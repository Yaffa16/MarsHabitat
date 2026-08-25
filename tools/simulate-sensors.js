'use strict';
/**
 * Posts plausible habitat readings to the station. For rehearsal, demos and
 * for keeping the site alive between installs. Not for use during the run --
 * the real sensors should own these channels.
 *
 *   STATION_URL=http://localhost:8080 SENSOR_TOKEN=... node tools/simulate-sensors.js
 */
const URL_BASE = process.env.STATION_URL || 'http://localhost:8080';
const TOKEN = process.env.SENSOR_TOKEN || '';
const INTERVAL = Number(process.env.INTERVAL_SECONDS || 30) * 1000;

let t = 0;
let dose = 0;   // cumulative radiation, only ever increases
const jitter = (a) => (Math.random() - 0.5) * a;

async function post() {
  t += INTERVAL / 3600000;
  // A room with three people in it and a door that occasionally opens.
  const crowd = Math.max(0, Math.sin(t / 5) ) * 1.8;
  const readings = [
    { metric: 'temperature', value: +(21.0 + Math.sin(t / 3.6) * 1.4 + crowd + jitter(0.25)).toFixed(2), unit: '°C' },
    { metric: 'humidity',    value: +(38 + Math.cos(t / 4.1) * 5 + crowd * 1.6 + jitter(1.0)).toFixed(1), unit: '%' },
    { metric: 'co2',         value: +(660 + Math.sin(t / 2.4) * 210 + crowd * 120 + jitter(25)).toFixed(0), unit: 'ppm' },
    { metric: 'air_quality', value: +(68 + Math.sin(t / 2.1) * 40 + crowd * 30 + jitter(10)).toFixed(0), unit: 'VOC' },
    // Dose rate drifts slowly and does not care about the people in the room.
    { metric: 'radiation',   value: +(0.18 + Math.sin(t / 11) * 0.05 + jitter(0.015)).toFixed(3), unit: 'µSv/h' },
    { metric: 'pressure',    value: +(1008 + Math.sin(t / 9) * 4 + jitter(0.8)).toFixed(1), unit: 'hPa' },
    // Air quality tracks the crowd: more people, more VOCs and more dust.
    { metric: 'air_quality', value: +(22 + crowd * 14 + Math.sin(t / 6) * 6 + jitter(3)).toFixed(0), unit: 'AQI' },
    { metric: 'voc',         value: +(180 + crowd * 90 + Math.sin(t / 3.1) * 60 + jitter(20)).toFixed(0), unit: 'ppb' },
    { metric: 'pm25',        value: +(6 + crowd * 4 + Math.abs(Math.sin(t / 7)) * 3 + jitter(1)).toFixed(1), unit: 'µg/m³' },
    // Dose rate wanders around background; the cumulative total only rises.
    { metric: 'radiation',   value: +(0.28 + Math.sin(t / 11) * 0.06 + jitter(0.03)).toFixed(3), unit: 'µSv/h' },
    { metric: 'radiation_cumulative', value: +(dose += 0.28 * (INTERVAL / 3600000)).toFixed(3), unit: 'µSv' },
  ];
  try {
    const res = await fetch(`${URL_BASE}/api/sensors/ingest`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${TOKEN}` },
      body: JSON.stringify({ deviceId: 'sim-01', readings }),
    });
    const out = await res.json();
    console.log(new Date().toISOString(), res.status, JSON.stringify(out));
  } catch (e) {
    console.error('ingest failed:', e.message);
  }
}

console.log(`[sim] posting to ${URL_BASE} every ${INTERVAL / 1000}s`);
post();
setInterval(post, INTERVAL);
