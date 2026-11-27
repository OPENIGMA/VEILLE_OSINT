#!/usr/bin/env bash
# Rejoue toutes les migrations sur une base vierge puis exécute les tests SQL.
#   PGHOST / PGPORT / PGUSER : accès à un Postgres 15+ jetable (superutilisateur)
#   Usage : bash supabase/tests/run.sh [pattern de test]
set -euo pipefail

cd "$(dirname "$0")/../.."
export PGHOST="${PGHOST:-/tmp/pgsock-veille}" PGPORT="${PGPORT:-54329}" PGUSER="${PGUSER:-postgres}"
DB="${TEST_DB:-veille_test}"
PSQL=(psql -X -q -v ON_ERROR_STOP=1)

"${PSQL[@]}" -d postgres -c "drop database if exists ${DB} with (force)" -c "create database ${DB}"
"${PSQL[@]}" -d "$DB" -f supabase/tests/00_supabase_shim.sql

for f in supabase/migrations/*.sql; do
  echo "== migration : $(basename "$f")"
  "${PSQL[@]}" -d "$DB" -f "$f"
done

for f in supabase/tests/*${1:-}*.test.sql; do
  [ -e "$f" ] || continue
  echo "== test : $(basename "$f")"
  # -o /dev/null : on ne garde que les NOTICE (une ligne « ok » par assertion)
  "${PSQL[@]}" -o /dev/null -d "$DB" -f "$f" 2>&1 | sed -e '/^psql:.*NOTICE:  /s//   /'
done
echo "== TOUT EST VERT"
