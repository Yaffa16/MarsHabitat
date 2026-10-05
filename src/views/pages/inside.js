'use strict';
/**
 * The habitat in section — a section of the About page (info.js, before Who we are; once the third page of the landing
 * page): the cutaway
 * drawing of the habitat handed over as two pictures (public/Svg_File/
 * mars-habitat-lineart-modules.svg and mars-habitat-colored-modules.svg —
 * each a stack of pictures: the Mars plain, the geodesic dome, and the
 * thirteen modules under it, each in its own box): the dome on the plain
 * drawn in its white lines (public/habitat/scene-lines.webp, the line-art
 * stack composed, 1536 × 1024), and **every module a key**: under the hand
 * the module shows itself in colour — its cut-out of the coloured picture
 * (public/habitat/modules/<id>.webp, cut at twice the size for sharpness)
 * comes in over its lines, a bright sweep crosses it once, its name comes
 * up on a tag at its floor line — and its pop-up opens, saying what that
 * part of the habitat is and what is happening in it now (the same
 * sentences the dome's keys carried, dome.js figures, refreshed every
 * twenty seconds from /api/dome). On a desk the drawing stands at the left
 * and the pop-up opens on the hand alone in the column at its right —
 * where, at rest, the hint alone stands — and goes when the hand leaves the
 * module and the pop-up; a touch screen opens it on a tap, the keyboard on
 * Enter. Two keys are not modules: EVA, the crew's daily walk outside, and
 * the Dashboard — round keys on the ground in front of the habitat. Under
 * the picture a line says what it is: AI generated image.
 *
 * The modules' boxes (rect, in the picture's own 1536 × 1024 coordinates)
 * are the line-art file's own layers, trimmed where two of them overlapped,
 * and their names are the file's layer names. The box the page shows
 * (VIEW) is the whole picture — a phone shows it as it is; a desk, where
 * the card fills the window, fits it to the stage beside the column (the
 * script, fit: a wider stage shows less of the sky over the dome, a taller
 * one more of it).
 */
const { esc } = require('../layout');
const { figures, LINE_ICONS } = require('./dome');

/* The picture's box — the whole of it is shown. */
const PIC = { w: 1536, h: 1024 };
const APEX_X = 769;                           // the dome's axis (its feet at 8 and 1530)
const VIEW = { x: 0, y: 0, w: PIC.w, h: PIC.h };
const VIEW_PHONE = VIEW;                                   // (a phone shows the box as it is; a desk fits it to its stage — the script, fit)
const SKY_MIN = 120;                          // how far down the sky a wider desk's box may begin: the dome's crown stands at 195
const GROUND = 838;                           // the ground line the dome stands on
const SCENE = '/habitat/scene-lines.webp?v=1';   // the drawing: the dome on the plain in its lines (the line-art stack, composed)
const MODULE_PICS = '/habitat/modules/';      // the modules in colour, one cut-out each (<id>.webp), at twice the picture's size

/* The modules, in the order the picture has them floor by floor: each with its box (rect: x, y, width, height, in the
   picture's coordinates — the line-art file's layer, trimmed where two overlapped), its name (the file's layer name),
   the fields of dome.js figures() whose live sentences it carries (fig), what it is (about — the words the dome's keys
   and the earlier drawing carried, where there are any) and the panel of the dashboard it leads to (href). A module with
   no sentences of its own (the lockers) lights up and is named, and opens nothing. */
const ROOMS = [
  { id: 'hydroponics', label: 'More-than-Human', href: '/dashboard#stores', btn: 'Open the Resources', fig: ['aeroponics-text', 'aeroponics-more'], rect: [270, 346, 325, 147],
    about: ['The habitat’s other astronauts: live crickets performing as our alternate protein source, a robot dog as an astronaut’s best friend and helper for space walks and an emotional support robot assisting in our mental health — and the gardens and hydroponic shelves, where fresh food can grow without soil.'] },
  { id: 'comms', label: 'Communication', href: '/write#exchanges', btn: 'Open the Message Board', fig: ['comms-text', 'comms-more'], rect: [595, 314, 349, 179],
    about: ['The crew is reachable by online message through this ground station website, by postcard and by direct communication each day at 19:00. All messages written here are also literally sent into space!'] },
  { id: 'science', label: 'Science Mission', href: '/dashboard#mission-today', btn: 'Open Today’s Mission', fig: ['mission-text', 'mission-more', 'sensors-text', 'sensors-more'], rect: [944, 349, 306, 144],
    about: ['Each of our days has a specific research mission, centered around one of the five topics MARS! is composed of: Habitat, Mental Health, Food, Governance or Resource Management. We take a hard look at our society from the red planet looking down on Earth.',
      'Sensors: everything is tracked inside the Red Dust City Habitat — CO₂, temperature, humidity, food rations, crew happiness. Keep in the loop and alert us if something seems amiss.'] },
  { id: 'airlock', label: 'Airlock', href: '/dashboard#schedule', btn: 'Open the Daily Schedule', fig: ['eva-text', 'eva-more'], rect: [102, 493, 109, 177],
    about: ['Going outside on Mars requires space suits and passing through an air lock. An EVA — extra-vehicular activity — is the crew’s daily walk on the Mars landscape of Karlsruhe’s Marktplatz at 16:00. Its mission is connected to the science mission of the day.'] },
  { id: 'kitchen', label: 'Kitchen', href: '/dashboard#galley', fig: ['kitchen-text', 'kitchen-more'], rect: [211, 493, 278, 177], about: [] },
  { id: 'storage', label: 'Storage', href: '/dashboard#stores', fig: ['recycling-text', 'aeroponics-text'], rect: [489, 493, 89, 177],
    about: ['Everything was carried in and nothing is resupplied: water, rations, medical kits, extinguishers. Used water passes through the recycling loop; the crew count the stores each evening.'] },
  { id: 'lounge', label: 'Crew', href: '/media', btn: 'Open the Media Gallery', fig: ['crew-more'], rect: [578, 493, 335, 187],
    about: ['Three astronauts from ZKM — Commander/Comms, Health Officer, and Science Officer — have volunteered to lead this experiment and are now stationed in the Red Dust City Habitat, each with their own role and responsibilities. You can check what they’re doing in the livestream gallery, see their moods and find out more about their daily duties.'] },
  { id: 'quarters', label: 'Living Quarters', href: '/dashboard#crew', btn: 'Open Crew Moods', fig: ['crew-text'], rect: [913, 493, 238, 178],
    about: ['Each day has a strict schedule the astronauts adhere to and the Habitat is divided into specific zones for working, cooking, playing and sleeping — because going out for a stroll requires serious effort. Have a look in the media gallery or look inside our windows on the MARS!platz to see how we are using the space.'] },
  { id: 'health', label: 'Health Station', href: '/dashboard#crew', fig: ['health-text', 'health-more'], rect: [1151, 493, 288, 178], about: [] },
  { id: 'lockers', label: 'Equipment Lockers', href: null, fig: [], rect: [46, 666, 149, 164], about: [] },
  { id: 'recycling', label: 'Water Recycling', href: '/dashboard#stores', btn: 'Open the Resources', fig: ['recycling-text', 'recycling-more'], rect: [195, 670, 420, 165],
    about: ['When every liter of water has to be carried up by space rocket, we become more mindful of our usage. Our water recycling system is one of the things we brought to reflect on resources and how we are currently treating them on Earth.'] },
  { id: 'cycle', label: 'Cycle (Power Generation)', href: '/dashboard#power', fig: ['generator-text', 'generator-more'], rect: [904, 680, 191, 155],
    about: ['A bicycle generator: pedalling charges the battery. The health officer’s workout is also the habitat’s power plant — the steps and the kilowatt-hours are the same effort.'] },
  { id: 'power', label: 'Electricity', href: '/dashboard#power', btn: 'Open the Power Balance', fig: ['generator-text', 'power-text'], rect: [1095, 680, 122, 155],
    about: ['We measure our energy expenditure: how much comes in, how much goes out: from calorie intake to taken steps, from power produced by muscle to electricity consumption. Check out our power balance in the dashboard!'] },
];
const hasPopup = (r) => !!(r.fig.length || r.about.length);

/* The two keys that are not modules — round keys with line icons, as the dome drew them, on the ground in front of the
   habitat, either side of its axis, drawn larger than the picture's units: on a desk a little (desk, DESK_KEY), with the
   name on a tag under the key; on a phone more, under the thumb (at, PHONE_KEY), the name on a tag over the key (which
   the stylesheet hides there with the modules' tags). */
const KEYS = [
  { id: 'dashboard', label: 'Dashboard', href: '/dashboard#mission', fig: ['dashboard-text'], at: [626, 940], desk: [626, 906], btn: 'Open the Mission Dashboard',
    about: ['The Mission Dashboard is the station’s instrument panel: the live readings, today’s schedule and meal, the crew’s condition, the trends and the three daily blogs, on one page.'] },
  { id: 'eva', label: 'Going Outside', href: '/dashboard#schedule', btn: 'Open the Daily Schedule', fig: ['eva-text', 'eva-more'], at: [912, 940], desk: [912, 906],
    about: ['Going outside on Mars requires space suits and passing through an air lock. An EVA — extra-vehicular activity — is the crew’s daily walk on the Mars landscape of Karlsruhe’s Marktplatz at 16:00. Its mission is connected to the science mission of the day.'] },
];
const PARTS = ROOMS.filter(hasPopup).concat(KEYS);
const DESK_KEY = 1.15, PHONE_KEY = 1.9;             // how much larger than the picture's units the two keys are drawn: on a desk, on a phone
const KEY_TAG = 42 + 12 + 20;                        // how far from a key's centre its name's tag stands (over it on a phone, under it on a desk)

/* The pop-ups' marks: the dome's line icons, by the module they stand for, and a few of the same hand for the modules
   the dome had no key for. */
const ICONS = Object.assign({}, LINE_ICONS, {
  hydroponics: LINE_ICONS.aeroponics,
  airlock: '<rect x="5" y="3.5" width="14" height="17" rx="3"/><circle cx="12" cy="12" r="3.2"/><path d="M12 8.8v-2"/><path d="M12 17.2v-2"/>',   // the hatch
  kitchen: '<path d="M4 11h16"/><path d="M5.5 11v6a2 2 0 0 0 2 2h9a2 2 0 0 0 2-2v-6"/><path d="M8 11V8.5a4 4 0 0 1 8 0V11"/><path d="M3 11h18"/>',   // the pot
  storage: '<rect x="4" y="9" width="16" height="11" rx="1.5"/><path d="M4 12.5h16"/><path d="M6.5 9V5.5h11V9"/><path d="M10 15.5h4"/>',   // the crate
  lounge: LINE_ICONS.crew,
  quarters: '<path d="M3 18.5v-11"/><path d="M3 15.5h18v3"/><path d="M3 12.5h18"/><circle cx="7.5" cy="9.5" r="1.8"/><path d="M11 12.5v-2A1.5 1.5 0 0 1 12.5 9H19a2 2 0 0 1 2 2v1.5"/>',   // the bunk
  health: '<path d="M12 4.5v15"/><path d="M4.5 12h15"/><rect x="4.5" y="4.5" width="15" height="15" rx="3.5"/>',   // the cross
  cycle: LINE_ICONS.generator,
});

const S = 42;                                        // the outside keys' radius, in the picture's units
const KEY_ICON = (S / 27).toFixed(3);                // the dome drew a 24-unit icon in a key of radius 27
const tagWidth = (text) => Math.round(text.length * 11.6 + 40);   // the name's tag, estimated from the name (19-unit type)
const rectOf = (r) => ({ x: r.rect[0], y: r.rect[1], w: r.rect[2], h: r.rect[3] });

/** A key's mark for the pop-up's head: the round key with its line icon, as the dome drew it. */
const mark = (p) => `<svg class="dome-mark" viewBox="-30 -30 60 60" aria-hidden="true"><circle class="dome-pod" r="27"/>
        <g class="dome-ic dome-ic-line" transform="translate(-12 -12)">${ICONS[p.id]}</g></svg>`;

/** A module's layers, bottom to top, each carrying the module's id: its picture in colour (over its lines; unseen until
 *  lit, when it comes in over them), the sweep that crosses it once when lit (a band clipped to the module), then its
 *  box itself as the key, and its name on a tag at its floor line (unseen until lit). */
const picture = (r) => { const b = rectOf(r); return `<image class="in-pic" data-hex="${r.id}" href="${MODULE_PICS}${r.id}.webp?v=1" x="${b.x}" y="${b.y}" width="${b.w}" height="${b.h}" preserveAspectRatio="none"/>`; };
function sweep(r) {
  const b = rectOf(r), w = Math.round(b.w * 0.26);
  return `<g clip-path="url(#in-clip-${r.id})"><rect class="in-sweep" data-hex="${r.id}" x="${b.x}" y="${b.y - 20}" width="${w}" height="${b.h + 40}"/></g>`;
}
function roomSvg(r, T) {
  const name = T(r.label), w = tagWidth(name), b = rectOf(r), tx = Math.round(b.x + b.w / 2), ty = b.y + b.h;
  const popup = hasPopup(r);
  return `<g class="in-part" data-part="${r.id}">
        <rect class="in-room" data-hex="${r.id}" x="${b.x}" y="${b.y}" width="${b.w}" height="${b.h}" role="button" tabindex="0"${popup ? ` aria-haspopup="dialog" aria-controls="dome-${r.id}"` : ''}><title>${esc(name)}</title></rect>
        <g class="dome-tag in-tag" data-hex="${r.id}" data-x="${tx}" data-y="${ty}" aria-hidden="true"><rect x="${tx - w / 2}" y="${ty - 20}" width="${w}" height="40" rx="20"/><text x="${tx}" y="${ty + 6.5}" text-anchor="middle">${esc(name)}</text></g>
      </g>`;
}

/** A key outside the shell: the round key, its name on a tag — under it (a desk) or over it (a phone): the script sets
 *  the tag's place with the key's size and position (fit). */
function keySvg(k, T) {
  const name = T(k.label), w = tagWidth(name);
  return `<g class="dome-hex in-key" data-hex="${k.id}" data-at="${k.at.join(',')}" data-desk="${k.desk.join(',')}" transform="translate(${k.desk[0]} ${k.desk[1]}) scale(${DESK_KEY})" role="button" tabindex="0" aria-haspopup="dialog" aria-controls="dome-${k.id}">
        <title>${esc(name)}</title>
        <g class="dome-hex-body"><circle class="dome-pod" r="${S}"/>
          <g class="dome-ic dome-ic-line" transform="scale(${KEY_ICON}) translate(-12 -12)">${ICONS[k.id]}</g></g>
        <g class="dome-tag in-tag" data-x="0" data-y="0" aria-hidden="true"><g class="in-key-tag" transform="translate(0 ${KEY_TAG})"><rect x="${-w / 2}" y="-20" width="${w}" height="40" rx="20"/><text x="0" y="6.5" text-anchor="middle">${esc(name)}</text></g></g>
      </g>`;
}

/**
 * The panel: the head (the name of the page, the hint), the drawing on the plain with its rooms and the two keys, a
 * pop-up per part, and the script that opens the pop-ups and keeps their sentences current. The arguments are the
 * dome's (dome.js, habitatDome): the day, the crew, the latest exchanges, the power, the counts and the crew's figures.
 */
function habitatInside(ctx, args) {
  const T = ctx.T;
  const f = figures(ctx, args);
  const popup = (p) => `
    <dialog class="popup dome-popup" id="dome-${p.id}" aria-labelledby="dome-${p.id}-title">
      <div class="popup-head">
        ${mark(p)}
        <div><span class="fold-title" id="dome-${p.id}-title">${esc(T(p.label))}</span><span class="fold-sub"><span data-field="stamp">${esc(f.stamp)}</span></span></div>
        <button type="button" class="popup-close" data-close aria-label="${esc(T('Close'))}"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18"/></svg></button>
      </div>
      <div class="popup-body">
        ${p.about.map((t) => `<p>${esc(T(t))}</p>`).join('')}
        <p class="dome-now"><span class="dome-now-k">${T('Now')}</span> ${p.fig.map((k) => { const [id, part] = k.split('-'); return `<span data-field="${k}">${esc((f[id] || {})[part] || '')}</span>`; }).join(' ')}</p>
        <p><a class="btn" href="${p.href}" data-close>${T(p.btn || 'Open its panel on the dashboard')} →</a></p>
      </div>
    </dialog>`;
  // the hint: on a desk the hand alone opens a room, on a touch screen a tap (sheet.css shows the one that applies)
  const hint = `<span class="dome-meta dome-hint"><span class="dome-hint-click">${T('Point at a room to know what is inside.')}</span><span class="dome-hint-tap">${T('Tap a room to know what is inside.')}</span></span>`;
  const vb = (v) => `${v.x} ${v.y} ${v.w} ${v.h}`;
  return `
  <section class="dome-panel is-inside" id="habitat-dome" aria-label="${esc(T('What’s inside the habitat?'))}">
    <header class="dome-head">
      <div class="dome-title"><h2>${T('What’s inside the habitat?')}</h2></div>
      ${hint}
    </header>
    <div class="dome-screen">
      <!-- a desk: the drawing at the left and, at its right, the column the pop-up opens in — at rest the hint alone
           (sheet.css lays the two out; a phone has the drawing alone) -->
      <div class="dome-stage">
        <svg class="dome-svg inside-svg" viewBox="${vb(VIEW)}" data-view="${vb(VIEW)}" data-view-phone="${vb(VIEW_PHONE)}" preserveAspectRatio="xMidYMid meet" role="img" aria-label="${esc(T('The habitat in section: its rooms under the dome, on the Mars plain'))}">
          <defs>
            <linearGradient id="in-sweep-light" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#fff" stop-opacity="0"/><stop offset=".42" stop-color="#fff" stop-opacity=".5"/><stop offset=".5" stop-color="#fff" stop-opacity=".95"/><stop offset=".58" stop-color="#fff" stop-opacity=".5"/><stop offset="1" stop-color="#fff" stop-opacity="0"/></linearGradient>
            ${ROOMS.map((r) => { const b = rectOf(r); return `<clipPath id="in-clip-${r.id}"><rect x="${b.x}" y="${b.y}" width="${b.w}" height="${b.h}"/></clipPath>`; }).join('')}
          </defs>
          <clipPath id="in-frame-clip"><rect class="in-frame" x="${VIEW.x}" y="${VIEW.y}" width="${VIEW.w}" height="${VIEW.h}" rx="26"/></clipPath>
          <g class="in-picture" clip-path="url(#in-frame-clip)">
            <image class="in-scene" href="${SCENE}" x="0" y="0" width="${PIC.w}" height="${PIC.h}" preserveAspectRatio="none" aria-hidden="true"/>
            <g class="in-pics" aria-hidden="true">${ROOMS.map(picture).join('')}</g>
            <g class="in-sweeps" aria-hidden="true">${ROOMS.map(sweep).join('')}</g>
          </g>
          <g class="in-rooms">${ROOMS.map((r) => roomSvg(r, T)).join('')}</g>
          <g class="dome-hexes">${KEYS.map((k) => keySvg(k, T)).join('')}</g>
        </svg>
      </div>
      <aside class="in-aside">
        <p class="in-aside-hint">${hint}</p>
      </aside>
    </div>
    <p class="in-credit">${T('AI generated image')}</p>
    <p class="dome-caption" aria-hidden="true"></p>
    ${PARTS.map(popup).join('')}
    <script>
    (function () {
      var root = document.getElementById('habitat-dome'); if (!root) return;
      var VB = [${VIEW.x}, ${VIEW.y}, ${VIEW.w}, ${VIEW.h}], AX = ${APEX_X};
      var hover = !!(window.matchMedia && window.matchMedia('(hover: hover) and (pointer: fine)').matches);   // a desk: the hand alone opens a room
      function dialogOf(id) { var d = document.getElementById('dome-' + id); return d && d.tagName === 'DIALOG' ? d : null; }
      var by = {}, from = {}, shown = null;              // how each pop-up was opened ('hand', 'hover' or 'key'board), from which element; the pop-up open on the hand
      // A pop-up opened on the hand alone stands open without taking the page (no backdrop, nothing modal), so the
      // hand can go on to the next room — or into the pop-up itself, to its key — and it goes when the hand has left
      // both. A tap, a click or Enter opens the same pop-up for good, over the page, until it is closed.
      function open(id, how, el) {
        var d = dialogOf(id); if (!d) return;
        if (how === 'hover') {
          if (d.open && shown === id) return;
          if (shown && shown !== id) { var o = dialogOf(shown); if (o && o.open) { o.removeAttribute('open'); settle(shown); } }
          root.querySelectorAll('dialog.dome-popup[open]').forEach(function (x) { if (x !== d) x.close(); });
          shown = id; by[id] = 'hover'; from[id] = el || null;
          d.classList.add('is-hover'); d.setAttribute('open', '');
        } else {
          if (d.open && by[id] === 'hover') { d.removeAttribute('open'); d.classList.remove('is-hover'); shown = null; }   // the hand's pop-up becomes the hand's own, for good
          if (d.open) return;
          by[id] = how || 'hand'; from[id] = el || null; d.classList.remove('is-hover');
          if (typeof d.showModal === 'function') d.showModal(); else d.setAttribute('open', '');
        }
        d.querySelector('.popup-body').scrollTop = 0;
        place(d, from[id]);
        lit(id, true);                                   // the room stays lit while its pop-up is open
        root.classList.add('has-popup');                 // the column's index gives way to the pop-up (sheet.css)
      }
      function shut(id) { var d = dialogOf(id); if (!d || !d.open) return; if (by[id] === 'hover') { d.removeAttribute('open'); d.classList.remove('is-hover'); if (shown === id) shown = null; settle(id); } else d.close(); gone(); }
      function gone() { if (!root.querySelector('dialog.dome-popup[open]')) root.classList.remove('has-popup'); }
      // On a desk the pop-up stands in the column at the right of the drawing (the aside, sheet.css), never on the
      // picture: as wide as the column, level with the middle of the drawing, kept within the window. A phone held
      // upright opens it over the drawing; otherwise (a short screen, where the column is not laid out) it opens beside
      // the part that was pressed.
      function place(d, el) {
        if (upright()) { above(d); return; }
        if (column(d)) return;
        beside(d, el);
      }
      function column(d) {
        var col = root.querySelector('.in-aside'); if (!col) return false;
        var cr = col.getBoundingClientRect(); if (cr.width < 200 || getComputedStyle(col).display === 'none') return false;
        d.style.width = Math.round(cr.width) + 'px'; d.style.margin = '0';
        var h = d.getBoundingClientRect().height, lo = below() + 8, hi = window.innerHeight - 8;
        var top = cr.top + (cr.height - h) / 2;                                      // level with the middle of the drawing
        if (h >= cr.height) top = cr.top;                                            // taller than the column: from its top
        put(d, Math.round(cr.left), Math.round(Math.max(Math.min(top, hi - h), Math.min(lo, top))));
        return true;
      }
      // A pop-up is placed at a point on the screen. One opened for good stands in the top layer, where the screen's
      // corner is its origin; one opened on the hand stands in the card, whose frosted glass makes it the origin
      // instead (a backdrop filter contains what is fixed inside it) — so the pop-up is set, measured, and moved by
      // whatever the difference was.
      function put(d, left, top) {
        d.style.left = left + 'px'; d.style.top = top + 'px';
        var r = d.getBoundingClientRect(), dx = r.left - left, dy = r.top - top;
        if (Math.abs(dx) > 0.5 || Math.abs(dy) > 0.5) { d.style.left = (left - dx) + 'px'; d.style.top = (top - dy) + 'px'; }
      }
      // The picture on the screen: its edges, and the dome's axis (the drawing is centred in its stage and scaled to
      // fit it, its foot at the stage's foot).
      function picture() {
        var svg = root.querySelector('.dome-svg'), sr = svg.getBoundingClientRect();
        var scale = Math.min(sr.width / VB[2], sr.height / VB[3]), side = (sr.width - VB[2] * scale) / 2, over = (sr.height - VB[3] * scale) / 2;   // centred in its stage
        return { x: sr.left + sr.width / 2 + (AX - (VB[0] + VB[2] / 2)) * scale, left: sr.left + side, right: sr.right - side, top: sr.top + over, bottom: sr.bottom - over };
      }
      function below() { var t = document.querySelector('.ticker'); return t ? Math.max(0, t.getBoundingClientRect().bottom) : 0; }   // the header's foot
      function upright() { return window.matchMedia && window.matchMedia('(max-width: 760px) and (min-height: 521px)').matches; }
      function phone() { return window.matchMedia && window.matchMedia('(max-width: 760px), (max-height: 520px)').matches; }
      // A phone held upright: the pop-up over the picture where there is room for it under the header; else under the
      // picture — the lit module stays in view — as tall as the screen allows (its body scrolls inside); on a screen
      // too short for that, over the picture after all.
      function above(d) {
        var vw = window.innerWidth, vh = window.innerHeight, m = 8;
        var w = Math.min(vw - 2 * m, 560); d.style.width = w + 'px'; d.style.margin = '0'; d.style.maxHeight = '';
        var h = d.getBoundingClientRect().height, pic = picture(), lo = below() + m;
        var top = pic.top - 10 - h;
        if (top < lo) {
          top = pic.bottom + 10;
          var room = vh - m - top;
          if (room < 200) top = Math.max(lo, vh - m - h);
          else if (h > room) d.style.maxHeight = room + 'px';
        }
        put(d, Math.round((vw - w) / 2), Math.round(top));
      }
      function beside(d, el) {
        d.style.top = ''; d.style.left = ''; d.style.width = ''; d.style.margin = '';
        if (!el || !el.getBoundingClientRect) return;
        var k = el.getBoundingClientRect(), vw = window.innerWidth, vh = window.innerHeight, m = 8;
        if (!k.width && !k.height) return;
        var w = Math.min(vw - 2 * m, 560); d.style.width = w + 'px'; d.style.margin = '0';
        var h = d.getBoundingClientRect().height;
        var top = k.bottom + 10;
        if (top + h > vh - m) top = k.top - 10 - h;
        if (top < m) {
          var roomR = vw - m - (k.right + 10), roomL = k.left - 10 - m, right = roomR >= roomL, room = Math.min(w, right ? roomR : roomL);
          if (room >= 280) {
            d.style.width = room + 'px'; h = d.getBoundingClientRect().height;
            put(d, right ? k.right + 10 : k.left - 10 - room, Math.max(m, Math.min(vh - m - h, k.top + k.height / 2 - h / 2)));
            return;
          }
          top = Math.max(m, Math.min(vh - m - h, k.bottom + 10));
        }
        put(d, Math.max(m, Math.min(vw - m - w, k.left + k.width / 2 - w / 2)), top);
      }
      // One rule for a part's light: it is lit while the hand is over it (or over its pop-up), while it has keyboard
      // focus, or while its pop-up is open — and goes dark the moment none of those is true (:focus-visible: a click's
      // focus alone does not count). Every layer of a room carries its id, so all of them light together.
      function lit(id, on) { root.querySelectorAll('[data-hex="' + id + '"]').forEach(function (x) { x.classList.toggle('lit', !!on); }); }
      function is(x, sel) { try { return x.matches(sel); } catch (e) { return sel === ':focus-visible' ? x === document.activeElement : false; } }
      function settle(id) {
        var d = dialogOf(id), any = !!(d && d.open);
        if (!any) root.querySelectorAll('[data-hex="' + id + '"]').forEach(function (x) { if (is(x, ':hover') || is(x, ':focus-visible')) any = true; });
        lit(id, any);
      }
      // The hand: a moment over a part opens its pop-up; a moment after it has left the part and the pop-up, the pop-up goes.
      var enterT = null, leaveT = null, over = null;
      function arrive(id, el) {
        if (!dialogOf(id)) { over = null; clearTimeout(enterT); clearTimeout(leaveT); leaveT = setTimeout(function () { if (over == null && shown != null) shut(shown); }, 320); return; }   // a part with no pop-up (the lockers): lit and named, and the last pop-up goes
        over = id; clearTimeout(leaveT); clearTimeout(enterT);
        if (shown && shown !== id) { enterT = setTimeout(function () { if (over === id) open(id, 'hover', el); }, 60); }
        else enterT = setTimeout(function () { if (over === id) open(id, 'hover', el); }, 140);
      }
      function depart(id) {
        if (over === id) over = null; clearTimeout(enterT);
        clearTimeout(leaveT); leaveT = setTimeout(function () { if (over == null && shown != null) shut(shown); }, 320);
      }
      root.querySelectorAll('[data-hex]').forEach(function (n) {
        var id = n.getAttribute('data-hex');
        n.addEventListener('click', function () { open(id, 'hand', n); });
        n.addEventListener('keydown', function (e) { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); open(id, 'key', n); } });
        n.addEventListener('mouseenter', function () { lit(id, true); if (hover) arrive(id, n); });
        n.addEventListener('mouseleave', function () { settle(id); if (hover) depart(id); });
        n.addEventListener('focus', function () { if (is(n, ':focus-visible')) lit(id, true); });
        n.addEventListener('blur', function () { settle(id); });
      });
      root.querySelectorAll('dialog.dome-popup').forEach(function (d) {
        var id = d.id.replace(/^dome-/, '');
        d.querySelectorAll('[data-close]').forEach(function (b) { b.addEventListener('click', function () { if (by[id] === 'hover') shut(id); else d.close(); }); });
        d.addEventListener('click', function (e) { if (e.target === d && by[id] !== 'hover') d.close(); });
        // the hand in the pop-up keeps it; leaving it lets it go
        d.addEventListener('mouseenter', function () { if (by[id] === 'hover') { over = id; clearTimeout(leaveT); } });
        d.addEventListener('mouseleave', function () { if (by[id] === 'hover') depart(id); });
        d.addEventListener('close', function () {
          var drop = function () {
            if (by[id] !== 'key') { var a = document.activeElement; if (a && a.getAttribute && a.getAttribute('data-hex') === id) a.blur(); }
            settle(id); gone();
          };
          drop(); setTimeout(drop, 0); setTimeout(drop, 150);
        });
      });
      document.addEventListener('keydown', function (e) { if (e.key === 'Escape' && shown) shut(shown); });   // a modal pop-up closes itself on Escape; the hand's does not
      // The sentences follow the station: every 20 seconds the figures are asked for again and the pop-ups rewritten
      // in place (public/sky.js watches the communication room's for a new exchange).
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
      // The box the page shows: on a phone the whole picture (VIEW); on a desk the shape of its stage — the card fills
      // the window and the stage is what is left beside the column (sheet.css) — a wider stage shows less of the sky
      // over the dome (the box's top moved down, never past SKY_MIN), a taller one all of it with room over it; its
      // foot and the dome's axis where they were. The two keys are drawn larger on a phone.
      var drawing = root.querySelector('.dome-svg'), frame = root.querySelector('.in-frame'), onView = '';
      var BASE = [${VIEW.x}, ${VIEW.y}, ${VIEW.w}, ${VIEW.h}], SKY_MIN = ${SKY_MIN};
      function fit() {
        var p = phone(), v = BASE.slice(), sr = drawing.getBoundingClientRect();
        if (!p && sr.width > 0 && sr.height > 0) {
          var ar = sr.width / sr.height, foot = BASE[1] + BASE[3];
          if (ar > BASE[2] / BASE[3]) { var h = Math.max(foot - SKY_MIN, Math.round(BASE[2] / ar)); v = [BASE[0], foot - h, BASE[2], h]; }
        }
        var key = (p ? 'phone ' : 'desk ') + v.join(' ');
        if (key === onView) return; onView = key;
        drawing.setAttribute('viewBox', v.join(' ')); VB = v;
        if (frame) { frame.setAttribute('x', v[0]); frame.setAttribute('y', v[1]); frame.setAttribute('width', v[2]); frame.setAttribute('height', v[3]); }
        keyK = p ? ${PHONE_KEY} : ${DESK_KEY};
        root.querySelectorAll('.in-key').forEach(function (k) {
          var at = (k.getAttribute(p ? 'data-at' : 'data-desk') || '').split(',');
          if (at.length === 2) k.setAttribute('transform', 'translate(' + at[0] + ' ' + at[1] + ') scale(' + keyK + ')');
          var t = k.querySelector('.in-key-tag'); if (t) t.setAttribute('transform', 'translate(0 ' + (p ? -${KEY_TAG} : ${KEY_TAG}) + ')');   // the name over the key on a phone, under it on a desk
        });
        tagK = 0; tagScale();
      }
      // The names are set in the drawing's units, and the drawing is scaled to the room the page gives it: where it is
      // drawn small the tags are enlarged again, about their own anchor, so a name reads at no less than TAG_PX on the
      // screen — never made smaller than drawn (the stylesheet hides them on a phone). A key's tag stands inside the
      // key, which is drawn larger than the units (keyK): it is scaled down by as much, so it reads like the rooms'.
      var TAG_PX = 12.5, TAG_UNITS = 19, tagK = 1, keyK = ${DESK_KEY};
      function tagScale() {
        var m = drawing && drawing.getScreenCTM ? drawing.getScreenCTM() : null, px = m ? Math.sqrt(m.a * m.a + m.b * m.b) : 0;
        var k = px > 0 ? Math.min(1.6, Math.max(1, TAG_PX / (TAG_UNITS * px))) : 1;
        if (Math.abs(k - tagK) < 0.01) return;
        tagK = k;
        root.querySelectorAll('.in-tag').forEach(function (g) {
          var x = +g.getAttribute('data-x'), y = +g.getAttribute('data-y'), kk = g.closest('.in-key') ? k / keyK : k;
          g.setAttribute('transform', Math.abs(kk - 1) < 0.001 ? '' : 'translate(' + x + ' ' + y + ') scale(' + kk.toFixed(3) + ') translate(' + -x + ' ' + -y + ')');
        });
      }
      fit(); window.addEventListener('resize', function () { fit(); tagScale(); });
      if ('ResizeObserver' in window) new ResizeObserver(function () { fit(); tagScale(); }).observe(drawing);
    })();
    </script>
  </section>`;
}

module.exports = { habitatInside, ROOMS, KEYS, VIEW, VIEW_PHONE, SCENE, MODULE_PICS };
