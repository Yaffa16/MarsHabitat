'use strict';
const L = require('../layout');
const { esc } = L;
const media = require('../../lib/media');
const missionLib = require('../../lib/mission');

const dd = (n) => String(n).padStart(3, '0');
const fmtBytes = (b) => b >= 1073741824 ? (b / 1073741824).toFixed(2) + ' GB' : b >= 1048576 ? (b / 1048576).toFixed(1) + ' MB' : b >= 1024 ? Math.round(b / 1024) + ' kB' : b + ' B';
const fmtDur = (s) => { if (!s) return ''; const m = Math.floor(s / 60), r = Math.round(s % 60); return `${m}:${String(r).padStart(2, '0')}`; };
const same = (s) => s;
const plural = (T, n, one, many) => `${n} ${T(n === 1 ? one : many)}`;

/* ==================================================================== TILE */

/** One item as a tile: its preview, nothing written under it. The caption
 *  (never the filename) is the tooltip and the alt text. */
/** The cadence as people say it: seconds under two minutes, minutes from there. */
const every = (sec) => (sec >= 120 && sec % 60 === 0 ? `${sec / 60} min` : `${sec} s`);

function tile(m, { linkTo = media.pageUrl(m) } = {}) {
  const thumb = media.thumbUrl(m);
  const alt = esc(m.caption || `${m.kind}, day ${dd(m.mission_day)}`);
  const visual = thumb ? `<img src="${thumb}" alt="${alt}" loading="lazy" decoding="async">`
    : m.kind === 'image' ? `<img src="${media.fileUrl(m)}" alt="${alt}" loading="lazy" decoding="async">`
    : `<span class="media-kind">${esc(m.kind)}</span>`;
  return `<a class="mtile kind-${m.kind}" href="${linkTo}" id="m${m.id}" data-kind="${m.kind}" data-crew="${m.crew_id || ''}"${m.caption ? ` title="${esc(m.caption)}"` : ''}>
    <span class="mtile-visual">${visual}${m.kind === 'video' ? `<i class="media-play" aria-hidden="true">▶</i>` : ''}${m.kind === 'audio' ? '<i class="media-play" aria-hidden="true">♪</i>' : ''}${m.duration_s ? `<span class="mtile-dur">${fmtDur(m.duration_s)}</span>` : ''}</span>
  </a>`;
}

/* ================================================================== ENTRY */
/* A crew-log entry is a post: paragraphs of text with photographs and video
   set in between them. In the text a picture is a marker on its
   own line — [media:12] — put there by the editor where the cursor was when
   the file was attached, and movable like any other line. Anything attached
   to the entry but not placed in the text is shown after it, so nothing sent
   is ever lost. */
const MARK = /(\[media:\d+\])/;

function figure(m, { link = true, T = same } = {}) {
  const src = media.fileUrl(m);
  const alt = esc(m.caption || `${m.kind}, day ${dd(m.mission_day)}`);
  let inner;
  if (m.kind === 'image') inner = `<img src="${src}" alt="${alt}" loading="lazy" decoding="async"${m.width && m.height ? ` width="${m.width}" height="${m.height}"` : ''}>`;
  else if (m.kind === 'video') inner = `<video controls playsinline preload="metadata"${m.thumb_sha256 ? ` poster="${media.thumbUrl(m)}"` : ''}><source src="${src}" type="${esc(m.mime)}"></video>`;
  else if (m.kind === 'audio') inner = `<audio controls preload="metadata"><source src="${src}" type="${esc(m.mime)}"></audio>`;
  else inner = `<span class="entry-doc">${esc(T(m.kind))} · <a href="${src}?download" download="${esc(m.filename)}">${T('download')}</a></span>`;
  // No whitespace between the tags: an entry body renders with pre-line,
  // and stray newlines here would open up as blank lines around the picture.
  return `<figure class="entry-figure kind-${m.kind}" id="m${m.id}">${
    link && m.kind === 'image' ? `<a href="${media.pageUrl(m)}">${inner}</a>` : inner
  }${m.caption ? `<figcaption>${esc(m.caption)}</figcaption>` : ''}</figure>`;
}

function paragraphs(text) {
  return String(text).trim().split(/\n{2,}/).filter((t) => t.trim())
    .map((t) => `<p>${esc(t.trim()).replace(/\n/g, '<br>')}</p>`).join('');
}

/** The entry as HTML: text in paragraphs, media set where its markers are. */
function entryHtml(body, attached = [], opts = {}) {
  const byId = new Map(attached.map((m) => [m.id, m]));
  const find = (id) => byId.get(id) || (opts.lookup ? opts.lookup(id) : null);
  const used = new Set();
  let html = '', text = '';
  const flush = () => { if (text.trim()) html += paragraphs(text); text = ''; };
  for (const part of String(body || '').split(MARK)) {
    const mm = /^\[media:(\d+)\]$/.exec(part);
    if (mm) {
      const m = find(Number(mm[1]));
      if (m && !m.hidden) { flush(); html += figure(m, opts); used.add(m.id); }
      continue;
    }
    text += part;
  }
  flush();
  for (const m of attached) if (!used.has(m.id)) html += figure(m, opts);
  return html;
}

/** The entry as text, for places that cannot show a picture. */
function entryText(body) {
  return String(body || '').replace(/\[media:\d+\]/g, '').replace(/\n{3,}/g, '\n\n').trim();
}

/** The entry as Markdown, for the readable record. */
function entryMarkdown(body, attached = []) {
  const byId = new Map(attached.map((m) => [m.id, m]));
  const used = new Set();
  const line = (m) => (m.kind === 'image' ? `![${m.caption || m.filename}](${media.fileUrl(m)})` : `[${m.kind}: ${m.filename}](${media.fileUrl(m)})`) + (m.caption ? `  \n_${m.caption}_` : '');
  let out = String(body || '').replace(/\[media:(\d+)\]/g, (_, id) => {
    const m = byId.get(Number(id)) || media.get(Number(id)); if (!m || m.hidden) return '';
    used.add(m.id); return `\n\n${line(m)}\n\n`;
  });
  for (const m of attached) if (!used.has(m.id)) out += `\n\n${line(m)}`;
  return out.replace(/\n{3,}/g, '\n\n').trim();
}

/** A row of tiles for one day, as used on the crew log page and the station. */
function strip(items, opts) {
  const more = (opts && opts.more) || null;
  if (!items.length) return '';
  return `<div class="mstrip">${items.map((m) => tile(m)).join('')}${more ? `<a class="mtile more" href="${more.href}"><span class="mtile-visual"><span class="media-kind">+${more.n}</span></span><span class="mtile-text"><b>${esc(more.label)}</b></span></a>` : ''}</div>`;
}

/* ================================================================= GALLERY */

/** A moment as a clock reading in the venue's time — "14:20" — for the head
 *  line that says when the folder was last read. */
function hm(iso, tz = 'Europe/Berlin') {
  const d = new Date(iso || NaN);
  if (Number.isNaN(d.getTime())) return '';
  try { return new Intl.DateTimeFormat('en-GB', { timeZone: tz, hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).format(d); }
  catch { return d.toISOString().slice(11, 16); }
}
/** The head line's tail: when the folder was last read, and — when the
 *  latest read failed — that the cloud could not be reached, with the time.
 *  A failed read leaves the pictures already copied on the page, so without
 *  this a stalled bridge would look exactly like a quiet folder. */
function checkedLine(T, s, tz) {
  const last = s.lastPollAt ? ` · ${T('last at')} ${hm(s.lastPollAt, tz)}` : '';
  const failed = s.lastError ? `<span class="count cloud-fail">${T('the cloud could not be reached')}${s.lastError.at ? ` (${hm(s.lastError.at, tz)})` : ''}</span>` : '';
  return { last, failed };
}

/** When a cloud picture was taken, written under it as "18.09.2026 · 17:15"
 *  — the form the board uses for its dates. The moment comes from the file's
 *  name (src/lib/cloud.js reads year_month_day-hour-minute out of it, the
 *  venue's own clock, nothing to convert); a file named any other way shows
 *  its own date instead, in the venue's time. */
function cloudWhen(x, tz = 'Europe/Berlin') {
  if (x.taken) return { text: `${x.taken.date.slice(8, 10)}.${x.taken.date.slice(5, 7)}.${x.taken.date.slice(0, 4)} · ${x.taken.time}`, iso: x.taken.iso };
  const d = new Date(x.modified || NaN);
  if (Number.isNaN(d.getTime())) return null;
  try {
    const p = Object.fromEntries(new Intl.DateTimeFormat('en-GB', { timeZone: tz, hour12: false, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' })
      .formatToParts(d).filter((q) => q.type !== 'literal').map((q) => [q.type, q.value]));
    return { text: `${p.day}.${p.month}.${p.year} · ${p.hour === '24' ? '00' : p.hour}:${p.minute}`, iso: d.toISOString() };
  } catch { return null; }
}

/** One picture from the cloud folder as a tile: the preview, and under it the
 *  date and the time it was taken. */
function cloudTile(x, tz) {
  const when = cloudWhen(x, tz);
  return `<a class="mtile kind-image" href="${x.url}" data-id="${x.id}" title="${esc(x.name)}" target="_blank" rel="noopener">
      <span class="mtile-visual"><img src="${x.thumb}" alt="${esc(x.name)}" loading="lazy" decoding="async"></span>${
      when ? `<span class="mtile-text mtile-stamp"><time class="mtile-when" datetime="${esc(when.iso)}">${esc(when.text)}</time></span>` : ''}</a>`;
}

/** The cloud folder as a grid: every image, newest first, each opening the
 *  original. Drawn only when the bridge is configured; if the folder is
 *  empty or the cloud has not answered yet, it says so rather than vanishing. */
function cloudGrid(T, cloud, opts) {
  return `<section class="logpage-day media-day cloud-gallery" id="gallery" data-version="${esc(cloud.snapshot.version || '')}" data-poll="${(Number(cloud.snapshot.checkSeconds) || 20) * 1000}">${cloudGridInner(T, cloud, opts)}</section>`;
}

/** The grid's inside — the head and the tiles — on its own so the page can
 *  swap it in as the folder changes (public/cloud.js polls /api/cloud).
 *  `tz` is the venue's time zone, for a file whose name carries no time. */
function cloudGridInner(T, cloud, { tz } = {}) {
  const n = cloud.items.length, s = cloud.snapshot, line = checkedLine(T, s, tz);
  return `
    <div class="log-day-head">
      <span class="cs">${esc(T(cloud.title))}</span>
      <span>${n ? plural(T, n, 'photograph', 'photographs') : T('no photographs yet')} · ${T('checked every')} ${every(s.checkSeconds)}${line.last}</span>
      ${line.failed}
      <span class="cloud-live" title="${esc(T('Updates by itself as pictures arrive'))}"><i></i>${T('LIVE')}</span>
    </div>
    ${n ? `<div class="mgrid cloud-grid">${cloud.items.map((x) => cloudTile(x, tz)).join('')}</div>`
    : `<div class="empty" style="padding:28px">${T('Nothing in the folder yet')}.</div>`}`;
}

/** The newest few from the cloud folder, as a strip — the head of the
 *  landing page's dashboard carries it, kept live by public/cloud.js. Its
 *  head is the LIVE badge alone (the label is for screen readers; when the
 *  folder was checked is the badge's tooltip), and the orange line when the
 *  last read failed. */
function cloudLatestInner(T, cloud, { tz } = {}) {
  const items = cloud.items.slice(0, cloud.limit || 6), s = cloud.snapshot, line = checkedLine(T, s, tz);
  return `<div class="cloud-latest-head">
      <span class="lbl sr-only">${T('Live images from the Habitat')}</span>
      <span class="sub"><span class="cloud-live" title="${esc(T('Live images from the Habitat'))} · ${esc(T('checked every'))} ${every(s.checkSeconds)}${esc(line.last)} · ${esc(T('Updates by itself as pictures arrive'))}"><i></i>${T('LIVE')}</span>${line.failed}</span>
    </div>
    ${items.length ? `<div class="mstrip cloud-strip">${items.map((x) => cloudTile(x, tz)).join('')}</div>`
    : `<div class="empty" style="padding:18px">${T('Nothing in the folder yet')}.</div>`}`;
}

function gallery(ctx, { cloud = null }) {
  const T = ctx.T;
  // /media is the cloud gallery and nothing else: what the crew send out of
  // the habitat is shown where it belongs — in their entries on the crew
  // log, in At a Glance and on each item's own page.
  const body = cloud ? cloudGrid(T, cloud, { tz: ctx.mission && ctx.mission.timezone })
    : `<div class="empty" style="padding:40px;margin-top:26px">${T('The gallery is not connected yet')}.</div>`;

  return L.page({ title: 'Media', ctx, body, current: '/media', scripts: cloud ? ['/cloud.js'] : [],
    hero: L.masthead(ctx) + L.pageNav('/media', T), hideRail: true, hideNav: true, bodyClass: 'landing inner' });
}

/* ==================================================================== ITEM */

function player(m, T = same) {
  const src = media.fileUrl(m);
  if (m.kind === 'image') return `<img class="mview-img" src="${src}" alt="${esc(m.caption || m.filename)}">`;
  if (m.kind === 'video') return `<video class="mview-video" controls playsinline preload="metadata"${m.thumb_sha256 ? ` poster="${media.thumbUrl(m)}"` : ''}>
      <source src="${src}" type="${esc(m.mime)}">
      ${T('This browser cannot play this file in the page')} — <a href="${src}?download" download="${esc(m.filename)}">${T('download it')}</a> ${T('and open it locally.')}
    </video>
    <p class="note mview-note">${T('If it will not play here, the file is still whole: download it and open it in any player.')}</p>`;
  if (m.kind === 'audio') return `<audio class="mview-audio" controls preload="metadata"><source src="${src}" type="${esc(m.mime)}"></audio>`;
  if (m.kind === 'document' && m.mime === 'application/pdf') return `<iframe class="mview-doc" src="${src}" title="${esc(m.filename)}"></iframe>`;
  return `<div class="empty" style="padding:40px">${esc(m.filename)} · ${fmtBytes(m.bytes)} — <a href="${src}?download" download="${esc(m.filename)}">${T('download')}</a></div>`;
}

function item(ctx, { item: m, date, prev, next, position }) {
  const T = ctx.T;
  const body = `
  <div class="logpage-top mview-top">
    <div class="eyebrow">${T('Channel group')} 60 · ${T('Media')} · ${T('Day')} ${dd(m.mission_day)} · ${esc(missionLib.dayLabel(date))} <span class="brk">${position.i} ${T('of')} ${position.n} ${T('that day')}</span></div>
    <h1>${esc(m.caption || m.filename)}</h1>
    <p class="lede">${m.designation ? esc(m.designation) : T('Habitat')} · ${esc(T(m.kind))} · ${fmtBytes(m.bytes)}${m.width && m.height ? ` · ${m.width}×${m.height}` : ''}${m.duration_s ? ` · ${fmtDur(m.duration_s)}` : ''}${m.taken_at ? ` · ${T('made')} ${esc(m.taken_at)}` : ''}</p>
    <div class="actions">
      <a class="btn" href="/media#day-${m.mission_day}">${T('All media')}</a>
      <a class="btn" href="/logbook#day-${m.mission_day}">${T('That day’s log')}</a>
      ${prev ? `<a class="btn" href="${media.pageUrl(prev)}">← ${T('Previous')}</a>` : ''}
      ${next ? `<a class="btn" href="${media.pageUrl(next)}">${T('Next')} →</a>` : ''}
    </div>
  </div>
  <div class="mview">${player(m, T)}</div>
  <dl class="kv mview-kv">
    <dt>${T('FILE')}</dt><dd>${esc(m.filename)} · ${esc(m.mime)}</dd>
    <dt>${T('SIZE')}</dt><dd>${m.bytes.toLocaleString('en-GB')} ${T('bytes')}</dd>
    <dt>SHA-256</dt><dd class="mono">${esc(m.sha256)}</dd>
    <dt>${T('SENT')}</dt><dd>${esc(m.uploaded_at)}</dd>
    <dt>${T('DAY')}</dt><dd>${T('Mission day')} ${dd(m.mission_day)} · ${esc(missionLib.dayLabel(date))}</dd>
    ${m.caption ? `<dt>${T('CAPTION')}</dt><dd>${esc(m.caption)}</dd>` : ''}
  </dl>`;
  return L.page({ title: m.caption || m.filename, ctx, body, current: '/media',
    hero: L.masthead(ctx) + L.pageNav('/media', T), hideRail: true, hideNav: true, bodyClass: 'landing inner' });
}

module.exports = { gallery, item, tile, strip, figure, entryHtml, entryText, entryMarkdown, fmtBytes, cloudGridInner, cloudLatestInner };
