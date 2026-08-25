'use strict';
/**
 * The run. These are the dates of the performance and they are a fact of the
 * piece, not a setting: MARS runs from Thursday 15 to Tuesday 27 October 2026,
 * thirteen days, at ZKM in Karlsruhe, on Berlin time.
 *
 * They live here, in code, rather than in .env, so that a stale line in a
 * configuration file on some machine can never shorten the mission. An old
 * .env that still says MISSION_START=2026-10-19 is ignored.
 *
 * The one exception is a rehearsal: to run the station against a made-up
 * mission (the test suite does this, and so can a run-through in the weeks
 * before), set MISSION_OVERRIDE=true together with MISSION_START and
 * MISSION_END. Without MISSION_OVERRIDE those two variables do nothing, and
 * the server says so in its log at start.
 */
const RUN = Object.freeze({
  START: '2026-10-15',
  END: '2026-10-27',
  TZ: 'Europe/Berlin',
  NAME: 'MARS — HABITAT ONE',
  DAYS: 13,
});

const ISO = /^\d{4}-\d{2}-\d{2}$/;

/** The dates this process runs with: the run, or an explicit rehearsal override. */
function dates() {
  const override = /^(1|true|yes)$/i.test(String(process.env.MISSION_OVERRIDE || ''));
  const s = process.env.MISSION_START, e = process.env.MISSION_END;
  if (override && ISO.test(s || '') && ISO.test(e || '') && e >= s) {
    return { start: s, end: e, tz: process.env.MISSION_TZ || RUN.TZ, name: process.env.MISSION_NAME || RUN.NAME, override: true };
  }
  return {
    start: RUN.START, end: RUN.END, tz: RUN.TZ, name: process.env.MISSION_NAME || RUN.NAME, override: false,
    // A stale or stray date in the environment is worth a line in the log.
    ignored: (s && s !== RUN.START) || (e && e !== RUN.END) ? { start: s, end: e } : null,
  };
}

function totalDays(start, end) {
  return Math.round((Date.parse(end + 'T00:00:00Z') - Date.parse(start + 'T00:00:00Z')) / 86400000) + 1;
}

module.exports = { RUN, dates, totalDays };
