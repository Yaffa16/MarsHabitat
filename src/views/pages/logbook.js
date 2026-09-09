'use strict';
const L = require('../layout');
const { esc } = L;
const MV = require('./media');
const missionLib = require('../../lib/mission');
const { shortDay } = missionLib;

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

/**
 * The crew log as a page of its own: every day of the run in order, each
 * with the three officers' slots. A slot that has been written carries the
 * entry; one that has not carries its placeholder, greyed — a cue for what
 * will go there — so the whole shape of the log is on the page from the
 * first day and fills in as the crew write. The strip at the top jumps to a
 * day and counts what is written on it.
 */
function logPage(ctx, { days, crew, counts, mediaLookup = () => null }) {
  const m = ctx.mission, T = ctx.T;
  const pre = m.phase === 'PRE_LAUNCH';
  const slots = counts.slots || days.reduce((n, d) => n + d.entries.length, 0);
  const body = `
  <div class="logpage-top">
    <div class="eyebrow">${T('Channel group')} 50 · ${T('Crew log')} <span class="brk">${T('Written from inside')}</span></div>
    <h1>${T('Crew log')}</h1>
    <p class="lede">${T('At the end of each day the three officers each write an entry from inside the habitat. Nobody edits them on the way out.')} ${counts.published} ${T('of')} ${slots} ${T('entries written')}${
      pre ? ` — ${T('the habitat is occupied from')} ${esc(m.startLabel)}; ${T('the grey slots show where each day’s entries will go')}` : ''}.</p>
    <div class="actions"><a class="btn" href="/#crewlog">${T('Back to the mission')}</a></div>
  </div>

  <div class="logpage-strip" aria-label="${esc(T('Jump to a day'))}">
    ${days.map((d) => {
      const n = d.missionDay;
      const cls = pre ? 'quiet' : n < m.clampedDay ? 'past' : n === m.clampedDay ? 'now' : 'quiet';
      return `<a class="${cls}" href="#day-${n}"><b>D${dayLabel(n)}</b><span>${esc(shortDay(d.date))}</span><i>${d.written}</i></a>`;
    }).join('')}
  </div>

  <div class="feed-filter log-filter logpage-filter" id="log-filter" role="group" aria-label="${esc(T('Filter the crew log'))}">
    <button type="button" class="chip active" data-crew="">${T('ALL CREW')}</button>
    ${crew.map((c) => `<button type="button" class="chip" data-crew="${c.id}">${esc(c.designation)}</button>`).join('')}
  </div>

  <div id="log-days" class="logpage-days">
    ${days.map((d) => `
    <section class="log-day logpage-day" id="day-${d.missionDay}" data-day="${d.missionDay}">
      <div class="log-day-head">
        <span class="cs">${T('Day')} ${dayLabel(d.missionDay)}</span>
        <span>${esc(missionLib.dayLabel(d.date))}</span>
        ${!pre && d.missionDay === m.clampedDay ? `<span class="now">${T('Today')}</span>` : ''}
        <span class="count">${d.written}/${d.entries.length} ${T('written')}</span>
      </div>
      ${d.entries.map((e) => `
      <article class="card log-entry${e.placeholder ? ' placeholder' : ''}" id="e${e.id}" data-crew="${e.crew_id}">
        <div class="card-top"><span class="cs">${esc(e.designation)}</span><span class="card-day">${
          e.placeholder ? T('placeholder') : esc(e.role)}</span></div>
        ${e.placeholder ? `<div class="card-body" style="white-space:pre-line">${esc(e.body)}</div>${
            e.media && e.media.length ? `<div class="card-body entry-post">${MV.entryHtml('', e.media, { lookup: mediaLookup, T })}</div>` : ''}`
          : `<div class="card-body entry-post">${MV.entryHtml(e.body, e.media || [], { lookup: mediaLookup, T })}</div>`}
      </article>`).join('')}
      ${d.media && d.media.length ? `<div class="logpage-media">
        <div class="logpage-media-head"><span>${T('From the habitat that day')} · ${d.media.length}</span>
          <a href="/media#day-${d.missionDay}">${T('all media')}</a> · <a href="/media/day/${d.missionDay}/export.zip">${T('download the day')}</a></div>
        ${MV.strip(d.media)}</div>` : ''}
    </section>`).join('')}
  </div>
  <div class="empty" id="log-empty" style="display:none">${T('Nothing written by them yet')}</div>`;

  return L.page({ title: 'Crew log', ctx, body, current: '/logbook', scripts: ['/board.js'],
    hero: L.masthead(ctx) + L.pageNav('/logbook', T), hideRail: true, hideNav: true, bodyClass: 'landing inner' });
}

module.exports = { entryCard, logSection, logPage };
