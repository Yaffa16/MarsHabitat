'use strict';
/**
 * The cloud gallery: photographs kept on the ZKM cloud (Nextcloud,
 * cloud.zkm.de), read over WebDAV and shown as a grid on /media.
 *
 * The station server signs in with the display account (CLOUD_USER and
 * CLOUD_PASSWORD in .env — never in the repository, never sent to a
 * browser), lists the folder (CLOUD_FOLDER, the account's root when empty)
 * every CLOUD_CHECK_SECONDS, and keeps a copy of every image on the station-data
 * volume under /data/cloud, beside a manifest. The browser only ever talks
 * to the station: /media/cloud/<id> serves the copy, /media/cloud/<id>/thumb
 * a preview that Nextcloud rendered. So the grid stands with the cloud
 * slow, unreachable or the venue network unplugged, and the credentials
 * stay on the server.
 *
 * Nothing is written to the cloud, ever: this is a read-only mirror. A file
 * that disappears from the folder disappears from the grid on the next
 * poll; its copy stays on the volume until the folder is cleared by hand.
 *
 * A second way in, for a machine where the cloud folder is already mounted
 * (davfs2 and an fstab line, as ZKM's IT set it up): CLOUD_DIR names that
 * directory, and the station reads the images from it instead of over the
 * network — same listing, same copies, same grid; only no previews, so the
 * grid draws the originals scaled down. With CLOUD_DIR set, CLOUD_USER and
 * CLOUD_PASSWORD are not needed.
 */
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { DATA_DIR } = require('../db');

const CFG = {
  url: (process.env.CLOUD_URL || 'https://cloud.zkm.de').trim().replace(/\/+$/, ''),
  user: (process.env.CLOUD_USER || '').trim(),
  password: (process.env.CLOUD_PASSWORD || '').trim(),
  folder: (process.env.CLOUD_FOLDER || '').trim().replace(/^\/+|\/+$/g, ''),
  // The frequency: how often the folder is checked for new images, in
  // seconds. One number in .env — CLOUD_CHECK_SECONDS, 1200 (twenty minutes)
  // by default — that sets both the station's read of the folder (one small
  // PROPFIND) and how often an open /media asks the station for the grid, so
  // a picture put in the folder is on every open page within about that long.
  checkSeconds: Math.max(5, Number(process.env.CLOUD_CHECK_SECONDS || (Number(process.env.CLOUD_POLL_MS) ? Number(process.env.CLOUD_POLL_MS) / 1000 : 1200))),
  timeoutMs: Number(process.env.CLOUD_TIMEOUT_MS || 20000),
  maxBytes: Number(process.env.CLOUD_MAX_MB || 60) * 1048576,
  maxFiles: Number(process.env.CLOUD_MAX_FILES || 500),
  depth: Number(process.env.CLOUD_DEPTH || 3),            // subfolders followed this deep
  thumb: Number(process.env.CLOUD_THUMB || 960),           // preview width, px (16:9 → 960×540)
  sort: process.env.CLOUD_SORT === 'name' ? 'name' : 'newest',
  title: (process.env.CLOUD_TITLE || 'Gallery').trim(),
  dir: (process.env.CLOUD_DIR || '').trim(),                // a mounted copy of the folder, instead of WebDAV
};
const fromDir = () => !!CFG.dir;
const configured = () => process.env.CLOUD_POLL !== 'false' && (fromDir() || !!(CFG.user && CFG.password));

const DIR = path.join(DATA_DIR, 'cloud');
const MANIFEST = path.join(DIR, 'manifest.json');
const IMAGE = { jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png', gif: 'image/gif', webp: 'image/webp', avif: 'image/avif', heic: 'image/heic', heif: 'image/heif', tif: 'image/tiff', tiff: 'image/tiff', bmp: 'image/bmp', svg: 'image/svg+xml' };

/* ------------------------------------------------------------------ state */

let items = [];              // the folder as last listed, images only, in order
const status = { lastPollAt: null, lastError: null, listed: 0, cached: 0, polling: false, folder: fromDir() ? CFG.dir : (CFG.folder || '/') };
let timer = null;

function loadManifest() {
  try { const j = JSON.parse(fs.readFileSync(MANIFEST, 'utf8')); items = Array.isArray(j.items) ? j.items : []; status.lastPollAt = j.generatedAt ? Date.parse(j.generatedAt) : null; }
  catch { items = []; }
}
function saveManifest() {
  fs.mkdirSync(DIR, { recursive: true });
  const out = { source: CFG.url, folder: status.folder, generatedAt: new Date().toISOString(), count: items.length,
    note: 'A read-only mirror of the cloud folder. Each item: its path on the cloud, size, last change, and the station\'s cached copy.', items };
  fs.writeFileSync(MANIFEST, JSON.stringify(out, null, 2) + '\n');
}

/* ----------------------------------------------------------------- WebDAV */

const auth = () => 'Basic ' + Buffer.from(`${CFG.user}:${CFG.password}`).toString('base64');
const davRoot = () => `${CFG.url}/remote.php/dav/files/${encodeURIComponent(CFG.user)}/`;
const encodePath = (p) => p.split('/').map(encodeURIComponent).join('/');

async function request(url, opts = {}) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), CFG.timeoutMs);
  try {
    return await fetch(url, { ...opts, signal: ctrl.signal, headers: { Authorization: auth(), ...(opts.headers || {}) } });
  } finally { clearTimeout(t); }
}

const unxml = (s) => String(s || '').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&amp;/g, '&');

/** One PROPFIND at depth 1: the entries directly inside a folder. */
async function list(folder) {
  const url = davRoot() + (folder ? encodePath(folder) + '/' : '');
  const res = await request(url, {
    method: 'PROPFIND',
    headers: { Depth: '1', 'Content-Type': 'application/xml; charset=utf-8' },
    body: '<?xml version="1.0"?><d:propfind xmlns:d="DAV:" xmlns:oc="http://owncloud.org/ns"><d:prop>'
      + '<d:resourcetype/><d:getcontenttype/><d:getcontentlength/><d:getlastmodified/><d:getetag/><oc:fileid/>'
      + '</d:prop></d:propfind>',
  });
  if (res.status === 401 || res.status === 403) throw new Error(`the cloud refused the sign-in (HTTP ${res.status}) — check CLOUD_USER and CLOUD_PASSWORD`);
  if (res.status === 404) throw new Error(`folder not found on the cloud: /${folder || ''} — check CLOUD_FOLDER`);
  if (res.status !== 207) throw new Error(`the cloud answered HTTP ${res.status} to the folder listing`);
  const xml = await res.text();
  const out = [];
  const basePath = new URL(url).pathname.replace(/\/+$/, '');
  for (const block of xml.split(/<\/d:response>/i).slice(0, -1)) {
    const href = /<d:href>([^<]*)<\/d:href>/i.exec(block);
    if (!href) continue;
    const hrefPath = decodeURIComponent(unxml(href[1])).replace(/\/+$/, '');
    if (hrefPath === basePath) continue;                        // the folder itself
    const rel = hrefPath.startsWith(basePath + '/') ? hrefPath.slice(basePath.length + 1) : path.posix.basename(hrefPath);
    const isDir = /<d:collection\s*\/?>/i.test(block);
    const size = Number((/<d:getcontentlength>(\d+)</i.exec(block) || [])[1] || 0);
    const modified = (/<d:getlastmodified>([^<]*)</i.exec(block) || [])[1] || null;
    const etag = unxml((/<d:getetag>([^<]*)</i.exec(block) || [])[1] || '').replace(/"/g, '');
    const fileId = (/<oc:fileid>(\d+)</i.exec(block) || [])[1] || null;
    const mime = unxml((/<d:getcontenttype>([^<]*)</i.exec(block) || [])[1] || '');
    out.push({ name: rel, path: folder ? `${folder}/${rel}` : rel, isDir, size, modified, etag, fileId, mime });
  }
  return out;
}

/** The mounted folder, read like the cloud: every image, subfolders followed. */
function listDir() {
  if (!fs.existsSync(CFG.dir)) throw new Error(`CLOUD_DIR does not exist or is not mounted: ${CFG.dir}`);
  const found = [];
  const walk = (dir, rel, depth) => {
    let names;
    try { names = fs.readdirSync(dir).sort(); } catch (e) { throw new Error(`cannot read ${dir}: ${e.message}`); }
    for (const name of names) {
      if (name.startsWith('.') || name === 'lost+found') continue;
      const p = path.join(dir, name), st = fs.statSync(p);
      const relPath = rel ? `${rel}/${name}` : name;
      if (st.isDirectory()) { if (depth < CFG.depth) walk(p, relPath, depth + 1); continue; }
      const ext = path.extname(name).slice(1).toLowerCase();
      if (!IMAGE[ext]) continue;
      found.push({ name: relPath, path: relPath, local: p, size: st.size, modified: st.mtime.toUTCString(),
        etag: `${st.size}-${Math.round(st.mtimeMs)}`, fileId: null, mime: IMAGE[ext], ext,
        added: Math.round(st.ctimeMs) });   // when it landed in the folder, whatever date the picture itself carries
      if (found.length >= CFG.maxFiles) return;
    }
  };
  walk(CFG.dir, '', 0);
  return found;
}

/** The whole folder, subfolders followed, images only. */
async function listImages() {
  if (fromDir()) return listDir();
  const found = [];
  const walk = async (folder, depth) => {
    for (const e of await list(folder)) {
      if (e.isDir) { if (depth < CFG.depth) await walk(e.path, depth + 1); continue; }
      const ext = path.posix.extname(e.name).slice(1).toLowerCase();
      if (!IMAGE[ext] && !/^image\//.test(e.mime)) continue;
      found.push({ ...e, ext: IMAGE[ext] ? ext : 'jpg', mime: IMAGE[ext] || e.mime });
      if (found.length >= CFG.maxFiles) return;
    }
  };
  await walk(CFG.folder, 0);
  return found;
}

/* ------------------------------------------------------------------ cache */

const idOf = (p) => crypto.createHash('sha1').update(p).digest('hex').slice(0, 16);
const filePath = (it) => path.join(DIR, `${it.id}.${it.ext}`);
const thumbPath = (it) => path.join(DIR, `${it.id}.thumb.jpg`);

async function download(url, dest) {
  const res = await request(url);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const buf = Buffer.from(await res.arrayBuffer());
  fs.mkdirSync(DIR, { recursive: true });
  fs.writeFileSync(dest + '.part', buf);
  fs.renameSync(dest + '.part', dest);
  return buf.length;
}

/** The original, once, unless it changed on the cloud. */
async function cacheFile(it) {
  if (it.size > CFG.maxBytes) { it.tooBig = true; return false; }
  const dest = filePath(it);
  if (fs.existsSync(dest) && it.cachedEtag === it.etag) return true;
  if (it.local) { fs.mkdirSync(DIR, { recursive: true }); fs.copyFileSync(it.local, dest + '.part'); fs.renameSync(dest + '.part', dest); }
  else await download(davRoot() + encodePath(it.path), dest);
  it.cachedEtag = it.etag;
  return true;
}

/** A preview rendered by Nextcloud, by file id — small, JPEG, quick to
 *  draw in a grid. When the cloud will not render one, the grid falls back
 *  to the original. */
async function cacheThumb(it) {
  const dest = thumbPath(it);
  if (fs.existsSync(dest) && it.thumbEtag === it.etag) return true;
  if (fromDir() || !it.fileId) return false;
  // a=1 keeps the picture's own proportions (1920×1080 comes back 16:9,
  // fitted inside the box, never cropped to a square)
  const url = `${CFG.url}/index.php/core/preview?fileId=${encodeURIComponent(it.fileId)}&x=${CFG.thumb}&y=${Math.round(CFG.thumb * 9 / 16)}&a=1&forceIcon=0`;
  try { await download(url, dest); it.thumbEtag = it.etag; return true; }
  catch { return false; }
}

/* ---------------------------------------------------------------- polling */

async function poll() {
  if (!configured() || status.polling) return;
  status.polling = true;
  try {
    const listed = await listImages();
    const before = new Map(items.map((i) => [i.id, i]));
    const next = listed.map((e) => {
      const id = idOf(e.path);
      const prev = before.get(id) || {};
      return { id, path: e.path, name: e.name, size: e.size, modified: e.modified, etag: e.etag, fileId: e.fileId, mime: e.mime, ext: e.ext, local: e.local || null,
        cachedEtag: prev.cachedEtag || null, thumbEtag: prev.thumbEtag || null, tooBig: false,
        // when it was ADDED to the folder — not the date the picture carries,
        // which a camera or a phone may have set days earlier: on the cloud
        // Nextcloud numbers every file as it arrives (oc:fileid, ever rising),
        // in a mounted folder the file's change time; and the moment the
        // station first saw it breaks any tie
        added: e.added || (e.fileId ? Number(e.fileId) : 0),
        seenAt: prev.seenAt || Date.now() };
    });
    const when = (it) => Date.parse(it.modified) || 0;
    next.sort(CFG.sort === 'name'
      ? (a, b) => a.path.localeCompare(b.path, undefined, { numeric: true })
      : (a, b) => (b.added - a.added) || (b.seenAt - a.seenAt) || (when(b) - when(a)) || b.path.localeCompare(a.path, undefined, { numeric: true }));
    let cached = 0;
    for (const it of next) {
      try { if (await cacheFile(it)) cached++; } catch (e) { it.error = `copy: ${e.message}`; }
      await cacheThumb(it);
    }
    items = next;
    status.listed = next.length; status.cached = cached;
    status.lastPollAt = Date.now(); status.lastError = null;
    saveManifest();
    console.log(`[cloud] ${next.length} image${next.length === 1 ? '' : 's'} in ${fromDir() ? CFG.dir : `/${CFG.folder || ''} on ${CFG.url}`}, ${cached} cached`);
  } catch (e) {
    status.lastError = { at: Date.now(), message: e.message || String(e) };
    console.warn('[cloud]', e.message || e);
  } finally { status.polling = false; }
}

function start() {
  loadManifest();
  status.listed = items.length;
  if (!configured()) { console.log('[cloud] not configured (set CLOUD_USER and CLOUD_PASSWORD, or CLOUD_DIR, in .env) — the gallery stays off /media'); return; }
  if (timer) return;
  timer = setInterval(() => poll().catch(() => {}), CFG.checkSeconds * 1000);
  timer.unref();
  poll().catch(() => {});
}

/* ------------------------------------------------------------------- read */

/** The grid: every image, in order, with where the station serves it from. */
function gallery() {
  return items.filter((it) => !it.tooBig && fs.existsSync(filePath(it))).map((it) => ({
    id: it.id, name: it.name, path: it.path, size: it.size, modified: it.modified, added: it.added, mime: it.mime,
    url: `/media/cloud/${it.id}`, thumb: fs.existsSync(thumbPath(it)) ? `/media/cloud/${it.id}/thumb` : `/media/cloud/${it.id}`,
  }));
}
const get = (id) => items.find((it) => it.id === id) || null;

/** A stamp that changes whenever the grid would: which images, in which
 *  order, which of them are copied and previewed. */
function version() {
  const h = crypto.createHash('sha1');
  for (const it of items) h.update(`${it.id}|${it.etag}|${it.cachedEtag || ''}|${it.thumbEtag || ''}|${it.tooBig ? 1 : 0};`);
  return h.digest('hex').slice(0, 12);
}

function snapshot() {
  return { configured: configured(), source: fromDir() ? 'mounted folder' : CFG.url, mode: fromDir() ? 'dir' : 'webdav', folder: status.folder, title: CFG.title, checkSeconds: CFG.checkSeconds, pollMs: CFG.checkSeconds * 1000, version: version(),
    listed: status.listed, cached: status.cached, shown: gallery().length,
    lastPollAt: status.lastPollAt ? new Date(status.lastPollAt).toISOString() : null,
    lastError: status.lastError ? { at: new Date(status.lastError.at).toISOString(), message: status.lastError.message } : null,
    tooBig: items.filter((i) => i.tooBig).map((i) => i.path) };
}

module.exports = { CFG, DIR, configured, start, poll, gallery, get, filePath, thumbPath, snapshot };
