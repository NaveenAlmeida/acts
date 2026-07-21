-- ============================================================
-- MEDIA CHURCH — Escopo por setor (ministério) — 1/2: ADITIVO
-- ============================================================
-- Ver spec: docs/superpowers/specs/2026-07-21-escopo-por-ministerio-design.md
-- Passo aditivo e reversível: adiciona a dimensão de setor e faz backfill dos
-- dados atuais. NÃO troca policies aqui — o app continua funcionando church-wide.

-- ---------- Helper: membro ativo de um setor específico ----------
create or replace function public.is_ministry_member(p_ministry uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from ministry_members
    where ministry_id = p_ministry and user_id = auth.uid() and active
  );
$$;

-- ---------- Toda igreja nasce com um setor padrão ----------
-- Agora que a escala é por setor, criar igreja também cria o setor "Mídia" e
-- torna o criador (admin da igreja) gerente dele. Sem isso, uma igreja recém
-- criada não teria setor para escalar.
create or replace function public.create_church(p_name text, p_slug text)
returns uuid language plpgsql security definer set search_path = public as $$
declare
  v_id uuid;
  v_min uuid;
begin
  if auth.uid() is null then
    raise exception 'not_authenticated';
  end if;
  insert into churches (name, slug) values (p_name, p_slug) returning id into v_id;
  insert into church_members (church_id, user_id, role) values (v_id, auth.uid(), 'admin');
  perform public.seed_church_skills(v_id);
  perform public.seed_church_categories(v_id);
  perform public.seed_church_event_types(v_id);
  insert into ministries (church_id, name, slug)
    values (v_id, 'Mídia', 'midia')
    returning id into v_min;
  insert into ministry_members (ministry_id, church_id, user_id, role)
    values (v_min, v_id, auth.uid(), 'gerente');
  return v_id;
end;
$$;

-- ---------- Colunas de setor (NULLABLE por ora) ----------
alter table public.assignments
  add column if not exists ministry_id uuid references public.ministries (id) on delete cascade;
alter table public.equipments
  add column if not exists ministry_id uuid references public.ministries (id) on delete set null;
alter table public.evaluations
  add column if not exists ministry_id uuid references public.ministries (id) on delete cascade;

-- ---------- Backfill ----------
-- Cada igreja recebe um setor padrão (o "Mídia" existente; senão, cria).
-- Escalas herdam o setor do evento quando marcado, senão o padrão.
-- Patrimônio atual entra como do setor Mídia (era a equipe de mídia).
-- o guard de update só permite mudança de status ao voluntário; o backfill é
-- operação administrativa (roda como postgres) — desliga o guard durante ele.
alter table public.assignments disable trigger assignments_guard_update;

do $$
declare
  c record;
  v_min uuid;
begin
  for c in select id from public.churches loop
    select id into v_min
    from public.ministries
    where church_id = c.id
    order by (slug = 'midia') desc, (name ilike 'm%dia') desc, created_at asc
    limit 1;

    if v_min is null then
      insert into public.ministries (church_id, name, slug)
      values (c.id, 'Mídia', 'midia')
      returning id into v_min;
    end if;

    update public.assignments a
      set ministry_id = coalesce(
        (select e.ministry_id from public.events e where e.id = a.event_id),
        v_min
      )
      where a.church_id = c.id and a.ministry_id is null;

    update public.equipments eq
      set ministry_id = v_min
      where eq.church_id = c.id and eq.ministry_id is null;
  end loop;
end $$;

alter table public.assignments enable trigger assignments_guard_update;

-- Avaliações herdam o setor da sua escala (após as escalas terem setor).
update public.evaluations ev
  set ministry_id = a.ministry_id
  from public.assignments a
  where a.id = ev.assignment_id and ev.ministry_id is null;

create index if not exists idx_assignments_ministry on public.assignments (ministry_id);
create index if not exists idx_equipments_ministry on public.equipments (ministry_id);
create index if not exists idx_evaluations_ministry on public.evaluations (ministry_id);

-- ---------- Default de setor (rede de segurança) ----------
-- O app já grava o ministry_id do setor ativo. Quando vier nulo (fluxos legados),
-- preenche a partir do evento ou do setor padrão da igreja — evita nulos e roda
-- ANTES do WITH CHECK da RLS (que valida has_ministry_role no ministry_id final).
create or replace function public.assignment_default_ministry()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.ministry_id is null then
    new.ministry_id := coalesce(
      (select e.ministry_id from public.events e where e.id = new.event_id),
      (select id from public.ministries where church_id = new.church_id
        order by (slug = 'midia') desc, created_at asc limit 1)
    );
  end if;
  return new;
end;
$$;
create trigger assignments_default_ministry
  before insert on public.assignments
  for each row execute function public.assignment_default_ministry();

create or replace function public.evaluation_default_ministry()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.ministry_id is null then
    new.ministry_id := (select ministry_id from public.assignments where id = new.assignment_id);
  end if;
  return new;
end;
$$;
create trigger evaluations_default_ministry
  before insert on public.evaluations
  for each row execute function public.evaluation_default_ministry();
