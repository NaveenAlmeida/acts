-- ============================================================
-- MEDIA CHURCH — Super-admin de plataforma (visão global)
-- ============================================================

-- ---------- Grants do service_role (backend key) ----------
-- A migration 1 só concedeu DML a `authenticated`. O service_role (chave
-- secreta de backend, bypassa RLS) precisa dos grants de tabela também.
grant select, insert, update, delete on all tables in schema public to service_role;
grant usage, select on all sequences in schema public to service_role;
alter default privileges in schema public
  grant select, insert, update, delete on tables to service_role;
alter default privileges in schema public
  grant usage, select on sequences to service_role;
-- Um super-admin enxerga TODAS as igrejas, equipes, patrimônio e logs.
-- Distinto do "admin" de igreja (dono de um tenant). Somente leitura
-- cross-tenant — a escrita continua isolada por igreja.

-- ---------- Allowlist de e-mails autorizados ----------
create table public.platform_admin_emails (
  email       text primary key,
  created_at  timestamptz not null default now()
);

-- E-mails do dono da plataforma (viram super-admin ao se cadastrar).
-- TROQUE pelos e-mails reais dos administradores da sua instância.
insert into public.platform_admin_emails (email) values
  ('admin@suaigreja.exemplo'),
  ('admin2@suaigreja.exemplo')
on conflict do nothing;

-- ---------- Super-admins efetivos ----------
create table public.platform_admins (
  user_id     uuid primary key references public.profiles (id) on delete cascade,
  granted_at  timestamptz not null default now()
);

-- ---------- Helper ----------
create or replace function public.is_platform_admin()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from platform_admins where user_id = auth.uid());
$$;

-- ---------- Concessão automática no signup ----------
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into profiles (id, full_name)
  values (new.id, coalesce(new.raw_user_meta_data ->> 'full_name', ''));

  -- e-mail na allowlist → super-admin da plataforma
  if exists (
    select 1 from platform_admin_emails
    where lower(email) = lower(new.email)
  ) then
    insert into platform_admins (user_id) values (new.id)
    on conflict do nothing;
  end if;

  return new;
end;
$$;

-- Backfill: usuários já existentes cujo e-mail esteja na allowlist
insert into public.platform_admins (user_id)
select u.id
from auth.users u
join public.platform_admin_emails e on lower(e.email) = lower(u.email)
on conflict do nothing;

-- ---------- RLS das novas tabelas ----------
alter table public.platform_admin_emails enable row level security;
alter table public.platform_admins enable row level security;

create policy platform_admin_emails_read on public.platform_admin_emails
  for select using (public.is_platform_admin());

create policy platform_admins_read on public.platform_admins
  for select using (user_id = auth.uid() or public.is_platform_admin());

-- ---------- Leitura cross-tenant para super-admins ----------
-- RLS é permissiva: estas policies são OR com as existentes por tenant.
create policy churches_platform_read on public.churches
  for select using (public.is_platform_admin());
create policy profiles_platform_read on public.profiles
  for select using (public.is_platform_admin());
create policy church_members_platform_read on public.church_members
  for select using (public.is_platform_admin());
create policy ministries_platform_read on public.ministries
  for select using (public.is_platform_admin());
create policy ministry_members_platform_read on public.ministry_members
  for select using (public.is_platform_admin());
create policy skills_platform_read on public.skills
  for select using (public.is_platform_admin());
create policy member_skills_platform_read on public.member_skills
  for select using (public.is_platform_admin());
create policy briefing_platform_read on public.briefing_responses
  for select using (public.is_platform_admin());
create policy equipment_categories_platform_read on public.equipment_categories
  for select using (public.is_platform_admin());
create policy equipments_platform_read on public.equipments
  for select using (public.is_platform_admin());
create policy equipment_events_platform_read on public.equipment_events
  for select using (public.is_platform_admin());
create policy events_platform_read on public.events
  for select using (public.is_platform_admin());
create policy assignments_platform_read on public.assignments
  for select using (public.is_platform_admin());
create policy evaluations_platform_read on public.evaluations
  for select using (public.is_platform_admin());
create policy maintenance_platform_read on public.maintenance_tickets
  for select using (public.is_platform_admin());
create policy audit_logs_platform_read on public.audit_logs
  for select using (public.is_platform_admin());
