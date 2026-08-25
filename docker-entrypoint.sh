#!/bin/sh
set -e

# The seed is idempotent: it creates the mission, crew, sensor channels,
# inventory definitions and day records only where they are missing.
# Running it on every boot means a fresh volume comes up complete, and an
# existing volume is left alone.
echo "[MCS] preparing ${DATA_DIR:-/data}"
node src/db/seed.js

if [ -z "${SENSOR_TOKEN:-}" ]; then
  echo "[MCS] warning: SENSOR_TOKEN is not set — the ingest endpoint will reject every device."
fi
if [ "${ADMIN_PASSWORD:-change-this-passphrase}" = "change-this-passphrase" ]; then
  echo "[MCS] warning: ADMIN_PASSWORD is still the default. Change it before the run opens."
fi

exec "$@"
