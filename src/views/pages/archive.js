'use strict';
const L = require('../layout');
const { esc, panel, eyebrow } = L;
const mood = require('../../lib/mood');
const MV = require('./media');
const mediaLookup = require('../../lib/media').get;
const officer = require('../../lib/officer');

const dd = (n) => String(n).padStart(3, '0');
/** A figure exactly as it was entered — no rounding, no formatting. */
const asIs = (v) => (v == null || v === '' ? '—' : esc(String(v)));

/* The archive shows what was entered and what was measured, as it is: no
   chart, no projection, no total, no figure carried from one day to the
   next. A store not counted on a day has no figure for that day. */

/* ============================================================== CONTENTS */

function contents(ctx, { days, counts, entryCounts, rehearsal = null, tally = { days: [], messages: 0, replied: 0, visitors: 0 } }) {
  const recorded = days.filter((d) => d.isPast || d.isToday);

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

  ${panel('TAKE A COPY', `
    ${eyebrow('Download the record')}
    <div class="dl-grid">
      ${card({ fmt: 'PDF · one document', title: 'The full record',
        blurb: 'The whole mission, bookmarked by section and by day: schedules, meals, '
          + 'the stores as counted, the crew log with its photographs in place, every '
          + 'state filed and every reading of every day.',
        href: '/archive/export.pdf', label: 'Download PDF', primary: true })}
      ${card({ fmt: 'JSON · every day of the run', title: 'Data',
        blurb: 'Everything the station holds for every day of the run, as one structured file: the schedule, '
          + 'the meals, the stores, the steps, the power generated and consumed, the Commander Log and the reports, '
          + 'every state filed, every sensor reading, the day’s mission, the messages received with their replies, '
          + 'and the media index with every file’s SHA-256.',
        href: '/archive/export.json', label: 'Download .json' })}
      ${card({ fmt: 'ZIP · tables for a spreadsheet', title: 'Sensor Data',
        blurb: 'Everything on the Sensors tab and in Today’s Meal, day by day: every reading of the habitat sensor '
          + 'and the hardware, each day’s low, high and mean, the steps, the power generated and consumed, the '
          + 'resources and every meal with its figures — a folder for each day and the same tables across them all. '
          + 'With the raw readings log beside them: every reading ever pulled, kept for good.',
        href: '/archive/sensor-data.zip', label: 'Download ZIP' })}
      ${card({ fmt: `PDF · ${counts.total} ${counts.total === 1 ? 'message' : 'messages'} · not part of the record`, title: 'All the messages',
        blurb: 'Every message that ever reached the station — published with its reply, rejected with '
          + 'the reason, still waiting or in transit — in the order it was sent.',
        href: '/control/messages/export.pdf', label: 'Download all messages',
        also: [{ href: '/control/messages/export.csv', label: 'CSV', title: 'One row per message, for a spreadsheet' },
               { href: '/control/messages/export.json', label: 'JSON', title: 'For machines' }] })}
    </div>
`, 'mars-side')}

  ${panel('CONTENTS', `
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
          <a href="/archive/now">Open</a>
          <a href="/archive/now/export.pdf" download>PDF</a>
          <a href="/archive/now/export.md" download>MD</a>
          ${rehearsal.media.length ? '<a href="/media/day/0/export.zip" download>Media</a>' : ''}</span></td>
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
    ${rehearsal ? `<p class="note" style="margin-top:10px"><b>NOW</b> is today${ctx.mission.phase === 'PRE_LAUNCH' ? ', before the run' : ' — this station rehearses against made-up dates'} — the rehearsal day, mission day 0. Its record is built the way a run day's is: today's readings from every source and the states filed today, the messages that came in before the run, and everything mission control files under <b>NOW</b> — the day picker's first stop on every tab — its schedule and meals, the Commander Log and the two reports, the counts, figures, power and media. Nothing of it touches the run's days. It is marked as a rehearsal wherever it appears — in the full record, the data, the sensor data and the messages — is not part of the record, and ${ctx.mission.phase === 'PRE_LAUNCH' ? 'disappears on the first day of the run' : 'is there only while the station rehearses against made-up dates'}.</p>` : ''}`)}

  ${panel('THE TALLY', `
    ${eyebrow('Messages received and replied, and visitors — mission control’s figures')}
    <div class="tally" id="tally">
      <div class="tally-item"><span class="tally-k">Messages received</span><b class="tally-n">${tally.messages}</b><span class="tally-sub">total</span></div>
      <div class="tally-item"><span class="tally-k">Messages replied</span><b class="tally-n">${tally.replied || 0}</b><span class="tally-sub">total</span></div>
      <div class="tally-item"><span class="tally-k">Visitors</span><b class="tally-n">${tally.visitors}</b><span class="tally-sub">total</span></div>
    </div>
    ${tally.days.length ? `<div class="tw"><table class="daylist tally-days">
      <thead><tr><th>Day</th><th>Date</th><th class="n">Messages received</th><th class="n">Messages replied</th><th class="n">Visitors</th></tr></thead>
      <tbody>${tally.days.map((r) => `<tr>
        <td class="n">${r.missionDay != null ? dd(r.missionDay) : '—'}</td>
        <td>${esc(r.date)}</td>
        <td class="n">${r.messages || '—'}</td>
        <td class="n">${r.replied || '—'}</td>
        <td class="n">${r.visitors || '—'}</td>
      </tr>`).join('')}</tbody>
    </table></div>` : '<p class="note">Nothing counted yet.</p>'}
`, 'earth-side')}
`;
  return L.page({ title: 'Archive', ctx, body, current: '/archive' });
}

/* ============================================================ DAY RECORD */

function dayRecord(ctx, { record, hasPrev, hasNext }) {
  const r = record;
  const slot = (x) => require('../../lib/data').slotLabel(x);

  const base = r.rehearsal ? '/archive/now' : `/archive/day/${r.missionDay}`;
  const mediaDay = r.rehearsal ? 0 : r.missionDay;   // NOW's media hangs on day 0
  const body = `
  <div style="padding:30px 0 18px">
    <div class="eyebrow">${r.rehearsal ? 'Archive · REHEARSAL · NOT THE RECORD' : `Archive · permanent record${r.sealed ? ' · sealed' : ' · still open'}`}</div>
    <h1>${r.rehearsal ? `NOW — today, ${ctx.mission.phase === 'PRE_LAUNCH' ? 'before the run' : 'the rehearsal day'}` : `Day ${dd(r.missionDay)}`}</h1>
    ${r.rehearsal ? `<p class="note">A day's record built for today: today's readings from every source and the states filed today, and everything mission control has filed under NOW (mission day 0) — its schedule and meals, the blogs and reports, the counts, figures, power and media — kept apart from the run's days. Not part of the record; ${ctx.mission.phase === 'PRE_LAUNCH' ? 'gone on the first day of the run, when day 001 takes its place' : 'there only while the station rehearses against made-up dates'}.</p>` : ''}
    <div class="spec">
      <span>${esc(r.date)}</span>
      <span><b>${r.officers.filter((o) => o.entry).length + r.officers.filter((o) => o.reports.length).length}</b> daily blogs</span>
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

  ${r.officers.map((o, k) => panel(`${esc(officer.shown(o.designation))}`, `
    ${eyebrow(`${esc(officer.shown(o.designation))}${o.role ? ` · ${esc(o.role)}` : ''}`)}
    ${o.hasBlog ? `<h3>Commander Log</h3>
    ${o.entry ? `<div class="entry-post">${MV.entryHtml(o.entry.body, o.media, { lookup: mediaLookup })}</div>`
      : '<p class="note">No Commander Log written for this day.</p>'}` : ''}
    ${o.reportKind ? `<h3${o.hasBlog ? ' style="margin-top:18px"' : ''}>${esc(o.reportLabel)}</h3>
    ${o.reports.length ? o.reports.map((x) => `<div class="entry-post">${MV.entryHtml(x.body, [], { lookup: mediaLookup })}</div>`).join('')
      : `<p class="note">No ${esc(o.reportLabel)} written for this day.</p>`}` : ''}
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

  ${r.reportsUnassigned.length ? panel('DAILY REPORTS', `
    ${eyebrow('Reports with no officer to hang on')}
    <div class="rows">${r.reportsUnassigned.map((n) => `
      <div class="row"><div class="t">${esc(n.posted_at.slice(11, 16))}</div>
      <div class="m entry-post">${MV.entryHtml(n.body, [], { lookup: mediaLookup })}</div>
      <span class="badge">${esc(n.kind)}</span></div>`).join('')}</div>`, 'mars-side') : ''}

  ${r.notesOther.length ? panel('NOTES', `
    ${eyebrow('Mission notes')}
    <div class="rows">${r.notesOther.map((n) => `
      <div class="row"><div class="t">${esc(n.posted_at.slice(11, 16))}</div>
      <div class="m entry-post">${MV.entryHtml(n.body, [], { lookup: mediaLookup })}</div>
      <span class="badge">${esc(n.kind)}</span></div>`).join('')}</div>`, 'mars-side') : ''}

  ${r.media && r.media.length ? panel('MEDIA', `
    ${eyebrow('What the crew sent out')}
    ${MV.strip(r.media)}
    <p class="note" style="margin-top:8px"><a href="/media/day/${mediaDay}/export.zip">Download this day's media as one ZIP</a> ·
      every file is listed with its SHA-256 in the day's export.</p>`, 'mars-side') : ''}

  <div style="padding:26px 0 8px"><div class="eyebrow">The Habitat tab of mission control · as it stands at the time of this record · the same tab is written to the readings log automatically at the end of each day</div></div>
  <div class="grid g2">
    ${panel('SCHEDULE', `
      ${eyebrow('Schedule')}
      ${r.day && r.day.tasks.length ? `<div class="rows">${r.day.tasks.map((t) => `
        <div class="row ${t.status === 'DONE' ? 'done' : ''}">
          <div class="t">${esc(t.time)}</div>
          <div class="m"><b>${esc(t.label)}</b>${t.detail ? `<span>${esc(t.detail)}</span>` : ''}</div>
          <span class="badge">${esc(t.status)}</span>
        </div>`).join('')}</div>` : '<p class="note">No schedule for this day.</p>'}`, 'mars-side')}

    ${panel('MEALS', `
      ${eyebrow('Meals')}
      ${r.day && r.day.meals.length ? r.day.meals.map((m) => `<div style="padding:8px 0;border-bottom:1px solid var(--rule)">
        <div class="eyebrow">${esc(slot(m.slot))}${m.served_at ? ` · ${esc(m.served_at)}` : ''}</div>
        <h3>${esc(m.name)}</h3>
        ${m.components ? `<div class="note" style="white-space:pre-line;margin-bottom:6px">${esc(m.components)}</div>` : ''}
        <div class="note">${asIs(m.kcal)} kcal · ${asIs(m.water_litres)} L water · ${asIs(m.prep_minutes)} min · ${m.energy_source === 'with' ? `power with ${esc(slot(m.power_with))}${m.window ? ` (${m.window[0]}–${m.window[1]}${m.power_wh != null ? `, ${m.power_wh} Wh` : ''})` : ''}` : `${asIs(m.energy_wh)} Wh${m.energy_source === 'meter' ? ` (the food meter${m.window ? `, ${m.window[0]}–${m.window[1]}` : ''}${m.power_running ? ', so far' : ''})` : ''}`}</div>
        ${m.notes ? `<p class="note">${esc(m.notes)}</p>` : ''}
      </div>`).join('') : '<p class="note">No meals entered for this day.</p>'}`, 'mars-side')}

    ${panel('STEPS TAKEN', `
      ${eyebrow('As filed')}
      ${r.figures && r.figures.crew && Object.keys(r.figures.crew).length ? `<div class="tw"><table style="min-width:0">
        <thead><tr><th>Officer</th><th>Steps taken</th></tr></thead>
        <tbody>${Object.entries(r.figures.crew).map(([who, f]) => `<tr>
          <th>${esc(who)}</th>
          <td class="n">${asIs(f.steps)}</td>
        </tr>`).join('')}${r.figures.steps != null ? `<tr>
          <th>Crew (as filed)</th>
          <td class="n"><b>${asIs(r.figures.steps)}</b></td>
        </tr>` : ''}</tbody></table></div>` : '<p class="note">Not filed for this day.</p>'}`, 'mars-side')}

    ${panel('POWER', `
      ${eyebrow('Power consumed · as filed')}
      ${r.power && r.power.filed ? `<div class="tw"><table style="min-width:0"><tbody>${r.power.categories.map((c) => `<tr>
        <th>${esc(c.label)}</th>
        <td class="n">${c.kwh == null ? '—' : `${asIs(c.kwh)} kWh`}</td>
      </tr>`).join('')}</tbody></table></div>` : '<p class="note">Not filed for this day.</p>'}`, 'mars-side')}
  </div>

  ${panel('INVENTORY LEVELS', `
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
    ${(r.external || []).length ? panel('HABITAT · SENSOR NODE', `
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

    ${r.habitat.length ? panel('HABITAT · THE STATION’S CHANNELS', `
      ${eyebrow('Posted to the station by the habitat node')}
      <div class="tw"><table>
        <thead><tr><th>Channel</th><th>Low</th><th>High</th><th>Mean</th><th>Readings</th></tr></thead>
        <tbody>${r.habitat.map((h) => `<tr>
          <th>${esc(h.label || h.metric)}</th>
          <td class="n">${h.min_value == null ? '—' : h.min_value.toFixed(1)}</td>
          <td class="n">${h.max_value == null ? '—' : h.max_value.toFixed(1)}</td>
          <td class="n">${h.avg_value == null ? '—' : h.avg_value.toFixed(1)} ${esc(h.unit || '')}</td>
          <td class="n">${h.samples}</td>
        </tr>`).join('')}</tbody>
      </table></div>`, 'mars-side') : ''}

    ${(r.hardware || []).length ? panel('HABITAT HARDWARE', `
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

  return L.page({ title: r.rehearsal ? 'Archive · NOW, today · rehearsal' : `Archive · day ${dd(r.missionDay)}`, ctx, body, current: '/archive' });
}

/* Every reading of the day, as stored: the station's channels as one row
   per instant with a column per channel, the external node one row per
   reading, the hardware one table per device. Nothing summarised, nothing
   drawn. */
function readingsPanels(R) {
  if (!R || !R.count) return '';
  const val = (v) => (v == null ? '—' : esc(String(v)));
  const station = R.station.rows.length ? panel('EVERY READING · HABITAT · THE STATION’S CHANNELS', `
    ${eyebrow(`${R.station.readings} readings · one row per instant, habitat time`)}
    <div class="tw"><table class="readings">
      <thead><tr><th>Time</th>${R.station.columns.map((c) => `<th>${esc(c.label)}${c.unit ? ` <span class="unit" style="font-weight:400;text-transform:none;font-size:.85em;opacity:.7">${esc(c.unit)}</span>` : ''}</th>`).join('')}</tr></thead>
      <tbody>${R.station.rows.map((row) => `<tr><td class="n">${esc(row.at)}</td>${R.station.columns.map((c) => `<td class="n">${val(row.values[c.metric])}</td>`).join('')}</tr>`).join('')}</tbody>
    </table></div>`, 'mars-side') : '';
  const external = R.external.rows.length ? panel('EVERY READING · HABITAT · SENSOR NODE', `
    ${eyebrow(`${R.external.readings} readings · habitat time`)}
    <div class="tw"><table class="readings">
      <thead><tr><th>Time</th>${R.external.columns.map((c) => `<th>${esc(c.label)} <span class="unit" style="font-weight:400;text-transform:none;font-size:.85em;opacity:.7">${esc(c.unit)}</span></th>`).join('')}</tr></thead>
      <tbody>${R.external.rows.map((row) => `<tr><td class="n">${esc(row.at)}</td>${R.external.columns.map((c) => `<td class="n">${val(row.values[c.key])}</td>`).join('')}</tr>`).join('')}</tbody>
    </table></div>`, 'mars-side') : '';
  const hardware = R.hardware.length ? panel('EVERY READING · HABITAT HARDWARE', `
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
