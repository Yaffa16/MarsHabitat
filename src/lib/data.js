'use strict';
const { db } = require('../db');
const mission = require('./mission');
const mood = require('./mood');

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

/* ---- the meals' slots: Breakfast, Lunch and Dinner, then the meals added on the desk (EXTRA1, EXTRA2, …), then Other
   (RATION, the slot older files used) */
const FIXED_SLOTS = ['BREAKFAST', 'LUNCH', 'DINNER'];
const isExtraSlot = (slot) => /^EXTRA\d+$/.test(String(slot || ''));
const extraIndex = (slot) => (isExtraSlot(slot) ? Number(String(slot).slice(5)) : 0);
/** Where a slot stands in the day: the three named meals in their order, the added meals after them in theirs. */
function slotOrder(slot) {
  const i = FIXED_SLOTS.indexOf(slot);
  return i >= 0 ? i : isExtraSlot(slot) ? 10 + extraIndex(slot) : 1000;
}
/** How a slot is named: { label, n } — 'Breakfast'; 'Extra meal' with n = 2 for the second added meal ("Extra meal 2");
 *  'Other' for RATION. The views translate the label and append the number. */
function slotParts(slot) {
  const s = String(slot || '').toUpperCase();
  if (FIXED_SLOTS.includes(s)) return { label: s[0] + s.slice(1).toLowerCase(), n: null };
  if (isExtraSlot(s)) return { label: 'Extra meal', n: extraIndex(s) > 1 ? extraIndex(s) : null };
  if (s === 'RATION') return { label: 'Other', n: null };
  return { label: s ? s[0] + s.slice(1).toLowerCase() : '', n: null };
}
/** The slot's name in English — "Breakfast", "Extra meal 2", "Other" — for the record and the desk. */
function slotLabel(slot) { const p = slotParts(slot); return p.n ? `${p.label} ${p.n}` : p.label; }

/**
 * A day's meals, in the day's order, each with the power it drew — the
 * kitchen's energy meter read between the meal's hours (src/lib/home-assistant.js,
 * mealPower): breakfast 06:00–09:00, lunch 09:00–14:00, dinner 15:00–22:00. A
 * meal added on the desk (EXTRA1, EXTRA2, …) has no hours of its own: it
 * COUNTS WITH the named meal whose hours cover the time it is served at
 * (`served`, "16:30" — the time it was added, unless the desk says another;
 * home-assistant.js, slotForTime) and shows that meal's window and reading.
 *
 * On each meal: `window` the hours read (['15:00', '22:00'], null for a meal
 * with no hours and no time), `power_wh` the meter's figure for them (null
 * while the meter has none inside them), `power_running` that the hours are
 * still going now (the figure is so far), `power_with` the named slot an
 * added meal counts with ('DINNER'), and `energy_wh` — the figure that is
 * summed for the day and the trends: the meter's, on the one meal that carries
 * each window (the named meal; the first added meal of a window with no named
 * meal), the file's `energy` where the meter has none, and null on an added
 * meal that counts with another (`energy_source` 'meter', 'filed', 'none' or
 * 'with'). `powerDay` reads the meter for another mission day than the meals'
 * — the dashboard before the run shows the first day's plan with today's
 * kitchen (day 0, NOW, is today).
 */
function mealsFor(missionDay, { powerDay = null } = {}) {
  const rows = db.prepare('SELECT * FROM meal WHERE mission_day = ?').all(missionDay).map(mealRow)
    .sort((a, b) => slotOrder(a.slot) - slotOrder(b.slot) || a.id - b.id);
  let ha = null;
  try { ha = require('./home-assistant'); } catch { ha = null; }
  const readDay = powerDay == null ? missionDay : powerDay;
  // the three windows, read once each — an added meal may count with a window whose named meal is not planned
  const windows = {};
  for (const slot of FIXED_SLOTS) windows[slot] = ha ? ha.mealPower(readDay, slot) : { wh: null, window: null, running: false };
  const carried = new Set(rows.filter((m) => FIXED_SLOTS.includes(m.slot)).map((m) => m.slot));   // windows whose figure a named meal carries
  return rows.map((m) => {
    const fixed = FIXED_SLOTS.includes(m.slot);
    const at = fixed ? null : (ha ? ha.parseTime(m.served) : null);
    const withSlot = fixed ? m.slot : (at && ha ? ha.slotForTime(at) : null);
    const p = withSlot ? windows[withSlot] : null;
    const metered = !!(p && p.wh != null);
    // the one meal of a window that carries its watt hours into the sums: the named meal, else the first added one
    let carries = fixed;
    if (!fixed && withSlot && !carried.has(withSlot)) { carried.add(withSlot); carries = true; }
    const energy = carries ? (metered ? p.wh : (m.energy_wh || 0)) : null;
    return {
      ...m, served: m.served || '',
      served_at: at,
      window: p ? p.window : null,
      power_wh: metered ? p.wh : null,
      power_running: !!(p && p.running),
      power_with: fixed ? null : withSlot,
      energy_wh: energy,
      energy_source: !carries ? 'with' : metered ? 'meter' : m.energy_wh ? 'filed' : 'none',
    };
  });
}

function day(missionDay, { powerDay = null } = {}) {
  const d = db.prepare('SELECT * FROM day WHERE mission_day = ?').get(missionDay);
  if (!d) return null;
  d.tasks = db.prepare('SELECT * FROM task WHERE mission_day = ? ORDER BY sort_order, time').all(missionDay);
  d.meals = mealsFor(missionDay, { powerDay });
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
  // From the recipe book: null when no meal of the day carries the figure,
  // so a day without recipes says nothing rather than "0 kg".
  const sumOf = (get) => { const v = d.meals.map(get).filter((x) => x != null); return v.length ? v.reduce((a, b) => a + b, 0) : null; };
  d.co2ePlanned = sumOf((m) => m.co2e_kg);
  d.waterFootprintPlanned = sumOf((m) => m.water_footprint_l);
  d.nutrientsPlanned = null;
  for (const m of d.meals) {
    if (!m.nutrients) continue;
    d.nutrientsPlanned = d.nutrientsPlanned || {};
    for (const [k, v] of Object.entries(m.nutrients)) d.nutrientsPlanned[k] = (d.nutrientsPlanned[k] || 0) + v;
  }
  return d;
}

/** A meal row as the views want it: the nutrients as an object (or null). */
function mealRow(m) {
  let nutrients = null;
  if (m && m.nutrients) { try { nutrients = JSON.parse(m.nutrients); } catch { nutrients = null; } }
  return { ...m, nutrients: nutrients && Object.keys(nutrients).length ? nutrients : null };
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

/** The record of an officer's states: every one a person filed (the mid-scale state the content loader gives a new
 *  officer, set_by 'content', was filed by nobody and is not part of it), the newest first, each with the venue's day
 *  and time, the sol and the word for it. Mission control shows it under the officer's state; the same rows, for every
 *  officer and oldest first, go out as CSV (moodRecordAll). */
function moodRecord(crewId, limit = 1000) {
  return db.prepare(
    "SELECT * FROM crew_mood WHERE crew_id = ? AND set_by != 'content' ORDER BY effective_at DESC, id DESC LIMIT ?"
  ).all(crewId, limit).map(dressMood);
}
function moodRecordAll() {
  return db.prepare(
    `SELECT cm.*, c.designation, c.role FROM crew_mood cm JOIN crew c ON c.id = cm.crew_id
     WHERE cm.set_by != 'content' ORDER BY cm.effective_at, cm.id`
  ).all().map(dressMood);
}
function dressMood(row) {
  const m = mission.config(), tz = (m && m.timezone) || 'Europe/Berlin', at = new Date(row.effective_at);
  const ok = !Number.isNaN(at.getTime());
  const date = ok ? mission.localDate(at, tz) : '';
  const sol = ok && m && m.start_date ? mission.daysBetween(m.start_date, date) + 1 : null;
  return { ...row, date, time: ok ? mission.localTime(at, tz).slice(0, 5) : '', sol,
    condition: mood.condition(row), text: mood.translate(row).lines[0] || '' };
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
/** What the board holds: the viewer's own messages, every one whatever its state, and the newest `limit` exchanges the
 *  crew have answered (published) — the site's board shows the last nine (BOARD_RECENT), the installation's screen as
 *  many as fit. The viewer's own come first; boardCards (public.js) heads them MY MESSAGES. */
function board(limit = 9, visitorId = null) {
  settleTransits();
  const SELECT = `SELECT m.*, r.body AS response_body, r.published_at AS response_at, c.designation AS responder,
            s.launched_at, s.remote_id AS space_id
     FROM message m
     LEFT JOIN response r ON r.message_id = m.id
     LEFT JOIN crew c ON c.id = r.crew_id
     LEFT JOIN space_relay s ON s.message_id = m.id AND s.state = 'SENT'`;
  const vid = visitorId == null ? -1 : visitorId;
  const mine = vid < 0 ? [] : db.prepare(`${SELECT} WHERE m.visitor_id = ? ORDER BY m.submitted_at DESC LIMIT 100`).all(vid);
  const rest = db.prepare(`${SELECT} WHERE m.state = 'PUBLISHED' AND m.visitor_id != ? ORDER BY m.submitted_at DESC LIMIT ?`).all(vid, limit);
  return mine.concat(rest).map((m) => ({
    ...m,
    mine: vid >= 0 && m.visitor_id === vid,
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
 * The three blogs, as the public sees them now: every day of the run with
 * its three slots — the Commander Blog (the commanding officer's entry),
 * the Daily Mission Report and the Health Report (the science and
 * health officers' reports, SCIENCE and HEALTH notes) — the written post where
 * there is one and a placeholder where there is not, so the shape of the
 * whole log is on the page from the first day and each slot fills in as it is
 * written. Held entries stay out. Each slot carries `blog` (its key),
 * `title`, and `placeholder` (true for a slot not yet written).
 */
const BLOGS = [
  { key: 'commander', title: 'Commander Blog' },
  { key: 'science', title: 'Daily Mission Report', kind: 'SCIENCE' },
  { key: 'health', title: 'Health Report', kind: 'HEALTH' },
];
function logSlotsPublic(totalDays, dateForDay, { from = 1 } = {}) {
  const content = require('./content');
  const mediaLib = require('./media');
  const commander = db.prepare('SELECT * FROM crew WHERE designation = ?').get(content.BLOG_OFFICER)
    || db.prepare('SELECT * FROM crew ORDER BY sort_order, id').get();
  const rows = commander ? db.prepare('SELECT * FROM crew_entry WHERE crew_id = ?').all(commander.id) : [];
  const media = mediaLib.list();
  const days = [];
  for (let n = from; n <= totalDays; n++) {
    const notes = db.prepare('SELECT * FROM day_note WHERE mission_day = ? AND published_at IS NOT NULL ORDER BY posted_at').all(n);
    // media placed in one of the day's reports belongs to that report
    const inNotes = new Set(notes.flatMap((r) => [...String(r.body).matchAll(/\[media:(\d+)\]/g)].map((m) => Number(m[1]))));
    const dd = n === 0 ? 'NOW' : `Day ${String(n).padStart(3, '0')}`;   // day 0 is NOW, the rehearsal day
    const entries = [];
    for (const b of BLOGS) {
      if (b.key === 'commander') {
        if (!commander) continue;
        const e = rows.find((r) => r.mission_day === n) || null;
        const placeholder = !e || content.isPlaceholder(e.body);
        if (e && !placeholder && e.published !== 1) continue;   // held: not public
        entries.push({ id: e ? e.id : `p${commander.id}-${n}`, blog: b.key, title: b.title, crew_id: commander.id,
          designation: commander.designation, role: commander.role, mission_day: n,
          body: placeholder ? content.placeholderPublic(e ? e.body : content.placeholderFor(n, commander.designation)) : e.body,
          placeholder, written_at: e ? e.written_at : null,
          // what the commander sent out that day travels with the post
          media: media.filter((m) => m.mission_day === n && m.crew_id === commander.id && !inNotes.has(m.id)) });
      } else {
        const body = notes.filter((x) => x.kind === b.kind).map((x) => x.body).join('\n\n').trim();
        entries.push({ id: `${b.key}-${n}`, blog: b.key, title: b.title, crew_id: null, designation: '', role: '',
          mission_day: n, body: body || `${dd} · ${b.title} — to be written at the end of this day.`,
          placeholder: !body, written_at: null, media: [] });
      }
    }
    days.push({ missionDay: n, date: dateForDay(n), entries,
      written: entries.filter((e) => !e.placeholder).length,
      // media of the day not carried by a post: unattributed, or an officer's
      media: media.filter((m) => m.mission_day === n && !inNotes.has(m.id) && (!commander || m.crew_id !== commander.id)) });
  }
  return days;
}
/** One day's three slots the same way — for NOW (day 0), the rehearsal day before the run. */
function logSlotsFor(n, dateForDay) {
  return logSlotsPublic(n, dateForDay, { from: n })[0] || null;
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

/**
 * What happened on each mission day, as counts: messages that came in from
 * Earth, exchanges the crew answered and published, media the crew sent out.
 * Keyed by mission day. Rejected traffic counts as a message that came in —
 * it did — but not as an exchange.
 */
function dailyActivity() {
  const out = {};
  const bump = (n, k, v) => { (out[n] = out[n] || { messages: 0, exchanges: 0, media: 0 })[k] = v; };
  for (const r of db.prepare('SELECT mission_day n, COUNT(*) c FROM message GROUP BY mission_day').all()) bump(r.n, 'messages', r.c);
  for (const r of db.prepare("SELECT mission_day n, COUNT(*) c FROM message WHERE state = 'PUBLISHED' GROUP BY mission_day").all()) bump(r.n, 'exchanges', r.c);
  for (const r of db.prepare('SELECT mission_day n, COUNT(*) c FROM media WHERE hidden = 0 GROUP BY mission_day').all()) bump(r.n, 'media', r.c);
  return out;
}

const TAGS = ['QUESTION', 'PERSONAL', 'HUMOUR', 'SCIENCE', 'HABITAT'];

module.exports = {
  metrics, latest, history, evaluate, sensorPanels, dailyAverages,
  day, mealRow, mealsFor, FIXED_SLOTS, isExtraSlot, extraIndex, slotOrder, slotParts, slotLabel, crewWithMood, moodHistory, moodRecord, moodRecordAll, moodSeries,
  entriesForDay, entriesByCrew, entry, logbook, logSlotsPublic, logSlotsFor, BLOGS, entryCounts,
  settleTransits, published, board, inFlightFor, messagesFor, counts, dailyActivity,
  TAGS, STALE_SECONDS,
};
