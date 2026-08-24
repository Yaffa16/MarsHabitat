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
const C = require('./views/pages/communicate');
const I = require('./views/pages/info');
const control = require('./routes/control');
const logbook = require('./routes/logbook');
const archive = require('./lib/archive');
const content = require('./lib/content');
const critical = require('./lib/critical');
const AR = require('./views/pages/archive');
const MS = require('./views/pages/messages');
const LB = require('./views/pages/logbook');

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
  req.ctx = () => {
    if (cached) return cached;
    const internal = req.path.startsWith('/control') || req.path.startsWith('/log');
    const visitor = internal ? null : callsign.identify(req, res);
    const newest = db.prepare('SELECT MAX(recorded_at) m FROM sensor_reading').get().m;
    const commsUp = newest ? (Date.now() - Date.parse(newest)) / 1000 < data.STALE_SECONDS : false;
    cached = {
      theme: req.cookies.mcs_theme === 'dark' ? 'dark' : 'light',
      logo: logo(),
      geo: geometry(),
      mission: missionLib.state(),
      callsign: visitor ? visitor.callsign : null,
      visitor,
      commsUp,
    };
    return cached;
  };
  next();
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

app.get('/', (req, res) => {
  const ctx = req.ctx();
  if (ctx.mission.phase === 'COMPLETE') {
    return res.send(P.complete(ctx, { counts: data.counts(), recent: data.published(3) }));
  }
  res.send(P.mission(ctx, {
    sensors: data.sensorPanels(),
    crew: data.crewWithMood(),
    today: data.day(ctx.mission.clampedDay),
    counts: data.counts(),
    // Published exchanges for everyone; this visitor's own messages as well,
    // whatever state they are in, so a sender can always find what they sent.
    recent: data.board(400, ctx.visitor ? ctx.visitor.id : null),
    latestEntries: data.entriesForDay(ctx.mission.clampedDay),
    crewFigures: content.crewFigures(),
    inFlight: ctx.visitor ? data.inFlightFor(ctx.visitor.id) : null,
    error: req.query.err ? String(req.query.err).slice(0, 160) : null,
  }));
});

// Every channel now lives on the mission page, so this address points there.
app.get('/habitat', (req, res) => res.redirect(301, '/#habitat'));

app.get('/crew', (req, res) => {
  const crew = data.crewWithMood().map((c) => ({
    ...c, latestEntry: data.entriesByCrew(c.id, { limit: 1 })[0] || null,
  }));
  res.send(P.crewPage(req.ctx(), { crew }));
});

/** The whole run in one page — the question a visitor arriving cold actually has. */
app.get('/schedule', (req, res) => {
  const ctx = req.ctx();
  const days = [];
  for (let n = 1; n <= ctx.mission.totalDays; n++) {
    const d = data.day(n);
    // Days still in draft show their date and nothing else, rather than lying.
    days.push({
      missionDay: n,
      date: missionLib.dateForDay(n),
      tasks: d && d.status !== 'DRAFT' ? d.tasks : [],
      meals: d && d.status !== 'DRAFT' ? d.meals : [],
    });
  }
  res.send(P.schedule(ctx, { days }));
});

app.get('/day/:n?', (req, res) => {
  const ctx = req.ctx();
  const n = req.params.n ? Number(req.params.n) : ctx.mission.clampedDay;
  if (!Number.isInteger(n) || n < 1) return res.redirect('/day');
  res.send(P.dayPage(ctx, {
    day: data.day(n), dayNumber: n, entries: data.entriesForDay(n),
    hasPrev: n > 1,
    hasNext: n < ctx.mission.totalDays && n < ctx.mission.clampedDay,
  }));
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
  archive.rollupPending();
  res.send(AR.contents(req.ctx(), {
    days: archive.index(),
    counts: data.counts(),
    entryCounts: data.entryCounts(),
  }));
});

app.get('/archive/day/:n', requireControl, (req, res, next) => {
  const ctx = req.ctx();
  const n = Number(req.params.n);
  if (!Number.isInteger(n) || n < 1 || n > ctx.mission.totalDays) return next();
  res.send(AR.dayRecord(ctx, {
    record: archive.dayRecord(n),
    hasPrev: n > 1,
    hasNext: n < Math.min(ctx.mission.clampedDay, ctx.mission.totalDays),
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
  const n = Number(req.params.n);
  if (!Number.isInteger(n) || n < 1) return next();
  res.type('text/markdown; charset=utf-8')
     .attachment(`mars-station-day-${String(n).padStart(3, '0')}.md`)
     .send(archive.dayMarkdown(n));
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

app.get('/logbook', (req, res) => {
  const crewId = req.query.crew ? Number(req.query.crew) : null;
  res.send(LB.publicLogbook(req.ctx(), {
    days: data.logbook({ crewId }),
    crew: data.crewWithMood(),
    filterCrew: crewId,
    counts: data.entryCounts(),
  }));
});

app.get('/what', (req, res) => res.send(I.what(req.ctx())));
app.get('/about', (req, res) => res.send(I.about(req.ctx())));
app.get('/who-we-are', (req, res) => res.send(I.who(req.ctx(), { crew: data.crewWithMood() })));

/* =========================================================== COMMUNICATION */

const MAX_CHARS = Number(process.env.MESSAGE_MAX_CHARS || 500);
const TRANSIT_MS = Number(process.env.TRANSIT_SECONDS || 12) * 1000;

/** Errors bounce back to the landing page, which is where the composer lives. */
function composeView(req, res, extra = {}) {
  const q = extra.error ? `?err=${encodeURIComponent(extra.error)}` : '';
  res.redirect(`/${q}#write`);
}

app.get('/communicate', (req, res) => res.redirect(301, '/#write'));
app.get('/board', (req, res) => res.redirect(301, '/messages'));

/** Every published exchange, in one scrollable field. */
app.get('/messages', (req, res) => {
  const filter = String(req.query.tag || '').toUpperCase();
  const all = data.published(500, filter ? { tag: filter } : {});
  const tally = {};
  for (const m of data.published(1000)) {
    for (const t of (m.tags || '').split(',').filter(Boolean)) tally[t] = (tally[t] || 0) + 1;
  }
  const tags = Object.entries(tally).map(([tag, n]) => ({ tag, n })).sort((a, b) => b.n - a.n);
  res.send(MS.messages(req.ctx(), {
    list: all, counts: data.counts(), tags, filter: filter || null,
  }));
});

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
    cards: P.boardCards(recent),
    count: recent.length,
    pendingMine: recent.filter((m) => m.mine && m.pending).length,
    total: counts.total,
    published: counts.published,
  });
});

app.post('/communicate', (req, res) => {
  const ctx = req.ctx();
  const visitor = ctx.visitor;

  // Enforced server-side so a closed channel cannot be walked around by
  // posting the form directly. After the run it is always shut.
  const holdBefore = process.env.HOLD_CHANNEL_BEFORE_LAUNCH === 'true';
  if (ctx.mission.phase === 'COMPLETE') return res.redirect('/communicate');
  if (ctx.mission.phase === 'PRE_LAUNCH' && holdBefore) return res.redirect('/communicate');

  // The transit lock is enforced here, not in the browser.
  if (data.inFlightFor(visitor.id)) return res.redirect('/communicate');

  const body = String(req.body.body || '').trim().replace(/\s+\n/g, '\n');
  if (body.length < 2) {
    return composeView(req, res, { error: 'Write something before transmitting.', draft: body });
  }
  if (body.length > MAX_CHARS) {
    return composeView(req, res, { error: `Messages are limited to ${MAX_CHARS} characters.`, draft: body.slice(0, MAX_CHARS) });
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

app.post('/theme', (req, res) => {
  const to = req.body.to === 'dark' ? 'dark' : 'light';
  res.cookie('mcs_theme', to, { httpOnly: false, sameSite: 'lax', maxAge: 365 * 86400000,
    secure: process.env.SECURE_COOKIES === 'true' });
  res.redirect(req.get('referer') || '/');
});

app.get('/api/content', (req, res) => {
  const s = content.status();
  res.status(s.ok ? 200 : 500).json(s);
});

/* The external habitat feed (critical-sensors.de), served station-local so
   visitors' phones never need CORS proxies. The server polls and stores;
   this endpoint hands the browser everything it needs to draw. */
app.get('/api/habitat/data', (req, res) => {
  const days = Math.min(365, Math.max(1, Number(req.query.days || 30)));
  res.json(critical.snapshot(days));
});

app.get('/healthz', (req, res) => res.type('text').send('ok'));

/* =================================================================== CONTROL */

app.use('/log', logbook);
app.use('/control', control);

/* ===================================================================== 404 */

app.use((req, res) => {
  const ctx = req.ctx();
  res.status(404).send(require('./views/layout').page({
    title: 'No such channel', ctx, current: '',
    body: `<div style="padding:60px 0"><div class="eyebrow">404</div>
      <h1>No such channel</h1>
      <p class="lede">Nothing is transmitting on this address.</p>
      <p><a class="btn" href="/">Return to mission</a></p></div>`,
  }));
});

/* Every cookie-less page view mints a callsign, so crawlers leave rows behind.
   Visitors who never transmitted and have not been seen for a week are dropped.
   Anyone who sent a message is kept: the archive references their callsign. */
function pruneVisitors() {
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

/* Seal each mission day into the permanent record shortly after it ends. */
setInterval(() => { try { archive.rollupPending(); } catch (e) { console.error('[MCS] rollup', e.message); } },
  15 * 60000).unref();
try { archive.rollupPending(); } catch (e) { console.error('[MCS] rollup', e.message); }

/* The editable files in content/ are the source of truth for day content.
   Load them at boot and watch for edits so a save shows up on the site. */
content.load();
if (process.env.WATCH_CONTENT !== 'false') content.watch();

/* Poll the external habitat sensor feed on its own transmit cycle. */
if (process.env.CRITICAL_POLL !== 'false') critical.start();

const PORT = Number(process.env.PORT || 8080);
app.listen(PORT, '0.0.0.0', () => {
  const m = missionLib.state();
  const g = geometry();
  console.log(`[MCS] station listening on :${PORT}`);
  console.log(`[MCS] mission day ${m.missionDay}/${m.totalDays} (${m.phase})`);
  console.log(`[MCS] Earth-Mars ${g.distanceAu.toFixed(3)} au, one way ${orbital.formatLightTime(g.lightSeconds)}`);
});
