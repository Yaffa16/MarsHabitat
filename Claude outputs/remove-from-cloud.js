#!/usr/bin/env node
// Remove pictures from the marsplatz folder on cloud.zkm.de.
//
//   node remove-from-cloud.js 1.png 2.jpg      remove these files from the folder
//   node remove-from-cloud.js --list           show what is in the folder now
//   node remove-from-cloud.js --all            remove every file in the folder (asks first)
//
// Needs only Node (18 or newer) — nothing to install. The same three settings
// as upload-to-cloud.js. Files go to the cloud's own trash bin, where
// Nextcloud keeps them for a while, so a mistake can be undone there.

const CLOUD_URL = 'https://cloud.zkm.de';
const USER = 'system_displays';
const PASSWORD = 'EW8D3-mQEHS-ekrj8-54b8w-essDZ';
const FOLDER = 'marsplatz';

const readline = require('readline');

const args = process.argv.slice(2);
const listOnly = args.includes('--list');
const all = args.includes('--all');
const names = args.filter((a) => !a.startsWith('--'));
if (!listOnly && !all && !names.length) {
  console.log('Usage: node remove-from-cloud.js 1.png 2.jpg\n       node remove-from-cloud.js --list\n       node remove-from-cloud.js --all');
  process.exit(1);
}

const auth = 'Basic ' + Buffer.from(USER + ':' + PASSWORD).toString('base64');
const base = CLOUD_URL.replace(/\/+$/, '') + '/remote.php/dav/files/' + encodeURIComponent(USER) + '/' + FOLDER.split('/').map(encodeURIComponent).join('/') + '/';

function refused(res) {
  if (res.status === 401 || res.status === 403) return 'the cloud refused the sign-in (HTTP ' + res.status + ') — check USER and PASSWORD';
  if (res.status === 404) return 'folder /' + FOLDER + ' not found on the cloud';
  return null;
}

/** The files directly in the folder (subfolders are named but left alone). */
async function list() {
  const res = await fetch(base, { method: 'PROPFIND', headers: { Authorization: auth, Depth: '1' } });
  const bad = refused(res); if (bad) throw new Error(bad);
  if (res.status !== 207) throw new Error('the cloud answered HTTP ' + res.status + ' to the listing');
  const xml = await res.text();
  const out = [];
  for (const block of xml.split(/<\/d:response>/i)) {
    const m = /<d:href>([^<]*)<\/d:href>/i.exec(block); if (!m) continue;
    const href = decodeURIComponent(m[1].replace(/&amp;/g, '&'));
    const rel = href.slice(new URL(base).pathname.length).replace(/\/+$/, '');
    if (!rel) continue;   // the folder itself
    out.push({ name: rel, isDir: /<d:collection\s*\/?>/i.test(block) });
  }
  return out;
}

async function remove(name) {
  const res = await fetch(base + encodeURIComponent(name), { method: 'DELETE', headers: { Authorization: auth } });
  if (res.status === 204 || res.status === 200) return null;
  if (res.status === 404) return 'not in the folder';
  return refused(res) || 'HTTP ' + res.status;
}

const ask = (q) => new Promise((resolve) => { const rl = readline.createInterface({ input: process.stdin, output: process.stdout }); rl.question(q, (a) => { rl.close(); resolve(a.trim()); }); });

(async () => {
  try {
    if (listOnly) {
      const items = await list();
      if (!items.length) { console.log('/' + FOLDER + ' is empty'); return; }
      for (const it of items) console.log((it.isDir ? '[folder] ' : '         ') + it.name);
      console.log(items.filter((i) => !i.isDir).length + ' files in /' + FOLDER);
      return;
    }
    let targets = names;
    if (all) {
      targets = (await list()).filter((i) => !i.isDir).map((i) => i.name);
      if (!targets.length) { console.log('/' + FOLDER + ' is already empty'); return; }
      console.log('This removes ' + targets.length + ' files from /' + FOLDER + ':\n  ' + targets.join('\n  '));
      if ((await ask('Type YES to go ahead: ')) !== 'YES') { console.log('Nothing removed.'); return; }
    }
    let failed = 0;
    for (const name of targets) {
      const err = await remove(name);
      if (err) { console.error(name + ': ' + err); failed++; } else console.log('removed ' + name);
    }
    console.log(failed ? (targets.length - failed) + ' removed, ' + failed + ' failed' : 'done — ' + targets.length + ' removed');
    process.exit(failed ? 1 : 0);
  } catch (e) { console.error(e.message || e); process.exit(1); }
})();
