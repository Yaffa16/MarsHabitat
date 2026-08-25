'use strict';
const { db } = require('../db');

const STALE_SECONDS = Number(process.env.SENSOR_STALE_SECONDS || 300);

/* ----------------------------------------------------------------- sensors */

function metrics() {
  return db.prepare('SELECT * FROM sensor_metric WHERE visible = 1 ORDER BY sort_order, metric').all();
}

function latest(metric) {
  return db.prepare(
    'SELECT * FROM sensor_reading WHERE metric = ? ORDER BY recorded_at DESC LIMIT 1'
  ).get(metric);
}

function history(metric, hours = 24, limit = 240) {
  const since = new Date(Date.now() - hours * 3600000).toISOString();
  const rows = db.prepare(
    `SELECT value, recorded_at FROM sensor_reading
     WHERE metric = ? AND recorded_at >= ? ORDER BY recorded_at DESC LIMIT ?`
  ).all(metric, since, limit);
  return rows.reverse();
}

/**
 * Classify a reading. A missing or old reading is not "0" and not "nominal" --
 * it is SIGNAL LOST, which will happen during a run and must read as a real
 * condition of the habitat rather than as a broken page.
 */
function evaluate(metricRow, reading) {
  if (!reading) return { state: '', label: 'NO SIGNAL', stale: true, value: null };
  const ageS = (Date.now() - Date.parse(reading.recorded_at)) / 1000;
  if (ageS > STALE_SECONDS) {
    return { state: 'warn', label: 'SIGNAL LOST', stale: true, value: reading.value, ageS };
  }
  const v = reading.value;
  const { ok_min: okMin, ok_max: okMax, warn_min: wMin, warn_max: wMax } = metricRow;
  let state = 'ok', label = 'NOMINAL';
  if (wMin != null && wMax != null && (v < wMin || v > wMax)) { state = 'warn'; label = 'CAUTION'; }
  if (okMin != null && okMax != null && (v < okMin || v > okMax)) { state = 'bad'; label = 'OUT OF RANGE'; }
  return { state, label, stale: false, value: v, ageS };
}

function sensorPanels() {
  return metrics().map((m) => {
    const reading = latest(m.metric);
    return { metric: m, reading, status: evaluate(m, reading), history: history(m.metric) };
  });
}

/**
 * One daily average per channel, for the trend charts: every visible channel
 * that has reported in the last `days`, as { metric, label, unit, warnMax,
 * points: { 'YYYY-MM-DD': value } }. The day is the venue's, not UTC — SQL
 * reduces the readings to hourly means first, so a month of readings is a
 * few thousand rows to walk rather than a hundred thousand.
 */
function dailyAverages(days = 40, localDate = (d) => d.toISOString().slice(0, 10)) {
  const since = new Date(Date.now() - days * 86400000).toISOString();
  const hours = db.prepare(
    `SELECT metric, strftime('%Y-%m-%dT%H:00:00Z', recorded_at) AS hour,
            AVG(value) AS mean, COUNT(*) AS n
     FROM sensor_reading WHERE recorded_at >= ? AND device_id != 'seed-01'
     GROUP BY metric, hour`
  ).all(since);
  const acc = {};
  for (const h of hours) {
    const date = localDate(new Date(h.hour));
    const a = (acc[h.metric] = acc[h.metric] || {});
    const d = (a[date] = a[date] || { sum: 0, n: 0 });
    d.sum += h.mean * h.n; d.n += h.n;
  }
  return metrics().filter((m) => acc[m.metric]).map((m) => {
    const points = {};
    for (const [date, d] of Object.entries(acc[m.metric])) points[date] = Math.round((d.sum / d.n) * 100) / 100;
    return { metric: m.metric, label: m.label, unit: m.unit, channel: m.channel, warnMax: m.warn_max,
      domain: m.ok_min != null && m.ok_max != null ? [m.ok_min, m.ok_max] : null, points };
  });
}

/* --------------------------------------------------------------- day content */

function day(missionDay) {
  const d = db.prepare('SELECT * FROM day WHERE mission_day = ?').get(missionDay);
  if (!d) return null;
  d.tasks = db.prepare('SELECT * FROM task WHERE mission_day = ? ORDER BY sort_order, time').all(missionDay);
  d.meals = db.prepare('SELECT * FROM meal WHERE mission_day = ? ORDER BY CASE slot WHEN \'BREAKFAST\' THEN 1 WHEN \'LUNCH\' THEN 2 WHEN \'DINNER\' THEN 3 ELSE 4 END').all(missionDay);
  d.notes = db.prepare('SELECT * FROM day_note WHERE mission_day = ? ORDER BY posted_at DESC').all(missionDay);
  // The day-1 figure is the scale each gauge is drawn against.
  d.inventory = db.prepare(
    `SELECT il.*, i.key, i.label, i.unit, i.category, i.critical, i.warn_below,
       (SELECT quantity FROM inventory_level WHERE item_id = i.id ORDER BY mission_day LIMIT 1)
         AS start_quantity
     FROM inventory_level il JOIN inventory_item i ON i.id = il.item_id
     WHERE il.mission_day = ? ORDER BY i.sort_order, i.label`
  ).all(missionDay);
  d.waterPlanned = d.meals.reduce((s, m) => s + (m.water_litres || 0), 0);
  d.kcalPlanned = d.meals.reduce((s, m) => s + (m.kcal || 0), 0);
  d.energyPlanned = d.meals.reduce((s, m) => s + (m.energy_wh || 0), 0);
  return d;
}

/* ------------------------------------------------------------------- crew */

function crewWithMood() {
  const crew = db.prepare('SELECT * FROM crew ORDER BY sort_order, id').all();
  const stmt = db.prepare(
    'SELECT * FROM crew_mood WHERE crew_id = ? ORDER BY effective_at DESC LIMIT 1'
  );
  return crew.map((c) => ({ ...c, mood: stmt.get(c.id) || null }));
}

function moodHistory(crewId, limit = 60) {
  return db.prepare(
    'SELECT * FROM crew_mood WHERE crew_id = ? ORDER BY effective_at DESC LIMIT ?'
  ).all(crewId, limit);
}

/**
 * Chronological mood series for the drift chart. Shows whether the crew arc is
 * actually landing as a curve or as noise -- a dramaturgical instrument as much
 * as an administrative one.
 */
function moodSeries(crewId, limit = 400) {
  return db.prepare(
    `SELECT calm_tense, energetic_exhausted, optimistic_uncertain, connected_isolated,
            effective_at FROM crew_mood WHERE crew_id = ?
     ORDER BY effective_at ASC LIMIT ?`
  ).all(crewId, limit);
}

/* ---------------------------------------------------------------- messages */

/**
 * Transit is resolved from the clock, not from a background job, so the state
 * is correct even if the process restarts mid-flight.
 */
function settleTransits() {
  const nowIso = new Date().toISOString();
  db.prepare(
    `UPDATE message SET state = 'PENDING_APPROVAL'
     WHERE state IN ('TRANSMITTED', 'IN_TRANSIT', 'ARRIVED') AND arrival_at <= ?`
  ).run(nowIso);
}

function published(limit = 100, filters = {}) {
  settleTransits();
  const where = ["m.state = 'PUBLISHED'"];
  const args = [];
  if (filters.tag) { where.push('m.tags LIKE ?'); args.push(`%${filters.tag}%`); }
  if (filters.callsign) { where.push('m.callsign = ?'); args.push(filters.callsign); }
  if (filters.day) { where.push('m.mission_day = ?'); args.push(Number(filters.day)); }
  const rows = db.prepare(
    `SELECT m.*, r.body AS response_body, r.published_at AS response_at, c.designation AS responder
     FROM message m
     LEFT JOIN response r ON r.message_id = m.id
     LEFT JOIN crew c ON c.id = r.crew_id
     WHERE ${where.join(' AND ')}
     ORDER BY COALESCE(r.published_at, m.reviewed_at, m.submitted_at) DESC LIMIT ?`
  ).all(...args, limit);
  return rows;
}

/**
 * The board as one visitor sees it: every published exchange, plus that
 * visitor's own messages whatever became of them — in transit, reached,
 * rejected, awaiting a reply. Nothing another visitor sent reaches the page
 * until mission control has approved and published it, so the common board
 * only ever carries the reviewed record; a sender still sees their own
 * traffic with its state stamped on it.
 *
 * Each row carries `mine` (sent by this visitor) and `pending` (not yet
 * published, so visible to its sender only).
 */
function board(limit = 400, visitorId = null) {
  settleTransits();
  return db.prepare(
    `SELECT m.*, r.body AS response_body, r.published_at AS response_at, c.designation AS responder
     FROM message m
     LEFT JOIN response r ON r.message_id = m.id
     LEFT JOIN crew c ON c.id = r.crew_id
     WHERE m.state = 'PUBLISHED' OR m.visitor_id = ?
     ORDER BY m.submitted_at DESC LIMIT ?`
  ).all(visitorId == null ? -1 : visitorId, limit).map((m) => ({
    ...m,
    mine: visitorId != null && m.visitor_id === visitorId,
    pending: m.state !== 'PUBLISHED',
  }));
}

function inFlightFor(visitorId) {
  settleTransits();
  return db.prepare(
    `SELECT * FROM message WHERE visitor_id = ? AND state IN ('TRANSMITTED','IN_TRANSIT')
     ORDER BY submitted_at DESC LIMIT 1`
  ).get(visitorId);
}

function messagesFor(visitorId, limit = 20) {
  settleTransits();
  return db.prepare(
    `SELECT m.*, r.body AS response_body, r.published_at AS response_at
     FROM message m LEFT JOIN response r ON r.message_id = m.id
     WHERE m.visitor_id = ? ORDER BY m.submitted_at DESC LIMIT ?`
  ).all(visitorId, limit);
}

function counts() {
  settleTransits();
  const g = (sql, ...a) => db.prepare(sql).get(...a).n;
  return {
    inTransit: g("SELECT COUNT(*) n FROM message WHERE state IN ('TRANSMITTED','IN_TRANSIT')"),
    pending: g("SELECT COUNT(*) n FROM message WHERE state = 'PENDING_APPROVAL'"),
    approved: g("SELECT COUNT(*) n FROM message WHERE state = 'APPROVED'"),
    awaitingResponse: g(
      "SELECT COUNT(*) n FROM message m LEFT JOIN response r ON r.message_id = m.id WHERE m.state = 'APPROVED' AND r.id IS NULL"),
    published: g("SELECT COUNT(*) n FROM message WHERE state = 'PUBLISHED'"),
    rejected: g("SELECT COUNT(*) n FROM message WHERE state = 'REJECTED'"),
    total: g('SELECT COUNT(*) n FROM message'),
    visitors: g('SELECT COUNT(*) n FROM visitor'),
    today: g('SELECT COUNT(*) n FROM message WHERE submitted_at >= ?',
      new Date(Date.now() - 86400000).toISOString()),
  };
}

/* ---------------------------------------------------------------- logbook */

/** Published entries for one mission day, in crew order. */
function entriesForDay(missionDay, { includeHeld = false } = {}) {
  return db.prepare(
    `SELECT e.*, c.designation, c.role FROM crew_entry e JOIN crew c ON c.id = e.crew_id
     WHERE e.mission_day = ? ${includeHeld ? '' : 'AND e.published = 1'}
     ORDER BY c.sort_order`
  ).all(missionDay);
}

/** Everything one crew member has written, newest first. */
function entriesByCrew(crewId, { includeHeld = false, limit = 200 } = {}) {
  return db.prepare(
    `SELECT e.*, c.designation, c.role FROM crew_entry e JOIN crew c ON c.id = e.crew_id
     WHERE e.crew_id = ? ${includeHeld ? '' : 'AND e.published = 1'}
     ORDER BY e.mission_day DESC LIMIT ?`
  ).all(crewId, limit);
}

function entry(crewId, missionDay) {
  return db.prepare('SELECT * FROM crew_entry WHERE crew_id = ? AND mission_day = ?')
    .get(crewId, missionDay);
}

/**
 * Day-by-day logbook, newest day first. Days where nobody wrote are omitted --
 * a gap in the log is visible as a jump in the day numbers, which is truer than
 * printing an empty day.
 */
function logbook({ includeHeld = false, crewId = null, limit = 400 } = {}) {
  const rows = db.prepare(
    `SELECT e.*, c.designation, c.role, c.sort_order FROM crew_entry e
     JOIN crew c ON c.id = e.crew_id
     WHERE 1=1 ${includeHeld ? '' : 'AND e.published = 1'} ${crewId ? 'AND e.crew_id = ?' : ''}
     ORDER BY e.mission_day DESC, c.sort_order LIMIT ?`
  ).all(...(crewId ? [crewId, limit] : [limit]));
  const days = [];
  for (const r of rows) {
    let d = days.find((x) => x.missionDay === r.mission_day);
    if (!d) { d = { missionDay: r.mission_day, entries: [] }; days.push(d); }
    d.entries.push(r);
  }
  return days;
}

/**
 * The crew log as the public sees it now: every day of the run, every
 * officer, the written entry where there is one and its placeholder where
 * there is not — so the shape of the whole log is on the page from the first
 * day, and each slot fills in as it is written. Held entries stay out.
 * Each entry carries `placeholder` (true for a slot not yet written).
 */
function logSlotsPublic(totalDays, dateForDay) {
  const content = require('./content');
  const mediaLib = require('./media');
  const crew = db.prepare('SELECT * FROM crew ORDER BY sort_order, id').all();
  const rows = db.prepare('SELECT * FROM crew_entry').all();
  const media = mediaLib.list();
  const days = [];
  for (let n = 1; n <= totalDays; n++) {
    // media placed in one of the day's reports belongs to that report
    const inNotes = new Set(db.prepare('SELECT body FROM day_note WHERE mission_day = ?').all(n)
      .flatMap((r) => [...String(r.body).matchAll(/\[media:(\d+)\]/g)].map((m) => Number(m[1]))));
    const entries = crew.map((c) => {
      const e = rows.find((r) => r.crew_id === c.id && r.mission_day === n) || null;
      const placeholder = !e || content.isPlaceholder(e.body);
      if (e && !placeholder && e.published !== 1) return null;   // held: not public
      // An entry is public the moment it is written, whatever the day and
      // whether or not the mission has started: the log is the crew's to fill.
      const body = placeholder
        ? content.placeholderPublic(e ? e.body : content.placeholderFor(n, c.designation))
        : e.body;
      return { id: e ? e.id : `p${c.id}-${n}`, crew_id: c.id, designation: c.designation, role: c.role,
        mission_day: n, body, placeholder, written_at: e ? e.written_at : null,
        // what this officer sent out that day travels with the entry
        media: media.filter((m) => m.mission_day === n && m.crew_id === c.id && !inNotes.has(m.id)) };
    }).filter(Boolean);
    days.push({ missionDay: n, date: dateForDay(n), entries,
      written: entries.filter((e) => !e.placeholder).length,
      // media of the day not attributed to an officer
      media: media.filter((m) => m.mission_day === n && !m.crew_id) });
  }
  return days;
}

function entryCounts() {
  const g = (sql, ...a) => db.prepare(sql).get(...a).n;
  return {
    total: g('SELECT COUNT(*) n FROM crew_entry'),
    published: g('SELECT COUNT(*) n FROM crew_entry WHERE published = 1'),
    held: g('SELECT COUNT(*) n FROM crew_entry WHERE published = 0'),
    days: g('SELECT COUNT(DISTINCT mission_day) n FROM crew_entry WHERE published = 1'),
  };
}

const TAGS = ['QUESTION', 'PERSONAL', 'SCIENCE', 'EARTH', 'MARS', 'FOOD',
  'GOVERNANCE', 'GREETING', 'HUMOUR', 'OTHER'];

module.exports = {
  metrics, latest, history, evaluate, sensorPanels, dailyAverages,
  day, crewWithMood, moodHistory, moodSeries,
  entriesForDay, entriesByCrew, entry, logbook, logSlotsPublic, entryCounts,
  settleTransits, published, board, inFlightFor, messagesFor, counts,
  TAGS, STALE_SECONDS,
};
