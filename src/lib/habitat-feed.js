'use strict';
/**
 * The habitat sensor, read through Home Assistant.
 *
 * An M5 ENV Pro (a Bosch BME688 running BSEC) sits inside the habitat and
 * reports, through Home Assistant, the CO₂ equivalent, the temperature, the
 * humidity, the air pressure, the breath-VOC equivalent, the air quality
 * index (0–500) and that index as a readable classification; a light sensor
 * beside it reports the illuminance in lux. This module
 * reads those entities and writes them into the station's one table of
 * habitat readings (external_reading, src/lib/critical.js) as full rows —
 * every channel at its minute — so the tiles, the ticker, the booklet, the
 * archive and the PDF record draw them exactly as they drew the node's.
 *
 * WHICH entity feeds which channel lives in content/home-assistant.json
 * under `habitat` (hot-read: change the file and the next poll follows);
 * WHERE Home Assistant is and the token live in .env (HA_HOST, HA_PORT,
 * HA_API_TOKEN), never in the repository, never sent to a browser.
 *
 * Each poll asks Home Assistant two things: the current state of every
 * mapped entity (so an entity gone `unavailable` is known at once), and the
 * history of all of them since the newest reading the station holds, so no
 * change between two polls is missed however often the sensor reports.
 * The changes are gathered to the minute — one row per minute at most,
 * each a snapshot of every channel, a channel that did not change carrying
 * its last known value forward, an unavailable one carrying nothing — and
 * a row for the poll itself closes the batch, so the tiles always know the
 * sensor is current. Every poll is written to the readings log exactly as
 * it came back (readings/habitat/), whatever became of it.
 */
const ha = require('./home-assistant');
const critical = require('./critical');

const CHANNELS = ha.HABITAT_CHANNELS;               // co2 temp hum pres light voc iaq iaqc
const NUMERIC = CHANNELS.filter((k) => k !== 'iaqc');
const DEAD = new Set(['unavailable', 'unknown', 'none', '']);
const num = (v) => { const n = parseFloat(v); return Number.isFinite(n) ? n : null; };
const minute = (t) => Math.floor(t / 60000) * 60000;

// What the last poll saw, per channel — for the tiles' notes and /api/habitat/data.
const status = {
  lastReadAt: null, lastError: null, stored: 0,
  entities: {},   // channel → { id, state, value, unit, t, missing, error }
};

/** Home Assistant is set up and at least one habitat channel is mapped. */
function configured() {
  return ha.configured() && Object.keys(ha.habitatMap()).length > 0;
}

/** The value a channel takes from a Home Assistant state string. */
function valueOf(channel, state) {
  const s = String(state ?? '').trim();
  if (DEAD.has(s.toLowerCase())) return null;
  return channel === 'iaqc' ? s : num(s);
}

let polling = false;

async function poll() {
  if (critical.frozen()) {
    console.log('[habitat] the record is closed — the habitat sensor is not read after 27 October 2026');
    return;
  }
  if (!configured() || polling) return;
  polling = true;
  const map = ha.habitatMap();
  const channels = CHANNELS.filter((k) => map[k]);
  const readAt = Date.now();
  const errors = [];
  const fetched = [];        // what the states endpoint returned, per channel, for the log
  const changes = new Map(); // minute → { channel: value }
  const note = (t, k, v) => {
    const m = minute(t);
    let row = changes.get(m);
    if (!row) changes.set(m, row = {});
    row[k] = v;
  };
  try {
    // 1. The current state of every mapped entity.
    const live = {};
    for (const k of channels) {
      const id = map[k];
      try {
        const d = await ha.fetchJson(`/api/states/sensor.${encodeURIComponent(id)}`, ha.CFG.attemptTimeoutMs);
        const t = Date.parse(d.last_updated || d.last_changed) || readAt;
        const value = valueOf(k, d.state);
        const unit = (d.attributes && d.attributes.unit_of_measurement) || null;
        live[k] = { id, state: String(d.state), value, unit, t, missing: false, error: null };
        fetched.push({ channel: k, entity: id, at: new Date(t).toISOString(), state: String(d.state), value: typeof value === 'number' ? value : null,
          unit, lastChanged: d.last_changed || null, lastUpdated: d.last_updated || null, attributes: d.attributes || null });
        if (value !== null) note(t, k, value);
      } catch (e) {
        const missing = /HTTP 404/.test(e.message || '');
        live[k] = { id, state: null, value: null, unit: null, t: null, missing, error: e.message };
        fetched.push({ channel: k, entity: id, error: e.message });
        errors.push(`${k} (sensor.${id}): ${e.message}`);
      }
    }
    // 2. Every change since the newest reading the station holds — one call
    //    for all the entities — so the minutes between two polls are filled.
    const last = critical.lastStored();
    const from = Math.max(last ? last.t + 1 : 0, critical.floorMs(), readAt - 24 * 3600 * 1000);
    let history = null;
    if (Object.values(live).some((l) => !l.missing && !l.error)) {
      try {
        const ids = channels.map((k) => `sensor.${map[k]}`).join(',');
        const d = await ha.fetchJson(
          `/api/history/period/${encodeURIComponent(new Date(from).toISOString())}?filter_entity_id=${encodeURIComponent(ids)}&minimal_response&no_attributes`,
          ha.CFG.attemptTimeoutMs);
        let rows = 0;
        for (const list of Array.isArray(d) ? d : []) {
          if (!Array.isArray(list) || !list.length) continue;
          // minimal_response: only the first item of each list names its entity
          const id = String(list[0].entity_id || '').replace(/^sensor\./, '');
          const k = channels.find((c) => map[c] === id);
          if (!k) continue;
          for (const r of list) {
            const t = Date.parse(r.last_updated || r.last_changed);
            if (!Number.isFinite(t) || t < from) continue;
            const v = valueOf(k, r.state);
            if (v !== null) { note(t, k, v); rows++; }
          }
        }
        history = { from: new Date(from).toISOString(), rows };
      } catch (e) {
        history = { from: new Date(from).toISOString(), error: e.message };   // the states are the feed; history is the filling-in
      }
    }
    // 3. The poll's own row, at this minute, so a steady sensor still leaves
    //    a reading — the current value of every channel that is alive.
    for (const k of channels) if (live[k] && live[k].value !== null) note(readAt, k, live[k].value);

    // 4. Full rows: each minute's changes laid over the values carried
    //    forward from the row before — from the last stored row to begin
    //    with — a channel Home Assistant reports unavailable carrying nothing.
    const carried = {};
    for (const k of CHANNELS) carried[k] = last && last[k] != null ? last[k] : null;
    const rows = [];
    for (const m of [...changes.keys()].sort((a, b) => a - b)) {
      const ch = changes.get(m);
      for (const k of CHANNELS) if (ch[k] !== undefined) carried[k] = ch[k];
      const row = { t: m };
      for (const k of critical.KEYS) row[k] = null;
      for (const k of NUMERIC) row[k] = live[k] && (live[k].missing || live[k].value === null) ? null : carried[k];
      row.iaqc = live.iaqc && (live.iaqc.missing || live.iaqc.value === null) ? null : carried.iaqc;
      rows.push(row);
    }
    const { stored, dropped, before, fresh } = rows.length ? critical.persistHabitat(rows) : { stored: 0, dropped: 0, before: 0, fresh: [] };

    status.lastReadAt = readAt;
    status.stored = stored;
    status.lastError = errors.length === channels.length ? { at: readAt, errors } : null;
    for (const k of channels) status.entities[k] = live[k];
    if (errors.length) console.warn('[habitat]', errors.join(' · '));
    if (stored) console.log(`[habitat] ${stored} new reading${stored === 1 ? '' : 's'} stored from the habitat sensor`);

    require('./readings-log').record('habitat', {
      host: ha.CFG.host, floor: critical.floorMs(), pollMs: critical.CFG.habitatPollMs,
      channels: Object.fromEntries(channels.map((k) => [k, map[k]])),
      fetched, history, stored, dropped, before,
      readings: fresh.map((r) => ({ at: new Date(r.t).toISOString(), t: r.t,
        ...Object.fromEntries(CHANNELS.map((k) => [k, r[k] == null ? null : r[k]])) })),
    });
  } catch (e) {
    status.lastError = { at: readAt, errors: [e.message || String(e)] };
    console.warn('[habitat]', e.message || e);
    require('./readings-log').record('habitat', { host: ha.CFG.host, error: [e.message || String(e)], stored: 0 });
  } finally { polling = false; }
}

/** What the tiles' notes need: when the sensor was last read, what went
 *  wrong, and each channel's entity as it stands. */
function snapshot() {
  return {
    lastReadAt: status.lastReadAt,
    lastError: status.lastError,
    entities: Object.fromEntries(Object.entries(status.entities).map(([k, e]) => [k, {
      id: e.id, state: e.state, unit: e.unit, t: e.t, missing: !!e.missing, error: e.error ? true : false,
    }])),
  };
}

module.exports = { poll, configured, status: snapshot, CHANNELS };
