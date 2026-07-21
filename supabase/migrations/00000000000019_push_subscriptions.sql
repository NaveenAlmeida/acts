-- ============================================================
-- MEDIA CHURCH — Notificações Web Push (inscrições + alvo de envio)
-- ============================================================
-- Tabela do NÚCLEO (genérica por church_id) — serve qualquer ministério.

create table public.push_subscriptions (
  id          uuid primary key default gen_random_uuid(),
  church_id   uuid not null references public.churches (id) on delete cascade,
  user_id     uuid not null references public.profiles (id) on delete cascade,
  endpoint    text not null unique,
  p256dh      text not null,
  auth        text not null,
  user_agent  text,
  created_at  timestamptz not null default now()
);

create index idx_push_subs_user on public.push_subscriptions (user_id);
create index idx_push_subs_church on public.push_subscriptions (church_id);

alter table public.push_subscriptions enable row level security;

-- cada pessoa gerencia SOMENTE as próprias inscrições
create policy push_subs_self_select on public.push_subscriptions
  for select using (user_id = auth.uid());
create policy push_subs_self_write on public.push_subscriptions
  for all using (user_id = auth.uid())
  with check (user_id = auth.uid() and public.is_church_member(church_id));

-- ---------- Alvo de envio ----------
-- SECURITY DEFINER: devolve as inscrições dos usuários pedidos, mas só quando o
-- solicitante compartilha uma igreja ativa com o alvo (mesma classe de checagem
-- de is_church_*/shares_church_with). Evita expor endpoints por RLS aberta e
-- dispensa service-role no runtime — o envio roda no server action autenticado.
create or replace function public.get_push_subscriptions(p_user_ids uuid[])
returns table (endpoint text, p256dh text, auth text)
language sql stable security definer set search_path = public as $$
  select s.endpoint, s.p256dh, s.auth
  from push_subscriptions s
  where s.user_id = any (p_user_ids)
    and public.shares_church_with(s.user_id);
$$;

grant execute on function public.get_push_subscriptions(uuid[]) to authenticated;
