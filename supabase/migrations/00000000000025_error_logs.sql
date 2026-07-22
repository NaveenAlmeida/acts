-- ============================================================
-- MEDIA CHURCH — Observabilidade: erros de produção visíveis
-- ============================================================
-- Hoje as error boundaries só fazem console.error: o erro morre no navegador
-- do usuário e ninguém fica sabendo. Agora que igrejas desconhecidas usam o
-- sistema, isso deixa de ser aceitável.
--
-- Os logs profundos ficam no Cloudflare (observability já habilitada no
-- wrangler). Esta tabela é a visão de produto: o que quebrou, para quem, onde.

create table public.error_logs (
  id          uuid primary key default gen_random_uuid(),
  church_id   uuid references public.churches (id) on delete set null,
  user_id     uuid references public.profiles (id) on delete set null,
  path        text check (path is null or char_length(path) <= 300),
  message     text not null check (char_length(message) <= 500),
  digest      text check (digest is null or char_length(digest) <= 100),
  stack       text check (stack is null or char_length(stack) <= 4000),
  user_agent  text check (user_agent is null or char_length(user_agent) <= 300),
  created_at  timestamptz not null default now()
);

create index idx_error_logs_created on public.error_logs (created_at desc);
create index idx_error_logs_church on public.error_logs (church_id, created_at desc);

alter table public.error_logs enable row level security;

-- Registrar: qualquer um. O erro pode acontecer DESLOGADO (login, cadastro,
-- landing) — e é justamente aí que perder o log dói mais.
create policy error_logs_insert on public.error_logs
  for insert with check (true);

-- Ler: só a plataforma. Mensagem de erro pode revelar detalhe interno.
create policy error_logs_select on public.error_logs
  for select using (public.is_platform_admin());

grant insert on public.error_logs to anon, authenticated;
