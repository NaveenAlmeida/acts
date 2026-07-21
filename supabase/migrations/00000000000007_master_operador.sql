-- ============================================================
-- MEDIA CHURCH — Usuário MASTER opera em todas as igrejas
-- ============================================================
-- Antes o super-admin era só-leitura. Agora o master (allowlist
-- platform_admin_emails) ATUA como admin/gerente em QUALQUER igreja
-- cadastrada — pode operar, não só visualizar.
--
-- Fazemos isso somando `is_platform_admin()` aos helpers de permissão.
-- Como eles são SECURITY DEFINER, não há recursão com o RLS.

create or replace function public.is_church_member(p_church uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select public.is_platform_admin() or exists (
    select 1 from church_members
    where church_id = p_church and user_id = auth.uid() and status = 'active'
  );
$$;

create or replace function public.is_church_admin(p_church uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select public.is_platform_admin() or exists (
    select 1 from church_members
    where church_id = p_church and user_id = auth.uid()
      and role = 'admin' and status = 'active'
  );
$$;

create or replace function public.is_church_manager(p_church uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select public.is_platform_admin()
    or public.is_church_admin(p_church)
    or exists (
      select 1 from ministry_members
      where church_id = p_church and user_id = auth.uid()
        and active and role = 'gerente'
    );
$$;

create or replace function public.is_church_leader(p_church uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select public.is_platform_admin()
    or public.is_church_admin(p_church)
    or exists (
      select 1 from ministry_members
      where church_id = p_church and user_id = auth.uid()
        and active and role in ('gerente', 'lider')
    );
$$;
