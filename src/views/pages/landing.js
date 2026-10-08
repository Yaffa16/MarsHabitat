'use strict';
/**
 * The landing page: four pages — the way to the habitat (space, below):
 * the Earth at the foot of the screen, the habitat far above it, a dashed
 * line between them and the latest exchanges and pictures coming and going
 * around it (sky.js, public/sky.js), with the station's name, the eyebrow,
 * the paragraph on what the site is for and the run at its left on a wider
 * screen and over it on a phone (intro); the two calls — the doors to the
 * composer and the dashboard (the note on what MARS is that stood beside
 * them is gone; the About page tells it); the habitat itself (dome.js) — the dome on its
 * sheet, its keys floating about it; and the world's slowest chat — its
 * welcome, then what becomes of a message written here, in three steps:
 * transmit, transit, downlink. (The mission's two chapters that stood between
 * the note and the chat are gone: the About page tells the mission.)
 * A phone opens on the words and the room under them, the room a screen of
 * its own on the next swipe. On a phone the chat ends in the door to the
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

/* ---------------------------------------------------------------- P01 */
/** The first page's words, at the left of the room on a wider screen and over it on a phone (October: "shift the
    Earth–habitat visual to the right and have this on the left"): the eyebrow — ZKM | Hertzlab • Durational
    performance — the station's name, MARS!platz, with Ground Station under it (the page's one heading), the paragraph
    on what MARS! is for (the note's, moved up here), and the run — its dates, the sols, and how far off or along it is.
    Drawn once; sheet.css lays it beside the room or over it. */
function intro(ctx) {
  const T = ctx.T, m = ctx.mission;
  const pre = m.phase === 'PRE_LAUNCH', n = m.daysUntilStart;
  const now = pre ? `${T('opens in')} ${n} ${T(n === 1 ? 'day' : 'days')}`
    : m.phase === 'ACTIVE' ? `SOL ${String(m.clampedDay).padStart(2, '0')} ${T('of')} ${m.totalDays}` : T('Mission complete');
  return `
    <div class="sheet-intro">
      <p class="intro-eyebrow">ZKM | Hertzlab <span class="intro-dot" aria-hidden="true">•</span> ${T('Durational performance')}</p>
      <h1 class="wordmark">MARS<span class="bang">!</span>platz<span class="wm-sep"> : </span><span class="wm-ground">${T('Ground Station')}</span></h1>
      <p class="intro-text">${T(INTRO_TEXT)}</p>
      <p class="run-dates"><b>${esc(m.runLabel)}</b> · ${m.totalDays} ${T('sols in the habitat')} · <span class="run-now">${now}</span></p>
    </div>`;
}
/** What MARS! is for, in October's words: on the first page beside the room (intro), where the note had it. */
const INTRO_TEXT = 'MARS! turns the Karlsruhe Marktplatz into MARS!platz. Can we go to Mars to save the Earth? Three astronauts are finding out, and you can help! Write them a message, have a look on the mission dashboard to find out if their food supply is running low or see what they’re currently researching.';

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
 * data-sky-round — and keeps them current). A field of stars behind it all. The words — the name, the
 * eyebrow, the paragraph, the run — stand at the room's left on a wider screen and over it on a phone (intro;
 * sheet.css). On the Earth, the nudge to scroll on (scrollNudge). Decorative
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
    ${intro(ctx)}
    <div class="space-room" id="space-room">
      <div class="space-stars" aria-hidden="true"></div>
      <div class="space-dome" data-sky-solid aria-hidden="true">
        <img class="space-dome-img" src="/space/habitat.png" alt="" width="${HABITAT.w}" height="${HABITAT.h}" decoding="async">
        <span class="space-tag space-tag-dome" data-sky-solid>RED DUST CITY</span>
      </div>
      <i class="space-line" data-sky-solid aria-hidden="true"></i>
      ${groundDish()}
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

/** The ground station's dish, at the line's foot on the Earth (8 October: "after the dot has come back from the habitat
 *  to Earth, show a satellite radio beaming it into space"): a small parabolic dish standing on the limb just left of
 *  the line, turned up and away from it, faint while the signal climbs and the answer comes down; the moment the answer
 *  reaches the Earth it lights up — its waves going out from the feed, a dashed beam drawn up into the dark, fading as
 *  it goes (it stops short of the sky's exchanges, which stand close to the line), and a bright dot sent along it into
 *  the dark — then dims again until the next round. One round of the line with it: thirteen seconds (sheet.css,
 *  space-up, space-down, dish-on, dish-shot). Drawn in its own pixels, the beam running on past the little box
 *  (overflow); still, faint, where less motion is asked for. On a desk the first stretch of the beam's way is kept free
 *  of the sky's exchanges and pictures (an unseen box the sky keeps clear of, space-beam-zone). */
function groundDish() {
  return `<i class="space-dish" data-sky-solid aria-hidden="true"><svg class="dish-svg" viewBox="-22 -30 44 30" width="44" height="30">
        <path class="dish-feet" d="M-7 0H7"/>
        <g transform="rotate(-35)">
          <defs><linearGradient id="dish-fade" gradientUnits="userSpaceOnUse" x1="0" y1="-23" x2="0" y2="-320"><stop class="df-0" offset="0"/><stop class="df-1" offset="1"/></linearGradient></defs>
          <path class="dish-beam" d="M0 -23V-320"/>
          <g class="dish-waves"><path d="M-6 -26.5A8.5 8.5 0 0 1 6 -26.5"/><path d="M-10 -30.5A14 14 0 0 1 10 -30.5"/><path d="M-14 -35A19.5 19.5 0 0 1 14 -35"/></g>
          <g class="dish-body"><path d="M0 0V-8"/><path class="dish-cup" d="M-11 -14Q0 -2 11 -14Z"/><path d="M0 -8V-19"/></g>
          <circle class="dish-feed" cx="0" cy="-20" r="2"/>
          <circle class="dish-shot" cx="0" cy="-22" r="3.2"/>
        </g>
      </svg></i>
      <i class="space-beam-zone" data-sky-solid aria-hidden="true"></i>`;   // the beam's way kept free: the sky places nothing over it (a desk; sheet.css)
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

/* ---------------------------------------------------------------- the second page */
/** The second page: the two calls (calls, below) — the page's doors to the composer and to the dashboard — side by side
    on a desk, one under the other on a phone (`crew`: how many dots the live card's radar carries). The note that stood beside them (MARS! – Mobilizing Awareness for
    Resilient Societies! – is a three-part project…) is gone: October asked for the box to go; the About page tells the
    project. The section keeps its id, `note`: the nudge on the Earth and the phone's scroll lead to it. */
function note(ctx, { crew = 3 } = {}) {
  const T = ctx.T;
  return `
  <section class="sheet sheet-p2" id="note" aria-label="${esc(T('Write to the crew, or follow them'))}" data-page>
    <div class="page2 is-calls">
      ${calls(ctx, { crew })}
    </div>
  </section>`;
}

/* ---------------------------------------------------------------- the two calls */
/**
 * The two calls of the station, the second page (note, above): two doors side by side — one to the composer, one to
 * the dashboard — each a large card with a drawing across its whole width and its words under it, set large enough to
 * read from a step back (8 October: "increase the size of the two boxes … text clearly readable; the visualisation
 * should span across the width, bigger and clearer; add a visualisation for the Live Mission Dashboard also").
 *
 * The first, in Mars: TRANSMIT — SEND A MESSAGE TO THE CREW — and, as the thing to know, that every message mission
 * control approves is beamed into space. Its drawing: the dish sending at the foot, its waves going out, the dashed way
 * up into space with a signal going along it again and again, the way ending in the open with INTO SPACE over its end
 * (October: "have nothing there"); the two states a message passes on the way, WRITTEN and APPROVED, each a station on
 * it with its name on the drawing's foot line. The thing to know is set large, in capitals, in Mars.
 *
 * The second, in cobalt: FOLLOW WHAT THE CREW IS DOING LIVE (no dash in it since 8 October), with a LIVE pill on its
 * line. Its drawing is the radar of the astronauts tracked, in the middle, its sweep going round and the crew's dots
 * wandering (aura.css and live.js draw and move it, as on the dashboard) — the three instruments beside it and the
 * drawing's lines went on 8 October.
 *
 * The whole card is the door (a phone's Write door leads to the Write page, tabbar.js). sheet.css lays them out and
 * moves what moves; asked for less motion, the drawings stand.
 */
function calls(ctx, { crew = 3 } = {}) {
  const T = ctx.T;
  const f1 = (v) => String(+v.toFixed(1));
  /* ---- the transmitting drawing (600 × 200): the dish at the foot, a parabola facing up and to the right, its feed at
     the focus and a stand under it (drawn at 1.3 its first size); its waves going out from the focus; the dashed way from
     the dish's mouth up into space (a cubic), WRITTEN and APPROVED stations on it — each with a dashed drop to its name on
     the foot line — and INTO SPACE over its open end; the signal along it (SMIL; sheet.css hides the signal where less
     motion is asked for) */
  const P = [[118, 112], [220, 70], [400, 52], [548, 46]];
  const bez = (t) => { const k = 1 - t, [a, b, c, d] = P; return [0, 1].map((i) => +(k * k * k * a[i] + 3 * k * k * t * b[i] + 3 * k * t * t * c[i] + t * t * t * d[i]).toFixed(1)); };
  const atX = (x) => { let lo = 0, hi = 1; for (let i = 0; i < 30; i++) { const m = (lo + hi) / 2; if (bez(m)[0] < x) lo = m; else hi = m; } return bez((lo + hi) / 2); };
  const WAY = `M${P[0][0]} ${P[0][1]} C ${P[1][0]} ${P[1][1]}, ${P[2][0]} ${P[2][1]}, ${P[3][0]} ${P[3][1]}`;
  const FOOT = 190;                                                                          // the foot line the stations' names stand on
  const station = (x, word) => { const [sx, sy] = atX(x); return `
            <line class="call-drop" x1="${sx}" y1="${f1(sy + 9)}" x2="${sx}" y2="${FOOT - 22}"/>
            <circle cx="${sx}" cy="${sy}" r="5"/><text x="${sx}" y="${FOOT}">${esc(T(word).toUpperCase())}</text>`; };
  const F = [74, 88];                                                                       // the focus, the waves' centre (in the dish's own units)
  const wave = (r) => { const a0 = -82 * Math.PI / 180, a1 = -8 * Math.PI / 180; return `M${(F[0] + r * Math.cos(a0)).toFixed(1)} ${(F[1] + r * Math.sin(a0)).toFixed(1)} A${r} ${r} 0 0 1 ${(F[0] + r * Math.cos(a1)).toFixed(1)} ${(F[1] + r * Math.sin(a1)).toFixed(1)}`; };
  const transmit = `
        <svg class="call-art call-art-tx" viewBox="0 0 600 200" preserveAspectRatio="xMidYMid meet" aria-hidden="true">
          <defs>
            <linearGradient id="call-way" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="var(--mars)" stop-opacity=".2"/><stop offset="1" stop-color="var(--mars)" stop-opacity=".95"/></linearGradient>
            <path id="call-way-path" d="${WAY}"/>
          </defs>
          <g class="call-grid">${[22, 56, 90, 124, 158].map((y) => `<line x1="0" y1="${y}" x2="600" y2="${y}"/>`).join('')}</g>
          <g transform="translate(4 6) scale(1.3)">
            <g class="call-dish">
              <path d="M60 104 L50 136"/><path d="M36 136 h30"/>
              <path d="M57 64 Q 42 122 100 107" class="call-dish-cup"/><path d="M60 104 L${F[0]} ${F[1]}"/>
              <circle cx="${F[0]}" cy="${F[1]}" r="3" class="call-dish-feed"/>
            </g>
            <g class="call-waves"><path d="${wave(20)}"/><path d="${wave(33)}"/><path d="${wave(46)}"/></g>
          </g>
          <path class="call-way-line" d="${WAY}"/>
          <g class="call-stations">${station(236, 'Written')}${station(420, 'Approved')}
          </g>
          <g class="call-hab">
            <text x="598" y="24">${esc(T('Into space').toUpperCase())}</text>
          </g>
          <circle class="call-sig" r="5"><animateMotion dur="4.2s" repeatCount="indefinite" calcMode="spline" keySplines=".3 0 .4 1" keyTimes="0;1"><mpath href="#call-way-path"/></animateMotion></circle>
          <circle class="call-sig is-tail" r="3"><animateMotion dur="4.2s" begin="0.25s" repeatCount="indefinite" calcMode="spline" keySplines=".3 0 .4 1" keyTimes="0;1"><mpath href="#call-way-path"/></animateMotion></circle>
        </svg>`;

  /* ---- the live drawing (600 × 200): the radar of the astronauts in the middle, as the dashboard draws it — its sweep
     going round, the crew's dots wandering (aura.css, live.js). The three instruments that stood at its left and the
     drawing's faint lines are gone (8 October: "remove the temp, humidity etc. and the lines"). */
  const ticks = Array.from({ length: 48 }, (_, i) => {
    const a = (i / 48) * Math.PI * 2, long = i % 6 === 0, r1 = long ? 50 : 53, r2 = 57;
    return `<line x1="${(60 + r1 * Math.cos(a)).toFixed(2)}" y1="${(60 + r1 * Math.sin(a)).toFixed(2)}" x2="${(60 + r2 * Math.cos(a)).toFixed(2)}" y2="${(60 + r2 * Math.sin(a)).toFixed(2)}"${long ? ' class="dl-tick-l"' : ''}/>`;
  }).join('');
  const nCrew = Math.max(1, Math.min(6, crew));
  const astros = Array.from({ length: nCrew }, (_, i) => { const a = (i / nCrew) * Math.PI * 2 + 0.6, r = 22 + (i % 2) * 10; return `<circle class="dl-astro" cx="${(60 + r * Math.cos(a)).toFixed(1)}" cy="${(60 + r * Math.sin(a)).toFixed(1)}" r="3"/>`; }).join('');
  const live = `
        <svg class="call-art call-art-live" viewBox="0 0 600 200" preserveAspectRatio="xMidYMid meet" aria-hidden="true">
          <svg class="dl-radar call-radar" x="206" y="6" width="188" height="188" viewBox="0 0 120 120">
            <defs><linearGradient id="dl-sweep" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="var(--cobalt)" stop-opacity="0"/><stop offset="1" stop-color="var(--cobalt)" stop-opacity=".7"/></linearGradient></defs>
            <g class="dl-ticks">${ticks}</g>
            <circle class="dl-ring" cx="60" cy="60" r="47"/>
            <circle class="dl-ring dl-dash" cx="60" cy="60" r="34"/>
            <circle class="dl-ring dl-dash" cx="60" cy="60" r="21"/>
            <circle class="dl-ring" cx="60" cy="60" r="8"/>
            <line class="dl-cross" x1="60" y1="13" x2="60" y2="107"/><line class="dl-cross" x1="13" y1="60" x2="107" y2="60"/>
            <g class="dl-sweep"><path d="M60 60 L60 13 A47 47 0 0 1 93.2 26.8 Z" fill="url(#dl-sweep)"/><line x1="60" y1="60" x2="60" y2="13"/></g>
            <g class="dl-crew">${astros}</g>
          </svg>
        </svg>`;
  return `
    <div class="calls" id="calls">
      <a class="call call-write" href="#write">
        ${transmit}
        <div class="call-text">
          <span class="call-k">01 · ${T('Transmit')}</span>
          <h2 class="call-title">${T('Send a message to the crew')}</h2>
          <p class="call-punch"><strong class="call-beam">${T('Approved messages are beamed into space')}</strong></p>
          <p class="call-body">${T('Mission control reads every message. The ones it approves are beamed into space by radio.')}</p>
          <span class="call-key is-write">${T('Write to the crew')} <span aria-hidden="true">→</span></span>
        </div>
      </a>
      <a class="call call-live" href="/dashboard">
        ${live}
        <div class="call-text">
          <span class="call-k">02 · ${T('Live feed')} <span class="call-livepill"><i aria-hidden="true"></i>${T('LIVE')}</span></span>
          <h2 class="call-title">${T('Follow what the crew is doing live')}</h2>
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
        ${stepHead('up', '01', T('Transmit'))}
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
