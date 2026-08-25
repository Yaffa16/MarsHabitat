'use strict';
const L = require('../layout');
const { isPlaceholder, placeholderCue } = require('../../lib/content');
const mediaLib = require('../../lib/media');
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
  ['messages', 'Messages'],
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

/** What the entry composer needs to know about the media already on an
 *  officer's day: enough to show each one and caption it. */
const editorMedia = (list, body = '', otherBodies = []) => {
  // media placed in another text of the same officer and day (the entry, a
  // report) belongs to that text, not to this one
  const elsewhere = new Set(otherBodies.flatMap((b) => [...String(b || '').matchAll(/\[media:(\d+)\]/g)].map((m) => Number(m[1]))));
  const items = (list || []).filter((m) => !m.hidden && !elsewhere.has(m.id));
  // anything placed in the text from elsewhere (another day) is known too
  for (const [, id] of String(body || '').matchAll(/\[media:(\d+)\]/g)) {
    if (!items.some((m) => m.id === Number(id))) { const m = mediaLib.get(id); if (m && !m.hidden) items.push(m); }
  }
  return esc(JSON.stringify(items.map((m) => ({
    id: m.id, kind: m.kind, thumb: mediaLib.thumbUrl(m), url: mediaLib.fileUrl(m), page: mediaLib.pageUrl(m),
    caption: m.caption, filename: m.filename }))));
};

/** That officer's Daily Blog for the chosen day, as a composer in place. */
function blogBlock(c, tab, day, entry) {
  const live = entry && !isPlaceholder(entry.body);
  return panel('CH-50 / DAILY BLOG', `
    <h2 class="block-title">Daily Blog</h2>
    ${eyebrow(`${c.designation} · day ${dd(day)}`)}
    <form method="post" action="/control/logbook" enctype="multipart/form-data" data-attach-media data-crew-id="${c.id}"
          data-media="${editorMedia(c.media, entry ? entry.body : '', c.otherBodies || [])}">
      <input type="hidden" name="day" value="${day}">
      <input type="hidden" name="designation" value="${esc(c.designation)}">
      <input type="hidden" name="back" value="${tab}">
      <textarea name="body" rows="10"
        placeholder="${esc(entry && isPlaceholder(entry.body) ? placeholderCue(entry.body) : 'What happened today, in their voice.')}">${esc(live ? entry.body : '')}</textarea>
      ${attachRow()}
      <div class="actions"><button class="primary">${live ? 'Update Daily Blog' : 'Publish Daily Blog'}</button>
        ${live ? '<button type="submit" class="ghost" name="action" value="clear" title="Take it down and put the placeholder back">Clear</button>' : ''}
        <span class="note">${live ? 'Live on the public crew log.' : 'Goes straight to the crew log the moment it is saved — any day, mission started or not.'}</span></div>
    </form>`, 'mars-side');
}

/** An officer's daily report — science findings, health activities — as the same composer. */
function reportBlock(c, kindKey, label, hint, day, tpl, tab) {
  const live = !!(c.report && c.report.trim());
  const preset = (tpl || []).find((t) => String(t.name).toLowerCase() === 'default');
  return panel(`CH-36 / ${kindKey.toUpperCase()}`, `
    ${eyebrow(`${label} · day ${dd(day)}`)}
    <p class="note" style="margin-bottom:10px">${hint}</p>
    <form method="post" action="/control/report" enctype="multipart/form-data" data-attach-media data-crew-id="${c.id}"
          data-media="${editorMedia(c.media, c.report || '', c.reportOtherBodies || [])}">
      <input type="hidden" name="day" value="${day}">
      <input type="hidden" name="kind" value="${esc(kindKey)}">
      <input type="hidden" name="crew_id" value="${c.id}">
      <input type="hidden" name="back" value="${tab}">
      <textarea name="body" rows="10" placeholder="${esc(label)} for the day…">${esc(live ? c.report : (preset ? preset.body : ''))}</textarea>
      ${attachRow()}
      <div class="actions"><button class="primary">${live ? `Update ${label.toLowerCase()}` : `Publish ${label.toLowerCase()}`}</button>
        ${live ? '<button type="submit" class="ghost" name="action" value="clear" title="Take it down">Clear</button>' : ''}
        <span class="note">${live ? 'Live on the station, in the day’s mission notes.' : 'Appears in the day’s mission notes the moment it is saved.'}</span></div>
    </form>`, 'mars-side');
}

/** The photographs / video / sound that go with an entry. */
function attachRow() {
  // Without the composer (no script): a picker and a caption; files are set at the end of the text.
  return `<div class="attach">
    <label class="attach-pick"><input type="file" name="file" multiple accept="${esc(mediaLib.ACCEPT)}">
      <b>＋ Photographs, video, sound</b><span class="attach-chosen">none chosen</span></label>
    <input type="text" name="media_caption" maxlength="2000" placeholder="Caption for the files (optional)">
    <span class="attach-hint">Files are set at the end of the entry as lines like <code>[media:12]</code>; move a line to move the picture.</span>
    <div class="media-progress attach-progress" hidden></div>
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


/* ================================================================== THE PAGE */

/**
 * `model` carries everything for every tab: the queue, the chosen day, each
 * officer with their entry and mood, the day's tasks, meals, notes, figures
 * and inventory. One request renders the whole desk.
 */
function page(ctx, model) {
  const { user, f, content, show, tab, day, totalDays, tpl,
          list, crew, counts, officers, tasks, meals, notes, figures, items,
          media: mediaItems = [], mediaCounts = { total: 0, bytes: 0 }, mediaAccept = '', mediaMaxMb = 0, filter = 'all' } = model;

  const dayPicker = `<nav class="filters daypick" aria-label="Mission day">
    ${Array.from({ length: totalDays }, (_, i) => i + 1).map((n) =>
      `<a href="${tabUrl(tab, n)}" class="${n === day ? 'on' : ''}" data-day="${n}">D${dd(n)}</a>`).join('')}
  </nav>`;

  const panes = {
    messages: queue({ list, crew, counts, show }),
    comms: `
      <p class="note tab-note">${esc(officers.comms.role)}.</p>
      <div class="grid g2">
        ${blogBlock(officers.comms, 'comms', day, officers.comms.entry)}
        ${moodBlock(officers.comms)}
      </div>`,
    science: `
      <p class="note tab-note">${esc(officers.science.role)}.</p>
      <div class="grid g2">
        ${blogBlock(officers.science, 'science', day, officers.science.entry)}
        ${reportBlock(officers.science, 'science', 'Daily science findings',
          'Samples, measurements, the greenhouse, anything the habitat did that was worth recording.', day, tpl.SCIENCE, 'science')}
      </div>
      ${moodBlock(officers.science)}`,
    health: `
      <p class="note tab-note">${esc(officers.health.role)}.</p>
      <div class="grid g2">
        ${blogBlock(officers.health, 'health', day, officers.health.entry)}
        ${reportBlock(officers.health, 'health', 'Daily health activities',
          'The morning workout, the evening wellbeing activity, and anything else worth recording. The form is prefilled; edit the default text in content/templates.json to change it.', day, tpl.HEALTH, 'health')}
      </div>
      ${crewFiguresBlock(day, figures)}
      ${moodBlock(officers.health)}`,
    habitat: `
      <p class="note tab-note">The habitat itself: the day's schedule, the food, and what is left.</p>
      ${scheduleBlock(day, tasks)}
      ${mealsBlock(day, meals)}
      ${inventoryBlock(day, items)}`,
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

  <!-- The top bar: messages from Earth first, then each officer's work, and
       the habitat. -->
  <div class="work" id="work">
    <nav class="tabs officer-bar" id="tabs" role="tablist" aria-label="Officer">
      ${TABS.map(([k, label]) => `<a href="${tabUrl(k, day)}" role="tab" data-tab="${k}"
        class="${k === tab ? 'on' : ''}" aria-selected="${k === tab}">${label}${
          k === 'messages' && counts.pending + counts.awaitingResponse
            ? `<b class="waiting">${counts.pending + counts.awaitingResponse}</b>` : ''}</a>`).join('')}
    </nav>
    <div class="daypick-wrap"${tab === 'messages' ? ' hidden' : ''}><div class="sechead" style="margin-top:8px"><span class="secsub">Mission day · edits are live on the station within seconds</span></div>${dayPicker}</div>
    ${TABS.map(([k]) => `<div class="tab-pane ${k === tab ? 'on' : ''}" data-pane="${k}" role="tabpanel"
      id="tab-${k}">${panes[k]}</div>`).join('')}
  </div>`;

  return L.page({
    title: 'Mission control', ctx, body, current: '',
    bodyClass: 'control', scripts: ['/control.js', '/media-upload.js', '/entry-editor.js'],
  });
}

module.exports = { login, page, TABS };
