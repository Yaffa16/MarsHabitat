'use strict';
const L = require('../layout');
const { esc } = L;

const dayLabel = (n) => String(n).padStart(3, '0');

/* ============================================================== CREW LOG */

/** One diary entry as a label card, stamped with who wrote it and which day. */
function entryCard(e) {
  return `<article class="card" id="e${e.id}" data-crew="${e.crew_id}">
    <div class="card-top">
      <span class="cs">${esc(e.designation)}</span>
      <span class="card-day">D${dayLabel(e.mission_day)}</span>
    </div>
    <div class="card-body" style="white-space:pre-line">${esc(e.body)}</div>
    <div class="card-foot"><span>${esc(e.role)}</span>
      <span style="margin-left:auto">${esc(e.written_at.slice(0, 10))}</span></div>
  </article>`;
}

/**
 * The crew log as a section of the landing page: every published entry,
 * newest day first, with a chip per crew member to read one voice through.
 * Days where nobody wrote are omitted — a gap in the day numbers is truer
 * than an empty day.
 */
function logSection({ days, crew, counts }) {
  return `
  <div class="sechead" id="crewlog">
    <h2 class="bigsec">Crew log</h2>
    <span class="secsub">${counts.published} ENTR${counts.published === 1 ? 'Y' : 'IES'} ·
      ${counts.days} DAY${counts.days === 1 ? '' : 'S'} · WRITTEN FROM INSIDE</span>
  </div>
  <p class="note" style="max-width:64ch;margin-bottom:14px">At the end of each day the three
  officers each write an entry from inside the habitat. Nobody edits them on the way out.</p>
  ${days.length ? `
    <div class="feed-filter" id="log-filter" role="group" aria-label="Filter the crew log" style="margin-bottom:14px">
      <button type="button" class="chip active" data-crew="">ALL CREW</button>
      ${crew.map((c) => `<button type="button" class="chip" data-crew="${c.id}">${esc(c.designation)}</button>`).join('')}
    </div>
    <div id="log-days">
    ${days.map((d) => `
      <section class="log-day" data-day="${d.missionDay}" style="margin-bottom:var(--gutter)">
        <div class="eyebrow" style="margin-bottom:8px">Mission day ${dayLabel(d.missionDay)}</div>
        <div class="cards">${d.entries.map(entryCard).join('')}</div>
      </section>`).join('')}
    </div>
    <div class="empty" id="log-empty" style="display:none">Nothing written by them yet</div>`
  : '<div class="empty">No entries have been filed yet</div>'}`;
}

module.exports = { entryCard, logSection };
