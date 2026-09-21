'use strict';
const L = require('../layout');
const { isPlaceholder, placeholderCue } = require('../../lib/content');
const mediaLib = require('../../lib/media');
const { esc, panel, eyebrow } = L;
const orbital = require('../../lib/orbital');
const mood = require('../../lib/mood');
const missionLib = require('../../lib/mission');

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
        ${esc(m.submitted_at.slice(11, 16))} UTC</span>
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
        <label class="reply-label" for="reply-${m.id}">Reply from the habitat</label>
        <textarea name="body" id="reply-${m.id}" rows="4" required minlength="2" class="reply-box"
          placeholder="Answer as the crew. Ctrl+Enter sends and publishes.">${esc(m.response_body || '')}</textarea>
        <div class="reply-bar">
          <select name="crew_id" aria-label="Reply attributed to">
            <option value="">Mars habitat</option>
            ${crew.map((c) => `<option value="${c.id}"${m.crew_id === c.id ? ' selected' : ''}>${esc(c.designation)}</option>`).join('')}
          </select>
          <button name="action" value="publish" class="primary">${
            m.state === 'PUBLISHED' ? 'Update reply' : 'Reply & publish'}</button>
        </div>
      </form>
      <div class="msg-actions">
        ${m.state === 'PUBLISHED' ? small('unpublish', 'Unpublish') : small('reject', 'Reject')}
        <div class="spacer"></div>
        ${small('delete', 'Delete', 'ghost danger', `Delete message ${dd(m.id)} permanently? This cannot be undone.`)}
      </div>`}
  </article>`;
}

function queue({ list, crew, counts, show }) {
  const waiting = counts.pending + counts.awaitingResponse;
  const FILTERS = [
    ['pending', 'Awaiting reply', counts.pending],
    ['published', 'Answered', counts.published],
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

/** The mood scale for one officer: five faces, calm to angry. */
function moodBlock(c, n = 2) {
  const t = mood.translate(c.mood);
  const current = c.mood ? mood.FACES.reduce((best, f) => (Math.abs(f.v - c.mood.calm_tense) < Math.abs(best.v - c.mood.calm_tense) ? f : best), mood.FACES[0]).v : null;
  return panel('CH-12 / MOOD', `
    ${blockHead(n, 'Crew state', `${esc(c.designation)} · mood, calm to angry`,
      { live: !!c.mood, liveText: `Filed: ${esc(t.condition)}`, emptyText: 'Not filed yet' })}
    <form method="post" action="/control/moods/${c.id}">
      <div class="poles mood-poles"><span>${mood.AXES[0].low}</span><span>${mood.AXES[0].label}</span><span>${mood.AXES[0].high}</span></div>
      <div class="mood-faces" role="radiogroup" aria-label="Mood, calm to angry">
        ${mood.FACES.map((f, i) => `<label class="mood-face" title="${esc(f.name)} — ${esc(mood.AXES[0].bands[i])}">
          <input type="radio" name="calm_tense" value="${f.v}" data-crew="${c.id}" data-band="${i}"${current === f.v ? ' checked' : ''} required>
          ${mood.faceSvg(f)}<span>${esc(f.name)}</span>
        </label>`).join('')}
      </div>
      <div class="axis-read" id="read-${c.id}-calm_tense">${c.mood ? `“${esc(t.lines[0])}”` : ''}</div>
      <button class="primary">Publish</button>
    </form>
`, 'mars-side officer-block');
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

/** The head every block on an officer's tab opens with: a number and a
 *  title in one size, a line saying whose and which day and where it goes,
 *  and on the right whether anything is live yet. One shape for the blog,
 *  the findings, the figures and the state, so the tab reads as a list of
 *  things to do rather than a stack of look-alike boxes. */
function blockHead(n, title, sub, { live = null, liveText = 'Live', emptyText = 'Nothing filed' } = {}) {
  return `<div class="block-head">
    <div>
      <h2 class="block-title"><span class="block-n">${n}</span>${esc(title)}</h2>
      <p class="block-sub">${sub}</p>
    </div>
    ${live === null ? '' : `<span class="block-state ${live ? 'live' : ''}">${live ? liveText : emptyText}</span>`}
  </div>`;
}

/** That officer's Daily Blog for the chosen day, as a composer in place. */
function blogBlock(c, tab, day, entry, n = 1) {
  const live = entry && !isPlaceholder(entry.body);
  return panel('CH-50 / DAILY BLOG', `
    ${blockHead(n, 'Daily Blog', `${esc(c.designation)} · day ${dd(day)}`,
      { live, liveText: 'Live', emptyText: 'Not written yet' })}
    <form method="post" action="/control/logbook" enctype="multipart/form-data" data-attach-media data-crew-id="${c.id}"
          data-media="${editorMedia(c.media, entry ? entry.body : '', c.otherBodies || [])}">
      <input type="hidden" name="day" value="${day}">
      <input type="hidden" name="designation" value="${esc(c.designation)}">
      <input type="hidden" name="back" value="${tab}">
      <textarea name="body" rows="18" class="blog-box"
        placeholder="${esc(entry && isPlaceholder(entry.body) ? placeholderCue(entry.body) : 'What happened today, in their voice.')}">${esc(live ? entry.body : '')}</textarea>
      ${attachRow()}
      <div class="actions"><button class="primary">Publish</button>
        ${live ? '<button type="submit" class="ghost" name="action" value="clear" title="Take it down and put the placeholder back">Clear</button>' : ''}
        <span class="note">${live ? 'Saving replaces what is live.' : 'Public the moment it is saved — any day, mission started or not.'}</span></div>
    </form>`, 'mars-side officer-block');
}

/** An officer's daily report — science findings, health activities — as the same composer. */
function reportBlock(c, kindKey, label, hint, day, tpl, tab, n = 2) {
  const live = !!(c.report && c.report.trim());
  const preset = (tpl || []).find((t) => String(t.name).toLowerCase() === 'default');
  return panel(`CH-36 / ${kindKey.toUpperCase()}`, `
    ${blockHead(n, label, `${esc(c.designation)} · day ${dd(day)}`,
      { live, liveText: 'Live', emptyText: 'Not written yet' })}
    ${hint ? `<p class="note block-hint">${hint}</p>` : ''}
    <form method="post" action="/control/report" enctype="multipart/form-data" data-attach-media data-crew-id="${c.id}"
          data-media="${editorMedia(c.media, c.report || '', c.reportOtherBodies || [])}">
      <input type="hidden" name="day" value="${day}">
      <input type="hidden" name="kind" value="${esc(kindKey)}">
      <input type="hidden" name="crew_id" value="${c.id}">
      <input type="hidden" name="back" value="${tab}">
      <textarea name="body" rows="14" class="blog-box" placeholder="${esc(label)} for the day…">${esc(live ? c.report : (preset ? preset.body : ''))}</textarea>
      ${attachRow()}
      <div class="actions"><button class="primary">Publish</button>
        ${live ? '<button type="submit" class="ghost" name="action" value="clear" title="Take it down">Clear</button>' : ''}
        <span class="note">${live ? 'Saving replaces what is live.' : 'Public the moment it is saved.'}</span></div>
    </form>`, 'mars-side officer-block');
}

/** The photographs / video that go with an entry. */
function attachRow() {
  // Without the composer (no script): a picker and a caption; files are set at the end of the text.
  return `<div class="attach">
    <label class="attach-pick"><input type="file" name="file" multiple accept="${esc(mediaLib.ACCEPT)}">
      <b>＋ Photographs, video</b><span class="attach-chosen">none chosen</span></label>
    <input type="text" name="media_caption" maxlength="2000" placeholder="Caption for the files (optional)">
    <span class="attach-hint">Files are set at the end of the entry as lines like <code>[media:12]</code>; move a line to move the picture.</span>
    <div class="media-progress attach-progress" hidden></div>
  </div>`;
}

/** The day's schedule, kept by the communication officer. */
function scheduleBlock(day, tasks) {
  return panel('CH-30 / DAILY MISSION', `
    ${eyebrow(`Schedule · day ${dd(day)}`)}
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

/** Calories and steps, the only habitat figures counted by a person — one
 *  line per officer; the crew's totals are the sums, worked out on save. */
function crewFiguresBlock(day, figures, crew, n = 3) {
  const f = figures[String(day)] || {}, per = f.crew || {};
  const live = f.calories != null || f.steps != null || Object.keys(per).length > 0;
  const short = (d) => String(d || '').replace(/\s*OFFICER$/i, '').trim();
  const fmt = (v) => (v == null ? '—' : Number(v).toLocaleString('en-GB'));
  return panel('CH-13 / CREW FIGURES', `
    ${blockHead(n, 'Crew figures', `Day ${dd(day)}`,
      { live, liveText: 'Filed', emptyText: 'Not filed yet' })}
    <p class="note block-hint">One line per officer. Saving writes <b>content/crew-figures.json</b>; the crew's totals are the sums.
    Leave a field blank to record nothing for that officer that day.</p>
    <form method="post" action="/control/crew-figures">
      <input type="hidden" name="day" value="${day}">
      ${crew.map((c) => { const v = per[c.designation] || {}; return `
      <div class="fig-officer">
        <span class="fig-officer-name" style="display:block;margin:10px 0 2px;font-size:12px;font-weight:700;letter-spacing:.08em">${esc(short(c.designation))}</span>
        <div class="grid g2" style="gap:0 12px">
          <label class="f"><span>Calories consumed</span>
            <input type="number" min="0" name="calories_${c.id}" value="${v.calories ?? ''}" placeholder="kcal"></label>
          <label class="f"><span>Steps taken</span>
            <input type="number" min="0" name="steps_${c.id}" value="${v.steps ?? ''}" placeholder="steps"></label>
        </div>
      </div>`; }).join('')}
      <p class="note">Crew total on record for this day: <b>${fmt(f.calories)}</b> kcal · <b>${fmt(f.steps)}</b> steps${Object.keys(per).length ? '' : f.calories != null || f.steps != null ? ' — filed as a total, before the officers were counted separately' : ''}.</p>
      <div class="actions"><button class="primary">Publish</button></div>
    </form>`, 'mars-side officer-block');
}

function mealsBlock(day, meals) {
  const SLOTS = [['BREAKFAST', 'Breakfast'], ['LUNCH', 'Lunch'],
                 ['DINNER', 'Dinner'], ['RATION', 'Ration']];
  const find = (slot) => meals.find((m) => m.slot === slot) || {};
  const kcal = meals.reduce((a, m) => a + (m.kcal || 0), 0);

  return panel('CH-32 / DAILY FOOD PLAN', `
    ${eyebrow(`Galley · day ${dd(day)}`)}
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
    <form method="post" action="/control/inventory">
      <input type="hidden" name="day" value="${day}">
      <div class="tw"><table>
        <thead><tr><th>Resource</th><th>Available amount</th><th>Amount used today</th><th>Amount left for future</th></tr></thead>
        <tbody>${items.map((i) => `<tr>
          <th>${esc(i.label)} <span style="color:var(--faint)">${esc(i.unit)}</span></th>
          <td class="n" style="color:var(--faint)">${i.carried == null ? '—' : i.carried}</td>
          <td><input type="number" step="0.1" min="0" name="c_${esc(i.key)}" value="${i.set ? i.consumption : ''}"
               placeholder="${i.consumption}"></td>
          <td><input type="number" step="0.1" min="0" name="q_${esc(i.key)}" value="${i.set ? i.quantity : ''}"
               placeholder="${i.quantity}"></td>
        </tr>`).join('')}</tbody>
      </table></div>
      <div class="actions">
        <button class="primary">Save levels for day ${dd(day)}</button>
        <div class="spacer"></div>
      </div>
    </form>`, 'mars-side');
}

/**
 * Power consumed that day, by category. Each row is a category: its name
 * (editable — renaming here renames it everywhere, the record included) and
 * the day's kWh. A blank amount records nothing for that category, not zero.
 */
function powerBlock(day, power) {
  const d = power.days[String(day)] || {};
  const filed = power.categories.filter((c) => d[c.key] != null);
  const total = filed.reduce((s, c) => s + d[c.key], 0);
  return panel('CH-35 / POWER', `
    ${eyebrow(`Power consumed · day ${dd(day)}`)}
    <form method="post" action="/control/power">
      <input type="hidden" name="day" value="${day}">
      <div class="tw"><table>
        <thead><tr><th>Category</th><th>kWh that day</th></tr></thead>
        <tbody>${power.categories.map((c) => `<tr>
          <td><input type="text" name="name_${esc(c.key)}" value="${esc(c.label)}" aria-label="Category name"></td>
          <td><input type="number" step="0.01" min="0" name="kwh_${esc(c.key)}" value="${d[c.key] ?? ''}"
               placeholder="nothing recorded" aria-label="${esc(c.label)} kWh"></td>
        </tr>`).join('')}</tbody>
      </table></div>
      <div class="kv" style="margin-top:6px"><dt>Day total</dt>
        <dd>${filed.length ? `${total.toFixed(2)} kWh across ${filed.length} categor${filed.length === 1 ? 'y' : 'ies'}` : 'nothing recorded for this day'}</dd></div>
      <div class="actions"><button class="primary">Save power for day ${dd(day)}</button></div>
    </form>`, 'mars-side');
}

/* Start again. The files in content/ are the plan; the reset empties the
   blog slots, clears everything written live and reloads the mission from
   the files. content/plan/ is a snapshot of the files, kept as a backup and
   used to put back a file that has gone missing. */
/** The cloud gallery's state, and a button to read the folder again now. */
function cloudBlock() {
  const s = require('../../lib/cloud').snapshot();
  const when = (iso) => (iso ? iso.slice(0, 16).replace('T', ' ') + ' UTC' : '—');
  return panel('CH-61 / CLOUD GALLERY', `
    <div id="cloud"></div>
    ${eyebrow('Gallery from the cloud')}
    ${!s.configured
      ? `<p class="note">Off. Set <b>CLOUD_USER</b> and <b>CLOUD_PASSWORD</b> (and <b>CLOUD_FOLDER</b>) in <b>.env</b> and recreate the
         container (<code>docker compose up -d</code>); the station then reads the folder on <b>${esc(s.source)}</b> over WebDAV and shows
         every image in it as a grid on <b>/media</b>. Or, on a machine where the folder is already mounted, set <b>CLOUD_DIR</b> to that
         directory instead.</p>`
      : `<div class="kv">
          <dt>Source</dt><dd>${s.mode === 'dir' ? `mounted folder <b>${esc(s.folder)}</b>` : `${esc(s.source)} · folder <b>/${esc(s.folder === '/' ? '' : s.folder)}</b>`}</dd>
          <dt>Images</dt><dd>${s.listed} listed · ${s.shown} on the grid${s.tooBig.length ? ` · ${s.tooBig.length} too large to copy` : ''}</dd>
          <dt>Frequency</dt><dd>checked every <b>${s.checkSeconds} s</b> — CLOUD_CHECK_SECONDS in .env; an open /media refreshes on the same beat</dd>
          <dt>Last read</dt><dd>${when(s.lastPollAt)}</dd>
          ${s.lastError ? `<dt>Error</dt><dd><b>${esc(s.lastError.message)}</b> (${when(s.lastError.at)})</dd>` : ''}
        </div>
        <form method="post" action="/control/cloud/refresh" class="actions">
          <button class="primary">Read the folder now</button>
          <a class="btn" href="/media#gallery">Open the grid</a>
          <span class="note">Read-only: nothing is ever written to the cloud. Copies live on the station's volume, so the grid stands without the network.</span>
        </form>`}`, 'mars-side');
}

function resetBlock(day, plan, locked) {
  const when = plan.savedAt ? new Date(plan.savedAt).toLocaleString('en-GB', { timeZone: 'Europe/Berlin', dateStyle: 'medium', timeStyle: 'short' }) : null;
  return panel('CH-00 / START AGAIN', `
    ${eyebrow('Start again from 15 October')}
    <p class="note"><b>Reset to 15 October</b> — the button at the top of this page, on every tab — asks you to
      type <code>RESET</code>, then: empties every blog slot for every day and officer (the crew fill them
      during the run); empties the crew's figures — calories and steps are filed daily on the Health tab;
      clears every message, reply and callsign from Earth; clears every crew state filed, so
      the crew begin with nothing on record; clears the media sent out from the record (the files stay on disk
      under their hashes); clears every habitat reading — the station's own and the external node's — so the
      readings and the trend graph start on 15 October, with nothing from before the run; clears the sealed
      daily records, task statuses and
      live notes; and reloads the schedule, meals, inventory levels, notes and sensors from the files
      in <code>content/</code> exactly as they are at that moment. From the reset on, the trend graph carries
      no plan: every day ahead is empty and fills in as the crew file it. Nothing is copied over the files. The
      sign-in, the audit trail and the readings log (every reading ever pulled, as JSON files on disk) are
      kept. It cannot be undone.</p>
    <p class="note">${locked
      ? '<b>Locked.</b> The run has begun; the reset is for the weeks before 15 October.'
      : 'Available until 15 October. From the first day of the run the button is locked.'}</p>
    <p class="note" style="margin-top:18px">A <b>snapshot</b> of the content files is kept in <code>content/plan/</code>
      ${plan.exists ? `(saved ${esc(when)} · ${plan.files.length} files)` : '(none yet)'} — a backup, and where a
      file that has gone missing is restored from at start-up. The reset does not read from it.</p>
    <form method="post" action="/control/plan/save" class="actions">
      <input type="hidden" name="day" value="${day}">
      <button class="ghost small">Save the files as they are now as the snapshot</button>
    </form>`, 'mars-side');
}

/* The reset dialog: the word must be typed; the button only wakes up when
   it has been. Without the page's script the field is still a plain text
   input the server checks. */
function resetDialog(locked) {
  if (locked) return '';
  return `
  <dialog class="popup reset-dialog" id="reset-dialog" aria-labelledby="reset-title">
    <div class="popup-head"><div><span class="fold-title" id="reset-title">Are you sure you want to reset?</span>
      <span class="fold-sub">Start again for 15 October · cannot be undone</span></div>
      <button type="button" class="popup-close" data-close aria-label="Close">×</button></div>
    <div class="popup-body">
      <p class="note">This empties every blog slot, clears every message and reply from Earth, every crew state,
        the media sent out, the daily records, and every habitat reading (the readings and the trend graph start on
        15 October), and reloads the mission from the files in <code>content/</code> as they are now.</p>
      <form method="post" action="/control/reset" id="reset-form" class="actions" style="align-items:flex-end;gap:12px;margin-top:10px">
        <label style="display:flex;flex-direction:column;gap:6px;flex:1 1 220px">
          <span class="note" style="margin:0">Type <b>RESET</b> to confirm</span>
          <input type="text" name="confirm" id="reset-word" autocomplete="off" autocapitalize="characters" spellcheck="false" placeholder="RESET" style="text-transform:uppercase">
        </label>
        <button class="primary" id="reset-go" disabled>Reset the station</button>
        <button type="button" class="ghost" data-close>Cancel</button>
      </form>
    </div>
  </dialog>
  <script>
  (function () {
    var open = document.getElementById('reset-open'), dlg = document.getElementById('reset-dialog');
    if (!open || !dlg) return;
    var word = document.getElementById('reset-word'), go = document.getElementById('reset-go');
    function arm() { go.disabled = word.value.trim().toUpperCase() !== 'RESET'; }
    open.addEventListener('click', function () { word.value = ''; arm(); if (dlg.showModal) dlg.showModal(); else dlg.setAttribute('open', ''); setTimeout(function () { word.focus(); }, 50); });
    word.addEventListener('input', arm);
    dlg.querySelectorAll('[data-close]').forEach(function (b) { b.addEventListener('click', function () { dlg.close ? dlg.close() : dlg.removeAttribute('open'); }); });
    dlg.addEventListener('click', function (e) { if (e.target === dlg) { dlg.close ? dlg.close() : dlg.removeAttribute('open'); } });
    document.getElementById('reset-form').addEventListener('submit', function (e) { if (word.value.trim().toUpperCase() !== 'RESET') e.preventDefault(); });
  })();
  </script>`;
}

/* ================================================================== THE PAGE */

/**
 * `model` carries everything for every tab: the queue, the chosen day, each
 * officer with their entry and mood, the day's tasks, meals, notes, figures
 * and inventory. One request renders the whole desk.
 */
function page(ctx, model) {
  const { user, f, content, show, tab, day, totalDays, tpl, plan = { exists: false }, resetLocked = false,
          list, crew, counts, officers, tasks, meals, notes, figures, items, power = { categories: [], days: {} },
          media: mediaItems = [], mediaCounts = { total: 0, bytes: 0 }, mediaAccept = '', mediaMaxMb = 0, filter = 'all' } = model;

  const dayPicker = `<nav class="filters daypick daypick-dates" aria-label="Mission day">
    ${Array.from({ length: totalDays }, (_, i) => i + 1).map((n) => {
      const d = new Date(missionLib.dateForDay(n) + 'T12:00:00Z');
      const label = d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', timeZone: 'UTC' });
      return `<a href="${tabUrl(tab, n)}" class="${n === day ? 'on' : ''}" data-day="${n}"
        title="Mission day ${dd(n)}">${esc(label)}</a>`;
    }).join('')}
  </nav>`;

  const panes = {
    messages: queue({ list, crew, counts, show }),
    // Every officer's blocks in one column, full width, the blog first —
    // the writing gets the room, and nothing sits beside anything.
    comms: `
      <div class="officer-stack">
        ${blogBlock(officers.comms, 'comms', day, officers.comms.entry, 1)}
        ${moodBlock(officers.comms, 2)}
      </div>`,
    science: `
      <div class="officer-stack">
        ${blogBlock(officers.science, 'science', day, officers.science.entry, 1)}
        ${reportBlock(officers.science, 'science', 'Daily science findings',
          'Samples, measurements, the greenhouse, anything the habitat did that was worth recording.', day, tpl.SCIENCE, 'science', 2)}
        ${moodBlock(officers.science, 3)}
      </div>`,
    health: `
      <div class="officer-stack">
        ${blogBlock(officers.health, 'health', day, officers.health.entry, 1)}
        ${reportBlock(officers.health, 'health', 'Daily health activities', '', day, tpl.HEALTH, 'health', 2)}
        ${crewFiguresBlock(day, figures, crew, 3)}
        ${moodBlock(officers.health, 4)}
      </div>`,
    habitat: `
      ${scheduleBlock(day, tasks)}
      ${mealsBlock(day, meals)}
      ${inventoryBlock(day, items)}
      ${powerBlock(day, power)}
      ${cloudBlock()}
      ${resetBlock(day, plan, resetLocked)}`,
  };

  const body = `
  <div style="padding:22px 0 4px">
    <div class="eyebrow">Mission control · ${esc(user.username)} ·
      day ${dd(ctx.mission.clampedDay)} · ${esc(ctx.mission.venueTime)} habitat time</div>
    <div class="actions" style="margin-bottom:8px">
      <h1 style="margin:0">Mission control</h1>
      <div class="spacer"></div>
      <a class="btn" href="/archive">Archive</a>
      <a class="btn" href="/archive/export.pdf" title="The whole mission as one PDF: every exchange, every entry with its photographs, the schedules, meals, inventory, states, trends and the media index">Download full record (PDF)</a>
      <button type="button" class="ghost" id="reset-open" ${resetLocked ? 'disabled' : ''}
              title="${resetLocked ? 'Locked: the run has begun. The reset is for the weeks before 15 October.' : 'Start again for 15 October — asks you to type RESET first'}">Reset to 15 October${resetLocked ? ' · locked' : ''}</button>
      <form method="post" action="/control/logout"><button class="ghost">Sign out</button></form>
    </div>
  </div>
  ${resetDialog(resetLocked)}

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
    <div class="daypick-wrap"${tab === 'messages' ? ' hidden' : ''}>${dayPicker}</div>
    ${TABS.map(([k]) => `<div class="tab-pane ${k === tab ? 'on' : ''}" data-pane="${k}" role="tabpanel"
      id="tab-${k}">${panes[k]}</div>`).join('')}
  </div>`;

  return L.page({
    title: 'Mission control', ctx, body, current: '',
    bodyClass: 'control', scripts: ['/control.js', '/media-upload.js', '/entry-editor.js'],
  });
}

module.exports = { login, page, TABS };
