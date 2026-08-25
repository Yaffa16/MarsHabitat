PRAGMA journal_mode = WAL;
PRAGMA foreign_keys = ON;

-- ---------------------------------------------------------------- mission
CREATE TABLE IF NOT EXISTS mission (
  id          INTEGER PRIMARY KEY CHECK (id = 1),
  name        TEXT NOT NULL,
  start_date  TEXT NOT NULL,          -- YYYY-MM-DD, venue-local
  end_date    TEXT NOT NULL,
  timezone    TEXT NOT NULL DEFAULT 'Europe/Berlin',
  status      TEXT NOT NULL DEFAULT 'NOMINAL'
);

-- ------------------------------------------------------------------- crew
CREATE TABLE IF NOT EXISTS crew (
  id           INTEGER PRIMARY KEY,
  designation  TEXT NOT NULL UNIQUE,  -- "ASTRONAUT A"
  role         TEXT NOT NULL,
  activity     TEXT NOT NULL DEFAULT '',
  status       TEXT NOT NULL DEFAULT 'ACTIVE',
  sort_order   INTEGER NOT NULL DEFAULT 0
);

-- Append-only mood log. The public sees the newest row; the archive keeps the trace.
CREATE TABLE IF NOT EXISTS crew_mood (
  id                    INTEGER PRIMARY KEY,
  crew_id               INTEGER NOT NULL REFERENCES crew(id) ON DELETE CASCADE,
  calm_tense            INTEGER NOT NULL,   -- 0 = calm        .. 100 = tense
  energetic_exhausted   INTEGER NOT NULL,   -- 0 = energetic   .. 100 = exhausted
  optimistic_uncertain  INTEGER NOT NULL,   -- 0 = optimistic  .. 100 = uncertain
  connected_isolated    INTEGER NOT NULL,   -- 0 = connected   .. 100 = isolated
  activity              TEXT NOT NULL DEFAULT '',
  status                TEXT NOT NULL DEFAULT 'ACTIVE',
  note                  TEXT NOT NULL DEFAULT '',
  effective_at          TEXT NOT NULL,
  set_by                TEXT NOT NULL DEFAULT 'control',
  amended               INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS idx_mood_crew ON crew_mood(crew_id, effective_at DESC);

CREATE TABLE IF NOT EXISTS mood_preset (
  id      INTEGER PRIMARY KEY,
  name    TEXT NOT NULL UNIQUE,
  values_json TEXT NOT NULL
);

-- -------------------------------------------------------------- day content
CREATE TABLE IF NOT EXISTS day (
  mission_day  INTEGER PRIMARY KEY,
  date         TEXT NOT NULL,
  status       TEXT NOT NULL DEFAULT 'DRAFT',   -- DRAFT | READY | ARCHIVED
  updated_at   TEXT NOT NULL,
  updated_by   TEXT NOT NULL DEFAULT 'control'
);

CREATE TABLE IF NOT EXISTS task (
  id           INTEGER PRIMARY KEY,
  mission_day  INTEGER NOT NULL REFERENCES day(mission_day) ON DELETE CASCADE,
  time         TEXT NOT NULL,
  label        TEXT NOT NULL,
  detail       TEXT NOT NULL DEFAULT '',
  crew_ids     TEXT NOT NULL DEFAULT '',        -- comma separated
  status       TEXT NOT NULL DEFAULT 'PLANNED', -- PLANNED | ACTIVE | DONE | SKIPPED
  sort_order   INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS idx_task_day ON task(mission_day, sort_order);

CREATE TABLE IF NOT EXISTS meal (
  id           INTEGER PRIMARY KEY,
  mission_day  INTEGER NOT NULL REFERENCES day(mission_day) ON DELETE CASCADE,
  slot         TEXT NOT NULL,                   -- BREAKFAST | LUNCH | DINNER | RATION
  name         TEXT NOT NULL,
  components   TEXT NOT NULL DEFAULT '',        -- one per line: "item | qty"
  kcal         INTEGER NOT NULL DEFAULT 0,
  water_litres REAL NOT NULL DEFAULT 0,
  prep_minutes INTEGER NOT NULL DEFAULT 0,
  energy_wh    INTEGER NOT NULL DEFAULT 0,
  notes        TEXT NOT NULL DEFAULT ''
);
CREATE INDEX IF NOT EXISTS idx_meal_day ON meal(mission_day);

CREATE TABLE IF NOT EXISTS day_note (
  id           INTEGER PRIMARY KEY,
  mission_day  INTEGER NOT NULL REFERENCES day(mission_day) ON DELETE CASCADE,
  body         TEXT NOT NULL,
  kind         TEXT NOT NULL DEFAULT 'LOG',     -- LOG | ANOMALY | BROADCAST
  posted_at    TEXT NOT NULL,
  published_at TEXT
);
CREATE INDEX IF NOT EXISTS idx_note_day ON day_note(mission_day, posted_at DESC);

-- --------------------------------------------------------------- inventory
CREATE TABLE IF NOT EXISTS inventory_item (
  id         INTEGER PRIMARY KEY,
  key        TEXT NOT NULL UNIQUE,
  label      TEXT NOT NULL,
  unit       TEXT NOT NULL,
  category   TEXT NOT NULL,
  critical   INTEGER NOT NULL DEFAULT 0,
  warn_below REAL NOT NULL DEFAULT 0,
  sort_order INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS inventory_level (
  id          INTEGER PRIMARY KEY,
  item_id     INTEGER NOT NULL REFERENCES inventory_item(id) ON DELETE CASCADE,
  mission_day INTEGER NOT NULL,
  quantity    REAL NOT NULL,
  consumption REAL NOT NULL DEFAULT 0,
  note        TEXT NOT NULL DEFAULT '',
  UNIQUE (item_id, mission_day)
);

-- ----------------------------------------------------------------- sensors
CREATE TABLE IF NOT EXISTS sensor_reading (
  id          INTEGER PRIMARY KEY,
  device_id   TEXT NOT NULL,
  metric      TEXT NOT NULL,
  value       REAL NOT NULL,
  unit        TEXT NOT NULL,
  recorded_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_reading ON sensor_reading(metric, recorded_at DESC);

CREATE TABLE IF NOT EXISTS sensor_metric (
  metric      TEXT PRIMARY KEY,
  label       TEXT NOT NULL,
  unit        TEXT NOT NULL,
  ok_min      REAL,
  ok_max      REAL,
  warn_min    REAL,
  warn_max    REAL,
  channel     TEXT NOT NULL DEFAULT '',
  sort_order  INTEGER NOT NULL DEFAULT 0,
  visible     INTEGER NOT NULL DEFAULT 1
);

-- ---------------------------------------------------------------- visitors
CREATE TABLE IF NOT EXISTS visitor (
  id         INTEGER PRIMARY KEY,
  callsign   TEXT NOT NULL UNIQUE,
  token      TEXT NOT NULL UNIQUE,
  created_at TEXT NOT NULL,
  last_seen  TEXT NOT NULL
);

-- ---------------------------------------------------------------- messages
CREATE TABLE IF NOT EXISTS message (
  id             INTEGER PRIMARY KEY,
  visitor_id     INTEGER NOT NULL REFERENCES visitor(id) ON DELETE CASCADE,
  callsign       TEXT NOT NULL,
  body           TEXT NOT NULL,
  tags           TEXT NOT NULL DEFAULT '',
  state          TEXT NOT NULL DEFAULT 'IN_TRANSIT',
  mission_day    INTEGER NOT NULL,
  submitted_at   TEXT NOT NULL,
  arrival_at     TEXT NOT NULL,       -- server authority for the transit lock
  light_seconds  REAL NOT NULL,       -- real Earth-Mars light time at send
  distance_au    REAL NOT NULL,
  reviewed_at    TEXT,
  reviewed_by    TEXT,
  reject_reason  TEXT,
  flagged        INTEGER NOT NULL DEFAULT 0,
  ip_hash        TEXT NOT NULL DEFAULT ''
);
CREATE INDEX IF NOT EXISTS idx_msg_state ON message(state, submitted_at DESC);
CREATE INDEX IF NOT EXISTS idx_msg_visitor ON message(visitor_id, submitted_at DESC);

CREATE TABLE IF NOT EXISTS response (
  id           INTEGER PRIMARY KEY,
  message_id   INTEGER NOT NULL UNIQUE REFERENCES message(id) ON DELETE CASCADE,
  body         TEXT NOT NULL,
  crew_id      INTEGER REFERENCES crew(id) ON DELETE SET NULL,
  written_at   TEXT NOT NULL,
  published_at TEXT
);

-- ------------------------------------------------------------------- admin
CREATE TABLE IF NOT EXISTS admin_user (
  id            INTEGER PRIMARY KEY,
  username      TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  role          TEXT NOT NULL DEFAULT 'OPERATOR',  -- CONTROL | OPERATOR
  created_at    TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS admin_session (
  token      TEXT PRIMARY KEY,
  user_id    INTEGER NOT NULL REFERENCES admin_user(id) ON DELETE CASCADE,
  created_at TEXT NOT NULL,
  expires_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS audit (
  id         INTEGER PRIMARY KEY,
  actor      TEXT NOT NULL,
  entity     TEXT NOT NULL,
  entity_id  TEXT NOT NULL,
  action     TEXT NOT NULL,
  detail     TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_audit ON audit(created_at DESC);

-- --------------------------------------------------------------- logbook
-- One entry per crew member per mission day, written by that crew member
-- from the habitat terminal. Editable by its author for as long as the day
-- is current; after that it is the record.
CREATE TABLE IF NOT EXISTS crew_entry (
  id           INTEGER PRIMARY KEY,
  crew_id      INTEGER NOT NULL REFERENCES crew(id) ON DELETE CASCADE,
  mission_day  INTEGER NOT NULL,
  body         TEXT NOT NULL,
  written_at   TEXT NOT NULL,
  updated_at   TEXT NOT NULL,
  published    INTEGER NOT NULL DEFAULT 1,
  held_by      TEXT,
  held_reason  TEXT,
  UNIQUE (crew_id, mission_day)
);
CREATE INDEX IF NOT EXISTS idx_entry_day ON crew_entry(mission_day, crew_id);

-- ---------------------------------------------------------------- archive
-- Daily rollups of habitat data. Raw readings are kept, but a mission day is
-- summarised once and stored, so the permanent record does not depend on
-- re-scanning a hundred thousand rows -- or on those rows surviving at all.
CREATE TABLE IF NOT EXISTS sensor_daily (
  mission_day INTEGER NOT NULL,
  metric      TEXT NOT NULL,
  min_value   REAL,
  max_value   REAL,
  avg_value   REAL,
  samples     INTEGER NOT NULL DEFAULT 0,
  sealed_at   TEXT,
  PRIMARY KEY (mission_day, metric)
);

-- A day is sealed once it is over: after that the archive renders from stored
-- values and stops recomputing.
CREATE TABLE IF NOT EXISTS day_seal (
  mission_day INTEGER PRIMARY KEY,
  sealed_at   TEXT NOT NULL,
  summary     TEXT NOT NULL DEFAULT ''
);

-- ------------------------------------------------------------------- media
-- Photographs, video and sound the crew send out of the habitat. The file is
-- stored once under its own SHA-256, so the same file uploaded twice is one
-- file, and any copy of the archive can be checked against the hash. Rows are
-- never deleted: a withdrawn item is hidden (hidden = 1) and its file kept.
CREATE TABLE IF NOT EXISTS media (
  id            INTEGER PRIMARY KEY,
  sha256        TEXT NOT NULL,
  filename      TEXT NOT NULL,          -- the original name, kept for the download
  mime          TEXT NOT NULL,
  kind          TEXT NOT NULL,          -- image | video | audio | document | file
  bytes         INTEGER NOT NULL,
  ext           TEXT NOT NULL,
  width         INTEGER,
  height        INTEGER,
  duration_s    REAL,
  thumb_sha256  TEXT,                   -- a small preview made in the browser at upload; optional
  mission_day   INTEGER NOT NULL,
  crew_id       INTEGER REFERENCES crew(id) ON DELETE SET NULL,
  caption       TEXT NOT NULL DEFAULT '',
  taken_at      TEXT,                   -- when it was made, if known
  uploaded_at   TEXT NOT NULL,
  uploaded_by   TEXT NOT NULL DEFAULT 'control',
  hidden        INTEGER NOT NULL DEFAULT 0,
  sort_order    INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS idx_media_day ON media(mission_day, hidden, sort_order, id);
CREATE INDEX IF NOT EXISTS idx_media_sha ON media(sha256);
