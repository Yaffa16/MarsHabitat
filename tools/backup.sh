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
# The readings log: every reading ever pulled, one JSON file per pull.
if [ "${1:-}" = "--docker" ]; then
  docker compose cp "$SERVICE:/data/readings" "$DEST/readings-$STAMP" 2>/dev/null \
    && echo "wrote $DEST/readings-$STAMP/ (the readings log)" || echo "no readings log yet"
else
  SRC="${DATA_DIR:-./data}/readings"
  if [ -d "$SRC" ]; then mkdir -p "$DEST/readings" && cp -R "$SRC/." "$DEST/readings/" && echo "synced $SRC → $DEST/readings/ (the readings log)"; fi
fi

# The pictures from the habitat's camera (13 October: "make sure nothing is missed"): every copy the station made of the
# cloud folder's pictures, with the manifest and the ledger of every picture the folder ever held.
if [ "${1:-}" = "--docker" ]; then
  docker compose cp "$SERVICE:/data/cloud" "$DEST/cloud-$STAMP" 2>/dev/null \
    && echo "wrote $DEST/cloud-$STAMP/ (the camera's pictures, with ledger.json)" || echo "no cloud copies yet"
else
  SRC="${DATA_DIR:-./data}/cloud"
  if [ -d "$SRC" ]; then mkdir -p "$DEST/cloud" && cp -R "$SRC/." "$DEST/cloud/" && echo "synced $SRC → $DEST/cloud/ (the camera's pictures, with ledger.json)"; fi
fi
# The content files — where the schedule, the meals, the Commander Log, the reports, the steps, the power and the counts
# are written (the database holds a copy of only some of them) — and every version of them the station read.
CONTENT="${CONTENT_DIR:-./content}"
if [ -d "$CONTENT" ]; then
  mkdir -p "$DEST/content-$STAMP" && cp -R "$CONTENT/." "$DEST/content-$STAMP/" && echo "wrote $DEST/content-$STAMP/ (the content files as they stand)"
fi
if [ "${1:-}" = "--docker" ]; then
  docker compose cp "$SERVICE:/data/content-history" "$DEST/content-history-$STAMP" 2>/dev/null \
    && echo "wrote $DEST/content-history-$STAMP/ (every version of the content files)" || echo "no content history yet"
else
  SRC="${DATA_DIR:-./data}/content-history"
  if [ -d "$SRC" ]; then mkdir -p "$DEST/content-history" && cp -R "$SRC/." "$DEST/content-history/" && echo "synced $SRC → $DEST/content-history/ (every version of the content files)"; fi
fi

echo "verify a copy any time:  node tools/verify-media.js $DEST/media"
echo "keep at least one copy off the venue machine — the archive is the artwork."
