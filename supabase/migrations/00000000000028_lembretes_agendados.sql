-- Lembretes agendados: a primeira coisa no Acts que acontece sem ninguém clicar.
--
-- Até aqui todo push era reativo (o líder escalou, o líder publicou). Estes
-- são os avisos que ninguém precisa lembrar de mandar: a véspera do culto, a
-- confirmação que falta, o repertório ainda em rascunho.

-- ---------------------------------------------------------------------------
-- Segredo do cron.
--
-- Optamos por NÃO colocar a chave de service-role no Worker: ela daria acesso
-- irrestrito ao banco e quebraria o princípio de que a autorização vive aqui.
-- Em vez disso o agendador prova quem é com um segredo, e a única função que
-- ele destranca devolve exatamente os lembretes vencidos — nada mais.
--
-- Sem policy nenhuma + RLS ligada = ninguém lê pelo PostgREST. Só a função
-- SECURITY DEFINER abaixo enxerga.
-- ---------------------------------------------------------------------------
create table public.cron_secret (
  secret text primary key
);
alter table public.cron_secret enable row level security;

-- ---------------------------------------------------------------------------
-- Registro do que já foi enviado.
--
-- A unique é a garantia de idempotência: se o cron rodar duas vezes (retry do
-- Cloudflare, deploy no meio), o segundo insert não passa e o lembrete não é
-- reenviado. Não depende de o código lembrar de checar.
-- ---------------------------------------------------------------------------
create table public.reminders_sent (
  id       uuid primary key default gen_random_uuid(),
  kind     text not null,
  ref_id   uuid not null,
  user_id  uuid not null references public.profiles (id) on delete cascade,
  sent_on  date not null default current_date,
  sent_at  timestamptz not null default now(),
  unique (kind, ref_id, user_id, sent_on)
);
alter table public.reminders_sent enable row level security;

create index idx_reminders_sent_dia on public.reminders_sent (sent_on);

-- ---------------------------------------------------------------------------
-- Os lembretes vencidos de hoje.
--
-- Insere e devolve na mesma transação: só sai daqui o que ACABOU de ser
-- registrado, então duas execuções simultâneas não duplicam nada.
--
-- Fuso: a igreja é no Brasil. Quando o Acts atender igreja de outro fuso, isto
-- vira uma coluna em churches — hoje seria complexidade sem demanda.
-- ---------------------------------------------------------------------------
create or replace function public.lembretes_do_dia(p_secret text)
returns table (
  user_id uuid,
  endpoint text,
  p256dh text,
  auth text,
  titulo text,
  corpo text,
  url text
)
language plpgsql security definer set search_path = public as $$
-- Os parâmetros de saída (user_id, endpoint…) têm o mesmo nome das colunas das
-- tabelas: sem esta diretiva o plpgsql acusa referência ambígua (42702).
#variable_conflict use_column
declare
  v_amanha date;
begin
  if p_secret is null or not exists (select 1 from cron_secret where secret = p_secret) then
    raise exception 'não autorizado';
  end if;

  v_amanha := ((now() at time zone 'America/Sao_Paulo')::date) + 1;

  return query
  with eventos_amanha as (
    select e.id, e.title, e.starts_at, e.church_id, e.setlist_status,
           c.slug as church_slug
    from events e
    join churches c on c.id = e.church_id
    where ((e.starts_at at time zone 'America/Sao_Paulo')::date) = v_amanha
  ),

  -- 1. "Você está escalado amanhã" — para quem ainda não deu ausência.
  vespera as (
    select a.user_id,
           'vespera'::text as kind,
           a.id as ref_id,
           'Você serve amanhã'::text as titulo,
           ev.title || ' · ' ||
             to_char(ev.starts_at at time zone 'America/Sao_Paulo', 'HH24:MI') ||
             ' · ' || a.role_name as corpo,
           '/' || ev.church_slug || '/escalas/' || ev.id as url
    from assignments a
    join eventos_amanha ev on ev.id = a.event_id
    where a.status in ('convidado', 'confirmado')
  ),

  -- 2. Quem ainda não confirmou — avisa a liderança do setor, que ainda dá
  --    tempo de correr atrás ou trocar.
  pendentes as (
    select a.ministry_id, a.event_id, count(*) as qtd
    from assignments a
    join eventos_amanha ev on ev.id = a.event_id
    where a.status = 'convidado'
    group by a.ministry_id, a.event_id
  ),
  cobranca as (
    select mm.user_id,
           'confirmacao_pendente'::text as kind,
           p.event_id as ref_id,
           'Falta confirmação'::text as titulo,
           p.qtd || (case when p.qtd = 1 then ' pessoa não confirmou' else ' pessoas não confirmaram' end)
             || ' para amanhã.' as corpo,
           '/' || ev.church_slug || '/escalas/' || ev.id as url
    from pendentes p
    join eventos_amanha ev on ev.id = p.event_id
    join ministry_members mm on mm.ministry_id = p.ministry_id
     and mm.active and mm.role in ('gerente', 'lider')
  ),

  -- 3. Repertório ainda em rascunho na véspera: a mídia não consegue montar a
  --    projeção do que não pode ver.
  repertorio as (
    select mm.user_id,
           'repertorio_rascunho'::text as kind,
           ev.id as ref_id,
           'Repertório ainda não publicado'::text as titulo,
           ev.title || ' é amanhã e a equipe ainda não vê a sequência.' as corpo,
           '/' || ev.church_slug || '/escalas/' || ev.id as url
    from eventos_amanha ev
    join ministry_members mm
      on mm.ministry_id = public.louvor_ministry(ev.church_id)
     and mm.active and mm.role in ('gerente', 'lider')
    where ev.setlist_status = 'rascunho'
      and exists (select 1 from setlist_items si where si.event_id = ev.id)
  ),

  todos as (
    select * from vespera
    union all select * from cobranca
    union all select * from repertorio
  ),

  -- O insert é o filtro: o que já foi enviado hoje não volta.
  novos as (
    insert into reminders_sent (kind, ref_id, user_id)
    select t.kind, t.ref_id, t.user_id from todos t
    on conflict (kind, ref_id, user_id, sent_on) do nothing
    returning reminders_sent.kind, reminders_sent.ref_id, reminders_sent.user_id
  )
  select ps.user_id, ps.endpoint, ps.p256dh, ps.auth, t.titulo, t.corpo, t.url
  from novos n
  join todos t
    on t.kind = n.kind and t.ref_id = n.ref_id and t.user_id = n.user_id
  join push_subscriptions ps on ps.user_id = n.user_id;
end;
$$;

-- A função é o único destranque do segredo; ninguém mais precisa executá-la.
revoke all on function public.lembretes_do_dia(text) from public;
grant execute on function public.lembretes_do_dia(text) to anon, authenticated;
