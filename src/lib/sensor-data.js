'use strict';
/**
 * Sensor Data — the archive's download of everything on the Sensors tab and in Today's Meal, day by day (9 October:
 * "the readings log: rename it to Sensor Data — it should have all the data in the Sensors tab and all the data from
 * Today's Meal for each day").
 *
 * Tables that open in any spreadsheet, built from the station's record for every day of the run that has happened (and,
 * before the run, NOW — today's rehearsal, marked) — a folder for each day and the same tables across all the days:
 *
 *   habitat-sensor.csv   every reading of the habitat sensor — carbon dioxide, temperature, humidity, air pressure,
 *                        volatile organic compounds, air quality and its class, light — one row per reading (the
 *                        table the Sensors tab's instruments are drawn from: external_reading, src/lib/critical.js)
 *   hardware.csv         every state the habitat's own hardware reported through Home Assistant — the oxygen, carbon
 *                        monoxide and nitrogen dioxide sensors, the terrarium, every power draw and energy meter —
 *                        one row per state
 *   posted-readings.csv  readings posted to the station's ingest (/api/sensors/ingest), one row per instant — only
 *                        where there are any
 *   daily-summary.csv    each channel's and device's low, high and mean for the day, its samples, and what a meter
 *                        added that day
 *   sensors-tab.csv      the Sensors tab's figures for the day: the steps taken (per officer and the crew's), the power
 *                        generated (rounds pedalled, battery charged), the resources (available, used, left — counted
 *                        or carried) and the power consumed by category
 *   meals.csv            Today's Meal: every meal of the day with all its figures
 *   meals-totals.csv     the day's meals together: kcal, water, watt hours, kg CO₂e
 *
 * Only what was entered on the station or measured by its sensors, as stored: nothing projected, nothing carried
 * forward but what the Habitat tab itself carries (a store's figure from the day before, marked so). The raw readings
 * log (src/lib/readings-log.js) travels in the same ZIP beside these tables.
 */
const mission = require('./mission');
const officer = require('./officer');

const cell = (v) => {
  if (v === null || v === undefined) return '';
  const s = typeof v === 'object' ? JSON.stringify(v) : String(v);
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};
const table = (head, rows) => '﻿' + [head, ...rows].map((r) => r.map(cell).join(',')).join('\r\n') + '\r\n';
const dd = (n) => String(n).padStart(2, '0');

/** The days the tables hold: every day of the run that has happened, and NOW before the run (marked a rehearsal). */
function days() {
  const archive = require('./archive');
  const st = mission.state();
  const out = [];
  const now = st.nowDay ? archive.rehearsalRecord(st) : null;
  if (now) out.push({ n: 0, date: now.date, rehearsal: true, record: now, folder: `day-00_NOW-rehearsal_${now.date}` });
  const upTo = archive.recordedUpTo(st);
  for (let n = 1; n <= upTo; n++) {
    const record = archive.dayRecord(n);
    out.push({ n, date: record.date, rehearsal: false, record, folder: `day-${dd(n)}_${record.date}` });
  }
  return out;
}

const dayCols = (d) => [d.rehearsal ? 'NOW' : dd(d.n), d.date];

/* ---- the tables, each for a list of days (one day for its folder, all of them for all-days/) */

function postedReadings(list) {
  const cols = new Map();
  for (const d of list) for (const c of d.record.readings.station.columns) if (!cols.has(c.metric)) cols.set(c.metric, c);
  const keys = [...cols.values()];
  const rows = [];
  for (const d of list) for (const r of d.record.readings.station.rows) rows.push([...dayCols(d), r.at, r.iso, ...keys.map((c) => r.values[c.metric])]);
  return table(['day', 'date', 'time', 'utc', ...keys.map((c) => `${c.label}${c.unit ? ` (${c.unit})` : ''}`)], rows);
}

function habitatSensor(list) {
  const cols = new Map();
  for (const d of list) for (const c of d.record.readings.external.columns) if (!cols.has(c.key)) cols.set(c.key, c);
  const keys = [...cols.values()];
  const rows = [];
  for (const d of list) for (const r of d.record.readings.external.rows) rows.push([...dayCols(d), r.at, r.iso, ...keys.map((c) => r.values[c.key])]);
  return table(['day', 'date', 'time', 'utc', ...keys.map((c) => `${c.label}${c.unit ? ` (${c.unit})` : ''}`)], rows);
}

function hardware(list) {
  const rows = [];
  for (const d of list) for (const h of d.record.readings.hardware) {
    for (const r of h.rows) rows.push([...dayCols(d), r.at, r.iso, h.label, `sensor.${h.id}`, h.kind || '', h.unit || '', r.value, r.state]);
  }
  return table(['day', 'date', 'time', 'utc', 'device', 'entity', 'kind', 'unit', 'value', 'state'], rows);
}

function dailySummary(list) {
  const rows = [];
  for (const d of list) {
    const r = d.record;
    for (const h of r.external) rows.push([...dayCols(d), 'habitat sensor', h.id.replace(/^ext-/, ''), h.label, h.unit || '', h.low, h.high, h.mean, h.samples, '']);
    for (const h of r.habitat) rows.push([...dayCols(d), 'posted readings', h.metric, h.label || h.metric, h.unit || '', h.min_value, h.max_value, h.avg_value, h.samples, '']);
    for (const h of r.hardware) rows.push([...dayCols(d), 'hardware', `sensor.${h.id}`, h.label, h.unit || '', h.low, h.high, h.mean, h.samples, h.added ?? '']);
  }
  return table(['day', 'date', 'source', 'channel', 'name', 'unit', 'low', 'high', 'mean', 'samples', 'added that day'], rows);
}

function sensorsTab(list) {
  const content = require('./content');
  const bike = content.bike();
  const rows = [];
  for (const d of list) {
    const r = d.record, k = dayCols(d);
    // the steps taken, per officer and the crew's
    const f = r.figures;
    if (f && f.crew) for (const [who, line] of Object.entries(f.crew)) rows.push([...k, 'Steps taken', officer.shown(who), 'steps', line.steps, 'steps', 'as filed']);
    if (f && f.steps != null) rows.push([...k, 'Steps taken', 'Crew', 'steps, crew total', f.steps, 'steps', 'as filed']);
    // the power generated: the bike's rounds and the battery
    const b = bike[String(d.n)];
    if (b && (b.rounds != null || b.battery != null)) {
      if (b.rounds != null && b.rounds !== '') rows.push([...k, 'Power generated', 'Bike', 'rounds pedalled', Number(b.rounds), 'rounds', 'as filed']);
      const pct = content.bikeBattery(b);
      if (pct != null) rows.push([...k, 'Power generated', 'Battery', 'battery charged', Math.round(pct * 10) / 10, '%',
        b.battery != null && b.battery !== '' ? 'as filed' : `from the rounds (${content.BIKE_FULL} rounds charge it full)`]);
    }
    // the resources: available at the start, used, left — each counted that day or carried from the day before
    for (const s of r.stores) {
      rows.push([...k, 'Resources', s.label, 'available at the start', s.available, s.unit, 'the day before\'s close (day 1: what was carried in)']);
      rows.push([...k, 'Resources', s.label, 'used today', s.used, s.unit, s.counted.used ? 'counted' : 'carried']);
      rows.push([...k, 'Resources', s.label, 'left for the future', s.left, s.unit, s.counted.left ? 'counted' : 'carried']);
    }
    // the power consumed, by category
    if (r.power && r.power.categories) for (const c of r.power.categories) {
      rows.push([...k, 'Power consumed', c.label, 'energy used', c.kwh, 'kWh', c.source === 'manual' ? 'filed by hand' : c.source === 'sensor' ? 'from its meter' : 'not counted']);
    }
  }
  return table(['day', 'date', 'section', 'item', 'figure', 'value', 'unit', 'note'], rows);
}

function meals(list) {
  const content = require('./content');
  const nut = content.NUTRIENTS || [];
  const rows = [];
  for (const d of list) {
    const day = d.record.day;
    for (const m of (day ? day.meals : [])) {
      rows.push([...dayCols(d), m.slot, m.name, m.components || '', m.kcal, m.water_litres, m.prep_minutes, m.energy_wh,
        m.energy_source || 'none', m.window ? m.window.join('-') : '', m.power_wh ?? '', m.served_at || '', m.power_with || '',
        m.recipe || '', m.co2e_kg ?? '', m.water_footprint_l ?? '', ...nut.map((n) => (m.nutrients ? m.nutrients[n.key] ?? '' : '')), m.notes || '']);
    }
  }
  return table(['day', 'date', 'slot', 'meal', 'components', 'kcal', 'water (L)', 'preparation (min)', 'energy (Wh)', 'energy from',
    'food meter hours', 'food meter (Wh)', 'served at', 'counts with', 'recipe', 'CO2e (kg)', 'water footprint (L)',
    ...nut.map((n) => `${n.label} (${n.unit})`), 'notes'], rows);
}

function mealsTotals(list) {
  const rows = [];
  for (const d of list) {
    const day = d.record.day;
    if (!day || !day.meals.length) continue;
    const metered = day.meals.some((m) => m.energy_source === 'meter') ? day.meals.reduce((s, m) => s + (m.energy_source === 'meter' ? (m.power_wh || 0) : 0), 0) : '';
    rows.push([...dayCols(d), day.meals.length, day.kcalPlanned, day.waterPlanned ? Math.round(day.waterPlanned * 100) / 100 : 0,
      day.energyPlanned || 0, metered, day.co2ePlanned != null ? Math.round(day.co2ePlanned * 1000) / 1000 : '']);
  }
  return table(['day', 'date', 'meals', 'kcal', 'water (L)', 'energy as filed (Wh)', 'food meter (Wh)', 'CO2e (kg)'], rows);
}

const TABLES = {
  'habitat-sensor.csv': habitatSensor, 'hardware.csv': hardware, 'posted-readings.csv': postedReadings,
  'daily-summary.csv': dailySummary, 'sensors-tab.csv': sensorsTab, 'meals.csv': meals, 'meals-totals.csv': mealsTotals,
};
/* the posted readings only where there are any — the habitat's sensor reaches the station through Home Assistant now */
const hasPosted = (list) => list.some((d) => d.record.readings.station.rows.length);

/** The ZIP's sensor-data/ entries: a folder for each day, and all-days/ with every table across them. */
function entries() {
  const list = days();
  const out = [];
  const put = (folder, days) => {
    for (const [name, make] of Object.entries(TABLES)) {
      if (name === 'posted-readings.csv' && !hasPosted(days)) continue;
      out.push({ name: `sensor-data/${folder}/${name}`, data: Buffer.from(make(days)) });
    }
  };
  put('all-days', list);
  for (const d of list) put(d.folder, [d]);
  return { entries: out, days: list.map((d) => ({ folder: d.folder, missionDay: d.n, date: d.date, rehearsal: d.rehearsal })) };
}

const README = [
  'SENSOR DATA',
  '',
  'Everything on the Sensors tab and in Today\'s Meal, day by day, as tables that open in any spreadsheet:',
  'sensor-data/ holds a folder for every day of the run that has happened (day-01_2026-10-15 …) and, before the run,',
  'NOW (day-00_NOW-rehearsal_<date>: today, a rehearsal, not the record), and all-days/ with each table across every',
  'one of those days. In each:',
  '',
  '  habitat-sensor.csv   every reading of the habitat sensor — carbon dioxide, temperature, humidity, air pressure,',
  '                       volatile organic compounds, air quality and its class, light',
  '  hardware.csv         every state the habitat\'s own hardware reported through Home Assistant — the oxygen,',
  '                       carbon monoxide and nitrogen dioxide sensors, the terrarium, every power draw and meter',
  '  posted-readings.csv  readings posted to the station\'s ingest, where there are any',
  '  daily-summary.csv    each channel\'s and device\'s low, high and mean for the day, its samples, what a meter added',
  '  sensors-tab.csv      the Sensors tab\'s figures: steps taken, power generated (rounds pedalled, battery charged),',
  '                       resources (available, used, left — counted or carried) and power consumed by category',
  '  meals.csv            Today\'s Meal: every meal with its kcal, water, preparation, watt hours, CO2e, nutrients …',
  '  meals-totals.csv     the day\'s meals together',
  '',
  'Times are the venue\'s (Europe/Berlin) with the UTC instant beside them. Only what was entered on the station or',
  'measured by its sensors, as stored — nothing projected or generated.',
  '',
  '',
].join('\n');

module.exports = { days, entries, TABLES, README };
