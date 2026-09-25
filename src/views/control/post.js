'use strict';
/**
 * The post editor — one crew-log entry on a page of its own, laid out the
 * way a blog editor is: a white sheet with the title at the top, a toolbar
 * strip above it, Preview and an orange Publish button top-right, and post
 * settings in a sidebar on the right. The sheet itself is the entry composer
 * (public/entry-editor.js): paragraphs and pictures in a column, a ＋ between
 * every two. Reached from the Posts list on the Crew log tab.
 */
const L = require('../layout');
const officer = require('../../lib/officer');
const { esc } = L;
const { isPlaceholder, placeholderCue } = require('../../lib/content');
const mediaLib = require('../../lib/media');

const dd = (n) => String(n).padStart(3, '0');
const title = (c, day) => { const d = officer.shown(c.designation); return `${d.charAt(0) + d.slice(1).toLowerCase()} · Day ${dd(day)}`; };

const editorMedia = (list, body, otherBodies = []) => {
  // media placed in another text of the same officer and day (the entry, or
  // another report) belongs to that text, not to this one
  const elsewhere = new Set(otherBodies.flatMap((b) => [...String(b || '').matchAll(/\[media:(\d+)\]/g)].map((m) => Number(m[1]))));
  const items = (list || []).filter((m) => !m.hidden && !elsewhere.has(m.id));
  for (const [, id] of String(body || '').matchAll(/\[media:(\d+)\]/g)) {
    if (!items.some((m) => m.id === Number(id))) { const m = mediaLib.get(id); if (m && !m.hidden) items.push(m); }
  }
  return esc(JSON.stringify(items.map((m) => ({
    id: m.id, kind: m.kind, thumb: mediaLib.thumbUrl(m), url: mediaLib.fileUrl(m), page: mediaLib.pageUrl(m),
    caption: m.caption, filename: m.filename }))));
};

const ICONS = {
  back: '<svg viewBox="0 0 24 24" width="24" height="24"><path fill="currentColor" d="M20 11H7.83l5.59-5.59L12 4l-8 8 8 8 1.41-1.41L7.83 13H20v-2z"/></svg>',
  paragraph: '<svg viewBox="0 0 24 24" width="22" height="22"><path fill="currentColor" d="M3 18h12v-2H3v2zM3 6v2h18V6H3zm0 7h18v-2H3v2z"/></svg>',
  image: '<svg viewBox="0 0 24 24" width="22" height="22"><path fill="currentColor" d="M21 19V5c0-1.1-.9-2-2-2H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2zM8.5 13.5l2.5 3.01L14.5 12l4.5 6H5l3.5-4.5z"/></svg>',
  video: '<svg viewBox="0 0 24 24" width="22" height="22"><path fill="currentColor" d="M17 10.5V7c0-.55-.45-1-1-1H4c-.55 0-1 .45-1 1v10c0 .55.45 1 1 1h12c.55 0 1-.45 1-1v-3.5l4 4v-11l-4 4z"/></svg>',
  audio: '<svg viewBox="0 0 24 24" width="22" height="22"><path fill="currentColor" d="M12 14c1.66 0 3-1.34 3-3V5c0-1.66-1.34-3-3-3S9 3.34 9 5v6c0 1.66 1.34 3 3 3zm5.3-3c0 3-2.54 5.1-5.3 5.1S6.7 14 6.7 11H5c0 3.41 2.72 6.23 6 6.72V21h2v-3.28c3.28-.48 6-3.3 6-6.72h-1.7z"/></svg>',
  eye: '<svg viewBox="0 0 24 24" width="20" height="20"><path fill="currentColor" d="M12 4.5C7 4.5 2.73 7.61 1 12c1.73 4.39 6 7.5 11 7.5s9.27-3.11 11-7.5c-1.73-4.39-6-7.5-11-7.5zM12 17c-2.76 0-5-2.24-5-5s2.24-5 5-5 5 2.24 5 5-2.24 5-5 5zm0-8c-1.66 0-3 1.34-3 3s1.34 3 3 3 3-1.34 3-3-1.34-3-3-3z"/></svg>',
  chevron: '<svg viewBox="0 0 24 24" width="20" height="20"><path fill="currentColor" d="M7.41 8.59L12 13.17l4.59-4.58L18 10l-6 6-6-6 1.41-1.41z"/></svg>',
};

const KIND_LABEL = { science: 'Daily Science Findings', health: 'Daily Health Blog' };

function postPage(ctx, { user, f, crew: c, day, date, entry, report = '', kind = null, media, tpl, totalDays, counts, otherBodies = [] }) {
  const isReport = !!kind;
  const text = isReport ? report : (entry && !isPlaceholder(entry.body) ? entry.body : '');
  const live = isReport ? !!report.trim() : !!(entry && !isPlaceholder(entry.body));
  const preset = (tpl || []).find((t) => String(t.name).toLowerCase() === 'default');
  const cue = isReport ? (preset ? preset.body : `${KIND_LABEL[kind]} for the day…`)
    : entry && isPlaceholder(entry.body) ? placeholderCue(entry.body) : 'Write the entry…';
  const heading = isReport ? `${KIND_LABEL[kind]} · Day ${dd(day)}` : title(c, day);
  const placed = live ? (text.match(/\[media:\d+\]/g) || []).length : 0;
  const backHref = isReport ? `/control?tab=${kind}&day=${day}#work` : `/control?tab=crewlog&day=${day}#log-d${day}`;
  const body = `
  <form method="post" action="${isReport ? '/control/report' : '/control/logbook'}" enctype="multipart/form-data" class="post" id="post"
        data-attach-media data-crew-id="${c.id}" data-media="${editorMedia(media, text, otherBodies)}">
    <input type="hidden" name="day" value="${day}">
    <input type="hidden" name="designation" value="${esc(c.designation)}">
    <input type="hidden" name="crew_id" value="${c.id}">
    ${isReport ? `<input type="hidden" name="kind" value="${esc(kind)}">` : ''}
    <input type="hidden" name="back" value="post">

    <header class="post-top">
      <a class="post-back" href="${backHref}" title="Back">${ICONS.back}</a>
      <div class="post-title">${esc(heading)}</div>
      <div class="post-top-actions">
        <a class="post-link" href="/logbook#day-${day}" target="_blank" rel="noopener">${ICONS.eye}<span>Preview</span></a>
        ${live ? `<button type="submit" name="action" value="clear" class="post-text" title="Take it down">Revert to draft</button>` : ''}
        <button type="submit" class="post-publish">${live ? 'Update' : 'Publish'}</button>
      </div>
    </header>

    ${f ? `<div class="post-flash ${f.err ? 'err' : ''}">${esc(f.msg)}</div>` : ''}

    <div class="post-body">
      <div class="post-main">
        <div class="post-toolbar" role="toolbar" aria-label="Insert">
          <button type="button" data-insert="text" title="Paragraph">${ICONS.paragraph}</button>
          <span class="post-toolbar-sep"></span>
          <button type="button" data-insert="visual" title="Insert image or video">${ICONS.image}</button>
          <button type="button" data-insert="visual" title="Insert video">${ICONS.video}</button>
          <button type="button" data-insert="sound" title="Insert sound">${ICONS.audio}</button>
          <span class="post-toolbar-sep"></span>
          ${(tpl || []).filter((t) => String(t.name).toLowerCase() !== 'default').map((t) =>
            `<button type="button" class="tpl post-tpl" data-body="${esc(t.body)}" title="Start from the ${esc(t.name)} template">${esc(t.name)}</button>`).join('')}
        </div>
        <div class="post-sheet">
          <div class="post-sheet-title">${esc(heading)}</div>
          <textarea name="body" rows="14" placeholder="${esc(cue)}">${esc(text)}</textarea>
          <div class="attach">
            <label class="attach-pick"><input type="file" name="file" multiple accept="${esc(mediaLib.ACCEPT)}">
              <b>＋ Photographs, video, sound</b><span class="attach-chosen">none chosen</span></label>
            <input type="text" name="media_caption" maxlength="2000" placeholder="Caption for the files (optional)">
            <div class="media-progress attach-progress" hidden></div>
          </div>
        </div>
      </div>

      <aside class="post-side">
        <h3>Post settings</h3>
        <details open>
          <summary>Status ${ICONS.chevron}</summary>
          <div class="post-side-body">
            <span class="post-status ${live ? 'live' : ''}">${live ? 'Published' : isReport ? 'Draft' : 'Draft · placeholder'}</span>
            <p>${isReport
              ? (live ? 'Live on the station for this day, in the day’s mission notes and the archive. Update to save changes; Revert to draft to take it down.'
                      : 'Not on the station yet. Publish and it appears in the day’s mission notes at once.')
              : (live ? 'Live on the station’s crew log for this day. Update to save changes; Revert to draft to take it down.'
                      : 'Not on the station yet. Publish and it appears on the crew log for this day at once — whether or not the mission has started.')}</p>
          </div>
        </details>
        <details open>
          <summary>Published on ${ICONS.chevron}</summary>
          <div class="post-side-body">
            <b>Mission day ${dd(day)}</b><span>${esc(date)}</span>
            <div class="post-side-days">${Array.from({ length: totalDays }, (_, i) => i + 1).map((n) =>
              `<a href="/control/post/${n}/${c.id}${isReport ? `?kind=${kind}` : ''}" class="${n === day ? 'on' : ''}">${n}</a>`).join('')}</div>
          </div>
        </details>
        <details open>
          <summary>Author ${ICONS.chevron}</summary>
          <div class="post-side-body"><b>${esc(officer.shown(c.designation))}</b><span>${esc(c.role)}</span>
            ${isReport ? '' : `<div class="post-side-authors">${counts.crew.map((x) => `<a href="/control/post/${day}/${x.id}" class="${x.id === c.id ? 'on' : ''}">${esc(officer.shown(x.designation).replace(' OFFICER', ''))}</a>`).join('')}</div>`}
          </div>
        </details>
        <details>
          <summary>Media ${ICONS.chevron}</summary>
          <div class="post-side-body">
            <b>${media.length} in this post</b><span>${placed} placed in the text${media.length > placed ? ` · ${media.length - placed} following it` : ''}</span>
            <p>Every file is kept as sent, under its checksum, and is downloadable from the station’s Media page. ✕ on a picture removes it from the station; the file stays in the archive.</p>
          </div>
        </details>
        ${isReport ? '' : `<details>
          <summary>Cue ${ICONS.chevron}</summary>
          <div class="post-side-body"><p>${esc(cue)}</p></div>
        </details>`}
      </aside>
    </div>
  </form>`;

  return L.page({
    title: `${heading} — post`, ctx, body, current: '',
    bodyClass: 'control post-page', hideNav: true, hideRail: true,
    scripts: ['/control.js', '/media-upload.js', '/entry-editor.js', '/post.js'],
  });
}

module.exports = { postPage, title };
