'use strict';
require('../lib/env');   // load .env before anything reads process.env
/**
 * Seeds a complete, runnable mission. Safe to run repeatedly: it only fills
 * what is missing. Set MISSION_OVERRIDE=true with MISSION_START / MISSION_END to
 * match the real run before opening night.
 */
const { db, now } = require('./index');
const crypto = require('crypto');

const makeHash = (pw) => {
  const salt = crypto.randomBytes(8).toString('hex');
  return salt + ':' + crypto.scryptSync(pw, salt, 32).toString('hex');
};
const verifyHash = (pw, stored) => {
  const [salt, key] = String(stored || '').split(':');
  if (!salt || !key) return false;
  const got = crypto.scryptSync(pw, salt, 32), want = Buffer.from(key, 'hex');
  return want.length === got.length && crypto.timingSafeEqual(got, want);
};

const todayISO = new Date().toISOString().slice(0, 10);
const plusDays = (iso, n) => new Date(Date.parse(iso + 'T00:00:00Z') + n * 86400000).toISOString().slice(0, 10);

// The actual run: Thursday 15 to Tuesday 27 October 2026, thirteen days,
// Europe/Berlin — fixed in src/lib/run.js. MISSION_START/MISSION_END only
// count for a rehearsal, with MISSION_OVERRIDE=true.
const run = require('../lib/run');
const dates = run.dates();
const START = dates.start;
const END = dates.end;

/* ---------------------------------------------------------------- mission */
db.prepare(
  `INSERT INTO mission (id, name, start_date, end_date, timezone, status)
   VALUES (1, ?, ?, ?, ?, 'NOMINAL')
   ON CONFLICT(id) DO UPDATE SET start_date = excluded.start_date, end_date = excluded.end_date,
     timezone = excluded.timezone`
).run(dates.name, START, END, dates.tz);
if (dates.ignored) console.warn(`[seed] MISSION_START/MISSION_END in the environment are ignored — the run is fixed in src/lib/run.js (set MISSION_OVERRIDE=true for a rehearsal)`);

/* ------------------------------------------------------------------- crew */
// The crew are defined in content/crew-and-inventory.json and created by the
// content loader, so a rename in that file is a real change rather than a
// relabel of rows the seed already made.

/* ---------------------------------------------------------------- sensors */
// Channels are defined in content/sensors.json so they can be added or
// retuned without a redeploy. The loader applies them on boot.

/* ------------------------------------------------------------- day content */
// The schedule, meals, inventory levels, diary entries and notes all come from
// the editable files in content/. The seed only creates the day records they
// attach to; content.load() fills them and is re-run whenever a file changes.
const totalDays = Math.round((Date.parse(END) - Date.parse(START)) / 86400000) + 1;
for (let n = 1; n <= totalDays; n++) {
  if (!db.prepare('SELECT 1 FROM day WHERE mission_day = ?').get(n)) {
    const date = new Date(Date.parse(START + 'T00:00:00Z') + (n - 1) * 86400000)
      .toISOString().slice(0, 10);
    db.prepare("INSERT INTO day (mission_day, date, status, updated_at, updated_by) VALUES (?, ?, 'DRAFT', ?, 'seed')")
      .run(n, date, now());
  }
}

/* ------------------------------------------------------------------ admin */
// The one account, from .env: CONTROL_USER and CONTROL_PASSWORD (the older
// names ADMIN_USER and ADMIN_PASSWORD still work). The account is whatever
// the file says at every start: it is created when missing, and its
// password is brought into line when the file names a different one — so a
// password changed in .env is the password after the next start. When no
// password is set at all the account is created once with the placeholder
// and, if it already exists, left exactly as it is.
const user = (process.env.CONTROL_USER || process.env.ADMIN_USER || 'control').trim();
const configuredPass = (process.env.CONTROL_PASSWORD || process.env.ADMIN_PASSWORD || '').trim();
const pass = configuredPass || 'change-this-passphrase';
const existing = db.prepare('SELECT * FROM admin_user WHERE username = ?').get(user);
if (!existing) {
  db.prepare('INSERT INTO admin_user (username, password_hash, role, created_at) VALUES (?, ?, \'CONTROL\', ?)')
    .run(user, makeHash(pass), now());
  console.log(`[seed] admin user "${user}" created`);
} else if (configuredPass && !verifyHash(configuredPass, existing.password_hash)) {
  db.prepare('UPDATE admin_user SET password_hash = ? WHERE id = ?').run(makeHash(configuredPass), existing.id);
  console.log(`[seed] admin user "${user}": password set from .env`);
}

// There is exactly one account. It signs in to mission control and to the
// habitat terminal; any older operator or per-crew logins are removed.
db.prepare("DELETE FROM admin_user WHERE username != ?").run(user);

/* -------------------------------------------------- opening sensor history */
if (!db.prepare('SELECT 1 FROM sensor_reading LIMIT 1').get()) {
  const insert = db.prepare(
    'INSERT INTO sensor_reading (device_id, metric, value, unit, recorded_at) VALUES (?, ?, ?, ?, ?)');
  const tx = db.transaction(() => {
    for (let i = 288; i >= 0; i--) {                      // 24 h at 5 min spacing
      const t = new Date(Date.now() - i * 300000).toISOString();
      const h = (Date.now() - i * 300000) / 3600000 % 24;
      insert.run('seed-01', 'temperature', +(21.2 + Math.sin(h / 3.8) * 1.6 + Math.random() * 0.3).toFixed(2), '°C', t);
      insert.run('seed-01', 'humidity', +(38 + Math.cos(h / 4.2) * 5 + Math.random() * 1.2).toFixed(1), '%', t);
      insert.run('seed-01', 'co2', +(680 + Math.sin(h / 2.6) * 190 + Math.random() * 30).toFixed(0), 'ppm', t);
      insert.run('seed-01', 'air_quality', +(70 + Math.sin(h / 2.2) * 45 + Math.random() * 12).toFixed(0), 'VOC', t);
      insert.run('seed-01', 'radiation', +(0.18 + Math.sin(h / 9) * 0.06 + Math.random() * 0.02).toFixed(3), 'µSv/h', t);
      insert.run('seed-01', 'pressure', +(1008 + Math.sin(h / 7) * 4 + Math.random()).toFixed(1), 'hPa', t);
    }
  });
  tx();
  console.log('[seed] 24 h of sensor history written');
}

console.log(`[seed] mission ${START} → ${END} (${totalDays} days) ready`);
