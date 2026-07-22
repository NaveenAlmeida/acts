#!/usr/bin/env bash
# Testa o restore de um backup num banco limpo e confere se os dados chegaram.
#
# Backup que nunca foi restaurado não é backup, é esperança. Este script existe
# para transformar o "OK" do backup.log numa afirmação verificada.
#
#   ./scripts/testar-restore.sh                      # usa o backup mais recente
#   ./scripts/testar-restore.sh backups/xxx-schema.sql
#
# Precisa do Supabase local de pé (docker) — o restore acontece num banco
# descartável dentro do container, nunca encosta em produção nem no dev.
set -euo pipefail
export MSYS_NO_PATHCONV=1 # Git Bash converteria /tmp em C:\...\Temp

cd "$(dirname "$0")/.."
# O nome do container leva o nome da pasta do projeto — descobrir sozinho evita
# quebrar em outro clone.
DB_CONTAINER="${DB_CONTAINER:-$(docker ps --filter name=supabase_db --format '{{.Names}}' | head -1)}"
[ -n "$DB_CONTAINER" ] || { echo "Supabase local não está de pé (npx supabase start)"; exit 1; }
ALVO="restore_test"

schema="${1:-$(ls -t backups/*-schema.sql | head -1)}"
base="${schema%-schema.sql}"
dados="$base-dados.sql"
[ -f "$dados" ] || { echo "faltando $dados"; exit 1; }
echo "Backup: $(basename "$base")"

docker exec "$DB_CONTAINER" psql -U postgres -d postgres -q \
  -c "drop database if exists $ALVO;" -c "create database $ALVO;"

# O dump de schema do supabase CLI só traz o schema public; o de dados traz
# também auth/storage. Sem este prelúdio, os INSERTs de usuário caem no chão e
# o restore "passa" com todas as contas faltando. Os tipos são permissivos de
# propósito: aqui é arquivo consultável, não um GoTrue funcionando.
prelude=".prelude-restore.sql" # caminho relativo: docker cp roda com MSYS_NO_PATHCONV
python - "$dados" > "$prelude" <<'PY'
import re, sys
sql = open(sys.argv[1], encoding="utf-8").read()
print('create schema if not exists auth; create schema if not exists storage;')
print('create schema if not exists extensions; create schema if not exists vault;')
# As policies do dump chamam auth.uid(); sem elas o CREATE POLICY falha e o
# banco restaurado fica sem RLS — pior que não restaurar.
print("create or replace function auth.uid() returns uuid language sql stable as $$ select null::uuid $$;")
print("create or replace function auth.role() returns text language sql stable as $$ select null::text $$;")
print("create or replace function auth.jwt() returns jsonb language sql stable as $$ select null::jsonb $$;")
print('create publication supabase_realtime;')
vistas = set()
for schema, tabela, cols in re.findall(
    r'INSERT INTO "(auth|storage)"\."(\w+)" \(([^)]*)\)', sql
):
    if (schema, tabela) in vistas:
        continue
    vistas.add((schema, tabela))
    campos = []
    for c in cols.split(","):
        nome = c.strip()
        # public.profiles tem FK para auth.users(id): precisa ser uuid E única,
        # senão o schema.sql não consegue recriar a referência.
        if (schema, tabela, nome) == ("auth", "users", '"id"'):
            campos.append(f"{nome} uuid primary key")
        else:
            campos.append(f"{nome} text")
    print(f'create table if not exists "{schema}"."{tabela}" ({", ".join(campos)});')
for seq in set(re.findall(r"setval\('\"(\w+)\"\.\"(\w+)\"'", sql)):
    print(f'create sequence if not exists "{seq[0]}"."{seq[1]}";')
PY

docker cp "$prelude" "$DB_CONTAINER:/tmp/prelude.sql" >/dev/null
docker cp "$schema" "$DB_CONTAINER:/tmp/schema.sql" >/dev/null
docker cp "$dados" "$DB_CONTAINER:/tmp/dados.sql" >/dev/null
rm -f "$prelude"

erros=0
for f in prelude schema dados; do
  saida=$(docker exec "$DB_CONTAINER" psql -U postgres -d "$ALVO" -q -f "/tmp/$f.sql" 2>&1 | grep -i "ERROR" || true)
  if [ -n "$saida" ]; then
    echo "ERROS ao restaurar $f:"; echo "$saida" | head -10
    erros=$((erros + 1))
  fi
done

echo ""
echo "Conferindo o conteúdo restaurado:"
docker exec "$DB_CONTAINER" psql -U postgres -d "$ALVO" -tA -F' ' -c "
  select 'igrejas', count(*) from public.churches
  union all select 'pessoas', count(*) from public.profiles
  union all select 'escalas', count(*) from public.assignments
  union all select 'contas de login', count(*) from auth.users
  union all select 'crianças', count(*) from public.children;"

# Uma igreja sem gente ou sem login é um restore que falhou em silêncio.
vazio=$(docker exec "$DB_CONTAINER" psql -U postgres -d "$ALVO" -tAc \
  "select case when (select count(*) from public.profiles) = 0
             or (select count(*) from auth.users) = 0 then 1 else 0 end;")

echo ""
if [ "$erros" -eq 0 ] && [ "$vazio" -eq 0 ]; then
  echo "RESTORE OK — dados e contas conferidos."
else
  echo "RESTORE FALHOU — o backup não volta a ser um banco. Não confie nele."
  exit 1
fi
