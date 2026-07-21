-- ============================================================
-- MEDIA CHURCH — Departamentos (personalizáveis) + evento por departamento
-- ============================================================
-- Departamento = para qual público/congregação é o evento (Jovens, Irmãs,
-- Crianças, Culto oficial...). Customizável por igreja, SEM lista predefinida.
-- Distinto de "ministério" (a equipe que serve).

create table public.departments (
  id          uuid primary key default gen_random_uuid(),
  church_id   uuid not null references public.churches (id) on delete cascade,
  name        text not null check (char_length(name) between 2 and 60),
  active      boolean not null default true,
  created_at  timestamptz not null default now()
);

create index idx_departments_church on public.departments (church_id);

-- Evento passa a poder apontar para um departamento (opcional).
alter table public.events
  add column department_id uuid references public.departments (id) on delete set null;

create index idx_events_department on public.events (department_id);

-- ---------- RLS ----------
alter table public.departments enable row level security;

-- leitura para membros da igreja (is_church_member já cobre o master)
create policy departments_select on public.departments
  for select using (public.is_church_member(church_id));

-- criar/editar/apagar: admin, gerente ou master (is_church_manager)
create policy departments_manage on public.departments
  for all using (public.is_church_manager(church_id));

-- ---------- Auditoria ----------
create trigger audit_departments
  after insert or update or delete on public.departments
  for each row execute function public.log_audit();
