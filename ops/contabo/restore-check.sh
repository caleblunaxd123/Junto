#!/bin/sh
# Only restore a JUNTO backup into a new, explicitly disposable check database.
set -eu
cd /opt/junto
case "${1:-}" in
  /opt/junto/backups/junto-*.dump) ;;
  *) echo 'Specify a private JUNTO backup' >&2; exit 1 ;;
esac
test -f "$1"
test "$(dirname "$(realpath "$1")")" = /opt/junto/backups
expected=${2:-}
case "$expected" in
  ''|*[!0-9]*) echo 'Specify the reviewed migration count in the backup' >&2; exit 1 ;;
esac
test "$expected" -gt 0 && test "$expected" -le 999
db="junto_restorecheck_$(date -u +%Y%m%d%H%M%S)_$$"
# Fail if this name already exists: never overwrite any database.
docker compose --env-file compose.env exec -T db createdb -U junto "$db"
docker compose --env-file compose.env exec -T db pg_restore -U junto --dbname="$db" --no-owner --no-acl < "$1"
count=$(docker compose --env-file compose.env exec -T db psql -U junto -d "$db" -Atc 'SELECT count(*) FROM _prisma_migrations')
test "$count" = "$expected"
pending=$(docker compose --env-file compose.env exec -T db psql -U junto -d "$db" -Atc 'SELECT count(*) FROM _prisma_migrations WHERE finished_at IS NULL AND rolled_back_at IS NULL')
test "$pending" = 0
echo "PASS: backup restored into an isolated check database; $count migration records recovered, no pending migration."
# This database was created above solely by this check, not used by the app.
docker compose --env-file compose.env exec -T db dropdb -U junto "$db"
