'use strict';
const L = require('../layout');
const { esc } = L;
const MV = require('./media');
const missionLib = require('../../lib/mission');
const { shortDay } = missionLib;

const dayLabel = (n) => String(n).padStart(3, '0');

/* ============================================================== CREW LOG */

/**
 * The crew log as a page of its own: every day of the run in order, each
 * with its three blogs — Commander Blog, Daily Science Findings, Daily
 * Health Blog. A slot that has been written carries the
 * entry; one that has not carries its placeholder, greyed — a cue for what
 * will go there — so the whole shape of the log is on the page from the
 * first day and fills in as the crew write. The strip at the top jumps to a
 * day and counts what is written on it.
 */
function logPage(ctx, { days, crew, counts, blogs = [], mediaLookup = () => null }) {
  const m = ctx.mission, T = ctx.T;
  const pre = m.phase === 'PRE_LAUNCH';
  const slots = counts.slots || days.reduce((n, d) => n + d.entries.length, 0);
  const body = `
  <div class="logpage-top">
    <div class="eyebrow">${T('Channel group')} 50 · ${T('Crew log')} <span class="brk">${T('Written from inside')}</span></div>
    <h1>${T('Crew log')}</h1>
    <p class="lede">${T('Three blogs come out of the habitat each day: the Commander Blog, the Daily Science Findings and the Daily Health Blog. Nobody edits them on the way out.')} ${counts.published} ${T('of')} ${slots} ${T('entries written')}${
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
    <button type="button" class="chip active" data-crew="">${T('ALL BLOGS')}</button>
    ${blogs.map((b) => `<button type="button" class="chip" data-crew="${b.key}">${esc(T(b.title))}</button>`).join('')}
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
      <article class="card log-entry${e.placeholder ? ' placeholder' : ''}" id="e${e.id}" data-crew="${e.blog}">
        <div class="card-top"><span class="cs">${esc(T(e.title))}</span><span class="card-day">${
          e.placeholder ? T('placeholder') : ''}</span></div>
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
  <div class="empty" id="log-empty" style="display:none">${T('Nothing written in this blog yet')}</div>`;

  return L.page({ title: 'Crew log', ctx, body, current: '/logbook', scripts: ['/board.js'],
    hero: L.masthead(ctx) + L.pageNav('/logbook', T), hideRail: true, hideNav: true, bodyClass: 'landing inner' });
}

module.exports = { logPage };
