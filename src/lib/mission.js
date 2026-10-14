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

/* One formatter per zone and shape, built once and kept. Building an Intl.DateTimeFormat is the costly part (a fifth of
   a millisecond, and its memory slow to come back), and the Trends series call localDate for every stored reading — a
   week of the habitat's hardware is some 150 000 of them, which took a page 20 seconds and gigabytes before (8 October).
   Reused, a call costs microseconds. */
const FORMATTERS = new Map();
function formatter(locale, opts) {
  const key = locale + '|' + JSON.stringify(opts);
  let f = FORMATTERS.get(key);
  if (!f) { f = new Intl.DateTimeFormat(locale, opts); FORMATTERS.set(key, f); }
  return f;
}

/** YYYY-MM-DD for `date` as seen in the venue timezone. */
function localDate(date, tz) {
  return formatter('en-CA', {
    timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit',
  }).format(date);
}

/** HH:MM:SS in the venue timezone. */
function localTime(date, tz) {
  return formatter('en-GB', {
    timeZone: tz, hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false,
  }).format(date);
}

function daysBetween(a, b) {
  return Math.round((Date.parse(b + 'T00:00:00Z') - Date.parse(a + 'T00:00:00Z')) / 86400000);
}

/** Offset of `tz` from UTC, in ms, at a given instant. Handles DST. */
function zoneOffsetMs(instant, tz) {
  const p = formatter('en-US', {
    timeZone: tz, hour12: false,
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit',
  }).formatToParts(instant).reduce((o, x) => (o[x.type] = x.value, o), {});
  const asUtc = Date.UTC(+p.year, +p.month - 1, +p.day,
    p.hour === '24' ? 0 : +p.hour, +p.minute, +p.second);
  return asUtc - instant.getTime();
}

/**
 * The zone the venue's clock keeps at an instant, as the pages name it beside a time (13 October: "for most places on
 * the website where time is shown, intelligently add CEST and change to CET when daylight savings shifts"): CEST while
 * summer time holds, CET from the last Sunday of October at 03:00 — 25 October 2026, in the run — each time by its own
 * moment, so a message sent on the 24th says CEST and one sent on the 26th CET, whatever the day it is read; the same
 * letters in every language. A zone outside Central Europe keeps the clock's own short name.
 */
const CENTRAL = /^(Europe\/(Berlin|Amsterdam|Brussels|Paris|Luxembourg|Zurich|Vienna|Rome|Madrid|Prague|Copenhagen|Oslo|Stockholm|Warsaw|Budapest)|CET)$/;
function zoneAbbr(instant, tz) {
  const at = instant instanceof Date ? instant : new Date(instant);
  if (Number.isNaN(at.getTime())) return '';
  const zone = tz || (config() || {}).timezone || run.RUN.TZ;
  if (CENTRAL.test(zone)) { const off = Math.round(zoneOffsetMs(at, zone) / 60000); return off === 120 ? 'CEST' : off === 60 ? 'CET' : ''; }
  try { return (formatter('en-GB', { timeZone: zone, timeZoneName: 'short' }).formatToParts(at).find((x) => x.type === 'timeZoneName') || {}).value || ''; }
  catch { return ''; }
}
/** The zone of a wall-clock time on a date at the venue: the schedule's 08:30 on 25 October is CET, its 01:30 CEST. */
function zoneOfWall(dateStr, hhmm, tz) {
  const zone = tz || (config() || {}).timezone || run.RUN.TZ;
  try { return zoneAbbr(new Date(venueTimeUtc(dateStr, hhmm, zone)), zone); } catch { return ''; }
}
/** An instant as the venue's clock reads it, with the zone: "17:54 CEST". */
function clockAt(instant, tz) {
  const at = instant instanceof Date ? instant : new Date(instant);
  if (Number.isNaN(at.getTime())) return '';
  const zone = tz || (config() || {}).timezone || run.RUN.TZ;
  return `${localTime(at, zone).slice(0, 5)} ${zoneAbbr(at, zone)}`.trim();
}

/**
 * The exact UTC instant of 00:00 venue-local on a given date. This is what the
 * T-clock counts from. Anchoring to UTC midnight instead would put the
 * countdown two hours out of step with the door opening -- and Berlin leaves
 * summer time on 25 October, so a fixed offset would drift mid-run too.
 */
function venueMidnightUtc(dateStr, tz) {
  return venueTimeUtc(dateStr, '00:00', tz);
}

/**
 * The UTC instant of a wall-clock time at the venue on a date — "06:00" on
 * 2026-10-25 is 05:00Z that day (clocks went back at 03:00), 04:00Z the day
 * before. The meal hours (src/lib/home-assistant.js) are read this way, so
 * breakfast begins at six on the habitat's clock on both sides of the change.
 */
function venueTimeUtc(dateStr, hhmm, tz) {
  const m = /^(\d{1,2}):(\d{2})$/.exec(String(hhmm || '00:00'));
  const hh = m ? String(Math.min(24, +m[1])).padStart(2, '0') : '00', mm = m ? m[2] : '00';
  // 24:00 is the end of the day: midnight of the day after
  const guess = hh === '24' ? Date.parse(dateStr + 'T00:00:00Z') + 86400000 : Date.parse(`${dateStr}T${hh}:${mm}:00Z`);
  let t = guess - zoneOffsetMs(new Date(guess), tz);
  // One correction pass resolves the case where the first guess lands on the
  // far side of a DST boundary.
  t = guess - zoneOffsetMs(new Date(t), tz);
  return t;
}

/* NOW, the rehearsal day, ends for good — on the desk, on the public pages, in the record — once the reset has been
   pressed (content.js, reset: pressed in the days before the run, so the station opens clean) and once the run itself
   has begun on 15 October, whatever dates this station runs on (13 October: "when it is Oct 15th or I click the reset
   button, remove the NOW from everywhere — control page, main page, everything"). Until then it is there before the
   run, and all through a rehearsal against made-up dates. The reset's mark is kept in the station's settings
   (now_retired, the moment it was pressed); the run's first day is run.js's — a rehearsal may move it on
   (REHEARSAL_NOW_UNTIL, with MISSION_OVERRIDE only: the test suite keeps NOW at hand with it after the real run has
   begun). */
db.exec('CREATE TABLE IF NOT EXISTS setting (key TEXT PRIMARY KEY, value TEXT NOT NULL)');
const NOW_RETIRED = 'now_retired';
/** When the reset retired NOW — an ISO instant — or null while it has not been pressed. */
function nowRetired() {
  try { const r = db.prepare('SELECT value FROM setting WHERE key = ?').get(NOW_RETIRED); return r ? r.value : null; } catch { return null; }
}
/** The reset's mark: NOW is gone from here on (content.js, reset). */
function retireNow(at = new Date().toISOString()) {
  db.prepare('INSERT OR REPLACE INTO setting (key, value) VALUES (?, ?)').run(NOW_RETIRED, at);
  zeroMemo = { at: 0, word: 'before the run' };                  // (zeroName, below: asked afresh)
}
/** The first day without NOW: the run's own first day — or, in a rehearsal, the day REHEARSAL_NOW_UNTIL names. */
function nowEnds() {
  const later = process.env.REHEARSAL_NOW_UNTIL;
  return run.dates().override && /^\d{4}-\d{2}-\d{2}$/.test(later || '') ? later : run.RUN.START;
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

  // The performance closes at 10:00 on the run's last day — 27 October 2026 (14 October: "the performance closes on the
  // 27th at 10am"): from then on the crew are out (`ended`). That afternoon the habitat is open to visitors, 15:00 to
  // 17:00 (run.js, OPEN_HOUSE); the last day has no mission and no blogs (`lastDay`) — and otherwise reads as every
  // other day, the landing page's invitation apart (14 October, 13:11).
  const endsMs = venueTimeUtc(m.end_date, run.RUN.COME_OUT, m.timezone);
  // The channel and the desk close at the end of that last day — at midnight on 27 October 2026 (14 October: "stop
  // everything from midnight on the 27th instead of the 28th"; until then they stayed open through the day after the
  // run): the last messages come in until midnight, and from 28 October the station is read-only (no message is taken,
  // mission control takes no edit; the archive and every download keep serving). A rehearsal against made-up dates
  // closes at the end of its own last day.
  const closeDate = m.end_date;
  const closeMs = venueMidnightUtc(new Date(Date.parse(m.end_date + 'T00:00:00Z') + 86400000).toISOString().slice(0, 10), m.timezone);

  // NOW (above): before the run, or all through a rehearsal against made-up dates — never once the reset has been
  // pressed, and never from the run's first day on
  const retired = nowRetired();
  const nowOn = !retired && localDate(date, run.RUN.TZ) < nowEnds() && (phase === 'PRE_LAUNCH' || run.dates().override);

  return {
    ...m,
    missionDay: day,
    clampedDay: Math.min(Math.max(day, 1), total),
    totalDays: total,
    phase,
    // NOW — mission day 0 — is the rehearsal day: everything mission control files under NOW (blogs, reports, the
    // Habitat tab, media) stays apart from the run's days, and the record shows it marked as a rehearsal. It is there
    // before the run, and all through a rehearsal against made-up dates (MISSION_OVERRIDE, src/lib/run.js) — never
    // during the real run, and never after the reset (nowRetired, above). nowPre: NOW on the public pages, which show
    // it before the run only. workDay is the day the desk opens on and the day today's content is filed under: NOW
    // before the run, the current sol during it, the last sol after — and SOL 01 before the run once NOW is gone.
    nowDay: nowOn,
    nowPre: nowOn && phase === 'PRE_LAUNCH',
    nowRetired: retired,
    workDay: phase === 'PRE_LAUNCH' && nowOn ? 0 : Math.min(Math.max(day, 1), total),
    today,
    venueTime: localTime(date, m.timezone),
    elapsed,
    // Everything the pre-launch and post-mission screens need
    countdown: { days: dd, hours: h, minutes: mi, seconds: s, ms: Math.abs(elapsedMs) },
    opensAt: new Date(launchMs).toISOString(),
    // the performance's close, 10:00 on the last day, and whether it is behind us (above); the last day itself, the
    // closing day — 27 October: no mission, no blogs, no schedule, the habitat open to visitors in the afternoon
    endsAt: new Date(endsMs).toISOString(), ended: date.getTime() >= endsMs,
    lastDay: phase === 'ACTIVE' && day === total,
    // the days with blogs: every day of the run but the last
    blogDays: Math.max(1, total - 1),
    // the channel and the desk: open until the end of the run's last day (closeDate), closed from then on
    open: date.getTime() < closeMs,
    closeDate, closeLabel: dayLabel(closeDate), closedAt: new Date(closeMs).toISOString(),
    daysUntilStart: elapsedMs < 0 ? dd + (h || mi || s ? 1 : 0) : 0,
    progress: total > 0 ? Math.min(1, Math.max(0, (day - 1) / total)) : 0,
    // "Thu 15 – Tue 27 Oct 2026", for wherever the run is named
    runLabel: runLabel(m.start_date, m.end_date),
    runLabelLong: runLabel(m.start_date, m.end_date, { long: true }),
    startLabel: dayLabel(m.start_date), endLabel: dayLabel(m.end_date),
  };
}

/* The days in the page's language (13 October: the dates on a German or French page were written in English — "Sat 10 –
   Thu 22 Oct 2026" on the landing page, "13 Oct · 17:54" on every note): German and French by their own calendars
   ("Do., 15. – Di., 27. Okt. 2026", "jeu. 15 – mar. 27 oct. 2026"), English as it always was. */
const DAY_LOCALE = { de: 'de-DE', fr: 'fr-FR' };
const local = (iso, lang, opts) => formatter(DAY_LOCALE[lang], { timeZone: 'UTC', ...opts }).format(new Date(iso + 'T12:00:00Z'));

/** The run, written the way it goes on a poster: "Thu 15 – Tue 27 Oct 2026" (`lang`: de, fr — in theirs). */
function runLabel(start, end, { long = false, lang = 'en' } = {}) {
  if (DAY_LOCALE[lang]) {
    const a0 = new Date(start + 'T12:00:00Z'), b0 = new Date(end + 'T12:00:00Z');
    const same = a0.getUTCMonth() === b0.getUTCMonth() && a0.getUTCFullYear() === b0.getUTCFullYear();
    const wd = long ? 'long' : 'short', mo = long ? 'long' : 'short';
    return `${local(start, lang, same ? { weekday: wd, day: 'numeric' } : { weekday: wd, day: 'numeric', month: mo })} – ${local(end, lang, { weekday: wd, day: 'numeric', month: mo, year: 'numeric' })}`;
  }
  const fmt = (iso, withMonth) => {
    const d = new Date(iso + 'T12:00:00Z');
    const wd = d.toLocaleDateString('en-GB', { weekday: long ? 'long' : 'short', timeZone: 'UTC' });
    return `${wd} ${d.getUTCDate()}${withMonth ? ' ' + d.toLocaleDateString('en-GB', { month: long ? 'long' : 'short', timeZone: 'UTC' }) : ''}`;
  };
  const a = new Date(start + 'T12:00:00Z'), b = new Date(end + 'T12:00:00Z');
  const sameMonth = a.getUTCMonth() === b.getUTCMonth() && a.getUTCFullYear() === b.getUTCFullYear();
  return `${fmt(start, !sameMonth)} – ${fmt(end, true)} ${b.getUTCFullYear()}`;
}

/** One date the same way: "Thu 15 Oct 2026" (`lang`: de, fr — "Do., 15. Okt. 2026", "jeu. 15 oct. 2026"). */
function dayLabel(iso, lang = 'en') {
  if (DAY_LOCALE[lang]) return local(iso, lang, { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' });
  const d = new Date(iso + 'T12:00:00Z');
  return d.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' }).replace(',', '');
}

/** The short form for rails and cards, no year: "Thu 15 Oct" (`lang`: de, fr — "Do., 15. Okt.", "jeu. 15 oct."). */
function shortDay(iso, lang = 'en') {
  if (DAY_LOCALE[lang]) return local(iso, lang, { weekday: 'short', day: 'numeric', month: 'short' });
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
  touchNow();                                                    // and NOW, the rehearsal day, dated today
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

/** Calendar date for a given mission day, as YYYY-MM-DD — for NOW (day 0), today's date at the venue. */
function dateForDay(missionDay) {
  const m = config();
  if (Number(missionDay) === 0) return localDate(new Date(), m.timezone);
  const t = Date.parse(m.start_date + 'T00:00:00Z') + (missionDay - 1) * 86400000;
  return new Date(t).toISOString().slice(0, 10);
}

/** "NOW" for day 0 — "before the run" once NOW is gone (a message that came in before the run is day 0 too) — and
    "day 006" otherwise, wherever a day is named on the desk or in the record. */
function dayName(missionDay, { pad = 3, word = 'day' } = {}) {
  return Number(missionDay) === 0 ? zeroName() : `${word} ${String(missionDay).padStart(pad, '0')}`;
}
/** What day 0 is called: NOW while the rehearsal day is there, "before the run" once it has gone (state().nowDay) —
    asked once a second at most, since a list of messages asks it of every one. */
let zeroMemo = { at: 0, word: 'NOW' };
function zeroName() {
  const t = Date.now();
  if (t - zeroMemo.at > 1000) zeroMemo = { at: t, word: state().nowDay ? 'NOW' : 'before the run' };
  return zeroMemo.word;
}

/**
 * The day row of NOW (mission day 0), dated today: made at start and kept
 * dated by the archive's tick, so what the desk files under NOW hangs on a
 * day like everything else (tasks, meals and notes refer to a day row).
 */
function touchNow() {
  const m = config();
  if (!m) return;
  const date = localDate(new Date(), m.timezone);
  const row = db.prepare('SELECT date FROM day WHERE mission_day = 0').get();
  if (!row) {
    db.prepare("INSERT INTO day (mission_day, date, status, updated_at, updated_by) VALUES (0, ?, 'READY', ?, 'mission')")
      .run(date, new Date().toISOString());
  } else if (row.date !== date) {
    db.prepare('UPDATE day SET date = ? WHERE mission_day = 0').run(date);
  }
}

module.exports = { config, state, dateForDay, dayName, zeroName, touchNow, localDate, localTime, daysBetween, runLabel, dayLabel, shortDay, sync, zoneAbbr, zoneOfWall, clockAt,
                   venueMidnightUtc, venueTimeUtc, zoneOffsetMs, nowRetired, retireNow, nowEnds };
