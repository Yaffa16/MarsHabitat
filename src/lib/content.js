'use strict';
const fs = require('fs');
const path = require('path');
const { db, now } = require('../db');
const mission = require('./mission');
const run = require('./run');

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
  // Days written beyond the end of the run are left out, not refused: a file
  // written for a longer run must never take the whole site's content down.
  const skipped = [];
  const counts = { crew: 0, items: 0, channels: 0, tasks: 0, meals: 0, levels: 0, entries: 0, notes: 0, days: 0 };

  const defs = readJson('crew-and-inventory.json', errors);
  const schedule = readJson('schedule.json', errors);
  const meals = readJson('meals.json', errors);
  const levels = readJson('inventory-levels.json', errors);
  const logbook = readJson('logbook.json', errors);
  const notes = readJson('notes.json', errors);
  const sensors = readJson('sensors.json', errors);
  const total = mission.state().totalDays;

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

    const days = new Set([
      ...dayKeys(schedule), ...dayKeys(meals), ...dayKeys(levels),
      ...dayKeys(logbook), ...dayKeys(notes),
    ].filter((n) => n >= 1 && n <= total));
    for (const n of days) ensureDay(n);
    counts.days = days.size;

    /* --------------------------------------------------------- schedule */
    if (schedule) {
      for (const n of dayKeys(schedule)) {
        if (n > total) { skipped.push(`schedule.json day ${n}`); continue; }
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
      const book = recipeBook();
      // The file is the food plan: a day the file no longer mentions has no
      // meals, rather than keeping whatever an older version of the file held.
      const inFile = new Set(dayKeys(meals));
      for (let n = 1; n <= total; n++) if (!inFile.has(n)) db.prepare('DELETE FROM meal WHERE mission_day = ?').run(n);
      for (const n of dayKeys(meals)) {
        if (n > total) { skipped.push(`meals.json day ${n}`); continue; }
        db.prepare('DELETE FROM meal WHERE mission_day = ?').run(n);
        (meals[String(n)] || []).forEach((m) => {
          const slot = String(m.slot || '').toUpperCase();
          if (!SLOTS.includes(slot)) { errors.push(`meals.json day ${n}: "${m.slot}" is not a slot`); return; }
          // A meal naming a recipe takes whatever it does not say itself from
          // the recipe book, so "recipe": "pfannenbrot" alone is a whole meal.
          const rec = m.recipe ? book.find((r) => r.slug === m.recipe) : null;
          if (m.recipe && !rec) errors.push(`meals.json day ${n} ${slot}: recipe "${m.recipe}" is not in recipes.json`);
          const name = m.name || (rec && !isPlaceholder(rec.name) ? rec.name : '');
          if (!name) { errors.push(`meals.json day ${n} ${slot}: no name`); return; }
          const nutr = mealNutrients(m.nutrients) || (rec ? rec.nutrients : null);
          const numOr = (v, fb) => (v != null && v !== '' && Number.isFinite(Number(v)) ? Number(v) : fb);
          db.prepare(`INSERT INTO meal (mission_day, slot, name, components, kcal, water_litres,
            prep_minutes, energy_wh, notes, recipe, nutrients, co2e_kg, water_footprint_l)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
            .run(n, slot, name, m.components || '', numOr(m.kcal, rec ? Math.round(rec.kcal) : 0), m.water || 0,
                 numOr(m.prep, rec && rec.prep_minutes != null ? rec.prep_minutes : 0), m.energy || 0, m.notes || '', rec ? rec.slug : String(m.recipe || ''),
                 nutr ? JSON.stringify(nutr) : '',
                 numOr(m.co2e_kg, rec ? rec.co2e_kg : null), numOr(m.water_footprint_l, rec ? rec.water_total_l : null));
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
            // The day's row is: available (what was there at the start),
            // used today, left at the close. Filing either of the last two
            // gives the other: left = available − used, used = available − left.
            const available = state[it.key].quantity;
            const hasQ = o.quantity != null, hasC = o.consumption != null;
            if (hasC) state[it.key].consumption = Number(o.consumption);
            if (hasQ) state[it.key].quantity = Number(o.quantity);
            else if (hasC && n > 1) state[it.key].quantity = Math.max(0, +(available - Number(o.consumption)).toFixed(2));
            if (hasQ && !hasC && n > 1) state[it.key].consumption = Math.max(0, +(available - Number(o.quantity)).toFixed(2));
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
    // The station keeps three blogs: the Commander Blog (the communication
    // officer's entry here) and the science and health officers' daily
    // reports (notes.json). No other officer has a blog of their own, so any
    // entry of theirs — in the file or left in the database — is dropped.
    db.prepare(`DELETE FROM crew_entry WHERE crew_id IN
      (SELECT id FROM crew WHERE designation != ?)`).run(BLOG_OFFICER);
    if (logbook) {
      for (const n of dayKeys(logbook)) {
        if (n > total) { skipped.push(`logbook.json day ${n}`); continue; }
        for (const [designation, body] of Object.entries(logbook[String(n)] || {})) {
          if (designation.startsWith('_')) continue;
          if (designation !== BLOG_OFFICER) continue;   // only the Commander Blog lives in logbook.json
          const member = db.prepare('SELECT id FROM crew WHERE designation = ?').get(designation);
          if (!member) { errors.push(`logbook.json day ${n}: no crew member "${designation}"`); continue; }
          const existing = db.prepare('SELECT * FROM crew_entry WHERE crew_id = ? AND mission_day = ?')
            .get(member.id, n);
          // Never overwrite something written live, at the terminal or from
          // mission control. Files are the draft; live writing wins.
          if (existing && existing.source !== 'file') continue;
          // A placeholder is a slot to write into: kept, shown in mission
          // control, never published.
          const published = isPlaceholder(body) ? 0 : 1;
          if (existing) {
            db.prepare("UPDATE crew_entry SET body = ?, updated_at = ?, published = ?, source = 'file' WHERE id = ?")
              .run(String(body), now(), published, existing.id);
          } else {
            db.prepare(`INSERT INTO crew_entry (crew_id, mission_day, body, written_at, updated_at, published, source)
              VALUES (?, ?, ?, ?, ?, ?, 'file')`).run(member.id, n, String(body), now(), now(), published);
          }
          if (published) counts.entries++;
        }
      }
    }

    /* ------------------------------------------------------------ notes */
    if (notes) {
      for (const n of dayKeys(notes)) if (n > total) skipped.push(`notes.json day ${n}`);
      // The file is the notes: every day of the run is rewritten from it, a
      // day the file no longer mentions included — otherwise a note taken
      // out of the file (or left from an older one) would stay on the station.
      for (let n = 1; n <= total; n++) {
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

  // The stores, day by day, as one flat table beside the files: every item on
  // every day of the run with what was left and what was used. Rewritten on
  // every load so it always matches what the site is showing.
  try { writeResourceLog(levels, total); } catch (e) { errors.push(`resource-log.csv: ${e.message}`); }

  // The stores and the crew's figures, as the files put them, into the
  // readings log — a snapshot every time they change, kept forever.
  try {
    const log = require('./readings-log');
    const items = db.prepare('SELECT key, label, unit, category, critical, warn_below FROM inventory_item ORDER BY sort_order, label').all();
    const pw = power();
    log.record('resources', { missionDays: total, items, levels: resourceLogRows(levels, total),
      power: { categories: pw.categories, days: pw.days } }, { dedupe: true });
    const fig = crewFigures();
    const days = Object.keys(fig).filter((k) => /^\d+$/.test(k)).sort((a, b) => a - b).map((k) => ({ missionDay: Number(k), ...fig[k] }));
    log.record('figures', { days }, { dedupe: true });
  } catch (e) { errors.push(`readings log: ${e.message}`); }

  lastLoad = { at: now(), ok: errors.length === 0, errors, counts };
  if (!quiet) {
    const summary = `${counts.days} days · ${counts.tasks} tasks · ${counts.meals} meals · ` +
      `${counts.channels || 0} channels · ` +
      `${counts.levels} inventory rows · ${counts.entries} diary entries · ${counts.notes} notes`;
    console.log(`[content] ${errors.length ? 'loaded with warnings' : 'loaded'} — ${summary}`);
    for (const e of errors) console.warn(`[content] ${e}`);
    if (skipped.length) console.warn(`[content] beyond the ${total}-day run, left out: ${skipped.join(', ')} — the run is ${total} days (src/lib/run.js)`);
  }
  return lastLoad;
}

/* ------------------------------------------------------------ resource log */

const LOG_FILE = 'resource-log.csv';
const LOG_HEADER = ['mission_day', 'date', 'item', 'label', 'unit', 'quantity_at_close', 'daily_use',
  'used_since_start', 'remaining_pct', 'days_left_at_this_use', 'source', 'note'];

const csvCell = (v) => {
  const s = v == null ? '' : String(v);
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

/**
 * The daily use of every store, as rows. Built from the same inventory rows
 * the site draws, so the file, the gauges and the trend graph never disagree.
 * A day is "filed" when inventory-levels.json (or the Habitat tab, which
 * writes into it) says something about that item on that day; otherwise it
 * is "carried" — yesterday's figure less the daily draw.
 */
function resourceLogRows(levels = null, total = null) {
  if (!levels) levels = readJson('inventory-levels.json', []) || {};
  if (!total) total = mission.state().totalDays;
  // What was carried in, per item — the figure "used since start" counts from.
  const carried = {};
  for (const d of ((readJson('crew-and-inventory.json', []) || {}).inventory || [])) carried[d.key] = d.start;
  const rows = db.prepare(
    `SELECT il.mission_day, il.quantity, il.consumption, i.key, i.label, i.unit, i.sort_order,
       (SELECT quantity FROM inventory_level WHERE item_id = i.id ORDER BY mission_day LIMIT 1) AS start_quantity
     FROM inventory_level il JOIN inventory_item i ON i.id = il.item_id
     WHERE il.mission_day <= ? ORDER BY il.mission_day, i.sort_order, i.label`
  ).all(total);
  return rows.map((r) => {
    const over = (levels[String(r.mission_day)] || {})[r.key];
    const filed = over && typeof over === 'object' && (over.quantity != null || over.consumption != null);
    const why = filed ? (levels[String(r.mission_day)]._why || '') : '';
    const start = carried[r.key] ?? r.start_quantity ?? r.quantity;
    return {
      mission_day: r.mission_day,
      date: mission.dateForDay(r.mission_day),
      item: r.key, label: r.label, unit: r.unit,
      quantity_at_close: r.quantity,
      daily_use: r.consumption,
      used_since_start: +(start - r.quantity).toFixed(2),
      remaining_pct: start > 0 ? Math.round((r.quantity / start) * 100) : null,
      days_left_at_this_use: r.consumption > 0 ? +(r.quantity / r.consumption).toFixed(1) : null,
      source: filed ? 'filed' : 'carried',
      note: why,
    };
  });
}

function resourceLogCsv(levels, total) {
  const lines = [LOG_HEADER.join(',')];
  for (const r of resourceLogRows(levels, total)) lines.push(LOG_HEADER.map((k) => csvCell(r[k])).join(','));
  return lines.join('\n') + '\n';
}

/** content/resource-log.csv, rewritten only when its contents change. */
function writeResourceLog(levels, total) {
  const file = path.join(DIR, LOG_FILE);
  const next = resourceLogCsv(levels, total);
  let cur = null;
  try { cur = fs.readFileSync(file, 'utf8'); } catch { /* not there yet */ }
  if (cur !== next) fs.writeFileSync(file, next);
}

/* ---------------------------------------------------------- the plan, reset */

/**
 * The plan is a copy of the content files as they should be on 15 October,
 * kept in content/plan/. It is made once from the shipped files if it does
 * not exist, and can be re-saved from mission control after the files have
 * been edited. Reset puts the plan back and clears everything written live
 * since — so a rehearsal in the weeks before can be wiped in one move and
 * the station opens clean.
 */
const PLAN_DIR = path.join(DIR, 'plan');
const PLAN_FILES = ['crew-and-inventory.json', 'schedule.json', 'meals.json', 'inventory-levels.json',
  'logbook.json', 'notes.json', 'sensors.json', 'templates.json', 'crew-figures.json', 'power.json', 'recipes.json'];

function planStatus() {
  const files = PLAN_FILES.filter((f) => fs.existsSync(path.join(PLAN_DIR, f)));
  let savedAt = null;
  for (const f of files) {
    const t = fs.statSync(path.join(PLAN_DIR, f)).mtime.toISOString();
    if (!savedAt || t > savedAt) savedAt = t;
  }
  return { exists: files.length > 0, files, savedAt, dir: PLAN_DIR };
}

/**
 * Copy one file by reading and writing it. Not fs.copyFile: on a folder
 * mounted into Docker from a Windows or macOS host, copyFile ends by setting
 * the copy's permissions to match the original, which the mount refuses
 * with EPERM — and content/ is exactly such a folder. A plain write is what
 * the Habitat tab does on every save, and that works everywhere.
 */
function copyText(src, dest) {
  fs.writeFileSync(dest, fs.readFileSync(src));
}

/** Copy the content files as they are now into content/plan/. */
function savePlan() {
  fs.mkdirSync(PLAN_DIR, { recursive: true });
  let n = 0;
  for (const f of PLAN_FILES) {
    const src = path.join(DIR, f);
    if (!fs.existsSync(src)) continue;
    copyText(src, path.join(PLAN_DIR, f));
    n++;
  }
  return n;
}

/**
 * A plan exists from the first boot on, so reset always has something to put
 * back. And the other way round: a content file that has gone missing while
 * the plan still has it is put back at start-up — a copy that failed halfway
 * (Node removes the destination when copyFile fails, which is how a reset on
 * a mounted folder once lost crew-and-inventory.json) must never leave the
 * station serving a stale version of a file that is one copy away.
 */
function ensurePlan() {
  if (!planStatus().exists) {
    const n = savePlan();
    if (n) console.log(`[content] plan saved from the shipped files: ${n} files in content/plan/`);
    return;
  }
  for (const f of PLAN_FILES) {
    const src = path.join(PLAN_DIR, f), dest = path.join(DIR, f);
    if (fs.existsSync(dest) || !fs.existsSync(src)) continue;
    copyText(src, dest);
    console.warn(`[content] ${f} was missing from content/ — restored from the plan`);
  }
}

/**
 * The reset is for the weeks before the run: rehearse, then press it once
 * and the station opens on 15 October clean. From 15 October the run is the
 * record, and the button is locked — a stray press could not be undone. A
 * rehearsal against made-up dates (MISSION_OVERRIDE) is never locked.
 */
function resetLocked(state) {
  const st = state || mission.state();
  if (run.dates().override) return false;
  return st.phase !== 'PRE_LAUNCH';
}

/**
 * Start again for 15 October. The files in content/ — schedule, meals,
 * inventory levels, notes, sensors, figures, templates, crew — are the plan,
 * as they stand at the moment the button is pressed: nothing is copied over
 * them. What the reset does is clear everything written live and reload
 * the mission from those files:
 *
 *   - every blog slot is emptied — logbook.json becomes a placeholder for
 *     every day and officer, for the crew to fill in during the run
 *   - the crew's figures are emptied — crew-figures.json loses its days;
 *     calories and steps are filed daily on the Habitat tab from 15 October
 *   - the power figures, the stores' counts and the mission notes are
 *     emptied the same way — power.json, inventory-levels.json and
 *     notes.json lose their days and keep their notes and categories; each
 *     is filed during the run. The stores start from what was carried in
 *     (crew-and-inventory.json) and carry forward until a day is counted.
 *   - messages, replies and callsigns from Earth go
 *   - every crew state filed goes; the crew begin with nothing filed
 *   - media sent out goes from the record (the files stay on disk under
 *     their hashes, as everywhere else in the station)
 *   - every habitat reading goes — the station's own ingest and the readings
 *     polled from the external node — and the readings, and the trend
 *     graph, start on 15 October (src/lib/critical.js): nothing from before
 *     the run is stored or shown
 *   - the sealed daily records, task statuses and live notes go
 *   - the inventory, schedule, meals and notes are rebuilt from the files
 *
 * Kept: the account and its sessions, the audit trail (the reset is
 * written to it), and the readings log on disk — every reading ever pulled,
 * which nothing touches.
 */
function reset(actor = 'control') {
  if (resetLocked()) throw new Error('the run has begun — the reset is locked from 15 October');
  const mediaLib = require('./media');
  const st = mission.state();

  // 1. the blog slots, emptied
  const crewFile = readJson('crew-and-inventory.json', []) || {};
  // Only the Commander Blog has slots in logbook.json: the science and health
  // blogs are the officers' daily reports, written into notes.json.
  const crew = (crewFile.crew || []).map((c) => c.designation).filter((d) => d === BLOG_OFFICER);
  const slots = {};
  for (let n = 1; n <= st.totalDays; n++) {
    slots[String(n)] = {};
    for (const d of crew) slots[String(n)][d] = placeholderFor(n, d);
  }
  // The crew's figures are dailies, counted by the health officer at the end
  // of each day — like the blog they start empty and fill in as the run goes.
  const cf = path.join(DIR, 'crew-figures.json');
  fs.writeFileSync(cf, JSON.stringify({
    _note: 'Calories consumed and steps taken, per officer and per day. Emptied by the reset: the health officer files each day\'s figures on the Health tab of mission control (or write them here as "1": { "crew": { "COMMUNICATION OFFICER": { "calories": 1720, "steps": 2200 }, "SCIENCE OFFICER": { … }, "HEALTH OFFICER": { … } }, "calories": 5010, "steps": 6420 } — the two totals being the sums), and each day appears on the station the moment it is saved.',
  }, null, 2) + '\n');

  // Power is a daily count too: the categories stay as they are shaped, the
  // days are emptied — each day's kWh is filed on the Habitat tab as it ends.
  const pw = path.join(DIR, 'power.json');
  fs.writeFileSync(pw, JSON.stringify({
    _note: 'Power consumed inside the habitat, in kWh per day, split by category. Rename or reshape the categories freely; the key is the stable name in the record, the label is what the station shows. Emptied of its days by the reset: file each day\'s figures on the Habitat tab of mission control (or write them here as "1": { "heating": 1.1, ... }) and each day appears on the station the moment it is saved.',
    categories: power().categories,
    days: {},
  }, null, 2) + '\n');

  const lb = path.join(DIR, 'logbook.json');
  let note = null;
  try { note = (JSON.parse(fs.readFileSync(lb, 'utf8')) || {})._note || null; } catch { /* rewritten below */ }
  fs.writeFileSync(lb, JSON.stringify({ ...(note ? { _note: note } : {}), ...slots }, null, 2) + '\n');
  try { fs.unlinkSync(path.join(DIR, LOG_FILE)); } catch { /* not there */ }

  // The stores' counts and the mission notes are dailies too — counted and
  // filed as the run goes. Their days are emptied; the file's own note stays.
  const emptyDays = (name, fallbackNote) => {
    const file = path.join(DIR, name);
    let kept = null;
    try { kept = (JSON.parse(fs.readFileSync(file, 'utf8')) || {})._note || null; } catch { /* rewritten below */ }
    fs.writeFileSync(file, JSON.stringify({ _note: kept || fallbackNote }, null, 2) + '\n');
  };
  emptyDays('inventory-levels.json', 'Quantity remaining at the end of each mission day and the daily draw, per store, over the thirteen days of the run — counted on the Habitat tab of mission control, or written here as "5": { "water": { "quantity": 440, "consumption": 36 } }. A day with no entry carries forward on the site from the previous day at its draw; the record prints only the days that were counted.');
  emptyDays('notes.json', 'Mission notes filed from control, over the thirteen days of the run: "3": [ { "kind": "LOG", "body": "…" } ]. kind is LOG or ANOMALY; the science officer\'s findings (SCIENCE) and the health officer\'s activities (HEALTH) are written on their tabs of mission control.');

  // 2. the database
  const wiped = {};
  const wipe = db.transaction(() => {
    for (const t of ['response', 'message', 'visitor', 'crew_entry', 'crew_mood', 'media',
                     'sensor_reading', 'sensor_daily', 'day_seal', 'day_note', 'task', 'meal', 'inventory_level',
                     'external_reading', 'ha_reading', 'control_edit', 'control_draft']) {
      wiped[t] = db.prepare(`DELETE FROM ${t}`).run().changes;
    }
    db.prepare("UPDATE day SET status = 'DRAFT', updated_at = ?, updated_by = 'reset'").run(now());
  });
  wipe();
  try { mediaLib.writeManifest(); } catch { /* the manifest is a convenience */ }
  // The readings start on the first day of the run (or the pinned
  // READINGS_FROM date): nothing from before 15 October is kept or shown.
  try {
    const critical = require('./critical');
    critical.setFloor('reset', 'run');
    // and the source is read again straight away — the habitat sensor
    // through Home Assistant, or the node, whichever feeds the station
    if (process.env.CRITICAL_POLL !== 'false') setTimeout(() => {
      const p = critical.source() === 'home-assistant' ? require('./habitat-feed').poll() : critical.poll();
      p.catch(() => {});
    }, 500);
  } catch (e) { console.warn('[content] readings floor not moved:', e.message); }
  // The habitat's own hardware starts again with the run too.
  try {
    const ha = require('./home-assistant');
    ha.clear();
    if (process.env.HA_POLL !== 'false') setTimeout(() => ha.poll().catch(() => {}), 500);
  } catch (e) { console.warn('[content] hardware readings not cleared:', e.message); }

  // 3. the files back into the database
  const loaded = load();
  db.prepare('INSERT INTO audit (actor, entity, entity_id, action, detail, created_at) VALUES (?, ?, ?, ?, ?, ?)')
    .run(actor, 'station', '1', 'reset', JSON.stringify({ slots: crew.length * st.totalDays, wiped }), now());
  console.log(`[content] RESET by ${actor}: ${crew.length * st.totalDays} blog slots emptied; wiped ` +
    Object.entries(wiped).filter(([, n]) => n).map(([t, n]) => `${t} ${n}`).join(', ') + '; mission reloaded from content/');
  return { slots: crew.length * st.totalDays, wiped, loaded };
}

/** When the last reset happened — the browser drops its cached readings when this changes. */
/** What was carried in, per store key — from crew-and-inventory.json. */
function inventoryStart() {
  try {
    const j = JSON.parse(fs.readFileSync(path.join(DIR, 'crew-and-inventory.json'), 'utf8'));
    const out = {};
    for (const it of (j.inventory || [])) if (it && it.key) out[it.key] = it.start ?? null;
    return out;
  } catch { return {}; }
}

function resetEpoch() {
  const r = db.prepare("SELECT MAX(created_at) t FROM audit WHERE action = 'reset'").get();
  return r && r.t ? r.t : null;
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
 * Power consumed inside the habitat, kWh per day, split by category —
 * heating, food, lighting, electronics, other, as content/power.json ships
 * them, though the categories are editable there and on the Habitat tab:
 * the key is the stable name in the record, the label is what is shown.
 * Read fresh like the crew figures: numbers handed straight to a view, so
 * an edit to the file is live the moment it is saved.
 */
const POWER_DEFAULTS = [
  { key: 'heating', label: 'habitat_power_kitchen_energie', sensor: 'habitat_power_kitchen_energie' },
  { key: 'food', label: 'Food' },
  { key: 'lighting', label: 'Lighting' },
  { key: 'electronics', label: 'Electronics' },
  { key: 'other', label: 'Other' },
];

function power() {
  let obj = {};
  try { obj = JSON.parse(fs.readFileSync(path.join(DIR, 'power.json'), 'utf8')) || {}; }
  catch { /* defaults below */ }
  const categories = (Array.isArray(obj.categories) ? obj.categories : [])
    .filter((c) => c && c.key && /^[a-z0-9_-]+$/i.test(String(c.key)))
    .map((c) => ({ key: String(c.key), label: String(c.label || c.key),
      ...(c.sensor && /^[a-z0-9_]+$/i.test(String(c.sensor)) ? { sensor: String(c.sensor) } : {}) }));
  const days = {};
  for (const [k, v] of Object.entries(obj.days && typeof obj.days === 'object' ? obj.days : {})) {
    if (!/^\d+$/.test(k) || !v || typeof v !== 'object') continue;
    const d = {};
    for (const [key, val] of Object.entries(v)) {
      const n = Number(val);
      if (Number.isFinite(n) && n >= 0) d[key] = n;
    }
    days[k] = d;
  }
  return { categories: categories.length ? categories : POWER_DEFAULTS.map((c) => ({ ...c })), days };
}

/* ------------------------------------------------------------ recipe book */

/**
 * The recipe book, content/recipes.json: the dishes the food plan's Breakfast,
 * Lunch and Dinner dropdowns offer. Each carries its per-serving figures —
 * kcal, the six nutrients, CO2e and the water footprint — which fill the slot
 * when the recipe is chosen. Read fresh on every call, like the power file,
 * so an edit is live the moment it is saved. A slot keeps its own copy of the
 * figures (meals.json), so changing a recipe never rewrites a planned day.
 */
const NUTRIENTS = [
  { key: 'protein_g', label: 'Protein', unit: 'g' },
  { key: 'fat_g', label: 'Fat', unit: 'g' },
  { key: 'carb_g', label: 'Carbohydrate', unit: 'g' },
  { key: 'fiber_g', label: 'Fibre', unit: 'g' },
  { key: 'sugar_g', label: 'Sugar', unit: 'g' },
  { key: 'sodium_mg', label: 'Sodium', unit: 'mg' },
];

/** Six numbers or nothing: a nutrients object with at least one real value. */
function mealNutrients(obj) {
  if (!obj || typeof obj !== 'object') return null;
  const out = {}; let any = false;
  for (const { key } of NUTRIENTS) {
    const v = obj[key];
    if (v === '' || v == null || !Number.isFinite(Number(v))) continue;
    out[key] = Number(v); any = true;
  }
  return any ? out : null;
}

const slugify = (s) => String(s || '').toLowerCase().normalize('NFKD').replace(/[\u0300-\u036f]/g, '')
  .replace(/ß/g, 'ss').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 60) || 'recipe';

/** The raw file: { _note, recipes: [...] } — kept whole so an edit preserves what it does not touch. */
function recipesFile() {
  try {
    const obj = JSON.parse(fs.readFileSync(path.join(DIR, 'recipes.json'), 'utf8')) || {};
    return { ...obj, recipes: Array.isArray(obj.recipes) ? obj.recipes : [] };
  } catch { return { recipes: [] }; }
}

/** The recipes, flattened for the desk and the loader. */
function recipeBook() {
  const seen = new Set();
  return recipesFile().recipes.filter((r) => r && r.name).map((r) => {
    let slug = String(r.slug || slugify(r.name));
    while (seen.has(slug)) slug += '-2';
    seen.add(slug);
    const ps = r.per_serving || {};
    const num = (v) => (v == null || v === '' || !Number.isFinite(Number(v)) ? null : Number(v));
    const nutrients = {};
    for (const { key } of NUTRIENTS) nutrients[key] = num((ps.nutrients || {})[key]);
    return {
      slug, name: String(r.name), placeholder: isPlaceholder(String(r.name)),
      servings: num(r.servings),
      kcal: num(ps.kcal), nutrients, co2e_kg: num(ps.co2e_kg), water_total_l: num(ps.water_total_l),
      prep_minutes: num(r.prep_minutes), sample: !!r.sample,
      coverage: r.coverage || null,
    };
  });
}

/**
 * The stores as they were counted on one day: exactly what inventory-levels.json
 * holds for that day — quantity left at the close and/or the day's use, per
 * store, whichever was written (the Habitat tab writes what its fields hold) —
 * with the day's `_why` note. Nothing carried forward, nothing derived: a
 * store not written for that day is not in `items`. This is what the record
 * prints; the site's day-by-day levels (data.day) carry forward instead.
 */
function inventoryFiled(missionDay) {
  let entry = null;
  try {
    const obj = JSON.parse(fs.readFileSync(path.join(DIR, 'inventory-levels.json'), 'utf8')) || {};
    entry = obj[String(missionDay)];
  } catch { entry = null; }
  if (!entry || typeof entry !== 'object') return { why: '', items: [] };
  const items = db.prepare('SELECT key, label, unit FROM inventory_item ORDER BY sort_order, label').all();
  const out = [];
  for (const it of items) {
    const o = entry[it.key];
    if (!o || typeof o !== 'object') continue;
    const q = o.quantity != null && Number.isFinite(Number(o.quantity)) ? Number(o.quantity) : null;
    const c = o.consumption != null && Number.isFinite(Number(o.consumption)) ? Number(o.consumption) : null;
    if (q == null && c == null) continue;
    out.push({ key: it.key, label: it.label, unit: it.unit, quantity: q, consumption: c });
  }
  return { why: entry._why ? String(entry._why) : '', items: out };
}

/** One day of it: each category with its kWh, the day total, and whether anything was filed. */
/* A category read from a meter (its "sensor" in power.json names a Home
   Assistant counter): the day's kWh as the meter has it — today's reading less
   yesterday's total. null when the meter has nothing for that day. */
function powerSensorKwh(c, missionDay) {
  if (!c || !c.sensor) return null;
  try { return require('./home-assistant').counterDay(c.sensor, Number(missionDay)); } catch { return null; }
}

/* The power file as the station shows it: each day's figures, with a metered
   category filled in from its meter wherever no figure was filed by hand. */
function powerLive() {
  const p = power();
  const metered = p.categories.filter((c) => c.sensor);
  if (!metered.length) return p;
  let total = 13;
  try { total = require('./mission').state().totalDays || total; } catch { /* the run's usual length */ }
  for (let n = 1; n <= total; n++) {
    for (const c of metered) {
      const d = p.days[String(n)] || {};
      if (d[c.key] != null) continue;
      const v = powerSensorKwh(c, n);
      if (v == null) continue;
      p.days[String(n)] = { ...d, [c.key]: v };
    }
  }
  return p;
}

function powerDay(missionDay, p = power()) {
  const d = p.days[String(missionDay)] || {};
  // A figure filed by hand wins; a category tied to a meter otherwise reads the meter.
  const categories = p.categories.map((c) => {
    const manual = d[c.key] ?? null;
    const metered = manual == null ? powerSensorKwh(c, missionDay) : null;
    return { ...c, kwh: manual ?? metered, source: manual != null ? 'manual' : metered != null ? 'sensor' : null };
  });
  const filed = categories.some((c) => c.kwh != null);
  const total = categories.reduce((s, c) => s + (c.kwh || 0), 0);
  return { categories, total: Math.round(total * 100) / 100, filed };
}

/**
 * Read a content file as an object, hand it to a mutator, write it back and
 * reload. Mission control's day-content tabs go through here, so editing a day
 * in the interface and editing the file by hand are the same operation on the
 * same source of truth — there is no second copy to drift.
 */
/**
 * An entry whose text begins with [PLACEHOLDER] is a slot, not an entry: it
 * ships in logbook.json for every day and officer, is shown in mission
 * control to be written over, and never reaches the public station.
 */
const PLACEHOLDER = '[PLACEHOLDER]';
/** The one officer whose entries are a blog: theirs is the Commander Blog. */
const BLOG_OFFICER = 'COMMUNICATION OFFICER';   // the commanding officer, filed under their old title: the key stays (lib/officer.js shows the new one)
const isPlaceholder = (body) => String(body || '').trimStart().startsWith(PLACEHOLDER);
/** The cue shown in an empty box in mission control: the placeholder text without its marker. */
const placeholderCue = (body) => String(body || '').trimStart().slice(PLACEHOLDER.length).trim();
/** What the public sees in the slot: the first line only — the writer's cue stays inside. */
const placeholderPublic = (body) => placeholderCue(body).split('\n')[0].trim();
const placeholderFor = (day, designation) =>
  `${PLACEHOLDER} Day ${String(day).padStart(3, '0')} · ${designation === BLOG_OFFICER ? 'Commander Blog' : designation.charAt(0) + designation.slice(1).toLowerCase()} — to be written at the end of this day.`;

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

module.exports = { load, watch, status, edit, templates, crewFigures, power, powerDay, powerSensorKwh, powerLive, inventoryFiled, DIR,
                   resourceLogRows, resourceLogCsv, LOG_FILE,
                   planStatus, savePlan, ensurePlan, reset, resetLocked, resetEpoch, inventoryStart, PLAN_DIR, PLAN_FILES,
                   PLACEHOLDER, BLOG_OFFICER, isPlaceholder, placeholderCue, placeholderPublic, placeholderFor,
                   NUTRIENTS, mealNutrients, recipesFile, recipeBook, slugify };
