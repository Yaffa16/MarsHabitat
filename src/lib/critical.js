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
  pollMs: Number(process.env.CRITICAL_POLL_MS || 15 * 60 * 1000), // every 15 minutes, like every other source
  attemptTimeoutMs: Number(process.env.CRITICAL_TIMEOUT_MS || 12000),
  attempts: 2,
  // Copies of one transmission arrive via several gateways, seconds to a few
  // minutes apart, with identical readings. Below the transmit cycle.
  dedupeWindowMs: 5 * 60 * 1000,
  maxDays: Number(process.env.CRITICAL_MAX_DAYS || 365),  // trim beyond this
  // The record closes with the run: from the end of 27 October 2026 (the
  // run's last day — Berlin, winter time; see src/lib/run.js) the node is
  // not polled again, nothing is stored again, and what is stored is the
  // record. CRITICAL_FREEZE_AT overrides it for a rehearsal.
  freezeAt: Date.parse(process.env.CRITICAL_FREEZE_AT || '2026-10-27T23:59:59+01:00'),
};
const frozen = () => Number.isFinite(CFG.freezeAt) && Date.now() > CFG.freezeAt;

const KEYS = ['co2', 'temp', 'hum', 'light', 'pres', 'bat', 'rssi'];

db.exec(`CREATE TABLE IF NOT EXISTS external_reading (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  t INTEGER NOT NULL,            -- epoch ms
  co2 REAL, temp REAL, hum REAL, light REAL, pres REAL, bat REAL, rssi REAL,
  sig TEXT NOT NULL,             -- value signature, for gateway-copy dedupe
  UNIQUE(t, sig)
);
CREATE INDEX IF NOT EXISTS idx_external_t ON external_reading(t);`);

/**
 * Where the readings start. The node's own feed hands back its last thirty
 * days on every poll, so without a floor weeks of old history would sit on
 * the dashboard and in the record. The floor is an instant kept in the
 * database: nothing stamped before it is stored or served. It is set in
 * one of two ways:
 *
 *   - "build": from today — midnight at the venue on the day the station
 *     starts from a newly built Docker image (the image carries a build
 *     stamp; a restart of the same image leaves the floor where it is), and
 *     the first time a database is used. READINGS_DAYS_BEFORE reaches back
 *     that many days further (default 0).
 *   - "run": from 15 October — midnight at the venue on the first day of
 *     the run — set by Reset to 15 October. Before the run nothing is on the
 *     tiles or the graph; from the first day everything is.
 *
 * READINGS_FROM=YYYY-MM-DD pins the floor to a date instead, whatever is
 * built or reset.
 */
db.exec(`CREATE TABLE IF NOT EXISTS setting (key TEXT PRIMARY KEY, value TEXT NOT NULL)`);
const getSetting = (k) => { const r = db.prepare('SELECT value FROM setting WHERE key = ?').get(k); return r ? r.value : null; };
const setSetting = (k, v) => db.prepare('INSERT INTO setting (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value').run(k, String(v));
const DAYS_BEFORE = Math.max(0, Number(process.env.READINGS_DAYS_BEFORE || 0));

function venue() {
  const mission = require('./mission');
  const m = mission.config();
  return { mission, m };
}
function pinnedFloor() {
  const d = process.env.READINGS_FROM;
  if (!d || !/^\d{4}-\d{2}-\d{2}$/.test(d)) return null;
  try { const { mission, m } = venue(); return mission.venueMidnightUtc(d, m.timezone); }
  catch { return Date.parse(d + 'T00:00:00Z'); }
}
/** Midnight at the venue, today. */
function todayStartMs() {
  try { const { mission, m } = venue(); return mission.venueMidnightUtc(mission.localDate(new Date(), m.timezone), m.timezone); }
  catch { const d = new Date(); d.setUTCHours(0, 0, 0, 0); return d.getTime(); }
}
/** Midnight at the venue on the first day of the run. */
function runStartMs() {
  try { const { mission, m } = venue(); return mission.venueMidnightUtc(m.start_date, m.timezone); }
  catch { return todayStartMs(); }
}

/**
 * Set the floor — mode "build" (from today) or "run" (from 15 October) —
 * and drop what is older. The anchor, where the trend graph's axis begins
 * before the run, is set with it.
 */
function setFloor(reason, mode = 'build') {
  const pinned = pinnedFloor();
  const t = pinned != null ? pinned : mode === 'run' ? runStartMs() : todayStartMs() - DAYS_BEFORE * 86400000;
  setSetting('readings_floor', t);
  setSetting('readings_anchor', t);
  setSetting('readings_mode', pinned != null ? 'pinned' : mode);
  const gone = db.prepare('DELETE FROM external_reading WHERE t < ?').run(t).changes;
  console.log(`[critical] readings start ${new Date(t).toISOString().slice(0, 16).replace('T', ' ')} UTC — ${mode === 'run' ? 'the first day of the run' : 'today'} (${reason})${gone ? `; ${gone} older readings dropped` : ''}`);
  return t;
}
/** "build", "run" or "pinned": how the floor was last set. */
function floorMode() {
  if (pinnedFloor() != null) return 'pinned';
  floorMs();
  return getSetting('readings_mode') || 'build';
}

/** Where the trend graph's axis begins before the run. */
function anchorMs() {
  const pinned = pinnedFloor();
  if (pinned != null) return pinned;
  const v = Number(getSetting('readings_anchor'));
  if (Number.isFinite(v) && v > 0) return v;
  floorMs();
  const w = Number(getSetting('readings_anchor'));
  return Number.isFinite(w) && w > 0 ? w : todayStartMs();
}

function floorMs() {
  const pinned = pinnedFloor();
  if (pinned != null) return pinned;
  const v = Number(getSetting('readings_floor'));
  if (Number.isFinite(v) && v > 0) return v;
  return setFloor('first start of this database', 'build');
}

/**
 * A newly built image starts the readings again from today. The stamp is
 * written into the image by the Dockerfile (/app/BUILD) or given as
 * STATION_BUILD; without either, only the first start and the reset move
 * the floor.
 */
function applyBuild(stamp) {
  if (!stamp) return false;
  // Once the record is closed, a newly built image must not move the floor:
  // that would hide — and drop — the run's stored readings. The record stays.
  if (frozen()) return false;
  if (getSetting('build_seen') === String(stamp)) return false;
  setSetting('build_seen', stamp);
  setFloor(`new build ${stamp}`, 'build');
  return true;
}
function buildStamp() {
  if (process.env.STATION_BUILD) return String(process.env.STATION_BUILD).trim();
  try { return require('fs').readFileSync(require('path').join(__dirname, '..', '..', 'BUILD'), 'utf8').trim() || null; } catch { return null; }
}

const status = { lastReadAt: null, lastError: null, source: null, stored: 0, dropped: 0, before: 0, nodeRows: null, nodeNewest: null };

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
  let stored = 0, dropped = 0, before = 0;
  const fresh = [];   // the rows this poll actually added
  let floor = floorMs();
  // A floor that would hide everything the node has ever sent is no use to
  // anyone standing in front of the dashboard. If the node's newest reading
  // is older than the floor — it has gone quiet, or the station was built
  // long after it last spoke — the floor moves back so the last three days
  // the node did send are kept and shown, marked as old on the page.
  const newest = rows.reduce((m, r) => Math.max(m, r.t), -Infinity);
  if (rows.length && newest < floor && floorMode() === 'build') {
    floor = newest - 3 * 86400000;
    setSetting('readings_floor', floor);
    console.warn(`[critical] the node's newest reading is ${new Date(newest).toISOString().slice(0, 16).replace('T', ' ')} UTC, older than the readings floor — floor moved back to ${new Date(floor).toISOString().slice(0, 16).replace('T', ' ')} UTC so its last three days are shown`);
  }
  for (const row of rows) {
    if (row.t < floor) { before++; continue; }
    const sig = sigOf(row);
    if (nearTwin.get(sig, row.t - CFG.dedupeWindowMs, row.t + CFG.dedupeWindowMs)) {
      dropped++; continue;
    }
    const r = insert.run(row.t, ...KEYS.map((k) => row[k]), sig);
    if (r.changes) { stored++; fresh.push(row); } else dropped++;
  }
  db.prepare('DELETE FROM external_reading WHERE t < ?')
    .run(Math.max(Date.now() - CFG.maxDays * 86400000, floor));
  return { stored, dropped, before, fresh };
});

/* ----------------------------------------------------------------- polling */

async function poll() {
  if (frozen()) {
    if (timer) { clearInterval(timer); timer = null; }
    console.log('[critical] the record is closed — the node is not polled after 27 October 2026');
    return;
  }
  const target = `${CFG.base}?_=${Date.now()}`;
  const errors = [];
  for (let attempt = 1; attempt <= CFG.attempts; attempt++) {
    try {
      const data = parseTolerant(await fetchOnce(target, CFG.attemptTimeoutMs));
      if (!Array.isArray(data)) throw new Error('payload is not an array');
      const rows = shape(data);
      const { stored, dropped, before, fresh } = persist(rows);
      // The node answers with its whole last thirty days every time; the
      // log keeps only what this poll added — the readings not already
      // held — with the counts of what was received and set aside, so a
      // file is the update, not a copy of the feed.
      require('./readings-log').record('node', {
        url: CFG.base, sensorId: CFG.sensorId, floor: floorMs(),
        received: rows.length, stored, dropped, before,
        newest: rows.length ? new Date(rows[rows.length - 1].t).toISOString() : null,
        readings: fresh.map((r) => ({ at: new Date(r.t).toISOString(), t: r.t, ...Object.fromEntries(KEYS.map((k) => [k, r[k]])) })),
      });
      status.lastReadAt = Date.now();
      status.lastError = null;
      status.stored = stored; status.dropped = dropped; status.before = before;
      status.nodeRows = rows.length;
      status.nodeNewest = rows.length ? rows[rows.length - 1].t : null;
      if (!rows.length) console.warn(`[critical] the feed answered but carried no readings for sensor ${CFG.sensorId} — is CRITICAL_SENSOR_ID right?`);
      if (stored) console.log(`[critical] ${stored} new readings stored (${dropped} duplicates)`);
      return;
    } catch (err) {
      errors.push(`attempt ${attempt}: ${err.message || err}`);
      if (attempt < CFG.attempts) await new Promise((r) => setTimeout(r, 900 * attempt));
    }
  }
  status.lastError = { at: Date.now(), errors };
  console.warn('[critical] feed unreachable —', errors.join(' · '));
  require('./readings-log').record('node', { url: CFG.base, sensorId: CFG.sensorId, error: errors, received: 0, stored: 0 });
  // Try again in two minutes rather than waiting a whole transmit cycle: a
  // station that starts before the venue's network is up should not sit
  // blank for twenty minutes.
  if (timer && !retry) { retry = setTimeout(() => { retry = null; poll(); }, 2 * 60 * 1000); retry.unref(); }
}
let retry = null;

let timer = null;
function start() {
  if (timer) return;
  applyBuild(buildStamp());
  if (frozen()) { poll(); return; }   // logs that the record is closed, and that is all
  timer = setInterval(poll, CFG.pollMs);
  timer.unref();
  poll();
}

/* -------------------------------------------------------------------- read */

function rows(days = 30) {
  // Counted back from now — or from the close of the record, once that has
  // passed, so the closed record does not slide out of view.
  const since = Math.min(Date.now(), Number.isFinite(CFG.freezeAt) ? CFG.freezeAt : Infinity) - days * 86400000;
  return db.prepare(
    `SELECT t, ${KEYS.join(', ')} FROM external_reading WHERE t >= ? ORDER BY t`
  ).all(Math.max(since, floorMs()));
}

function snapshot(days = 30) {
  return {
    sensorId: CFG.sensorId,
    pollMs: CFG.pollMs,
    frozen: frozen(),
    lastReadAt: status.lastReadAt,
    lastError: status.lastError,
    // what the node itself holds: how many readings the feed carried for
    // this sensor on the last poll, and when its newest one is from
    nodeRows: status.nodeRows == null ? null : status.nodeRows,
    nodeNewest: status.nodeNewest || null,
    // the first instant readings count from, and the last reset: the browser
    // keeps a copy of the rows and drops it when either moves
    floor: floorMs(),
    mode: floorMode(),
    epoch: require('./content').resetEpoch(),
    rows: rows(days),
  };
}

module.exports = { start, poll, rows, snapshot, persist, floorMs, floorMode, anchorMs, runStartMs, todayStartMs, setFloor, applyBuild, buildStamp, DAYS_BEFORE, CFG, frozen };
