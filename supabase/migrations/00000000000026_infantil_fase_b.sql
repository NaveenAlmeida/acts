-- ============================================================
-- MEDIA CHURCH — Infantil Fase B: chamar responsável e fim da sessão
-- ============================================================
-- Ver spec: docs/superpowers/specs/2026-07-21-modulo-infantil-design.md
-- O aviso chega por dois caminhos: Web Push (para o responsável que tem conta)
-- e o ANÚNCIO na igreja — que mostra somente o CÓDIGO, nunca a criança.

create type public.child_page_kind as enum ('chamar', 'fim_sessao');

create table public.child_pages (
  id           uuid primary key default gen_random_uuid(),
  church_id    uuid not null references public.churches (id) on delete cascade,
  ministry_id  uuid not null references public.ministries (id) on delete cascade,
  event_id     uuid not null references public.events (id) on delete cascade,
  -- 'chamar' aponta para uma criança; 'fim_sessao' vale para a sessão toda
  checkin_id   uuid references public.child_checkins (id) on delete cascade,
  kind         public.child_page_kind not null default 'chamar',
  reason       text check (reason is null or char_length(reason) <= 200),
  created_by   uuid references public.profiles (id) on delete set null,
  created_at   timestamptz not null default now(),
  resolved_at  timestamptz,
  resolved_by  uuid references public.profiles (id) on delete set null
);

create index idx_child_pages_ativo on public.child_pages (church_id, resolved_at);
create index idx_child_pages_checkin on public.child_pages (checkin_id);

alter table public.child_pages enable row level security;

-- A chamada em si (com a criança) fica atrás da parede do setor.
create policy child_pages_select on public.child_pages
  for select using (
    public.is_ministry_member(ministry_id) or public.is_church_coord(church_id)
  );
create policy child_pages_manage on public.child_pages
  for all using (
    public.is_ministry_member(ministry_id) or public.is_church_coord(church_id)
  );

-- ---------- O anúncio: só o código atravessa a parede ----------
-- Qualquer MEMBRO da igreja vê os códigos chamados, sem descobrir de qual
-- criança se trata. É o equivalente digital do painel na parede do corredor.
create or replace function public.anuncios_infantil(p_church uuid)
returns table (code text, kind public.child_page_kind, created_at timestamptz)
language sql stable security definer set search_path = public as $$
  select k.code, p.kind, p.created_at
  from child_pages p
  left join child_checkins k on k.id = p.checkin_id
  where p.church_id = p_church
    and p.resolved_at is null
    and public.is_church_member(p_church)
  order by p.created_at desc
  limit 20;
$$;

grant execute on function public.anuncios_infantil(uuid) to authenticated;

-- ---------- Retirada encerra a chamada pendente ----------
-- Se a criança já saiu, o aviso não deve continuar piscando na igreja.
create or replace function public.resolve_pages_on_checkout()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.checked_out_at is not null and old.checked_out_at is null then
    update child_pages
      set resolved_at = now(), resolved_by = auth.uid()
      where checkin_id = new.id and resolved_at is null;
  end if;
  return new;
end;
$$;

create trigger child_checkins_resolve_pages
  after update on public.child_checkins
  for each row execute function public.resolve_pages_on_checkout();
