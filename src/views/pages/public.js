'use strict';
const L = require('../layout');
const { esc, panel, eyebrow, readout, orbitPlot, sparkline, pipeline,
        sym, legend, scaleStrip } = L;
const mood = require('../../lib/mood');
const orbital = require('../../lib/orbital');
const { TAGS } = require('../../lib/data');
const { composerBlock } = require('./communicate');

const fmtTime = (iso) => new Date(iso).toISOString().slice(11, 16) + ' UTC';
const fmtDate = (iso) => new Date(iso).toISOString().slice(0, 10);

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
    <p><a class="btn" href="/archive">Read the archive</a><a class="btn" href="/about">About the project</a></p>
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
function inventoryGauges(inventory, { compact = false, strip = false } = {}) {
  if (!inventory || !inventory.length) {
    return '<div class="empty">No inventory filed for today</div>';
  }
  const shown = compact ? inventory.filter((i) => i.critical).slice(0, 5) : inventory;
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

function mission(ctx, { sensors, crew, today, counts, recent, latestEntries = [], crewFigures = {},
                        inFlight = null, error = null, draft = '' }) {
  const pre = ctx.mission.phase === 'PRE_LAUNCH';
  const slotName = { BREAKFAST: 'Breakfast', LUNCH: 'Lunch', DINNER: 'Dinner', RATION: 'Ration' };

  /* The masthead: the Martian surface, full bleed, with the title and the
     mission day stamped over it. Drop a different photograph on public/hero.jpg
     to change the view; a Mars-toned ground shows if the file is missing. */
  const hero = `
  <header class="hero-art">
    <div class="hero-inner">
      <h1 class="hero-title">MARS!PLATZ</h1>
      <p class="hero-tagline">${pre
        ? 'Three people will live inside a sealed habitat for nine days.<br>This will be the only way to reach them, and everything you send arrives late.'
        : 'Three people are living inside a sealed habitat for nine days.<br>This is the only way to reach them, and everything you send arrives late.'}</p>
      <span class="hero-mark relay">SURFACE RELAY — CH-09</span>
      <span class="hero-mark hab">HAB-01</span>
      <div class="hero-day">
        ${pre
          ? `<b>T−${String(ctx.mission.countdown.days).padStart(3, '0')}</b>
             <span>DAYS · OPENS ${esc(ctx.mission.start_date)}</span>`
          : `<b>${String(ctx.mission.clampedDay).padStart(2, '0')}</b><em>/${String(ctx.mission.totalDays).padStart(2, '0')}</em>
             <span>MISSION DAY</span>`}
      </div>
    </div>
  </header>`;

  const body = `
  <div class="portal-grid" id="write">
    <div class="portal-main">
      <h2 class="bigsec">Communication Portal</h2>
      <div class="portal-row">
        ${panel('CH-09 / UPLINK', `
          <p class="note" style="margin-bottom:16px">You are
            <b style="color:var(--ink)">${esc(ctx.callsign)}</b> for this visit — no account, no name.</p>
          ${composerBlock(ctx, { inFlight, error, draft })}`, 'mars-side banded')}
        <div class="portal-orbit">${orbitPlot(ctx.geo, { size: 340 })}</div>
      </div>
      <div class="downarrow" aria-hidden="true">↓</div>
    </div>
    <section class="feed-col" id="exchanges">
      <h2 class="bigsec">Message Board</h2>
      <div class="feed-wrap"><div class="feed-scroll">
        ${recent.length
          ? `<div class="feed-filter" id="feed-filter" role="group" aria-label="Filter the board">
               <button type="button" class="chip active" data-filter="">ALL</button>
               <button type="button" class="chip mine" data-filter="mine">MY MESSAGES</button>
               ${TAGS.map((t) => `<button type="button" class="chip" data-filter="tag:${t}">${t}</button>`).join('')}
             </div>
             <div class="scroller feed"><div class="cards">${
               recent.map((m) => messageCard(ctx.visitor && m.visitor_id === ctx.visitor.id
                 ? { ...m, mine: true } : m)).join('')}
               <div class="empty" id="feed-empty" style="display:none">No messages match this filter</div>
             </div></div>
             <p class="feed-foot"><a class="btn" href="/messages">All ${counts.published} exchanges</a>
               <span class="counter">${counts.total} SENT · ${counts.published} REPLIED</span></p>`
          : '<div class="empty">Nothing transmitted yet — the first message could be yours</div>'}
      </div></div>
    </section>
  </div>

  <div class="band-grey">
  <input type="radio" name="dp" id="dp-plan" class="dp-radio" checked>
  <input type="radio" name="dp" id="dp-meals" class="dp-radio">
  <input type="radio" name="dp" id="dp-resources" class="dp-radio">
  <input type="radio" name="dp" id="dp-figures" class="dp-radio">
  <section class="panel dayplan">
    <div class="dp-grid">
      <div class="dp-pills">
        <label for="dp-plan"><i>001</i>daily plan</label>
        <label for="dp-meals"><i>002</i>meal plan</label>
        <label for="dp-resources"><i>003</i>resources</label>
        <label for="dp-figures"><i>004</i>figures</label>
      </div>
      <div class="dp-panes">
        <div class="dp-pane" id="pane-plan"><div class="dp-inner">
          <div class="dp-head">CH-30 / SCHEDULE — DAY ${String(ctx.mission.clampedDay).padStart(3, '0')}</div>
          ${today && today.tasks.length
            ? `<div class="rows">${today.tasks.map((t) => `
              <div class="row ${t.status === 'DONE' ? 'done' : ''} ${t.status === 'ACTIVE' ? 'active' : ''}">
                <div class="t">${esc(t.time)}</div>
                <div class="m"><b>${esc(t.label)}</b>${t.detail ? `<span>${esc(t.detail)}</span>` : ''}</div>
              </div>`).join('')}</div>
              <p class="note" style="margin:14px 0 0"><a href="/schedule">The whole mission schedule</a></p>`
            : '<div class="empty">No schedule filed for today</div>'}
        </div></div>
        <div class="dp-pane" id="pane-meals"><div class="dp-inner">
          <div class="dp-head">CH-32 / GALLEY — DAY ${String(ctx.mission.clampedDay).padStart(3, '0')}</div>
          ${today && today.meals.length
            ? `${today.meals.map((m) => `<div style="border-bottom:1px solid var(--rule);padding:10px 0">
                <div class="eyebrow" style="margin-bottom:4px">${esc(slotName[m.slot] || m.slot)}</div>
                <b style="font-family:var(--display);font-size:15px;text-transform:uppercase">${esc(m.name)}</b>
                <div class="note" style="font-size:11px;margin-top:3px">${m.kcal} kcal ·
                  ${m.water_litres} L water · ${m.energy_wh} Wh</div>
              </div>`).join('')}
              <div class="kv" style="margin-top:12px"><dt>Day total</dt>
                <dd>${today.kcalPlanned} kcal · ${today.waterPlanned.toFixed(1)} L · ${today.energyPlanned} Wh</dd></div>`
            : '<div class="empty">No meals filed for today</div>'}
        </div></div>
        <div class="dp-pane" id="pane-resources"><div class="dp-inner">
          <div class="dp-head">CH-34 / INVENTORY — DAY ${String(ctx.mission.clampedDay).padStart(3, '0')}</div>
          ${inventoryGauges(today ? today.inventory : [])}
        </div></div>
        <div class="dp-pane" id="pane-figures"><div class="dp-inner">
          <div class="dp-head">CH-13 / CREW FIGURES — COUNTED BY THE CREW</div>
          ${crewFiguresGraph(crewFigures, ctx.mission, {
            key: 'calories', label: 'Calories consumed', unit: 'kcal',
            colour: 'var(--orange)', fmt: (v) => v.toLocaleString('en-GB'),
          })}
          ${crewFiguresGraph(crewFigures, ctx.mission, {
            key: 'steps', label: 'Steps taken', unit: 'steps',
            colour: 'var(--ink)', fmt: (v) => (v >= 1000 ? (v / 1000) + 'k' : String(v)),
          })}
        </div></div>
      </div>
    </div>
  </section>

  <div class="sechead">
    <h2 class="bigsec">Habitat</h2><span class="secsub">SENSOR NODE · MEASURED LIVE</span>
  </div>
  <!-- The Sensor-11 dashboard. The station server polls the external feed and
       stores every reading in its own database; /public/habitat.js draws these
       tiles from /api/habitat/data and refreshes on the node's cycle. -->
  <div class="hbt" id="habitat">
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
      <section class="tile t-days">
        <h3 id="days15Title">15 days</h3>
        <div class="drows" id="days15"></div>
        <div class="daxis" id="days15Axis"></div>
      </section>
    </div>
    <div id="hbt-notes"></div>
    <div class="empty" id="hbt-empty">Waiting for the first read from the sensor node…</div>
  </div>

  ${panel('CH-34 / RESOURCES — CARRIED IN, NEVER RESUPPLIED',
    inventoryGauges(today ? today.inventory : [], { strip: true }), 'mars-side')}
  </div>
  `;
  return L.page({
    title: 'Mission', ctx, body, hero, hideNav: true, bodyClass: 'landing',
    current: '/', scripts: ['/composer.js', '/board.js', '/habitat.js'],
  });
}

/* ==================================================================== CREW */

function crewPage(ctx, { crew }) {
  const body = `
  <div style="padding:30px 0 18px">
    <div class="eyebrow">Channel group 12 · Crew report</div>
    <h1>Crew</h1>
    <p class="lede">The condition reading under each name is filed by mission control and
    summarised rather than quoted. The writing underneath it is not: each crew member files
    their own entry at the end of the day, from a terminal inside the habitat.</p>
  </div>
  <div class="grid g3">
    ${crew.map((c) => {
      const t = mood.translate(c.mood);
      return panel(`CH-12 / ${esc(c.designation.replace(/\s+/g, '-'))}`, `
        <div class="eyebrow">${esc(c.role)}</div>
        <h2 style="margin-bottom:6px">${esc(c.designation)}</h2>
        <span class="badge ${t.load > 65 ? 'warn' : 'mars'}">${esc(t.condition)}</span>
        <div class="kv" style="margin:16px 0">
          <dt>ACTIVITY</dt><dd>${esc(c.activity || '—')}</dd>
          <dt>STATUS</dt><dd>${esc(c.status)}</dd>
          <dt>FILED</dt><dd>${c.mood ? esc(fmtTime(c.mood.effective_at)) : '—'}</dd>
        </div>
        ${t.axes.map((a) => `
          <div class="axis-row">
            <div class="poles"><span>${esc(a.low)}</span><span>${esc(a.high)}</span></div>
            <div class="bar"><i class="${a.value > 70 ? 'warn' : 'ok'}" style="width:${a.value}%"></i></div>
            <div class="note" style="margin-top:5px">${esc(a.text)}</div>
          </div>`).join('')}
        ${c.latestEntry ? `<hr>
          <div class="eyebrow">In their own words · day ${String(c.latestEntry.mission_day).padStart(3, '0')}</div>
          <p style="white-space:pre-line;font-size:14px;color:#cbd8de">${esc(
            c.latestEntry.body.length > 320 ? c.latestEntry.body.slice(0, 320) + '…' : c.latestEntry.body)}</p>
          <a href="/logbook?crew=${c.id}">Everything they have written →</a>` : ''}
      `, 'mars-side');
    }).join('')}
  </div>
  ${panel('CH-12 / METHOD', `
    ${eyebrow('How this reading is produced')}
    <p class="note">Mission control files a state for each crew member on four axes during the
    performance. Those values are never shown to you as numbers; they are translated into the
    sentences above. The bar positions indicate direction only.</p>`)}
  `;
  return L.page({ title: 'Crew', ctx, body, current: '/crew' });
}

/**
 * The whole mission on one page. The day-by-day view answers "what is happening
 * now"; this answers "what is this run", which is a different question and the
 * one a visitor arriving cold actually has.
 */
function schedule(ctx, { days }) {
  const now = ctx.mission.clampedDay;
  const body = `
  <div style="padding:30px 0 18px">
    <div class="eyebrow">Channel group 30 · Mission plan
      <span class="brk">${ctx.mission.totalDays} days</span></div>
    <h1>The whole mission</h1>
    <p class="lede">Every day the crew are inside, start to finish. ${esc(ctx.mission.start_date)}
    to ${esc(ctx.mission.end_date)}. Days that have not happened yet are shown as planned.</p>
  </div>

  ${scaleStrip(ctx.mission)}
  <div class="eyebrow" style="margin:10px 0 var(--gutter)">
    ${ctx.mission.phase === 'ACTIVE' ? `Currently on day ${String(now).padStart(3, '0')}`
      : ctx.mission.phase === 'PRE_LAUNCH' ? 'The habitat is not occupied yet' : 'Mission complete'}</div>

  ${days.map((d) => {
    const state = d.missionDay < now ? 'past' : d.missionDay === now ? 'now' : 'ahead';
    return `<section class="panel ${state === 'now' ? 'mars-side' : ''}"
      style="${state === 'ahead' ? 'opacity:.72' : ''}">
      <span class="chan">DAY ${String(d.missionDay).padStart(3, '0')}</span>
      <div class="msg-head" style="padding:0 0 10px;border-bottom:1px solid var(--rule)">
        <span class="cs">Day ${String(d.missionDay).padStart(3, '0')}</span>
        <span>${esc(d.date)}</span>
        ${state === 'now' ? '<span class="badge warn">Today</span>' : ''}
        ${state === 'past' ? '<span class="badge">Complete</span>' : ''}
        ${state === 'ahead' ? '<span class="badge earth">Planned</span>' : ''}
        <span style="margin-left:auto">${d.tasks.length} tasks${
          d.meals.length ? ` · ${d.meals.length} meals` : ''}</span>
      </div>
      ${d.tasks.length ? `<div class="rows">${d.tasks.map((t) => `
        <div class="row ${t.status === 'DONE' ? 'done' : ''}">
          <div class="t">${esc(t.time)}</div>
          <div class="m"><b>${esc(t.label)}</b>${t.detail ? `<span>${esc(t.detail)}</span>` : ''}</div>
        </div>`).join('')}</div>`
        : '<div class="empty">No schedule filed for this day</div>'}
      ${d.meals.length ? `<div class="note" style="margin-top:12px">
        ${d.meals.map((m) => `<b style="color:var(--ink)">${esc(m.slot[0] + m.slot.slice(1).toLowerCase())}</b> ${esc(m.name)}`).join(' · ')}
      </div>` : ''}
      ${state !== 'ahead' ? `<p style="margin:12px 0 0"><a href="/day/${d.missionDay}">
        Day ${String(d.missionDay).padStart(3, '0')} in full</a></p>` : ''}
    </section>`;
  }).join('')}`;
  return L.page({ title: 'The whole mission', ctx, body, current: '/schedule' });
}

/* ================================================================= HABITAT */

/**
 * Every monitoring channel, including the ones nobody has wired up yet. A
 * channel that has never reported still appears with its label and limits, so
 * the page shows what the habitat is *meant* to be measuring as well as what it
 * currently is.
 */
function habitat(ctx, { sensors }) {
  const body = `
  <div style="padding:30px 0 18px">
    <div class="eyebrow">Channel group 01–09 · Environmental monitoring
      <span class="brk">${sensors.length} channels</span></div>
    <h1>Habitat</h1>
    <p class="lede">Readings arrive from sensors mounted inside the performance space and are
    stored as they come in. A channel that stops reporting is shown as lost rather than hidden —
    an interruption in the data is itself information about the habitat.</p>
  </div>

  <div class="grid g2">
    ${sensors.map((sn) => panel(
      `${esc(sn.metric.channel)} / ${esc(sn.metric.metric.toUpperCase())}`, `
      <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:14px">
        ${readout({
          label: sn.metric.label,
          value: sn.status.value == null ? '——' : sn.status.value.toFixed(2).replace(/\.00$/, ''),
          unit: sn.metric.unit,
          sub: sn.reading
            ? `Last sample ${esc(sn.reading.recorded_at.slice(11, 16))} UTC · ${sn.history.length} in 24 h`
            : 'No sample received yet',
          state: sn.status.state,
        })}
        <span class="badge ${sn.status.state}">${sym(sn.status.state)} ${esc(sn.status.label)}</span>
      </div>
      ${sparkline(sn.history, {
        warnMin: sn.metric.warn_min, warnMax: sn.metric.warn_max,
        colour: sn.status.state === 'bad' ? 'var(--orange)' : 'var(--ink)',
      })}
      <div class="kv" style="margin-top:10px">
        <dt>Expected</dt><dd>${sn.metric.warn_min ?? '—'} – ${sn.metric.warn_max ?? '—'} ${esc(sn.metric.unit)}</dd>
        <dt>Limits</dt><dd>${sn.metric.ok_min ?? '—'} – ${sn.metric.ok_max ?? '—'} ${esc(sn.metric.unit)}</dd>
      </div>`, 'mars-side')).join('') || '<div class="empty">No channels configured</div>'}
  </div>

  ${panel('CH-01 / KEY', `
    ${eyebrow('Reading the channels')}
    ${legend()}
    <p class="note" style="margin-top:16px">Status is shown as a mark rather than a colour, so it
    stays readable when the page is projected, printed, or seen by someone who cannot separate
    the accent from the ink.</p>`)}

  ${panel('CH-XX / EXPANSION', `
    ${eyebrow('Adding a channel')}
    <p class="note">Any device that posts to the ingest endpoint with a new metric name registers
    itself and appears here immediately. Give it a label, a unit and thresholds by adding it to
    <b>content/sensors.json</b>; until then it shows unconfigured rather than being dropped.</p>`)}
  `;
  return L.page({ title: 'Habitat', ctx, body, current: '/habitat' });
}

/* ============================================================ DAILY MISSION */

function dayPage(ctx, { day, dayNumber, hasPrev, hasNext, entries }) {
  if (!day || day.status === 'DRAFT') {
    const body = `<div style="padding:30px 0"><h1>Day ${dayNumber}</h1>
      <div class="empty">DAY CONTENT NOT YET TRANSMITTED FROM THE HABITAT</div></div>`;
    return L.page({ title: `Day ${dayNumber}`, ctx, body, current: '/day' });
  }
  const slotName = { BREAKFAST: 'Breakfast', LUNCH: 'Lunch', DINNER: 'Dinner', RATION: 'Ration' };
  const body = `
  <div style="padding:30px 0 18px">
    <div class="eyebrow">Channel group 30 · Daily mission</div>
    <h1>Mission day ${String(dayNumber).padStart(3, '0')}</h1>
    <p class="lede">${esc(day.date)} · a structured routine inside a closed volume of air.</p>
    <p>
      ${hasPrev ? `<a class="btn" href="/day/${dayNumber - 1}">← Day ${dayNumber - 1}</a>` : ''}
      ${hasNext ? `<a class="btn" href="/day/${dayNumber + 1}">Day ${dayNumber + 1} →</a>` : ''}
      ${dayNumber !== ctx.mission.clampedDay ? '<a class="btn" href="/day">Today</a>' : ''}
    </p>
  </div>

  <div class="grid g-hero">
    ${panel('CH-30 / SCHEDULE', `
      ${eyebrow('Task report')}
      <div class="rows">
      ${day.tasks.length ? day.tasks.map((t) => `
        <div class="row ${t.status === 'DONE' ? 'done' : ''} ${t.status === 'ACTIVE' ? 'active' : ''}">
          <div class="t">${esc(t.time)}</div>
          <div class="m"><b>${esc(t.label)}</b>${t.detail ? `<span>${esc(t.detail)}</span>` : ''}</div>
          <span class="badge ${t.status === 'ACTIVE' ? 'warn' : ''}">${esc(t.status)}</span>
        </div>`).join('') : '<div class="empty">NO TASKS FILED FOR THIS DAY</div>'}
      </div>`, 'mars-side')}

    ${panel('CH-34 / INVENTORY', `
      ${eyebrow('Resources on hand')}
      ${day.inventory.length ? day.inventory.map((i) => {
        const daysLeft = i.consumption > 0 ? i.quantity / i.consumption : null;
        const low = i.warn_below > 0 && i.quantity <= i.warn_below;
        return `<div style="margin-bottom:13px">
          <div style="display:flex;justify-content:space-between;font-family:var(--mono);font-size:12px">
            <span style="color:var(--dim);letter-spacing:.1em">${esc(i.label.toUpperCase())}</span>
            <span style="color:var(--ink-bright)">${i.quantity} ${esc(i.unit)}</span>
          </div>
          <div class="bar" style="margin:5px 0 4px">
            <i class="${low ? 'bad' : daysLeft && daysLeft < 6 ? 'warn' : 'ok'}"
               style="width:${Math.max(3, Math.min(100, daysLeft ? daysLeft * 6 : 100))}%"></i>
          </div>
          <div class="note" style="font-size:11px">${daysLeft
            ? `${daysLeft.toFixed(1)} days at ${i.consumption} ${esc(i.unit)}/day`
            : 'No consumption logged'}</div>
        </div>`;
      }).join('') : '<div class="empty">NO INVENTORY FILED</div>'}`, 'mars-side')}
  </div>

  ${panel('CH-32 / GALLEY', `
    ${eyebrow('Meal plan')}
    <div class="grid g3">
    ${day.meals.length ? day.meals.map((m) => `
      <div>
        <div class="eyebrow">${esc(slotName[m.slot] || m.slot)}</div>
        <h3>${esc(m.name)}</h3>
        ${m.components ? `<div class="note" style="white-space:pre-line;margin-bottom:10px">${esc(m.components)}</div>` : ''}
        <dl class="kv">
          <dt>ENERGY</dt><dd>${m.kcal} kcal</dd>
          <dt>WATER</dt><dd>${m.water_litres} L</dd>
          <dt>PREP</dt><dd>${m.prep_minutes} min · ${m.energy_wh} Wh</dd>
        </dl>
        ${m.notes ? `<p class="note" style="margin-top:10px">${esc(m.notes)}</p>` : ''}
      </div>`).join('') : '<div class="empty">NO MEALS FILED</div>'}
    </div>
    <hr>
    <div class="kv">
      <dt>DAY TOTAL</dt><dd>${day.kcalPlanned} kcal · ${day.waterPlanned.toFixed(1)} L water · ${day.energyPlanned} Wh</dd>
    </div>`, 'mars-side')}

  ${entries && entries.length ? panel('CH-50 / CREW LOG', `
    ${eyebrow(`What the crew wrote on day ${String(dayNumber).padStart(3, '0')}`)}
    ${entries.map((e) => `<article class="msg">
      <div class="msg-head">
        <span style="color:var(--oxide);letter-spacing:.18em">${esc(e.designation)}</span>
        <span>${esc(e.role)}</span>
      </div>
      <div class="msg-body" style="white-space:pre-line;font-size:15.5px">${esc(e.body)}</div>
    </article>`).join('')}
    <p style="margin:6px 0 0"><a href="/logbook">Full logbook →</a></p>`, 'mars-side')
  : `<div class="panel mars-side"><span class="chan">CH-50 / CREW LOG</span>
      ${eyebrow('Crew log')}
      <div class="empty">NO ENTRIES FILED FOR THIS DAY</div></div>`}

  ${day.notes.filter((n) => n.published_at).length ? panel('CH-36 / LOG', `
    ${eyebrow('Mission notes')}
    ${day.notes.filter((n) => n.published_at).map((n) => `
      <div class="row"><div class="t">${esc(fmtTime(n.posted_at))}</div>
      <div class="m"><b>${esc(n.body)}</b></div>
      <span class="badge ${n.kind === 'ANOMALY' ? 'warn' : ''}">${esc(n.kind)}</span></div>`).join('')}
  `, 'mars-side') : ''}
  `;
  return L.page({ title: `Mission day ${dayNumber}`, ctx, body, current: '/day' });
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
  return `<article class="card ${fresh ? 'fresh' : ''}" id="m${m.id}"
      data-tags="${esc(tags.join(','))}"${m.mine ? ' data-mine="1"' : ''}>
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

function board(ctx, { messages, counts }) {
  const body = `
  <div style="padding:30px 0 18px">
    <div class="eyebrow">Channel group 20 · Public exchange</div>
    <h1>Communication board</h1>
    <p class="lede">Every message here was written by a visitor, crossed the distance shown in
    the rail above, was read in the habitat, and was answered. ${counts.published} exchanges
    have been published so far.</p>
  </div>
  ${messages.length ? `<div class="cards">${messages.map(messageCard).join('')}</div>`
    : '<div class="empty">Nothing has been published yet</div>'}
  <p style="margin-top:24px"><a class="btn" href="/#write">Write to the habitat</a></p>`;
  return L.page({ title: 'Communication board', ctx, body, current: '/board' });
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
  mission, complete, schedule, habitat, crewPage, dayPage,
  inventoryGauges, board, archive, single, messageCard,
};
