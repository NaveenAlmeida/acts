-- ============================================================
-- MEDIA CHURCH — Correção de segurança: IDOR cross-tenant em
-- evaluations, maintenance_tickets e assignment_equipments
-- ============================================================
-- PROBLEMA: as policies de insert só confirmavam is_church_leader
-- da igreja INFORMADA no payload, sem validar que os demais IDs
-- (assignment_id, event_id, equipment_id, user_id) de fato
-- pertencem a essa igreja / entre si. Um líder (inclusive um
-- obtido por escalação) podia:
--   S-4: fabricar avaliação para qualquer usuário da plataforma
--   S-5: mudar status de equipamento de outra igreja (via trigger
--        sync_equipment_maintenance)
--   S-7: vincular equipamento de outra igreja a uma escala
--
-- SOLUÇÃO: triggers que DERIVAM os campos a partir do ID âncora
-- (fonte da verdade), tornando impossível forjar. Mesmo padrão
-- da migration 11.

-- ---------- S-4: evaluations ancoradas no assignment ----------
-- church_id, event_id e user_id derivam do assignment_id real.
create or replace function public.enforce_evaluation_consistency()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  a record;
begin
  select church_id, event_id, user_id into a
  from public.assignments where id = new.assignment_id;

  if a is null then
    raise exception 'assignment_id % inexistente', new.assignment_id;
  end if;

  new.church_id := a.church_id;
  new.event_id := a.event_id;
  new.user_id := a.user_id;
  return new;
end;
$$;

drop trigger if exists trg_evaluation_consistency on public.evaluations;
create trigger trg_evaluation_consistency
  before insert or update on public.evaluations
  for each row execute function public.enforce_evaluation_consistency();

-- ---------- S-5: ticket ancorado no equipamento ----------
-- church_id deriva do equipment_id (impede referenciar/derrubar
-- equipamento de outra igreja).
create or replace function public.enforce_ticket_church()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_church uuid;
begin
  select church_id into v_church
  from public.equipments where id = new.equipment_id;

  if v_church is null then
    raise exception 'equipment_id % inexistente', new.equipment_id;
  end if;

  new.church_id := v_church;
  return new;
end;
$$;

-- roda antes do sync_equipment_maintenance (ambos BEFORE UPDATE:
-- 'a_' garante ordem alfabética anterior; no INSERT o sync é AFTER)
drop trigger if exists a_trg_ticket_church on public.maintenance_tickets;
create trigger a_trg_ticket_church
  before insert or update on public.maintenance_tickets
  for each row execute function public.enforce_ticket_church();

-- ---------- S-7: vínculo escala×equipamento na mesma igreja ----------
-- exige que assignment e equipment sejam da MESMA igreja; ancora church_id.
create or replace function public.enforce_assignment_equipment_church()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_assignment_church uuid;
  v_equipment_church uuid;
begin
  select church_id into v_assignment_church
  from public.assignments where id = new.assignment_id;
  select church_id into v_equipment_church
  from public.equipments where id = new.equipment_id;

  if v_assignment_church is null or v_equipment_church is null then
    raise exception 'assignment ou equipment inexistente';
  end if;
  if v_assignment_church <> v_equipment_church then
    raise exception 'assignment e equipment de igrejas diferentes';
  end if;

  new.church_id := v_assignment_church;
  return new;
end;
$$;

drop trigger if exists trg_assignment_equipment_church on public.assignment_equipments;
create trigger trg_assignment_equipment_church
  before insert or update on public.assignment_equipments
  for each row execute function public.enforce_assignment_equipment_church();

-- ---------- S-6: ex-membro não edita a própria escala ----------
-- adiciona checagem de membership ativo à policy de self-update.
drop policy if exists assignments_self_update on public.assignments;
create policy assignments_self_update on public.assignments
  for update using (
    user_id = auth.uid() and public.is_church_member(church_id)
  );
