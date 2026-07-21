-- ============================================================
-- MEDIA CHURCH — Papel "Coordenador" de igreja (1/2: enum)
-- ============================================================
-- Terceiro papel de igreja, entre admin e member. Ver spec:
-- docs/superpowers/specs/2026-07-17-papel-coordenador-igreja.md
--
-- ALTER TYPE ... ADD VALUE não pode ter o valor USADO na mesma
-- transação, por isso esta migration só adiciona o valor; a
-- migration 14 recria helpers e policies que o utilizam.

alter type public.church_role add value if not exists 'coordenador';
