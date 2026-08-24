'use strict';
/**
 * The external habitat sensor feed (critical-sensors.de, "Sensor 11" node).
 *
 * The station server polls srv.php on the node's own transmit cycle, dedupes
 * the gateway copies, and merges every successful read into its SQLite
 * database — so the history accumulates past the 30 days the server returns,
 * survives restarts, is shared by every visitor, and keeps serving when the
 * venue loses its internet connection. The browser never talks to
 * critical-sensors.de directly (no CORS proxies on gallery phones): it reads
 * /api/habitat/data from the station itself.
 *
 * Everything is env-tunable and fails soft: an unreachable feed logs, backs
 * off, and leaves the last good data serving.
 */
const { db } = require('../db');

const CFG = {
  base: process.env.CRITICAL_URL || 'https://critical-sensors.de/srv.php',
  sensorId: String(process.env.CRITICAL_SENSOR_ID || '11'),
  utcSource: process.env.CRITICAL_UTC !== 'false',       // node stamps in UTC
  pollMs: Number(process.env.CRITICAL_POLL_MS || 20 * 60 * 1000), // transmit cycle
  attemptTimeoutMs: Number(process.env.CRITICAL_TIMEOUT_MS || 12000),
  attempts: 2,
  // Copies of one transmission arrive via several gateways, seconds to a few
  // minutes apart, with identical readings. Below the transmit cycle.
  dedupeWindowMs: 5 * 60 * 1000,
  maxDays: Number(process.env.CRITICAL_MAX_DAYS || 365),  // trim beyond this
};

const KEYS = ['co2', 'temp', 'hum', 'light', 'pres', 'bat', 'rssi'];

db.exec(`CREATE TABLE IF NOT EXISTS external_reading (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  t INTEGER NOT NULL,            -- epoch ms
  co2 REAL, temp REAL, hum REAL, light REAL, pres REAL, bat REAL, rssi REAL,
  sig TEXT NOT NULL,             -- value signature, for gateway-copy dedupe
  UNIQUE(t, sig)
);
CREATE INDEX IF NOT EXISTS idx_external_t ON external_reading(t);`);

const status = { lastReadAt: null, lastError: null, source: null, stored: 0, dropped: 0 };

/* ------------------------------------------------------------------ fetch */

function parseTolerant(text) {
  try { return JSON.parse(text); } catch (_) { /* fall through */ }
  const a = text.indexOf('['), b = text.lastIndexOf(']');
  if (a !== -1 && b > a) return JSON.parse(text.slice(a, b + 1));
  throw new Error('no JSON array in response');
}

async function fetchOnce(url, ms) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), ms);
  try {
    const res = await fetch(url, { signal: ctrl.signal });
    if (!res.ok) throw new Error('HTTP ' + res.status);
    return await res.text();
  } finally { clearTimeout(timer); }
}

/* ---------------------------------------------------------------- shaping */

function parseStamp(s) {
  const iso = String(s).trim().replace(' ', 'T');
  const d = new Date(CFG.utcSource ? iso + 'Z' : iso);
  return isNaN(d) ? null : d.getTime();
}
const num = (v) => { const n = parseFloat(v); return Number.isFinite(n) ? n : null; };
const sigOf = (row) => KEYS.map((k) => row[k]).join('|');

function shape(raw) {
  const rows = [];
  for (const r of raw) {
    if (String(r.id) !== CFG.sensorId) continue;
    const t = parseStamp(r.date);
    if (t == null) continue;
    const row = { t };
    for (const k of KEYS) row[k] = num(r[k]);
    rows.push(row);
  }
  rows.sort((a, b) => a.t - b.t);
  return rows;
}

/* -------------------------------------------------------------- persisting */

const insert = db.prepare(
  `INSERT OR IGNORE INTO external_reading (t, ${KEYS.join(', ')}, sig)
   VALUES (?, ${KEYS.map(() => '?').join(', ')}, ?)`);
const nearTwin = db.prepare(
  'SELECT 1 FROM external_reading WHERE sig = ? AND t BETWEEN ? AND ? LIMIT 1');

/** Merge one batch: a copy of a reading already stored within the dedupe
 *  window is dropped; everything else is kept. Same rule as the reference
 *  dashboard, applied against the whole stored history. */
const persist = db.transaction((rows) => {
  let stored = 0, dropped = 0;
  for (const row of rows) {
    const sig = sigOf(row);
    if (nearTwin.get(sig, row.t - CFG.dedupeWindowMs, row.t + CFG.dedupeWindowMs)) {
      dropped++; continue;
    }
    const r = insert.run(row.t, ...KEYS.map((k) => row[k]), sig);
    if (r.changes) stored++; else dropped++;
  }
  db.prepare('DELETE FROM external_reading WHERE t < ?')
    .run(Date.now() - CFG.maxDays * 86400000);
  return { stored, dropped };
});

/* ----------------------------------------------------------------- polling */

async function poll() {
  const target = `${CFG.base}?_=${Date.now()}`;
  const errors = [];
  for (let attempt = 1; attempt <= CFG.attempts; attempt++) {
    try {
      const data = parseTolerant(await fetchOnce(target, CFG.attemptTimeoutMs));
      if (!Array.isArray(data)) throw new Error('payload is not an array');
      const rows = shape(data);
      const { stored, dropped } = persist(rows);
      status.lastReadAt = Date.now();
      status.lastError = null;
      status.stored = stored; status.dropped = dropped;
      if (stored) console.log(`[critical] ${stored} new readings stored (${dropped} duplicates)`);
      return;
    } catch (err) {
      errors.push(`attempt ${attempt}: ${err.message || err}`);
      if (attempt < CFG.attempts) await new Promise((r) => setTimeout(r, 900 * attempt));
    }
  }
  status.lastError = { at: Date.now(), errors };
  console.warn('[critical] feed unreachable —', errors.join(' · '));
}

let timer = null;
function start() {
  if (timer) return;
  poll();
  timer = setInterval(poll, CFG.pollMs);
  timer.unref();
}

/* -------------------------------------------------------------------- read */

function rows(days = 30) {
  const since = Date.now() - days * 86400000;
  return db.prepare(
    `SELECT t, ${KEYS.join(', ')} FROM external_reading WHERE t >= ? ORDER BY t`
  ).all(since);
}

function snapshot(days = 30) {
  return {
    sensorId: CFG.sensorId,
    pollMs: CFG.pollMs,
    lastReadAt: status.lastReadAt,
    lastError: status.lastError,
    rows: rows(days),
  };
}

module.exports = { start, poll, rows, snapshot, CFG };
