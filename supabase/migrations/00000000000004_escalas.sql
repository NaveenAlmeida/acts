-- ============================================================
-- MEDIA CHURCH — Fase 3: Escalas (eventos, assignments, equipamentos)
-- ============================================================

create type public.assignment_status as enum (
  'convidado', 'confirmado', 'substituicao_solicitada', 'ausente', 'presente'
);

create type public.substitution_status as enum ('aberta', 'atendida', 'cancelada');

-- ---------- Tipos de evento ----------
create table public.event_types (
  id          uuid primary key default gen_random_uuid(),
  church_id   uuid not null references public.churches (id) on delete cascade,
  name        text not null check (char_length(name) between 2 and 60),
  slug        text not null,
  created_at  timestamptz not null default now(),
  unique (church_id, slug)
);

create or replace function public.seed_church_event_types(p_church uuid)
returns void language sql security definer set search_path = public as $$
  insert into event_types (church_id, name, slug)
  values
    (p_church, 'Culto', 'culto'),
    (p_church, 'Conferência', 'conferencia'),
    (p_church, 'Congresso', 'congresso'),
    (p_church, 'Evento externo', 'evento-externo'),
    (p_church, 'Ensaio', 'ensaio'),
    (p_church, 'Reunião', 'reuniao')
  on conflict (church_id, slug) do nothing;
$$;

create or replace function public.create_church(p_name text, p_slug text)
returns uuid language plpgsql security definer set search_path = public as $$
declare
  v_id uuid;
begin
  if auth.uid() is null then
    raise exception 'not_authenticated';
  end if;
  insert into churches (name, slug) values (p_name, p_slug) returning id into v_id;
  insert into church_members (church_id, user_id, role) values (v_id, auth.uid(), 'admin');
  perform public.seed_church_skills(v_id);
  perform public.seed_church_categories(v_id);
  perform public.seed_church_event_types(v_id);
  return v_id;
end;
$$;

do $$
declare c record;
begin
  for c in select id from public.churches loop
    perform public.seed_church_event_types(c.id);
  end loop;
end $$;

-- ---------- Helper: líder (admin, gerente ou líder de ministério) ----------
create or replace function public.is_church_leader(p_church uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select public.is_church_admin(p_church) or exists (
    select 1 from ministry_members
    where church_id = p_church and user_id = auth.uid()
      and active and role in ('gerente', 'lider')
  );
$$;

-- ---------- Eventos ----------
create table public.events (
  id           uuid primary key default gen_random_uuid(),
  church_id    uuid not null references public.churches (id) on delete cascade,
  ministry_id  uuid references public.ministries (id) on delete set null,
  type_id      uuid references public.event_types (id) on delete set null,
  title        text not null check (char_length(title) between 2 and 120),
  description  text,
  location     text,
  map_url      text,
  script       text,
  checklist    jsonb not null default '[]',
  starts_at    timestamptz not null,
  ends_at      timestamptz,
  created_by   uuid references public.profiles (id) on delete set null,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

create index idx_events_church_date on public.events (church_id, starts_at);

create trigger events_updated_at
  before update on public.events
  for each row execute function public.set_updated_at();

-- ---------- Escala (assignments) ----------
create table public.assignments (
  id            uuid primary key default gen_random_uuid(),
  church_id     uuid not null references public.churches (id) on delete cascade,
  event_id      uuid not null references public.events (id) on delete cascade,
  user_id       uuid not null references public.profiles (id) on delete cascade,
  role_name     text not null check (char_length(role_name) between 2 and 80),
  arrival_time  timestamptz,
  items_to_bring text,
  status        public.assignment_status not null default 'convidado',
  leader_id     uuid references public.profiles (id) on delete set null,
  notes         text,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  unique (event_id, user_id, role_name)
);

create index idx_assignments_event on public.assignments (event_id);
create index idx_assignments_user on public.assignments (user_id, created_at desc);

create trigger assignments_updated_at
  before update on public.assignments
  for each row execute function public.set_updated_at();

-- Voluntário só transita o próprio status para estados permitidos
create or replace function public.guard_assignment_update()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if public.is_church_leader(new.church_id) then
    return new;
  end if;
  -- não-líder: apenas o próprio assignment
  if new.user_id <> auth.uid() or old.user_id <> auth.uid() then
    raise exception 'not_allowed';
  end if;
  -- só o campo status pode mudar
  if to_jsonb(new) - 'status' - 'updated_at' is distinct from to_jsonb(old) - 'status' - 'updated_at' then
    raise exception 'only_status_change_allowed';
  end if;
  -- transições permitidas ao voluntário
  if not (
    (old.status = 'convidado' and new.status in ('confirmado', 'substituicao_solicitada'))
    or (old.status = 'confirmado' and new.status = 'substituicao_solicitada')
    or (old.status = 'substituicao_solicitada' and new.status = 'confirmado')
  ) then
    raise exception 'invalid_status_transition';
  end if;
  return new;
end;
$$;

create trigger assignments_guard_update
  before update on public.assignments
  for each row execute function public.guard_assignment_update();

-- ---------- Equipamentos vinculados ----------
create table public.assignment_equipments (
  assignment_id  uuid not null references public.assignments (id) on delete cascade,
  equipment_id   uuid not null references public.equipments (id) on delete cascade,
  church_id      uuid not null references public.churches (id) on delete cascade,
  created_at     timestamptz not null default now(),
  primary key (assignment_id, equipment_id)
);

create index idx_assignment_equipments_church on public.assignment_equipments (church_id);

-- uso registrado automaticamente no histórico do equipamento
create or replace function public.log_equipment_use()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_event record;
  v_user uuid;
begin
  select e.title, e.starts_at, a.user_id into v_event
  from assignments a join events e on e.id = a.event_id
  where a.id = new.assignment_id;

  select user_id into v_user from assignments where id = new.assignment_id;

  insert into equipment_events (church_id, equipment_id, user_id, event_type, payload)
  values (
    new.church_id,
    new.equipment_id,
    v_user,
    'uso',
    jsonb_build_object('evento', v_event.title, 'data', v_event.starts_at)
  );
  return new;
end;
$$;

create trigger assignment_equipments_log_use
  after insert on public.assignment_equipments
  for each row execute function public.log_equipment_use();

-- ---------- Substituições ----------
create table public.substitution_requests (
  id             uuid primary key default gen_random_uuid(),
  church_id      uuid not null references public.churches (id) on delete cascade,
  assignment_id  uuid not null references public.assignments (id) on delete cascade,
  requested_by   uuid not null references public.profiles (id) on delete cascade,
  reason         text,
  status         public.substitution_status not null default 'aberta',
  resolved_by    uuid references public.profiles (id) on delete set null,
  created_at     timestamptz not null default now()
);

create index idx_substitution_church on public.substitution_requests (church_id, status);

-- ---------- RLS ----------
alter table public.event_types enable row level security;
alter table public.events enable row level security;
alter table public.assignments enable row level security;
alter table public.assignment_equipments enable row level security;
alter table public.substitution_requests enable row level security;

create policy event_types_select on public.event_types
  for select using (public.is_church_member(church_id));
create policy event_types_manage on public.event_types
  for all using (public.is_church_manager(church_id));

create policy events_select on public.events
  for select using (public.is_church_member(church_id));
create policy events_manage on public.events
  for all using (public.is_church_leader(church_id));

create policy assignments_select on public.assignments
  for select using (public.is_church_member(church_id));
create policy assignments_leader_manage on public.assignments
  for all using (public.is_church_leader(church_id));
-- voluntário atualiza o próprio (trigger valida a transição)
create policy assignments_self_update on public.assignments
  for update using (user_id = auth.uid());

create policy assignment_equipments_select on public.assignment_equipments
  for select using (public.is_church_member(church_id));
create policy assignment_equipments_manage on public.assignment_equipments
  for all using (public.is_church_leader(church_id));

create policy substitution_select on public.substitution_requests
  for select using (
    requested_by = auth.uid() or public.is_church_leader(church_id)
  );
create policy substitution_insert_own on public.substitution_requests
  for insert with check (
    requested_by = auth.uid() and public.is_church_member(church_id)
  );
create policy substitution_leader_update on public.substitution_requests
  for update using (public.is_church_leader(church_id));

-- ---------- Auditoria ----------
create trigger audit_events
  after insert or update or delete on public.events
  for each row execute function public.log_audit();
create trigger audit_assignments
  after insert or update or delete on public.assignments
  for each row execute function public.log_audit();
