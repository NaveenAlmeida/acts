-- ============================================================
-- MEDIA CHURCH — Escopo por setor (ministério) — 2/2: A PAREDE (RLS)
-- ============================================================
-- Ver spec: docs/superpowers/specs/2026-07-21-escopo-por-ministerio-design.md
-- Fecha a parede: escala/equipamento/avaliação passam a ser isolados por setor.
-- Coordenador de igreja (admin/coordenador) enxerga e gere todos os setores.
-- NÃO usar is_church_leader na parede: ele inclui líder de qualquer setor.

alter table public.assignments alter column ministry_id set not null;

-- ---------- assignments ----------
drop policy if exists assignments_select on public.assignments;
create policy assignments_select on public.assignments
  for select using (
    user_id = auth.uid()
    or public.is_church_coord(church_id)
    or public.is_ministry_member(ministry_id)
  );

drop policy if exists assignments_leader_manage on public.assignments;
create policy assignments_manage on public.assignments
  for all using (
    public.is_church_coord(church_id)
    or public.has_ministry_role(ministry_id, array['gerente', 'lider']::public.ministry_role[])
  );
-- assignments_self_update (voluntário muda o próprio status) permanece.

-- guard de update: bypass de líder agora é por setor (coord OU líder do setor)
create or replace function public.guard_assignment_update()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if public.is_church_coord(new.church_id)
     or public.has_ministry_role(new.ministry_id, array['gerente', 'lider']::public.ministry_role[]) then
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

-- ---------- equipments (setor + pool compartilhado: ministry_id null = compartilhado) ----------
drop policy if exists equipments_select on public.equipments;
create policy equipments_select on public.equipments
  for select using (
    public.is_church_member(church_id)
    and (
      ministry_id is null
      or public.is_church_coord(church_id)
      or public.is_ministry_member(ministry_id)
    )
  );

drop policy if exists equipments_manage on public.equipments;
create policy equipments_manage on public.equipments
  for all using (
    public.is_church_coord(church_id)
    or (
      ministry_id is not null
      and public.has_ministry_role(ministry_id, array['gerente', 'lider']::public.ministry_role[])
    )
  );

-- ---------- evaluations ----------
drop policy if exists evaluations_select on public.evaluations;
create policy evaluations_select on public.evaluations
  for select using (
    user_id = auth.uid()
    or public.is_church_coord(church_id)
    or public.is_ministry_member(ministry_id)
  );

drop policy if exists evaluations_insert on public.evaluations;
create policy evaluations_insert on public.evaluations
  for insert with check (
    public.is_church_coord(church_id)
    or public.has_ministry_role(ministry_id, array['gerente', 'lider']::public.ministry_role[])
  );

drop policy if exists evaluations_update on public.evaluations;
create policy evaluations_update on public.evaluations
  for update using (
    public.is_church_coord(church_id)
    or public.has_ministry_role(ministry_id, array['gerente', 'lider']::public.ministry_role[])
  );
