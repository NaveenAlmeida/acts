-- ============================================================
-- MEDIA CHURCH — Fundação: tenancy, papéis, RLS
-- ============================================================

-- ---------- Tipos ----------
create type public.church_role as enum ('admin', 'member');
create type public.ministry_role as enum ('gerente', 'lider', 'instrutor', 'voluntario');

-- ---------- Tabelas ----------
create table public.churches (
  id          uuid primary key default gen_random_uuid(),
  name        text not null check (char_length(name) between 2 and 80),
  slug        text not null unique check (slug ~ '^[a-z0-9]([a-z0-9-]{1,48}[a-z0-9])$'),
  logo_url    text,
  invite_code text not null unique default encode(gen_random_bytes(4), 'hex'),
  settings    jsonb not null default '{}',
  created_at  timestamptz not null default now()
);

create table public.profiles (
  id                    uuid primary key references auth.users (id) on delete cascade,
  full_name             text not null default '',
  avatar_url            text,
  phone                 text,
  birth_date            date,
  profession            text,
  availability          jsonb not null default '{}',
  onboarding_completed  boolean not null default false,
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now()
);

create table public.church_members (
  church_id  uuid not null references public.churches (id) on delete cascade,
  user_id    uuid not null references public.profiles (id) on delete cascade,
  role       public.church_role not null default 'member',
  status     text not null default 'active' check (status in ('active', 'inactive')),
  joined_at  timestamptz not null default now(),
  primary key (church_id, user_id)
);

create table public.ministries (
  id          uuid primary key default gen_random_uuid(),
  church_id   uuid not null references public.churches (id) on delete cascade,
  name        text not null check (char_length(name) between 2 and 60),
  slug        text not null,
  color       text not null default '#6366f1',
  icon        text not null default 'sparkles',
  created_at  timestamptz not null default now(),
  unique (church_id, slug)
);

create table public.ministry_members (
  ministry_id  uuid not null references public.ministries (id) on delete cascade,
  church_id    uuid not null references public.churches (id) on delete cascade,
  user_id      uuid not null references public.profiles (id) on delete cascade,
  role         public.ministry_role not null default 'voluntario',
  active       boolean not null default true,
  joined_at    timestamptz not null default now(),
  primary key (ministry_id, user_id)
);

create index idx_church_members_user on public.church_members (user_id);
create index idx_ministries_church on public.ministries (church_id);
create index idx_ministry_members_user on public.ministry_members (user_id);
create index idx_ministry_members_church on public.ministry_members (church_id);

-- ---------- Funções auxiliares de permissão ----------
-- SECURITY DEFINER: rodam sem RLS, evitando recursão nas policies.
create or replace function public.is_church_member(p_church uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from church_members
    where church_id = p_church and user_id = auth.uid() and status = 'active'
  );
$$;

create or replace function public.is_church_admin(p_church uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from church_members
    where church_id = p_church and user_id = auth.uid()
      and role = 'admin' and status = 'active'
  );
$$;

create or replace function public.has_ministry_role(p_ministry uuid, p_roles public.ministry_role[])
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from ministry_members
    where ministry_id = p_ministry and user_id = auth.uid()
      and active and role = any (p_roles)
  );
$$;

create or replace function public.shares_church_with(p_user uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1
    from church_members a
    join church_members b on a.church_id = b.church_id
    where a.user_id = auth.uid() and b.user_id = p_user
      and a.status = 'active' and b.status = 'active'
  );
$$;

-- ---------- Fluxos atômicos (criar/entrar em igreja) ----------
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
  return v_id;
end;
$$;

create or replace function public.join_church(p_invite_code text)
returns uuid language plpgsql security definer set search_path = public as $$
declare
  v_id uuid;
begin
  if auth.uid() is null then
    raise exception 'not_authenticated';
  end if;
  select id into v_id from churches where invite_code = lower(p_invite_code);
  if v_id is null then
    raise exception 'invalid_invite_code';
  end if;
  insert into church_members (church_id, user_id, role)
  values (v_id, auth.uid(), 'member')
  on conflict (church_id, user_id) do update set status = 'active';
  return v_id;
end;
$$;

-- ---------- Perfil automático no signup ----------
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into profiles (id, full_name)
  values (new.id, coalesce(new.raw_user_meta_data ->> 'full_name', ''));
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------- updated_at automático ----------
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger profiles_updated_at
  before update on public.profiles
  for each row execute function public.set_updated_at();

-- ---------- RLS ----------
alter table public.churches enable row level security;
alter table public.profiles enable row level security;
alter table public.church_members enable row level security;
alter table public.ministries enable row level security;
alter table public.ministry_members enable row level security;

-- churches: leitura para membros; update para admin; insert/delete só via funções
create policy churches_select on public.churches
  for select using (public.is_church_member(id));
create policy churches_update on public.churches
  for update using (public.is_church_admin(id));

-- profiles: eu mesmo + colegas de igreja; update só o próprio
create policy profiles_select on public.profiles
  for select using (id = auth.uid() or public.shares_church_with(id));
create policy profiles_update on public.profiles
  for update using (id = auth.uid());

-- church_members: leitura para membros da igreja; gestão para admin
create policy church_members_select on public.church_members
  for select using (public.is_church_member(church_id));
create policy church_members_admin_write on public.church_members
  for all using (public.is_church_admin(church_id));

-- ministries: leitura para membros; gestão para admin
create policy ministries_select on public.ministries
  for select using (public.is_church_member(church_id));
create policy ministries_admin_write on public.ministries
  for all using (public.is_church_admin(church_id));

-- ministry_members: leitura para membros da igreja; gestão para admin ou gerente do ministério
create policy ministry_members_select on public.ministry_members
  for select using (public.is_church_member(church_id));
create policy ministry_members_manage on public.ministry_members
  for all using (
    public.is_church_admin(church_id)
    or public.has_ministry_role(ministry_id, array['gerente']::public.ministry_role[])
  );

-- ---------- Grants ----------
-- O Supabase (versões novas) não concede DML por padrão em tabelas novas.
-- RLS continua sendo a camada de autorização; grants apenas habilitam o acesso base.
grant usage on schema public to anon, authenticated;
grant select, insert, update, delete on all tables in schema public to authenticated;
grant usage, select on all sequences in schema public to authenticated;
grant execute on all functions in schema public to anon, authenticated;

-- Migrations futuras herdam os mesmos grants automaticamente
alter default privileges in schema public
  grant select, insert, update, delete on tables to authenticated;
alter default privileges in schema public
  grant usage, select on sequences to authenticated;
alter default privileges in schema public
  grant execute on functions to anon, authenticated;
