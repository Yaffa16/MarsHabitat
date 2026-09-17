'use strict';
/**
 * The habitat as a picture: a geodesic dome, drawn as a wireframe over a
 * copper shell on a dark screen, with a hexagon set into it for each thing
 * that lives inside — the science bench, the three crew, the power draw, the
 * three crew, the power store, the water recycling loop, the nap pod, the
 * hydroponic shelves and the bicycle power generator — each named by a short label
 * on a leader line, and each opening, when pressed, a pop-up that says what
 * that part of the habitat is and what is happening in it right now. It
 * sits between the About row and the composer on the landing
 * page: the habitat the message is about, before the box the message is
 * written in. The picture follows the theme — a pale well by day, dark
 * glass by night — from the stylesheet alone.
 *
 * The geometry is a frequency-3 icosahedral dome, projected orthographically
 * from a little above the horizon and drawn face by face, each face shaded
 * by the light falling on it, computed once at module load. The figures are rendered from the
 * same data the dashboard uses, and refreshed from /api/dome without a
 * reload.
 */
const { esc } = require('../layout');
const moodLib = require('../../lib/mood');

const same = (s) => s;

/* ------------------------------------------------------------ geometry */
const W = 1000, H = 550;            // the drawing's box
const CX = 500, CY = 430, R = 340;  // the dome's centre on the ground and its radius
const TILT = 0.26;                  // radians above the horizon we look from

/** An icosahedron with a vertex straight up, subdivided `f` times and
 *  pushed onto the unit sphere; only the upper half is kept. */
function dome(f = 4) {
  const t = (1 + Math.sqrt(5)) / 2;
  let V = [
    [-1, t, 0], [1, t, 0], [-1, -t, 0], [1, -t, 0],
    [0, -1, t], [0, 1, t], [0, -1, -t], [0, 1, -t],
    [t, 0, -1], [t, 0, 1], [-t, 0, -1], [-t, 0, 1],
  ];
  const F = [
    [0, 11, 5], [0, 5, 1], [0, 1, 7], [0, 7, 10], [0, 10, 11],
    [1, 5, 9], [5, 11, 4], [11, 10, 2], [10, 7, 6], [7, 1, 8],
    [3, 9, 4], [3, 4, 2], [3, 2, 6], [3, 6, 8], [3, 8, 9],
    [4, 9, 5], [2, 4, 11], [6, 2, 10], [8, 6, 7], [9, 8, 1],
  ];
  // Stand it on a vertex: rotate so vertex 0 points up (+z).
  const norm = (v) => { const l = Math.hypot(...v); return v.map((x) => x / l); };
  V = V.map(norm);
  const up = V[0];
  // rotation taking `up` to (0,0,1): axis = up × z, angle = acos(up·z)
  const ax = norm([up[1], -up[0], 0]);
  const ang = Math.acos(up[2]);
  const rot = (v) => {
    const [x, y, z] = v, [ux, uy, uz] = ax, c = Math.cos(ang), s = Math.sin(ang), d = ux * x + uy * y + uz * z;
    return [
      x * c + (uy * z - uz * y) * s + ux * d * (1 - c),
      y * c + (uz * x - ux * z) * s + uy * d * (1 - c),
      z * c + (ux * y - uy * x) * s + uz * d * (1 - c),
    ];
  };
  V = V.map(rot);
  // Turn it a little about the vertical so a pentagon edge does not sit dead centre.
  const spin = 0.32;
  V = V.map(([x, y, z]) => [x * Math.cos(spin) - y * Math.sin(spin), x * Math.sin(spin) + y * Math.cos(spin), z]);

  // Subdivide each face into f² triangles.
  const tris = [];
  const lerp = (a, b, k) => a.map((x, i) => x + (b[i] - x) * k);
  for (const [a, b, c] of F) {
    const A = V[a], B = V[b], C = V[c];
    const grid = [];
    for (let i = 0; i <= f; i++) {
      grid.push([]);
      for (let j = 0; j <= i; j++) {
        const p = i === 0 ? A : lerp(lerp(A, B, i / f), lerp(A, C, i / f), i ? j / i : 0);
        grid[i].push(norm(p));
      }
    }
    for (let i = 0; i < f; i++) {
      for (let j = 0; j <= i; j++) {
        tris.push([grid[i][j], grid[i + 1][j], grid[i + 1][j + 1]]);
        if (j < i) tris.push([grid[i][j], grid[i + 1][j + 1], grid[i][j + 1]]);
      }
    }
  }
  // A dome, not a ball: keep every face whose vertices all sit above the
  // cut. A 3V icosahedron has no ring exactly on the equator, so the cut
  // falls just under it and the base is a gentle zigzag, as built domes are.
  return tris.filter((tr) => tr.every((p) => p[2] > -1e-6));
}

/** World → screen. +z is up, +y is towards the viewer. */
function project([x, y, z]) {
  const c = Math.cos(TILT), s = Math.sin(TILT);
  const depth = y * c + z * s;          // towards the viewer
  const sy = z * c - y * s;             // up on the screen
  return { x: CX + x * R, y: CY - sy * R, depth };
}

/** The dome as SVG: the front faces of the shell, each filled by how the
 *  light falls on it, over the translucent pearl. */
function domeSvgInner() {
  const tris = dome(4);
  const c = Math.cos(TILT), sn = Math.sin(TILT);
  const view = [0, c, sn];                       // towards the viewer
  const light = [-0.45, 0.55, 0.75];             // from the upper left, in front
  const ll = Math.hypot(...light); light.forEach((v, i) => { light[i] = v / ll; });
  const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
  const faces = [];
  for (const tr of tris) {
    const [A, B, C] = tr;
    const u = [B[0] - A[0], B[1] - A[1], B[2] - A[2]], v = [C[0] - A[0], C[1] - A[1], C[2] - A[2]];
    let n = [u[1] * v[2] - u[2] * v[1], u[2] * v[0] - u[0] * v[2], u[0] * v[1] - u[1] * v[0]];
    const nl = Math.hypot(...n); n = n.map((x) => x / nl);
    // Normals point outwards on a sphere: flip any that face the centre.
    const cen = [(A[0] + B[0] + C[0]) / 3, (A[1] + B[1] + C[1]) / 3, (A[2] + B[2] + C[2]) / 3];
    if (dot(n, cen) < 0) n = n.map((x) => -x);
    if (dot(n, view) <= 0.02) continue;         // the far side is hidden
    // How lit the face is: 0 in the shade, 1 facing the light — softened
    // so the shading is a gentle gradient rather than a hard facet.
    const lit = Math.max(0, dot(n, light));
    const alpha = (0.075 * (1 - lit)).toFixed(3);
    const pts = tr.map(project).map((q) => `${q.x.toFixed(1)},${q.y.toFixed(1)}`).join(' ');
    faces.push({ depth: dot(cen, view), pts, alpha });
  }
  faces.sort((x, y) => x.depth - y.depth);
  // The silhouette of the shell — the sphere's outline over the top, the
  // front of the base ellipse below — carries the ground light: an orange
  // glow rising from the floor of the habitat and fading out by the apex.
  const ry = R * sn;
  const outline = `M${CX - R} ${CY} A${R} ${R} 0 0 1 ${CX + R} ${CY} A${R} ${ry.toFixed(1)} 0 0 1 ${CX - R} ${CY} Z`;
  return `
    <defs>
      <linearGradient id="dome-pearl" x1="0" y1="0" x2="0" y2="1">
        <stop class="s1" offset="0"/>
        <stop class="s2" offset="0.55"/>
        <stop class="s3" offset="1"/>
      </linearGradient>
      <radialGradient id="dome-floor" cx="0.5" cy="0.5" r="0.5">
        <stop offset="0" stop-color="#000" stop-opacity="0.18"/>
        <stop offset="0.7" stop-color="#000" stop-opacity="0.05"/>
        <stop offset="1" stop-color="#000" stop-opacity="0"/>
      </radialGradient>
    </defs>
    <ellipse class="dome-floor" cx="${CX}" cy="${CY + 8}" rx="${(R * 1.3).toFixed(0)}" ry="${(ry * 1.5).toFixed(0)}" fill="url(#dome-floor)"/>
    <path class="dome-shell" d="${outline}" fill="url(#dome-pearl)"/>
    <g class="dome-faces">${faces.map((f) => `<polygon points="${f.pts}" style="fill:rgba(21,21,23,${f.alpha})"/>`).join('')}</g>
`;
}
const DOME_SVG = domeSvgInner();

/* ------------------------------------------------------------ the hexagons
   Each is a system inside the habitat: where it stands (in the dome's own
   space, x across, y towards the viewer, z up — all within the unit sphere),
   its icon (traced from the pictograms in src/views/pages/dome-icons.json),
   the section of the dashboard its pop-up links to, and where its label sits
   around the dome (as a fraction of the drawing's box, anchored on `side`). */
const ICONS = require('./dome-icons.json');

const HEXES = [
  { id: 'crew',       code: 'CH-12', at: [-0.10, 0.28, 0.40], label: 'Crew',            href: '#crew',      lx: 0.03, ly: 0.20, side: 'left' },
  { id: 'science',    code: 'CH-11', at: [-0.52, 0.10, 0.38], label: 'Science lab',     href: '#crewlog',   lx: 0.03, ly: 0.42, side: 'left' },
  { id: 'recycling',  code: 'CH-10', at: [-0.46, 0.40, 0.14], label: 'Water recycling', href: '#habitat',   lx: 0.03, ly: 0.64, side: 'left' },
  { id: 'aeroponics', code: 'CH-13', at: [-0.18, 0.56, 0.08], label: 'Hydroponics',     href: '#galley',    lx: 0.03, ly: 0.86, side: 'left' },
  { id: 'comms',      code: 'CH-09', at: [0.32, -0.04, 0.68], label: 'Communication',   href: '#exchanges', lx: 0.97, ly: 0.20, side: 'right' },
  { id: 'power',      code: 'CH-20', at: [0.54, 0.20, 0.38],  label: 'Power',           href: '#habitat',   lx: 0.97, ly: 0.42, side: 'right' },
  { id: 'nappod',     code: 'CH-30', at: [0.48, 0.46, 0.12],  label: 'Nap pod',         href: '#schedule',  lx: 0.97, ly: 0.64, side: 'right' },
  { id: 'generator',  code: 'CH-21', at: [0.16, 0.58, 0.10],  label: 'Power generator', href: '#habitat',   lx: 0.97, ly: 0.86, side: 'right' },
];

/* --------------------------------------------------------------- figures */
const venueClock = (tz) => {
  try { return new Intl.DateTimeFormat('en-GB', { timeZone: tz, hour: '2-digit', minute: '2-digit', hour12: false }).format(new Date()); } catch { return '00:00'; }
};
const titled = (s) => { s = String(s || ''); return s.charAt(0).toUpperCase() + s.slice(1).toLowerCase(); };
const qty = (v) => (Number.isInteger(v) ? String(v) : Number(v).toFixed(1));

/**
 * What is happening in each part of the habitat right now: a line or two
 * per hexagon, as sentences, from the same data the dashboard uses. Also
 * what /api/dome returns, so the page and the refresh cannot drift apart.
 */
function figures(ctx, { today, crew, recent = [], power = { categories: [], days: {} }, counts = { published: 0, total: 0 }, crewFigures = {} }) {
  const m = ctx.mission, T = ctx.T;
  const pre = m.phase === 'PRE_LAUNCH';
  const sol = String(m.clampedDay).padStart(3, '0');
  const hhmm = venueClock(m.timezone);
  const stamp = pre ? `${T('Opens')} ${m.startLabel}` : `SOL ${sol} · ${hhmm}`;

  // The schedule: what the crew are doing at this minute, and what is next.
  const tasks = today ? today.tasks : [];
  let nowT = null, nextT = null;
  for (const t of tasks) { if (t.time <= hhmm) nowT = t; else if (!nextT) nextT = t; }
  const doing = pre ? (tasks[0] ? `${T('Day 01 opens with')} ${tasks[0].label}.` : T('Hatch not yet sealed.'))
    : nowT ? `${T('Now')}: ${nowT.label}${nowT.detail ? ' — ' + nowT.detail : ''}.` : T('Off the schedule.');
  const next = nextT ? ` ${T('Up next')} ${nextT.time}: ${nextT.label}.` : '';

  // Each officer's condition — as words, never as numbers.
  const cond = (c) => (c && c.mood ? titled(T(moodLib.translate(c.mood).condition)) : T('no state filed'));
  const officer = (re, i) => crew.find((c) => re.test(c.designation)) || crew[i];
  const comm = officer(/COMM/i, 0), sci = officer(/SCIENCE/i, 1), health = officer(/HEALTH/i, 2);
  const name = (c) => (c ? titled(c.designation.replace(' OFFICER', '')) : '');

  // The stores.
  const inv = today ? today.inventory : [];
  const store = (key) => inv.find((i) => i.key === key) || null;
  const daysOf = (i) => (i && i.consumption > 0 ? i.quantity / i.consumption : null);
  const left = (i) => { const d = daysOf(i); return d == null ? '' : d < 1 ? ` — ${T('under a day at this draw')}` : d < 99 ? ` — ${Math.round(d)} ${T(Math.round(d) === 1 ? 'day left at this draw' : 'days left at this draw')}` : ''; };
  const storeLine = (key, fallback) => { const i = store(key) || inv.find((x) => x.critical) || inv[0]; return i ? `${i.label}: ${qty(i.quantity)} ${i.unit} ${T('of')} ${i.start_quantity || i.quantity}${left(i)}.` : fallback; };

  // Today's power, all categories.
  const pwrDay = pre ? 1 : m.clampedDay;
  const d = power.days[String(pwrDay)] || null;
  const parts = d ? power.categories.filter((c) => d[c.key] != null).map((c) => `${c.label} ${d[c.key]}`) : [];
  const total = parts.length ? Math.round(power.categories.reduce((s, c) => s + (d[c.key] || 0), 0) * 100) / 100 : null;
  const powerLine = total != null ? `${pre ? T('Planned for day 01') : `SOL ${sol}`}: ${total} kWh — ${parts.join(', ')}.` : T('Today’s power has not been counted yet.');

  // The crew's figures.
  const fig = crewFigures[String(pwrDay)] || {};
  const steps = fig.steps != null ? `${Number(fig.steps).toLocaleString('en-GB')} ${T('steps today')}` : T('steps not yet counted');
  const kcal = fig.calories != null ? `${Number(fig.calories).toLocaleString('en-GB')} kcal` : null;

  // The latest exchange with Earth.
  const ex = recent.find((r) => r.state === 'PUBLISHED' && r.response_body) || recent.find((r) => r.state === 'PUBLISHED');
  const clip = (t, n) => { t = String(t || '').replace(/\s+/g, ' ').trim(); return t.length > n ? t.slice(0, n - 1).trimEnd() + '…' : t; };
  const exLine = ex ? `${T('Latest exchange')}: “${clip(ex.body, 80)}”${ex.response_body ? ` — “${clip(ex.response_body, 80)}”` : ''}.` : `${counts.published} ${T('exchanges published')}, ${counts.total} ${T('messages sent')}.`;

  return {
    stamp, sol, phase: m.phase,
    crew:       { text: `${name(comm)} — ${cond(comm)} · ${name(sci)} — ${cond(sci)} · ${name(health)} — ${cond(health)}.`, more: `${doing}${next}` },
    comms:      { text: exLine, more: `${name(comm)}: ${cond(comm)}.` },
    science:    { text: `${name(sci)}: ${cond(sci)}.`, more: `${doing}${next}` },
    recycling:  { text: storeLine('water', T('No inventory filed for today.')), more: T('The loop runs whenever there is grey water to pass; the crew count the tank at the end of the day.') },
    aeroponics: { text: storeLine('food', T('No inventory filed for today.')), more: `${T('First harvest planned for SOL 10.')}` },
    power:      { text: powerLine, more: '' },
    nappod:     { text: `${doing}${next}`, more: `${name(health)}: ${cond(health)}.` },
    generator:  { text: `${steps}${kcal ? ` · ${kcal}` : ''}.`, more: powerLine },
  };
}

/* ------------------------------------------------------------- the markup */
const S = 27;   // half-width of a hexagon in the drawing's units

/** The hexagon with its pictogram, on its own — for the pop-up's head. */
function hexMark(h) {
  const pts = Array.from({ length: 6 }, (_, i) => {
    const a = Math.PI / 3 * i + Math.PI / 6;
    return `${(S * Math.cos(a)).toFixed(1)},${(S * Math.sin(a)).toFixed(1)}`;
  }).join(' ');
  const ic = ICONS[h.id];
  const box = S * 2 * 0.66;
  const sc = box / Math.max(ic.w, ic.h);
  return `<svg class="dome-mark" viewBox="${-S - 3} ${-S - 3} ${2 * S + 6} ${2 * S + 6}" aria-hidden="true">
      <polygon points="${pts}"/>
      <g class="dome-ic" transform="translate(${(-ic.w * sc / 2).toFixed(1)} ${(-ic.h * sc / 2).toFixed(1)}) scale(${sc.toFixed(4)}) translate(0 ${ic.h}) scale(0.1 -0.1)"><path d="${ic.d}"/></g>
    </svg>`;
}

function hexSvg(h, T) {
  const p = project(h.at);
  const pts = Array.from({ length: 6 }, (_, i) => {
    const a = Math.PI / 3 * i + Math.PI / 6;
    return `${(S * Math.cos(a)).toFixed(1)},${(S * Math.sin(a)).toFixed(1)}`;
  }).join(' ');
  // The pictogram, fitted into the hexagon: potrace's paths are in tenths of
  // a point, y up, so they are flipped and scaled into a box of 2·S·0.66.
  const ic = ICONS[h.id];
  const box = S * 2 * 0.66;
  const sc = box / Math.max(ic.w, ic.h);
  const ox = -ic.w * sc / 2, oy = -ic.h * sc / 2;
  // Drawn about its own origin and placed by the transform, which the page
  // script rewrites as the hexagon drifts; without the script it stands here.
  return `<g class="dome-hex" data-hex="${h.id}" data-at="${h.at.join(',')}" transform="translate(${p.x.toFixed(1)} ${p.y.toFixed(1)})" role="button" tabindex="0" aria-haspopup="dialog" aria-controls="dome-${h.id}">
      <title>${esc(T(h.label))}</title>
      <g class="dome-hex-body">
        <polygon points="${pts}"/>
        <g class="dome-ic" transform="translate(${ox.toFixed(1)} ${oy.toFixed(1)}) scale(${sc.toFixed(4)}) translate(0 ${ic.h}) scale(0.1 -0.1)"><path d="${ic.d}"/></g>
      </g>
    </g>`;
}

/** The label beside the dome and the leader that ties it to its hexagon. */
function labelSvg(h, T) {
  const p = project(h.at);
  const text = T(h.label);
  const tx = h.lx * W, ty = h.ly * H;
  const right = h.side === 'right';
  // The name is set in the display face at 15 units, its channel code in
  // the small mono above it. The width is estimated so the leader starts a
  // little beyond the name's inner edge, runs level for a moment, then goes
  // straight to the hexagon.
  const width = Math.max(text.length * 8.0, 5 * 6.4);
  const sx = right ? tx - width - 16 : tx + width + 16;
  const kx = right ? sx - 30 : sx + 30;
  return `<g class="dome-label" data-hex="${h.id}" data-side="${h.side}" data-w="${width.toFixed(0)}" data-y="${ty.toFixed(0)}" role="button" tabindex="0" aria-haspopup="dialog" aria-controls="dome-${h.id}">
      <path class="dome-lead" d="M${sx.toFixed(0)} ${ty.toFixed(0)}H${kx.toFixed(0)}L${p.x.toFixed(1)} ${p.y.toFixed(1)}"/>
      <circle class="dome-lead-dot" cx="${sx.toFixed(0)}" cy="${ty.toFixed(0)}" r="2.5"/>
      <text class="dome-code" x="${tx.toFixed(0)}" y="${(ty - 13).toFixed(0)}" text-anchor="${right ? 'end' : 'start'}">${esc(h.code)}</text>
      <text class="dome-name" x="${tx.toFixed(0)}" y="${(ty + 5).toFixed(0)}" text-anchor="${right ? 'end' : 'start'}">${esc(text)}</text>
    </g>`;
}

/* What each part of the habitat is — the still text of each pop-up. The
   live sentences come from figures(). */
const ABOUT = {
  crew: 'Three officers live sealed inside the habitat for the thirteen days of the run: a communication officer who relays every message from Earth, a science officer who runs the experiments and watches the habitat’s systems, and a health officer who keeps the crew fit and the life support in order. They write a daily blog and file their condition from inside.',
  science: 'The science bench: the habitat’s own experiments — samples, cultures, readings — and the daily science findings the science officer writes up. The sensor node beside it measures temperature, humidity, carbon dioxide and more every twenty minutes.',
  recycling: 'Nothing is thrown away. Used water passes through a planted filter bed, a screw press and a settling funnel and comes back as water for the plants and the crew. This loop decides how long the stores last.',
  aeroponics: 'Three shelves of plants grown without soil, their roots in nutrient-rich water — the habitat’s fresh food and part of its air. What grows here is counted with the food rations.',
  power: 'Everything in the habitat runs on what the crew can make and store. Heating, the galley, lighting and electronics draw on one battery, and the crew count the kilowatt-hours by category every day.',
  nappod: 'One enclosed pod for rest. The crew sleep in shifts so that someone is always awake for a communication window, and the air in the pod during the sleep period is the reading watched most closely.',
  comms: 'The uplink. Every message written on this station crosses the distance to the habitat and waits for the communication officer, who reads it and answers from inside; the reply comes back to the board on every open phone. The real light-time between Earth and Mars is shown beside the composer.',
  generator: 'A bicycle generator: pedalling charges the battery. The health officer’s workout is also the habitat’s power plant — the steps and the kilowatt-hours are the same effort.',
};

/**
 * The panel: the dome, its seven hexagons, a label on a leader line for
 * each, and a pop-up per hexagon — what that part of the habitat is, and
 * what is happening in it now. On a phone the labels leave the picture and
 * stand beneath it as a row of chips that open the same pop-ups.
 */
function habitatDome(ctx, args) {
  const T = ctx.T;
  const f = figures(ctx, args);
  const popup = (h) => `
    <dialog class="popup dome-popup" id="dome-${h.id}" aria-labelledby="dome-${h.id}-title">
      <div class="popup-head">
        ${hexMark(h)}
        <div><span class="fold-title" id="dome-${h.id}-title">${esc(T(h.label))}</span><span class="fold-sub"><span class="dome-code-chip">${esc(h.code)}</span> · <span data-field="stamp">${esc(f.stamp)}</span></span></div>
        <button type="button" class="popup-close" data-close aria-label="${esc(T('Close'))}">×</button>
      </div>
      <div class="popup-body">
        <p class="dome-now"><span class="dome-now-k">${T('Now')}</span> <span data-field="${h.id}-text">${esc(f[h.id].text)}</span> <span data-field="${h.id}-more">${esc(f[h.id].more)}</span></p>
        <p>${esc(T(ABOUT[h.id]))}</p>
        <p><a class="btn" href="${h.href}" data-close>${T('Open its panel on the dashboard')} →</a></p>
      </div>
    </dialog>`;
  return `
  <section class="dome-panel" id="habitat-dome" aria-label="${esc(T('The habitat'))}">
    <header class="dome-head">
      <div class="dome-title"><span class="dpanel-code">CH-00</span><h2>${T('The habitat')}</h2></div>
      <span class="dome-meta">HABITAT ONE · R75-2 · ${T('press a part of the habitat to see what is happening in it')}</span>
    </header>
    <div class="dome-screen">
      <div class="dome-stage">
        <svg class="dome-svg" viewBox="0 0 ${W} ${H}" preserveAspectRatio="xMidYMid meet" role="img" aria-label="${esc(T('The habitat as a dome, with what is inside it'))}">
          ${DOME_SVG}
          <g class="dome-labels">${HEXES.map((h) => labelSvg(h, T)).join('')}</g>
          <g class="dome-hexes">${HEXES.map((h) => hexSvg(h, T)).join('')}</g>
        </svg>
      </div>
      <div class="dome-legend" role="group" aria-label="${esc(T('The parts of the habitat'))}">${HEXES.map((h) => `
        <button type="button" class="chip" data-hex="${h.id}"><span class="chip-code">${esc(h.code)}</span>${esc(T(h.label))}</button>`).join('')}</div>
    </div>
    ${HEXES.map(popup).join('')}
    <script>
    (function () {
      var root = document.getElementById('habitat-dome'); if (!root) return;
      function dialogOf(id) { var d = document.getElementById('dome-' + id); return d && d.tagName === 'DIALOG' ? d : null; }
      function open(id) {
        var d = dialogOf(id); if (!d || d.open) return;
        if (typeof d.showModal === 'function') d.showModal(); else d.setAttribute('open', '');
        d.querySelector('.popup-body').scrollTop = 0;
      }
      // A hexagon, its label or its chip opens the pop-up; hovering one
      // lifts the other two.
      // A hexagon, its label or its chip opens the pop-up; hovering one
      // lifts the other two, and holds the hexagon still under the hand.
      var held = {};
      root.querySelectorAll('[data-hex]').forEach(function (n) {
        var id = n.getAttribute('data-hex');
        n.addEventListener('click', function () { open(id); });
        n.addEventListener('keydown', function (e) { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); open(id); } });
        var on = function () { held[id] = true; root.querySelectorAll('[data-hex="' + id + '"]').forEach(function (x) { x.classList.add('lit'); }); };
        var off = function () { held[id] = false; root.querySelectorAll('[data-hex="' + id + '"]').forEach(function (x) { x.classList.remove('lit'); }); };
        n.addEventListener('mouseenter', on); n.addEventListener('mouseleave', off);
        n.addEventListener('focus', on); n.addEventListener('blur', off);
      });
      root.querySelectorAll('dialog.dome-popup').forEach(function (d) {
        d.querySelectorAll('[data-close]').forEach(function (b) { b.addEventListener('click', function () { d.close(); }); });
        d.addEventListener('click', function (e) { if (e.target === d) d.close(); });
      });
      // The sentences follow the station: every 20 seconds the figures are
      // asked for again and the pop-ups rewritten in place.
      var busy = false;
      function refresh() {
        if (busy || document.hidden) return; busy = true;
        fetch('/api/dome', { cache: 'no-store' }).then(function (r) { return r.json(); }).then(function (f) {
          root.querySelectorAll('[data-field]').forEach(function (n) {
            var k = n.getAttribute('data-field'), v;
            if (k === 'stamp') v = f.stamp; else { var m = k.match(/^(\\w+)-(text|more)$/); v = m && f[m[1]] ? f[m[1]][m[2]] : null; }
            if (typeof v === 'string' && n.textContent !== v) n.textContent = v;
          });
        }).catch(function () { /* next time */ }).finally(function () { busy = false; });
      }
      setInterval(refresh, 20000);
      // The hexagons float about the whole interior of the dome. Each has a
      // destination somewhere inside the shell and glides towards it as if
      // on a slow spring; arriving, or after a while, it picks another. Two
      // that would overlap on the screen ease apart. Each is projected with
      // the dome's own camera and comes forward or recedes a little with
      // depth. Its label follows: the leader is redrawn every frame, the
      // name slides along its column to stay level with the hexagon, the
      // names on a side keep clear of one another, and when a hexagon
      // crosses to the other half of the dome its name crosses too, fading
      // out on one side and in on the other. Still under reduced motion.
      var CX = ${CX}, CY = ${CY}, R = ${R}, TILT = ${TILT}, W = ${W}, H = ${H}, S = ${S};
      var cs = Math.cos(TILT), sn = Math.sin(TILT);
      function project(x, y, z) { return { x: CX + x * R, y: CY - (z * cs - y * sn) * R, d: y * cs + z * sn }; }
      var LIM = 0.84, ZMIN = 0.14;
      function inside(x, y, z) {
        var r = Math.sqrt(x * x + y * y + z * z);
        if (r > LIM) { x *= LIM / r; y *= LIM / r; z *= LIM / r; }
        if (z < ZMIN) z = ZMIN;
        return [x, y, z];
      }
      function anywhere() {
        // A point inside the shell, anywhere: a height drawn evenly from the
        // floor to just under the apex, then a point in the disc the shell
        // leaves at that height — so the top of the dome is visited as
        // often as the wide floor, and the hexagon stays clear of the shell.
        // The height is drawn with a lean towards the top (a uniform draw
        // raised to a power below one), because the floor is wide and would
        // otherwise gather most of the hexagons; the point in the disc leans
        // a little towards the rim so they spread across it.
        var z = ZMIN + Math.pow(Math.random(), 0.72) * (LIM * 0.94 - ZMIN);
        var rr = Math.sqrt(Math.max(0, LIM * LIM * 0.94 - z * z)) * Math.pow(Math.random(), 0.65);
        var a = Math.random() * Math.PI * 2;
        return [rr * Math.cos(a), rr * Math.sin(a), z];
      }
      function somewhere(me) {
        // Of a few candidates, the one farthest from where the others are
        // heading, so the hexagons spread through the dome rather than
        // gathering in the middle of it.
        var best = null, bestD = -1;
        for (var c = 0; c < 5; c++) {
          var q = anywhere(), near = Infinity;
          (hexes || []).forEach(function (o) {
            if (o === me || !o.to) return;
            var dx = o.to[0] - q[0], dy = o.to[1] - q[1], dz = o.to[2] - q[2];
            near = Math.min(near, dx * dx + dy * dy + dz * dz);
          });
          if (near > bestD) { bestD = near; best = q; }
        }
        return best;
      }
      var hexes = null;
      hexes = [].map.call(root.querySelectorAll('.dome-hex'), function (n, i) {
        var at = n.getAttribute('data-at').split(',').map(Number);
        var lab = root.querySelector('.dome-label[data-hex="' + n.getAttribute('data-hex') + '"]');
        return { n: n, pos: at.slice(), vel: [0, 0, 0], to: null, until: 14 + Math.random() * 12, lab: lab,
          lead: lab && lab.querySelector('.dome-lead'), dot: lab && lab.querySelector('.dome-lead-dot'),
          code: lab && lab.querySelector('.dome-code'), name: lab && lab.querySelector('.dome-name'),
          side: lab && lab.getAttribute('data-side'), w: lab ? +lab.getAttribute('data-w') : 0,
          ly: lab ? +lab.getAttribute('data-y') : 0, fade: 1, swapTo: null };
      });
      hexes.forEach(function (h) { h.to = somewhere(h); });
      var still = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
      var minGap = 52, top = 0.10 * H, bottom = 0.92 * H, last = null, clock = 0;
      function placeLabel(h) {
        var right = h.side === 'right';
        var tx = right ? 0.97 * W : 0.03 * W;
        var sx = right ? tx - h.w - 16 : tx + h.w + 16;
        var kx = right ? sx - 30 : sx + 30;
        var ty = h.ly.toFixed(1);
        h.code.setAttribute('x', tx); h.name.setAttribute('x', tx);
        h.code.setAttribute('text-anchor', right ? 'end' : 'start'); h.name.setAttribute('text-anchor', right ? 'end' : 'start');
        h.code.setAttribute('y', (h.ly - 13).toFixed(1)); h.name.setAttribute('y', (h.ly + 5).toFixed(1));
        h.dot.setAttribute('cx', sx); h.dot.setAttribute('cy', ty);
        h.lead.setAttribute('d', 'M' + sx + ' ' + ty + 'H' + kx + 'L' + h.p.x.toFixed(1) + ' ' + h.p.y.toFixed(1));
        h.lab.style.opacity = h.fade.toFixed(3);
      }
      function frame(now) {
        var dt = last == null ? 0.016 : Math.min(0.05, (now - last) / 1000); last = now; clock += dt;
        hexes.forEach(function (h) {
          // Towards the destination, on a soft spring; a new one when there.
          var d = [h.to[0] - h.pos[0], h.to[1] - h.pos[1], h.to[2] - h.pos[2]];
          var dist = Math.sqrt(d[0] * d[0] + d[1] * d[1] + d[2] * d[2]);
          h.until -= dt;
          if (dist < 0.05 || h.until <= 0) { h.to = somewhere(h); h.until = 18 + Math.random() * 14; }
          for (var k = 0; k < 3; k++) h.vel[k] += (d[k] * 0.30 - h.vel[k] * 1.1) * dt;
        });
        // Two hexagons that would sit on each other on the screen ease apart.
        for (var i = 0; i < hexes.length; i++) for (var j = i + 1; j < hexes.length; j++) {
          var a = hexes[i], b = hexes[j];
          var pa = project(a.pos[0], a.pos[1], a.pos[2]), pb = project(b.pos[0], b.pos[1], b.pos[2]);
          var dx = pb.x - pa.x, dy = pb.y - pa.y, dd = Math.sqrt(dx * dx + dy * dy) || 1, room = S * 2.6;
          if (dd < room) {
            var push = (room - dd) / room * 0.35 * dt, ux = dx / dd, uy = dy / dd;
            // Screen x is dome x; screen y is mostly dome z (up), so push there.
            a.vel[0] -= ux * push; a.vel[2] += uy * push;
            b.vel[0] += ux * push; b.vel[2] -= uy * push;
          }
        }
        hexes.forEach(function (h) {
          var speed = Math.sqrt(h.vel[0] * h.vel[0] + h.vel[1] * h.vel[1] + h.vel[2] * h.vel[2]), cap = 0.03;
          if (speed > cap) for (var k = 0; k < 3; k++) h.vel[k] *= cap / speed;
          // Under the hand a hexagon stands still, so it can be pressed.
          if (held[h.n.getAttribute('data-hex')]) { h.vel = [0, 0, 0]; }
          var np = inside(h.pos[0] + h.vel[0] * dt, h.pos[1] + h.vel[1] * dt, h.pos[2] + h.vel[2] * dt);
          h.pos = np;
          var p = project(np[0], np[1], np[2]);
          h.p = p; h.s = 0.84 + 0.20 * (p.d + 1) / 2;
          h.n.setAttribute('transform', 'translate(' + p.x.toFixed(1) + ' ' + p.y.toFixed(1) + ') scale(' + h.s.toFixed(3) + ')');
          h.n.style.opacity = (0.80 + 0.20 * (p.d + 1) / 2).toFixed(3);
          h.target = Math.max(top, Math.min(bottom, p.y));
          // A hexagon well into the other half of the dome takes its name
          // across: the name fades out where it is and in on the other side.
          if (h.lab) {
            var wants = np[0] > 0.14 ? 'right' : np[0] < -0.14 ? 'left' : h.side;
            if (wants !== h.side && !h.swapTo) h.swapTo = wants;
            if (h.swapTo) {
              h.fade = Math.max(0, h.fade - dt * 3.5);
              if (h.fade === 0) { h.side = h.swapTo; h.swapTo = null; h.ly = h.target; }
            } else if (h.fade < 1) h.fade = Math.min(1, h.fade + dt * 3.5);
          }
        });
        // The names slide towards their hexagon, then are pushed apart so
        // none overlap, then the leaders are redrawn.
        ['left', 'right'].forEach(function (side) {
          var col = hexes.filter(function (h) { return h.lab && h.side === side; });
          col.forEach(function (h) { h.ly += (h.target - h.ly) * Math.min(1, dt * 4); });
          col.sort(function (a, b) { return a.ly - b.ly; });
          for (var k = 1; k < col.length; k++) if (col[k].ly - col[k - 1].ly < minGap) col[k].ly = col[k - 1].ly + minGap;
          for (var k = col.length - 2; k >= 0; k--) if (col[k + 1].ly - col[k].ly < minGap) col[k].ly = col[k + 1].ly - minGap;
          col.forEach(placeLabel);
        });
        if (!still && !document.hidden) requestAnimationFrame(frame);
      }
      if (hexes.length && hexes[0].lab) {
        requestAnimationFrame(frame);
        document.addEventListener('visibilitychange', function () { if (!document.hidden && !still) { last = null; requestAnimationFrame(frame); } });
      }
      // On a phone the drawing is cropped to the dome itself; the labels
      // are the chips beneath it.
      var svg = root.querySelector('.dome-svg'), full = svg.getAttribute('viewBox');
      function fit() { svg.setAttribute('viewBox', window.innerWidth <= 760 ? '${(CX - R - 30)} ${Math.round(CY - R * Math.cos(TILT)) - 40} ${(2 * R + 60)} ${Math.round(R * Math.cos(TILT) + R * 0.5) + 60}' : full); }
      fit(); window.addEventListener('resize', fit);
    })();
    </script>
  </section>`;
}

module.exports = { habitatDome, figures, HEXES, ABOUT };
