'use strict';
const L = require('../layout');
const { esc, panel, eyebrow, orbitPlot, pipeline } = L;
const mood = require('../../lib/mood');
const orbital = require('../../lib/orbital');
const { TAGS } = require('../../lib/data');
const { composerBlock, tagPills } = require('./communicate');
const { entryCard } = require('./logbook');
const { aboutReader } = require('./info');

const fmtTime = (iso) => new Date(iso).toISOString().slice(11, 16) + ' UTC';

/* ============================================================== COMPLETE */

/** After the last day. The archive stays; nothing else pretends to be live. */
function complete(ctx, { counts, recent }) {
  const m = ctx.mission;
  const body = `
  <div style="padding:34px 0 26px">
    <div class="eyebrow">Mars Communication Station · mission complete</div>
    <h1>The habitat is empty.<br>What was said is still here.</h1>
    <p class="lede">The crew went in on ${esc(m.start_date)} and came out on ${esc(m.end_date)}.
    Over ${m.totalDays} days, ${counts.published} exchanges crossed the distance between an
    audience on Earth and three people who could not be reached any other way.</p>
    <p><a class="btn" href="/archive">Read the archive</a><a class="btn" href="/#about">About the project</a></p>
  </div>

  <div class="grid g-hero">
    ${orbitPlot(ctx.geo)}
    ${panel('CH-21 / RECORD', `
      ${eyebrow('What the station carried')}
      <dl class="kv">
        <dt>MISSION</dt><dd>${esc(m.name)}</dd>
        <dt>DURATION</dt><dd>${m.totalDays} days</dd>
        <dt>EXCHANGES</dt><dd>${counts.published} published</dd>
        <dt>MESSAGES SENT</dt><dd>${counts.total}</dd>
        <dt>CALLSIGNS ISSUED</dt><dd>${counts.visitors}</dd>
      </dl>
      <p class="note" style="margin-top:16px">The communication channel is closed. The archive
      is not — it stays readable, and it stays part of the work.</p>`, 'earth-side')}
  </div>

  ${panel('CH-20 / LAST EXCHANGES', recent.length
    ? recent.slice(0, 3).map(messageCard).join('') + '<p style="margin:6px 0 0"><a href="/archive">Full archive →</a></p>'
    : '<div class="empty">NOTHING WAS PUBLISHED DURING THIS MISSION</div>')}`;

  return L.page({ title: 'Mission complete', ctx, body, current: '/' });
}

/**
 * Resources as a row of gauges. The bar is what is left against what they
 * started with, so the whole nine days is legible in one glance: a habitat
 * running down. Anything below its warning threshold turns orange, and the
 * figure under each bar is days remaining at the current draw — the number
 * that actually decides things inside a closed volume.
 */
function inventoryGauges(inventory, { compact = false, strip = false, cells = false } = {}) {
  if (!inventory || !inventory.length) {
    return '<div class="empty">No inventory filed for today</div>';
  }
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
      return `<div class="gauge round ${low ? 'low' : ''}" title="${esc(i.label)}: ${i.quantity} ${esc(i.unit)} of ${start} · ${
        daysLeft != null ? (daysLeft < 99 ? daysLeft.toFixed(1) + ' days left' : 'ample') : 'no draw'}">
        <svg viewBox="0 0 60 60" aria-hidden="true">
          <circle cx="30" cy="30" r="${R}" class="round-track"/>
          <circle cx="30" cy="30" r="${R}" class="round-arc" stroke-dasharray="${C.toFixed(1)}"
            stroke-dashoffset="${(C * (1 - pct / 100)).toFixed(1)}" transform="rotate(-90 30 30)"/>
          <text x="30" y="32" class="round-num">${num}</text>
          <text x="30" y="41" class="round-unit">${esc(i.unit)}</text>
        </svg>
        <span class="cell-name">${esc(i.label)}</span>
        <span class="cell-days">${daysLeft != null ? (daysLeft < 99 ? `${daysLeft.toFixed(0)} days` : 'ample') : 'no draw'}</span>
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
        <span>${pct.toFixed(0)}% of ${start} ${esc(i.unit)}</span>
        <span>${daysLeft != null
          ? (daysLeft < 99 ? `${daysLeft.toFixed(1)} days left` : 'ample')
          : 'no draw'}</span>
      </div>
    </div>`;
  }).join('')}</div>`;
}

/**
 * Calories consumed and steps taken, plotted across the whole mission. Drawn
 * as a real graph — gridlines, a value axis, a day axis and a plotted line
 * with a point per day — because the question these two figures answer is what
 * the shape did over nine days, and a shape needs a graph.
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
  const now = ctx.mission.clampedDay;
  return days.map((d) => {
    const state = d.missionDay < now ? 'past' : d.missionDay === now ? 'now' : 'ahead';
    const badge = state === 'now' ? '<span class="badge warn">Today</span>'
      : state === 'past' ? '<span class="badge">Complete</span>' : '<span class="badge earth">Planned</span>';
    return `<details class="mday ${state}"${state === 'now' && openToday ? ' open' : ''}>
      <summary><span class="cs">D${String(d.missionDay).padStart(3, '0')}</span>
        <span>${esc(d.date)}</span>${badge}
        <span class="mday-n">${d.tasks.length} tasks${d.meals.length ? ` · ${d.meals.length} meals` : ''}</span></summary>
      ${d.tasks.length ? `<div class="rows">${d.tasks.map((t) => `
        <div class="row ${t.status === 'DONE' ? 'done' : ''}">
          <div class="t">${esc(t.time)}</div>
          <div class="m"><b>${esc(t.label)}</b>${t.detail ? `<span>${esc(t.detail)}</span>` : ''}</div>
        </div>`).join('')}</div>`
        : '<div class="empty">No schedule filed for this day</div>'}
      ${d.meals.length ? `<div class="note" style="margin-top:10px">
        ${d.meals.map((m) => `<b style="color:var(--ink)">${esc(m.slot[0] + m.slot.slice(1).toLowerCase())}</b> ${esc(m.name)}`).join(' · ')}
      </div>` : ''}
      ${d.notes && d.notes.length ? `<div class="rows mday-notes">
        <div class="eyebrow" style="margin:12px 0 6px">Mission notes</div>
        ${d.notes.map((n) => `<div class="row">
          <div class="t">${esc(fmtTime(n.posted_at).slice(0, 5))}</div>
          <div class="m"><b>${esc(n.body)}</b></div>
          <span class="badge ${n.kind === 'ANOMALY' ? 'warn' : ''}">${esc(n.kind)}</span></div>`).join('')}
      </div>` : ''}
    </details>`;
  }).join('');
}

function mission(ctx, { sensors, crew, today, counts, recent, latestEntries = [], crewFigures = {},
                        inFlight = null, error = null, draft = '',
                        allDays = [], logDays = [], entryCounts = { published: 0, days: 0 } }) {
  const pre = ctx.mission.phase === 'PRE_LAUNCH';
  const slotName = { BREAKFAST: 'Breakfast', LUNCH: 'Lunch', DINNER: 'Dinner', RATION: 'Ration' };
  // This visitor's messages that mission control has not yet published. They
  // are in the page, but only surface under MY MESSAGES.
  const pendingMine = recent.filter((m) => m.mine && m.pending).length;
  // Once you have sent something, the board opens on your own messages, so
  // the one you just transmitted is the first thing you see.
  const openOnMine = recent.some((m) => m.mine);

  /* The masthead: the wordmark, one line under it, and the station's
     readings as a row of small pills on the right. */
  const hero = '';
  const masthead = `
  <header class="masthead">
    <h1 class="sr-only">Marsplatz — Communication Station · ZKM | Hertzlab</h1>
    ${L.statusStrip(ctx)}
  </header>`;

  const body = `
  <div style="padding:34px 0 26px">
    <div class="eyebrow">Mars Communication Station · mission complete</div>
    <h1>The habitat is empty.<br>What was said is still here.</h1>
    <p class="lede">The crew went in on ${esc(m.start_date)} and came out on ${esc(m.end_date)}.
    Over ${m.totalDays} days, ${counts.published} exchanges crossed the distance between an
    audience on Earth and three people who could not be reached any other way.</p>
    <p><a class="btn" href="/archive">Read the archive</a><a class="btn" href="/#about">About the project</a></p>
  </div>

  <div class="grid g-hero">
    ${orbitPlot(ctx.geo)}
    ${panel('CH-21 / RECORD', `
      ${eyebrow('What the station carried')}
      <dl class="kv">
        <dt>MISSION</dt><dd>${esc(m.name)}</dd>
        <dt>DURATION</dt><dd>${m.totalDays} days</dd>
        <dt>EXCHANGES</dt><dd>${counts.published} published</dd>
        <dt>MESSAGES SENT</dt><dd>${counts.total}</dd>
        <dt>CALLSIGNS ISSUED</dt><dd>${counts.visitors}</dd>
      </dl>
      <p class="note" style="margin-top:16px">The communication channel is closed. The archive
      is not — it stays readable, and it stays part of the work.</p>`, 'earth-side')}
  </div>

  ${panel('CH-20 / LAST EXCHANGES', recent.length
    ? recent.slice(0, 3).map(messageCard).join('') + '<p style="margin:6px 0 0"><a href="/archive">Full archive →</a></p>'
    : '<div class="empty">NOTHING WAS PUBLISHED DURING THIS MISSION</div>')}`;

  return L.page({ title: 'Mission complete', ctx, body, current: '/' });
}

/**
 * Resources as a row of gauges. The bar is what is left against what they
 * started with, so the whole nine days is legible in one glance: a habitat
 * running down. Anything below its warning threshold turns orange, and the
 * figure under each bar is days remaining at the current draw — the number
 * that actually decides things inside a closed volume.
 */
function inventoryGauges(inventory, { compact = false, strip = false, cells = false } = {}) {
  if (!inventory || !inventory.length) {
    return '<div class="empty">No inventory filed for today</div>';
  }
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
      return `<div class="gauge round ${low ? 'low' : ''}" title="${esc(i.label)}: ${i.quantity} ${esc(i.unit)} of ${start} · ${
        daysLeft != null ? (daysLeft < 99 ? daysLeft.toFixed(1) + ' days left' : 'ample') : 'no draw'}">
        <svg viewBox="0 0 60 60" aria-hidden="true">
          <circle cx="30" cy="30" r="${R}" class="round-track"/>
          <circle cx="30" cy="30" r="${R}" class="round-arc" stroke-dasharray="${C.toFixed(1)}"
            stroke-dashoffset="${(C * (1 - pct / 100)).toFixed(1)}" transform="rotate(-90 30 30)"/>
          <text x="30" y="32" class="round-num">${num}</text>
          <text x="30" y="41" class="round-unit">${esc(i.unit)}</text>
        </svg>
        <span class="cell-name">${esc(i.label)}</span>
        <span class="cell-days">${daysLeft != null ? (daysLeft < 99 ? `${daysLeft.toFixed(0)} days` : 'ample') : 'no draw'}</span>
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
        <span>${pct.toFixed(0)}% of ${start} ${esc(i.unit)}</span>
        <span>${daysLeft != null
          ? (daysLeft < 99 ? `${daysLeft.toFixed(1)} days left` : 'ample')
          : 'no draw'}</span>
      </div>
    </div>`;
  }).join('')}</div>`;
}

/**
 * Calories consumed and steps taken, plotted across the whole mission. Drawn
 * as a real graph — gridlines, a value axis, a day axis and a plotted line
 * with a point per day — because the question these two figures answer is what
 * the shape did over nine days, and a shape needs a graph.
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
  const now = ctx.mission.clampedDay;
  return days.map((d) => {
    const state = d.missionDay < now ? 'past' : d.missionDay === now ? 'now' : 'ahead';
    const badge = state === 'now' ? '<span class="badge warn">Today</span>'
      : state === 'past' ? '<span class="badge">Complete</span>' : '<span class="badge earth">Planned</span>';
    return `<details class="mday ${state}"${state === 'now' && openToday ? ' open' : ''}>
      <summary><span class="cs">D${String(d.missionDay).padStart(3, '0')}</span>
        <span>${esc(d.date)}</span>${badge}
        <span class="mday-n">${d.tasks.length} tasks${d.meals.length ? ` · ${d.meals.length} meals` : ''}</span></summary>
      ${d.tasks.length ? `<div class="rows">${d.tasks.map((t) => `
        <div class="row ${t.status === 'DONE' ? 'done' : ''}">
          <div class="t">${esc(t.time)}</div>
          <div class="m"><b>${esc(t.label)}</b>${t.detail ? `<span>${esc(t.detail)}</span>` : ''}</div>
        </div>`).join('')}</div>`
        : '<div class="empty">No schedule filed for this day</div>'}
      ${d.meals.length ? `<div class="note" style="margin-top:10px">
        ${d.meals.map((m) => `<b style="color:var(--ink)">${esc(m.slot[0] + m.slot.slice(1).toLowerCase())}</b> ${esc(m.name)}`).join(' · ')}
      </div>` : ''}
      ${d.notes && d.notes.length ? `<div class="rows mday-notes">
        <div class="eyebrow" style="margin:12px 0 6px">Mission notes</div>
        ${d.notes.map((n) => `<div class="row">
          <div class="t">${esc(fmtTime(n.posted_at).slice(0, 5))}</div>
          <div class="m"><b>${esc(n.body)}</b></div>
          <span class="badge ${n.kind === 'ANOMALY' ? 'warn' : ''}">${esc(n.kind)}</span></div>`).join('')}
      </div>` : ''}
    </details>`;
  }).join('');
}

function mission(ctx, { sensors, crew, today, counts, recent, latestEntries = [], crewFigures = {},
                        inFlight = null, error = null, draft = '',
                        allDays = [], logDays = [], entryCounts = { published: 0, days: 0 } }) {
  const pre = ctx.mission.phase === 'PRE_LAUNCH';
  const slotName = { BREAKFAST: 'Breakfast', LUNCH: 'Lunch', DINNER: 'Dinner', RATION: 'Ration' };
  // This visitor's messages that mission control has not yet published. They
  // are in the page, but only surface under MY MESSAGES.
  const pendingMine = recent.filter((m) => m.mine && m.pending).length;
  // Once you have sent something, the board opens on your own messages, so
  // the one you just transmitted is the first thing you see.
  const openOnMine = recent.some((m) => m.mine);

  /* The masthead: the wordmark, one line under it, and the station's
     readings as a row of small pills on the right. */
  const hero = '';
  const masthead = `
  <header class="masthead">
    <h1 class="sr-only">Marsplatz — Communication Station · ZKM | Hertzlab</h1>
    ${L.statusStrip(ctx)}
  </header>`;

  /* The nine days of the run, spelled down the right-hand margin. */
  const dayRail = `<aside class="day-rail" aria-hidden="true">
    ${Array.from({ length: ctx.mission.totalDays }, (_, i) => {
      const n = i + 1, now = ctx.mission.clampedDay;
      const cls = pre ? '' : n === now ? 'now' : n < now ? 'past' : '';
      return `${i ? `<i class="${!pre && n <= now ? 'past' : ''}"></i>` : ''}<span class="${cls}">${String(n).padStart(2, '0')}</span>`;
    }).join('')}
    <span class="day-rail-cap">${pre ? 'Days' : 'Mission day'}</span>
  </aside>`;

  const body = `
  <div class="band-dark">
  ${masthead}
  <!-- The console. Black, with the orange name plate down its left; the
       project in a few words across the top with the tags beside it; the
       message box — your thread with the crew and the line you type on —
       in the middle; the ZKM mark and the Earth→Mars scene beneath it; and
       the messages panel standing in the right edge. -->
  <div class="console" id="write">
    <aside class="rail-left">
      <div class="plate" aria-hidden="true"><span class="plate-word">Marsplatz</span></div>
    </aside>

    <div class="console-main">
      <header class="console-head">
        <div class="console-copy">
          <p class="headline">Three people in a sealed habitat.<br>Nine days.<br>This is the only way to reach them.</p>
          <p class="subline">Everything you send arrives late — ${orbital.formatLightTime(ctx.geo.lightSeconds)} late, today. The crew read it, and write back.</p>
          <nav class="rail-nav" aria-label="About the project">
            <a href="#about-project" data-reader="about-project">About</a>
            <a href="#what" data-reader="what">What this is</a>
            <a href="#who-we-are" data-reader="who-we-are">Who we are</a>
          </nav>
        </div>
        <div class="console-tags">
          <span class="tags-lbl">Tag your message · up to three</span>
          ${tagPills()}
        </div>
      </header>
      <div class="statline">
        <span class="bolt">⚡</span> ONE WAY <b>${orbital.formatLightTime(ctx.geo.lightSeconds)}</b>
        <span class="sep">·</span> EARTH–MARS <b>${ctx.geo.distanceAu.toFixed(3)} au</b>
        <span class="sep">·</span> <span class="dot ${ctx.commsUp ? 'ok' : 'warn'}"></span> ${ctx.commsUp ? 'LINK NOMINAL' : 'LINK DEGRADED'}
      </div>

      <section class="mbox composer-device${inFlight ? ' sending' : ''}" aria-label="Composer">
        <h2 class="sr-only">Communication Portal</h2>
        <div class="operator">
          <span class="avatar you" style="--h:${[...ctx.callsign].reduce((a, c) => (a * 31 + c.charCodeAt(0)) % 360, 7)}">${esc(ctx.callsign[0])}<i class="online"></i></span>
          <span class="operator-cs">@${esc(ctx.callsign)}</span>
        </div>
        <div class="thread" id="thread">
          ${(() => {
            const mine = recent.filter((x) => x.mine).slice(0, 4).reverse();
            if (!mine.length) return `<div class="thread-empty">Nothing sent yet. Your messages to the crew, and their replies, collect here.</div>`;
            return mine.map((x) => `
              <div class="bubble you" id="t${x.id}">
                <p>${esc(x.body)}</p>
                <span class="bubble-time">${esc(x.submitted_at.slice(8, 10))}.${esc(x.submitted_at.slice(5, 7))}.${esc(x.submitted_at.slice(0, 4))} · ${esc(x.submitted_at.slice(11, 16))}${
                  x.response_body ? '' : ` · <em>${cardStatus(x).label.toLowerCase()}</em>`}</span>
              </div>
              ${x.response_body ? `<div class="bubble crew">
                <p>${esc(x.response_body)}</p>
                <span class="bubble-time">${esc((x.responder || 'Mars habitat'))}${x.response_at ? ` · ${esc(x.response_at.slice(11, 16))}` : ''}</span>
              </div>` : ''}`).join('');
          })()}
        </div>
        <div class="dev-body" id="dev-body">${composerBlock(ctx, { inFlight, error, draft })}</div>
        ${aboutReader(ctx, { crew })}
      </section>

      <div class="console-cards">
        <div class="ccard zkm" aria-label="ZKM | Hertzlab">
          <svg viewBox="0 0 100 100" aria-hidden="true" class="zkm-mark">
            ${[44, 38, 32, 26, 20, 14, 8].map((r, i) => `<circle cx="50" cy="50" r="${r}" fill="none" stroke="#fff" stroke-width="${i % 2 ? 1 : 1.6}" opacity="${0.9 - i * 0.08}"/>`).join('')}
            <path d="M32 50 L48 38 L52 62 L68 50" fill="none" stroke="#fff" stroke-width="3" stroke-linejoin="round"/>
          </svg>
          <span class="zkm-word">ZKM</span>
          <span class="zkm-sub">Hertzlab</span>
        </div>
        <div class="ccard scene" aria-label="The crossing from Earth to Mars">
          <svg viewBox="0 0 640 150" class="scene-svg" aria-hidden="true">
            <defs>
              <radialGradient id="earthG" cx="35%" cy="35%" r="70%"><stop offset="0" stop-color="#9fd0ff"/><stop offset=".6" stop-color="#2c73b8"/><stop offset="1" stop-color="#0c2a4d"/></radialGradient>
              <radialGradient id="marsG" cx="35%" cy="35%" r="70%"><stop offset="0" stop-color="#ffb07a"/><stop offset=".55" stop-color="#e0562a"/><stop offset="1" stop-color="#5a1a0a"/></radialGradient>
              <linearGradient id="beamG" x1="0" x2="1" y1="0" y2="0"><stop offset="0" stop-color="#fff" stop-opacity=".0"/><stop offset=".5" stop-color="#fff" stop-opacity=".35"/><stop offset="1" stop-color="#fff" stop-opacity=".0"/></linearGradient>
            </defs>
            <rect x="0" y="70" width="640" height="10" fill="url(#beamG)"/>
            <path id="xroute" d="M96,75 L544,75" class="scene-route"/>
            <path id="xtrail" d="M96,75 L544,75" class="scene-trail" stroke-dasharray="0 1000"/>
            <circle cx="60" cy="75" r="30" fill="url(#earthG)"/>
            <circle cx="580" cy="75" r="46" fill="url(#marsG)"/>
            <circle cx="320" cy="75" r="22" class="scene-ring"/>
            <circle cx="320" cy="75" r="22" class="scene-ring-arc" id="xring" stroke-dasharray="138.2" stroke-dashoffset="138.2"/>
            <circle id="xpacket" cx="96" cy="75" r="5" class="scene-packet"/>
          </svg>
          <span class="scene-word" id="xword">${inFlight ? 'Sending message to Mars…' : `Earth → Mars · ${orbital.formatLightTime(ctx.geo.lightSeconds)} one way`}</span>
        </div>
      </div>
    </div>

    <section class="board-panel" id="exchanges">
      <h2 class="sr-only">Message Board</h2>
      <!-- The board is live: board.js polls /api/board and swaps the cards in
           place, so a reply published from mission control, or another
           visitor's exchange, appears without anyone reloading. -->
      <div class="feed-wrap"><div class="feed-scroll" id="feed" data-poll="/api/board"
          data-version="${boardVersion(recent)}">
        <div class="board">
          <div class="board-head">
            <span class="board-title" id="board-title">${openOnMine ? 'My messages' : 'All messages'}</span>
            <span class="live" id="feed-live" title="The board refreshes itself every few seconds">LIVE</span>
          </div>
          <div class="scroller feed"><div class="cards" id="feed-cards">${boardCards(recent)}
            <div class="empty" id="feed-empty"${recent.length ? ' style="display:none"' : ''}
              data-none="Nothing transmitted yet — the first message could be yours"
              data-filtered="No messages match this filter">${
              recent.length ? 'No messages match this filter' : 'Nothing transmitted yet — the first message could be yours'}</div>
          </div></div>
          <div class="feed-filter" id="feed-filter" role="group" aria-label="Filter the board"${
          recent.length ? '' : ' hidden'}>
          <button type="button" class="chip${openOnMine ? '' : ' active'}" data-filter="">ALL</button>
          <button type="button" class="chip mine${openOnMine ? ' active' : ''}" data-filter="mine">MINE <span
            class="chip-count" id="feed-mine-count"${pendingMine ? '' : ' hidden'}>${pendingMine}</span></button>
          ${TAGS.map((t) => `<button type="button" class="chip" data-filter="tag:${t}">${t}</button>`).join('')}
          </div>
          <p class="feed-foot"${recent.length ? '' : ' hidden'}>
            <span id="feed-counter">${counts.published} exchanges · ${counts.total} sent</span>
            <span>Scroll ↓</span></p>
        </div>
      </div></div>
    </section>
  </div>
  </div>

  ${dashboard(ctx, { crew, today, counts, crewFigures, allDays, logDays, entryCounts })}
  `;
  return L.page({
    title: 'Mission', ctx, body, hero, hideNav: true, hideRail: true, bodyClass: 'landing',
    current: '/', scripts: ['/composer.js', '/board.js', '/habitat.js'],
  });
}



/**
 * A crew figure as a small tile: today's value, the mission average, and the
 * nine days as a sparkline. Lives inside the habitat bento beside the sensor
 * tiles rather than as a chart of its own.
 */
function figureTile(figures, mission, { key, label, unit, colour, fmt }) {
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
          <title>Day ${String(days[i]).padStart(3, '0')}: ${v.toLocaleString('en-GB')} ${unit}</title></circle>`).join('')}
  </svg>` : '';
  const shown = today ?? latest;
  return `<section class="tile t-fig t-${key}" role="img" aria-label="${label}: ${shown != null ? fmt(shown) + ' ' + unit : 'nothing recorded'} today">
    <h3>${label}</h3>
    <span class="sub">${today != null ? `Day ${String(mission.clampedDay).padStart(3, '0')}` : latest != null ? 'Last recorded' : 'Counted by the crew'}</span>
    <div class="fig-row">
      <div class="big">${shown != null ? fmt(shown) : '—'}<em>${esc(unit)}</em></div>
      ${spark}
    </div>
    <div class="verdict">${mean != null ? `${fmt(mean)} ${esc(unit)} a day on average · ${present.length} of ${days.length} days` : 'Nothing recorded yet'}</div>
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

/* =============================================================== DASHBOARD */

/** One stat tile of the KPI row. */
const kpi = ({ label, value, unit, sub, state }) => `
  <div class="kpi${state ? ` ${state}` : ''}">
    <div class="kpi-label">${esc(label)}</div>
    <div class="kpi-value">${value}${unit ? `<em>${esc(unit)}</em>` : ''}</div>
    <div class="kpi-sub">${sub}</div>
  </div>`;

/** A dashboard panel: code, title and meta in the head, the content beneath. */
const dpanel = ({ id, code, title, meta = '', span = 4, cls = '' }, inner) => `
  <section class="dpanel span-${span} ${cls}"${id ? ` id="${id}"` : ''}>
    <header class="dpanel-head">
      <div class="dpanel-title"><span class="dpanel-code">${esc(code)}</span><h3>${esc(title)}</h3></div>
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
function dashboard(ctx, { crew, today, counts, crewFigures, allDays, logDays, entryCounts }) {
  const m = ctx.mission, g = ctx.geo;
  const pre = m.phase === 'PRE_LAUNCH';
  const slotName = { BREAKFAST: 'Breakfast', LUNCH: 'Lunch', DINNER: 'Dinner', RATION: 'Ration' };
  const day3 = String(m.clampedDay).padStart(3, '0');
  const inventory = today ? today.inventory : [];

  /* ---- headline figures */
  const moods = crew.map((c) => mood.translate(c.mood));
  const strained = moods.filter((t) => t.load > 65).length;
  const drawn = inventory.filter((i) => i.consumption > 0)
    .map((i) => ({ ...i, daysLeft: i.quantity / i.consumption }))
    .sort((a, b) => a.daysLeft - b.daysLeft);
  const lowest = drawn[0];
  const tasks = today ? today.tasks : [];
  const done = tasks.filter((t) => t.status === 'DONE').length;

  const kpis = [
    kpi({ label: 'Mission day', value: pre ? `T−${m.countdown.days}` : String(m.clampedDay).padStart(2, '0'),
          unit: pre ? 'days' : `/ ${String(m.totalDays).padStart(2, '0')}`,
          sub: pre ? `Opens ${esc(m.start_date)}` : `${m.totalDays - m.clampedDay} day${m.totalDays - m.clampedDay === 1 ? '' : 's'} remaining` }),
    kpi({ label: 'One-way signal', value: orbital.formatLightTime(g.lightSeconds),
          sub: `${g.distanceAu.toFixed(3)} au · ${esc(g.trend.toLowerCase())}` }),
    kpi({ label: 'Exchanges', value: String(counts.published), sub: `${counts.total} sent · ${counts.total - counts.published} in hand` }),
    kpi({ label: 'Uplink', value: ctx.commsUp ? 'Nominal' : 'Degraded', state: ctx.commsUp ? 'ok' : 'warn',
          sub: `<span class="dot ${ctx.commsUp ? 'ok' : 'warn'}"></span> CH-09 · ${ctx.commsUp ? 'holding' : 'unreachable'}` }),
    kpi({ label: 'Crew', value: String(crew.length),
          sub: strained ? `${strained} under strain` : 'all nominal', state: strained ? 'warn' : '' }),
    kpi({ label: 'Tightest reserve', value: lowest ? (lowest.daysLeft < 99 ? lowest.daysLeft.toFixed(1) : '99+') : '—',
          unit: lowest ? 'days' : '', sub: lowest ? esc(lowest.label) : 'no draw recorded',
          state: lowest && lowest.warn_below > 0 && lowest.quantity <= lowest.warn_below ? 'warn' : '' }),
  ].join('');

  /* ---- the run as a strip */
  const strip = `<div class="run-strip" aria-label="The nine days of the run">${
    Array.from({ length: m.totalDays }, (_, i) => {
      const n = i + 1;
      const cls = pre ? '' : n < m.clampedDay ? 'past' : n === m.clampedDay ? 'now' : '';
      const d = allDays.find((x) => x.missionDay === n);
      return `<div class="${cls}"><span class="run-n">${String(n).padStart(2, '0')}</span><i></i>
        <span class="run-d">${d ? esc(d.date.slice(5)) : ''}</span></div>`;
    }).join('')}</div>`;

  /* ---- panels */
  const schedule = dpanel({ id: 'schedule', code: 'CH-30', title: 'Today’s Schedule',
    meta: `Day ${day3} · ${done}/${tasks.length} done`, span: 4, cls: 'h-3 scroll' },
    tasks.length ? `<div class="rows">${tasks.map((t) => `
      <div class="row ${t.status === 'DONE' ? 'done' : ''} ${t.status === 'ACTIVE' ? 'active' : ''}">
        <div class="t">${esc(t.time)}</div>
        <div class="m"><b>${esc(t.label)}</b>${t.detail ? `<span>${esc(t.detail)}</span>` : ''}</div>
      </div>`).join('')}</div>` : '<div class="empty">No schedule filed for today</div>');

  /* ---- the trend charts: what habitat.js draws, as data. Stores are given
     as a share of what was carried in, so several can share one axis;
     everything else keeps its own unit and its own chart. */
  const dayN = Array.from({ length: m.totalDays }, (_, i) => i + 1);
  const items = inventory.length ? inventory : ((allDays[0] || {}).inventory || []);
  const upTo = (n) => !pre && n <= m.clampedDay;
  const share = (key) => dayN.map((n) => {
    if (!upTo(n)) return null;
    const d = allDays[n - 1];
    const row = d && d.inventory ? d.inventory.find((i) => i.key === key) : null;
    if (!row) return null;
    const start = row.start_quantity || row.quantity || 1;
    return Math.round((row.quantity / start) * 1000) / 10;
  });
  const has = (k) => items.some((i) => i.key === k);
  const label = (k) => (items.find((i) => i.key === k) || { label: k }).label;
  const group = (id, title, keys) => ({
    id, title, unit: '%', ymin: 0, ymax: 100,
    series: keys.filter(has).map((k, i) => ({ name: label(k), tone: ['orange', 'ink', 'grey'][i], values: share(k) })),
  });
  const trendSpec = {
    dates: allDays.map((d) => d.date),
    charts: [
      group('consumables', 'Consumables remaining', ['water', 'food', 'oxygen']),
      group('systems', 'Systems remaining', ['power', 'scrubber', 'filters']),
      group('spares', 'Spares remaining', ['materials', 'medical', 'seed']),
      { id: 'calories', title: 'Calories consumed', unit: 'kcal', auto: true, floor: 0,
        series: [{ name: 'kcal a day', tone: 'orange', values: dayN.map((n) => (upTo(n) ? (crewFigures[String(n)] || {}).calories ?? null : null)) }] },
      { id: 'steps', title: 'Steps taken', unit: 'steps', auto: true, floor: 0,
        series: [{ name: 'steps a day', tone: 'ink', values: dayN.map((n) => (upTo(n) ? (crewFigures[String(n)] || {}).steps ?? null : null)) }] },
    ].filter((c) => c.series.length),
  };

  const habitat = dpanel({ id: 'habitat', code: 'CH-01', title: 'Habitat', meta: 'Sensor node · measured live · figures and stores counted by the crew', span: 12, cls: 'compact' }, `
    <!-- The Sensor-11 dashboard. The station server polls the external feed and
         stores every reading in its own database; /public/habitat.js draws these
         tiles from /api/habitat/data and refreshes on the node's cycle. -->
    <div class="hbt">
      <div class="bento" id="hbt-bento" hidden>
        <section class="tile t-co2">
          <h3>Carbon dioxide</h3>
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
          <h3>Temperature</h3>
          <span class="sub">Scale 0–40 °C</span>
          <div class="ruler-row">
            <div class="ruler-num">
              <div class="big" id="tempVal">—<em>°C</em></div>
              <div class="verdict" id="tempVerdict"></div>
            </div>
            <div class="ruler-wrap" id="hbt-ruler"></div>
          </div>
        </section>
        <section class="tile t-hum lvl">
          <h3>Humidity</h3>
          <span class="sub">Scale 0–100 %RH</span>
          <div class="big" id="humVal" style="margin-top:12px">—<em>%</em></div>
          <div id="hbt-level"></div>
        </section>
        <section class="tile t-light spk">
          <h3>Light</h3>
          <span class="sub">Scale 0–1000 raw</span>
          <div class="big" id="lightVal" style="margin-top:12px">—<em>raw</em></div>
          <div id="hbt-spark"></div>
        </section>
        ${figureTile(crewFigures, m, { key: 'calories', label: 'Calories consumed', unit: 'kcal', colour: 'var(--orange)', fmt: (v) => v.toLocaleString('en-GB') })}
        ${figureTile(crewFigures, m, { key: 'steps', label: 'Steps taken', unit: 'steps', colour: 'var(--ink)', fmt: (v) => v.toLocaleString('en-GB') })}
      </div>
      <div class="bento aux">
        <section class="tile t-res">
          <h3>Resources</h3>
          <span class="sub">Carried in · never resupplied</span>
          ${inventoryGauges(inventory, { cells: true })}
        </section>
        <section class="tile t-days" id="hbt-trends" data-start="${esc(m.start_date)}" data-days="${m.totalDays}" data-today="${m.clampedDay}"
          data-spec="${esc(JSON.stringify(trendSpec))}">
          <div class="tile-head">
            <div><h3>Trends</h3>
            <span class="sub">Day by day across the mission · sensor averages, stores as a share of what was carried in, the crew's counts</span></div>
          </div>
          ${pre ? `<div class="empty tnote">The mission opens on ${esc(m.start_date)}. From day one these charts fill in,
            a point a day: the four sensor channels, every store, and the crew's calories and steps.</div>` : ''}
          <div class="tcharts" id="hbt-tcharts"${pre ? ' hidden' : ''}></div>
        </section>
      </div>
      <div id="hbt-notes"></div>
      <div class="empty" id="hbt-empty">Waiting for the first read from the sensor node…</div>
    </div>`);

  const galley = dpanel({ id: 'galley', code: 'CH-32', title: 'Meal', meta: today && today.meals.length
      ? `${today.kcalPlanned} kcal · ${today.waterPlanned.toFixed(1)} L · ${today.energyPlanned} Wh` : '', span: 4, cls: 'h-3 scroll' },
    today && today.meals.length ? `<div class="meals">${today.meals.map((x) => `
      <div class="meal">
        <span class="meal-slot">${esc(slotName[x.slot] || x.slot)}</span>
        <b>${esc(x.name)}</b>
        <span class="meal-figs">${x.kcal} kcal · ${x.water_litres} L · ${x.energy_wh} Wh</span>
      </div>`).join('')}</div>` : '<div class="empty">No meals filed for today</div>');

  const crewPanel = dpanel({ id: 'crew', code: 'CH-12', title: 'Mood', meta: 'Filed by mission control · never quoted as numbers', span: 4, cls: 'h-3 scroll' },
    `<div class="officers">${crew.map((c, i) => {
      const t = moods[i];
      return `<div class="officer">
        <div class="officer-id">
          <b>${esc(c.designation)}</b>
          <span class="officer-role">${esc(c.role)}</span>
        </div>
        <span class="badge ${t.load > 65 ? 'warn' : 'mars'}">${esc(t.condition)}</span>
        <div class="officer-axes">${t.axes.map((a) => `
          <div class="axis-mini" title="${esc(a.text)}">
            <span>${esc(a.low)}</span>
            <div class="bar"><i class="${a.value > 70 ? 'warn' : 'ok'}" style="width:${a.value}%"></i></div>
            <span>${esc(a.high)}</span>
          </div>`).join('')}</div>
        <div class="officer-note">${t.axes.map((a) => esc(a.text)).join(' · ')}</div>
      </div>`;
    }).join('')}</div>`);

  const log = dpanel({ id: 'crewlog', code: 'CH-50', title: 'Crew log',
    meta: `${entryCounts.published} entr${entryCounts.published === 1 ? 'y' : 'ies'} · ${entryCounts.days} day${entryCounts.days === 1 ? '' : 's'} · written from inside`, span: 12, cls: 'h-3' },
    logDays.length ? `
      <div class="feed-filter log-filter" id="log-filter" role="group" aria-label="Filter the crew log">
        <button type="button" class="chip active" data-crew="">ALL</button>
        ${crew.map((c) => `<button type="button" class="chip" data-crew="${c.id}">${esc(c.designation.replace(' OFFICER', ''))}</button>`).join('')}
      </div>
      <div class="log-scroll" id="log-days">
      ${logDays.map((d) => `
        <div class="log-day" data-day="${d.missionDay}">
          <div class="log-day-head"><span class="cs">Day ${String(d.missionDay).padStart(3, '0')}</span><span>${esc(d.date)}</span></div>
          ${d.entries.map((e) => `<article class="card log-entry" id="e${e.id}" data-crew="${e.crew_id}">
            <div class="card-top"><span class="cs">${esc(e.designation)}</span><span class="card-day">${esc(e.role)}</span></div>
            <div class="card-body">${esc(e.body)}</div>
          </article>`).join('')}
        </div>`).join('')}
      </div>
      <div class="empty" id="log-empty" style="display:none">Nothing written by them yet</div>`
    : '<div class="empty">No entries have been filed yet</div>');

  const whole = dpanel({ id: 'whole', code: 'CH-30', title: 'The whole mission',
    meta: `${esc(m.start_date)} → ${esc(m.end_date)} · ${m.totalDays} days`, span: 12 },
    allDays.length ? `<div class="days-strip">${allDays.map((d) => {
      const state = d.missionDay < m.clampedDay ? 'past' : d.missionDay === m.clampedDay ? 'now' : 'ahead';
      return `<details class="dcard ${state}">
        <summary>
          <span class="dcard-n">D${String(d.missionDay).padStart(3, '0')}</span>
          <span class="dcard-date">${esc(d.date.slice(5))}</span>
          <span class="dcard-state">${state === 'now' ? 'Today' : state === 'past' ? 'Complete' : 'Planned'}</span>
          <span class="dcard-count">${d.tasks.length} tasks${d.meals.length ? ` · ${d.meals.length} meals` : ''}</span>
        </summary>
        <div class="dcard-body">
          ${d.tasks.map((t) => `<div class="dcard-task ${t.status === 'DONE' ? 'done' : ''}"><span>${esc(t.time)}</span>${esc(t.label)}</div>`).join('')}
          ${d.meals.length ? `<div class="dcard-meals">${d.meals.map((x) => esc(x.name)).join(' · ')}</div>` : ''}
          ${d.notes && d.notes.length ? `<div class="dcard-notes">${d.notes.map((n) => `
            <div class="dcard-note ${n.kind === 'ANOMALY' ? 'anomaly' : ''}"><span>${esc(fmtTime(n.posted_at).slice(0, 5))} · ${esc(n.kind)}</span>${esc(n.body)}</div>`).join('')}</div>` : ''}
        </div>
      </details>`;
    }).join('')}</div>` : '<div class="empty">No schedule filed yet</div>');

  return `
  <section class="dash" id="mission">
    <header class="dash-head">
      <div>
        <h2 class="bigsec">Mission dashboard</h2>
        <p class="dash-sub">${esc(m.name)} · ${esc(m.start_date)} → ${esc(m.end_date)} · ${esc(m.timezone)}</p>
      </div>
      <div class="dash-clock">
        <span class="dash-clock-label">${pre ? 'Countdown' : 'Elapsed'}</span>
        <b>${esc(m.elapsed)}</b>
      </div>
    </header>
    <div class="kpis">${kpis}</div>
    ${strip}
    <div class="dash-grid">
      ${schedule}${galley}${crewPanel}${habitat}${log}${whole}
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

function messageCard(m) {
  const fresh = m.response_at && (Date.now() - Date.parse(m.response_at)) < 6 * 3600000;
  const tags = (m.tags || '').split(',').filter(Boolean);
  const st = cardStatus(m);
  // A card that is both the viewer's and unpublished is stamped data-pending:
  // the stylesheet keeps it out of the common board and board.js reveals it
  // under MY MESSAGES. Such cards only ever reach their own sender's page.
  return `<article class="card ${fresh ? 'fresh' : ''}" id="m${m.id}"
      data-tags="${esc(tags.join(','))}"${m.mine ? ' data-mine="1"' : ''}${
      m.mine && m.pending ? ' data-pending="1"' : ''}>
    <div class="card-top">
      <span class="cs">${esc(m.callsign)}</span>
      ${fresh ? '<span class="badge new">New</span>' : ''}
      <span class="badge card-state ${st.cls}">${st.label}</span>
      <span class="card-day">D${String(m.mission_day).padStart(3, '0')}</span>
    </div>
    <div class="card-sent">
      <span>Sent ${esc(m.submitted_at.slice(8, 10))}.${esc(m.submitted_at.slice(5, 7))}.${esc(m.submitted_at.slice(0, 4))}</span>
      <span>${esc(m.submitted_at.slice(11, 16))} UTC</span>
    </div>
    <div class="card-body">${esc(m.body)}</div>
    ${tags.length ? `<div class="tagrow">${tags.map((t) => `<span>${esc(t)}</span>`).join('')}</div>` : ''}
    ${m.response_body ? `<div class="card-reply">
      <div class="who">${esc(m.responder || 'Mars habitat')}</div>
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
function boardCards(recent) {
  return recent.map(boardCard).join('');
}

/**
 * One exchange as it appears in the messages panel: an avatar with the
 * callsign's initial, the callsign, when it was sent, the message; the
 * crew's reply nested beneath it in a quieter box; the state at the foot.
 * The same data attributes as messageCard, so board.js filters it the same
 * way and only published exchanges reach the common board.
 */
function boardCard(m) {
  const fresh = m.response_at && (Date.now() - Date.parse(m.response_at)) < 6 * 3600000;
  const tags = (m.tags || '').split(',').filter(Boolean);
  const st = cardStatus(m);
  const when = (iso) => `${iso.slice(8, 10)}.${iso.slice(5, 7)}.${iso.slice(0, 4)} · ${iso.slice(11, 16)}`;
  const hue = [...m.callsign].reduce((a, c) => (a * 31 + c.charCodeAt(0)) % 360, 7);
  return `<article class="card bcard ${fresh ? 'fresh' : ''}" id="m${m.id}"
      data-tags="${esc(tags.join(','))}"${m.mine ? ' data-mine="1"' : ''}${
      m.mine && m.pending ? ' data-pending="1"' : ''}>
    <div class="bcard-head">
      <span class="avatar" style="--h:${hue}">${esc(m.callsign[0])}</span>
      <div class="bcard-who"><span class="cs">@${esc(m.callsign)}</span><span class="bcard-time">${esc(when(m.submitted_at))}</span></div>
      ${fresh ? '<span class="badge new">New</span>' : ''}
    </div>
    <div class="card-body">${esc(m.body)}</div>
    ${m.response_body ? `<div class="card-reply">
      <div class="bcard-head">
        <span class="avatar mars">M</span>
        <div class="bcard-who"><span class="cs">@${esc((m.responder || 'Mars habitat').replace(/\s+/g, '').toUpperCase())}</span>
          <span class="bcard-time">${m.response_at ? esc(when(m.response_at)) : ''}</span></div>
      </div>
      <p>${esc(m.response_body)}</p>
    </div>` : ''}
    <div class="bcard-foot">
      ${tags.length ? `<span class="bcard-tags">${tags.map((t) => esc(t)).join(' · ')}</span>` : '<span></span>'}
      <span class="badge card-state ${st.cls}">${st.label}</span>
    </div>
  </article>`;
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

  ${messages.length ? `<div class="cards">${messages.map(messageCard).join('')}</div>`
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
};
