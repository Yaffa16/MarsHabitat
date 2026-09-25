'use strict';
/**
 * A stand-in Home Assistant for rehearsing the habitat feed without the
 * venue network: answers /api/states/sensor.<id> and /api/history/period
 * for the M5 ENV Pro's seven entities, the light sensor and the kitchen socket with
 * plausible, slowly moving values. Not part of the station; a tool.
 *
 *   node tools/mock-home-assistant.js 8123
 *   HA_HOST=localhost HA_PORT=8123 HA_API_TOKEN=x npm start
 */
const http = require('http');
const PORT = Number(process.argv[2] || 8123);

const ENT = {
  m5_env_pro_env_pro_co2_equivalent: { unit: 'ppm', base: 640, swing: 180, period: 3600, dec: 1 },
  m5_env_pro_env_pro_temperature: { unit: '°C', base: 22.4, swing: 1.2, period: 5400, dec: 2 },
  m5_env_pro_env_pro_humidity: { unit: '%', base: 41, swing: 6, period: 4200, dec: 1 },
  m5_env_pro_env_pro_pressure: { unit: 'hPa', base: 1008.3, swing: 2.5, period: 9000, dec: 2 },
  m5_env_pro_env_pro_breath_voc_equivalent: { unit: 'ppm', base: 1.1, swing: 0.7, period: 2700, dec: 2 },
  m5_env_pro_env_pro_iaq: { unit: '', base: 85, swing: 60, period: 3000, dec: 0 },
  environment_light_illuminance: { unit: 'lx', base: 320, swing: 260, period: 7200, dec: 0 },
  habitat_power_kitchen_energie: { unit: 'kWh', base: 0.5, swing: 0, period: 1, dec: 3, rising: 0.00002 },
  habitat_power_kitchen_leistung: { unit: 'W', base: 9.2, swing: 4, period: 600, dec: 1 },
};
const CLASSES = [[50, 'Excellent'], [100, 'Good'], [150, 'Lightly polluted'], [200, 'Moderately polluted'], [250, 'Heavily polluted'], [350, 'Severely polluted'], [Infinity, 'Extremely polluted']];
const valueAt = (id, t) => {
  const e = ENT[id]; if (!e) return null;
  const s = t / 1000;
  let v = e.base + e.swing * Math.sin((s / e.period) * 2 * Math.PI) + (e.rising ? e.rising * s : 0);
  return Number(v.toFixed(e.dec));
};
const classAt = (t) => { const v = valueAt('m5_env_pro_env_pro_iaq', t); return CLASSES.find(([hi]) => v <= hi)[1]; };
const stateOf = (id, t, attrs = true) => {
  const iso = new Date(t).toISOString();
  if (id === 'm5_env_pro_env_pro_iaq_classification') {
    return { entity_id: `sensor.${id}`, state: classAt(t), attributes: attrs ? { friendly_name: 'ENV Pro IAQ classification' } : undefined, last_changed: iso, last_updated: iso };
  }
  const v = valueAt(id, t); if (v === null) return null;
  return { entity_id: `sensor.${id}`, state: String(v), attributes: attrs ? { unit_of_measurement: ENT[id].unit, friendly_name: `ENV Pro ${id.replace(/^m5_env_pro_env_pro_/, '')}` } : undefined, last_changed: iso, last_updated: iso };
};

http.createServer((req, res) => {
  const url = new URL(req.url, 'http://x');
  const auth = req.headers.authorization || '';
  if (!/^Bearer /.test(auth)) { res.writeHead(401); return res.end('401: Unauthorized'); }
  let m = url.pathname.match(/^\/api\/states\/sensor\.([^/]+)$/);
  if (m) {
    const st = stateOf(m[1], Date.now() - 20000);
    if (!st) { res.writeHead(404); return res.end('404: Not Found'); }
    res.writeHead(200, { 'Content-Type': 'application/json' }); return res.end(JSON.stringify(st));
  }
  m = url.pathname.match(/^\/api\/history\/period\/([^/]+)$/);
  if (m) {
    const start = Date.parse(decodeURIComponent(m[1])) || Date.now() - 3600000;
    const ids = String(url.searchParams.get('filter_entity_id') || '').split(',').map((x) => x.replace(/^sensor\./, '')).filter(Boolean);
    const out = ids.map((id) => {
      const rows = [];
      // one change every 30 seconds since `start`, up to now
      for (let t = Math.ceil(start / 30000) * 30000; t < Date.now(); t += 30000) rows.push(stateOf(id, t, false));
      if (!rows.length) rows.push(stateOf(id, start, false));
      return rows.filter(Boolean).map((r, i) => (i ? { state: r.state, last_changed: r.last_changed, last_updated: r.last_updated } : r));
    }).filter((l) => l.length);
    res.writeHead(200, { 'Content-Type': 'application/json' }); return res.end(JSON.stringify(out));
  }
  res.writeHead(404); res.end('404: Not Found');
}).listen(PORT, () => console.log(`[mock-ha] listening on :${PORT}`));
