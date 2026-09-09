'use strict';
/**
 * At a Glance — the whole mission, day by day, on one public page: everything
 * each day held, in day order. The crew's blog entries with their photographs,
 * what was eaten and what it cost, what each store was drawn down to, how the
 * habitat behaved, the crew's condition (as sentences — the numbers are never
 * public), the exchanges published, the media sent out and the mission notes.
 * Days ahead show the plan, marked as planned.
 *
 * Built from the same day records as the archive, filtered to what is public:
 * published entries and exchanges only, no placeholder cues, no slider values,
 * no rejected traffic. Opened from the button under the mission dashboard.
 */
const L = require('../layout');
const { esc, panel, eyebrow } = L;
const mood = require('../../lib/mood');
const orbital = require('../../lib/orbital');
const MV = require('./media');
const content = require('../../lib/content');
const mediaLookup = require('../../lib/media').get;
const { inventoryGauges } = require('./public');

const ddd = (n) => String(n).padStart(3, '0');
const slotName = { BREAKFAST: 'Breakfast', LUNCH: 'Lunch', DINNER: 'Dinner', RATION: 'Ration' };
/* The day's date in words, in the visitor's language — the one place a
   date is spelled out rather than numbered. */
const LOCALE = { de: 'de-DE', fr: 'fr-FR', en: 'en-GB' };
const longDate = (iso, lang = 'en') => new Date(iso + 'T12:00:00Z').toLocaleDateString(LOCALE[lang] || 'en-GB', { weekday: 'long', day: 'numeric', month: 'long', timeZone: 'UTC' });
const f1 = (v) => (v == null ? '—' : Number(v).toFixed(1));
const same = (s) => s;

/* The habitat tile bank, shared by the run's day pages and the rehearsal
   page: the node's channels labelled, and one tile per channel with the
   day's mean large, its low–high range and reading count beneath. */
const NODE_LABELS = { co2: ['CO₂', 'ppm', 0], temp: ['Temperature', '°C', 1], hum: ['Humidity', '%', 0], light: ['Light', 'raw', 0], pres: ['Pressure', 'hPa', 0], bat: ['Node battery', 'V', 2], rssi: ['Signal', 'dBm', 0] };
const tile = (label, unit, av, lo, hi, n, dec, T = same) => `<div class="glance-tile">
    <span class="gt-label">${esc(T(label))}</span>
    <span class="gt-value">${av == null ? '—' : Number(av).toFixed(dec)}<em>${esc(unit)}</em></span>
    <span class="gt-range">${lo == null ? '' : `${Number(lo).toFixed(dec)}–${Number(hi).toFixed(dec)} · ${n} ${T(n === 1 ? 'reading' : 'readings')}`}</span>
  </div>`;

/**
 * One channel's day as a chart: every reading a point, placed by its instant
 * across the 24 hours from the venue's midnight, joined by a line. Drawn
 * server-side as plain SVG — the booklet needs no script for it, and the
 * page prints and archives with the data in it. The y-scale is the day's own
 * (padded a little), with the low and high written at the edges; the x-axis
 * is the day, gridded every six hours, in habitat time by construction.
 */
function dayChart(s, dayStart, label, unit, dec, tz, tr = same) {
  const hm = (t) => { try { return new Intl.DateTimeFormat('en-GB', { timeZone: tz, hour12: false, hour: '2-digit', minute: '2-digit' }).format(new Date(t)); } catch { return new Date(t).toISOString().slice(11, 16); } };
  const W = 560, H = 140, L = 46, R = 10, T = 12, B = 24;
  const PW = W - L - R, PH = H - T - B;
  const DAY = 86400000;
  const pts = s.points;
  let lo = Math.min(...pts.map((p) => p.v)), hi = Math.max(...pts.map((p) => p.v));
  if (hi === lo) { hi += 1; lo -= 1; }
  const pad = (hi - lo) * 0.08;
  lo -= pad; hi += pad;
  const x = (t) => L + Math.max(0, Math.min(1, (t - dayStart) / DAY)) * PW;
  const y = (v) => T + (1 - (v - lo) / (hi - lo)) * PH;
  const f = (v) => Number(v).toFixed(dec);
  const grid = [0, 6, 12, 18, 24].map((h) => {
    const gx = L + (h / 24) * PW;
    return `<line class="gc-grid" x1="${gx}" y1="${T}" x2="${gx}" y2="${T + PH}"/>` +
      `<text class="gc-ax" x="${gx}" y="${H - 8}" text-anchor="middle">${String(h).padStart(2, '0')}:00</text>`;
  }).join('');
  const line = pts.length > 1 ? `<polyline class="gc-line" points="${pts.map((p) => `${x(p.t).toFixed(1)},${y(p.v).toFixed(1)}`).join(' ')}"/>` : '';
  const dots = pts.map((p) => `<circle class="gc-dot" cx="${x(p.t).toFixed(1)}" cy="${y(p.v).toFixed(1)}" r="2.4"><title>${hm(p.t)} ${tr('habitat time')} · ${f(p.v)} ${esc(unit)}</title></circle>`).join('');
  const first = pts[0], last = pts[pts.length - 1];
  return `<div class="glance-chart">
    <div class="gc-head"><b>${esc(tr(label))}</b><span>${pts.length} ${tr(pts.length === 1 ? 'reading' : 'readings')} · ${f(Math.min(...pts.map((p) => p.v)))}–${f(Math.max(...pts.map((p) => p.v)))} ${esc(unit)} · ${tr('first')} ${hm(first.t)} · ${tr('last')} ${hm(last.t)} ${tr('habitat time')}</span></div>
    <svg class="gc-svg" viewBox="0 0 ${W} ${H}" role="img" aria-label="${esc(tr(label))}: ${esc(tr('every reading of the day'))}">
      <line class="gc-grid base" x1="${L}" y1="${T + PH}" x2="${L + PW}" y2="${T + PH}"/>
      <line class="gc-grid" x1="${L}" y1="${T}" x2="${L + PW}" y2="${T}"/>
      ${grid}
      <text class="gc-ax" x="${L - 6}" y="${T + 4}" text-anchor="end">${f(hi)}</text>
      <text class="gc-ax" x="${L - 6}" y="${T + PH + 3}" text-anchor="end">${f(lo)}</text>
      ${line}${dots}
    </svg>
  </div>`;
}

function daySection(r, m, { rehearsal = false, T = same, lang = 'en' } = {}) {
  const n = r.missionDay;
  const state = m.phase === 'PRE_LAUNCH' ? 'planned' : n < m.clampedDay ? 'past' : n === m.clampedDay ? 'today' : 'planned';
  const written = r.entries.filter((e) => !content.isPlaceholder(e.body));
  const day = r.day;
  // one state per officer: the last filed that day
  const lastMood = new Map();
  for (const s of r.moods) lastMood.set(s.designation, s);

  const head = `
    <header class="glance-head">
      <div>
        <span class="glance-n">${rehearsal ? T('REHEARSAL') : `SOL ${ddd(n)}`}</span>
        <h2>${esc(longDate(r.date, lang))}</h2>
      </div>
      <span class="badge ${rehearsal ? 'warn' : state === 'today' ? 'mars' : ''}">${T(rehearsal ? 'Before the run' : state === 'today' ? 'Today' : state === 'past' ? 'Complete' : 'Planned')}</span>
    </header>
    ${rehearsal ? `<p class="note" style="margin:0 0 14px">${T('A preview, not the record: a run day’s page as it will look, filled with what there is')} <b>${T('today')}</b> — ${T('the habitat’s readings as the sensors are sending them now, the plan for SOL 001 (schedule, meals, consumption, power), whatever the crew have already written into the opening day, and any states filed today. This page disappears on 15 October, when SOL 001 takes its place.')}</p>` : ''}
    <div class="spec glance-spec">
      <span><b>${written.length}</b> ${T('crew entries')}</span>
      <span><b>${r.messages.length}</b> ${T('exchanges')}</span>
      <span><b>${r.traffic.sent}</b> ${T('messages from Earth')}</span>
      <span><b>${r.media.length}</b> ${T('media sent out')}</span>
    </div>`;

  const blog = written.length ? `
    <div class="glance-block">
      ${eyebrow(T('Blogs'))}
      <div class="cards">${written.map((e) => `<article class="card">
        <div class="card-top"><span class="cs">${esc(e.designation)}</span><span class="card-day">${esc(e.role || '')}</span></div>
        <div class="card-body entry-post">${MV.entryHtml(e.body, (r.media || []).filter((x) => x.crew_id === e.crew_id), { lookup: mediaLookup, T })}</div>
      </article>`).join('')}</div>
    </div>` : (state !== 'planned' ? `<div class="glance-block">${eyebrow(T('Blogs'))}<div class="empty">${T('No blog written by the crew on this day')}</div></div>` : '');

  const meals = day && day.meals.length ? `
    <div class="glance-block">
      ${eyebrow(`${T('Meals')}${state === 'planned' ? ` · ${T('planned')}` : ''} · ${day.kcalPlanned} kcal · ${day.waterPlanned.toFixed(1)} L ${T('water')} · ${day.energyPlanned} Wh`)}
      <div class="tw"><table>
        <thead><tr><th>${T('Slot')}</th><th>${T('Meal')}</th><th class="n">kcal</th><th class="n">${T('Water')} L</th><th class="n">Wh</th></tr></thead>
        <tbody>${day.meals.map((x) => `<tr><th>${esc(T(slotName[x.slot] || x.slot))}</th><td>${esc(x.name)}</td>
          <td class="n">${x.kcal}</td><td class="n">${x.water_litres}</td><td class="n">${x.energy_wh}</td></tr>`).join('')}</tbody>
      </table></div>
    </div>` : '';

  // The stores at the close of the day, twice over: first as the rings the
  // landing page draws — each arc is what is left of what was carried in —
  // then the same figures as a table, for the exact numbers.
  const consumption = day && day.inventory.length ? `
    <div class="glance-block">
      ${eyebrow(`${T('Consumption')}${state === 'planned' ? ` · ${T('planned')}` : ''} · ${T('at the close of the day · what is left of what was carried in')}`)}
      ${inventoryGauges(day.inventory, { cells: true, T })}
      <div class="tw"><table>
        <thead><tr><th>${T('Store')}</th><th class="n">${T('Remaining')}</th><th class="n">${T('Used that day')}</th><th class="n">${T('Days left')}</th></tr></thead>
        <tbody>${day.inventory.map((i) => `<tr><th>${esc(i.label)}</th>
          <td class="n">${i.quantity} ${esc(i.unit)}</td>
          <td class="n">${i.consumption > 0 ? `−${i.consumption}` : '—'}</td>
          <td class="n">${i.consumption > 0 ? (i.quantity / i.consumption).toFixed(1) : '—'}</td></tr>`).join('')}</tbody>
      </table></div>
    </div>` : '';

  // Power consumed that day, by category — heating, food, lighting,
  // electronics, other, as content/power.json shapes them. Counted daily by
  // the crew; a day nothing was filed for says so.
  const pd = content.powerDay(n);
  const power = pd.filed ? `
    <div class="glance-block">
      ${eyebrow(`${T('Power consumed')}${state === 'planned' ? ` · ${T('planned')}` : ''} · ${pd.total.toFixed(2)} kWh`)}
      <div class="pwr">${pd.categories.map((c) => {
        const max = Math.max(...pd.categories.map((x) => x.kwh || 0), 0.001);
        return `<div class="pwr-row${c.kwh == null ? ' none' : ''}">
          <span class="pwr-name">${esc(c.label)}</span>
          <div class="pwr-track">${c.kwh == null ? '' : `<i style="width:${Math.max(2, (c.kwh / max) * 100).toFixed(1)}%"></i>`}</div>
          <span class="pwr-val">${c.kwh == null ? '—' : c.kwh.toFixed(2)}</span>
        </div>`; }).join('')}
      <div class="pwr-total"><span>${T('Day total')}</span><b>${pd.total.toFixed(2)} kWh</b></div></div>
    </div>` : (state !== 'planned' ? `<div class="glance-block">${eyebrow(T('Power consumed'))}<div class="empty">${T('Not counted for this day')}</div></div>` : '');

  // The habitat as it was that day, drawn as the dashboard draws it: a tile
  // per channel, the day's mean large, its low–high range and sample count
  // beneath. The external node's channels first, then anything the station's
  // own ingest recorded.
  const nodeTiles = (r.node || []).map((x) => { const [label, unit, dec] = NODE_LABELS[x.key] || [x.key, '', 1]; return tile(label, unit, x.av, x.lo, x.hi, x.n, dec, T); });
  const ingestTiles = r.habitat.map((h) => tile(h.label || h.metric, h.unit || '', h.avg_value, h.min_value, h.max_value, h.samples, 1, T));
  // The crew's counted figures for the day — calories consumed and steps
  // taken, as the Habitat dashboard carries them — drawn as tiles of the
  // same bank, so the day's habitat is whole: what the sensors measured and
  // what the crew counted, side by side.
  const fig = content.crewFigures()[String(n)] || {};
  const figTile = (label, unit, v) => (v == null ? '' : `<div class="glance-tile">
      <span class="gt-label">${esc(T(label))}</span>
      <span class="gt-value">${Number(v).toLocaleString('en-GB')}<em>${esc(T(unit))}</em></span>
      <span class="gt-range">${T('crew total · counted that day')}</span>
    </div>`);
  const figTiles = figTile('Calories consumed', 'kcal', fig.calories) + figTile('Steps taken', 'steps', fig.steps);
  // Every reading of the day, drawn whole: one chart per channel, each pull
  // a point across the day's 24 hours (habitat time). This is the data the
  // Habitat display was drawn from — the summary tiles above, the readings
  // themselves here.
  const charts = (r.series || []).map((s) => {
    const [label, unit, dec] = s.label != null ? [s.label, s.unit, 1] : (NODE_LABELS[s.key] || [s.key, '', 1]);
    return dayChart(s, r.dayStart, label, unit, dec, m.timezone, T);
  }).join('');
  const habitat = (nodeTiles.length || ingestTiles.length || figTiles) ? `
    <div class="glance-block">
      ${eyebrow(T(rehearsal ? 'Habitat · today, as the sensors are seeing it' : 'Habitat · the day as the sensors saw it, and as the crew counted it'))}
      <div class="glance-tiles">${nodeTiles.join('')}${ingestTiles.join('')}${figTiles}</div>
      ${charts ? `<div class="gc-note">${T('Every reading the station pulled or received that day, point by point, across the day (habitat time).')}</div>
      <div class="glance-charts">${charts}</div>` : ''}
    </div>` : (state !== 'planned' ? `<div class="glance-block">${eyebrow(T('Habitat'))}<div class="empty">${T('No readings on this day')}</div></div>` : '');

  const states = lastMood.size ? `
    <div class="glance-block">
      ${eyebrow(T('Crew condition · as reported, never as numbers'))}
      <div class="rows">${[...lastMood.values()].map((s) => { const t = mood.translate(s); return `
        <div class="row"><div class="t">${esc(T(t.condition))}</div>
          <div class="m"><b>${esc(s.designation)}</b><span>${esc(t.lines.map(T).join('; '))}${s.activity ? ` — ${esc(s.activity)}` : ''}</span></div>
        </div>`; }).join('')}</div>
    </div>` : '';

  const exchanges = r.messages.length ? `
    <div class="glance-block">
      ${eyebrow(T('Exchanges with Earth'))}
      <div class="cards">${r.messages.map((x) => `<article class="card">
        <div class="card-top"><span class="cs">${esc(x.callsign)}</span>
          <span class="card-day">${orbital.formatLightTime(x.light_seconds)}</span></div>
        <div class="card-body">${esc(x.body)}</div>
        ${x.response_body ? `<div class="card-reply"><div class="who">${esc(x.responder || T('Mars habitat'))}</div><p>${esc(x.response_body)}</p></div>` : ''}
      </article>`).join('')}</div>
    </div>` : '';

  const schedule = day && day.tasks.length ? `
    <div class="glance-block">
      ${eyebrow(`${T('Schedule')}${state === 'planned' ? ` · ${T('planned')}` : ` · ${day.tasks.filter((t) => t.status === 'DONE').length}/${day.tasks.length} ${T('done')}`}`)}
      <div class="rows">${day.tasks.map((t) => `
        <div class="row ${t.status === 'DONE' ? 'done' : ''}"><div class="t">${esc(t.time)}</div>
          <div class="m"><b>${esc(t.label)}</b>${t.detail ? `<span>${esc(t.detail)}</span>` : ''}</div>
          ${state !== 'planned' && t.status !== 'PLANNED' ? `<span class="badge">${esc(T(t.status))}</span>` : ''}
        </div>`).join('')}</div>
    </div>` : '';

  const findings = day ? day.notes.filter((x) => x.published_at && x.kind === 'SCIENCE') : [];
  const health = day ? day.notes.filter((x) => x.published_at && x.kind === 'HEALTH') : [];
  const reportBlock = (label, list) => (list.length ? `
    <div class="glance-block">
      ${eyebrow(T(label))}
      ${list.map((x) => `<div class="entry-post">${MV.entryHtml(x.body, [], { lookup: mediaLookup, T })}</div>`).join('')}
    </div>` : '');
  const notes = day ? day.notes.filter((x) => x.published_at && x.kind !== 'SCIENCE' && x.kind !== 'HEALTH') : [];
  const notesBlock = notes.length ? `
    <div class="glance-block">
      ${eyebrow(T('Mission notes'))}
      <div class="rows">${notes.map((x) => `
        <div class="row"><div class="t">${esc(T(x.kind))}</div>
          <div class="m entry-post">${MV.entryHtml(x.body, [], { lookup: mediaLookup, T })}</div></div>`).join('')}</div>
    </div>` : '';

  // media not carried by a written entry above — unattributed, or an
  // officer's who wrote nothing that day — still belongs to the day
  const shownCrew = new Set(written.map((e) => e.crew_id));
  const loose = (r.media || []).filter((x) => !x.crew_id || !shownCrew.has(x.crew_id));
  const mediaBlock = loose.length ? `
    <div class="glance-block">${eyebrow(T('Also sent out'))}${MV.strip(loose)}</div>` : '';

  const body = head + blog + reportBlock('Science findings', findings) + reportBlock('Health activities', health) + exchanges + schedule + meals + consumption + power + habitat + states + notesBlock + mediaBlock;
  if (rehearsal) {
    return `<div class="bk-page" id="today" data-day="0" role="group" aria-roledescription="${esc(T('page'))}" aria-label="${esc(T('Rehearsal · today, before the run'))}">${
      panel(T('REHEARSAL · NOT THE RECORD'), body, 'mars-side glance-day')
    }</div>`;
  }
  return `<div class="bk-page" id="day-${n}" data-day="${n}" role="group" aria-roledescription="${esc(T('page'))}" aria-label="SOL ${ddd(n)} · ${esc(longDate(r.date, lang))}">${
    panel(`SOL ${ddd(n)}`, body, 'mars-side glance-day')
  }</div>`;
}

/**
 * The page is a booklet: one day per page, side by side, and you scroll or
 * swipe left and right to turn to the next day. CSS scroll-snap does the
 * turning, so it works without the script; the script adds the arrows, the
 * keyboard, the page counter and keeping the day strip in step. Each page
 * scrolls vertically on its own, like a page of a book being read.
 */
function page(ctx, { records, rehearsal = null }) {
  const m = ctx.mission, T = ctx.T;
  // The page the booklet opens on: today during the run; the rehearsal page
  // before it, so what the habitat is sending now is the first thing seen.
  const openOn = m.phase === 'ACTIVE' ? m.clampedDay : rehearsal ? 0 : 1;
  const body = `
  <div style="padding:30px 0 10px">
    <div class="eyebrow">${T('Channel group')} 30 · ${T('The whole mission, day by day')}</div>
    <h1>${T('At a Glance')}</h1>
    <nav class="filters daypick" id="bk-strip" aria-label="${esc(T('Jump to a day'))}">${
      (rehearsal ? `<a href="#today" data-day="0" class="${openOn === 0 ? 'on' : ''}" title="${esc(T('Today, before the run — a rehearsal preview'))}">${T('NOW')}</a>` : '')
    }${records.map((r) =>
      `<a href="#day-${r.missionDay}" data-day="${r.missionDay}" class="${r.missionDay === openOn ? 'on' : ''}">D${String(r.missionDay).padStart(2, '0')}</a>`).join('')}</nav>
  </div>
  <div class="booklet-shell">
    <button type="button" class="bk-arrow prev" id="bk-prev" aria-label="${esc(T('Previous day'))}">&#8249;</button>
    <div class="booklet" id="booklet" tabindex="0" aria-roledescription="carousel" aria-label="${esc(T('The days of the run'))}">
      ${rehearsal ? daySection(rehearsal, m, { rehearsal: true, T, lang: ctx.lang }) : ''}${records.map((r) => daySection(r, m, { T, lang: ctx.lang })).join('')}
    </div>
    <button type="button" class="bk-arrow next" id="bk-next" aria-label="${esc(T('Next day'))}">&#8250;</button>
  </div>
  <div class="bk-counter" id="bk-counter" aria-live="polite">${openOn === 0 ? T('REHEARSAL · TODAY, BEFORE THE RUN') : `SOL ${String(openOn).padStart(3, '0')} / ${String(m.totalDays).padStart(3, '0')}`}</div>
  <script>
  (function () {
    var bk = document.getElementById('booklet');
    if (!bk) return;
    var pages = [].slice.call(bk.children);
    var strip = document.getElementById('bk-strip'), counter = document.getElementById('bk-counter');
    var total = pages.length;
    function current() {
      var mid = bk.scrollLeft + bk.clientWidth / 2, i = 0;
      pages.forEach(function (p, k) { if (p.offsetLeft <= mid) i = k; });
      return i;
    }
    function go(i, smooth) {
      i = Math.max(0, Math.min(total - 1, i));
      bk.scrollTo({ left: pages[i].offsetLeft, behavior: smooth === false ? 'auto' : 'smooth' });
      var inner = pages[i].querySelector('.glance-day');   // a fresh page opens at its top
      if (inner) inner.scrollTop = 0;
      // keep the page's own header in view under the rail when turning
      var r = bk.parentElement.getBoundingClientRect();
      if (r.top < 60) window.scrollTo({ top: window.scrollY + r.top - 78, behavior: smooth === false ? 'auto' : 'smooth' });
    }
    // Pages carry their day in data-day (0 is the rehearsal page, before the
    // run), so the counter, the strip and the hash follow the day, not the
    // page index — the rehearsal page can come and go without shifting them.
    function dayOf(p) { return Number(p.getAttribute('data-day') || 0); }
    function indexOfDay(d) { for (var k = 0; k < pages.length; k++) if (dayOf(pages[k]) === d) return k; return 0; }
    function mark() {
      var i = current(), d = dayOf(pages[i]);
      if (counter) counter.textContent = d === 0 ? t('REHEARSAL \u00b7 TODAY, BEFORE THE RUN')
        : 'SOL ' + String(d).padStart(3, '0') + ' / ' + String(${m.totalDays}).padStart(3, '0');
      if (strip) [].forEach.call(strip.children, function (a) { a.classList.toggle('on', Number(a.getAttribute('data-day')) === d); });
      if (history.replaceState) history.replaceState(null, '', d === 0 ? '#today' : '#day-' + d);
    }
    var t; bk.addEventListener('scroll', function () { clearTimeout(t); t = setTimeout(mark, 120); }, { passive: true });
    document.getElementById('bk-prev').addEventListener('click', function () { go(current() - 1); });
    document.getElementById('bk-next').addEventListener('click', function () { go(current() + 1); });
    document.addEventListener('keydown', function (e) {
      if (e.target && /INPUT|TEXTAREA|SELECT/.test(e.target.tagName)) return;
      if (e.key === 'ArrowRight') { go(current() + 1); e.preventDefault(); }
      if (e.key === 'ArrowLeft') { go(current() - 1); e.preventDefault(); }
    });
    if (strip) strip.addEventListener('click', function (e) {
      var a = e.target.closest('a[data-day]'); if (!a) return;
      e.preventDefault(); go(indexOfDay(Number(a.getAttribute('data-day'))));
    });
    var m0 = /#day-(\\d+)/.exec(location.hash);
    go(location.hash === '#today' ? indexOfDay(0) : indexOfDay(m0 ? Number(m0[1]) : ${openOn}), false);
    mark();
  })();
  </script>`;
  return L.page({ title: 'At a Glance', ctx, body, current: '/at-a-glance' });
}

module.exports = { page };
