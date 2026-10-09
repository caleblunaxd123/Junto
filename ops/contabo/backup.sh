#!/bin/sh
set -eu
cd /opt/junto
umask 077
install -d -m 700 /opt/junto/backups
stamp=$(date -u +%Y%m%dT%H%M%SZ)
file="/opt/junto/backups/junto-${stamp}.dump"
docker compose --env-file compose.env exec -T db pg_dump -U junto -d junto --format=custom > "$file"
docker compose --env-file compose.env exec -T db pg_restore --list < "$file" > /dev/null
echo "JUNTO backup validated: $file"
