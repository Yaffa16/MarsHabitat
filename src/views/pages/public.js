'use strict';
const L = require('../layout');
const { esc, panel, eyebrow, orbitPlot, pipeline } = L;
const orbital = require('../../lib/orbital');
const data = require('../../lib/data');
const { TAGS } = data;
const { composerBlock } = require('./communicate');
const { aboutSection } = require('./info');
const { habitatDome, LINE_ICONS } = require('./dome');
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
    ${orbitPlot(ctx.geo, { T, light: false })}
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
      const startLabel = (i.start_quantity || i.quantity) ? start : '—';   // a 0 placeholder reads "of —", not "of 1"
      const pct = Math.max(0, Math.min(100, (i.quantity / start) * 100));
      const low = i.warn_below > 0 && i.quantity <= i.warn_below;
      const daysLeft = i.consumption > 0 ? i.quantity / i.consumption : null;
      const num = Number.isInteger(i.quantity) ? String(i.quantity) : i.quantity.toFixed(1);
      return `<div class="gauge round ${low ? 'low' : ''}" title="${esc(i.label)}: ${i.quantity} ${esc(i.unit)} ${T('of')} ${startLabel} · ${esc(left(daysLeft, 1))}">
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
    const startLabel = (i.start_quantity || i.quantity) ? start : '—';   // a 0 placeholder reads "of —", not "of 1"
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
        <span>${pct.toFixed(0)}% ${T('of')} ${startLabel} ${esc(i.unit)}</span>
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
    return `<div class="empty" style="margin-top:10px">${T(categories.some((c) => c.sensor) ? 'No reading from the meter yet today, and nothing filed by the crew' : 'Nothing filed for this day — the crew count the day’s power as it ends')}</div>`;
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
 * The composer as a device: an LED, the ribbed grip, a knob and a row of
 * vents, then the operator's callsign and the channel. While a message is
 * crossing, the form gives way to the dial (composerBlock, composer.js).
 * Drawn on the mission page and on the messages page alike.
 */
function composerDevice(ctx, { inFlight = null, error = null, draft = '' } = {}) {
  const T = ctx.T;
  return `<section class="device composer-device${inFlight ? ' sending' : ''}" aria-label="${esc(T('Composer'))}">
        <h2 class="dev-title">${T('Write to the crew')}</h2>
        <button type="button" class="dev-close" aria-label="${esc(T('Close'))}" title="${esc(T('Close'))}"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18"/></svg></button>
        <span class="dev-led" aria-hidden="true"></span>
        <span class="dev-grip" aria-hidden="true"></span>
        <span class="dev-knob" aria-hidden="true"></span>
        <span class="dev-vents" aria-hidden="true"></span>
        <div class="dev-head">
          <span>${T('Operator')}</span>
          ${ctx.callsign ? `<span class="dev-chip" title="${esc(T('Your callsign for this visit — no account, no name'))}">${esc(ctx.callsign)}</span>`
            : ctx.offer ? `<span class="dev-chip dev-chip-later" title="${esc(T('Your callsign for this visit — no account, no name'))}">${esc(ctx.offer)}</span>`
            : `<span class="dev-chip dev-chip-later" title="${esc(T('Your callsign for this visit — no account, no name'))}">${T('Callsign on sending')}</span>`}
          <span class="dev-chan">CH-09 · Uplink</span>
        </div>
        <div class="dev-body" id="dev-body">${composerBlock(ctx, { inFlight, error, draft })}</div>
      </section>`;
}

/**
 * The board, live: board.js polls /api/board and swaps the cards in place,
 * so a reply published from mission control, or another visitor's exchange,
 * appears without anyone reloading. The full structure is always rendered,
 * even when empty, so the first card can arrive into it. `recent` holds
 * everyone's published exchanges and this visitor's own messages, whatever
 * their state. Drawn on the mission page and on the messages page alike.
 */
function boardScreen(ctx, { recent = [] } = {}) {
  const T = ctx.T;
  // This visitor's messages that mission control has not yet published. They
  // are in the page, but only surface under MY MESSAGES.
  const pendingMine = recent.filter((m) => m.mine && m.pending).length;
  const openOnMine = false;   // ALL opens first; the viewer's own messages head it
  return `<div class="feed-wrap"><div class="feed-scroll" id="feed" data-poll="/api/board"
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
          </div><button type="button" class="feed-more" id="feed-more" hidden>${T('Show more')}</button></div>
          <div class="feed-filter" id="feed-filter" role="group" aria-label="${esc(T('Filter the board'))}"${
          recent.length ? '' : ' hidden'}>
          <button type="button" class="chip${openOnMine ? '' : ' active'}" data-filter="">${T('ALL')}</button>
          <button type="button" class="chip mine${openOnMine ? ' active' : ''}" data-filter="mine">${T('MY MESSAGES')} <span
            class="chip-count" id="feed-mine-count"${pendingMine ? '' : ' hidden'}>${pendingMine}</span></button>
          ${TAGS.map((t) => `<button type="button" class="chip" data-filter="tag:${t}">#${T(t)}</button>`).join('')}
          </div>
        </div>
      </div></div>`;
}

/**
 * The dashboard page, /dashboard: the mission dashboard — the nine panels
 * behind their index, the live images, the doors — on a page of its own, the
 * same section the mission page carries. Drawn for a phone first, where the
 * mission page keeps only the habitat and the doors (aura.css) and the bar's
 * Dashboard key leads here; on a wider screen it is an inner page like the
 * media page.
 */
function dashboardPage(ctx, d) {
  const body = dashboard(ctx, {
    crew: d.crew, today: d.today, counts: d.counts, crewFigures: d.crewFigures, power: d.power, allDays: d.allDays,
    logDays: d.logDays, entryCounts: d.entryCounts, ingest: d.ingest, media: d.media, mediaCounts: d.mediaCounts,
    mediaLookup: d.mediaLookup, hardware: d.hardware, hardwareDaily: d.hardwareDaily, cloud: d.cloud,
  });
  return L.page({
    title: 'Mission dashboard', ctx, body, hideNav: true, hideRail: true, bodyClass: 'landing inner dashboard',
    current: '/dashboard', scripts: ['/habitat.js', '/hardware.js', '/folder.js'].concat(d.cloud ? ['/cloud.js'] : []),
    styles: ['/aura.css'],
  });
}

/**
 * The messages page, /messages: the portal on a page of its own — the board
 * and the composer as the mission page has them, without the rest. Drawn for
 * a phone first: there the exchanges flow with the page and the composer is a
 * pop-up over the foot of the screen, above the bar of keys, that the bar's
 * Write key shows and hides (aura.css, tabbar.js); the bar's Write key and
 * the mission page's doors lead here, /messages#write opening it with the
 * composer shown. On a wider screen it is an inner page like the media page,
 * the two side by side as on the mission page.
 */
function messages(ctx, { recent = [], inFlight = null, error = null, draft = '' } = {}) {
  const T = ctx.T;
  const body = `
  <section class="portal portal-page" id="write">
  <header class="portal-head">
    <div>
      <span class="dash-code">CH-09</span>
      <h2 class="bigsec">${T('Messages')}</h2>
      <p class="dash-sub">${T('Communication Portal')} · ${T('Uplink')} · ${esc(ctx.mission.name)} · ${ctx.geo.distanceAu.toFixed(3)} au</p>
    </div>
    <div class="dash-clock">
      <span class="dash-clock-label">${T('One-way signal')}</span>
      <b>${esc(orbital.formatLightTime(ctx.geo.lightSeconds))}</b>
    </div>
  </header>
  <div class="portal-grid">
    <aside class="portal-letters" aria-hidden="true">${'MARSPLATZ'.split('').map((c) => `<span>${c}</span>`).join('')}</aside>
    <div class="portal-main">${composerDevice(ctx, { inFlight, error, draft })}</div>
    <section class="feed-col" id="exchanges">${boardScreen(ctx, { recent })}</section>
  </div>
  </section>`;
  return L.page({
    title: 'Messages', ctx, body, hideNav: true, hideRail: true, bodyClass: 'landing inner messages',
    current: '/messages', scripts: ['/composer.js', '/board.js'], styles: ['/aura.css'],
  });
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
function ticker(ctx, { today, links = false } = {}) {
  const m = ctx.mission, T = ctx.T;
  const pre = m.phase === 'PRE_LAUNCH', over = m.phase === 'COMPLETE';
  // On the inner pages (layout.js draws the ticker there too) the day's
  // schedule is read here, and the menu's rows are links to the landing
  // page's pop-ups, which open from the hash.
  if (today === undefined) today = m.phase === 'ACTIVE' ? data.day(m.clampedDay) : null;
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
  cells.push(`${T('Habitat:')} <b id="tk-hab">${T('awaiting reading')}</b>`);   // the one-way signal is read where a message is written, and nowhere else
  const line = cells.map((c) => `<span class="tk-cell">${c}</span>`).join('<span class="tk-sep">·</span>');
  /* The three-lines menu at the ticker's left end drops the reading matter
     — About, What this is, Who we are — as a short list; a row opens the
     same pop-up the About buttons open (info.js binds .fold-btn[data-popup]),
     so the texts live in one place. The theme and language switches sit at
     the ticker's right end. */
  // On a phone the list is a sheet from the foot of the screen, opened by the bar's More key (layout.js, tabbar()): it gets a
  // head and a sign on every row, which the wider screens hide.
  const sign = (d) => `<svg class="tk-ic" viewBox="0 0 24 24" aria-hidden="true">${d}</svg>`;
  const MENU_ICONS = { 'about-project': '<circle cx="12" cy="12" r="8.5"/><path d="M12 11v5"/><path d="M12 7.8h.01"/>', what: TAB_ICONS.habitat, 'who-we-are': LINE_ICONS.crew };
  const menu = `
    <button type="button" class="tk-menu" id="tk-menu" aria-expanded="false" aria-controls="tk-dropdown" aria-label="${esc(T('About, What this is, Who we are'))}"><span class="bars" aria-hidden="true"><i></i><i></i><i></i></span></button>
    <div class="tk-dropdown" id="tk-dropdown" hidden>
      <div class="tk-sheet-head"><b>${T('About')}</b><span>${T('Everything else on the station')}</span></div>
      ${[['about-project', 'About', 'The habitat, the distance, the archive'], ['what', 'What this is', 'How the station behaves, in plain terms'], ['who-we-are', 'Who we are', 'Crew, company, production credits']]
        .map(([id, title, sub]) => links
          ? `<a class="tk-row" href="/#${id}">${sign(MENU_ICONS[id])}<span class="fold-title">${esc(T(title))}</span><span class="fold-sub">${esc(T(sub))}</span></a>`
          : `<button type="button" class="fold-btn tk-row" data-popup="${id}" aria-haspopup="dialog" aria-controls="${id}">${sign(MENU_ICONS[id])}<span class="fold-title">${esc(T(title))}</span><span class="fold-sub">${esc(T(sub))}</span></button>`).join('')}
    </div>`;
  return `
  <div class="ticker" role="marquee" aria-label="${esc(T('What is happening in the habitat'))}"
       data-tz="${esc(m.timezone)}" data-tasks="${esc(JSON.stringify(tasks))}"${over ? ' data-over="1"' : ''}
       data-phase="${esc(m.phase)}" data-opens="${esc(m.opensAt)}" data-epoch="${esc(String(require('../../lib/content').resetEpoch() || ''))}">
    ${menu}
    <a class="tk-brand" href="/" aria-label="MARS!platz">MARS<span class="bang">!</span>platz</a>
    <span class="tk-sol"><i aria-hidden="true"></i>${pre ? `T−${m.countdown.days}d` : over ? T('Complete') : `SOL ${String(m.clampedDay).padStart(2, '0')}/${String(m.totalDays).padStart(2, '0')}`}</span>
    <div class="tk-clock"><span class="tk-clock-label">${T('HABITAT TIME')}</span> <b id="tk-clock">${esc(m.venueTime)}</b></div>
    <div class="tk-window"><div class="tk-track" id="tk-track"><div class="tk-line">${line}</div><div class="tk-line" aria-hidden="true">${line}</div></div></div>
    <div class="tk-right">${L.statusStrip(ctx)}</div>
  </div>
  <script>
  (function () {
    var b = document.getElementById('tk-menu'), d = document.getElementById('tk-dropdown');
    if (!b || !d) return;
    function set(open) { d.hidden = !open; b.setAttribute('aria-expanded', open ? 'true' : 'false'); }
    b.addEventListener('click', function () { set(d.hidden); });
    d.querySelectorAll('.tk-row').forEach(function (r) { r.addEventListener('click', function () { set(false); }); });
    document.addEventListener('click', function (e) { if (!d.hidden && !d.contains(e.target) && e.target !== b && !b.contains(e.target)) set(false); });
    document.addEventListener('keydown', function (e) { if (e.key === 'Escape' && !d.hidden) { set(false); b.focus(); } });
  })();
  (function () {
    // the language drop-down (layout.js draws it in the status strip): a press elsewhere, or Escape, closes it again
    var menus = [].slice.call(document.querySelectorAll('details.lang-menu'));
    if (!menus.length) return;
    document.addEventListener('click', function (e) { menus.forEach(function (m) { if (m.open && !m.contains(e.target)) m.removeAttribute('open'); }); });
    document.addEventListener('keydown', function (e) { if (e.key !== 'Escape') return; menus.forEach(function (m) { if (m.open) { m.removeAttribute('open'); var s = m.querySelector('summary'); if (s) s.focus(); } }); });
  })();
  </script>
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
  /* The masthead: the wordmark, one line under it, the run, and the
     station's readings as a row of small pills on the right — shared with
     every other public page so they read as one station. */
  const hero = ticker(ctx, { today });
  const lead = T('MARS is a durational performance. Three officers live sealed inside the habitat for the thirteen days of the run; visitors to the exhibition can see the habitat from outside. What they cannot do is walk in and talk to the people inside it. Here a message has to travel. You watch it go. You wait.');
  // Two doors under the lead: the composer (the orange button) and, beside
  // it, the Mission dashboard further down the page (#mission, where the
  // foot's "Daily mission" also leads).
  // On a phone held upright the portal and the dashboard are pages of their own (/messages, /dashboard), so the doors
  // lead there instead (aura.css shows one of each pair).
  const cta = `<a class="btn primary masthead-btn" href="#write">${T('Write to the crew')} <span aria-hidden="true">↓</span></a>
      <a class="btn primary masthead-btn masthead-btn-page" href="/messages#write">${T('Write to the crew')} <span aria-hidden="true">→</span></a>
      <a class="btn masthead-btn masthead-btn-live" href="#mission"><i class="live-dot" aria-hidden="true"></i>${T('Live Mission Dashboard')} <span aria-hidden="true">↓</span></a>
      <a class="btn masthead-btn masthead-btn-live masthead-btn-page" href="/dashboard"><i class="live-dot" aria-hidden="true"></i>${T('Live Mission Dashboard')} <span aria-hidden="true">→</span></a>`;
  const masthead = L.masthead(ctx, { home: true, status: true, lead, cta });   // the strip is drawn in the ticker on wide screens; aura.css shows this one on phones

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
  <div class="hero-grid">
    ${masthead}
    ${habitatDome(ctx, { today, crew, recent, power, counts, crewFigures, pods: true })}
  </div>
  <section class="portal" id="write" data-stop>
  <!-- The portal's heading, in the dress of the dashboard's: the channel's
       code, the title, the line beneath; at the right the one-way light-time
       a message is about to cross, where the dashboard shows the elapsed. -->
  <header class="portal-head">
    <div>
      <span class="dash-code">CH-09</span>
      <h2 class="bigsec">${T('Send a message to the Crew')}</h2>
      <p class="dash-sub">${T('Communication Portal')} · ${T('Uplink')} · ${esc(ctx.mission.name)} · ${ctx.geo.distanceAu.toFixed(3)} au</p>
    </div>
    <div class="dash-clock">
      <span class="dash-clock-label">${T('One-way signal')}</span>
      <b>${esc(orbital.formatLightTime(ctx.geo.lightSeconds))}</b>
    </div>
  </header>
  <div class="portal-grid">
    <aside class="portal-letters" aria-hidden="true">${'MARSPLATZ'.split('').map((c) => `<span>${c}</span>`).join('')}</aside>
    <div class="portal-main">${composerDevice(ctx, { inFlight, error, draft })}</div>
    <section class="feed-col" id="exchanges">${boardScreen(ctx, { recent })}</section>
    ${dayRail}
  </div>
  </section>

  ${dashboard(ctx, { crew, today, counts, crewFigures, power, allDays, logDays, entryCounts, ingest, media, mediaCounts, mediaLookup, hardware, hardwareDaily, cloud })}
  `;
  return L.page({
    title: 'Mission', ctx, body, hero, hideNav: true, hideRail: true, bodyClass: 'landing',
    current: '/', scripts: ['/composer.js', '/board.js', '/habitat.js', '/hardware.js', '/section-scroll.js', '/folder.js'].concat(cloud ? ['/cloud.js'] : []),
    styles: ['/aura.css'],
  });
}



/**
 * A crew figure as a small tile — calories consumed, steps taken: the day's
 * figure for every officer, one under the other, the crew's total beneath it
 * with the thirteen days as a sparkline, and the average. Lives inside the
 * habitat bento beside the sensor tiles rather than as a chart of its own.
 * The figures are filed per officer on mission control's Habitat tab, under
 * Steps taken (content/crew-figures.json, a day as
 *   "5": { "crew": { "SCIENCE OFFICER": { "calories": 1480, "steps": 2010 }, … }, "calories": 4420, "steps": 5960 }
 * — the totals are the sums); a day filed only as a total shows the total
 * and a dash for each officer.
 */
function figureTile(figures, mission, { key, label, unit, colour, fmt, T = same, crew = [] }) {
  const days = Array.from({ length: mission.totalDays }, (_, i) => i + 1);
  const dayOf = (n) => figures[String(n)] || {};
  const perOf = (d, c) => ((d.crew || {})[c.designation] || {})[key] ?? null;
  const filed = (d) => d[key] != null || crew.some((c) => perOf(d, c) != null);
  const values = days.map((n) => dayOf(n)[key] ?? null);
  const present = values.filter((v) => v != null);
  const n0 = mission.clampedDay;
  // the day shown: today when filed, else the last day that was
  const shownDay = filed(dayOf(n0)) ? n0 : ([...days].reverse().find((n) => filed(dayOf(n))) || null);
  const d = shownDay ? dayOf(shownDay) : {};
  const total = d[key] ?? null;
  const mean = present.length ? Math.round(present.reduce((a, b) => a + b, 0) / present.length) : null;
  const W = 160, H = 26, pad = 3;
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
      : `<circle cx="${x(i).toFixed(1)}" cy="${y(v).toFixed(1)}" r="${days[i] === n0 ? 3 : 1.8}"
          fill="${days[i] === n0 ? colour : 'var(--well)'}" stroke="${colour}" stroke-width="${days[i] === n0 ? 2 : 1.5}">
          <title>${T('Day')} ${String(days[i]).padStart(3, '0')}: ${v.toLocaleString('en-GB')} ${unit}</title></circle>`).join('')}
  </svg>` : '';
  // the officer's name as the station writes it: COMMUNICATION, SCIENCE, HEALTH
  const who = (c) => T(String(c.designation || '').replace(/\s*OFFICER$/i, '').trim());
  const rows = crew.map((c) => { const v = perOf(d, c); return `<div class="fig-r"><span class="fig-who">${esc(who(c))}</span><span class="fig-v">${v != null ? fmt(v) : '—'}<em>${esc(unit)}</em></span></div>`; }).join('');
  return `<section class="tile t-fig t-${key}" role="group" aria-label="${esc(T(label))}${total != null ? `: ${fmt(total)} ${esc(unit)} ${T('crew total')}` : ''}">
    <h3>${T(label)}</h3>
    <span class="sub">${shownDay === n0 ? `${T('Day')} ${String(n0).padStart(3, '0')}` : shownDay ? `${T('Last recorded')} · ${T('Day')} ${String(shownDay).padStart(3, '0')}` : T('Counted by the crew')}</span>
    <div class="fig-rows">${rows}</div>
    <div class="fig-foot"><span class="fig-total">${total != null ? `${fmt(total)} ${esc(unit)} · ${T('crew total')}` : T('nothing recorded')}</span>${spark}</div>
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
 * own directly below the Habitat panel: one chart per kind of quantity
 * (temperature, energy, …), every device of that kind a line on the same
 * day, midnight to midnight at the venue, on one proper axis in its unit —
 * each line named at its end with the current reading. The server polls and stores
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

/**
 * Which graph a device belongs on. Devices are grouped by what they
 * measure, and each group is one chart with a real Y axis in that unit:
 * temperatures together, energy meters together, anything else by its
 * unit. A counter (an energy meter, which only rises) is drawn as what it
 * has added since midnight — so the energy axis starts at zero and reads
 * as today's consumption, the same figure the tile calls "today".
 */
function hwGroupOf(s) {
  const u = String(s.unit || '').trim();
  // `range` is the fixed Y axis of the chart. A device can carry its own
  // `range: [lo, hi]` in content/home-assistant.json, which widens the
  // chart's axis to hold it; a group with no range at all fits the data.
  if (s.chart) return { key: 'chart:' + s.chart.toLowerCase() + ':' + u.toLowerCase(), title: s.chart, unit: u, zero: false, range: null };
  if (/^(°\s*[cf]|k)$/i.test(u)) return { key: 'temperature', title: 'Temperature', unit: u, zero: false, range: [0, 30] };
  // Energy and power are drawn in one unit each whatever the meter reports —
  // Wh and W — so a Shelly reading kWh and another reading Wh share an axis
  // (a kWh meter's line is drawn ×1000; its legend keeps its own unit).
  if (/^k?wh$/i.test(u)) return { key: 'energy', title: 'Energy', unit: 'Wh', zero: true, range: [0, 300] };
  if (s.kind === 'counter') return { key: 'energy:' + u.toLowerCase(), title: 'Energy', unit: u, zero: true, range: null };
  if (/^k?w$/i.test(u)) return { key: 'power', title: 'Power', unit: 'W', zero: true, range: null };
  return { key: 'unit:' + u.toLowerCase(), title: u || 'Other', unit: u, zero: false, range: null };
}

/** Ticks on a fixed axis: about `n` round steps between exact bounds. */
function hwFixedTicks(lo, hi, n = 5) {
  const raw = (hi - lo) / n;
  const p = Math.pow(10, Math.floor(Math.log10(raw)));
  const m = raw / p;
  const step = (m <= 1 ? 1 : m <= 2 ? 2 : m <= 2.5 ? 2.5 : m <= 5 ? 5 : 10) * p;
  const ticks = [];
  for (let v = Math.ceil(lo / step) * step; v <= hi + step / 1e6; v += step) ticks.push(Math.round(v / step) * step);
  if (ticks[0] !== lo) ticks.unshift(lo);
  if (ticks[ticks.length - 1] !== hi) ticks.push(hi);
  const dec = Math.max(0, -Math.floor(Math.log10(step)));
  return { lo, hi, ticks, dec };
}

/** Round axis bounds and ticks — steps of 1, 2, 5 × 10ⁿ, about `n` of them,
 *  the bounds pushed out to the nearest step so every reading sits inside. */
function hwTicks(lo, hi, n = 4, fromZero = false) {
  if (fromZero) lo = Math.min(0, lo);
  if (!(hi > lo)) { hi = lo + (Math.abs(lo) || 1) * 0.1; lo = fromZero ? 0 : lo - (Math.abs(lo) || 1) * 0.1; }
  const raw = (hi - lo) / n;
  const p = Math.pow(10, Math.floor(Math.log10(raw)));
  const m = raw / p;
  const step = (m <= 1 ? 1 : m <= 2 ? 2 : m <= 5 ? 5 : 10) * p;
  const a = Math.floor(lo / step) * step, b = Math.ceil(hi / step) * step;
  const ticks = [];
  for (let v = a; v <= b + step / 2; v += step) ticks.push(Math.round(v / step) * step);
  const dec = Math.max(0, -Math.floor(Math.log10(step)));
  return { lo: a, hi: b === a ? a + step : b, ticks, dec };
}

/**
 * One group of devices on one day — midnight to midnight at the venue.
 * Time along the bottom; the group's unit up the left on a proper scale,
 * shared by every line on the chart, with gridlines on the round values.
 * Each line is named at its right-hand end in its own colour with the
 * current reading. A thin mark stands on the current time.
 */
function hwChart(hw, group, members, tz, T = same) {
  // Half the panel wide: the charts stand side by side, the names and
  // readings in a legend beneath the plot.
  const W = 500, H = 250, padL = 44, padR = 16, padT = 26, padB = 30;
  const iw = W - padL - padR, ih = H - padT - padB, bottom = padT + ih;
  const span = Math.max(1, hw.now - hw.since);
  const sx = (t) => padL + ((t - hw.since) / span) * iw;
  // kWh on the Wh axis and kW on the W axis are scaled into it.
  const scale = (s) => ((group.unit === 'Wh' && /^kwh$/i.test(s.unit)) || (group.unit === 'W' && /^kw$/i.test(s.unit)) ? 1000 : 1);
  const val = (s, v) => (s.kind === 'counter' && s.base != null ? Math.max(0, v - s.base) : v) * scale(s);
  const drawn = members.filter((m) => m.s.points && m.s.points.length);
  if (!drawn.length) return '';
  const all = drawn.flatMap((m) => m.s.points.map((p) => val(m.s, p[1])));
  // The axis: the fixed range of the group (widened by any device's own
  // range from the file), or, with no range set, round bounds round the data.
  const ranges = members.map((m) => m.s.range).filter(Boolean).concat(group.range ? [group.range] : []);
  const rlo = ranges.length ? Math.min(...ranges.map((r) => r[0])) : null, rhi = ranges.length ? Math.max(...ranges.map((r) => r[1])) : null;
  let dlo = Math.min(...all), dhi = Math.max(...all);
  // A device's `span` is the least height the axis keeps round its readings,
  // centred on them — a steady reading then has room to move.
  const least = Math.max(0, ...members.map((m) => m.s.span || 0));
  if (least && dhi - dlo < least) { const mid = (dlo + dhi) / 2; dlo = mid - least / 2; dhi = mid + least / 2; }
  const ax = ranges.length && dlo >= rlo && dhi <= rhi
    ? hwFixedTicks(rlo, rhi)
    : hwTicks(ranges.length ? Math.min(rlo, dlo) : dlo, ranges.length ? Math.max(rhi, dhi) : dhi, 4, group.zero);
  const clamp = (v) => Math.min(ax.hi, Math.max(ax.lo, v));
  const sy = (v) => padT + ih - ((clamp(v) - ax.lo) / (ax.hi - ax.lo)) * ih;
  const gid = 'hwg-' + group.key.replace(/[^a-z0-9]+/gi, '-');
  // A soft curve through the hourly points (Catmull–Rom, held inside the plot).
  const curve = (pts) => {
    if (pts.length < 3) return pts.map(([x, y], k) => `${k ? 'L' : 'M'}${x.toFixed(1)},${y.toFixed(1)}`).join('');
    const cy = (y) => Math.min(bottom, Math.max(padT, y));
    let d = `M${pts[0][0].toFixed(1)},${pts[0][1].toFixed(1)}`;
    for (let i = 0; i < pts.length - 1; i++) {
      const p0 = pts[i - 1] || pts[i], p1 = pts[i], p2 = pts[i + 1], p3 = pts[i + 2] || p2;
      const c1 = [p1[0] + (p2[0] - p0[0]) / 6, cy(p1[1] + (p2[1] - p0[1]) / 6)];
      const c2 = [p2[0] - (p3[0] - p1[0]) / 6, cy(p2[1] - (p3[1] - p1[1]) / 6)];
      d += `C${c1[0].toFixed(1)},${c1[1].toFixed(1)} ${c2[0].toFixed(1)},${c2[1].toFixed(1)} ${p2[0].toFixed(1)},${p2[1].toFixed(1)}`;
    }
    return d;
  };
  const series = drawn.map((m, i) => {
    const { s, colour } = m;
    const pts = s.points.map((p) => [sx(p[0]), sy(val(s, p[1]))]);
    const d = curve(pts);
    const area = `${d}L${pts[pts.length - 1][0].toFixed(1)},${bottom}L${pts[0][0].toFixed(1)},${bottom}Z`;
    const raw = s.points.map((p) => p[1]);
    const lo = Math.min(...raw), hi = Math.max(...raw);
    const [ex, ey] = pts[pts.length - 1];
    return { s, colour, d, area, pts, ex, ey, lo, hi, id: `${gid}-${i}` };
  });
  const ticks = Array.from({ length: 25 }, (_, k) => ({ t: hw.since + k * 3600000, k }));
  const unit = group.unit ? esc(group.unit) : '';
  const yLabel = (v) => v.toLocaleString('en-GB', { minimumFractionDigits: 0, maximumFractionDigits: ax.dec });
  const u = (s) => (s.unit ? ' ' + esc(s.unit) : '');
  const reading = (s) => s.kind === 'counter' && s.today != null
    ? `+${hwNum(s.today, s.decimals)}${u(s)} ${T('today')}`
    : `${hwNum(s.value, s.decimals)}${u(s)}`;
  // The night, 22:00 to 06:00 at the venue, a darker band either side of the day.
  const band = (h0, h1) => `<rect x="${sx(hw.since + h0 * 3600000).toFixed(1)}" y="${padT}" width="${(sx(hw.since + h1 * 3600000) - sx(hw.since + h0 * 3600000)).toFixed(1)}" height="${ih}" class="hw-night"/>`;
  const now = hw.liveNow && hw.liveNow > hw.since && hw.liveNow < hw.now ? sx(hw.liveNow) : null;
  // The newest reading of the first line, in a tag above its end.
  const lead = series[0];
  const tagText = `${hwNum(lead.s.kind === 'counter' && lead.s.today != null ? lead.s.today : lead.s.value, lead.s.decimals)}${lead.s.unit ? ' ' + lead.s.unit : ''}`;
  const tagW = 12 + tagText.length * 6.6, tagX = Math.min(W - padR - tagW, Math.max(padL, lead.ex - tagW / 2)), tagY = Math.max(2, lead.ey - 30);
  return `<figure class="hw-chart hw-${esc(group.key.replace(/[^a-z0-9]+/gi, '-'))}">
  <figcaption class="hw-title"><b>${esc(T(group.title))}</b>${unit ? ` <span class="hw-unit">${unit}${group.key === 'power' ? ` · ${T('hourly average')}` : ''}</span>` : ''}</figcaption>
  <svg viewBox="0 0 ${W} ${H}" role="img" aria-label="${esc(T(group.title))} — ${esc(T('today, midnight to midnight venue time, one line per device, on one scale in'))} ${unit || '—'}">
    <defs>${series.map((r) => `
      <linearGradient id="${r.id}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${r.colour}" stop-opacity="${series.length > 1 ? 0.16 : 0.3}"/><stop offset="1" stop-color="${r.colour}" stop-opacity="0"/></linearGradient>`).join('')}
    </defs>
    ${band(0, 6)}${band(22, 24)}
    ${ax.ticks.map((v) => `<line x1="${padL}" y1="${sy(v).toFixed(1)}" x2="${W - padR}" y2="${sy(v).toFixed(1)}" class="hw-grid"/>
      <text x="${padL - 7}" y="${(sy(v) + 3.5).toFixed(1)}" text-anchor="end" class="hw-ax">${yLabel(v)}</text>`).join('')}
    ${ticks.map(({ t, k }) => (k % 3 ? '' : `<text x="${sx(t).toFixed(1)}" y="${H - padB + 16}" text-anchor="${k === 0 ? 'start' : k === ticks.length - 1 ? 'end' : 'middle'}" class="hw-ax"${k % 6 ? ' opacity="0.55"' : ''}>${String(k).padStart(2, '0')}</text>`)).join('')}
    ${unit ? `<text x="${padL - 7}" y="${padT - 12}" text-anchor="end" class="hw-ax hw-ax-unit">${unit}</text>` : ''}
    ${now != null ? `<rect x="${now.toFixed(1)}" y="${padT}" width="${(W - padR - now).toFixed(1)}" height="${ih}" class="hw-ahead"/>
      <line x1="${now.toFixed(1)}" y1="${padT}" x2="${now.toFixed(1)}" y2="${bottom}" class="hw-now"><title>${T('now')} · ${hwClock(hw.liveNow, tz)}</title></line>
      <text x="${now.toFixed(1)}" y="${padT - 12}" text-anchor="middle" class="hw-ax hw-now-t">${hwClock(hw.liveNow, tz)}</text>` : ''}
    ${series.map((r) => `<path d="${r.area}" fill="url(#${r.id})" class="hw-area"/>`).join('')}
    ${series.map((r) => `<path d="${r.d}" class="hw-line" stroke="${r.colour}" style="color:${r.colour}" pathLength="1"><title>${esc(r.s.label)}</title></path>
      ${r.pts.slice(0, -1).map(([x, y]) => `<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="1.8" fill="${r.colour}" class="hw-dot"/>`).join('')}
      <circle cx="${r.ex.toFixed(1)}" cy="${r.ey.toFixed(1)}" r="9" fill="${r.colour}" class="hw-pulse"/>
      <circle cx="${r.ex.toFixed(1)}" cy="${r.ey.toFixed(1)}" r="4.2" fill="${r.colour}" class="hw-end"/>`).join('')}
    <g class="hw-tag"><rect x="${tagX.toFixed(1)}" y="${tagY.toFixed(1)}" width="${tagW.toFixed(1)}" height="20" rx="10" fill="${lead.colour}"/>
      <text x="${(tagX + tagW / 2).toFixed(1)}" y="${(tagY + 13.8).toFixed(1)}" text-anchor="middle">${esc(tagText)}</text></g>
  </svg>
  <ul class="hw-legend">${series.map((r) => `
    <li><i style="background:${r.colour}"></i><span class="hw-name">${esc(r.s.label)}</span><span class="hw-val" style="color:${r.colour}">${reading(r.s)}</span>${
      r.s.kind === 'counter' ? '' : `<span class="hw-range">${T('low')} ${hwNum(r.lo, r.s.decimals)} · ${T('high')} ${hwNum(r.hi, r.s.decimals)}</span>`}</li>`).join('')}
  </ul>
</figure>`;
}

/** The devices sorted onto their charts, in the order they first appear in
 *  content/home-assistant.json; a device keeps its colour by its position
 *  in that list, whichever chart it lands on. Energy meters are not drawn
 *  here: their day's kWh is on the Power panel (content/power.json). */
function hwCharts(hw, tz, T = same) {
  const groups = new Map();
  (hw.sensors || []).forEach((s, i) => {
    const g = hwGroupOf(s);
    if (g.key.startsWith('energy')) return;
    let e = groups.get(g.key);
    if (!e) groups.set(g.key, e = { group: g, members: [] });
    e.members.push({ s, colour: hwColour(i) });
  });
  const charts = [...groups.values()].map((e) => hwChart(hw, e.group, e.members, tz, T)).filter(Boolean);
  return charts.length ? `<div class="hw-charts">${charts.join('')}</div>` : '';
}

/**
 * The power tile's figures: today during the run (a filed figure, or for a
 * category tied to a meter the meter's day — its reading now less its last
 * reading of yesterday), day 1's plan before the run except that a metered
 * category then reads the meter today. Rendered here and by /api/hardware,
 * which the page polls on the hardware's own cycle, so the figure moves with
 * the other readings.
 */
function powerTileInner(ctx, power) {
  const m = ctx.mission, T = ctx.T || same, pre = m.phase === 'PRE_LAUNCH';
  const pwrDay = pre ? 1 : m.clampedDay;
  const pwrOf = power.days[String(pwrDay)] || {};
  const meterNow = (c) => { try { return require('../../lib/home-assistant').counterToday(c.sensor); } catch { return null; } };
  const powerToday = power.categories.map((c) => ({ ...c, kwh: pre && c.sensor ? meterNow(c) : pwrOf[c.key] ?? null }));
  const pwrMetered = power.categories.some((c) => c.sensor);
  const pwrSub = pre
    ? (pwrMetered ? T('Today · before the run') : T('Planned for day 01'))
    : `${T('Today')} · SOL ${String(m.clampedDay).padStart(2, '0')}`;
  return `<span class="sub">${pwrSub} · ${T(pwrMetered ? 'from the meter and the crew' : 'counted by the crew')} · kWh</span>
          ${powerBars(powerToday, T)}`;
}

/**
 * The panel's whole inner HTML: tiles, then the combined chart. Rendered
 * here and by /api/hardware alike, so what the browser swaps in is exactly
 * what the server would have served.
 */
function hardwareInner(hw, T = same) {
  const tz = hwTz();
  const list = hw.sensors || [];
  // The charts are the panel: no tiles, one day chart per kind of quantity
  // (temperature, energy, …), each on a proper axis in its unit, every
  // device a line named at its end with the current reading. The
  // diagnostics the tiles used to carry (a sensor not in the feed) become a
  // note above them.
  const missing = list.filter((s) => s.missing);
  const chart = hwCharts(hw, tz, T);
  return `
    ${hw.down ? `<p class="note hw-down">${L.sym('warn')} ${T('Home Assistant could not be reached on the last poll')}${
      hw.lastPollAt ? ` ${T('at')} ${hwClock(hw.lastPollAt, tz)}` : ''} — ${T('these are the last readings stored.')}</p>` : ''}
    ${hw.frozen ? `<p class="note">${T('The record is closed — the hardware was last read before the end of 27 October 2026.')}</p>` : ''}
    ${missing.length ? `<p class="note">${L.sym('warn')} ${T('Not in the feed:')} ${missing.map((s) => `sensor.${esc(s.id)}`).join(' · ')} — ${T('check the id in content/home-assistant.json.')}</p>` : ''}
    ${chart || `<div class="empty">${T(list.length ? 'WAITING FOR THE FIRST READINGS FROM THE HARDWARE' : 'NO DEVICES CONFIGURED IN CONTENT/HOME-ASSISTANT.JSON')}</div>`}`;
}

/* =============================================================== DASHBOARD */

/** One headline figure of the dashboard's head — its label, the figure with
 *  its unit, the line beneath — set small, in one row under the heading. */
const kpi = ({ label, value, unit, sub, state }) => `
  <span class="dash-fig${state ? ` ${state}` : ''}">
    <span class="dash-fig-k">${esc(label)}</span><b>${value}${unit ? `<em>${esc(unit)}</em>` : ''}</b>${sub ? `<span class="dash-fig-s">${sub}</span>` : ''}
  </span>`;

/** A dashboard panel: code, title and meta in the head, the content beneath. */
const dpanel = ({ id, code, title, meta = '', span = 4, cls = '', href = null, live = null, stop = false }, inner) => `
  <section class="dpanel span-${span} ${cls}"${id ? ` id="${id}"` : ''}${stop ? ' data-stop' : ''}>
    <header class="dpanel-head">
      <div class="dpanel-title"><span class="dpanel-code">${esc(code)}</span><h3>${
        href ? `<a href="${href}">${esc(title)} <span class="dpanel-arrow" aria-hidden="true">→</span></a>` : esc(title)}</h3>${
        live ? `<span class="cloud-live" title="${esc(live)}"><i></i>LIVE</span>` : ''}</div>
      ${meta ? `<span class="dpanel-meta">${meta}</span>` : ''}
    </header>
    <div class="dpanel-body">${inner}</div>
  </section>`;

/* The dashboard's panels behind one index: three rows of keys — the habitat's
   (Habitat, Trends), the day's (Today's Schedule, Today's
   Meal, Crew Moods), the blogs' — each row a track with its name at the left,
   all three of one width, on the head of one glass panel; beneath them the
   folder that is open, showing its panel. The page opens on the first key of
   the first row, the Habitat (which carries the habitat's own hardware too). A press on a key brings that folder to the front
   (public/folder.js); the panels keep their ids, so every link into them —
   #habitat, #crew, #galley, #schedule from the dome's keys and the foot —
   still lands on them: the script opens the right folder and brings the index
   into view. Without the script the first folder stands open and the keys do
   nothing. `rows` is a list of rows, each `{ label, tabs }`; an empty slot (a
   panel the station is not showing, such as the hardware without its bridge)
   is left out of its row. */
/* Each tab's pictogram: 24 × 24 line icons in the dress of the dome's keys
   (src/views/pages/dome.js, LINE_ICONS) — the crew's and the science flask
   are the keys' own, so a key on the dome and the folder it leads to share
   a sign; the rest are drawn here in the same hand. */
const TAB_ICONS = {
  habitat: '<path d="M4 17a8 8 0 0 1 16 0"/><path d="M3 17h18"/><path d="M12 9v8"/><path d="M6.5 12.5h11"/>',                       // the dome, its base line, a rib and a ring
  hardware: '<rect x="7" y="7" width="10" height="10" rx="2"/><path d="M12 3v4M12 17v4M3 12h4M17 12h4"/><path d="M10 10h4v4h-4z"/>',      // a chip with its pins
  trends: '<path d="M3 17l5-6 4 3 5-8 4 5"/><path d="M3 21h18"/>',                                                                  // a line rising across the days
  schedule: '<circle cx="12" cy="12" r="8.5"/><path d="M12 7.5V12l3 2"/>',                                                          // the clock
  galley: '<path d="M7 3v18"/><path d="M5 3v5a2 2 0 0 0 4 0V3"/><path d="M17 3c-2 1.5-3 4-3 7a2 2 0 0 0 2 2h1v9"/>',                   // fork and knife
  crew: LINE_ICONS.crew,
  'blog-commander': '<path d="M4 20l4-1L19 8l-3-3L5 16z"/><path d="M13.5 6.5l3 3"/>',                                               // the pen
  'blog-health': '<path d="M12 20s-7-4.4-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 10c0 5.6-7 10-7 10z"/><path d="M8 12h2l1.5-2.5 2 5L15 12h1.5"/>',   // the heart, a pulse across it
  'blog-science': LINE_ICONS.science,
};
const tabIcon = (id) => TAB_ICONS[id] ? `<svg class="ftab-ic" viewBox="0 0 24 24" aria-hidden="true">${TAB_ICONS[id]}</svg>` : '';

const folder = (T, rows, { id = 'day-folder', label = '' } = {}) => {
  rows = rows.map((row) => ({ label: row.label, tabs: row.tabs.filter(Boolean) })).filter((row) => row.tabs.length);
  const tabs = rows.flatMap((row) => row.tabs);
  const tab = (t, i) => `<button type="button" class="ftab${i === 0 ? ' is-front' : ''}" role="tab" id="ftab-${t.id}" aria-controls="fpage-${t.id}" aria-selected="${i === 0 ? 'true' : 'false'}"${i === 0 ? '' : ' tabindex="-1"'} data-folder="${t.id}">${tabIcon(t.id)}<span class="ftab-n">${esc(t.code)}</span><span class="ftab-l">${esc(t.label)}</span></button>`;
  return `
  <section class="folder span-12" id="${id}" data-stop aria-label="${esc(label)}">
    <div class="folder-tabs">
      <!-- a phone's first row: the groups as a segmented control (aura.css shows it under 760 px only);
           a press opens the group's first folder, and the row of its keys takes the place of the row shown -->
      <div class="fgroups" role="group" aria-label="${esc(label)}">${rows.map((row, r) => `<button type="button" class="fgroup${r === 0 ? ' is-cur' : ''}" data-group="${r}" aria-pressed="${r === 0 ? 'true' : 'false'}">${esc(row.label)}</button>`).join('')}</div>
      <div class="frows" role="tablist" aria-label="${esc(label)}">${rows.map((row, r) => `
      <div class="frow n${row.tabs.length}${r === 0 ? ' is-cur' : ''}" data-group="${r}"><span class="frow-k" aria-hidden="true">${esc(row.label)}</span>${row.tabs.map((t) => tab(t, tabs.indexOf(t))).join('')}</div>`).join('')}
      </div>
    </div>
    <div class="folder-body">${tabs.map((t, i) => `
      <div class="fpage" role="tabpanel" id="fpage-${t.id}" aria-labelledby="ftab-${t.id}" data-folder="${t.id}"${i === 0 ? '' : ' hidden'}>${t.html}</div>`).join('')}
    </div>
  </section>`;
};

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
          sub: pre ? '' : `${sols} ${T(sols === 1 ? 'sol remaining' : 'sols remaining')}` }),
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
     axis. The station's own ingest channels come from here (the habitat
     sensor's channels are added in the browser, which already holds its rows), then each
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



  /* ---- the habitat's own hardware, through Home Assistant — the Cricket
     temperature sensor, the Shelly plug and whatever else is listed in
     content/home-assistant.json — drawn inside the Habitat panel, under the
     node's tiles, the stores and the power. Rendered only when the bridge is
     configured in .env; /public/hardware.js keeps it live from /api/hardware
     (it looks for #hw-live, wherever that stands). */
  const hardwareSection = hardware && hardware.configured && (hardware.sensors || []).length
    ? `<section class="hw-in-habitat" id="hardware">
        <div class="hw-head"><h3>${T('Habitat hardware')}</h3>
          <span class="sub">Home Assistant · ${hardware.sensors.length} ${T(hardware.sensors.length === 1 ? 'device' : 'devices')} · ${T('read by the station every')} ${hardware.pollMs >= 120000 ? `${Math.round(hardware.pollMs / 60000)} min` : `${Math.round(hardware.pollMs / 1000)} s`} · ${T('one point per hour')}</span></div>
        <div class="hbt hw"><div id="hw-live" data-poll="${hardware.pollMs}" data-version="${esc(require('../../lib/home-assistant').version(hardware))}">${hardwareInner(hardware, T)}</div></div>
      </section>`
    : '';

  const habitat = dpanel({ id: 'habitat', code: 'CH-01', title: T('Habitat'), meta: T('Habitat sensor · measured live · figures and stores counted by the crew'), span: 12, cls: 'compact',
    live: T('The readings refresh by themselves as the sensors report') }, `
    <!-- The habitat's instruments. The station server polls the habitat sensor
         (through Home Assistant — or the external node, src/lib/critical.js)
         and stores every reading in its own database; /public/habitat.js draws
         these tiles from /api/habitat/data and refreshes on the station's cycle. -->
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
        <section class="tile t-pres spk">
          <h3>${T('Air pressure')}</h3>
          <span class="sub">${T('Scale')} 950–1050 hPa</span>
          <div class="big" id="presVal" style="margin-top:12px">—<em>hPa</em></div>
          <div id="hbt-pres"></div>
        </section>
        ${figureTile(crewFigures, m, { key: 'calories', label: 'Calories consumed', unit: 'kcal', colour: 'var(--orange)', fmt: (v) => v.toLocaleString('en-GB'), T, crew })}
        ${figureTile(crewFigures, m, { key: 'steps', label: 'Steps taken', unit: T('steps'), colour: 'var(--ink)', fmt: (v) => v.toLocaleString('en-GB'), T, crew })}
        <section class="tile t-iaq lvl">
          <h3>${T('Air quality')}</h3>
          <span class="sub">${T('IAQ index')} · ${T('Scale')} 0–500 · ${T('as the sensor classifies it')}</span>
          <div class="big" id="iaqVal" style="margin-top:12px">—<em>IAQ</em></div>
          <div class="verdict" id="iaqVerdict"></div>
          <div id="hbt-iaq"></div>
        </section>
        <section class="tile t-voc spk">
          <h3>${T('Volatile organic compounds')}</h3>
          <span class="sub">${T('Breath-VOC equivalent')} · ${T('Scale')} 0–10 ppm</span>
          <div class="big" id="vocVal" style="margin-top:12px">—<em>ppm</em></div>
          <div id="hbt-voc"></div>
        </section>
      </div>
      <div class="bento aux">
        <section class="tile t-res">
          <h3>${T('Resources')}</h3>
          <span class="sub">${T('Carried in · never resupplied')}</span>
          ${inventoryGauges(inventory, { cells: true, T })}
        </section>
        <section class="tile t-pwr">
          <h3>${T('Power consumed')}</h3>
          <div id="pwr-live">${powerTileInner(ctx, power)}</div>
        </section>
      </div>
      <div id="hbt-notes"></div>
    </div>
    ${hardwareSection}`);

  /* ---- the newest stills out of the cloud folder, as a strip of their own at
     the head of the dashboard — under its heading, above the two doors (At a
     Glance, Media) — kept live by /public/cloud.js on the folder's cadence. */
  const cloudStrip = cloud ? `<div class="cloud-latest" id="cloud-latest" data-version="${esc(cloud.snapshot.version || '')}" data-poll="${(Number(cloud.snapshot.checkSeconds) || 20) * 1000}">${require('./media').cloudLatestInner(T, cloud, { tz: m.timezone })}</div>` : '';

  /* ---- every trend as a chart: the habitat's channels, each store, the
     crew's counts. habitat.js draws them from the spec above plus its own
     habitat rows, and redraws when the period selector changes. */
  const trends = dpanel({ id: 'trends', code: 'CH-40', title: T('Trends'),
    span: 12 }, `
    <div class="trends" id="hbt-trends" data-date="${esc(m.today)}" data-day-start="${missionLib.venueMidnightUtc(m.today, m.timezone)}" data-axis-start="${esc(axis.start)}" data-axis-end="${esc(axis.end)}" data-axis-run="${axis.run ? '1' : '0'}" data-spec="${esc(JSON.stringify(trendSpec))}">
      <div id="hbt-tcharts"></div>
    </div>`);

  /* ---- the three daily blogs, the front row of the stack of folders: the science
     officer's Daily Science Findings, the health officer's Daily Health Blog
     (the day's health activities) and the Commander Blog — which is the
     communication officer's Daily Blog, under the name the station gives it.
     All three are written in mission control (the Science, Health and
     Communication officer tabs) and are public the moment they are saved, as
     everywhere else on the station.

     Each panel shows the CURRENT DAY's post and nothing else — the day the
     schedule and the meal panels above are showing: today's SOL during the
     run, SOL 01 before it. Earlier days are on the crew log and in At a
     Glance, not here. The post is read where it stands, by scrolling inside
     its panel: a panel's title is not a link and a photograph in a post is
     shown, not linked — nothing in a panel leads off the page, so there is
     nothing to click into and back out of. */
  const blogDay = m.clampedDay;
  const blogDate = (allDays[blogDay - 1] || {}).date || m.today;
  // A post is its rendered body; one that comes out empty — a picture since
  // withdrawn and nothing else — is left out rather than shown as a blank card.
  const post = (body, attached) => MV.entryHtml(body, attached, { lookup: mediaLookup, T, link: false });
  const reportToday = (kind) => ((allDays[blogDay - 1] || {}).notes || [])
    .filter((n) => n.kind === kind).map((n) => post(n.body, [])).filter(Boolean);
  const commander = crew.find((c) => /COMM/i.test(c.designation)) || crew[0] || null;
  const commanderToday = commander ? ((logDays[blogDay - 1] || {}).entries || [])
    .filter((e) => e.blog === 'commander' && !e.placeholder).map((e) => post(e.body, e.media || [])).filter(Boolean) : [];
  // A panel is as tall as the post in it, up to a limit, and scrolls from
  // there (.h-4 and .blog-scroll in the stylesheet) — so with nothing written
  // yet the three make a low row rather than a wall of empty boxes.
  const blogPanel = ({ id, code, title, posts, empty }) => dpanel({ id, code, title, span: 4, cls: 'h-4 blogp',
      meta: `SOL ${day3} · ${esc(shortDay(blogDate))}` },
    // No whitespace inside the card body: it renders with pre-line.
    posts.length ? `<div class="blog-scroll" tabindex="0" role="region" aria-label="${esc(title)}">${
      posts.map((html) => `<div class="card log-entry"><div class="card-body entry-post">${html}</div></div>`).join('')}</div>`
    : `<div class="empty">${T(empty)} SOL ${day3}${pre ? ` — ${T('occupied from')} ${esc(m.startLabel)}` : ''}</div>`);
  const blogScience = blogPanel({ id: 'blog-science', code: 'CH-51', title: T('Daily Science Findings'),
    posts: reportToday('SCIENCE'), empty: 'No science findings yet for' });
  const blogHealth = blogPanel({ id: 'blog-health', code: 'CH-52', title: T('Daily Health Blog'),
    posts: reportToday('HEALTH'), empty: 'No health blog yet for' });
  const blogCommander = blogPanel({ id: 'blog-commander', code: 'CH-53', title: T('Commander Blog'),
    posts: commanderToday, empty: 'No commander blog yet for' });

  const galley = dpanel({ id: 'galley', code: 'CH-32', title: T('Today’s Meal'), meta: today && today.meals.length
      ? `${today.kcalPlanned} kcal · ${today.waterPlanned.toFixed(1)} L · ${today.energyPlanned} Wh${today.co2ePlanned != null ? ` · ${+today.co2ePlanned.toFixed(2)} kg CO₂e` : ''}` : '', span: 4, cls: 'h-3 scroll' },
    today && today.meals.length ? `<div class="meals">${today.meals.map((x) => `
      <div class="meal">
        <span class="meal-slot">${esc(T(slotName[x.slot] || x.slot))}</span>
        <b>${esc(x.name)}</b>
        <span class="meal-figs">${x.kcal} kcal · ${x.water_litres} L · ${x.energy_wh} Wh</span>
        ${L.mealEco(x, T)}
      </div>`).join('')}</div>` : `<div class="empty">${T('No meals filed for today')}</div>`);

  // Each officer with their current condition — the latest state filed from
  // mission control, translated to language in src/lib/mood.js. The slider
  // number itself is never published; only the word and the sentence.
  const crewPanel = dpanel({ id: 'crew', code: 'CH-12', title: T('Crew Moods'),
      meta: T('Condition as reported · never as numbers'), span: 4, cls: 'h-3 scroll' },
    `<div class="officers">${crew.map((c) => {
      const t = moodLib.translate(c.mood);
      // The face mission control filed — the nearest of its five, calm to
      // angry — stands beside the name (a blank face while nothing is filed).
      const face = c.mood ? moodLib.FACES.reduce((best, f) => (Math.abs(f.v - c.mood.calm_tense) < Math.abs(best.v - c.mood.calm_tense) ? f : best), moodLib.FACES[0]) : null;
      return `<div class="officer">
        <span class="officer-face band-${face ? moodLib.FACES.indexOf(face) : 'none'}" aria-hidden="true">${face ? moodLib.faceSvg(face) : moodLib.faceSvg({ mouth: 'M11 20 h10', eyes: 'dot' })}</span>
        <div class="officer-id">
          <b>${esc(c.designation)}</b>
          <span class="officer-role">${esc(c.role)}</span>
        </div>
        <span class="badge${c.mood ? ' ok' : ''}">${esc(T(t.condition))}</span>
        <div class="officer-note">${c.mood ? esc(T(t.lines[0])) : T('No state filed yet')}</div>
      </div>`;
    }).join('')}</div>`);

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
    <header class="dash-head" data-stop>
      <div>
        <span class="dash-code">CH-00</span>
        <h2 class="bigsec">${T('Mission dashboard')}</h2>
        <p class="dash-sub">${esc(m.name)} · ${esc(m.runLabel)} · ${dayWord(T, m.totalDays)} · ${esc(m.timezone)}</p>
        <p class="dash-figs">${kpis}</p>
      </div>
    </header>
    ${cloudStrip}
    <!-- the two doors and, beside them, the run as a strip of sols -->
    <div class="dash-links">
      <a class="glance-link" href="/at-a-glance" title="${esc(T('The whole mission, day by day — blogs, meals, consumption, habitat, crew condition and every exchange'))}">
        <span class="glance-link-title">${T('At a Glance')}</span>
        <span class="glance-link-arrow">-&gt;</span>
      </a>
      <a class="glance-link media-link" href="/media" title="${esc(T('Photographs and video — the gallery, and everything the crew send out of the habitat'))}">
        <span class="glance-link-title">${T('Media')}</span>
        <span class="glance-link-arrow">-&gt;</span>
      </a>
      ${strip}
    </div>
    <div class="dash-grid">
      ${folder(T, [
        { label: T('Habitat'), tabs: [
          { id: 'habitat', code: 'CH-01', label: T('Habitat'), html: habitat },
          { id: 'trends', code: 'CH-40', label: T('Trends'), html: trends } ] },
        { label: T('Today'), tabs: [
          { id: 'schedule', code: 'CH-30', label: T('Today’s Schedule'), html: schedule },
          { id: 'galley', code: 'CH-32', label: T('Today’s Meal'), html: galley },
          { id: 'crew', code: 'CH-12', label: T('Crew Moods'), html: crewPanel } ] },
        { label: T('Blogs'), tabs: [
          { id: 'blog-commander', code: 'CH-53', label: T('Commander Blog'), html: blogCommander },
          { id: 'blog-health', code: 'CH-52', label: T('Daily Health Blog'), html: blogHealth },
          { id: 'blog-science', code: 'CH-51', label: T('Daily Science Findings'), html: blogScience } ] },
      ], { label: `${T('Mission dashboard')} · SOL ${day3} · ${shortDay(blogDate)}` })}
    </div>
  </section>`;
}

/* ================================================================== BOARD */

/**
 * One exchange as a card: the visitor's message in a shaded box — one line
 * of small print above it with its tags, the callsign, Earth and the time
 * it was sent, the reference number at the right — and beneath the box the
 * crew's answer, large, under the words CREW ANSWER, with the officer, the
 * habitat and the time it left Mars in small print under it. A message not
 * yet answered shows its state — in transit, reached Mars — where the answer
 * will stand. Drawn on the board (mission page, messages page) and, after
 * the run, among the last exchanges on the closing page; styled under *the
 * exchanges* in aura.css.
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

/** `T` puts the card's chrome — the state, Earth, CREW ANSWER, the tags —
 *  into the visitor's language. The archive passes nothing and gets
 *  English; what was written is never touched either way. */
function messageCard(m, tz, T = same) {
  const fresh = m.response_at && (Date.now() - Date.parse(m.response_at)) < 6 * 3600000;
  const tags = (m.tags || '').split(',').filter(Boolean);
  const st = cardStatus(m);
  const short = (label) => label.replace(/^[A-Za-z]{2,3} /, '');                    // the day and the time, without the weekday
  const sent = short(whenLabel(m.submitted_at, tz)), replied = m.response_body ? short(whenLabel(m.response_at, tz)) : '';
  const home = (() => { try { return missionLib.config().name; } catch { return ''; } })() || T('Mars habitat');
  const meta = tags.map((t) => '#' + esc(T(t))).concat(
    `<span class="cs">${esc(m.callsign)}</span>`, T('Earth'), `<time datetime="${esc(m.submitted_at)}">${esc(sent)}</time>`).join(' · ');
  // A card that is both the viewer's and unpublished is stamped data-pending:
  // the stylesheet keeps it out of the common board and board.js reveals it
  // under MY MESSAGES. Such cards only ever reach their own sender's page.
  return `<article class="card xc${fresh ? ' fresh' : ''}${m.response_body ? ' has-reply' : ''}" id="m${m.id}"
      data-tags="${esc(tags.join(','))}"${m.mine ? ' data-mine="1"' : ''}${
      m.mine && m.pending ? ' data-pending="1"' : ''}>
    <div class="card-post">
      <div class="card-top">
        <span class="card-meta">${meta}</span>
        ${fresh ? `<span class="badge new">${T('New')}</span>` : ''}
        <span class="card-ref">Ref ${String(m.id).padStart(5, '0')}</span>
      </div>
      <div class="card-body">${esc(m.body)}</div>
    </div>
    ${m.response_body ? `<div class="card-reply">
      <div class="who">${T('Crew answer')}</div>
      <p>${esc(m.response_body)}</p>
      <div class="card-reply-meta">${esc(m.responder ? T(m.responder) : T('Mars habitat'))} · ${esc(home)} · <time datetime="${esc(m.response_at)}">${esc(replied)}</time></div>
    </div>` : `<div class="card-state-line"><span class="badge card-state ${st.cls}">${T(st.label)}</span></div>`}
    <div class="card-foot">
      <span>${orbital.formatLightTime(m.light_seconds)}</span>
      <span>${m.distance_au.toFixed(2)} au</span>
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
  mission, messages, dashboardPage, complete, inventoryGauges, boardCards, boardVersion, archive, single, messageCard,
  hardwareInner, powerTileInner, ticker,
};
