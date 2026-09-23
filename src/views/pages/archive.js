'use strict';
const L = require('../layout');
const { esc, panel, eyebrow } = L;
const mood = require('../../lib/mood');
const MV = require('./media');
const mediaLookup = require('../../lib/media').get;

const dd = (n) => String(n).padStart(3, '0');
/** A figure exactly as it was entered — no rounding, no formatting. */
const asIs = (v) => (v == null || v === '' ? '—' : esc(String(v)));

/* The archive shows what was entered and what was measured, as it is: no
   chart, no projection, no total, no figure carried from one day to the
   next. A store not counted on a day has no figure for that day. */

/* ============================================================== CONTENTS */

function contents(ctx, { days, counts, entryCounts, rehearsal = null }) {
  const recorded = days.filter((d) => d.isPast || d.isToday);
  const mediaTotal = days.reduce((s, d) => s + (d.media || 0), 0);

  /* One download per card: what it is, what it is for, one button. */
  const card = ({ fmt, title, blurb, href, label, primary, also = [] }) => `
    <div class="dl-card">
      <div class="fmt">${esc(fmt)}</div>
      <h3>${esc(title)}</h3>
      <a class="btn${primary ? ' primary' : ''}" href="${href}" download>${esc(label)}</a>
      ${also.length ? `<div class="day-links" style="margin-top:8px">${also.map((a) => `<a href="${a.href}" download title="${esc(a.title || '')}">${esc(a.label)}</a>`).join('')}</div>` : ''}
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
          + 'the stores as counted, the crew log with its photographs in place, every '
          + 'state filed and every reading of every day.',
        href: '/archive/export.pdf', label: 'Download PDF', primary: true })}
      ${card({ fmt: 'Markdown · plain text', title: 'The readable copy',
        blurb: 'Every day in order, as plain text. Opens in any editor, prints without a '
          + 'stylesheet, and still makes sense with nothing left to render it.',
        href: '/archive/export.md', label: 'Download .md' })}
      ${card({ fmt: 'JSON · structured', title: 'The data copy',
        blurb: 'The same record as one structured file, for machines: every day, every '
          + 'reading, and the media index with every file’s SHA-256.',
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
      ${card({ fmt: `PDF · ${counts.total} ${counts.total === 1 ? 'message' : 'messages'} · not part of the record`, title: 'All the messages',
        blurb: 'Every message that ever reached the station — published with its reply, rejected with '
          + 'the reason, still waiting or in transit — in the order it was sent.',
        href: '/control/messages/export.pdf', label: 'Download all messages',
        also: [{ href: '/control/messages/export.csv', label: 'CSV', title: 'One row per message, for a spreadsheet' },
               { href: '/control/messages/export.json', label: 'JSON', title: 'For machines' }] })}
    </div>
`, 'mars-side')}

  ${panel('CH-21 / CONTENTS', `
    ${eyebrow('The mission, day by day')}
    <div class="tw"><table class="daylist">
      <thead><tr><th>Day</th><th>Date</th><th>State</th>
        <th>Crew entries</th><th>Media</th><th>Channels</th><th>Open · download</th></tr></thead>
      <tbody>${rehearsal ? `<tr style="box-shadow:inset 2px 0 0 var(--mars)">
        <td class="n">NOW</td>
        <td>${esc(rehearsal.date)}</td>
        <td><span class="badge warn">Rehearsal · not the record</span></td>
        <td class="n">${rehearsal.entries.length || '—'}</td>
        <td class="n">${rehearsal.media.length || '—'}</td>
        <td class="n">${rehearsal.habitat.length || '—'}</td>
        <td><span class="day-links">
          <a href="/archive/today">Open</a>
          <a href="/archive/today/export.pdf" download>PDF</a>
          <a href="/archive/today/export.md" download>MD</a></span></td>
      </tr>` : ''}${days.map((d) => `<tr${d.isToday ? ' style="box-shadow:inset 2px 0 0 var(--mars)"' : ''}${
          !(d.isPast || d.isToday) ? ' class="ahead-row"' : ''}>
        <td class="n">${dd(d.missionDay)}</td>
        <td>${esc(d.date)}</td>
        <td>${status(d)}</td>
        <td class="n">${d.entries || '—'}</td>
        <td class="n">${d.media || '—'}</td>
        <td class="n">${d.channels || '—'}</td>
        <td>${d.isPast || d.isToday ? `<span class="day-links">
          <a href="/archive/day/${d.missionDay}">Open</a>
          <a href="/archive/day/${d.missionDay}/export.pdf" download>PDF</a>
          <a href="/archive/day/${d.missionDay}/export.md" download>MD</a>
          ${d.media ? `<a href="/media/day/${d.missionDay}/export.zip" download>Media</a>` : ''}</span>`
          : '<span style="color:var(--faint)">not yet</span>'}</td>
      </tr>`).join('')}</tbody>
    </table></div>
    ${rehearsal ? `<p class="note" style="margin-top:10px"><b>NOW</b> is today, before the run: a day's record built for today — today's readings from every source and the states filed today, plus whatever has been put into the opening day (SOL 001) so far — so the shape of the record can be seen with real data in it. It is marked as a rehearsal wherever it appears, is not part of the record, and disappears on the first day of the run.</p>` : ''}`)}`;
  return L.page({ title: 'Archive', ctx, body, current: '/archive' });
}

/* ============================================================ DAY RECORD */

function dayRecord(ctx, { record, hasPrev, hasNext }) {
  const r = record;
  const slot = { BREAKFAST: 'Breakfast', LUNCH: 'Lunch', DINNER: 'Dinner', RATION: 'Ration' };

  const base = r.rehearsal ? '/archive/today' : `/archive/day/${r.missionDay}`;
  const mediaDay = r.rehearsal ? 1 : r.missionDay;   // the rehearsal shows the opening day's media
  const body = `
  <div style="padding:30px 0 18px">
    <div class="eyebrow">${r.rehearsal ? 'Archive · REHEARSAL · NOT THE RECORD' : `Archive · permanent record${r.sealed ? ' · sealed' : ' · still open'}`}</div>
    <h1>${r.rehearsal ? 'Today, before the run' : `Day ${dd(r.missionDay)}`}</h1>
    ${r.rehearsal ? `<p class="note">A preview of a day's record with what there is today: today's readings from every source and the states filed today, and whatever has been put into the opening day (SOL 001) so far — its plan, entries, counts, figures and media. Not part of the record; gone on the first day of the run, when day 001 takes its place.</p>` : ''}
    <div class="spec">
      <span>${esc(r.date)}</span>
      <span><b>${r.officers.filter((o) => o.entry).length}</b> daily blogs</span>
      <span><b>${r.moods.length}</b> states filed</span>
      <span><b>${r.media.length}</b> files sent out</span>
      <span><b>${r.readings.count}</b> readings</span>
    </div>
    <div class="actions" style="margin-top:20px">
      ${hasPrev ? `<a class="btn" href="/archive/day/${r.missionDay - 1}">← Day ${dd(r.missionDay - 1)}</a>` : ''}
      ${hasNext ? `<a class="btn" href="/archive/day/${r.missionDay + 1}">Day ${dd(r.missionDay + 1)} →</a>` : ''}
      <a class="btn" href="/archive">All days</a>
      <span class="spacer"></span>
      <a class="btn primary" href="${base}/export.pdf" download>Download this day (PDF)</a>
      <a class="btn" href="${base}/export.md" download>As Markdown</a>
      ${r.media && r.media.length ? `<a class="btn" href="/media/day/${mediaDay}/export.zip" download>The day's media (ZIP)</a>` : ''}
    </div>
  </div>

  ${r.officers.map((o, k) => panel(`CH-5${k} / ${esc(o.designation)}`, `
    ${eyebrow(`${esc(o.designation)}${o.role ? ` · ${esc(o.role)}` : ''}`)}
    <h3>Daily Blog</h3>
    ${o.entry ? `<div class="entry-post">${MV.entryHtml(o.entry.body, o.media, { lookup: mediaLookup })}</div>`
      : '<p class="note">No blog written for this day.</p>'}
    ${o.reportKind ? `<h3 style="margin-top:18px">${esc(o.reportLabel)}</h3>
    ${o.reports.length ? o.reports.map((x) => `<div class="entry-post">${MV.entryHtml(x.body, [], { lookup: mediaLookup })}</div>`).join('')
      : `<p class="note">No ${esc(o.reportLabel.toLowerCase().replace('daily ', ''))} written for this day.</p>`}` : ''}
    <h3 style="margin-top:18px">Crew state</h3>
    ${o.states.length ? o.states.map((m) => {
      const t = mood.translate(m);
      return `<div style="border-bottom:1px solid var(--rule);padding:10px 0">
        <div style="display:flex;gap:10px;align-items:center;flex-wrap:wrap">
          <span class="badge">${esc(t.condition)}</span>
          <span class="note" style="font-size:11px">${esc(m.effective_at.slice(11, 16))} UTC
            ${m.activity ? `· ${esc(m.activity)}` : ''} · filed by ${esc(m.set_by)}</span>
        </div>
        <ul style="margin:6px 0 0;padding-left:18px">
          ${t.axes.map((a) => `<li class="note">${esc(a.label)} · value filed ${esc(String(a.value))} (${esc(a.low.toLowerCase())} 0 … ${esc(a.high.toLowerCase())} 100) · shown as “${esc(a.text)}”</li>`).join('')}
        </ul>
      </div>`;
    }).join('') : '<p class="note">No state filed for this day.</p>'}`, 'mars-side')).join('')}

  ${r.reportsUnassigned.length ? panel('CH-36 / DAILY REPORTS', `
    ${eyebrow('Reports with no officer to hang on')}
    <div class="rows">${r.reportsUnassigned.map((n) => `
      <div class="row"><div class="t">${esc(n.posted_at.slice(11, 16))}</div>
      <div class="m entry-post">${MV.entryHtml(n.body, [], { lookup: mediaLookup })}</div>
      <span class="badge">${esc(n.kind)}</span></div>`).join('')}</div>`, 'mars-side') : ''}

  ${r.notesOther.length ? panel('CH-36 / NOTES', `
    ${eyebrow('Mission notes')}
    <div class="rows">${r.notesOther.map((n) => `
      <div class="row"><div class="t">${esc(n.posted_at.slice(11, 16))}</div>
      <div class="m entry-post">${MV.entryHtml(n.body, [], { lookup: mediaLookup })}</div>
      <span class="badge">${esc(n.kind)}</span></div>`).join('')}</div>`, 'mars-side') : ''}

  ${r.media && r.media.length ? panel('CH-60 / MEDIA', `
    ${eyebrow('What the crew sent out')}
    ${MV.strip(r.media)}
    <p class="note" style="margin-top:8px"><a href="/media/day/${mediaDay}/export.zip">Download this day's media as one ZIP</a> ·
      every file is listed with its SHA-256 in the day's export.</p>`, 'mars-side') : ''}

  <div style="padding:26px 0 8px"><div class="eyebrow">The Habitat tab of mission control · as it stands at the time of this record · the same tab is written to the readings log automatically at the end of each day</div></div>
  <div class="grid g2">
    ${panel('CH-30 / SCHEDULE', `
      ${eyebrow('Schedule')}
      ${r.day && r.day.tasks.length ? `<div class="rows">${r.day.tasks.map((t) => `
        <div class="row ${t.status === 'DONE' ? 'done' : ''}">
          <div class="t">${esc(t.time)}</div>
          <div class="m"><b>${esc(t.label)}</b>${t.detail ? `<span>${esc(t.detail)}</span>` : ''}</div>
          <span class="badge">${esc(t.status)}</span>
        </div>`).join('')}</div>` : '<p class="note">No schedule for this day.</p>'}`, 'mars-side')}

    ${panel('CH-32 / MEALS', `
      ${eyebrow('Meals')}
      ${r.day && r.day.meals.length ? r.day.meals.map((m) => `<div style="padding:8px 0;border-bottom:1px solid var(--rule)">
        <div class="eyebrow">${esc(slot[m.slot] || m.slot)}</div>
        <h3>${esc(m.name)}</h3>
        ${m.components ? `<div class="note" style="white-space:pre-line;margin-bottom:6px">${esc(m.components)}</div>` : ''}
        <div class="note">${asIs(m.kcal)} kcal · ${asIs(m.water_litres)} L water · ${asIs(m.prep_minutes)} min · ${asIs(m.energy_wh)} Wh</div>
        ${m.notes ? `<p class="note">${esc(m.notes)}</p>` : ''}
      </div>`).join('') : '<p class="note">No meals entered for this day.</p>'}`, 'mars-side')}

    ${panel('CH-13 / STEPS TAKEN · CALORIES CONSUMED', `
      ${eyebrow('As filed')}
      ${r.figures && r.figures.crew && Object.keys(r.figures.crew).length ? `<div class="tw"><table style="min-width:0">
        <thead><tr><th>Officer</th><th>Steps taken</th><th>Calories consumed</th></tr></thead>
        <tbody>${Object.entries(r.figures.crew).map(([who, f]) => `<tr>
          <th>${esc(who)}</th>
          <td class="n">${asIs(f.steps)}</td>
          <td class="n">${asIs(f.calories)}${f.calories == null ? '' : ' kcal'}</td>
        </tr>`).join('')}${(r.figures.calories != null || r.figures.steps != null) ? `<tr>
          <th>Crew (as filed)</th>
          <td class="n"><b>${asIs(r.figures.steps)}</b></td>
          <td class="n"><b>${asIs(r.figures.calories)}${r.figures.calories == null ? '' : ' kcal'}</b></td>
        </tr>` : ''}</tbody></table></div>` : '<p class="note">Not filed for this day.</p>'}`, 'mars-side')}

    ${panel('CH-35 / POWER', `
      ${eyebrow('Power consumed · as filed')}
      ${r.power && r.power.filed ? `<div class="tw"><table style="min-width:0"><tbody>${r.power.categories.map((c) => `<tr>
        <th>${esc(c.label)}</th>
        <td class="n">${c.kwh == null ? '—' : `${asIs(c.kwh)} kWh`}</td>
      </tr>`).join('')}</tbody></table></div>` : '<p class="note">Not filed for this day.</p>'}`, 'mars-side')}
  </div>

  ${panel('CH-34 / INVENTORY LEVELS', `
    ${eyebrow('As the tab shows them · "counted" means filed for this day, "carried" means from the day before at its draw')}
    ${r.stores.length ? `<div class="tw"><table>
      <thead><tr><th>Resource</th><th>Available amount</th><th>Amount used today</th><th>Amount left for future</th><th>Figures</th></tr></thead>
      <tbody>${r.stores.map((i) => `<tr>
        <th>${esc(i.label)}</th>
        <td class="n">${asIs(i.available)} ${esc(i.unit)}</td>
        <td class="n">${asIs(i.used)} ${esc(i.unit)}</td>
        <td class="n">${asIs(i.left)} ${esc(i.unit)}</td>
        <td class="note">used ${i.counted.used ? 'counted' : 'carried'} · left ${i.counted.left ? 'counted' : 'carried'}</td>
      </tr>`).join('')}</tbody></table></div>
      ${r.filed.why ? `<p class="note" style="margin-top:8px">${esc(r.filed.why)}</p>` : ''}` : '<p class="note">No stores tracked.</p>'}`, 'mars-side')}

  <div style="padding:26px 0 8px"><div class="eyebrow">Habitat sensors · named as on the dashboard · lowest, highest and mean reading over the day, then every reading</div></div>
  <div class="grid g2">
    ${(r.external || []).length ? panel('CH-01 / HABITAT · SENSOR NODE', `
      ${eyebrow('The Habitat panel of the dashboard')}
      <div class="tw"><table>
        <thead><tr><th>Channel</th><th>Low</th><th>High</th><th>Mean</th><th>Readings</th></tr></thead>
        <tbody>${(r.external || []).map((h) => { const f = (v) => (v == null ? '—' : String(Math.round(v * 100) / 100)); return `<tr>
          <th>${esc(h.label)}</th>
          <td class="n">${f(h.low)}</td>
          <td class="n">${f(h.high)}</td>
          <td class="n">${f(h.mean)} ${esc(h.unit || '')}</td>
          <td class="n">${h.samples}</td>
        </tr>`; }).join('')}</tbody>
      </table></div>`, 'mars-side') : ''}

    ${r.habitat.length ? panel('CH-01 / HABITAT · THE STATION’S CHANNELS', `
      ${eyebrow('Posted to the station by the habitat node')}
      <div class="tw"><table>
        <thead><tr><th>Channel</th><th>Low</th><th>High</th><th>Mean</th><th>Readings</th></tr></thead>
        <tbody>${r.habitat.map((h) => `<tr>
          <th>${h.channel ? `<span class="note">${esc(h.channel)}</span> ` : ''}${esc(h.label || h.metric)}</th>
          <td class="n">${h.min_value == null ? '—' : h.min_value.toFixed(1)}</td>
          <td class="n">${h.max_value == null ? '—' : h.max_value.toFixed(1)}</td>
          <td class="n">${h.avg_value == null ? '—' : h.avg_value.toFixed(1)} ${esc(h.unit || '')}</td>
          <td class="n">${h.samples}</td>
        </tr>`).join('')}</tbody>
      </table></div>`, 'mars-side') : ''}

    ${(r.hardware || []).length ? panel('CH-02 / HABITAT HARDWARE', `
      ${eyebrow('The Habitat hardware panel of the dashboard · through Home Assistant')}
      <div class="tw"><table>
        <thead><tr><th>Device</th><th>Low</th><th>High</th><th>Mean</th><th>Added today</th><th>Readings</th></tr></thead>
        <tbody>${r.hardware.map((h) => { const f = (v) => (v == null ? '—' : String(Math.round(v * 100) / 100)); return `<tr>
          <th>${esc(h.label)}</th>
          <td class="n">${f(h.low)}</td>
          <td class="n">${f(h.high)}</td>
          <td class="n">${f(h.mean)} ${esc(h.unit)}</td>
          <td class="n">${h.added == null ? '—' : `${f(h.added)} ${esc(h.unit)}`}</td>
          <td class="n">${h.samples}</td>
        </tr>`; }).join('')}</tbody>
      </table></div>`, 'mars-side') : ''}
  </div>
  ${!(r.external || []).length && !r.habitat.length && !(r.hardware || []).length ? '<p class="note">No reading was stored for this day.</p>' : ''}

  ${readingsPanels(r.readings)}

  ${r.isEmpty ? '<div class="empty">NOTHING WAS RECORDED ON THIS DAY</div>' : ''}`;

  return L.page({ title: r.rehearsal ? 'Archive · today, before the run · rehearsal' : `Archive · day ${dd(r.missionDay)}`, ctx, body, current: '/archive' });
}

/* Every reading of the day, as stored: the station's channels as one row
   per instant with a column per channel, the external node one row per
   reading, the hardware one table per device. Nothing summarised, nothing
   drawn. */
function readingsPanels(R) {
  if (!R || !R.count) return '';
  const val = (v) => (v == null ? '—' : esc(String(v)));
  const station = R.station.rows.length ? panel('CH-01 / EVERY READING · HABITAT · THE STATION’S CHANNELS', `
    ${eyebrow(`${R.station.readings} readings · one row per instant, habitat time`)}
    <div class="tw"><table class="readings">
      <thead><tr><th>Time</th>${R.station.columns.map((c) => `<th>${esc(c.label)}${c.unit ? ` <span class="unit" style="font-weight:400;text-transform:none;font-size:.85em;opacity:.7">${esc(c.unit)}</span>` : ''}</th>`).join('')}</tr></thead>
      <tbody>${R.station.rows.map((row) => `<tr><td class="n">${esc(row.at)}</td>${R.station.columns.map((c) => `<td class="n">${val(row.values[c.metric])}</td>`).join('')}</tr>`).join('')}</tbody>
    </table></div>`, 'mars-side') : '';
  const external = R.external.rows.length ? panel('CH-01 / EVERY READING · HABITAT · SENSOR NODE', `
    ${eyebrow(`${R.external.readings} readings · habitat time`)}
    <div class="tw"><table class="readings">
      <thead><tr><th>Time</th>${R.external.columns.map((c) => `<th>${esc(c.label)} <span class="unit" style="font-weight:400;text-transform:none;font-size:.85em;opacity:.7">${esc(c.unit)}</span></th>`).join('')}</tr></thead>
      <tbody>${R.external.rows.map((row) => `<tr><td class="n">${esc(row.at)}</td>${R.external.columns.map((c) => `<td class="n">${val(row.values[c.key])}</td>`).join('')}</tr>`).join('')}</tbody>
    </table></div>`, 'mars-side') : '';
  const hardware = R.hardware.length ? panel('CH-02 / EVERY READING · HABITAT HARDWARE', `
    ${eyebrow('Through Home Assistant · every state reported, per device, habitat time')}
    <div class="grid g2">${R.hardware.map((h) => `<div>
      <h3>${esc(h.label)} <span class="unit" style="font-weight:400;text-transform:none;font-size:.85em;opacity:.7">sensor.${esc(h.id)} · ${h.rows.length} readings</span></h3>
      <div class="tw"><table class="readings">
        <thead><tr><th>Time</th><th>Value${h.unit ? ` <span class="unit" style="font-weight:400;text-transform:none;font-size:.85em;opacity:.7">${esc(h.unit)}</span>` : ''}</th><th>As reported</th></tr></thead>
        <tbody>${h.rows.map((row) => `<tr><td class="n">${esc(row.at)}</td><td class="n">${val(row.value)}</td><td>${esc(row.state)}</td></tr>`).join('')}</tbody>
      </table></div>
    </div>`).join('')}</div>`, 'mars-side') : '';
  return external + station + hardware;
}

module.exports = { contents, dayRecord };
