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
db=junto_restorecheck_20261008
# Fail if this name already exists: never overwrite any database.
docker compose --env-file compose.env exec -T db createdb -U junto "$db"
docker compose --env-file compose.env exec -T db pg_restore -U junto --dbname="$db" --no-owner --no-acl < "$1"
count=$(docker compose --env-file compose.env exec -T db psql -U junto -d "$db" -Atc 'SELECT count(*) FROM _prisma_migrations')
test "$count" = 8
echo 'PASS: backup restored into an isolated check database; eight migrations recovered.'
# This database was created above solely by this check, not used by the app.
docker compose --env-file compose.env exec -T db dropdb -U junto "$db"
