#!/usr/bin/env bash
# Take a consistent copy of the station. Safe to run while it is serving:
# sqlite's .backup handles the WAL correctly, a plain cp does not.
#
#   bash tools/backup.sh                 # local install
#   bash tools/backup.sh --docker        # running under docker compose
set -euo pipefail

DEST="${BACKUP_DIR:-./backups}"
STAMP=$(date +%Y-%m-%d-%H%M)
mkdir -p "$DEST"

if [ "${1:-}" = "--docker" ]; then
  SERVICE="${SERVICE:-station}"
  docker compose exec -T "$SERVICE" node -e "
    const Database = require('better-sqlite3');
    const db = new Database(process.env.DATA_DIR + '/station.db', { readonly: true });
    db.backup('/tmp/backup.db').then(() => { console.error('ok'); process.exit(0); });
  "
  docker compose cp "$SERVICE:/tmp/backup.db" "$DEST/station-$STAMP.db"
else
  DB="${DATA_DIR:-./data}/station.db"
  node -e "
    const Database = require('better-sqlite3');
    const db = new Database('$DB', { readonly: true });
    db.backup('$DEST/station-$STAMP.db').then(() => process.exit(0));
  "
fi

echo "wrote $DEST/station-$STAMP.db"
echo "keep at least one copy off the venue machine — the archive is the artwork."
