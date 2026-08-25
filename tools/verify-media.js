#!/usr/bin/env node
'use strict';
/**
 * Check a media folder against its own manifest: every file listed must be
 * present and hash to the SHA-256 recorded for it. Works on the live volume
 * or on any copy of it — a backup, a USB stick, an unpacked export ZIP.
 *
 *   node tools/verify-media.js                 # the station's own DATA_DIR/media
 *   node tools/verify-media.js ./backups/media # a copy
 *   node tools/verify-media.js ./unpacked-zip  # an unpacked /media/export.zip
 */
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const dir = process.argv[2] || path.join(process.env.DATA_DIR || path.join(__dirname, '../data'), 'media');
const manifestPath = path.join(dir, 'manifest.json');
if (!fs.existsSync(manifestPath)) { console.error(`no manifest.json in ${dir}`); process.exit(2); }
const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));

function sha256(file) {
  return new Promise((resolve, reject) => {
    const h = crypto.createHash('sha256');
    fs.createReadStream(file).on('data', (c) => h.update(c)).on('end', () => resolve(h.digest('hex'))).on('error', reject);
  });
}

(async () => {
  let ok = 0, bad = 0;
  for (const item of manifest.items) {
    // a volume copy keeps files under media/<xx>/<sha>.<ext>; an unpacked ZIP
    // keeps them under day-NNN/<name>. Accept either.
    const candidates = [
      item.storedAs ? path.join(dir, item.storedAs.replace(/^media\//, '')) : null,
      item.path ? path.join(dir, item.path) : null,
    ].filter(Boolean);
    const file = candidates.find((c) => fs.existsSync(c));
    if (!file) { bad++; console.log(`MISSING   ${item.filename} (day ${item.missionDay})`); continue; }
    const got = await sha256(file);
    if (got === item.sha256) { ok++; }
    else { bad++; console.log(`MISMATCH  ${item.filename}: ${got.slice(0, 16)}… expected ${item.sha256.slice(0, 16)}…`); }
  }
  console.log(`${ok} verified, ${bad} problem${bad === 1 ? '' : 's'} — ${manifest.items.length} listed in ${manifestPath}`);
  process.exit(bad ? 1 : 0);
})();
