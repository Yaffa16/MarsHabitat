'use strict';
/**
 * The installation's screens: one piece of the station a screen, full screen —
 * the habitat's instruments, the message board, the composer (the writing
 * screen), today's mission, the three blogs, the day (schedule, meal, moods),
 * the trends, the landing page's first screen (the one with the ticker) and
 * the media gallery. Each is a page of its own at /screen/<name>
 * (the list at /screens), without the station's chrome — no ticker but on the
 * landing screen (and the running line along the habitat's head-up display), no
 * menu, no bar of keys, no foot, no cookie question — in
 * the dark theme and in German unless the address says otherwise
 * (?theme=light, ?lang=en|de|fr). Landscape and upright screens alike: the
 * layout turns with the screen (public/screen.css), and what does not fit is
 * scaled down to fit (public/screen.js) or cut clean at the foot — the board's
 * cards, the gallery's tiles — never scrolled by hand; the blogs roll by on
 * their own, slowly, at their full size (screen-blogs.js), and the habitat's
 * tiles come a page at a time round the way from the Earth to the habitat
 * (screen-habitat-hud.js; rolled by, as before, at ?roll=1: screen-roll.js).
 * What the site keeps live stays
 * live — the board, the habitat's readings, the pictures, the sky — and every
 * screen reloads itself every five minutes and at the venue's midnight, when
 * the sol turns (the writing screen waits while someone is writing).
 * They wear the site's soft UI (public/neu.css, over screen.css — October: "make sure the visualisations also change
 * for the /screens page"), by night and by day, as the public pages do.
 * A screen can be drawn light on request, ?lite=1 in its address, for a computer with little graphics power (12 October:
 * "make the pages very very light to load — they are set up on computers with not so much graphics power or GLSL, and it
 * is glitching and giving artifacts" made it every screen's way that morning; that afternoon, "undo the simplification
 * of the screens page, restore to previous state", every screen is as it was again, its movement and effects whole):
 * html.lite and public/screen-lite.css, last — nothing blurred, masked, filtered or glowing, nothing moving by itself
 * but the landing screen's running line and the LIVE dots, the soft UI's shades without their blur, the stars still and
 * no comets (screenSky); the habitat's display turns its pages at once, and the rolled habitat and the blogs turn a page
 * at a time instead of rolling (screen-habitat-hud.js, screen-roll.js, screen-blogs.js) — server.js, screenCtx: ctx.lite.
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
   to the screen's, filling the stage: the habitat's head-up display (public/screen-habitat-hud.js), or with ?roll=1 its
   panel, its head standing and its body rolling by under it, slowly, from top to bottom (public/screen-roll.js).
   `minWidth`: how narrow the piece may be made by scaling up (the width it
   keeps its layout at) — the scale is capped so the screen's width, divided by the scale, stays at least this. */
const SCREENS = [
  { name: 'landing', title: 'Landing page', fit: 'scale', minWidth: 1000, about: 'The first screen of the landing page — the name, the way to the habitat with the latest exchanges and pictures around the line — with the ticker' },
  { name: 'habitat', title: 'Habitat', fit: 'roll', about: 'The habitat’s instruments, live, as a head-up display: over it Habitat and LIVE, the day, the date and the clock; in the middle the way from the Earth to the habitat, the latest exchange and the latest picture beside its line; at the left and at the right every tile of the Sensors panel — the readings and Karlsruhe, the stores, the steps, the astronauts, the current crew, the power and the bike, the hardware’s charts, the trends — a page at a time, the tiles coming one after another; the running line along the top (the panel rolling by slowly from top to bottom, as it did: ?roll=1)' },
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
    by day none of it (8 October: "do not have the background stars in light mode" — screen.css). On a screen drawn
    light (`still` — ?lite=1 in its address; 12 October) the stars stand still and there are no comets: the same four
    hundred dots, none twinkling, nothing crossing. */
function screenSky({ still = false } = {}) {
  // (the stars and the comets are the site's night sky as well — src/views/sky.js)
  const SKY = require('../sky');
  return `<div class="screen-sky" aria-hidden="true"><svg class="sky-field" viewBox="0 0 1920 1080" preserveAspectRatio="xMidYMid slice">${SKY.circles({ still })}</svg>${still ? '' : SKY.COMETS}</div>`;
}

/** The page around a screen: the stylesheets and the dictionary the site uses, the stage, the scripts — nothing else. */
/* `head`: the thin band over the piece — MARS!platz, the screen's name, the sol and the clock. No screen carries it any
   more (8 October: "from the /screen pages remove the MARS!platz header, have nothing there"): the piece has the whole
   screen; only the screens' sign-in page keeps it, to say where it is. */
/* (light when the address says ?lite=1 — ctx.lite, server.js: html.lite, screen-lite.css after the others, the sky still)
   (`stage`: a class more on the stage — the habitat's head-up display has the whole stage, edge to edge: is-hud) */
function shell(ctx, { name, title, body, scripts = [], fit = 'scale', ticker = '', head = false, inner = true, stage = '' }) {
  const T = ctx.T, m = ctx.mission, lang = ctx.lang || 'en', minWidth = (BY_NAME[name] && BY_NAME[name].minWidth) || 0,
    fitLandscape = (BY_NAME[name] && BY_NAME[name].fitLandscape) || '', lite = !!ctx.lite;
  const stamp = m.phase === 'ACTIVE' ? `SOL ${String(m.clampedDay).padStart(2, '0')}/${m.totalDays}`
    : m.phase === 'PRE_LAUNCH' ? `T−${m.countdown.days}d` : T('Mission complete');
  return `<!doctype html>
<html lang="${lang}" data-theme="${ctx.theme === 'light' ? 'light' : 'dark'}" class="js screen${lite ? ' lite' : ''}"><head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="color-scheme" content="light dark">
${L.favicons()}
<meta name="robots" content="noindex">
<title>${esc(T(title))} — MARS!platz</title>
<link rel="stylesheet" href="/station.css?v=${V}">
<link rel="stylesheet" href="/aura.css?v=${V}">
<link rel="stylesheet" href="/sheet.css?v=${V}">
<link rel="stylesheet" href="/screen.css?v=${V}">
<link rel="stylesheet" href="/neu.css?v=${V}">${lite ? `
<link rel="stylesheet" href="/screen-lite.css?v=${V}">` : ''}
${L.clientTable(lang)}
</head><body class="landing${inner ? ' inner' : ''} screen screen-${name}" data-screen="${name}" data-fit="${fit}"${fitLandscape ? ` data-fit-landscape="${fitLandscape}"` : ''}${minWidth ? ` data-min-width="${minWidth}"` : ''} data-tz="${esc(m.timezone)}" data-v="${V}">
${screenSky({ still: lite })}
${ticker}
<main class="stage${head ? '' : ' no-head'}${stage ? ` ${stage}` : ''}">${head ? `
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

/** The habitat's instruments, live, read from across a room — as a head-up display (12 October: "make the actual
    screens/habitat look like this" — the mock-up in the screens' own dress — "make all the tiles from the original screen
    show up one after another"): over it all the name, Habitat, with LIVE beside it, and at the right the day of the run,
    the date, the place and the clock; in the middle the landing page's way from the Earth to the habitat — the dome, Red
    Dust City, the dashed line with the signal going up it and the answer coming down, the latest picture out of the
    habitat on one side of it and the latest exchange on the other, the signal's time and the distance beside it, and the
    Earth at the foot with its dawn and its rings of dots (landing.js); at the left and at the right a column of the
    Sensors panel's own tiles, live — every one of them, a page of them at a time, the next page coming tile by tile,
    one after another, every few seconds (public/screen-habitat-hud.js): the instruments, the stores, Karlsruhe, the
    steps, the volatile organic compounds and the astronauts at the left; the current crew, the power, the bike, the
    hardware's charts and the trends at the right; along the top the running line (the ticker — 12 October: "move the
    ticker to the top"; it ran along the foot for an hour). Each tile is the
    dashboard's, drawn as the rolled screen drew it and shown smaller to fit its column, so it reads as it did; the
    tiles are kept live by the scripts that always kept them (habitat.js, hardware.js, live.js, screen-habitat-fx.js).
    The rolled screen (8 October: "a vertical layout with scrolling, to show all the content clearly and slowly" — the
    panel filling the screen, its rows rolling by under its head: screen-roll.js) is there still, at ?roll=1. */
function habitat(ctx, d) {
  const p = P.dashboardPanels(ctx, d, { trendsInside: true });
  const live = ['/habitat.js', '/hardware.js', '/live.js'];
  if (ctx.roll) return shell(ctx, { name: 'habitat', title: 'Habitat', body: `<div class="screen-roll" id="screen-roll">${p.habitat}</div>`, fit: 'roll', scripts: live.concat('/screen-roll.js', '/screen-habitat-fx.js') });
  return shell(ctx, { name: 'habitat', title: 'Habitat', body: habitatHud(ctx, d, p), fit: 'roll', stage: 'is-hud',
    scripts: live.concat(d.cloud ? ['/cloud.js'] : [], '/screen-habitat-fx.js', '/screen-habitat-hud.js') });
}

/* "Thu 15 Oct", "Do 15 Okt", "jeu 15 oct" — a day short, in the screen's language, without the dots */
const LOCALES = { en: 'en-GB', de: 'de-DE', fr: 'fr-FR' };
function dayShort(iso, lang) {
  const d = new Date(String(iso) + 'T12:00:00Z');
  if (isNaN(d.getTime())) return String(iso || '');
  try {
    const o = {};
    new Intl.DateTimeFormat(LOCALES[lang] || 'en-GB', { weekday: 'short', day: 'numeric', month: 'short', timeZone: 'UTC' })
      .formatToParts(d).forEach((x) => { o[x.type] = x.value.replace(/\.$/, ''); });
    return `${o.weekday} ${o.day} ${o.month}`;
  } catch { return String(iso); }
}

/** The head-up display's markup (habitat, above): the running line, the head, the two columns the tiles are shown in
    (empty — the script stands the tiles over them), the way from the Earth to the habitat in the middle, and — unseen
    until the script has laid them out — the current crew's card and the Sensors panel, whose tiles they are. */
function habitatHud(ctx, d, p) {
  const T = ctx.T, m = ctx.mission, lang = ctx.lang || 'de', tz = m.timezone, g = ctx.geo || {};
  const pad = (n) => String(n).padStart(2, '0');
  const SKY = require('./sky');
  // the head: the name and LIVE (while there is a habitat to be live), and the day, the date, the place and the clock
  const sol = m.phase === 'ACTIVE' ? `SOL <b>${pad(m.clampedDay)}</b> / ${pad(m.totalDays)}` : m.phase === 'PRE_LAUNCH' ? `T−<b>${m.countdown.days}</b>D` : esc(T('Mission complete'));
  const head = `
    <header class="hh-head">
      <h1 class="hh-title">${esc(T('Habitat'))}${m.phase === 'COMPLETE' ? '' : `<span class="cloud-live hh-live"><i></i>${T('LIVE')}</span>`}</h1>
      <p class="hh-meta">${sol} · ${esc(dayShort(m.today, lang))} · Karlsruhe, MARS<b class="bang">!</b>platz <b class="hh-clock" id="hh-clock">${esc(`${String(m.venueTime || '').slice(0, 5)} ${require('../../lib/mission').zoneAbbr(new Date(), tz)}`.trim())}</b></p>
    </header>`;
  // the latest exchange, answered, and the latest picture — kept current by the script (the board's, the strip's)
  const ex = SKY.exchanges(d.recent || [], T), x = ex.find((e) => e.reply) || ex[0] || null;
  // (the officer who answered as the board's notes name them — "Kommandantin", "Science officer": public.js, noteCard)
  const raw = x ? (d.recent || []).find((m) => m.id === x.id) : null, shownAs = require('../../lib/officer').shown;
  const rwho = raw && raw.responder ? T(shownAs(raw.responder).charAt(0) + shownAs(raw.responder).slice(1).toLowerCase()) : T('Crew');
  const pic = SKY.pictures(d.cloud, tz)[0] || null;
  const msg = `
        <div class="hh-note hh-msg" id="hh-msg"${x ? ` data-id="${esc(String(x.id))}"` : ' hidden'} data-q="${esc(T('Question'))}" data-a="${esc(T('Answer'))}">
          <span class="hh-note-k"><i></i>${T('Latest message:')}</span>
          <span class="hh-q-k">${x ? `${esc(T('Question'))} · ${esc(x.who)}${SKY.stamp(x.at, tz) ? ` · ${esc(SKY.stamp(x.at, tz))}` : ''}` : ''}</span>
          <span class="hh-q">${x ? esc(x.text) : ''}</span>
          <span class="hh-a"${x && x.reply ? '' : ' hidden'}><span class="hh-a-k">${x && x.reply ? `${esc(T('Answer'))} · ✧ ${esc(rwho)}` : ''}</span><span class="hh-a-t">${x && x.reply ? esc(x.reply) : ''}</span></span>
          <i class="hh-bk tl"></i><i class="hh-bk tr"></i><i class="hh-bk bl"></i><i class="hh-bk br"></i>
        </div>`;
  const shot = `
        <div class="hh-note hh-pic" id="hh-pic"${pic ? ` data-id="${esc(String(pic.id))}"` : ' hidden'}>
          <span class="hh-note-k"><i></i>${T('Latest image')}</span>
          <span class="hh-pic-frame"><img src="${pic ? esc(pic.thumb) : ''}" alt="" decoding="async"></span>
          <span class="hh-pic-when">${pic ? esc(String(pic.when).replace(/(\d{2})\.(\d{2})\.\d{4}/, '$1.$2')) : ''}</span>
          <i class="hh-bk tl"></i><i class="hh-bk tr"></i><i class="hh-bk bl"></i><i class="hh-bk br"></i>
        </div>`;
  const signal = g.lightSeconds ? `<span class="hh-signal">↑ ${esc(require('../../lib/orbital').formatLightTime(g.lightSeconds))} · ${Math.round(g.distanceKm / 1e6)} ${esc(T('M km'))}</span>` : '';
  // the middle: the landing page's way from the Earth to the habitat, its own drawing and its own classes (sheet.css)
  const centre = `
    <div class="hh-centre" aria-hidden="true">
      <div class="space-stars"></div>
      <div class="space-dome">
        <img class="space-dome-img" src="/space/habitat.webp" alt="" width="${LP.HABITAT.w}" height="${LP.HABITAT.h}" decoding="async">
        <span class="space-tag space-tag-dome">RED DUST CITY</span>
      </div>
      <i class="space-line"></i>
      ${shot}
      <div class="hh-side">${msg}${signal}
      </div>
      <div class="space-earth">
        <img class="space-earth-img" src="/space/earth.webp" alt="" width="${LP.EARTH.w}" height="${LP.EARTH.h}" decoding="async">
        ${LP.halo('desk')}
      </div>
    </div>`;
  // the current crew, as the landing page's card has them (landing.js, crewNow): the sol and its date over the title
  const content = require('../../lib/content'), SOL = require('./sol'), now = content.crewNow(m);
  const when = now && now.day != null ? `SOL ${pad(now.day)} · ${dayShort(require('../../lib/mission').dateForDay(now.day), lang)}` : T('The crew is not named yet');
  const crew = `
      <section class="tile hh-crew" id="hh-crew" aria-label="${esc(T('Current Crew'))}">
        <span class="hh-crew-k">${esc(when)}</span>
        <h3>${esc(T('Current Crew'))}</h3>${SOL.crewList(ctx, { crew: SOL.CREW, onShift: (now && now.crew) || {} })}
      </section>`;
  // the pictures' strip, unseen: cloud.js keeps it in line with the folder, and the latest picture follows it
  const strip = d.cloud ? `<div class="screen-hidden"><div class="cloud-latest" id="cloud-latest" data-version="${esc(d.cloud.snapshot.version || '')}" data-poll="${(Number(d.cloud.snapshot.checkSeconds) || 20) * 1000}">${M.cloudLatestInner(T, d.cloud, { tz })}</div></div>` : '';
  return `<div class="screen-roll hab-hud" id="hab-hud" data-hold="12000" data-tz="${esc(tz)}" data-lang="${esc(lang)}">
    ${P.ticker(ctx, { today: d.today })}
    <div class="hh-grid">${head}
      <div class="hh-col hh-left" id="hh-left"></div>${centre}
      <div class="hh-col hh-right" id="hh-right"></div>
    </div>
    <div class="hh-deck" id="hh-deck">${crew}
      ${p.habitat}
    </div>
    ${strip}
  </div>`;
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
    <div class="hud-bl hud-read"><span class="hud-k">${esc(T('Local time'))} · Karlsruhe, MARS<b>!</b>platz</span><span class="hud-v hud-clock" id="hud-clock">${esc(`${m.venueTime || ''} ${require('../../lib/mission').zoneAbbr(new Date(), m.timezone)}`.trim())}</span></div>${signal ? `
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
  // a screen's own name only — never what every object carries (/screen/constructor answered with the page's context
  // as JSON, /screen/__proto__ with a 500)
  return Object.prototype.hasOwnProperty.call(BUILD, name) ? BUILD[name](ctx, d) : null;
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
      <p class="screen-index-note">${T('Every screen is dark and in German unless its address says otherwise:')} <code>?theme=light</code> · <code>?lang=en</code> · <code>?lang=fr</code> — ${T('for example')} <code>/screen/board?lang=en&amp;theme=light</code>. ${T('What the site keeps live stays live on the screen; a screen reloads itself only when the station is started anew, and at midnight, when the sol turns.')}</p>
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
