'use strict';
/**
 * The habitat's readings — CO₂, temperature, humidity, air pressure, and
 * from the new sensor the volatile organic compounds and the air quality
 * index with its readable classification — and where they start.
 *
 * Two sources feed the one table (external_reading), and the rest of the
 * station — the tiles on the landing page, the ticker, the booklet, the
 * archive, the PDF record — reads the table and never asks which:
 *
 *   - "home-assistant": the M5 ENV Pro (a BME688 running BSEC) inside the
 *     habitat, read through Home Assistant. WHICH entities feed which
 *     channel lives in content/home-assistant.json under `habitat`; WHERE
 *     Home Assistant is lives in .env (HA_HOST, HA_API_TOKEN). This is the
 *     source whenever both are set (src/lib/habitat-feed.js).
 *   - "node": the external critical-sensors.de feed ("Sensor 11"), polled
 *     on the node's own transmit cycle, the gateway copies deduped, kept
 *     for a venue with no sensor of its own. HABITAT_SOURCE=node forces it.
 *
 * Either way the server polls and stores, so the history accumulates,
 * survives restarts, is shared by every visitor, and keeps serving when the
 * venue loses its network; the browser reads /api/habitat/data from the
 * station itself. Everything is env-tunable and fails soft: an unreachable
 * source logs, backs off, and leaves the last good data serving.
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
  // Which source feeds the table: "home-assistant", "node", or "auto" —
  // Home Assistant whenever it is configured and the habitat entities are
  // mapped in content/home-assistant.json, the node otherwise.
  source: String(process.env.HABITAT_SOURCE || 'auto').trim().toLowerCase(),
  // The habitat feed reads Home Assistant every minute by default (the
  // sensor itself reports every few seconds; the history call between two
  // polls brings every change in between); HABITAT_POLL_MS overrides.
  habitatPollMs: Math.max(15000, Number(process.env.HABITAT_POLL_MS || 60 * 1000)),
};
const frozen = () => Number.isFinite(CFG.freezeAt) && Date.now() > CFG.freezeAt;

// The numeric channels of a reading. The node sends the first seven (light,
// battery and signal strength are its own); the habitat sensor fills co2,
// temp, hum and pres and adds voc (breath-VOC equivalent) and iaq (the air
// quality index, 0–500). `iaqc` is the index's readable classification —
// "Excellent", "Good", "Lightly polluted" … — kept as text beside it.
const KEYS = ['co2', 'temp', 'hum', 'light', 'pres', 'bat', 'rssi', 'voc', 'iaq'];
const TEXT_KEYS = ['iaqc'];

db.exec(`CREATE TABLE IF NOT EXISTS external_reading (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  t INTEGER NOT NULL,            -- epoch ms
  co2 REAL, temp REAL, hum REAL, light REAL, pres REAL, bat REAL, rssi REAL,
  sig TEXT NOT NULL,             -- value signature, for gateway-copy dedupe
  UNIQUE(t, sig)
);
CREATE INDEX IF NOT EXISTS idx_external_t ON external_reading(t);`);
// A database made before the habitat sensor gains its columns in place.
{
  const have = new Set(db.prepare('PRAGMA table_info(external_reading)').all().map((c) => c.name));
  for (const [col, type] of [['voc', 'REAL'], ['iaq', 'REAL'], ['iaqc', 'TEXT']]) {
    if (!have.has(col)) db.exec(`ALTER TABLE external_reading ADD COLUMN ${col} ${type}`);
  }
}

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

const status = { lastReadAt: null, lastError: null, source: null, stored: 0, dropped: 0, before: 0, nodeRows: null, nodeNewest: null, entities: null };

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
  `INSERT OR IGNORE INTO external_reading (t, ${KEYS.join(', ')}, ${TEXT_KEYS.join(', ')}, sig)
   VALUES (?, ${KEYS.map(() => '?').join(', ')}, ${TEXT_KEYS.map(() => '?').join(', ')}, ?)`);
const lastStored = db.prepare(
  `SELECT t, ${KEYS.join(', ')}, ${TEXT_KEYS.join(', ')} FROM external_reading ORDER BY t DESC LIMIT 1`);
const sigOfAll = (row) => KEYS.concat(TEXT_KEYS).map((k) => row[k] == null ? '' : row[k]).join('|');
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
    const r = insert.run(row.t, ...KEYS.map((k) => row[k]), ...TEXT_KEYS.map((k) => row[k] == null ? null : String(row[k])), sig);
    if (r.changes) { stored++; fresh.push(row); } else dropped++;
  }
  db.prepare('DELETE FROM external_reading WHERE t < ?')
    .run(Math.max(Date.now() - CFG.maxDays * 86400000, floor));
  return { stored, dropped, before, fresh };
});

/**
 * Merge the habitat feed's rows: each is a full snapshot of every channel
 * at its minute, in time order, newest last. There are no gateway copies
 * to dedupe here; a row identical to the one stored before it is kept only
 * when five minutes have passed, so a steady sensor still leaves a
 * heartbeat and the tiles know it is current. Nothing before the floor is
 * stored.
 */
const persistHabitat = db.transaction((rows) => {
  let stored = 0, dropped = 0, before = 0;
  const fresh = [];
  const floor = floorMs();
  let prev = lastStored.get() || null;
  for (const row of rows) {
    if (row.t < floor) { before++; continue; }
    if (prev && row.t <= prev.t) { dropped++; continue; }
    const sig = sigOfAll(row);
    if (prev && sigOfAll(prev) === sig && row.t - prev.t < 5 * 60 * 1000) { dropped++; continue; }
    const r = insert.run(row.t, ...KEYS.map((k) => row[k] == null ? null : row[k]), ...TEXT_KEYS.map((k) => row[k] == null ? null : String(row[k])), sig);
    if (r.changes) { stored++; fresh.push(row); prev = row; } else dropped++;
  }
  db.prepare('DELETE FROM external_reading WHERE t < ?')
    .run(Math.max(Date.now() - CFG.maxDays * 86400000, floor));
  return { stored, dropped, before, fresh };
});

/* ----------------------------------------------------------------- polling */

/** Which source feeds the table right now. */
function source() {
  if (CFG.source === 'node' || CFG.source === 'home-assistant') return CFG.source;
  try { return require('./habitat-feed').configured() ? 'home-assistant' : 'node'; } catch { return 'node'; }
}

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
  status.source = source();
  if (status.source === 'home-assistant') {
    // The habitat sensor, through Home Assistant: src/lib/habitat-feed.js
    // polls and hands its rows to persistHabitat.
    const feed = require('./habitat-feed');
    if (frozen()) { feed.poll(); return; }
    console.log(`[habitat] readings come from the habitat sensor through Home Assistant, read every ${Math.round(CFG.habitatPollMs / 1000)} s`);
    timer = setInterval(() => feed.poll().catch(() => {}), CFG.habitatPollMs);
    timer.unref();
    feed.poll().catch(() => {});
    return;
  }
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
    `SELECT t, ${KEYS.join(', ')}, ${TEXT_KEYS.join(', ')} FROM external_reading WHERE t >= ? ORDER BY t`
  ).all(Math.max(since, floorMs()));
}

function snapshot(days = 30) {
  const src = status.source || source();
  const ha = src === 'home-assistant' ? (() => { try { return require('./habitat-feed').status(); } catch { return null; } })() : null;
  return {
    source: src,
    sensorId: src === 'node' ? CFG.sensorId : null,
    pollMs: src === 'home-assistant' ? CFG.habitatPollMs : CFG.pollMs,
    // How old the newest reading may be and still count as current: the
    // node transmits every twenty minutes, so thirty; the habitat sensor is
    // read every minute, so five — or three polls, whichever is longer.
    staleMs: src === 'home-assistant' ? Math.max(5 * 60 * 1000, 3 * CFG.habitatPollMs) : 30 * 60 * 1000,
    frozen: frozen(),
    lastReadAt: ha ? ha.lastReadAt : status.lastReadAt,
    lastError: ha ? ha.lastError : status.lastError,
    // the habitat sensor's entities as Home Assistant last reported them
    entities: ha ? ha.entities : null,
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

module.exports = { start, poll, rows, snapshot, persist, persistHabitat, lastStored: () => lastStored.get() || null, source, floorMs, floorMode, anchorMs, runStartMs, todayStartMs, setFloor, applyBuild, buildStamp, DAYS_BEFORE, CFG, KEYS, TEXT_KEYS, frozen };
