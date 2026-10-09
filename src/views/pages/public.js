'use strict';
const L = require('../layout');
const { esc, panel, eyebrow, orbitPlot, pipeline } = L;
const orbital = require('../../lib/orbital');
const data = require('../../lib/data');
const { TAGS } = data;
const { composerBlock } = require('./communicate');
const { habitatDome, LINE_ICONS } = require('./dome');
const { habitatSky } = require('./sky');
const LP = require('./landing');
const MV = require('./media');
const mediaGet = require('../../lib/media').get;
const moodLib = require('../../lib/mood');
const { shortDay } = require('../../lib/mission');

const fmtTime = (iso) => new Date(iso).toISOString().slice(11, 16) + ' UTC';
const missionLib = require('../../lib/mission');
const officer = require('../../lib/officer');
/* English through, for the places that have no visitor: the archive. */
const same = require('../../lib/i18n').plain;                 // the English, where no T is given (a key's sense after '::' left out)
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
    <p><a class="btn" href="/archive">${T('Read the archive')}</a><a class="btn" href="/about">${T('About the project')}</a></p>
  </div>

  <div class="grid g-hero">
    ${orbitPlot(ctx.geo, { T, light: false })}
    ${panel('RECORD', `
      ${eyebrow(T('What the station carried'))}
      <dl class="kv">
        <dt>${T('MISSION')}</dt><dd>${esc(m.name)}</dd>
        <dt>${T('DURATION')}</dt><dd>${dayWord(T, m.totalDays)}</dd>
        <dt>${T('EXCHANGES')}</dt><dd>${counts.published} ${T('published')}</dd>
      </dl>
      <p class="note" style="margin-top:16px">${T('The communication channel is closed. The archive is not — it stays readable, and it stays part of the work.')}</p>`, 'earth-side')}
  </div>

  ${panel('LAST EXCHANGES', recent.length
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
  // carried in, the figure in the centre, the name beneath — large, and no
  // count of days under it (October: "remove the days count and make the
  // layout bigger to show the text clearly").
  // A store with no figure at all yet — nothing carried in written into
  // content/crew-and-inventory.json and no count filed on the Habitat tab —
  // stands dimmed, its ring empty and a dash for its figure, rather than as an
  // empty store; it carries no word for it.
  const placeholder = (i) => !(i.start_quantity || i.quantity);
  if (cells) {
    const R = 24, C = 2 * Math.PI * R;
    return `<div class="gauges rounds">${shown.map((i) => {
      const ph = placeholder(i);
      const start = i.start_quantity || i.quantity || 1;
      const startLabel = (i.start_quantity || i.quantity) ? start : '—';   // a 0 placeholder reads "of —", not "of 1"
      const pct = ph ? 0 : Math.max(0, Math.min(100, (i.quantity / start) * 100));
      const low = !ph && i.warn_below > 0 && i.quantity <= i.warn_below;
      const num = Number.isInteger(i.quantity) ? String(i.quantity) : i.quantity.toFixed(1);
      return `<div class="gauge round ${low ? 'low' : ''}${ph ? ' is-ph' : ''}" title="${esc(i.label)}${ph ? '' : `: ${i.quantity} ${esc(i.unit)} ${T('of')} ${startLabel}`}">
        <svg viewBox="0 0 60 60" aria-hidden="true">
          <circle cx="30" cy="30" r="${R}" class="round-track"/>
          <circle cx="30" cy="30" r="${R}" class="round-arc" stroke-dasharray="${C.toFixed(1)}"
            stroke-dashoffset="${(C * (1 - pct / 100)).toFixed(1)}" transform="rotate(-90 30 30)"/>
          <text x="30" y="33.5" class="round-num">${ph ? '—' : num}</text>
          <text x="30" y="44" class="round-unit">${ph ? '' : esc(i.unit)}</text>
        </svg>
        <span class="cell-name">${esc(i.label)}</span>
      </div>`;
    }).join('')}</div>`;
  }
  return `<div class="gauges${strip ? ' strip' : ''}">${shown.map((i) => {
    const ph = placeholder(i);
    const start = i.start_quantity || i.quantity || 1;
    const startLabel = (i.start_quantity || i.quantity) ? start : '—';   // a 0 placeholder reads "of —", not "of 1"
    const pct = ph ? 0 : Math.max(0, Math.min(100, (i.quantity / start) * 100));
    const low = !ph && i.warn_below > 0 && i.quantity <= i.warn_below;
    const daysLeft = i.consumption > 0 ? i.quantity / i.consumption : null;
    return `<div class="gauge ${low ? 'low' : ''}${ph ? ' is-ph' : ''}">
      <div class="gauge-head">
        <span class="gauge-name">${esc(i.label)}</span>
        <span class="gauge-val">${ph ? '<span class="is-ph">—</span>' : `${i.quantity}<em>${esc(i.unit)}</em>`}</span>
      </div>
      <div class="gauge-track"><i style="width:${pct.toFixed(1)}%"></i></div>
      <div class="gauge-foot">
        <span>${ph ? '' : `${pct.toFixed(0)}% ${T('of')} ${startLabel} ${esc(i.unit)}`}</span>
        <span>${ph ? '' : left(daysLeft, 1)}</span>
      </div>
    </div>`;
  }).join('')}</div>`;
}

/**
 * Power consumed inside the habitat, one day, by channel — the eight metered
 * channels, crickets, science 1 and 2, living, table, food, water and
 * hydroponics, as content/power.json shapes them (each category reads its
 * energy meter, habitat_power_<channel>_energie, in kWh). A bar per category
 * against the day's biggest draw, the figure at its end, the day's total
 * underneath. A day nothing has been read or filed for says so rather than
 * showing zeros: an uncounted day and a day of no draw are not the same
 * thing.
 */
function powerBars(categories, T = same) {
  const filed = categories.filter((c) => c.kwh != null);
  if (!filed.length) {
    const metered = categories.filter((c) => c.sensor).length;
    return `<div class="empty" style="margin-top:10px">${T(metered > 1 ? 'No reading from the meters yet today, and nothing filed by the crew' : metered ? 'No reading from the meter yet today, and nothing filed by the crew' : 'Nothing filed for this day — the crew count the day’s power as it ends')}</div>`;
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
 * A crew figure — the steps taken — plotted across the whole mission. Drawn
 * as a real graph — gridlines, a value axis, a day axis and a plotted line
 * with a point per day — because the question the figure answers is what
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
 * where it sits inside its limits, the status beneath.
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
    <div class="dial-foot">${sym(st.state)}</div>
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
        ${d.meals.map((m) => `<b style="color:var(--ink)">${esc(L.slotName(T, m.slot))}</b> ${esc(m.name)}`).join(' · ')}
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
 * vents, then the operator's callsign and the channel — and, over the
 * writing box, the day's question from the habitat: the question for the
 * community hour on the day's mission sheet (content/missions.json), in the
 * visitor's language where the sheet has it (English and German; the other
 * where not), as a prompt to write. While a message is crossing, the form
 * gives way to the dial (composerBlock, composer.js). Drawn on the mission
 * page and on the messages page alike.
 */
function composerPrompt(ctx) {
  const T = ctx.T;
  let mission = null;
  try { mission = require('../../lib/content').missionForDay(ctx.mission.clampedDay); } catch { mission = null; }
  const c = mission && mission.community ? mission.community : null;
  const q = c ? (ctx.lang === 'de' ? c.de || c.en : c.en || c.de) : '';
  if (!q) return '';
  return `
        <div class="dev-prompt" id="dev-prompt">
          <span class="dev-prompt-k">${T('The crew’s question today')}</span>
          <p class="dev-prompt-q"${ctx.lang !== 'de' && c.de && !c.en ? ' lang="de"' : ''}>${esc(q)}</p>
          <span class="dev-prompt-n">${T('Answer it below — or ask the crew something of your own.')}</span>
        </div>`;
}
function composerDevice(ctx, { inFlight = null, error = null, draft = '', kiosk = '', meta = false } = {}) {
  const T = ctx.T;
  // `meta`: the Write page's pop-up says, in its head, the one-way signal a message is about to cross and the distance.
  // The head names no operator and no callsign on the site (October: "remove the operator name") — only the writing
  // screen's keeps OPERATOR · BODENSTATION; the callsign a visitor writes under is on the cookie card and on the board
  // (the word in the head is Transmit, 8 October — the word the station used before it is gone from every page)
  const signal = meta ? `<span class="dev-signal" title="${esc(T('One-way signal'))}"><span class="dev-sig-k">${T('Transmit')}</span> · ${T('One-way signal')} <b>${esc(orbital.formatLightTime(ctx.geo.lightSeconds))}</b> · ${ctx.geo.distanceAu.toFixed(3)} au</span>` : `<span class="dev-chan">${T('Transmit')}</span>`;
  return `<section class="device composer-device${inFlight ? ' sending' : ''}" aria-label="${esc(T('Composer'))}">
        <h2 class="dev-title" id="dev-title">${T('Write to the crew')}</h2>
        <button type="button" class="dev-close" aria-label="${esc(T('Close'))}" title="${esc(T('Close'))}"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18"/></svg></button>
        <span class="dev-led" aria-hidden="true"></span>
        <span class="dev-grip" aria-hidden="true"></span>
        <span class="dev-vents" aria-hidden="true"></span>
        <div class="dev-head${kiosk ? '' : ' is-bare'}">${kiosk ? `
          <span>${T('Operator')}</span>
          <span class="dev-chip" title="${esc(T('Your callsign for this visit — no account, no name'))}">${esc(ctx.callsign || ctx.offer || T('Callsign on sending'))}</span>` : ''}
          ${signal}
        </div>${composerPrompt(ctx)}
        <div class="dev-body" id="dev-body"${kiosk ? ` data-kiosk="1" data-refresh="/screen/write/composer?lang=${esc(kiosk)}"` : ''}>${composerBlock(ctx, { inFlight, error, draft, kiosk })}</div>
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
/* (The installation's boards — the board screen, the ground station's beside its composer — carry the Write page's
   notes since 9 October: "make the messages in /screen/board look like the message board in the main site" — noteCard,
   drawn for a room in screen.css; their poll asks /api/board for the same, &wall=1. Nothing on them is tappable.) */
function boardScreen(ctx, { recent = [], poll = '/api/board' } = {}) {
  const T = ctx.T;
  // This visitor's messages that mission control has not yet published —
  // in the page among the rest, counted on the MY MESSAGES chip.
  const pendingMine = recent.filter((m) => m.mine && m.pending).length;
  const openOnMine = false;   // ALL opens first
  // the page polls /api/board for the same cards it was drawn with (the installation's board screen names its own
  // address: its language and its nine cards — views/pages/screens.js)
  return `<div class="feed-wrap"><div class="feed-scroll" id="feed" data-poll="${esc(poll)}" data-open="${ctx.mission.open ? 1 : 0}"
          data-version="${boardVersion(recent)}">
        <div class="screen board">
          <div class="board-head">
            <h2>${T('Message Board')}</h2>
            <span class="live" id="feed-live" title="${esc(T('The board refreshes itself every few seconds'))}">${T('LIVE')}</span>
          </div>
          <div class="scroller feed"><div class="cards" id="feed-cards">${boardCards(recent, T, { wall: true })}
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
    crew: d.crew, today: d.today, counts: d.counts, crewFigures: d.crewFigures, bike: d.bike, power: d.power, allDays: d.allDays,
    logDays: d.logDays, entryCounts: d.entryCounts, ingest: d.ingest, media: d.media, mediaCounts: d.mediaCounts,
    mediaLookup: d.mediaLookup, hardware: d.hardware, hardwareDaily: d.hardwareDaily, cloud: d.cloud, mission: d.mission,
    // NOW before the run, as the screens have it: its blogs for the three blog panels, its day for the trends (9 October)
    nowLog: d.nowLog, nowDay: d.nowDay,
  });
  return L.page({
    title: 'Mission dashboard', ctx, body, hideNav: true, hideRail: true, bodyClass: 'landing inner dashboard', masthead: false,
    current: '/dashboard', scripts: ['/habitat.js', '/hardware.js', '/folder.js', '/live.js'].concat(d.cloud ? ['/cloud.js'] : []),
    styles: ['/aura.css'],
  });
}

/**
 * The ticker across the very top of the station: the habitat's clock and a
 * slowly running line of what is happening in there right now — the current
 * task from the day's schedule, the one after it, and the node's current
 * readings. The line is rendered twice and scrolled by CSS so it runs
 * continuously; a small script keeps the clock ticking, moves to the next
 * task as its time comes, and refreshes the readings on the node's cycle.
 * Under prefers-reduced-motion it stands still on a desk and drifts more
 * slowly on a phone (aura.css), where it is how the station says what is
 * happening now.
 */
/* The habitat's latest reading, for the running line: its temperature, humidity and CO₂ while the newest reading is
   current — a quarter of an hour for the habitat sensor, half an hour for the node (critical.js, staleMs) —, "no current
   reading" else. Written into the page with it and sent again with the schedule
   (/api/ticker, every five minutes), so no page fetches the day's readings for one line (8 October: "the website is very
   heavy to load" — it was a day of readings, some 200 kB, on every page). */
function habReading(ctx) {
  const T = ctx.T || ((s) => s);
  let last = null, stale = 15 * 60 * 1000;
  try { const critical = require('../../lib/critical'); last = critical.lastStored(); stale = critical.staleMs(); } catch { last = null; }
  if (!last || !(Date.now() - last.t <= stale)) return T('no current reading');
  const bits = [];
  if (last.temp != null && Number.isFinite(Number(last.temp))) bits.push(Number(last.temp).toFixed(1) + ' °C');
  if (last.hum != null && Number.isFinite(Number(last.hum))) bits.push(Math.round(Number(last.hum)) + ' %');
  if (last.co2 != null && Number.isFinite(Number(last.co2))) bits.push('CO₂ ' + Math.round(Number(last.co2)) + ' ppm');
  return bits.length ? bits.join(' · ') : T('no current reading');
}

function ticker(ctx, { today } = {}) {
  const m = ctx.mission, T = ctx.T;
  const pre = m.phase === 'PRE_LAUNCH', over = m.phase === 'COMPLETE';
  // On the inner pages (layout.js draws the ticker there too) the day's
  // schedule is read here.
  if (today === undefined) today = m.phase === 'ACTIVE' ? data.day(m.clampedDay) : null;
  const tasks = (today && today.tasks ? today.tasks : []).map((t) => ({ time: t.time, label: t.label, detail: t.detail || '' }));
  const hm = m.venueTime.slice(0, 5);
  let nowTask = null, nextTask = null;
  for (const t of tasks) { if (t.time <= hm) nowTask = t; else if (!nextTask) nextTask = t; }
  const cells = [];
  // the opening day in the visitor's language — Thu 15 Oct 2026, Do., 15. Okt. 2026, jeu. 15 oct. 2026
  const opensOn = ctx.lang === 'de' || ctx.lang === 'fr'
    ? new Date(m.start_date + 'T12:00:00Z').toLocaleDateString(ctx.lang === 'de' ? 'de-DE' : 'fr-FR', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' })
    : m.startLabel;
  if (pre) cells.push(`<b id="tk-count">T−${m.countdown.days}d ${String(m.countdown.hours).padStart(2, '0')}:${String(m.countdown.minutes).padStart(2, '0')}:${String(m.countdown.seconds).padStart(2, '0')}</b> ${T('to occupation')} · ${T('opens')} ${esc(opensOn)}`);
  else if (over) cells.push(`<b>${T('Mission complete')}</b> · ${T('the record stays')}`);
  else {
    cells.push(`<b>SOL ${String(m.clampedDay).padStart(2, '0')}/${String(m.totalDays).padStart(2, '0')}</b>`);
    const say = (t) => `${esc(t.time)} · ${esc(t.label)}${t.detail ? ` — ${esc(t.detail)}` : ''}`;
    cells.push(`${T('The crew are currently:')} <b id="tk-now">${nowTask ? say(nowTask) : T('off the schedule')}</b>`);
    cells.push(`${T('Next:')} <b id="tk-next">${nextTask ? say(nextTask) : T('nothing more today')}</b>`);
  }
  cells.push(`${T('Habitat:')} <b id="tk-hab">${esc(habReading(ctx))}</b>`);   // the one-way signal is read where a message is written, and nowhere else
  if (!over) cells.push(`${T('Communication window daily')} <b>${esc(LP.windowWhen(ctx))}</b>`);   // when the crew answer — "19:00 CET" (landing.js)
  const line = cells.map((c) => `<span class="tk-cell">${c}</span>`).join('<span class="tk-sep">·</span>');
  /* The header of every public page, after the design handoff's reference sheet: a row with the wordmark (the way home),
     the run's badge — the countdown before it, the sol during it —, and in the middle of the row the station's three ways
     on — Write to the crew (the Write page, /write), Live Mission Dashboard (/dashboard) and About (/about) —, then the
     theme and language switches at its right end (no clock); under it the running line. The three links are
     a wider screen's: a phone held upright has its bar of keys at the foot for the same ways (sheet.css hides them there),
     and a screen in the square shows none of them (screen.css). No menu: the reading matter is one page, /about. */
  // the three keys, each with its sign in the line-icon hand of the dome's keys: the pen, the four panels, the i — the
  // Write key in Mars, the station's primary colour (the Write link opens the Write page's pop-up)
  const ways = [
    ['/write#write', 'Write to the crew', 'tk-write', '<path d="M4 20l4-1L19 8l-3-3L5 16z"/><path d="M13.5 6.5l3 3"/>'],
    ['/dashboard', 'Live Mission Dashboard', 'tk-dash', '<rect x="4" y="4" width="7" height="7" rx="1.5"/><rect x="13" y="4" width="7" height="7" rx="1.5"/><rect x="4" y="13" width="7" height="7" rx="1.5"/><rect x="13" y="13" width="7" height="7" rx="1.5"/>'],
    ['/about', 'About', 'tk-about', '<circle cx="12" cy="12" r="8.5"/><path d="M12 11v5"/><path d="M12 7.5v.5"/>'],
  ];
  const here = ctx.current || '';
  const nav = `<nav class="tk-nav" aria-label="${esc(T('The station, page by page'))}">${ways.map(([href, label, cls, icon]) =>
    `<a class="${cls}" href="${href}"${here && href.replace(/#.*$/, '') === here ? ' aria-current="page"' : ''}><svg class="tk-ic" viewBox="0 0 24 24" aria-hidden="true">${icon}</svg><span>${esc(T(label))}</span></a>`).join('')}</nav>`;
  return `
  <header class="ticker"
       data-tz="${esc(m.timezone)}" data-tasks="${esc(JSON.stringify(tasks))}"${over ? ' data-over="1"' : ''}
       data-phase="${esc(m.phase)}" data-opens="${esc(m.opensAt)}" data-epoch="${esc(String(require('../../lib/content').resetEpoch() || ''))}">
    <div class="tk-bar">
      <a class="tk-brand" href="/" aria-label="MARS!platz">MARS<span class="bang">!</span>platz</a>
      <span class="tk-sol"><i aria-hidden="true"></i>${pre ? `T−${m.countdown.days}d` : over ? T('Complete') : `SOL ${String(m.clampedDay).padStart(2, '0')}/${String(m.totalDays).padStart(2, '0')}`}</span>
      ${nav}
      <div class="tk-right">${L.statusStrip(ctx)}</div>
    </div>
    <div class="tk-window" role="marquee" aria-label="${esc(T('What is happening in the habitat'))}"><div class="tk-track" id="tk-track"><div class="tk-line">${line}</div><div class="tk-line" aria-hidden="true">${line}</div></div></div>
  </header>
  <script>
  (function () {
    // The running line on a phone is moved by the page itself, a little every frame, rather than left to the stylesheet's
    // animation: a phone's browser has more than one way of holding a CSS animation still — a tap leaves the line
    // "hovered", the setting for less motion stops it, a saver mode or an old stylesheet in the cache can too — and on a
    // phone the line is how the station says what is happening now. It keeps a steady pace whatever the line's length, a
    // gentler one where less motion is asked for; it rests while the page is out of sight. A wider screen keeps the
    // stylesheet's animation, which holds while a mouse rests on the line.
    var track = document.getElementById('tk-track');
    if (!track || !window.matchMedia || !window.requestAnimationFrame) return;
    var phone = window.matchMedia('(max-width: 760px), (max-height: 520px)');
    var calm = window.matchMedia('(prefers-reduced-motion: reduce)');
    var x = 0, last = 0, raf = 0, on = false, span = 0, age = 0;
    function length() { var line = track.firstElementChild; return line ? line.getBoundingClientRect().width : 0; }   // one copy of the line
    function frame(t) {
      raf = requestAnimationFrame(frame);
      var dt = last ? Math.min(100, t - last) : 0; last = t;
      if (!span || ++age > 60) { span = length(); age = 0; }          // the line changes as the clock and the schedule do
      if (!span) return;
      x -= (calm.matches ? 16 : 28) * dt / 1000;                        // pixels a second
      if (-x >= span) x += span;                                        // the second copy has come to where the first began
      track.style.transform = 'translate3d(' + x.toFixed(2) + 'px,0,0)';
    }
    function set() {
      if (phone.matches === on) return;
      on = phone.matches;
      if (on) { track.style.setProperty('animation', 'none', 'important'); last = 0; span = 0; raf = requestAnimationFrame(frame); }
      else { cancelAnimationFrame(raf); track.style.removeProperty('animation'); track.style.transform = ''; x = 0; }
    }
    set();
    if (phone.addEventListener) phone.addEventListener('change', set); else if (phone.addListener) phone.addListener(set);
    document.addEventListener('visibilitychange', function () { last = 0; });
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
    // (the habitat's clock is no longer in the bar; the running line keeps the habitat's time where it says it)
    // After the run nothing is updated by automation: the schedule and the readings are never asked for again.
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
        // the habitat's latest reading comes with the schedule (habReading)
        if (typeof d.hab === 'string' && d.hab) all('[id="tk-hab"]').forEach(function (n) { n.textContent = d.hab; });
      }).catch(function () { /* next time */ });
    }
    // every five minutes; every ten seconds in the last minute before the run
    timers.push(setInterval(function () {
      var left = opens ? opens - Date.now() : Infinity;
      if (left < 60000) refetch();
    }, 10000));
    timers.push(setInterval(refetch, 5 * 60 * 1000));
  })();
  </script>`;
}

function mission(ctx, { sensors, crew, today, counts, recent, latestEntries = [], crewFigures = {},
                        power = { categories: [], days: {} },
                        inFlight = null, error = null, draft = '',
                        allDays = [], logDays = [], entryCounts = { published: 0, days: 0 }, ingest = [],
                        media = [], mediaCounts = { total: 0, bytes: 0 }, mediaLookup = () => null,
                        hardware = null, hardwareDaily = [], cloud = null, mission = null }) {
  const pre = ctx.mission.phase === 'PRE_LAUNCH', T = ctx.T;
  /* The header every public page shares (ticker): the wordmark, the run's badge, the habitat's clock, the switches, the
     running line. */
  const hero = ticker(ctx, { today });

  /* The landing page (landing.js): first the way to the habitat — the Earth, the line up to the habitat, and around
     it the sky of the latest exchanges and the newest pictures from the cloud folder, the scroll nudge on the Earth —
     with the name over it on a wider screen; the second page (landing.js, note — a phone has the name at its head): the
     note, and under it the two calls, SEND A MESSAGE TO THE CREW, approved messages are beamed into space, and FOLLOW
     WHAT THE CREW IS DOING — LIVE; the world's slowest chat. The composer is the pop-up every public page carries
     (layout.js, writeKit): the Write doors here (#write) open it over the page on a wider screen, and lead a phone to
     the Write page's dock (tabbar.js); the board is on the Write page (/write, writePage below), the mission dashboard
     on its own page (/dashboard). On a phone every data-page is a page of the scroll: a swipe goes to the next (sheet.css,
     public/sky.js). (The habitat in section — inside.js, habitatInside: the picture with every module a key — stands on
     the About page, before Who we are; the dome with its floating keys — dome.js, habitatDome — and the earlier cutaway
     — cutaway.js, public/cutaway.js — are not drawn any more; the code stays, in case the run wants either back; the
     dome's figures() still write every pop-up's sentences and /api/dome.) */
  const body = `
  <script>
  // the reading matter was three pop-ups over this page once, opened from the address: those addresses — /#about,
  // /#about-project, /#what, /#who-we-are — lead to the About page, where it is now; by way of /about?from=home, which no
  // browser can have kept as the permanent redirect back to /#about that /about used to be. The board is on the Write
  // page (/#exchanges leads to the wall; /#write opens the pop-up here, as on every page) and the dashboard on its own
  // page: /#mission and every panel of it lead to /dashboard.
  (function () { var h = location.hash; if (/^#(about|about-project|what|inside|who-we-are)$/.test(h)) location.replace('/about?from=home' + (h === '#about' || h === '#what' ? '' : h));
    else if (h === '#exchanges') location.replace('/write' + h);
    else if (/^#(mission|mission-today|habitat|sensors|stores|power|hardware|trends|schedule|galley|crew|blog-commander|blog-health|blog-science)$/.test(h)) location.replace('/dashboard' + h); })();
  </script>
  ${LP.space(ctx, { sky: habitatSky(ctx, { recent, cloud }) })}
  ${LP.note(ctx, { crew: (crew || []).length || 3 })}
  ${LP.slowChat(ctx)}
  `;
  return L.page({
    title: 'Mission', ctx, body, hero, hideNav: true, hideRail: true, bodyClass: 'landing',
    current: '/', scripts: ['/live.js', '/sky.js'],   // the page scrolls freely: no stops
    styles: ['/aura.css'],
  });
}

/**
 * The composer's pop-up (`#write`), on every public page (layout.js, writeKit): the composer device, with the callsign
 * and the one-way signal in its head, in a box that opens over the page at the foot of the window, at the right
 * (public/write.js on a wider screen: the floating Write key, a #write door and /write#write open it, its cross, Escape
 * or a click beside it close it; the message's crossing plays in it, with a Message Board key to the wall, and on the
 * Write page it closes by itself once the message has arrived). A phone has the box as the Write page's dock at the
 * foot of the screen (tabbar.js) and nothing of it elsewhere.
 */
function portal(ctx, { inFlight = null, error = null, draft = '' } = {}) {
  const T = ctx.T;
  return `
  <section class="portal portal-pop" id="write" data-stop role="dialog" aria-modal="false" aria-labelledby="dev-title" aria-label="${esc(T('Write to the crew'))}">
  <div class="portal-grid">
    <div class="portal-main">${composerDevice(ctx, { inFlight, error, draft, meta: true })}</div>
  </div>
  </section>`;
}

/**
 * The board as a wall of notes (the Write page, under the composer): the exchanges as cards on the page's ground — three
 * across on a wide screen, two on a narrower one, one on a phone, each row starting level — the newest first, flowing with
 * the page and never in a box. The first BOARD_PAGE exchanges are drawn here; as the reader nears the end, board.js
 * fetches the page before them (/api/board?before=) and lays it on, until the beginning of the correspondence
 * (`more` says whether there is anything older than this first page). Over the cards a bar that stays under the header:
 * the board's name and its LIVE mark, the count, the chips that narrow the wall (ALL, MY MESSAGES, a tag). The
 * viewer's own messages stand among the rest, whatever their state.
 */
function boardWall(ctx, { recent = [], more = false, poll = '/api/board?limit=20' } = {}) {
  const T = ctx.T;
  const pendingMine = recent.filter((m) => m.mine && m.pending).length;
  const counts = data.counts();
  return `<div class="feed-wrap wall-wrap"><div class="feed-scroll" id="feed" data-poll="${esc(poll)}" data-open="${ctx.mission.open ? 1 : 0}"
          data-version="${boardVersion(recent)}" data-more="${more ? 1 : 0}" data-wall="1">
        <div class="board wall">
          <div class="wall-bar" id="feed-bar">
            <div class="board-head">
              <h2>${T('Message Board')}</h2>
              <span class="live" id="feed-live" title="${esc(T('The board refreshes itself every few seconds'))}">${T('LIVE')}</span>
              <span class="wall-count" id="feed-counter">${counts.published} ${T('exchanges')} · ${counts.total} ${T('sent')}</span>
            </div>
            <div class="feed-filter" id="feed-filter" role="group" aria-label="${esc(T('Filter the board'))}"${
            recent.length ? '' : ' hidden'}>
            <button type="button" class="chip active" data-filter="">${T('ALL')}</button>
            <button type="button" class="chip mine" data-filter="mine">${T('MY MESSAGES')} <span
              class="chip-count" id="feed-mine-count"${pendingMine ? '' : ' hidden'}>${pendingMine}</span></button>
            ${TAGS.map((t) => `<button type="button" class="chip" data-filter="tag:${t}">#${T(t)}</button>`).join('')}
            </div>
          </div>
          <div class="cards" id="feed-cards">${boardCards(recent, T, { wall: true })}
            <div class="empty" id="feed-empty"${recent.length ? ' style="display:none"' : ''}
              data-none="${esc(T('Nothing transmitted yet — the first message could be yours'))}"
              data-filtered="${esc(T('No messages match this filter'))}">${
              T(recent.length ? 'No messages match this filter' : 'Nothing transmitted yet — the first message could be yours')}</div>
          </div>
          <div class="feed-end${more ? '' : ' is-done'}" id="feed-end" data-loading="${esc(T('Loading older exchanges…'))}" data-done="${esc(T('The beginning of the correspondence'))}"${recent.length ? '' : ' hidden'}><span>${
            T(more ? 'Loading older exchanges…' : 'The beginning of the correspondence')}</span></div>
        </div>
      </div></div>`;
}

/**
 * The Write page, /write: the board as a wall of notes (boardWall), under the header alone (no masthead), with the
 * composer's pop-up every public page carries (layout.js, writeKit; portal below) — nothing else; the mission
 * dashboard is a page of its own (/dashboard, dashboardPage). Where the header's Write link and the phone bar's Write
 * key lead (/write#write opens the page with the pop-up open). The wall's bar stays under the header all the way
 * down; the Write key floats at the foot of the window at the right, as on every page (public/write.js); on a phone
 * the pop-up is the dock over the foot of the screen that the bar's Write key shows and hides (aura.css, tabbar.js;
 * the page keeps the messages page's dress for it).
 */
function writePage(ctx, d) {
  const body = `
  <section class="wall-sec" id="exchanges" aria-label="${esc(ctx.T('Message Board'))}">${boardWall(ctx, { recent: d.recent, more: d.more, poll: d.poll })}</section>`;
  return L.page({
    title: 'Write to the crew', ctx, body, hideNav: true, hideRail: true, bodyClass: 'landing inner messages write', masthead: false,
    composer: { inFlight: d.inFlight, error: d.error, draft: d.draft },
    current: '/write', scripts: ['/board.js', '/live.js'],
    styles: ['/aura.css'],
  });
}



/**
 * A crew figure as a small tile — the steps taken (October: the calories
 * consumed are no longer kept, by the station or by mission control): the day's
 * figure for every officer, one under the other, the crew's total beneath it
 * with the thirteen days as a sparkline, and the average. Lives inside the
 * habitat bento beside the sensor tiles rather than as a chart of its own.
 * The figures are filed per officer on mission control's Habitat tab, under
 * Steps taken (content/crew-figures.json, a day as
 *   "5": { "crew": { "SCIENCE OFFICER": { "steps": 2010 }, … }, "steps": 5960 }
 * — the totals are the sums); a day filed only as a total shows the total
 * and a dash for each officer.
 */
function figureTile(figures, mission, { key, label, unit, colour, fmt, T = same, crew = [], icon = '' }) {
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
  // the officer's title whole, as the station shows it: Commanding officer, Science officer, Health officer (the row's
  // small capitals set the case on the page; the dictionary knows the titles in this spelling)
  const who = (c) => { const s = officer.shown(c.designation); return T(s.charAt(0) + s.slice(1).toLowerCase()); };
  const rows = crew.map((c) => { const v = perOf(d, c); return `<div class="fig-r"><span class="fig-who">${esc(who(c))}</span><span class="fig-v">${v != null ? fmt(v) : '—'}<em>${esc(unit)}</em></span></div>`; }).join('');
  return `<section class="tile t-fig t-${key}" role="group" aria-label="${esc(T(label))}${total != null ? `: ${fmt(total)} ${esc(unit)} ${T('crew total')}` : ''}">
    ${icon ? sensorIcon(icon) : ''}<h3>${T(label)}</h3>
    <span class="sub">${shownDay === n0 ? `${T('Day')} ${String(n0).padStart(3, '0')}` : shownDay ? `${T('Last recorded')} · ${T('Day')} ${String(shownDay).padStart(3, '0')}` : T('Counted by the crew')}</span>
    <div class="fig-rows">${rows}</div>
    <div class="fig-foot"><span class="fig-total">${total != null ? `${fmt(total)} ${esc(unit)} · ${T('crew total')}` : T('nothing recorded')}</span>${spark}</div>
    <div class="verdict">${mean != null ? `${fmt(mean)} ${esc(unit)} ${T('a day on average')} · ${present.length} ${T('of')} ${dayWord(T, days.length)}` : ''}</div>
  </section>`;
}

/**
 * Power generated (8 October: "in the Sensors tab add another measurement, Power generated — the logo a bike — and
 * inside it two visualisations, the number of rounds pedalled and the percentage of battery charged"): the bicycle
 * generator's day from content/bike.json, filed by hand on the Habitat tab of mission control (Power generated by
 * bike). The rounds on a bicycle computer's odometer — five drums, every figure white (9 October) — and
 * the battery as a battery: ten cells lit to its charge, the next one pulsing while it is not full, the per cent
 * beside it (no line under them since 9 October: "remove the 4,500 rounds charge the battery full text"). 4,500 rounds
 * charge it full; a day filed without a battery figure shows the rounds' share of a full
 * charge (content.bikeBattery). The day shown: before the run NOW's, the rehearsal day's (filed under NOW on the desk);
 * during it today's, else the last day filed, as the steps do. The About page's Cycle leads here (#bike, inside.js).
 */
function bikeTile(T, bike = {}, mission) {
  const C = require('../../lib/content');
  const has = (n) => { const d = bike[String(n)]; return !!d && (d.rounds != null || d.battery != null); };
  const pre = mission.phase === 'PRE_LAUNCH', n0 = mission.clampedDay;
  let day = null;
  if (pre) day = has(0) ? 0 : null;
  else for (let n = n0; n >= 1; n--) if (has(n)) { day = n; break; }
  const d = day == null ? {} : bike[String(day)];
  const rounds = d.rounds == null ? null : Math.max(0, Math.round(Number(d.rounds)) || 0);
  const pct = day == null ? null : C.bikeBattery(d);
  const when = day == null ? T('Counted by the crew')
    : pre ? T('Today · before the run')
    : day === n0 ? `${T('Day')} ${String(n0).padStart(3, '0')}`
    : `${T('Last recorded')} · ${T('Day')} ${String(day).padStart(3, '0')}`;
  // the odometer: five drums at the least, more for a larger count; every figure white, the zeros before the count too
  // (9 October — the .z they carry is no longer dimmed: aura.css)
  const str = rounds == null ? '' : String(rounds), width = Math.max(5, str.length);
  const drums = rounds == null
    ? Array.from({ length: width }, () => '<b class="z">–</b>').join('')
    : str.padStart(width, '0').split('').map((ch, i) => `<b${i < width - str.length ? ' class="z"' : ''}>${ch}</b>`).join('');
  // the battery: ten cells, lit to the charge (one at the least for any charge), the next one pulsing until it is full
  const on = pct == null ? 0 : Math.max(pct > 0 ? 1 : 0, Math.min(10, Math.round(pct / 10)));
  const cells = Array.from({ length: 10 }, (_, i) => `<i${i < on ? ' class="on"' : i === on && pct != null ? ' class="next"' : ''}></i>`).join('');
  const pctText = pct == null ? '—' : String(Math.round(pct));
  const label = `${T('Power generated')}: ${rounds == null ? '—' : rounds.toLocaleString('en-GB')} ${T('rounds pedalled')}, ${T('battery')} ${pctText} %`;
  return `<section class="tile t-gen t-bike" id="bike" role="group" aria-label="${esc(label)}">
          ${sensorIcon('bike')}
          <h3>${T('Power generated')}</h3>
          <span class="sub">${when}</span>
          <div class="bike-viz" aria-hidden="true">
            <div class="bike-part bike-rounds">
              <span class="bike-k">${T('Rounds pedalled')}</span>
              <div class="odo">${drums}</div>
              <span class="bike-u">${T('rounds')}</span>
            </div>
            <div class="bike-part bike-batt">
              <span class="bike-k">${T('Battery charged')}</span>
              <div class="batt${pct != null && pct >= 100 ? ' is-full' : ''}"><span class="batt-body">${cells}</span><span class="batt-cap"></span></div>
              <span class="bike-pc">${pctText}<em>%</em></span>
            </div>
          </div>
        </section>`;   // (no line under it: "remove the 4,500 rounds charge the battery full text" — 9 October)
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

/* ============================================= THE SENSORS' SIGNS AND METERS */

/**
 * The Sensors panel's signs: a line drawing for each instrument in a disc at its tile's top right, after a racing car's
 * dash (8 October: "add the corresponding logos to the sensor visualisations") — the lungs for the oxygen, a molecule
 * (O=C=O) for the carbon dioxide, a thermometer, a drop for the humidity, a gauge for the air pressure, the wind for the
 * air quality, the sun for the light, a flask for the volatile organic compounds, footprints for the steps, a crate for
 * the stores, a bolt for the power, a pin for Karlsruhe, a radar for the astronauts. 24 × 24, stroked in currentColor
 * (aura.css, .t-ic); the hardware's charts carry the same signs in their captions.
 */
const SENSOR_ICON = {
  o2: '<path d="M12 3.6v7.6"/><path d="M12 8.6c-.9 1.5-2 2-3.3 2"/><path d="M12 8.6c.9 1.5 2 2 3.3 2"/><path d="M8.7 6.6c-2.6 0-4.2 3.9-4.2 8.4 0 2.5 1.4 3.8 3.1 3.8 1.9 0 2.7-1.3 2.7-3.4V8.7"/><path d="M15.3 6.6c2.6 0 4.2 3.9 4.2 8.4 0 2.5-1.4 3.8-3.1 3.8-1.9 0-2.7-1.3-2.7-3.4V8.7"/>',
  co2: '<circle cx="4.8" cy="12" r="2.5"/><circle cx="12" cy="12" r="2.9"/><circle cx="19.2" cy="12" r="2.5"/><path d="M7.4 10.8h1.8M7.4 13.2h1.8M14.8 10.8h1.8M14.8 13.2h1.8"/>',
  temp: '<path d="M10 14.4V5.2a2 2 0 0 1 4 0v9.2a4 4 0 1 1-4 0z"/><path d="M12 9.5v6.4"/><circle cx="12" cy="17.6" r="1.5" fill="currentColor" stroke="none"/>',
  hum: '<path d="M12 3.4c3.3 4.2 5.6 7.3 5.6 10.4a5.6 5.6 0 0 1-11.2 0c0-3.1 2.3-6.2 5.6-10.4z"/><path d="M9.3 14.4a2.8 2.8 0 0 0 2.4 2.7"/>',
  pres: '<path d="M4.6 16.8a8 8 0 1 1 14.8 0"/><path d="M12 14l3.4-4.4"/><circle cx="12" cy="14.3" r="1.5" fill="currentColor" stroke="none"/><path d="M6.9 11.6l1.1.6M12 6.9v1.3M17.1 11.6l-1.1.6"/>',
  iaq: '<path d="M3.5 9h10.6a2.6 2.6 0 1 0-2.6-2.6"/><path d="M3.5 13h14.4a2.6 2.6 0 1 1-2.6 2.6"/><path d="M3.5 17h6.5"/>',
  light: '<circle cx="12" cy="12" r="3.7"/><path d="M12 3.4v2.1M12 18.5v2.1M3.4 12h2.1M18.5 12h2.1M5.9 5.9l1.5 1.5M16.6 16.6l1.5 1.5M5.9 18.1l1.5-1.5M16.6 7.4l1.5-1.5"/>',
  voc: '<path d="M9.4 3.6h5.2M10.5 3.6v5.3L5.7 17.2A2 2 0 0 0 7.4 20.1h9.2a2 2 0 0 0 1.7-2.9l-4.8-8.3V3.6"/><path d="M7.9 14.4h8.2"/><circle cx="10.6" cy="17.1" r=".9" fill="currentColor" stroke="none"/><circle cx="13.7" cy="16.3" r=".7" fill="currentColor" stroke="none"/>',
  steps: '<path d="M8.3 3.4c1.7 0 2.7 2 2.7 4.5 0 2.3-1 3.9-2.7 3.9S5.6 10.2 5.6 7.9c0-2.5 1-4.5 2.7-4.5z"/><path d="M6.5 13.7h3.6v1.5a1.8 1.8 0 0 1-3.6 0z"/><path d="M15.7 8.2c1.7 0 2.7 2 2.7 4.5 0 2.3-1 3.9-2.7 3.9S13 15 13 12.7c0-2.5 1-4.5 2.7-4.5z"/><path d="M13.9 18.5h3.6V20a1.8 1.8 0 0 1-3.6 0z"/>',
  res: '<path d="M12 3.2l7.8 4.3v9L12 20.8l-7.8-4.3v-9z"/><path d="M4.4 7.6L12 11.8l7.6-4.2"/><path d="M12 11.8v8.8"/><path d="M8.1 5.4l7.7 4.3"/>',
  pwr: '<path d="M13.4 2.8L5.6 13.4h5.6l-1.1 7.8 7.8-10.6h-5.6z" fill="currentColor" stroke-width="1.2"/>',
  bike: '<circle cx="5.8" cy="15.8" r="3.7"/><circle cx="18.2" cy="15.8" r="3.7"/><path d="M5.8 15.8L9.4 8.6h6.2l2.6 7.2"/><path d="M9.4 8.6l2.2 7.2H5.8"/><path d="M15.6 8.6l-4 7.2"/><path d="M9.4 8.6L8.9 6.4M7.6 6.4h2.8"/><path d="M15.6 8.6l-.7-2.5h2.3"/><circle cx="11.6" cy="15.8" r="1" fill="currentColor" stroke="none"/>',
  map: '<path d="M12 20.8s6.4-6 6.4-10.9a6.4 6.4 0 0 0-12.8 0c0 4.9 6.4 10.9 6.4 10.9z"/><circle cx="12" cy="9.9" r="2.4"/>',
  radar: '<circle cx="12" cy="12" r="8.4"/><circle cx="12" cy="12" r="4.4"/><path d="M12 12l5.8-5.8"/><circle cx="15.2" cy="14.6" r="1.1" fill="currentColor" stroke="none"/>',
};
const sensorIcon = (k, cls = 't-ic') => (SENSOR_ICON[k] ? `<span class="${cls}" aria-hidden="true"><svg viewBox="0 0 24 24">${SENSOR_ICON[k]}</svg></span>` : '');

/**
 * A reading's drawing (8 October: "use more than just the horizontal filling line — varied but beautiful"): each
 * instrument its own — public/habitat.js draws the seven the habitat sensor reads into their hosts (the day's curve, a
 * thermometer, a vessel of water, a barometer, the air quality's bands, a sun, the hours' columns); the oxygen's is
 * drawn here (o2Ring). A drawing of the round kind stands at the right of the figure (`side`); a wide one under it.
 */
const r1 = (v) => Math.round(v * 10) / 10;
const onCircle = (cx, cy, r, deg) => { const a = deg * Math.PI / 180; return [r1(cx + r * Math.cos(a)), r1(cy + r * Math.sin(a))]; };
const arcD = (cx, cy, r, d0, d1) => { const p = onCircle(cx, cy, r, d0), q = onCircle(cx, cy, r, d1); return `M${p[0]} ${p[1]}A${r} ${r} 0 ${Math.abs(d1 - d0) > 180 ? 1 : 0} 1 ${q[0]} ${q[1]}`; };
/** The oxygen's ring: three quarters of a circle, open at its foot, the scale 16–24 % round it — the normal range
 *  (19.5–23.5 %) along its outside in cobalt, the ring lit in Mars from its start to the reading (red out of the normal
 *  range), a dot where the reading stands; O₂ in its middle. */
function o2Ring(v, hot) {
  const A = (x) => 135 + 270 * Math.min(1, Math.max(0, (x - O2.lo) / (O2.hi - O2.lo)));
  let out = `<path class="vz-track" d="${arcD(50, 52, 38, 135, 405)}"/><path class="vz-normal" d="${arcD(50, 52, 48, A(O2.safeLo), A(O2.safeHi))}"/>`;
  if (v != null) {
    const end = A(v), p = onCircle(50, 52, 38, end);
    if (end - 135 > 0.5) out += `<path class="vz-arc${hot ? ' is-hot' : ''}" d="${arcD(50, 52, 38, 135, end)}"/>`;
    out += `<circle class="vz-dot${hot ? ' is-hot' : ''}" cx="${p[0]}" cy="${p[1]}" r="5.5"/>`;
  }
  out += `<text class="vz-mid" x="50" y="58" text-anchor="middle">O₂</text>`;
  return `<svg viewBox="0 0 100 100" width="100%" height="100%" aria-hidden="true">${out}</svg>`;
}

/** The habitat sensor's instruments, after the oxygen — in the order they stand on the panel (8 October): the carbon
 *  dioxide, the temperature, the humidity; the air pressure, the air quality, the light (Karlsruhe beside it); the
 *  volatile organic compounds, further down beside the power and the astronauts.
 *  Each a tile of the same make: its name and scale, the figure, its meter, a word on it (habitat.js fills them). */
const SENSOR_TILES = [
  { k: 'co2', title: 'Carbon dioxide', unit: 'ppm', viz: 'spark', scale: '0–2000 ppm' },            // the day's curve under the limit
  { k: 'temp', title: 'Temperature', unit: '°C', viz: 'thermo', side: true, scale: '0–40 °C' },     // a thermometer
  { k: 'hum', title: 'Humidity', unit: '%RH', viz: 'liquid', side: true, scale: '0–100 %RH' },      // a vessel of water
  { k: 'pres', title: 'Air pressure', unit: 'hPa', viz: 'dial', scale: '950–1050 hPa' },            // a barometer
  { k: 'iaq', title: 'Air quality', unit: 'IAQ', viz: 'band', sub: 'IAQ index' },   // the index alone under its name: no scale (October); its bands, a pointer on one
  { k: 'light', title: 'Light::sensor', unit: 'lx', viz: 'sun', side: true, scale: '0–1000 lx' },   // a sun
  { k: 'voc', title: 'Volatile organic compounds', unit: 'ppm', viz: 'cols', scale: '0–10 ppm' },   // the day's hours as columns
];
const sensorTile = (T, d) => `
        <section class="tile t-sens t-${d.k}">
          ${sensorIcon(d.k)}
          <h3>${T(d.title)}</h3>
          <span class="sub" id="${d.k}Sub">${d.sub ? T(d.sub) : `${T('Scale')} ${d.scale}`}</span>
          <div class="t-read${d.side ? ' has-side' : ''}">
            <div class="big" id="${d.k}Val">—<em>${esc(d.unit)}</em></div>
            <div class="viz viz-${d.viz} ${d.side ? 'is-side' : 'is-wide'}" id="hbt-m-${d.k}" aria-hidden="true"></div>
            <div class="verdict" id="${d.k}Verdict"></div>
          </div>
        </section>`;

/**
 * The oxygen: the first of the instruments, read from the habitat's own hardware (the oxygen sensor in
 * content/home-assistant.json — an id or a name with O2 or oxygen in it) rather than the habitat sensor. Rendered here
 * and by /api/hardware, which hardware.js polls on the hardware's cycle, so the figure moves with the readings. Normal
 * air is 20.9 %; under 19.5 % or over 23.5 % the figure and the meter turn red. A reading that has not arrived again
 * for a quarter of an hour (three of Home Assistant's five-minute polls; hw.staleMs, src/lib/home-assistant.js — it was
 * half an hour) is not a current one: the tile shows a dash and "No current reading", as the habitat sensor's tiles do.
 * Arrived means read: a steady oxygen level Home Assistant keeps reporting is current however long it has not moved.
 */
const O2 = { lo: 16, hi: 24, safeLo: 19.5, safeHi: 23.5, staleMs: 15 * 60 * 1000 };
/** A device's reading is current while it last arrived less than hw.staleMs ago — a closed record keeps its last. */
const hwCurrent = (hw, s) => !!s && s.value != null && (hw.frozen || Date.now() - (s.seen || s.t || 0) <= (Number(hw.staleMs) > 0 ? Number(hw.staleMs) : O2.staleMs));
const oxygenSensor = (hw) => (hw && (hw.sensors || []).find((x) => /(^|[^a-z])o2([^a-z]|$)|oxygen/i.test(`${x.id} ${x.label}`))) || null;
function oxygenTileInner(hw, T = same) {
  const s = oxygenSensor(hw);
  const v = hwCurrent(hw, s) ? Number(s.value) : null;
  const hot = v != null && (v < O2.safeLo || v > O2.safeHi);
  const verdict = v == null ? T(s ? 'No current reading' : 'No oxygen sensor connected') : hot ? T(v < O2.safeLo ? 'Low oxygen' : 'High oxygen') : T('Normal air');
  return `${sensorIcon('o2')}
          <h3>${T('Oxygen')}</h3>
          <span class="sub">${T('Scale')} ${O2.lo}–${O2.hi} %</span>
          <div class="t-read has-side">
            <div class="big${hot ? ' hot' : ''}" id="o2Val">${v == null ? '—' : hwNum(v, Math.min(2, Number.isFinite(Number(s.decimals)) ? Number(s.decimals) : 1))}<em>%</em></div>
            <div class="viz viz-ring is-side${hot ? ' is-hot' : ''}" aria-hidden="true">${o2Ring(v, hot)}</div>
            <div class="verdict${hot ? ' hot' : ''}">${verdict}</div>
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
  // the habitat's thermometer on its own chart is the cricket terrarium's (8 October: the graph named "Cricket Terrarium
  // Temperature")
  if (/^(°\s*[cf]|k)$/i.test(u)) return { key: 'temperature', title: /cricket/i.test(`${s.id} ${s.label}`) ? 'Cricket Terrarium Temperature' : 'Temperature', unit: u, zero: false, range: [0, 30] };
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
function hwChart(hw, group, members, tz, T = same, W = HW_W, H = HW_H) {
  // The chart is drawn for the width it is shown at (W, in CSS pixels —
  // hardware.js asks /api/hardware for the width its tiles have, so the
  // type keeps its size on a desk and on a phone alike; HW_W until it does),
  // and a fixed height (H — HW_H, unless the page asks for a lower one: the
  // installation's screens, where a short screen has no room for a tall
  // chart): the plot fills its tile, the legend beneath it.
  const padL = 44, padR = 16, padT = 26, padB = 30;
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
  // The night, 22:00 to 06:00 at the venue, a darker band either side of the day.
  const band = (h0, h1) => `<rect x="${sx(hw.since + h0 * 3600000).toFixed(1)}" y="${padT}" width="${(sx(hw.since + h1 * 3600000) - sx(hw.since + h0 * 3600000)).toFixed(1)}" height="${ih}" class="hw-night"/>`;
  const now = hw.liveNow && hw.liveNow > hw.since && hw.liveNow < hw.now ? sx(hw.liveNow) : null;
  // The legend names each line. Where every line's label ends in the same
  // " · quantity" (the eight power channels, "Crickets · power draw",
  // "Science 1 · power draw", …), the legend drops it: the chart's title
  // already says what is drawn, and the names read as names — Crickets,
  // Science 1, Science 2, … The line's own tooltip keeps the whole label.
  const suffix = (l) => { const i = String(l).lastIndexOf(' · '); return i > 0 ? String(l).slice(i) : null; };
  const shared = series.length > 1 && suffix(series[0].s.label) && series.every((r) => suffix(r.s.label) === suffix(series[0].s.label)) ? suffix(series[0].s.label) : null;
  const legendName = (l) => (shared ? String(l).slice(0, -shared.length) : l);
  // The newest reading of every line, in a pill above its end — named after
  // the line where the chart has more than one (CO 1.2 ppm; the name is the
  // label's first part, before any " · "), so a figure is not taken for
  // another line's. (Until 9 October only the first line had one: the
  // Power chart always read the crickets', the air quality's never the CO's
  // — "CO · carbon monoxide does not show any value: make it display the
  // current value".) The Power chart has none — its eight lines say their
  // figures under the pointer (hardware.js, data-hw below; "for all lines,
  // when I hover show the current power rating … remove the cricket value it
  // always reads"). Pills that would overlap are moved apart.
  const pillName = (l) => String(l).split(' · ')[0];
  const tagH = 26;
  // A line whose reading has not arrived for a quarter of an hour (hwCurrent) says so in its pill instead of a figure
  // (9 October: "if nothing arrives for 15 minutes, … say there is no current reading").
  const pills = group.key === 'power' ? [] : series.map((r) => {
    const reading = hwCurrent(hw, r.s)
      ? `${hwNum(r.s.kind === 'counter' && r.s.today != null ? r.s.today : r.s.value, r.s.decimals)}${r.s.unit ? ' ' + r.s.unit : ''}`
      : T('no current reading');
    const text = `${series.length > 1 ? pillName(r.s.label) + ' ' : ''}${reading}`;
    // a pill wide and tall enough to hold the figure (the type is larger than the plot's own: aura.css, .hw-tag), over
    // the line's end, or under it where the line runs near the top of the plot (the clock of the moment stands there)
    const tagW = 20 + text.length * 8.4;
    return { r, text, w: tagW, x: Math.min(W - padR - tagW, Math.max(padL, r.ex - tagW / 2)), y: r.ey - 38 >= padT + 2 ? r.ey - 38 : r.ey + 12 };
  }).sort((a, b) => a.y - b.y);
  for (let i = 1; i < pills.length; i++) {
    for (let j = 0; j < i; j++) {
      const a = pills[j], b = pills[i];
      if (a.x < b.x + b.w && b.x < a.x + a.w && b.y < a.y + tagH + 4) b.y = a.y + tagH + 4;   // under the one it would cover
    }
  }
  pills.forEach((t) => { t.y = Math.min(bottom - tagH, t.y); });
  // what the pointer reads (hardware.js): every line's points — minutes since midnight and the value in the chart's unit —
  // with its name and colour, and where the plot lies in the drawing
  const hover = { pl: padL, iw, pt: padT, ih, W, H, since: hw.since, span, tz, unit: group.unit || '', lo: ax.lo, hi: ax.hi,
    s: series.map((r) => ({ n: legendName(r.s.label), c: r.colour, d: Math.max(0, Math.min(3, r.s.decimals == null ? 1 : r.s.decimals)),
      p: r.s.points.map((p) => [Math.round((p[0] - hw.since) / 60000), Number(val(r.s, p[1]).toFixed(3))]) })) };
  return `<figure class="hw-chart hw-${esc(group.key.replace(/[^a-z0-9]+/gi, '-'))}" data-hw="${esc(JSON.stringify(hover))}">
  <figcaption class="hw-title">${sensorIcon(group.key === 'power' || group.key.startsWith('energy') ? 'pwr' : group.key === 'temperature' ? 'temp' : /oxygen/i.test(group.title) ? 'o2' : /air quality/i.test(group.title) ? 'iaq' : 'pres', 'hw-ic')}<b>${esc(T(group.title))}</b>${unit ? ` <span class="hw-unit">${unit}${group.key === 'power' ? ` · ${T('hourly average')}` : ''}</span>` : ''}</figcaption>
  <svg viewBox="0 0 ${W} ${H}" role="img" aria-label="${esc(T(group.title))} — ${esc(T('today, midnight to midnight venue time, one line per device, on one scale in'))} ${unit || '—'}">
    <defs>${series.map((r) => `
      <linearGradient id="${r.id}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${r.colour}" stop-opacity="${series.length > 1 ? 0.16 : 0.3}"/><stop offset="1" stop-color="${r.colour}" stop-opacity="0"/></linearGradient>`).join('')}
    </defs>
    ${band(0, 6)}${band(22, 24)}
    ${ax.ticks.map((v) => `<line x1="${padL}" y1="${sy(v).toFixed(1)}" x2="${W - padR}" y2="${sy(v).toFixed(1)}" class="hw-grid"/>
      <text x="${padL - 7}" y="${(sy(v) + 3.5).toFixed(1)}" text-anchor="end" class="hw-ax">${yLabel(v)}</text>`).join('')}
    ${ticks.map(({ t, k }) => (k % (W < 400 ? 6 : 3) ? '' : `<text x="${sx(t).toFixed(1)}" y="${H - padB + 16}" text-anchor="${k === 0 ? 'start' : k === ticks.length - 1 ? 'end' : 'middle'}" class="hw-ax"${k % 6 ? ' opacity="0.55"' : ''}>${String(k).padStart(2, '0')}</text>`)).join('')}
    ${unit ? `<text x="${padL - 7}" y="${padT - 12}" text-anchor="end" class="hw-ax hw-ax-unit">${unit}</text>` : ''}
    ${now != null ? `<rect x="${now.toFixed(1)}" y="${padT}" width="${(W - padR - now).toFixed(1)}" height="${ih}" class="hw-ahead"/>
      <line x1="${now.toFixed(1)}" y1="${padT}" x2="${now.toFixed(1)}" y2="${bottom}" class="hw-now"><title>${T('now')} · ${hwClock(hw.liveNow, tz)}</title></line>
      <text x="${now.toFixed(1)}" y="${padT - 12}" text-anchor="middle" class="hw-ax hw-now-t">${hwClock(hw.liveNow, tz)}</text>` : ''}
    ${series.map((r) => `<path d="${r.area}" fill="url(#${r.id})" class="hw-area"/>`).join('')}
    ${series.map((r) => `<path d="${r.d}" class="hw-line" stroke="${r.colour}" style="color:${r.colour}" pathLength="1"><title>${esc(r.s.label)}</title></path>
      ${r.pts.slice(0, -1).map(([x, y]) => `<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="1.8" fill="${r.colour}" class="hw-dot"/>`).join('')}
      <circle cx="${r.ex.toFixed(1)}" cy="${r.ey.toFixed(1)}" r="9" fill="${r.colour}" class="hw-pulse"/>
      <circle cx="${r.ex.toFixed(1)}" cy="${r.ey.toFixed(1)}" r="4.2" fill="${r.colour}" class="hw-end"/>`).join('')}
    ${pills.map((t) => `<g class="hw-tag"><rect x="${t.x.toFixed(1)}" y="${t.y.toFixed(1)}" width="${t.w.toFixed(1)}" height="${tagH}" rx="${tagH / 2}" fill="${t.r.colour}"/>
      <text x="${(t.x + t.w / 2).toFixed(1)}" y="${(t.y + tagH / 2).toFixed(1)}" text-anchor="middle" dominant-baseline="central">${esc(t.text)}</text></g>`).join('')}
  </svg>
  <ul class="hw-legend">${series.map((r) => `
    <li><i style="background:${r.colour}"></i><span class="hw-name">${esc(legendName(r.s.label))}</span>${
      r.s.kind === 'counter' || group.key === 'power' ? '' : `<span class="hw-range">${T('low')} ${hwNum(r.lo, r.s.decimals)} · ${T('high')} ${hwNum(r.hi, r.s.decimals)}</span>`}</li>`).join('')}
  </ul>
</figure>`;
}

/** The devices sorted onto their charts, in the order they first appear in
 *  content/home-assistant.json; a device keeps its colour by its position
 *  in that list, whichever chart it lands on. Energy meters are not drawn
 *  here: their day's kWh is on the Power panel (content/power.json). */
const HW_W = 720, HW_H = 240;                // the width and the height a chart is drawn for until the page says its own (hardware.js)
function hwCharts(hw, tz, T = same, W = HW_W, H = HW_H) {
  const groups = new Map();
  (hw.sensors || []).forEach((s, i) => {
    const g = hwGroupOf(s);
    if (g.key.startsWith('energy')) return;
    // no Oxygen graph (9 October: "remove the Oxygen graph"): the oxygen stands in the Sensors panel's first tile, read
    // from the same sensor (oxygenSensor) — the device keeps its place in the list, so every other keeps its colour
    if (/(^|[^a-z])o2([^a-z]|$)|oxygen/i.test(`${s.id} ${s.label}`)) return;
    let e = groups.get(g.key);
    if (!e) groups.set(g.key, e = { group: g, members: [] });
    e.members.push({ s, colour: hwColour(i) });
  });
  // in the order the panel reads them (8 October): the power, the cricket terrarium's temperature; the oxygen, the air
  // quality — two across, then anything else the file lists, in its order
  const rank = (g) => (g.key === 'power' ? 0 : g.key === 'temperature' ? 1 : /oxygen/i.test(g.title) ? 2 : /air quality/i.test(g.title) ? 3 : 9);
  const charts = [...groups.values()].sort((a, b) => rank(a.group) - rank(b.group))
    .map((e) => hwChart(hw, e.group, e.members, tz, T, W, H)).filter(Boolean);
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
  // every category on a meter: the energy used, channel by channel — the habitat's eight meters as shipped;
  // a category without one is counted by the crew, and the line says so
  const pwrAllMetered = pwrMetered && power.categories.every((c) => c.sensor);
  const pwrSub = pre
    ? (pwrMetered ? T('Today · before the run') : T('Planned for day 01'))
    : `${T('Today')} · SOL ${String(m.clampedDay).padStart(2, '0')}`;
  return `<span class="sub">${pwrSub} · ${T(pwrAllMetered ? 'energy used, from the meters' : pwrMetered ? 'from the meter and the crew' : 'counted by the crew')} · kWh</span>
          ${powerBars(powerToday, T)}`;
}

/**
 * The panel's whole inner HTML: tiles, then the combined chart. Rendered
 * here and by /api/hardware alike, so what the browser swaps in is exactly
 * what the server would have served.
 */
function hardwareInner(hw, T = same, { width = HW_W, height = HW_H } = {}) {
  const tz = hwTz();
  const list = hw.sensors || [];
  const W = Math.max(240, Math.min(1400, Math.round(Number(width) || HW_W)));
  const H = Math.max(120, Math.min(700, Math.round(Number(height) || HW_H)));
  // The charts are the panel: no tiles, one day chart per kind of quantity
  // (temperature, energy, …), each on a proper axis in its unit, every
  // device a line named at its end with the current reading. The
  // diagnostics the tiles used to carry (a sensor not in the feed) become a
  // note above them.
  const missing = list.filter((s) => s.missing);
  const chart = hwCharts(hw, tz, T, W, H);
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

/** A dashboard panel: title and meta in the head, the content beneath. */
const dpanel = ({ id, title, meta = '', span = 4, cls = '', href = null, live = null, stop = false }, inner) => `
  <section class="dpanel span-${span} ${cls}"${id ? ` id="${id}"` : ''}${stop ? ' data-stop' : ''}>
    <header class="dpanel-head">
      <div class="dpanel-title"><h3>${
        href ? `<a href="${href}">${esc(title)} <span class="dpanel-arrow" aria-hidden="true">→</span></a>` : esc(title)}</h3>${
        live ? `<span class="cloud-live" title="${esc(live)}"><i></i>LIVE</span>` : ''}</div>
      ${meta ? `<span class="dpanel-meta">${meta}</span>` : ''}
    </header>
    <div class="dpanel-body">${inner}</div>
  </section>`;

/* The dashboard's panels behind one index: the keys in three tracks — the
   sensors' (Sensors), the day's (Today's Schedule, Today's Meal, Crew Moods),
   the blogs' — each track named, its keys one under the other: a rail at the
   left of the folder on a wider screen, the open folder's panel beside it;
   on a phone the tracks are one at a time, chosen by a segmented control of
   the three names, with the track's keys as tabs under it (aura.css). The page opens on the
   first key of the first track, the Sensors (which carries the habitat's own hardware too). A press on a key brings that folder to the front
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
  'mission-today': '<path d="M5 21V4"/><path d="M5 4h12l-2.5 4L17 12H5"/>',                                                         // the day's flag
  schedule: '<circle cx="12" cy="12" r="8.5"/><path d="M12 7.5V12l3 2"/>',                                                          // the clock
  galley: '<path d="M7 3v18"/><path d="M5 3v5a2 2 0 0 0 4 0V3"/><path d="M17 3c-2 1.5-3 4-3 7a2 2 0 0 0 2 2h1v9"/>',                   // fork and knife
  crew: LINE_ICONS.crew,
  'blog-commander': '<path d="M4 20l4-1L19 8l-3-3L5 16z"/><path d="M13.5 6.5l3 3"/>',                                               // the pen
  'blog-health': '<path d="M12 20s-7-4.4-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 10c0 5.6-7 10-7 10z"/><path d="M8 12h2l1.5-2.5 2 5L15 12h1.5"/>',   // the heart, a pulse across it
  'blog-science': LINE_ICONS.science,
};
const tabIcon = (id) => TAB_ICONS[id] ? `<svg class="ftab-ic" viewBox="0 0 24 24" aria-hidden="true">${TAB_ICONS[id]}</svg>` : '';

const folder = (T, rows, { id = 'day-folder', label = '', title = '' } = {}) => {
  rows = rows.map((row) => ({ label: row.label, tabs: row.tabs.filter(Boolean) })).filter((row) => row.tabs.length);
  const tabs = rows.flatMap((row) => row.tabs);
  // (a phone shows the key's short name, one word, on one line — t.short; aura.css: 8 October, "the tabs and inner tabs
  // are too cluttered on mobile")
  const tab = (t, i) => `<button type="button" class="ftab${i === 0 ? ' is-front' : ''}" role="tab" id="ftab-${t.id}" aria-controls="fpage-${t.id}" aria-selected="${i === 0 ? 'true' : 'false'}"${i === 0 ? '' : ' tabindex="-1"'} data-folder="${t.id}">${tabIcon(t.id)}<span class="ftab-l">${esc(t.label)}</span>${t.short ? `<span class="ftab-s">${esc(t.short)}</span>` : ''}</button>`;
  return `
  <section class="folder span-12" id="${id}" data-stop aria-label="${esc(label)}">
    <div class="folder-tabs">
      <!-- the rail: its heading, then the tracks one under the other, each named, its keys stacked — at the left of the
           folder on a wider screen (sticky under the header). A phone's first row instead: the groups as a segmented
           control (aura.css shows it under 760 px only); a press opens the group's first folder, and the row of its
           keys takes the place of the row shown -->
      <div class="frail">${title ? `
      <div class="folder-head"><h2 class="folder-title">${esc(title)}</h2></div>` : ''}
      <div class="fgroups" role="group" aria-label="${esc(label)}">${rows.map((row, r) => `<button type="button" class="fgroup${r === 0 ? ' is-cur' : ''}" data-group="${r}" aria-pressed="${r === 0 ? 'true' : 'false'}">${esc(row.label)}</button>`).join('')}</div>
      <div class="frows" role="tablist" aria-label="${esc(label)}">${rows.map((row, r) => `
      <div class="frow n${row.tabs.length}${r === 0 ? ' is-cur' : ''}" data-group="${r}"><span class="frow-k" aria-hidden="true">${esc(row.label)}</span>${row.tabs.map((t) => tab(t, tabs.indexOf(t))).join('')}</div>`).join('')}
      </div>
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
/* The dashboard's pieces, each on its own, so the dashboard can assemble them and the installation's screens
   (screens.js) can show one at a time: the headline figures, the strip of sols, the live pictures, Today's Mission and
   the nine panels — with the day they stand under. */
function dashboardPanels(ctx, { crew, today, counts, crewFigures, bike = {}, power = { categories: [], days: {} }, allDays, logDays, entryCounts, ingest = [], media = [], mediaCounts = { total: 0, bytes: 0 }, mediaLookup = () => null, hardware = null, hardwareDaily = [], cloud = null, mission = null, nowLog = null, nowDay = null }, { trendsInside = false } = {}) {
  const m = ctx.mission, g = ctx.geo, T = ctx.T;
  const pre = m.phase === 'PRE_LAUNCH';
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
  const schedule = dpanel({ id: 'schedule', title: T('Today’s Schedule'),
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
  // NOW, before the run — the rehearsal day, mission day 0 (src/lib/mission.js): what mission control files under it and
  // what its meters read today stand on today's date, the way the Sensor Data download carries it (src/lib/sensor-data.js;
  // 9 October: "add all things from the Sensor data here"). `now: true` gives a series that point; day 0 is asked for
  // through the same function as the run's days.
  const withNow = pre && !!nowDay;
  const dayAt = (n) => (n === 0 ? nowDay : allDays[n - 1]);
  const byDay = (fn, { ahead = false, now = false } = {}) => {
    const points = {}, planned = {};
    if (now && withNow) { const v = fn(0); if (v != null) points[m.today] = v; }
    for (const n of dayN) {
      const v = fn(n);
      if (v == null) continue;
      if (upTo(n)) points[dateOf(n)] = v;
      if (ahead) planned[n] = v;
    }
    return { points, planned };
  };
  const rowOf = (n, key) => { const d = dayAt(n); return d && d.inventory ? d.inventory.find((i) => i.key === key) : null; };
  const level = (key) => byDay((n) => { const r = rowOf(n, key); return r ? r.quantity : null; }, { ahead: true, now: true });
  const use = (key) => byDay((n) => { const r = rowOf(n, key); return r ? r.consumption : null; }, { ahead: true, now: true });
  // The day's meals, summed: what the plan cost in energy, water and power.
  const mealSum = (field) => byDay((n) => { const d = dayAt(n); return d && d.meals.length ? d.meals.reduce((s, x) => s + (x[field] || 0), 0) : null; }, { ahead: true, now: true });
  // …and the recipe book's figures on them, as Today's Meal shows each meal's (layout.js, mealEco): a day's total of
  // those its meals carry, nothing for a day none of them does — a day without recipes says nothing rather than "0".
  const mealTotal = (get, dp = 2) => byDay((n) => {
    const d = dayAt(n);
    const v = d ? d.meals.map(get).filter((x) => x != null && Number.isFinite(Number(x))).map(Number) : [];
    return v.length ? Math.round(v.reduce((s, x) => s + x, 0) * 10 ** dp) / 10 ** dp : null;
  }, { ahead: true, now: true });
  const figure = (k) => byDay((n) => (crewFigures[String(n)] || {})[k] ?? null, { ahead: true, now: true });
  // each officer's steps, as the Steps taken tile lists them (figureTile)
  const stepsOf = (designation) => byDay((n) => (((crewFigures[String(n)] || {}).crew || {})[designation] || {}).steps ?? null, { ahead: true, now: true });
  const officerName = (c) => { const s = officer.shown(c.designation); return T(s.charAt(0) + s.slice(1).toLowerCase()); };
  // the power generated by the bike (content/bike.json): the rounds pedalled, and the battery charged — the figure filed,
  // else the rounds' share of a full charge (content.bikeBattery), as the Power generated tile shows it
  const C = require('../../lib/content');
  const bikeOf = (n) => { const b = bike[String(n)]; return b && (b.rounds != null || b.battery != null) ? b : null; };
  const bikeRounds = byDay((n) => { const b = bikeOf(n); const r = b && b.rounds != null && b.rounds !== '' ? Number(b.rounds) : NaN; return Number.isFinite(r) ? Math.max(0, Math.round(r)) : null; }, { ahead: true, now: true });
  const bikeBattery = byDay((n) => { const p = C.bikeBattery(bikeOf(n)); return p == null ? null : Math.round(p * 10) / 10; }, { ahead: true, now: true });
  // the power consumed: a run day's figures as the station shows them (content.powerLive), NOW's as its tile reads them —
  // filed by hand, else the meter's day (content.powerDay)
  const nowPower = withNow ? C.powerDay(0) : null;
  const kwhOf = (n, key) => (n === 0
    ? ((nowPower.categories.find((c) => c.key === key) || {}).kwh ?? null)
    : (power.days[String(n)] || {})[key] ?? null);
  // What happened each day: the schedule worked through, the traffic from
  // Earth, what the crew wrote and sent out.
  const act = data.dailyActivity();
  const tasksDone = byDay((n) => { const d = allDays[n - 1]; return d && d.tasks.length ? d.tasks.filter((t) => t.status === 'DONE').length : null; });
  const written = byDay((n) => { const d = logDays[n - 1]; return d ? d.written : null; });
  const count = (k) => byDay((n) => (act[n] || {})[k] || 0);
  /* The axis of the trend graph: always a fortnight of the calendar (9 October: "the Trends graph should always show
     trends for 14-day periods — 1–14th, 15–29th"): the half of the month today is in — the 1st to the 14th, or the
     15th to the 29th (to the month's end on the 30th and 31st) — and once the run is over the half it began in, where
     the record stands still. So it is 1 to 14 October until the run, and the run's own fortnight, 15 to 29 October —
     SOL 01 to 13 and the two days after — from its first day. `run` says whether any day of the run is on it: those
     days are named by their SOL (the run's dates go with it, data-run-start / data-run-end), the others by the date. */
  const fortnight = (iso) => {
    const [Y, Mo, D] = String(iso).split('-').map(Number), last = new Date(Date.UTC(Y, Mo, 0)).getUTCDate();
    const p2 = (n) => String(n).padStart(2, '0');
    const a = D <= 14 ? 1 : 15, b = D <= 14 ? 14 : (D <= 29 ? Math.min(29, last) : last);
    return { start: `${Y}-${p2(Mo)}-${p2(a)}`, end: `${Y}-${p2(Mo)}-${p2(b)}` };
  };
  const span14 = fortnight(m.phase === 'COMPLETE' ? m.start_date : m.today);
  const axis = { ...span14, run: span14.start <= m.end_date && span14.end >= m.start_date };
  // (whether the readings run from a fresh build rather than from the reset — the plan's dashed lines below)
  let fromBuild = false;
  try { fromBuild = require('../../lib/critical').floorMode() === 'build'; } catch { /* the run */ }
  const trendSpec = {
    series: [
      ...ingest.map((c) => ({ id: 'ingest-' + c.metric, name: T(c.label), unit: c.unit, group: T('Habitat'), domain: c.domain, points: c.points })),
      // The habitat's own hardware, through Home Assistant: one line per
      // device, one value per day — a gauge's daily mean, a meter's daily
      // added amount. Appears from the first day a reading was stored. A
      // power draw (a gauge in watts — a channel's socket) is not a trend:
      // its day is on its meter's line, as energy; and a meter that a Power
      // category reads (content/power.json, `sensor`) is that category's
      // line in the Power group below, not a second one here.
      ...hardwareDaily.filter((h) => Object.keys(h.points).length && !(h.kind === 'gauge' && /^k?w$/i.test(String(h.unit || '')))
          && !power.categories.some((c) => c.sensor === h.id)).map((h) => ({
        id: 'hw-' + h.id, name: h.label, unit: h.unit, group: T('Hardware'), points: h.points })),
      ...items.map((it) => ({ id: 'store-' + it.key, name: it.label, unit: it.unit, group: T('Resources'),
        scaleMax: it.start_quantity || it.quantity || 1, ...level(it.key) })),
      ...items.map((it) => ({ id: 'use-' + it.key, name: it.label + ' ' + T('use'), unit: it.unit + '/' + T('day'), group: T('Daily use'), ...use(it.key) })),
      ...power.categories.map((c) => ({ id: 'pwr-' + c.key, name: T('Power') + ' · ' + c.label, unit: 'kWh', group: T('Power'),
        ...byDay((n) => kwhOf(n, c.key), { ahead: true, now: true }) })),
      { id: 'pwr-total', name: T('Power · all categories'), unit: 'kWh', group: T('Power'),
        ...byDay((n) => { const vals = power.categories.map((c) => kwhOf(n, c.key)).filter((v) => v != null);
          return vals.length ? Math.round(vals.reduce((s, v) => s + v, 0) * 100) / 100 : null; }, { ahead: true, now: true }) },
      // the power generated by the bike (9 October: everything on the Sensors tab)
      { id: 'bike-rounds', name: T('Rounds pedalled'), unit: T('rounds'), group: T('Power generated'), ...bikeRounds },
      { id: 'bike-battery', name: T('Battery charged'), unit: '%', group: T('Power generated'), scaleMax: 100, ...bikeBattery },
      { id: 'meal-kcal', name: T('Meals energy'), unit: 'kcal', group: T('Meals'), ...mealSum('kcal') },
      { id: 'meal-water', name: T('Meals water'), unit: 'L', group: T('Meals'), ...mealSum('water_litres') },
      { id: 'meal-power', name: T('Meals power'), unit: 'Wh', group: T('Meals'), ...mealSum('energy_wh') },
      // the rest of Today's Meal (9 October): each meal's carbon dioxide equivalent, water footprint and nutrients from the
      // recipe book, and the preparation time filed with it — the day's together
      { id: 'meal-co2e', name: T('Meals CO₂e'), unit: 'kg', group: T('Meals'), ...mealTotal((x) => x.co2e_kg, 3) },
      { id: 'meal-footprint', name: T('Meals water footprint'), unit: 'L', group: T('Meals'), ...mealTotal((x) => x.water_footprint_l, 1) },
      { id: 'meal-prep', name: T('Meals preparation'), unit: 'min', group: T('Meals'), ...mealTotal((x) => x.prep_minutes, 0) },
      ...L.MEAL_NUTRIENTS.map(([k, label, unit]) => ({ id: 'meal-' + k, name: T('Meals ' + label.toLowerCase()), unit, group: T('Meals'),
        ...mealTotal((x) => (x.nutrients ? x.nutrients[k] : null), k === 'sodium_mg' ? 0 : 1) })),
      { id: 'steps', name: T('Steps taken') + ' · ' + T('crew total'), unit: T('steps'), group: T('Crew'), ...figure('steps') },
      ...crew.map((c) => ({ id: 'steps-' + String(c.designation).toLowerCase().replace(/[^a-z0-9]+/g, '-'),
        name: T('Steps taken') + ' · ' + officerName(c), unit: T('steps'), group: T('Crew'), ...stepsOf(c.designation) })),
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



  /* ---- every trend as a chart: the habitat's channels, each store, the
     crew's counts. habitat.js draws them from the spec above plus its own
     habitat rows, and redraws when the period selector changes. The screens
     have them as a panel of their own (the Trends screen); the dashboard
     stands them inside the Sensors panel, under the tiles and the hardware's
     charts, drawn smaller (aura.css, .hbt-trends-in) — one Sensors tab holds
     the instruments, the hardware and the trends, and a link to #trends
     lands on them there. */
  const trendsBlock = `
    <div class="trends" id="hbt-trends" data-date="${esc(m.today)}" data-day-start="${missionLib.venueMidnightUtc(m.today, m.timezone)}" data-axis-start="${esc(axis.start)}" data-axis-end="${esc(axis.end)}" data-axis-run="${axis.run ? '1' : '0'}" data-run-start="${esc(m.start_date)}" data-run-end="${esc(m.end_date)}" data-spec="${esc(JSON.stringify(trendSpec))}">
      <div id="hbt-tcharts"></div>
    </div>`;
  const trends = dpanel({ id: 'trends', title: T('Trends'), span: 12 }, trendsBlock);
  const trendsInSensors = trendsInside ? `
    <div class="hbt-trends-in" id="trends">
      <div class="hbt-sec"><h3>${T('Trends')}</h3></div>
      ${trendsBlock}
    </div>` : '';

  /* ---- the habitat's own hardware, through Home Assistant — the Cricket
     temperature sensor, the Shelly plug and whatever else is listed in
     content/home-assistant.json — its day charts drawn inside the Sensors
     panel, under the node's tiles, the stores and the power, as part of the
     one Sensors tab: no heading of their own (each chart carries its name).
     Rendered only when the bridge is configured in .env; /public/hardware.js
     keeps it live from /api/hardware (it looks for #hw-live, wherever that
     stands). */
  const hardwareSection = hardware && hardware.configured && (hardware.sensors || []).length
    ? `<section class="hw-in-habitat" id="hardware" aria-label="${esc(T('Habitat hardware'))}">
        <div class="hbt hw"><div id="hw-live" data-poll="${hardware.pollMs}" data-version="${esc(require('../../lib/home-assistant').version(hardware))}" data-w="${HW_W}" data-h="${HW_H}">${hardwareInner(hardware, T)}</div></div>
      </section>`
    : '';

  const habitat = dpanel({ id: 'habitat', title: T('Sensors'), meta: T('Live sensors and Habitat measurements'), span: 12, cls: 'compact',
    live: T('The readings refresh by themselves as the sensors report') }, `
    <!-- The habitat's instruments. The station server polls the habitat sensor
         (through Home Assistant — or the external node, src/lib/critical.js)
         and stores every reading in its own database; /public/habitat.js draws
         these tiles from /api/habitat/data and refreshes on the station's cycle. -->
    <div class="hbt" id="sensors">
      <!-- 8 October: the instruments on four tracks — the oxygen, the carbon dioxide, the temperature, the humidity; the air
           pressure, the air quality, the light and Karlsruhe (in the place the volatile organic compounds had: "move the
           Karlsruhe screen to be in place of the volatile organic compounds") — each with its sign; then the steps and the
           stores; then the power, the volatile organic compounds and the astronauts; the hardware's charts under them
           (aura.css, #hbt-bento). The power generated by the bike (8 October) stands beside the steps, the stores under
           them the panel's width. -->
      <div class="bento" id="hbt-bento">
        <section class="tile t-sens t-o2" id="o2-live">${oxygenTileInner(hardware, T)}</section>${SENSOR_TILES.filter((d) => d.k !== 'voc').map((d) => sensorTile(T, d)).join('')}${vizTile(T, 'city')}
        <div class="hbt-notes" id="hbt-notes"></div>
        ${figureTile(crewFigures, m, { key: 'steps', label: 'Steps taken', unit: T('steps'), colour: 'var(--ink)', fmt: (v) => v.toLocaleString('en-GB'), T, crew, icon: 'steps' })}
        ${bikeTile(T, bike, m)}
        <section class="tile t-res" id="stores">
          ${sensorIcon('res')}
          <h3>${T('Resources')}</h3>
          <span class="sub">${T('Carried in · never resupplied')}</span>
          ${inventoryGauges(inventory, { cells: true, T })}
        </section>
        <section class="tile t-pwr" id="power">
          ${sensorIcon('pwr')}
          <h3>${T('Power consumed')}</h3>
          <div id="pwr-live">${powerTileInner(ctx, power)}</div>
        </section>${SENSOR_TILES.filter((d) => d.k === 'voc').map((d) => sensorTile(T, d)).join('')}${vizTile(T, 'radar', { n: crew.length })}
      </div>
    </div>
    ${hardwareSection}${trendsInSensors}`);

  /* ---- the newest stills out of the cloud folder, as a strip of their own at
     the head of the dashboard — under its heading, above the two doors (At a
     Glance, Media) — kept live by /public/cloud.js on the folder's cadence. */
  const cloudStrip = cloud ? `<div class="cloud-latest" id="cloud-latest" data-version="${esc(cloud.snapshot.version || '')}" data-poll="${(Number(cloud.snapshot.checkSeconds) || 20) * 1000}">${require('./media').cloudLatestInner(T, cloud, { tz: m.timezone })}</div>` : '';


  /* ---- the three daily blogs, the front row of the stack of folders: the science
     officer's Daily Mission Report, the health officer's Health Report
     (the day's health activities) and the Commander Log — which is the
     commanding officer's Daily Blog, under the name the station gives it.
     All three are written in mission control (the Science, Health and
     Commanding officer tabs) and are public the moment they are saved, as
     everywhere else on the station.

     Each panel stands under the CURRENT DAY — the day the schedule and the
     meal panels above are showing: today's SOL during the run, SOL 01 before
     it — and shows the day's post once it is written. The crew write at
     night, so through the day the post would be missing: until today's is
     written, the panel shows the LATEST POST OF AN EARLIER DAY instead (the
     day before, or the last day that has one), under today's date and
     without a note, so that a visitor never meets an empty blog; the
     placeholder stands only while no post at all has been written yet.
     Earlier days are on the crew log and in At a Glance, day by day. The post
     is read where it stands: a panel's title is not a link and a photograph
     in a post is shown, not linked — nothing in a panel leads off the page,
     so there is nothing to click into and back out of. */
  const blogDay = m.clampedDay;
  const blogDate = (allDays[blogDay - 1] || {}).date || m.today;
  // A post is its rendered body; one that comes out empty — a picture since
  // withdrawn and nothing else — is left out rather than shown as a blank card.
  const post = (body, attached) => MV.entryHtml(body, attached, { lookup: mediaLookup, T, link: false });
  const reportOn = (kind, d) => ((allDays[d - 1] || {}).notes || [])
    .filter((n) => n.kind === kind).map((n) => post(n.body, [])).filter(Boolean);
  const commander = crew.find((c) => /COMM/i.test(c.designation)) || crew[0] || null;
  const commanderOn = (d) => (commander ? ((logDays[d - 1] || {}).entries || [])
    .filter((e) => e.blog === 'commander' && !e.placeholder).map((e) => post(e.body, e.media || [])).filter(Boolean) : []);
  // today's post — or, until it is written, the latest earlier day's (see above)
  const latest = (on) => { for (let d = blogDay; d >= 1; d--) { const posts = on(d); if (posts.length) return posts; } return []; };
  // NOW, before the run: the rehearsal day, mission day 0 (src/lib/mission.js). Once a blog is written under it the
  // three panels show NOW's posts, the way the run's day will be shown, headed NOW; until then they keep the opening
  // day's empty slots. Nothing written under NOW ever stands in a run day's panel.
  const onNow = (kind) => (kind === 'commander'
    ? (commander && nowLog ? nowLog.entries.filter((e) => e.blog === 'commander' && !e.placeholder).map((e) => post(e.body, e.media || [])).filter(Boolean) : [])
    : (nowDay ? nowDay.notes.filter((n) => n.kind === kind && n.published_at).map((n) => post(n.body, [])).filter(Boolean) : []));
  const nowWritten = !!(m.phase === 'PRE_LAUNCH' && (onNow('commander').length || onNow('SCIENCE').length || onNow('HEALTH').length));   // before the run only: during a rehearsal run the sols have their own
  const reportToday = (kind) => (nowWritten ? onNow(kind) : latest((d) => reportOn(kind, d)));
  const commanderToday = nowWritten ? onNow('commander') : latest(commanderOn);
  // A panel is as tall as the post in it, up to a limit, and scrolls from
  // there (.h-4 and .blog-scroll in the stylesheet) — so with nothing written
  // yet the three make a low row rather than a wall of empty boxes.
  const blogPanel = ({ id, title, posts, empty }) => dpanel({ id, title, span: 4, cls: 'h-4 blogp',
      meta: nowWritten ? `${T('NOW')} · ${esc(shortDay(m.today))}` : `SOL ${day3} · ${esc(shortDay(blogDate))}` },
    // No whitespace inside the card body: it renders with pre-line.
    posts.length ? `<div class="blog-scroll" tabindex="0" role="region" aria-label="${esc(title)}">${
      posts.map((html) => `<div class="card log-entry"><div class="card-body entry-post">${html}</div></div>`).join('')}</div>`
    : `<div class="empty">${T(empty)} ${nowWritten ? T('today') : `SOL ${day3}`}${pre && !nowWritten ? ` — ${T('occupied from')} ${esc(m.startLabel)}` : ''}</div>`);
  const blogScience = blogPanel({ id: 'blog-science', title: T('Daily Mission Report'),
    posts: reportToday('SCIENCE'), empty: 'No mission report yet for' });
  const blogHealth = blogPanel({ id: 'blog-health', title: T('Health Report'),
    posts: reportToday('HEALTH'), empty: 'No health report yet for' });
  const blogCommander = blogPanel({ id: 'blog-commander', title: T('Commander Log'),
    posts: commanderToday, empty: 'No commander log yet for' });

  /* ---- today's meals: each with its kcal and, beside it, the power it drew — the food meter (the Food channel's energy
     meter) read between the meal's hours (breakfast 06:00–09:00, lunch 09:00–14:00, dinner 15:00–22:00; an added meal counts with the one of
     its hour), data.mealsFor — always with its unit, 0 Wh where the meter has nothing yet. The meta line sums the day:
     kcal, the metered watt hours ("so far" while a meal's hours still run), CO₂e from the recipe book. */
  // the day's watt hours: each window once — the meal that carries it (data.mealsFor), not an added meal counting with it
  const mealsWh = today && today.meals.some((x) => x.energy_source === 'meter') ? today.meals.reduce((s, x) => s + (x.energy_source === 'meter' ? x.power_wh : 0), 0) : null;
  const mealsRunning = !!(today && today.meals.some((x) => x.power_running));
  const galley = dpanel({ id: 'galley', title: T('Today’s Meal'), meta: today && today.meals.length
      ? `${today.kcalPlanned} kcal${today.waterPlanned ? ` · ${today.waterPlanned.toFixed(1)} L` : ''}${mealsWh != null ? ` · ${mealsWh} Wh${mealsRunning ? ` ${T('so far')}` : ''}` : today.energyPlanned ? ` · ${today.energyPlanned} Wh` : ''}${today.co2ePlanned != null ? ` · ${+today.co2ePlanned.toFixed(2)} kg CO₂e` : ''}` : '', span: 4, cls: 'h-3 scroll' },
    today && today.meals.length ? `<div class="meals">${today.meals.map((x) => `
      <div class="meal">
        <span class="meal-slot">${esc(L.slotName(T, x.slot))}</span>
        <b>${esc(x.name)}</b>
        <span class="meal-figs">${esc(L.mealFigs(x, T))}</span>
        ${L.mealEco(x, T)}
      </div>`).join('')}</div>` : `<div class="empty">${T('No meals filed for today')}</div>`);

  // Each officer with their current condition — the latest state filed from
  // mission control, translated to language in src/lib/mood.js. The slider
  // number itself is never published; only the word and the sentence.
  // (no line under its heading: "Condition as reported · never as numbers" stood there until 8 October — "from Crew
  // Moods remove: Condition as reported · never as numbers"; the numbers stay unpublished all the same)
  const crewPanel = dpanel({ id: 'crew', title: T('Crew Moods'), span: 4, cls: 'h-3 scroll' },
    `<div class="officers">${crew.map((c) => {
      const t = moodLib.translate(c.mood);
      // The face mission control filed — the nearest of its five, calm to
      // angry — stands beside the name (a blank face while nothing is filed).
      const face = c.mood ? moodLib.FACES.reduce((best, f) => (Math.abs(f.v - c.mood.calm_tense) < Math.abs(best.v - c.mood.calm_tense) ? f : best), moodLib.FACES[0]) : null;
      return `<div class="officer">
        <span class="officer-face band-${face ? moodLib.FACES.indexOf(face) : 'none'}" aria-hidden="true">${face ? moodLib.faceSvg(face) : moodLib.faceSvg({ mouth: 'M11 20 h10', eyes: 'dot' })}</span>
        <div class="officer-id">
          <b>${esc(officer.shown(c.designation))}</b>
          <span class="officer-role">${esc(T(c.role))}</span>
        </div>
        <span class="badge${c.mood ? ' ok' : ''}">${esc(T(t.condition))}</span>
        <div class="officer-note">${c.mood ? esc(T(t.lines[0])) : T('No state filed yet')}</div>
      </div>`;
    }).join('')}</div>`);

  /* ---- media out of the habitat: the newest items, and the door to all of them */
  const mediaPanel = dpanel({ id: 'media', title: T('Media'), href: '/media',
    meta: mediaCounts.total ? `${mediaCounts.total} ${T(mediaCounts.total === 1 ? 'item' : 'items')} · ${MV.fmtBytes(mediaCounts.bytes)} · ${T('originals, every one downloadable')}` : T('photographs, video and sound out of the habitat'), span: 12 },
    media.length ? `${MV.strip(media, mediaCounts.total > media.length ? { href: '/media', n: mediaCounts.total - media.length, label: T('See everything') } : null)}
      <div class="dpanel-more"><a class="btn" href="/media">${T('All media, day by day')} →</a><a class="btn" href="/media/export.zip">${T('Download everything')} · ZIP</a></div>`
    : `<div class="empty">${T('Nothing has been sent out of the habitat yet')}${pre ? ` — ${T('occupied from')} ${esc(m.startLabel)}` : ''}</div>`);

  const whole = dpanel({ id: 'whole', title: T('The whole mission'),
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

  /* ---- today's scientific mission (content/missions.json, content.missionForDay): at the head of the dashboard, over the
     index of folders — the mission's number and title, its central question, the three parts of the day (Morning,
     Afternoon, EVA) as the sheet gives them, the question for the community hour in English and German as the sheet has
     it. (The sheets themselves, PDFs in missions/, are served at /missions/<file> but not linked from here.) The words
     are the sheet's own, shown as written, like the schedule's; the labels are in the visitor's language. The number is
     printed with two figures — 00 is the first day's. A sheet still to be written (`placeholder`, a copy of another's PDF
     for now) shows its title and says the sheet is to come. */
  const missionPanel = (() => {
    const missionNo = (no) => String(no).padStart(2, '0');   // the number as the production counts them: 00 on the first day
    const head = `<header class="dpanel-head"><div class="dpanel-title"><h3>${T('Today’s Mission')}</h3></div>
        <span class="dpanel-meta">SOL ${day3} · ${esc(shortDay(blogDate))}${mission ? ` · ${T('Mission No.')} ${missionNo(mission.no)}` : ''}</span></header>`;
    if (!mission) return `<section class="dpanel span-12 mission-today" id="mission-today" aria-label="${esc(T('Today’s Mission'))}">${head}
      <div class="dpanel-body"><div class="empty">${T('No mission filed for')} SOL ${day3}${pre ? ` — ${T('occupied from')} ${esc(m.startLabel)}` : ''}</div></div></section>`;
    // a part's lines: a line in capitals is a heading, bullets and numbered lines are lists, → a pointer, the rest paragraphs
    const lines = (arr) => {
      const out = []; let list = null, kind = '';
      const close = () => { if (list) { out.push(`<${kind}>${list.join('')}</${kind}>`); list = null; kind = ''; } };
      for (const raw of arr) {
        const l = String(raw).trim(); if (!l) continue;
        const bullet = /^•\s*/.test(l), num = /^\d+\.\s+/.test(l);
        if (bullet || num) {
          const k = bullet ? 'ul' : 'ol';
          if (list && kind !== k) close();
          if (!list) { list = []; kind = k; }
          list.push(`<li>${esc(l.replace(bullet ? /^•\s*/ : /^\d+\.\s+/, ''))}</li>`);
          continue;
        }
        close();
        if (/^→/.test(l)) out.push(`<p class="mission-arrow">${esc(l.replace(/^→\s*/, ''))}</p>`);
        else if (l.length > 2 && l === l.toUpperCase() && /[A-Z]/.test(l)) out.push(`<b class="mission-sub">${esc(l)}</b>`);
        else out.push(`<p>${esc(l)}</p>`);
      }
      close();
      return out.join('');
    };
    const part = (key, name) => (mission[key].length ? `<div class="mission-part is-${key}"><h4>${T(name)}</h4>${lines(mission[key])}</div>` : '');
    const c = mission.community, community = c.en || c.de ? `<p class="mission-community"><span class="mission-k">${T('Question for the community hour')}</span>${
      c.en ? `<span class="mission-cq">${esc(c.en)}</span>` : ''}${c.de ? `<span class="mission-cq is-de" lang="de">${esc(c.de)}</span>` : ''}</p>` : '';
    return `<section class="dpanel span-12 mission-today" id="mission-today" aria-labelledby="mission-today-title">${head}
      <div class="dpanel-body mission-body">
        <div class="mission-lead">
          <span class="mission-no">${T('Mission No.')} ${missionNo(mission.no)}</span>
          <h4 class="mission-title" id="mission-today-title">${esc(mission.title)}</h4>
          ${mission.question ? `<p class="mission-q"><span class="mission-k">${T('Central question')}</span>${esc(mission.question)}</p>` : ''}
          ${mission.placeholder ? `<p class="note mission-tocome">${T('The sheet for this mission is still to come.')}</p>` : ''}
        </div>
        <div class="mission-parts">${part('morning', 'Morning')}${part('afternoon', 'Afternoon')}${part('eva', 'EVA')}${part('evening', 'Evening')}</div>
        <div class="mission-foot">
          ${community}
          <a class="glance-link mission-blog" href="#blog-science" title="${esc(T('Daily Mission Report'))}">
            <span class="glance-link-title">${T('Mission Report')}</span>
            <span class="glance-link-arrow">-&gt;</span>
          </a>
        </div>
      </div>
    </section>`;
  })();

  /* ---- the mission for the installation's mission screen (9 October: "undo the typing; only show the mission, in large
     type"): the same mission alone and large — its number, its title, its central question, and the question for the
     community hour in the screen's own language (the sheet's other, where it has only one) — without the parts of the day,
     whose lists would only stand there small (the dashboard keeps them). Its own class, so the screen's rules (screen.css,
     .mission-big) touch nothing on the site. */
  const missionBig = (() => {
    const missionNo = (no) => String(no).padStart(2, '0');
    const head = `<header class="dpanel-head"><div class="dpanel-title"><h3>${T('Today’s Mission')}</h3></div>
        <span class="dpanel-meta">SOL ${day3} · ${esc(shortDay(blogDate))}</span></header>`;
    if (!mission) return `<section class="dpanel span-12 mission-big" aria-label="${esc(T('Today’s Mission'))}">${head}
      <div class="dpanel-body"><p class="mb-q">${T('No mission filed for')} SOL ${day3}</p></div></section>`;
    const c = mission.community || {}, de = ctx.lang === 'de';
    const cq = de ? c.de || c.en : c.en || c.de, cqLang = cq && cq === c.de && !de ? ' lang="de"' : cq && cq === c.en && de ? ' lang="en"' : '';
    return `<section class="dpanel span-12 mission-big" aria-labelledby="mission-big-title">${head}
      <div class="dpanel-body">
        <span class="mb-no">${T('Mission No.')} ${missionNo(mission.no)}</span>
        <h4 class="mb-title" id="mission-big-title">${esc(mission.title)}</h4>
        ${mission.question ? `<span class="mb-k">${T('Central question')}</span><p class="mb-q">${esc(mission.question)}</p>` : ''}
        ${cq ? `<span class="mb-k">${T('Question for the community hour')}</span><p class="mb-cq"${cqLang}>${esc(cq)}</p>` : ''}
      </div>
    </section>`;
  })();

  return { m, T, day3, blogDate, kpis, strip, cloudStrip, missionPanel, missionBig, habitat, trends, schedule, galley, crewPanel, blogCommander, blogHealth, blogScience };
}

/* The dashboard's LIVE mark, at the right of its head: a pill with a pulsing dot (aura.css). Decoration — hidden from
   assistive technology; the strip of live pictures under the head carries a LIVE mark of its own for its readers. */
function dashLive(T) {
  return `
      <div class="dash-live" aria-hidden="true"><span class="dl-live"><i></i>${T('LIVE')}</span></div>`;
}

/* Two instruments without a reading among the habitat's tiles — visual elements in the bento, each on a row of its own
   (aura.css draws them, public/live.js moves what moves in them): Astronauts tracked, at the end of the sensors' third
   row — a radar with a sweep going round, rings and a rim of ticks, and inside it one dot an astronaut (`n`, the crew's
   number), each wandering about the disc and lit as the sweep passes over it; Karlsruhe between the stores and the
   power — the city as its fan, the plan drawn from the Schloss: rings and the thirty-two rays, Red Dust City at the
   Marktplatz, the ground station at the ZKM and the dashed link between them with a signal going along it, a sweep going
   slowly round. Decoration, nothing more: hidden from assistive technology, not one figure in them (the dots are as
   many as the crew, which the head's figure says in words); the readings are the other tiles'. */
function vizTile(T, id, { n = 3 } = {}) {
  // named as the instruments are, with its sign at the top right (a pin for Karlsruhe, a radar for the astronauts)
  const tile = (key, inner) => `
        <section class="tile t-viz t-viz-${id}" aria-hidden="true"><span class="viz-k">${T(key)}</span>${sensorIcon(id === 'city' ? 'map' : 'radar')}${inner}</section>`;
  if (id === 'city') return tile('Karlsruhe', cityFan(T));
  const ticks = Array.from({ length: 48 }, (_, i) => {
    const a = (i / 48) * Math.PI * 2, long = i % 6 === 0, r1 = long ? 50 : 53, r2 = 57;
    return `<line x1="${(60 + r1 * Math.cos(a)).toFixed(2)}" y1="${(60 + r1 * Math.sin(a)).toFixed(2)}" x2="${(60 + r2 * Math.cos(a)).toFixed(2)}" y2="${(60 + r2 * Math.sin(a)).toFixed(2)}"${long ? ' class="dl-tick-l"' : ''}/>`;
  }).join('');
  // the astronauts: one dot each, set down apart from one another to begin with (live.js moves them)
  const astros = Array.from({ length: Math.max(1, Math.min(6, n)) }, (_, i) => { const a = (i / Math.max(1, Math.min(6, n))) * Math.PI * 2 + 0.6, r = 22 + (i % 2) * 10; return `<circle class="dl-astro" cx="${(60 + r * Math.cos(a)).toFixed(1)}" cy="${(60 + r * Math.sin(a)).toFixed(1)}" r="2.6"/>`; }).join('');
  return tile('Astronauts tracked', `
          <svg class="dl-radar" viewBox="0 0 120 120">
            <defs>
              <linearGradient id="dl-sweep" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="var(--cobalt)" stop-opacity="0"/><stop offset="1" stop-color="var(--cobalt)" stop-opacity=".7"/></linearGradient>
            </defs>
            <g class="dl-ticks">${ticks}</g>
            <circle class="dl-ring" cx="60" cy="60" r="47"/>
            <circle class="dl-ring dl-dash" cx="60" cy="60" r="34"/>
            <circle class="dl-ring dl-dash" cx="60" cy="60" r="21"/>
            <circle class="dl-ring" cx="60" cy="60" r="8"/>
            <line class="dl-cross" x1="60" y1="13" x2="60" y2="107"/><line class="dl-cross" x1="13" y1="60" x2="107" y2="60"/>
            <g class="dl-sweep"><path d="M60 60 L60 13 A47 47 0 0 1 93.2 26.8 Z" fill="url(#dl-sweep)"/><line x1="60" y1="60" x2="60" y2="13"/></g>
            <g class="dl-crew">${astros}</g>
          </svg>`);
}

/* Karlsruhe as its fan (the stores' row, vizTile 'city'): the plan of the city drawn from the Schloss, as the mock-up
   draws it — a disc of rings and the thirty-two rays of the fan, north up, nothing written on the rings and no N — and on
   it, to scale, the three places of the station: the Schloss at the centre (a small square), Red Dust City at the
   Marktplatz (a dot of Mars with a ring pulsing out of it, 480 m south of the Schloss), the ground station at the ZKM
   (a diamond of cobalt, 2 km to the south-west) and the dashed link between the two with a signal going along it; a
   sweep of Mars going slowly round, as a radar's. 31 units a kilometre, the disc 2.4 km across its radius; the places'
   offsets from the Schloss (49.0138 N, 8.4044 E) in kilometres east and south. aura.css draws and moves it; asked for
   less motion it stands. */
const CITY = { s: 31, R: 74, c: 80, rays: 32, places: { marktplatz: [-0.05, 0.48], zkm: [-1.54, 1.35] } };
function cityFan(T) {
  const { s, R, c, rays } = CITY;
  const f = (v) => String(+v.toFixed(1));                                    // one decimal, no float dust
  const at = ([e, so]) => ({ x: +(c + e * s).toFixed(1), y: +(c + so * s).toFixed(1) });
  const rdc = at(CITY.places.marktplatz), gs = at(CITY.places.zkm);
  const rings = [0.5, 1, 1.5, 2].map((km) => `<circle class="dl-ring${km % 1 ? ' dl-dash' : ''}" cx="${c}" cy="${c}" r="${(km * s).toFixed(1)}"/>`).join('');
  const fan = Array.from({ length: rays }, (_, i) => {
    const a = (i / rays) * Math.PI * 2, r0 = 5;
    return `<line x1="${(c + r0 * Math.sin(a)).toFixed(2)}" y1="${(c - r0 * Math.cos(a)).toFixed(2)}" x2="${(c + R * Math.sin(a)).toFixed(2)}" y2="${(c - R * Math.cos(a)).toFixed(2)}"/>`;
  }).join('');
  const sweep = `M${c} ${c} L${c} ${c - R} A${R} ${R} 0 0 1 ${(c + R * Math.sin(Math.PI / 8)).toFixed(1)} ${(c - R * Math.cos(Math.PI / 8)).toFixed(1)} Z`;
  return `
          <svg class="dl-city" viewBox="0 0 160 160" style="--lx:${f(gs.x - rdc.x)}px;--ly:${f(gs.y - rdc.y)}px">
            <defs>
              <linearGradient id="dl-fan-sweep" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="var(--mars)" stop-opacity="0"/><stop offset="1" stop-color="var(--mars)" stop-opacity=".5"/></linearGradient>
            </defs>
            <circle class="dl-city-disc" cx="${c}" cy="${c}" r="${R}"/>
            <g class="dl-fan">${fan}</g>
            ${rings}
            <circle class="dl-ring dl-rim" cx="${c}" cy="${c}" r="${R}"/>
            <g class="dl-fan-sweep"><path d="${sweep}" fill="url(#dl-fan-sweep)"/></g>
            <line class="dl-link" x1="${rdc.x}" y1="${rdc.y}" x2="${gs.x}" y2="${gs.y}"/>
            <circle class="dl-link-sig" cx="${rdc.x}" cy="${rdc.y}" r="1.6"/>
            <rect class="dl-schloss" x="${f(c - 2.5)}" y="${f(c - 2.5)}" width="5" height="5"/>
            <text class="dl-city-t dl-dim" x="${f(c + 6)}" y="${f(c + 2.5)}">${T('Schloss')}</text>
            <circle class="dl-rdc-ping" cx="${rdc.x}" cy="${rdc.y}" r="3.4"/>
            <circle class="dl-rdc" cx="${rdc.x}" cy="${rdc.y}" r="3.4"/>
            <text class="dl-city-t dl-hot" x="${f(rdc.x + 7)}" y="${f(rdc.y + 1)}">${T('Red Dust City')}</text>
            <text class="dl-city-t dl-dim" x="${f(rdc.x + 7)}" y="${f(rdc.y + 10)}">${T('Marktplatz')}</text>
            <rect class="dl-gs" x="${f(gs.x - 3)}" y="${f(gs.y - 3)}" width="6" height="6" transform="rotate(45 ${gs.x} ${gs.y})"/>
            <text class="dl-city-t dl-cool" x="${f(gs.x + 7)}" y="${f(gs.y + 1)}">${T('Ground station')}</text>
            <text class="dl-city-t dl-dim" x="${f(gs.x + 7)}" y="${f(gs.y + 10)}">${T('ZKM')}</text>
          </svg>`;
}

function dashboard(ctx, args) {
  const { m, T, day3, blogDate, kpis, strip, cloudStrip, missionPanel, habitat, schedule, galley, crewPanel, blogCommander, blogHealth, blogScience } = dashboardPanels(ctx, args, { trendsInside: true });
  return `
  <section class="dash" id="mission">
    <header class="dash-head" data-stop>
      <div>
        <h2 class="bigsec">${T('Mission dashboard')}</h2>
        <p class="dash-sub">${esc(m.name)} · ${esc(m.runLabel)} · ${dayWord(T, m.totalDays)}</p>
        <p class="dash-figs">${kpis}</p>
      </div>${dashLive(T)}
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
        { label: T('Sensors'), tabs: [
          { id: 'habitat', label: T('Sensors'), html: habitat } ] },
        { label: T('Daily Life'), tabs: [
          { id: 'mission-today', label: T('Today’s Mission'), short: T('Mission'), html: missionPanel },
          { id: 'schedule', label: T('Today’s Schedule'), short: T('Schedule'), html: schedule },
          { id: 'galley', label: T('Today’s Meal'), short: T('Meal'), html: galley },
          { id: 'crew', label: T('Crew Moods'), short: T('Moods'), html: crewPanel } ] },
        { label: T('Blogs'), tabs: [
          { id: 'blog-commander', label: T('Commander Log'), short: T('Commander::tab'), html: blogCommander },
          { id: 'blog-health', label: T('Health Report'), short: T('Health'), html: blogHealth },
          { id: 'blog-science', label: T('Daily Mission Report'), short: T('Report::tab'), html: blogScience } ] },
      ], { label: `${T('Mission dashboard')} · SOL ${day3} · ${shortDay(blogDate)}`, title: T('Mission dashboard') })}
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
 * yet answered shows its state — in transit, then awaiting reply — where the
 * answer will stand. Drawn on the board (mission page, messages page) and, after
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
  return { label: 'AWAITING REPLY', cls: 'ok' };   // ARRIVED · PENDING_APPROVAL · APPROVED: it is on Mars, and the crew have not answered yet
}

/* The card's line into space. From the moment a message is sent it is
   counted as on its way out of the atmosphere at the speed of light —
   299,792 km every second (and once the crew answer, it really is:
   src/lib/spacespeak.js hands it to SpaceSpeak then). The card says how far
   it has got, in the visitor's language and figures — and no longer when it
   was launched (8 October: "from all the messages, remove the Launched …
   ago part"; the card's own head carries the day and the hour it was sent);
   board.js keeps the figure running, a second at a time. Without a script
   the figure is the one the page was drawn with. */
const KM_PER_S = 299792.458;
const LOCALE = { de: 'de-DE', fr: 'fr-FR', en: 'en-GB' };
function fmtInt(n, lang) {
  try { return new Intl.NumberFormat(LOCALE[lang] || 'en-GB', { maximumFractionDigits: 0 }).format(n); } catch { return String(Math.round(n)); }
}
/** A big figure in words once it is big: every digit up to ten million, then "4.36 million", "3.95 billion",
 *  "1.02 trillion" — in the visitor's language, where the English billion is the German Milliarde and the French
 *  milliard (board.js has the same, for the running figure). */
const SCALES = [[1e15, 'quadrillion'], [1e12, 'trillion'], [1e9, 'billion'], [1e6, 'million']];
function fmtBig(n, lang, T = same) {
  if (n < 1e7) return fmtInt(n, lang);
  const [unit, word] = SCALES.find(([u]) => n >= u);
  let num;
  try { num = new Intl.NumberFormat(LOCALE[lang] || 'en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n / unit); }
  catch { num = (n / unit).toFixed(2); }
  // English says "4.83 billion km" whatever the figure; German and French have a plural for it (the dictionary's row),
  // and French puts "de" before the unit: "7,78 milliards de km"
  const one = /^1([.,]00)?$/.test(num);
  return `${num} ${lang === 'en' || one ? T(word) : T(word + 's')}${lang === 'fr' ? ' de' : ''}`;
}
function spaceLine(m, T = same, { compact = false } = {}) {
  // the count starts the moment the message was sent
  const at = Date.parse(m.submitted_at || '');
  if (Number.isNaN(at)) return '';
  const lang = T.lang || 'en';
  const secs = Math.max(0, (Date.now() - at) / 1000);
  const attrs = `data-launched="${esc(new Date(at).toISOString())}" data-au="${Number(m.distance_au || 0).toFixed(4)}" data-ls="${Math.round(Number(m.light_seconds || 0))}" data-callsign="${esc(m.callsign || '')}"`;
  // the wall's foot (the Write page): the figure alone and the › to its journey (no sign before it — the orbit's ellipse
  // stood there until 8 October); board.js moves the same .sp-km on
  if (compact) {
    return `<div class="card-space card-space-compact" ${attrs} title="${esc(T('This message is currently {km} km from Earth!').replace('{km}', fmtBig(secs * KM_PER_S, lang, T)))}">
      <span class="card-space-line"><b class="sp-km">${fmtBig(secs * KM_PER_S, lang, T)}</b> km</span>
      <span class="card-space-go" title="${esc(T('Follow its journey'))}">›</span>
    </div>`;
  }
  const sentence = esc(T('This message is currently {km} km from Earth!'))
    .replace('{km}', `<b class="sp-km">${fmtBig(secs * KM_PER_S, lang, T)}</b>`);
  // the card is opened by a tap (board.js): the one thing the message is heading for — Mars as it stood that day is
  // the message's own distance (orbital.js at the moment it was sent)
  return `<div class="card-space" ${attrs}>
      <span class="card-space-line">${sentence}</span>
      <span class="card-space-more"><span class="card-space-go">${T('Follow its journey')} ›</span></span>
    </div>`;
}

/** `T` puts the card's chrome — the state, Earth, CREW ANSWER, the tags —
 *  into the visitor's language. The archive passes nothing and gets
 *  English; what was written is never touched either way. The line of small
 *  print over the message is the callsign, Earth and the time it was sent;
 *  its tags stand under the text. The reply's own line (who answered, the
 *  habitat, when) is drawn only where `replyMeta` asks for it — the archive;
 *  the boards carry the answer alone. On a board (`board`) the card carries
 *  no reference number and no NEW badge (8 October: "remove the Ref also from
 *  the messages in the message board, remove the NEW tab also"); the
 *  archive's keep both. */
function messageCard(m, tz, T = same, { replyMeta = true, wall = false, board = false } = {}) {
  const fresh = m.response_at && (Date.now() - Date.parse(m.response_at)) < 6 * 3600000;
  const tags = (m.tags || '').split(',').filter(Boolean);
  const st = cardStatus(m);
  const short = (label) => label.replace(/^[A-Za-z]{2,3} /, '');                    // the day and the time, without the weekday
  const sent = short(whenLabel(m.submitted_at, tz)), replied = m.response_body ? short(whenLabel(m.response_at, tz)) : '';
  const home = (() => { try { return missionLib.config().name; } catch { return ''; } })() || T('Mars habitat');
  if (wall) return noteCard(m, { fresh, tags, st, sent, replied, T });
  const meta = [`<span class="cs">${esc(m.callsign)}</span>`, T('Earth'), `<time datetime="${esc(m.submitted_at)}">${esc(sent)}</time>`].join(' · ');
  // A card that is both the viewer's and unpublished is stamped data-pending:
  // without the script the stylesheet keeps it off the board; board.js lists
  // it with the rest. Such cards only ever reach their own sender's page.
  return `<article class="card xc${fresh ? ' fresh' : ''}${m.response_body ? ' has-reply' : ''}" id="m${m.id}"
      data-tags="${esc(tags.join(','))}"${m.mine ? ' data-mine="1"' : ''}${
      m.mine && m.pending ? ' data-pending="1"' : ''}>
    <div class="card-post">
      <div class="card-top">
        <span class="card-meta">${meta}</span>${board ? '' : `
        ${fresh ? `<span class="badge new">${T('New')}</span>` : ''}
        <span class="card-ref">Ref ${String(m.id).padStart(5, '0')}</span>`}
      </div>
      <div class="card-body">${esc(m.body)}</div>
      ${tags.length ? `<div class="card-tags">${tags.map((t) => '#' + esc(T(t))).join(' · ')}</div>` : ''}
    </div>
    ${spaceLine(m, T)}
    ${m.response_body ? `<div class="card-reply">
      <div class="who">${T('Crew answer')}</div>
      <p>${esc(m.response_body)}</p>
      ${replyMeta ? `<div class="card-reply-meta">${esc(m.responder ? T(officer.shown(m.responder)) : T('Mars habitat'))} · ${esc(home)} · <time datetime="${esc(m.response_at)}">${esc(replied)}</time></div>` : ''}
    </div>` : `<div class="card-state-line"><span class="badge card-state ${st.cls}">${T(st.label)}</span></div>`}
    <div class="card-foot">
      <span>${orbital.formatLightTime(m.light_seconds)}</span>
      <span>${m.distance_au.toFixed(2)} au</span>
    </div>
  </article>`;
}

/* A note on the wall (the Write page's board, boardWall; messageCard with `wall`): the card after the handed-over
   reference — a flat card with, in its corner, the message's signal (answered or still out; the folded corner stood
   there until October), its head the callsign alone (no Earth · you beside it — October asked for the label to go; the
   viewer's own notes are known by their edge in Mars; no disc of initials before it, no reference number and no NEW
   badge — 8 October); the message as the note's title, and right after it its tags, each a key that narrows the wall
   to that tag (board.js), in the message's own colour; under them the crew's answer as a quoted card of its own, after
   the second reference — who answered and where (no disc before it either), the day and time of the answer at its
   right, the answer under them — or the message's state where the answer will stand; a foot with the message's
   distance into space (spaceLine, compact — board.js moves it on and a tap on the card opens its journey) and the day
   and time it was sent. The viewer's own carry a Mars edge at the left. */
function noteCard(m, { fresh, tags, st, sent, replied, T }) {
  const cs = String(m.callsign || '');
  const title = (d) => { const x = officer.shown(d); return T(x.charAt(0) + x.slice(1).toLowerCase()); };   // "Commanding officer", as the crew panel writes it
  const who = m.responder ? title(m.responder) : T('Crew');
  // The mark in the corner, where the folded corner was (October): the message's round trip, Earth (cobalt, lower left)
  // to Mars (upper right) and back. Answered — the loop closed in Mars orange, Mars lit: the signal went and came back.
  // Not yet — the way out alone, dashed, with the message as a dot flying along it (the way back a ghost); once it has
  // arrived the dot rests inside Mars, hollow until the crew answer, and pulses (aura.css, .note-mark). Its words are
  // the state's own, as a title.
  // The orbit is round (9 October: "make the message sent and received visual a round orbit instead of elliptical"):
  // a circle through Earth and Mars about the middle of the mark — the two halves of it the way out and the way back.
  const planets = '<circle class="nm-earth" cx="7" cy="25" r="3.6"/><circle class="nm-mars" cx="25" cy="7" r="4.2"/>';
  const flying = m.state === 'TRANSMITTED' || m.state === 'IN_TRANSIT';
  const mark = m.response_body
    ? `<span class="note-mark is-answered" title="${esc(T('Answered by the crew'))}"><svg viewBox="0 0 32 32" aria-hidden="true"><circle class="nm-loop" cx="16" cy="16" r="12.73"/>${planets}</svg></span>`
    : `<span class="note-mark is-waiting${flying ? '' : ' is-arrived'}" title="${esc(T(st.label))}"><svg viewBox="0 0 32 32" aria-hidden="true"><path class="nm-back" d="M25 7A12.73 12.73 0 0 1 7 25"/><path class="nm-out" d="M7 25A12.73 12.73 0 0 1 25 7"/>${planets}<circle class="nm-ship" r="2.2"/></svg></span>`;
  return `<article class="card xc note${fresh ? ' fresh' : ''}${m.response_body ? ' has-reply' : ''}" id="m${m.id}"
      data-tags="${esc(tags.join(','))}"${m.mine ? ' data-mine="1"' : ''}${
      m.mine && m.pending ? ' data-pending="1"' : ''}>
    ${mark}
    <header class="note-head">
      <span class="note-who"><span class="cs">${esc(cs)}</span></span>
    </header>
    <div class="note-main">
      <p class="card-body note-title">${esc(m.body)}</p>
      ${tags.length ? `<div class="note-tags">${tags.map((t) => `<button type="button" class="note-tag tag-${esc(t.toLowerCase())}" data-filter="tag:${esc(t)}">#${esc(T(t))}</button>`).join('')}</div>` : ''}
      ${m.response_body ? `<div class="card-reply note-answer">
        <div class="note-ahead">
          <span class="note-awho"><span class="cs">${esc(who)}</span><span class="note-role">${T('Crew answer')} · ${T('Mars habitat')}</span></span>
          ${replied ? `<time class="note-awhen" datetime="${esc(m.response_at)}">${esc(replied)}</time>` : ''}
        </div>
        <p>${esc(m.response_body)}</p>
      </div>` : `<div class="card-state-line"><span class="badge card-state ${st.cls}">${T(st.label)}</span></div>`}
    </div>
    <footer class="note-foot">
      ${spaceLine(m, T, { compact: true })}
      <time class="note-when" datetime="${esc(m.submitted_at)}">${esc(sent)}</time>
    </footer>
    ${Number.isNaN(Date.parse(m.submitted_at || '')) ? '' : `<span class="note-hint" aria-hidden="true">${T('Click to see how far it has travelled')} ›</span>`}
  </article>`;
}

/**
 * The cards of the board, as one fragment. Rendered into the page on load and
 * again by /api/board for the live refresh, so the two cannot drift apart: one
 * function defines what the board holds. `wall`: the Write page's notes
 * (noteCard) rather than the screens' cards.
 */
function boardCards(recent, T = same, { wall = false } = {}) {
  const tz = (missionLib.config() || {}).timezone || 'Europe/Berlin';
  // One sequence, the newest first, by the moment each message was sent —
  // the viewer's own (or the installation's, on the station's board) among
  // the rest in their place, whatever state they are in; no group of them
  // at the top and no headings. Each card's reply carries no line of its own.
  const at = (m) => Date.parse(m.submitted_at || '') || 0;
  return recent.slice().sort((a, b) => at(b) - at(a) || b.id - a.id).map((m) => messageCard(m, tz, T, { replyMeta: false, wall, board: true })).join('');
}

/**
 * A stamp that changes whenever the board would render differently: a new
 * message, a change of state, a reply published, or a "New" badge lapsing.
 * The page carries it and /api/board reports it, so the browser only swaps
 * the cards when there is actually something new.
 */
function boardVersion(recent) {
  const key = recent.map((m) =>
    `${m.id}:${m.state}:${m.response_at || ''}:${m.launched_at || ''}:${m.mine ? 1 : 0}:${
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

  ${panel('DISTRIBUTION', `
    ${eyebrow('What people asked about')}
    ${stats.tags.length ? stats.tags.map((t) => `
      <div style="display:flex;align-items:center;gap:12px;margin-bottom:7px">
        <span style="font-family:var(--mono);font-size:10px;letter-spacing:.16em;color:var(--dim);width:110px">${esc(t.tag)}</span>
        <div class="bar" style="flex:1"><i style="width:${(t.n / stats.max * 100).toFixed(0)}%"></i></div>
        <span style="font-family:var(--mono);font-size:11px;color:var(--dim);width:34px;text-align:right">${t.n}</span>
      </div>`).join('') : '<div class="empty">NO DATA YET</div>'}`, 'earth-side')}

  <form method="get" action="/archive" class="panel">
    <span class="chan">FILTER</span>
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
  return L.page({ title: `Exchange ${message.id}`, ctx, body, current: '/archive', scripts: ['/board.js'] });   // board.js keeps the card's distance running
}

module.exports = {
  mission, writePage, dashboardPage, complete, inventoryGauges, boardCards, boardVersion, archive, single, messageCard,
  hardwareInner, powerTileInner, oxygenTileInner, ticker, habReading, dashboardPanels, boardScreen, habitatDome, composerDevice, portal,
  SENSOR_ICON,
};
