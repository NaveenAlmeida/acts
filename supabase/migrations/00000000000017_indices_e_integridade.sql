-- ============================================================
-- MEDIA CHURCH — Índices de performance + CHECKs de integridade
-- ============================================================
-- Auditoria 360° (banco/arquitetura): FKs sem índice viram seq scan
-- em joins reversos e cascade; ordenações sem índice fazem sort em
-- memória; jsonb/datas sem CHECK permitem linha inconsistente.
-- Índices normais (não CONCURRENTLY) — tabelas ainda pequenas; para
-- tabelas grandes no futuro, usar CREATE INDEX CONCURRENTLY fora de tx.

-- ---------- Índices de FK (joins reversos e ON DELETE CASCADE) ----------
create index if not exists idx_assignment_equipments_equipment
  on public.assignment_equipments (equipment_id);
create index if not exists idx_events_type on public.events (type_id);
create index if not exists idx_events_ministry on public.events (ministry_id);
create index if not exists idx_assignments_leader on public.assignments (leader_id);
create index if not exists idx_maintenance_opened_by
  on public.maintenance_tickets (opened_by);
create index if not exists idx_substitution_assignment
  on public.substitution_requests (assignment_id);
create index if not exists idx_member_skills_approved_by
  on public.member_skills (approved_by);
create index if not exists idx_evaluations_evaluator
  on public.evaluations (evaluator_id);

-- ---------- Índices de ordenação/filtro das listas quentes ----------
-- lista de manutenções ordena por created_at desc
create index if not exists idx_maintenance_church_created
  on public.maintenance_tickets (church_id, created_at desc);
-- lista de equipamentos filtra church_id + status<>baixado, ordena por name
create index if not exists idx_equipments_church_name
  on public.equipments (church_id, name)
  where status <> 'baixado';
-- painel global (super-admin) ordena audit_logs por created_at sem filtro
create index if not exists idx_audit_logs_created_at
  on public.audit_logs (created_at desc);
-- badge de escalas pendentes: assignments do usuário aguardando confirmação
create index if not exists idx_assignments_pendentes
  on public.assignments (user_id, church_id)
  where status = 'convidado';

-- ---------- CHECKs de integridade ----------
-- evento não pode terminar antes de começar
alter table public.events drop constraint if exists events_time_order;
alter table public.events add constraint events_time_order
  check (ends_at is null or ends_at >= starts_at);

-- limites de tamanho em jsonb de payload do cliente (evita linha patológica)
alter table public.maintenance_tickets drop constraint if exists photos_max;
alter table public.maintenance_tickets add constraint photos_max
  check (jsonb_array_length(photos) <= 20);
alter table public.events drop constraint if exists checklist_max;
alter table public.events add constraint checklist_max
  check (jsonb_array_length(checklist) <= 100);
