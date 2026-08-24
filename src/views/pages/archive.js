'use strict';
const L = require('../layout');
const { esc, panel, eyebrow, sym } = L;
const mood = require('../../lib/mood');
const orbital = require('../../lib/orbital');

const dd = (n) => String(n).padStart(3, '0');

/* ============================================================== CONTENTS */

function contents(ctx, { days, counts, entryCounts }) {
  const body = `
  <div style="padding:30px 0 18px">
    <div class="eyebrow">Channel group 21 · Permanent record
      <span class="brk">Mission control only</span></div>
    <h1>Archive</h1>
    <p class="lede">Everything this station has carried, kept day by day: what the crew were
    asked to do, what they ate, what they had left, what they wrote, how the habitat behaved,
    and every message that crossed the gap. Nothing here expires.</p>
    <div class="actions"><a class="btn" href="/control">Back to messages</a>
      <a class="btn" href="/archive/export.json">Download the full record</a></div>
  </div>

  <div class="grid g4">
    ${[['Exchanges', counts.published], ['Crew entries', entryCounts.published],
       ['Callsigns issued', counts.visitors], ['Days recorded', days.filter((d) => d.isPast || d.isToday).length]]
      .map(([l, v]) => panel('', `<div class="readout"><div class="label">${l}</div>
        <div class="value">${v}</div></div>`)).join('')}
  </div>

  ${panel('CH-21 / CONTENTS', `
    ${eyebrow('The mission, day by day')}
    <div class="tw"><table>
      <thead><tr><th>Day</th><th>Date</th><th>Schedule</th><th>Meals</th>
        <th>Crew entries</th><th>Exchanges</th><th>Channels</th><th></th></tr></thead>
      <tbody>${days.map((d) => `<tr${d.isToday ? ' style="box-shadow:inset 2px 0 0 var(--mars)"' : ''}>
        <td class="n">${dd(d.missionDay)}</td>
        <td>${esc(d.date)}</td>
        <td class="n">${d.tasks || '—'}</td>
        <td class="n">${d.meals || '—'}</td>
        <td class="n">${d.entries || '—'}</td>
        <td class="n">${d.messages || '—'}</td>
        <td class="n">${d.channels || '—'}</td>
        <td>${d.isPast || d.isToday ? `<a href="/archive/day/${d.missionDay}">open</a>`
          : '<span style="color:var(--faint)">not yet</span>'}</td>
      </tr>`).join('')}</tbody>
    </table></div>`)}

  <div class="grid g2">
    ${panel('CH-21 / BY CHANNEL', `
      ${eyebrow('Jump into one strand')}
      <p class="note">The same record, cut a different way.</p>
      <p>
        <a class="btn" href="/#exchanges">Every exchange</a>
        <a class="btn" href="/#crewlog">Every crew entry</a>
        <a class="btn" href="/archive/messages">Search messages</a>
        <a class="btn" href="/control">Mission control</a>
      </p>`, 'earth-side')}
    ${panel('CH-21 / TAKE A COPY', `
      ${eyebrow('The whole mission, as one file')}
      <p class="note">Schedules, meals, inventory, crew entries, crew states, habitat summaries
      and every published exchange with the real light-time it crossed. No account needed.</p>
      <p>
        <a class="btn" href="/archive/export.md">Download the record (readable)</a>
        <a class="btn" href="/archive/export.json">As JSON</a>
      </p>
      <p class="note">The readable copy is plain Markdown: every day with its schedule, meals,
      inventory, crew writing, states, exchanges and habitat summary, in order. It opens in any
      text editor and still makes sense with nothing to render it.</p>
      <p class="note">This page and the download are not public. A visitor sees the exchange on
      the mission page and the crew log; the complete record is yours.</p>`, 'mars-side')}
  </div>`;
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
    <p style="margin-top:20px">
      ${hasPrev ? `<a class="btn" href="/archive/day/${r.missionDay - 1}">Day ${dd(r.missionDay - 1)}</a>` : ''}
      ${hasNext ? `<a class="btn" href="/archive/day/${r.missionDay + 1}">Day ${dd(r.missionDay + 1)}</a>` : ''}
      <a class="btn" href="/archive">Contents</a>
      <a class="btn" href="/archive/day/${r.missionDay}/export.md">Download this day</a>
    </p>
  </div>

  ${r.entries.length ? panel('CH-50 / CREW LOG', `
    ${eyebrow('What the crew wrote')}
    <div class="cards">${r.entries.map((e) => `<article class="card">
      <div class="card-top"><span class="cs">${esc(e.designation)}</span>
        <span class="card-day">${esc(e.role)}</span></div>
      <div class="card-body" style="white-space:pre-line">${esc(e.body)}</div>
    </article>`).join('')}</div>`, 'mars-side') : ''}

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
      </table></div>`, 'mars-side') : ''}
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
      <div class="m"><b>${esc(n.body)}</b></div>
      <span class="badge">${esc(n.kind)}</span></div>`).join('')}</div>`, 'mars-side') : ''}

  ${r.isEmpty ? '<div class="empty">NOTHING WAS RECORDED ON THIS DAY</div>' : ''}`;

  return L.page({ title: `Archive · day ${dd(r.missionDay)}`, ctx, body, current: '/archive' });
}

module.exports = { contents, dayRecord };
