'use strict';
const { db, now } = require('../db');
const mission = require('./mission');
const data = require('./data');
const mediaLib = require('./media');
const MV = require('../views/pages/media');

/**
 * The archive is the work, so nothing on this site is allowed to be transient.
 * Every mission day is rolled up into a permanent record: the schedule as it
 * was actually run, the meals, the stores as they were counted, the crew's
 * own entries, the mood states filed that day, a summary of every habitat
 * channel and every reading behind it. Once a day is over it is sealed and
 * stops being recomputed. The messages from Earth and the crew's replies are
 * not part of the record.
 *
 * The record holds only what was entered or measured. Nothing in it is
 * generated, projected or carried forward: a store that was not counted on a
 * day has no figure for that day, a day that has not happened has no record,
 * and readings written by the seed or a simulator (device ids below) are
 * never rolled into it.
 */

/** Readings that are not the habitat's: the seed's opening history and the
    simulator's. Never part of the record. */
const FAKE_DEVICES = ['seed-01', 'sim-01'];
const NOT_FAKE = `device_id NOT IN (${FAKE_DEVICES.map(() => '?').join(', ')})`;

// The sensor node's channels, named as the dashboard's Habitat panel names
// them (Carbon dioxide, Temperature, Humidity, Light) and, for the three the
// panel does not show as tiles, as At a Glance does (Pressure, Node battery,
// Signal).
const EXTERNAL_KEYS = [['co2', 'Carbon dioxide', 'ppm'], ['temp', 'Temperature', '°C'],
  ['hum', 'Humidity', '%'], ['pres', 'Pressure', 'hPa'],
  ['light', 'Light', 'raw'], ['bat', 'Node battery', 'V'], ['rssi', 'Signal', 'dBm']];

/** The last day that has a record: today, or the last day of the run once
    it is over; 0 before the run has begun. */
function recordedUpTo(st = mission.state()) {
  if (st.phase === 'PRE_LAUNCH') return 0;
  return Math.min(st.missionDay, st.totalDays);
}

/** UTC window covering one venue-local mission day. */
function windowFor(missionDay) {
  const m = mission.config();
  const date = mission.dateForDay(missionDay);
  const start = mission.venueMidnightUtc(date, m.timezone);
  const nextDate = mission.dateForDay(missionDay + 1);
  const end = mission.venueMidnightUtc(nextDate, m.timezone);
  return { start: new Date(start).toISOString(), end: new Date(end).toISOString() };
}

/** Compute and store habitat summaries for one day. */
function rollup(missionDay) {
  const { start, end } = windowFor(missionDay);
  const rows = db.prepare(
    `SELECT metric, MIN(value) lo, MAX(value) hi, AVG(value) av, COUNT(*) n
     FROM sensor_reading WHERE recorded_at >= ? AND recorded_at < ? AND ${NOT_FAKE}
     GROUP BY metric`
  ).all(start, end, ...FAKE_DEVICES);

  const over = Date.parse(end) < Date.now();
  const stmt = db.prepare(
    `INSERT INTO sensor_daily (mission_day, metric, min_value, max_value, avg_value, samples, sealed_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(mission_day, metric) DO UPDATE SET
       min_value = excluded.min_value, max_value = excluded.max_value,
       avg_value = excluded.avg_value, samples = excluded.samples,
       sealed_at = excluded.sealed_at`
  );
  const tx = db.transaction(() => {
    // A channel with no real reading that day has no row — including one an
    // earlier rollup made from readings that are not the habitat's.
    const keep = rows.map((r) => r.metric);
    db.prepare(`DELETE FROM sensor_daily WHERE mission_day = ? AND metric NOT IN (${keep.map(() => '?').join(', ') || "''"})`)
      .run(missionDay, ...keep);
    for (const r of rows) {
      stmt.run(missionDay, r.metric, r.lo, r.hi, r.av, r.n, over ? now() : null);
    }
    // A day that is over is sealed — with or without readings: the seal is
    // the close of the day's record, and the day's Habitat tab goes to the
    // readings log with it (below).
    if (over) {
      db.prepare('INSERT OR IGNORE INTO day_seal (mission_day, sealed_at) VALUES (?, ?)')
        .run(missionDay, now());
    }
  });
  tx();
  // The day's summary in the readings log carries the hardware beside the
  // channels, so the log's daily record holds the whole habitat — and, once
  // the day is over, the Habitat tab as it stood at the end of the day: the
  // schedule, the meals, the steps and calories, the inventory levels and the
  // power, saved automatically (the rollup runs every fifteen minutes).
  const hardware = require('./home-assistant').daySummary({ start, end });
  if (rows.length || hardware.length || over) {
    require('./readings-log').record('daily', { missionDay, window: { start, end }, sealed: over,
      channels: rows.map((r) => ({ metric: r.metric, low: r.lo, high: r.hi, mean: r.av, samples: r.n })),
      hardware: hardware.map((h) => ({ device: h.label, entity: `sensor.${h.id}`, unit: h.unit,
        low: h.low, high: h.high, mean: h.mean, addedToday: h.added, samples: h.samples })),
      ...(over ? { habitatTab: habitatTab(missionDay) } : {}) }, { dedupe: true });
  }
  return rows.length;
}

/** Roll up anything that has not been sealed yet. Cheap; safe to call often.
    Once, after the rule that leaves the seed's and the simulator's readings
    out came in, every day is rolled again so a summary sealed over such
    readings is redone from the real ones (a rollup is a pure function of
    the readings, which are never deleted, so a real seal comes out the same). */
const REROLL_KEY = 'archive.rollup.real-only';
db.exec('CREATE TABLE IF NOT EXISTS setting (key TEXT PRIMARY KEY, value TEXT NOT NULL)');
function rollupPending() {
  const st = mission.state();
  const upTo = Math.min(st.missionDay, st.totalDays);
  const reroll = !db.prepare('SELECT 1 FROM setting WHERE key = ?').get(REROLL_KEY);
  let done = 0;
  for (let n = 1; n <= upTo; n++) {
    const sealed = db.prepare('SELECT 1 FROM day_seal WHERE mission_day = ?').get(n);
    if (sealed && n < st.missionDay && !reroll) continue;   // already final
    rollup(n);
    done++;
  }
  if (reroll) db.prepare('INSERT INTO setting (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value').run(REROLL_KEY, now());
  return done;
}

/** Everything that happened on one mission day, in one object. */
function dayRecord(missionDay) {
  const { start, end } = windowFor(missionDay);
  const day = data.day(missionDay);

  let habitat = db.prepare(
    `SELECT sd.*, sm.label, sm.unit, sm.channel FROM sensor_daily sd
     LEFT JOIN sensor_metric sm ON sm.metric = sd.metric
     WHERE sd.mission_day = ? ORDER BY sm.sort_order, sd.metric`
  ).all(missionDay);
  if (!habitat.length) { rollup(missionDay); habitat = db.prepare(
    `SELECT sd.*, sm.label, sm.unit, sm.channel FROM sensor_daily sd
     LEFT JOIN sensor_metric sm ON sm.metric = sd.metric
     WHERE sd.mission_day = ? ORDER BY sm.sort_order, sd.metric`
  ).all(missionDay); }

  const entries = data.entriesForDay(missionDay);

  // States filed by a person. The mid-scale state the content loader gives a
  // new officer (set_by 'content'), so the public crew page has something to
  // show, was filed by nobody and is not part of the record.
  const moods = db.prepare(
    `SELECT cm.*, c.designation FROM crew_mood cm JOIN crew c ON c.id = cm.crew_id
     WHERE cm.effective_at >= ? AND cm.effective_at < ? AND cm.set_by != 'content' ORDER BY cm.effective_at`
  ).all(start, end);

  // The day's exchanges and traffic are not part of the record — no archive
  // page, export or PDF prints them — but the public At a Glance booklet
  // (src/views/pages/glance.js) is built from the same day object and shows
  // them there, so they stay on it.
  const messages = db.prepare(
    `SELECT m.*, r.body AS response_body, c.designation AS responder
     FROM message m LEFT JOIN response r ON r.message_id = m.id
     LEFT JOIN crew c ON c.id = r.crew_id
     WHERE m.state = 'PUBLISHED' AND m.mission_day = ? ORDER BY m.submitted_at`
  ).all(missionDay);
  const traffic = db.prepare(
    `SELECT COUNT(*) sent, COUNT(DISTINCT callsign) callsigns
     FROM message WHERE submitted_at >= ? AND submitted_at < ?`
  ).get(start, end);

  const sealed = db.prepare('SELECT * FROM day_seal WHERE mission_day = ?').get(missionDay);
  const media = mediaLib.list({ day: missionDay });

  // The habitat's own hardware, through Home Assistant: the day's low, high,
  // mean and samples per device, and what the day added for a meter. Read
  // straight from ha_reading, which is never pruned.
  const hardware = require('./home-assistant').daySummary({ start, end });

  // The external sensor node (critical.js), the same way: the day's low, high
  // and mean per channel from the readings the station polled, demo rows
  // (tools/demo-readings.js) left out.
  const external = externalSummary(Date.parse(start), Date.parse(end));

  const content = require('./content');
  // The stores as they were counted that day — the figures written into
  // inventory-levels.json (by the Habitat tab or by hand), and nothing else:
  // a store not counted that day has no figure here.
  const filed = content.inventoryFiled(missionDay);
  // Steps and calories as the health officer filed them, per officer, with
  // the totals as they stand in crew-figures.json.
  const figures = (content.crewFigures() || {})[String(missionDay)] || null;
  // Power consumed that day, by category — from content/power.json, counted
  // daily by the crew like the calories and steps.
  const power = content.powerDay(missionDay);

  // Every reading of the day, as it was stored.
  const readings = dayReadings(start, end);

  return dress({
    missionDay, date: mission.dateForDay(missionDay), day,
    habitat, external, hardware, entries, moods, messages, traffic, media, power, figures, filed, readings, sealed: !!sealed,
    isEmpty: !day && !entries.length && !habitat.length && !hardware.length && !media.length && !readings.count,
  });
}

/**
 * The record's shape, by officer and by tab. Added to every day object:
 *
 *   officers  one block per crew member, in the crew's order: the
 *             communication officer's Commander Blog for the day (the
 *             published entry, placeholders left out), the other officers'
 *             blog — the science officer's Daily Science Findings, the
 *             health officer's Daily Health Blog, as the
 *             notes of that kind — and every crew state filed for them that
 *             day. A report kind with no officer to hang on goes to
 *             `reportsUnassigned`; notes of other kinds (LOG, ANOMALY …) to
 *             `notesOther`.
 *   stores    the Habitat tab's inventory table for the day, row for row:
 *             what was available at the start (the previous day's close, on
 *             day 1 what was carried in), what was used, what was left —
 *             the figures as the tab shows them, each marked counted (filed
 *             that day) or carried (from the day before at its draw).
 */
const REPORT_OF = [['SCIENCE', /SCIENCE/i, 'Daily Science Findings'], ['HEALTH', /HEALTH/i, 'Daily Health Blog']];
function dress(r) {
  const crew = db.prepare('SELECT id, designation, role FROM crew ORDER BY sort_order, id').all();
  const content = require('./content');
  const notes = (r.day ? r.day.notes : []).filter((x) => x.published_at);
  // a file placed in a report by its marker belongs to the report, not to the blog
  const inNotes = new Set(notes.flatMap((x) => [...String(x.body).matchAll(/\[media:(\d+)\]/g)].map((m) => Number(m[1]))));
  const used = new Set();
  const officers = crew.map((c) => {
    const entry = r.entries.find((e) => e.crew_id === c.id && !content.isPlaceholder(e.body)) || null;
    const kind = REPORT_OF.find(([, re]) => re.test(c.designation));
    let reports = [];
    if (kind) { reports = notes.filter((x) => x.kind === kind[0]); reports.forEach((x) => used.add(x.id)); }
    // Only the communication officer has a blog of their own — the Commander Blog.
    const hasBlog = c.designation === content.BLOG_OFFICER;
    return { id: c.id, designation: c.designation, role: c.role, entry: hasBlog ? entry : null, hasBlog,
      reportKind: kind ? kind[0] : null, reportLabel: kind ? kind[2] : null, reports,
      states: r.moods.filter((m) => m.crew_id === c.id),
      media: r.media.filter((m) => m.crew_id === c.id && !inNotes.has(m.id)) };
  });
  const reportsUnassigned = notes.filter((x) => !used.has(x.id) && REPORT_OF.some(([k]) => k === x.kind));
  const notesOther = notes.filter((x) => !REPORT_OF.some(([k]) => k === x.kind));
  return { ...r, officers, reportsUnassigned, notesOther, stores: storesTable(r.missionDay, r.day, r.filed) };
}

/** The Habitat tab's inventory table for one day (see dress). */
function storesTable(missionDay, day, filed) {
  const content = require('./content');
  const filedBy = new Map((filed ? filed.items : []).map((i) => [i.key, i]));
  const startOf = content.inventoryStart();
  return (day ? day.inventory : []).map((i) => {
    const before = missionDay > 1
      ? (db.prepare(`SELECT il.quantity q FROM inventory_level il JOIN inventory_item it ON it.id = il.item_id WHERE it.key = ? AND il.mission_day = ?`).get(i.key, missionDay - 1) || {}).q ?? null
      : (startOf[i.key] ?? null);
    const f = filedBy.get(i.key) || {};
    return { key: i.key, label: i.label, unit: i.unit, available: before, used: i.consumption, left: i.quantity,
      counted: { used: f.consumption != null, left: f.quantity != null } };
  });
}

/**
 * The Habitat tab of mission control for one day, as it stands: the
 * schedule, the meals, the steps and calories, the inventory levels and the
 * power. The record prints it as it is at the time of the record; at the end
 * of each day it is written to the readings log with the day's seal, so the
 * day's tab as it was when the day ended is kept too.
 */
function habitatTab(missionDay) {
  const content = require('./content');
  const day = data.day(missionDay);
  const filed = content.inventoryFiled(missionDay);
  return {
    schedule: day ? day.tasks.map((t) => ({ time: t.time, label: t.label, detail: t.detail, status: t.status })) : [],
    meals: day ? day.meals.map((m) => ({ slot: m.slot, name: m.name, components: m.components, kcal: m.kcal,
      waterLitres: m.water_litres, prepMinutes: m.prep_minutes, energyWh: m.energy_wh, notes: m.notes || '',
      recipe: m.recipe || '', nutrients: m.nutrients || null, co2eKg: m.co2e_kg ?? null, waterFootprintL: m.water_footprint_l ?? null })) : [],
    figures: (content.crewFigures() || {})[String(missionDay)] || null,
    stores: storesTable(missionDay, day, filed),
    storesNote: filed.why || '',
    power: content.powerDay(missionDay).categories.map((c) => ({ key: c.key, label: c.label, kwh: c.kwh })),
  };
}

/**
 * Today, before the run — a rehearsal record, so the shape of a day's record
 * can be seen weeks early with real data in it. Not part of the record and
 * marked as such wherever it is shown; gone on the first day of the run,
 * when day 001 takes its place. It is built exactly as a day's record is,
 * for today's calendar day: today's readings from all three sources and the
 * habitat summary computed straight from them (nothing is sealed or written
 * to sensor_daily), the states filed today, and — because entries, notes,
 * counts, figures and media hang on a mission day — whatever has been put
 * into the opening day (SOL 001) so far, with its plan. Null once the run
 * has begun.
 */
function rehearsalRecord(st = mission.state()) {
  if (st.phase !== 'PRE_LAUNCH') return null;
  const startMs = mission.venueMidnightUtc(st.today, st.timezone);
  const start = new Date(startMs).toISOString(), end = new Date(startMs + 86400000).toISOString();
  const content = require('./content');
  const habitat = db.prepare(
    `SELECT sr.metric, MIN(sr.value) min_value, MAX(sr.value) max_value, AVG(sr.value) avg_value, COUNT(*) samples,
            sm.label, sm.unit, sm.channel, NULL AS sealed_at
     FROM sensor_reading sr LEFT JOIN sensor_metric sm ON sm.metric = sr.metric
     WHERE sr.recorded_at >= ? AND sr.recorded_at < ? AND sr.${NOT_FAKE}
     GROUP BY sr.metric ORDER BY sm.sort_order, sr.metric`
  ).all(start, end, ...FAKE_DEVICES);
  const moods = db.prepare(
    `SELECT cm.*, c.designation FROM crew_mood cm JOIN crew c ON c.id = cm.crew_id
     WHERE cm.effective_at >= ? AND cm.effective_at < ? AND cm.set_by != 'content' ORDER BY cm.effective_at`
  ).all(start, end);
  const day = data.day(1);
  const entries = data.entriesForDay(1);
  const media = mediaLib.list({ day: 1 });
  const hardware = require('./home-assistant').daySummary({ start, end });
  const external = externalSummary(startMs, startMs + 86400000);
  const readings = dayReadings(start, end);
  return dress({
    rehearsal: true, missionDay: 1, date: st.today, day,
    habitat, external, hardware, entries, moods, messages: [], traffic: { sent: 0, callsigns: 0 }, media,
    power: content.powerDay(1), figures: (content.crewFigures() || {})['1'] || null, filed: content.inventoryFiled(1),
    readings, sealed: false,
    isEmpty: !day && !entries.length && !habitat.length && !hardware.length && !media.length && !readings.count,
  });
}

/**
 * Every reading of one day, as stored — nothing summarised. Three sources:
 *
 *   station   the habitat node's channels posted to the ingest endpoint
 *             (sensor_reading), one row per instant with a column per
 *             channel — the node posts its channels as one batch, so a batch
 *             is one row (instants are matched to the second);
 *   external  the external sensor node the station polls (external_reading),
 *             one row per reading with its channels;
 *   hardware  the habitat's own devices through Home Assistant (ha_reading),
 *             per device, one row per state HA reported.
 *
 * Times are the venue's, to the second. The seed's and the simulator's
 * readings and the demo rows are left out, as everywhere in the record.
 */
function dayReadings(start, end) {
  const tz = mission.config().timezone;
  const hms = (ms) => mission.localTime(new Date(ms), tz);
  const a = Date.parse(start), b = Date.parse(end);

  // the station's channels: rows by instant (to the second), columns by channel
  const meta = new Map(db.prepare('SELECT metric, label, unit, channel, sort_order FROM sensor_metric').all().map((m) => [m.metric, m]));
  const ingest = db.prepare(
    `SELECT metric, value, unit, recorded_at, device_id FROM sensor_reading
     WHERE recorded_at >= ? AND recorded_at < ? AND ${NOT_FAKE} ORDER BY recorded_at, id`
  ).all(start, end, ...FAKE_DEVICES);
  const byInstant = new Map(), used = new Map();
  for (const r of ingest) {
    const key = r.recorded_at.slice(0, 19);
    let row = byInstant.get(key);
    if (!row) byInstant.set(key, row = { iso: r.recorded_at, at: hms(Date.parse(r.recorded_at)), values: {}, devices: new Set() });
    row.values[r.metric] = r.value;
    row.devices.add(r.device_id);
    if (!used.has(r.metric)) { const m = meta.get(r.metric) || {}; used.set(r.metric, { metric: r.metric, label: m.label || r.metric.replace(/_/g, ' ').toUpperCase(), unit: m.unit || r.unit || '', channel: m.channel || '', sort: m.sort_order ?? 99 }); }
  }
  const station = {
    columns: [...used.values()].sort((p, q) => p.sort - q.sort || p.metric.localeCompare(q.metric)),
    rows: [...byInstant.values()].map((r) => ({ ...r, devices: [...r.devices] })),
    readings: ingest.length,
  };

  // the external node: one row per reading
  let external = { columns: EXTERNAL_KEYS.map(([key, label, unit]) => ({ key, label, unit })), rows: [], readings: 0 };
  try {
    const rows = db.prepare(
      `SELECT t, ${EXTERNAL_KEYS.map(([k]) => k).join(', ')} FROM external_reading
       WHERE t >= ? AND t < ? AND (sig IS NULL OR sig NOT LIKE 'demo:%') ORDER BY t, id`
    ).all(a, b);
    const present = new Set();
    for (const r of rows) for (const [k] of EXTERNAL_KEYS) if (r[k] != null) present.add(k);
    external = {
      columns: external.columns.filter((c) => present.has(c.key)),
      rows: rows.map((r) => ({ iso: new Date(r.t).toISOString(), at: hms(r.t), values: r })),
      readings: rows.length,
    };
  } catch { /* the node's table is created by critical.js on first use */ }

  // the hardware: per device, every state HA reported
  const hardware = [];
  try {
    // every device with readings that day — configured now or taken out of
    // content/home-assistant.json since: what was pulled stays in the record
    const sensors = require('./home-assistant').sensorsFor(a, b);
    const q = db.prepare('SELECT t, value, state, unit FROM ha_reading WHERE entity = ? AND t >= ? AND t < ? ORDER BY t, id');
    for (const s of sensors) {
      const rows = q.all(s.id, a, b);
      if (!rows.length) continue;
      hardware.push({ id: s.id, label: s.label, unit: s.unit || (rows[0].unit || ''), kind: s.kind,
        rows: rows.map((r) => ({ iso: new Date(r.t).toISOString(), at: hms(r.t), value: r.value, state: r.state })) });
    }
  } catch { /* no hardware configured */ }

  const count = station.readings + external.readings + hardware.reduce((n, h) => n + h.rows.length, 0);
  return { station, external, hardware, count };
}

/** The external node's day: low, high, mean and count per channel, from
    external_reading between two instants (ms). Nothing when the node's
    table does not exist yet or holds nothing for the day. */

function externalSummary(fromMs, toMs) {
  try {
    const row = db.prepare(
      `SELECT ${EXTERNAL_KEYS.map(([k]) => `MIN(${k}) ${k}_lo, MAX(${k}) ${k}_hi, AVG(${k}) ${k}_av, COUNT(${k}) ${k}_n`).join(', ')}
       FROM external_reading WHERE t >= ? AND t < ? AND (sig IS NULL OR sig NOT LIKE 'demo:%')`
    ).get(fromMs, toMs);
    if (!row) return [];
    return EXTERNAL_KEYS.filter(([k]) => row[`${k}_n`] > 0).map(([k, label, unit]) => ({
      id: 'ext-' + k, label, unit, low: row[`${k}_lo`], high: row[`${k}_hi`],
      mean: Math.round(row[`${k}_av`] * 100) / 100, samples: row[`${k}_n`],
    }));
  } catch { return []; }   // the node's table is created by critical.js on first use
}

/** Index of every day, for the archive contents page. */
function index() {
  const st = mission.state();
  const out = [];
  for (let n = 1; n <= st.totalDays; n++) {
    const c = db.prepare(
      `SELECT
        (SELECT COUNT(*) FROM crew_entry WHERE mission_day = ? AND published = 1) entries,
        (SELECT COUNT(*) FROM task WHERE mission_day = ?) tasks,
        (SELECT COUNT(*) FROM meal WHERE mission_day = ?) meals,
        (SELECT COUNT(*) FROM sensor_daily WHERE mission_day = ?) channels,
        (SELECT COUNT(*) FROM media WHERE mission_day = ? AND hidden = 0) media`
    ).get(n, n, n, n, n);
    out.push({
      missionDay: n, date: mission.dateForDay(n), ...c,
      isPast: n < st.missionDay, isToday: n === st.missionDay,
      sealed: !!db.prepare('SELECT 1 FROM day_seal WHERE mission_day = ?').get(n),
    });
  }
  return out;
}

/** The complete mission as one object, for download. Days that have not
    happened carry nothing but their date. */
function fullExport() {
  const st = mission.state();
  const upTo = recordedUpTo(st);
  return {
    mission: {
      name: st.name, start: st.start_date, end: st.end_date, timezone: st.timezone,
      totalDays: st.totalDays, recordedDays: upTo,
    },
    exportedAt: now(),
    note: 'Only what was entered on the station or measured by its sensors, every reading included. No figure is projected, carried forward or generated: a store not counted on a day has no figure for that day. The messages from Earth and the crew\'s replies are not part of this record.',
    crew: db.prepare('SELECT id, designation, role FROM crew ORDER BY sort_order').all(),
    days: Array.from({ length: st.totalDays }, (_, i) => {
      if (i + 1 > upTo) return { missionDay: i + 1, date: mission.dateForDay(i + 1), recorded: false };
      const r = dayRecord(i + 1);
      return {
        missionDay: r.missionDay, date: r.date, recorded: true, sealed: r.sealed,
        schedule: r.day ? r.day.tasks.map((t) => ({
          time: t.time, label: t.label, detail: t.detail, status: t.status })) : [],
        meals: r.day ? r.day.meals.map((m) => ({
          slot: m.slot, name: m.name, components: m.components, kcal: m.kcal,
          waterLitres: m.water_litres, prepMinutes: m.prep_minutes, energyWh: m.energy_wh,
          recipe: m.recipe || '', nutrients: m.nutrients || null, co2eKg: m.co2e_kg ?? null, waterFootprintL: m.water_footprint_l ?? null })) : [],
        // the Habitat tab's inventory table: available at the start, used
        // today, left for the future, each figure marked counted (filed that
        // day) or carried (from the day before at its draw)
        stores: r.stores.map((v) => ({ item: v.label, key: v.key, unit: v.unit, available: v.available, usedToday: v.used,
          leftForFuture: v.left, usedCounted: v.counted.used, leftCounted: v.counted.left })),
        // the stores counted that day, as filed — quantity left at the close
        // and/or the day's use, whichever was written; null where it was not
        storesCounted: r.filed.items.map((v) => ({
          item: v.label, key: v.key, unit: v.unit, quantity: v.quantity, consumption: v.consumption })),
        storesNote: r.filed.why || null,
        // by officer: the Commander Blog (communication officer), the Daily Science
        // Findings / Daily Health Blog (science, health officer) and the states filed
        officers: r.officers.map((o) => ({ crew: o.designation, role: o.role,
          ...(o.hasBlog ? { commanderBlog: o.entry ? { body: o.entry.body, writtenAt: o.entry.written_at, updatedAt: o.entry.updated_at } : null } : {}),
          report: o.reportKind ? { kind: o.reportKind, label: o.reportLabel, bodies: o.reports.map((x) => x.body) } : null,
          states: o.states.map((m) => ({ effectiveAt: m.effective_at, value: m.calm_tense, condition: require('./mood').condition(m), activity: m.activity, filedBy: m.set_by })) })),
        power: r.power.filed ? {
          categories: r.power.categories.map((c) => ({ key: c.key, label: c.label, kwh: c.kwh })) } : null,
        crewFigures: r.figures ? {
          perOfficer: Object.entries(r.figures.crew || {}).map(([designation, f]) => ({
            crew: designation, calories: f.calories ?? null, steps: f.steps ?? null })),
          calories: r.figures.calories ?? null, steps: r.figures.steps ?? null } : null,
        notes: r.day ? r.day.notes.filter((x) => x.published_at)
          .map((x) => ({ kind: x.kind, body: x.body, postedAt: x.posted_at })) : [],
        crewEntries: r.entries.map((e) => ({
          crew: e.designation, body: e.body, writtenAt: e.written_at })),
        crewStates: r.moods.map((m) => ({
          crew: m.designation, effectiveAt: m.effective_at, activity: m.activity,
          calmTense: m.calm_tense, energeticExhausted: m.energetic_exhausted,
          optimisticUncertain: m.optimistic_uncertain, connectedIsolated: m.connected_isolated })),
        habitat: r.habitat.map((h) => ({
          metric: h.metric, unit: h.unit, min: h.min_value, max: h.max_value,
          avg: h.avg_value, samples: h.samples })),
        externalNode: r.external.map((h) => ({
          channel: h.id.slice(4), unit: h.unit, min: h.low, max: h.high, avg: h.mean, samples: h.samples })),
        hardware: r.hardware.map((h) => ({
          device: h.label, entity: `sensor.${h.id}`, kind: h.kind, unit: h.unit,
          min: h.low, max: h.high, avg: h.mean, addedToday: h.added, samples: h.samples })),
        // What the crew sent out that day: the files are in the media ZIP
        // and on the volume under media/<sha>; this is the list with hashes.
        media: r.media.map(mediaLib.describe),
        // Every reading of the day, as stored: the station's channels (one
        // entry per instant, a value per channel), the external node (one
        // per reading) and the hardware (per device, one per state reported).
        readings: {
          station: r.readings.station.rows.map((x) => ({ at: x.iso, ...x.values })),
          stationChannels: r.readings.station.columns.map((c) => ({ metric: c.metric, label: c.label, unit: c.unit, channel: c.channel })),
          externalNode: r.readings.external.rows.map((x) => ({ at: x.iso, ...Object.fromEntries(r.readings.external.columns.map((c) => [c.key, x.values[c.key]])) })),
          hardware: r.readings.hardware.map((h) => ({ entity: `sensor.${h.id}`, device: h.label, unit: h.unit,
            readings: h.rows.map((x) => ({ at: x.iso, value: x.value, state: x.state })) })),
        },
      };
    }),
    media: { note: 'Originals are downloadable at /media/export.zip (one ZIP, manifest inside) and singly at each item\'s url.',
             counts: mediaLib.counts() },
  };
}

module.exports = { mealEcoLine, rollup, rollupPending, dayRecord, index, fullExport, windowFor, recordedUpTo, FAKE_DEVICES, habitatTab };

/* ==================================================================== PROSE */

/**
 * The record as something a person can read: plain Markdown, opening in any
 * text editor, printing without a stylesheet, and readable in fifty years when
 * nothing here still runs. The JSON export is for machines; this is the one
 * that matters for an archive that is part of the artwork.
 *
 * Numbers and names as they were entered, nothing else: no totals, no
 * projections, no figure carried from one day to the next.
 */
const moodLib = require('./mood');

const fmtV = (v) => (v == null ? '—' : String(v));

function dayMarkdown(missionDay) {
  const st = mission.state();
  const dd = String(missionDay).padStart(3, '0');
  if (missionDay > recordedUpTo(st)) {
    return [`## Mission day ${dd} — ${mission.dateForDay(missionDay)}`, '', '_This day has not happened yet._', ''].join('\n');
  }
  return recordMarkdown(dayRecord(missionDay), `## Mission day ${dd} — ${mission.dateForDay(missionDay)}`);
}

/** Today, before the run, as Markdown — the rehearsal record, marked. Null once the run has begun. */
function rehearsalMarkdown() {
  const r = rehearsalRecord();
  if (!r) return null;
  return recordMarkdown(r, `## Today, before the run — ${r.date} — REHEARSAL, NOT THE RECORD`,
    '_A preview of a day\'s record with what there is today: today\'s readings and the states filed today, and whatever has been put into the opening day (SOL 001) so far — its plan, entries, counts, figures and media. This page is not part of the record and disappears on the first day of the run._');
}

function recordMarkdown(r, heading, note = null) {
  const out = [];
  out.push(heading, '');
  if (note) out.push(note, '');
  if (r.isEmpty) { out.push('_Nothing was recorded on this day._', ''); return out.join('\n'); }
  const written = r.officers.filter((o) => o.entry).length + r.officers.reduce((n, o) => n + (o.reports.length ? 1 : 0), 0);
  out.push(`${written} daily ${written === 1 ? 'blog' : 'blogs'} · ` +
           `${r.moods.length} ${r.moods.length === 1 ? 'state' : 'states'} filed · ` +
           `${r.media.length} ${r.media.length === 1 ? 'file' : 'files'} sent out · ` +
           `${r.readings.count} ${r.readings.count === 1 ? 'reading' : 'readings'}`, '');
  const stateLines = (states) => states.map((m) => {
    const t = moodLib.translate(m);
    return `- ${m.effective_at.slice(11, 16)} UTC — value ${m.calm_tense} (calm 0 … angry 100) — ${t.condition} — “${t.lines[0] || ''}”${m.activity ? ` — ${m.activity}` : ''} — filed by ${m.set_by}`;
  });

  /* ---- the officers ---------------------------------------------------- */
  for (const o of r.officers) {
    out.push(`### ${o.designation}${o.role ? ` — ${o.role}` : ''}`, '');
    if (o.hasBlog) {
      out.push('#### Commander Blog', '');
      if (o.entry) out.push(MV.entryMarkdown(o.entry.body, o.media), '');
      else out.push('_No Commander Blog written for this day._', '');
    }
    if (o.reportKind) {
      out.push(`#### ${o.reportLabel}`, '');
      if (o.reports.length) for (const x of o.reports) out.push(MV.entryMarkdown(x.body, []), '');
      else out.push(`_No ${o.reportLabel} written for this day._`, '');
    }
    out.push('#### Crew state', '');
    if (o.states.length) out.push(...stateLines(o.states), '');
    else out.push('_No state filed for this day._', '');
  }
  if (r.reportsUnassigned.length) {
    out.push('### Daily reports', '');
    for (const x of r.reportsUnassigned) out.push(`- **${x.kind}** — ${MV.entryMarkdown(x.body, [])}`);
    out.push('');
  }
  if (r.notesOther.length) {
    out.push('### Mission notes', '');
    for (const x of r.notesOther) out.push(`- **${x.kind}** — ${MV.entryMarkdown(x.body, [])}`);
    out.push('');
  }

  /* ---- the Habitat tab -------------------------------------------------- */
  out.push('### Habitat', '');
  out.push('_The Habitat tab of mission control for this day, as it stands at the time of this record. The same tab is written to the readings log automatically at the end of each day._', '');
  out.push('#### Schedule', '');
  if (r.day && r.day.tasks.length) {
    for (const t of r.day.tasks) out.push(`- **${t.time}** — ${t.label}${t.detail ? `. ${t.detail}` : ''} _(${String(t.status || 'PLANNED').toLowerCase()})_`);
  } else out.push('_No schedule for this day._');
  out.push('');
  out.push('#### Meals', '');
  if (r.day && r.day.meals.length) {
    for (const m of r.day.meals) {
      out.push(`**${m.slot === 'RATION' ? 'Other' : m.slot[0] + m.slot.slice(1).toLowerCase()}: ${m.name}**  `);
      if (m.components) out.push(m.components.split('\n').map((l) => `  ${l}`).join('  \n') + '  ');
      out.push(`  ${fmtV(m.kcal)} kcal · ${fmtV(m.water_litres)} L water · ${fmtV(m.prep_minutes)} min · ${fmtV(m.energy_wh)} Wh`);
      const eco = mealEcoLine(m);
      if (eco) out.push(`  ${eco}`);
      if (m.notes) out.push(`  _${m.notes}_`);
      out.push('');
    }
  } else out.push('_No meals entered for this day._', '');
  out.push('#### Steps taken and calories consumed', '');
  if (r.figures && r.figures.crew && Object.keys(r.figures.crew).length) {
    out.push('| Officer | Steps taken | Calories consumed (kcal) |', '| --- | --- | --- |');
    for (const [who, f] of Object.entries(r.figures.crew)) out.push(`| ${who} | ${fmtV(f.steps)} | ${fmtV(f.calories)} |`);
    if (r.figures.calories != null || r.figures.steps != null) out.push(`| **Crew (as filed)** | **${fmtV(r.figures.steps)}** | **${fmtV(r.figures.calories)}** |`);
  } else out.push('_Not filed for this day._');
  out.push('');
  out.push('#### Inventory levels', '');
  if (r.stores.length) {
    out.push('_As the tab shows them; "counted" means filed for this day, "carried" means from the day before at its draw._', '');
    out.push('| Resource | Available amount | Amount used today | Amount left for future | Figures |', '| --- | --- | --- | --- | --- |');
    for (const i of r.stores) out.push(`| ${i.label} | ${fmtV(i.available)} ${i.unit} | ${fmtV(i.used)} ${i.unit} | ${fmtV(i.left)} ${i.unit} | used ${i.counted.used ? 'counted' : 'carried'} · left ${i.counted.left ? 'counted' : 'carried'} |`);
    if (r.filed.why) out.push('', `_${r.filed.why}_`);
  } else out.push('_No stores tracked._');
  out.push('');
  out.push('#### Power consumed', '');
  if (r.power && r.power.filed) {
    out.push('| Category | kWh |', '| --- | --- |');
    for (const c of r.power.categories) out.push(`| ${c.label} | ${fmtV(c.kwh)} |`);
  } else out.push('_Not filed for this day._');
  out.push('');

  /* ---- the sensors, named as on the dashboard --------------------------- */
  out.push('### Habitat sensors', '');
  if (r.external.length) {
    out.push('#### Habitat · sensor node', '');
    out.push('| Channel | Low | High | Mean | Readings |', '| --- | --- | --- | --- | --- |');
    for (const h of r.external) {
      const f = (v) => (v == null ? '—' : String(Math.round(v * 100) / 100));
      out.push(`| ${h.label} | ${f(h.low)} | ${f(h.high)} | ${f(h.mean)} ${h.unit} | ${h.samples} |`);
    }
    out.push('');
  }
  if (r.habitat.length) {
    out.push('#### Habitat · the station\'s channels', '');
    out.push('| Channel | Low | High | Mean | Readings |', '| --- | --- | --- | --- | --- |');
    for (const h of r.habitat) {
      const f = (v) => (v == null ? '—' : v.toFixed(1));
      out.push(`| ${h.channel ? h.channel + ' ' : ''}${h.label || h.metric} | ${f(h.min_value)} | ${f(h.max_value)} | ${f(h.avg_value)} ${h.unit || ''} | ${h.samples} |`);
    }
    out.push('');
  }
  if (r.hardware.length) {
    out.push('#### Habitat hardware', '');
    out.push('| Device | Low | High | Mean | Added today | Readings |', '| --- | --- | --- | --- | --- | --- |');
    for (const h of r.hardware) {
      const f = (v) => (v == null ? '—' : String(Math.round(v * 100) / 100));
      out.push(`| ${h.label} | ${f(h.low)} | ${f(h.high)} | ${f(h.mean)} ${h.unit} | ${h.added == null ? '—' : `${f(h.added)} ${h.unit}`} | ${h.samples} |`);
    }
    out.push('');
  }
  if (!r.external.length && !r.habitat.length && !r.hardware.length) out.push('_No reading was stored for this day._', '');

  // every reading of the day, as stored
  const R = r.readings;
  if (R.count) {
    out.push(`#### Every reading of the day · ${R.count} readings`, '');
    out.push('Each as it was stored — times are habitat time, to the second.', '');
  }
  if (R.external.rows.length) {
    out.push(`**Habitat · sensor node** (${R.external.readings} readings)`, '');
    out.push(`| Time | ${R.external.columns.map((c) => `${c.label} (${c.unit})`).join(' | ')} |`,
             `| --- | ${R.external.columns.map(() => '---').join(' | ')} |`);
    for (const row of R.external.rows) out.push(`| ${row.at} | ${R.external.columns.map((c) => fmtV(row.values[c.key])).join(' | ')} |`);
    out.push('');
  }
  if (R.station.rows.length) {
    out.push(`**Habitat · the station's channels** (${R.station.readings} readings)`, '');
    out.push(`| Time | ${R.station.columns.map((c) => `${c.label}${c.unit ? ` (${c.unit})` : ''}`).join(' | ')} |`,
             `| --- | ${R.station.columns.map(() => '---').join(' | ')} |`);
    for (const row of R.station.rows) out.push(`| ${row.at} | ${R.station.columns.map((c) => fmtV(row.values[c.metric])).join(' | ')} |`);
    out.push('');
  }
  for (const h of R.hardware) {
    out.push(`**Habitat hardware · ${h.label}** (sensor.${h.id}, ${h.rows.length} readings)`, '');
    out.push(`| Time | Value${h.unit ? ` (${h.unit})` : ''} | As reported |`, '| --- | --- | --- |');
    for (const row of h.rows) out.push(`| ${row.at} | ${fmtV(row.value)} | ${row.state} |`);
    out.push('');
  }

  /* ---- what was sent out ------------------------------------------------ */
  if (r.media.length) {
    out.push('### Media sent out', '');
    for (const m of r.media) {
      out.push(`- **${m.filename}** — ${m.kind}, ${m.bytes.toLocaleString('en-GB')} bytes` +
        `${m.designation ? `, ${m.designation}` : ''}${m.caption ? ` — ${m.caption}` : ''}  `);
      out.push(`  SHA-256 \`${m.sha256}\` · ${mediaLib.fileUrl(m)}`);
    }
    out.push('');
  }

  return out.join('\n');
}

function fullMarkdown() {
  rollupPending();
  const st = mission.state();
  const crew = db.prepare('SELECT designation, role FROM crew ORDER BY sort_order').all();
  const out = [];

  const upTo = recordedUpTo(st);

  out.push(`# ${st.name}`, '');
  out.push(`Mars Communication Station — complete mission record.`, '');
  out.push(`- Mission: ${st.start_date} to ${st.end_date} (${st.totalDays} days, ${st.timezone})`);
  out.push(`- Crew: ${crew.map((c) => `${c.designation} (${c.role})`).join('; ')}`);
  out.push(`- Days recorded: ${upTo === 0 ? 'none yet — the run has not begun' : `${upTo} of ${st.totalDays}`}`);
  out.push(`- Exported: ${new Date().toISOString().slice(0, 16).replace('T', ' ')} UTC`, '');
  out.push('Every day below holds what was entered on the station that day and what its sensors',
           'measured: the schedule as it was run, the meals, the stores as they were counted, the',
           'power and the crew\'s figures as they were filed, what the crew wrote and sent out, the',
           'states filed for them, and every reading of the day — the station\'s channels, the',
           'external node and the hardware, each as it was stored. Nothing is projected, totalled',
           'or carried forward; a day that has not happened has no record. The messages from Earth',
           'and the crew\'s replies are not part of this record.', '');
  out.push('---', '');

  for (let n = 1; n <= upTo; n++) {
    out.push(dayMarkdown(n), '---', '');
  }
  // before the run: today's rehearsal page, marked, so the shape can be seen
  const rehearsal = upTo === 0 ? rehearsalMarkdown() : null;
  if (rehearsal) out.push(rehearsal, '---', '');
  if (upTo < st.totalDays) {
    out.push(`_Days ${String(upTo + 1).padStart(3, '0')} to ${String(st.totalDays).padStart(3, '0')} have not happened yet._`, '');
  }
  return out.join('\n');
}

module.exports.dayMarkdown = dayMarkdown;
module.exports.fullMarkdown = fullMarkdown;
module.exports.rehearsalMarkdown = rehearsalMarkdown;
/** One line of the recipe figures of a meal, per serving: nutrients, CO2e, water footprint. */
function mealEcoLine(m) {
  const n = m.nutrients || {};
  const { NUTRIENTS } = require('./content');
  const parts = NUTRIENTS.filter((x) => n[x.key] != null).map((x) => `${x.label.toLowerCase()} ${+Number(n[x.key]).toFixed(1)} ${x.unit}`);
  if (m.co2e_kg != null) parts.push(`${+Number(m.co2e_kg).toFixed(3)} kg CO2e`);
  if (m.water_footprint_l != null) parts.push(`${+Number(m.water_footprint_l).toFixed(1)} L water footprint`);
  return parts.length ? `Per serving: ${parts.join(' · ')}` : '';
}

module.exports.rehearsalRecord = rehearsalRecord;
