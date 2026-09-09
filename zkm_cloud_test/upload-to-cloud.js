#!/usr/bin/env node
// Upload pictures to the marsplatz folder on cloud.zkm.de.
//
//   node upload-to-cloud.js 1.png 2.jpg
//
// Needs only Node (18 or newer) — nothing to install. Fill in the three
// settings below once. Each file is sent over WebDAV into the folder; a file
// with the same name already there is replaced.

const CLOUD_URL = 'https://cloud.zkm.de';
const USER = 'system_displays';
const PASSWORD = 'EW8D3-mQEHS-ekrj8-54b8w-essDZ';
const FOLDER = 'marsplatz';

const fs = require('fs');
const path = require('path');

const files = process.argv.slice(2);
if (!files.length) { console.log('Usage: node upload-to-cloud.js 1.png 2.jpg ...'); process.exit(1); }

const MIME = { jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png', gif: 'image/gif', webp: 'image/webp', heic: 'image/heic', tif: 'image/tiff', tiff: 'image/tiff' };
const auth = 'Basic ' + Buffer.from(USER + ':' + PASSWORD).toString('base64');
const base = CLOUD_URL.replace(/\/+$/, '') + '/remote.php/dav/files/' + encodeURIComponent(USER) + '/' + FOLDER.split('/').map(encodeURIComponent).join('/') + '/';

(async () => {
  let failed = 0;
  for (const file of files) {
    const name = path.basename(file);
    if (!fs.existsSync(file)) { console.error('not found: ' + file); failed++; continue; }
    const ext = path.extname(name).slice(1).toLowerCase();
    try {
      const res = await fetch(base + encodeURIComponent(name), {
        method: 'PUT',
        headers: { Authorization: auth, 'Content-Type': MIME[ext] || 'application/octet-stream' },
        body: fs.readFileSync(file),
      });
      if (res.status === 201 || res.status === 204) console.log('uploaded ' + name);
      else if (res.status === 401 || res.status === 403) { console.error('the cloud refused the sign-in (HTTP ' + res.status + ') — check USER and PASSWORD'); failed++; }
      else if (res.status === 404 || res.status === 409) { console.error('folder /' + FOLDER + ' not found on the cloud (HTTP ' + res.status + ')'); failed++; }
      else { console.error(name + ': HTTP ' + res.status); failed++; }
    } catch (e) { console.error(name + ': ' + e.message); failed++; }
  }
  console.log(failed ? (files.length - failed) + ' uploaded, ' + failed + ' failed' : 'done — ' + files.length + ' uploaded');
  process.exit(failed ? 1 : 0);
})();
