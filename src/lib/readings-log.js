'use strict';
/**
 * The readings log: every reading the station pulls or receives, written as
 * a JSON file the moment it arrives, and never touched again.
 *
 *   DATA_DIR/readings/<source>/<YYYY-MM-DD>/<HH-MM-SS.mmm>.json
 *
 * Sources: `node` — every poll of the external sensor node, the rows the
 * feed returned and what became of them; `ingest` — every POST to
 * /api/sensors/ingest; `resources` — the stores as the content files put
 * them, every time they change; `figures` — the crew's calories and steps,
 * every time they change; `daily` — each day's habitat summary as it is
 * rolled up. Where a source only changes now and then (resources, figures,
 * daily) an identical snapshot is not written twice.
 *
 * The log sits on the station-data volume beside the database and the
 * media, so one backup carries all three. The reset does not touch it —
 * this is the one thing that survives everything — and neither does
 * anything else: nothing here is ever deleted or rewritten.
 *
 * It is downloadable whole as a ZIP at /archive/readings.zip (mission
 * control), and listed at /archive/readings.json.
 */
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { DATA_DIR } = require('../db');

const DIR = path.join(DATA_DIR, 'readings');
const SOURCES = ['node', 'ingest', 'resources', 'figures', 'daily'];
const last = new Map();      // source → hash of the last snapshot written

const stamp = (d) => {
  const iso = d.toISOString();           // 2026-10-15T20:41:07.123Z
  return { day: iso.slice(0, 10), file: iso.slice(11, 23).replace(/:/g, '-') + '.json' };
};

/**
 * Write one record. `payload` is anything JSON; `pulledAt`, `source` and a
 * `station` block are added. Returns the path written, or null when a
 * deduplicated source has not changed. Never throws: a full disk must not
 * take the station down, only the log.
 */
function record(source, payload, { dedupe = false } = {}) {
  try {
    if (!SOURCES.includes(source)) throw new Error(`unknown source ${source}`);
    const body = JSON.stringify(payload);
    if (dedupe) {
      const h = crypto.createHash('sha256').update(body).digest('hex');
      if (last.get(source) === h) return null;
      last.set(source, h);
    }
    const now = new Date();
    const { day, file } = stamp(now);
    const dir = path.join(DIR, source, day);
    fs.mkdirSync(dir, { recursive: true });
    let p = path.join(dir, file);
    for (let i = 1; fs.existsSync(p); i++) p = path.join(dir, file.replace('.json', `-${i}.json`));
    const out = { pulledAt: now.toISOString(), source, ...payload };
    fs.writeFileSync(p, JSON.stringify(out, null, 2) + '\n');
    return p;
  } catch (e) {
    console.error(`[readings] could not write ${source}:`, e.message);
    return null;
  }
}

/** Remember the last snapshot hash across restarts, so a restart does not rewrite it. */
function primeDedupe() {
  for (const source of ['resources', 'figures', 'daily']) {
    try {
      const files = list({ source });
      if (!files.length) continue;
      const f = files[files.length - 1];
      const obj = JSON.parse(fs.readFileSync(f.path, 'utf8'));
      delete obj.pulledAt; delete obj.source;
      last.set(source, crypto.createHash('sha256').update(JSON.stringify(obj)).digest('hex'));
    } catch { /* fine: the next snapshot is written */ }
  }
}

/** Every file in the log, oldest first, as { name, path, size, mtime, source, day }. */
function list({ source = null, day = null } = {}) {
  const out = [];
  if (!fs.existsSync(DIR)) return out;
  for (const src of fs.readdirSync(DIR).sort()) {
    if (source && src !== source) continue;
    const sdir = path.join(DIR, src);
    if (!fs.statSync(sdir).isDirectory()) continue;
    for (const d of fs.readdirSync(sdir).sort()) {
      if (day && d !== day) continue;
      const ddir = path.join(sdir, d);
      if (!fs.statSync(ddir).isDirectory()) continue;
      for (const f of fs.readdirSync(ddir).sort()) {
        if (!f.endsWith('.json')) continue;
        const p = path.join(ddir, f);
        const st = fs.statSync(p);
        out.push({ name: `${src}/${d}/${f}`, path: p, size: st.size, mtime: st.mtime, source: src, day: d });
      }
    }
  }
  return out;
}

function counts() {
  const files = list();
  const by = {};
  for (const f of files) by[f.source] = (by[f.source] || 0) + 1;
  return { total: files.length, bytes: files.reduce((s, f) => s + f.size, 0), bySource: by,
    first: files.length ? files[0].mtime.toISOString() : null, last: files.length ? files[files.length - 1].mtime.toISOString() : null };
}

/** The whole log as one ZIP, streamed, with an index and a README inside. */
async function sendZip(res, { writeZip, mission }) {
  const files = list();
  const generatedAt = new Date().toISOString();
  const index = {
    mission, generatedAt,
    note: 'One JSON file per pull, written the moment the readings arrived and never changed. Paths are <source>/<day>/<time>.json.',
    counts: counts(),
    files: files.map((f) => ({ path: f.name, source: f.source, day: f.day, bytes: f.size, writtenAt: f.mtime.toISOString() })),
  };
  const readme = [
    'MARS Communication Station — readings log',
    `Mission: ${mission.name}, ${mission.start} to ${mission.end} (${mission.timezone})`,
    `Generated: ${generatedAt}`,
    '',
    'Every reading the station pulled or received, one JSON file per pull, kept',
    'forever: node/ is every poll of the external sensor node, ingest/ every batch',
    'posted to /api/sensors/ingest, resources/ the stores as the content files put',
    'them each time they changed, figures/ the crew\'s calories and steps each time',
    'they changed, daily/ each day\'s habitat summary as it was rolled up. Nothing',
    'in here is ever rewritten or deleted; a reset of the station leaves it alone.',
    'index.json lists every file.',
    '',
    'ZKM | Hertzlab',
  ].join('\n') + '\n';
  const entries = files.map((f) => ({ name: f.name, path: f.path, size: f.size, mtime: f.mtime }));
  entries.push({ name: 'index.json', data: Buffer.from(JSON.stringify(index, null, 2) + '\n') });
  entries.push({ name: 'README.txt', data: Buffer.from(readme) });
  res.set({
    'Content-Type': 'application/zip',
    'Content-Disposition': `attachment; filename="mars-station-readings-${generatedAt.slice(0, 10)}.zip"`,
    'Cache-Control': 'no-store',
  });
  try { await writeZip(res, entries, { comment: 'MARS station readings log' }); res.end(); }
  catch (e) { if (!res.headersSent) res.status(500).type('text').send(e.message); else res.destroy(); }
}

module.exports = { DIR, SOURCES, record, primeDedupe, list, counts, sendZip };
