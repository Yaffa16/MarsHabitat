'use strict';
/**
 * Inside the habitat — the page after the note on the landing page: the
 * cutaway drawing of Habitat One that was handed over (public/habitat/
 * cutaway-lines.webp — its three floors under the geodesic dome, in white
 * line on the Mars ground) with, beside it, what each part of it is. The
 * hand over a part of the drawing (or a touch, or the keyboard) shows that
 * part in colour — the coloured drawing (cutaway-colour.webp, the same
 * picture painted) laid over the line drawing and clipped to the part's
 * outline, that part alone — and the panel beside the drawing names the
 * part, says what is happening in it now (the same live sentences the dome's
 * keys carry, dome.js figures, refreshed every twenty seconds from /api/dome
 * by public/cutaway.js) and tells what it is (the dome's own words where the
 * key exists, ABOUT below for the rooms the keys do not name). A row of chips
 * under the drawing names every part and selects it too — for a phone, where
 * there is no hand to hover, and for the keyboard.
 *
 * The outlines are traced on the picture as it was handed over, 1536 × 1024;
 * the page shows it cropped to the habitat (CROP: 180 off the top, the crown
 * of the dome just under the edge; 124 off the foot, a strip of ground kept
 * under it), 1536 × 720 — the SVG that carries the drawing, the colour and
 * the outlines is in that box, and the outlines are moved down into it here.
 * The dome itself is the shell about the rooms: the outline of the dome with
 * the block of rooms cut out of it (a path with two rings, even-odd).
 */
const { esc } = require('../layout');
const { ABOUT, figures } = require('./dome');

const W = 1536, H = 720, CROP = 180;
const IMG = { lines: '/habitat/cutaway-lines.webp', colour: '/habitat/cutaway-colour.webp' };

/* The parts, in the order the chips name them, each with its outline (in the picture's own coordinates), the fields
   of dome.js figures() whose live sentences it carries (fig: a figure's text, or its text and its more), what it is
   (about — the dome's words where the key exists) and the panel of the dashboard it leads to. */
const OUTER = [[18, 832], [28, 700], [58, 600], [108, 520], [178, 420], [298, 320], [448, 252], [618, 212], [768, 199], [918, 212], [1088, 252], [1238, 320], [1358, 420], [1430, 520], [1480, 600], [1510, 700], [1520, 832]];
const ROOMS = [[172, 505], [238, 502], [292, 372], [345, 340], [1205, 340], [1240, 378], [1262, 502], [1362, 505], [1426, 560], [1446, 672], [1446, 836], [95, 836], [95, 672], [112, 560]];
const MODULES = [
  { id: 'dome', label: 'Geodesic dome', fig: ['dome-text'], href: '#habitat', ring: [OUTER, ROOMS],
    about: ['Habitat One is a geodesic dome on Karlsruhe’s Marktplatz: a shell of triangles over three floors. Under the crown, the growing shelves, the communication station and the science bench; on the main floor the kitchen, the lounge, the sleeping pods and the health station; below them the water loop and the power plant. Three crew members are always in it for the thirteen days of the run, and everything they measure and report comes to this station.'] },
  { id: 'hydro', label: 'Hydroponic plants', fig: ['aeroponics-text', 'aeroponics-more'], href: '#galley', poly: [[238, 502], [292, 372], [345, 340], [592, 340], [592, 502]], about: [ABOUT.aeroponics] },
  { id: 'comms', label: 'Communication station', fig: ['comms-text', 'comms-more'], href: '#exchanges', poly: [[592, 502], [592, 348], [660, 330], [760, 320], [860, 330], [925, 348], [925, 502]], about: [ABOUT.comms] },
  { id: 'science', label: 'Science station', fig: ['science-text', 'science-more'], href: '#crewlog', poly: [[925, 502], [925, 345], [1205, 345], [1240, 378], [1262, 502]], about: [ABOUT.science] },
  { id: 'kitchen', label: 'Kitchen', fig: ['kitchen-text', 'kitchen-more'], href: '#galley', poly: [[172, 505], [585, 505], [585, 672], [95, 672], [112, 560]],
    about: ['The galley: where the crew cook and eat what the stores and the growing shelves give — three meals a day, each planned in calories, water and energy. What is eaten is counted with the rations, and today’s meal stands on the dashboard.'] },
  { id: 'lounge', label: 'Relaxing area', fig: ['crew-text', 'crew-more'], href: '#crew', poly: [[585, 505], [925, 505], [925, 672], [900, 696], [610, 696], [585, 672]],
    about: ['The lounge, under the crown: the one room in the habitat that is nobody’s station — the round sofa where the three meet, eat, plan the day and end it. Each of them files their condition from inside, in words, and it stands on the dashboard.'] },
  { id: 'nap', label: 'Nap pod', fig: ['nap-text'], href: '#schedule', poly: [[925, 505], [1150, 505], [1150, 672], [925, 672]],
    about: ['Two sleeping pods, each a bunk closed off from the light and the sound of the habitat. Rest is on the schedule like everything else: the hours are written on the day’s plan, and the crew keep to them as they keep to the rest.'] },
  { id: 'health', label: 'Health station', fig: ['health-text', 'health-more'], href: '#crew', poly: [[1150, 505], [1362, 505], [1426, 560], [1446, 672], [1150, 672]],
    about: ['The health station: a bed, the monitors and the medicine cabinet, where the health officer looks after the crew — their condition, their steps, what they have eaten — and the life support with them, and where the Daily Health Blog is written each day.'] },
  { id: 'water', label: 'Water recycling system', fig: ['recycling-text', 'recycling-more'], href: '#habitat', poly: [[195, 678], [600, 678], [600, 836], [195, 836]], about: [ABOUT.recycling] },
  { id: 'power', label: 'Power generation', fig: ['power-text', 'generator-text'], href: '#habitat', poly: [[915, 690], [1215, 690], [1215, 836], [915, 836]], about: [ABOUT.power, ABOUT.generator] },
];

/* The outlines as SVG: a polygon's points, moved into the cropped box; the dome's two rings as one even-odd path. */
const pts = (poly) => poly.map(([x, y]) => `${x},${y - CROP}`).join(' ');
const ring = (poly) => 'M' + poly.map(([x, y]) => `${x} ${y - CROP}`).join(' L') + ' Z';
const shape = (m, attrs) => (m.ring
  ? `<path d="${m.ring.map(ring).join(' ')}" fill-rule="evenodd" clip-rule="evenodd" ${attrs}/>`
  : `<polygon points="${pts(m.poly)}" ${attrs}/>`);

/**
 * The page: the drawing with its colour and its outlines in one SVG at the left, the chips under it, the panel at the
 * right — one article a part, the dome's shown first (public/cutaway.js switches them). `f` is figures() of dome.js
 * for the moment the page is drawn, so the live sentences stand before the first refresh.
 */
function cutaway(ctx, { f }) {
  const T = ctx.T;
  const first = MODULES[0].id;
  const svg = `
      <svg class="cut-svg" viewBox="0 0 ${W} ${H}" role="img" aria-label="${esc(T('The habitat in section: its three floors under the dome'))}">
        <defs>${MODULES.map((m) => `<clipPath id="cut-clip-${m.id}">${shape(m, '')}</clipPath>`).join('')}</defs>
        <image class="cut-lines" href="${IMG.lines}" width="${W}" height="${H}"/>
        ${MODULES.map((m) => `<image class="cut-colour" data-module="${m.id}" href="${IMG.colour}" width="${W}" height="${H}" clip-path="url(#cut-clip-${m.id})"/>`).join('')}
        <g class="cut-hits">${MODULES.map((m) => shape(m, `class="cut-hit" data-module="${m.id}" tabindex="0" role="button" aria-label="${esc(T(m.label))}"`)).join('')}</g>
      </svg>`;
  const chips = `
      <div class="cut-chips" role="tablist" aria-label="${esc(T('The parts of the habitat'))}">${MODULES.map((m, i) => `
        <button type="button" class="chip${i === 0 ? ' active' : ''}" role="tab" aria-selected="${i === 0 ? 'true' : 'false'}" aria-controls="cut-about-${m.id}" data-module="${m.id}">${esc(T(m.label))}</button>`).join('')}
      </div>`;
  const panel = MODULES.map((m, i) => `
      <article class="cut-about${i === 0 ? ' is-on' : ''}" id="cut-about-${m.id}" data-module="${m.id}" role="tabpanel"${i === 0 ? '' : ' hidden'}>
        <span class="cut-k">${T('Inside the habitat')} · <span data-field="stamp">${esc(f.stamp)}</span></span>
        <h3>${esc(T(m.label))}</h3>
        <p class="dome-now"><span class="dome-now-k">${T('Now')}</span> ${m.fig.map((k) => { const [id, part] = k.split('-'); return `<span data-field="${k}">${esc((f[id] || {})[part] || '')}</span>`; }).join(' ')}</p>
        ${m.about.map((t) => `<p>${esc([].concat(t).map(T).join(' '))}</p>`).join('')}
        <p><a class="btn" href="${m.href}">${T('Open its panel on the dashboard')} →</a></p>
      </article>`).join('');
  return `
  <section class="sheet sheet-p3 cutaway" id="inside" aria-label="${esc(T('Inside the habitat'))}" data-page>
    <div class="cut-card" id="cutaway" data-first="${first}">
      <div class="sheet-meta is-ruled"><span>${T('Inside the habitat')}</span><span class="cut-hint">${T('Hover over a part of the habitat — or touch it — to see it in colour and read what it is.')}</span></div>
      <div class="cut-body">
        <div class="cut-fig">${svg}${chips}</div>
        <aside class="cut-panel" aria-live="polite">${panel}</aside>
      </div>
    </div>
  </section>`;
}

module.exports = { cutaway, MODULES, figures, IMG };
