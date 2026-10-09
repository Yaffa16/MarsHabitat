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
const spacespeak = require('./lib/spacespeak');
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

/* Lighter pages (8 October: "the website is very heavy to load — keep all the functions, but make it lighter"): every
   text the station sends goes compressed to a browser that takes it — Brotli, else gzip, by Node's own zlib, nothing to
   install. The station's own stylesheets and scripts (public/*.css, *.js and public/vendor/) are compressed once, at
   Brotli's best, and kept until the file changes on disk; asked for with their version in the address (?v=, which
   changes with every start of the station) a browser keeps them a year and asks again for none of them — the four
   stylesheets alone go from some 600 kB to under 100. What the pages render and the API answers is compressed as it
   is sent (res.send: HTML, JSON, text, SVG, a playlist; a kilobyte at the least). Pictures and files go as they are. */
const zlib = require('zlib');
const fs = require('fs');
function encodingFor(req) {
  if (req.method === 'HEAD') return null;
  const ae = String(req.headers['accept-encoding'] || '');
  return /\bbr\b/.test(ae) ? 'br' : /\bgzip\b/.test(ae) ? 'gzip' : null;
}
// a text compressed both ways, at their best, once: what is sent again and again
function pack(raw, type) {
  return { raw, type,
    br: zlib.brotliCompressSync(raw, { params: { [zlib.constants.BROTLI_PARAM_QUALITY]: 11, [zlib.constants.BROTLI_PARAM_SIZE_HINT]: raw.length } }),
    gzip: zlib.gzipSync(raw, { level: 9 }),
    etag: '"' + crypto.createHash('sha1').update(raw).digest('base64').slice(0, 27) + '"' };
}
function sendPacked(req, res, e) {
  const enc = encodingFor(req);
  res.set({ 'Content-Type': e.type, Vary: 'Accept-Encoding', ETag: e.etag,
    'Cache-Control': req.query.v ? 'public, max-age=31536000, immutable' : 'public, max-age=3600' });
  if (req.headers['if-none-match'] === e.etag) return res.status(304).end();
  const body = enc ? e[enc] : e.raw;
  if (enc) res.set('Content-Encoding', enc);
  res.set('Content-Length', String(body.length));
  return req.method === 'HEAD' ? res.end() : res.end(body);
}
const PACKED = new Map();                                                         // file → its pack, with the file's mtime and size
function packed(file) {
  let st; try { st = fs.statSync(file); } catch { return null; }
  if (!st.isFile()) return null;
  const hit = PACKED.get(file);
  if (hit && hit.mtimeMs === st.mtimeMs && hit.size === st.size) return hit;
  const entry = Object.assign(pack(fs.readFileSync(file), file.endsWith('.css') ? 'text/css; charset=utf-8' : 'application/javascript; charset=utf-8'),
    { mtimeMs: st.mtimeMs, size: st.size });
  PACKED.set(file, entry);
  return entry;
}
const PUBLIC_DIR = path.join(__dirname, '../public');
app.use((req, res, next) => {
  if ((req.method !== 'GET' && req.method !== 'HEAD') || !/^\/(?:vendor\/)?[A-Za-z0-9_-][A-Za-z0-9._-]*\.(?:css|js)$/.test(req.path)) return next();
  const e = packed(path.join(PUBLIC_DIR, req.path)); if (!e) return next();
  return sendPacked(req, res, e);
});
// the browser's dictionary, a script of its own for each language (src/views/layout.js, clientTable): kept by the browser
// rather than sent with every page
const TABLES = {};
app.get(/^\/i18n\/(de|fr)\.js$/, (req, res) => {
  const lang = req.params[0];
  const e = TABLES[lang] || (TABLES[lang] = pack(Buffer.from(require('./views/layout').tableScript(lang), 'utf8'), 'application/javascript; charset=utf-8'));
  return sendPacked(req, res, e);
});
// the night sky's stars as a picture of their own (src/views/sky.js): the site's pages by night lay it under everything —
// fetched once (neu.css asks for it with a version: kept a year), never sent with a page, and not at all by day
let SKY_SVG = null;
app.get('/sky.svg', (req, res) => sendPacked(req, res, SKY_SVG || (SKY_SVG = pack(Buffer.from(require('./views/sky').svg(), 'utf8'), 'image/svg+xml; charset=utf-8'))));
const PACKABLE = /^(text\/|application\/(json|javascript|xml|vnd\.apple\.mpegurl|x-mpegurl)|image\/svg\+xml)/i;
app.use((req, res, next) => {
  const enc = encodingFor(req);
  if (!enc) return next();
  const send = res.send;
  res.send = function (body) {
    try {
      if ((typeof body === 'string' || Buffer.isBuffer(body)) && !this.get('Content-Encoding') && this.statusCode !== 204 && this.statusCode !== 304) {
        if (typeof body === 'string' && !this.get('Content-Type')) this.type('html');
        const type = String(this.get('Content-Type') || '');
        const buf = typeof body === 'string' ? Buffer.from(body, 'utf8') : body;
        if (buf.length >= 1024 && PACKABLE.test(type)) {
          const out = enc === 'br' ? zlib.brotliCompressSync(buf, { params: { [zlib.constants.BROTLI_PARAM_QUALITY]: 5, [zlib.constants.BROTLI_PARAM_SIZE_HINT]: buf.length } }) : zlib.gzipSync(buf, { level: 6 });
          this.set('Content-Encoding', enc);
          this.vary('Accept-Encoding');
          this.removeHeader('Content-Length');
          return send.call(this, out);
        }
      }
    } catch { /* sent as it is */ }
    return send.call(this, body);
  };
  next();
});
// redirect: false — a folder's address (/crew, the portraits' folder) is not sent to /crew/, so the old page's address
// below can send it on to its section of the Write page
app.use(express.static(PUBLIC_DIR, { maxAge: '1h', redirect: false }));
// The scientific missions' sheets, one PDF a mission, from the missions/ folder beside content/ (the Today's Mission
// panel links to the day's; content/missions.json says which sheet is which day's). PDFs only; nothing else in the
// folder is served.
app.use('/missions', (req, res, next) => (/\.pdf$/i.test(req.path) ? next() : res.status(404).end()),
  express.static(path.join(__dirname, '../missions'), { maxAge: '1h', index: false }));

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
    // The visitor's language, from the cookie — German until they choose (i18n.pick) — and T, which puts any
    // interface string into it. Mission control and the archive ignore both.
    const lang = i18n.pick(req);
    cached = {
      // light unless the visitor chose dark (8 October: "the project should open in light mode by default")
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
    // Today's Meal shows the current day's meals with the power the food meter read for each; before the run the panel
    // shows the first day's plan, and the meter is read for today — the rehearsal day, NOW (data.mealsFor, powerDay)
    today: data.day(ctx.mission.clampedDay, { powerDay: ctx.mission.phase === 'PRE_LAUNCH' ? 0 : null }),
    // The day's scientific mission, from content/missions.json (Today's Mission, at the head of the dashboard).
    mission: content.missionForDay(ctx.mission.clampedDay),
    counts: data.counts(),
    latestEntries: data.entriesForDay(ctx.mission.clampedDay),
    // NOW, before the run — the rehearsal day, mission day 0 (src/lib/mission.js): its three blog slots and its day,
    // for the blog panels, which show NOW's posts once there are any (views/pages/public.js, dashboardPanels)
    nowLog: ctx.mission.phase === 'PRE_LAUNCH' ? data.logSlotsFor(0, missionLib.dateForDay) : null,
    nowDay: ctx.mission.phase === 'PRE_LAUNCH' ? data.day(0) : null,
    crewFigures: content.crewFigures(),
    // Power generated by the bike — the rounds pedalled and the battery charged, per day (content/bike.json, 8 October).
    bike: content.bike(),
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
  // The station closes at the end of the day after the run (mission.open — 28 October 2026): until then the page is
  // the mission's, its channel taking messages for the crew's last replies; from then on it is the closed record.
  if (!ctx.mission.open) {
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
    recent: data.board(BOARD_RECENT, ctx.visitor ? ctx.visitor.id : null),
    inFlight: ctx.visitor ? data.inFlightFor(ctx.visitor.id) : null,
    error: req.query.err ? String(req.query.err).slice(0, 160) : null,
  }));
});

/* The installation's screens (views/pages/screens.js): one piece of the station a screen, full screen, nothing to
   scroll — /screen/<name>, the list at /screens. Dark and in German unless the address says otherwise (?theme=light,
   ?lang=en|de|fr): the cookies do not reach a screen in the square. The screens open to anyone — unless .env puts a
   door on them (lib/screens-auth.js — SCREENS_USER and SCREENS_PASSWORD, both set): then every one of them, the list
   and the writing screen's post ask for that sign-in (a cookie for a year once given), mission control's session does
   not open them, and a browser without the screens' cookie is sent to /screens/login and, signed in, on to where it
   was going. Without the door, /screens/login simply leads to the list. */
const screensAuth = require('./lib/screens-auth');
function requireScreens(req, res, next) {
  if (screensAuth.signedIn(req)) return next();                        // always, without a door
  res.set('Cache-Control', 'no-store').redirect(`/screens/login?next=${encodeURIComponent(req.originalUrl)}`);
}
const screensNext = (req) => { const n = String((req.query && req.query.next) || (req.body && req.body.next) || ''); return screensAuth.guarded(n) ? n : '/screens'; };
app.get('/screens/login', (req, res) => {
  if (screensAuth.signedIn(req)) return res.redirect(screensNext(req));
  res.set('Cache-Control', 'no-store').send(require('./views/pages/screens').login(screenCtx(req), { next: screensNext(req) }));
});
app.post('/screens/login', (req, res) => {
  const S = require('./views/pages/screens'), ip = hashIp(req.ip), next = screensNext(req);
  res.set('Cache-Control', 'no-store');
  if (!screensAuth.enabled) return res.redirect(next);                  // no door: nothing to sign in to
  if (screensAuth.throttled(ip)) return res.status(429).send(S.login(screenCtx(req), { next, error: 'Too many tries. Wait ten minutes, then sign in again.' }));
  if (!screensAuth.accepted(req.body.username, req.body.password)) {
    screensAuth.failed(ip);
    return res.status(401).send(S.login(screenCtx(req), { next, error: 'Those credentials were not accepted.' }));
  }
  screensAuth.cleared(ip);
  screensAuth.signIn(res);
  res.redirect(next);
});
app.post('/screens/logout', (req, res) => { screensAuth.signOut(res); res.redirect(screensAuth.enabled ? '/screens/login' : '/screens'); });
function screenCtx(req) {
  const base = req.ctx();
  const lang = i18n.LANGS.includes(req.query.lang) ? req.query.lang : 'de';
  // no visitor on a screen: a screen in the square is nobody's browser (the writing screen mints one a message)
  // every screen dark unless the address says ?theme=light (8 October: "everything in /screens, all the pages there,
  // should have the dark mode" — the site itself opens light)
  return { ...base, lang, T: i18n.of(lang), theme: req.query.theme === 'light' ? 'light' : 'dark', offer: '', visitor: null, callsign: '' };
}
app.get('/screens', requireScreens, (req, res) => res.set('Cache-Control', 'no-store').send(require('./views/pages/screens').index(screenCtx(req))));
// The version the station's pages are built with — a new one each time the station starts: an open screen that finds its
// own older reloads itself, once, to take up the new code (public/screen.js; 9 October: "make sure the screens do not
// continuously reload" — no screen reloads on a timer any more). A stamp and nothing else, so it asks for no password.
app.get('/api/screens/version', (req, res) => res.set('Cache-Control', 'no-store').json({ v: require('./views/layout').ASSET_V }));
app.get(['/screen', '/screen/'], (req, res) => res.redirect('/screens'));                 // the list, for an address without a name
app.get('/screens/:name', (req, res) => res.redirect(`/screen/${encodeURIComponent(req.params.name)}${req.url.includes('?') ? req.url.slice(req.url.indexOf('?')) : ''}`));   // /screens/write, a slip of the hand, is /screen/write
// The installation's board (the board screen, and the ground station's beside its composer): the ground station's board —
// its own messages, everything sent from the writing screen under the station's name, whatever their state, among
// everyone's answered exchanges — the latest nine of them, in the one sequence, newest first (8 October: "the latest
// messages that fit on the screen, nine at the most"; board.js shows as many of them as fit). The page and its poll
// (/api/board?station=1) take the same nine, so the board's version is the same in both.
const SCREEN_BOARD_MAX = 9;
function stationBoard(limit = SCREEN_BOARD_MAX) {
  const at = (m) => Date.parse(m.submitted_at || '') || 0;
  return data.board(limit, null, { callsign: callsign.STATION }).sort((a, b) => at(b) - at(a) || b.id - a.id).slice(0, limit);
}
app.get('/screen/:name', requireScreens, (req, res) => {
  const ctx = req.params.name === 'write' || req.params.name === 'station' ? writeCtx(req) : screenCtx(req);   // the composer's head names the operator
  // the board screen is the ground station's board: its own messages — everything sent from the writing screen, under
  // the station's name — stand on it whatever their state, among everyone's answered exchanges (data.board, callsign);
  // the board and the station screens take the latest nine (stationBoard), the landing screen's sky the lot
  const S = require('./views/pages/screens');
  const boardOnly = req.params.name === 'board' || req.params.name === 'station';
  const html = S.render(req.params.name, ctx, { ...stationData(ctx), recent: boardOnly ? stationBoard() : data.board(400, null, { callsign: callsign.STATION }) });
  // a name that is no screen's: the list, with a word, in the screens' own dress — never the site's 404 page, which
  // carries the cookie question (October: no screen address is ever to ask about cookies)
  if (!html) return res.status(404).set('Cache-Control', 'no-store').send(S.index(ctx, { missing: req.params.name }));
  res.set('Cache-Control', 'no-store').send(html);
});

/* The livestream (8 October: "in the screens add a page called Livestream — this stream embedded, playing by itself,
   with a play button"; views/pages/screens.js, livestream; public/screen-live.js): the habitat's HLS stream from ZKM's
   radio server, passed through the station — its playlist at /screen/livestream/stream.m3u8, everything the playlist
   names under /screen/livestream/ beside it — so the screen plays it from the station's own address: no other server's
   permission (CORS) to ask, no plain-http stream refused on a secure page, and the stream's address, key and all, in no
   page. Only what lies in the stream's own folder on its own server is passed on, and a playlist's addresses are
   rewritten to the station's. LIVESTREAM_URL in .env names another stream. */
const LIVESTREAM_URL = process.env.LIVESTREAM_URL || 'http://radio.zkm.de:8099/marsplatz-hls/W3lc0m32M@R5!.m3u8';
const liveBase = (() => { try { return new URL('.', LIVESTREAM_URL); } catch { return null; } })();
function liveUpstream(raw) {
  // the stream's own folder only: no climbing out of it, no other server
  const q = raw.indexOf('?'), p = q < 0 ? raw : raw.slice(0, q);
  let plain; try { plain = decodeURIComponent(p); } catch { return null; }
  if (!liveBase || !plain || /\\|(^|\/)\.\.?(\/|$)|^\/|:\/\//.test(plain)) return null;
  let u; try { u = new URL(raw, liveBase); } catch { return null; }
  return u.origin === liveBase.origin && u.pathname.startsWith(liveBase.pathname) ? u : null;
}
// a playlist's addresses — its segments, its variants, a key, an init section — turned into the station's
function livePlaylist(text, from) {
  const local = (ref) => {
    let u; try { u = new URL(ref, from); } catch { return ref; }
    if (u.origin !== liveBase.origin || !u.pathname.startsWith(liveBase.pathname)) return ref;
    return '/screen/livestream/' + u.pathname.slice(liveBase.pathname.length) + u.search;
  };
  return text.split(/\r?\n/).map((line) => {
    const l = line.trim();
    if (!l) return line;
    return l[0] === '#' ? line.replace(/URI="([^"]+)"/g, (m, ref) => `URI="${local(ref)}"`) : local(l);
  }).join('\n');
}
async function liveProxy(res, upstream) {
  res.set('Cache-Control', 'no-store');
  if (!upstream) return res.status(404).end();
  let r;
  try { r = await fetch(upstream, { signal: AbortSignal.timeout(15000), headers: { 'User-Agent': 'MARSplatz-station' } }); }
  catch { return res.status(502).type('text').send('The livestream could not be reached.'); }
  if (!r.ok) return res.status(r.status === 404 ? 404 : 502).type('text').send('The livestream is not on air.');
  const type = r.headers.get('content-type') || '';
  if (/mpegurl/i.test(type) || /\.m3u8$/i.test(upstream.pathname)) {
    return res.type('application/vnd.apple.mpegurl').send(livePlaylist(await r.text(), upstream));
  }
  if (type) res.type(type);
  const len = r.headers.get('content-length'); if (len) res.set('Content-Length', len);
  require('stream').Readable.fromWeb(r.body).on('error', () => res.destroy()).pipe(res);
}
app.get('/screen/livestream/stream.m3u8', requireScreens, (req, res) => {
  let u = null; try { u = new URL(LIVESTREAM_URL); } catch { /* none set */ }
  liveProxy(res, u);
});
app.get(/^\/screen\/livestream\/(.+)$/, requireScreens, (req, res) => liveProxy(res, liveUpstream(req.originalUrl.slice('/screen/livestream/'.length))));

/* The writing screen (views/pages/screens.js, write): the composer full screen, for writing to the crew at the venue.
   Its operator is the ground station itself: every message sent from it goes out under ONE name — BODENSTATION (the
   ground station, in German; SCREEN_OPERATOR in .env for another) — which is the callsign the message carries, on the
   board, in mission control and in the record, and the name the composer's head shows at the screen. Behind the name
   each message is still a new visitor's — a visitor row minted for it alone (lib/callsign.js, mint), no cookie set —
   so the next person at the screen is nobody's continuation: no transit lock across them. The checks are the
   composer's (the channel open, the words within bounds); the hourly limit is the screen's own, per address, since all
   its messages come from one (KIOSK_HOURLY_LIMIT, 60 an hour). The fragment the screen's script asks for comes in the
   screen's language (?lang=), which no cookie could carry. */
const KIOSK_HOURLY_LIMIT = Number(process.env.KIOSK_HOURLY_LIMIT || 60);
const SCREEN_OPERATOR = callsign.STATION;                                           // BODENSTATION (lib/callsign.js)
const writeCtx = (req) => ({ ...screenCtx(req), callsign: SCREEN_OPERATOR });   // the screen's composer: the operator in its head
app.get('/screen/write/composer', requireScreens, (req, res) => {
  const ctx = writeCtx(req);
  res.set('Cache-Control', 'no-store').type('html').send(composerBlock(ctx, { inFlight: null, error: null, draft: '', kiosk: ctx.lang }));
});
app.post('/screen/write', requireScreens, (req, res) => {
  const ctx = writeCtx(req);
  const S = require('./views/pages/screens');
  const answer = (extra = {}, visitor = null) => {                  // the fragment for the screen's script, or the whole screen
    const c = ctx;                                                    // the operator's name stays in the head, sent or not
    const inFlight = visitor ? data.inFlightFor(visitor.id) : null;
    res.set('Cache-Control', 'no-store');
    if (isLive(req)) return res.type('html').send(composerBlock(c, { inFlight, error: extra.error || null, draft: extra.draft || '', kiosk: ctx.lang }));
    return res.send(S.render('write', c, { ...stationData(ctx), recent: [], inFlight, error: extra.error || null, draft: extra.draft || '' }));
  };
  if (!ctx.mission.open) return answer();
  if (ctx.mission.phase === 'PRE_LAUNCH' && process.env.HOLD_CHANNEL_BEFORE_LAUNCH === 'true') return answer();
  const body = String(req.body.body || '').trim().replace(/\s+\n/g, '\n');
  if (body.length < 2) return answer({ error: 'Write something before transmitting.', draft: body });
  if (body.length > MAX_CHARS) return answer({ error: `${ctx.T('Messages are limited to')} ${MAX_CHARS} ${ctx.T('characters.')}`, draft: body.slice(0, MAX_CHARS) });
  const since = new Date(Date.now() - 3600000).toISOString(), ip = hashIp(req.ip);
  const sent = db.prepare('SELECT COUNT(*) n FROM message WHERE ip_hash = ? AND submitted_at > ?').get(ip, since).n;
  if (sent >= KIOSK_HOURLY_LIMIT) return answer({ error: 'Too many transmissions from your position. Try again later.', draft: body });
  let tags = req.body.tags || [];
  if (!Array.isArray(tags)) tags = [tags];
  tags = tags.filter((t) => data.TAGS.includes(t)).slice(0, 3);
  const visitor = callsign.mint();                                  // a row of its own behind the name, never a cookie
  const geo = geometry(), submitted = new Date(), arrival = new Date(submitted.getTime() + TRANSIT_MS);
  db.prepare(
    `INSERT INTO message (visitor_id, callsign, body, tags, state, mission_day,
        submitted_at, arrival_at, light_seconds, distance_au, ip_hash)
     VALUES (?, ?, ?, ?, 'IN_TRANSIT', ?, ?, ?, ?, ?, ?)`
  ).run(visitor.id, SCREEN_OPERATOR, body, tags.join(','),
        ctx.mission.phase === 'PRE_LAUNCH' ? 0 : ctx.mission.clampedDay,
        submitted.toISOString(), arrival.toISOString(), geo.lightSeconds, geo.distanceAu, ip);
  answer({}, visitor);
});

/* The dashboard page: the mission dashboard — the nine panels behind their
   index, the live images, the doors — on a page of its own, for a phone first
   (the bar's Dashboard key leads here). The same pieces as the mission page. */
app.get('/dashboard', (req, res) => {
  const ctx = req.ctx();
  if (!ctx.mission.open) return res.redirect('/');
  res.send(P.dashboardPage(ctx, stationData(ctx)));
});

/* The Write page: the composer and the board, nothing else — the exchanges one under the other, flowing on the page,
   the newest BOARD_PAGE of them drawn here and the older ones fetched as the reader scrolls (/api/board?before=,
   public/board.js) (views/pages/public.js, writePage). The mission page's composer, the header's Write link and the
   bar's Write key lead here, and a message sent from the mission page is followed here. The old /messages lands here
   too. The dashboard is a page of its own, /dashboard. */
app.get('/write', (req, res) => {
  const ctx = req.ctx();
  const recent = data.board(BOARD_PAGE, ctx.visitor ? ctx.visitor.id : null);
  res.send(P.writePage(ctx, {
    recent,
    more: recent.filter((m) => !m.mine).length >= BOARD_PAGE,                 // a full first page: older exchanges may follow
    poll: `/api/board?limit=${BOARD_PAGE}&wall=1`,                              // the wall polls for its own cards (noteCard)
    inFlight: ctx.visitor ? data.inFlightFor(ctx.visitor.id) : null,
    error: req.query.err ? String(req.query.err).slice(0, 160) : null,
  }));
});
app.get('/messages', (req, res) => res.redirect(301, '/write'));

/* The station has few pages: the mission page, the Write page, the dashboard page, the media page, At a Glance, the
   crew log, About and mission control. Every other address a public subpage used to have points at its section on the
   Write page or the dashboard page, so old links, bookmarks and printed material still land somewhere. */
const SECTION = {
  '/habitat': '/dashboard#habitat', '/crew': '/dashboard#crew',
  '/day': '/dashboard#mission', '/schedule': '/dashboard#mission',
  '/board': '/write#exchanges', '/communicate': '/write#write',
};
for (const [from, to] of Object.entries(SECTION)) {
  app.get(from, (req, res) => res.redirect(301, to));
}
/* About, What this is and Who we are: the reading matter, a page of its own
   (views/pages/info.js) — the About key of a phone's bar and the rows of the
   ticker's menu lead here; the old addresses of the other two land on their
   section of it. */
app.get('/about', (req, res) => {
  const ctx = req.ctx();
  // the habitat's section carries the picture with every module a key and its pop-ups' live sentences (inside.js,
  // habitatInside — dome.js figures): the day, the crew, the latest exchanges, the power, the counts and the crew's figures
  const habitat = {
    today: data.day(ctx.mission.clampedDay, { powerDay: ctx.mission.phase === 'PRE_LAUNCH' ? 0 : null }),
    crew: data.crewWithMood(), recent: data.published(3), power: content.powerLive(), counts: data.counts(), crewFigures: content.crewFigures(),
  };
  res.send(require('./views/pages/info').aboutPage(ctx, { crew: data.crewWithMood(), habitat }));
});
app.get('/what', (req, res) => res.redirect(301, '/about'));                 // What this is left the page (October): the address lands on About
app.get('/who-we-are', (req, res) => res.redirect(301, '/about#who-we-are'));
app.get('/day/:n', (req, res) => res.redirect(301, '/dashboard#mission'));

/* The crew log as a page of its own: every day of the run, every officer's
   slot — the entry where it is written, its placeholder where it is not,
   and the media that went with it. Public the moment it is written. */
/* At a Glance: the whole mission, day by day, public. Built from the same
   day records as the archive, shown through the public-safe view. */
app.get('/at-a-glance', (req, res) => {
  const ctx = req.ctx();
  archive.rollupPending();
  const records = Array.from({ length: ctx.mission.totalDays }, (_, i) => archive.dayRecord(i + 1));
  // The last reading of the day per channel, so each page of the booklet
  // carries the habitat as it stood at the end of that day (as it stands
  // now, for today): every channel the external node transmits — its own
  // battery and signal strength included — and the station's own ingest
  // channels. The hardware's last readings come with the day record
  // (home-assistant.daySummary).
  const KEYS = ['co2', 'temp', 'hum', 'light', 'pres', 'bat', 'rssi', 'voc', 'iaq'];
  const nodeRows = db.prepare(`SELECT t, ${KEYS.join(', ')} FROM external_reading WHERE t >= ? AND t < ? ORDER BY t`);
  // (the seed's and the simulator's readings are not the habitat's — left out, as the record leaves them out)
  const ingestRows = db.prepare(`SELECT sr.metric, sr.value, sr.recorded_at, sm.label, sm.unit
    FROM sensor_reading sr LEFT JOIN sensor_metric sm ON sm.metric = sr.metric
    WHERE sr.recorded_at >= ? AND sr.recorded_at < ? AND sr.device_id NOT IN (${archive.FAKE_DEVICES.map(() => '?').join(', ')})
    ORDER BY sm.sort_order, sr.metric, sr.recorded_at`);
  const dayData = (start, end) => {
    const last = new Map();
    for (const x of nodeRows.all(start, end)) for (const k of KEYS) if (x[k] != null) last.set(k, { key: k, last: x[k], lastAt: x.t });
    const node = KEYS.filter((k) => last.has(k)).map((k) => last.get(k));
    const ingest = [];
    for (const x of ingestRows.all(new Date(start).toISOString(), new Date(end).toISOString(), ...archive.FAKE_DEVICES)) {
      const t = Date.parse(x.recorded_at);
      if (!Number.isFinite(t)) continue;
      let s = ingest.find((y) => y.key === x.metric);
      if (!s) { s = { key: x.metric, label: x.label || x.metric, unit: x.unit || '' }; ingest.push(s); }
      s.last = x.value; s.lastAt = t;
    }
    return { node, ingest };
  };
  for (const r of records) {
    const w = archive.windowFor(r.missionDay);
    Object.assign(r, dayData(Date.parse(w.start), Date.parse(w.end)));
  }
  // Before the run, the booklet opens on NOW — the rehearsal day, mission
  // day 0 — as a complete day page, so the real feel of a filled one can be
  // had weeks early: the habitat's sensors as they read now, and everything
  // mission control has filed under NOW — its schedule, meals, counts and
  // power, its blogs and media — with any states filed today
  // (src/lib/archive.js, rehearsalRecord). Clearly marked, not part of the
  // record, gone on 15 October.
  let rehearsal = null;
  if (ctx.mission.phase === 'PRE_LAUNCH') {
    const start = missionLib.venueMidnightUtc(ctx.mission.today, ctx.mission.timezone);
    const end = start + 86400000;
    const base = archive.rehearsalRecord(ctx.mission) || {};
    rehearsal = { ...base, date: ctx.mission.today, ...dayData(start, end) };
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
  // NOW, before the run: the rehearsal day heads the log once a blog is written under it — marked, apart from the days
  if (ctx.mission.phase === 'PRE_LAUNCH') { const nowSlots = data.logSlotsFor(0, missionLib.dateForDay); if (nowSlots && nowSlots.written) days.unshift(nowSlots); }
  const counts = { published: days.filter((d) => d.missionDay).reduce((n, d) => n + d.written, 0), days: days.filter((d) => d.missionDay && d.written).length,
    slots: days.filter((d) => d.missionDay).reduce((n, d) => n + d.entries.length, 0) };
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
    tally: data.tallyByDay(ctx.mission),                                   // messages sent and visitors, total and day by day — mission control's figures (October)
    entryCounts: data.entryCounts(),
    // before the run: today's rehearsal page, so the shape can be seen
    rehearsal: archive.rehearsalRecord(ctx.mission),
  }));
});

/* NOW — the rehearsal day (mission day 0, src/lib/mission.js): its record, built for today from what mission
   control has filed under NOW and what the sensors sent today, marked as not the record. There before the run and
   through a rehearsal against made-up dates (MISSION_OVERRIDE); a 404 during the real run. */
app.get('/archive/now', requireControl, (req, res, next) => {
  const record = archive.rehearsalRecord(req.ctx().mission);
  if (!record) return next();
  res.send(AR.dayRecord(req.ctx(), { record, hasPrev: false, hasNext: false }));
});
app.get('/archive/now/export.md', requireControl, (req, res, next) => {
  const md = archive.rehearsalMarkdown();
  if (!md) return next();
  res.type('text/markdown; charset=utf-8')
     .attachment(`mars-station-now-rehearsal-${new Date().toISOString().slice(0, 10)}.md`)
     .send(md);
});
app.get('/archive/now/export.pdf', requireControl, (req, res, next) => {
  try {
    const buf = recordPdf.todayRecord();
    if (!buf) return next();
    res.type('application/pdf')
       .attachment(`mars-station-now-rehearsal-${new Date().toISOString().slice(0, 10)}.pdf`)
       .send(buf);
  } catch (e) { next(e); }
});
/* Today. Before the run this is NOW — the rehearsal page. During the run
   "today" is simply the current mission day, so the address goes there;
   after the run, to the last day. */
const todayTarget = (req, suffix = '') => {
  const st = req.ctx().mission;
  return st.phase === 'PRE_LAUNCH' ? `/archive/now${suffix}` : `/archive/day/${archive.recordedUpTo(st)}${suffix}`;
};
app.get('/archive/today', requireControl, (req, res) => res.redirect(todayTarget(req)));
app.get('/archive/today/export.md', requireControl, (req, res) => res.redirect(todayTarget(req, '/export.md')));
app.get('/archive/today/export.pdf', requireControl, (req, res) => res.redirect(todayTarget(req, '/export.pdf')));

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

/* The record of the crew's states as CSV — every state filed for every officer, oldest first — from the Archive's
   Take a copy, behind the sign-in like the rest of the record (October: in the archive, not under the officer's state). */
app.get('/archive/moods.csv', requireControl, (req, res) => {
  res.type('text/csv; charset=utf-8').attachment(`mars-station-crew-states-${new Date().toISOString().slice(0, 10)}.csv`)
    .send(require('./lib/record-pdf').moodsCsv());
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
    `SELECT m.*, r.body AS response_body, r.published_at AS response_at, c.designation AS responder, s.launched_at
     FROM message m LEFT JOIN response r ON r.message_id = m.id
     LEFT JOIN crew c ON c.id = r.crew_id
     LEFT JOIN space_relay s ON s.message_id = m.id AND s.state = 'SENT'
     WHERE m.id = ? AND m.state = 'PUBLISHED'`
  ).get(Number(req.params.id));
  if (!m) return next();
  res.send(P.single(req.ctx(), { message: m }));
});

/* =========================================================== COMMUNICATION */

const MAX_CHARS = require('./lib/limits').MESSAGE_MAX;   // a message's length: five hundred characters at the most (src/lib/limits.js — 8 October)
const BOARD_RECENT = Math.max(1, Number(process.env.BOARD_RECENT || 9));   // the answered exchanges the first poll of a board shows, newest first (the sky, the screens)
const BOARD_PAGE = Math.max(5, Number(process.env.BOARD_PAGE || 20));      // the Write page's board: a page of exchanges, the next fetched as the reader scrolls
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
  // a plain post goes back to the Write page, with the pop-up open (the composer is nowhere else)
  res.redirect(`/write${q}#write`);
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
  // The installation's board screen polls with ?lang=, ?limit=9 and ?station=1: the latest nine, as many of them shown
  // as fit, in the language its address names (no cookie reaches a screen), and its cards must come back in the same
  // language they were drawn in — otherwise the words the page ticks (board.js: Milliarden, vor 19 Stunden) and the
  // words the cards carry would be in two languages.
  const T = i18n.LANGS.includes(req.query.lang) ? i18n.of(req.query.lang) : ctx.T;
  const limit = Math.min(400, Math.max(1, Number(req.query.limit) || BOARD_RECENT));
  const wall = req.query.wall === '1';                                       // the Write page's wall of notes asks for its own cards (noteCard)
  // ?before=<id>: the Write page's board asking for the page of exchanges older than the oldest it has (board.js, as
  // the reader scrolls) — the published ones alone, the reader's own are all on the first page; `more` says whether
  // a page older than this one may follow
  if (req.query.before !== undefined) {
    const id = Math.round(Number(req.query.before));
    if (!Number.isFinite(id) || id < 1) return res.status(400).json({ error: 'before: a message id' });
    const at = /^\d{4}-\d\d-\d\dT[\d:.]+Z$/.test(String(req.query.at || '')) ? String(req.query.at) : null;   // the moment it was sent, as the card carries it
    const older = data.board(limit, ctx.visitor ? ctx.visitor.id : null, { before: { id, at } });
    return res.set('Cache-Control', 'no-store').json({ cards: P.boardCards(older, T, { wall }), count: older.length, more: older.length >= limit });
  }
  // ?station=1: the installation's board screen asks for the ground station's board — its own messages are the ones
  // under the station's name (everything the writing screen sends), not a cookie's (a screen has none) — the latest of
  // them all, as many as it asks for (nine: stationBoard)
  const recent = req.query.station === '1' ? stationBoard(limit) : data.board(limit, ctx.visitor ? ctx.visitor.id : null);
  const counts = data.counts();
  res.set('Cache-Control', 'no-store').json({
    version: P.boardVersion(recent),
    phase: ctx.mission.phase,
    open: ctx.mission.open,                                                    // false once the station has closed (board.js turns the page)
    cards: P.boardCards(recent, T, { wall }),
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
  // posting the form directly. The channel closes at the end of the day after the run — 28 October 2026
  // (src/lib/mission.js, open) — and stays shut.
  const holdBefore = process.env.HOLD_CHANNEL_BEFORE_LAUNCH === 'true';
  if (!ctx.mission.open) return composeView(req, res);
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
    return composeView(req, res, { error: 'Too many transmissions from your position. Try again later.', draft: body });
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
  // (out of the atmosphere it goes only once the crew have replied — routes/control.js hands it to the relay then)

  if (isLive(req)) return composerFragment(req, res);
  res.redirect('/write#write');                                               // the message is followed on the Write page
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
    sol: st.clampedDay, totalDays: st.totalDays, phase: st.phase, open: st.open, venueTime: st.venueTime,
    opensAt: st.opensAt, epoch: content.resetEpoch(),
    tasks: today ? today.tasks.map((t) => ({ time: t.time, label: t.label, detail: t.detail || '' })) : [],
    hab: P.habReading(req.ctx()),   // the running line's habitat reading (public.js, habReading)
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

/* The mission's state, for anyone: the day, the phase, the time elapsed — and no counts: how many messages were sent
   and how many visitors there were is mission control's alone (October), at /control/counts behind the sign-in. */
app.get('/api/status', (req, res) => {
  const m = missionLib.state();
  res.json({ missionDay: m.missionDay, phase: m.phase, elapsed: m.elapsed });
});

/* The theme and language switches keep their choice in a cookie — for a year
   once the visitor has accepted the station's cookies, for the visit only
   until then. Neither moves the visitor: the page's script (public/switches.js)
   turns the theme on the page itself and posts the cookie in the background,
   answered 204 — no reload, the page stays where it is; the language has to
   reload, so its form carries the whole address the visitor was at, the #part
   included (which a Referer never has), and the station sends them back to
   exactly that. Without the script, the Referer is the way back, and the
   landing page the last resort. */
const keep = (req) => (req.cookies.mcs_consent === 'yes' ? 365 * 86400000 : undefined);
const wayBack = (req) => {
  const back = String((req.body && req.body.back) || '');
  if (/^\/(?![\/\\])[^\s]*$/.test(back)) return back;                           // a path of this station, with its query and #part
  return req.get('referer') || '/';
};
app.post('/theme', (req, res) => {
  const to = req.body.to === 'dark' ? 'dark' : 'light';
  res.cookie('mcs_theme', to, { httpOnly: false, sameSite: 'lax', maxAge: keep(req),
    secure: process.env.SECURE_COOKIES === 'true' });
  if (isLive(req)) return res.status(204).end();
  res.redirect(wayBack(req));
});

/* The language switch: the same shape as the theme — a cookie, a redirect
   back to where the visitor was. Anything but de/en/fr falls back to the site's default (i18n.DEFAULT_LANG — German). */
app.post('/lang', (req, res) => {
  const to = i18n.LANGS.includes(req.body.to) ? req.body.to : i18n.DEFAULT_LANG;
  res.cookie('mcs_lang', to, { httpOnly: false, sameSite: 'lax', maxAge: keep(req),
    secure: process.env.SECURE_COOKIES === 'true' });
  res.redirect(wayBack(req));
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
  // ?since=<ms>: only the readings from then on; ?thin=1: the days before today one reading in ten minutes
  // (src/lib/critical.js, rows — the dashboard reads the month so once, then only what is new; public/habitat.js)
  const after = Number(req.query.since);
  res.json(critical.snapshot(days, { after: after > 0 ? after : null, thin: req.query.thin === '1' }));
});

/* The habitat's own hardware, read through Home Assistant. The server polls
   and stores (src/lib/home-assistant.js); the browser reads this — rendered
   panel HTML plus a change mark, the same pattern as /api/board — so the
   token and the Home Assistant address never leave the server. */
/* A poll's words in the page's own language: the one its address says (?lang= — the installation's screens carry no
   cookie and say their language in the address; hardware.js and the gallery's screen pass it on), else the visitor's. */
function pollCtx(req) {
  const base = req.ctx();
  const lang = i18n.LANGS.includes(req.query.lang) ? req.query.lang : base.lang;
  return lang === base.lang ? base : { ...base, lang, T: i18n.of(lang) };
}
app.get('/api/hardware', (req, res) => {
  const snap = homeAssistant.snapshot(24), ctx = pollCtx(req);
  // `w`: the width the page shows a chart at, in CSS pixels (hardware.js measures its tiles) — the charts are drawn
  // for it, so their type keeps its size on a desk and on a phone alike
  // `h`: the height, where the page wants another than the usual 240 — lower on the installation's screens that show
  // the panel whole, taller on the rolled Habitat screen, where the roll gives the charts room
  const asked = Math.round(Number(req.query.w)), askedH = Math.round(Number(req.query.h));
  const width = Number.isFinite(asked) && asked >= 240 ? Math.min(1400, asked) : 720;
  const height = Number.isFinite(askedH) && askedH >= 120 ? Math.min(700, askedH) : 240;
  res.set('Cache-Control', 'no-store').json({
    version: homeAssistant.version(snap),
    frozen: snap.frozen,
    pollMs: snap.pollMs,
    w: width,
    h: height,
    html: snap.configured && snap.sensors.length ? P.hardwareInner(snap, ctx.T, { width, height }) : '',
    // the power tile, whose metered category moves with the readings
    power: P.powerTileInner(ctx, content.powerLive()),
    // the oxygen tile, the first of the Sensors panel's instruments, read from the hardware (8 October)
    o2: P.oxygenTileInner(snap, ctx.T),
  });
});

/* The cloud gallery's state — is the bridge on, how many images, when it
   last answered, what went wrong. No credentials, no paths beyond the folder. */
/* The celestial objects a message's distance is compared with (src/lib/celestial.js, content/celestial.json), in the
   visitor's language (?lang=de|en|fr says otherwise — the installation's screens), nearest first. board.js asks for it
   once, the first time a card is tapped. */
app.get('/api/celestial', (req, res) => {
  const lang = ['de', 'en', 'fr'].includes(req.query.lang) ? req.query.lang : req.ctx().lang;
  res.set('Cache-Control', 'public, max-age=300').json({ lang, objects: require('./lib/celestial').list(lang) });
});

app.get('/api/cloud', (req, res) => {
  const cloud = require('./lib/cloud');
  const snap = cloud.snapshot();
  // the grid itself, rendered for the visitor's language, so the media page
  // can swap it in the moment the folder changes — the same pattern as the board
  const M = require('./views/pages/media');
  const model = { title: cloud.CFG.title, items: cloud.gallery(), snapshot: snap, limit: 6, sort: cloud.CFG.sort };
  const ctx = pollCtx(req);                                              // the gallery's screen says its language (?lang=)
  // the venue's zone, for a file whose name carries no time (its own date, in the venue's time); the run and the language,
  // for the gallery's day heads
  const opts = { tz: ctx.mission.timezone, mission: ctx.mission, lang: ctx.lang };
  // ?flat=1: the installation's media screen, which shows every picture in one grid (views/pages/screens.js)
  const html = !snap.configured ? '' : req.query.flat === '1' ? M.cloudScreenInner(ctx.T, model, opts) : M.cloudGridInner(ctx.T, model, opts);
  const latestHtml = snap.configured ? M.cloudLatestInner(ctx.T, model, opts) : '';
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
spacespeak.start();                                        // the relay to space — on when the account is set

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
