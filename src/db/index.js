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

const now = () => new Date().toISOString();

function audit(actor, entity, entityId, action, detail = '') {
  db.prepare(
    `INSERT INTO audit (actor, entity, entity_id, action, detail, created_at)
     VALUES (?, ?, ?, ?, ?, ?)`
  ).run(actor, entity, String(entityId), action, detail, now());
}

module.exports = { db, audit, now, DATA_DIR };
