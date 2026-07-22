-- Repertório de louvor: acervo de músicas da igreja + a sequência de cada culto.
--
-- A plataforma NÃO projeta letra — quem projeta é o Holyrics. A letra existe
-- para o músico ensaiar; a mídia precisa do aviso e da lista (ordem, tom) para
-- montar a projeção antes do culto.

-- ---------------------------------------------------------------------------
-- Quem está escalado neste culto?
--
-- É o helper que deixa o repertório atravessar a parede de setor sem derrubá-la:
-- a mídia lê o repertório do louvor porque TRABALHA naquele culto, não porque
-- virou membro do louvor.
-- ---------------------------------------------------------------------------
create or replace function public.is_assigned_to_event(p_event uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from assignments
    where event_id = p_event and user_id = auth.uid()
  );
$$;

-- O setor de louvor da igreja (pelo slug, mesmo padrão do módulo Infantil).
create or replace function public.louvor_ministry(p_church uuid)
returns uuid language sql stable security definer set search_path = public as $$
  select id from ministries
  where church_id = p_church and (slug = 'louvor' or name ilike '%louvor%')
  order by (slug = 'louvor') desc
  limit 1;
$$;

-- Só gerente/líder do louvor mexe no acervo e na sequência.
create or replace function public.is_louvor_leader(p_church uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select public.has_ministry_role(
    public.louvor_ministry(p_church),
    array['gerente','lider']::public.ministry_role[]
  );
$$;

-- ---------------------------------------------------------------------------
-- Acervo da igreja
-- ---------------------------------------------------------------------------
create table public.songs (
  id          uuid primary key default gen_random_uuid(),
  church_id   uuid not null references public.churches (id) on delete cascade,
  title       text not null check (char_length(title) between 1 and 160),
  artist      text,
  default_key text check (char_length(default_key) <= 8),
  bpm         int check (bpm between 20 and 300),
  lyrics      text,
  link        text,
  -- tirar do acervo sem apagar histórico: repertórios antigos continuam legíveis
  active      boolean not null default true,
  created_by  uuid references public.profiles (id) on delete set null,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  unique (church_id, title, artist)
);

create index idx_songs_church on public.songs (church_id, active, title);

-- ---------------------------------------------------------------------------
-- A sequência de um culto
--
-- Sem tabela "setlists": o repertório É do evento, e o evento já existe.
-- ---------------------------------------------------------------------------
create table public.setlist_items (
  id           uuid primary key default gen_random_uuid(),
  church_id    uuid not null references public.churches (id) on delete cascade,
  event_id     uuid not null references public.events (id) on delete cascade,
  song_id      uuid not null references public.songs (id) on delete restrict,
  position     int not null check (position > 0),
  -- o mesmo hino sobe ou desce conforme quem canta naquele domingo
  key_override text check (char_length(key_override) <= 8),
  notes        text check (char_length(notes) <= 300),
  created_at   timestamptz not null default now(),
  unique (event_id, position),
  unique (event_id, song_id)
);

create index idx_setlist_event on public.setlist_items (event_id, position);
create index idx_setlist_song on public.setlist_items (song_id, created_at desc);

-- Estado da publicação mora no evento.
create type public.setlist_status as enum ('rascunho', 'publicado');
alter table public.events
  add column setlist_status public.setlist_status not null default 'rascunho',
  add column setlist_published_at timestamptz;

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------
alter table public.songs enable row level security;
alter table public.setlist_items enable row level security;

-- O acervo é da igreja: qualquer membro consulta (dá para ensaiar em casa).
create policy songs_select on public.songs
  for select using (public.is_church_member(church_id));

create policy songs_write on public.songs
  for all
  using (public.is_louvor_leader(church_id) or public.is_church_coord(church_id))
  with check (public.is_louvor_leader(church_id) or public.is_church_coord(church_id));

-- O rascunho é só do louvor; publicado, quem trabalha no culto lê.
create policy setlist_select on public.setlist_items
  for select using (
    public.is_louvor_leader(church_id)
    or public.is_church_coord(church_id)
    or (
      public.is_assigned_to_event(event_id)
      and exists (
        select 1 from events e
        where e.id = event_id and e.setlist_status = 'publicado'
      )
    )
  );

create policy setlist_write on public.setlist_items
  for all
  using (public.is_louvor_leader(church_id) or public.is_church_coord(church_id))
  with check (public.is_louvor_leader(church_id) or public.is_church_coord(church_id));

-- ---------------------------------------------------------------------------
-- Coerência de tenant: item de repertório não pode apontar para música ou
-- evento de outra igreja. A unique (event_id, song_id) não protege disso.
-- ---------------------------------------------------------------------------
create or replace function public.guard_setlist_tenant()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if not exists (
    select 1 from events where id = new.event_id and church_id = new.church_id
  ) then
    raise exception 'evento de outra igreja';
  end if;
  if not exists (
    select 1 from songs where id = new.song_id and church_id = new.church_id
  ) then
    raise exception 'música de outra igreja';
  end if;
  return new;
end;
$$;

create trigger setlist_items_guard_tenant
  before insert or update on public.setlist_items
  for each row execute function public.guard_setlist_tenant();
