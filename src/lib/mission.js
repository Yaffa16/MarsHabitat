'use strict';
const { db } = require('../db');
const run = require('./run');

/**
 * The mission day is derived from the venue's timezone, never the visitor's.
 * A visitor in Auckland must see the same mission day as the performers in
 * the habitat, otherwise the daily content desynchronises from the piece.
 */
function config() {
  return db.prepare('SELECT * FROM mission WHERE id = 1').get();
}

/** YYYY-MM-DD for `date` as seen in the venue timezone. */
function localDate(date, tz) {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit',
  }).format(date);
}

/** HH:MM:SS in the venue timezone. */
function localTime(date, tz) {
  return new Intl.DateTimeFormat('en-GB', {
    timeZone: tz, hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false,
  }).format(date);
}

function daysBetween(a, b) {
  return Math.round((Date.parse(b + 'T00:00:00Z') - Date.parse(a + 'T00:00:00Z')) / 86400000);
}

/** Offset of `tz` from UTC, in ms, at a given instant. Handles DST. */
function zoneOffsetMs(instant, tz) {
  const p = new Intl.DateTimeFormat('en-US', {
    timeZone: tz, hour12: false,
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit',
  }).formatToParts(instant).reduce((o, x) => (o[x.type] = x.value, o), {});
  const asUtc = Date.UTC(+p.year, +p.month - 1, +p.day,
    p.hour === '24' ? 0 : +p.hour, +p.minute, +p.second);
  return asUtc - instant.getTime();
}

/**
 * The exact UTC instant of 00:00 venue-local on a given date. This is what the
 * T-clock counts from. Anchoring to UTC midnight instead would put the
 * countdown two hours out of step with the door opening -- and Berlin leaves
 * summer time on 25 October, so a fixed offset would drift mid-run too.
 */
function venueMidnightUtc(dateStr, tz) {
  const guess = Date.parse(dateStr + 'T00:00:00Z');
  let t = guess - zoneOffsetMs(new Date(guess), tz);
  // One correction pass resolves the case where the first guess lands on the
  // far side of a DST boundary.
  t = guess - zoneOffsetMs(new Date(t), tz);
  return t;
}

function state(date = new Date()) {
  const m = config();
  const today = localDate(date, m.timezone);
  const day = daysBetween(m.start_date, today) + 1;
  const total = daysBetween(m.start_date, m.end_date) + 1;

  let phase = 'ACTIVE';
  if (day < 1) phase = 'PRE_LAUNCH';
  else if (day > total) phase = 'COMPLETE';

  // T± elapsed clock, counted from 00:00 venue-local on the start date.
  // Before launch this is a countdown; spaceflight convention counts elapsed
  // days, so mission day 1 reads T+000 rather than T+001.
  const launchMs = venueMidnightUtc(m.start_date, m.timezone);
  const elapsedMs = date.getTime() - launchMs;
  const abs = Math.abs(elapsedMs);
  const p = (n, w = 2) => String(n).padStart(w, '0');

  let elapsed;
  if (elapsedMs < 0) {
    // Counting down to the launch instant.
    elapsed = `T−${p(Math.floor(abs / 86400000), 3)}:${p(Math.floor(abs / 3600000) % 24)}` +
              `:${p(Math.floor(abs / 60000) % 60)}:${p(Math.floor(abs / 1000) % 60)}`;
  } else {
    // Counting up. The day count comes from the mission day and the time from
    // the venue wall clock, so the hour Berlin gains on 25 October cannot push
    // the T-clock a day out of step with the schedule the crew are following.
    const [hh, mm, ss] = localTime(date, m.timezone).split(':');
    elapsed = `T+${p(Math.max(0, day - 1), 3)}:${hh}:${mm}:${ss}`;
  }
  const dd = Math.floor(abs / 86400000);
  const h = Math.floor(abs / 3600000) % 24;
  const mi = Math.floor(abs / 60000) % 60;
  const s = Math.floor(abs / 1000) % 60;

  return {
    ...m,
    missionDay: day,
    clampedDay: Math.min(Math.max(day, 1), total),
    totalDays: total,
    phase,
    today,
    venueTime: localTime(date, m.timezone),
    elapsed,
    // Everything the pre-launch and post-mission screens need
    countdown: { days: dd, hours: h, minutes: mi, seconds: s, ms: Math.abs(elapsedMs) },
    opensAt: new Date(launchMs).toISOString(),
    closesAt: new Date(venueMidnightUtc(m.end_date, m.timezone) + 86399000).toISOString(),
    daysUntilStart: elapsedMs < 0 ? dd + (h || mi || s ? 1 : 0) : 0,
    progress: total > 0 ? Math.min(1, Math.max(0, (day - 1) / total)) : 0,
    // "Thu 15 – Tue 27 Oct 2026", for wherever the run is named
    runLabel: runLabel(m.start_date, m.end_date),
    runLabelLong: runLabel(m.start_date, m.end_date, { long: true }),
    startLabel: dayLabel(m.start_date), endLabel: dayLabel(m.end_date),
  };
}

/** The run, written the way it goes on a poster: "Thu 15 – Tue 27 Oct 2026". */
function runLabel(start, end, { long = false } = {}) {
  const fmt = (iso, withMonth) => {
    const d = new Date(iso + 'T12:00:00Z');
    const wd = d.toLocaleDateString('en-GB', { weekday: long ? 'long' : 'short', timeZone: 'UTC' });
    return `${wd} ${d.getUTCDate()}${withMonth ? ' ' + d.toLocaleDateString('en-GB', { month: long ? 'long' : 'short', timeZone: 'UTC' }) : ''}`;
  };
  const a = new Date(start + 'T12:00:00Z'), b = new Date(end + 'T12:00:00Z');
  const sameMonth = a.getUTCMonth() === b.getUTCMonth() && a.getUTCFullYear() === b.getUTCFullYear();
  return `${fmt(start, !sameMonth)} – ${fmt(end, true)} ${b.getUTCFullYear()}`;
}

/** One date the same way: "Thu 15 Oct 2026". */
function dayLabel(iso) {
  const d = new Date(iso + 'T12:00:00Z');
  return d.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' }).replace(',', '');
}

/** The short form for rails and cards, no year: "Thu 15 Oct". */
function shortDay(iso) {
  const d = new Date(iso + 'T12:00:00Z');
  return d.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short', timeZone: 'UTC' }).replace(',', '');
}

/**
 * The run's dates are fixed in src/lib/run.js — Thu 15 to Tue 27 October
 * 2026, thirteen days. A database seeded for an earlier plan (a nine-day
 * run, say) would otherwise keep its old dates for ever, because the seed
 * only runs once — and then every content file written for the real run is
 * refused as "beyond the mission". So at every start the mission row is
 * brought into line with the run, and a day row is made for every day of it.
 * A rehearsal against made-up dates needs MISSION_OVERRIDE=true (see run.js).
 * Returns what changed, or null when nothing did.
 */
function sync() {
  const want = run.dates();
  const target = { start_date: want.start, end_date: want.end, timezone: want.tz, name: want.name };
  const m = config();
  if (!m) {
    db.prepare(`INSERT INTO mission (id, name, start_date, end_date, timezone, status) VALUES (1, ?, ?, ?, ?, 'NOMINAL')`)
      .run(target.name, target.start_date, target.end_date, target.timezone);
  }
  const cur = config();
  const changed = {};
  for (const k of ['start_date', 'end_date', 'timezone', 'name']) {
    if (target[k] && target[k] !== cur[k]) changed[k] = target[k];
  }
  if (Object.keys(changed).length) {
    const sets = Object.keys(changed).map((k) => `${k} = ?`).join(', ');
    db.prepare(`UPDATE mission SET ${sets} WHERE id = 1`).run(...Object.values(changed));
  }
  // A day row for every day of the run, dated from the start; none beyond it.
  const after = config();
  const total = daysBetween(after.start_date, after.end_date) + 1;
  let added = 0;
  for (let n = 1; n <= total; n++) {
    const date = dateForDay(n);
    const row = db.prepare('SELECT date FROM day WHERE mission_day = ?').get(n);
    if (!row) {
      db.prepare("INSERT INTO day (mission_day, date, status, updated_at, updated_by) VALUES (?, ?, 'DRAFT', ?, 'mission')")
        .run(n, date, new Date().toISOString());
      added++;
    } else if (row.date !== date) {
      db.prepare('UPDATE day SET date = ? WHERE mission_day = ?').run(date, n);
    }
  }
  const label = `${after.start_date} → ${after.end_date} (${total} days, ${after.timezone})`;
  if (want.override) console.log(`[mission] REHEARSAL — MISSION_OVERRIDE is set: ${label}`);
  else console.log(`[mission] the run: ${runLabel(after.start_date, after.end_date)} — ${label}`);
  if (want.ignored) {
    console.warn(`[mission] MISSION_START/MISSION_END in the environment (${want.ignored.start || '—'} → ${want.ignored.end || '—'}) are IGNORED — ` +
      'the run is fixed in src/lib/run.js. Set MISSION_OVERRIDE=true for a rehearsal against other dates.');
  }
  if (Object.keys(changed).length || added) {
    console.log(`[mission] database brought into line` +
      (Object.keys(changed).length ? ` — updated: ${Object.keys(changed).join(', ')}` : '') +
      (added ? ` — ${added} day rows added` : ''));
    return { changed, added, total };
  }
  return null;
}

/** Calendar date for a given mission day, as YYYY-MM-DD. */
function dateForDay(missionDay) {
  const m = config();
  const t = Date.parse(m.start_date + 'T00:00:00Z') + (missionDay - 1) * 86400000;
  return new Date(t).toISOString().slice(0, 10);
}

module.exports = { config, state, dateForDay, localDate, localTime, daysBetween, runLabel, dayLabel, shortDay, sync,
                   venueMidnightUtc, zoneOffsetMs };
