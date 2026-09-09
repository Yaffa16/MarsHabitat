#!/usr/bin/env node
'use strict';
/**
 * Put photographs into the cloud folder the gallery reads.
 *
 *   node tools/cloud-upload.js photo.jpg another.png            two files
 *   node tools/cloud-upload.js ~/Pictures/marsplatz/             every image in a folder (subfolders too)
 *   node tools/cloud-upload.js --to marsplatz/day-05 *.jpg       into a subfolder (made if missing)
 *   node tools/cloud-upload.js --overwrite photo.jpg             replace a file already there
 *   node tools/cloud-upload.js --dry-run ~/Pictures/marsplatz/   say what would happen, send nothing
 *
 * Where and as whom comes from .env, the same lines the station reads:
 * CLOUD_URL, CLOUD_USER, CLOUD_PASSWORD and CLOUD_FOLDER (the default
 * destination; --to overrides it). Sends over WebDAV, one PUT per file, and
 * skips a file the folder already has unless --overwrite. Only image types
 * the gallery shows are sent; anything else is named and left out.
 *
 * The station reads the folder on its own cycle (CLOUD_POLL_MS, five minutes
 * by default); press "Read the folder now" on mission control's Habitat tab
 * to see them sooner.
 */
require('../src/lib/env');
const fs = require('fs');
const path = require('path');

const IMAGE = new Set(['jpg', 'jpeg', 'png', 'gif', 'webp', 'avif', 'heic', 'heif', 'tif', 'tiff', 'bmp', 'svg']);
const MIME = { jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png', gif: 'image/gif', webp: 'image/webp', avif: 'image/avif', heic: 'image/heic', heif: 'image/heif', tif: 'image/tiff', tiff: 'image/tiff', bmp: 'image/bmp', svg: 'image/svg+xml' };

const args = process.argv.slice(2);
const flag = (name) => { const i = args.indexOf(name); if (i < 0) return false; args.splice(i, 1); return true; };
const opt = (name) => { const i = args.indexOf(name); if (i < 0) return null; const v = args[i + 1]; args.splice(i, 2); return v; };
const dryRun = flag('--dry-run');
const overwrite = flag('--overwrite');
const quiet = flag('--quiet');
const to = opt('--to');
if (flag('--help') || flag('-h') || !args.length) {
  const lines = fs.readFileSync(__filename, 'utf8').split('\n');
  console.log(lines.slice(3, lines.indexOf(' */')).map((l) => l.replace(/^ \*\s?/, '')).join('\n'));
  process.exit(args.length ? 0 : 1);
}

const CFG = {
  url: (process.env.CLOUD_URL || 'https://cloud.zkm.de').trim().replace(/\/+$/, ''),
  user: (process.env.CLOUD_USER || '').trim(),
  password: (process.env.CLOUD_PASSWORD || '').trim(),
  folder: (to !== null ? to : (process.env.CLOUD_FOLDER || '')).trim().replace(/^\/+|\/+$/g, ''),
};
if (!CFG.user || !CFG.password) {
  console.error('CLOUD_USER and CLOUD_PASSWORD are needed — put them in .env (see .env.example).');
  process.exit(2);
}

const auth = 'Basic ' + Buffer.from(`${CFG.user}:${CFG.password}`).toString('base64');
const root = `${CFG.url}/remote.php/dav/files/${encodeURIComponent(CFG.user)}/`;
const enc = (p) => p.split('/').filter(Boolean).map(encodeURIComponent).join('/');
const say = (...a) => { if (!quiet) console.log(...a); };

async function dav(method, rel, opts = {}) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), opts.timeout || 120000);
  try {
    return await fetch(root + enc(rel) + (opts.dir ? '/' : ''), { method, body: opts.body, signal: ctrl.signal,
      headers: { Authorization: auth, ...(opts.headers || {}) } });
  } finally { clearTimeout(t); }
}

/** Make the folder and every folder above it, quietly, if they are not there. */
async function ensureFolder(folder) {
  if (!folder) return;
  const parts = folder.split('/');
  for (let i = 1; i <= parts.length; i++) {
    const p = parts.slice(0, i).join('/');
    const head = await dav('PROPFIND', p, { dir: true, headers: { Depth: '0' } });
    if (head.status === 207) continue;
    if (head.status === 401 || head.status === 403) throw new Error(`the cloud refused the sign-in (HTTP ${head.status}) — check CLOUD_USER and CLOUD_PASSWORD`);
    if (dryRun) { say(`  would make folder /${p}`); continue; }
    const mk = await dav('MKCOL', p, { dir: true });
    if (mk.status !== 201) throw new Error(`could not make folder /${p} (HTTP ${mk.status})`);
    say(`  made folder /${p}`);
  }
}

async function exists(rel) {
  const r = await dav('PROPFIND', rel, { headers: { Depth: '0' } });
  if (r.status === 207) return true;
  if (r.status === 404) return false;
  if (r.status === 401 || r.status === 403) throw new Error(`the cloud refused the sign-in (HTTP ${r.status}) — check CLOUD_USER and CLOUD_PASSWORD`);
  throw new Error(`HTTP ${r.status} asking about ${rel}`);
}

/** Every image under the paths given, as { local, name } — a folder's
 *  structure below it is kept on the cloud. */
function collect(paths) {
  const out = [], skipped = [];
  const walk = (p, base) => {
    const st = fs.statSync(p);
    if (st.isDirectory()) { for (const n of fs.readdirSync(p).sort()) if (!n.startsWith('.')) walk(path.join(p, n), base); return; }
    const ext = path.extname(p).slice(1).toLowerCase();
    if (!IMAGE.has(ext)) { skipped.push(p); return; }
    out.push({ local: p, name: base ? path.relative(base, p).split(path.sep).join('/') : path.basename(p), ext, size: st.size });
  };
  for (const p of paths) {
    if (!fs.existsSync(p)) { console.error(`not found: ${p}`); process.exitCode = 1; continue; }
    walk(p, fs.statSync(p).isDirectory() ? p : null);
  }
  return { files: out, skipped };
}

(async () => {
  const { files, skipped } = collect(args);
  if (skipped.length) say(`Not images, left out: ${skipped.map((s) => path.basename(s)).join(', ')}`);
  if (!files.length) { console.error('Nothing to send.'); process.exit(1); }
  say(`${dryRun ? 'Would send' : 'Sending'} ${files.length} image${files.length === 1 ? '' : 's'} to ${CFG.url} as ${CFG.user}, folder /${CFG.folder}`);
  try {
    await ensureFolder(CFG.folder);
    const subs = new Set(files.map((f) => path.posix.dirname(f.name)).filter((d) => d && d !== '.'));
    for (const s of [...subs].sort()) await ensureFolder(CFG.folder ? `${CFG.folder}/${s}` : s);
    let sent = 0, kept = 0, failed = 0, bytes = 0;
    for (const f of files) {
      const rel = CFG.folder ? `${CFG.folder}/${f.name}` : f.name;
      if (!overwrite && await exists(rel)) { say(`  = ${f.name} (already there)`); kept++; continue; }
      if (dryRun) { say(`  + ${f.name} (${(f.size / 1048576).toFixed(1)} MB)`); sent++; bytes += f.size; continue; }
      const r = await dav('PUT', rel, { body: fs.readFileSync(f.local), headers: { 'Content-Type': MIME[f.ext] || 'application/octet-stream' }, timeout: 600000 });
      if (r.status === 201 || r.status === 204) { say(`  + ${f.name} (${(f.size / 1048576).toFixed(1)} MB)`); sent++; bytes += f.size; }
      else { console.error(`  ! ${f.name}: HTTP ${r.status}`); failed++; }
    }
    say(`${dryRun ? 'Would send' : 'Sent'} ${sent} (${(bytes / 1048576).toFixed(1)} MB)${kept ? `, ${kept} already there` : ''}${failed ? `, ${failed} failed` : ''}.`);
    if (sent && !dryRun) say('The station reads the folder on its next cycle; "Read the folder now" on the Habitat tab shows them sooner.');
    process.exit(failed ? 1 : 0);
  } catch (e) {
    console.error(e.message || e);
    process.exit(1);
  }
})();
