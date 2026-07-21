-- ============================================================
-- MEDIA CHURCH — Módulo Infantil (Fase A): cadastro, turmas e
-- check-in/check-out com retirada autorizada
-- ============================================================
-- Ver spec: docs/superpowers/specs/2026-07-21-modulo-infantil-design.md
-- Dados de MENORES (LGPD art. 14) + segurança física na entrega.
-- Tudo carrega ministry_id (o setor Infantil) e herda a parede por setor.
--
-- Quem enxerga, explicitamente:
--   LEITURA : membro ativo do setor Infantil  +  coordenador/admin da igreja
--   ESCRITA : liderança do setor (gerente/líder)  +  coordenador/admin
--   exceção: child_checkins também é ESCRITO por qualquer membro do setor
--            (o voluntário de plantão faz check-in e registra a retirada)

-- ---------- Turmas por faixa etária ----------
create table public.child_classes (
  id             uuid primary key default gen_random_uuid(),
  church_id      uuid not null references public.churches (id) on delete cascade,
  ministry_id    uuid not null references public.ministries (id) on delete cascade,
  name           text not null check (char_length(name) between 2 and 60),
  min_age_months int not null default 0 check (min_age_months >= 0),
  max_age_months int not null default 216 check (max_age_months > 0),
  sort_order     int not null default 0,
  created_at     timestamptz not null default now(),
  check (max_age_months >= min_age_months)
);
create index idx_child_classes_ministry on public.child_classes (ministry_id, sort_order);

-- ---------- Responsáveis ----------
-- user_id não-nulo = é membro com conta → recebe Web Push direto.
create table public.guardians (
  id           uuid primary key default gen_random_uuid(),
  church_id    uuid not null references public.churches (id) on delete cascade,
  ministry_id  uuid not null references public.ministries (id) on delete cascade,
  user_id      uuid references public.profiles (id) on delete set null,
  full_name    text not null check (char_length(full_name) between 2 and 120),
  phone        text check (phone is null or char_length(phone) <= 30),
  created_at   timestamptz not null default now()
);
create index idx_guardians_ministry on public.guardians (ministry_id);
create index idx_guardians_user on public.guardians (user_id);

-- ---------- Crianças ----------
-- Campos mínimos e justificados (LGPD): saúde/alergia existem para uso em
-- emergência; imagem é consentimento SEPARADO do consentimento de cadastro.
create table public.children (
  id                      uuid primary key default gen_random_uuid(),
  church_id               uuid not null references public.churches (id) on delete cascade,
  ministry_id             uuid not null references public.ministries (id) on delete cascade,
  full_name               text not null check (char_length(full_name) between 2 and 120),
  birth_date              date not null,
  allergies               text check (allergies is null or char_length(allergies) <= 500),
  health_notes            text check (health_notes is null or char_length(health_notes) <= 1000),
  special_needs           text check (special_needs is null or char_length(special_needs) <= 1000),
  emergency_contact_name  text check (emergency_contact_name is null or char_length(emergency_contact_name) <= 120),
  emergency_contact_phone text check (emergency_contact_phone is null or char_length(emergency_contact_phone) <= 30),
  -- consentimento do cadastro (obrigatório) e de imagem (separado)
  consent_at              timestamptz not null default now(),
  consent_guardian_id     uuid references public.guardians (id) on delete set null,
  photo_consent           boolean not null default false,
  photo_consent_at        timestamptz,
  notes                   text check (notes is null or char_length(notes) <= 1000),
  active                  boolean not null default true,
  created_at              timestamptz not null default now(),
  updated_at              timestamptz not null default now()
);
create index idx_children_ministry on public.children (ministry_id, active);
create trigger children_updated_at
  before update on public.children
  for each row execute function public.set_updated_at();

-- ---------- Autorização de retirada (o coração da segurança) ----------
create table public.child_guardians (
  child_id     uuid not null references public.children (id) on delete cascade,
  guardian_id  uuid not null references public.guardians (id) on delete cascade,
  church_id    uuid not null references public.churches (id) on delete cascade,
  relationship text check (relationship is null or char_length(relationship) <= 40),
  can_pickup   boolean not null default true,
  is_primary   boolean not null default false,
  created_at   timestamptz not null default now(),
  primary key (child_id, guardian_id)
);
create index idx_child_guardians_guardian on public.child_guardians (guardian_id);

-- ---------- Presença na sessão (check-in / check-out) ----------
create table public.child_checkins (
  id              uuid primary key default gen_random_uuid(),
  church_id       uuid not null references public.churches (id) on delete cascade,
  ministry_id     uuid not null references public.ministries (id) on delete cascade,
  event_id        uuid not null references public.events (id) on delete cascade,
  class_id        uuid references public.child_classes (id) on delete set null,
  child_id        uuid not null references public.children (id) on delete cascade,
  code            text not null check (char_length(code) between 3 and 8),
  checked_in_at   timestamptz not null default now(),
  checked_in_by   uuid references public.profiles (id) on delete set null,
  checked_out_at  timestamptz,
  checked_out_by  uuid references public.profiles (id) on delete set null,
  picked_up_by    uuid references public.guardians (id) on delete set null,
  override_reason text check (override_reason is null or char_length(override_reason) <= 300),
  override_by     uuid references public.profiles (id) on delete set null,
  unique (event_id, child_id),
  unique (event_id, code)
);
create index idx_child_checkins_event on public.child_checkins (event_id);
create index idx_child_checkins_child on public.child_checkins (child_id);

-- ---------- GUARD: a criança só sai com quem está autorizado ----------
-- Vive no banco (não só na tela): chamada direta à API não contorna.
create or replace function public.guard_child_pickup()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.picked_up_by is not null
     and new.picked_up_by is distinct from old.picked_up_by then

    if not exists (
      select 1 from child_guardians cg
      where cg.child_id = new.child_id
        and cg.guardian_id = new.picked_up_by
        and cg.can_pickup
    ) then
      -- pessoa NÃO autorizada: exige justificativa...
      if new.override_reason is null or char_length(trim(new.override_reason)) < 5 then
        raise exception 'pickup_not_authorized';
      end if;
      -- ...e que quem liberou seja liderança do setor ou coordenação
      if not (
        public.is_church_coord(new.church_id)
        or public.has_ministry_role(new.ministry_id, array['gerente', 'lider']::public.ministry_role[])
      ) then
        raise exception 'override_requires_leader';
      end if;
      new.override_by := auth.uid();
    end if;
  end if;
  return new;
end;
$$;

create trigger child_checkins_guard_pickup
  before update on public.child_checkins
  for each row execute function public.guard_child_pickup();

-- ---------- Turmas padrão (a igreja pode editar depois) ----------
create or replace function public.seed_child_classes(p_ministry uuid)
returns void language plpgsql security definer set search_path = public as $$
declare v_church uuid;
begin
  select church_id into v_church from ministries where id = p_ministry;
  if v_church is null then return; end if;
  insert into child_classes (church_id, ministry_id, name, min_age_months, max_age_months, sort_order)
  values
    (v_church, p_ministry, 'Berçário',  0,   35,  1),
    (v_church, p_ministry, 'Maternal',  36,  59,  2),
    (v_church, p_ministry, 'Jardim',    60,  83,  3),
    (v_church, p_ministry, 'Primários', 84,  119, 4),
    (v_church, p_ministry, 'Juniores',  120, 156, 5)
  on conflict do nothing;
end;
$$;
grant execute on function public.seed_child_classes(uuid) to authenticated;

-- ---------- RLS ----------
alter table public.child_classes enable row level security;
alter table public.guardians enable row level security;
alter table public.children enable row level security;
alter table public.child_guardians enable row level security;
alter table public.child_checkins enable row level security;

-- leitura: setor Infantil + coordenação da igreja
create policy child_classes_select on public.child_classes
  for select using (public.is_ministry_member(ministry_id) or public.is_church_coord(church_id));
create policy guardians_select on public.guardians
  for select using (public.is_ministry_member(ministry_id) or public.is_church_coord(church_id));
create policy children_select on public.children
  for select using (public.is_ministry_member(ministry_id) or public.is_church_coord(church_id));
create policy child_checkins_select on public.child_checkins
  for select using (public.is_ministry_member(ministry_id) or public.is_church_coord(church_id));
-- child_guardians não tem ministry_id: ancora na criança
create policy child_guardians_select on public.child_guardians
  for select using (
    exists (
      select 1 from children c
      where c.id = child_id
        and (public.is_ministry_member(c.ministry_id) or public.is_church_coord(c.church_id))
    )
  );

-- escrita: liderança do setor + coordenação
create policy child_classes_manage on public.child_classes
  for all using (
    public.is_church_coord(church_id)
    or public.has_ministry_role(ministry_id, array['gerente', 'lider']::public.ministry_role[])
  );
create policy guardians_manage on public.guardians
  for all using (
    public.is_church_coord(church_id)
    or public.has_ministry_role(ministry_id, array['gerente', 'lider']::public.ministry_role[])
  );
create policy children_manage on public.children
  for all using (
    public.is_church_coord(church_id)
    or public.has_ministry_role(ministry_id, array['gerente', 'lider']::public.ministry_role[])
  );
create policy child_guardians_manage on public.child_guardians
  for all using (
    exists (
      select 1 from children c
      where c.id = child_id
        and (
          public.is_church_coord(c.church_id)
          or public.has_ministry_role(c.ministry_id, array['gerente', 'lider']::public.ministry_role[])
        )
    )
  );

-- check-in/out: qualquer membro do setor (voluntário de plantão) + coordenação
create policy child_checkins_manage on public.child_checkins
  for all using (public.is_ministry_member(ministry_id) or public.is_church_coord(church_id));

-- ---------- Auditoria de escrita ----------
create trigger audit_children
  after insert or update or delete on public.children
  for each row execute function public.log_audit();
create trigger audit_child_checkins
  after insert or update or delete on public.child_checkins
  for each row execute function public.log_audit();
