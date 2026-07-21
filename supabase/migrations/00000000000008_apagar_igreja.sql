-- ============================================================
-- MEDIA CHURCH — Apagar igreja (somente admin/master)
-- ============================================================
-- Apagar a igreja é ação do DONO (admin da igreja) ou do master.
-- is_church_admin(id) já retorna true para o master (migration 7).
-- O delete cascateia todos os dados da igreja (church_id ON DELETE CASCADE).
-- A UI exige digitar o nome exato da igreja para confirmar.

create policy churches_delete on public.churches
  for delete using (public.is_church_admin(id));
