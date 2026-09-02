'use strict';
const L = require('../layout');
const { esc, panel, eyebrow, sym } = L;
const mood = require('../../lib/mood');
const orbital = require('../../lib/orbital');
const MV = require('./media');
const mediaLookup = require('../../lib/media').get;

const dd = (n) => String(n).padStart(3, '0');

/* ============================================================== CONTENTS */

function contents(ctx, { days, counts, entryCounts }) {
  const recorded = days.filter((d) => d.isPast || d.isToday);
  const mediaTotal = days.reduce((s, d) => s + (d.media || 0), 0);

  /* One download per card: what it is, what it is for, one button. */
  const card = ({ fmt, title, blurb, href, label, primary }) => `
    <div class="dl-card">
      <div class="fmt">${esc(fmt)}</div>
      <h3>${esc(title)}</h3>
      <p>${esc(blurb)}</p>
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
    <p class="lede">Everything this station has carried, kept day by day: what the crew were
    asked to do, what they ate, what they had left, what they wrote, how the habitat behaved,
    and every message that crossed the gap. Nothing here expires.</p>
    <div class="actions"><a class="btn" href="/control">Back to messages</a></div>
  </div>

  <div class="grid g4">
    ${[['Exchanges', counts.published], ['Crew entries', entryCounts.published],
       ['Callsigns issued', counts.visitors], ['Days recorded', recorded.length]]
      .map(([l, v]) => panel('', `<div class="readout"><div class="label">${l}</div>
        <div class="value">${v}</div></div>`)).join('')}
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
        blurb: 'Every reading the station ever pulled or received, one JSON file per pull, '
          + 'written the moment it arrived and never changed. It survives the reset.',
        href: '/archive/readings.zip', label: 'Download ZIP' })}
      ${card({ fmt: 'ZIP · originals', title: 'The media archive',
        blurb: `Every photograph, video and sound file the crew sent out${mediaTotal
          ? ` — ${mediaTotal} so far` : ''}, byte for byte as uploaded, with the manifest
          and every file’s hash inside.`,
        href: '/media/export.zip', label: 'Download ZIP' })}
    </div>
    <p class="note" style="margin-top:14px">A single day downloads from its row in the table
    below, and from the top of its own page. Nothing here needs an account once saved:
    every copy is complete in itself.</p>
    <details class="fold">
      <summary><span class="fold-title">What exactly is in each file</span></summary>
      <div class="fold-body">
        <p class="note">The PDF is the whole mission in one document: a contents page, the mission
        and what was carried in, the trend charts across the run, every store's daily use, then
        each day whole — schedule, meals, inventory, mission notes, the crew log with its
        photographs in place and its video and sound listed, science findings and health
        activities, every state filed, every exchange, what was sent out and the habitat
        summary — followed by the complete correspondence including what was never published,
        the media index with every file's SHA-256, and the audit trail. Bookmarked by section
        and by day.</p>
        <p class="note">The readable copy is plain Markdown: every day with its schedule, meals,
        inventory, crew writing, states, exchanges and habitat summary, in order. It opens in any
        text editor and still makes sense with nothing to render it.</p>
        <p class="note">The readings log is every reading the station ever pulled or received — every poll of the
        sensor node, every batch posted to the ingest endpoint, the stores and the crew's figures each time they
        changed, each day's habitat summary — one JSON file per pull, written the moment it arrived and never
        changed. It survives the reset. <code>index.json</code> inside lists every file.</p>
        <p class="note">The media ZIP is stored, not compressed, and streamed as it goes, so the
        whole mission is one download whatever it weighs. <code>manifest.json</code> and a
        <code>README.txt</code> are inside; every file can be checked against its SHA-256.</p>
      </div>
    </details>`, 'mars-side')}

  ${panel('CH-21 / CONTENTS', `
    ${eyebrow('The mission, day by day')}
    <p class="note">Open a day to see it whole — or take just that day as a PDF or as
    Markdown from its row. Days ahead join the record as they happen.</p>
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
    </table></div>`)}

  ${panel('CH-21 / BY CHANNEL', `
    ${eyebrow('Jump into one strand')}
    <p class="note">The same record, cut a different way.</p>
    <div class="actions">
      <a class="btn" href="/#exchanges">Every exchange</a>
      <a class="btn" href="/archive/messages">Search messages</a>
      <a class="btn" href="/logbook">Every crew entry</a>
      <a class="btn" href="/media">Every photograph, video and recording</a>
      <a class="btn" href="/at-a-glance">The mission at a glance</a>
      <a class="btn" href="/control">Mission control</a>
    </div>
    <p class="note" style="margin-top:14px">This page and the downloads are not public. A visitor
    sees the exchange on the mission page and the crew log; the complete record is yours.</p>`, 'earth-side')}`;
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
