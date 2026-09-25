'use strict';
require('./lib/env');   // load .env before anything reads process.env
const path = require('path');
const crypto = require('crypto');
const express = require('express');

const { db, now } = require('./db');
const orbital = require('./lib/orbital');
const missionLib = require('./lib/mission');
const data = require('./lib/data');
const callsign = require('./lib/callsign');
const P = require('./views/pages/public');
const { composerBlock } = require('./views/pages/communicate');
const control = require('./routes/control');
const archive = require('./lib/archive');
const recordPdf = require('./lib/record-pdf');
const readingsLog = require('./lib/readings-log');
const { writeZip } = require('./lib/zip');
const content = require('./lib/content');
const critical = require('./lib/critical');
const homeAssistant = require('./lib/home-assistant');
const AR = require('./views/pages/archive');
const GL = require('./views/pages/glance');
const LB = require('./views/pages/logbook');
const mediaLib = require('./lib/media');
const i18n = require('./lib/i18n');

const app = express();
app.set('trust proxy', true);
app.disable('x-powered-by');
app.use(express.urlencoded({ extended: false, limit: '64kb' }));
app.use(express.json({ limit: '256kb' }));
app.use(require('./lib/cookies'));
app.use(express.static(path.join(__dirname, '../public'), { maxAge: '1h' }));

/* --------------------------------------------------------------- geometry
   Recomputed at most once a minute. The planets do not move fast enough to
   justify doing this on every request. */
let geoCache = { at: 0, value: null };
function geometry() {
  if (Date.now() - geoCache.at > 60000) {
    geoCache = { at: Date.now(), value: orbital.geometry(new Date()) };
  }
  return geoCache.value;
}

/** Everything every template needs. */
app.use((req, res, next) => {
  // Memoised: identify() writes a Set-Cookie but cannot see it on the same
  // request, so building the context twice would mint a second visitor.
  let cached = null;
  // Decided here, not inside ctx(): by the time a mounted router calls ctx(),
  // req.path has had its mount prefix stripped and '/control/login' reads as
  // '/login', which used to mint a visitor callsign for mission control.
  const internal = req.path.startsWith('/control');
  // The station's one cookie of its own — the callsign — is set only once the
  // visitor has accepted it (mcs_consent, asked on first contact) or sends a
  // message; until then a page view identifies nobody.
  const consent = req.cookies.mcs_consent === 'yes' ? 'yes' : req.cookies.mcs_consent === 'no' ? 'no' : null;
  req.ctx = () => {
    if (cached) return cached;
    const visitor = internal ? null : callsign.identify(req, res, { create: consent === 'yes', persist: consent === 'yes' });
    const newest = db.prepare('SELECT MAX(recorded_at) m FROM sensor_reading').get().m;
    const commsUp = newest ? (Date.now() - Date.parse(newest)) / 1000 < data.STALE_SECONDS : false;
    // The visitor's language, from the cookie — and T, which puts any
    // interface string into it. Mission control and the archive ignore both.
    const lang = i18n.pick(req);
    cached = {
      theme: req.cookies.mcs_theme === 'dark' ? 'dark' : 'light',
      lang,
      T: i18n.of(lang),
      logo: logo(),
      geo: geometry(),
      mission: missionLib.state(),
      callsign: visitor ? visitor.callsign : null,
      visitor,
      // The callsign offered to a visitor who has none yet — greeted by name on
      // the cookie card, shown in the composer's head and carried in its form,
      // so the name they see is the name they write under. Picked once per page.
      get offer() {
        if (this.visitor) return this.visitor.callsign;
        if (!this._offer) this._offer = callsign.generate();
        return this._offer;
      },
      consent,
      commsUp,
    };
    return cached;
  };
  // The visitor as a writer: the one they are, or one minted now for the
  // message — for the visit only unless they accepted the cookie.
  req.writer = () => {
    const ctx = req.ctx();
    if (!ctx.visitor) {
      ctx.visitor = callsign.identify(req, res, { create: true, persist: consent === 'yes', callsign: req.body && req.body.callsign });
      ctx.callsign = ctx.visitor.callsign;
    }
    return ctx.visitor;
  };
  next();
});

/* The cookie question, answered: yes keeps the callsign (and the theme and
   language) for a year; no keeps nothing beyond the visit and drops whatever
   the browser held. Either answer is itself remembered, so the question is
   asked once. */
app.post('/consent', (req, res) => {
  const yes = req.body.choice === 'yes';
  res.cookie('mcs_consent', yes ? 'yes' : 'no', { httpOnly: true, sameSite: 'lax', maxAge: 365 * 86400000,
    secure: process.env.SECURE_COOKIES === 'true' });
  if (!yes) { res.clearCookie('mcs_id'); res.clearCookie('mcs_theme'); res.clearCookie('mcs_lang'); }
  else {
    // The name the card greeted them with is the name they keep: a visitor who
    // has written already keeps theirs, now for a year; anyone else is given
    // the callsign the card offered (or another, if it was taken meanwhile).
    const v = callsign.identify(req, res, { create: false });
    if (v) callsign.keep(res, v);
    else callsign.identify(req, res, { create: true, persist: true, callsign: req.body.callsign });
  }
  const back = String(req.body.back || '');
  res.redirect(/^\/[^/\\]*$/.test(back) ? back : '/');
});

/**
 * A logo, if one is present. Drop a file called logo.svg, logo.png, logo.jpg or
 * logo.webp into public/ and it appears at the top right of the mission page.
 * Nothing is hard-coded, so the image can be swapped without touching any code.
 */
function findLogo() {
  const dir = path.join(__dirname, '../public');
  for (const name of ['logo.svg', 'logo.png', 'logo.webp', 'logo.jpg', 'logo.jpeg']) {
    if (require('fs').existsSync(path.join(dir, name))) return '/' + name;
  }
  return null;
}
let logoCache = { at: 0, value: null };
function logo() {
  if (Date.now() - logoCache.at > 10000) logoCache = { at: Date.now(), value: findLogo() };
  return logoCache.value;
}

const hashIp = (ip) => crypto.createHash('sha256')
  .update(String(ip) + (process.env.IP_SALT || 'mcs')).digest('hex').slice(0, 32);

/* ============================================================ PUBLIC PAGES */

/* What the mission page and the dashboard page are built from: the crew
   with their latest entries, every day of the run, the day's schedule, the
   readings, the media, the hardware and the cloud folder. Read here once for
   both, so the two pages cannot drift apart. */
function stationData(ctx) {
  // The crew's diary is drafted ahead in content/logbook.json. Days that have
  // not happened yet stay out of public view until they do.
  // The latest entry each officer has written, whatever its day: the log
  // does not wait for the mission clock.
  const crew = data.crewWithMood().map((c) => ({
    ...c, latestEntry: data.entriesByCrew(c.id, { limit: 30 }).find((e) => !content.isPlaceholder(e.body)) || null,
  }));
  // Every day of the run with its three slots — written entries where they
  // exist, placeholders where not — so the log has its full shape from day one.
  const logDays = data.logSlotsPublic(ctx.mission.totalDays, missionLib.dateForDay);
  const allDays = [];
  for (let n = 1; n <= ctx.mission.totalDays; n++) {
    const d = data.day(n);
    allDays.push({
      missionDay: n, date: missionLib.dateForDay(n),
      tasks: d && d.status !== 'DRAFT' ? d.tasks : [],
      meals: d && d.status !== 'DRAFT' ? d.meals : [],
      notes: d && d.status !== 'DRAFT' ? d.notes.filter((n) => n.published_at) : [],
      // End-of-day stores, for the trend rows. Days still ahead carry the
      // planned figures, which the page does not plot.
      inventory: d ? d.inventory : [],
    });
  }
  return {
    sensors: data.sensorPanels(),
    crew,
    allDays,
    logDays,
    entryCounts: { published: logDays.reduce((n, d) => n + d.written, 0), days: logDays.filter((d) => d.written).length },
    today: data.day(ctx.mission.clampedDay),
    counts: data.counts(),
    latestEntries: data.entriesForDay(ctx.mission.clampedDay),
    crewFigures: content.crewFigures(),
    // Power consumed by category, kWh per day, from content/power.json.
    power: content.powerLive(),
    // Daily averages of anything posted to /api/sensors/ingest, for the
    // trend charts, keyed by venue date.
    ingest: data.dailyAverages(40, (d) => missionLib.localDate(d, ctx.mission.timezone)),
    // The newest media out of the habitat, for the Media panel; and a way for
    // an entry to find a picture placed in its text by id.
    media: mediaLib.list({ limit: 12 }), mediaCounts: mediaLib.counts(), mediaLookup: mediaLib.get,
    // The habitat's own hardware, polled through Home Assistant — drawn as a
    // panel of its own below the Habitat panel when the bridge is configured.
    hardware: homeAssistant.snapshot(24),
    // The newest five from the cloud folder, for the Habitat panel; kept
    // live by public/cloud.js on the frequency.
    cloud: (() => { const c = require('./lib/cloud'); return c.configured() ? { title: c.CFG.title, items: c.gallery().slice(0, 6), snapshot: c.snapshot(), limit: 6 } : null; })(),
    // And its daily series for the Trends panel: one value per device per
    // venue day — a gauge's daily mean, a meter's daily added amount.
    hardwareDaily: homeAssistant.daily((d) => missionLib.localDate(d, ctx.mission.timezone)),
  };
}

app.get('/', (req, res) => {
  const ctx = req.ctx();
  if (ctx.mission.phase === 'COMPLETE') {
    return res.send(P.complete(ctx, { counts: data.counts(), recent: data.published(3) }));
  }
  // Two public things exist: this page and mission control. Everything a
  // visitor can read — the board, the crew, the crew log, the whole schedule,
  // the about text — is a section of this page (a phone held upright gets the
  // messages and the dashboard as pages of their own, from the same data).
  res.send(P.mission(ctx, {
    ...stationData(ctx),
    // Published exchanges for everyone; this visitor's own messages as well,
    // whatever state they are in, so a sender can always find what they sent.
    recent: data.board(400, ctx.visitor ? ctx.visitor.id : null),
    inFlight: ctx.visitor ? data.inFlightFor(ctx.visitor.id) : null,
    error: req.query.err ? String(req.query.err).slice(0, 160) : null,
  }));
});

/* The dashboard page: the mission dashboard — the nine panels behind their
   index, the live images, the doors — on a page of its own, for a phone first
   (the bar's Dashboard key leads here). The same pieces as the mission page. */
app.get('/dashboard', (req, res) => {
  const ctx = req.ctx();
  if (ctx.mission.phase === 'COMPLETE') return res.redirect('/');
  res.send(P.dashboardPage(ctx, stationData(ctx)));
});

/* The messages page: the portal — the board and the composer — on a page of
   its own, drawn for a phone first; the bar of keys there leads to it. The
   same data as the mission page's portal, rendered by the same pieces. */
app.get('/messages', (req, res) => {
  const ctx = req.ctx();
  res.send(P.messages(ctx, {
    recent: data.board(400, ctx.visitor ? ctx.visitor.id : null),
    inFlight: ctx.visitor ? data.inFlightFor(ctx.visitor.id) : null,
    error: req.query.err ? String(req.query.err).slice(0, 160) : null,
  }));
});

/* The station has few pages: this one, the messages page, the media page,
   At a Glance, the crew log and mission control. Every other address a
   public subpage used to have points at its section on the landing page,
   so old links, bookmarks and printed material still land somewhere. */
const SECTION = {
  '/habitat': '#habitat', '/crew': '#crew',
  '/day': '#mission', '/schedule': '#mission',
  '/board': '#exchanges', '/communicate': '#write',
  '/what': '#what', '/about': '#about', '/who-we-are': '#who-we-are',
};
for (const [from, to] of Object.entries(SECTION)) {
  app.get(from, (req, res) => res.redirect(301, '/' + to));
}
app.get('/day/:n', (req, res) => res.redirect(301, '/#mission'));

/* The crew log as a page of its own: every day of the run, every officer's
   slot — the entry where it is written, its placeholder where it is not,
   and the media that went with it. Public the moment it is written. */
/* At a Glance: the whole mission, day by day, public. Built from the same
   day records as the archive, shown through the public-safe view. */
app.get('/at-a-glance', (req, res) => {
  const ctx = req.ctx();
  archive.rollupPending();
  const records = Array.from({ length: ctx.mission.totalDays }, (_, i) => archive.dayRecord(i + 1));
  // The external node's day, summarised per channel, so each page of the
  // booklet carries the habitat as it was that day — every channel the node
  // transmits, its own battery and signal strength included.
  const KEYS = ['co2', 'temp', 'hum', 'light', 'pres', 'bat', 'rssi', 'voc', 'iaq'];
  const stmt = db.prepare(`SELECT ${KEYS.map((k) => `MIN(${k}) ${k}_lo, MAX(${k}) ${k}_hi, AVG(${k}) ${k}_av, COUNT(${k}) ${k}_n`).join(', ')}
    FROM external_reading WHERE t >= ? AND t < ?`);
  // And every reading of the day whole — each poll of the node and each
  // batch the station's own devices posted, as data points across the day's
  // 24 hours, so a day's page carries not the summary alone but the data.
  const nodeRows = db.prepare(`SELECT t, ${KEYS.join(', ')} FROM external_reading WHERE t >= ? AND t < ? ORDER BY t`);
  const ingestRows = db.prepare(`SELECT sr.metric, sr.value, sr.recorded_at, sm.label, sm.unit
    FROM sensor_reading sr LEFT JOIN sensor_metric sm ON sm.metric = sr.metric
    WHERE sr.recorded_at >= ? AND sr.recorded_at < ? ORDER BY sm.sort_order, sr.metric, sr.recorded_at`);
  const dayData = (start, end) => {
    const row = stmt.get(start, end) || {};
    const node = KEYS.map((k) => ({ key: k, lo: row[`${k}_lo`], hi: row[`${k}_hi`], av: row[`${k}_av`], n: row[`${k}_n`] || 0 })).filter((x) => x.n > 0);
    // One series per channel: every value the day held, with its instant.
    const series = [];
    const rows = nodeRows.all(start, end);
    for (const k of KEYS) {
      const pts = rows.filter((x) => x[k] != null).map((x) => ({ t: x.t, v: x[k] }));
      if (pts.length) series.push({ key: k, points: pts });
    }
    for (const x of ingestRows.all(new Date(start).toISOString(), new Date(end).toISOString())) {
      const t = Date.parse(x.recorded_at);
      if (!Number.isFinite(t)) continue;
      let s = series.find((y) => y.key === 'ingest-' + x.metric);
      if (!s) { s = { key: 'ingest-' + x.metric, label: x.label || x.metric, unit: x.unit || '', points: [] }; series.push(s); }
      s.points.push({ t, v: x.value });
    }
    return { node, series };
  };
  for (const r of records) {
    const w = archive.windowFor(r.missionDay);
    const start = Date.parse(w.start);
    Object.assign(r, { dayStart: start }, dayData(start, Date.parse(w.end)));
  }
  // Before the run, the booklet opens on a rehearsal page — a complete day
  // page, so the real feel of a filled one can be had weeks early: today's
  // pulled readings for the habitat, the opening day's plan for the
  // schedule, meals, consumption and power, whatever the crew have already
  // written into SOL 001 (blogs, exchanges, media), and any states filed
  // today. Clearly marked, not part of the record, gone on 15 October.
  let rehearsal = null;
  if (ctx.mission.phase === 'PRE_LAUNCH') {
    const start = missionLib.venueMidnightUtc(ctx.mission.today, ctx.mission.timezone);
    const end = start + 86400000;
    const todayMoods = db.prepare(
      `SELECT cm.*, c.designation FROM crew_mood cm JOIN crew c ON c.id = cm.crew_id
       WHERE cm.effective_at >= ? AND cm.effective_at < ? AND cm.set_by != 'content' ORDER BY cm.effective_at`
    ).all(new Date(start).toISOString(), new Date(end).toISOString());
    const base = records[0] || {};
    rehearsal = { ...base, date: ctx.mission.today, dayStart: start, ...dayData(start, end),
      moods: todayMoods.length ? todayMoods : base.moods || [] };
  }
  res.send(GL.page(ctx, { records, rehearsal }));
});

// The imprint, on the station: ZKM's legal details in German and English.
app.get('/imprint', (req, res) => res.send(require('./views/pages/imprint').imprintPage(req.ctx())));

app.get('/logbook', (req, res) => {
  const ctx = req.ctx();
  // All thirteen days, each with its three blogs: the written post, or the
  // placeholder that shows where one will go.
  const days = data.logSlotsPublic(ctx.mission.totalDays, missionLib.dateForDay);
  const counts = { published: days.reduce((n, d) => n + d.written, 0), days: days.filter((d) => d.written).length,
    slots: days.reduce((n, d) => n + d.entries.length, 0) };
  res.send(LB.logPage(ctx, { days, crew: data.crewWithMood(), counts, blogs: data.BLOGS, mediaLookup: mediaLib.get }));
});

/**
 * The archive holds the whole record — every day, every crew state, every
 * exchange, and the download of all of it. It is mission control's, not the
 * public's, so everything under /archive requires the control session.
 */
function requireControl(req, res, next) {
  if (!control.currentUser(req)) return res.redirect('/control/login?next=archive');
  next();
}

app.get('/archive', requireControl, (req, res) => {
  const ctx = req.ctx();
  archive.rollupPending();
  res.send(AR.contents(ctx, {
    days: archive.index(),
    counts: data.counts(),
    entryCounts: data.entryCounts(),
    // before the run: today's rehearsal page, so the shape can be seen
    rehearsal: archive.rehearsalRecord(ctx.mission),
  }));
});

/* Today. Before the run this is the rehearsal page — a day's record built
   for today, marked as not the record, gone on the first day of the run.
   During the run "today" is simply the current mission day, so the address
   goes there; after the run, to the last day. */
const todayTarget = (req, suffix = '') => {
  const st = req.ctx().mission;
  return st.phase === 'PRE_LAUNCH' ? null : `/archive/day/${archive.recordedUpTo(st)}${suffix}`;
};
app.get('/archive/today', requireControl, (req, res) => {
  const to = todayTarget(req);
  if (to) return res.redirect(to);
  res.send(AR.dayRecord(req.ctx(), { record: archive.rehearsalRecord(req.ctx().mission), hasPrev: false, hasNext: false }));
});
app.get('/archive/today/export.md', requireControl, (req, res) => {
  const to = todayTarget(req, '/export.md');
  if (to) return res.redirect(to);
  res.type('text/markdown; charset=utf-8')
     .attachment(`mars-station-today-rehearsal-${new Date().toISOString().slice(0, 10)}.md`)
     .send(archive.rehearsalMarkdown());
});
app.get('/archive/today/export.pdf', requireControl, (req, res, next) => {
  const to = todayTarget(req, '/export.pdf');
  if (to) return res.redirect(to);
  try {
    const buf = recordPdf.todayRecord();
    if (!buf) return next();
    res.type('application/pdf')
       .attachment(`mars-station-today-rehearsal-${new Date().toISOString().slice(0, 10)}.pdf`)
       .send(buf);
  } catch (e) { next(e); }
});

/* A day's record exists once the day has happened. A day ahead has no
   record — not the plan dressed as one — so its addresses do not exist yet. */
const recordedDay = (req) => {
  const n = Number(req.params.n);
  return Number.isInteger(n) && n >= 1 && n <= archive.recordedUpTo(req.ctx().mission) ? n : null;
};

app.get('/archive/day/:n', requireControl, (req, res, next) => {
  const ctx = req.ctx();
  const n = recordedDay(req);
  if (!n) return next();
  res.send(AR.dayRecord(ctx, {
    record: archive.dayRecord(n),
    hasPrev: n > 1,
    hasNext: n < archive.recordedUpTo(ctx.mission),
  }));
});

/** The whole mission as one file. No account, no admin: the record is public. */
/** The record as readable Markdown — the format that outlives the software. */
app.get('/archive/export.md', requireControl, (req, res) => {
  res.type('text/markdown; charset=utf-8')
     .attachment(`mars-station-record-${new Date().toISOString().slice(0, 10)}.md`)
     .send(archive.fullMarkdown());
});

app.get('/archive/day/:n/export.md', requireControl, (req, res, next) => {
  const n = recordedDay(req);
  if (!n) return next();
  res.type('text/markdown; charset=utf-8')
     .attachment(`mars-station-day-${String(n).padStart(3, '0')}.md`)
     .send(archive.dayMarkdown(n));
});

/**
 * The full record as one PDF: for every day that has happened, what was
 * entered and what was measured — every exchange, every blog entry with its
 * photographs in place, the schedule as run, the meals, the stores as
 * counted, the power and figures as filed, the states filed, the daily
 * sensor summary, the complete correspondence and the media index with
 * hashes — the form the record is handed over in. No chart, no projection,
 * nothing generated. Composed here without a browser or an image library
 * (src/lib/pdf.js).
 */
app.get('/archive/export.pdf', requireControl, (req, res, next) => {
  try {
    const buf = recordPdf.fullRecord();
    res.type('application/pdf')
       .attachment(`mars-station-record-${new Date().toISOString().slice(0, 10)}.pdf`)
       .send(buf);
  } catch (e) { next(e); }
});

app.get('/archive/day/:n/export.pdf', requireControl, (req, res, next) => {
  const n = recordedDay(req);
  if (!n) return next();
  try {
    const buf = recordPdf.dayRecord(n);
    if (!buf) return next();
    res.type('application/pdf')
       .attachment(`mars-station-day-${String(n).padStart(3, '0')}.pdf`)
       .send(buf);
  } catch (e) { next(e); }
});

/* The readings log — every reading ever pulled, one JSON file per pull — as
   one ZIP, and as a listing. See src/lib/readings-log.js. */
app.get('/archive/readings.zip', requireControl, (req, res) => {
  const st = req.ctx().mission;
  readingsLog.sendZip(res, { writeZip, mission: { name: st.name, start: st.start_date, end: st.end_date, timezone: st.timezone } });
});
/* The same log as flat tables: one CSV per source, built from the files on
   request. Also inside the ZIP under csv/. */
app.get('/archive/readings/:name.csv', requireControl, (req, res, next) => {
  const body = readingsLog.csv(req.params.name);
  if (body === null) return next();
  res.type('text/csv; charset=utf-8')
     .set('Cache-Control', 'no-store')
     .attachment(`mars-station-readings-${req.params.name}-${new Date().toISOString().slice(0, 10)}.csv`)
     .send(body);
});
app.get('/archive/readings.json', requireControl, (req, res) => {
  res.json({ counts: readingsLog.counts(), files: readingsLog.list().map((f) => ({ path: f.name, source: f.source, day: f.day, bytes: f.size, writtenAt: f.mtime.toISOString() })) });
});

app.get('/archive/export.json', requireControl, (req, res) => {
  archive.rollupPending();
  res.attachment(`mars-station-${new Date().toISOString().slice(0, 10)}.json`)
     .json(archive.fullExport());
});

app.get('/archive/messages', requireControl, (req, res) => {
  const filters = {
    tag: req.query.tag || '', day: req.query.day || '',
    callsign: (req.query.callsign || '').toUpperCase(),
  };
  const all = data.published(500, filters);
  const tally = {};
  for (const m of data.published(1000)) {
    for (const t of (m.tags || '').split(',').filter(Boolean)) tally[t] = (tally[t] || 0) + 1;
  }
  const tags = Object.entries(tally).map(([tag, n]) => ({ tag, n })).sort((a, b) => b.n - a.n);
  res.send(P.archive(req.ctx(), {
    messages: all, filters,
    stats: { tags, max: Math.max(1, ...tags.map((t) => t.n)) },
  }));
});

app.get('/archive/message/:id', requireControl, (req, res, next) => {
  data.settleTransits();
  const m = db.prepare(
    `SELECT m.*, r.body AS response_body, r.published_at AS response_at, c.designation AS responder
     FROM message m LEFT JOIN response r ON r.message_id = m.id
     LEFT JOIN crew c ON c.id = r.crew_id
     WHERE m.id = ? AND m.state = 'PUBLISHED'`
  ).get(Number(req.params.id));
  if (!m) return next();
  res.send(P.single(req.ctx(), { message: m }));
});

/* =========================================================== COMMUNICATION */

const MAX_CHARS = Number(process.env.MESSAGE_MAX_CHARS || 500);
const TRANSIT_MS = Number(process.env.TRANSIT_SECONDS || 12) * 1000;

/** Errors bounce back to the landing page, which is where the composer lives. */
/**
 * The composer answers two ways. A plain form post is answered with a
 * redirect back to the page, as before. A post from composer.js (marked
 * X-Requested-With: fetch) is answered with the composer fragment alone —
 * the dial if the message left, the form with its error if it did not — and
 * the script swaps it into the device in place, so sending a message never
 * reloads or scrolls the page.
 */
const isLive = (req) => req.get('x-requested-with') === 'fetch';

function composerFragment(req, res, extra = {}) {
  const ctx = req.ctx();
  const inFlight = ctx.visitor ? data.inFlightFor(ctx.visitor.id) : null;
  res.set('Cache-Control', 'no-store').type('html')
    .send(composerBlock(ctx, { inFlight, error: extra.error || null, draft: extra.draft || '' }));
}

function composeView(req, res, extra = {}) {
  if (isLive(req)) return composerFragment(req, res, extra);
  const q = extra.error ? `?err=${encodeURIComponent(extra.error)}` : '';
  // a plain post from the messages page goes back to the messages page
  const back = /\/messages(?:[?#]|$)/.test(req.get('referer') || '') ? '/messages' : '/';
  res.redirect(`${back}${q}#write`);
}

/* The composer as it stands for this visitor — what a reload would show.
   composer.js asks for it when the crossing ends. */
app.get('/api/composer', (req, res) => composerFragment(req, res));

/**
 * The board, live. board.js polls this every few seconds and swaps the cards
 * into the page, so an exchange published from mission control reaches every
 * open phone in the room without a reload. It is rendered by the same
 * function as the page, for the same visitor (their own unpublished messages
 * included, nobody else's), so what arrives is exactly what a reload would
 * have shown. A version stamp lets the browser skip the swap when nothing
 * has changed.
 */
app.get('/api/board', (req, res) => {
  const ctx = req.ctx();
  const recent = data.board(400, ctx.visitor ? ctx.visitor.id : null);
  const counts = data.counts();
  res.set('Cache-Control', 'no-store').json({
    version: P.boardVersion(recent),
    phase: ctx.mission.phase,
    cards: P.boardCards(recent, ctx.T),
    count: recent.length,
    pendingMine: recent.filter((m) => m.mine && m.pending).length,
    total: counts.total,
    published: counts.published,
  });
});

app.post('/communicate', (req, res) => {
  const ctx = req.ctx();
  const visitor = req.writer();

  // Enforced server-side so a closed channel cannot be walked around by
  // posting the form directly. After the run it is always shut.
  const holdBefore = process.env.HOLD_CHANNEL_BEFORE_LAUNCH === 'true';
  if (ctx.mission.phase === 'COMPLETE') return composeView(req, res);
  if (ctx.mission.phase === 'PRE_LAUNCH' && holdBefore) return composeView(req, res);

  // The transit lock is enforced here, not in the browser.
  if (data.inFlightFor(visitor.id)) return composeView(req, res);

  const body = String(req.body.body || '').trim().replace(/\s+\n/g, '\n');
  if (body.length < 2) {
    return composeView(req, res, { error: 'Write something before transmitting.', draft: body });
  }
  if (body.length > MAX_CHARS) {
    return composeView(req, res, { error: `${ctx.T('Messages are limited to')} ${MAX_CHARS} ${ctx.T('characters.')}`, draft: body.slice(0, MAX_CHARS) });
  }

  // Rate limit by visitor and by IP hash: the cookie alone is trivially cleared.
  const since = new Date(Date.now() - 3600000).toISOString();
  const ip = hashIp(req.ip);
  const recent = db.prepare(
    'SELECT COUNT(*) n FROM message WHERE (visitor_id = ? OR ip_hash = ?) AND submitted_at > ?'
  ).get(visitor.id, ip, since).n;
  if (recent >= Number(process.env.HOURLY_LIMIT || 6)) {
    return composeView(req, res, { error: 'The uplink is saturated from your position. Try again later.', draft: body });
  }

  let tags = req.body.tags || [];
  if (!Array.isArray(tags)) tags = [tags];
  tags = tags.filter((t) => data.TAGS.includes(t)).slice(0, 3);

  const geo = geometry();
  const submitted = new Date();
  const arrival = new Date(submitted.getTime() + TRANSIT_MS);

  db.prepare(
    `INSERT INTO message (visitor_id, callsign, body, tags, state, mission_day,
        submitted_at, arrival_at, light_seconds, distance_au, ip_hash)
     VALUES (?, ?, ?, ?, 'IN_TRANSIT', ?, ?, ?, ?, ?, ?)`
  ).run(visitor.id, visitor.callsign, body, tags.join(','),
        ctx.mission.phase === 'PRE_LAUNCH' ? 0 : ctx.mission.clampedDay,
        submitted.toISOString(), arrival.toISOString(), geo.lightSeconds, geo.distanceAu, ip);

  if (isLive(req)) return composerFragment(req, res);
  res.redirect('/#write');
});

/* ================================================================ SENSOR API */

function ingestAuth(req, res, next) {
  const token = (req.get('authorization') || '').replace(/^Bearer\s+/i, '');
  if (!process.env.SENSOR_TOKEN || token !== process.env.SENSOR_TOKEN) {
    return res.status(401).json({ error: 'device token rejected' });
  }
  next();
}

app.post('/api/sensors/ingest', ingestAuth, (req, res) => {
  // The record closed with the run: after the end of 27 October 2026 no
  // reading is stored, whoever sends it. (CRITICAL_FREEZE_AT moves the
  // instant for a rehearsal — see src/lib/critical.js.)
  if (critical.frozen()) {
    return res.status(410).json({ error: 'the record closed on 27 October 2026 — readings are no longer accepted' });
  }
  const { deviceId, readings } = req.body || {};
  if (!deviceId || !Array.isArray(readings)) {
    return res.status(400).json({ error: 'expected { deviceId, readings: [{metric, value, unit}] }' });
  }
  const insert = db.prepare(
    'INSERT INTO sensor_reading (device_id, metric, value, unit, recorded_at) VALUES (?, ?, ?, ?, ?)'
  );
  // Unknown metrics are accepted and registered, so a new sensor can be added
  // in the venue without redeploying the station.
  const register = db.prepare(
    `INSERT OR IGNORE INTO sensor_metric (metric, label, unit, channel, sort_order, visible)
     VALUES (?, ?, ?, ?, 99, 1)`
  );
  let stored = 0;
  const tx = db.transaction((rows) => {
    for (const r of rows) {
      const metric = String(r.metric || '').toLowerCase().slice(0, 40);
      const value = Number(r.value);
      if (!metric || !Number.isFinite(value) || Math.abs(value) > 1e6) continue;
      register.run(metric, metric.replace(/_/g, ' ').toUpperCase(), String(r.unit || ''), 'CH-??');
      insert.run(String(deviceId).slice(0, 40), metric, value, String(r.unit || ''),
                 r.recordedAt || now());
      stored++;
    }
  });
  tx(readings);
  readingsLog.record('ingest', { deviceId: String(deviceId).slice(0, 40), received: readings.length, stored,
    readings: readings.map((r) => ({ metric: r.metric, value: r.value, unit: r.unit, recordedAt: r.recordedAt || null })) });
  res.json({ ok: true, stored });
});

app.get('/api/sensors/latest', (req, res) => {
  res.json(data.sensorPanels().map((p) => ({
    metric: p.metric.metric, label: p.metric.label, unit: p.metric.unit,
    value: p.status.value, status: p.status.label,
    recordedAt: p.reading ? p.reading.recorded_at : null,
  })));
});

app.get('/api/sensors/history', (req, res) => {
  const metric = String(req.query.metric || '');
  res.json(data.history(metric, Number(req.query.hours || 24), 500));
});

/* What the crew are currently doing: today's schedule, for the ticker's
   hourly refresh. Public, tiny, no identifiers. */
app.get('/api/ticker', (req, res) => {
  const st = req.ctx().mission;
  const today = st.phase === 'ACTIVE' ? data.day(st.clampedDay) : null;
  res.json({
    sol: st.clampedDay, totalDays: st.totalDays, phase: st.phase, venueTime: st.venueTime,
    opensAt: st.opensAt, epoch: content.resetEpoch(),
    tasks: today ? today.tasks.map((t) => ({ time: t.time, label: t.label, detail: t.detail || '' })) : [],
  });
});

/* The figures in the habitat dome's callouts — what the crew are doing, the
   latest exchange, their condition, the stores, the day's power — as the
   landing page's dome refreshes them. Same function as renders the page. */
app.get('/api/dome', (req, res) => {
  const ctx = req.ctx();
  res.set('Cache-Control', 'no-store');
  res.json(require('./views/pages/dome').figures(ctx, {
    today: data.day(ctx.mission.clampedDay),
    crew: data.crewWithMood(),
    recent: data.published(20),
    power: content.powerLive(),
    counts: data.counts(),
    crewFigures: content.crewFigures(),
  }));
});

app.get('/api/orbital', (req, res) => {
  const g = geometry();
  res.json({
    at: g.at, distanceAu: g.distanceAu, distanceKm: g.distanceKm,
    lightSeconds: g.lightSeconds, trend: g.trend,
    earth: { lonDeg: g.earth.lonDeg }, mars: { lonDeg: g.mars.lonDeg },
  });
});

app.get('/api/status', (req, res) => {
  const m = missionLib.state();
  res.json({ missionDay: m.missionDay, phase: m.phase, elapsed: m.elapsed, counts: data.counts() });
});

/* The theme and language switches keep their choice in a cookie — for a year
   once the visitor has accepted the station's cookies, for the visit only
   until then. */
const keep = (req) => (req.cookies.mcs_consent === 'yes' ? 365 * 86400000 : undefined);
app.post('/theme', (req, res) => {
  const to = req.body.to === 'dark' ? 'dark' : 'light';
  res.cookie('mcs_theme', to, { httpOnly: false, sameSite: 'lax', maxAge: keep(req),
    secure: process.env.SECURE_COOKIES === 'true' });
  res.redirect(req.get('referer') || '/');
});

/* The language switch: the same shape as the theme — a cookie, a redirect
   back to where the visitor was. Anything but de/en/fr falls back to English. */
app.post('/lang', (req, res) => {
  const to = i18n.LANGS.includes(req.body.to) ? req.body.to : 'en';
  res.cookie('mcs_lang', to, { httpOnly: false, sameSite: 'lax', maxAge: keep(req),
    secure: process.env.SECURE_COOKIES === 'true' });
  res.redirect(req.get('referer') || '/');
});

/* The stores' daily use — every item on every day of the run — as one CSV.
   The same table is written to content/resource-log.csv on every load. */
app.get('/resources/log.csv', (req, res) => {
  res.type('text/csv; charset=utf-8')
     .attachment(`mars-station-resources-${new Date().toISOString().slice(0, 10)}.csv`)
     .send(content.resourceLogCsv());
});
app.get('/resources/log.json', (req, res) => res.json(content.resourceLogRows()));

app.get('/api/content', (req, res) => {
  const s = content.status();
  res.status(s.ok ? 200 : 500).json(s);
});

/* The habitat's readings — from the habitat sensor through Home Assistant,
   or from the external node (src/lib/critical.js) — served station-local so
   visitors' phones never need CORS proxies. The server polls and stores;
   this endpoint hands the browser everything it needs to draw. */
app.get('/api/habitat/data', (req, res) => {
  const days = Math.min(365, Math.max(1, Number(req.query.days || 30)));
  res.json(critical.snapshot(days));
});

/* The habitat's own hardware, read through Home Assistant. The server polls
   and stores (src/lib/home-assistant.js); the browser reads this — rendered
   panel HTML plus a change mark, the same pattern as /api/board — so the
   token and the Home Assistant address never leave the server. */
app.get('/api/hardware', (req, res) => {
  const snap = homeAssistant.snapshot(24);
  res.set('Cache-Control', 'no-store').json({
    version: homeAssistant.version(snap),
    frozen: snap.frozen,
    pollMs: snap.pollMs,
    html: snap.configured && snap.sensors.length ? P.hardwareInner(snap, req.ctx().T) : '',
    // the power tile, whose metered category moves with the readings
    power: P.powerTileInner(req.ctx(), content.powerLive()),
  });
});

/* The cloud gallery's state — is the bridge on, how many images, when it
   last answered, what went wrong. No credentials, no paths beyond the folder. */
app.get('/api/cloud', (req, res) => {
  const cloud = require('./lib/cloud');
  const snap = cloud.snapshot();
  // the grid itself, rendered for the visitor's language, so the media page
  // can swap it in the moment the folder changes — the same pattern as the board
  const M = require('./views/pages/media');
  const model = { title: cloud.CFG.title, items: cloud.gallery(), snapshot: snap, limit: 6 };
  const opts = { tz: req.ctx().mission.timezone };      // for a file whose name carries no time: its own date, in the venue's time
  const html = snap.configured ? M.cloudGridInner(req.ctx().T, model, opts) : '';
  const latestHtml = snap.configured ? M.cloudLatestInner(req.ctx().T, model, opts) : '';
  res.set('Cache-Control', 'no-store').json({ ...snap, html, latestHtml });
});

/* The habitat hardware's last 24 hours as plain JSON — every stored reading
   per device and the hourly points — for any outside tool that wants the
   numbers rather than the panel. `?hours=` reaches back
   further, up to a week. */
app.get('/api/hardware/readings', (req, res) => {
  const hours = Math.min(168, Math.max(1, Number(req.query.hours || 24)));
  res.set('Cache-Control', 'no-store').json(homeAssistant.readings(hours));
});

app.get('/healthz', (req, res) => res.type('text').send('ok'));

/* ===================================================================== MEDIA */

app.use('/media', require('./routes/media'));

/* =================================================================== CONTROL */

app.use('/control', control);

/* ===================================================================== 404 */

app.use((req, res) => {
  const ctx = req.ctx();
  const T = ctx.T;
  res.status(404).send(require('./views/layout').page({
    title: 'No such channel', ctx, current: '',
    body: `<div style="padding:60px 0"><div class="eyebrow">404</div>
      <h1>${T('No such channel')}</h1>
      <p class="lede">${T('Nothing is transmitting on this address.')}</p>
      <p><a class="btn" href="/">${T('Return to mission')}</a></p></div>`,
  }));
});

/* Every cookie-less page view mints a callsign, so crawlers leave rows behind.
   Visitors who never transmitted and have not been seen for a week are dropped.
   Anyone who sent a message is kept: the archive references their callsign. */
function pruneVisitors() {
  // After the record closes (end of 27 October 2026) nothing is changed by
  // automation any more — stale callsigns included: the rows stay as the run
  // left them. Only expired control sessions are still swept.
  if (critical.frozen()) {
    db.prepare('DELETE FROM admin_session WHERE expires_at < ?').run(now());
    return;
  }
  const cutoff = new Date(Date.now() - 7 * 86400000).toISOString();
  const r = db.prepare(
    `DELETE FROM visitor WHERE last_seen < ?
       AND id NOT IN (SELECT DISTINCT visitor_id FROM message)`
  ).run(cutoff);
  db.prepare('DELETE FROM admin_session WHERE expires_at < ?').run(now());
  if (r.changes) console.log(`[MCS] pruned ${r.changes} unused callsigns`);
}
setInterval(pruneVisitors, 3600000).unref();
pruneVisitors();

/* Seal each mission day into the permanent record shortly after it ends.
   Once the record has closed (end of 27 October 2026) and every day of the
   run carries its seal, this is the last automated writer left — so it shuts
   itself down: the one write it still makes after the close is the final
   day's seal, the closing of the book, and then nothing writes again. */
let rollupTimer = setInterval(rollupTick, 15 * 60000);
rollupTimer.unref();
function rollupTick() {
  try {
    archive.rollupPending();
    if (critical.frozen() && rollupTimer) {
      const days = missionLib.state().totalDays;
      const sealed = db.prepare('SELECT COUNT(*) n FROM day_seal').get().n;
      if (sealed >= days) {
        clearInterval(rollupTimer); rollupTimer = null;
        console.log('[MCS] the record is closed and every day is sealed — automation has ended');
      }
    }
  } catch (e) { console.error('[MCS] rollup', e.message); }
}
rollupTick();

/* The run's dates are fixed in src/lib/run.js, not in .env and not in
   whenever the database happened to be seeded. Bring the mission row into
   line first, so the content files are read against the real length. */
try { missionLib.sync(); } catch (e) { console.error('[MCS] mission sync', e.message); }

/* The plan — the files as they should be on 15 October — is kept in
   content/plan/ so mission control can reset to it after a rehearsal. It is
   made from the shipped files on first boot, and a content file that has
   gone missing is put back from it, before the files are read. */
content.ensurePlan();
/* The readings log remembers its last snapshots, so a restart does not
   write the same stores and figures again. */
readingsLog.primeDedupe();
/* The editable files in content/ are the source of truth for day content.
   Load them at boot and watch for edits so a save shows up on the site. */
content.load();
if (process.env.WATCH_CONTENT !== 'false') content.watch();

/* Poll the external habitat sensor feed on its own transmit cycle. */
if (process.env.CRITICAL_POLL !== 'false') critical.start(); else critical.applyBuild(critical.buildStamp());

/* Poll the habitat's own hardware through Home Assistant (src/lib/home-assistant.js).
   Off until HA_HOST and HA_API_TOKEN are set in .env; HA_POLL=false holds it off. */
if (process.env.HA_POLL !== 'false') homeAssistant.start();
if (process.env.CLOUD_POLL !== 'false') require('./lib/cloud').start();

const PORT = Number(process.env.PORT || 8080);
// Which address to listen on. 0.0.0.0 (every address) is right inside a
// container with its own network. With network_mode: host — the container
// sharing the server's network, so it can reach an SSH tunnel on the server's
// localhost — set LISTEN_HOST=127.0.0.1 so the station is only reachable from
// the server itself (the reverse proxy in front of it), as before.
const LISTEN_HOST = (process.env.LISTEN_HOST || '0.0.0.0').trim();
const server = app.listen(PORT, LISTEN_HOST, () => {
  const m = missionLib.state();
  const g = geometry();
  console.log(`[MCS] station listening on ${LISTEN_HOST}:${PORT}`);
  console.log(`[MCS] mission day ${m.missionDay}/${m.totalDays} (${m.phase})`);
  console.log(`[MCS] Earth-Mars ${g.distanceAu.toFixed(3)} au, one way ${orbital.formatLightTime(g.lightSeconds)}`);
});
// A film out of the habitat can be gigabytes over venue Wi-Fi, and so can the
// ZIP of the whole run going the other way. Node's default five-minute cap on
// a request would cut both off; time is not the limit here, MEDIA_MAX_MB is.
server.requestTimeout = 0;
server.headersTimeout = 65000;
server.timeout = 0;
