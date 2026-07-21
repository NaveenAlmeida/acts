-- ============================================================
-- MEDIA CHURCH — Fase 4: Manutenções + Avaliações
-- ============================================================

create type public.maintenance_priority as enum ('baixa', 'media', 'alta', 'urgente');
create type public.maintenance_status as enum (
  'aberto', 'em_andamento', 'aguardando_peca', 'concluido', 'cancelado'
);

-- ---------- Chamados de manutenção ----------
create table public.maintenance_tickets (
  id            uuid primary key default gen_random_uuid(),
  church_id     uuid not null references public.churches (id) on delete cascade,
  equipment_id  uuid not null references public.equipments (id) on delete cascade,
  opened_by     uuid references public.profiles (id) on delete set null,
  title         text not null check (char_length(title) between 2 and 120),
  description   text,
  priority      public.maintenance_priority not null default 'media',
  status        public.maintenance_status not null default 'aberto',
  supplier      text,
  parts         text,
  cost_cents    bigint check (cost_cents is null or cost_cents >= 0),
  photos        jsonb not null default '[]',
  opened_at     timestamptz not null default now(),
  resolved_at   timestamptz,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create index idx_maintenance_church on public.maintenance_tickets (church_id, status);
create index idx_maintenance_equipment on public.maintenance_tickets (equipment_id);

create trigger maintenance_updated_at
  before update on public.maintenance_tickets
  for each row execute function public.set_updated_at();

-- Ciclo de vida: chamado aberto derruba o equipamento; concluído/cancelado devolve
create or replace function public.sync_equipment_maintenance()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'INSERT' then
    update equipments set status = 'manutencao' where id = new.equipment_id;
    insert into equipment_events (church_id, equipment_id, user_id, event_type, payload)
    values (new.church_id, new.equipment_id, auth.uid(), 'manutencao',
      jsonb_build_object('acao', 'chamado_aberto', 'chamado', new.title, 'prioridade', new.priority));
    return new;
  end if;

  if old.status not in ('concluido', 'cancelado')
     and new.status in ('concluido', 'cancelado') then
    new.resolved_at := coalesce(new.resolved_at, now());
    update equipments set status = 'disponivel' where id = new.equipment_id;
    insert into equipment_events (church_id, equipment_id, user_id, event_type, payload)
    values (new.church_id, new.equipment_id, auth.uid(), 'manutencao',
      jsonb_build_object(
        'acao', case when new.status = 'concluido' then 'chamado_concluido' else 'chamado_cancelado' end,
        'chamado', new.title,
        'custo_cents', new.cost_cents,
        'tempo_parado_horas', round(extract(epoch from (coalesce(new.resolved_at, now()) - new.opened_at)) / 3600)
      ));
  end if;
  return new;
end;
$$;

create trigger maintenance_sync_insert
  after insert on public.maintenance_tickets
  for each row execute function public.sync_equipment_maintenance();
create trigger maintenance_sync_update
  before update on public.maintenance_tickets
  for each row execute function public.sync_equipment_maintenance();

-- ---------- Avaliações pós-culto ----------
create table public.evaluations (
  id               uuid primary key default gen_random_uuid(),
  church_id        uuid not null references public.churches (id) on delete cascade,
  assignment_id    uuid not null unique references public.assignments (id) on delete cascade,
  event_id         uuid not null references public.events (id) on delete cascade,
  user_id          uuid not null references public.profiles (id) on delete cascade,
  evaluator_id     uuid references public.profiles (id) on delete set null,
  pontualidade     int not null check (pontualidade between 1 and 5),
  organizacao      int not null check (organizacao between 1 and 5),
  conhecimento     int not null check (conhecimento between 1 and 5),
  comunicacao      int not null check (comunicacao between 1 and 5),
  trabalho_equipe  int not null check (trabalho_equipe between 1 and 5),
  comprometimento  int not null check (comprometimento between 1 and 5),
  notes            text,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);

create index idx_evaluations_user on public.evaluations (church_id, user_id);
create index idx_evaluations_event on public.evaluations (event_id);

create trigger evaluations_updated_at
  before update on public.evaluations
  for each row execute function public.set_updated_at();

-- ---------- RLS ----------
alter table public.maintenance_tickets enable row level security;
alter table public.evaluations enable row level security;

create policy maintenance_select on public.maintenance_tickets
  for select using (public.is_church_member(church_id));
create policy maintenance_insert on public.maintenance_tickets
  for insert with check (public.is_church_leader(church_id));
create policy maintenance_update on public.maintenance_tickets
  for update using (public.is_church_leader(church_id));

-- avaliado lê a própria; líderes leem todas; só líder escreve
create policy evaluations_select on public.evaluations
  for select using (user_id = auth.uid() or public.is_church_leader(church_id));
create policy evaluations_insert on public.evaluations
  for insert with check (public.is_church_leader(church_id));
create policy evaluations_update on public.evaluations
  for update using (public.is_church_leader(church_id));

-- ---------- Auditoria ----------
create trigger audit_maintenance
  after insert or update or delete on public.maintenance_tickets
  for each row execute function public.log_audit();
create trigger audit_evaluations
  after insert or update or delete on public.evaluations
  for each row execute function public.log_audit();
