-- ============================================================
-- MEDIA CHURCH — Bucket de mídia privado (isolamento por igreja)
-- ============================================================
-- Antes o bucket 'media' era público: qualquer um com a URL via o
-- arquivo, sem passar por RLS. Agora é privado — a leitura só
-- acontece via signed URL gerada no servidor, e a policy restringe
-- ao membro da igreja dona do arquivo (path começa com church_id).

update storage.buckets set public = false where id = 'media';

-- leitura restrita ao membro da igreja dona do path (era aberta)
drop policy if exists media_read on storage.objects;
create policy media_read on storage.objects
  for select using (
    bucket_id = 'media'
    and public.is_church_member(((storage.foldername(name))[1])::uuid)
  );

-- migra URLs públicas já salvas para o path do objeto, para as signed
-- URLs continuarem funcionando (fotos de equipamento existentes)
update public.equipments
set photo_url = substring(photo_url from '/object/public/media/(.*)$')
where photo_url like '%/object/public/media/%';
