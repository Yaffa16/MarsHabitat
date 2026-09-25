'use strict';
/**
 * The readings log: every reading the station pulls or receives, written as
 * a JSON file the moment it arrives, and never touched again.
 *
 *   DATA_DIR/readings/<source>/<YYYY-MM-DD>/<HH-MM-SS.mmm>.json
 *
 * Sources: `node` — every poll of the external sensor node: the readings
 * that poll added (the node repeats its whole last thirty days each time;
 * only what was not already held is written) and the counts of what came
 * back; `habitat` — every poll of the habitat sensor through Home
 * Assistant (src/lib/habitat-feed.js): each entity's state as fetched and
 * the rows the poll stored; `ingest` — every POST to
 * /api/sensors/ingest; `resources` — the stores as the content files put
 * them, every time they change; `figures` — the crew's calories and steps,
 * every time they change; `daily` — each day's habitat summary as it is
 * rolled up; `home-assistant` — every poll of the habitat's own hardware
 * (src/lib/home-assistant.js) that carried something new.
 * Where a source only changes now and then (resources, figures,
 * daily) an identical snapshot is not written twice.
 *
 * The log sits on the station-data volume beside the database and the
 * media, so one backup carries all three. The reset does not touch it —
 * this is the one thing that survives everything — and neither does
 * anything else: nothing here is ever deleted or rewritten.
 *
 * It is downloadable whole as a ZIP at /archive/readings.zip (mission
 * control), and listed at /archive/readings.json. The ZIP also carries, and
 * /archive/readings/<name>.csv serves on its own, the same log flattened
 * into tables that open in a spreadsheet: one row per reading per pull for
 * the hardware and the ingest, one row per poll and one per reading for
 * the node. They are built from the JSON files on request and add nothing
 * the files do not hold.
 */
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { DATA_DIR } = require('../db');

const DIR = path.join(DATA_DIR, 'readings');
const SOURCES = ['node', 'habitat', 'ingest', 'resources', 'figures', 'daily', 'home-assistant'];
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
      // a daily record is one per mission day, so each day is deduplicated
      // on its own — rolling the days in turn must not rewrite them in turn
      const key = dedupeKey(source, payload);
      const h = crypto.createHash('sha256').update(body).digest('hex');
      if (last.get(key) === h) return null;
      last.set(key, h);
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

const dedupeKey = (source, payload) => (source === 'daily' && payload && payload.missionDay != null ? `${source}:${payload.missionDay}` : source);

/** Remember the last snapshot hash across restarts, so a restart does not
    rewrite it — for the daily records, the last one of each mission day. */
function primeDedupe() {
  for (const source of ['resources', 'figures', 'daily']) {
    try {
      const files = list({ source });
      if (!files.length) continue;
      const seen = new Set();
      for (let i = files.length - 1; i >= 0; i--) {              // newest first, one per key
        const obj = JSON.parse(fs.readFileSync(files[i].path, 'utf8'));
        delete obj.pulledAt; delete obj.source;
        const key = dedupeKey(source, obj);
        if (seen.has(key)) { if (source !== 'daily') break; continue; }
        seen.add(key);
        last.set(key, crypto.createHash('sha256').update(JSON.stringify(obj)).digest('hex'));
        if (source !== 'daily') break;
      }
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
    'forever: node/ is every poll of the external sensor node (the readings that',
    'poll added — the node repeats its last thirty days each time — with the',
    'counts of what came back), habitat/ every poll of the habitat sensor through',
    'Home Assistant (each entity\'s state as fetched, and the rows stored), ingest/ every batch',
    'posted to /api/sensors/ingest, resources/ the stores as the content files put',
    'them each time they changed, figures/ the crew\'s calories and steps each time',
    'they changed, daily/ each day\'s habitat summary as it was rolled up, and',
    'home-assistant/ every poll of the habitat\'s own hardware, changed or not,',
    'exactly as Home Assistant returned it. Nothing',
    'in here is ever rewritten or deleted; a reset of the station leaves it alone.',
    'index.json lists every file.',
    '',
    'csv/ holds the same log flattened into tables for a spreadsheet:',
    'home-assistant.csv one row per entity per poll (and per history row fetched),',
    'ingest.csv one row per reading per batch posted, node-polls.csv one row per',
    'poll of the external node, node.csv one row per reading the node ever sent',
    'with the poll that brought it in. The tables are',
    'built from the JSON files and add nothing the files do not hold.',
    '',
    'ZKM | Hertzlab',
  ].join('\n') + '\n';
  const entries = files.map((f) => ({ name: f.name, path: f.path, size: f.size, mtime: f.mtime }));
  for (const name of CSV_NAMES) entries.push({ name: `csv/${name}.csv`, data: Buffer.from(csv(name)) });
  index.tables = CSV_NAMES.map((n) => `csv/${n}.csv`);
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

/* ---------------------------------------------------------------- as CSV */

const cell = (v) => {
  if (v === null || v === undefined) return '';
  const str = typeof v === 'object' ? JSON.stringify(v) : String(v);
  return /[",\n\r]/.test(str) ? `"${str.replace(/"/g, '""')}"` : str;
};
const line = (cols) => cols.map(cell).join(',') + '\n';

/** Every file of one source, parsed, oldest first; a file that will not parse is skipped. */
function* records(source) {
  for (const f of list({ source })) {
    try { yield JSON.parse(fs.readFileSync(f.path, 'utf8')); } catch { /* skip */ }
  }
}

const CSV = {
  /* One row per entity per poll — the state exactly as fetched, whether or
     not it had moved — then one row per history row the backfill fetched.
     Reads files written before the log carried attributes and history too. */
  'home-assistant': function* () {
    yield line(['pulledAt', 'via', 'entity', 'at', 'state', 'value', 'unit', 'storedInDb', 'lastChanged', 'lastUpdated', 'friendlyName', 'error', 'attributes']);
    for (const o of records('home-assistant')) {
      for (const r of o.readings || []) {
        yield line([o.pulledAt, 'states', r.entity, r.at, r.state, r.value ?? (r.state != null && Number.isFinite(parseFloat(r.state)) ? parseFloat(r.state) : null),
          r.unit, r.stored ?? '', r.lastChanged, r.lastUpdated, r.friendly, r.error, r.attributes]);
      }
      for (const h of o.history || []) {
        for (const r of h.rows || []) yield line([o.pulledAt, 'history', r.entity, r.at, r.state, Number.isFinite(parseFloat(r.state)) ? parseFloat(r.state) : null, '', r.stored ?? '', '', '', '', h.error, '']);
      }
    }
  },
  /* One row per reading stored from the habitat sensor (through Home
     Assistant): every channel at its minute, with the poll that stored it. */
  habitat: function* () {
    const keys = ['co2', 'temp', 'hum', 'pres', 'light', 'voc', 'iaq', 'iaqc'];
    yield line(['pulledAt', 'at', 't', ...keys]);
    for (const o of records('habitat')) {
      for (const r of o.readings || []) yield line([o.pulledAt, r.at, r.t, ...keys.map((k) => r[k])]);
    }
  },
  /* One row per poll of the habitat sensor: what each entity's state was
     as fetched, whether or not it moved, and what the poll stored. */
  'habitat-polls': function* () {
    yield line(['pulledAt', 'channel', 'entity', 'at', 'state', 'value', 'unit', 'lastChanged', 'lastUpdated', 'error', 'historyFrom', 'historyRows', 'storedInDb']);
    for (const o of records('habitat')) {
      for (const f of o.fetched || []) {
        yield line([o.pulledAt, f.channel, f.entity, f.at, f.state, f.value, f.unit, f.lastChanged, f.lastUpdated, f.error,
          o.history && o.history.from, o.history && o.history.rows, o.stored]);
      }
      if (!(o.fetched || []).length) yield line([o.pulledAt, '', '', '', '', '', '', '', '', Array.isArray(o.error) ? o.error.join(' · ') : (o.error || ''), '', '', o.stored]);
    }
  },
  /* One row per reading per batch posted to /api/sensors/ingest. */
  ingest: function* () {
    yield line(['pulledAt', 'deviceId', 'metric', 'value', 'unit', 'recordedAt']);
    for (const o of records('ingest')) {
      for (const r of o.readings || []) yield line([o.pulledAt, o.deviceId, r.metric, r.value, r.unit, r.recordedAt]);
    }
  },
  /* One row per poll of the external node: what came back and what became of it. */
  'node-polls': function* () {
    yield line(['pulledAt', 'sensorId', 'received', 'storedInDb', 'duplicates', 'beforeFloor', 'newestReading', 'error']);
    for (const o of records('node')) {
      const rd = o.readings || [];
      yield line([o.pulledAt, o.sensorId, o.received ?? rd.length, o.stored, o.dropped, o.before,
        o.newest || (rd.length ? rd[rd.length - 1].at : ''), Array.isArray(o.error) ? o.error.join(' · ') : (o.error || '')]);
    }
  },
  /* One row per reading the node sent, with the poll that brought it in.
     (Files written before the log kept only the additions carry the whole
     feed each time; a reading in several files is still one row, with the
     first and last poll that carried it.) */
  node: function* () {
    const seen = new Map();   // t|values → { first, last, row }
    let keys = null;
    for (const o of records('node')) {
      for (const r of o.readings || []) {
        if (!keys) keys = Object.keys(r).filter((k) => k !== 'at' && k !== 't');
        const sig = `${r.t}|${keys.map((k) => r[k]).join('|')}`;
        const e = seen.get(sig);
        if (e) e.last = o.pulledAt; else seen.set(sig, { first: o.pulledAt, last: o.pulledAt, row: r });
      }
    }
    keys = keys || [];
    yield line(['at', 't', ...keys, 'firstPulledAt', 'lastPulledAt']);
    for (const e of [...seen.values()].sort((a, b) => a.row.t - b.row.t)) {
      yield line([e.row.at, e.row.t, ...keys.map((k) => e.row[k]), e.first, e.last]);
    }
  },
};
const CSV_NAMES = Object.keys(CSV);

/** The whole table as one string, or null for a name that is not a table. */
function csv(name) {
  if (!CSV[name]) return null;
  let out = '';
  for (const l of CSV[name]()) out += l;
  return out;
}

module.exports = { DIR, SOURCES, CSV_NAMES, record, primeDedupe, list, counts, csv, sendZip };
