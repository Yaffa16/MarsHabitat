#!/usr/bin/env node
// Calls the Home Assistant API directly and prints the sensors. Nothing to do
// with the station or its container — talks to the hardware's own server.
//
//   node ha-print.js                     current value of each sensor
//   node ha-print.js --history           every reading of the last 24 h, time + value
//   node ha-print.js --history --hours 6
//   node ha-print.js --watch             re-read every 10 s until Ctrl-C
//
// Where Home Assistant is and the token: the script reads HA_HOST / HA_PORT /
// HA_API_TOKEN from the station's .env — give its path with --env, or copy
// the .env next to this script. Values below are the fallback.
// Needs only Node 18 or newer.

const fs = require('fs');
const path = require('path');
const envFile = (() => { const i = process.argv.indexOf('--env'); if (i > 0) { const p = process.argv[i + 1]; process.argv.splice(i, 2); return p; } return path.join(__dirname, '.env'); })();
const ENV = {};
try {
  for (const line of fs.readFileSync(envFile, 'utf8').split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/); if (m) ENV[m[1]] = m[2].replace(/^["']|["']$/g, '');
  }
} catch { /* no .env here — fall back to the values below */ }

const HOST = process.env.HA_HOST || ENV.HA_HOST || '192.168.225.23';   // Home Assistant's IP (from the station's .env)
const PORT = process.env.HA_PORT || ENV.HA_PORT || '80';
const TOKEN = process.env.HA_API_TOKEN || ENV.HA_API_TOKEN || '';      // long-lived token — never write it into this file

// Entity ids to print — the same ones the station shows.
const SENSORS = [
  'sensor.sonoff_temperatur_temperature_1',   // Cricket Terrarium Temperature
  'sensor.shelly_steckdose_2_energie',        // Socket energy · Shelly plug
];

const args = process.argv.slice(2);
const flag = (n) => { const i = args.indexOf(n); if (i < 0) return false; args.splice(i, 1); return true; };
const opt = (n, d) => { const i = args.indexOf(n); if (i < 0) return d; const v = args[i + 1]; args.splice(i, 2); return v; };
const history = flag('--history');
const watch = flag('--watch');
const hours = Number(opt('--hours', 24)) || 24;

const base = `http://${HOST}:${PORT}`;
const when = (iso) => new Date(iso).toLocaleString('en-GB', { timeZone: 'Europe/Berlin', hour12: false }).replace(',', '');

async function ha(path) {
  const res = await fetch(base + path, { headers: { Authorization: `Bearer ${TOKEN}` } });
  if (res.status === 401) throw new Error('401 — the token is wrong or expired');
  if (res.status === 404) throw new Error('404 — no such entity');
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

async function once() {
  if (watch) console.clear();
  for (const id of SENSORS) {
    try {
      const s = await ha(`/api/states/${id}`);
      const unit = s.attributes?.unit_of_measurement || '';
      console.log(`${s.attributes?.friendly_name || id}  [${id}]`);
      console.log(`  now: ${s.state} ${unit}  at ${when(s.last_updated)}`);
      if (history) {
        const start = new Date(Date.now() - hours * 3600000).toISOString();
        const rows = (await ha(`/api/history/period/${start}?filter_entity_id=${id}&minimal_response&no_attributes`))[0] || [];
        for (const r of rows) {
          if (r.state === 'unavailable' || r.state === 'unknown') continue;
          console.log(`  ${when(r.last_changed || r.last_updated)}   ${r.state} ${unit}`);
        }
        if (!rows.length) console.log(`  (no history in the last ${hours} h)`);
      }
    } catch (e) {
      console.log(`${id}\n  could not read — ${e.message}`);
    }
    console.log('');
  }
}

(async () => {
  if (!TOKEN) { console.error(`no HA_API_TOKEN found (looked in ${envFile}). Run:  node ha-print.js --env "C:\\path\\to\\mars-station\\.env"`); process.exit(1); }
  console.log(`Home Assistant at ${base}  (settings from ${fs.existsSync(envFile) ? envFile : 'built-in fallback'})\n`);
  try { await fetch(base + '/api/', { headers: { Authorization: `Bearer ${TOKEN}` } }); }
  catch (e) { console.error(`cannot reach Home Assistant at ${base} — ${e.message}\nThis PC must be on the same network as the habitat hardware (the station's container reaches it from there).`); process.exit(1); }
  await once();
  if (watch) setInterval(once, 10_000);
})();
