'use strict';
const crypto = require('crypto');
const express = require('express');
const { db, audit, now } = require('../db');
const data = require('../lib/data');
const V = require('../views/control');
const content = require('../lib/content');
const missionLib = require('../lib/mission');
const media = require('../lib/media');
const multer = require('multer');

const router = express.Router();

/* ------------------------------------------------------------------- auth */

const hash = (pw, salt) => salt + ':' + crypto.scryptSync(pw, salt, 32).toString('hex');
const makeHash = (pw) => hash(pw, crypto.randomBytes(8).toString('hex'));
const verify = (pw, stored) => {
  const [salt, key] = String(stored).split(':');
  if (!salt || !key) return false;
  const got = crypto.scryptSync(pw, salt, 32);
  const want = Buffer.from(key, 'hex');
  return want.length === got.length && crypto.timingSafeEqual(got, want);
};

/** There is one account. It opens mission control and the archive. */
function currentUser(req) {
  const token = req.cookies.mcs_admin;
  if (!token) return null;
  const s = db.prepare('SELECT * FROM admin_session WHERE token = ? AND expires_at > ?')
    .get(token, now());
  if (!s) return null;
  return db.prepare('SELECT * FROM admin_user WHERE id = ?').get(s.user_id);
}

router.use((req, res, next) => { req.user = currentUser(req); next(); });

router.get('/login', (req, res) => res.send(V.login(req.ctx(), null)));

router.post('/login', (req, res) => {
  const u = db.prepare('SELECT * FROM admin_user WHERE username = ?')
    .get(String(req.body.username || '').trim());
  if (!u || !verify(String(req.body.password || ''), u.password_hash)) {
    return res.status(401).send(V.login(req.ctx(), 'Those credentials were not accepted.'));
  }
  const token = crypto.randomBytes(24).toString('hex');
  db.prepare('INSERT INTO admin_session (token, user_id, created_at, expires_at) VALUES (?, ?, ?, ?)')
    .run(token, u.id, now(), new Date(Date.now() + 30 * 86400000).toISOString());
  res.cookie('mcs_admin', token, { httpOnly: true, sameSite: 'lax',
    maxAge: 30 * 86400000, secure: process.env.SECURE_COOKIES === 'true' });
  audit(u.username, 'session', u.id, 'login');
  res.redirect(req.query.next === 'archive' ? '/archive' : '/control');
});

router.post('/logout', (req, res) => {
  if (req.cookies.mcs_admin) {
    db.prepare('DELETE FROM admin_session WHERE token = ?').run(req.cookies.mcs_admin);
  }
  res.clearCookie('mcs_admin');
  res.redirect('/control/login');
});

router.use((req, res, next) => { if (!req.user) return res.redirect('/control/login'); next(); });

/* ---------------------------------------------------------------- flashes */

const flashes = new Map();
const setFlash = (req, msg, err = false) => flashes.set(req.user.username, { msg, err });
function takeFlash(req) {
  const f = flashes.get(req.user.username);
  flashes.delete(req.user.username);
  return f || null;
}

/* ------------------------------------------------------------ navigation */

/**
 * Mission control is one page. After a reply you return to the queue, in the
 * view you were looking at; after an edit you return to the tab and day you
 * were working on. Nothing lands you somewhere else.
 */
const TAB_NAMES = ['messages', 'comms', 'science', 'health', 'habitat'];
const tabOf = (v) => {
  const t = String(v || '').replace(/^\/control\/?/, '') || 'messages';
  return TAB_NAMES.includes(t) ? t : 'messages';
};
const toQueue = (req, res) => {
  const show = VIEWS[req.query.show] ? req.query.show : 'pending';
  res.redirect(`/control?tab=messages&show=${show}#queue`);
};
const toTab = (res, tab, day) => res.redirect(`/control?tab=${tabOf(tab)}&day=${day}#work`);
// The tab an officer's work lives on, for a plain (no-script) media post.
const officerTab = (crewId) => {
  const c = crewId && db.prepare('SELECT designation FROM crew WHERE id = ?').get(crewId);
  return (c && TAB_OF_OFFICER[c.designation]) || 'comms';
};

/* ================================================================= OFFICERS */

const officerBy = (designation) =>
  data.crewWithMood().find((c) => c.designation === designation) || null;

const dayParam = (req, ctx) => {
  const n = Number(req.query.day || req.body.day || ctx.mission.clampedDay);
  return Math.min(Math.max(Number.isInteger(n) ? n : 1, 1), ctx.mission.totalDays);
};

const entryFor = (crewId, day) =>
  db.prepare('SELECT * FROM crew_entry WHERE crew_id = ? AND mission_day = ?').get(crewId, day);

const notesFor = (day) =>
  db.prepare('SELECT * FROM day_note WHERE mission_day = ? ORDER BY posted_at').all(day);

/** Report templates, read from content/templates.json on every request. */
const allTemplates = () => ({
  SCIENCE: content.templates('SCIENCE'),
  HEALTH: content.templates('HEALTH'),
  UPDATE: content.templates('UPDATE'),
  ANOMALY: content.templates('ANOMALY'),
  BLOG: content.templates('BLOG'),
});

/** Inventory for a day, with what carried over and whether the day overrides it. */
function inventoryFor(day) {
  const raw = (() => {
    try { return JSON.parse(require('fs').readFileSync(
      require('path').join(content.DIR, 'inventory-levels.json'), 'utf8')); }
    catch { return {}; }
  })();
  const overrides = raw[String(day)] || {};
  return db.prepare(
    `SELECT il.*, i.key, i.label, i.unit FROM inventory_level il
     JOIN inventory_item i ON i.id = il.item_id
     WHERE il.mission_day = ? ORDER BY i.sort_order`).all(day).map((i) => ({
    ...i,
    set: Object.prototype.hasOwnProperty.call(overrides, i.key),
    carried: (db.prepare(
      `SELECT quantity q FROM inventory_level il JOIN inventory_item i ON i.id = il.item_id
       WHERE i.key = ? AND il.mission_day = ?`).get(i.key, day - 1) || {}).q ?? null,
  }));
}

/* ================================================================= MESSAGES */

const VIEWS = {
  pending: "state IN ('PENDING_APPROVAL','APPROVED','RESPONSE')",
  published: "state = 'PUBLISHED'",
  rejected: "state = 'REJECTED'",
  all: "state NOT IN ('IN_TRANSIT','TRANSMITTED')",
};

/* =================================================================== THE PAGE */

router.get('/', (req, res) => {
  const ctx = req.ctx();
  data.settleTransits();
  const show = VIEWS[req.query.show] ? req.query.show : 'pending';
  const list = db.prepare(
    `SELECT m.*, r.body AS response_body, r.crew_id
     FROM message m LEFT JOIN response r ON r.message_id = m.id
     WHERE ${VIEWS[show]}
     ORDER BY m.submitted_at ${show === 'pending' ? 'ASC' : 'DESC'} LIMIT 200`
  ).all();

  const day = dayParam(req, ctx);
  const withEntry = (designation, kind) => {
    const o = officerBy(designation);
    if (!o) return null;
    const entry = entryFor(o.id, day);
    const report = kind ? reportFor(day, kind) : '';
    return { ...o, entry, media: media.list({ day, crewId: o.id }), report,
      // media placed in the report belongs to the report, and the other way round
      otherBodies: [report], reportOtherBodies: [entry ? entry.body : ''] };
  };
  const officers = {
    comms: withEntry('COMMUNICATION OFFICER'),
    science: withEntry('SCIENCE OFFICER', 'SCIENCE'),
    health: withEntry('HEALTH OFFICER', 'HEALTH'),
  };
  if (!officers.comms || !officers.science || !officers.health) {
    return res.status(500).send('The crew in content/crew-and-inventory.json must include a communication, a science and a health officer.');
  }

  res.send(V.page(ctx, {
    user: req.user, f: takeFlash(req), content: content.status(),
    show, tab: tabOf(req.query.tab), day, totalDays: ctx.mission.totalDays,
    tpl: allTemplates(),
    list, crew: data.crewWithMood(), counts: data.counts(),
    officers,
    tasks: db.prepare('SELECT * FROM task WHERE mission_day = ? ORDER BY sort_order, time').all(day),
    meals: db.prepare(`SELECT * FROM meal WHERE mission_day = ? ORDER BY
      CASE slot WHEN 'BREAKFAST' THEN 1 WHEN 'LUNCH' THEN 2 WHEN 'DINNER' THEN 3 ELSE 4 END`).all(day),
    notes: notesFor(day),
    figures: content.crewFigures(),
    items: inventoryFor(day),
    // Every slot of the crew log, for the Crew log tab: each day, each officer.
    // Everything in the media archive, hidden items included, for the Media tab.
    media: media.byDay({ includeHidden: true }).map((d) => ({ ...d, date: missionLib.dateForDay(d.missionDay) })),
    mediaCounts: media.counts(), mediaAccept: media.ACCEPT, mediaMaxMb: media.MAX_BYTES / 1048576,
  }));
});

const REPORT_KINDS = { science: 'SCIENCE', health: 'HEALTH' };
const reportFor = (day, kind) => notesFor(day).filter((n) => n.kind === kind).map((n) => n.body).join('\n\n');

/**
 * An officer's daily report — science findings or health activities — saved
 * from the post editor: one text per day and kind, written into notes.json
 * in place of whatever that kind held for the day. Media sent with it goes
 * into the archive under the officer and the day, like an entry's.
 */
router.post('/report', (req, res, next) => upload.array('file', 50)(req, res, (err) => {
  if (!err) return next();
  setFlash(req, err.code === 'LIMIT_FILE_SIZE' ? `A file is over the ${media.MAX_BYTES / 1048576} MB limit (MEDIA_MAX_MB).` : err.message, true);
  toTab(res, tabOf(req.body && req.body.back), dayParam(req, req.ctx()));
}), async (req, res) => {
  const ctx = req.ctx();
  const day = dayParam(req, ctx);
  const kindKey = REPORT_KINDS[req.body.kind] ? req.body.kind : 'science';
  const kind = REPORT_KINDS[kindKey];
  const crewId = Number(req.body.crew_id) || null;
  let text = req.body.action === 'clear' ? '' : String(req.body.body || '').trim();
  let attached = 0, mediaError = null;
  for (const f of req.files || []) {
    try {
      const m = await media.add({ tmpPath: f.path, filename: f.originalname, missionDay: day, crewId,
        caption: String(req.body.media_caption || '').trim(), uploadedBy: req.user.username });
      attached++;
      text = `${text}\n\n[media:${m.id}]`.trim();
    } catch (e) { mediaError = e.message; }
  }
  const r = content.edit('notes.json', (obj) => {
    const rest = (Array.isArray(obj[String(day)]) ? obj[String(day)] : []).filter((n) => n.kind !== kind);
    obj[String(day)] = text ? rest.concat([{ kind, body: text }]) : rest;
  });
  audit(req.user.username, 'DayNote', day, kind.toLowerCase() + (text ? '' : ' cleared'));
  const label = kind === 'SCIENCE' ? 'Science findings' : 'Health activities';
  setFlash(req, r.ok ? `${label} ${text ? 'published' : 'cleared'} for day ${day}.` + (attached ? ` ${attached} file${attached === 1 ? '' : 's'} added.` : '') + (mediaError ? ` One file was refused: ${mediaError}` : '')
    : `Saved, but: ${r.error}`, !r.ok || !!mediaError);
  toTab(res, tabOf(req.body.back) === 'messages' ? kindKey : req.body.back, day);
});

/* The old per-officer addresses land on their tab of the one page. */
for (const t of ['science', 'health', 'habitat']) {
  router.get(`/${t}`, (req, res) => {
    const q = req.query.day ? `&day=${Number(req.query.day) || 1}` : '';
    res.redirect(301, `/control?tab=${t}${q}#work`);
  });
}

/** The count the page polls, so a message arriving while control is open is announced. */
router.get('/api/queue', (req, res) => {
  const c = data.counts();
  res.set('Cache-Control', 'no-store').json({ waiting: c.pending + c.awaitingResponse, total: c.total });
});

/* ================================================================= REPLIES */

/**
 * Reviewing and replying are one action. Sending the reply approves the
 * message and publishes the exchange in a single step.
 */
router.post('/:id(\\d+)/reply', (req, res) => {
  const id = Number(req.params.id);
  const body = String(req.body.body || '').trim();
  if (body.length < 2) {
    setFlash(req, 'A reply needs actual text before it can be sent.', true);
    return toQueue(req, res);
  }
  const crewId = req.body.crew_id ? Number(req.body.crew_id) : null;
  const publish = req.body.action !== 'draft';
  const existing = db.prepare('SELECT * FROM response WHERE message_id = ?').get(id);

  if (existing) {
    db.prepare('UPDATE response SET body = ?, crew_id = ?, written_at = ?, published_at = ? WHERE message_id = ?')
      .run(body, crewId, now(), publish ? (existing.published_at || now()) : existing.published_at, id);
  } else {
    db.prepare('INSERT INTO response (message_id, body, crew_id, written_at, published_at) VALUES (?, ?, ?, ?, ?)')
      .run(id, body, crewId, now(), publish ? now() : null);
  }
  db.prepare('UPDATE message SET state = ?, reviewed_at = ?, reviewed_by = ? WHERE id = ?')
    .run(publish ? 'PUBLISHED' : 'RESPONSE', now(), req.user.username, id);
  audit(req.user.username, 'Message', id, publish ? 'reply-publish' : 'reply-draft');
  setFlash(req, publish ? `Exchange ${id} is live on the mission page.` : `Reply saved for ${id}, not published.`);
  toQueue(req, res);
});

router.post('/:id(\\d+)/reject', (req, res) => {
  const id = Number(req.params.id);
  db.prepare("UPDATE message SET state = 'REJECTED', reviewed_at = ?, reviewed_by = ? WHERE id = ?")
    .run(now(), req.user.username, id);
  audit(req.user.username, 'Message', id, 'reject');
  setFlash(req, `Message ${id} rejected. It stays out of the public record.`);
  toQueue(req, res);
});

router.post('/:id(\\d+)/restore', (req, res) => {
  const id = Number(req.params.id);
  db.prepare("UPDATE message SET state = 'PENDING_APPROVAL', reviewed_at = NULL WHERE id = ?").run(id);
  audit(req.user.username, 'Message', id, 'restore');
  setFlash(req, `Message ${id} is back in the queue.`);
  toQueue(req, res);
});

router.post('/:id(\\d+)/unpublish', (req, res) => {
  const id = Number(req.params.id);
  db.prepare('UPDATE response SET published_at = NULL WHERE message_id = ?').run(id);
  db.prepare("UPDATE message SET state = 'RESPONSE' WHERE id = ?").run(id);
  audit(req.user.username, 'Response', id, 'unpublish');
  setFlash(req, `Exchange ${id} pulled from the mission page. The reply is kept as a draft.`);
  toQueue(req, res);
});

router.post('/:id(\\d+)/delete', (req, res) => {
  const id = Number(req.params.id);
  const m = db.prepare('SELECT callsign FROM message WHERE id = ?').get(id);
  db.prepare('DELETE FROM response WHERE message_id = ?').run(id);
  db.prepare('DELETE FROM message WHERE id = ?').run(id);
  audit(req.user.username, 'Message', id, 'delete', m ? m.callsign : '');
  setFlash(req, `Message ${id} deleted.`);
  toQueue(req, res);
});

/* ==================================================================== MOODS */

const TAB_OF_OFFICER = { 'SCIENCE OFFICER': 'science', 'HEALTH OFFICER': 'health' };

router.post('/moods/:id', (req, res) => {
  const ctx = req.ctx();
  const id = Number(req.params.id);
  const member = db.prepare('SELECT * FROM crew WHERE id = ?').get(id);
  if (!member) return res.redirect('/control');
  const v = (k) => Math.max(0, Math.min(100, Number(req.body[k] ?? 50) || 0));
  const activity = String(req.body.activity ?? member.activity);
  db.prepare(
    `INSERT INTO crew_mood (crew_id, calm_tense, energetic_exhausted, optimistic_uncertain,
       connected_isolated, activity, status, effective_at, set_by)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(id, v('calm_tense'), v('energetic_exhausted'), 50, 50,
        activity, member.status, now(), req.user.username);
  db.prepare('UPDATE crew SET activity = ? WHERE id = ?').run(activity, id);
  audit(req.user.username, 'CrewMood', id, 'file');
  setFlash(req, `State filed for ${member.designation}. The mission page has been updated.`);
  toTab(res, TAB_OF_OFFICER[member.designation] || 'comms', dayParam(req, ctx));
});

/* ---------------------------------------------------------------- uploads */

const upload = multer({
  storage: multer.diskStorage({
    destination: media.TMP,
    filename: (req, file, cb) => cb(null, `${Date.now()}-${crypto.randomBytes(6).toString('hex')}`),
  }),
  limits: { fileSize: media.MAX_BYTES, files: 50, fields: 200, fieldSize: 3 * 1024 * 1024 },
  fileFilter: (req, file, cb) => cb(null, !!media.extOf(file.originalname)),
});
const isLive = (req) => req.get('x-requested-with') === 'fetch';

/* ================================================================== LOGBOOK */

/**
 * The crew's diary entries are written here, into content/logbook.json, so the
 * interface and the file are edits to the same thing. Saving from control is
 * always allowed: the file is the record.
 */
router.post('/logbook', (req, res, next) => upload.array('file', 50)(req, res, (err) => {
  if (!err) return next();
  setFlash(req, err.code === 'LIMIT_FILE_SIZE' ? `A file is over the ${media.MAX_BYTES / 1048576} MB limit (MEDIA_MAX_MB).` : err.message, true);
  toTab(res, tabOf(req.body && req.body.back), dayParam(req, req.ctx()));
}), async (req, res) => {
  const ctx = req.ctx();
  const day = dayParam(req, ctx);
  const designation = String(req.body.designation || '');
  const body = req.body.action === 'clear' ? '' : String(req.body.body || '').trim();
  const member = db.prepare('SELECT * FROM crew WHERE designation = ?').get(designation);
  const tab = tabOf(req.body.back);
  const dropFiles = () => { for (const f of req.files || []) { try { require('fs').unlinkSync(f.path); } catch (e) { /* gone */ } } };
  if (!member) { dropFiles(); setFlash(req, 'No such crew member.', true); return toTab(res, tab, day); }

  // Media sent with the entry goes into the archive under this officer and
  // day, so it travels with the entry wherever the entry is shown.
  let attached = 0, mediaError = null, text = body;
  for (const f of req.files || []) {
    try {
      const m = await media.add({ tmpPath: f.path, filename: f.originalname, missionDay: day, crewId: member.id,
        caption: String(req.body.media_caption || '').trim(), uploadedBy: req.user.username });
      attached++;
      // Without the page's script the file arrives with the text; set it at
      // the end of the post, where it can be moved like any other line.
      if (!content.isPlaceholder(text)) text = `${text}\n\n[media:${m.id}]`.trim();
    } catch (e) { mediaError = e.message; }
  }

  // An entry once typed at the old habitat terminal is marked as not the
  // file's. Hand it back to the file so this edit — and the file — apply.
  db.prepare("UPDATE crew_entry SET source = 'file' WHERE crew_id = ? AND mission_day = ?")
    .run(member.id, day);

  // An empty save does not delete the slot: it puts the placeholder back, so
  // the day still has somewhere to be written, and nothing is public.
  const finalText = text || content.placeholderFor(day, designation);
  const r = content.edit('logbook.json', (obj) => {
    obj[String(day)] = obj[String(day)] || {};
    obj[String(day)][designation] = finalText;
  });
  audit(req.user.username, 'CrewEntry', `${designation} day ${day}`, body ? 'write' : 'clear');
  const what = (!body ? `Entry cleared for ${designation}, day ${day} — the slot is a placeholder again.`
    : content.isPlaceholder(body) ? `Placeholder saved for ${designation}, day ${day} — the text is not public until replaced.`
    : `Blog entry saved for ${designation}, day ${day} — live on the station.`)
    + (attached ? ` ${attached} file${attached === 1 ? '' : 's'} added to the archive with it.` : '')
    + (mediaError ? ` One file was refused: ${mediaError}` : '');
  setFlash(req, r.ok ? what : `Saved, but: ${r.error}`, !r.ok || !!mediaError);
  toTab(res, tab, day);
});

/* ==================================================================== MEDIA */

/**
 * Photographs, video and sound out of the habitat. The file is received
 * whole into the archive volume, hashed, and kept under its hash; the
 * browser sends a small preview alongside so the gallery has thumbnails
 * without the server ever re-encoding anything. One file per request from
 * the page's script (which shows progress); a plain form post without
 * JavaScript may carry several.
 */

router.post('/media/upload', (req, res) => {
  upload.array('file', 50)(req, res, async (err) => {
    const ctx = req.ctx();
    const day = dayParam(req, ctx);
    const fail = (msg, code = 400) => {
      for (const f of req.files || []) { try { require('fs').unlinkSync(f.path); } catch (e) { /* gone */ } }
      if (isLive(req)) return res.status(code).json({ ok: false, error: msg });
      setFlash(req, msg, true); return toTab(res, req.body && req.body.back ? req.body.back : officerTab(Number(req.body && req.body.crew_id)), day);
    };
    if (err) return fail(err.code === 'LIMIT_FILE_SIZE' ? `That file is over the ${media.MAX_BYTES / 1048576} MB limit (MEDIA_MAX_MB).` : err.message);
    if (!req.files || !req.files.length) return fail('No file arrived — or its type is not one the archive keeps (' + media.ACCEPT.replace(/\./g, '') + ').');
    const crewId = Number(req.body.crew_id) || null;
    const saved = [];
    try {
      for (const f of req.files) {
        saved.push(await media.add({
          tmpPath: f.path, filename: f.originalname, missionDay: day, crewId,
          caption: req.body.caption || '', takenAt: req.body.taken_at || null, uploadedBy: req.user.username,
          thumb: req.files.length === 1 ? req.body.thumb : null,
          width: Number(req.body.width) || null, height: Number(req.body.height) || null,
          duration: Number(req.body.duration) || null,
        }));
      }
    } catch (e) { return fail(e.message); }
    if (isLive(req)) return res.json({ ok: true, items: saved.map((m) => ({ id: m.id, filename: m.filename, bytes: m.bytes, sha256: m.sha256, kind: m.kind,
      url: media.pageUrl(m), fileUrl: media.fileUrl(m), thumb: media.thumbUrl(m) })) });
    setFlash(req, `${saved.length} file${saved.length === 1 ? '' : 's'} added to the archive for day ${day}.`);
    toTab(res, req.body.back || officerTab(crewId), day);
  });
});

router.post('/media/:id(\\d+)/edit', (req, res) => {
  const ctx = req.ctx();
  const m = media.get(req.params.id);
  if (!m) { setFlash(req, 'No such item.', true); return toTab(res, req.body.back, ctx.mission.clampedDay); }
  const day = Math.min(Math.max(Number(req.body.day) || m.mission_day, 1), ctx.mission.totalDays);
  const saved = media.update(m.id, { caption: req.body.caption, missionDay: day, crewId: Number(req.body.crew_id) || null,
    takenAt: req.body.taken_at || null }, req.user.username);
  if (isLive(req)) return res.json({ ok: true, item: { id: saved.id, caption: saved.caption, missionDay: saved.mission_day } });
  setFlash(req, `Saved: ${m.filename}.`);
  toTab(res, req.body.back || officerTab(saved.crew_id), day);
});

router.post('/media/:id(\\d+)/hide', (req, res) => {
  const m = media.get(req.params.id);
  if (m) media.setHidden(m.id, true, req.user.username);
  if (isLive(req)) return m ? res.json({ ok: true, id: m.id }) : res.status(404).json({ ok: false });
  setFlash(req, m ? `${m.filename} withdrawn from view. The file is kept; restore it any time.` : 'No such item.', !m);
  toTab(res, req.body.back || officerTab(m && m.crew_id), m ? m.mission_day : req.ctx().mission.clampedDay);
});
router.post('/media/:id(\\d+)/restore', (req, res) => {
  const m = media.get(req.params.id);
  if (m) media.setHidden(m.id, false, req.user.username);
  setFlash(req, m ? `${m.filename} is back in view.` : 'No such item.', !m);
  toTab(res, req.body.back || officerTab(m && m.crew_id), m ? m.mission_day : req.ctx().mission.clampedDay);
});

/** The archive's own check: every file against its hash. */
router.get('/media/verify', async (req, res) => {
  const problems = await media.verify();
  res.set('Cache-Control', 'no-store').json({ ok: !problems.length, checked: media.list({ includeHidden: true }).length, problems });
});

/* ================================================================== UPDATES */

router.post('/updates', (req, res) => {
  const ctx = req.ctx();
  const day = dayParam(req, ctx);
  const body = String(req.body.body || '').trim();
  const kind = String(req.body.kind || 'UPDATE').toUpperCase();
  const tab = tabOf(req.body.back);
  if (body.length < 2) { setFlash(req, 'An update needs text.', true); return toTab(res, tab, day); }
  const r = content.edit('notes.json', (obj) => {
    obj[String(day)] = obj[String(day)] || [];
    obj[String(day)].push({ kind, body });
  });
  audit(req.user.username, 'DayNote', day, kind.toLowerCase());
  setFlash(req, r.ok ? `${kind} filed for day ${day}.` : `Saved, but: ${r.error}`, !r.ok);
  toTab(res, tab, day);
});

router.post('/updates/delete', (req, res) => {
  const ctx = req.ctx();
  const day = dayParam(req, ctx);
  const body = String(req.body.body || '');
  const r = content.edit('notes.json', (obj) => {
    if (Array.isArray(obj[String(day)])) {
      obj[String(day)] = obj[String(day)].filter((n) => n.body !== body);
    }
  });
  audit(req.user.username, 'DayNote', day, 'remove');
  setFlash(req, r.ok ? 'Update removed.' : `Removed, but: ${r.error}`, !r.ok);
  toTab(res, tabOf(req.body.back), day);
});

/* ================================================================= SCHEDULE */

/**
 * The daily schedule, kept on the Habitat tab. The day is rewritten wholesale
 * into content/schedule.json and sorted by clock time.
 */
router.post('/schedule', (req, res) => {
  const ctx = req.ctx();
  const day = dayParam(req, ctx);
  const existing = db.prepare('SELECT * FROM task WHERE mission_day = ? ORDER BY sort_order, time').all(day);

  const rows = [];
  existing.forEach((t, i) => {
    if (req.body[`t${i}_del`]) return;
    const label = String(req.body[`t${i}_label`] ?? t.label).trim();
    if (!label) return;
    rows.push({
      time: String(req.body[`t${i}_time`] ?? t.time) || '00:00',
      label,
      detail: String(req.body[`t${i}_detail`] ?? t.detail ?? ''),
    });
  });
  for (const k of [0, 1, 2]) {
    const label = String(req.body[`n${k}_label`] || '').trim();
    if (!label) continue;
    rows.push({
      time: String(req.body[`n${k}_time`] || '00:00'),
      label,
      detail: String(req.body[`n${k}_detail`] || ''),
    });
  }
  rows.sort((a, b) => a.time.localeCompare(b.time));

  const r = content.edit('schedule.json', (obj) => {
    if (rows.length) obj[String(day)] = rows;
    else delete obj[String(day)];
  });
  audit(req.user.username, 'Schedule', day, 'edit', `${rows.length} tasks`);
  setFlash(req, r.ok ? `Day ${day} schedule saved — ${rows.length} tasks.` : `Saved, but: ${r.error}`, !r.ok);
  toTab(res, 'habitat', day);
});

/* ============================================================= CREW FIGURES */

router.post('/crew-figures', (req, res) => {
  const ctx = req.ctx();
  const day = dayParam(req, ctx);
  const val = (k) => {
    const v = String(req.body[k] ?? '').trim();
    if (v === '') return null;              // blank records nothing, not zero
    const n = Number(v);
    return Number.isFinite(n) && n >= 0 ? Math.round(n) : null;
  };
  const calories = val('calories');
  const steps = val('steps');

  const r = content.edit('crew-figures.json', (obj) => {
    if (calories == null && steps == null) { delete obj[String(day)]; return; }
    const entry = {};
    if (calories != null) entry.calories = calories;
    if (steps != null) entry.steps = steps;
    obj[String(day)] = entry;
  });
  audit(req.user.username, 'CrewFigures', day, 'edit');
  setFlash(req, r.ok ? `Day ${day} crew figures saved.` : `Saved, but: ${r.error}`, !r.ok);
  toTab(res, 'health', day);
});

/* ================================================================ FOOD PLAN */

router.post('/meals', (req, res) => {
  const ctx = req.ctx();
  const day = dayParam(req, ctx);
  const SLOTS = ['BREAKFAST', 'LUNCH', 'DINNER', 'RATION'];
  const num = (v) => (v === '' || v == null ? 0 : Number(v) || 0);

  // Water and power are not edited here, so they are carried through from the
  // existing meal rather than quietly zeroed.
  const current = db.prepare('SELECT * FROM meal WHERE mission_day = ?').all(day);
  const rows = [];
  for (const slot of SLOTS) {
    const name = String(req.body[`${slot}_name`] || '').trim();
    if (!name) continue;   // a slot with no name is a slot that is not served
    const was = current.find((m) => m.slot === slot) || {};
    rows.push({
      slot, name,
      components: String(req.body[`${slot}_components`] || ''),
      kcal: num(req.body[`${slot}_kcal`]),
      water: was.water_litres || 0,
      prep: num(req.body[`${slot}_prep`]),
      energy: was.energy_wh || 0,
      ...(String(req.body[`${slot}_notes`] || '').trim()
        ? { notes: String(req.body[`${slot}_notes`]).trim() } : {}),
    });
  }

  const r = content.edit('meals.json', (obj) => {
    if (rows.length) obj[String(day)] = rows;
    else delete obj[String(day)];
  });
  audit(req.user.username, 'Meals', day, 'edit', `${rows.length} slots`);
  setFlash(req, r.ok ? `Day ${day} food plan saved — ${rows.length} slots.` : `Saved, but: ${r.error}`, !r.ok);
  toTab(res, 'habitat', day);
});

/* ================================================================ INVENTORY */

router.post('/inventory', (req, res) => {
  const ctx = req.ctx();
  const day = dayParam(req, ctx);
  const keys = db.prepare('SELECT key FROM inventory_item').all().map((i) => i.key);
  const r = content.edit('inventory-levels.json', (obj) => {
    const entry = obj[String(day)] || {};
    if (req.body.why) entry._why = String(req.body.why);
    for (const k of keys) {
      const q = req.body[`q_${k}`], c = req.body[`c_${k}`];
      // A blank field means "no override" -- the day carries forward instead.
      if ((q === '' || q == null) && (c === '' || c == null)) { delete entry[k]; continue; }
      entry[k] = entry[k] || {};
      if (q !== '' && q != null) entry[k].quantity = Number(q);
      if (c !== '' && c != null) entry[k].consumption = Number(c);
    }
    if (Object.keys(entry).filter((k) => !k.startsWith('_')).length) obj[String(day)] = entry;
    else delete obj[String(day)];
  });
  audit(req.user.username, 'Inventory', day, 'update');
  setFlash(req, r.ok ? `Inventory saved for day ${day}. Later days recalculated.` : `Saved, but: ${r.error}`, !r.ok);
  toTab(res, 'habitat', day);
});

router.post('/inventory/clear', (req, res) => {
  const ctx = req.ctx();
  const day = dayParam(req, ctx);
  const r = content.edit('inventory-levels.json', (obj) => { delete obj[String(day)]; });
  audit(req.user.username, 'Inventory', day, 'clear');
  setFlash(req, r.ok ? `Day ${day} now carries forward automatically.` : `Cleared, but: ${r.error}`, !r.ok);
  toTab(res, 'habitat', day);
});

module.exports = router;
module.exports.currentUser = currentUser;
module.exports.makeHash = makeHash;
