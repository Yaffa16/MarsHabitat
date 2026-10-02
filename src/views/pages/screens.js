'use strict';
/**
 * The installation's screens: one piece of the station a screen, full screen,
 * the whole of it in one glance, nothing to scroll — the habitat's instruments,
 * the message board, the composer (the writing screen), today's mission, the
 * three blogs, the day (schedule, meal, moods), the trends, the landing page's
 * first screen (the one with the ticker) and the media gallery. Each is a page of its own at /screen/<name>
 * (the list at /screens), without the station's chrome — no ticker but on the
 * landing screen, no menu, no bar of keys, no foot, no cookie question — in
 * the dark theme and in German unless the address says otherwise
 * (?theme=light, ?lang=en|de|fr). Landscape and upright screens alike: the
 * layout turns with the screen (public/screen.css), and what does not fit is
 * scaled down to fit (public/screen.js) or cut clean at the foot — the board's
 * cards, the gallery's tiles — never scrolled. What the site keeps live stays
 * live — the board, the habitat's readings, the pictures, the sky — and every
 * screen reloads itself every five minutes and at the venue's midnight, when
 * the sol turns (the writing screen waits while someone is writing).
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
   not scaled (only read larger on a large screen) and the rows that would be cut at the foot are hidden. `minWidth`: how
   narrow the piece may be made by scaling up (the width it keeps its layout at) — the scale is capped so the screen's
   width, divided by the scale, stays at least this. */
const SCREENS = [
  { name: 'landing', title: 'Landing page', fit: 'scale', minWidth: 1000, about: 'The first screen of the landing page — the name, the way to the habitat with the latest exchanges and pictures around the line — with the ticker' },
  { name: 'habitat', title: 'Habitat', fit: 'scale', minWidth: 960, about: 'The habitat’s instruments: the readings, the crew’s figures, the stores and the power' },
  { name: 'board', title: 'Message Board', fit: 'clip', about: 'The latest exchanges with the crew, as many as fit, live' },
  { name: 'write', title: 'Write to the crew', fit: 'scale', minWidth: 640, about: 'The composer, full screen, for writing to the crew at the venue — every message from it under a callsign of its own' },
  { name: 'mission', title: 'Today’s Mission', fit: 'scale', minWidth: 760, about: 'The day’s scientific mission: its question, Morning, Afternoon and EVA' },
  { name: 'blogs', title: 'Blogs', fit: 'none', about: 'The Commander Blog, the Daily Mission Report and the Health Report, one at a time — each post rolling by from top to bottom, then the next blog' },
  { name: 'day', title: 'Today', fit: 'scale', minWidth: 640, about: 'Today’s Schedule, Today’s Meal and the Crew Moods' },
  { name: 'trends', title: 'Trends', fit: 'scale', minWidth: 520, about: 'The run’s trends on one graph' },
  { name: 'media', title: 'Media', fit: 'clip', about: 'The newest pictures out of the habitat in one grid, as many as fit, live' },
];
const BY_NAME = Object.fromEntries(SCREENS.map((s) => [s.name, s]));

/** The page around a screen: the stylesheets and the dictionary the site uses, the stage, the scripts — nothing else. */
function shell(ctx, { name, title, body, scripts = [], fit = 'scale', ticker = '', head = true, inner = true }) {
  const T = ctx.T, m = ctx.mission, lang = ctx.lang || 'en', minWidth = (BY_NAME[name] && BY_NAME[name].minWidth) || 0;
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
${L.clientTable(lang)}
</head><body class="landing${inner ? ' inner' : ''} screen screen-${name}" data-screen="${name}" data-fit="${fit}"${minWidth ? ` data-min-width="${minWidth}"` : ''} data-tz="${esc(m.timezone)}">
${ticker}
<main class="stage">${head ? `
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
  return shell(ctx, { name: 'landing', title: 'Landing page', body, head: false, inner: false, fit: 'scale',
    ticker: P.ticker(ctx, { today: d.today }), scripts: ['/sky.js'].concat(d.cloud ? ['/cloud.js'] : []) });
}

/** The habitat's instruments: the Habitat panel as the dashboard has it, live. */
function habitat(ctx, d) {
  const p = P.dashboardPanels(ctx, d);
  return shell(ctx, { name: 'habitat', title: 'Habitat', body: p.habitat, fit: 'scale', scripts: ['/habitat.js', '/hardware.js'] });
}

/** The trends on one graph — drawn by habitat.js, which needs the Habitat panel on the page: it stands here unshown. */
function trends(ctx, d) {
  const p = P.dashboardPanels(ctx, d);
  return shell(ctx, { name: 'trends', title: 'Trends', body: `${p.trends}<div class="screen-hidden">${p.habitat}</div>`, fit: 'scale', scripts: ['/habitat.js', '/hardware.js'] });
}

/** Today's mission — typed out as if someone were writing it, letter by letter, held a few minutes typed to the end,
    then typed again (public/typed.js; the dashboard shows the same panel still). */
function mission(ctx, d) {
  const p = P.dashboardPanels(ctx, d);
  return shell(ctx, { name: 'mission', title: 'Today’s Mission', body: p.missionPanel, fit: 'scale', scripts: ['/typed.js'] });
}

/** The three blogs one at a time, each filling the screen: its head, then the day's post rolling by from top to bottom
    at reading pace (public/screen-blogs.js) — the Commander Blog, then the Daily Mission Report, then the Daily Health
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

/** The message board: the latest exchanges, as many as fit, kept live by board.js (its filter bar stands unshown — the
    script needs it — and the cards are cut clean at the foot by screen.js). */
function board(ctx, d) {
  // the screen polls for its own 400 cards in its own language (server.js /api/board) — no cookie reaches a screen
  return shell(ctx, { name: 'board', title: 'Message Board', body: P.boardScreen(ctx, { recent: d.recent, poll: `/api/board?lang=${ctx.lang || 'de'}&limit=400` }), fit: 'clip', scripts: ['/board.js'] });
}

/** The writing screen: the composer alone, full screen, for writing to the crew at the venue (the mission page's
    composer, with the crew's question of the day over it). Every message sent from it is a new visitor's, under a
    callsign minted for it (server.js, POST /screen/write) — no cookie, so the next person at the screen starts afresh —
    and the crossing's read-out names the callsign, so the visitor can look for their exchange on the board. The
    screen's script (public/screen-write.js) clears what was left half-written after a while, and the page's own
    reloads wait while someone is writing. */
function write(ctx, d) {
  const body = `<div class="screen-write">${P.composerDevice(ctx, { inFlight: d.inFlight || null, error: d.error || null, draft: d.draft || '', kiosk: ctx.lang || 'de' })}</div>`;
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

const BUILD = { landing, habitat, board, write, mission, blogs, day, trends, media };

/** The screen by its name, or null for a name that is not one. */
function render(name, ctx, d) {
  return BUILD[name] ? BUILD[name](ctx, d) : null;
}

/** The list of the screens, for setting up: each with its address and what it shows, and the two switches in the address. */
function index(ctx) {
  const T = ctx.T;
  const body = `
    <div class="screen-index">
      <p class="screen-index-lead">${T('One piece of the station a screen, full screen, the whole of it in one glance — nothing to scroll. Open one on a screen and put the browser into full-screen mode (F11).')}</p>
      <ul class="screen-list">${SCREENS.map((s) => `
        <li><a href="/screen/${s.name}"><b>${esc(T(s.title))}</b><span>/screen/${s.name}</span></a><p>${esc(T(s.about))}</p></li>`).join('')}
      </ul>
      <form method="post" action="/screens/logout" class="screen-index-out"><button type="submit">${T('Sign out of the screens')}</button></form>
      <p class="screen-index-note">${T('Every screen is dark and in German unless its address says otherwise:')} <code>?theme=light</code> · <code>?lang=en</code> · <code>?lang=fr</code> — ${T('for example')} <code>/screen/board?lang=en&amp;theme=light</code>. ${T('What the site keeps live stays live on the screen; the rest reloads every five minutes and at midnight, when the sol turns.')}</p>
    </div>`;
  return shell(ctx, { name: 'index', title: 'Screens', body, fit: 'none' });
}

/** The screens' door (server.js, /screens/login; lib/screens-auth.js): the user and the password, and the address to go
 *  on to — the screen that was asked for, or the list. Wrong credentials come back here with a word; too many wrong
 *  tries with another. Mission control's session opens the screens too, so an operator signed in there is never asked. */
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
