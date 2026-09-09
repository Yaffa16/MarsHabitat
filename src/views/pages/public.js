'use strict';
const L = require('../layout');
const { esc, panel, eyebrow, orbitPlot, pipeline } = L;
const orbital = require('../../lib/orbital');
const data = require('../../lib/data');
const { TAGS } = data;
const { composerBlock } = require('./communicate');
const { entryCard } = require('./logbook');
const { aboutSection } = require('./info');
const MV = require('./media');
const mediaGet = require('../../lib/media').get;
const moodLib = require('../../lib/mood');
const { shortDay } = require('../../lib/mission');

const fmtTime = (iso) => new Date(iso).toISOString().slice(11, 16) + ' UTC';
const missionLib = require('../../lib/mission');
/* English through, for the places that have no visitor: the archive. */
const same = (s) => s;
const dayWord = (T, n) => `${n} ${T(n === 1 ? 'day' : 'days')}`;
/** A moment as the room reads it: "Sat 24 Oct · 16:02", in the venue's time. */
function whenLabel(iso, tz) {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const zone = tz || 'Europe/Berlin';
  const day = d.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short', timeZone: zone }).replace(',', '');
  const time = d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', hour12: false, timeZone: zone });
  return `${day} · ${time}`;
}

/* ============================================================== COMPLETE */

/** After the last day. The archive stays; nothing else pretends to be live. */
function complete(ctx, { counts, recent }) {
  const m = ctx.mission, T = ctx.T;
  const body = `
  <div style="padding:34px 0 26px">
    <div class="eyebrow">${T('Mars Communication Station')} · ${T('mission complete')}</div>
    <h1>${T('The habitat is empty.')}<br>${T('What was said is still here.')}</h1>
    <p class="lede">${T('The crew went in on')} ${esc(m.startLabel)} ${T('and came out on')} ${esc(m.endLabel)}.
    ${T('Over the course of')} ${dayWord(T, m.totalDays)}, ${counts.published} ${T('exchanges crossed the distance between an audience on Earth and three people who could not be reached any other way.')}</p>
    <p><a class="btn" href="/archive">${T('Read the archive')}</a><a class="btn" href="/#about">${T('About the project')}</a></p>
  </div>

  <div class="grid g-hero">
    ${orbitPlot(ctx.geo, { T })}
    ${panel('CH-21 / RECORD', `
      ${eyebrow(T('What the station carried'))}
      <dl class="kv">
        <dt>${T('MISSION')}</dt><dd>${esc(m.name)}</dd>
        <dt>${T('DURATION')}</dt><dd>${dayWord(T, m.totalDays)}</dd>
        <dt>${T('EXCHANGES')}</dt><dd>${counts.published} ${T('published')}</dd>
        <dt>${T('MESSAGES SENT')}</dt><dd>${counts.total}</dd>
        <dt>${T('CALLSIGNS ISSUED')}</dt><dd>${counts.visitors}</dd>
      </dl>
      <p class="note" style="margin-top:16px">${T('The communication channel is closed. The archive is not — it stays readable, and it stays part of the work.')}</p>`, 'earth-side')}
  </div>

  ${panel('CH-20 / LAST EXCHANGES', recent.length
    ? recent.slice(0, 3).map((x) => messageCard(x, undefined, T)).join('') + `<p style="margin:6px 0 0"><a href="/archive">${T('Full archive')} →</a></p>`
    : `<div class="empty">${T('NOTHING WAS PUBLISHED DURING THIS MISSION')}</div>`)}`;

  return L.page({ title: 'Mission complete', ctx, body, current: '/' });
}

/**
 * Resources as a row of gauges. The bar is what is left against what they
 * started with, so the whole thirteen days is legible in one glance: a habitat
 * running down. Anything below its warning threshold turns orange, and the
 * figure under each bar is days remaining at the current draw — the number
 * that actually decides things inside a closed volume.
 */
function inventoryGauges(inventory, { compact = false, strip = false, cells = false, T = same } = {}) {
  if (!inventory || !inventory.length) {
    return `<div class="empty">${T('No inventory filed for today')}</div>`;
  }
  const left = (daysLeft, dec) => daysLeft != null
    ? (daysLeft < 99 ? `${daysLeft.toFixed(dec)} ${T('days left')}` : T('ample')) : T('no draw');
  const shown = compact ? inventory.filter((i) => i.critical).slice(0, 5) : inventory;
  // As rounds: a ring per resource, its arc filled to what is left of what was
  // carried in, the figure in the centre, the name and days remaining beneath.
  if (cells) {
    const R = 24, C = 2 * Math.PI * R;
    return `<div class="gauges rounds">${shown.map((i) => {
      const start = i.start_quantity || i.quantity || 1;
      const pct = Math.max(0, Math.min(100, (i.quantity / start) * 100));
      const low = i.warn_below > 0 && i.quantity <= i.warn_below;
      const daysLeft = i.consumption > 0 ? i.quantity / i.consumption : null;
      const num = Number.isInteger(i.quantity) ? String(i.quantity) : i.quantity.toFixed(1);
      return `<div class="gauge round ${low ? 'low' : ''}" title="${esc(i.label)}: ${i.quantity} ${esc(i.unit)} ${T('of')} ${start} · ${esc(left(daysLeft, 1))}">
        <svg viewBox="0 0 60 60" aria-hidden="true">
          <circle cx="30" cy="30" r="${R}" class="round-track"/>
          <circle cx="30" cy="30" r="${R}" class="round-arc" stroke-dasharray="${C.toFixed(1)}"
            stroke-dashoffset="${(C * (1 - pct / 100)).toFixed(1)}" transform="rotate(-90 30 30)"/>
          <text x="30" y="32" class="round-num">${num}</text>
          <text x="30" y="41" class="round-unit">${esc(i.unit)}</text>
        </svg>
        <span class="cell-name">${esc(i.label)}</span>
        <span class="cell-days">${daysLeft != null ? (daysLeft < 99 ? `${daysLeft.toFixed(0)} ${T('days')}` : T('ample')) : T('no draw')}</span>
      </div>`;
    }).join('')}</div>`;
  }
  return `<div class="gauges${strip ? ' strip' : ''}">${shown.map((i) => {
    const start = i.start_quantity || i.quantity || 1;
    const pct = Math.max(0, Math.min(100, (i.quantity / start) * 100));
    const low = i.warn_below > 0 && i.quantity <= i.warn_below;
    const daysLeft = i.consumption > 0 ? i.quantity / i.consumption : null;
    return `<div class="gauge ${low ? 'low' : ''}">
      <div class="gauge-head">
        <span class="gauge-name">${esc(i.label)}</span>
        <span class="gauge-val">${i.quantity}<em>${esc(i.unit)}</em></span>
      </div>
      <div class="gauge-track"><i style="width:${pct.toFixed(1)}%"></i></div>
      <div class="gauge-foot">
        <span>${pct.toFixed(0)}% ${T('of')} ${start} ${esc(i.unit)}</span>
        <span>${left(daysLeft, 1)}</span>
      </div>
    </div>`;
  }).join('')}</div>`;
}

/**
 * Power consumed inside the habitat, one day, split by category — heating,
 * food, lighting, electronics, other, as content/power.json shapes them. A
 * bar per category against the day's biggest draw, the figure at its end,
 * the day's total underneath. A day nothing has been filed for says so
 * rather than showing zeros: an uncounted day and a day of no draw are not
 * the same thing.
 */
function powerBars(categories, T = same) {
  const filed = categories.filter((c) => c.kwh != null);
  if (!filed.length) {
    return `<div class="empty" style="margin-top:10px">${T('Nothing filed for this day — the crew count the day’s power as it ends')}</div>`;
  }
  const max = Math.max(...filed.map((c) => c.kwh), 0.001);
  const total = filed.reduce((s, c) => s + c.kwh, 0);
  return `<div class="pwr">
    ${categories.map((c) => `<div class="pwr-row${c.kwh == null ? ' none' : ''}">
      <span class="pwr-name">${esc(c.label)}</span>
      <div class="pwr-track">${c.kwh == null ? '' : `<i style="width:${Math.max(2, (c.kwh / max) * 100).toFixed(1)}%"></i>`}</div>
      <span class="pwr-val">${c.kwh == null ? '—' : c.kwh.toFixed(2)}</span>
    </div>`).join('')}
    <div class="pwr-total"><span>${T('Day total')}</span><b>${total.toFixed(2)} kWh</b></div>
  </div>`;
}

/**
 * Calories consumed and steps taken, plotted across the whole mission. Drawn
 * as a real graph — gridlines, a value axis, a day axis and a plotted line
 * with a point per day — because the question these two figures answer is what
 * the shape did over thirteen days, and a shape needs a graph.
 *
 * A day with nothing recorded breaks the line rather than dropping it to zero:
 * an unrecorded day and a day of no movement are not the same thing.
 */
function crewFiguresGraph(figures, mission, { key, label, unit, colour, fmt }) {
  const days = Array.from({ length: mission.totalDays }, (_, i) => i + 1);
  const values = days.map((n) => (figures[String(n)] || {})[key] ?? null);
  const present = values.filter((v) => v != null);
  if (!present.length) {
    return `<div class="graph">
      <div class="graph-head"><span class="graph-label">${label}</span></div>
      <div class="empty" style="padding:20px">Nothing recorded yet</div></div>`;
  }

  // Round the axis out to something readable rather than to the data exactly.
  const rawMax = Math.max(...present);
  const step = Math.pow(10, Math.floor(Math.log10(rawMax))) / 2;
  const top = Math.ceil(rawMax / step) * step;
  const mean = Math.round(present.reduce((a, b) => a + b, 0) / present.length);

  const W = 640, H = 200, padL = 52, padR = 12, padT = 14, padB = 26;
  const plotW = W - padL - padR, plotH = H - padT - padB;
  const x = (i) => padL + (days.length === 1 ? plotW / 2 : (i / (days.length - 1)) * plotW);
  const y = (v) => padT + plotH - (v / top) * plotH;

  // Break the line wherever a day is missing.
  const segments = [];
  let run = [];
  values.forEach((v, i) => {
    if (v == null) { if (run.length) segments.push(run); run = []; }
    else run.push([x(i), y(v)]);
  });
  if (run.length) segments.push(run);

  const gridlines = [0, 0.25, 0.5, 0.75, 1].map((f) => {
    const gy = padT + plotH - f * plotH;
    return `<line x1="${padL}" y1="${gy.toFixed(1)}" x2="${W - padR}" y2="${gy.toFixed(1)}"
      stroke="currentColor" stroke-width="0.5" opacity="${f === 0 ? 0.55 : 0.16}"/>
      <text x="${padL - 8}" y="${(gy + 3).toFixed(1)}" text-anchor="end"
        class="graph-axis">${fmt(Math.round(top * f))}</text>`;
  }).join('');

  const line = segments.map((seg) =>
    `<path d="${seg.map(([px, py], i) => `${i ? 'L' : 'M'}${px.toFixed(1)},${py.toFixed(1)}`).join('')}"
      fill="none" stroke="${colour}" stroke-width="2" stroke-linejoin="round"/>`).join('');

  const area = segments.filter((sg) => sg.length > 1).map((seg) =>
    `<path d="M${seg[0][0].toFixed(1)},${(padT + plotH).toFixed(1)} ${
      seg.map(([px, py]) => `L${px.toFixed(1)},${py.toFixed(1)}`).join('')
    } L${seg[seg.length - 1][0].toFixed(1)},${(padT + plotH).toFixed(1)} Z"
      fill="${colour}" opacity="0.12"/>`).join('');

  const points = values.map((v, i) => {
    if (v == null) return `<line x1="${x(i).toFixed(1)}" y1="${padT}" x2="${x(i).toFixed(1)}"
      y2="${padT + plotH}" stroke="currentColor" stroke-width="0.5" stroke-dasharray="2 3" opacity="0.35"/>`;
    const now = days[i] === mission.missionDay;
    return `<circle cx="${x(i).toFixed(1)}" cy="${y(v).toFixed(1)}" r="${now ? 5 : 3}"
      fill="${now ? colour : 'var(--card)'}" stroke="${colour}" stroke-width="2">
      <title>Day ${String(days[i]).padStart(3, '0')}: ${v.toLocaleString('en-GB')} ${unit}</title>
    </circle>`;
  }).join('');

  const dayLabels = days.map((n, i) => `<text x="${x(i).toFixed(1)}" y="${H - 8}"
    text-anchor="middle" class="graph-axis ${n === mission.missionDay ? 'now' : ''}"
    >${String(n).padStart(2, '0')}</text>`).join('');

  return `<div class="graph">
    <div class="graph-head">
      <span class="graph-label"><i style="background:${colour}"></i>${label}</span>
      <span class="graph-stat">${mean.toLocaleString('en-GB')} ${unit} a day on average ·
        ${present.length} of ${days.length} days</span>
    </div>
    <svg viewBox="0 0 ${W} ${H}" class="graph-svg" role="img"
         aria-label="${label} for each of the ${days.length} mission days.">
      ${gridlines}${area}${line}${points}${dayLabels}
    </svg>
  </div>`;
}

/* ================================================================= MISSION */

/**
 * One monitoring channel as a dial: the value in the centre, an arc showing
 * where it sits inside its limits, the channel code and status beneath.
 * Out-of-range channels turn orange, and status is carried by the symbol as
 * well as the colour, so the dial survives print and colourblindness.
 */
function sensorDial(sn) {
  const m = sn.metric, st = sn.status;
  const lo = m.ok_min ?? m.warn_min, hi = m.ok_max ?? m.warn_max;
  const v = st.value;
  const live = v != null;
  let f = 0.66;
  if (live && lo != null && hi != null && hi > lo) {
    f = Math.max(0.05, Math.min(1, (v - lo) / (hi - lo)));
  }
  const R = 42, C = 2 * Math.PI * R;
  const num = !live ? '——' : Math.abs(v) < 10 ? v.toFixed(1) : v.toFixed(v >= 1000 ? 0 : 1);
  const alert = st.state === 'bad' || st.state === 'warn';
  return `<div class="dial ${alert ? 'alert' : ''} ${live ? '' : 'dead'}"
    role="img" aria-label="${esc(m.label)}: ${live ? `${num} ${m.unit}` : 'no signal'} — ${esc(st.label)}">
    <svg viewBox="0 0 100 100" aria-hidden="true">
      <circle cx="50" cy="50" r="${R}" class="dial-track"/>
      ${live ? `<circle cx="50" cy="50" r="${R}" class="dial-arc"
        stroke-dasharray="${C.toFixed(1)}" stroke-dashoffset="${(C * (1 - f)).toFixed(1)}"
        transform="rotate(-90 50 50)"/>` : ''}
      <text x="50" y="57" class="dial-num">${num}</text>
    </svg>
    <div class="dial-unit">${esc(m.unit)}</div>
    <div class="dial-foot">${sym(st.state)}<span>${esc(m.channel)}</span></div>
    <div class="dial-label">${esc(m.label)}</div>
  </div>`;
}

/**
 * Every day of the run, compactly: one fold per day, today's open. Answers
 * "what is this run", which is a different question from "what is happening
 * now" and the one a visitor arriving cold actually has.
 */
function wholeMission(ctx, days, { openToday = true } = {}) {
  const now = ctx.mission.clampedDay, T = ctx.T;
  return days.map((d) => {
    const state = d.missionDay < now ? 'past' : d.missionDay === now ? 'now' : 'ahead';
    const badge = state === 'now' ? `<span class="badge warn">${T('Today')}</span>`
      : state === 'past' ? `<span class="badge">${T('Complete')}</span>` : `<span class="badge earth">${T('Planned')}</span>`;
    return `<details class="mday ${state}"${state === 'now' && openToday ? ' open' : ''}>
      <summary><span class="cs">D${String(d.missionDay).padStart(3, '0')}</span>
        <span>${esc(d.date)}</span>${badge}
        <span class="mday-n">${d.tasks.length} ${T('tasks')}${d.meals.length ? ` · ${d.meals.length} ${T('meals')}` : ''}</span></summary>
      ${d.tasks.length ? `<div class="rows">${d.tasks.map((t) => `
        <div class="row ${t.status === 'DONE' ? 'done' : ''}">
          <div class="t">${esc(t.time)}</div>
          <div class="m"><b>${esc(t.label)}</b>${t.detail ? `<span>${esc(t.detail)}</span>` : ''}</div>
        </div>`).join('')}</div>`
        : `<div class="empty">${T('No schedule filed for this day')}</div>`}
      ${d.meals.length ? `<div class="note" style="margin-top:10px">
        ${d.meals.map((m) => `<b style="color:var(--ink)">${esc(T(m.slot[0] + m.slot.slice(1).toLowerCase()))}</b> ${esc(m.name)}`).join(' · ')}
      </div>` : ''}
      ${d.notes && d.notes.length ? `<div class="rows mday-notes">
        <div class="eyebrow" style="margin:12px 0 6px">${T('Mission notes')}</div>
        ${d.notes.map((n) => `<div class="row">
          <div class="t">${esc(fmtTime(n.posted_at).slice(0, 5))}</div>
          <div class="m entry-post">${MV.entryHtml(n.body, [], { lookup: mediaGet, T })}</div>
          <span class="badge ${n.kind === 'ANOMALY' ? 'warn' : ''}">${esc(n.kind)}</span></div>`).join('')}
      </div>` : ''}
    </details>`;
  }).join('');
}

/**
 * The ticker across the very top of the station: the habitat's clock and a
 * slowly running line of what is happening in there right now — the current
 * task from the day's schedule, the one after it, and the node's current
 * readings. The line is rendered twice and scrolled by CSS so it runs
 * continuously; a small script keeps the clock ticking, moves to the next
 * task as its time comes, and refreshes the readings on the node's cycle.
 * Under prefers-reduced-motion it stands still.
 */
function ticker(ctx, { today }) {
  const m = ctx.mission, T = ctx.T;
  const pre = m.phase === 'PRE_LAUNCH', over = m.phase === 'COMPLETE';
  const tasks = (today && today.tasks ? today.tasks : []).map((t) => ({ time: t.time, label: t.label, detail: t.detail || '' }));
  const hm = m.venueTime.slice(0, 5);
  let nowTask = null, nextTask = null;
  for (const t of tasks) { if (t.time <= hm) nowTask = t; else if (!nextTask) nextTask = t; }
  const cells = [];
  if (pre) cells.push(`<b id="tk-count">T−${m.countdown.days}d ${String(m.countdown.hours).padStart(2, '0')}:${String(m.countdown.minutes).padStart(2, '0')}:${String(m.countdown.seconds).padStart(2, '0')}</b> ${T('to occupation')} · ${T('opens')} ${esc(m.startLabel)}`);
  else if (over) cells.push(`<b>${T('Mission complete')}</b> · ${T('the record stays')}`);
  else {
    cells.push(`<b>SOL ${String(m.clampedDay).padStart(2, '0')}/${String(m.totalDays).padStart(2, '0')}</b>`);
    const say = (t) => `${esc(t.time)} · ${esc(t.label)}${t.detail ? ` — ${esc(t.detail)}` : ''}`;
    cells.push(`${T('The crew are currently:')} <b id="tk-now">${nowTask ? say(nowTask) : T('off the schedule')}</b>`);
    cells.push(`${T('Next:')} <b id="tk-next">${nextTask ? say(nextTask) : T('nothing more today')}</b>`);
  }
  cells.push(`${T('Habitat:')} <b id="tk-hab">${T('awaiting reading')}</b>`);
  cells.push(`${T('One-way signal')} <b>${orbital.formatLightTime(ctx.geo.lightSeconds)}</b>`);
  const line = cells.map((c) => `<span class="tk-cell">${c}</span>`).join('<span class="tk-sep">·</span>');
  return `
  <div class="ticker" role="marquee" aria-label="${esc(T('What is happening in the habitat'))}"
       data-tz="${esc(m.timezone)}" data-tasks="${esc(JSON.stringify(tasks))}"${over ? ' data-over="1"' : ''}
       data-phase="${esc(m.phase)}" data-opens="${esc(m.opensAt)}" data-epoch="${esc(String(require('../../lib/content').resetEpoch() || ''))}">
    <div class="tk-clock"><span class="tk-clock-label">${T('HABITAT TIME')}</span> <b id="tk-clock">${esc(m.venueTime)}</b></div>
    <div class="tk-window"><div class="tk-track" id="tk-track"><div class="tk-line">${line}</div><div class="tk-line" aria-hidden="true">${line}</div></div></div>
  </div>
  <script>
  (function () {
    var el = document.querySelector('.ticker');
    if (!el) return;
    var tz = el.getAttribute('data-tz') || 'Europe/Berlin';
    function fmt(opts) { return new Intl.DateTimeFormat('en-GB', Object.assign({ timeZone: tz, hour12: false }, opts)).format(new Date()); }
    var clock = document.getElementById('tk-clock');
    function tick() { try { clock.textContent = fmt({ hour: '2-digit', minute: '2-digit', second: '2-digit' }); } catch (e) { /* keep the server's */ } }
    setInterval(tick, 1000); tick();
    // After the run nothing is updated by automation: the clock still ticks,
    // but the schedule and the readings are never asked for again.
    var over = el.getAttribute('data-over') === '1';
    if (over) return;
    var all = function (sel) { return [].slice.call(el.querySelectorAll(sel)); };
    var tasks = [];
    try { tasks = JSON.parse(el.getAttribute('data-tasks') || '[]'); } catch (e) { /* none */ }
    function say(t) { return t.time + ' \u00b7 ' + t.label + (t.detail ? ' \u2014 ' + t.detail : ''); }
    function retask() {
      var at = fmt({ hour: '2-digit', minute: '2-digit' }), nowT = null, nextT = null;
      tasks.forEach(function (t) { if (t.time <= at) nowT = t; else if (!nextT) nextT = t; });
      all('[id="tk-now"]').forEach(function (n) { n.textContent = nowT ? say(nowT) : t('off the schedule'); });
      all('[id="tk-next"]').forEach(function (n) { n.textContent = nextT ? say(nextT) : t('nothing more today'); });
    }
    var timers = [];
    function stop() { timers.forEach(clearInterval); timers = []; }
    retask(); timers.push(setInterval(retask, 30000));
    // The ticker is always NOW. Before the run it counts down, to the second,
    // to 00:00 at the venue on the first day; the moment that instant passes
    // — or the station is reset, or its dates change under an open page —
    // the page reloads itself once and comes back as the run: SOL 01, the
    // day's schedule, the crew's current task. A page left open across
    // midnight on 15 October turns into the run by itself.
    var phase = el.getAttribute('data-phase') || '';
    var epoch = el.getAttribute('data-epoch') || '';
    var opens = Date.parse(el.getAttribute('data-opens') || '') || 0;
    var reloading = false;
    function turn() { if (reloading) return; reloading = true; stop(); setTimeout(function () { window.location.reload(); }, 1500); }
    var count = document.querySelectorAll('[id="tk-count"]');
    function countdown() {
      if (!opens || !count.length) return;
      var left = opens - Date.now();
      // at zero the station is asked, not assumed: a phone's clock can run
      // ahead, and the page must not reload itself in a loop
      if (left <= 0) { for (var k = 0; k < count.length; k++) count[k].textContent = 'T\u22120d 00:00:00'; refetch(); return; }
      var s = Math.floor(left / 1000), d = Math.floor(s / 86400), h = Math.floor(s % 86400 / 3600), mi = Math.floor(s % 3600 / 60), sec = s % 60;
      var pad = function (n) { return (n < 10 ? '0' : '') + n; };
      var text = 'T\u2212' + d + 'd ' + pad(h) + ':' + pad(mi) + ':' + pad(sec);
      for (var i = 0; i < count.length; i++) count[i].textContent = text;
    }
    if (phase === 'PRE_LAUNCH') { countdown(); timers.push(setInterval(countdown, 1000)); }
    // The schedule is fetched again on a cycle, so a day edited in mission
    // control — or midnight turning the page to a new day — reaches every
    // open phone without a reload; and if the station's phase or epoch has
    // moved (the run began, a reset, new dates), the page turns over.
    var fetching = false;
    function refetch() {
      if (fetching || reloading) return; fetching = true;
      fetch('/api/ticker', { cache: 'no-store' }).finally(function () { fetching = false; }).then(function (r) { return r.json(); }).then(function (d) {
        if (d.phase === 'COMPLETE' && phase !== 'COMPLETE') { turn(); return; }   // the run has ended under this open page
        if ((d.phase && d.phase !== phase) || (d.epoch && epoch && String(d.epoch) !== epoch)) { turn(); return; }
        if (d.opensAt) opens = Date.parse(d.opensAt) || opens;
        if (Array.isArray(d.tasks)) { tasks = d.tasks; retask(); }
      }).catch(function () { /* next time */ });
    }
    // every five minutes; every ten seconds in the last minute before the run
    timers.push(setInterval(function () {
      var left = opens ? opens - Date.now() : Infinity;
      if (left < 60000) refetch();
    }, 10000));
    timers.push(setInterval(refetch, 5 * 60 * 1000));
    function reading() {
      fetch('/api/habitat/data?days=1', { cache: 'no-store' }).then(function (r) { return r.json(); }).then(function (d) {
        var rows = d.rows || [], last = rows[rows.length - 1];
        var fresh = last && (Date.now() - last.t) <= 30 * 60 * 1000;
        var text = t('no current reading');
        if (fresh) {
          var bits = [];
          if (last.temp != null) bits.push(last.temp.toFixed(1) + ' \u00b0C');
          if (last.hum != null) bits.push(Math.round(last.hum) + ' %');
          if (last.co2 != null) bits.push('CO\u2082 ' + Math.round(last.co2) + ' ppm');
          if (bits.length) text = bits.join(' \u00b7 ');
        }
        all('[id="tk-hab"]').forEach(function (n) { n.textContent = text; });
      }).catch(function () { /* next cycle */ });
    }
    reading(); timers.push(setInterval(reading, 5 * 60 * 1000));
  })();
  </script>`;
}

function mission(ctx, { sensors, crew, today, counts, recent, latestEntries = [], crewFigures = {},
                        power = { categories: [], days: {} },
                        inFlight = null, error = null, draft = '',
                        allDays = [], logDays = [], entryCounts = { published: 0, days: 0 }, ingest = [],
                        media = [], mediaCounts = { total: 0, bytes: 0 }, mediaLookup = () => null,
                        hardware = null, hardwareDaily = [], cloud = null }) {
  const pre = ctx.mission.phase === 'PRE_LAUNCH', T = ctx.T;
  // This visitor's messages that mission control has not yet published. They
  // are in the page, but only surface under MY MESSAGES.
  const pendingMine = recent.filter((m) => m.mine && m.pending).length;
  // Once you have sent something, the board opens on your own messages, so
  // the one you just transmitted is the first thing you see.
  const openOnMine = false;   // ALL opens first; the viewer's own messages head it

  /* The masthead: the wordmark, one line under it, the run, and the
     station's readings as a row of small pills on the right — shared with
     every other public page so they read as one station. */
  const hero = ticker(ctx, { today }) + L.masthead(ctx, { home: true });

  /* The days of the run, spelled down the right-hand margin. */
  const dayRail = `<aside class="day-rail" aria-hidden="true">
    ${Array.from({ length: ctx.mission.totalDays }, (_, i) => {
      const n = i + 1, now = ctx.mission.clampedDay;
      const cls = pre ? '' : n === now ? 'now' : n < now ? 'past' : '';
      return `${i ? `<i class="${!pre && n <= now ? 'past' : ''}"></i>` : ''}<span class="${cls}">${String(n).padStart(2, '0')}</span>`;
    }).join('')}
    <span class="day-rail-cap">SOL</span>
  </aside>`;

  const body = `
  ${aboutSection(ctx, { crew })}
  <div class="portal-grid" id="write">
    <aside class="portal-letters" aria-hidden="true">${'MARSPLATZ'.split('').map((c) => `<span>${c}</span>`).join('')}</aside>
    <div class="portal-main">
      <h2 class="sr-only">${T('Communication Portal')}</h2>
      <!-- The composer as a device: an LED, the ribbed grip, a knob and a
           row of vents, then the operator's callsign and the channel. While
           a message is crossing, the form gives way to the dial. -->
      <section class="device composer-device${inFlight ? ' sending' : ''}" aria-label="${esc(T('Composer'))}">
        <span class="dev-led" aria-hidden="true"></span>
        <span class="dev-grip" aria-hidden="true"></span>
        <span class="dev-knob" aria-hidden="true"></span>
        <span class="dev-vents" aria-hidden="true"></span>
        <div class="dev-head">
          <span>${T('Operator')}</span>
          <span class="dev-chip" title="${esc(T('Your callsign for this visit — no account, no name'))}">${esc(ctx.callsign)}</span>
          <span class="dev-chan">CH-09 · Uplink</span>
        </div>
        <div class="dev-body" id="dev-body">${composerBlock(ctx, { inFlight, error, draft })}</div>
      </section>
    </div>
    <section class="feed-col" id="exchanges">
      <!-- The board is live: board.js polls /api/board and swaps the cards in
           place, so a reply published from mission control, or another
           visitor's exchange, appears without anyone reloading. The full
           structure is always rendered, even when empty, so the first card
           can arrive into it. -->
      <div class="feed-wrap"><div class="feed-scroll" id="feed" data-poll="/api/board"
          data-version="${boardVersion(recent)}">
        <div class="screen board">
          <div class="board-head">
            <h2>${T('Message Board')}</h2>
            <span class="live" id="feed-live" title="${esc(T('The board refreshes itself every few seconds'))}">${T('LIVE')}</span>
          </div>
          <div class="scroller feed"><div class="cards" id="feed-cards">${boardCards(recent, T)}
            <div class="empty" id="feed-empty"${recent.length ? ' style="display:none"' : ''}
              data-none="${esc(T('Nothing transmitted yet — the first message could be yours'))}"
              data-filtered="${esc(T('No messages match this filter'))}">${
              T(recent.length ? 'No messages match this filter' : 'Nothing transmitted yet — the first message could be yours')}</div>
          </div></div>
          <div class="feed-filter" id="feed-filter" role="group" aria-label="${esc(T('Filter the board'))}"${
          recent.length ? '' : ' hidden'}>
          <button type="button" class="chip${openOnMine ? '' : ' active'}" data-filter="">${T('ALL')}</button>
          <button type="button" class="chip mine${openOnMine ? ' active' : ''}" data-filter="mine">${T('MY MESSAGES')} <span
            class="chip-count" id="feed-mine-count"${pendingMine ? '' : ' hidden'}>${pendingMine}</span></button>
          ${TAGS.map((t) => `<button type="button" class="chip" data-filter="tag:${t}">${T(t)}</button>`).join('')}
          </div>
        </div>
      </div></div>
    </section>
    ${dayRail}
  </div>

  ${dashboard(ctx, { crew, today, counts, crewFigures, power, allDays, logDays, entryCounts, ingest, media, mediaCounts, mediaLookup, hardware, hardwareDaily, cloud })}
  `;
  return L.page({
    title: 'Mission', ctx, body, hero, hideNav: true, hideRail: true, bodyClass: 'landing',
    current: '/', scripts: ['/composer.js', '/board.js', '/habitat.js', '/hardware.js'].concat(cloud ? ['/cloud.js'] : []),
  });
}



/**
 * A crew figure as a small tile: today's value, the mission average, and the
 * thirteen days as a sparkline. Lives inside the habitat bento beside the sensor
 * tiles rather than as a chart of its own.
 */
function figureTile(figures, mission, { key, label, unit, colour, fmt, T = same }) {
  const days = Array.from({ length: mission.totalDays }, (_, i) => i + 1);
  const values = days.map((n) => (figures[String(n)] || {})[key] ?? null);
  const present = values.filter((v) => v != null);
  const today = values[mission.clampedDay - 1];
  const latest = [...values].reverse().find((v) => v != null);
  const mean = present.length ? Math.round(present.reduce((a, b) => a + b, 0) / present.length) : null;
  const W = 160, H = 36, pad = 4;
  const hi = present.length ? Math.max(...present) : 1, lo = present.length ? Math.min(...present) : 0;
  const x = (i) => pad + (days.length === 1 ? (W - 2 * pad) / 2 : (i / (days.length - 1)) * (W - 2 * pad));
  const y = (v) => hi === lo ? H / 2 : pad + (H - 2 * pad) - ((v - lo) / (hi - lo)) * (H - 2 * pad);
  const segs = [];
  let run = [];
  values.forEach((v, i) => { if (v == null) { if (run.length) segs.push(run); run = []; } else run.push([x(i), y(v)]); });
  if (run.length) segs.push(run);
  const spark = present.length ? `<svg class="fig-spark" viewBox="0 0 ${W} ${H}" preserveAspectRatio="none" aria-hidden="true">
    ${segs.map((sg) => `<path d="${sg.map(([px, py], i) => `${i ? 'L' : 'M'}${px.toFixed(1)},${py.toFixed(1)}`).join('')}"
      fill="none" stroke="${colour}" stroke-width="2" stroke-linejoin="round" stroke-linecap="round"/>`).join('')}
    ${values.map((v, i) => v == null
      ? `<line x1="${x(i).toFixed(1)}" y1="${pad}" x2="${x(i).toFixed(1)}" y2="${H - pad}" stroke="currentColor" stroke-width="1" stroke-dasharray="2 3" opacity="0.35"/>`
      : `<circle cx="${x(i).toFixed(1)}" cy="${y(v).toFixed(1)}" r="${days[i] === mission.clampedDay ? 3.5 : 2}"
          fill="${days[i] === mission.clampedDay ? colour : 'var(--well)'}" stroke="${colour}" stroke-width="${days[i] === mission.clampedDay ? 2 : 1.5}">
          <title>${T('Day')} ${String(days[i]).padStart(3, '0')}: ${v.toLocaleString('en-GB')} ${unit}</title></circle>`).join('')}
  </svg>` : '';
  const shown = today ?? latest;
  return `<section class="tile t-fig t-${key}" role="img" aria-label="${esc(T(label))}: ${shown != null ? fmt(shown) + ' ' + unit : T('nothing recorded')} ${T('today')}">
    <h3>${T(label)}</h3>
    <span class="sub">${today != null ? `${T('Day')} ${String(mission.clampedDay).padStart(3, '0')}` : latest != null ? T('Last recorded') : T('Counted by the crew')}</span>
    <div class="fig-row">
      <div class="big">${shown != null ? fmt(shown) : '—'}<em>${esc(unit)}</em></div>
      ${spark}
    </div>
    <div class="verdict">${mean != null ? `${fmt(mean)} ${esc(unit)} ${T('a day on average')} · ${present.length} ${T('of')} ${dayWord(T, days.length)}` : T('Nothing recorded yet')}</div>
  </section>`;
}


/**
 * One row of the trend view: a name and its scale on the left, the series as
 * a line across the mission days, the latest figure on the right. Every row
 * shares the same x-axis and the same height, so the block reads as a set of
 * instruments rather than a set of charts. A day with nothing recorded is a
 * gap, never a zero.
 */
function trendRow({ name, scale, values, lo, hi, unit, today, fmt = (v) => String(v), alertAbove = null }) {
  const n = values.length, W = 1000, H = 40, pad = 5;
  const x = (i) => n === 1 ? W / 2 : (i / (n - 1)) * (W - 2 * pad) + pad;
  const span = hi - lo || 1;
  const y = (v) => pad + (H - 2 * pad) - ((Math.min(hi, Math.max(lo, v)) - lo) / span) * (H - 2 * pad);
  const segs = [];
  let run = [];
  values.forEach((v, i) => { if (v == null) { if (run.length) segs.push(run); run = []; } else run.push([x(i), y(v)]); });
  if (run.length) segs.push(run);
  const latestIdx = values.reduce((acc, v, i) => (v != null ? i : acc), -1);
  const latest = latestIdx >= 0 ? values[latestIdx] : null;
  const hot = alertAbove != null && latest != null && latest > alertAbove;
  return `<div class="trow ${hot ? 'hot' : ''}">
    <div class="tkey"><span class="k">${esc(name)}</span><span class="v">${esc(scale)}</span></div>
    <div class="tplot"><svg viewBox="0 0 ${W} ${H}" preserveAspectRatio="none" aria-label="${esc(name)} across the mission">
      <line x1="0" x2="${W}" y1="${H - pad}" y2="${H - pad}" class="tbase"/>
      ${alertAbove != null && alertAbove > lo && alertAbove < hi
        ? `<line x1="0" x2="${W}" y1="${y(alertAbove).toFixed(1)}" y2="${y(alertAbove).toFixed(1)}" class="talert"/>` : ''}
      ${segs.filter((sg) => sg.length > 1).map((sg) => `<path d="M${sg[0][0].toFixed(1)},${H - pad} ${
        sg.map(([px, py]) => `L${px.toFixed(1)},${py.toFixed(1)}`).join('')} L${sg[sg.length - 1][0].toFixed(1)},${H - pad} Z" class="tarea"/>`).join('')}
      ${segs.map((sg) => `<path d="${sg.map(([px, py], i) => `${i ? 'L' : 'M'}${px.toFixed(1)},${py.toFixed(1)}`).join('')}" class="tline"/>`).join('')}
      ${values.map((v, i) => v == null ? '' : `<circle cx="${x(i).toFixed(1)}" cy="${y(v).toFixed(1)}" r="${i + 1 === today ? 4 : 2.5}"
        class="tdot ${i + 1 === today ? 'today' : ''}"><title>Day ${String(i + 1).padStart(3, '0')}: ${fmt(v)} ${esc(unit)}</title></circle>`).join('')}
    </svg></div>
    <div class="tval">${latest != null ? `<b>${fmt(latest)}</b><em>${esc(unit)}</em>` : '<span class="none">—</span>'}</div>
  </div>`;
}

/* ======================================================== HABITAT HARDWARE */

/**
 * The habitat's own hardware, read through Home Assistant — a panel of its
 * own directly below the Habitat panel: one combined chart with every
 * device on the same day, midnight to midnight at the venue — each line
 * named at its end with the current reading. The server polls and stores
 * (src/lib/home-assistant.js) and renders this; /public/hardware.js
 * re-fetches the rendered panel from /api/hardware and swaps it in place,
 * so a new sensor added to content/home-assistant.json is on every open
 * phone within a poll. Without host and token in .env the panel is not
 * rendered at all.
 */

// The trend graph's palette (public/habitat.js), in the same fixed order —
// a device keeps its colour as the list grows; it is assigned by position
// in content/home-assistant.json, never re-dealt by the data.
const HW_PALETTE = ['#ff6a1a', '#4f7bd9', '#8b6fd6', '#3aa66f', '#d94f7b', '#2aa7b8', '#c48a1c', '#6b7a8f',
                   '#e0562e', '#3f5fbf', '#9c4dcc', '#2e8b57', '#b8336a', '#1f8fa3', '#a67c00', '#556677'];
const hwColour = (i) => HW_PALETTE[i % HW_PALETTE.length];
function hwTz() { try { return missionLib.config().timezone; } catch { return 'Europe/Berlin'; } }
const hwClock = (t, tz) => {
  try { return new Date(t).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', timeZone: tz }); }
  catch { return new Date(t).toISOString().slice(11, 16); }
};
const hwNum = (v, dec = 1) => v == null ? '—'
  : v.toLocaleString('en-GB', { minimumFractionDigits: 0, maximumFractionDigits: dec });

/** Every device on one day — midnight to midnight at the venue. One axis —
 *  time; each line rides its own scale (lowest to highest of the day, the
 *  same device as the Trends panel), named at its right-hand end in its own
 *  colour with the current reading. A thin mark stands on the current time. */
function hwChart(hw, tz, T = same) {
  const W = 1000, H = 280, padL = 12, padR = 210, padT = 16, padB = 34;
  const iw = W - padL - padR, ih = H - padT - padB;
  const span = Math.max(1, hw.now - hw.since);
  const sx = (t) => padL + ((t - hw.since) / span) * iw;
  const series = [];
  (hw.sensors || []).forEach((s, i) => {
    if (!s.points || !s.points.length) return;
    const vals = s.points.map((p) => p[1]);
    let lo = Math.min(...vals), hi = Math.max(...vals);
    if (hi - lo < 1e-9) { hi += 0.5; lo -= 0.5; }
    const sy = (v) => padT + ih - ((v - lo) / (hi - lo)) * ih;
    const d = s.points.map((p, k) => `${k ? 'L' : 'M'}${sx(p[0]).toFixed(1)},${sy(p[1]).toFixed(1)}`).join('');
    // Every hourly value is a visible point on the line.
    const dots = s.points.map((p) => [sx(p[0]), sy(p[1])]);
    const [et, ev] = s.points[s.points.length - 1];
    series.push({ s, colour: hwColour(i), d, dots, ex: sx(et), ey: sy(ev) });
  });
  if (!series.length) return '';
  // The time axis: every hour of the day, 00 to 24, a gridline and a label
  // each — the six-hour marks drawn stronger. The first and last labels
  // anchor inward so nothing clips at the edges.
  const ticks = Array.from({ length: 25 }, (_, k) => ({ t: hw.since + k * 3600000, k }));
  // Line-end labels pushed apart so none overlap, as on the Trends panel.
  // Two lines each — the name, the current reading beneath it.
  const rows = [...series].sort((a, b) => a.ey - b.ey);
  let prev = -Infinity;
  for (const r of rows) { r.ty = Math.max(r.ey, prev + 34, padT + 10); prev = r.ty; }
  const over = rows.length ? rows[rows.length - 1].ty + 14 - (H - padB) : 0;
  if (over > 0) for (const r of rows) r.ty -= over;
  const railX = W - padR + 14;
  return `<figure class="hw-chart">
  <svg viewBox="0 0 ${W} ${H}" role="img" aria-label="${esc(T('Every hardware device today, midnight to midnight venue time, one line each, each on its own scale.'))}">
    ${ticks.map(({ t, k }) => `<line x1="${sx(t).toFixed(1)}" y1="${padT}" x2="${sx(t).toFixed(1)}" y2="${H - padB}" stroke="var(--rule)" stroke-width="1"${k % 6 ? ' opacity="0.45"' : ''}/>
      <text x="${sx(t).toFixed(1)}" y="${H - padB + 16}" text-anchor="${k === 0 ? 'start' : k === ticks.length - 1 ? 'end' : 'middle'}" class="hw-ax"${k % 6 ? ' opacity="0.6"' : ''}>${String(k).padStart(2, '0')}</text>`).join('')}
    ${hw.liveNow && hw.liveNow > hw.since && hw.liveNow < hw.now ? `<line x1="${sx(hw.liveNow).toFixed(1)}" y1="${padT}" x2="${sx(hw.liveNow).toFixed(1)}" y2="${H - padB}" stroke="#ff6a1a" stroke-width="1" stroke-dasharray="2 4" opacity="0.6"><title>${T('now')} · ${hwClock(hw.liveNow, tz)}</title></line>` : ''}
    <line x1="${padL}" y1="${H - padB}" x2="${W - padR + 4}" y2="${H - padB}" stroke="var(--rule-hard)" stroke-width="1"/>
    ${series.map((r) => `<path d="${r.d}" class="hw-line" stroke="${r.colour}"><title>${esc(r.s.label)}</title></path>
      ${r.dots.map(([dx, dy]) => `<circle cx="${dx.toFixed(1)}" cy="${dy.toFixed(1)}" r="2.5" fill="${r.colour}" stroke="var(--well)" stroke-width="1"/>`).join('')}`).join('')}
    ${rows.map((r) => `
      <circle cx="${r.ex.toFixed(1)}" cy="${r.ey.toFixed(1)}" r="3.5" fill="${r.colour}" stroke="var(--well)" stroke-width="1.5"/>
      ${Math.abs(r.ty - r.ey) > 2 || railX - r.ex > 8 ? `<line x1="${r.ex.toFixed(1)}" y1="${r.ey.toFixed(1)}" x2="${(railX - 4).toFixed(1)}" y2="${r.ty.toFixed(1)}" stroke="${r.colour}" stroke-width="1" stroke-dasharray="2 3" opacity="0.7"/>` : ''}
      <text x="${railX}" y="${r.ty.toFixed(1)}" text-anchor="start" class="hw-name" fill="${r.colour}">${esc(r.s.label)}</text>
      <text x="${railX}" y="${(r.ty + 16).toFixed(1)}" text-anchor="start" class="hw-val" fill="${r.colour}">${hwNum(r.s.value, r.s.decimals)}${r.s.unit ? ' ' + esc(r.s.unit) : ''}</text>`).join('')}
  </svg>
</figure>`;
}

/**
 * The panel's whole inner HTML: tiles, then the combined chart. Rendered
 * here and by /api/hardware alike, so what the browser swaps in is exactly
 * what the server would have served.
 */
function hardwareInner(hw, T = same) {
  const tz = hwTz();
  const list = hw.sensors || [];
  // The chart is the panel: no tiles, one combined day chart, every device a
  // line named at its end with the current reading. The diagnostics the
  // tiles used to carry (a sensor not in the feed) become a note above it.
  const missing = list.filter((s) => s.missing);
  const chart = hwChart(hw, tz, T);
  return `
    ${hw.down ? `<p class="note hw-down">${L.sym('warn')} ${T('Home Assistant could not be reached on the last poll')}${
      hw.lastPollAt ? ` ${T('at')} ${hwClock(hw.lastPollAt, tz)}` : ''} — ${T('these are the last readings stored.')}</p>` : ''}
    ${hw.frozen ? `<p class="note">${T('The record is closed — the hardware was last read before the end of 27 October 2026.')}</p>` : ''}
    ${missing.length ? `<p class="note">${L.sym('warn')} ${T('Not in the feed:')} ${missing.map((s) => `sensor.${esc(s.id)}`).join(' · ')} — ${T('check the id in content/home-assistant.json.')}</p>` : ''}
    ${chart || `<div class="empty">${T(list.length ? 'WAITING FOR THE FIRST READINGS FROM THE HARDWARE' : 'NO DEVICES CONFIGURED IN CONTENT/HOME-ASSISTANT.JSON')}</div>`}`;
}

/* =============================================================== DASHBOARD */

/** One stat tile of the KPI row. */
const kpi = ({ label, value, unit, sub, state }) => `
  <div class="kpi${state ? ` ${state}` : ''}">
    <div class="kpi-label">${esc(label)}</div>
    <div class="kpi-value">${value}${unit ? `<em>${esc(unit)}</em>` : ''}</div>
    <div class="kpi-sub">${sub}</div>
  </div>`;

/** A dashboard panel: code, title and meta in the head, the content beneath. */
const dpanel = ({ id, code, title, meta = '', span = 4, cls = '', href = null }, inner) => `
  <section class="dpanel span-${span} ${cls}"${id ? ` id="${id}"` : ''}>
    <header class="dpanel-head">
      <div class="dpanel-title"><span class="dpanel-code">${esc(code)}</span><h3>${
        href ? `<a href="${href}">${esc(title)} <span class="dpanel-arrow" aria-hidden="true">→</span></a>` : esc(title)}</h3></div>
      ${meta ? `<span class="dpanel-meta">${meta}</span>` : ''}
    </header>
    <div class="dpanel-body">${inner}</div>
  </section>`;

/**
 * Everything below the landing fold, in one view: a row of headline figures,
 * the run as a strip of days, then the day's schedule, the habitat, the
 * galley, the stores, the crew's figures, their condition, their log and the
 * whole mission — laid out on one twelve-column grid, nothing hidden behind
 * a tab.
 */
function dashboard(ctx, { crew, today, counts, crewFigures, power = { categories: [], days: {} }, allDays, logDays, entryCounts, ingest = [], media = [], mediaCounts = { total: 0, bytes: 0 }, mediaLookup = () => null, hardware = null, hardwareDaily = [], cloud = null }) {
  const m = ctx.mission, g = ctx.geo, T = ctx.T;
  const pre = m.phase === 'PRE_LAUNCH';
  const slotName = { BREAKFAST: 'Breakfast', LUNCH: 'Lunch', DINNER: 'Dinner', RATION: 'Ration' };
  const day3 = String(m.clampedDay).padStart(3, '0');
  const sols = m.totalDays - m.clampedDay;
  const inventory = today ? today.inventory : [];

  /* ---- headline figures */
  const tasks = today ? today.tasks : [];
  const done = tasks.filter((t) => t.status === 'DONE').length;

  const kpis = [
    kpi({ label: 'SOL', value: pre ? `T−${m.countdown.days}` : String(m.clampedDay).padStart(2, '0'),
          unit: pre ? 'sols' : `/ ${String(m.totalDays).padStart(2, '0')}`,
          sub: pre ? `${T('Opens')} ${esc(m.startLabel)}` : `${sols} ${T(sols === 1 ? 'sol remaining' : 'sols remaining')}` }),
    kpi({ label: T('Crew'), value: String(crew.length), sub: T('officers') }),
  ].join('');

  /* ---- the run as a strip */
  const strip = `<div class="run-strip" aria-label="${esc(T('The sols of the run'))}">${
    Array.from({ length: m.totalDays }, (_, i) => {
      const n = i + 1;
      const cls = pre ? '' : n < m.clampedDay ? 'past' : n === m.clampedDay ? 'now' : '';
      const d = allDays.find((x) => x.missionDay === n);
      return `<div class="${cls}"><span class="run-n">SOL ${String(n).padStart(2, '0')}</span><i></i>
        <span class="run-d">${d ? esc(shortDay(d.date)) : ''}</span></div>`;
    }).join('')}</div>`;

  /* ---- panels */
  const schedule = dpanel({ id: 'schedule', code: 'CH-30', title: T('Today’s Schedule'),
    meta: `SOL ${day3} · ${done}/${tasks.length} ${T('done')}`, span: 4, cls: 'h-3 scroll' },
    tasks.length ? `<div class="rows">${tasks.map((t) => `
      <div class="row ${t.status === 'DONE' ? 'done' : ''} ${t.status === 'ACTIVE' ? 'active' : ''}">
        <div class="t">${esc(t.time)}</div>
        <div class="m"><b>${esc(t.label)}</b>${t.detail ? `<span>${esc(t.detail)}</span>` : ''}</div>
      </div>`).join('')}</div>` : `<div class="empty">${T('No schedule filed for today')}</div>`);

  /* ---- the trend graph: what habitat.js draws, as data. Every series is a
     map of venue date → value, so the browser can lay it on its fifteen-day
     axis. The station's own ingest channels come from here (the Sensor-11
     feed is added in the browser, which already holds its rows), then each
     store — with what was carried in, the scale it is drawn against — and
     the crew's counts. Stores and counts are indexed by mission day, so they
     have nothing to plot until day one; they are still listed, so the legend
     shows what will join. */
  const dayN = Array.from({ length: m.totalDays }, (_, i) => i + 1);
  const items = inventory.length ? inventory : ((allDays[0] || {}).inventory || []);
  const upTo = (n) => !pre && n <= m.clampedDay;
  const dateOf = (n) => (allDays[n - 1] || {}).date;
  // Each series is two maps of venue date → value: `points`, the days that
  // have happened, and — for anything prepared in advance — `planned`, the
  // days still ahead, which the graph draws dashed until the real figure
  // replaces them. Counts of what happened (messages, tasks done) have no
  // planned side.
  // `points` is keyed by venue date — the days that have happened. `planned`
  // is keyed by SOL (mission day 1–13), for anything prepared in advance, so
  // the graph can lay the run's plan over whichever fortnight it is showing;
  // a real point on the same SOL takes its place. Counts of what happened
  // (messages, tasks done) have no planned side.
  const byDay = (fn, { ahead = false } = {}) => {
    const points = {}, planned = {};
    for (const n of dayN) {
      const v = fn(n);
      if (v == null) continue;
      if (upTo(n)) points[dateOf(n)] = v;
      if (ahead) planned[n] = v;
    }
    return { points, planned };
  };
  const rowOf = (n, key) => { const d = allDays[n - 1]; return d && d.inventory ? d.inventory.find((i) => i.key === key) : null; };
  const level = (key) => byDay((n) => { const r = rowOf(n, key); return r ? r.quantity : null; }, { ahead: true });
  const use = (key) => byDay((n) => { const r = rowOf(n, key); return r ? r.consumption : null; }, { ahead: true });
  // The day's meals, summed: what the plan cost in energy, water and power.
  const mealSum = (field) => byDay((n) => { const d = allDays[n - 1]; return d && d.meals.length ? d.meals.reduce((s, x) => s + (x[field] || 0), 0) : null; }, { ahead: true });
  const figure = (k) => byDay((n) => (crewFigures[String(n)] || {})[k] ?? null, { ahead: true });
  // What happened each day: the schedule worked through, the traffic from
  // Earth, what the crew wrote and sent out.
  const act = data.dailyActivity();
  const tasksDone = byDay((n) => { const d = allDays[n - 1]; return d && d.tasks.length ? d.tasks.filter((t) => t.status === 'DONE').length : null; });
  const written = byDay((n) => { const d = logDays[n - 1]; return d ? d.written : null; });
  const count = (k) => byDay((n) => (act[n] || {})[k] || 0);
  /* The axis of the trend graph. During and after the run it is the run,
     SOL 01 to 13 — and so it is before the run once Reset to 15 October has
     been pressed. Until then, after a fresh build, it starts on the build
     day and runs thirteen days from there, so what the node sends now is on
     the graph from today. */
  let axis = { start: m.start_date, end: m.end_date, run: true };
  let fromBuild = false;
  try { fromBuild = require('../../lib/critical').floorMode() === 'build'; } catch { /* the run */ }
  if (pre && fromBuild) {
    let anchor = m.today;
    try { anchor = missionLib.localDate(new Date(require('../../lib/critical').anchorMs()), m.timezone); } catch { /* today */ }
    if (anchor > m.today) anchor = m.today;
    const end = new Date(Date.parse(anchor + 'T00:00:00Z') + 12 * 86400000).toISOString().slice(0, 10);
    axis = { start: anchor, end: end < m.start_date ? end : m.start_date, run: false };
    if (axis.end < axis.start) axis.end = axis.start;
  }
  const trendSpec = {
    series: [
      ...ingest.map((c) => ({ id: 'ingest-' + c.metric, name: T(c.label), unit: c.unit, group: T('Habitat'), domain: c.domain, points: c.points })),
      // The habitat's own hardware, through Home Assistant: one line per
      // device, one value per day — a gauge's daily mean, a meter's daily
      // added amount. Appears from the first day a reading was stored.
      ...hardwareDaily.filter((h) => Object.keys(h.points).length).map((h) => ({
        id: 'hw-' + h.id, name: h.label, unit: h.unit, group: T('Hardware'), points: h.points })),
      ...items.map((it) => ({ id: 'store-' + it.key, name: it.label, unit: it.unit, group: T('Resources'),
        scaleMax: it.start_quantity || it.quantity || 1, ...level(it.key) })),
      ...items.map((it) => ({ id: 'use-' + it.key, name: it.label + ' ' + T('use'), unit: it.unit + '/' + T('day'), group: T('Daily use'), ...use(it.key) })),
      ...power.categories.map((c) => ({ id: 'pwr-' + c.key, name: T('Power') + ' · ' + c.label, unit: 'kWh', group: T('Power'),
        ...byDay((n) => (power.days[String(n)] || {})[c.key] ?? null, { ahead: true }) })),
      { id: 'pwr-total', name: T('Power · all categories'), unit: 'kWh', group: T('Power'),
        ...byDay((n) => { const d = power.days[String(n)]; if (!d) return null;
          const vals = power.categories.map((c) => d[c.key]).filter((v) => v != null);
          return vals.length ? Math.round(vals.reduce((s, v) => s + v, 0) * 100) / 100 : null; }, { ahead: true }) },
      { id: 'meal-kcal', name: T('Meals energy'), unit: 'kcal', group: T('Meals'), ...mealSum('kcal') },
      { id: 'meal-water', name: T('Meals water'), unit: 'L', group: T('Meals'), ...mealSum('water_litres') },
      { id: 'meal-power', name: T('Meals power'), unit: 'Wh', group: T('Meals'), ...mealSum('energy_wh') },
      { id: 'calories', name: T('Calories consumed'), unit: 'kcal', group: T('Crew'), ...figure('calories') },
      { id: 'steps', name: T('Steps taken'), unit: T('steps'), group: T('Crew'), ...figure('steps') },
      { id: 'act-tasks', name: T('Tasks done'), unit: '', group: T('Activity'), ...tasksDone },
      { id: 'act-messages', name: T('Messages from Earth'), unit: '', group: T('Activity'), ...count('messages') },
      { id: 'act-exchanges', name: T('Exchanges published'), unit: '', group: T('Activity'), ...count('exchanges') },
      { id: 'act-entries', name: T('Crew log entries'), unit: '', group: T('Activity'), ...written },
      { id: 'act-media', name: T('Media sent out'), unit: '', group: T('Activity'), ...count('media') },
    ],
  };
  // Once Reset to 15 October has been pressed (or the floor is pinned), the
  // graph carries no plan: every day ahead is null and fills in as the crew
  // file it. Only a fresh build, before the reset, still shows the dashed
  // prepared lines — useful while the mission is being written.
  if (!fromBuild) for (const s of trendSpec.series) s.planned = {};

  // The day the power tile shows: today during the run, day 1's plan before it.
  const pwrDay = pre ? 1 : m.clampedDay;
  const pwrOf = power.days[String(pwrDay)] || {};
  const powerToday = power.categories.map((c) => ({ ...c, kwh: pwrOf[c.key] ?? null }));

  const habitat = dpanel({ id: 'habitat', code: 'CH-01', title: T('Habitat'), meta: T('Sensor node · measured live · figures and stores counted by the crew'), span: 12, cls: 'compact' }, `
    <!-- The Sensor-11 dashboard. The station server polls the external feed and
         stores every reading in its own database; /public/habitat.js draws these
         tiles from /api/habitat/data and refreshes on the node's cycle. -->
    <div class="hbt">
      <div class="bento" id="hbt-bento" hidden>
        <section class="tile t-co2">
          <h3>${T('Carbon dioxide')}</h3>
          <span class="sub" id="co2Sub"></span>
          <div class="dial-wrap">
            <div id="hbt-dial"></div>
            <div class="dial-center">
              <div class="big" id="co2Val">—<em>ppm</em></div>
              <div class="verdict" id="co2Verdict"></div>
            </div>
          </div>
        </section>
        <section class="tile t-temp">
          <h3>${T('Temperature')}</h3>
          <span class="sub">${T('Scale')} 0–40 °C</span>
          <div class="ruler-row">
            <div class="ruler-num">
              <div class="big" id="tempVal">—<em>°C</em></div>
              <div class="verdict" id="tempVerdict"></div>
            </div>
            <div class="ruler-wrap" id="hbt-ruler"></div>
          </div>
        </section>
        <section class="tile t-hum lvl">
          <h3>${T('Humidity')}</h3>
          <span class="sub">${T('Scale')} 0–100 %RH</span>
          <div class="big" id="humVal" style="margin-top:12px">—<em>%</em></div>
          <div id="hbt-level"></div>
        </section>
        <section class="tile t-light spk">
          <h3>${T('Light')}</h3>
          <span class="sub">${T('Scale')} 0–1000 raw</span>
          <div class="big" id="lightVal" style="margin-top:12px">—<em>raw</em></div>
          <div id="hbt-spark"></div>
        </section>
        ${figureTile(crewFigures, m, { key: 'calories', label: 'Calories consumed', unit: 'kcal', colour: 'var(--orange)', fmt: (v) => v.toLocaleString('en-GB'), T })}
        ${figureTile(crewFigures, m, { key: 'steps', label: 'Steps taken', unit: T('steps'), colour: 'var(--ink)', fmt: (v) => v.toLocaleString('en-GB'), T })}
      </div>
      <div class="bento aux">
        <section class="tile t-res">
          <h3>${T('Resources')}</h3>
          <span class="sub">${T('Carried in · never resupplied')}</span>
          ${inventoryGauges(inventory, { cells: true, T })}
        </section>
        <section class="tile t-pwr">
          <h3>${T('Power consumed')}</h3>
          <span class="sub">${pre ? T('Planned for day 01') : `${T('Today')} · SOL ${String(m.clampedDay).padStart(2, '0')}`} · ${T('counted by the crew')} · kWh</span>
          ${powerBars(powerToday, T)}
        </section>
      </div>
      <div id="hbt-notes"></div>
    </div>
    ${cloud ? `<div class="cloud-latest" id="cloud-latest" data-version="${esc(cloud.snapshot.version || '')}" data-poll="${(Number(cloud.snapshot.checkSeconds) || 20) * 1000}">${require('./media').cloudLatestInner(T, cloud)}</div>` : ''}`);

  /* ---- the habitat's own hardware, through Home Assistant: directly below
     the Habitat panel. Rendered only when the bridge is configured in .env;
     /public/hardware.js keeps it live from /api/hardware. */
  const hardwarePanel = hardware && hardware.configured && (hardware.sensors || []).length
    ? dpanel({ id: 'hardware', code: 'CH-02', title: T('Habitat hardware'),
        meta: `Home Assistant · ${hardware.sensors.length} ${T(hardware.sensors.length === 1 ? 'device' : 'devices')} · ${T('read by the station every')} ${hardware.pollMs >= 120000 ? `${Math.round(hardware.pollMs / 60000)} min` : `${Math.round(hardware.pollMs / 1000)} s`} · ${T('one point per hour')} · ${T('nothing leaves the venue')}`,
        span: 12, cls: 'compact' },
      `<div class="hbt hw"><div id="hw-live" data-poll="${hardware.pollMs}" data-version="${esc(require('../../lib/home-assistant').version(hardware))}">${hardwareInner(hardware, T)}</div></div>`)
    : '';

  /* ---- every trend as a chart: the habitat's channels, each store, the
     crew's counts. habitat.js draws them from the spec above plus its own
     Sensor-11 rows, and redraws when the period selector changes. */
  const trends = dpanel({ id: 'trends', code: 'CH-40', title: T('Trends'),
    span: 12 }, `
    <div class="trends" id="hbt-trends" data-date="${esc(m.today)}" data-day-start="${missionLib.venueMidnightUtc(m.today, m.timezone)}" data-axis-start="${esc(axis.start)}" data-axis-end="${esc(axis.end)}" data-axis-run="${axis.run ? '1' : '0'}" data-spec="${esc(JSON.stringify(trendSpec))}">
      <div id="hbt-tcharts"></div>
    </div>`);

  const galley = dpanel({ id: 'galley', code: 'CH-32', title: T('Meal'), meta: today && today.meals.length
      ? `${today.kcalPlanned} kcal · ${today.waterPlanned.toFixed(1)} L · ${today.energyPlanned} Wh` : '', span: 4, cls: 'h-3 scroll' },
    today && today.meals.length ? `<div class="meals">${today.meals.map((x) => `
      <div class="meal">
        <span class="meal-slot">${esc(T(slotName[x.slot] || x.slot))}</span>
        <b>${esc(x.name)}</b>
        <span class="meal-figs">${x.kcal} kcal · ${x.water_litres} L · ${x.energy_wh} Wh</span>
      </div>`).join('')}</div>` : `<div class="empty">${T('No meals filed for today')}</div>`);

  // Each officer with their current condition — the latest state filed from
  // mission control, translated to language in src/lib/mood.js. The slider
  // number itself is never published; only the word and the sentence.
  const crewPanel = dpanel({ id: 'crew', code: 'CH-12', title: T('Crew'),
      meta: T('Condition as reported · never as numbers'), span: 4, cls: 'h-3 scroll' },
    `<div class="officers">${crew.map((c) => {
      const t = moodLib.translate(c.mood);
      return `<div class="officer">
        <div class="officer-id">
          <b>${esc(c.designation)}</b>
          <span class="officer-role">${esc(c.role)}</span>
        </div>
        <span class="badge${c.mood ? ' ok' : ''}">${esc(T(t.condition))}</span>
        <div class="officer-note">${c.mood ? esc(T(t.lines[0])) : T('No state filed yet')}</div>
      </div>`;
    }).join('')}</div>`);

  const log = dpanel({ id: 'crewlog', code: 'CH-50', title: T('Crew log'), href: '/logbook',
    meta: `${entryCounts.published} ${T('of')} ${logDays.reduce((n, d) => n + d.entries.length, 0)} ${T('entries written')} · ${dayWord(T, m.totalDays)} · ${T('written from inside')}`, span: 12, cls: 'h-3 linked' },
    logDays.length ? `
      <div class="feed-filter log-filter" id="log-filter" role="group" aria-label="${esc(T('Filter the crew log'))}">
        <button type="button" class="chip active" data-crew="">${T('ALL')}</button>
        ${crew.map((c) => `<button type="button" class="chip" data-crew="${c.id}">${esc(c.designation.replace(' OFFICER', ''))}</button>`).join('')}
      </div>
      <div class="log-scroll" id="log-days">
      ${logDays.map((d) => `
        <div class="log-day" data-day="${d.missionDay}">
          <div class="log-day-head"><span class="cs">${T('Day')} ${String(d.missionDay).padStart(3, '0')}</span><span>${esc(shortDay(d.date))}</span>
            <span style="margin-left:auto">${d.written}/${d.entries.length} ${T('written')}</span></div>
          ${d.entries.map((e) => `<article class="card log-entry${e.placeholder ? ' placeholder' : ''}" id="e${e.id}" data-crew="${e.crew_id}">
            <div class="card-top"><span class="cs">${esc(e.designation)}</span><span class="card-day">${
              e.placeholder ? T('placeholder') : esc(e.role)}</span></div>
            ${e.placeholder ? `<div class="card-body">${esc(e.body)}</div>${
                e.media && e.media.length ? `<div class="card-body entry-post">${MV.entryHtml('', e.media, { lookup: mediaLookup, T })}</div>` : ''}`
              : `<div class="card-body entry-post">${MV.entryHtml(e.body, e.media || [], { lookup: mediaLookup, T })}</div>`}
          </article>`).join('')}
        </div>`).join('')}
      </div>
      <div class="empty" id="log-empty" style="display:none">${T('Nothing written by them yet')}</div>
      <div class="dpanel-more"><a class="btn" href="/logbook">${T('Open the full crew log — every entry, day by day')} →</a></div>`
    : `<div class="empty">${T('No entries have been filed yet')}</div>`);

  /* ---- media out of the habitat: the newest items, and the door to all of them */
  const mediaPanel = dpanel({ id: 'media', code: 'CH-60', title: T('Media'), href: '/media',
    meta: mediaCounts.total ? `${mediaCounts.total} ${T(mediaCounts.total === 1 ? 'item' : 'items')} · ${MV.fmtBytes(mediaCounts.bytes)} · ${T('originals, every one downloadable')}` : T('photographs, video and sound out of the habitat'), span: 12 },
    media.length ? `${MV.strip(media, mediaCounts.total > media.length ? { href: '/media', n: mediaCounts.total - media.length, label: T('See everything') } : null)}
      <div class="dpanel-more"><a class="btn" href="/media">${T('All media, day by day')} →</a><a class="btn" href="/media/export.zip">${T('Download everything')} · ZIP</a></div>`
    : `<div class="empty">${T('Nothing has been sent out of the habitat yet')}${pre ? ` — ${T('occupied from')} ${esc(m.startLabel)}` : ''}</div>`);

  const whole = dpanel({ id: 'whole', code: 'CH-30', title: T('The whole mission'),
    meta: `${esc(m.runLabel)} · ${dayWord(T, m.totalDays)}`, span: 12 },
    allDays.length ? `<div class="days-strip">${allDays.map((d) => {
      // Before the hatch closes every day is still ahead; after it opens,
      // every day is complete. Only during the run is one of them today.
      const state = pre || m.phase === 'COMPLETE' ? (pre ? 'ahead' : 'past')
        : d.missionDay < m.clampedDay ? 'past' : d.missionDay === m.clampedDay ? 'now' : 'ahead';
      return `<details class="dcard ${state}">
        <summary>
          <span class="dcard-n">D${String(d.missionDay).padStart(3, '0')}</span>
          <span class="dcard-date">${esc(shortDay(d.date))}</span>
          <span class="dcard-state">${T(state === 'now' ? 'Today' : state === 'past' ? 'Complete' : 'Planned')}</span>
          <span class="dcard-count">${d.tasks.length} ${T('tasks')}${d.meals.length ? ` · ${d.meals.length} ${T('meals')}` : ''}</span>
        </summary>
        <div class="dcard-body">
          ${d.tasks.map((t) => `<div class="dcard-task ${t.status === 'DONE' ? 'done' : ''}"><span>${esc(t.time)}</span>${esc(t.label)}</div>`).join('')}
          ${d.meals.length ? `<div class="dcard-meals">${d.meals.map((x) => esc(x.name)).join(' · ')}</div>` : ''}
          ${d.notes && d.notes.length ? `<div class="dcard-notes">${d.notes.map((n) => `
            <div class="dcard-note ${n.kind === 'ANOMALY' ? 'anomaly' : ''}"><span>${esc(fmtTime(n.posted_at).slice(0, 5))} · ${esc(n.kind)}</span><div class="entry-post">${MV.entryHtml(n.body, [], { lookup: mediaLookup, T })}</div></div>`).join('')}</div>` : ''}
        </div>
      </details>`;
    }).join('')}</div>` : `<div class="empty">${T('No schedule filed yet')}</div>`);

  return `
  <section class="dash" id="mission">
    <header class="dash-head">
      <div>
        <h2 class="bigsec">${T('Mission dashboard')}</h2>
        <p class="dash-sub">${esc(m.name)} · ${esc(m.runLabel)} · ${dayWord(T, m.totalDays)} · ${esc(m.timezone)}</p>
      </div>
      <div class="dash-clock">
        <span class="dash-clock-label">${T(pre ? 'Countdown' : 'Elapsed')}</span>
        <b>${esc(m.elapsed)}</b>
      </div>
    </header>
    <div class="dash-links">
      <a class="glance-link" href="/at-a-glance">
        <span class="glance-link-title">${T('At a Glance')}</span>
        <span class="glance-link-sub">${T('The whole mission, day by day — blogs, meals, consumption, habitat, crew condition and every exchange')}</span>
        <span class="glance-link-arrow">-&gt;</span>
      </a>
      <a class="glance-link media-link" href="/media">
        <span class="glance-link-title">${T('Media')}</span>
        <span class="glance-link-sub">${T('Photographs and video — the gallery, and everything the crew send out of the habitat')}</span>
        <span class="glance-link-arrow">-&gt;</span>
      </a>
    </div>
    <div class="kpis">${kpis}</div>
    ${strip}
    <div class="dash-grid">
      ${schedule}${galley}${crewPanel}
      ${habitat}${hardwarePanel}${trends}
    </div>
  </section>`;
}

/* ================================================================== BOARD */

/**
 * One exchange as a label card. Sized for a grid: the callsign is stamped like
 * a lot number, the message is the content, the reply sits beneath it in
 * orange, and the foot carries the reference data — mission day and the real
 * light-time it crossed.
 */
/** What became of a message, stamped on its card. */
function cardStatus(m) {
  if (m.state === 'PUBLISHED') {
    return m.response_body ? { label: 'REPLIED', cls: 'warn' } : { label: 'PUBLISHED', cls: 'ok' };
  }
  if (m.state === 'REJECTED') return { label: 'REJECTED', cls: 'bad' };
  if (m.state === 'TRANSMITTED' || m.state === 'IN_TRANSIT') return { label: 'IN TRANSIT', cls: 'earth' };
  return { label: 'REACHED MARS', cls: 'ok' };   // ARRIVED · PENDING_APPROVAL · APPROVED
}

/** `T` puts the card's chrome — the state stamp, "Sent", "replied", the
 *  tags — into the visitor's language. The archive passes nothing and gets
 *  English; what was written is never touched either way. */
function messageCard(m, tz, T = same) {
  const fresh = m.response_at && (Date.now() - Date.parse(m.response_at)) < 6 * 3600000;
  const tags = (m.tags || '').split(',').filter(Boolean);
  const st = cardStatus(m);
  const sent = whenLabel(m.submitted_at, tz), replied = m.response_body ? whenLabel(m.response_at, tz) : '';
  // A card that is both the viewer's and unpublished is stamped data-pending:
  // the stylesheet keeps it out of the common board and board.js reveals it
  // under MY MESSAGES. Such cards only ever reach their own sender's page.
  return `<article class="card ${fresh ? 'fresh' : ''}" id="m${m.id}"
      data-tags="${esc(tags.join(','))}"${m.mine ? ' data-mine="1"' : ''}${
      m.mine && m.pending ? ' data-pending="1"' : ''}>
    <div class="card-top">
      <span class="cs">${esc(m.callsign)}</span>
      ${fresh ? `<span class="badge new">${T('New')}</span>` : ''}
      <span class="badge card-state ${st.cls}">${T(st.label)}</span>
      <span class="card-day">D${String(m.mission_day).padStart(3, '0')}</span>
    </div>
    <div class="card-sent">
      <span>${T('Sent')} ${esc(m.submitted_at.slice(8, 10))}.${esc(m.submitted_at.slice(5, 7))}.${esc(m.submitted_at.slice(0, 4))}</span>
      <span>${esc(m.submitted_at.slice(11, 16))} UTC</span>
    </div>
    <div class="card-when"><time datetime="${esc(m.submitted_at)}">${esc(sent)}</time>${
      replied ? ` <span class="card-when-sep">·</span> <span class="card-when-reply">${T('replied')} <time datetime="${esc(m.response_at)}">${esc(replied)}</time></span>` : ''}</div>
    <div class="card-body">${esc(m.body)}</div>
    ${tags.length ? `<div class="tagrow">${tags.map((t) => `<span>${esc(T(t))}</span>`).join('')}</div>` : ''}
    ${m.response_body ? `<div class="card-reply">
      <div class="who">${esc(m.responder || T('Mars habitat'))}</div>
      <p>${esc(m.response_body)}</p>
    </div>` : ''}
    <div class="card-foot">
      <span>${orbital.formatLightTime(m.light_seconds)}</span>
      <span>${m.distance_au.toFixed(2)} au</span>
      <span style="margin-left:auto">Ref ${String(m.id).padStart(5, '0')}</span>
    </div>
  </article>`;
}

/**
 * The cards of the landing-page board, as one fragment. Rendered into the
 * page on load and again by /api/board for the live refresh, so the two
 * cannot drift apart: one function defines what the board holds.
 */
function boardCards(recent, T = same) {
  const tz = (missionLib.config() || {}).timezone || 'Europe/Berlin';
  // The viewer's own messages first, under their own heading — whatever
  // state they are in — then everyone's published exchanges. Without any
  // of the viewer's own there are no headings, just the board.
  const mine = recent.filter((m) => m.mine), rest = recent.filter((m) => !m.mine);
  if (!mine.length) return rest.map((m) => messageCard(m, tz, T)).join('');
  return `<div class="board-group" data-group="mine">${T('My messages')} <span class="board-group-n">${mine.length}</span></div>`
    + mine.map((m) => messageCard(m, tz, T)).join('')
    + `<div class="board-group" data-group="all">${T('All messages')}</div>`
    + rest.map((m) => messageCard(m, tz, T)).join('');
}

/**
 * A stamp that changes whenever the board would render differently: a new
 * message, a change of state, a reply published, or a "New" badge lapsing.
 * The page carries it and /api/board reports it, so the browser only swaps
 * the cards when there is actually something new.
 */
function boardVersion(recent) {
  const key = recent.map((m) =>
    `${m.id}:${m.state}:${m.response_at || ''}:${m.mine ? 1 : 0}:${
      m.response_at && Date.now() - Date.parse(m.response_at) < 6 * 3600000 ? 'new' : ''}`
  ).join('|');
  return require('crypto').createHash('sha1').update(key).digest('hex').slice(0, 16);
}

/* ================================================================= ARCHIVE */

function archive(ctx, { messages, filters, stats }) {
  const body = `
  <div style="padding:30px 0 18px">
    <div class="eyebrow">Channel group 21 · Permanent record</div>
    <h1>Archive</h1>
    <p class="lede">The archive is not a log of the work — it is part of it. It shows what people
    on Earth wanted to know, what they assumed Mars would be, and how the questions changed as
    the mission went on.</p>
  </div>

  ${panel('CH-21 / DISTRIBUTION', `
    ${eyebrow('What people asked about')}
    ${stats.tags.length ? stats.tags.map((t) => `
      <div style="display:flex;align-items:center;gap:12px;margin-bottom:7px">
        <span style="font-family:var(--mono);font-size:10px;letter-spacing:.16em;color:var(--dim);width:110px">${esc(t.tag)}</span>
        <div class="bar" style="flex:1"><i style="width:${(t.n / stats.max * 100).toFixed(0)}%"></i></div>
        <span style="font-family:var(--mono);font-size:11px;color:var(--dim);width:34px;text-align:right">${t.n}</span>
      </div>`).join('') : '<div class="empty">NO DATA YET</div>'}`, 'earth-side')}

  <form method="get" action="/archive" class="panel">
    <span class="chan">CH-21 / FILTER</span>
    <div class="grid g4">
      <label class="f"><span>Tag</span>
        <select name="tag"><option value="">Any</option>
        ${TAGS.map((t) => `<option${filters.tag === t ? ' selected' : ''}>${t}</option>`).join('')}
        </select></label>
      <label class="f"><span>Mission day</span>
        <input type="number" name="day" min="1" value="${esc(filters.day || '')}"></label>
      <label class="f"><span>Callsign</span>
        <input type="text" name="callsign" value="${esc(filters.callsign || '')}" placeholder="DUST-417"></label>
      <label class="f"><span>&nbsp;</span><button type="submit">Filter archive</button></label>
    </div>
  </form>

  ${messages.length ? `<div class="cards">${messages.map((m) => messageCard(m)).join('')}</div>`
    : '<div class="empty">No exchanges match these filters</div>'}`;
  return L.page({ title: 'Archive', ctx, body, current: '/archive' });
}

function single(ctx, { message }) {
  const body = `
  <div style="padding:30px 0 18px">
    <div class="eyebrow">Exchange ${String(message.id).padStart(5, '0')}</div>
    <h1>${esc(message.callsign)} → Mars habitat</h1>
  </div>
  ${messageCard(message)}
  ${pipeline('PUBLISHED')}
  <p style="margin-top:22px"><a href="/archive">← Back to the archive</a></p>`;
  return L.page({ title: `Exchange ${message.id}`, ctx, body, current: '/archive' });
}

module.exports = {
  mission, complete, inventoryGauges, boardCards, boardVersion, archive, single, messageCard,
  hardwareInner,
};
