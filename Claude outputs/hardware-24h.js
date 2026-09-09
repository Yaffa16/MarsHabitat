#!/usr/bin/env node
// Print the habitat hardware's last 24 hours from the station.
//
//   node hardware-24h.js                       the station on this PC (http://localhost:8080)
//   node hardware-24h.js http://192.168.1.42:8080
//   node hardware-24h.js --hourly              one line per hour per device (what the chart draws)
//   node hardware-24h.js --csv > today.csv     every reading, as CSV
//   node hardware-24h.js --hours 48            reach back further (up to a week)
//
// Needs only Node (18 or newer). Reads /api/hardware/readings on the station —
// public, no login — so it works from any machine that can open the website.

const args = process.argv.slice(2);
const flag = (n) => { const i = args.indexOf(n); if (i < 0) return false; args.splice(i, 1); return true; };
const opt = (n, d) => { const i = args.indexOf(n); if (i < 0) return d; const v = args[i + 1]; args.splice(i, 2); return v; };
const hourly = flag('--hourly');
const csv = flag('--csv');
const hours = Number(opt('--hours', 24)) || 24;
const station = (args[0] || 'http://localhost:8080').replace(/\/+$/, '');

const local = (iso) => new Date(iso).toLocaleString('en-GB', { timeZone: 'Europe/Berlin', hour12: false }).replace(',', '');
const num = (v, d) => (v == null ? '' : Number(v).toFixed(d == null ? 2 : d));

(async () => {
  let d;
  try {
    const r = await fetch(`${station}/api/hardware/readings?hours=${hours}`);
    if (!r.ok) throw new Error('HTTP ' + r.status);
    d = await r.json();
  } catch (e) {
    console.error(`could not read ${station}/api/hardware/readings — ${e.message}`);
    process.exit(1);
  }
  if (!d.configured) { console.log('The Home Assistant bridge is off on this station (HA_HOST / HA_API_TOKEN not set).'); process.exit(0); }

  if (csv) {
    console.log('device,label,time (Europe/Berlin),time (UTC),value,unit');
    for (const s of d.sensors) {
      const rows = hourly ? s.hourly : s.readings;
      for (const r of rows) console.log([s.id, JSON.stringify(s.label), local(r.at), r.at, num(r.value, s.decimals), s.unit].join(','));
    }
    return;
  }

  console.log(`Habitat hardware — last ${hours} h — ${local(d.since)} → ${local(d.until)} (Europe/Berlin)`);
  console.log(`last read from Home Assistant: ${d.lastPollAt ? local(d.lastPollAt) : 'never'}${d.frozen ? ' · the record is closed' : ''}`);
  for (const s of d.sensors) {
    const rows = hourly ? s.hourly : s.readings;
    console.log('');
    console.log(`${s.label} (${s.id}) — ${s.kind}${s.current ? ` — now ${num(s.current.value, s.decimals)} ${s.unit} at ${local(s.current.at)}` : ' — no current reading'}${s.today != null ? ` — today +${num(s.today, s.decimals)} ${s.unit}` : ''}`);
    if (!rows.length) { console.log('  (nothing stored in this window)'); continue; }
    const vals = rows.map((r) => r.value).filter((v) => v != null);
    const lo = Math.min(...vals), hi = Math.max(...vals), mean = vals.reduce((a, b) => a + b, 0) / vals.length;
    console.log(`  ${rows.length} ${hourly ? 'hours' : 'readings'} · low ${num(lo, s.decimals)} · high ${num(hi, s.decimals)} · mean ${num(mean, s.decimals)} ${s.unit}`);
    for (const r of rows) console.log(`  ${local(r.at)}  ${num(r.value, s.decimals).padStart(10)} ${s.unit}`);
  }
})();
