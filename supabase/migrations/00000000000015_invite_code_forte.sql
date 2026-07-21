-- ============================================================
-- MEDIA CHURCH — Código de convite mais forte (anti força-bruta)
-- ============================================================
-- Era gen_random_bytes(4) = 32 bits (8 chars hex), força-brutável.
-- Passa a um UUID sem hífens = 32 chars hex (~122 bits). Usa
-- gen_random_uuid() (função core do Postgres) para não depender do
-- schema 'extensions' no search_path da migration.

-- igrejas novas já nascem com código forte
alter table public.churches
  alter column invite_code set default replace(gen_random_uuid()::text, '-', '');

-- rotaciona os códigos fracos das igrejas existentes (formato antigo
-- de até 8 chars). Convites pendentes com o código antigo param de
-- valer — o admin compartilha o novo código.
update public.churches
set invite_code = replace(gen_random_uuid()::text, '-', '')
where length(invite_code) <= 8;
