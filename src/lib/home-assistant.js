'use strict';
/**
 * The habitat's own hardware, read through Home Assistant.
 *
 * A Home Assistant instance on the venue network carries the real devices
 * inside the habitat — a smart plug's energy meter, a temperature sensor,
 * more as they are installed. The station server polls its REST API and
 * keeps every state change in its own SQLite database, so the history
 * accumulates, survives restarts, and is served to every visitor by the
 * station itself: the browser never talks to Home Assistant (whose address
 * and token stay on the server, in .env, out of the repository).
 *
 * WHICH sensors are read lives in content/home-assistant.json — a plain
 * file, hot-read on every poll, so adding a device is an edit, not a
 * redeploy. WHERE Home Assistant is and HOW to authenticate live in .env
 * (HA_HOST, HA_PORT, HA_API_TOKEN): all of it will change, none of it is
 * code. Without host and token the bridge is off and the panel stays off
 * the page — the station runs exactly as before.
 *
 * The same disciplines as the external node (src/lib/critical.js):
 * readings respect the readings floor, Reset to 15 October clears them,
 * EVERY poll — changed or not, answered or not — is written to the readings
 * log exactly as Home Assistant returned it (state, attributes, both
 * timestamps, and whatever the history endpoint handed back), and from the
 * end of 27 October 2026 Home Assistant is not polled again — the record is
 * closed. The database keeps one row per state change (it is what the
 * panel draws); the log keeps every pull, so nothing that was ever fetched
 * is lost even when the state had not moved.
 */
const fs = require('fs');
const path = require('path');
const { db } = require('../db');

const CFG = {
  host: (process.env.HA_HOST || '').trim(),
  port: String(process.env.HA_PORT || '80').trim(),
  token: (process.env.HA_API_TOKEN || '').trim(),
  // Read every 20 minutes — the same rhythm as the external node's
  // transmissions; HA_POLL_MS in .env overrides.
  pollMs: Math.max(15000, Number(process.env.HA_POLL_MS || 20 * 60 * 1000)),
  attemptTimeoutMs: Number(process.env.HA_TIMEOUT_MS || 10000),
  attempts: 2,
  // A restart or a quiet spell is backfilled from HA's history endpoint,
  // which holds the recent past; one day is what the panel draws.
  backfillMs: Number(process.env.HA_BACKFILL_MS || 24 * 3600 * 1000),
  // The record closes with the run — same instant as the external node,
  // and CRITICAL_FREEZE_AT moves both for a rehearsal.
  freezeAt: Date.parse(process.env.HA_FREEZE_AT || process.env.CRITICAL_FREEZE_AT
    || '2026-10-27T23:59:59+01:00'),
};
const frozen = () => Number.isFinite(CFG.freezeAt) && Date.now() > CFG.freezeAt;
const configured = () => !!(CFG.host && CFG.token);

/* ------------------------------------------------------------------ config */

const DIR = process.env.CONTENT_DIR || path.join(__dirname, '../../content');
const FILE = path.join(DIR, 'home-assistant.json');
let cfgCache = { mtimeMs: -1, sensors: [], error: null };

/** The sensor list from content/home-assistant.json, re-read when the file
 *  changes. A broken file keeps the last good list serving and says so. */
function sensors() {
  let st = null;
  try { st = fs.statSync(FILE); } catch { /* no file: no sensors */ }
  if (!st) { cfgCache = { mtimeMs: -1, sensors: [], error: null }; return []; }
  if (st.mtimeMs === cfgCache.mtimeMs) return cfgCache.sensors;
  try {
    const raw = JSON.parse(fs.readFileSync(FILE, 'utf8'));
    const list = (Array.isArray(raw) ? raw : raw.sensors || [])
      .filter((s) => s && s.id)
      .map((s) => ({
        id: String(s.id).replace(/^sensor\./, ''),
        label: s.label || String(s.id),
        unit: s.unit || '',
        // "gauge" reads as it is; "counter" only ever rises (an energy
        // meter), so the tile also says what today has added.
        kind: s.kind === 'counter' ? 'counter' : 'gauge',
        decimals: Number.isFinite(Number(s.decimals)) ? Number(s.decimals) : 1,
      }));
    cfgCache = { mtimeMs: st.mtimeMs, sensors: list, error: null };
    console.log(`[home-assistant] ${list.length} sensor${list.length === 1 ? '' : 's'} configured in content/home-assistant.json`);
  } catch (e) {
    if (cfgCache.error !== e.message) console.warn(`[home-assistant] content/home-assistant.json is broken (${e.message}) — the last good list keeps serving`);
    cfgCache.error = e.message;
    cfgCache.mtimeMs = st.mtimeMs;
  }
  return cfgCache.sensors;
}

/* ------------------------------------------------------------------- floor */

/** Nothing stamped before the readings floor is stored or served — the same
 *  floor as every other habitat reading (see src/lib/critical.js). */
function floorMs() {
  try { return require('./critical').floorMs(); } catch { return 0; }
}

/* -------------------------------------------------------------------- fetch */

async function fetchJson(pathname, ms) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), ms);
  try {
    const res = await fetch(`http://${CFG.host}:${CFG.port}${pathname}`, {
      signal: ctrl.signal,
      headers: { Authorization: `Bearer ${CFG.token}`, 'Content-Type': 'application/json' },
    });
    const text = await res.text();
    // Home Assistant reports errors as plain text ("404: Not Found"), not JSON.
    if (!res.ok) throw new Error(`HTTP ${res.status}: ${text.slice(0, 120)}`);
    return JSON.parse(text);
  } finally { clearTimeout(timer); }
}

/* -------------------------------------------------------------- persisting */

const insert = db.prepare(
  'INSERT OR IGNORE INTO ha_reading (entity, t, value, state, unit) VALUES (?, ?, ?, ?, ?)');
const newestOf = db.prepare('SELECT MAX(t) t FROM ha_reading WHERE entity = ?');
const num = (v) => { const n = parseFloat(v); return Number.isFinite(n) ? n : null; };
const DEAD = new Set(['unavailable', 'unknown', 'none', '']);

function store(entity, t, state, unit) {
  if (!Number.isFinite(t) || t < floorMs()) return 0;
  const s = String(state ?? '').trim();
  if (DEAD.has(s.toLowerCase())) return 0;
  return insert.run(entity, t, num(s), s, unit || null).changes;
}

/* ----------------------------------------------------------------- polling */

// What the last poll saw, per entity: the current state even when it has not
// changed for hours, and why a tile is dark when it is.
const status = {
  lastPollAt: null, lastError: null,
  entities: new Map(),   // id → { state, value, t, unit, friendly, fetchedAt, missing }
};

async function pollEntity(s) {
  const id = s.id;
  try {
    const d = await fetchJson(`/api/states/sensor.${encodeURIComponent(id)}`, CFG.attemptTimeoutMs);
    const t = Date.parse(d.last_updated || d.last_changed) || Date.now();
    const unit = (d.attributes && d.attributes.unit_of_measurement) || s.unit || null;
    const friendly = (d.attributes && d.attributes.friendly_name) || null;
    const stored = store(id, t, d.state, unit);
    status.entities.set(id, {
      state: String(d.state), value: num(d.state), t, unit, friendly,
      fetchedAt: Date.now(), missing: false,
    });
    return { id, stored, state: String(d.state), t, value: num(d.state), unit, friendly,
      lastChanged: d.last_changed || null, lastUpdated: d.last_updated || null,
      attributes: d.attributes || null };
  } catch (e) {
    const missing = /HTTP 404/.test(e.message || '');
    const prev = status.entities.get(id);
    status.entities.set(id, { ...(prev || { state: null, value: null, t: null, unit: s.unit }),
      fetchedAt: Date.now(), missing, error: e.message });
    return { id, stored: 0, error: e.message };
  }
}

/** Fill the drawn window after a restart or a gap: HA's history endpoint
 *  hands back the recent past; minimal_response keeps it small. */
async function backfill(s) {
  const id = s.id;
  const newest = newestOf.get(id).t || 0;
  const from = Math.max(Date.now() - CFG.backfillMs, floorMs());
  if (newest >= Date.now() - 2 * CFG.pollMs) return null;   // nothing to fill
  const start = new Date(Math.max(from, newest + 1)).toISOString();
  try {
    const d = await fetchJson(
      `/api/history/period/${encodeURIComponent(start)}?filter_entity_id=sensor.${encodeURIComponent(id)}&minimal_response&no_attributes`,
      CFG.attemptTimeoutMs);
    const rows = Array.isArray(d) && Array.isArray(d[0]) ? d[0] : [];
    let stored = 0;
    const kept = [];
    for (const r of rows) {
      const t = Date.parse(r.last_updated || r.last_changed);
      const n = store(id, t, r.state, s.unit || null);
      stored += n;
      kept.push({ entity: id, at: Number.isFinite(t) ? new Date(t).toISOString() : null,
        state: String(r.state), stored: n });
    }
    return { stored, rows: kept, from: start };
  } catch (e) { return { stored: 0, rows: [], error: e.message }; }   // history is a convenience; the states poll is the feed
}

let timer = null;
let polling = false;

async function poll() {
  if (frozen()) {
    if (timer) { clearInterval(timer); timer = null; }
    console.log('[home-assistant] the record is closed — the hardware is not polled after 27 October 2026');
    return;
  }
  if (!configured() || polling) return;
  polling = true;
  try {
    const list = sensors();
    if (!list.length) return;
    let stored = 0;
    const results = [];
    const history = [];
    for (const s of list) {
      const b = await backfill(s);
      if (b) { stored += b.stored; history.push({ entity: s.id, from: b.from || null, stored: b.stored,
        rows: b.rows, ...(b.error ? { error: b.error } : {}) }); }
      results.push(await pollEntity(s));
      stored += results[results.length - 1].stored || 0;
    }
    const errors = results.filter((r) => r.error).map((r) => `${r.id}: ${r.error}`);
    status.lastPollAt = Date.now();
    status.lastError = errors.length === results.length && results.length
      ? { at: Date.now(), errors } : null;
    if (errors.length) console.warn('[home-assistant]', errors.join(' · '));
    // The readings log keeps EVERY pull, whether or not the state moved and
    // whether or not Home Assistant answered: each entity exactly as the
    // states endpoint returned it (state, attributes, both timestamps) and
    // every row the history endpoint handed back. The database above keeps
    // one row per state change for the panel; this is the complete record
    // of what was fetched, kept forever, in the archive's readings ZIP.
    require('./readings-log').record('home-assistant', {
      host: CFG.host, floor: floorMs(), pollMs: CFG.pollMs, stored,
      entities: list.length, answered: results.length - errors.length,
      readings: results.map((r) => ({
        entity: r.id, at: r.t ? new Date(r.t).toISOString() : null,
        state: r.state ?? null, value: r.value ?? null, unit: r.unit ?? null,
        stored: r.stored || 0,
        lastChanged: r.lastChanged || null, lastUpdated: r.lastUpdated || null,
        friendly: r.friendly || null, attributes: r.attributes || null,
        ...(r.error ? { error: r.error } : {}),
      })),
      history,
    });
    if (stored) console.log(`[home-assistant] ${stored} new reading${stored === 1 ? '' : 's'} stored`);
  } finally { polling = false; }
}

function start() {
  if (timer) return;
  if (!configured()) {
    console.log('[home-assistant] not configured (set HA_HOST and HA_API_TOKEN in .env) — the hardware panel stays off the page');
    return;
  }
  if (frozen()) { poll(); return; }   // logs that the record is closed, and that is all
  timer = setInterval(() => poll().catch(() => {}), CFG.pollMs);
  timer.unref();
  poll().catch(() => {});
}

/** Reset to 15 October: the hardware readings are habitat readings and go
 *  with the rest. (The readings log keeps its copies, as everywhere.) */
function clear() {
  const n = db.prepare('DELETE FROM ha_reading').run().changes;
  status.entities.clear();
  return n;
}

/* -------------------------------------------------------------------- read */

/** Midnight at the venue on the day holding `at` — the start of that day. */
function dayStartMs(at = Date.now()) {
  try {
    const mission = require('./mission');
    const m = mission.config();
    return mission.venueMidnightUtc(mission.localDate(new Date(at), m.timezone), m.timezone);
  } catch { const d = new Date(at); d.setUTCHours(0, 0, 0, 0); return d.getTime(); }
}

const windowRows = db.prepare(
  'SELECT t, value FROM ha_reading WHERE entity = ? AND t >= ? AND value IS NOT NULL ORDER BY t');
const lastRow = db.prepare(
  'SELECT t, value, state, unit FROM ha_reading WHERE entity = ? ORDER BY t DESC LIMIT 1');
const firstSince = db.prepare(
  'SELECT value FROM ha_reading WHERE entity = ? AND t >= ? AND value IS NOT NULL ORDER BY t LIMIT 1');

/**
 * Everything the hardware panel needs, server-rendered and re-fetched by the
 * browser: per sensor the current reading, its last day of history, and —
 * for a counter — what today has added.
 */
function snapshot(hours = 24) {
  const list = sensors();
  const liveEnd = Math.min(Date.now(), Number.isFinite(CFG.freezeAt) ? CFG.freezeAt : Infinity);
  // The panel draws the day, midnight to midnight at the venue — the axis
  // holds all 24 hours of the current day (of the freeze day once the
  // record is closed) and the lines fill it in as the day runs. Nothing
  // stamped before the readings floor is stored or served.
  const dayStart = dayStartMs(liveEnd);
  const since = dayStart;
  const end = dayStart + 24 * 3600 * 1000;
  const readFrom = Math.max(since, floorMs());
  const out = list.map((s) => {
    const live = status.entities.get(s.id);
    const stored = lastRow.get(s.id);
    // The current reading: what the last poll saw; before the first poll of
    // this process, the newest stored row stands in.
    const cur = live && !live.missing && live.state != null ? live
      : stored ? { state: stored.state, value: stored.value, t: stored.t, unit: stored.unit } : null;
    const rows = windowRows.all(s.id, readFrom).map((r) => [r.t, r.value]);
    // One point per hour: the hour's readings collapse to one value — the
    // mean for a gauge, the last for a counter (a meter only rises) — set
    // on the hour mark. The day reads as up to 24 points, and the point of
    // the hour now running updates with every poll until the hour is done.
    const buckets = new Map();
    for (const [t, v] of rows) {
      const h = Math.floor((t - dayStart) / 3600000);
      if (h < 0 || h > 23) continue;
      let b = buckets.get(h);
      if (!b) buckets.set(h, b = { sum: 0, n: 0, last: v });
      b.sum += v; b.n += 1; b.last = v;
    }
    const hourly = [...buckets.keys()].sort((a, b) => a - b).map((h) => {
      const b = buckets.get(h);
      return [dayStart + h * 3600000, s.kind === 'counter' ? b.last : b.sum / b.n];
    });
    let today = null;
    if (s.kind === 'counter' && cur && cur.value != null) {
      const base = firstSince.get(s.id, dayStart);
      if (base && base.value != null && cur.value >= base.value) today = cur.value - base.value;
    }
    return {
      id: s.id, label: s.label, kind: s.kind, decimals: s.decimals,
      unit: (cur && cur.unit) || s.unit || '',
      value: cur ? cur.value : null,
      state: cur ? cur.state : null,
      t: cur ? cur.t : null,
      missing: !!(live && live.missing),
      error: live && live.error && !live.missing ? true : false,
      today,
      points: hourly,
    };
  });
  return {
    configured: configured(), frozen: frozen(), pollMs: CFG.pollMs,
    lastPollAt: status.lastPollAt,
    down: !!status.lastError,
    hours, since, now: end, liveNow: liveEnd,
    sensors: out,
  };
}

/**
 * Per-sensor daily series for the Trends panel: venue date → one value per
 * day. A gauge's day is its mean; a counter's day is what the day added
 * (last reading minus first — a meter only rises). `localDate` maps a Date
 * to the venue's calendar date, the same mapper the other trend series use.
 */
function daily(localDate, days = 40) {
  const list = sensors();
  const from = Math.max(Date.now() - days * 86400000, floorMs());
  return list.map((s) => {
    const rows = windowRows.all(s.id, from);
    const byDate = new Map();
    for (const r of rows) {
      const d = localDate(new Date(r.t));
      let b = byDate.get(d);
      if (!b) byDate.set(d, b = { sum: 0, n: 0, first: r.value, last: r.value });
      b.sum += r.value; b.n += 1; b.last = r.value;
    }
    const points = {};
    for (const [d, b] of byDate) {
      const v = s.kind === 'counter' ? Math.max(0, b.last - b.first) : b.sum / b.n;
      points[d] = Math.round(v * 100) / 100;
    }
    return { id: s.id, label: s.label, kind: s.kind,
      unit: s.kind === 'counter' ? `${s.unit || ''}/day` : (s.unit || ''), points };
  });
}

/* One mission day of the hardware, summarised for the archive. */
const dayAgg = db.prepare(
  'SELECT MIN(value) lo, MAX(value) hi, AVG(value) av, COUNT(*) n FROM ha_reading WHERE entity = ? AND t >= ? AND t < ? AND value IS NOT NULL');
const dayFirst = db.prepare(
  'SELECT value FROM ha_reading WHERE entity = ? AND t >= ? AND t < ? AND value IS NOT NULL ORDER BY t LIMIT 1');
const dayLast = db.prepare(
  'SELECT value FROM ha_reading WHERE entity = ? AND t >= ? AND t < ? AND value IS NOT NULL ORDER BY t DESC LIMIT 1');

/**
 * The hardware's day for the permanent record: per configured sensor the
 * low, high, mean and sample count of the readings inside the day's window,
 * and — for a counter — what the day added (last reading minus first; a
 * meter only rises). `window` is the archive's UTC window for the mission
 * day ({ start, end } as ISO strings, archive.windowFor). Sensors with no
 * reading that day are left out.
 */
function daySummary(window) {
  const a = Date.parse(window.start), b = Date.parse(window.end);
  if (!Number.isFinite(a) || !Number.isFinite(b)) return [];
  const out = [];
  for (const s of sensors()) {
    const r = dayAgg.get(s.id, a, b);
    if (!r || !r.n) continue;
    let added = null;
    if (s.kind === 'counter') {
      const first = dayFirst.get(s.id, a, b), last = dayLast.get(s.id, a, b);
      if (first && last && first.value != null && last.value != null) {
        added = Math.round(Math.max(0, last.value - first.value) * 100) / 100;
      }
    }
    out.push({ id: s.id, label: s.label, unit: s.unit || '', kind: s.kind,
      low: r.lo, high: r.hi, mean: r.av, samples: r.n, added });
  }
  return out;
}

/**
 * The hardware's day hour by hour, for the archive's day charts: per sensor
 * up to 24 points keyed 1–24 (position = hour mark 00–23), a gauge's hour as
 * its mean, a counter's as its level at the end of the hour. Same window
 * shape as daySummary.
 */
function hourly(window) {
  const a = Date.parse(window.start), b = Date.parse(window.end);
  if (!Number.isFinite(a) || !Number.isFinite(b)) return [];
  const out = [];
  for (const s of sensors()) {
    const rows = windowRows.all(s.id, a).filter((r) => r.t < b);
    const buckets = new Map();
    for (const r of rows) {
      const h = Math.min(23, Math.max(0, Math.floor((r.t - a) / 3600000)));
      let x = buckets.get(h);
      if (!x) buckets.set(h, x = { sum: 0, n: 0, last: r.value });
      x.sum += r.value; x.n += 1; x.last = r.value;
    }
    const points = {};
    for (const [h, x] of [...buckets].sort((p, q) => p[0] - q[0])) {
      points[h + 1] = Math.round((s.kind === 'counter' ? x.last : x.sum / x.n) * 100) / 100;
    }
    if (Object.keys(points).length) out.push({ id: s.id, label: s.label, unit: s.unit || '', kind: s.kind, points });
  }
  return out;
}

/** A cheap change mark: the browser swaps the panel only when this moves. */
function version(snap) {
  return (snap.sensors || []).map((s) => `${s.id}:${s.t || 0}:${s.state || ''}`).join('|')
    + `|${snap.since || 0}`   // the day turning over redraws the axis
    + (snap.down ? '|down' : '') + (snap.frozen ? '|frozen' : '');
}

module.exports = { start, poll, snapshot, daily, daySummary, hourly, version, clear, sensors, configured, frozen, CFG };
