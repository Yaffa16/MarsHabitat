'use strict';
/**
 * The installation's screens: one piece of the station a screen, full screen —
 * the habitat's instruments, the message board, the composer (the writing
 * screen), today's mission, the three blogs, the day (schedule, meal, moods),
 * the trends, the landing page's first screen (the one with the ticker) and
 * the media gallery. Each is a page of its own at /screen/<name>
 * (the list at /screens), without the station's chrome — no ticker but on the
 * landing screen, no menu, no bar of keys, no foot, no cookie question — in
 * the dark theme and in German unless the address says otherwise
 * (?theme=light, ?lang=en|de|fr). Landscape and upright screens alike: the
 * layout turns with the screen (public/screen.css), and what does not fit is
 * scaled down to fit (public/screen.js) or cut clean at the foot — the board's
 * cards, the gallery's tiles — never scrolled by hand; the blogs and the habitat
 * roll by on their own, slowly, at their full size (screen-blogs.js,
 * screen-roll.js). What the site keeps live stays
 * live — the board, the habitat's readings, the pictures, the sky — and every
 * screen reloads itself every five minutes and at the venue's midnight, when
 * the sol turns (the writing screen waits while someone is writing).
 * They wear the site's soft UI (public/neu.css, over screen.css — October: "make sure the visualisations also change
 * for the /screens page"), by night and by day, as the public pages do.
 */
const L = require('../layout');
const { esc } = L;
const P = require('./public');
const { habitatSky } = require('./sky');
const LP = require('./landing');
const M = require('./media');

const V = L.ASSET_V;

/** The screens, in the order the list shows them: the name in the address, the title, how the body is made to fit. */
/* `fit`: scale — the piece is scaled to the height of the screen, up (to twice) as well as down; clip — the piece is
   not scaled (only read larger on a large screen) and the rows that would be cut at the foot are hidden; fill — not
   scaled either: the piece is laid out to the stage's height by screen.css (the trends' graph, which is as wide as its
   panel whatever the scale, so scaling cannot make it fill the height — it is drawn to the height instead). `fitLandscape`:
   another way of fitting for a screen held landscape (the trends: scaled when upright, where the graph carries its
   legend under it, filled when landscape); roll — laid out at a width of its own (1920 landscape, 1080 upright) and zoomed
   to the screen's, the panel filling the stage, its head standing and its body rolling by under it, slowly, from top to
   bottom (the habitat: public/screen-roll.js). `minWidth`: how narrow the piece may be made by scaling up (the width it
   keeps its layout at) — the scale is capped so the screen's width, divided by the scale, stays at least this. */
const SCREENS = [
  { name: 'landing', title: 'Landing page', fit: 'scale', minWidth: 1000, about: 'The first screen of the landing page — the name, the way to the habitat with the latest exchanges and pictures around the line — with the ticker' },
  { name: 'habitat', title: 'Habitat', fit: 'roll', about: 'The habitat’s instruments, large, one row under the other, rolling by slowly from top to bottom: the readings and Karlsruhe, the crew’s figures, the stores, the power and the astronauts, the hardware’s charts' },
  { name: 'board', title: 'Message Board', fit: 'clip', about: 'The ground station’s board, live: every message sent from the writing screen as it stands — in transit, awaiting a reply, answered — among the latest exchanges with the crew, the newest first — the latest that fit, nine at the most, never one cut' },
  { name: 'write', title: 'Write to the crew', fit: 'scale', minWidth: 640, about: 'The composer, full screen, for writing to the crew at the venue — every message from it as the ground station’s, under its one operator name' },
  { name: 'mission', title: 'Today’s Mission', fit: 'scale', minWidth: 760, about: 'The day’s scientific mission, typed: its question, Morning, Afternoon and EVA — ten seconds after it stands whole, the day (the schedule, the meal and the crew’s moods) for half a minute, then the mission again, round and round' },
  { name: 'blogs', title: 'Blogs', fit: 'none', about: 'The Commander Log, the Daily Mission Report and the Health Report, one at a time — each post rolling by from top to bottom, then the next blog' },
  { name: 'day', title: 'Today', fit: 'scale', minWidth: 640, about: 'Today’s Schedule, Today’s Meal and the Crew Moods' },
  { name: 'trends', title: 'Trends', fit: 'scale', fitLandscape: 'fill', minWidth: 520, about: 'The run’s trends on one graph' },
  { name: 'media', title: 'Media', fit: 'clip', about: 'The newest pictures out of the habitat in one grid, as many as fit, live' },
  { name: 'livestream', title: 'Livestream', fit: 'none', about: 'The habitat’s livestream, playing by itself without its sound, framed in a space HUD’s four brackets — over it LIVE · MARS!platz Habitat, the day of the run and the date; under it the clock in Karlsruhe, MARS!platz, and the signal’s time to Mars; a large play key whenever it stands still; it picks itself up again when the stream drops' },
  { name: 'station', title: 'Ground station', fit: 'clip', about: 'The writing screen and the message board side by side, for the ground station’s own PC on the square — write to the crew as BODENSTATION, and every message sent stands on the board at once; no cookie question, ever' },
];
const BY_NAME = Object.fromEntries(SCREENS.map((s) => [s.name, s]));

/** The screens' sky (8 October: "add stars and comets in the background for all screens — always in the background
    only"): a field of stars, a few of them twinkling, and now and then a comet crossing — behind everything a screen
    shows: fixed under the stage, which stands over it (screen.css, .screen-sky), so a panel is never covered and the sky
    shows round and between the pieces — and between the habitat's tiles and the board's messages, whose panels lie on it
    without a ground of their own. Four hundred stars, every one a dot (that evening: "remove all the planets from the
    background, only have dots as stars" — the planets, the moon, the nebula and the bright stars' rays, added an hour
    before, are gone), and five comets. The same scatter on every load (seeded); still where less motion is asked for;
    by day none of it (8 October: "do not have the background stars in light mode" — screen.css). */
function screenSky() {
  // (the stars and the comets are the site's night sky as well — src/views/sky.js)
  const SKY = require('../sky');
  return `<div class="screen-sky" aria-hidden="true"><svg class="sky-field" viewBox="0 0 1920 1080" preserveAspectRatio="xMidYMid slice">${SKY.circles()}</svg>${SKY.COMETS}</div>`;
}

/** The page around a screen: the stylesheets and the dictionary the site uses, the stage, the scripts — nothing else. */
/* `head`: the thin band over the piece — MARS!platz, the screen's name, the sol and the clock. No screen carries it any
   more (8 October: "from the /screen pages remove the MARS!platz header, have nothing there"): the piece has the whole
   screen; only the screens' sign-in page keeps it, to say where it is. */
function shell(ctx, { name, title, body, scripts = [], fit = 'scale', ticker = '', head = false, inner = true }) {
  const T = ctx.T, m = ctx.mission, lang = ctx.lang || 'en', minWidth = (BY_NAME[name] && BY_NAME[name].minWidth) || 0,
    fitLandscape = (BY_NAME[name] && BY_NAME[name].fitLandscape) || '';
  const stamp = m.phase === 'ACTIVE' ? `SOL ${String(m.clampedDay).padStart(2, '0')}/${m.totalDays}`
    : m.phase === 'PRE_LAUNCH' ? `T−${m.countdown.days}d` : T('Mission complete');
  return `<!doctype html>
<html lang="${lang}" data-theme="${ctx.theme === 'light' ? 'light' : 'dark'}" class="js screen"><head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="color-scheme" content="light dark">
<meta name="robots" content="noindex">
<title>${esc(T(title))} — MARS!platz</title>
<link rel="stylesheet" href="/station.css?v=${V}">
<link rel="stylesheet" href="/aura.css?v=${V}">
<link rel="stylesheet" href="/sheet.css?v=${V}">
<link rel="stylesheet" href="/screen.css?v=${V}">
<link rel="stylesheet" href="/neu.css?v=${V}">
${L.clientTable(lang)}
</head><body class="landing${inner ? ' inner' : ''} screen screen-${name}" data-screen="${name}" data-fit="${fit}"${fitLandscape ? ` data-fit-landscape="${fitLandscape}"` : ''}${minWidth ? ` data-min-width="${minWidth}"` : ''} data-tz="${esc(m.timezone)}" data-v="${V}">
${screenSky()}
${ticker}
<main class="stage${head ? '' : ' no-head'}">${head ? `
  <header class="stage-head">
    <span class="stage-brand">MARS<b>!</b>platz</span>
    <span class="stage-title">${esc(T(title))}</span>
    <span class="stage-when">${esc(stamp)} · <time id="stage-clock" data-tz="${esc(m.timezone)}"></time></span>
  </header>` : ''}
  <div class="stage-body" id="stage-body"><div class="stage-fit" id="stage-fit">${body}</div></div>
</main>
${scripts.concat('/screen.js').map((s) => `<script src="${s}?v=${V}" defer></script>`).join('\n')}
</body></html>`;
}

/* ------------------------------------------------------------------ the screens */

/** The landing page's first screen: the ticker, the name in its band, then the way to the habitat — the Earth, the
    line, the habitat far above, and the sky's exchanges and pictures around the line (landing.js, space). */
function landing(ctx, d) {
  const T = ctx.T;
  const body = `
  ${LP.space(ctx, { sky: habitatSky(ctx, { recent: d.recent, cloud: d.cloud }) })}
  ${d.cloud ? `<div class="screen-hidden"><div class="cloud-latest" id="cloud-latest" data-version="${esc(d.cloud.snapshot.version || '')}" data-poll="${(Number(d.cloud.snapshot.checkSeconds) || 20) * 1000}">${M.cloudLatestInner(T, d.cloud, { tz: ctx.mission.timezone })}</div></div>` : ''}`;
  return shell(ctx, { name: 'landing', title: 'Landing page', body, inner: false, fit: 'scale',
    ticker: P.ticker(ctx, { today: d.today }), scripts: ['/sky.js'].concat(d.cloud ? ['/cloud.js'] : []) });
}

/** The habitat's instruments: the Sensors panel as the dashboard has it, live — read from across a room (8 October: "a
    vertical layout with scrolling, to show all the content clearly and slowly"): the panel fills the screen, its head
    stands, and its rows — the instruments with Karlsruhe, the steps and the stores, the power with the astronauts,
    the hardware's charts, and at the foot the trends graph (9 October: "in the screen/habitat, at the bottom add the
    trends graph; it scrolls as the rest of the content" — the dashboard's, inside the panel: trendsInside) — stand at
    their full size and roll by under the head, slowly, then start again from the top (public/screen-roll.js; the layout
    in public/screen.css). The astronauts wander on their radar (live.js). */
function habitat(ctx, d) {
  const p = P.dashboardPanels(ctx, d, { trendsInside: true });
  return shell(ctx, { name: 'habitat', title: 'Habitat', body: `<div class="screen-roll" id="screen-roll">${p.habitat}</div>`, fit: 'roll', scripts: ['/habitat.js', '/hardware.js', '/live.js', '/screen-roll.js'] });
}

/** The trends on one graph — drawn by habitat.js, which needs the Habitat panel on the page: it stands here unshown.
    Landscape, the graph is drawn to the stage's height (screen.css, data-fit-landscape="fill"): the wide graph, every
    line named at its right-hand end, as tall as the stage allows and no wider than it; upright, the piece is scaled like
    the others, and the graph is the narrow one with its legend under it. */
function trends(ctx, d) {
  const p = P.dashboardPanels(ctx, d);
  return shell(ctx, { name: 'trends', title: 'Trends', body: `${p.trends}<div class="screen-hidden">${p.habitat}</div>`, fit: 'scale', scripts: ['/habitat.js', '/hardware.js'] });
}

/** The day, one thing at a time and still (9 October: "in the mission screen undo the typing; only show the mission, in
    large type — the screen glitches and does not show the typing or small type well; then today's schedule, today's meal
    and the crew's moods, one after another, not on the same page; no typing, no movement"): the day's mission in large
    type (missionBig — its number, title, central question and the question for the community hour), then the schedule,
    the meal and the crew's moods, each alone on the screen for its time (data-hold), and round again — each turn changed
    at once, fitted to the screen before it is drawn (public/screen-turns.js). Until then the mission was typed out letter
    by letter and the three panels stood side by side. */
function mission(ctx, d) {
  const p = P.dashboardPanels(ctx, d);
  const body = `<div class="screen-turns" id="screen-turns">
    <div class="turn is-on" data-turn="mission" data-hold="40000">${p.missionBig}</div>
    <div class="turn" data-turn="schedule" data-hold="25000">${p.schedule}</div>
    <div class="turn" data-turn="galley" data-hold="20000">${p.galley}</div>
    <div class="turn" data-turn="crew" data-hold="20000">${p.crewPanel}</div>
  </div>`;
  return shell(ctx, { name: 'mission', title: 'Today’s Mission', body, fit: 'scale', scripts: ['/screen-turns.js'] });
}

/** The three blogs one at a time, each filling the screen: its head, then the day's post rolling by from top to bottom
    at reading pace (public/screen-blogs.js) — the Commander Log, then the Daily Mission Report, then the Daily Health
    Blog, round and round. A blog with nothing written yet shows its note for a moment and passes the turn on. */
function blogs(ctx, d) {
  const p = P.dashboardPanels(ctx, d);
  return shell(ctx, { name: 'blogs', title: 'Blogs', body: `<div class="screen-blogs" id="screen-blogs">${p.blogCommander}${p.blogScience}${p.blogHealth}</div>`, fit: 'none', scripts: ['/screen-blogs.js'] });
}

/** The day: the schedule, the meal and the crew's moods side by side (one under the other upright). */
function day(ctx, d) {
  const p = P.dashboardPanels(ctx, d);
  return shell(ctx, { name: 'day', title: 'Today', body: `<div class="screen-three">${p.schedule}${p.galley}${p.crewPanel}</div>`, fit: 'scale' });
}

/** The message board — the ground station's: everything sent from the writing screen, under the station's name,
    stands on it at once, whatever its state (in transit, awaiting a reply, answered), among everyone's answered
    exchanges in one sequence, the newest first, three across: the latest nine, as many of them standing as fit — the
    last three where three fit, the last one where one does — and none cut (board.js, fitScreen). Kept live by board.js
    (its filter bar stands unshown — the script needs it). */
function board(ctx, d) {
  // the screen polls for its own nine cards in its own language, as the station (server.js /api/board, ?station=1,
  // stationBoard) — no cookie reaches a screen, and the board is the station's, not any visitor's; board.js shows the
  // latest of them that fit
  // (the cards are the Write page's notes — 9 October: "make the messages in /screen/board look like the message board in
  // the main site" — &wall=1 asks for them)
  return shell(ctx, { name: 'board', title: 'Message Board', body: P.boardScreen(ctx, { recent: d.recent, poll: `/api/board?lang=${ctx.lang || 'de'}&limit=9&station=1&wall=1` }), fit: 'clip', scripts: ['/board.js'] });
}

/** The writing screen: the composer alone, full screen, for writing to the crew at the venue (the mission page's
    composer, with the crew's question of the day over it). Every message sent from it is a new visitor's, under a
    callsign minted for it (server.js, POST /screen/write) — no cookie, so the next person at the screen starts afresh —
    and the crossing's read-out names the callsign, so the visitor can look for their exchange on the board. The
    screen's script (public/screen-write.js) clears what was left half-written after a while, and the page's own
    reloads wait while someone is writing. */
function write(ctx, d) {
  // beside the box, what sending means (9 October: "move the write to the right of the screen a bit and add the text from
  // the site's write card — send a message to the crew, approved messages are beamed into space, mission control reads
  // every message… — as context to the message sending; highlight the message sent into space part"): the landing
  // page's write card (landing.js) — its name and its beamed-into-space line, highlighted — and under them what becomes
  // of a message, in the screen's language ("it should say the approved messages are transmitted into space by radio
  // transmitters, where your messages will continue to fly through space")
  const T = ctx.T;
  const intro = `<div class="write-intro">
      <h2 class="wi-title">${T('Send a message to the crew')}</h2>
      <p class="wi-beam"><strong>${T('Approved messages are beamed into space')}</strong></p>
      <p class="wi-body">${T('Mission control reads every message. Radio transmitters send the ones it approves into space — where your message keeps flying, on and on.')}</p>
    </div>`;
  const body = `<div class="screen-write has-intro">${intro}${P.composerDevice(ctx, { inFlight: d.inFlight || null, error: d.error || null, draft: d.draft || '', kiosk: ctx.lang || 'de' })}</div>`;
  return shell(ctx, { name: 'write', title: 'Write to the crew', body, fit: 'scale', scripts: ['/composer.js', '/screen-write.js'] });
}

/** The gallery: every picture in one grid, the newest first, as many as fit, kept live by cloud.js (through
    /api/cloud?flat=1 — the grid without the site's day heads). */
function media(ctx, d) {
  const T = ctx.T;
  const body = d.cloud ? M.cloudScreen(T, d.cloud, { tz: ctx.mission.timezone, mission: ctx.mission, lang: ctx.lang })
    : `<div class="empty" style="padding:40px">${T('The gallery is not connected yet')}.</div>`;
  return shell(ctx, { name: 'media', title: 'Media', body, fit: 'clip', scripts: d.cloud ? ['/cloud.js'] : [] });
}

/** The ground station's own screen (October: "a URL that never asks for cookies and always opens the writing screen
    and the message board with the operator as Bodenstation"): the writing screen at the left and the station's board
    at the right (one over the other upright), on one page — /screen/station. The composer is the writing screen's,
    operator BODENSTATION, every message a new visitor's with no cookie (server.js, POST /screen/write — the form posts
    there, the fragment comes back from /screen/write/composer); the board the board screen's, the station's own messages
    on it at once, as many cards as fit, cut clean at the foot (screen.js, clip). No cookie question: no screen has one. */
function station(ctx, d) {
  const body = `<div class="screen-station">
    <div class="screen-write station-write">${P.composerDevice(ctx, { inFlight: d.inFlight || null, error: d.error || null, draft: d.draft || '', kiosk: ctx.lang || 'de' })}</div>
    <div class="station-board">${P.boardScreen(ctx, { recent: d.recent, poll: `/api/board?lang=${ctx.lang || 'de'}&limit=9&station=1&wall=1` })}</div>
  </div>`;
  return shell(ctx, { name: 'station', title: 'Ground station', body, fit: 'clip', scripts: ['/composer.js', '/screen-write.js', '/board.js'] });
}

/** The livestream (8 October: "in the screens add a page called Livestream — this stream embedded, playing by itself,
    with a play button"): the habitat's HLS stream full screen, black round it, through the station (server.js,
    /screen/livestream/stream.m3u8 — the stream's own address is in no page). It plays by itself: with its sound where
    the screen lets a page play sound unasked (a kiosk browser set so), else muted, a key in the corner turning the sound
    on; a large play key in the middle whenever it stands still; LIVE in the corner while it plays; a word while it
    connects, and when the stream is off the air — it is taken up again by itself every ten seconds, and again if it
    stalls. Played by hls.js (public/vendor/hls.min.js), or by the browser itself where it plays HLS (Safari); a stream
    of sound alone shows the station's name with its rings instead of a black picture (public/screen-live.js). */
function livestream(ctx) {
  const T = ctx.T, m = ctx.mission, g = ctx.geo || {};
  const orbital = require('../../lib/orbital');
  const signal = g.lightSeconds ? `${orbital.formatLightTime(g.lightSeconds)} · ${Number(g.distanceAu).toFixed(3)} AU` : '';
  /* the space HUD round the picture (8 October: "add a space HUD; add text that says Live, MARS!platz Habitat, the
     current day and time"): the picture framed in its four brackets (9 October: "frame the image inside the brackets"),
     a faint reticle in its middle, the rulers along its top and its foot, a scan over it; over the frame at the left LIVE
     (while it plays) and MARS!platz Habitat, at the right the day of the run and the date; under it the venue's clock to
     the second — the place, Karlsruhe, MARS!platz (9 October: "location is Karlsruhe, MARSplatz") — and the signal's
     one-way time to Mars and the distance. screen-live.js keeps the clock and the day current — the page is never
     reloaded while it plays — and gives the frame the picture's own shape. */
  const hud = `
    <div class="live-hud" aria-hidden="true">
      <i class="hud-scan"></i><i class="hud-rule top"></i><i class="hud-rule bottom"></i>
      <i class="hud-c tl"></i><i class="hud-c tr"></i><i class="hud-c bl"></i><i class="hud-c br"></i>
      <svg class="hud-reticle" viewBox="-50 -50 100 100"><circle r="20"/><circle r="34" class="dash"/><path d="M-46 0h12M34 0h12M0-46v12M0 34v12"/><circle r="1.6" class="dot"/></svg>
    </div>
    <div class="hud-tl"><div class="live-badge" id="live-badge" hidden><i aria-hidden="true"></i>${T('LIVE')}</div><span class="hud-name">MARS<b>!</b>platz ${esc(T('Habitat'))}</span></div>
    <div class="hud-tr hud-read"><span class="hud-v" id="hud-sol">${esc(m.phase === 'ACTIVE' ? `SOL ${String(m.clampedDay).padStart(2, '0')} / ${String(m.totalDays).padStart(2, '0')}` : m.phase === 'PRE_LAUNCH' ? `T−${m.countdown.days}D` : T('Mission complete'))}</span><span class="hud-k" id="hud-date"></span></div>
    <div class="hud-bl hud-read"><span class="hud-k">${esc(T('Local time'))} · Karlsruhe, MARS<b>!</b>platz</span><span class="hud-v hud-clock" id="hud-clock">${esc(m.venueTime || '')}</span></div>${signal ? `
    <div class="hud-br hud-read"><span class="hud-k">${esc(T('Signal travel time'))} · ${esc(T('Earth'))} → Mars</span><span class="hud-v">${esc(signal)}</span></div>` : ''}`;
  const body = `<div class="screen-live" id="screen-live" data-src="/screen/livestream/stream.m3u8" data-tz="${esc(m.timezone)}" data-lang="${esc(ctx.lang || 'de')}"
      data-start="${esc(m.start_date)}" data-days="${esc(String(m.totalDays))}" data-opens="${esc(m.opensAt || '')}" data-over="${m.phase === 'COMPLETE' ? '1' : ''}">
    <div class="live-frame" id="live-frame">
    <video class="live-video" id="live-video" playsinline autoplay muted preload="auto" aria-label="${esc(T('Livestream'))}"></video>
    <div class="live-audio" aria-hidden="true"><span class="la-ring"></span><span class="la-ring"></span><span class="la-ring"></span><span class="la-mark">MARS<b>!</b>platz</span><span class="la-sub">${esc(T('Livestream'))}</span></div>
    ${hud}
    <div class="live-word" id="live-word" role="status">${T('Connecting to the livestream…')}</div>
    <button type="button" class="live-play" id="live-play" hidden><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8 5.2v13.6L19.2 12z"/></svg><span>${T('Play')}</span></button>
    </div>
  </div>`;
  return shell(ctx, { name: 'livestream', title: 'Livestream', body, fit: 'none', scripts: ['/vendor/hls.min.js', '/screen-live.js'] });
}

const BUILD = { landing, habitat, board, write, mission, blogs, day, trends, media, livestream, station };

/** The screen by its name, or null for a name that is not one. */
function render(name, ctx, d) {
  return BUILD[name] ? BUILD[name](ctx, d) : null;
}

/** The list of the screens, for setting up: each with its address and what it shows, and the two switches in the address.
    With `missing`, the list answers an address that is no screen's (server.js: a word at its head; the site's 404 page,
    with its cookie question, is never shown under /screen). */
function index(ctx, { missing = null } = {}) {
  const T = ctx.T;
  const body = `
    <div class="screen-index">
      ${missing ? `<p class="screen-index-missing" role="alert">${T('There is no screen called')} <code>${esc(String(missing).slice(0, 40))}</code>. ${T('These are the screens:')}</p>` : ''}
      <p class="screen-index-lead">${T('One piece of the station a screen, full screen, the whole of it in one glance — nothing to scroll. Open one on a screen and put the browser into full-screen mode (F11).')}</p>
      <ul class="screen-list">${SCREENS.map((s) => `
        <li><a href="/screen/${s.name}"><b>${esc(T(s.title))}</b><span>/screen/${s.name}</span></a><p>${esc(T(s.about))}</p></li>`).join('')}
      </ul>
      ${require('../../lib/screens-auth').enabled ? `<form method="post" action="/screens/logout" class="screen-index-out"><button type="submit">${T('Sign out of the screens')}</button></form>` : ''}
      <p class="screen-index-note">${T('Every screen is dark and in German unless its address says otherwise:')} <code>?theme=light</code> · <code>?lang=en</code> · <code>?lang=fr</code> — ${T('for example')} <code>/screen/board?lang=en&amp;theme=light</code>. ${T('What the site keeps live stays live on the screen; the rest reloads every five minutes and at midnight, when the sol turns.')}</p>
    </div>`;
  return shell(ctx, { name: 'index', title: 'Screens', body, fit: 'none' });
}

/** The screens' door (server.js, /screens/login; lib/screens-auth.js): the user and the password, and the address to go
 *  on to — the screen that was asked for, or the list. Wrong credentials come back here with a word; too many wrong
 *  tries with another. Mission control's session does not open the screens: everyone is asked for their password. */
function login(ctx, { next = '/screens', error = null } = {}) {
  const T = ctx.T;
  const body = `
    <div class="screen-login">
      <p class="screen-login-k">${T('The screens')}</p>
      <h1 class="screen-login-h">${T('Sign in')}</h1>
      <p class="screen-login-lead">${T('The installation’s screens are for the venue: sign in once on this browser and it stays signed in.')}</p>
      ${error ? `<p class="screen-login-err" role="alert">${esc(T(error))}</p>` : ''}
      <form method="post" action="/screens/login" class="screen-login-form">
        <input type="hidden" name="next" value="${esc(next)}">
        <label><span>${T('User')}</span><input type="text" name="username" autocomplete="username" autocapitalize="none" autofocus required></label>
        <label><span>${T('Password')}</span><input type="password" name="password" autocomplete="current-password" required></label>
        <button type="submit" class="primary">${T('Sign in')}</button>
      </form>
    </div>`;
  return shell(ctx, { name: 'login', title: 'Screens', body, fit: 'none', scripts: [], head: true });
}

module.exports = { render, index, login, SCREENS };
