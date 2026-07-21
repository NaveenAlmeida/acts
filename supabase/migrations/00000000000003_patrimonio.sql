-- ============================================================
-- MEDIA CHURCH — Fase 2: Patrimônio (equipamentos, histórico, auditoria)
-- ============================================================

create type public.equipment_status as enum (
  'disponivel', 'em_uso', 'manutencao', 'emprestado', 'indisponivel', 'baixado'
);

create type public.equipment_event_type as enum (
  'cadastro', 'alteracao', 'uso', 'manutencao', 'emprestimo', 'devolucao'
);

-- ---------- Categorias ----------
create table public.equipment_categories (
  id          uuid primary key default gen_random_uuid(),
  church_id   uuid not null references public.churches (id) on delete cascade,
  name        text not null check (char_length(name) between 2 and 60),
  slug        text not null,
  created_at  timestamptz not null default now(),
  unique (church_id, slug)
);

create index idx_equipment_categories_church on public.equipment_categories (church_id);

create or replace function public.seed_church_categories(p_church uuid)
returns void language sql security definer set search_path = public as $$
  insert into equipment_categories (church_id, name, slug)
  values
    (p_church, 'Áudio', 'audio'),
    (p_church, 'Vídeo', 'video'),
    (p_church, 'Iluminação', 'iluminacao'),
    (p_church, 'Informática', 'informatica'),
    (p_church, 'Streaming', 'streaming'),
    (p_church, 'Fotografia', 'fotografia'),
    (p_church, 'Cabos', 'cabos'),
    (p_church, 'Acessórios', 'acessorios')
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
  perform public.seed_church_categories(v_id);
  return v_id;
end;
$$;

do $$
declare c record;
begin
  for c in select id from public.churches loop
    perform public.seed_church_categories(c.id);
  end loop;
end $$;

-- ---------- Equipamentos ----------
create table public.equipments (
  id               uuid primary key default gen_random_uuid(),
  church_id        uuid not null references public.churches (id) on delete cascade,
  category_id      uuid references public.equipment_categories (id) on delete set null,
  name             text not null check (char_length(name) between 2 and 120),
  subcategory      text,
  brand            text,
  model            text,
  serial_number    text,
  asset_number     text,
  value_cents      bigint check (value_cents is null or value_cents >= 0),
  supplier         text,
  invoice_ref      text,
  warranty_until   date,
  manual_url       text,
  photo_url        text,
  status           public.equipment_status not null default 'disponivel',
  location         text,
  purchase_date    date,
  lifespan_months  int check (lifespan_months is null or lifespan_months > 0),
  responsible_id   uuid references public.profiles (id) on delete set null,
  notes            text,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);

create index idx_equipments_church on public.equipments (church_id);
create index idx_equipments_category on public.equipments (category_id);

create trigger equipments_updated_at
  before update on public.equipments
  for each row execute function public.set_updated_at();

-- ---------- Histórico (append-only) ----------
create table public.equipment_events (
  id            uuid primary key default gen_random_uuid(),
  church_id     uuid not null references public.churches (id) on delete cascade,
  equipment_id  uuid not null references public.equipments (id) on delete cascade,
  user_id       uuid references public.profiles (id) on delete set null,
  event_type    public.equipment_event_type not null,
  payload       jsonb not null default '{}',
  created_at    timestamptz not null default now()
);

create index idx_equipment_events_equipment on public.equipment_events (equipment_id, created_at desc);
create index idx_equipment_events_church on public.equipment_events (church_id);

-- diff só com campos alterados
create or replace function public.jsonb_changed_fields(p_old jsonb, p_new jsonb)
returns jsonb language sql immutable as $$
  select coalesce(
    jsonb_object_agg(key, jsonb_build_object('de', p_old -> key, 'para', p_new -> key)),
    '{}'::jsonb
  )
  from jsonb_each(p_new)
  where p_old -> key is distinct from p_new -> key
    and key not in ('updated_at', 'created_at');
$$;

create or replace function public.log_equipment_event()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'INSERT' then
    insert into equipment_events (church_id, equipment_id, user_id, event_type, payload)
    values (new.church_id, new.id, auth.uid(), 'cadastro',
      jsonb_build_object('nome', new.name));
    return new;
  end if;

  insert into equipment_events (church_id, equipment_id, user_id, event_type, payload)
  values (new.church_id, new.id, auth.uid(), 'alteracao',
    public.jsonb_changed_fields(to_jsonb(old), to_jsonb(new)));
  return new;
end;
$$;

create trigger equipments_log_insert
  after insert on public.equipments
  for each row execute function public.log_equipment_event();
create trigger equipments_log_update
  after update on public.equipments
  for each row execute function public.log_equipment_event();

-- ---------- Auditoria genérica ----------
create table public.audit_logs (
  id          uuid primary key default gen_random_uuid(),
  church_id   uuid,
  user_id     uuid,
  table_name  text not null,
  record_id   text,
  action      text not null check (action in ('insert', 'update', 'delete')),
  diff        jsonb not null default '{}',
  created_at  timestamptz not null default now()
);

create index idx_audit_logs_church on public.audit_logs (church_id, created_at desc);

create or replace function public.log_audit()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_church uuid;
  v_record text;
  v_diff jsonb;
begin
  if tg_op = 'DELETE' then
    v_church := old.church_id;
    v_record := old.id::text;
    v_diff := to_jsonb(old);
    insert into audit_logs (church_id, user_id, table_name, record_id, action, diff)
    values (v_church, auth.uid(), tg_table_name, v_record, 'delete', v_diff);
    return old;
  elsif tg_op = 'INSERT' then
    v_church := new.church_id;
    v_record := new.id::text;
    v_diff := to_jsonb(new);
    insert into audit_logs (church_id, user_id, table_name, record_id, action, diff)
    values (v_church, auth.uid(), tg_table_name, v_record, 'insert', v_diff);
    return new;
  else
    v_church := new.church_id;
    v_record := new.id::text;
    v_diff := public.jsonb_changed_fields(to_jsonb(old), to_jsonb(new));
    insert into audit_logs (church_id, user_id, table_name, record_id, action, diff)
    values (v_church, auth.uid(), tg_table_name, v_record, 'update', v_diff);
    return new;
  end if;
end;
$$;

create trigger audit_equipments
  after insert or update or delete on public.equipments
  for each row execute function public.log_audit();

-- ---------- Storage: bucket de mídia ----------
insert into storage.buckets (id, name, public)
values ('media', 'media', true)
on conflict (id) do nothing;

create policy media_read on storage.objects
  for select using (bucket_id = 'media');
create policy media_insert on storage.objects
  for insert with check (
    bucket_id = 'media'
    and public.is_church_manager(((storage.foldername(name))[1])::uuid)
  );
create policy media_update on storage.objects
  for update using (
    bucket_id = 'media'
    and public.is_church_manager(((storage.foldername(name))[1])::uuid)
  );
create policy media_delete on storage.objects
  for delete using (
    bucket_id = 'media'
    and public.is_church_manager(((storage.foldername(name))[1])::uuid)
  );

-- ---------- RLS ----------
alter table public.equipment_categories enable row level security;
alter table public.equipments enable row level security;
alter table public.equipment_events enable row level security;
alter table public.audit_logs enable row level security;

create policy equipment_categories_select on public.equipment_categories
  for select using (public.is_church_member(church_id));
create policy equipment_categories_manage on public.equipment_categories
  for all using (public.is_church_manager(church_id));

create policy equipments_select on public.equipments
  for select using (public.is_church_member(church_id));
create policy equipments_manage on public.equipments
  for all using (public.is_church_manager(church_id));

-- histórico: leitura para membros; escrita apenas via triggers (security definer);
-- sem policies de update/delete = imutável
create policy equipment_events_select on public.equipment_events
  for select using (public.is_church_member(church_id));

-- auditoria: apenas admins da igreja leem; escrita só via trigger
create policy audit_logs_select on public.audit_logs
  for select using (church_id is not null and public.is_church_admin(church_id));
