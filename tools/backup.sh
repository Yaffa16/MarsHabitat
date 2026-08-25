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

# The media the crew sent out lives beside the database, one file per hash,
# with a manifest.json that describes the folder on its own. Copy it too —
# rsync keeps this incremental, so nightly runs move only what is new.
if [ "${1:-}" = "--docker" ]; then
  docker compose cp "$SERVICE:/data/media" "$DEST/media-$STAMP" 2>/dev/null \
    && echo "wrote $DEST/media-$STAMP/ (every original, plus manifest.json)" \
    || echo "no media folder yet (or docker compose cp unavailable) — nothing sent out so far"
else
  SRC="${DATA_DIR:-./data}/media"
  if [ -d "$SRC" ]; then
    if command -v rsync >/dev/null; then rsync -a --exclude incoming "$SRC/" "$DEST/media/"; else mkdir -p "$DEST/media" && cp -R "$SRC/." "$DEST/media/"; fi
    echo "synced $SRC → $DEST/media/ (every original, plus manifest.json)"
  fi
fi
echo "verify a copy any time:  node tools/verify-media.js $DEST/media"
echo "keep at least one copy off the venue machine — the archive is the artwork."
