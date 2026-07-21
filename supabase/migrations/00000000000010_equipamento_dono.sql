-- ============================================================
-- MEDIA CHURCH — Dono do equipamento (da igreja x pessoal)
-- ============================================================
-- owner_id NULL  = "Equipamento da igreja" (gerido por admin/gerente/líder)
-- owner_id <user> = "Equipamento de <fulano>" (o voluntário cadastra o SEU)
-- Ambos entram no mesmo inventário; a etiqueta diferencia.

alter table public.equipments
  add column owner_id uuid references public.profiles (id) on delete set null;

create index idx_equipments_owner on public.equipments (owner_id);

-- RLS é permissiva (OR). A policy de manager (equipments_manage) já deixa
-- admin/gerente/master gerir TUDO. Aqui acrescentamos: o membro comum pode
-- gerir SÓ o equipamento pessoal dele (owner_id = ele mesmo).
create policy equipments_self_personal on public.equipments
  for all
  using (public.is_church_member(church_id) and owner_id = auth.uid())
  with check (public.is_church_member(church_id) and owner_id = auth.uid());
