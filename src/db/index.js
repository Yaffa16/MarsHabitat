'use strict';
const fs = require('fs');
const path = require('path');
const Database = require('better-sqlite3');

const DATA_DIR = process.env.DATA_DIR || path.join(__dirname, '../../data');
fs.mkdirSync(DATA_DIR, { recursive: true });

const db = new Database(path.join(DATA_DIR, 'station.db'));
db.exec(fs.readFileSync(path.join(__dirname, 'schema.sql'), 'utf8'));

/* Small forward migrations, so an existing volume from an earlier build comes
   up complete instead of failing on a missing column. */
const columns = (table) => db.prepare(`PRAGMA table_info(${table})`).all().map((c) => c.name);
if (!columns('admin_user').includes('crew_id')) {
  db.exec('ALTER TABLE admin_user ADD COLUMN crew_id INTEGER REFERENCES crew(id)');
}
// Where a logbook entry came from. Entries loaded from content/logbook.json are
// refreshed whenever that file changes; entries typed at the habitat terminal by
// a performer are never overwritten by a file edit.
if (!columns('crew_entry').includes('source')) {
  db.exec("ALTER TABLE crew_entry ADD COLUMN source TEXT NOT NULL DEFAULT 'terminal'");
}

// The recipe book (content/recipes.json): a meal remembers which recipe it
// was filled from, with that recipe's nutrients, CO2e and water footprint.
{
  const have = columns('meal');
  if (!have.includes('recipe')) db.exec("ALTER TABLE meal ADD COLUMN recipe TEXT NOT NULL DEFAULT ''");
  if (!have.includes('nutrients')) db.exec("ALTER TABLE meal ADD COLUMN nutrients TEXT NOT NULL DEFAULT ''");
  if (!have.includes('co2e_kg')) db.exec('ALTER TABLE meal ADD COLUMN co2e_kg REAL');
  if (!have.includes('water_footprint_l')) db.exec('ALTER TABLE meal ADD COLUMN water_footprint_l REAL');
  // An added meal (slot EXTRA1, EXTRA2, …) may carry its own hours, between which the food meter is read for it.
  if (!have.includes('served')) db.exec("ALTER TABLE meal ADD COLUMN served TEXT NOT NULL DEFAULT ''");
}

// The station keeps no log of mission control's doings (13 October: "remove the mission control's log"): the table an
// earlier build wrote a line into for every publish, save, upload, sign-in and deletion goes, with every line in it.
// The one thing read back from it — when the last reset was, which tells an open page to drop the readings it holds —
// is kept in the settings (content.js, resetEpoch).
db.exec('CREATE TABLE IF NOT EXISTS setting (key TEXT PRIMARY KEY, value TEXT NOT NULL)');
if (db.prepare("SELECT 1 FROM sqlite_master WHERE type = 'table' AND name = 'audit'").get()) {
  const last = db.prepare("SELECT MAX(created_at) t FROM audit WHERE action = 'reset'").get();
  if (last && last.t) db.prepare("INSERT INTO setting (key, value) VALUES ('reset.epoch', ?) ON CONFLICT(key) DO NOTHING").run(last.t);
  db.exec('DROP TABLE audit');
}

// Who posted a note or a report (13 October): the desk's sign-in, written into notes.json with the note.
if (!columns('day_note').includes('posted_by')) {
  db.exec("ALTER TABLE day_note ADD COLUMN posted_by TEXT NOT NULL DEFAULT ''");
}

const now = () => new Date().toISOString();

module.exports = { db, now, DATA_DIR };
