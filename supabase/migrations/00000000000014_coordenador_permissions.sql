-- ============================================================
-- MEDIA CHURCH — Papel "Coordenador" de igreja (2/2: permissões)
-- ============================================================
-- Estende os helpers de permissão para reconhecer o coordenador,
-- e eleva 2 policies de admin→coord (criar ministério, organizar
-- pessoas nos ministérios). Preserva o join real da migration 11.
--
-- Fica INTOCADO (só admin): renomear/apagar igreja, promover papel
-- de igreja (church_members_admin_write), ver logs de auditoria.
-- Como atribuir papel de igreja é gated por admin, o coordenador
-- não se autopromove nem nomeia outro coordenador.

-- ---------- Helper: gestão da igreja (admin ou coordenador) ----------
create or replace function public.is_church_coord(p_church uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select public.is_platform_admin() or exists (
    select 1 from church_members
    where church_id = p_church and user_id = auth.uid()
      and status = 'active' and role in ('admin', 'coordenador')
  );
$$;

-- ---------- Helpers operacionais: incluem coordenador ----------
-- (mantêm o join real ministry_members→ministries da migration 11)
create or replace function public.is_church_manager(p_church uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select public.is_church_coord(p_church)
    or exists (
      select 1
      from ministry_members mm
      join ministries m on m.id = mm.ministry_id
      where m.church_id = p_church
        and mm.user_id = auth.uid()
        and mm.active
        and mm.role = 'gerente'
    );
$$;

create or replace function public.is_church_leader(p_church uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select public.is_church_coord(p_church)
    or exists (
      select 1
      from ministry_members mm
      join ministries m on m.id = mm.ministry_id
      where m.church_id = p_church
        and mm.user_id = auth.uid()
        and mm.active
        and mm.role in ('gerente', 'lider')
    );
$$;

-- ---------- Alcance pleno: criar ministério + organizar pessoas ----------
drop policy if exists ministries_admin_write on public.ministries;
create policy ministries_admin_write on public.ministries
  for all using (public.is_church_coord(church_id));

drop policy if exists ministry_members_manage on public.ministry_members;
create policy ministry_members_manage on public.ministry_members
  for all using (
    public.is_church_coord(church_id)
    or public.has_ministry_role(ministry_id, array['gerente']::public.ministry_role[])
  );
