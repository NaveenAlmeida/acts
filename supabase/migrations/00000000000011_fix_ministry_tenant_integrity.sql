-- ============================================================
-- MEDIA CHURCH — Correção de segurança: isolamento de tenant
-- em ministry_members (furo de escalação cross-tenant)
-- ============================================================
-- PROBLEMA: ministry_members guarda church_id como coluna
-- denormalizada, independente do ministry_id. Os helpers
-- is_church_manager/is_church_leader confiavam nesse church_id
-- sem validar que ele bate com ministries.church_id do
-- ministry_id real. Como o PK é (ministry_id, user_id), um
-- "gerente" de um ministério da própria igreja conseguia dar
-- upsert trocando church_id para o de OUTRA igreja e virar
-- gerente/líder dela — escalação total cross-tenant.
--
-- DEFESA EM PROFUNDIDADE (3 camadas):
--   1) trigger que força church_id = ministries.church_id
--      (raiz: impossível divergir, independente do que o
--      cliente enviar no payload)
--   2) helpers recriados com JOIN real em ministries
--      (protege contra linhas legadas já divergentes)
--   3) saneamento das linhas existentes divergentes

-- ---------- Camada 3: saneamento de dados legados ----------
-- Corrige qualquer linha onde church_id já divergiu do ministério.
update public.ministry_members mm
set church_id = m.church_id
from public.ministries m
where m.id = mm.ministry_id
  and mm.church_id <> m.church_id;

-- ---------- Camada 1: trigger de integridade ----------
-- Deriva church_id do ministério SEMPRE, ignorando o valor
-- enviado pelo cliente. No caso legítimo (app manda o valor
-- certo) é no-op; no caso malicioso, sobrescreve com o correto.
create or replace function public.enforce_ministry_member_church()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  select church_id into new.church_id
  from public.ministries
  where id = new.ministry_id;

  if new.church_id is null then
    raise exception 'ministry_id % inexistente', new.ministry_id;
  end if;

  return new;
end;
$$;

drop trigger if exists trg_ministry_member_church on public.ministry_members;
create trigger trg_ministry_member_church
  before insert or update on public.ministry_members
  for each row execute function public.enforce_ministry_member_church();

-- ---------- Camada 2: helpers com join real ----------
-- Não confiam mais na coluna denormalizada: derivam a igreja
-- via ministries.church_id. Mantém o bypass do platform admin
-- (migration 07) e o atalho do admin da própria igreja.
create or replace function public.is_church_manager(p_church uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select public.is_platform_admin()
    or public.is_church_admin(p_church)
    or exists (
      select 1
      from ministry_members mm
      join ministries m on m.id = mm.ministry_id
      where m.church_id = p_church
        and mm.user_id = auth.uid()
        and mm.active
        and mm.role = 'gerente'
    );
$$;

create or replace function public.is_church_leader(p_church uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select public.is_platform_admin()
    or public.is_church_admin(p_church)
    or exists (
      select 1
      from ministry_members mm
      join ministries m on m.id = mm.ministry_id
      where m.church_id = p_church
        and mm.user_id = auth.uid()
        and mm.active
        and mm.role in ('gerente', 'lider')
    );
$$;
