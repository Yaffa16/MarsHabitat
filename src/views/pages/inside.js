'use strict';
/**
 * The habitat in section — the third page of the landing page: the cutaway
 * drawing of Habitat One that was handed over (the geodesic shell, and under
 * it the rooms, floor by floor: the hydroponic shelves, the communication
 * station under the dish, the laboratory; the health station, the crew's
 * round room under the crown, the sleeping pod; the water recycling loop
 * and the bicycle generator with the power store), its lines in warm white
 * **on the Mars plain** — the photograph handed over (public/habitat/
 * ground.jpg: the red plain, the hills at the horizon, the dusty sky), set
 * behind the drawing so the habitat stands on the ground at the picture's
 * foot and the horizon runs behind its lower rooms. Each room is a dark
 * panel on it — the inside of the habitat — with its furniture drawn in
 * white. **Every room is a key**: under the hand its lights come on — the
 * room fills with a warm light, a glow bleeds through its walls, a bright
 * sweep crosses it once, its lines turn pure white, its name's tag fills —
 * and its pop-up opens, saying what that part of the habitat is and what is
 * happening in it now (the same sentences the dome's keys carried, dome.js
 * figures, refreshed every twenty seconds from /api/dome). On a desk the
 * pop-up opens on the hand alone, over the crown of the shell, and goes
 * when the hand leaves the room and the pop-up; a touch screen opens it on
 * a tap, the keyboard on Enter. Two keys are not rooms: EVA, the crew's
 * daily walk outside, and the Dashboard — round keys on the ground either
 * side of the shell (on a phone, in front of it, under the ground line).
 *
 * The linework is public/habitat/inside.svg — traced from the picture by
 * tools/trace-inside.py, every line a filled path in currentColor, one path
 * per room and one for the shell — drawn here with <use>, so the page
 * carries the rooms' outlines, the keys and the pop-ups alone and the
 * browser keeps the drawing. The outlines (ROOMS, in the picture's own
 * 1536 × 1024 coordinates) are the same the tracer sorts the lines by. A
 * desk shows the picture cropped to the habitat and the ground it stands on,
 * with room on the ground either side for the two keys (VIEW); a phone a
 * tighter crop, the shell the width of the screen, taller under the ground
 * line for the two keys in front of it (VIEW_PHONE) — public/sheet.css and
 * the script below switch between the two.
 */
const { esc } = require('../layout');
const { ABOUT, figures, LINE_ICONS } = require('./dome');

/* The picture's box, and the parts of it the page shows. */
const PIC = { w: 1536, h: 1024 };
const VIEW = { x: -60, y: 118, w: 1656, h: 750 };          // a desk: the dome, and the ground either side for the keys
const VIEW_PHONE = { x: 60, y: 118, w: 1412, h: 920 };     // a phone: the shell edge to edge, the ground under it for the keys
const APEX = { x: 766, y: 136 };            // the crown of the shell: the pop-up opens over it
const GROUND = 862;                          // the ground line the dome stands on
const INK = '/habitat/inside.svg';           // the linework, by the tracer
const PLAIN = '/habitat/ground.jpg';         // the Mars plain behind it

/* The rooms, in the order the chips name them: each with its outline (poly, in the picture's coordinates), where its
   name stands (tag — on the room's floor line), the fields of dome.js figures() whose live sentences it carries (fig),
   what it is (about — the dome's words where the key exists) and the panel of the dashboard it leads to (href). */
const ROOMS = [
  { id: 'aeroponics', label: 'Hydroponics', href: '#galley', fig: ['aeroponics-text', 'aeroponics-more'], about: [ABOUT.aeroponics],
    poly: [[330, 357], [540, 357], [572, 392], [572, 485], [540, 517], [330, 517], [296, 485], [296, 392]], tag: [434, 517] },
  { id: 'comms', label: 'Communication', href: '#exchanges', fig: ['comms-text', 'comms-more'], about: [ABOUT.comms],
    poly: [[588, 350], [612, 322], [690, 290], [766, 278], [842, 290], [920, 322], [942, 350], [942, 452], [915, 478], [614, 478], [588, 452]], tag: [765, 478] },
  { id: 'science', label: 'Science lab', href: '#crewlog', fig: ['science-text', 'science-more'], about: [ABOUT.science],
    poly: [[990, 357], [1210, 357], [1255, 392], [1255, 485], [1210, 517], [990, 517], [960, 485], [960, 392]], tag: [1107, 517] },
  { id: 'health', label: 'Health station', href: '#crew', fig: ['health-text', 'health-more'],
    about: ['The health station: a bed, the monitors and the medicine cabinet, where the health officer looks after the crew — their condition, their steps, what they have eaten — and the life support with them, and where the Daily Health Blog is written each day.'],
    poly: [[255, 530], [540, 530], [600, 585], [600, 650], [560, 695], [255, 695], [220, 650], [220, 585]], tag: [410, 695] },
  { id: 'crew', label: 'Crew', href: '#crew', fig: ['crew-text', 'crew-more'],
    about: ['The lounge, under the crown: the one room in the habitat that is nobody’s station — the round sofa where the three meet, eat, plan the day and end it. Each of them files their condition from inside, in words, and it stands on the dashboard.', ABOUT.crew],
    poly: [[610, 515], [935, 515], [975, 560], [975, 660], [935, 710], [610, 710], [600, 650], [600, 585]], tag: [772, 710] },
  { id: 'nap', label: 'Nap pod', href: '#schedule', fig: ['nap-text'],
    about: ['Two sleeping pods, each a bunk closed off from the light and the sound of the habitat. Rest is on the schedule like everything else: the hours are written on the day’s plan, and the crew keep to them as they keep to the rest.'],
    poly: [[1050, 530], [1270, 530], [1300, 565], [1300, 660], [1270, 695], [1050, 695], [1020, 660], [1020, 565]], tag: [1160, 695] },
  { id: 'recycling', label: 'Water recycling', href: '#habitat', fig: ['recycling-text', 'recycling-more'], about: [ABOUT.recycling],
    poly: [[395, 728], [690, 728], [725, 775], [660, 862], [285, 862], [330, 775]], tag: [505, 862] },
  { id: 'power', label: 'Power', href: '#habitat', fig: ['power-text', 'generator-text'], about: [ABOUT.power, ABOUT.generator],
    poly: [[870, 728], [1125, 728], [1125, 862], [860, 862], [830, 775]], tag: [992, 862] },
];

/* The two keys that are not rooms — round keys with line icons, as the dome drew them, each named on a tag over it:
   on a desk on the ground either side of the shell (at), on a phone in front of the habitat under its ground line,
   drawn larger under the thumb (phone). */
const KEYS = [
  { id: 'dashboard', label: 'Dashboard', href: '#mission', fig: ['dashboard-text'], about: [ABOUT.dashboard], at: [-6, 820], phone: [626, 952], btn: 'Open the Mission Dashboard' },
  { id: 'eva', label: 'EVA', href: '#schedule', fig: ['eva-text', 'eva-more'], about: [].concat(ABOUT.eva), at: [1542, 820], phone: [906, 952] },
];
const PARTS = ROOMS.concat(KEYS);
const PHONE_KEY = 1.9;                               // how much larger a phone draws the two keys

/* The pop-ups' marks: the dome's line icons, and two of its hand for the rooms the dome had no key for. */
const ICONS = Object.assign({}, LINE_ICONS, {
  health: '<rect x="3.5" y="7.5" width="17" height="12" rx="2"/><path d="M12 10.5v6"/><path d="M9 13.5h6"/><path d="M9 7.5V6a1.5 1.5 0 0 1 1.5-1.5h3A1.5 1.5 0 0 1 15 6v1.5"/>',   // the medicine cabinet: a case with a cross
  nap: '<path d="M3 18.5v-11"/><path d="M3 15.5h18v3"/><path d="M3 12.5h18"/><circle cx="7.5" cy="9.5" r="1.8"/><path d="M11 12.5v-2A1.5 1.5 0 0 1 12.5 9H19a2 2 0 0 1 2 2v1.5"/>',   // the bunk
});

const S = 42;                                        // the outside keys' radius, in the picture's units
const KEY_ICON = (S / 27).toFixed(3);                // the dome drew a 24-unit icon in a key of radius 27
const pts = (poly) => poly.map(([x, y]) => `${x},${y}`).join(' ');
const box = (poly) => { const xs = poly.map((p) => p[0]), ys = poly.map((p) => p[1]); const x = Math.min(...xs), y = Math.min(...ys); return { x, y, w: Math.max(...xs) - x, h: Math.max(...ys) - y }; };
const tagWidth = (text) => Math.round(text.length * 11.6 + 40);   // the name's tag, estimated from the name (19-unit type)

/** A key's mark for the pop-up's head: the round key with its line icon, as the dome drew it. */
const mark = (p) => `<svg class="dome-mark" viewBox="-30 -30 60 60" aria-hidden="true"><circle class="dome-pod" r="27"/>
        <g class="dome-ic dome-ic-line" transform="translate(-12 -12)">${ICONS[p.id]}</g></svg>`;

/** A room's layers, bottom to top, each carrying the room's id: the glow through its walls (its outline blurred, unseen
 *  until lit), its dark floor, its lamp (a warm light over the floor, unseen until lit), its lines, the sweep that
 *  crosses it once when lit (a band clipped to the room), then the outline itself as the key, and its name on a tag. */
const halo = (r) => `<polygon class="in-halo" data-hex="${r.id}" points="${pts(r.poly)}" filter="url(#in-glow)"/>`;
const floor = (r) => `<polygon class="in-floor" data-hex="${r.id}" points="${pts(r.poly)}"/>`;
const lamp = (r) => `<polygon class="in-lamp" data-hex="${r.id}" points="${pts(r.poly)}"/>`;
const ink = (r) => `<use class="in-ink in-ink-room" data-hex="${r.id}" href="${INK}#r-${r.id}"/>`;
function sweep(r) {
  const b = box(r.poly), w = Math.round(b.w * 0.26);
  return `<g clip-path="url(#in-clip-${r.id})"><rect class="in-sweep" data-hex="${r.id}" x="${b.x}" y="${b.y - 20}" width="${w}" height="${b.h + 40}"/></g>`;
}
function roomSvg(r, T) {
  const name = T(r.label), w = tagWidth(name), [tx, ty] = r.tag;
  return `<g class="in-part" data-part="${r.id}">
        <polygon class="in-room" data-hex="${r.id}" points="${pts(r.poly)}" role="button" tabindex="0" aria-haspopup="dialog" aria-controls="dome-${r.id}"><title>${esc(name)}</title></polygon>
        <g class="dome-tag in-tag" data-hex="${r.id}" data-x="${tx}" data-y="${ty}" aria-hidden="true"><rect x="${tx - w / 2}" y="${ty - 20}" width="${w}" height="40" rx="20"/><text x="${tx}" y="${ty + 6.5}" text-anchor="middle">${esc(name)}</text></g>
      </g>`;
}

/** A key outside the shell: the round key, its name on a tag over it. The script places it for a desk or a phone. */
function keySvg(k, T) {
  const name = T(k.label), w = tagWidth(name), ty = -(S + 12 + 20);
  return `<g class="dome-hex in-key" data-hex="${k.id}" data-at="${k.at.join(',')}" data-phone="${k.phone.join(',')}" transform="translate(${k.at[0]} ${k.at[1]})" role="button" tabindex="0" aria-haspopup="dialog" aria-controls="dome-${k.id}">
        <title>${esc(name)}</title>
        <g class="dome-hex-body"><circle class="dome-pod" r="${S}"/>
          <g class="dome-ic dome-ic-line" transform="scale(${KEY_ICON}) translate(-12 -12)">${ICONS[k.id]}</g></g>
        <g class="dome-tag in-tag" data-x="0" data-y="${ty}" aria-hidden="true"><rect x="${-w / 2}" y="${ty - 20}" width="${w}" height="40" rx="20"/><text x="0" y="${ty + 6.5}" text-anchor="middle">${esc(name)}</text></g>
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
        <button type="button" class="popup-close" data-close aria-label="${esc(T('Close'))}">×</button>
      </div>
      <div class="popup-body">
        <p class="dome-now"><span class="dome-now-k">${T('Now')}</span> ${p.fig.map((k) => { const [id, part] = k.split('-'); return `<span data-field="${k}">${esc((f[id] || {})[part] || '')}</span>`; }).join(' ')}</p>
        ${p.about.map((t) => `<p>${esc(T(t))}</p>`).join('')}
        <p><a class="btn" href="${p.href}" data-close>${T(p.btn || 'Open its panel on the dashboard')} →</a></p>
      </div>
    </dialog>`;
  // the hint: on a desk the hand alone opens a room, on a touch screen a tap (sheet.css shows the one that applies)
  const hint = `<span class="dome-meta dome-hint"><span class="dome-hint-click">${T('Point at a room to know what is inside.')}</span><span class="dome-hint-tap">${T('Tap a room to know what is inside.')}</span></span>`;
  const vb = (v) => `${v.x} ${v.y} ${v.w} ${v.h}`;
  return `
  <section class="dome-panel is-inside" id="habitat-dome" aria-label="${esc(T('The habitat'))}">
    <header class="dome-head">
      <div class="dome-title"><h2>${T('The habitat')}</h2></div>
      ${hint}
    </header>
    <div class="dome-screen">
      <div class="dome-stage">
        <svg class="dome-svg inside-svg" viewBox="${vb(VIEW)}" data-view="${vb(VIEW)}" data-view-phone="${vb(VIEW_PHONE)}" preserveAspectRatio="xMidYMax meet" role="img" aria-label="${esc(T('The habitat in section: its rooms under the dome, on the Mars plain'))}">
          <defs>
            <linearGradient id="in-lamp-light" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fff6df" stop-opacity=".72"/><stop offset=".55" stop-color="#ffd995" stop-opacity=".42"/><stop offset="1" stop-color="#ffb55a" stop-opacity=".26"/></linearGradient>
            <linearGradient id="in-sweep-light" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#fff" stop-opacity="0"/><stop offset=".42" stop-color="#fff" stop-opacity=".5"/><stop offset=".5" stop-color="#fff" stop-opacity=".95"/><stop offset=".58" stop-color="#fff" stop-opacity=".5"/><stop offset="1" stop-color="#fff" stop-opacity="0"/></linearGradient>
            <filter id="in-glow" x="-25%" y="-35%" width="150%" height="170%"><feGaussianBlur stdDeviation="18"/></filter>
            ${ROOMS.map((r) => `<clipPath id="in-clip-${r.id}"><polygon points="${pts(r.poly)}"/></clipPath>`).join('')}
          </defs>
          <image class="in-plain" href="${PLAIN}" x="${VIEW.x}" y="${VIEW.y}" width="${VIEW.w}" height="${VIEW.h}" preserveAspectRatio="xMidYMin slice" aria-hidden="true"/>
          <g class="in-halos" aria-hidden="true">${ROOMS.map(halo).join('')}</g>
          <g class="in-floors" aria-hidden="true">${ROOMS.map(floor).join('')}</g>
          <g class="in-lamps" aria-hidden="true">${ROOMS.map(lamp).join('')}</g>
          <g class="in-inks"><use class="in-ink in-ink-shell" href="${INK}#shell"/>${ROOMS.map(ink).join('')}</g>
          <g class="in-sweeps" aria-hidden="true">${ROOMS.map(sweep).join('')}</g>
          <g class="in-rooms">${ROOMS.map((r) => roomSvg(r, T)).join('')}</g>
          <g class="dome-hexes">${KEYS.map((k) => keySvg(k, T)).join('')}</g>
        </svg>
      </div>
      <div class="dome-legend" role="group" aria-label="${esc(T('The parts of the habitat'))}">${PARTS.map((p) => `
        <button type="button" class="chip" data-hex="${p.id}">${esc(T(p.label))}</button>`).join('')}</div>
    </div>
    <p class="dome-caption" aria-hidden="true"></p>
    ${PARTS.map(popup).join('')}
    <script>
    (function () {
      var root = document.getElementById('habitat-dome'); if (!root) return;
      var VB = [${VIEW.x}, ${VIEW.y}, ${VIEW.w}, ${VIEW.h}], AX = ${APEX.x}, AY = ${APEX.y};
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
      }
      function shut(id) { var d = dialogOf(id); if (!d || !d.open) return; if (by[id] === 'hover') { d.removeAttribute('open'); d.classList.remove('is-hover'); if (shown === id) shown = null; settle(id); } else d.close(); }
      // With room kept above the picture (--pop-room), the pop-up stands there, over the crown of the shell; a phone
      // held upright opens it over the drawing; otherwise it opens beside the part that was pressed.
      function place(d, el) {
        var screen = root.querySelector('.dome-screen'), room = parseFloat(getComputedStyle(root).getPropertyValue('--pop-room')) || 0;
        if (screen && upright()) { above(d); return; }
        if (!screen || !room) { beside(d, el); return; }
        var head = root.querySelector('.dome-head'), hb = head ? head.getBoundingClientRect() : screen.getBoundingClientRect();
        var hp = head ? parseFloat(getComputedStyle(head).paddingLeft) || 0 : 0;
        var w = Math.max(280, Math.min(760, hb.width - 2 * hp));
        d.style.width = w + 'px';
        var h = d.getBoundingClientRect().height, ap = apex();
        var top = ap.y - 10 - h, left = ap.x - w / 2;
        top = Math.max(below() + 8, top);
        put(d, Math.max(8, Math.min(window.innerWidth - w - 8, left)), top);
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
      // The crown of the shell on the screen: the drawing is centred in its box and scaled to fit it, its foot at the box's foot.
      function apex() {
        var svg = root.querySelector('.dome-svg'), sr = svg.getBoundingClientRect();
        var scale = Math.min(sr.width / VB[2], sr.height / VB[3]);
        return { x: sr.left + sr.width / 2 + (AX - (VB[0] + VB[2] / 2)) * scale, y: sr.top + (sr.height - VB[3] * scale) + (AY - VB[1]) * scale };
      }
      function below() { var t = document.querySelector('.ticker'); return t ? Math.max(0, t.getBoundingClientRect().bottom) : 0; }   // the header's foot
      function upright() { return window.matchMedia && window.matchMedia('(max-width: 760px) and (min-height: 521px)').matches; }
      function phone() { return window.matchMedia && window.matchMedia('(max-width: 760px), (max-height: 520px)').matches; }
      function above(d) {
        var vw = window.innerWidth, m = 8;
        var w = Math.min(vw - 2 * m, 560); d.style.width = w + 'px'; d.style.margin = '0';
        var h = d.getBoundingClientRect().height, ap = apex();
        var top = Math.max(below() + m, ap.y - 10 - h);
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
      function arrive(id) {
        over = id; clearTimeout(leaveT); clearTimeout(enterT);
        if (shown && shown !== id) { enterT = setTimeout(function () { if (over === id) open(id, 'hover'); }, 60); }
        else enterT = setTimeout(function () { if (over === id) open(id, 'hover'); }, 140);
      }
      function depart(id) {
        if (over === id) over = null; clearTimeout(enterT);
        clearTimeout(leaveT); leaveT = setTimeout(function () { if (over == null && shown != null) shut(shown); }, 320);
      }
      root.querySelectorAll('[data-hex]').forEach(function (n) {
        var id = n.getAttribute('data-hex');
        n.addEventListener('click', function () { open(id, 'hand', n); });
        n.addEventListener('keydown', function (e) { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); open(id, 'key', n); } });
        n.addEventListener('mouseenter', function () { lit(id, true); if (hover) arrive(id); });
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
            settle(id);
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
      // The box the page shows: a desk the dome and the ground either side, a phone the shell edge to edge and the
      // ground under it — the plain fills whichever, and the two keys stand where the box has room for them.
      var drawing = root.querySelector('.dome-svg'), plain = root.querySelector('.in-plain'), onPhone = null;
      function fit() {
        var p = phone(); if (p === onPhone) return; onPhone = p;
        var v = (drawing.getAttribute(p ? 'data-view-phone' : 'data-view') || '').split(' ').map(Number);
        if (v.length === 4) { drawing.setAttribute('viewBox', v.join(' ')); VB = v; if (plain) { plain.setAttribute('x', v[0]); plain.setAttribute('y', v[1]); plain.setAttribute('width', v[2]); plain.setAttribute('height', v[3]); } }
        root.querySelectorAll('.in-key').forEach(function (k) {
          var at = (k.getAttribute(p ? 'data-phone' : 'data-at') || '').split(',');
          if (at.length === 2) k.setAttribute('transform', 'translate(' + at[0] + ' ' + at[1] + ')' + (p ? ' scale(${PHONE_KEY})' : ''));
        });
        tagK = 0; tagScale();
      }
      // The names are set in the drawing's units, and the drawing is scaled to the room the page gives it: where it is
      // drawn small the tags are enlarged again, about their own anchor, so a name reads at no less than TAG_PX on the
      // screen — never made smaller than drawn (the stylesheet hides them on a phone).
      var TAG_PX = 12.5, TAG_UNITS = 19, tagK = 1;
      function tagScale() {
        var m = drawing && drawing.getScreenCTM ? drawing.getScreenCTM() : null, px = m ? Math.sqrt(m.a * m.a + m.b * m.b) : 0;
        var k = px > 0 ? Math.min(1.6, Math.max(1, TAG_PX / (TAG_UNITS * px))) : 1;
        if (Math.abs(k - tagK) < 0.01) return;
        tagK = k;
        root.querySelectorAll('.in-tag').forEach(function (g) {
          var x = +g.getAttribute('data-x'), y = +g.getAttribute('data-y');
          g.setAttribute('transform', k === 1 ? '' : 'translate(' + x + ' ' + y + ') scale(' + k.toFixed(3) + ') translate(' + -x + ' ' + -y + ')');
        });
      }
      fit(); window.addEventListener('resize', function () { fit(); tagScale(); });
      if ('ResizeObserver' in window) new ResizeObserver(tagScale).observe(drawing);
    })();
    </script>
  </section>`;
}

module.exports = { habitatInside, ROOMS, KEYS, VIEW, VIEW_PHONE, INK, PLAIN };
