'use strict';
const { db } = require('../db');

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
  };
}

/** Calendar date for a given mission day, as YYYY-MM-DD. */
function dateForDay(missionDay) {
  const m = config();
  const t = Date.parse(m.start_date + 'T00:00:00Z') + (missionDay - 1) * 86400000;
  return new Date(t).toISOString().slice(0, 10);
}

module.exports = { config, state, dateForDay, localDate, localTime, daysBetween,
                   venueMidnightUtc, zoneOffsetMs };
