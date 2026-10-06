'use strict';
/**
 * The landing page: four pages — the way to the habitat (space, below):
 * the Earth at the foot of the screen, the habitat far above it, a dashed
 * line between them and the latest exchanges and pictures coming and going
 * around it (sky.js, public/sky.js), with the station's name over it on a
 * wider screen; a note on what MARS is and what this website is for, with
 * the doors to the composer and the dashboard and a key to the About page
 * (Know more) for the rest; the habitat itself (dome.js) — the dome on its
 * sheet, its keys floating about it; and the world's slowest chat — its
 * welcome, then what becomes of a message written here, in three steps:
 * uplink, transit, downlink. (The mission's two chapters that stood between
 * the note and the chat are gone: the About page tells the mission.)
 * A phone opens on the first page alone, the whole screen, and has the name
 * at the head of the note (the next page); a wider screen has the name in a
 * band over the first page. On a phone the chat ends in the door to the
 * composer; on a wider screen the portal and the dashboard follow on the
 * same page (public.js).
 *
 * The words are the handoff's; the figures in them are the station's own: the
 * day the run begins, the distance to Mars and the one-way light-time today,
 * the length of the crossing as the station simulates it (TRANSIT_SECONDS,
 * read the way server.js reads it), the visitor's own callsign on the example
 * message (the one the composer carries), and the hour the crew's
 * communication window opens (WINDOW_TIME, windowWhen), written with the
 * venue's zone as the station names it — CET, in every language, all through
 * the run (the hour itself is the venue's own, Europe/Berlin, on either side
 * of 25 October, when the clocks go back).
 *
 * Also the line under the dome (underLine): it turns every few seconds
 * through what is happening in the habitat now, the signal's time and the
 * habitat's reading, a few older exchanges and the last answered ones — never
 * a message still waiting for mission control or one it turned down.
 */
const { esc } = require('../layout');
const orbital = require('../../lib/orbital');
const { stamp, responder } = require('./sky');

const WINDOW_TIME = '19:00';                                 // the crew answer from seven in the evening — the communication hour — every day of the run
const LOCALE = { en: 'en-GB', de: 'de-DE', fr: 'fr-FR' };

/** "15 October", "15. Oktober", "15 octobre". */
function dayMonth(iso, lang) {
  try { return new Date(iso + 'T12:00:00Z').toLocaleDateString(LOCALE[lang] || 'en-GB', { day: 'numeric', month: 'long', timeZone: 'UTC' }); }
  catch { return iso; }
}
/** The venue's zone, as the station names it everywhere and in every language: CET — never the summer-time
    abbreviation (CEST, MESZ), whatever the day; the clock itself keeps the venue's own time (Europe/Berlin). */
const ZONE = 'CET';
function zoneName() { return ZONE; }
/** When the crew answer, as every page writes it — the hour and the venue's zone: "19:00 CET". The ticker (public.js)
    writes it too. */
function windowWhen(ctx) {
  const m = ctx.mission;
  const zone = zoneName(m.today || m.start_date, m.timezone, ctx.lang || 'en');
  return `${WINDOW_TIME}${zone ? ' ' + zone : ''}`;
}

/** A sentence of the dictionary with its live figures put in ({date}, {time}, …), the figures already escaped. */
const fill = (T, key, vals) => Object.entries(vals).reduce((s, [k, v]) => s.split(`{${k}}`).join(v), esc(T(key)));

/** A sheet's label row: its subject, in small capitals (a page's number and name used to stand at its left; none now). */
const meta = (left, right = '', cls = '') => `<div class="sheet-meta${cls ? ' ' + cls : ''}"><span>${left}</span>${right ? `<span>${right}</span>` : ''}</div>`;

/* ---------------------------------------------------------------- P01 */
/** The station's name — MARS!platz : Ground Station — the line under it and the run — in the band over the first page on
    a wider screen (`desk`: the name large in the top left corner, the line and the run beside it on its baseline), at
    the head of the note on a phone, where the first page has the screen to itself (`phone`); each is drawn where it is
    shown, and the other is not drawn at all (sheet.css). */
function intro(ctx, where = 'desk') {
  const T = ctx.T, m = ctx.mission;
  const pre = m.phase === 'PRE_LAUNCH', n = m.daysUntilStart;
  const now = pre ? `${T('opens in')} ${n} ${T(n === 1 ? 'day' : 'days')}`
    : m.phase === 'ACTIVE' ? `SOL ${String(m.clampedDay).padStart(2, '0')} ${T('of')} ${m.totalDays}` : T('Mission complete');
  const H = where === 'desk' ? 'h1' : 'p';                            // one heading for the page: the name over the habitat
  return `
    <div class="sheet-intro is-${where}">
      <${H} class="wordmark">MARS<span class="bang">!</span>platz<span class="wm-sep"> : </span><span class="wm-ground">${T('Ground Station')}</span></${H}>
      <p class="tagline"><b>ZKM | Hertzlab</b></p>
      <p class="run-dates"><b>${esc(m.runLabel)}</b> · ${m.totalDays} ${T('sols in the habitat')} · <span class="run-now">${now}</span></p>
    </div>`;
}

/* ---------------------------------------------------------------- the first page: Earth to the habitat */
/**
 * The first screen, after the mock-up: the Earth at the foot of the page —
 * a photograph of its limb from orbit (public/space/earth.jpg), the horizon
 * curving away, and over it a mesh of dots that thins out quickly with
 * height; the habitat far above it at the top — the geodesic dome as a line
 * drawing (public/space/habitat.png), white on the night, named Red Dust
 * City in Mars orange; and the way a message goes between them: on a phone
 * a dashed line straight up, with a signal climbing it and the crew's answer
 * coming down; on a wider screen the Earth stands in the lower left corner
 * of the room, its horizon curving away, the habitat in the north-east, and
 * between them **the trajectory** (trajectory, below): an arc leaving the
 * horizon straight up, rising to the habitat and carrying on past it into
 * space — the signal climbs it, flares at the habitat, the answer comes back
 * down it while the signal goes on into the dark. Around it the latest
 * exchanges with Earth and the newest pictures out of the habitat come and
 * go (sky.js draws them into the page; public/sky.js places them clear of
 * the Earth, the habitat and the line or the arc — data-sky-solid,
 * data-sky-round — and keeps them current). A field of stars behind it all. The name and the run
 * stand in the band over it on a wider screen (intro); a phone has the page
 * to itself. On the Earth, the nudge to scroll on (scrollNudge). Decorative
 * but for the sky's items: the drawing is hidden from assistive technology,
 * and the exchanges are the board's own.
 *
 * The Earth's picture is 1414 × 340 (EARTH), its bright limb a circle of
 * radius 997 centred at (674, 1079) in it, its apex 82 down from the top
 * (24 % of the height; the haze above it is fainter). The one picture
 * serves by night and by day (October: "the same image for day and night —
 * the default night image"): the light theme leaves the room as it is by
 * night, space with the same Earth at its foot (the day strip once cut from
 * Earth_Day.png, public/space/earth-day.jpg, stays on disk, unused). The mesh is rings of
 * dots about that circle, from just over the limb up — every ring the same
 * angular pitch (pathLength puts the dashes in degrees), so the dots line
 * up along the radii too, into a mesh — a set for a desk and a closer set
 * for a phone (sheet.css shows one). The line down from the habitat ends on
 * the limb (sheet.css puts the limb's apex at --earth-arc). The habitat's
 * drawing is 1004 × 699 (HABITAT), its axis down the middle and its front
 * foot 97 % of the way down.
 */
const EARTH = { w: 1414, h: 340, cx: 674, cy: 1079, r: 997 };
const HABITAT = { w: 1004, h: 699, foot: 0.971 };
function halo(kind) {
  // desk: rings 13 apart, dots 0.6° apart; phone (the picture a quarter the size): rings 32 apart, dots 2.2° apart;
  // the first just over the limb, each ring fainter than the one under it, gone within a few
  const rings = kind === 'phone' ? { from: 14, step: 32, n: 10, dash: 4.4 } : { from: 8, step: 13, n: 10, dash: 1.2 };
  return `<svg class="space-halo is-${kind}" viewBox="0 0 ${EARTH.w} ${EARTH.h}" aria-hidden="true"><g fill="none" stroke="#fff" stroke-linecap="round" stroke-dasharray="0 ${rings.dash}">${
    Array.from({ length: rings.n }, (_, k) => `<circle cx="${EARTH.cx}" cy="${EARTH.cy}" r="${EARTH.r + rings.from + k * rings.step}" pathLength="720" opacity="${(0.72 * Math.pow(0.72, k)).toFixed(3)}"/>`).join('')
  }</g></svg>`;
}
function space(ctx, { sky = null } = {}) {
  const T = ctx.T;
  // the globe, for the sky to keep clear of: the horizon's circle, as a box the width of its diameter about its centre
  // (data-r sets the radius the sky keeps clear of as a part of that width: the horizon and a little of the mesh)
  const globe = `left:${(100 * (EARTH.cx - EARTH.r) / EARTH.w).toFixed(2)}%;top:${(100 * (EARTH.cy - EARTH.r) / EARTH.h).toFixed(2)}%;width:${(200 * EARTH.r / EARTH.w).toFixed(2)}%`;
  return `
  <section class="sheet sheet-p0 space" id="top" aria-label="${esc(T('From Earth to the habitat'))}" data-page>
    ${intro(ctx, 'desk')}
    <div class="space-room" id="space-room">
      <div class="space-stars" aria-hidden="true"></div>
      <div class="space-dome" data-sky-solid aria-hidden="true">
        <img class="space-dome-img" src="/space/habitat.png" alt="" width="${HABITAT.w}" height="${HABITAT.h}" decoding="async">
        <span class="space-tag space-tag-dome" data-sky-solid>RED DUST CITY</span>
      </div>
      <i class="space-line" data-sky-solid aria-hidden="true"></i>
      ${trajectory()}
      <div class="space-earth" aria-hidden="true">
        <img class="space-earth-img" src="/space/earth.jpg" alt="" width="${EARTH.w}" height="${EARTH.h}" decoding="async">
        ${halo('desk')}${halo('phone')}
        <i class="space-globe" data-sky-round data-r="0.52" style="${globe}"></i>
      </div>
      ${sky ? sky.html : ''}
      ${scrollNudge(ctx)}
    </div>
  </section>`;
}

/** The trajectory, on a wider screen (sheet.css shows it there and the vertical line on a phone): the way a message
 *  goes, drawn as an arc of a great circle from the Earth's horizon — leaving it straight up from the ground, as a
 *  launch does — to the habitat's front foot in the north-east, and on from the habitat's far side into space, where it
 *  thins and fades (no line crosses the habitat). Along it: a white signal climbs to the habitat and flares there; the crew's answer comes back down the arc in
 *  Mars orange while the signal carries on, out past the habitat, into the dark. The paths are set by public/sky.js
 *  from where the layout puts the Earth and the habitat (the trajectory); the motion is the SVG's own (SMIL) along
 *  them, ten seconds a round, and stands still where motion is asked to be less (sheet.css). */
function trajectory() {
  const T = 10;                                         // one round: up, the flare, back and on, a pause
  const motion = (path, pts, times) => `<animateMotion dur="${T}s" repeatCount="indefinite" calcMode="linear" keyPoints="${pts}" keyTimes="${times}" rotate="0"><mpath href="#${path}"/></animateMotion>`;
  const fade = (values, times) => `<animate attributeName="opacity" dur="${T}s" repeatCount="indefinite" calcMode="linear" values="${values}" keyTimes="${times}"/>`;
  return `
      <svg class="space-arc" id="space-arc" aria-hidden="true">
        <defs>
          <linearGradient id="arc-fade" gradientUnits="userSpaceOnUse" x1="0" y1="0" x2="0" y2="0"><stop offset="0" stop-color="#fff" stop-opacity=".55"/><stop offset="1" stop-color="#fff" stop-opacity="0"/></linearGradient>
        </defs>
        <path class="arc-up" id="arc-up" d="M0 0"/>
        <path class="arc-on" id="arc-on" d="M0 0"/>
        <circle class="arc-flare" r="3">${fade('0;0;.9;0;0', '0;.4;.42;.5;1')}<animate attributeName="r" dur="${T}s" repeatCount="indefinite" values="2;2;16;2;2" keyTimes="0;.4;.47;.5;1"/></circle>
        <circle class="arc-sig" r="4">${motion('arc-up', '0;1;1', '0;.4;1')}${fade('0;1;1;0;0', '0;.03;.39;.42;1')}</circle>
        <circle class="arc-ans" r="4">${motion('arc-up', '1;1;0;0', '0;.46;.86;1')}${fade('0;0;1;1;0;0', '0;.46;.49;.83;.87;1')}</circle>
        <circle class="arc-far" r="3">${motion('arc-on', '0;0;1;1', '0;.42;.8;1')}${fade('0;0;1;0;0', '0;.42;.5;.8;1')}</circle>
      </svg>`;
}

/* ---------------------------------------------------------------- the note */
/** The second page: what MARS! is and what this website is for (the words of October's text sheet), and under the
    note the two calls (calls, below) — the page's doors to the composer and to the dashboard. The project's name at the
    head of the lead is a link to the project's page at ZKM. */
const ZKM_MARS = 'https://zkm.de/en/projects/mars';
function note(ctx) {
  const T = ctx.T;
  // the first word is the project's name, set bold and linked, in every language
  const lead = esc(T('MARS! – Mobilizing Awareness for Resilient Societies! – is a three-part project of ZKM | Karlsruhe, the current part being a 13-day field test of prototypes and experiments in the heart of Karlsruhe.'))
    .replace(/^MARS!/, `<a class="note-project" href="${ZKM_MARS}" target="_blank" rel="noopener"><b>MARS!</b></a>`);
  // the second page: the station's name at its head on a phone, the note, and beside it (under it on a phone) the two
  // calls — the doors of the page (no keys under the note's words any more: the two cards are the doors; the About
  // page is the header's)
  // on a desk the note stands at the left and the two calls one over the other at its right (page2, sheet.css); a phone
  // stacks them, the note first
  return `
  <section class="sheet sheet-p2" id="note" aria-label="${esc(T('Durational performance'))}" data-page>
    ${intro(ctx, 'phone')}
    <div class="page2">
      <div class="note-card">
        ${meta(T('Durational performance'), '', 'is-ruled')}
        <div class="note-body">
          <p class="note-lead">${lead}</p>
          <div class="note-aside">
            <p class="note-more">${T('MARS! turns the Marktplatz into MARS!platz. Can we go to Mars to save the Earth? Three astronauts are finding out, and you can help! Write them a message, have a look on the mission dashboard to find out if their food supply is running low or see what they’re currently researching.')}</p>
          </div>
        </div>
      </div>
      ${calls(ctx)}
    </div>
  </section>`;
}

/* ---------------------------------------------------------------- the two calls */
/**
 * The two calls of the station, under the note on the second page (note, above; the grid alone is drawn here): two
 * doors side by side — one to the composer, one to the dashboard — each a card with its words under a drawing, or
 * without one. The first, in Mars: SEND A MESSAGE TO THE CREW — and, as the thing to know, that
 * every message mission control approves is sent into space: a dish at the foot of the drawing sending, its waves
 * going out, the dashed way up into space, a signal going along it again and again, and nothing at the way's end but
 * the words — the way ends in the open, the signal goes off it (October: first no dome on the Mars disc, then no disc
 * at all, "have nothing there"); under the way the three states a message goes through, WRITTEN · APPROVED · INTO
 * SPACE; the Write key (the count of messages sent into space so far is not written any more — data.counts,
 * sentToSpace, stays). The thing to
 * know is set large, in capitals, in a gradient of Mars and light with a glow and a shimmer passing along it now and
 * then — APPROVED MESSAGES ARE BEAMED INTO SPACE (October: "the entire part should look exciting"; the galaxy it was
 * cut out of for an hour stays drawn, tools/galaxy.py and public/space/galaxy.jpg, unused). The second, in cobalt,
 * carries no drawing: FOLLOW WHAT THE CREW IS DOING — LIVE with a LIVE pill on its line, its sentence, the dashboard's
 * key (no count of messages sent into space, no line of what the crew are doing and no "Thirteen sols, as they happen":
 * October asked for all three to go).
 * The whole card is the door (a phone's Write door leads to the Write page, tabbar.js). sheet.css lays them out and
 * moves what moves; asked for less motion, the drawing stands.
 */
function calls(ctx) {
  const T = ctx.T;
  // the uplink's drawing: the dish sending at the foot — a parabola facing up and to the right, its feed at the focus, a
  // stand under it — its waves going out from the focus, the dashed way from the dish's mouth up into space (a cubic;
  // WRITTEN and APPROVED stand on it, points of the curve; INTO SPACE under its open end), the signal along it (SMIL; sheet.css
  // hides the signal where less motion is asked for)
  const P = [[88, 82], [170, 54], [320, 42], [468, 40]];
  const bez = (t) => { const k = 1 - t, [a, b, c, d] = P; return [0, 1].map((i) => +(k * k * k * a[i] + 3 * k * k * t * b[i] + 3 * k * t * t * c[i] + t * t * t * d[i]).toFixed(1)); };
  const WAY = `M${P[0][0]} ${P[0][1]} C ${P[1][0]} ${P[1][1]}, ${P[2][0]} ${P[2][1]}, ${P[3][0]} ${P[3][1]}`;
  const [wx, wy] = bez(0.16), [ax, ay] = bez(0.56);
  const F = [74, 88];                                                                       // the focus, the waves' centre
  const wave = (r) => { const a0 = -82 * Math.PI / 180, a1 = -8 * Math.PI / 180; return `M${(F[0] + r * Math.cos(a0)).toFixed(1)} ${(F[1] + r * Math.sin(a0)).toFixed(1)} A${r} ${r} 0 0 1 ${(F[0] + r * Math.cos(a1)).toFixed(1)} ${(F[1] + r * Math.sin(a1)).toFixed(1)}`; };
  const uplink = `
        <svg class="call-art" viewBox="0 0 560 150" preserveAspectRatio="xMidYMid meet" aria-hidden="true">
          <defs>
            <linearGradient id="call-way" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="var(--mars)" stop-opacity=".15"/><stop offset="1" stop-color="var(--mars)" stop-opacity=".9"/></linearGradient>
            <path id="call-way-path" d="${WAY}"/>
          </defs>
          <g class="call-grid">${[20, 46, 72, 98, 124].map((y) => `<line x1="0" y1="${y}" x2="560" y2="${y}"/>`).join('')}</g>
          <g class="call-dish">
            <path d="M60 104 L50 136"/><path d="M36 136 h30"/>
            <path d="M57 64 Q 42 122 100 107" class="call-dish-cup"/><path d="M60 104 L${F[0]} ${F[1]}"/>
            <circle cx="${F[0]}" cy="${F[1]}" r="3" class="call-dish-feed"/>
          </g>
          <g class="call-waves"><path d="${wave(24)}"/><path d="${wave(38)}"/><path d="${wave(52)}"/></g>
          <path class="call-way-line" d="${WAY}"/>
          <g class="call-stations">
            <circle cx="${wx}" cy="${wy}" r="4"/><text x="${wx}" y="${wy + 20}">${esc(T('Written').toUpperCase())}</text>
            <circle cx="${ax}" cy="${ay}" r="4"/><text x="${ax}" y="${ay + 20}">${esc(T('Approved').toUpperCase())}</text>
          </g>
          <g class="call-hab">
            <text x="${P[3][0]}" y="${P[3][1] + 20}">${esc(T('Into space').toUpperCase())}</text>
          </g>
          <circle class="call-sig" r="4"><animateMotion dur="4.2s" repeatCount="indefinite" calcMode="spline" keySplines=".3 0 .4 1" keyTimes="0;1"><mpath href="#call-way-path"/></animateMotion></circle>
          <circle class="call-sig is-tail" r="2.5"><animateMotion dur="4.2s" begin="0.25s" repeatCount="indefinite" calcMode="spline" keySplines=".3 0 .4 1" keyTimes="0;1"><mpath href="#call-way-path"/></animateMotion></circle>
        </svg>`;
  return `
    <div class="calls" id="calls">
      <a class="call call-write" href="#write">
        ${uplink}
        <div class="call-text">
          <span class="call-k">01 · ${T('Uplink')}</span>
          <h2 class="call-title">${T('Send a message to the crew')}</h2>
          <p class="call-punch"><strong class="call-beam">${T('Approved messages are beamed into space')}</strong></p>
          <p class="call-body">${T('Mission control reads every message. The ones it approves are beamed into space by radio.')}</p>
          <span class="call-key is-write">${T('Write to the crew')} <span aria-hidden="true">→</span></span>
        </div>
      </a>
      <a class="call call-live" href="/dashboard">
        <div class="call-text">
          <span class="call-k">02 · ${T('Live feed')} <span class="call-livepill"><i aria-hidden="true"></i>${T('LIVE')}</span></span>
          <h2 class="call-title">${T('Follow what the crew is doing — live')}</h2>
          <p class="call-body">${T('The habitat’s sensors, today’s mission and schedule, the galley, the crew’s reports and moods — live from Red Dust City, every day of the run.')}</p>
          <span class="call-key is-dash">${T('Live Mission Dashboard')} <span aria-hidden="true">→</span></span>
        </div>
      </a>
    </div>`;
}

/* ---------------------------------------------------------------- the chat's heading */
/** A part's heading: its name, large and bold; a short orange rule — and its welcome under it. */
function partHead(T, { title, id = '', lead = '' }) {
  return `
    <header class="part-head">
      <h2 class="part-title"${id ? ` id="${id}"` : ''}>${esc(T(title))}</h2>
      <i class="part-rule" aria-hidden="true"></i>${lead ? `\n      <p class="part-lead">${lead}</p>` : ''}
    </header>`;
}

/* ---------------------------------------------------------------- the world's slowest chat */
/* The three steps' signs, line drawings in the hand of the habitat's keys: the dish sending the message up, the signal on
   its arc from Earth to Mars, the crew's answer as a speech bubble with a spark in it. */
const ICON = {
  up: '<path d="M4.6 12.8a6 6 0 0 0 8.5 0L4.6 4.3a6 6 0 0 0 0 8.5z"/><path d="M8.8 8.6l3-3"/><circle cx="12.4" cy="5" r="1" fill="currentColor" stroke="none"/><path d="M8 14.5l-1.6 5.5h5"/><path d="M15.5 3.5a4 4 0 0 1 4 4"/><path d="M16 .9a6.8 6.8 0 0 1 6.1 6.1" style="opacity:.55"/>',
  transit: '<circle cx="5" cy="18.5" r="2.6"/><circle cx="19" cy="5.5" r="2.6" fill="currentColor" style="fill-opacity:.18"/><path d="M7.4 16.4C8 10 11 7.2 16.4 6.3" style="stroke-dasharray:1.6 2.6"/><circle cx="11.2" cy="9.4" r="1.2" fill="currentColor" stroke="none"/>',
  down: '<path d="M5 4.5h14a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2h-7.5L7 20v-3.5H5a2 2 0 0 1-2-2v-8a2 2 0 0 1 2-2z"/><path d="M12 7.3l.95 2.25 2.25.95-2.25.95L12 13.7l-.95-2.25-2.25-.95 2.25-.95z" fill="currentColor" stroke="none"/>',
};
/** A step's head: its sign in a small tinted disc, its number and its name. */
const stepHead = (k, n, name) => `<div class="step-k"><span class="step-ic" aria-hidden="true"><svg viewBox="0 0 24 24">${ICON[k]}</svg></span><span class="step-l"><b>${n}</b>${name}</span></div>`;

function slowChat(ctx) {
  const T = ctx.T;
  const b = (s) => `<b>${esc(s)}</b>`;
  const km = Math.round(ctx.geo.distanceKm / 1e6);
  const light = orbital.formatLightTime(ctx.geo.lightSeconds);
  const secs = Number(process.env.TRANSIT_SECONDS || 12);
  const crossing = `${secs} ${T(secs === 1 ? 'second' : 'seconds')}`;
  const when = windowWhen(ctx);                                            // "19:00 CET"
  const me = ctx.callsign || ctx.offer || '';
  return `
  <section class="sheet sheet-p4" id="slowest-chat" aria-labelledby="ch-03-title" data-page>
    ${partHead(T, { title: 'Welcome to the World’s Slowest Chat (that also zips into space!)', id: 'ch-03-title',
      lead: fill(T, 'As our ground station personnel, you can discuss the question of the day with us, send us messages about things we should know or find out for you or send a message to space via our habitat. The Comms Officer will answer your messages personally. You can also drop us a postcard on MARS!platz or come to our daily Communication Hour at {time} to speak to us directly.', { time: esc(when) }) })}
    <p class="steps-how">${T('How it works:')}</p>
    <ol class="steps" aria-label="${esc(T('How a message reaches the crew'))}">
      <li class="step s-up">
        ${stepHead('up', '01', T('Uplink'))}
        <div class="step-body">
          <h3>${T('Send a message')}</h3>
          <div class="step-card is-earth">${me ? `<span class="step-who">${esc(me)}</span>` : ''}${T('Have you checked your CO₂ sensors lately? They seem to be running dangerously high')}</div>
          <p>${T('Your message from Earth will travel to Mars to reach the crew on MARS!platz, where it will be seen and answered accordingly.')}
            <span class="step-space">${T('At the same time, your message will also travel into space. Click on the Message Board to see how far your message has gone. Keep it family friendly.')}</span></p>
        </div>
      </li>
      <li class="step s-transit">
        ${stepHead('transit', '02', T('Transit'))}
        <div class="step-body">
          <h3>${T('Signal in transit')}</h3>
          <div class="transit" aria-hidden="true" data-seconds="${secs}"><span class="transit-earth">${T('Earth')}</span><span class="transit-track"><i style="animation-duration:${secs}s"></i></span><span class="transit-mars">${T('Mars')}</span></div>
          <p class="transit-meta">${km} ${T('M km')} · ${esc(light)}</p>
          <p>${T('The signal is on its way.')} ${fill(T, 'Under real conditions, a message can take {range} to reach Mars — today it takes {now}.', { range: b(T('4 to 22 minutes')), now: b(light) })}
            ${fill(T, 'Each chat response will require {range}.', { range: b(T('8 to 44 minutes')) })}
            ${fill(T, 'For this simulation, the transmission takes {time}.', { time: b(crossing) })}</p>
        </div>
      </li>
      <li class="step s-down">
        ${stepHead('down', '03', T('Downlink'))}
        <div class="step-body">
          <h3>${T('Crew response')}</h3>
          <p class="step-flag">${T('Downlink received')}</p>
          <div class="step-card is-crew"><span class="step-who">${T('Crew answer')}</span>${T('Yes, CO₂ levels were elevated. We took countermeasures and sensors indicate we are back at normal parameters. Thanks for the heads up!')}</div>
          <p>${fill(T, 'Messages will be answered during the day and can be viewed on the {board}. Also, at {time}, the daily communication window opens where people on MARS!platz can communicate directly with the crew.', { board: `<a class="step-link" href="/write#exchanges">${esc(T('message board'))}</a>`, time: b(when) })}</p>
        </div>
      </li>
    </ol>
    <p class="p4-cta"><a class="sheet-cta" href="#write"><span>${T('Write to the crew')}</span><span aria-hidden="true">→</span></a></p>
  </section>`;
}

/* ---------------------------------------------------------------- the line under the dome */
const shuffle = (a) => { a = a.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
const clip = (t, n = 140) => { t = String(t || '').replace(/\s+/g, ' ').trim(); return t.length > n ? t.slice(0, n - 1).trimEnd() + '…' : t; };

/**
 * What the line under the dome takes turns through, as a JSON block and the
 * first of it drawn in place (public/sky.js turns it every six seconds): what
 * the crew are doing now; the signal's one-way time; the habitat's latest
 * reading (the header's running line has it); the sol, or
 * the countdown before the run; the last three answered exchanges, question
 * then answer; and a few older published messages, picked afresh for every
 * page. Only published exchanges are ever in it.
 */
function underLine(ctx, { recent = [], today = null } = {}) {
  const T = ctx.T, m = ctx.mission, g = ctx.geo, tz = m.timezone;
  const pre = m.phase === 'PRE_LAUNCH', over = m.phase === 'COMPLETE';
  // what the crew are doing at this minute, as the header's running line says it (public.js, ticker)
  const hm = String(m.venueTime || '').slice(0, 5);
  let task = null;
  for (const t of (today && today.tasks) || []) if (t.time <= hm) task = t;
  const doing = task ? `${task.time} · ${task.label}${task.detail ? ` — ${task.detail}` : ''}` : T('off the schedule');
  const pub = recent.filter((x) => x.state === 'PUBLISHED');
  const answered = pub.filter((x) => x.response_body)
    .sort((a, b) => String(b.response_at || b.submitted_at).localeCompare(String(a.response_at || a.submitted_at))).slice(0, 3);
  const older = shuffle(pub.filter((x) => !answered.includes(x))).slice(0, 4);
  const q = (x) => ({ id: x.id, meta: [x.callsign, stamp(x.submitted_at, tz)].filter(Boolean).join(' · '), text: clip(x.body) });
  const a = (x) => ({ id: x.id, meta: ['✧ ' + responder(x, T), stamp(x.response_at, tz)].filter(Boolean).join(' · '), text: clip(x.response_body), crew: 1 });
  const left = m.totalDays - m.clampedDay;
  const pool = {
    now: pre ? { meta: T('Now in the habitat'), text: T('The run has not begun yet.') }
      : over ? { meta: T('Now in the habitat'), text: T('Mission complete') }
        : { meta: T('Now in the habitat'), live: 'tk-now', text: doing },
    data: [
      { meta: T('One-way signal'), text: `${orbital.formatLightTime(g.lightSeconds)} ${T('at the speed of light')}` },
      { meta: T('Habitat reading'), live: 'tk-hab', text: '' },
      pre ? { meta: T('Countdown'), live: 'tk-count', text: `T−${m.countdown.days}d`, after: T('to occupation') }
        : over ? { meta: `SOL ${m.totalDays}/${m.totalDays}`, text: T('Mission complete') }
          : { meta: `SOL ${String(m.clampedDay).padStart(2, '0')}/${String(m.totalDays).padStart(2, '0')}`,
            text: left > 0 ? `${T('Sol')} ${m.clampedDay} ${T('of')} ${m.totalDays} · ${left} ${T(left === 1 ? 'sol to go' : 'sols to go')}` : `${T('Sol')} ${m.clampedDay} ${T('of')} ${m.totalDays} · ${T('the last day')}` },
    ],
    ex: answered.map((x) => [q(x), a(x)]),
    old: older.map(q),
  };
  const first = pool.now;                                     // the line opens with what is happening now
  const json = JSON.stringify(pool).replace(/</g, '\\u003c');
  return `
      <div class="hab-line" id="hab-line">
        <p class="hab-line-item"><span class="hab-line-meta">${esc(first.meta)}</span><span class="hab-line-text">${esc(first.text)}</span></p>
        <script type="application/json" id="hab-line-data">${json}</script>
      </div>`;
}

/* ---------------------------------------------------------------- the nudge */
/**
 * What stands at the foot of the first page, on the Earth: an arrow pointing
 * down, on its own, that bobs gently, nudging the visitor to scroll on to the
 * pages beneath (public/sky.js hides it once the page has been scrolled). It
 * is a link to the next page, so it works as a key too. (It stood on the
 * floor under the habitat's ground line while the habitat was the first
 * page.) The line that used to turn under the dome (underLine, above) is kept
 * for the run, unused.
 */
function scrollNudge(ctx) {
  const T = ctx.T;
  return `
      <a class="dome-nudge" id="dome-nudge" href="#note" data-sky-solid aria-label="${esc(T('Scroll down'))}" title="${esc(T('Scroll down'))}">
        <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 4v15"/><path d="M5.5 12.5 12 19l6.5-6.5"/></svg>
      </a>`;
}

module.exports = { intro, space, calls, note, slowChat, underLine, scrollNudge, trajectory, WINDOW_TIME, ZONE, windowWhen, dayMonth, zoneName };
