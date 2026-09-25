'use strict';
const orbital = require('../lib/orbital');

/* Static assets are served with a one-hour cache. Stamping every stylesheet
   and script URL with the server's boot time means a restarted or rebuilt
   station always pushes fresh assets to every browser — no hard refresh
   needed in the gallery. */
const ASSET_V = Date.now().toString(36);

/* The station in three languages — German, English, French — from the
   station's own dictionary (src/lib/i18n.js), switched by the DE·EN·FR
   control beside the theme switch and kept in a cookie like the theme.
   Nothing is fetched: it works with the network unplugged. `ctx.T` turns an
   English string into the visitor's language, or leaves it as written when
   no entry exists. Mission control and the archive are never translated —
   English is the mission's working language and the record is kept as
   written — so their chrome is rendered with the identity T below. */
const i18n = require('../lib/i18n');
const same = (s) => s;

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

/** The theme switch, as a form: one press flips the cookie. `cls` is the
 *  wrapper's class — a rail cell on the inner pages, a pill in the masthead. */
function themeSwitch(ctx, cls, T = ctx.T || same) {
  const dark = ctx.theme === 'dark';
  return `
    <form method="post" action="/theme" class="${cls}">
      <input type="hidden" name="to" value="${dark ? 'light' : 'dark'}">
      <button type="submit" title="${esc(T(dark ? 'Switch to light mode' : 'Switch to dark mode'))}">
        <span class="theme-mark" aria-hidden="true"></span>${T(dark ? 'Light' : 'Dark')}
      </button>
    </form>`;
}

/** The language switch: DE · EN · FR as three small buttons in one form,
 *  the current one marked. Drawn as the theme switch's twin and placed
 *  beside it — a rail cell on the inner pages, a pill in the masthead. It
 *  never appears on mission control or the archive, which stay English. */
function langSwitch(ctx, cls = 'lang', T = ctx.T || same) {
  const cur = ctx.lang || 'en';
  return `
    <form method="post" action="/lang" class="${cls}" aria-label="${esc(T('Language'))}">
      ${i18n.LANGS.map((l) => `<button type="submit" name="to" value="${l}"${
        l === cur ? ' class="on" aria-current="true"' : ''} lang="${l}">${l.toUpperCase()}</button>`).join('')}
    </form>`;
}

/** The fixed rail. Present on every page, public and control alike.
 *  The landing page gets the MARS!PLATZ variant: no brand chip, no day cell
 *  (the masthead already carries the day), cells spread across the width and
 *  the visitor's callsign in orange. `T` is the identity on mission control
 *  and the archive, where the rail stays English and carries no language
 *  switch. */
function rail(ctx, landing = false, T = ctx.T || same) {
  const g = ctx.geo;
  const link = T(ctx.commsUp ? 'LINK NOMINAL' : 'LINK DEGRADED');
  const translated = T !== same;
  const themeCell = themeSwitch(ctx, 'rail-cell theme', T);
  const langCell = translated ? langSwitch(ctx, 'rail-cell lang', T) : '';
  if (landing) {
    return `<div class="rail">
    <div class="rail-cell link"><span class="dot ${ctx.commsUp ? 'ok' : 'warn'}"></span> ${link}</div>
    <div class="rail-cell">${T('EARTH–MARS')} <b>${g.distanceAu.toFixed(3)} au</b></div>
    <div class="rail-cell">${T('ONE WAY')} <b>${orbital.formatLightTime(g.lightSeconds)}</b></div>
    <div class="rail-cell opt">${esc(ctx.mission.elapsed)}</div>
    ${ctx.callsign ? `<div class="rail-cell">${T('YOU')} <b class="you">${esc(ctx.callsign)}</b></div>` : ''}
    ${themeCell}
    ${langCell}
  </div>`;
  }
  return `<div class="rail">
    <div class="rail-cell rail-brand">MCS</div>
    <div class="rail-cell">${T('DAY')} <b>${ctx.mission.missionDay < 1 ? '--' : String(ctx.mission.missionDay).padStart(3, '0')}</b></div>
    <div class="rail-cell opt">${esc(ctx.mission.elapsed)}</div>
    <div class="rail-cell opt">${T('EARTH–MARS')} <b>${g.distanceAu.toFixed(3)} au</b></div>
    <div class="rail-cell narrow-opt">${T('ONE WAY')} <b>${orbital.formatLightTime(g.lightSeconds)}</b></div>
    <div class="rail-cell opt">${esc(T(g.trend))}</div>
    <div class="rail-cell push"><span class="dot ${ctx.commsUp ? 'ok' : 'warn'}"></span> ${link}</div>
    ${ctx.callsign ? `<div class="rail-cell narrow-opt">${T('YOU')} <b>${esc(ctx.callsign)}</b></div>` : ''}
    ${themeCell}
    ${langCell}
  </div>`;
}

/* The masthead's right-hand side. The station's readings — link state, the
   T-clock, the Earth–Mars gap, the visitor's callsign — used to sit here as
   a row of pills; the rail at the head of the dashboard carries what is
   needed, so only the theme switch and the language switch remain.
   The language switch is a drop-down: the current language shows on top;
   a press lists the others beneath it, one under the other (public/aura.css
   draws it; the ticker's script closes it on a press elsewhere). Inside is
   the same form the rail carries, so switching works as it always has. */
function statusStrip(ctx) {
  const T = ctx.T || same;
  const cur = ctx.lang || 'en';
  return `<div class="status" role="group" aria-label="${esc(T('Display'))}">
    ${themeSwitch(ctx, 'theme', T)}
    <details class="lang-menu">
      <summary class="lang-cur" title="${esc(T('Language'))}"><span lang="${cur}">${cur.toUpperCase()}</span><i class="lang-chev" aria-hidden="true"></i></summary>
      ${langSwitch(ctx, 'lang', T)}
    </details>
  </div>`;
}

function nav(current, T = same) {
  return `<nav class="nav">${NAV.map(([href, label]) =>
    `<a href="${href}"${href === current ? ' aria-current="page"' : ''}>${T(label)}</a>`
  ).join('')}</nav>`;
}

/**
 * The masthead every public page opens with: the wordmark, one line under
 * it, the run named plainly, and the theme switch on the right.
 * On the landing page the wordmark is the title; on the inner pages it is
 * the way home. The inner pages then carry the same pill row as a nav.
 */
function masthead(ctx, { home = false, status = true, lead = '', cta = '' } = {}) {
  const T = ctx.T || same;
  const m = ctx.mission;
  const pre = m.phase === 'PRE_LAUNCH';
  const mark = `MARS<span class="bang">!</span>platz`;
  const n = m.daysUntilStart;
  return `
  <header class="masthead">
    <div>
      <h1 class="wordmark">${home ? mark : `<a href="/" title="${esc(T('Back to the station'))}">${mark}</a>`}</h1>
      <p class="tagline">${T('Communication Station')} · <b>ZKM | Hertzlab</b></p>
      <p class="run-dates"><b>${esc(m.runLabel)}</b> · ${m.totalDays} ${T('sols in the habitat')}${pre
        ? ` · ${T('opens in')} ${n} ${T(n === 1 ? 'day' : 'days')}`
        : m.phase === 'ACTIVE' ? ` · SOL ${String(m.clampedDay).padStart(2, '0')} ${T('of')} ${m.totalDays}` : ''}</p>${
        lead ? `\n      <p class="lead">${lead}</p>` : ''}${cta ? `\n      <p class="masthead-cta">${cta}</p>` : ''}
    </div>
    ${status ? statusStrip(ctx) : ''}
  </header>`;
}

/** The inner pages' navigation: the same pills as the About row, one per page. */
function pageNav(current, T = same) {
  return `<nav class="page-nav" aria-label="${esc(T('Pages'))}">${NAV.map(([href, label]) =>
    `<a href="${href}"${href === current ? ' aria-current="page"' : ''}>${T(label)}</a>`
  ).join('')}</nav>`;
}

/* The bottom bar a phone gets (public/aura.css shows it under 760 px in
   portrait and nowhere else): five keys under the thumb — Home (the landing
   page), Dashboard (/dashboard), Write (the orange key, the station's one
   action — the messages page, /messages, its composer open), Media, and More,
   which opens the ticker's menu as a sheet (public/tabbar.js). */
const TAB_ICONS = {
  home: '<path d="M3.5 11.5L12 4l8.5 7.5"/><path d="M5.5 10v10h13V10"/><path d="M10 20v-6h4v6"/>',                                    // a house
  dashboard: '<rect x="3" y="3" width="7.5" height="7.5" rx="2"/><rect x="13.5" y="3" width="7.5" height="7.5" rx="2"/><rect x="3" y="13.5" width="7.5" height="7.5" rx="2"/><rect x="13.5" y="13.5" width="7.5" height="7.5" rx="2"/>',
  write: '<path d="M3 11l18-8-8 18-2-8z"/><path d="M11 13l10-10"/>',
  media: '<path d="M4 8h3l2-3h6l2 3h3v11H4z"/><circle cx="12" cy="13" r="3.5"/>',
  more: '<circle cx="5" cy="12" r="1.6"/><circle cx="12" cy="12" r="1.6"/><circle cx="19" cy="12" r="1.6"/>',
};
function tabbar(current, T = same) {
  const landing = current === '/';
  const tab = (key, href, label, extra = '') => `<a class="tab tab-${key}${extra}" data-tab="${key}" href="${href}"><svg class="tab-ic" viewBox="0 0 24 24" aria-hidden="true">${TAB_ICONS[key]}</svg><span>${T(label)}</span></a>`;
  return `<nav class="tabbar" aria-label="${esc(T('The station, page by page'))}">
    ${tab('home', '/', 'Home', landing ? ' is-on' : '')}
    ${tab('dashboard', '/dashboard', 'Dashboard', current === '/dashboard' ? ' is-on' : '')}
    ${tab('write', '/messages#write', 'Write', current === '/messages' ? ' is-on' : '')}
    ${tab('media', '/media', 'Media', current === '/media' ? ' is-on' : '')}
    <button type="button" class="tab tab-more${!landing && !['/media', '/messages', '/dashboard'].includes(current) ? ' is-on' : ''}" data-tab="more" aria-haspopup="menu" aria-controls="tk-dropdown" aria-expanded="false"><svg class="tab-ic" viewBox="0 0 24 24" aria-hidden="true">${TAB_ICONS.more}</svg><span>${T('About')}</span></button>
  </nav>`;
}

/* The cookie question, asked once on first contact (server.js, /consent):
   the facts of the station's one cookie in a few small lines, and Accept or
   Reject. A form, so it works without a script; the answer sends the visitor
   back to the page. */
function consent(current, T = same, callsign = '') {
  // The callsign the visitor has, or will get on agreeing: the one they were
  // given for this visit if they have written already, otherwise a free one
  // picked now and carried in the form, so the name greeted is the name kept.
  // Shown in the middle of the screen over a blurred page (.consent-veil,
  // aura.css), so it is read before anything else.
  return `<div class="consent-veil" id="consent-veil">
  <aside class="consent" id="consent" role="dialog" aria-modal="true" aria-labelledby="consent-title" aria-describedby="consent-text">
    <div class="consent-sky" aria-hidden="true">
      <span class="consent-stars"></span>
      <span class="consent-planet"></span>
      <span class="consent-orbit"></span>
      <svg class="consent-astro" viewBox="0 0 160 170">
        <defs>
          <linearGradient id="ca-suit" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#ffffff"/><stop offset="1" stop-color="#d9dcea"/></linearGradient>
          <radialGradient id="ca-helmet" cx=".38" cy=".3" r=".8"><stop offset="0" stop-color="#ffffff"/><stop offset=".7" stop-color="#e8eaf4"/><stop offset="1" stop-color="#c3c8dc"/></radialGradient>
          <linearGradient id="ca-visor" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#2b3a9e"/><stop offset=".55" stop-color="#121a52"/><stop offset="1" stop-color="#070a26"/></linearGradient>
          <radialGradient id="ca-mars" cx=".5" cy=".5" r=".5"><stop offset="0" stop-color="#ffb07a"/><stop offset=".6" stop-color="#ff5a1f"/><stop offset="1" stop-color="#b8330a"/></radialGradient>
          <clipPath id="ca-vclip"><path d="M50 62c0-17 13-28 30-28s30 11 30 28c0 15-12 25-30 25S50 77 50 62z"/></clipPath>
        </defs>
        <path d="M22 170c2-34 22-52 58-52s56 18 58 52z" fill="url(#ca-suit)" stroke="#b9bfd6" stroke-width="1.2"/>
        <path d="M58 124l22 12 22-12" fill="none" stroke="#c3c8dc" stroke-width="1.5"/>
        <rect x="62" y="138" width="36" height="22" rx="5" fill="#eef0f8" stroke="#b9bfd6"/>
        <circle cx="70" cy="149" r="3" fill="#ff5a1f"/><circle cx="80" cy="149" r="3" fill="#2f45e8"/><circle cx="90" cy="149" r="3" fill="#3fbf8f" class="consent-blink"/>
        <circle cx="40" cy="146" r="9" fill="#2f45e8"/><circle cx="40" cy="146" r="4.5" fill="#ff5a1f"/>
        <ellipse cx="80" cy="116" rx="30" ry="8" fill="#c9cee2"/>
        <line x1="112" y1="34" x2="122" y2="12" stroke="#b9bfd6" stroke-width="2.4" stroke-linecap="round"/>
        <circle cx="122" cy="11" r="4" fill="#ff5a1f" class="consent-blink"/>
        <circle cx="80" cy="64" r="48" fill="url(#ca-helmet)" stroke="#b9bfd6" stroke-width="1.2"/>
        <path d="M50 62c0-17 13-28 30-28s30 11 30 28c0 15-12 25-30 25S50 77 50 62z" fill="url(#ca-visor)"/>
        <g clip-path="url(#ca-vclip)">
          <circle cx="96" cy="76" r="15" fill="url(#ca-mars)" opacity=".9"/>
          <circle cx="62" cy="50" r="1" fill="#fff"/><circle cx="72" cy="72" r=".8" fill="#fff" opacity=".7"/><circle cx="88" cy="46" r=".9" fill="#fff" opacity=".8"/>
          <path d="M56 50c5-9 14-13 24-13" fill="none" stroke="#fff" stroke-width="3.2" stroke-linecap="round" opacity=".55"/>
        </g>
        <rect x="30" y="56" width="8" height="18" rx="3" fill="#d4d8e8"/><rect x="122" y="56" width="8" height="18" rx="3" fill="#d4d8e8"/>
      </svg>
      <span class="consent-signal"><i></i>${T('Incoming transmission')}</span>
    </div>
    <form method="post" action="/consent">
      <input type="hidden" name="back" value="${esc(current || '/')}">
      ${callsign ? `<input type="hidden" name="callsign" value="${esc(callsign)}">` : ''}
      <h2 id="consent-title">${T('Welcome')}${callsign ? ` <b class="consent-cs">${esc(callsign)}</b>` : ''}</h2>
      <p id="consent-text">${T('To make sure you talk to the Mars habitat under the same call sign every time, please accept. If you do not, you will be given a new name on each visit and cannot see your own messages. We do not track anything.')}</p>
      <div class="consent-keys">
        <button type="submit" name="choice" value="no" class="btn">${T('Reject')}</button>
        <button type="submit" name="choice" value="yes" class="btn primary">${T('Agree and close')}</button>
      </div>
      <a class="consent-more" href="https://zkm.de/en/privacy-policy" target="_blank" rel="noopener">${T('Privacy policy')}</a>
    </form>
  </aside>
  </div>`;
}

/* The foot: the wordmark (on the station page), three keys — the privacy
   statement and ZKM on zkm.de, and the station's own imprint page (/imprint) — and the line that names the house.
   The pages themselves are reached from the bar of keys, the ticker's menu
   and the doors above; nothing else is listed here. */
function foot(ctx, T = ctx.T || same, landing = false) {
  return `<div class="foot">${landing ? `
    <div class="foot-brand-block"><span class="foot-wordmark">MARS<span class="bang">!</span>platz</span></div>` : ''}
    <div class="foot-links">
      <a href="https://zkm.de/en/privacy-policy">${T('Privacy policy')}</a><a href="https://zkm.de/">ZKM</a><a href="/imprint">${T('Imprint')}</a>
    </div>
    <div class="foot-base">
      <span class="foot-brand">ZKM | HERTZLAB — MARS</span>
    </div>
  </div>`;
}

/* The dictionary for the browser: the page scripts (board, composer, the
   ticker, the habitat tiles) build a few strings of their own, and read
   them through `t()` from this table — the current language's entries
   only, nothing for English. Emitted in the head so the inline scripts
   further down can use it too. */
function clientTable(lang) {
  const json = JSON.stringify(i18n.table(lang)).replace(/</g, '\\u003c');
  return `<script>window.MCS_T=${json};function t(s){return (window.MCS_T||{})[s]||s}</script>`;
}

/**
 * `hero` renders full-bleed above the rail — the landing page passes its
 * Mars-surface masthead through it. `hideNav` drops the top navigation on
 * pages whose links live in the footer instead (the landing page, per the
 * MARS!PLATZ layout).
 */
function page({ title, ctx, body, current, bodyClass = '', head = '', scripts = [], styles = [],
                hero = '', hideNav = false, hideRail = false }) {
  const control = bodyClass.includes('control') || bodyClass.includes('habitat');
  // Mission control and the archive stay English whatever the cookie says.
  const translate = !control && !String(current || '').startsWith('/archive');
  const T = translate ? (ctx.T || same) : same;
  const lang = translate ? (ctx.lang || 'en') : 'en';
  // Every public page wears the same dress (public/aura.css) and the same
  // chrome: the pages drawn for the older rail-and-nav layout take the inner
  // pages' hero — the wordmark, the switches and the pill nav — instead.
  const aura = !control;
  if (aura && !styles.includes('/aura.css')) styles = ['/aura.css'].concat(styles);
  if (aura && !bodyClass.includes('landing')) {
    bodyClass = `${bodyClass} landing inner`.trim();
    hideRail = true; hideNav = true;
  }
  if (aura && bodyClass.includes('inner')) {
    // The inner pages' chrome is the landing page's: the ticker (its menu
    // rows link to the landing page's pop-ups) and the wordmark as the way
    // home. The foot carries the links between the pages.
    hero = require('./pages/public').ticker(ctx, { links: true }) + masthead(ctx);
  }
  return `<!doctype html>
<html lang="${lang}" data-theme="${ctx.theme === 'dark' ? 'dark' : 'light'}"><head>
<meta charset="utf-8">${aura ? '\n<script>document.documentElement.className += " js"</script>' : ''}
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<meta name="color-scheme" content="light dark">
<title>${esc(T(title))} — ${T('Mars Communication Station')}</title>
<meta name="description" content="${esc(T('A live communication interface between an Earth-based audience and the crew of the MARS habitat.'))}">
<link rel="stylesheet" href="/station.css?v=${ASSET_V}">${styles.map((s) => `\n<link rel="stylesheet" href="${s}?v=${ASSET_V}">`).join('')}
${translate ? clientTable(lang) : ''}
${head}
</head><body class="${bodyClass}">
${hero}
${hideRail ? '' : rail(ctx, bodyClass.includes('landing'), T)}
${control || hideNav ? '' : nav(current, T)}
<main class="shell">${body}</main>
${control ? '' : foot(ctx, T, aura)}
${aura && ctx.consent === null ? consent(current, T, ctx.offer || '') : ''}
${control ? '' : tabbar(current, T)}
${scripts.concat(control ? [] : ['/tabbar.js']).map((s) => `<script src="${s}?v=${ASSET_V}" defer></script>`).join('')}
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
const legend = (T = same) => `<div class="legend">${SYMBOL_KEY.map(([k, l]) =>
  `<span>${sym(k)} ${T(l)}</span>`).join('')}</div>`;

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
function orbitPlot(geo, { size = 460, id = 'orbit', T = same, light = true } = {}) {   // light: the one-way signal in the caption (the dashboard leaves it to the messages page)
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
       aria-label="${esc(T('Plot of Earth and Mars in their orbits around the Sun. Current separation'))} ${geo.distanceAu.toFixed(2)} ${esc(T('astronomical units'))}.">
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

    ${leader(ex, ey, earthSide, size * 0.13, T('EARTH'), 'currentColor')}
    ${leader(mx, my, marsSide, size * 0.87, T('MARS · HABITAT'), '#ff6a00')}

    <circle id="${id}-packet" r="3.5" fill="#ff6a00" stroke="currentColor" stroke-width="1" opacity="0"/>
  </svg>
  <div class="orbit-caption">
    <div><span class="k">${T('Separation')}</span><span class="v">${geo.distanceAu.toFixed(3)} au</span></div>
    <div><span class="k">${T('Distance')}</span><span class="v">${(geo.distanceKm / 1e6).toFixed(1)} M km</span></div>
    ${light ? `<div><span class="k">${T('One-way signal')}</span><span class="v">${orbital.formatLightTime(geo.lightSeconds)}</span></div>` : ''}
    <div><span class="k">${T('Geometry')}</span><span class="v">${T(geo.trend)} · ${geo.separationDeg.toFixed(0)}°</span></div>
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

function pipeline(current, T = same) {
  const idx = MESSAGE_STATES.indexOf(current);
  return `<div class="pipe">${MESSAGE_STATES.map((s, i) => {
    const cls = i < idx ? 'past' : i === idx ? 'at' : '';
    return `<div class="${cls}">${T(s.replace(/_/g, ' '))}</div>`;
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

/**
 * A meal's recipe figures, per serving, for the public pages: CO2e and water
 * footprint on one line, the nutrients on the next. Nothing when the meal
 * carries none (a custom dish, or a plan written before the recipe book).
 * The same order and names as NUTRIENTS in src/lib/content.js.
 */
const MEAL_NUTRIENTS = [['protein_g', 'Protein', 'g'], ['fat_g', 'Fat', 'g'], ['carb_g', 'Carbohydrate', 'g'],
  ['fiber_g', 'Fibre', 'g'], ['sugar_g', 'Sugar', 'g'], ['sodium_mg', 'Sodium', 'mg']];
const trim = (v, dp) => String(+Number(v).toFixed(dp));
function mealEcoText(m, T = (x) => x) {
  const eco = [];
  if (m.co2e_kg != null) eco.push(`${trim(m.co2e_kg, 3)} kg CO₂e`);
  if (m.water_footprint_l != null) eco.push(`${trim(m.water_footprint_l, 1)} L ${T('water footprint')}`);
  const n = m.nutrients || {};
  const nutr = MEAL_NUTRIENTS.filter(([k]) => n[k] != null).map(([k, label, unit]) => `${T(label)} ${trim(n[k], k === 'sodium_mg' ? 0 : 1)} ${unit}`);
  return { eco: eco.join(' · '), nutr: nutr.join(' · ') };
}
function mealEco(m, T = (x) => x) {
  const { eco, nutr } = mealEcoText(m, T);
  return (eco ? `<span class="meal-figs meal-eco">${esc(eco)} · ${esc(T('per serving'))}</span>` : '')
    + (nutr ? `<span class="meal-figs meal-nutr">${esc(nutr)}</span>` : '');
}

module.exports = {
  masthead, pageNav,
  page, panel, eyebrow, readout, orbitPlot, sparkline, pipeline, scaleStrip,
  statusStrip, langSwitch, themeSwitch, sym, legend, SYMBOL_KEY, esc, NAV, MESSAGE_STATES,
  mealEco, mealEcoText, MEAL_NUTRIENTS,
};
