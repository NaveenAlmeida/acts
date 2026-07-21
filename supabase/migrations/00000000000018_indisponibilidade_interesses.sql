-- ============================================================
-- MEDIA CHURCH — Indisponibilidade + Interesses (escalação assistida)
-- ============================================================
-- Ver spec: docs/superpowers/specs/2026-07-20-escalacao-assistida-design.md
-- Tabelas do NÚCLEO (genéricas por church_id/skill_id) — servem qualquer
-- ministério na visão 3.0, não amarram à mídia.

-- ---------- Indisponibilidade: períodos em que o voluntário não pode ----------
create table public.unavailability (
  id          uuid primary key default gen_random_uuid(),
  church_id   uuid not null references public.churches (id) on delete cascade,
  user_id     uuid not null references public.profiles (id) on delete cascade,
  start_date  date not null,
  end_date    date not null,
  reason      text check (reason is null or char_length(reason) <= 200),
  created_at  timestamptz not null default now(),
  check (end_date >= start_date)
);
create index idx_unavailability_church_user on public.unavailability (church_id, user_id);
create index idx_unavailability_user_dates on public.unavailability (user_id, start_date, end_date);

alter table public.unavailability enable row level security;

-- o voluntário vê/gerencia a SUA; líder/gestor vê a de todos (p/ escalar informado)
create policy unavailability_select on public.unavailability
  for select using (
    user_id = auth.uid() or public.is_church_leader(church_id)
  );
create policy unavailability_self_manage on public.unavailability
  for all using (
    user_id = auth.uid() and public.is_church_member(church_id)
  )
  with check (
    user_id = auth.uid() and public.is_church_member(church_id)
  );

-- ---------- Interesses: aptidões que a pessoa QUER servir ----------
create table public.member_interests (
  church_id   uuid not null references public.churches (id) on delete cascade,
  user_id     uuid not null references public.profiles (id) on delete cascade,
  skill_id    uuid not null references public.skills (id) on delete cascade,
  created_at  timestamptz not null default now(),
  primary key (user_id, skill_id)
);
create index idx_member_interests_church_skill on public.member_interests (church_id, skill_id);
create index idx_member_interests_church_user on public.member_interests (church_id, user_id);

alter table public.member_interests enable row level security;

-- membros da igreja veem (escalação, perfil, "quem quer crescer"); o próprio gerencia
create policy member_interests_select on public.member_interests
  for select using (public.is_church_member(church_id));
create policy member_interests_self_manage on public.member_interests
  for all using (
    user_id = auth.uid() and public.is_church_member(church_id)
  )
  with check (
    user_id = auth.uid() and public.is_church_member(church_id)
  );
