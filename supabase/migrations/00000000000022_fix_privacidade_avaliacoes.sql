-- ============================================================
-- MEDIA CHURCH — Correção: privacidade das avaliações
-- ============================================================
-- Regressão introduzida na migration 21 (escopo por setor): ao reescrever a
-- policy, troquei `is_church_leader` por `is_ministry_member` — que INCLUI
-- voluntários. Resultado: qualquer membro do setor passou a ler as avaliações
-- de desempenho dos colegas.
--
-- Avaliação é feedback pessoal: só a própria pessoa, a LIDERANÇA do setor e o
-- coordenador da igreja podem ler.

drop policy if exists evaluations_select on public.evaluations;
create policy evaluations_select on public.evaluations
  for select using (
    user_id = auth.uid()
    or public.is_church_coord(church_id)
    or public.has_ministry_role(ministry_id, array['gerente', 'lider']::public.ministry_role[])
  );
