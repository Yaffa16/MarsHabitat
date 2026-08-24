'use strict';
const L = require('../layout');
const { esc, panel, eyebrow } = L;
const orbital = require('../../lib/orbital');
const mood = require('../../lib/mood');

const dd = (n) => String(n).padStart(3, '0');

/**
 * Mission control is organised by who does the work, not by what kind of
 * record it is. Each officer's tab holds everything that officer is
 * responsible for, so whoever is at the desk moves through three people rather
 * than through five kinds of form.
 */
const TABS = [
  ['/control', 'Communication officer'],
  ['/control/science', 'Science officer'],
  ['/control/health', 'Health officer'],
  ['/control/habitat', 'Habitat'],
];

function shell(ctx, current, inner, title, user, content) {
  const body = `
  <div style="padding:22px 0 4px">
    <div class="eyebrow">Mission control · ${esc(user.username)} ·
      day ${dd(ctx.mission.clampedDay)} · ${esc(ctx.mission.venueTime)} habitat time</div>
    <h1>${esc(title)}</h1>
    <div class="actions" style="margin-bottom:14px">
      <a class="btn" href="/archive">Archive</a>
      <a class="btn" href="/archive/export.md">Download record</a>
      <a class="btn" href="/log">Habitat terminal</a>
      <a class="btn" href="/">Public station</a>
      <div class="spacer"></div>
      <form method="post" action="/control/logout"><button class="ghost">Sign out</button></form>
    </div>
  </div>

  <nav class="filters">
    ${TABS.map(([h, l]) => `<a href="${h}" class="${h === current ? 'on' : ''}">${l}</a>`).join('')}
  </nav>

  ${content && !content.ok ? `<div class="flash err">
    Content files have a problem — the site is serving the last good version.<br>
    ${content.errors.map((e) => esc(e)).join('<br>')}</div>` : ''}

  ${inner}`;
  return L.page({
    title: `${title} · Control`, ctx, body, current: '',
    bodyClass: 'control', scripts: ['/control.js'],
  });
}

const flash = (f) => f ? `<div class="flash ${f.err ? 'err' : ''}">${esc(f.msg)}</div>` : '';

/** Day picker, shared by every officer tab. */
const dayPicker = (base, day, totalDays) => `
  <nav class="filters" style="margin-bottom:var(--gutter)">
    ${Array.from({ length: totalDays }, (_, i) => i + 1).map((n) =>
      `<a href="${base}?day=${n}" class="${n === day ? 'on' : ''}">D${dd(n)}</a>`).join('')}
  </nav>`;

/** The four mood sliders for one officer, with the public sentence live. */
function moodBlock(c) {
  const t = mood.translate(c.mood);
  return panel(`CH-12 / MOOD`, `
    ${eyebrow('Mood')}
    <span class="badge">${esc(t.condition)}</span>
    <form method="post" action="/control/moods/${c.id}" style="margin-top:14px">
      ${mood.AXES.map((a) => {
        const v = c.mood ? c.mood[a.key] : 50;
        return `<div class="axis-row">
          <div class="poles"><span>${a.low}</span><span>${a.label}</span><span>${a.high}</span></div>
          <input type="range" min="0" max="100" name="${a.key}" value="${v}"
                 class="mood-slider" data-axis="${a.key}" data-crew="${c.id}">
          <div class="axis-read" id="read-${c.id}-${a.key}"></div>
        </div>`;
      }).join('')}
      <label class="f"><span>What they are doing</span>
        <input type="text" name="activity" value="${esc(c.activity || '')}"></label>
      <button class="primary">File state</button>
    </form>
    <p class="note" style="margin-top:10px">The public never sees these numbers, only the
    sentence under each slider.</p>`, 'mars-side');
}

/** That officer's blog entry for the chosen day. */
function blogBlock(c, day, entry, tpl) {
  const locked = entry && entry.source !== 'file';
  return panel('CH-50 / DAILY BLOG', `
    ${eyebrow(`Daily blog · day ${dd(day)}`)}
    ${locked ? '<span class="badge warn">Written at the habitat terminal — theirs, not editable here</span>' : ''}
    <form method="post" action="/control/logbook">
      <input type="hidden" name="day" value="${day}">
      <input type="hidden" name="designation" value="${esc(c.designation)}">
      <input type="hidden" name="back" value="${esc(c.tab)}">
      ${locked ? '' : templateBar(tpl)}
      <textarea name="body" rows="10" ${locked ? 'disabled' : ''}
        placeholder="What happened today, in their voice.">${esc(entry ? entry.body : '')}</textarea>
      ${locked ? '' : '<div class="actions"><button class="primary">Save blog entry</button></div>'}
    </form>`, 'mars-side');
}

/**
 * Template buttons. Pressing one drops a skeleton into the field below it, so
 * nobody has to remember the shape of a report at the end of a long day.
 * They only fill an empty box — an entry already being written is never
 * overwritten by a stray press.
 */
function templateBar(list) {
  // "Default" is what the box already contains, so offering it as a button
  // would be a button that does nothing. A kind whose only template is the
  // default therefore shows no bar at all.
  list = (list || []).filter((t) => String(t.name).toLowerCase() !== 'default');
  if (!list || !list.length) return '';
  return `<div class="templates">
    <span class="templates-label">Templates</span>
    ${list.map((t) => `<button type="button" class="tpl" data-body="${esc(t.body)}">${esc(t.name)}</button>`).join('')}
  </div>`;
}

/**
 * The day's schedule, kept by the communication officer. Rows are rewritten
 * wholesale into content/schedule.json on save, which is why the blank rows at
 * the bottom are how you add and the checkbox is how you remove — there is no
 * partial update that could drift out of step with the file.
 */
function scheduleBlock(day, tasks) {
  return panel('CH-30 / DAILY MISSION', `
    ${eyebrow(`Schedule · day ${dd(day)}`)}
    <p class="note" style="margin-bottom:12px">Times are habitat-local. Saving rewrites this day
    in <b>content/schedule.json</b> and sorts it into clock order.</p>
    <form method="post" action="/control/schedule">
      <input type="hidden" name="day" value="${day}">
      <div class="tw"><table>
        <thead><tr><th style="width:88px">Time</th><th>Task</th><th>Detail</th>
          <th style="width:52px">Del</th></tr></thead>
        <tbody>
        ${tasks.map((t, i) => `<tr>
          <td><input type="time" name="t${i}_time" value="${esc(t.time)}"></td>
          <td><input type="text" name="t${i}_label" value="${esc(t.label)}"></td>
          <td><input type="text" name="t${i}_detail" value="${esc(t.detail || '')}"></td>
          <td style="text-align:center"><input type="checkbox" name="t${i}_del"></td>
        </tr>`).join('')}
        ${[0, 1, 2].map((k) => `<tr>
          <td><input type="time" name="n${k}_time"></td>
          <td><input type="text" name="n${k}_label" placeholder="New task"></td>
          <td><input type="text" name="n${k}_detail"></td>
          <td></td>
        </tr>`).join('')}
        </tbody>
      </table></div>
      <div class="actions"><button class="primary">Save day ${dd(day)}</button></div>
    </form>`, 'mars-side');
}

/**
 * Calories consumed and steps taken, per day, kept by the health officer.
 * These are the only habitat figures counted by a person rather than sampled
 * by a sensor. A blank field records nothing for that day, which is not the
 * same as recording a zero.
 */
function crewFiguresBlock(day, figures) {
  const f = figures[String(day)] || {};
  return panel('CH-13 / CREW FIGURES', `
    ${eyebrow(`Crew totals · day ${dd(day)}`)}
    <p class="note" style="margin-bottom:12px">Totals across all three of them, plotted for the
    whole mission in the Habitat section of the landing page. Saving writes
    <b>content/crew-figures.json</b>. Leave a field blank to record nothing for that day.</p>
    <form method="post" action="/control/crew-figures">
      <input type="hidden" name="day" value="${day}">
      <div class="grid g2" style="gap:0 12px">
        <label class="f"><span>Calories consumed</span>
          <input type="number" min="0" name="calories" value="${f.calories ?? ''}"
            placeholder="kcal across the crew"></label>
        <label class="f"><span>Steps taken</span>
          <input type="number" min="0" name="steps" value="${f.steps ?? ''}"
            placeholder="steps inside the habitat"></label>
      </div>
      <div class="actions"><button class="primary">Save figures for day ${dd(day)}</button></div>
    </form>`, 'mars-side');
}

/**
 * The daily food plan, kept by the health officer. Water and power are set in
 * the file rather than here — the officer's concern is what the crew eat, not
 * what the galley draws — and they are preserved untouched when this saves.
 */
function mealsBlock(day, meals) {
  const SLOTS = [['BREAKFAST', 'Breakfast'], ['LUNCH', 'Lunch'],
                 ['DINNER', 'Dinner'], ['RATION', 'Ration']];
  const find = (slot) => meals.find((m) => m.slot === slot) || {};
  const kcal = meals.reduce((a, m) => a + (m.kcal || 0), 0);

  return panel('CH-32 / DAILY FOOD PLAN', `
    ${eyebrow(`Galley · day ${dd(day)}`)}
    <p class="note" style="margin-bottom:12px">Saving rewrites this day in
    <b>content/meals.json</b>. A slot left without a name is not served that day.</p>
    <form method="post" action="/control/meals">
      <input type="hidden" name="day" value="${day}">
      <div class="grid g2">
      ${SLOTS.map(([slot, label]) => {
        const m = find(slot);
        return `<div>
          <div class="eyebrow" style="margin-bottom:8px">${label}</div>
          <label class="f"><span>Name</span>
            <input type="text" name="${slot}_name" value="${esc(m.name || '')}"
              placeholder="${slot === 'RATION' ? 'Leave blank if none' : 'Dish'}"></label>
          <label class="f"><span>Components, one per line</span>
            <textarea name="${slot}_components" rows="3">${esc(m.components || '')}</textarea></label>
          <div class="grid g2" style="gap:0 8px">
            <label class="f"><span>kcal</span>
              <input type="number" name="${slot}_kcal" value="${m.kcal || ''}"></label>
            <label class="f"><span>Prep min</span>
              <input type="number" name="${slot}_prep" value="${m.prep_minutes || ''}"></label>
          </div>
          <label class="f"><span>Note (shown publicly)</span>
            <input type="text" name="${slot}_notes" value="${esc(m.notes || '')}"></label>
        </div>`;
      }).join('')}
      </div>
      <div class="kv" style="margin-top:6px"><dt>Day total</dt>
        <dd>${kcal} kcal offered across ${meals.length} slot${meals.length === 1 ? '' : 's'}</dd></div>
      <div class="actions"><button class="primary">Save food plan for day ${dd(day)}</button></div>
    </form>`, 'mars-side');
}

/** A stream of findings — science or health — filed against a day. */
function findingsBlock(kind, label, hint, day, notes, back, tpl) {
  const mine = notes.filter((n) => n.kind === kind);
  // A template named "Default" is loaded into the empty box, so the shape of
  // the report is already there when the officer arrives rather than waiting
  // behind a button they have to know to press.
  const preset = (tpl || []).find((t) => String(t.name).toLowerCase() === 'default');
  const rows = preset ? Math.max(6, preset.body.split('\n').length + 1) : 6;
  return panel(`CH-36 / ${kind}`, `
    ${eyebrow(label)}
    <p class="note" style="margin-bottom:10px">${hint}</p>
    <form method="post" action="/control/updates">
      <input type="hidden" name="day" value="${day}">
      <input type="hidden" name="kind" value="${kind}">
      <input type="hidden" name="back" value="${esc(back)}">
      ${templateBar(tpl)}
      <textarea name="body" rows="${rows}" required minlength="2">${esc(preset ? preset.body : '')}</textarea>
      <div class="actions"><button class="primary">File ${label.toLowerCase()}</button></div>
    </form>
    <hr>
    ${mine.length ? mine.map((n) => `<div class="row">
      <div class="t">${esc(n.posted_at.slice(11, 16))}</div>
      <div class="m"><b>${esc(n.body)}</b></div>
      <form method="post" action="/control/updates/delete">
        <input type="hidden" name="day" value="${day}">
        <input type="hidden" name="back" value="${esc(back)}">
        <input type="hidden" name="body" value="${esc(n.body)}">
        <button class="ghost danger" style="padding:6px 10px;min-height:0">Remove</button></form>
    </div>`).join('') : '<div class="empty">Nothing filed for this day</div>'}`, 'mars-side');
}

/* ==================================================================== LOGIN */

function login(ctx, error) {
  const body = `<div style="max-width:400px;margin:12vh auto 0">
    ${panel('CH-99 / ACCESS', `
      ${eyebrow('Mission control')}
      <h1 style="font-size:26px">Sign in</h1>
      ${error ? `<div class="flash err">${esc(error)}</div>` : ''}
      <form method="post" action="/control/login">
        <label class="f"><span>Operator</span>
          <input type="text" name="username" autocomplete="username" autofocus required></label>
        <label class="f"><span>Passphrase</span>
          <input type="password" name="password" autocomplete="current-password" required></label>
        <button type="submit" class="primary">Sign in</button>
      </form>
      <p class="note" style="margin:18px 0 0">The same account opens the habitat terminal at
      <a href="/log">/log</a> and the archive.</p>`)}
  </div>`;
  return L.page({ title: 'Sign in', ctx, body, current: '', bodyClass: 'control' });
}

/* ================================================================= MESSAGES */

const stateBadge = (m) => ({
  PENDING_APPROVAL: '<span class="badge warn">Awaiting review</span>',
  APPROVED: '<span class="badge">Approved, no reply yet</span>',
  RESPONSE: '<span class="badge">Reply drafted</span>',
  PUBLISHED: '<span class="badge ok">Published</span>',
  REJECTED: '<span class="badge bad">Rejected</span>',
}[m.state] || `<span class="badge">${esc(m.state.replace(/_/g, ' '))}</span>`);

/**
 * Reviewing and replying are one action. A message arrives, you read it, you
 * write the answer and you send it — approving without a reply was a step that
 * only ever created a queue of half-finished exchanges.
 */
function messageCard(m, crew) {
  const tags = (m.tags || '').split(',').filter(Boolean);
  const del = `<form method="post" action="/control/${m.id}/delete"
      data-confirm="Delete message ${dd(m.id)} permanently? This cannot be undone.">
      <button class="ghost danger">Delete</button></form>`;

  return `<article class="panel ${m.state === 'PENDING_APPROVAL' ? 'mars-side' : ''}" id="m${m.id}">
    <span class="chan">MSG ${String(m.id).padStart(5, '0')}</span>
    <div class="msg-head" style="padding:0 0 12px;border-bottom:1px solid var(--rule)">
      <span class="cs">${esc(m.callsign)}</span>
      ${tags.map((t) => `<span class="badge earth">${esc(t)}</span>`).join('')}
      ${stateBadge(m)}
      <span style="margin-left:auto">Day ${dd(m.mission_day)} ·
        ${esc(m.submitted_at.slice(0, 16).replace('T', ' '))} UTC ·
        crossed ${orbital.formatLightTime(m.light_seconds)}</span>
    </div>

    <p class="quoted">${esc(m.body)}</p>

    ${m.state === 'REJECTED' ? `
      <div class="actions">
        <form method="post" action="/control/${m.id}/restore"><button class="ghost">Restore to the queue</button></form>
        <div class="spacer"></div>${del}
      </div>`
    : `
      <form method="post" action="/control/${m.id}/reply">
        <label class="f"><span>Reply from the habitat</span>
          <textarea name="body" rows="3" required minlength="2"
            placeholder="Answer as the crew. Sending publishes the exchange.">${esc(m.response_body || '')}</textarea></label>
        <div class="actions">
          <select name="crew_id" aria-label="Reply attributed to">
            <option value="">Mars habitat</option>
            ${crew.map((c) => `<option value="${c.id}"${m.crew_id === c.id ? ' selected' : ''}>${esc(c.designation)}</option>`).join('')}
          </select>
          <button name="action" value="publish" class="primary">${
            m.state === 'PUBLISHED' ? 'Update the published reply' : 'Reply and publish'}</button>
          <button name="action" value="draft" class="ghost">Save without publishing</button>
        </div>
      </form>
      <div class="actions">
        ${m.state === 'PUBLISHED' ? `<form method="post" action="/control/${m.id}/unpublish">
          <button class="ghost">Unpublish</button></form>` : ''}
        ${m.state !== 'PUBLISHED' ? `<form method="post" action="/control/${m.id}/reject">
          <button class="ghost">Reject without replying</button></form>` : ''}
        <div class="spacer"></div>${del}
      </div>`}
  </article>`;
}

/* ============================================== COMMUNICATION OFFICER TAB */

/**
 * The communication officer answers Earth, so the message queue lives here
 * rather than in a section of its own — replying is that officer's work.
 */
function commsTab(ctx, { officer, list, crew, counts, filter, day, entry, tasks, f, user, content, totalDays, tpl }) {
  const FILTERS = [
    ['pending', 'Awaiting reply', counts.pending + counts.awaitingResponse],
    ['published', 'Published', counts.published],
    ['rejected', 'Rejected', counts.rejected],
    ['all', 'Everything', counts.total],
  ];
  const waiting = counts.pending + counts.awaitingResponse;
  // The day's own work comes first — schedule, state, blog — and the queue sits
  // at the foot, so the officer files the day before answering Earth rather
  // than starting in the inbox and never leaving it.
  const inner = `${flash(f)}
    <p class="note" style="max-width:64ch;margin-bottom:var(--gutter)">
      ${esc(officer.role)}. Keep the day's schedule, file your state and blog, then work the
      queue at the foot of the page.${waiting
        ? ` <b><a href="#messages">${waiting} message${waiting === 1 ? '' : 's'} waiting</a></b>.` : ''}</p>

    ${dayPicker('/control', day, totalDays)}
    ${scheduleBlock(day, tasks)}
    <div class="grid g2">
      ${moodBlock(officer)}
      ${blogBlock({ ...officer, tab: '/control' }, day, entry, tpl.BLOG)}
    </div>

    <div id="messages">
    ${panel('CH-09 / MESSAGES', `
      ${eyebrow('Messages from Earth')}
      <nav class="filters" style="margin:0 0 var(--gutter)">
        ${FILTERS.map(([k, label, n]) => `<a href="/control?show=${k}${day ? `&day=${day}` : ''}#messages"
          class="${filter === k ? 'on' : ''}">${label}<b>${n}</b></a>`).join('')}
      </nav>
      ${list.length ? list.map((m) => messageCard(m, crew)).join('')
        : '<div class="empty">Nothing in this view</div>'}`, 'mars-side')}
    </div>`;
  return shell(ctx, '/control', inner, 'Communication officer', user, content);
}

/* ===================================================== SCIENCE OFFICER TAB */

function scienceTab(ctx, { officer, day, entry, notes, f, user, content, totalDays, tpl }) {
  const inner = `${flash(f)}
    <p class="note" style="max-width:64ch;margin-bottom:14px">${esc(officer.role)}.</p>
    ${dayPicker('/control/science', day, totalDays)}
    <div class="grid g2">
      ${findingsBlock('SCIENCE', 'Daily science findings',
        'Samples, measurements, the greenhouse, anything the habitat did that was worth recording.',
        day, notes, '/control/science', tpl.SCIENCE)}
      ${blogBlock({ ...officer, tab: '/control/science' }, day, entry, tpl.BLOG)}
    </div>
    ${moodBlock(officer)}`;
  return shell(ctx, '/control/science', inner, 'Science officer', user, content);
}

/* ====================================================== HEALTH OFFICER TAB */

function healthTab(ctx, { officer, day, entry, notes, meals, figures, f, user, content, totalDays, tpl }) {
  const inner = `${flash(f)}
    <p class="note" style="max-width:64ch;margin-bottom:14px">${esc(officer.role)}.</p>
    ${dayPicker('/control/health', day, totalDays)}
    <div class="grid g2">
      ${findingsBlock('HEALTH', 'Daily health activities',
        'The morning workout, the evening wellbeing activity, and anything else worth recording. The form is prefilled; edit the template in content/templates.json to change it.',
        day, notes, '/control/health', tpl.HEALTH)}
      ${blogBlock({ ...officer, tab: '/control/health' }, day, entry, tpl.BLOG)}
    </div>
    ${crewFiguresBlock(day, figures)}
    ${mealsBlock(day, meals)}
    ${moodBlock(officer)}`;
  return shell(ctx, '/control/health', inner, 'Health officer', user, content);
}

/* ============================================================= HABITAT TAB */

function habitatTab(ctx, { day, items, notes, f, user, content, totalDays, tpl }) {
  const inner = `${flash(f)}
    <p class="note" style="max-width:64ch;margin-bottom:14px">The habitat itself: what is left,
    and anything that happened which does not belong to one officer. These write into
    <b>content/inventory-levels.json</b> and <b>content/notes.json</b>.</p>
    ${dayPicker('/control/habitat', day, totalDays)}

    ${panel('CH-34 / INVENTORY', `
      ${eyebrow(`Levels at the end of day ${dd(day)}`)}
      <p class="note" style="margin-bottom:12px">Only change what actually moved — every other
      item carries forward on its own. A blank field means "carry forward".</p>
      <form method="post" action="/control/inventory">
        <input type="hidden" name="day" value="${day}">
        <div class="tw"><table>
          <thead><tr><th>Resource</th><th>Yesterday</th><th>Quantity</th><th>Use per day</th></tr></thead>
          <tbody>${items.map((i) => `<tr>
            <th>${esc(i.label)} <span style="color:var(--faint)">${esc(i.unit)}</span></th>
            <td class="n" style="color:var(--faint)">${i.carried == null ? '—' : i.carried}</td>
            <td><input type="number" step="0.1" name="q_${esc(i.key)}" value="${i.set ? i.quantity : ''}"
                 placeholder="${i.quantity}"></td>
            <td><input type="number" step="0.1" name="c_${esc(i.key)}" value="${i.set ? i.consumption : ''}"
                 placeholder="${i.consumption}"></td>
          </tr>`).join('')}</tbody>
        </table></div>
        <label class="f" style="margin-top:14px"><span>Why (optional, kept in the file)</span>
          <input type="text" name="why" placeholder="Water allowance cut after the loop shortfall"></label>
        <div class="actions">
          <button class="primary">Save levels for day ${dd(day)}</button>
          <div class="spacer"></div>
        </div>
      </form>
      <form method="post" action="/control/inventory/clear" class="actions">
        <input type="hidden" name="day" value="${day}">
        <button class="ghost">Clear this day's override</button></form>`, 'mars-side')}

    <div class="grid g2">
      ${findingsBlock('UPDATE', 'Daily mission update',
        'The general log for the day — anything not owned by science or health.',
        day, notes, '/control/habitat', tpl.UPDATE)}
      ${panel('CH-36 / OTHER', `
        ${eyebrow('Anomaly or broadcast')}
        <p class="note" style="margin-bottom:10px">An anomaly is something that went wrong. A
        broadcast is a short announcement.</p>
        <form method="post" action="/control/updates">
          <input type="hidden" name="day" value="${day}">
          <input type="hidden" name="back" value="/control/habitat">
          <label class="f"><span>Kind</span>
            <select name="kind"><option value="ANOMALY">Anomaly</option>
              <option value="BROADCAST">Broadcast</option></select></label>
          ${templateBar(tpl.ANOMALY)}
          <textarea name="body" rows="6" required minlength="2"></textarea>
          <div class="actions"><button class="primary">File it</button></div>
        </form>
        <hr>
        ${notes.filter((n) => ['ANOMALY', 'BROADCAST'].includes(n.kind)).map((n) => `<div class="row">
          <div class="t">${esc(n.kind.slice(0, 4))}</div>
          <div class="m"><b>${esc(n.body)}</b></div>
          <form method="post" action="/control/updates/delete">
            <input type="hidden" name="day" value="${day}">
            <input type="hidden" name="back" value="/control/habitat">
            <input type="hidden" name="body" value="${esc(n.body)}">
            <button class="ghost danger" style="padding:6px 10px;min-height:0">Remove</button></form>
        </div>`).join('') || '<div class="empty">Nothing filed</div>'}`, 'mars-side')}
    </div>`;
  return shell(ctx, '/control/habitat', inner, 'Habitat', user, content);
}

module.exports = { login, commsTab, scienceTab, healthTab, habitatTab };
