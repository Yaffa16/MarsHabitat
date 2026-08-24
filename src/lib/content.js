'use strict';
const fs = require('fs');
const path = require('path');
const { db, now } = require('../db');
const mission = require('./mission');

/**
 * The files in content/ are the source of truth for everything the crew do not
 * write live: the schedule, the meals, the inventory, the mission notes, and
 * the diary entries the crew go in with.
 *
 * Edit a file, save it, and the site changes. There is no build step and no
 * restart: the station watches the folder and reloads within a second or two.
 *
 * The one thing a file edit never overwrites is a diary entry a performer has
 * typed at the habitat terminal. Those belong to them.
 */

const DIR = process.env.CONTENT_DIR || path.join(__dirname, '../../content');

let lastLoad = { at: null, ok: false, errors: [], counts: {} };

function readJson(name, errors) {
  const file = path.join(DIR, name);
  try {
    if (!fs.existsSync(file)) { errors.push(`${name}: not found — skipped`); return null; }
    const raw = fs.readFileSync(file, 'utf8');
    return JSON.parse(raw);
  } catch (e) {
    // Point at the line so a stray comma is a five-second fix, not a hunt.
    const m = /position (\d+)/.exec(e.message);
    let where = '';
    if (m) {
      const upto = fs.readFileSync(file, 'utf8').slice(0, Number(m[1]));
      where = ` (line ${upto.split('\n').length})`;
    }
    errors.push(`${name}: ${e.message}${where}`);
    return null;
  }
}

/** Numeric day keys only — '_note' and '_why' are for whoever edits the file. */
const dayKeys = (obj) => Object.keys(obj || {}).filter((k) => /^\d+$/.test(k)).map(Number).sort((a, b) => a - b);

function ensureDay(n) {
  if (!db.prepare('SELECT 1 FROM day WHERE mission_day = ?').get(n)) {
    db.prepare("INSERT INTO day (mission_day, date, status, updated_at, updated_by) VALUES (?, ?, 'READY', ?, 'content')")
      .run(n, mission.dateForDay(n), now());
  } else {
    db.prepare("UPDATE day SET status = 'READY', date = ?, updated_at = ?, updated_by = 'content' WHERE mission_day = ?")
      .run(mission.dateForDay(n), now(), n);
  }
}

function load({ quiet = false } = {}) {
  const errors = [];
  const counts = { crew: 0, items: 0, channels: 0, tasks: 0, meals: 0, levels: 0, entries: 0, notes: 0, days: 0 };

  const defs = readJson('crew-and-inventory.json', errors);
  const schedule = readJson('schedule.json', errors);
  const meals = readJson('meals.json', errors);
  const levels = readJson('inventory-levels.json', errors);
  const logbook = readJson('logbook.json', errors);
  const notes = readJson('notes.json', errors);
  const sensors = readJson('sensors.json', errors);

  const apply = db.transaction(() => {
    /* ------------------------------------------------------------- crew */
    if (defs && Array.isArray(defs.crew)) {
      defs.crew.forEach((c, i) => {
        const existing = db.prepare('SELECT id FROM crew WHERE designation = ?').get(c.designation);
        if (existing) {
          db.prepare('UPDATE crew SET role = ?, sort_order = ? WHERE id = ?').run(c.role || '', i, existing.id);
        } else {
          const info = db.prepare(
            "INSERT INTO crew (designation, role, activity, status, sort_order) VALUES (?, ?, '', 'ACTIVE', ?)")
            .run(c.designation, c.role || '', i);
          // A new officer starts mid-scale on every axis, so the public crew
          // page reads as a report rather than as missing data.
          db.prepare(
            `INSERT INTO crew_mood (crew_id, calm_tense, energetic_exhausted,
               optimistic_uncertain, connected_isolated, activity, status, effective_at, set_by)
             VALUES (?, 30, 30, 50, 50, '', 'ACTIVE', ?, 'content')`
          ).run(info.lastInsertRowid, now());
        }
        counts.crew++;
      });
      // A crew member removed from the file leaves the station, along with the
      // states and entries attached to them. Renaming a role is a delete plus
      // an insert, so this is what makes a rename take effect.
      const names = defs.crew.map((c) => c.designation);
      const q = names.map(() => '?').join(',') || "''";
      const gone = db.prepare(`SELECT designation FROM crew WHERE designation NOT IN (${q})`).all(...names);
      if (gone.length) {
        db.prepare(`DELETE FROM crew WHERE designation NOT IN (${q})`).run(...names);
        errors.push(`crew-and-inventory.json: removed ${gone.map((g) => g.designation).join(', ')} — no longer listed`);
      }
    }

    /* -------------------------------------------------------- inventory */
    if (defs && Array.isArray(defs.inventory)) {
      defs.inventory.forEach((it, i) => {
        const existing = db.prepare('SELECT id FROM inventory_item WHERE key = ?').get(it.key);
        if (existing) {
          db.prepare('UPDATE inventory_item SET label = ?, unit = ?, category = ?, critical = ?, warn_below = ?, sort_order = ? WHERE id = ?')
            .run(it.label, it.unit, it.category || '', it.critical ? 1 : 0, it.warnBelow || 0, i, existing.id);
        } else {
          db.prepare('INSERT INTO inventory_item (key, label, unit, category, critical, warn_below, sort_order) VALUES (?, ?, ?, ?, ?, ?, ?)')
            .run(it.key, it.label, it.unit, it.category || '', it.critical ? 1 : 0, it.warnBelow || 0, i);
        }
        counts.items++;
      });
      // Items removed from the file leave the site with their history.
      const keys = defs.inventory.map((i) => i.key);
      const placeholders = keys.map(() => '?').join(',') || "''";
      db.prepare(`DELETE FROM inventory_item WHERE key NOT IN (${placeholders})`).run(...keys);
    }

    /* --------------------------------------------------------- monitoring */
    // Channels are upserted, never deleted: a device can register a metric of
    // its own by posting it, and wiping that on the next file load would lose
    // a working sensor because somebody had not written it down yet.
    if (sensors && Array.isArray(sensors.channels)) {
      sensors.channels.forEach((c, i) => {
        if (!c.metric) { errors.push('sensors.json: a channel has no metric name'); return; }
        const existing = db.prepare('SELECT metric FROM sensor_metric WHERE metric = ?').get(c.metric);
        if (existing) {
          db.prepare(`UPDATE sensor_metric SET label = ?, unit = ?, channel = ?,
            warn_min = ?, warn_max = ?, ok_min = ?, ok_max = ?, sort_order = ?, visible = 1
            WHERE metric = ?`).run(c.label || c.metric, c.unit || '', c.channel || '',
              c.warnMin ?? null, c.warnMax ?? null, c.okMin ?? null, c.okMax ?? null, i, c.metric);
        } else {
          db.prepare(`INSERT INTO sensor_metric (metric, label, unit, channel,
            warn_min, warn_max, ok_min, ok_max, sort_order, visible)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 1)`).run(c.metric, c.label || c.metric,
              c.unit || '', c.channel || '', c.warnMin ?? null, c.warnMax ?? null,
              c.okMin ?? null, c.okMax ?? null, i);
        }
        counts.channels = (counts.channels || 0) + 1;
      });
    }

    const total = mission.state().totalDays;
    const days = new Set([
      ...dayKeys(schedule), ...dayKeys(meals), ...dayKeys(levels),
      ...dayKeys(logbook), ...dayKeys(notes),
    ].filter((n) => n >= 1 && n <= total));
    for (const n of days) ensureDay(n);
    counts.days = days.size;

    /* --------------------------------------------------------- schedule */
    if (schedule) {
      for (const n of dayKeys(schedule)) {
        if (n > total) { errors.push(`schedule.json: day ${n} is beyond the ${total}-day mission`); continue; }
        db.prepare("DELETE FROM task WHERE mission_day = ?").run(n);
        (schedule[String(n)] || []).forEach((t, i) => {
          if (!t.label) { errors.push(`schedule.json day ${n}: an entry has no label`); return; }
          db.prepare("INSERT INTO task (mission_day, time, label, detail, status, sort_order) VALUES (?, ?, ?, ?, 'PLANNED', ?)")
            .run(n, t.time || '00:00', t.label, t.detail || '', i);
          counts.tasks++;
        });
      }
    }

    /* ------------------------------------------------------------ meals */
    if (meals) {
      const SLOTS = ['BREAKFAST', 'LUNCH', 'DINNER', 'RATION'];
      for (const n of dayKeys(meals)) {
        if (n > total) continue;
        db.prepare('DELETE FROM meal WHERE mission_day = ?').run(n);
        (meals[String(n)] || []).forEach((m) => {
          const slot = String(m.slot || '').toUpperCase();
          if (!SLOTS.includes(slot)) { errors.push(`meals.json day ${n}: "${m.slot}" is not a slot`); return; }
          if (!m.name) { errors.push(`meals.json day ${n} ${slot}: no name`); return; }
          db.prepare(`INSERT INTO meal (mission_day, slot, name, components, kcal, water_litres,
            prep_minutes, energy_wh, notes) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`)
            .run(n, slot, m.name, m.components || '', m.kcal || 0, m.water || 0,
                 m.prep || 0, m.energy || 0, m.notes || '');
          counts.meals++;
        });
      }
    }

    /* -------------------------------------------------------- inventory */
    // Levels carry forward: a day with no entry inherits yesterday's closing
    // figure minus its draw, so only the days that actually change need writing.
    if (defs && Array.isArray(defs.inventory)) {
      db.prepare('DELETE FROM inventory_level').run();
      const items = db.prepare('SELECT * FROM inventory_item ORDER BY sort_order').all();
      const state = {};
      for (const it of items) {
        const def = defs.inventory.find((d) => d.key === it.key) || {};
        state[it.key] = { quantity: def.start ?? 0, consumption: 0 };
      }
      for (let n = 1; n <= total; n++) {
        const override = (levels && levels[String(n)]) || {};
        for (const it of items) {
          const o = override[it.key];
          if (o && typeof o === 'object') {
            if (o.quantity != null) state[it.key].quantity = Number(o.quantity);
            if (o.consumption != null) state[it.key].consumption = Number(o.consumption);
          } else if (n > 1) {
            state[it.key].quantity = Math.max(0,
              +(state[it.key].quantity - state[it.key].consumption).toFixed(2));
          }
          db.prepare('INSERT INTO inventory_level (item_id, mission_day, quantity, consumption, note) VALUES (?, ?, ?, ?, ?)')
            .run(it.id, n, state[it.key].quantity, state[it.key].consumption, '');
          counts.levels++;
        }
      }
    }

    /* ---------------------------------------------------------- logbook */
    if (logbook) {
      for (const n of dayKeys(logbook)) {
        if (n > total) continue;
        for (const [designation, body] of Object.entries(logbook[String(n)] || {})) {
          if (designation.startsWith('_')) continue;
          const member = db.prepare('SELECT id FROM crew WHERE designation = ?').get(designation);
          if (!member) { errors.push(`logbook.json day ${n}: no crew member "${designation}"`); continue; }
          const existing = db.prepare('SELECT * FROM crew_entry WHERE crew_id = ? AND mission_day = ?')
            .get(member.id, n);
          // Never overwrite something written live, at the terminal or from
          // mission control. Files are the draft; live writing wins.
          if (existing && existing.source !== 'file') continue;
          if (existing) {
            db.prepare("UPDATE crew_entry SET body = ?, updated_at = ?, source = 'file' WHERE id = ?")
              .run(String(body), now(), existing.id);
          } else {
            db.prepare(`INSERT INTO crew_entry (crew_id, mission_day, body, written_at, updated_at, published, source)
              VALUES (?, ?, ?, ?, ?, 1, 'file')`).run(member.id, n, String(body), now(), now());
          }
          counts.entries++;
        }
      }
    }

    /* ------------------------------------------------------------ notes */
    if (notes) {
      for (const n of dayKeys(notes)) {
        if (n > total) continue;
        db.prepare("DELETE FROM day_note WHERE mission_day = ? AND posted_at LIKE '%'").run(n);
        (notes[String(n)] || []).forEach((note) => {
          if (!note.body) return;
          db.prepare('INSERT INTO day_note (mission_day, body, kind, posted_at, published_at) VALUES (?, ?, ?, ?, ?)')
            .run(n, note.body, String(note.kind || 'LOG').toUpperCase(), now(), now());
          counts.notes++;
        });
      }
    }
  });

  try {
    apply();
  } catch (e) {
    errors.push(`apply failed: ${e.message}`);
  }

  lastLoad = { at: now(), ok: errors.length === 0, errors, counts };
  if (!quiet) {
    const summary = `${counts.days} days · ${counts.tasks} tasks · ${counts.meals} meals · ` +
      `${counts.channels || 0} channels · ` +
      `${counts.levels} inventory rows · ${counts.entries} diary entries · ${counts.notes} notes`;
    console.log(`[content] ${errors.length ? 'loaded with warnings' : 'loaded'} — ${summary}`);
    for (const e of errors) console.warn(`[content] ${e}`);
  }
  return lastLoad;
}

/**
 * Watch the folder so an edit is live within a second or two. Debounced,
 * because editors write a file in several bursts.
 */
function watch() {
  if (!fs.existsSync(DIR)) return;
  let timer = null;
  try {
    fs.watch(DIR, { persistent: false }, (event, file) => {
      if (file && !file.endsWith('.json')) return;
      clearTimeout(timer);
      timer = setTimeout(() => {
        console.log(`[content] ${file || 'folder'} changed — reloading`);
        load();
      }, 400);
    });
    console.log(`[content] watching ${DIR} for edits`);
  } catch (e) {
    console.warn(`[content] cannot watch ${DIR}: ${e.message}. Edits will need a restart.`);
  }
}

const status = () => lastLoad;

/**
 * Report templates, read fresh each time. They are only text handed to a form,
 * so there is nothing to sync into the database and an edit is live the moment
 * the file is saved.
 */
/**
 * Crew figures — calories consumed and steps taken, per day. Read fresh like
 * the templates: they are numbers handed straight to a view rather than
 * something to sync into the database, so an edit to the file is live the
 * moment it is saved.
 */
function crewFigures() {
  try {
    return JSON.parse(fs.readFileSync(path.join(DIR, 'crew-figures.json'), 'utf8'));
  } catch { return {}; }
}

function templates(kind) {
  try {
    const obj = JSON.parse(fs.readFileSync(path.join(DIR, 'templates.json'), 'utf8'));
    return Array.isArray(obj[kind]) ? obj[kind] : [];
  } catch { return []; }
}

/**
 * Report templates, read from content/templates.json on demand. They never
 * enter the database: they are prompts for whoever is typing, not records.
 */
/**
 * Crew figures — calories consumed and steps taken, per day. Read fresh like
 * the templates: they are numbers handed straight to a view rather than
 * something to sync into the database, so an edit to the file is live the
 * moment it is saved.
 */
function crewFigures() {
  try {
    return JSON.parse(fs.readFileSync(path.join(DIR, 'crew-figures.json'), 'utf8'));
  } catch { return {}; }
}

function templates(kind) {
  try {
    const all = JSON.parse(fs.readFileSync(path.join(DIR, 'templates.json'), 'utf8'));
    return Array.isArray(all[kind]) ? all[kind] : [];
  } catch { return []; }
}

/**
 * Read a content file as an object, hand it to a mutator, write it back and
 * reload. Mission control's day-content tabs go through here, so editing a day
 * in the interface and editing the file by hand are the same operation on the
 * same source of truth — there is no second copy to drift.
 */
function edit(name, mutate) {
  const file = path.join(DIR, name);
  let obj = {};
  if (fs.existsSync(file)) {
    try { obj = JSON.parse(fs.readFileSync(file, 'utf8')); }
    catch (e) { return { ok: false, error: `${name} is not valid JSON: ${e.message}` }; }
  }
  try {
    mutate(obj);
  } catch (e) {
    return { ok: false, error: `could not apply the change: ${e.message}` };
  }
  fs.writeFileSync(file, JSON.stringify(obj, null, 2) + '\n');
  const result = load({ quiet: true });
  return { ok: result.ok, error: result.errors[0] || null };
}

module.exports = { load, watch, status, edit, templates, crewFigures, DIR };
