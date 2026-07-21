-- ============================================================
-- MEDIA CHURCH — Sustentação: assinatura leve (Pix manual) + freio de cadastro
-- ============================================================
-- Modelo: valor baixo cobrindo servidor/domínio, com ISENÇÃO para a igreja que
-- não pode pagar. Toda igreja nova começa em trial de 30 dias.
-- Pagamento é confirmado à mão pela plataforma (Pix não tem webhook aqui).

create type public.church_billing_status as enum ('trial', 'ativa', 'pendente', 'isenta');

alter table public.churches
  add column if not exists billing_status public.church_billing_status not null default 'trial',
  add column if not exists paid_until date,
  add column if not exists billing_note text check (billing_note is null or char_length(billing_note) <= 300),
  add column if not exists created_by uuid references public.profiles (id) on delete set null;

-- Igrejas que já existiam entram como ISENTAS (não faz sentido cobrar de quem
-- já estava usando antes do modelo existir). Feito ANTES do trigger de guarda.
update public.churches
  set billing_status = 'isenta',
      billing_note = 'igreja anterior ao modelo de sustentação'
  where billing_status = 'trial';

-- ---------- Guarda: só a plataforma mexe em faturamento ----------
-- Sem isso, o admin da própria igreja poderia se declarar isento (a policy
-- churches_update permite que ele edite a igreja dele).
create or replace function public.guard_church_billing()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if (new.billing_status is distinct from old.billing_status
      or new.paid_until is distinct from old.paid_until
      or new.billing_note is distinct from old.billing_note)
     and not public.is_platform_admin() then
    raise exception 'billing_change_not_allowed';
  end if;
  return new;
end;
$$;

create trigger churches_guard_billing
  before update on public.churches
  for each row execute function public.guard_church_billing();

-- a plataforma precisa poder atualizar a igreja para confirmar pagamento/isentar
drop policy if exists churches_platform_update on public.churches;
create policy churches_platform_update on public.churches
  for update using (public.is_platform_admin());

-- ---------- "Já paguei": a igreja avisa, a plataforma confere ----------
create table public.billing_claims (
  id          uuid primary key default gen_random_uuid(),
  church_id   uuid not null references public.churches (id) on delete cascade,
  claimed_by  uuid references public.profiles (id) on delete set null,
  note        text check (note is null or char_length(note) <= 300),
  created_at  timestamptz not null default now()
);
create index idx_billing_claims_church on public.billing_claims (church_id, created_at desc);

alter table public.billing_claims enable row level security;
create policy billing_claims_insert on public.billing_claims
  for insert with check (public.is_church_admin(church_id) and claimed_by = auth.uid());
create policy billing_claims_select on public.billing_claims
  for select using (public.is_church_admin(church_id) or public.is_platform_admin());

-- ---------- create_church: trial + freio leve (1 igreja por conta) ----------
create or replace function public.create_church(p_name text, p_slug text)
returns uuid language plpgsql security definer set search_path = public as $$
declare
  v_id uuid;
  v_min uuid;
begin
  if auth.uid() is null then
    raise exception 'not_authenticated';
  end if;

  -- freio contra abuso: uma conta comum cria no máximo 1 igreja.
  -- Ela continua podendo ser MEMBRO de quantas quiser.
  if not public.is_platform_admin() then
    if (select count(*) from churches where created_by = auth.uid()) >= 1 then
      raise exception 'church_limit_reached';
    end if;
  end if;

  insert into churches (name, slug, created_by, billing_status, paid_until)
    values (p_name, p_slug, auth.uid(), 'trial', (current_date + 30))
    returning id into v_id;

  insert into church_members (church_id, user_id, role) values (v_id, auth.uid(), 'admin');
  perform public.seed_church_skills(v_id);
  perform public.seed_church_categories(v_id);
  perform public.seed_church_event_types(v_id);
  insert into ministries (church_id, name, slug)
    values (v_id, 'Mídia', 'midia')
    returning id into v_min;
  insert into ministry_members (ministry_id, church_id, user_id, role)
    values (v_min, v_id, auth.uid(), 'gerente');
  return v_id;
end;
$$;
