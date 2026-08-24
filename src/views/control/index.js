'use strict';
const L = require('../layout');
const { esc, panel, eyebrow } = L;
const orbital = require('../../lib/orbital');
const mood = require('../../lib/mood');

const dd = (n) => String(n).padStart(3, '0');

/**
 * Mission control is one page. The top bar chooses the officer; the message
 * queue sits inside the communication officer's tab, first, because
 * answering Earth is the job that cannot wait; everything else the crew and
 * the habitat need edited lives underneath, organised by who does the work —
 * one tab per officer, plus the habitat — and switched without a page load.
 *
 * Every tab, every officer's editing panels and the queue are in the same
 * document, so a save returns you to the tab and day you were on, and a
 * reply returns you to the queue.
 */
const TABS = [
  ['comms', 'Communication officer'],
  ['science', 'Science officer'],
  ['health', 'Health officer'],
  ['habitat', 'Habitat'],
];

const tabUrl = (tab, day, extra = '') => `/control?tab=${tab}&day=${day}${extra}#work`;

const flash = (f) => f ? `<div class="flash ${f.err ? 'err' : ''}">${esc(f.msg)}</div>` : '';

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
      <p class="note" style="margin:18px 0 0">One account. It opens mission control and the archive.</p>`)}
  </div>`;
  return L.page({ title: 'Sign in', ctx, body, current: '', bodyClass: 'control' });
}

/* ================================================================= MESSAGES */

const stateBadge = (m) => ({
  PENDING_APPROVAL: '<span class="badge warn">Awaiting reply</span>',
  APPROVED: '<span class="badge">Approved, no reply yet</span>',
  RESPONSE: '<span class="badge">Reply drafted</span>',
  PUBLISHED: '<span class="badge ok">Published</span>',
  REJECTED: '<span class="badge bad">Rejected</span>',
}[m.state] || `<span class="badge">${esc(m.state.replace(/_/g, ' '))}</span>`);

/**
 * One message, with its reply box directly beneath it. Reading and replying
 * are one motion: the message, the box, one orange button. Everything else —
 * attribution, saving a draft, rejecting, deleting — is on the same row but
 * quieter, so the eye lands on the thing to do.
 */
function messageCard(m, crew, show) {
  const tags = (m.tags || '').split(',').filter(Boolean);
  const q = `?show=${show}`;
  const small = (action, label, cls = 'ghost', confirm = '') =>
    `<form method="post" action="/control/${m.id}/${action}${q}"${confirm ? ` data-confirm="${esc(confirm)}"` : ''}>
      <button class="${cls} small">${label}</button></form>`;
  const pending = m.state === 'PENDING_APPROVAL' || m.state === 'APPROVED' || m.state === 'RESPONSE';

  return `<article class="msg ${pending ? 'pending' : ''} ${m.state === 'REJECTED' ? 'rejected' : ''}" id="m${m.id}">
    <div class="msg-top">
      <span class="cs">${esc(m.callsign)}</span>
      ${tags.map((t) => `<span class="badge earth">${esc(t)}</span>`).join('')}
      ${stateBadge(m)}
      <span class="msg-meta">MSG ${String(m.id).padStart(5, '0')} · day ${dd(m.mission_day)} ·
        ${esc(m.submitted_at.slice(11, 16))} UTC · crossed ${orbital.formatLightTime(m.light_seconds)}</span>
    </div>
    <p class="quoted">${esc(m.body)}</p>
    ${m.state === 'REJECTED' ? `
      <div class="msg-actions">
        ${small('restore', 'Restore to the queue')}
        <div class="spacer"></div>
        ${small('delete', 'Delete', 'ghost danger', `Delete message ${dd(m.id)} permanently? This cannot be undone.`)}
      </div>`
    : `
      <form method="post" action="/control/${m.id}/reply${q}" class="reply">
        <textarea name="body" rows="2" required minlength="2" class="reply-box"
          aria-label="Reply from the habitat"
          placeholder="Answer as the crew. Ctrl+Enter sends and publishes.">${esc(m.response_body || '')}</textarea>
        <div class="reply-bar">
          <select name="crew_id" aria-label="Reply attributed to">
            <option value="">Mars habitat</option>
            ${crew.map((c) => `<option value="${c.id}"${m.crew_id === c.id ? ' selected' : ''}>${esc(c.designation)}</option>`).join('')}
          </select>
          <button name="action" value="publish" class="primary">${
            m.state === 'PUBLISHED' ? 'Update reply' : 'Reply & publish'}</button>
          <button name="action" value="draft" class="ghost small">Save draft</button>
        </div>
      </form>
      <div class="msg-actions">
        ${m.state === 'PUBLISHED' ? small('unpublish', 'Unpublish') : small('reject', 'Reject without replying')}
        <div class="spacer"></div>
        ${small('delete', 'Delete', 'ghost danger', `Delete message ${dd(m.id)} permanently? This cannot be undone.`)}
      </div>`}
  </article>`;
}

function queue({ list, crew, counts, show }) {
  const waiting = counts.pending + counts.awaitingResponse;
  const FILTERS = [
    ['pending', 'Awaiting reply', waiting],
    ['published', 'Published', counts.published],
    ['rejected', 'Rejected', counts.rejected || 0],
    ['all', 'Everything', counts.total],
  ];
  return `<section class="queue" id="queue" data-waiting="${waiting}">
    <div class="sechead">
      <h2 class="bigsec">Messages from Earth</h2>
      <span class="secsub">${waiting ? `<b class="waiting">${waiting}</b> WAITING FOR A REPLY` : 'NOTHING WAITING'}</span>
    </div>
    <nav class="filters" style="margin-bottom:12px">
      ${FILTERS.map(([k, label, n]) => `<a href="/control?show=${k}#queue"
        class="${show === k ? 'on' : ''}">${label}<b>${n}</b></a>`).join('')}
    </nav>
    <div class="flash queue-new" id="queue-new" hidden>
      <span id="queue-new-text">New messages have arrived.</span>
      <a class="btn" href="/control?show=pending#queue">Show them</a>
    </div>
    ${list.length ? list.map((m) => messageCard(m, crew, show)).join('')
      : `<div class="empty">${show === 'pending' ? 'Nothing waiting — every message has been answered' : 'Nothing in this view'}</div>`}
  </section>`;
}

/* ============================================================= DAY CONTENT */

/** The mood sliders for one officer, with the public sentence live. */
function moodBlock(c) {
  const t = mood.translate(c.mood);
  return panel('CH-12 / MOOD', `
    ${eyebrow(`${c.designation} · state`)}
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

/** That officer's diary entry for the chosen day. */
function blogBlock(c, tab, day, entry, tpl) {
  return panel('CH-50 / DAILY BLOG', `
    ${eyebrow(`${c.designation} · day ${dd(day)}`)}
    <form method="post" action="/control/logbook">
      <input type="hidden" name="day" value="${day}">
      <input type="hidden" name="designation" value="${esc(c.designation)}">
      <input type="hidden" name="back" value="${tab}">
      ${templateBar(tpl)}
      <textarea name="body" rows="10"
        placeholder="What happened today, in their voice.">${esc(entry ? entry.body : '')}</textarea>
      <div class="actions"><button class="primary">Save blog entry</button>
        <span class="note">Goes straight to the public crew log.</span></div>
    </form>`, 'mars-side');
}

/**
 * Template buttons. Pressing one drops a skeleton into the field below it.
 * They only fill an empty box — an entry already being written is never
 * overwritten by a stray press.
 */
function templateBar(list) {
  list = (list || []).filter((t) => String(t.name).toLowerCase() !== 'default');
  if (!list || !list.length) return '';
  return `<div class="templates">
    <span class="templates-label">Templates</span>
    ${list.map((t) => `<button type="button" class="tpl" data-body="${esc(t.body)}">${esc(t.name)}</button>`).join('')}
  </div>`;
}

/** The day's schedule, kept by the communication officer. */
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

/** Calories and steps, the only habitat figures counted by a person. */
function crewFiguresBlock(day, figures) {
  const f = figures[String(day)] || {};
  return panel('CH-13 / CREW FIGURES', `
    ${eyebrow(`Crew totals · day ${dd(day)}`)}
    <p class="note" style="margin-bottom:12px">Totals across all three of them, plotted on the
    landing page. Saving writes <b>content/crew-figures.json</b>. Leave a field blank to record
    nothing for that day.</p>
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

/** The daily food plan, kept by the health officer. */
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

/** A stream of findings — science, health or the general update — for a day. */
function findingsBlock(kind, label, hint, day, notes, tab, tpl) {
  const mine = notes.filter((n) => n.kind === kind);
  const preset = (tpl || []).find((t) => String(t.name).toLowerCase() === 'default');
  const rows = preset ? Math.max(6, preset.body.split('\n').length + 1) : 6;
  return panel(`CH-36 / ${kind}`, `
    ${eyebrow(label)}
    <p class="note" style="margin-bottom:10px">${hint}</p>
    <form method="post" action="/control/updates">
      <input type="hidden" name="day" value="${day}">
      <input type="hidden" name="kind" value="${kind}">
      <input type="hidden" name="back" value="${tab}">
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
        <input type="hidden" name="back" value="${tab}">
        <input type="hidden" name="body" value="${esc(n.body)}">
        <button class="ghost danger small">Remove</button></form>
    </div>`).join('') : '<div class="empty">Nothing filed for this day</div>'}`, 'mars-side');
}

function inventoryBlock(day, items) {
  return panel('CH-34 / INVENTORY', `
    ${eyebrow(`Levels at the end of day ${dd(day)}`)}
    <p class="note" style="margin-bottom:12px">Only change what actually moved — every other
    item carries forward on its own. A blank field means "carry forward". Writes
    <b>content/inventory-levels.json</b>.</p>
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
      <button class="ghost small">Clear this day's override</button></form>`, 'mars-side');
}

function anomalyBlock(day, notes, tpl) {
  return panel('CH-36 / OTHER', `
    ${eyebrow('Anomaly or broadcast')}
    <p class="note" style="margin-bottom:10px">An anomaly is something that went wrong. A
    broadcast is a short announcement.</p>
    <form method="post" action="/control/updates">
      <input type="hidden" name="day" value="${day}">
      <input type="hidden" name="back" value="habitat">
      <label class="f"><span>Kind</span>
        <select name="kind"><option value="ANOMALY">Anomaly</option>
          <option value="BROADCAST">Broadcast</option></select></label>
      ${templateBar(tpl)}
      <textarea name="body" rows="6" required minlength="2"></textarea>
      <div class="actions"><button class="primary">File it</button></div>
    </form>
    <hr>
    ${notes.filter((n) => ['ANOMALY', 'BROADCAST'].includes(n.kind)).map((n) => `<div class="row">
      <div class="t">${esc(n.kind.slice(0, 4))}</div>
      <div class="m"><b>${esc(n.body)}</b></div>
      <form method="post" action="/control/updates/delete">
        <input type="hidden" name="day" value="${day}">
        <input type="hidden" name="back" value="habitat">
        <input type="hidden" name="body" value="${esc(n.body)}">
        <button class="ghost danger small">Remove</button></form>
    </div>`).join('') || '<div class="empty">Nothing filed</div>'}`, 'mars-side');
}

/* ================================================================== THE PAGE */

/**
 * `model` carries everything for every tab: the queue, the chosen day, each
 * officer with their entry and mood, the day's tasks, meals, notes, figures
 * and inventory. One request renders the whole desk.
 */
function page(ctx, model) {
  const { user, f, content, show, tab, day, totalDays, tpl,
          list, crew, counts, officers, tasks, meals, notes, figures, items } = model;

  const dayPicker = `<nav class="filters daypick" aria-label="Mission day">
    ${Array.from({ length: totalDays }, (_, i) => i + 1).map((n) =>
      `<a href="${tabUrl(tab, n)}" class="${n === day ? 'on' : ''}" data-day="${n}">D${dd(n)}</a>`).join('')}
  </nav>`;

  const panes = {
    comms: `
      ${queue({ list, crew, counts, show })}
      <div class="sechead">
        <h2 class="bigsec">The day's work</h2>
        <span class="secsub">${esc(officers.comms.role)}</span>
      </div>
      ${scheduleBlock(day, tasks)}
      <div class="grid g2">
        ${moodBlock(officers.comms)}
        ${blogBlock(officers.comms, 'comms', day, officers.comms.entry, tpl.BLOG)}
      </div>`,
    science: `
      <p class="note tab-note">${esc(officers.science.role)}.</p>
      <div class="grid g2">
        ${findingsBlock('SCIENCE', 'Daily science findings',
          'Samples, measurements, the greenhouse, anything the habitat did that was worth recording.',
          day, notes, 'science', tpl.SCIENCE)}
        ${blogBlock(officers.science, 'science', day, officers.science.entry, tpl.BLOG)}
      </div>
      ${moodBlock(officers.science)}`,
    health: `
      <p class="note tab-note">${esc(officers.health.role)}.</p>
      <div class="grid g2">
        ${findingsBlock('HEALTH', 'Daily health activities',
          'The morning workout, the evening wellbeing activity, and anything else worth recording. The form is prefilled; edit the template in content/templates.json to change it.',
          day, notes, 'health', tpl.HEALTH)}
        ${blogBlock(officers.health, 'health', day, officers.health.entry, tpl.BLOG)}
      </div>
      ${crewFiguresBlock(day, figures)}
      ${mealsBlock(day, meals)}
      ${moodBlock(officers.health)}`,
    habitat: `
      <p class="note tab-note">The habitat itself: what is left, and anything that happened which
        does not belong to one officer.</p>
      ${inventoryBlock(day, items)}
      <div class="grid g2">
        ${findingsBlock('UPDATE', 'Daily mission update',
          'The general log for the day — anything not owned by science or health.',
          day, notes, 'habitat', tpl.UPDATE)}
        ${anomalyBlock(day, notes, tpl.ANOMALY)}
      </div>`,
  };

  const body = `
  <div style="padding:22px 0 4px">
    <div class="eyebrow">Mission control · ${esc(user.username)} ·
      day ${dd(ctx.mission.clampedDay)} · ${esc(ctx.mission.venueTime)} habitat time</div>
    <div class="actions" style="margin-bottom:8px">
      <h1 style="margin:0">Mission control</h1>
      <div class="spacer"></div>
      <a class="btn" href="/archive">Archive</a>
      <a class="btn" href="/archive/export.md">Download record</a>
      <a class="btn" href="/">Public station</a>
      <form method="post" action="/control/logout"><button class="ghost">Sign out</button></form>
    </div>
  </div>

  ${flash(f)}
  ${content && !content.ok ? `<div class="flash err">
    Content files have a problem — the site is serving the last good version.<br>
    ${content.errors.map((e) => esc(e)).join('<br>')}</div>` : ''}

  <!-- The top bar chooses the officer. Messages from Earth are the
       communication officer's, so the queue lives in that tab and nowhere
       else; the other tabs carry only their own officer's work. -->
  <div class="work" id="work">
    <nav class="tabs officer-bar" id="tabs" role="tablist" aria-label="Officer">
      ${TABS.map(([k, label]) => `<a href="${tabUrl(k, day)}" role="tab" data-tab="${k}"
        class="${k === tab ? 'on' : ''}" aria-selected="${k === tab}">${label}${
          k === 'comms' && counts.pending + counts.awaitingResponse
            ? `<b class="waiting">${counts.pending + counts.awaitingResponse}</b>` : ''}</a>`).join('')}
    </nav>
    <div class="sechead" style="margin-top:8px">
      <span class="secsub">MISSION DAY · EDITS WRITE STRAIGHT INTO content/ · LIVE ON THE STATION WITHIN SECONDS</span>
    </div>
    ${dayPicker}
    ${TABS.map(([k]) => `<div class="tab-pane ${k === tab ? 'on' : ''}" data-pane="${k}" role="tabpanel"
      id="tab-${k}">${panes[k]}</div>`).join('')}
  </div>`;

  return L.page({
    title: 'Mission control', ctx, body, current: '',
    bodyClass: 'control', scripts: ['/control.js'],
  });
}

module.exports = { login, page, TABS };
