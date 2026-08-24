'use strict';
const L = require('../layout');
const { esc, panel, eyebrow } = L;

const { AXES } = require('../../lib/mood');

const dayLabel = (n) => String(n).padStart(3, '0');

/* ================================================================== LOGIN */

/** Who is at the terminal. The tablet is shared; switching is one tap. */
function chooseCrew(ctx, { crew }) {
  const body = `<div style="max-width:520px;margin:10vh auto 0">
    ${panel('CH-50 / HABITAT TERMINAL', `
      ${eyebrow('Interior access')}
      <h1 style="font-size:26px">Who is writing?</h1>
      <p class="note">Mission day ${dayLabel(ctx.mission.clampedDay)} ·
        ${esc(ctx.mission.venueTime)} habitat time</p>
      <div class="choose">
        ${crew.map((c) => `<form method="post" action="/log/who">
          <input type="hidden" name="crew_id" value="${c.id}">
          <button class="primary">${esc(c.designation)}<em>${esc(c.role)}</em></button>
        </form>`).join('')}
      </div>`, 'mars-side')}
  </div>`;
  return L.page({ title: 'Habitat terminal', ctx, body, current: '', bodyClass: 'habitat' });
}

/* =============================================================== TERMINAL */

/**
 * The writing surface. Deliberately one screen: today's entry, the day's
 * schedule and meals for context, and everything this crew member has written
 * before. A performer coming off a task should be able to sit down and write
 * without navigating anything.
 */
function terminal(ctx, { member, crew, today, entry, mood, mine, f, phase }) {
  const n = ctx.mission.clampedDay;
  const words = entry ? entry.body.trim().split(/\s+/).filter(Boolean).length : 0;

  const body = `
  <div style="padding:26px 0 10px">
    <div class="eyebrow">Habitat terminal · ${esc(ctx.mission.elapsed)}</div>
    <h1 style="font-size:clamp(22px,3.6vw,32px)">${esc(member.designation)}</h1>
    <p class="note">Mission day ${dayLabel(n)} · ${esc(ctx.mission.today)} ·
      ${esc(ctx.mission.venueTime)} habitat time</p>
  </div>

  ${f ? `<div class="flash ${f.err ? 'err' : ''}">${esc(f.msg)}</div>` : ''}
  ${phase !== 'ACTIVE' ? `<div class="flash err">The mission is not running today. Anything you
    write will be filed against day ${dayLabel(n)}.</div>` : ''}

  <div class="term">
    <!-- The terminal is shared. Switching is one press, always in the same
         place, so nobody has to sign out to hand it over. -->
    <nav class="whoami">
      ${(crew || []).map((c) => `<form method="post" action="/log/who">
        <input type="hidden" name="crew_id" value="${c.id}">
        <button class="${c.id === member.id ? 'on' : ''}">
          <b>${esc(c.designation.replace(' OFFICER', ''))}</b>
          <em>${esc(c.designation.includes('OFFICER') ? 'officer' : '')}</em>
        </button>
      </form>`).join('')}
    </nav>

  <div class="grid g-hero">
    ${panel(`CH-50 / DAY ${dayLabel(n)} ENTRY`, `
      ${eyebrow(entry ? 'Your entry for today' : 'Nothing written yet today')}
      <form method="post" action="/log/entry">
        <textarea name="body" id="entry" required minlength="2"
          style="min-height:280px;font-size:15px;line-height:1.7"
          placeholder="What happened today. What you did, what broke, what you ate, what you thought about. Write it as yourself.">${esc(entry ? entry.body : '')}</textarea>
        <div style="display:flex;justify-content:space-between;align-items:center;margin:10px 0 16px">
          <span class="counter" id="wordcount">${words} words</span>
          <span class="counter">${entry
            ? `LAST SAVED ${esc(entry.updated_at.slice(11, 16))} UTC`
            : 'NOT YET SAVED'}</span>
        </div>
        <button type="submit" class="primary">${entry ? 'Save changes' : 'File today’s entry'}</button>
        ${entry && entry.published ? '<span class="badge ok" style="margin-left:10px">VISIBLE ON EARTH</span>' : ''}
        ${entry && !entry.published ? '<span class="badge warn" style="margin-left:10px">HELD BY MISSION CONTROL</span>' : ''}
      </form>
      <p class="note" style="margin-top:14px">Your entry goes straight to the public logbook.
      You can keep editing it for as long as today is today; after that it stands as the record.</p>`,
      'mars-side')}

    <div>
      ${panel(`CH-30 / TODAY'S SCHEDULE`, `
        ${eyebrow('What you were meant to be doing')}
        ${today && today.tasks.length ? `<div class="rows">${today.tasks.map((t) => `
          <div class="row ${t.status === 'DONE' ? 'done' : ''} ${t.status === 'ACTIVE' ? 'active' : ''}">
            <div class="t">${esc(t.time)}</div>
            <div class="m"><b>${esc(t.label)}</b></div>
          </div>`).join('')}</div>`
        : '<div class="empty">NO SCHEDULE FILED FOR TODAY</div>'}`, 'mars-side')}

      ${today && today.meals.length ? panel('CH-32 / GALLEY', `
        ${eyebrow('What you ate')}
        <dl class="kv">${today.meals.map((m) =>
          `<dt>${esc(m.slot)}</dt><dd>${esc(m.name)}</dd>`).join('')}</dl>`, 'mars-side') : ''}
    </div>
  </div>

  ${panel('CH-12 / YOUR STATE', `
    ${eyebrow('How today felt')}
    <form method="post" action="/log/state">
      ${AXES.map((a) => {
        const val = mood ? mood[a.key] : 50;
        return `<div class="axis-row">
          <div class="poles"><span>${a.low}</span><span>${a.label}</span><span>${a.high}</span></div>
          <input type="range" min="0" max="100" name="${a.key}" value="${val}"
                 class="mood-slider" data-axis="${a.key}" data-crew="${member.id}">
          <div class="axis-read" id="read-${member.id}-${a.key}"></div>
        </div>`;
      }).join('')}
      <label class="f"><span>What you are doing</span>
        <input type="text" name="activity" value="${esc(member.activity || '')}"></label>
      <button class="primary">File state</button>
    </form>
    <p class="note" style="margin-top:12px">Nobody on Earth sees these numbers. They see the
    sentence under each slider.</p>`, 'mars-side')}

  ${panel('CH-50 / YOUR LOG', `
    ${eyebrow(`${mine.length} entr${mine.length === 1 ? 'y' : 'ies'} filed`)}
    ${mine.length ? mine.map((e) => `
      <div style="border-bottom:1px solid var(--rule);padding:12px 0">
        <div style="font-family:var(--mono);font-size:10px;letter-spacing:.16em;color:var(--dim)">
          DAY ${dayLabel(e.mission_day)} · ${esc(e.written_at.slice(0, 10))}
          ${e.published ? '' : ' · <span style="color:var(--signal)">HELD</span>'}
        </div>
        <p style="margin:6px 0 0;white-space:pre-line">${esc(e.body)}</p>
      </div>`).join('')
    : '<div class="empty">You have not written anything yet</div>'}`, 'mars-side')}
  </div>`;

  return L.page({
    title: `${member.designation} · log`, ctx, body, current: '',
    bodyClass: 'habitat', scripts: ['/logbook.js'],
  });
}

/* ========================================================= PUBLIC LOGBOOK */

function entryCard(e) {
  return `<article class="card" id="e${e.id}">
    <div class="card-top">
      <span class="cs">${esc(e.designation)}</span>
      <span class="card-day">D${dayLabel(e.mission_day)}</span>
    </div>
    <div class="card-body" style="white-space:pre-line">${esc(e.body)}</div>
    <div class="card-foot"><span>${esc(e.role)}</span>
      <span style="margin-left:auto">${esc(e.written_at.slice(0, 10))}</span></div>
  </article>`;
}

function publicLogbook(ctx, { days, crew, filterCrew, counts }) {
  const body = `
  <div style="padding:30px 0 18px">
    <div class="eyebrow">Channel group 50 · Crew log</div>
    <h1>Logbook</h1>
    <p class="lede">At the end of each day the captain, the science officer and the
    communication officer each write an entry from inside the habitat. Nobody edits them on
    the way out. ${counts.published} entr${counts.published === 1 ? 'y' : 'ies'} across
    ${counts.days} day${counts.days === 1 ? '' : 's'} so far.</p>
    <div class="tags" style="margin-top:18px">
      <a class="btn" href="/logbook"${!filterCrew ? ' style="border-color:var(--oxide);color:var(--oxide)"' : ''}>All crew</a>
      ${crew.map((c) => `<a class="btn" href="/logbook?crew=${c.id}"${String(filterCrew) === String(c.id)
        ? ' style="border-color:var(--oxide);color:var(--oxide)"' : ''}>${esc(c.designation)}</a>`).join('')}
    </div>
  </div>

  ${days.length ? days.map((d) => `
    <section style="margin-bottom:var(--gutter)">
      <div class="eyebrow">Mission day ${dayLabel(d.missionDay)}
        · <a href="/day/${d.missionDay}">that day's schedule</a></div>
      <div class="cards">${d.entries.map(entryCard).join('')}</div>
    </section>`).join('')
  : '<div class="empty">NO ENTRIES HAVE BEEN FILED YET</div>'}`;

  return L.page({ title: 'Logbook', ctx, body, current: '/logbook' });
}

module.exports = { chooseCrew, terminal, publicLogbook, entryCard };
