'use strict';
const L = require('../layout');
const { isPlaceholder, placeholderCue } = require('../../lib/content');
const mediaLib = require('../../lib/media');
const { esc, panel, eyebrow } = L;
const orbital = require('../../lib/orbital');
const mood = require('../../lib/mood');
const missionLib = require('../../lib/mission');
const officer = require('../../lib/officer');

const dd = (n) => String(n).padStart(3, '0');

/**
 * Mission control is one page. The top bar chooses the officer; the message
 * queue sits inside the commanding officer's tab, first, because
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
  ['comms', 'Commanding officer'],
  ['science', 'Science officer'],
  ['health', 'Health officer'],
  ['habitat', 'Habitat'],
];

const tabUrl = (tab, day, extra = '') => `/control?tab=${tab}&day=${day}${extra}#work`;
// "day 006" — or "NOW", the rehearsal day before the run (mission day 0), wherever a block names its day
const dayN = (day) => (Number(day) === 0 ? 'NOW' : `day ${dd(day)}`);

const flash = (f) => f ? `<div class="flash ${f.err ? 'err' : ''}">${esc(f.msg)}</div>` : '';

/* The desk's memory of edits (routes/control.js, control_edit): `e` is one
   form's record for the day — when it was last saved, and which of its
   fields were changed through this page. A changed field is marked in
   orange and stays marked after the save; the form's button says when it
   was last saved. */
const when = (iso) => {
  const tz = (missionLib.config() || {}).timezone || 'Europe/Berlin';
  return new Date(iso).toLocaleString('en-GB', { timeZone: tz, day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
};
/** The moment a message was sent, in full: the day, the time and the zone, on the venue's clock — "28 Sept 2026, 16:28:54 CET"
    (the zone is always named CET, as everywhere on the station; the clock is the venue's own). */
const whenFull = (iso) => {
  const tz = (missionLib.config() || {}).timezone || 'Europe/Berlin';
  try { return new Date(iso).toLocaleString('en-GB', { timeZone: tz, day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', second: '2-digit' }) + ' CET'; }
  catch { return when(iso); }
};
const mark = (e, key) => (e && e.keys && e.keys[key] ? ' was-edited' : '');
// A block never saved from the desk says nothing about it: the note appears with the first save.
const savedNote = (e) => (e && e.savedAt
  ? `<span class="saved-at" title="${esc(e.savedAt)}">Last saved ${esc(when(e.savedAt))}${e.actor ? ` · ${esc(e.actor)}` : ''}</span>`
  : '');

/* ==================================================================== LOGIN */

function login(ctx, error) {
  const body = `<div style="max-width:400px;margin:12vh auto 0">
    ${panel('ACCESS', `
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
    <div class="actions" style="justify-content:flex-end;margin-top:12px">${L.themeSwitch(ctx, 'theme', (t) => t)}</div>
  </div>`;
  return L.page({ title: 'Sign in', ctx, body, current: '', bodyClass: 'control', hideRail: true });
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
 * are one motion: who wrote, what they wrote, the box, one orange button that
 * replies. The quieter things — the state, when it came, rejecting, deleting
 * — sit in the card's top line, out of the way of the writing.
 */
function messageCard(m, crew, show, space = null) {
  const tags = (m.tags || '').split(',').filter(Boolean);
  const q = `?show=${show}`;
  const sp = space && space.enabled ? spaceMark(m) : '';
  const small = (action, label, cls = 'ghost', confirm = '') =>
    `<form method="post" action="/control/${m.id}/${action}${q}"${confirm ? ` data-confirm="${esc(confirm)}"` : ''}>
      <button class="${cls} small">${label}</button></form>`;
  const pending = m.state === 'PENDING_APPROVAL' || m.state === 'APPROVED' || m.state === 'RESPONSE';
  const del = small('delete', 'Delete', 'ghost danger', `Delete message ${dd(m.id)} permanently? This cannot be undone.`);

  return `<article class="msg ${pending ? 'pending' : ''} ${m.state === 'REJECTED' ? 'rejected' : ''}" id="m${m.id}">
    <div class="msg-top">
      <div class="msg-who">
        <span class="cs">${esc(m.callsign)}</span>
        ${tags.map((t) => `<span class="badge earth">#${esc(t)}</span>`).join('')}
        ${stateBadge(m)}
        ${sp}
      </div>
      <div class="msg-side">
        <span class="msg-meta" title="Message ${String(m.id).padStart(5, '0')} · sent ${esc(m.submitted_at)} (UTC)">MSG ${String(m.id).padStart(5, '0')} · ${dayN(m.mission_day)} · <b class="msg-sent">sent ${esc(whenFull(m.submitted_at))}</b></span>
        <div class="msg-actions">
          ${m.state === 'REJECTED' ? small('restore', 'Restore to the queue')
            : m.state === 'PUBLISHED' ? small('unpublish', 'Unpublish') : small('reject', 'Reject')}
          ${del}
        </div>
      </div>
    </div>
    <blockquote class="quoted">${esc(m.body)}</blockquote>
    ${m.state === 'REJECTED' ? '' : `
      <form method="post" action="/control/${m.id}/reply${q}" class="reply">
        <div class="reply-head">
          <label class="reply-label" for="reply-${m.id}">${m.state === 'PUBLISHED' ? 'The reply' : 'Reply'}</label>
          <label class="reply-as">as <select name="crew_id" aria-label="Reply attributed to">
            <option value="">Mars habitat</option>
            ${crew.map((c) => `<option value="${c.id}"${m.crew_id === c.id ? ' selected' : ''}>${esc(officer.shown(c.designation))}</option>`).join('')}
          </select></label>
        </div>
        <textarea name="body" id="reply-${m.id}" rows="4" required minlength="2" class="reply-box"
          placeholder="Answer as the crew.">${esc(m.response_body || '')}</textarea>
        <div class="reply-bar">
          <button name="action" value="publish" class="primary">${m.state === 'PUBLISHED' ? 'Update reply' : 'Reply'}</button>
          <span class="reply-hint">${m.state === 'PUBLISHED' ? 'Published on the board — saving replaces it.' : 'Goes to the board the moment it is sent · Ctrl+Enter'}</span>
        </div>
      </form>`}
  </article>`;
}

/** How one message stands with SpaceSpeak — a mark in its top line. Only a replied, published message is ever handed
 *  over (routes/control.js), so a message still waiting carries no mark; a published one without a row was published
 *  while the relay was off. */
function spaceMark(m) {
  const r = m.relay;
  if (!r) return m.state === 'PUBLISHED' ? '<span class="badge space-none" title="Not handed to SpaceSpeak — the relay was off when the reply was published">Not beamed</span>' : '';
  const tries = r.attempts >= 1 ? ` · try ${r.attempts} failed` : '';                 // a queued message with tries behind it
  switch (r.state) {
    case 'SENT': return `<a class="badge space-sent" href="${esc(r.remote_url || '#')}" target="_blank" rel="noopener" title="Beamed into space by SpaceSpeak at ${esc(whenFull(r.launched_at || r.sent_at))}">Beamed${r.remote_id ? ` · No. ${esc(r.remote_id)}` : ''}</a>`;
    case 'DRY_RUN': return `<span class="badge space-dry" title="${esc(r.steps)}">Dry run · not pressed</span>`;
    case 'SENDING': return '<span class="badge space-wait" title="The browser is on the site now">Beaming…</span>';
    case 'QUEUED': return `<span class="badge space-wait" title="${esc(r.error ? `Last try: ${r.error}` : 'Waiting its turn')}">Queued for space${tries}</span>`;
    case 'FAILED': return `<span class="badge bad space-bad" title="${esc(r.error)}">Not beamed · ${esc(r.error.slice(0, 80))}${r.error.length > 80 ? '…' : ''}</span>`;
    case 'SKIPPED': return `<span class="badge space-none" title="${esc(r.error || 'Not published when its turn came')}">Not beamed · ${esc(r.error || 'skipped')}</span>`;
    default: return '';
  }
}

function queue({ list, crew, counts, show, space = null }) {
  const waiting = counts.pending + counts.awaitingResponse;
  const FILTERS = [
    ['pending', 'Awaiting reply', counts.pending],
    ['published', 'Answered', counts.published],
    ['rejected', 'Rejected', counts.rejected || 0],
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
    ${list.length ? list.map((m) => messageCard(m, crew, show, space)).join('')
      : `<div class="empty">${show === 'pending' ? 'Nothing waiting — every message has been answered' : 'Nothing in this view'}</div>`}
  </section>`;
}

/* ============================================================= DAY CONTENT */

/** The mood scale for one officer: five faces, calm to angry. */
function moodBlock(c, n = 2, e = null) {
  const t = mood.translate(c.mood);
  const current = c.mood ? mood.FACES.reduce((best, f) => (Math.abs(f.v - c.mood.calm_tense) < Math.abs(best.v - c.mood.calm_tense) ? f : best), mood.FACES[0]).v : null;
  return panel('MOOD', `
    ${blockHead(n, 'Crew state', `${esc(officer.shown(c.designation))} · mood, calm to angry`,
      { live: !!c.mood, liveText: `Filed: ${esc(t.condition)}`, emptyText: 'Not filed yet' })}
    <form method="post" action="/control/moods/${c.id}">
      <div class="poles mood-poles"><span>${mood.AXES[0].low}</span><span>${mood.AXES[0].label}</span><span>${mood.AXES[0].high}</span></div>
      <div class="mood-faces" role="radiogroup" aria-label="Mood, calm to angry">
        ${mood.FACES.map((f, i) => `<label class="mood-face${current === f.v ? mark(e, 'calm_tense') : ''}" title="${esc(f.name)} — ${esc(mood.AXES[0].bands[i])}">
          <input type="radio" name="calm_tense" value="${f.v}" data-crew="${c.id}" data-band="${i}"${current === f.v ? ' checked' : ''} required>
          ${mood.faceSvg(f)}<span>${esc(f.name)}</span>
        </label>`).join('')}
      </div>
      <div class="axis-read" id="read-${c.id}-calm_tense">${c.mood ? `“${esc(t.lines[0])}”` : ''}</div>
      <div class="actions"><button class="primary">Publish</button>${savedNote(e)}</div>
    </form>
    ${moodRecord(c)}
`, 'mars-side officer-block');
}

/** The record under an officer's state: every state filed for them — the day and time it was filed (the venue's clock),
 *  the sol, the mood and its words, who filed it — the newest first. Nothing is ever taken out of it: a state filed
 *  again is one more row. The three officers' records together go out as CSV. */
const SHOWN_STATES = 12;
function moodRecord(c) {
  const rows = c.record || [];
  const row = (m) => `<tr>
        <td class="mr-when"><b>${esc(m.date ? fmtDay(m.date) : '—')}</b><span>${esc(m.time)}</span></td>
        <td class="mr-sol">${m.sol != null && m.sol >= 1 ? `SOL ${dd(m.sol)}` : m.sol != null ? 'before the run' : '—'}</td>
        <td class="mr-mood"><b>${esc(m.condition)}</b><span>${esc(m.text)}</span></td>
        <td class="mr-by">${esc(m.set_by)}</td>
      </tr>`;
  return `<div class="mood-record">
    <div class="mood-record-head">
      ${eyebrow('Record')}
      <span class="note">${rows.length ? `${rows.length} ${rows.length === 1 ? 'state' : 'states'} filed for ${esc(officer.shown(c.designation))} — every filing, the newest first` : `Every state filed for ${esc(officer.shown(c.designation))} will be listed here — the day and time, the mood, who filed it.`}</span>
      <a class="mood-record-csv" href="/control/moods.csv" title="Every state filed for every officer, oldest first">CSV · all officers</a>
    </div>
    ${rows.length ? `<table class="mood-table">
      <thead><tr><th>Date · time</th><th>Sol</th><th>Mood</th><th>Filed by</th></tr></thead>
      <tbody>${rows.slice(0, SHOWN_STATES).map(row).join('')}</tbody>
    </table>${rows.length > SHOWN_STATES ? `<p class="note">${rows.length - SHOWN_STATES} earlier ${rows.length - SHOWN_STATES === 1 ? 'state is' : 'states are'} in the CSV.</p>` : ''}` : ''}
  </div>`;
}
const fmtDay = (ymd) => {
  try { return new Date(ymd + 'T12:00:00Z').toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' }); }
  catch { return ymd; }
};

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
function blockHead(n, title, sub, { live = null, liveText = 'Live', draft = null } = {}) {
  return `<div class="block-head">
    <div>
      <h2 class="block-title"><span class="block-n">${n}</span>${esc(title)}</h2>
      <p class="block-sub">${sub}</p>
    </div>
    ${draft ? `<span class="block-state draft" title="${esc(draft.at)}">Draft · ${esc(when(draft.at))}</span>` : ''}
    ${live ? `<span class="block-state live">${liveText}</span>` : ''}
  </div>`;
}

/** The Commander Blog — the commanding officer's entry — for the chosen day, as a composer in place. */
function blogBlock(c, tab, day, entry, n = 1, e = null, draft = null) {
  const live = entry && !isPlaceholder(entry.body);
  const text = draft ? draft.body : live ? entry.body : '';
  return panel('COMMANDER BLOG', `
    ${blockHead(n, 'Commander Blog', `${esc(officer.shown(c.designation))} · ${dayN(day)}`, { live, liveText: 'Live', draft })}
    <form method="post" action="/control/logbook" enctype="multipart/form-data" data-attach-media data-crew-id="${c.id}" class="${mark(e, 'body').trim()}"
          data-media="${editorMedia(c.media, text, c.otherBodies || [])}">
      <input type="hidden" name="day" value="${day}">
      <input type="hidden" name="designation" value="${esc(c.designation)}">
      <input type="hidden" name="back" value="${tab}">
      <textarea name="body" rows="18" class="blog-box"
        placeholder="${esc(entry && isPlaceholder(entry.body) ? placeholderCue(entry.body) : 'What happened today, in their voice.')}">${esc(text)}</textarea>
      ${attachRow()}
      <div class="actions"><button class="primary">Publish</button><button type="submit" class="ghost" name="action" value="draft" title="Keep the text on this desk without publishing it">Save draft</button>${savedNote(e)}
        <span class="note">${draft ? `A draft is open — ${live ? 'the live entry stays as it is until' : 'nothing is public until'} it is published.` : live ? 'Publishing replaces what is live.' : 'Public the moment it is published — any day, mission started or not.'}</span></div>
    </form>`, 'mars-side officer-block');
}

/** An officer's daily report — science findings, health activities — as the same composer. */
function reportBlock(c, kindKey, label, hint, day, tpl, tab, n = 2, e = null, draft = null) {
  const live = !!(c.report && c.report.trim());
  const preset = (tpl || []).find((t) => String(t.name).toLowerCase() === 'default');
  const text = draft ? draft.body : live ? c.report : (preset ? preset.body : '');
  return panel(`${kindKey.toUpperCase()}`, `
    ${blockHead(n, label, `${esc(officer.shown(c.designation))} · ${dayN(day)}`, { live, liveText: 'Live', draft })}
    ${hint ? `<p class="note block-hint">${hint}</p>` : ''}
    <form method="post" action="/control/report" enctype="multipart/form-data" data-attach-media data-crew-id="${c.id}" class="${mark(e, 'body').trim()}"
          data-media="${editorMedia(c.media, text, c.reportOtherBodies || [])}">
      <input type="hidden" name="day" value="${day}">
      <input type="hidden" name="kind" value="${esc(kindKey)}">
      <input type="hidden" name="crew_id" value="${c.id}">
      <input type="hidden" name="back" value="${tab}">
      <textarea name="body" rows="14" class="blog-box" placeholder="${esc(label)} for the day…">${esc(text)}</textarea>
      ${attachRow()}
      <div class="actions"><button class="primary">Publish</button><button type="submit" class="ghost" name="action" value="draft" title="Keep the text on this desk without publishing it">Save draft</button>${savedNote(e)}
        <span class="note">${draft ? `A draft is open — ${live ? 'the live text stays as it is until' : 'nothing is public until'} it is published.` : live ? 'Publishing replaces what is live.' : 'Public the moment it is published.'}</span></div>
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

/** The day's schedule, kept by the commanding officer. */
function scheduleBlock(day, tasks, e = null) {
  const rowKey = (t) => `row:${t.time}|${t.label}|${t.detail || ''}`;
  return panel('DAILY MISSION', `
    ${eyebrow(`Schedule · ${dayN(day)}`)}
    <form method="post" action="/control/schedule">
      <input type="hidden" name="day" value="${day}">
      <div class="tw"><table>
        <thead><tr><th style="width:88px">Time</th><th>Task</th><th>Detail</th></tr></thead>
        <tbody>
        ${tasks.map((t, i) => `<tr class="${mark(e, rowKey(t)).trim()}">
          <td><input type="time" name="t${i}_time" value="${esc(t.time)}"></td>
          <td><input type="text" name="t${i}_label" value="${esc(t.label)}" placeholder="Empty to remove this task"></td>
          <td><input type="text" name="t${i}_detail" value="${esc(t.detail || '')}"></td>
        </tr>`).join('')}
        ${[0, 1, 2].map((k) => `<tr>
          <td><input type="time" name="n${k}_time"></td>
          <td><input type="text" name="n${k}_label" placeholder="New task"></td>
          <td><input type="text" name="n${k}_detail"></td>
        </tr>`).join('')}
        </tbody>
      </table></div>
      <div class="actions"><button class="primary">Save</button>${savedNote(e)}
        <span class="note">A task with its name emptied is removed when the day is saved.</span></div>
    </form>`, 'mars-side');
}

/** The day's scientific mission, on the Science officer's tab: the plan in content/missions.json names one for
 *  each day (the default); the officer may set another in its place from the list — Default puts the plan's back.
 *  What is chosen stands wherever the day's mission is shown (routes/control.js, /mission; content.missionForDay).
 *  NOW has no mission of its own (before the run the dashboard shows day 01's), so the block stands on the run's
 *  days alone. */
function missionBlock(day, plan, e = null) {
  if (!day || !plan) return '';
  const name = (m) => `Mission No. ${m.no} · ${m.title}`;
  const def = plan.missions.find((m) => m.no === plan.default) || null;
  const cur = plan.chosen != null ? String(plan.chosen) : '';
  return panel('SCIENCE MISSION', `
    ${eyebrow(`Science mission · day ${dd(day)}`)}
    <form method="post" action="/control/mission">
      <input type="hidden" name="day" value="${day}">
      <label class="f${mark(e, 'mission')}"><span>Mission</span>
        <select name="mission">
          <option value=""${cur === '' ? ' selected' : ''}>Default${def ? ` — ${esc(name(def))}` : ' — none'}</option>
          ${plan.missions.map((m) => `<option value="${m.no}"${cur === String(m.no) ? ' selected' : ''}>${esc(name(m))}</option>`).join('')}
        </select></label>
      <div class="actions"><button class="primary">Save</button>${savedNote(e)}</div>
    </form>`, 'mars-side');
}

/** Steps taken and calories consumed, the only habitat figures counted by a
 *  person — two blocks on the Habitat tab, one line per officer each, both
 *  writing content/crew-figures.json (a save touches only its own figure);
 *  the crew's totals are the sums, worked out on save. */
function figureBlock(day, figures, crew, e, { key, chan, title, label, unit }) {
  const f = figures[String(day)] || {}, per = f.crew || {};
  const fmt = (v) => (v == null ? '—' : Number(v).toLocaleString('en-GB'));
  return panel(chan, `
    ${eyebrow(title)}
    <p class="note block-hint">One line per officer. Saving writes <b>content/crew-figures.json</b>; the crew's total is the sum.
    Leave a field blank to record nothing for that officer that day.</p>
    <form method="post" action="/control/crew-figures">
      <input type="hidden" name="day" value="${day}">
      <div class="grid g3 fig-grid">
      ${crew.map((c) => { const v = per[c.designation] || {}; return `
        <label class="f fig-officer${mark(e, `${key}_${c.id}`)}"><span>${esc(officer.shown(c.designation))} · ${label}</span>
          <input type="number" min="0" name="${key}_${c.id}" value="${v[key] ?? ''}" placeholder="${unit}"></label>`; }).join('')}
      </div>
      ${Object.keys(per).length || f[key] == null ? '' : `<p class="note">Filed as a total before the officers were counted separately: <b>${fmt(f[key])}</b> ${unit}.</p>`}
      <div class="actions"><button class="primary">Save</button>${savedNote(e)}</div>
    </form>`, 'mars-side');
}
const stepsBlock = (day, figures, crew, e) => figureBlock(day, figures, crew, e,
  { key: 'steps', chan: 'STEPS TAKEN', title: 'Steps taken', label: 'steps', unit: 'steps' });
const caloriesBlock = (day, figures, crew, e) => figureBlock(day, figures, crew, e,
  { key: 'calories', chan: 'CALORIES CONSUMED', title: 'Calories consumed', label: 'kcal', unit: 'kcal' });

/* The recipe book's figures, per serving, as the food plan and the book show them. */
const { NUTRIENTS } = require('../../lib/content');
const dataLib = require('../../lib/data');
const numVal = (v) => (v == null || v === '' ? '' : String(+Number(v).toFixed(4)));
const hhmm = (w) => (w ? `${w[0]}–${w[1]}` : '');

/**
 * The day's meals: Breakfast, Lunch and Dinner, each with a dropdown over the
 * recipe book, and after them the meals added on the desk — "+ Add a meal"
 * puts another card beside them, with the same dropdown and the same fields,
 * numbered EXTRA1, EXTRA2, … (public/control.js clones the template below;
 * each card's × takes it away again). The power each meal used is not typed:
 * it is the kitchen's energy meter read between the meal's hours — breakfast
 * 06:00–09:00, lunch 09:00–14:00, dinner 15:00–22:00 (content/home-assistant.json,
 * `meals`), an added meal between the hours its card names — and each card
 * shows the figure as it stands (data.mealsFor). Other, the old free-text
 * slot, is gone; a day that still has one is shown as an added meal.
 */
function mealsBlock(day, meals, e = null, recipes = [], hours = { meter: '', windows: {} }) {
  const find = (slot) => meals.find((m) => m.slot === slot) || {};
  const extras = meals.filter((m) => !dataLib.FIXED_SLOTS.includes(m.slot));
  // The book, for control.js to fill a slot from: '<' escaped so no name can close the script.
  const book = JSON.stringify(recipes.filter((r) => !r.placeholder)
    .map((r) => ({ slug: r.slug, name: r.name, kcal: r.kcal, prep_minutes: r.prep_minutes, nutrients: r.nutrients, co2e_kg: r.co2e_kg, water_total_l: r.water_total_l })))
    .replace(/</g, '\\u003c');

  const picker = (slot, m) => {
    const inBook = m.recipe && recipes.some((r) => r.slug === m.recipe);
    return `<label class="f recipe-pick-f"><span>From the recipe book</span>
      <select name="${slot}_recipe" class="recipe-pick" data-slot="${slot}">
        <option value="" hidden${inBook ? '' : ' selected'}>Choose meal</option>
        <option value="__empty">Empty</option>
        <optgroup label="Recipe book">
        ${recipes.filter((r) => !r.placeholder).map((r) => `<option value="${esc(r.slug)}"${m.recipe === r.slug ? ' selected' : ''}>${esc(r.name)}${r.kcal ? ` · ${Math.round(r.kcal)} kcal` : ''}${r.prep_minutes ? ` · ${r.prep_minutes} min` : ''}</option>`).join('')}
        </optgroup>
      </select></label>
      ${m.recipe && !inBook ? `<p class="note">Filled from “${esc(m.recipe)}”, which is no longer in the recipe book — the figures below are kept.</p>` : ''}`;
  };

  const figures = (slot, m) => {
    const n = m.nutrients || {};
    const any = m.co2e_kg != null || m.water_footprint_l != null || Object.keys(n).length;
    return `<details class="meal-recipe-figs"${any ? ' open' : ''}>
      <summary>Nutrients, CO₂e and water footprint · per serving</summary>
      <div class="grid g3" style="gap:0 8px">
        ${NUTRIENTS.map((x) => `<label class="f${mark(e, `${slot}_${x.key}`)}"><span>${x.label} ${x.unit}</span>
          <input type="number" step="any" min="0" name="${slot}_${x.key}" value="${numVal(n[x.key])}"></label>`).join('')}
        <label class="f${mark(e, `${slot}_co2e`)}"><span>CO₂e kg</span>
          <input type="number" step="any" min="0" name="${slot}_co2e" value="${numVal(m.co2e_kg)}"></label>
        <label class="f${mark(e, `${slot}_wfp`)}"><span>Water footprint L</span>
          <input type="number" step="any" min="0" name="${slot}_wfp" value="${numVal(m.water_footprint_l)}"></label>
      </div>
    </details>`;
  };

  // What the meter read for the meal, under its name: the figure, so far while its hours run; nothing yet. An added
  // meal counts with the named meal whose hours cover the time it is served at, and shows that meal's hours and figure.
  const powerLine = (slot, m, isExtra) => {
    const win = m.window || (!isExtra && hours.windows[slot] ? hours.windows[slot].split('-') : null);
    const withWhom = isExtra && m.power_with ? ` — counts with ${dataLib.slotLabel(m.power_with)}` : '';
    if (!win) return `<p class="note meal-power is-none">Power · counts with the meal whose hours cover the time it is served at (below), once saved.</p>`;
    if (m.power_wh != null) return `<p class="note meal-power"><b>${m.power_wh} Wh</b>${m.power_running ? ' so far' : ''} · the kitchen meter, ${hhmm(win)}${withWhom}</p>`;
    return `<p class="note meal-power is-none">Power · the kitchen meter, ${hhmm(win)}${withWhom} — no reading for these hours yet.</p>`;
  };

  // One card. `slot` is its field prefix; an added meal has its hours and its × as well.
  const card = (slot, label, m, { extra = false, n = null } = {}) => `<div class="meal-slot-edit${extra ? ' meal-extra' : ''}" data-slot="${slot}">
          <div class="meal-card-head">
            <h3 class="slot-name">${label}${n ? ` <span class="slot-n">${n}</span>` : ''}</h3>
            ${extra ? `<button type="button" class="ghost meal-remove" title="Take this meal off the day" aria-label="Remove this meal">×</button>` : ''}
          </div>
          ${powerLine(slot, m, extra)}
          ${picker(slot, m)}
          <label class="f${mark(e, `${slot}_name`)}"><span>Name</span>
            <input type="text" name="${slot}_name" value="${esc(m.name || '')}" placeholder="Dish"></label>
          ${extra ? `<label class="f meal-at${mark(e, `${slot}_at`)}"><span>Served at — counts with Breakfast, Lunch or Dinner by this time</span>
            <input type="time" name="${slot}_at" value="${esc(m.served_at || (m.served ? m.served.slice(0, 5) : ''))}"></label>` : ''}
          <label class="f${mark(e, `${slot}_components`)}"><span>Components, one per line</span>
            <textarea name="${slot}_components" rows="3">${esc(m.components || '')}</textarea></label>
          <div class="grid g2" style="gap:0 8px">
            <label class="f${mark(e, `${slot}_kcal`)}"><span>kcal</span>
              <input type="number" name="${slot}_kcal" value="${m.kcal || ''}"></label>
            <label class="f${mark(e, `${slot}_prep`)}"><span>Prep min</span>
              <input type="number" name="${slot}_prep" value="${m.prep_minutes || ''}"></label>
          </div>
          ${figures(slot, m)}
          <label class="f${mark(e, `${slot}_notes`)}"><span>Note (shown publicly)</span>
            <input type="text" name="${slot}_notes" value="${esc(m.notes || '')}"></label>
        </div>`;

  const named = dataLib.FIXED_SLOTS.map((slot) => card(slot, dataLib.slotLabel(slot), find(slot)));
  // the added meals as they are saved (EXTRA1, EXTRA2, …; an Other from an older file among them, as EXTRA too, renumbered on saving)
  const addedSlots = extras.map((m, i) => (dataLib.isExtraSlot(m.slot) ? m.slot : `EXTRA${extras.length + 1 + i}`));
  const added = extras.map((m, i) => card(addedSlots[i], 'Extra meal', m, { extra: true, n: dataLib.extraIndex(addedSlots[i]) > 1 ? dataLib.extraIndex(addedSlots[i]) : null }));
  const nextN = addedSlots.reduce((hi, s) => Math.max(hi, dataLib.extraIndex(s)), 0) + 1;
  const hoursLine = Object.entries(hours.windows || {}).map(([k, v]) => `${dataLib.slotLabel(k).toLowerCase()} ${v.replace('-', '–')}`).join(', ');

  return panel('DAILY FOOD PLAN', `
    ${eyebrow(`Meals · ${dayN(day)}`)}
    <p class="note block-hint">Choose Breakfast, Lunch or Dinner from the recipe book and its name, kcal, prep time, nutrients,
    CO₂e and water footprint are filled in — every field stays editable. <b>Empty</b> clears the slot to fill in by hand, on the
    go; it is saved for that day only and never adds a recipe. <b>Add a meal</b> puts a further meal beside the three, with
    the same choice. The power each meal used is not typed: it is the kitchen's energy meter, read between the meal's
    hours${hoursLine ? ` (${hoursLine})` : ''}; an added meal counts with the one of the three whose hours cover the time it
    is served at — the time it was added, unless its card says another.</p>
    <script type="application/json" id="recipe-book">${book}</script>
    <form method="post" action="/control/meals" class="meals-form" data-next-extra="${nextN}">
      <input type="hidden" name="day" value="${day}">
      <div class="grid g2 meal-cards">
      ${named.join('')}${added.join('')}
      </div>
      <template class="meal-extra-tpl">${card('EXTRA__N__', 'Extra meal', {}, { extra: true, n: '__N__' })}</template>
      <div class="actions meal-add-row"><button type="button" class="ghost meal-add">+ Add a meal</button></div>
      <div class="actions"><button class="primary">Save</button>${savedNote(e)}</div>
    </form>`, 'mars-side');
}

function inventoryBlock(day, items, e = null) {
  return panel('INVENTORY', `
    ${eyebrow(day ? `Levels at the end of day ${dd(day)}` : 'Levels at the end of NOW — a rehearsal of the count, from what was carried in')}
    <form method="post" action="/control/inventory">
      <input type="hidden" name="day" value="${day}">
      <div class="tw"><table>
        <thead><tr><th>Resource</th><th>Available amount</th><th>Amount used today</th><th>Amount left for future</th></tr></thead>
        <tbody>${items.map((i) => `<tr class="${(mark(e, `c_${i.key}`) || mark(e, `q_${i.key}`)).trim()}">
          <th>${esc(i.label)} <span style="color:var(--faint)">${esc(i.unit)}</span></th>
          <td class="n" style="color:var(--faint)">${i.carried == null ? '—' : i.carried}</td>
          <td><input type="number" step="0.1" min="0" name="c_${esc(i.key)}" value="${i.set ? i.consumption : ''}"
               placeholder="${i.consumption}" class="${mark(e, `c_${i.key}`).trim()}"></td>
          <td><input type="number" step="0.1" min="0" name="q_${esc(i.key)}" value="${i.set ? i.quantity : ''}"
               placeholder="${i.quantity}" class="${mark(e, `q_${i.key}`).trim()}"></td>
        </tr>`).join('')}</tbody>
      </table></div>
      <div class="actions">
        <button class="primary">Save</button>${savedNote(e)}
        <div class="spacer"></div>
      </div>
    </form>`, 'mars-side');
}

/**
 * Power consumed that day, by category. Each row is a category: its name
 * (editable — renaming here renames it everywhere, the record included) and
 * the day's kWh. A blank amount records nothing for that category, not zero.
 */
function powerBlock(day, power, e = null) {
  const d = power.days[String(day)] || {};
  const meter = (c) => (c.sensor ? require('../../lib/content').powerSensorKwh(c, day) : null);
  // What each row stands at: a figure filed by hand, else — for a row tied to a meter — the meter's day.
  const rows = power.categories.map((c) => {
    const m = meter(c), manual = d[c.key] ?? null;
    return { c, m, manual, value: manual ?? m };
  });
  const fmt = (v) => (v == null ? '' : (Math.round(v * 100) / 100).toFixed(2));
  // Every value is locked: Edit opens it, after asking — "These values are automated, are you sure you would like to
  // edit?" — the same way for every row. A metered row shows the meter's figure by default, and a figure typed by hand
  // wins over the meter for that day; a row without a meter holds what was filed.
  const row = ({ c, m, manual, value }) => {
    const cls = (mark(e, `name_${c.key}`) || mark(e, `kwh_${c.key}`)).trim();
    const name = `<td><input type="text" name="name_${esc(c.key)}" value="${esc(c.label)}" aria-label="Category name" class="${mark(e, `name_${c.key}`).trim()}"></td>`;
    if (!c.sensor) {
      return `<tr class="${cls} pw-locked" data-key="${esc(c.key)}" data-label="${esc(c.label)}">${name}
          <td><div class="pw-meter">
            <input type="number" step="0.01" min="0" name="kwh_${esc(c.key)}" value="${d[c.key] ?? ''}" readonly
               aria-label="${esc(c.label)} kWh" class="${mark(e, `kwh_${c.key}`).trim()}">
            <button type="button" class="ghost pw-edit">Edit</button>
          </div></td></tr>`;
    }
    return `<tr class="${cls} pw-metered pw-locked" data-key="${esc(c.key)}" data-label="${esc(c.label)}">${name}
          <td>
            <div class="pw-meter">
              <input type="number" step="0.01" min="0" name="kwh_${esc(c.key)}" value="${fmt(value)}" readonly
                     data-meter="${fmt(m)}"
                     aria-label="${esc(c.label)} kWh" class="${mark(e, `kwh_${c.key}`).trim()}">
              <input type="hidden" name="meter_${esc(c.key)}" value="${fmt(m)}">
              <input type="hidden" name="edited_${esc(c.key)}" value="">
              <button type="button" class="ghost pw-edit">Edit</button>
              ${manual != null && m != null ? `<button type="button" class="ghost pw-back">Use the meter (${fmt(m)})</button>` : ''}
            </div>
            <p class="note pw-src" style="margin:4px 0 0">${manual != null
              ? `<b>Edited by hand.</b> The meter reads ${m == null ? 'nothing for this day' : `<b>${fmt(m)} kWh</b>`}.`
              : m != null ? `From the meter <code>sensor.${esc(c.sensor)}</code>: this day's last reading less the day before's total (the meter only grows).`
              : `From the meter <code>sensor.${esc(c.sensor)}</code> — no reading for this day yet.`}</p>
          </td></tr>`;
  };
  return panel('POWER', `
    ${eyebrow('Power consumed')}
    <form method="post" action="/control/power" class="pw-form">
      <input type="hidden" name="day" value="${day}">
      <div class="tw"><table>
        <thead><tr><th>Category</th><th>kWh that day</th></tr></thead>
        <tbody>${rows.map(row).join('')}</tbody>
      </table></div>
      <div class="actions"><button class="primary">Save</button>${savedNote(e)}</div>
    </form>
    <script>
    (function () {
      var form = document.currentScript.previousElementSibling;
      if (!form) return;
      // every row: locked until Edit, which asks first — the one question for all of them
      form.querySelectorAll('.pw-locked').forEach(function (tr) {
        var box = tr.querySelector('input[type=number]'), flag = tr.querySelector('input[name^="edited_"]'), label = tr.getAttribute('data-label');
        var edit = tr.querySelector('.pw-edit'), back = tr.querySelector('.pw-back');
        edit.addEventListener('click', function () {
          if (!box.readOnly) { box.focus(); return; }
          if (!confirm('These values are automated, are you sure you would like to edit?')) return;
          box.readOnly = false; if (flag) flag.value = '1'; edit.textContent = 'Editing'; box.focus(); box.select();
        });
        if (back) back.addEventListener('click', function () {
          if (!confirm('Are you sure you want to go back to the meter\\'s value (' + box.getAttribute('data-meter') + ' kWh) for ' + label + '?')) return;
          box.value = box.getAttribute('data-meter'); if (flag) flag.value = '1'; box.readOnly = true;
        });
      });
      form.addEventListener('submit', function (ev) {
        var asks = [];
        form.querySelectorAll('.pw-metered').forEach(function (tr) {
          var box = tr.querySelector('input[type=number]'), flag = tr.querySelector('input[name^="edited_"]');
          if (flag.value !== '1') return;
          var m = box.getAttribute('data-meter');
          if (box.value !== '' && (m === '' || Number(box.value).toFixed(2) !== Number(m).toFixed(2)))
            asks.push(tr.getAttribute('data-label') + ': ' + box.value + ' kWh by hand' + (m === '' ? '' : ' instead of the meter\\'s ' + m + ' kWh'));
        });
        if (asks.length && !confirm('Are you sure you want to save?\\n\\n' + asks.join('\\n'))) ev.preventDefault();
      });
    })();
    </script>`, 'mars-side');
}

/* Start again. The files in content/ are the plan; the reset empties the
   blog slots, clears everything written live and reloads the mission from
   the files. content/plan/ is a snapshot of the files, kept as a backup and
   used to put back a file that has gone missing. */
/** The cloud gallery's state, and a button to read the folder again now. */
function cloudBlock() {
  const s = require('../../lib/cloud').snapshot();
  const when = (iso) => (iso ? iso.slice(0, 16).replace('T', ' ') + ' UTC' : '—');
  return panel('CLOUD GALLERY', `
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
        </form>`}`, 'mars-side');
}

function resetBlock(day, plan, locked) {
  const when = plan.savedAt ? new Date(plan.savedAt).toLocaleString('en-GB', { timeZone: 'Europe/Berlin', dateStyle: 'medium', timeStyle: 'short' }) : null;
  return panel('START AGAIN', `
    ${eyebrow('Start again from 15 October')}
    <p class="note"><b>Reset to 15 October</b> — the button at the top of this page, on every tab — asks you to
      type <code>RESET</code>, then: empties every blog slot for every day and officer (the crew fill them
      during the run); empties the dailies that are counted as the run goes — the crew's steps and calories,
      the power figures, the stores' counts and the mission notes (their files keep their notes and the
      power categories; the stores start from what was carried in); clears every message, reply and callsign from Earth; clears every crew state filed, so
      the crew begin with nothing on record; clears the media sent out from the record (the files stay on disk
      under their hashes); clears every habitat reading — the station's own and the external node's — so the
      readings and the trend graph start on 15 October, with nothing from before the run; clears the sealed
      daily records, task statuses and
      live notes; and reloads the schedule, meals, stores and sensors from the files
      in <code>content/</code> exactly as they are at that moment. From the reset on, the trend graph carries
      no plan: every day ahead is empty and fills in as the crew file it. Nothing else is copied over the files. The
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
      <button type="button" class="popup-close" data-close aria-label="Close"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18"/></svg></button></div>
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
  const { user, f, content, show, tab, day, totalDays, tpl, plan = { exists: false }, resetLocked = false, edits = {}, drafts = {},
          list, crew, counts, officers, tasks, meals, recipes = [], mealHours = { meter: '', windows: {} }, notes, figures, items, power = { categories: [], days: {} },
          media: mediaItems = [], mediaCounts = { total: 0, bytes: 0 }, mediaAccept = '', mediaMaxMb = 0, filter = 'all', space = null, missionPlan = null } = model;

  // NOW — the rehearsal day, mission day 0, dated today — heads the picker before the run, and all through a rehearsal
  // against made-up dates: what is filed under it stays apart from the run's days and shows in the record marked as a
  // rehearsal (src/lib/mission.js, src/lib/archive.js)
  const dateLabel = (n) => new Date(missionLib.dateForDay(n) + 'T12:00:00Z').toLocaleDateString('en-GB', { day: 'numeric', month: 'short', timeZone: 'UTC' });
  const pre = ctx.mission.phase === 'PRE_LAUNCH';
  const dayPicker = `<nav class="filters daypick daypick-dates" aria-label="Mission day">
    ${ctx.mission.nowDay ? `<a href="${tabUrl(tab, 0)}" class="daypick-now${day === 0 ? ' on' : ''}" data-day="0" title="NOW — today, ${esc(dateLabel(0))}: the rehearsal day, to try everything out. Filed apart from the run's days; in the record marked as a rehearsal${pre ? ', gone on the first day of the run' : ''}">NOW · ${esc(dateLabel(0))}</a>` : ''}
    ${Array.from({ length: totalDays }, (_, i) => i + 1).map((n) => {
      const label = dateLabel(n);
      return `<a href="${tabUrl(tab, n)}" class="${n === day ? 'on' : ''}" data-day="${n}"
        title="Mission day ${dd(n)}">${esc(label)}</a>`;
    }).join('')}
  </nav>`;

  const panes = {
    messages: queue({ list, crew, counts, show, space }),
    // Every officer's blocks in one column, full width, the blog first —
    // the writing gets the room, and nothing sits beside anything.
    comms: `
      <div class="officer-stack">
        ${blogBlock(officers.comms, 'comms', day, officers.comms.entry, 1, edits[`blog:${officers.comms.id}`], drafts[`blog:${officers.comms.id}`])}
        ${moodBlock(officers.comms, 2, edits[`mood:${officers.comms.id}`])}
      </div>`,
    science: `
      <div class="officer-stack">
        ${missionBlock(day, missionPlan, edits.mission)}
        ${reportBlock(officers.science, 'science', 'Daily Mission Report',
          'Samples, measurements, the greenhouse, anything the habitat did that was worth recording.', day, tpl.SCIENCE, 'science', 1, edits['report:science'], drafts['report:science'])}
        ${moodBlock(officers.science, 2, edits[`mood:${officers.science.id}`])}
      </div>`,
    health: `
      <div class="officer-stack">
        ${reportBlock(officers.health, 'health', 'Health Report', '', day, tpl.HEALTH, 'health', 1, edits['report:health'], drafts['report:health'])}
        ${moodBlock(officers.health, 2, edits[`mood:${officers.health.id}`])}
      </div>`,
    habitat: `
      ${scheduleBlock(day, tasks, edits.schedule)}
      ${mealsBlock(day, meals, edits.meals, recipes, mealHours)}
      ${stepsBlock(day, figures, crew, edits.steps)}
      ${caloriesBlock(day, figures, crew, edits.calories)}
      ${inventoryBlock(day, items, edits.inventory)}
      ${powerBlock(day, power, edits.power)}
      ${cloudBlock()}
      ${resetBlock(day, plan, resetLocked)}`,
  };

  const body = `
  <div style="padding:22px 0 4px">
    <div class="eyebrow">Mission control · ${esc(user.username)} ·
      ${pre ? `before the run · ${esc(ctx.mission.startLabel)} opens in ${ctx.mission.daysUntilStart} ${ctx.mission.daysUntilStart === 1 ? 'day' : 'days'} · rehearsing as NOW, ${esc(dateLabel(0))}`
        : `day ${dd(ctx.mission.clampedDay)}${ctx.mission.nowDay ? ` · a rehearsal against made-up dates · NOW, ${esc(dateLabel(0))}, at hand` : ''}`} · ${esc(ctx.mission.venueTime)} habitat time</div>
    <div class="actions" style="margin-bottom:8px">
      <h1 style="margin:0">Mission control</h1>
      <div class="spacer"></div>
      ${L.themeSwitch(ctx, 'theme', (t) => t)}
      <a class="btn" href="/archive">Archive</a>
      <a class="btn" href="/archive/export.pdf" title="The whole mission as one PDF: every exchange, every entry with its photographs, the schedules, meals, inventory, states, trends and the media index">Download full record (PDF)</a>
      <button type="button" class="ghost" id="reset-open" ${resetLocked ? 'disabled' : ''}
              title="${resetLocked ? 'Locked: the run has begun. The reset is for the weeks before 15 October.' : 'Start again for 15 October — asks you to type RESET first'}">Reset to 15 October${resetLocked ? ' · locked' : ''}</button>
      <form method="post" action="/control/logout"><button class="ghost">Sign out</button></form>
    </div>
  </div>
  ${resetDialog(resetLocked)}

  ${ctx.mission.open ? '' : `<div class="flash err control-closed-note"><b>Mission control closed at the end of ${esc(ctx.mission.closeLabel)}.</b>
    The record is read-only now: nothing on this page can be edited or replied to any more — the server refuses every save — while the archive and every download stay open.</div>`}
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
    title: 'Mission control', ctx, body, current: '', hideRail: true,          // the desk is its own header: no rail across the top
    bodyClass: `control${ctx.mission.open ? '' : ' closed'}`,                 // closed: control.js disables every form (the server refuses them anyway)
    scripts: ['/control.js', '/media-upload.js', '/entry-editor.js'],
  });
}

module.exports = { login, page, TABS };
