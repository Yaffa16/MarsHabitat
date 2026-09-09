'use strict';
const L = require('../layout');
const { esc, panel, eyebrow, sym } = L;
const mood = require('../../lib/mood');
const orbital = require('../../lib/orbital');
const MV = require('./media');
const mediaLookup = require('../../lib/media').get;

const dd = (n) => String(n).padStart(3, '0');

/* The day over its 24 hours: one line per series, each on its own scale,
   hourly gridlines 00–24 (venue time), every point drawn, named at its end
   in its own colour. Points are keyed 1–25 (position 1 = 00:00, 25 = 24:00);
   the same shape the archive's day record carries. */
const HOUR_PALETTE = ['#ff6a1a', '#4f7bd9', '#8b6fd6', '#3aa66f', '#d94f7b', '#2aa7b8', '#c48a1c', '#6b7a8f',
  '#e0562e', '#3f5fbf', '#9c4dcc', '#2e8b57', '#b8336a', '#1f8fa3', '#a67c00', '#556677'];
function hourChart(seriesList, { caption = '' } = {}) {
  const W = 1000, padL = 12, padR = 210, padT = 14, padB = 30;
  const drawnIn = (seriesList || []).filter((s) => Object.keys(s.points || {}).length);
  if (!drawnIn.length) return '';
  const H = Math.max(240, drawnIn.length * 32 + padT + padB + 40);
  const iw = W - padL - padR, ih = H - padT - padB;
  const sx = (pos) => padL + ((pos - 1) / 24) * iw;
  const drawn = drawnIn.map((s, i) => {
    const entries = Object.entries(s.points).map(([p, v]) => [Number(p), v]).sort((a, b) => a[0] - b[0]);
    const vals = entries.map((e) => e[1]);
    let lo = Math.min(...vals), hi = Math.max(...vals);
    if (hi - lo < 1e-9) { hi += 0.5; lo -= 0.5; }
    const sy = (v) => padT + ih - ((v - lo) / (hi - lo)) * ih;
    const d = entries.map(([p, v], k) => `${k ? 'L' : 'M'}${sx(p).toFixed(1)},${sy(v).toFixed(1)}`).join('');
    const [, ev] = entries[entries.length - 1];
    return { s, colour: HOUR_PALETTE[i % HOUR_PALETTE.length], d,
      dots: entries.map(([p, v]) => [sx(p), sy(v)]),
      ex: sx(entries[entries.length - 1][0]), ey: sy(ev), last: ev };
  });
  const rows = [...drawn].sort((a, b) => a.ey - b.ey);
  let prev = -Infinity;
  for (const r of rows) { r.ty = Math.max(r.ey, prev + 30, padT + 8); prev = r.ty; }
  const over = rows.length ? rows[rows.length - 1].ty + 12 - (H - padB) : 0;
  if (over > 0) for (const r of rows) r.ty -= over;
  const railX = W - padR + 14;
  const fmt = (v) => v.toLocaleString('en-GB', { maximumFractionDigits: 2 });
  return `<figure class="hw-chart"><svg viewBox="0 0 ${W} ${H}" role="img" aria-label="${esc(caption || 'The day, hour by hour, 00 to 24 venue time')}">
    ${Array.from({ length: 13 }, (_, k) => { const xx = sx(1 + k * 2); return `<line x1="${xx.toFixed(1)}" y1="${padT}" x2="${xx.toFixed(1)}" y2="${H - padB}" stroke="var(--rule)" stroke-width="1"${(k * 2) % 6 ? ' opacity="0.45"' : ''}/>
      <text x="${xx.toFixed(1)}" y="${H - padB + 15}" text-anchor="${k === 0 ? 'start' : k === 12 ? 'end' : 'middle'}" class="hw-ax"${(k * 2) % 6 ? ' opacity="0.6"' : ''}>${String(k * 2).padStart(2, '0')}</text>`; }).join('')}
    <line x1="${padL}" y1="${H - padB}" x2="${W - padR + 4}" y2="${H - padB}" stroke="var(--rule-hard)" stroke-width="1"/>
    ${drawn.map((r) => `<path d="${r.d}" class="hw-line" stroke="${r.colour}"><title>${esc(r.s.label)}</title></path>
      ${r.dots.map(([dx, dy]) => `<circle cx="${dx.toFixed(1)}" cy="${dy.toFixed(1)}" r="2.5" fill="${r.colour}" stroke="var(--well)" stroke-width="1"/>`).join('')}`).join('')}
    ${rows.map((r) => `${Math.abs(r.ty - r.ey) > 2 || railX - r.ex > 8 ? `<line x1="${r.ex.toFixed(1)}" y1="${r.ey.toFixed(1)}" x2="${(railX - 4).toFixed(1)}" y2="${r.ty.toFixed(1)}" stroke="${r.colour}" stroke-width="1" stroke-dasharray="2 3" opacity="0.7"/>` : ''}
      <text x="${railX}" y="${r.ty.toFixed(1)}" text-anchor="start" class="hw-name" fill="${r.colour}">${esc(r.s.label)}</text>
      <text x="${railX}" y="${(r.ty + 14).toFixed(1)}" text-anchor="start" class="hw-val" fill="${r.colour}">${fmt(r.last)}${r.s.unit ? ' ' + esc(r.s.unit) : ''}</text>`).join('')}
  </svg>${caption ? `<figcaption class="note">${esc(caption)}</figcaption>` : ''}</figure>`;
}

/* ============================================================== CONTENTS */

function contents(ctx, { days, counts, entryCounts }) {
  const recorded = days.filter((d) => d.isPast || d.isToday);
  const mediaTotal = days.reduce((s, d) => s + (d.media || 0), 0);

  /* One download per card: what it is, what it is for, one button. */
  const card = ({ fmt, title, blurb, href, label, primary }) => `
    <div class="dl-card">
      <div class="fmt">${esc(fmt)}</div>
      <h3>${esc(title)}</h3>
      <a class="btn${primary ? ' primary' : ''}" href="${href}" download>${esc(label)}</a>
    </div>`;

  const status = (d) => d.isToday ? '<span class="badge mars">Today</span>'
    : !(d.isPast) ? '<span class="badge ahead">Ahead</span>'
    : d.sealed ? '<span class="badge">Sealed</span>'
    : '<span class="badge earth">Still open</span>';

  const body = `
  <div style="padding:30px 0 18px">
    <div class="eyebrow">Channel group 21 · Permanent record
      <span class="brk">Mission control only</span></div>
    <h1>Archive</h1>
  </div>

  ${panel('CH-21 / TAKE A COPY', `
    ${eyebrow('Download the record')}
    <div class="dl-grid">
      ${card({ fmt: 'PDF · one document', title: 'The full record',
        blurb: 'The whole mission, bookmarked by section and by day: schedules, meals, '
          + 'inventory, the crew log with its photographs in place, every exchange, every '
          + 'state filed, the correspondence in full and the audit trail.',
        href: '/archive/export.pdf', label: 'Download PDF', primary: true })}
      ${card({ fmt: 'Markdown · plain text', title: 'The readable copy',
        blurb: 'Every day in order, as plain text. Opens in any editor, prints without a '
          + 'stylesheet, and still makes sense with nothing left to render it.',
        href: '/archive/export.md', label: 'Download .md' })}
      ${card({ fmt: 'JSON · structured', title: 'The data copy',
        blurb: 'The same record as one structured file, for machines: every day, every '
          + 'exchange, and the media index with every file’s SHA-256.',
        href: '/archive/export.json', label: 'Download .json' })}
      ${card({ fmt: 'ZIP · raw readings', title: 'The readings log',
        blurb: 'Every reading the station ever pulled or received — every poll, changed or '
          + 'not — one JSON file per pull, written the moment it arrived and never changed, '
          + 'with the same log as CSV tables inside. It survives the reset.',
        href: '/archive/readings.zip', label: 'Download ZIP' })}
      ${card({ fmt: 'ZIP · originals', title: 'The media archive',
        blurb: `Every photograph, video and sound file the crew sent out${mediaTotal
          ? ` — ${mediaTotal} so far` : ''}, byte for byte as uploaded, with the manifest
          and every file’s hash inside.`,
        href: '/media/export.zip', label: 'Download ZIP' })}
    </div>
`, 'mars-side')}

  ${panel('CH-21 / CONTENTS', `
    ${eyebrow('The mission, day by day')}
    <div class="tw"><table class="daylist">
      <thead><tr><th>Day</th><th>Date</th><th>State</th>
        <th>Crew entries</th><th>Exchanges</th><th>Media</th><th>Channels</th><th>Open · download</th></tr></thead>
      <tbody>${days.map((d) => `<tr${d.isToday ? ' style="box-shadow:inset 2px 0 0 var(--mars)"' : ''}${
          !(d.isPast || d.isToday) ? ' class="ahead-row"' : ''}>
        <td class="n">${dd(d.missionDay)}</td>
        <td>${esc(d.date)}</td>
        <td>${status(d)}</td>
        <td class="n">${d.entries || '—'}</td>
        <td class="n">${d.messages || '—'}</td>
        <td class="n">${d.media || '—'}</td>
        <td class="n">${d.channels || '—'}</td>
        <td>${d.isPast || d.isToday ? `<span class="day-links">
          <a href="/archive/day/${d.missionDay}">Open</a>
          <a href="/archive/day/${d.missionDay}/export.pdf" download>PDF</a>
          <a href="/archive/day/${d.missionDay}/export.md" download>MD</a>
          ${d.media ? `<a href="/media/day/${d.missionDay}/export.zip" download>Media</a>` : ''}</span>`
          : '<span style="color:var(--faint)">not yet</span>'}</td>
      </tr>`).join('')}</tbody>
    </table></div>`)}`;
  return L.page({ title: 'Archive', ctx, body, current: '/archive' });
}

/* ============================================================ DAY RECORD */

function dayRecord(ctx, { record, hasPrev, hasNext }) {
  const r = record;
  const slot = { BREAKFAST: 'Breakfast', LUNCH: 'Lunch', DINNER: 'Dinner', RATION: 'Ration' };

  const body = `
  <div style="padding:30px 0 18px">
    <div class="eyebrow">Archive · permanent record${r.sealed ? ' · sealed' : ' · still open'}</div>
    <h1>Day ${dd(r.missionDay)}</h1>
    <div class="spec">
      <span>${esc(r.date)}</span>
      <span><b>${r.entries.length}</b> crew entries</span>
      <span><b>${r.messages.length}</b> exchanges published</span>
      <span><b>${r.traffic.sent}</b> messages sent from Earth</span>
    </div>
    <div class="actions" style="margin-top:20px">
      ${hasPrev ? `<a class="btn" href="/archive/day/${r.missionDay - 1}">← Day ${dd(r.missionDay - 1)}</a>` : ''}
      ${hasNext ? `<a class="btn" href="/archive/day/${r.missionDay + 1}">Day ${dd(r.missionDay + 1)} →</a>` : ''}
      <a class="btn" href="/archive">All days</a>
      <span class="spacer"></span>
      <a class="btn primary" href="/archive/day/${r.missionDay}/export.pdf" download>Download this day (PDF)</a>
      <a class="btn" href="/archive/day/${r.missionDay}/export.md" download>As Markdown</a>
      ${r.media && r.media.length ? `<a class="btn" href="/media/day/${r.missionDay}/export.zip" download>The day's media (ZIP)</a>` : ''}
    </div>
  </div>

  ${r.entries.length ? panel('CH-50 / CREW LOG', `
    ${eyebrow('What the crew wrote')}
    <div class="cards">${r.entries.map((e) => `<article class="card">
      <div class="card-top"><span class="cs">${esc(e.designation)}</span>
        <span class="card-day">${esc(e.role)}</span></div>
      <div class="card-body entry-post">${MV.entryHtml(e.body, (r.media || []).filter((m) => m.crew_id === e.crew_id), { lookup: mediaLookup })}</div>
    </article>`).join('')}</div>`, 'mars-side') : ''}

  ${r.media && r.media.length ? panel('CH-60 / MEDIA', `
    ${eyebrow('What the crew sent out')}
    ${MV.strip(r.media)}
    <p class="note" style="margin-top:8px"><a href="/media/day/${r.missionDay}/export.zip">Download this day's media as one ZIP</a> ·
      every file is listed with its SHA-256 in the day's export.</p>`, 'mars-side') : ''}

  ${r.messages.length ? panel('CH-20 / EXCHANGES', `
    ${eyebrow('What crossed the gap')}
    <div class="cards">${r.messages.map((m) => `<article class="card">
      <div class="card-top">
        <span class="cs">${esc(m.callsign)}</span>
        <span class="card-day">D${String(m.mission_day).padStart(3, '0')}</span>
      </div>
      <div class="card-body">${esc(m.body)}</div>
      ${(m.tags || '') ? `<div class="tagrow">${(m.tags || '').split(',').filter(Boolean)
        .map((t) => `<span>${esc(t)}</span>`).join('')}</div>` : ''}
      ${m.response_body ? `<div class="card-reply">
        <div class="who">${esc(m.responder || 'Mars habitat')}</div>
        <p>${esc(m.response_body)}</p></div>` : ''}
      <div class="card-foot"><span>${orbital.formatLightTime(m.light_seconds)}</span>
        <span>${m.distance_au.toFixed(2)} au</span></div>
    </article>`).join('')}</div>`, 'earth-side') : ''}

  <div class="grid g2">
    ${r.day && r.day.tasks.length ? panel('CH-30 / SCHEDULE', `
      ${eyebrow('As it was run')}
      <div class="rows">${r.day.tasks.map((t) => `
        <div class="row ${t.status === 'DONE' ? 'done' : ''}">
          <div class="t">${esc(t.time)}</div>
          <div class="m"><b>${esc(t.label)}</b>${t.detail ? `<span>${esc(t.detail)}</span>` : ''}</div>
          <span class="badge">${esc(t.status)}</span>
        </div>`).join('')}</div>`, 'mars-side') : ''}

    ${r.habitat.length ? panel('CH-01 / HABITAT', `
      ${eyebrow('How the air behaved')}
      <div class="tw"><table>
        <thead><tr><th>Channel</th><th>Low</th><th>High</th><th>Mean</th><th>Samples</th></tr></thead>
        <tbody>${r.habitat.map((h) => `<tr>
          <th>${esc(h.label || h.metric)}</th>
          <td class="n">${h.min_value == null ? '—' : h.min_value.toFixed(1)}</td>
          <td class="n">${h.max_value == null ? '—' : h.max_value.toFixed(1)}</td>
          <td class="n">${h.avg_value == null ? '—' : h.avg_value.toFixed(1)} ${esc(h.unit || '')}</td>
          <td class="n">${h.samples}</td>
        </tr>`).join('')}</tbody>
      </table></div>
      ${hourChart([...(r.habitatHours || []), ...(r.externalHours || [])],
        { caption: 'The habitat over the day — every channel pulled that day, one point per hour, 00 to 24 venue time, each line on its own scale.' })}`, 'mars-side') : ''}

    ${(r.hardware || []).length ? panel('CH-02 / HARDWARE', `
      ${eyebrow('The habitat’s own hardware · through Home Assistant')}
      <div class="tw"><table>
        <thead><tr><th>Device</th><th>Low</th><th>High</th><th>Mean</th><th>Added today</th><th>Samples</th></tr></thead>
        <tbody>${r.hardware.map((h) => { const f = (v) => (v == null ? '—' : String(Math.round(v * 100) / 100)); return `<tr>
          <th>${esc(h.label)}</th>
          <td class="n">${f(h.low)}</td>
          <td class="n">${f(h.high)}</td>
          <td class="n">${f(h.mean)} ${esc(h.unit)}</td>
          <td class="n">${h.added == null ? '—' : `${f(h.added)} ${esc(h.unit)}`}</td>
          <td class="n">${h.samples}</td>
        </tr>`; }).join('')}</tbody>
      </table></div>
      ${hourChart(r.hardwareHours || [],
        { caption: 'The hardware over the day — one point per hour, a gauge’s hour as its mean, a meter as its level, 00 to 24 venue time.' })}`, 'mars-side') : ''}

    ${((r.resourcesDay || []).length || r.caloriesDay) ? panel('CH-31 / OVER THE DAY', `
      ${eyebrow('Two points per line: the start of the day and its close')}
      ${hourChart([
        ...(r.resourcesDay || []).map((s) => ({ label: s.label, unit: s.unit, points: { 1: s.open, 25: s.close } })),
        ...(r.caloriesDay ? [{ label: 'Calories consumed', unit: 'kcal', points: { 1: r.caloriesDay.open, 25: r.caloriesDay.close } }] : []),
      ], { caption: 'Each store from what it held at the start of the day to its close; calories from zero to the day’s total. Each line on its own scale.' })}`, 'mars-side') : ''}
  </div>

  ${r.day && r.day.meals.length ? panel('CH-32 / GALLEY', `
    ${eyebrow('What they ate')}
    <div class="grid g3">${r.day.meals.map((m) => `<div>
      <div class="eyebrow">${esc(slot[m.slot] || m.slot)}</div>
      <h3>${esc(m.name)}</h3>
      ${m.components ? `<div class="note" style="white-space:pre-line;margin-bottom:10px">${esc(m.components)}</div>` : ''}
      <dl class="kv">
        <dt>Energy</dt><dd>${m.kcal} kcal</dd>
        <dt>Water</dt><dd>${m.water_litres} L</dd>
      </dl>
    </div>`).join('')}</div>`, 'mars-side') : ''}

  <div class="grid g2">
    ${r.day && r.day.inventory.length ? panel('CH-34 / INVENTORY', `
      ${eyebrow('What was left')}
      <div class="tw"><table><tbody>${r.day.inventory.map((i) => `<tr>
        <th>${esc(i.label)}</th>
        <td class="n">${i.quantity} ${esc(i.unit)}</td>
        <td class="n" style="color:var(--faint)">−${i.consumption}/day</td>
      </tr>`).join('')}</tbody></table></div>`, 'mars-side') : ''}

    ${r.power && r.power.filed ? panel('CH-35 / POWER', `
      ${eyebrow(`Power consumed · ${r.power.total.toFixed(2)} kWh`)}
      <div class="tw"><table><tbody>${r.power.categories.map((c) => `<tr>
        <th>${esc(c.label)}</th>
        <td class="n">${c.kwh == null ? '—' : `${c.kwh.toFixed(2)} kWh`}</td>
      </tr>`).join('')}
      <tr><th>Day total</th><td class="n"><b>${r.power.total.toFixed(2)} kWh</b></td></tr></tbody></table></div>`, 'mars-side') : ''}

    ${r.moods.length ? panel('CH-12 / CREW STATES', `
      ${eyebrow('Filed that day, in full')}
      ${r.moods.map((m) => {
        const t = mood.translate(m);
        return `<div style="border-bottom:1px solid var(--rule);padding:12px 0">
          <div style="display:flex;gap:10px;align-items:center;flex-wrap:wrap">
            <span class="badge mars">${esc(m.designation)}</span>
            <span class="badge">${esc(t.condition)}</span>
            <span class="note" style="font-size:11px">${esc(m.effective_at.slice(11, 16))} UTC
              ${m.activity ? `· ${esc(m.activity)}` : ''} · filed by ${esc(m.set_by)}</span>
          </div>
          <ul style="margin:8px 0 0;padding-left:18px">
            ${t.axes.map((a) => `<li class="note">${esc(a.label)}: ${esc(a.text)}</li>`).join('')}
          </ul>
        </div>`;
      }).join('')}`, 'mars-side') : ''}
  </div>

  ${r.day && r.day.notes.filter((n) => n.published_at).length ? panel('CH-36 / NOTES', `
    ${eyebrow('Logged from mission control')}
    <div class="rows">${r.day.notes.filter((n) => n.published_at).map((n) => `
      <div class="row"><div class="t">${esc(n.posted_at.slice(11, 16))}</div>
      <div class="m entry-post">${MV.entryHtml(n.body, [], { lookup: mediaLookup })}</div>
      <span class="badge">${esc(n.kind)}</span></div>`).join('')}</div>`, 'mars-side') : ''}

  ${r.isEmpty ? '<div class="empty">NOTHING WAS RECORDED ON THIS DAY</div>' : ''}`;

  return L.page({ title: `Archive · day ${dd(r.missionDay)}`, ctx, body, current: '/archive' });
}

module.exports = { contents, dayRecord };
