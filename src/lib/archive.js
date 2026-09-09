'use strict';
const { db, now } = require('../db');
const mission = require('./mission');
const data = require('./data');
const mediaLib = require('./media');
const MV = require('../views/pages/media');

/**
 * The archive is the work, so nothing on this site is allowed to be transient.
 * Every mission day is rolled up into a permanent record: the schedule as it
 * was actually run, the meals, the inventory, the crew's own entries, the mood
 * states filed that day, a summary of every habitat channel, and every message
 * that crossed the gap. Once a day is over it is sealed and stops being
 * recomputed.
 */

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
     FROM sensor_reading WHERE recorded_at >= ? AND recorded_at < ?
     GROUP BY metric`
  ).all(start, end);

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
    for (const r of rows) {
      stmt.run(missionDay, r.metric, r.lo, r.hi, r.av, r.n, over ? now() : null);
    }
    if (over && rows.length) {
      db.prepare('INSERT OR IGNORE INTO day_seal (mission_day, sealed_at) VALUES (?, ?)')
        .run(missionDay, now());
    }
  });
  tx();
  // The day's summary in the readings log carries the hardware beside the
  // channels, so the log's daily record holds the whole habitat.
  const hardware = require('./home-assistant').daySummary({ start, end });
  if (rows.length || hardware.length) {
    require('./readings-log').record('daily', { missionDay, window: { start, end }, sealed: over,
      channels: rows.map((r) => ({ metric: r.metric, low: r.lo, high: r.hi, mean: r.av, samples: r.n })),
      hardware: hardware.map((h) => ({ device: h.label, entity: `sensor.${h.id}`, unit: h.unit,
        low: h.low, high: h.high, mean: h.mean, addedToday: h.added, samples: h.samples })) }, { dedupe: true });
  }
  return rows.length;
}

/** Roll up anything that has not been sealed yet. Cheap; safe to call often. */
function rollupPending() {
  const st = mission.state();
  const upTo = Math.min(st.missionDay, st.totalDays);
  let done = 0;
  for (let n = 1; n <= upTo; n++) {
    const sealed = db.prepare('SELECT 1 FROM day_seal WHERE mission_day = ?').get(n);
    if (sealed && n < st.missionDay) continue;   // already final
    rollup(n);
    done++;
  }
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

  const moods = db.prepare(
    `SELECT cm.*, c.designation FROM crew_mood cm JOIN crew c ON c.id = cm.crew_id
     WHERE cm.effective_at >= ? AND cm.effective_at < ? ORDER BY cm.effective_at`
  ).all(start, end);

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

  /* ---- the day over its 24 hours, for the archive's charts -------------
     Every reading pulled that day — the station's own channels (the ingest
     API), the external node's feed and the hardware through Home Assistant —
     bucketed to one point per hour, keyed 1–24 (position = hour mark 00–23).
     And the two-point day: each store's level at open and close, and the
     calories from zero to the day's total. */
  const winA = Date.parse(start), winB = Date.parse(end);
  const bucketize = (list) => {
    const b = new Map();
    for (const [t, v] of list) {
      const h = Math.min(23, Math.max(0, Math.floor((t - winA) / 3600000)));
      const x = b.get(h) || { s: 0, n: 0 };
      x.s += v; x.n += 1; b.set(h, x);
    }
    const points = {};
    for (const [h, x] of [...b].sort((p, q) => p[0] - q[0])) points[h + 1] = Math.round((x.s / x.n) * 100) / 100;
    return points;
  };
  // The station's own channels, from the ingest API.
  const ingestRows = db.prepare(
    `SELECT metric, recorded_at, value FROM sensor_reading
     WHERE recorded_at >= ? AND recorded_at < ? AND value IS NOT NULL ORDER BY recorded_at`).all(start, end);
  const metricMeta = new Map(db.prepare('SELECT metric, label, unit, channel FROM sensor_metric').all()
    .map((m) => [m.metric, m]));
  const byMetric = new Map();
  for (const r of ingestRows) {
    if (!byMetric.has(r.metric)) byMetric.set(r.metric, []);
    byMetric.get(r.metric).push([Date.parse(r.recorded_at), r.value]);
  }
  const habitatHours = [...byMetric].map(([metric, list]) => {
    const m = metricMeta.get(metric) || {};
    return { id: metric, channel: m.channel || null, label: m.label || metric, unit: m.unit || '', points: bucketize(list) };
  }).filter((c) => Object.keys(c.points).length);
  // The external node's feed.
  const EXT_KEYS = [['co2', 'CO₂ · node', 'ppm'], ['temp', 'Temperature · node', '°C'],
    ['hum', 'Humidity · node', '%'], ['pres', 'Pressure · node', 'hPa'],
    ['light', 'Light · node', 'raw'], ['bat', 'Node battery', 'V']];
  let externalHours = [];
  try {
    const ext = db.prepare('SELECT * FROM external_reading WHERE t >= ? AND t < ? ORDER BY t').all(winA, winB);
    externalHours = EXT_KEYS.map(([k, label, unit]) => ({
      id: 'ext-' + k, label, unit,
      points: bucketize(ext.filter((r) => r[k] != null).map((r) => [r.t, r[k]])),
    })).filter((c) => Object.keys(c.points).length);
  } catch { /* the node's table is created by critical.js on first use */ }
  // The hardware, hour by hour.
  const hardwareHours = require('./home-assistant').hourly({ start, end });
  // The two-point day: open (yesterday's close — the close plus the day's
  // use) and close, per store; calories from zero to the day's total.
  const resourcesDay = day ? day.inventory.map((i) => ({
    key: i.key, label: i.label, unit: i.unit,
    open: Math.round((i.quantity + (i.consumption || 0)) * 100) / 100,
    close: i.quantity,
  })) : [];
  const figDay = (require('./content').crewFigures() || {})[String(missionDay)] || null;
  const caloriesDay = figDay && figDay.calories != null ? { open: 0, close: figDay.calories } : null;

  // Power consumed that day, by category — from content/power.json, counted
  // daily by the crew like the calories and steps.
  const power = require('./content').powerDay(missionDay);

  return {
    missionDay, date: mission.dateForDay(missionDay), day,
    habitat, hardware, entries, moods, messages, traffic, media, power, sealed: !!sealed,
    habitatHours, externalHours, hardwareHours, resourcesDay, caloriesDay,
    isEmpty: !day && !entries.length && !messages.length && !habitat.length && !hardware.length && !media.length,
  };
}

/** Index of every day, for the archive contents page. */
function index() {
  const st = mission.state();
  const out = [];
  for (let n = 1; n <= st.totalDays; n++) {
    const c = db.prepare(
      `SELECT
        (SELECT COUNT(*) FROM crew_entry WHERE mission_day = ? AND published = 1) entries,
        (SELECT COUNT(*) FROM message WHERE mission_day = ? AND state = 'PUBLISHED') messages,
        (SELECT COUNT(*) FROM task WHERE mission_day = ?) tasks,
        (SELECT COUNT(*) FROM meal WHERE mission_day = ?) meals,
        (SELECT COUNT(*) FROM sensor_daily WHERE mission_day = ?) channels,
        (SELECT COUNT(*) FROM media WHERE mission_day = ? AND hidden = 0) media`
    ).get(n, n, n, n, n, n);
    out.push({
      missionDay: n, date: mission.dateForDay(n), ...c,
      isPast: n < st.missionDay, isToday: n === st.missionDay,
      sealed: !!db.prepare('SELECT 1 FROM day_seal WHERE mission_day = ?').get(n),
    });
  }
  return out;
}

/** The complete mission as one object, for download. */
function fullExport() {
  const st = mission.state();
  return {
    mission: {
      name: st.name, start: st.start_date, end: st.end_date, timezone: st.timezone,
      totalDays: st.totalDays,
    },
    exportedAt: now(),
    crew: db.prepare('SELECT id, designation, role FROM crew ORDER BY sort_order').all(),
    days: Array.from({ length: st.totalDays }, (_, i) => {
      const r = dayRecord(i + 1);
      return {
        missionDay: r.missionDay, date: r.date,
        schedule: r.day ? r.day.tasks.map((t) => ({
          time: t.time, label: t.label, detail: t.detail, status: t.status })) : [],
        meals: r.day ? r.day.meals.map((m) => ({
          slot: m.slot, name: m.name, components: m.components, kcal: m.kcal,
          waterLitres: m.water_litres, prepMinutes: m.prep_minutes, energyWh: m.energy_wh })) : [],
        inventory: r.day ? r.day.inventory.map((v) => ({
          item: v.label, unit: v.unit, quantity: v.quantity, consumption: v.consumption })) : [],
        power: r.power.filed ? { totalKwh: r.power.total,
          categories: r.power.categories.map((c) => ({ key: c.key, label: c.label, kwh: c.kwh })) } : null,
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
        hardware: r.hardware.map((h) => ({
          device: h.label, entity: `sensor.${h.id}`, kind: h.kind, unit: h.unit,
          min: h.low, max: h.high, avg: h.mean, addedToday: h.added, samples: h.samples })),
        exchanges: r.messages.map((m) => ({
          callsign: m.callsign, tags: (m.tags || '').split(',').filter(Boolean),
          message: m.body, response: m.response_body, respondedBy: m.responder,
          submittedAt: m.submitted_at, lightSeconds: m.light_seconds, distanceAu: m.distance_au })),
        traffic: r.traffic,
        // What the crew sent out that day: the files are in the media ZIP
        // and on the volume under media/<sha>; this is the list with hashes.
        media: r.media.map(mediaLib.describe),
      };
    }),
    media: { note: 'Originals are downloadable at /media/export.zip (one ZIP, manifest inside) and singly at each item\'s url.',
             counts: mediaLib.counts() },
  };
}

module.exports = { rollup, rollupPending, dayRecord, index, fullExport, windowFor };

/* ==================================================================== PROSE */

/**
 * The record as something a person can read: plain Markdown, opening in any
 * text editor, printing without a stylesheet, and readable in fifty years when
 * nothing here still runs. The JSON export is for machines; this is the one
 * that matters for an archive that is part of the artwork.
 */
const moodLib = require('./mood');

function dayMarkdown(missionDay) {
  const r = dayRecord(missionDay);
  const st = mission.state();
  const out = [];
  const dd = String(missionDay).padStart(3, '0');

  out.push(`## Mission day ${dd} — ${r.date}`, '');
  if (r.isEmpty) { out.push('_Nothing was recorded on this day._', ''); return out.join('\n'); }

  out.push(`${r.entries.length} crew ${r.entries.length === 1 ? 'entry' : 'entries'} · ` +
           `${r.messages.length} ${r.messages.length === 1 ? 'exchange' : 'exchanges'} published · ` +
           `${r.traffic.sent} messages sent from Earth by ${r.traffic.callsigns} callsigns`, '');

  if (r.day && r.day.tasks.length) {
    out.push('### Schedule', '');
    for (const t of r.day.tasks) {
      out.push(`- **${t.time}** — ${t.label}${t.detail ? `. ${t.detail}` : ''}` +
        (t.status && t.status !== 'PLANNED' ? ` _(${t.status.toLowerCase()})_` : ''));
    }
    out.push('');
  }

  if (r.day && r.day.meals.length) {
    out.push('### Meals', '');
    for (const m of r.day.meals) {
      out.push(`**${m.slot[0] + m.slot.slice(1).toLowerCase()}: ${m.name}**  `);
      if (m.components) out.push(m.components.split('\n').map((l) => `  ${l}`).join('  \n') + '  ');
      out.push(`  ${m.kcal} kcal · ${m.water_litres} L water · ${m.prep_minutes} min · ${m.energy_wh} Wh`);
      if (m.notes) out.push(`  _${m.notes}_`);
      out.push('');
    }
    out.push(`Day total: ${r.day.kcalPlanned} kcal · ${r.day.waterPlanned.toFixed(1)} L water · ${r.day.energyPlanned} Wh`, '');
  }

  if (r.day && r.day.inventory.length) {
    out.push('### Inventory at the end of the day', '');
    out.push('| Resource | Remaining | Daily draw | Days left |', '| --- | --- | --- | --- |');
    for (const i of r.day.inventory) {
      const left = i.consumption > 0 ? (i.quantity / i.consumption).toFixed(1) : '—';
      out.push(`| ${i.label} | ${i.quantity} ${i.unit} | ${i.consumption} | ${left} |`);
    }
    out.push('');
  }

  if (r.power && r.power.filed) {
    out.push('### Power consumed', '');
    out.push('| Category | kWh |', '| --- | --- |');
    for (const c of r.power.categories) out.push(`| ${c.label} | ${c.kwh == null ? '—' : c.kwh} |`);
    out.push(`| **Day total** | **${r.power.total}** |`, '');
  }

  if (r.entries.length) {
    out.push('### Crew log', '');
    for (const e of r.entries) {
      out.push(`#### ${e.designation}`, '');
      out.push(MV.entryMarkdown(e.body, r.media.filter((m) => m.crew_id === e.crew_id)), '');
    }
  }

  if (r.media.length) {
    out.push('### Media sent out', '');
    for (const m of r.media) {
      out.push(`- **${m.filename}** — ${m.kind}, ${m.bytes.toLocaleString('en-GB')} bytes` +
        `${m.designation ? `, ${m.designation}` : ''}${m.caption ? ` — ${m.caption}` : ''}  `);
      out.push(`  SHA-256 \`${m.sha256}\` · ${mediaLib.fileUrl(m)}`);
    }
    out.push('');
  }

  if (r.moods.length) {
    out.push('### Crew states filed', '');
    for (const m of r.moods) {
      const t = moodLib.translate(m);
      out.push(`**${m.designation}** — ${m.effective_at.slice(11, 16)} UTC — ${t.condition}` +
        (m.activity ? ` — ${m.activity}` : ''));
      for (const a of t.axes) out.push(`  - ${a.label}: ${a.text}`);
      out.push('');
    }
  }

  if (r.messages.length) {
    out.push('### Exchanges', '');
    for (const m of r.messages) {
      const tags = (m.tags || '').split(',').filter(Boolean).join(', ');
      out.push(`**${m.callsign}**${tags ? ` — ${tags}` : ''} — crossed ${formatLight(m.light_seconds)} at ${m.distance_au.toFixed(3)} au`, '');
      out.push(`> ${m.body.replace(/\n/g, '\n> ')}`, '');
      if (m.response_body) {
        out.push(`_${m.responder || 'Mars habitat'} replied:_`, '');
        out.push(`> ${m.response_body.replace(/\n/g, '\n> ')}`, '');
      }
    }
  }

  const notes = r.day ? r.day.notes.filter((n) => n.published_at) : [];
  if (notes.length) {
    out.push('### Mission notes', '');
    for (const n of notes) out.push(`- **${n.kind}** — ${MV.entryMarkdown(n.body, [])}`);
    out.push('');
  }

  if (r.habitat.length) {
    out.push('### Habitat', '');
    out.push('| Channel | Low | High | Mean | Samples |', '| --- | --- | --- | --- | --- |');
    for (const h of r.habitat) {
      const f = (v) => (v == null ? '—' : v.toFixed(1));
      out.push(`| ${h.label || h.metric} | ${f(h.min_value)} | ${f(h.max_value)} | ${f(h.avg_value)} ${h.unit || ''} | ${h.samples} |`);
    }
    out.push('');
  }

  if (r.hardware.length) {
    out.push('### Habitat hardware', '');
    out.push('| Device | Low | High | Mean | Added today | Samples |', '| --- | --- | --- | --- | --- | --- |');
    for (const h of r.hardware) {
      const f = (v) => (v == null ? '—' : String(Math.round(v * 100) / 100));
      out.push(`| ${h.label} | ${f(h.low)} | ${f(h.high)} | ${f(h.mean)} ${h.unit} | ${h.added == null ? '—' : `${f(h.added)} ${h.unit}`} | ${h.samples} |`);
    }
    out.push('');
  }

  return out.join('\n');
}

const formatLight = (s) => `${Math.floor(s / 60)} min ${String(Math.round(s % 60)).padStart(2, '0')} s`;

function fullMarkdown() {
  rollupPending();
  const st = mission.state();
  const crew = db.prepare('SELECT designation, role FROM crew ORDER BY sort_order').all();
  const out = [];

  out.push(`# ${st.name}`, '');
  out.push(`Mars Communication Station — complete mission record.`, '');
  out.push(`- Mission: ${st.start_date} to ${st.end_date} (${st.totalDays} days, ${st.timezone})`);
  out.push(`- Crew: ${crew.map((c) => `${c.designation} (${c.role})`).join('; ')}`);
  out.push(`- Exported: ${new Date().toISOString().slice(0, 16).replace('T', ' ')} UTC`, '');
  out.push('Every day below holds the schedule as it was run, the meals, the inventory, what the',
           'crew wrote, the states filed for them, every exchange with the public and the real',
           'time each message took to cross. Nothing is summarised away.', '');
  out.push('---', '');

  for (let n = 1; n <= st.totalDays; n++) {
    out.push(dayMarkdown(n), '---', '');
  }
  return out.join('\n');
}

module.exports.dayMarkdown = dayMarkdown;
module.exports.fullMarkdown = fullMarkdown;
