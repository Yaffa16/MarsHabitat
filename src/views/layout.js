'use strict';
const orbital = require('../lib/orbital');

/* Static assets are served with a one-hour cache. Stamping every stylesheet
   and script URL with the server's boot time means a restarted or rebuilt
   station always pushes fresh assets to every browser — no hard refresh
   needed in the gallery. */
const ASSET_V = Date.now().toString(36);

const esc = (s) => String(s ?? '')
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;').replace(/'/g, '&#39;');

// Communication is what this station is for, so it leads. The habitat data
// and the crew are context for the message you are about to write.
// Writing a message and reading the replies both happen on the landing page,
// so neither needs a tab of its own.
// The mission page carries the habitat, the crew, the day and the messages, so
// the bar stays at three. Everything else is reachable from the foot.
// Everything public is on the landing page; the bar on the remaining
// subpages (the archive, sign-in, 404) points into its sections.
const NAV = [
  ['/', 'Mission'],
  ['/#exchanges', 'Messages'],
  ['/at-a-glance', 'At a Glance'],
  ['/logbook', 'Crew log'],
  ['/#about', 'About'],
];

/** The fixed rail. Present on every page, public and control alike.
 *  The landing page gets the MARS!PLATZ variant: no brand chip, no day cell
 *  (the masthead already carries the day), cells spread across the width and
 *  the visitor's callsign in orange. */
function rail(ctx, landing = false) {
  const g = ctx.geo;
  const link = ctx.commsUp ? 'LINK NOMINAL' : 'LINK DEGRADED';
  const themeCell = `
    <form method="post" action="/theme" class="rail-cell theme">
      <input type="hidden" name="to" value="${ctx.theme === 'dark' ? 'light' : 'dark'}">
      <button type="submit" title="Switch to ${ctx.theme === 'dark' ? 'light' : 'dark'} mode">
        <span class="theme-mark" aria-hidden="true"></span>${ctx.theme === 'dark' ? 'Light' : 'Dark'}
      </button>
    </form>`;
  if (landing) {
    return `<div class="rail">
    <div class="rail-cell link"><span class="dot ${ctx.commsUp ? 'ok' : 'warn'}"></span> ${link}</div>
    <div class="rail-cell">EARTH–MARS <b>${g.distanceAu.toFixed(3)} au</b></div>
    <div class="rail-cell">ONE WAY <b>${orbital.formatLightTime(g.lightSeconds)}</b></div>
    <div class="rail-cell opt">${esc(ctx.mission.elapsed)}</div>
    ${ctx.callsign ? `<div class="rail-cell">YOU <b class="you">${esc(ctx.callsign)}</b></div>` : ''}
    ${themeCell}
  </div>`;
  }
  return `<div class="rail">
    <div class="rail-cell rail-brand">MCS</div>
    <div class="rail-cell">DAY <b>${ctx.mission.missionDay < 1 ? '--' : String(ctx.mission.missionDay).padStart(3, '0')}</b></div>
    <div class="rail-cell opt">${esc(ctx.mission.elapsed)}</div>
    <div class="rail-cell opt">EARTH–MARS <b>${g.distanceAu.toFixed(3)} au</b></div>
    <div class="rail-cell narrow-opt">ONE WAY <b>${orbital.formatLightTime(g.lightSeconds)}</b></div>
    <div class="rail-cell opt">${esc(g.trend)}</div>
    <div class="rail-cell push"><span class="dot ${ctx.commsUp ? 'ok' : 'warn'}"></span> ${link}</div>
    ${ctx.callsign ? `<div class="rail-cell narrow-opt">YOU <b>${esc(ctx.callsign)}</b></div>` : ''}
    ${themeCell}
  </div>`;
}

/* The masthead's right-hand side. The station's readings — link state, the
   T-clock, the Earth–Mars gap, the visitor's callsign — used to sit here as
   a row of pills; the rail at the head of the dashboard carries what is
   needed, so only the theme switch remains. */
function statusStrip(ctx) {
  return `<div class="status" role="group" aria-label="Display">
    <form method="post" action="/theme" class="theme">
      <input type="hidden" name="to" value="${ctx.theme === 'dark' ? 'light' : 'dark'}">
      <button type="submit" title="Switch to ${ctx.theme === 'dark' ? 'light' : 'dark'} mode">
        <span class="theme-mark" aria-hidden="true"></span>${ctx.theme === 'dark' ? 'Light' : 'Dark'}
      </button>
    </form>
  </div>`;
}

function nav(current) {
  return `<nav class="nav">${NAV.map(([href, label]) =>
    `<a href="${href}"${href === current ? ' aria-current="page"' : ''}>${label}</a>`
  ).join('')}</nav>`;
}

/**
 * The masthead every public page opens with: the wordmark, one line under
 * it, the run named plainly, and the theme switch on the right.
 * On the landing page the wordmark is the title; on the inner pages it is
 * the way home. The inner pages then carry the same pill row as a nav.
 */
function masthead(ctx, { home = false } = {}) {
  const m = ctx.mission;
  const pre = m.phase === 'PRE_LAUNCH';
  const mark = `Mars<span class="bang">!</span>platz`;
  return `
  <header class="masthead">
    <div>
      <h1 class="wordmark">${home ? mark : `<a href="/" title="Back to the station">${mark}</a>`}</h1>
      <p class="tagline">Communication Station · <b>ZKM | Hertzlab</b> — ${pre
        ? 'the only way to reach the crew, once they are inside'
        : 'the only way to reach the crew'}</p>
      <p class="run-dates"><b>${esc(m.runLabel)}</b> · ${m.totalDays} sols in the habitat${pre
        ? ` · opens in ${m.daysUntilStart} day${m.daysUntilStart === 1 ? '' : 's'}`
        : m.phase === 'ACTIVE' ? ` · SOL ${String(m.clampedDay).padStart(2, '0')} of ${m.totalDays}` : ''}</p>
    </div>
    ${statusStrip(ctx)}
  </header>`;
}

/** The inner pages' navigation: the same pills as the About row, one per page. */
function pageNav(current) {
  return `<nav class="page-nav" aria-label="Pages">${NAV.map(([href, label]) =>
    `<a href="${href}"${href === current ? ' aria-current="page"' : ''}>${label}</a>`
  ).join('')}</nav>`;
}

function foot(ctx) {
  return `<div class="foot">
    <div class="foot-links">
      <a href="/#write">Write</a><a href="/#exchanges">Messages</a>
      <a href="/#mission">Daily mission</a><a href="/#habitat">Habitat</a>
      <a href="/#crew">Crew</a><a href="/at-a-glance">At a Glance</a><a href="/logbook">Crew log</a><a href="/#about">About</a>
      <a href="/control">Mission control</a>
    </div>
    <div class="foot-base">
      <span class="foot-brand">ZKM | HERTZLAB — MARS</span>
      <span>SIGNAL DELAY ${orbital.formatLightTime(ctx.geo.lightSeconds)} ONE WAY</span>
    </div>
  </div>`;
}

/**
 * `hero` renders full-bleed above the rail — the landing page passes its
 * Mars-surface masthead through it. `hideNav` drops the top navigation on
 * pages whose links live in the footer instead (the landing page, per the
 * MARS!PLATZ layout).
 */
function page({ title, ctx, body, current, bodyClass = '', head = '', scripts = [],
                hero = '', hideNav = false, hideRail = false }) {
  return `<!doctype html>
<html lang="en" data-theme="${ctx.theme === 'dark' ? 'dark' : 'light'}"><head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="color-scheme" content="light dark">
<title>${esc(title)} — Mars Communication Station</title>
<meta name="description" content="A live communication interface between an Earth-based audience and the crew of the MARS habitat.">
<link rel="stylesheet" href="/station.css?v=${ASSET_V}">
${head}
</head><body class="${bodyClass}">
${hero}
${hideRail ? '' : rail(ctx, bodyClass.includes('landing'))}
${bodyClass.includes('control') || bodyClass.includes('habitat') || hideNav ? '' : nav(current)}
<main class="shell">${body}</main>
${bodyClass.includes('control') || bodyClass.includes('habitat') ? '' : foot(ctx)}
${scripts.map((s) => `<script src="${s}?v=${ASSET_V}" defer></script>`).join('')}
</body></html>`;
}

/* ------------------------------------------------------------------ pieces */

/**
 * Status as a mark rather than a hue, after the mission-outcome key on the
 * reference poster: filled centre = nominal, single bar = caution, crossed =
 * out of range, empty ring = no signal. Legible printed, projected, or by
 * someone who cannot separate red from white.
 */
const SYMBOL_KEY = [
  ['ok', 'Nominal'], ['warn', 'Caution'], ['bad', 'Out of range'], ['none', 'No signal'],
];
const sym = (state) => `<span class="sym ${state || 'none'}" aria-hidden="true"></span>`;
const legend = () => `<div class="legend">${SYMBOL_KEY.map(([k, l]) =>
  `<span>${sym(k)} ${l}</span>`).join('')}</div>`;

const panel = (chan, inner, cls = '') =>
  `<section class="panel ${cls}"><span class="chan">${esc(chan)}</span>${
    cls.includes('banded') ? '<div class="hatch" style="margin:-20px -20px 18px;border-radius:2px 2px 0 0"></div>' : ''
  }${inner}</section>`;

const eyebrow = (t) => `<div class="eyebrow">${esc(t)}</div>`;

const readout = ({ label, value, unit, sub, state }) => `
  <div class="readout">
    <div class="label">${esc(label)}</div>
    <div class="value">${esc(value)}${unit ? `<small>${esc(unit)}</small>` : ''}</div>
    ${sub ? `<div class="sub">${state ? sym(state) + ' ' : ''}${esc(sub)}</div>` : ''}
  </div>`;

/**
 * The schematic orbital plot. Deliberately not an astronomical simulation:
 * two circles, two markers, one dashed chord. Its only job is to make the
 * gap legible and to give the transmission animation a track to run along.
 */
function orbitPlot(geo, { size = 460, id = 'orbit' } = {}) {
  const c = size / 2;
  const rEarth = size * 0.215;
  const rMars = size * 0.345;
  const pos = (lon, r) => {
    const a = (lon - 90) * Math.PI / 180;   // 0 degrees to the top, clockwise
    return [c + r * Math.cos(a), c + r * Math.sin(a)];
  };
  const [ex, ey] = pos(geo.earth.lonDeg, rEarth);
  const [mx, my] = pos(geo.mars.lonDeg, rMars);

  /**
   * A stepped leader: out from the point at 45 degrees, then horizontal to the
   * margin, ending in a small ring. This is the device that makes the
   * reference poster legible -- every label is tied to an exact position.
   */
  const leader = (x, y, side, row, label, accent) => {
    const dir = side === 'l' ? -1 : 1;
    const railX = side === 'l' ? size * 0.055 : size * 0.945;
    const textX = side === 'l' ? railX + 9 : railX - 9;
    const anchor = side === 'l' ? 'start' : 'end';
    const kneeY = row;
    const kneeX = x + dir * Math.abs(kneeY - y);
    return `<g>
      <path class="leader" d="M${x.toFixed(1)},${y.toFixed(1)} L${kneeX.toFixed(1)},${kneeY.toFixed(1)} L${railX.toFixed(1)},${kneeY.toFixed(1)}"/>
      <circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="3.2" fill="none"
              stroke="${accent}" stroke-width="1"/>
      <circle cx="${railX.toFixed(1)}" cy="${kneeY.toFixed(1)}" r="1.6" fill="${accent}"/>
      <text x="${textX.toFixed(1)}" y="${(kneeY + 3).toFixed(1)}" text-anchor="${anchor}"
            class="orbit-label" fill="${accent}">${label}</text>
    </g>`;
  };

  // Tick marks every 30 degrees of heliocentric longitude, on an outer ring
  const ticks = Array.from({ length: 12 }, (_, i) => {
    const a = (i * 30 - 90) * Math.PI / 180;
    const r1 = size * 0.415, r2 = size * 0.44;
    return `<line x1="${(c + r1 * Math.cos(a)).toFixed(1)}" y1="${(c + r1 * Math.sin(a)).toFixed(1)}"
      x2="${(c + r2 * Math.cos(a)).toFixed(1)}" y2="${(c + r2 * Math.sin(a)).toFixed(1)}"
      stroke="currentColor" stroke-width="0.75" opacity="0.45"/>`;
  }).join('');

  // Decorative concentric rings, as on the poster, carrying no data
  const rings = [0.265, 0.295, 0.385, 0.41].map((f) =>
    `<circle cx="${c}" cy="${c}" r="${(size * f).toFixed(1)}" fill="none"
       stroke="currentColor" stroke-width="0.75" opacity="0.14"/>`).join('');

  const earthSide = ex < c ? 'l' : 'r';
  const marsSide = mx < c ? 'l' : 'r';

  return `<div class="orbit-frame">
  <svg viewBox="0 0 ${size} ${size}" id="${id}" role="img" style="color:var(--ink)"
       aria-label="Plot of Earth and Mars in their orbits around the Sun. Current separation ${geo.distanceAu.toFixed(2)} astronomical units.">
    ${rings}${ticks}
    <circle cx="${c}" cy="${c}" r="${rEarth}" class="orbit-line" stroke-width="0.75"/>
    <circle cx="${c}" cy="${c}" r="${rMars}" class="orbit-line" stroke-width="0.75" stroke-dasharray="1.5 4"/>

    <!-- the Sun, drawn as a registration target -->
    <circle cx="${c}" cy="${c}" r="9" fill="none" stroke="currentColor" stroke-width="1.25"/>
    <line x1="${c - 14}" y1="${c}" x2="${c + 14}" y2="${c}" stroke="currentColor" stroke-width="1"/>
    <line x1="${c}" y1="${c - 14}" x2="${c}" y2="${c + 14}" stroke="currentColor" stroke-width="1"/>
    <circle cx="${c}" cy="${c}" r="3" fill="currentColor"/>

    <line id="${id}-chord" x1="${ex.toFixed(1)}" y1="${ey.toFixed(1)}"
          x2="${mx.toFixed(1)}" y2="${my.toFixed(1)}" class="orbit-chord"/>

    <circle cx="${ex.toFixed(1)}" cy="${ey.toFixed(1)}" r="5" fill="currentColor"/>
    <circle cx="${mx.toFixed(1)}" cy="${my.toFixed(1)}" r="7" fill="#ff6a00"
            stroke="currentColor" stroke-width="1.25"/>

    ${leader(ex, ey, earthSide, size * 0.13, 'EARTH', 'currentColor')}
    ${leader(mx, my, marsSide, size * 0.87, 'MARS · HABITAT', '#ff6a00')}

    <circle id="${id}-packet" r="3.5" fill="#ff6a00" stroke="currentColor" stroke-width="1" opacity="0"/>
  </svg>
  <div class="orbit-caption">
    <div><span class="k">Separation</span><span class="v">${geo.distanceAu.toFixed(3)} au</span></div>
    <div><span class="k">Distance</span><span class="v">${(geo.distanceKm / 1e6).toFixed(1)} M km</span></div>
    <div><span class="k">One-way signal</span><span class="v">${orbital.formatLightTime(geo.lightSeconds)}</span></div>
    <div><span class="k">Geometry</span><span class="v">${geo.trend} · ${geo.separationDeg.toFixed(0)}°</span></div>
  </div>
</div>`;
}

/** Line chart for a sensor metric. Plain SVG, no chart library. */
function sparkline(points, { min, max, warnMin, warnMax, colour = 'var(--earth)' } = {}) {
  if (!points.length) return '<div class="empty">NO READINGS ON THIS CHANNEL</div>';
  const w = 600, h = 56, pad = 3;
  const vals = points.map((p) => p.value);
  let lo = Math.min(...vals, min ?? Infinity);
  let hi = Math.max(...vals, max ?? -Infinity);
  if (!isFinite(lo) || !isFinite(hi)) { lo = Math.min(...vals); hi = Math.max(...vals); }
  if (hi - lo < 0.6) { hi += 0.3; lo -= 0.3; }
  const x = (i) => pad + (i / Math.max(1, points.length - 1)) * (w - pad * 2);
  const y = (v) => h - pad - ((v - lo) / (hi - lo)) * (h - pad * 2);

  const d = points.map((p, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)},${y(p.value).toFixed(1)}`).join('');
  let band = '';
  if (warnMin != null && warnMax != null) {
    const yTop = y(warnMax), yBot = y(warnMin);
    band = `<rect class="band" x="0" y="${Math.max(0, yTop).toFixed(1)}" width="${w}"
             height="${Math.max(0, yBot - yTop).toFixed(1)}"/>`;
  }
  return `<svg class="spark" viewBox="0 0 ${w} ${h}" preserveAspectRatio="none" aria-hidden="true">
    ${band}<path d="${d}" stroke="${colour}"/>
  </svg>`;
}

const MESSAGE_STATES = [
  'DRAFT', 'TRANSMITTED', 'IN_TRANSIT', 'ARRIVED',
  'PENDING_APPROVAL', 'APPROVED', 'RESPONSE', 'PUBLISHED',
];

function pipeline(current) {
  const idx = MESSAGE_STATES.indexOf(current);
  return `<div class="pipe">${MESSAGE_STATES.map((s, i) => {
    const cls = i < idx ? 'past' : i === idx ? 'at' : '';
    return `<div class="${cls}">${s.replace(/_/g, ' ')}</div>`;
  }).join('')}</div>`;
}

/**
 * The mission as a row of markers, after the planet-scale bar at the foot of
 * the reference. Thirteen days is few enough to show every one.
 */
function scaleStrip(mission) {
  const total = mission.totalDays;
  return `<div class="scale">${Array.from({ length: total }, (_, i) => {
    const n = i + 1;
    const cls = n === mission.missionDay ? 'now' : n < mission.missionDay ? 'past' : '';
    return `<div class="${cls}"><span>${String(n).padStart(2, '0')}</span><i></i></div>`;
  }).join('')}</div>`;
}

module.exports = {
  masthead, pageNav,
  page, panel, eyebrow, readout, orbitPlot, sparkline, pipeline, scaleStrip,
  statusStrip, sym, legend, SYMBOL_KEY, esc, NAV, MESSAGE_STATES,
};
