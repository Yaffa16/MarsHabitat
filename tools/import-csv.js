'use strict';
/**
 * Bulk day content from the command line. The preset schedule, meals and
 * inventory used to have an editor in mission control; mission control is now
 * one screen for messages, so this is where that capability lives.
 *
 *   node tools/import-csv.js tasks  schedule.csv
 *   node tools/import-csv.js meals  meals.csv
 *
 * tasks: day,time,label,detail
 * meals: day,slot,name,components,kcal,water_litres,prep_minutes,energy_wh
 */
const fs = require('fs');
const { db, now } = require('../src/db');
const mission = require('../src/lib/mission');

function parseCsv(text) {
  const rows = []; let row = [], field = '', quoted = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (quoted) {
      if (c === '"' && text[i + 1] === '"') { field += '"'; i++; }
      else if (c === '"') quoted = false;
      else field += c;
    } else if (c === '"') quoted = true;
    else if (c === ',') { row.push(field); field = ''; }
    else if (c === '\n') { row.push(field); rows.push(row); row = []; field = ''; }
    else if (c !== '\r') field += c;
  }
  if (field || row.length) { row.push(field); rows.push(row); }
  return rows.filter((r) => r.some((f) => f.trim() !== ''));
}

const [kind, file] = process.argv.slice(2);
if (!['tasks', 'meals'].includes(kind) || !file) {
  console.error('usage: node tools/import-csv.js <tasks|meals> <file.csv>');
  process.exit(1);
}

const rows = parseCsv(fs.readFileSync(file, 'utf8').trim());
if (rows.length && !/^\d+$/.test(String(rows[0][0]).trim())) rows.shift();   // header

const ensureDay = (n) => {
  if (!db.prepare('SELECT 1 FROM day WHERE mission_day = ?').get(n)) {
    db.prepare("INSERT INTO day (mission_day, date, status, updated_at, updated_by) VALUES (?, ?, 'READY', ?, 'import')")
      .run(n, mission.dateForDay(n), now());
  }
};

let written = 0, skipped = 0;
const days = new Set();
db.transaction(() => {
  for (const r of rows) {
    const n = Number(String(r[0]).trim());
    if (!Number.isInteger(n) || n < 1) { skipped++; continue; }
    ensureDay(n); days.add(n);
    if (kind === 'tasks') {
      const [, time, label, detail] = r.map((x) => String(x ?? '').trim());
      if (!label) { skipped++; continue; }
      db.prepare("INSERT INTO task (mission_day, time, label, detail, status, sort_order) VALUES (?, ?, ?, ?, 'PLANNED', 0)")
        .run(n, time || '00:00', label, detail || '');
    } else {
      const [, slotRaw, name, comp, kcal, water, prep, energy] = r.map((x) => String(x ?? '').trim());
      const slot = (slotRaw || '').toUpperCase();
      if (!['BREAKFAST', 'LUNCH', 'DINNER', 'RATION'].includes(slot) || !name) { skipped++; continue; }
      db.prepare('DELETE FROM meal WHERE mission_day = ? AND slot = ?').run(n, slot);
      db.prepare(`INSERT INTO meal (mission_day, slot, name, components, kcal, water_litres,
        prep_minutes, energy_wh) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`)
        .run(n, slot, name, (comp || '').replace(/\\n/g, '\n'),
             Number(kcal) || 0, Number(water) || 0, Number(prep) || 0, Number(energy) || 0);
    }
    written++;
  }
  for (const n of days) {
    db.prepare('SELECT id FROM task WHERE mission_day = ? ORDER BY time').all(n)
      .forEach((t, i) => db.prepare('UPDATE task SET sort_order = ? WHERE id = ?').run(i, t.id));
    db.prepare("UPDATE day SET status = 'READY', updated_at = ?, updated_by = 'import' WHERE mission_day = ?")
      .run(now(), n);
  }
})();

console.log(`[import] ${written} ${kind} rows across ${days.size} day(s)` +
  (skipped ? `, ${skipped} skipped` : '') + '. Those days are marked ready.');
