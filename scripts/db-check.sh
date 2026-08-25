#!/usr/bin/env bash
# Applies every migration to a scratch database on plain Postgres (with the
# Supabase shim), then runs the RLS behavior matrix. Proves two things CI
# cannot otherwise see: the migrations actually apply, and the policies
# actually enforce what their comments claim.
#
# Usage:
#   scripts/db-check.sh                    # uses PG* env vars / defaults
#   PGHOST=localhost PGUSER=postgres PGPASSWORD=postgres scripts/db-check.sh
set -euo pipefail

DB_NAME="${DB_NAME:-letters_db_check}"
PSQL=(psql -v ON_ERROR_STOP=1 -q)

repo_root="$(cd "$(dirname "$0")/.." && pwd)"

"${PSQL[@]}" -d postgres -c "drop database if exists ${DB_NAME};"
"${PSQL[@]}" -d postgres -c "create database ${DB_NAME};"

"${PSQL[@]}" -d "${DB_NAME}" -f "${repo_root}/supabase/tests/shim.sql"

for migration in "${repo_root}"/supabase/migrations/*.sql; do
  echo "applying $(basename "${migration}")"
  "${PSQL[@]}" -d "${DB_NAME}" -f "${migration}"
done

echo "running RLS matrix"
"${PSQL[@]}" -d "${DB_NAME}" -f "${repo_root}/supabase/tests/rls_matrix.sql"

echo "db-check: OK"
