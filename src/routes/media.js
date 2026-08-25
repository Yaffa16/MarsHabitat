'use strict';
/**
 * The public side of the media archive: the gallery, one item, the file
 * itself, and the downloads — a single file, a day, or the whole run as one
 * ZIP with its manifest inside.
 */
const express = require('express');
const fs = require('fs');
const path = require('path');
const media = require('../lib/media');
const { writeZip } = require('../lib/zip');
const missionLib = require('../lib/mission');
const data = require('../lib/data');
const M = require('../views/pages/media');

const router = express.Router();

/* ---------------------------------------------------------------- gallery */

router.get('/', (req, res) => {
  const ctx = req.ctx();
  const kind = ['image', 'video', 'audio', 'document'].includes(req.query.kind) ? req.query.kind : null;
  const crewId = Number(req.query.crew) || null;
  res.send(M.gallery(ctx, {
    days: media.byDay({ kind, crewId }).map((d) => ({ ...d, date: missionLib.dateForDay(d.missionDay) })),
    counts: media.counts(), crew: data.crewWithMood(), filters: { kind, crewId },
  }));
});

router.get('/manifest.json', (req, res) => {
  res.set('Cache-Control', 'no-store').attachment('mars-station-media-manifest.json').json(media.manifest());
});

/* ------------------------------------------------------------------- files */

function findVisible(req, res, next) {
  const m = media.get(req.params.id);
  if (!m || m.hidden) return next('route');   // on to the 404, not to this route's handler
  if (!media.exists(m)) return res.status(410).type('text').send('The file for this item is missing from the archive volume.');
  req.item = m;
  next();
}

/** The original, inline or as a download. Content-addressed, so it may be
 *  cached forever; the ETag is the hash itself. */
router.get('/file/:id/:name?', findVisible, (req, res) => {
  const m = req.item;
  res.set({
    'Content-Type': m.mime,
    'ETag': `"${m.sha256}"`,
    'Cache-Control': 'public, max-age=31536000, immutable',
    'X-Content-Type-Options': 'nosniff',
    'Content-Disposition': `${req.query.download != null ? 'attachment' : 'inline'}; filename*=UTF-8''${encodeURIComponent(m.filename)}`,
  });
  res.sendFile(media.pathOf(m), { acceptRanges: true, lastModified: false, cacheControl: false, etag: false });
});

router.get('/thumb/:id.jpg', (req, res, next) => {
  const m = media.get(req.params.id);
  const p = m && !m.hidden ? media.thumbPathOf(m) : null;
  if (!p || !fs.existsSync(p)) return next('route');
  res.set({ 'Content-Type': 'image/jpeg', 'Cache-Control': 'public, max-age=31536000, immutable', 'ETag': `"${m.thumb_sha256}"` });
  res.sendFile(p, { lastModified: false, cacheControl: false, etag: false });
});

/* --------------------------------------------------------------- downloads */

const dd = (n) => String(n).padStart(3, '0');

/** Everything visible, one ZIP: day folders, original names (made unique),
 *  the manifest and a README. Stored, not deflated, streamed as it goes. */
async function sendZip(res, items, label) {
  const st = missionLib.state();
  const seen = new Set();
  const entries = items.map((m) => {
    let name = `day-${dd(m.mission_day)}/${m.filename}`;
    if (seen.has(name)) {
      const ext = path.extname(m.filename), base = m.filename.slice(0, -ext.length || undefined);
      name = `day-${dd(m.mission_day)}/${base}-${m.sha256.slice(0, 8)}${ext}`;
    }
    seen.add(name);
    return { name, path: media.pathOf(m), size: m.bytes, mtime: new Date(m.uploaded_at), item: m };
  }).filter((e) => fs.existsSync(e.path));
  const manifest = {
    mission: { name: st.name, start: st.start_date, end: st.end_date, timezone: st.timezone },
    generatedAt: new Date().toISOString(),
    note: 'Files are stored uncompressed. Each file\'s SHA-256 is listed; `sha256sum` any file to check it.',
    items: entries.map((e) => ({ path: e.name, ...media.describe(e.item) })),
  };
  const readme = [
    `MARS Communication Station — media archive (${label})`,
    `Mission: ${st.name}, ${st.start_date} to ${st.end_date} (${st.timezone})`,
    `Generated: ${manifest.generatedAt}`,
    '',
    'One folder per mission day. Files are the originals as they left the habitat:',
    'nothing has been re-encoded or resized. manifest.json lists every file with its',
    'mission day, who made it, its caption, and its SHA-256, so any copy of this',
    'archive can be checked file by file.',
    '',
    'ZKM | Hertzlab',
  ].join('\n') + '\n';
  entries.push({ name: 'manifest.json', data: Buffer.from(JSON.stringify(manifest, null, 2) + '\n') });
  entries.push({ name: 'README.txt', data: Buffer.from(readme) });

  res.set({
    'Content-Type': 'application/zip',
    'Content-Disposition': `attachment; filename="mars-station-media-${label}.zip"`,
    'Cache-Control': 'no-store',
  });
  try { await writeZip(res, entries, { comment: `MARS station media — ${label}` }); res.end(); }
  catch (e) { if (!res.headersSent) res.status(500).type('text').send(e.message); else res.destroy(); }
}

router.get('/export.zip', (req, res) => sendZip(res, media.list(), new Date().toISOString().slice(0, 10)));
router.get('/day/:n/export.zip', (req, res, next) => {
  const n = Number(req.params.n);
  if (!Number.isInteger(n) || n < 1) return next();
  sendZip(res, media.list({ day: n }), `day-${dd(n)}`);
});

/* -------------------------------------------------------------------- item */

router.get('/:id(\\d+)', findVisible, (req, res) => {
  const ctx = req.ctx();
  const m = req.item;
  const siblings = media.list({ day: m.mission_day });
  const i = siblings.findIndex((x) => x.id === m.id);
  res.send(M.item(ctx, {
    item: m, date: missionLib.dateForDay(m.mission_day),
    prev: i > 0 ? siblings[i - 1] : null, next: i >= 0 && i < siblings.length - 1 ? siblings[i + 1] : null,
    position: { i: i + 1, n: siblings.length },
  }));
});

module.exports = router;
