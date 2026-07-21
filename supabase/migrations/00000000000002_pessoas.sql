-- ============================================================
-- MEDIA CHURCH — Fase 1: Pessoas (skills, briefing, aptidões)
-- ============================================================

create type public.aptitude_source as enum ('experience', 'training', 'both');

-- ---------- Skills (catálogo por igreja) ----------
create table public.skills (
  id          uuid primary key default gen_random_uuid(),
  church_id   uuid not null references public.churches (id) on delete cascade,
  name        text not null check (char_length(name) between 2 and 60),
  slug        text not null,
  created_at  timestamptz not null default now(),
  unique (church_id, slug)
);

create index idx_skills_church on public.skills (church_id);

-- ---------- Aptidões dos membros ----------
create table public.member_skills (
  skill_id     uuid not null references public.skills (id) on delete cascade,
  church_id    uuid not null references public.churches (id) on delete cascade,
  user_id      uuid not null references public.profiles (id) on delete cascade,
  source       public.aptitude_source not null default 'experience',
  -- approved_by null = sugestão pendente (vinda do briefing)
  approved_by  uuid references public.profiles (id) on delete set null,
  approved_at  timestamptz,
  notes        text,
  created_at   timestamptz not null default now(),
  primary key (skill_id, user_id)
);

create index idx_member_skills_user on public.member_skills (user_id);
create index idx_member_skills_church on public.member_skills (church_id);

-- ---------- Briefing obrigatório do 1º acesso ----------
create table public.briefing_responses (
  id            uuid primary key default gen_random_uuid(),
  church_id     uuid not null references public.churches (id) on delete cascade,
  user_id       uuid not null references public.profiles (id) on delete cascade,
  form_version  int not null default 1,
  answers       jsonb not null default '{}',
  summary       text not null default '',
  created_at    timestamptz not null default now(),
  unique (church_id, user_id, form_version)
);

create index idx_briefing_church on public.briefing_responses (church_id);

-- ---------- Helper: admin OU gerente de algum ministério da igreja ----------
create or replace function public.is_church_manager(p_church uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select public.is_church_admin(p_church) or exists (
    select 1 from ministry_members
    where church_id = p_church and user_id = auth.uid()
      and active and role = 'gerente'
  );
$$;

-- ---------- Seed de skills padrão ao criar igreja ----------
create or replace function public.seed_church_skills(p_church uuid)
returns void language sql security definer set search_path = public as $$
  insert into skills (church_id, name, slug)
  values
    (p_church, 'Fotografia', 'fotografia'),
    (p_church, 'Vídeo', 'video'),
    (p_church, 'Áudio', 'audio'),
    (p_church, 'Iluminação', 'iluminacao'),
    (p_church, 'Design', 'design'),
    (p_church, 'Transmissão', 'transmissao'),
    (p_church, 'Informática', 'informatica')
  on conflict (church_id, slug) do nothing;
$$;

create or replace function public.create_church(p_name text, p_slug text)
returns uuid language plpgsql security definer set search_path = public as $$
declare
  v_id uuid;
begin
  if auth.uid() is null then
    raise exception 'not_authenticated';
  end if;
  insert into churches (name, slug) values (p_name, p_slug) returning id into v_id;
  insert into church_members (church_id, user_id, role) values (v_id, auth.uid(), 'admin');
  perform public.seed_church_skills(v_id);
  return v_id;
end;
$$;

-- Seed para igrejas já existentes
do $$
declare c record;
begin
  for c in select id from public.churches loop
    perform public.seed_church_skills(c.id);
  end loop;
end $$;

-- ---------- RLS ----------
alter table public.skills enable row level security;
alter table public.member_skills enable row level security;
alter table public.briefing_responses enable row level security;

create policy skills_select on public.skills
  for select using (public.is_church_member(church_id));
create policy skills_manage on public.skills
  for all using (public.is_church_manager(church_id));

create policy member_skills_select on public.member_skills
  for select using (public.is_church_member(church_id));
create policy member_skills_manage on public.member_skills
  for all using (public.is_church_manager(church_id));
-- voluntário pode registrar as próprias sugestões (pendentes) no briefing
create policy member_skills_self_suggest on public.member_skills
  for insert with check (
    user_id = auth.uid()
    and approved_by is null
    and public.is_church_member(church_id)
  );

create policy briefing_select on public.briefing_responses
  for select using (user_id = auth.uid() or public.is_church_manager(church_id));
create policy briefing_insert_own on public.briefing_responses
  for insert with check (user_id = auth.uid() and public.is_church_member(church_id));
