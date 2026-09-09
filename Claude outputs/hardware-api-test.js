#!/usr/bin/env node
// Local test: call the station's hardware API and print value + time per reading.
// Standalone — keep it outside the project.
//
//   node hardware-api-test.js                          the station on this PC (http://localhost:8080)
//   node hardware-api-test.js http://192.168.1.42:8080 another station
//   node hardware-api-test.js --hours 48               reach back further (up to 168)
//   node hardware-api-test.js --watch                  refresh every 10 s until Ctrl-C
//   node hardware-api-test.js --json                   the raw API answer instead
//
// Needs only Node 18 or newer (built-in fetch). No login, no Home Assistant token.
// If you get "404", the station is still running old code: `docker compose restart`.

const args = process.argv.slice(2);
const flag = (n) => { const i = args.indexOf(n); if (i < 0) return false; args.splice(i, 1); return true; };
const opt = (n, d) => { const i = args.indexOf(n); if (i < 0) return d; const v = args[i + 1]; args.splice(i, 2); return v; };
const watch = flag('--watch');
const json = flag('--json');
const hours = Number(opt('--hours', 24)) || 24;
const station = (args[0] || 'http://localhost:8080').replace(/\/+$/, '');
const url = `${station}/api/hardware/readings?hours=${hours}`;

const when = (iso) => new Date(iso).toLocaleString('en-GB', { timeZone: 'Europe/Berlin', hour12: false }).replace(',', '');
const num = (v, d) => (v == null ? '—' : Number(v).toFixed(d == null ? 2 : d));

function print(d) {
  if (!d.configured) { console.log('Home Assistant bridge is off on this station (HA_HOST / HA_API_TOKEN not set).'); return; }
  console.log(`Last poll from Home Assistant: ${d.lastPollAt ? when(d.lastPollAt) : 'never'}${d.frozen ? '  (record closed)' : ''}`);
  for (const s of d.sensors) {
    console.log('');
    console.log(`${s.label}  [${s.id}]`);
    if (s.current) console.log(`  now: ${num(s.current.value, s.decimals)} ${s.unit}  at ${when(s.current.at)}`);
    if (!s.readings.length) { console.log('  (no readings stored yet)'); continue; }
    for (const r of s.readings) console.log(`  ${when(r.at)}   ${num(r.value, s.decimals)} ${s.unit}`);
  }
  console.log('');
}

async function once() {
  let res;
  try { res = await fetch(url); } catch (e) {
    console.error(`could not reach ${url} — ${e.message}. Is the station running? Try opening ${station} in a browser.`); return;
  }
  const body = await res.text();
  if (res.status === 404) {
    console.error(`${url} → 404. The station is running old code that has no /api/hardware/readings yet.\nIn the project folder run:  docker compose restart   and try again.`); return;
  }
  if (!res.ok) { console.error(`${url} → HTTP ${res.status}\n${body.slice(0, 300)}`); return; }
  let data;
  try { data = JSON.parse(body); } catch { console.error(`${url} did not answer with JSON:\n${body.slice(0, 300)}`); return; }
  if (watch) console.clear();
  if (json) console.log(JSON.stringify(data, null, 2)); else print(data);
}

(async () => {
  await once();
  if (watch) setInterval(once, 10_000);
})();
