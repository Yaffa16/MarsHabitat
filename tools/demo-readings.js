#!/usr/bin/env node
'use strict';
/**
 * Fills the habitat with plausible readings for every mission day so far, so
 * the dashboard's tiles and trend charts can be seen before the real sensor
 * node exists. Writes into the station's own database (external_reading —
 * the table the live feed fills), one sample every 30 minutes from 00:00 on
 * mission day 1 up to now, with a daily rhythm and a slow drift over the run.
 *
 *   npm run demo            # readings for the mission in .env
 *   npm run demo -- --clear # remove the demo readings again
 *
 * Only rows stamped as demo are ever removed; real readings are left alone.
 * Nothing here is served as real: the public page shows exactly what the
 * table holds, and the stores and crew figures still come from content/.
 */
require('../src/lib/env');
const path = require('path');
const fs = require('fs');
const Database = require('better-sqlite3');

const DATA_DIR = process.env.DATA_DIR || path.join(__dirname, '../data');
fs.mkdirSync(DATA_DIR, { recursive: true });
const db = new Database(path.join(DATA_DIR, 'station.db'));

db.exec(`CREATE TABLE IF NOT EXISTS external_reading (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  t INTEGER NOT NULL,
  co2 REAL, temp REAL, hum REAL, light REAL, pres REAL, bat REAL, rssi REAL,
  sig TEXT NOT NULL,
  UNIQUE(t, sig)
);
CREATE INDEX IF NOT EXISTS idx_external_t ON external_reading(t);`);

if (process.argv.includes('--clear')) {
  const n = db.prepare("DELETE FROM external_reading WHERE sig LIKE 'demo:%'").run().changes;
  console.log(`[demo] removed ${n} demo readings`);
  process.exit(0);
}

const start = process.env.MISSION_START || '2026-10-19';
const t0 = new Date(start + 'T00:00:00').getTime();
const now = Date.now();
if (t0 > now) {
  console.log(`[demo] the mission opens on ${start}; nothing to fill in yet.`);
  console.log('[demo] to see the dashboard populated, seed a mission around today first:');
  console.log('[demo]   MISSION_START=$(date -d "-4 days" +%F) MISSION_END=$(date -d "+4 days" +%F) npm run seed');
  process.exit(0);
}

// A small deterministic noise so re-running gives the same picture.
const noise = (i, k) => (Math.sin(i * 12.9898 + k * 78.233) * 43758.5453) % 1;

const ins = db.prepare(
  'INSERT OR IGNORE INTO external_reading (t, co2, temp, hum, light, pres, bat, rssi, sig) VALUES (?,?,?,?,?,?,?,?,?)'
);
const tx = db.transaction(() => {
  let n = 0, i = 0;
  for (let t = t0; t <= now; t += 30 * 60 * 1000, i++) {
    const day = (t - t0) / 86400000;            // fractional mission day
    const h = ((t - t0) / 3600000) % 24;        // hour of the day (local midnight = 0)
    const daylight = h > 6.5 && h < 21.5;
    const occupied = h > 7 && h < 23;           // three people awake and moving
    const co2 = 480 + day * 28 + (occupied ? 210 : 40) + 90 * Math.sin((h - 3) / 24 * Math.PI * 2)
      + (day > 5.4 && day < 6.2 ? 240 : 0)      // the cartridge that ran late on day 6
      + noise(i, 1) * 40;
    const temp = 21.2 + day * 0.18 + 1.4 * Math.sin((h - 5) / 24 * Math.PI * 2) + noise(i, 2) * 0.4;
    const hum = 41 + day * 1.3 + (occupied ? 3 : 0) + 2 * Math.sin((h - 2) / 24 * Math.PI * 2) + noise(i, 3) * 2;
    const light = daylight ? 380 + 220 * Math.sin((h - 6.5) / 15 * Math.PI) + noise(i, 4) * 40 : 30 + noise(i, 5) * 10;
    ins.run(t, Math.round(co2), Math.round(temp * 10) / 10, Math.round(hum * 10) / 10, Math.round(light),
      1012 + Math.round(noise(i, 6) * 30) / 10, 3.9, -58 - Math.round(noise(i, 7) * 6), `demo:${t}`);
    n++;
  }
  return n;
});
const written = tx();
console.log(`[demo] ${written} readings written, from ${start} 00:00 to now (30-minute samples)`);
console.log('[demo] the dashboard reads them on its next poll; reload the page to see the charts fill in');
