'use strict';
/**
 * At a Glance — the whole mission, day by day, on one public page: everything
 * each day held, in day order. The crew's blog entries with their photographs,
 * the schedule, what was eaten and what it cost, what each store was drawn
 * down to (Resources), the power, the habitat's sensors as they last read
 * that day, the crew's condition (as sentences — the numbers are never
 * public) and the mission notes. The exchanges with Earth are not on it.
 * Days ahead show the plan, marked as planned.
 *
 * Built from the same day records as the archive, filtered to what is public:
 * published entries only, no placeholder cues, no slider values. Opened from
 * the button under the mission dashboard.
 */
const L = require('../layout');
const { esc, panel, eyebrow } = L;
const mood = require('../../lib/mood');
const MV = require('./media');
const content = require('../../lib/content');
const mediaLookup = require('../../lib/media').get;
const { inventoryGauges } = require('./public');
const officer = require('../../lib/officer');

const ddd = (n) => String(n).padStart(3, '0');
/* The day's date in words, in the visitor's language — the one place a
   date is spelled out rather than numbered. */
const LOCALE = { de: 'de-DE', fr: 'fr-FR', en: 'en-GB' };
const longDate = (iso, lang = 'en') => new Date(iso + 'T12:00:00Z').toLocaleDateString(LOCALE[lang] || 'en-GB', { weekday: 'long', day: 'numeric', month: 'long', timeZone: 'UTC' });
const f1 = (v) => (v == null ? '—' : Number(v).toFixed(1));
const same = (s) => s;

/* The habitat tile bank, shared by the run's day pages and the rehearsal
   page: one tile per sensor channel — the node's channels labelled — with
   the day's last reading large, in its unit. */
const NODE_LABELS = { co2: ['CO₂', 'ppm', 0], temp: ['Temperature', '°C', 1], hum: ['Humidity', '%', 0], light: ['Light', 'lx', 0], pres: ['Pressure', 'hPa', 0], bat: ['Node battery', 'V', 2], rssi: ['Signal', 'dBm', 0], voc: ['VOC', 'ppm', 2], iaq: ['Air quality index', '', 0] };
const tile = (label, unit, v, dec, T = same) => `<div class="glance-tile">
    <span class="gt-label">${esc(T(label))}</span>
    <span class="gt-value">${v == null ? '—' : Number(v).toFixed(dec)}<em>${esc(unit)}</em></span>
  </div>`;

function daySection(r, m, { rehearsal = false, T = same, lang = 'en' } = {}) {
  const n = r.missionDay;
  const state = m.phase === 'PRE_LAUNCH' ? 'planned' : n < m.clampedDay ? 'past' : n === m.clampedDay ? 'today' : 'planned';
  const written = r.entries.filter((e) => !content.isPlaceholder(e.body));
  const day = r.day;
  // The three blogs of the day, each a card of its own: the Commander Blog
  // (the commanding officer's entry, with what they sent out that day),
  // the Daily Mission Report and the Health Report (the reports).
  const findings = day ? day.notes.filter((x) => x.published_at && x.kind === 'SCIENCE') : [];
  const health = day ? day.notes.filter((x) => x.published_at && x.kind === 'HEALTH') : [];
  const posts = [
    ...written.map((e) => ({ title: 'Commander Blog', html: MV.entryHtml(e.body, (r.media || []).filter((x) => x.crew_id === e.crew_id), { lookup: mediaLookup, T }) })),
    ...findings.map((x) => ({ title: 'Daily Mission Report', html: MV.entryHtml(x.body, [], { lookup: mediaLookup, T }) })),
    ...health.map((x) => ({ title: 'Health Report', html: MV.entryHtml(x.body, [], { lookup: mediaLookup, T }) })),
  ];
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
    ${rehearsal ? `<p class="note" style="margin:0 0 14px">${T('A preview, not the record: a run day’s page as it will look, filled with what there is')} <b>${T('today')}</b> — ${T('the habitat’s readings as the sensors are sending them now, and everything mission control has filed under NOW, the rehearsal day — its schedule, meals, counts and power, the blogs and the media — with any states filed today. Nothing of it touches the run’s days. This page disappears on 15 October, when SOL 001 takes its place.')}</p>` : ''}
    <div class="spec glance-spec">
      <span><b>${posts.length}</b> ${T('blog posts')}</span>
      <span><b>${r.media.length}</b> ${T('media sent out')}</span>
    </div>`;

  const blog = posts.length ? `
    <div class="glance-block">
      ${eyebrow(T('Blogs'))}
      <div class="cards">${posts.map((p) => `<article class="card">
        <div class="card-top"><span class="cs">${esc(T(p.title))}</span></div>
        <div class="card-body entry-post">${p.html}</div>
      </article>`).join('')}</div>
    </div>` : (state !== 'planned' ? `<div class="glance-block">${eyebrow(T('Blogs'))}<div class="empty">${T('No blog written by the crew on this day')}</div></div>` : '');

  const meals = day && day.meals.length ? `
    <div class="glance-block">
      ${eyebrow(`${T('Meals')}${state === 'planned' ? ` · ${T('planned')}` : ''} · ${day.kcalPlanned} kcal${day.waterPlanned ? ` · ${day.waterPlanned.toFixed(1)} L ${T('water')}` : ''} · ${day.energyPlanned} Wh${day.meals.some((x) => x.power_running) ? ` ${T('so far')}` : ''}${
        day.co2ePlanned != null ? ` · ${+day.co2ePlanned.toFixed(2)} kg CO₂e` : ''}${day.waterFootprintPlanned != null ? ` · ${+day.waterFootprintPlanned.toFixed(0)} L ${T('water footprint')}` : ''}`)}
      <div class="tw"><table>
        <thead><tr><th>${T('Slot')}</th><th>${T('Meal')}</th><th class="n">kcal</th><th class="n">${T('Water')} L</th><th class="n">Wh</th><th class="n">kg CO₂e</th><th class="n">${T('Water footprint')} L</th></tr></thead>
        <tbody>${day.meals.map((x) => { const nutr = L.mealEcoText(x, T).nutr; return `<tr><th>${esc(L.slotName(T, x.slot))}</th><td>${esc(x.name)}${nutr ? `<br><small class="meal-nutr">${esc(nutr)}</small>` : ''}</td>
          <td class="n">${x.kcal}</td><td class="n">${x.water_litres || '—'}</td><td class="n">${x.energy_source === 'with' ? `${esc(T('with'))} ${esc(L.slotName(T, x.power_with))}` : x.power_wh != null ? `${x.power_wh}${x.power_running ? '*' : ''}` : x.energy_wh || '—'}</td>
          <td class="n">${x.co2e_kg != null ? +Number(x.co2e_kg).toFixed(3) : '—'}</td><td class="n">${x.water_footprint_l != null ? +Number(x.water_footprint_l).toFixed(1) : '—'}</td></tr>`; }).join('')}</tbody>
      </table></div>
      <p class="note meal-hours">${esc(T('Power: the food meter, read'))} ${esc(L.mealHoursLine(T, (() => { try { return require('../../lib/home-assistant').mealsConfig().windows; } catch { return {}; } })()))}${day.meals.some((x) => x.power_with) ? ` · ${esc(T('an added meal counts with the meal whose hours cover the time it is served at'))}` : ''}${day.meals.some((x) => x.power_running) ? ` · * ${esc(T('so far'))}` : ''}</p>
    </div>` : '';

  // The stores at the close of the day, twice over: first as the rings the
  // landing page draws — each arc is what is left of what was carried in —
  // then the same figures as a table, for the exact numbers.
  const consumption = day && day.inventory.length ? `
    <div class="glance-block">
      ${eyebrow(T('Resources'))}
      ${inventoryGauges(day.inventory, { cells: true, T })}
      <div class="tw"><table>
        <thead><tr><th>${T('Store')}</th><th class="n">${T('Remaining')}</th><th class="n">${T('Used that day')}</th><th class="n">${T('Days left')}</th></tr></thead>
        <tbody>${day.inventory.map((i) => `<tr><th>${esc(i.label)}</th>
          <td class="n">${i.quantity} ${esc(i.unit)}</td>
          <td class="n">${i.consumption > 0 ? `−${i.consumption}` : '—'}</td>
          <td class="n">${i.consumption > 0 ? (i.quantity / i.consumption).toFixed(1) : '—'}</td></tr>`).join('')}</tbody>
      </table></div>
    </div>` : '';

  // Power consumed that day, by channel — crickets, science 1 and 2, living, table, food, water, hydroponics,
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

  // The habitat as it stood at the end of that day (as it stands now, for
  // today): a tile per sensor channel with the day's last reading — the
  // external node's channels first, then the station's own ingest channels,
  // then the habitat hardware through Home Assistant — and nothing else of
  // the day's readings (the record has them all, reading by reading).
  const nodeTiles = (r.node || []).map((x) => { const [label, unit, dec] = NODE_LABELS[x.key] || [x.key, '', 1]; return tile(label, unit, x.last, dec, T); });
  const ingestTiles = (r.ingest || []).map((h) => tile(h.label || h.key, h.unit || '', h.last, 1, T));
  const hardwareTiles = (r.hardware || []).filter((h) => h.last != null && !h.retired).map((h) => tile(h.label, h.unit || '', h.last, Number.isFinite(Number(h.decimals)) ? Number(h.decimals) : 1, T));
  // The crew's counted figures for the day — calories consumed and steps
  // taken, as the Habitat dashboard carries them — drawn as tiles of the
  // same bank.
  const fig = content.crewFigures()[String(n)] || {};
  const figTile = (label, unit, v) => (v == null ? '' : `<div class="glance-tile">
      <span class="gt-label">${esc(T(label))}</span>
      <span class="gt-value">${Number(v).toLocaleString('en-GB')}<em>${esc(T(unit))}</em></span>
      <span class="gt-range">${T('crew total · counted that day')}</span>
    </div>`);
  const figTiles = figTile('Calories consumed', 'kcal', fig.calories) + figTile('Steps taken', 'steps', fig.steps);
  const habitat = (nodeTiles.length || ingestTiles.length || hardwareTiles.length || figTiles) ? `
    <div class="glance-block">
      ${eyebrow(T('Habitat'))}
      <div class="glance-tiles">${nodeTiles.join('')}${ingestTiles.join('')}${hardwareTiles.join('')}${figTiles}</div>
    </div>` : (state !== 'planned' ? `<div class="glance-block">${eyebrow(T('Habitat'))}<div class="empty">${T('No readings on this day')}</div></div>` : '');

  const states = lastMood.size ? `
    <div class="glance-block">
      ${eyebrow(T('Crew condition · as reported, never as numbers'))}
      <div class="rows">${[...lastMood.values()].map((s) => { const t = mood.translate(s); return `
        <div class="row"><div class="t">${esc(T(t.condition))}</div>
          <div class="m"><b>${esc(officer.shown(s.designation))}</b><span>${esc(t.lines.map(T).join('; '))}${s.activity ? ` — ${esc(s.activity)}` : ''}</span></div>
        </div>`; }).join('')}</div>
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

  const notes = day ? day.notes.filter((x) => x.published_at && x.kind !== 'SCIENCE' && x.kind !== 'HEALTH') : [];
  const notesBlock = notes.length ? `
    <div class="glance-block">
      ${eyebrow(T('Mission notes'))}
      <div class="rows">${notes.map((x) => `
        <div class="row"><div class="t">${esc(T(x.kind))}</div>
          <div class="m entry-post">${MV.entryHtml(x.body, [], { lookup: mediaLookup, T })}</div></div>`).join('')}</div>
    </div>` : '';

  const body = head + blog + schedule + meals + consumption + power + habitat + states + notesBlock;
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
    // (the timer is not called t: a var t here would hide the page's translator, t(), from mark() above)
    var settle; bk.addEventListener('scroll', function () { clearTimeout(settle); settle = setTimeout(mark, 120); }, { passive: true });
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
  (function () {
    // A day's charts are drawn 560 wide and scaled to the page — on a phone to about half, and their figures with them:
    // each figure is given back the size the page is read at (--fs-tag), whatever the chart's scale.
    function fit() {
      var px = parseFloat(getComputedStyle(document.body).getPropertyValue('--fs-tag')) || 11;
      [].forEach.call(document.querySelectorAll('svg.gc-svg'), function (svg) {
        var m = svg.getScreenCTM && svg.getScreenCTM(); if (!m || !m.a) return;
        svg.style.overflow = 'visible';
        [].forEach.call(svg.querySelectorAll('text'), function (tx) {
          if (tx.__drawn == null) tx.__drawn = parseFloat(getComputedStyle(tx).fontSize) || 8.5;
          tx.style.fontSize = Math.max(tx.__drawn, px / m.a).toFixed(2) + 'px';
        });
      });
    }
    fit();
    var rz; window.addEventListener('resize', function () { clearTimeout(rz); rz = setTimeout(fit, 150); });
  })();
  </script>`;
  return L.page({ title: 'At a Glance', ctx, body, current: '/at-a-glance' });
}

module.exports = { page };
