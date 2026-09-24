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

/* The desk's memory of edits (control_edit): which fields of which form and
   day were changed through this page, and when each form was last saved (the
   key '*'). The view marks those fields in orange — the marks stay after the
   save — and says "Last saved …" beside each form's button. The mood forms
   have no day; they file under day 0. */
function noteEdits(form, day, keys, actor) {
  const at = now();
  const up = db.prepare(`INSERT INTO control_edit (form, day, key, at, actor) VALUES (?, ?, ?, ?, ?)
    ON CONFLICT(form, day, key) DO UPDATE SET at = excluded.at, actor = excluded.actor`);
  db.transaction(() => { up.run(form, day, '*', at, actor); for (const k of keys) up.run(form, day, k, at, actor); })();
}
function editsFor(day) {
  const out = {};
  for (const r of db.prepare('SELECT form, key, at, actor FROM control_edit WHERE day = ? OR day = 0').all(day)) {
    const f = out[r.form] || (out[r.form] = { savedAt: null, actor: '', keys: {} });
    if (r.key === '*') { f.savedAt = r.at; f.actor = r.actor; } else f.keys[r.key] = r.at;
  }
  return out;
}
const same = (a, b) => String(a ?? '') === String(b ?? '');

/* Drafts (control_draft): a blog or a report written and kept on the desk,
   not yet public — one per composer and day. The composer opens on the
   draft when there is one; Publish sends the text live and drops the draft. */
const draftFor = (form, day) => db.prepare('SELECT body, at, actor FROM control_draft WHERE form = ? AND day = ?').get(form, day) || null;
function keepDraft(form, day, body, actor) {
  db.prepare(`INSERT INTO control_draft (form, day, body, at, actor) VALUES (?, ?, ?, ?, ?)
    ON CONFLICT(form, day) DO UPDATE SET body = excluded.body, at = excluded.at, actor = excluded.actor`).run(form, day, body, now(), actor);
}
const dropDraft = (form, day) => db.prepare('DELETE FROM control_draft WHERE form = ? AND day = ?').run(form, day);
function draftsFor(day) {
  const out = {};
  for (const r of db.prepare('SELECT form, body, at, actor FROM control_draft WHERE day = ?').all(day)) out[r.form] = r;
  return out;
}

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
    // available at the start of the day: yesterday's close, or on day 1 what was carried in
    carried: day > 1
      ? ((db.prepare(
          `SELECT quantity q FROM inventory_level il JOIN inventory_item i ON i.id = il.item_id
           WHERE i.key = ? AND il.mission_day = ?`).get(i.key, day - 1) || {}).q ?? null)
      : ((content.inventoryStart && content.inventoryStart()[i.key]) ?? null),
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
    user: req.user, f: takeFlash(req), content: content.status(), plan: content.planStatus(), resetLocked: content.resetLocked(ctx.mission),
    show, tab: tabOf(req.query.tab), day, totalDays: ctx.mission.totalDays,
    tpl: allTemplates(),
    list, crew: data.crewWithMood(), counts: data.counts(),
    officers,
    tasks: db.prepare('SELECT * FROM task WHERE mission_day = ? ORDER BY sort_order, time').all(day),
    meals: db.prepare(`SELECT * FROM meal WHERE mission_day = ? ORDER BY
      CASE slot WHEN 'BREAKFAST' THEN 1 WHEN 'LUNCH' THEN 2 WHEN 'DINNER' THEN 3 ELSE 4 END`).all(day).map(data.mealRow),
    recipes: content.recipeBook(),
    notes: notesFor(day),
    figures: content.crewFigures(),
    power: content.power(),
    items: inventoryFor(day),
    edits: editsFor(day),
    drafts: draftsFor(day),
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
  if (req.body.action === 'draft') {                                         // kept on the desk; what is live stays live
    keepDraft(`report:${kindKey}`, day, text, req.user.username);
    audit(req.user.username, 'DayNote', day, kind.toLowerCase() + ' draft');
    setFlash(req, `Draft saved for day ${day} — not public until it is published.` + (attached ? ` ${attached} file${attached === 1 ? '' : 's'} added.` : '') + (mediaError ? ` One file was refused: ${mediaError}` : ''), !!mediaError);
    return toTab(res, tabOf(req.body.back) === 'messages' ? kindKey : req.body.back, day);
  }
  const wasReport = reportFor(day, kind);
  const r = content.edit('notes.json', (obj) => {
    const rest = (Array.isArray(obj[String(day)]) ? obj[String(day)] : []).filter((n) => n.kind !== kind);
    obj[String(day)] = text ? rest.concat([{ kind, body: text }]) : rest;
  });
  audit(req.user.username, 'DayNote', day, kind.toLowerCase() + (text ? '' : ' cleared'));
  noteEdits(`report:${kindKey}`, day, same(wasReport, text) ? [] : ['body'], req.user.username);
  dropDraft(`report:${kindKey}`, day);
  const label = kind === 'SCIENCE' ? 'Daily Science Findings' : 'Daily Health Blog';
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

/* All the messages, as a download of their own — every message that ever
   reached the station with whatever became of it. Not part of the mission
   record (which leaves the messages out); mission control's own copy, as a
   PDF to read, a CSV to open in a spreadsheet, or JSON. */
const stampNow = () => new Date().toISOString().slice(0, 10);
router.get('/messages/export.pdf', (req, res, next) => {
  try {
    res.type('application/pdf').attachment(`mars-station-messages-${stampNow()}.pdf`).send(require('../lib/record-pdf').messagesPdf());
  } catch (e) { next(e); }
});
router.get('/messages/export.csv', (req, res) => {
  res.type('text/csv; charset=utf-8').attachment(`mars-station-messages-${stampNow()}.csv`).send('\ufeff' + require('../lib/record-pdf').messagesCsv());
});
router.get('/messages/export.json', (req, res) => {
  res.attachment(`mars-station-messages-${stampNow()}.json`).json(require('../lib/record-pdf').messagesJson());
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
  // The form carries no activity field any more; what the crew are doing
  // comes from the schedule (the ticker). Anything still posted is ignored.
  const activity = '';
  const before = db.prepare('SELECT calm_tense FROM crew_mood WHERE crew_id = ? ORDER BY effective_at DESC LIMIT 1').get(id);
  db.prepare(
    `INSERT INTO crew_mood (crew_id, calm_tense, energetic_exhausted, optimistic_uncertain,
       connected_isolated, activity, status, effective_at, set_by)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(id, v('calm_tense'), v('energetic_exhausted'), 50, 50,
        activity, member.status, now(), req.user.username);
  audit(req.user.username, 'CrewMood', id, 'file');
  noteEdits(`mood:${id}`, 0, before && same(before.calm_tense, v('calm_tense')) ? [] : ['calm_tense'], req.user.username);
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
  // The Commander Blog is the only blog kept in the log: the science and
  // health officers write the Daily Science Findings and the Daily Health
  // Blog, which are their reports (POST /control/report).
  if (member.designation !== content.BLOG_OFFICER) {
    dropFiles(); setFlash(req, 'Only the communication officer has a blog here — the Commander Blog. The science and health officers write the Daily Science Findings and the Daily Health Blog on their tabs.', true);
    return toTab(res, tab, day);
  }
  const draft = req.body.action === 'draft';

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

  if (draft) {                                                               // kept on the desk; what is live stays live
    keepDraft(`blog:${member.id}`, day, text, req.user.username);
    audit(req.user.username, 'CrewEntry', `${designation} day ${day}`, 'draft');
    setFlash(req, `Draft saved for ${designation}, day ${day} — not public until it is published.`
      + (attached ? ` ${attached} file${attached === 1 ? '' : 's'} added to the archive with it.` : '') + (mediaError ? ` One file was refused: ${mediaError}` : ''), !!mediaError);
    return toTab(res, tab, day);
  }

  // An entry once typed at the old habitat terminal is marked as not the
  // file's. Hand it back to the file so this edit — and the file — apply.
  db.prepare("UPDATE crew_entry SET source = 'file' WHERE crew_id = ? AND mission_day = ?")
    .run(member.id, day);

  // An empty save does not delete the slot: it puts the placeholder back, so
  // the day still has somewhere to be written, and nothing is public.
  const finalText = text || content.placeholderFor(day, designation);
  let wasText = '';
  const r = content.edit('logbook.json', (obj) => {
    obj[String(day)] = obj[String(day)] || {};
    wasText = String(obj[String(day)][designation] || '');
    obj[String(day)][designation] = finalText;
  });
  audit(req.user.username, 'CrewEntry', `${designation} day ${day}`, body ? 'write' : 'clear');
  noteEdits(`blog:${member.id}`, day, same(wasText, finalText) ? [] : ['body'], req.user.username);
  dropDraft(`blog:${member.id}`, day);
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
  // a row is remembered by what it says: one not in the day before this save is an edited row
  const rowKey = (t) => `row:${t.time}|${t.label}|${t.detail || ''}`;
  const had = new Set(existing.map(rowKey));
  noteEdits('schedule', day, rows.map(rowKey).filter((k) => !had.has(k)), req.user.username);
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
  // Two forms on the Habitat tab write here, Steps taken (steps_<id>) and
  // Calories consumed (calories_<id>), one line per officer: each save
  // touches only the figure it carries and keeps the other as it was; the
  // crew's totals are the sums. The older form's two totals (calories,
  // steps) are still accepted when no officer's field came with the request.
  const crew = db.prepare('SELECT id, designation FROM crew ORDER BY sort_order, id').all();
  const hasSteps = crew.some((c) => `steps_${c.id}` in req.body);
  const hasCal = crew.some((c) => `calories_${c.id}` in req.body);
  const changed = [];
  const r = content.edit('crew-figures.json', (obj) => {
    const cur = obj[String(day)] || {};
    const per = {};
    for (const [d, line] of Object.entries(cur.crew || {})) per[d] = { ...line };
    if (hasSteps || hasCal) {
      for (const c of crew) {
        const line = per[c.designation] || {};
        if (hasSteps) { const st = val(`steps_${c.id}`); if (!same(line.steps, st ?? undefined)) changed.push(`steps_${c.id}`); if (st == null) delete line.steps; else line.steps = st; }
        if (hasCal) { const cal = val(`calories_${c.id}`); if (!same(line.calories, cal ?? undefined)) changed.push(`calories_${c.id}`); if (cal == null) delete line.calories; else line.calories = cal; }
        if (Object.keys(line).length) per[c.designation] = line; else delete per[c.designation];
      }
    }
    const entry = {};
    if (Object.keys(per).length) entry.crew = per;
    const sum = (k) => Object.values(per).reduce((t, line) => (line[k] == null ? t : (t || 0) + line[k]), null);
    if (hasSteps || hasCal) {
      const steps = sum('steps'), calories = sum('calories');
      // a total filed before the officers were counted separately stays until that figure is filed per officer
      if (steps != null) entry.steps = steps; else if (!hasSteps && cur.steps != null) entry.steps = cur.steps;
      if (calories != null) entry.calories = calories; else if (!hasCal && cur.calories != null) entry.calories = cur.calories;
    } else {
      const calories = val('calories'), steps = val('steps');
      if (calories != null) entry.calories = calories;
      if (steps != null) entry.steps = steps;
    }
    if (!Object.keys(entry).length) delete obj[String(day)];
    else obj[String(day)] = entry;
  });
  audit(req.user.username, 'CrewFigures', day, 'edit');
  const form = hasCal && !hasSteps ? 'calories' : 'steps';
  noteEdits(form, day, changed, req.user.username);
  setFlash(req, r.ok ? `Day ${day} ${form === 'calories' ? 'calories consumed' : 'steps taken'} saved.` : `Saved, but: ${r.error}`, !r.ok);
  toTab(res, 'habitat', day);
});

/* ================================================================ FOOD PLAN */

router.post('/meals', (req, res) => {
  const ctx = req.ctx();
  const day = dayParam(req, ctx);
  const SLOTS = ['BREAKFAST', 'LUNCH', 'DINNER', 'RATION'];
  const num = (v) => (v === '' || v == null ? 0 : Number(v) || 0);

  // Water and power are not edited here, so they are carried through from the
  // existing meal rather than quietly zeroed.
  const current = db.prepare('SELECT * FROM meal WHERE mission_day = ?').all(day).map(data.mealRow);
  const book = content.recipeBook();
  // Blank stays blank: a recipe figure not given is not known, never 0.
  const opt = (v) => (v === '' || v == null || !Number.isFinite(Number(v)) ? null : Number(v));
  const rows = [];
  for (const slot of SLOTS) {
    const name = String(req.body[`${slot}_name`] || '').trim();
    if (!name) continue;   // a slot with no name is a slot that is not served
    const was = current.find((m) => m.slot === slot) || {};
    // The recipe the slot was filled from — only if it is in the book.
    const slug = String(req.body[`${slot}_recipe`] ?? was.recipe ?? '').trim();
    const recipe = slug && book.some((r) => r.slug === slug) ? slug : '';
    // Fields the form did not carry (an older page, a script) keep what the meal had.
    const has = (k) => Object.prototype.hasOwnProperty.call(req.body, `${slot}_${k}`);
    const nutrients = {};
    for (const { key } of content.NUTRIENTS) {
      const v = has(key) ? opt(req.body[`${slot}_${key}`]) : (was.nutrients ? was.nutrients[key] ?? null : null);
      if (v != null) nutrients[key] = v;
    }
    const co2e = has('co2e') ? opt(req.body[`${slot}_co2e`]) : was.co2e_kg ?? null;
    const wfp = has('wfp') ? opt(req.body[`${slot}_wfp`]) : was.water_footprint_l ?? null;
    rows.push({
      slot, name,
      ...(recipe ? { recipe } : {}),
      components: String(req.body[`${slot}_components`] || ''),
      kcal: num(req.body[`${slot}_kcal`]),
      water: was.water_litres || 0,
      prep: num(req.body[`${slot}_prep`]),
      energy: was.energy_wh || 0,
      ...(Object.keys(nutrients).length ? { nutrients } : {}),
      ...(co2e != null ? { co2e_kg: co2e } : {}),
      ...(wfp != null ? { water_footprint_l: wfp } : {}),
      ...(String(req.body[`${slot}_notes`] || '').trim()
        ? { notes: String(req.body[`${slot}_notes`]).trim() } : {}),
    });
  }

  const r = content.edit('meals.json', (obj) => {
    if (rows.length) obj[String(day)] = rows;
    else delete obj[String(day)];
  });
  audit(req.user.username, 'Meals', day, 'edit', `${rows.length} slots`);
  const changed = [];
  for (const slot of SLOTS) {
    const was = current.find((m) => m.slot === slot) || {}, is = rows.find((m) => m.slot === slot) || {};
    if (!same(was.name, is.name)) changed.push(`${slot}_name`);
    if (!same(was.components, is.components)) changed.push(`${slot}_components`);
    if (!same(was.kcal || 0, is.kcal || 0)) changed.push(`${slot}_kcal`);
    if (!same(was.prep_minutes || 0, is.prep || 0)) changed.push(`${slot}_prep`);
    if (!same(was.notes, is.notes)) changed.push(`${slot}_notes`);
    if (!same(was.recipe || '', is.recipe || '')) changed.push(`${slot}_recipe`);
    for (const { key } of content.NUTRIENTS) {
      if (!same((was.nutrients || {})[key], (is.nutrients || {})[key])) changed.push(`${slot}_${key}`);
    }
    if (!same(was.co2e_kg, is.co2e_kg)) changed.push(`${slot}_co2e`);
    if (!same(was.water_footprint_l, is.water_footprint_l)) changed.push(`${slot}_wfp`);
  }
  noteEdits('meals', day, changed, req.user.username);
  setFlash(req, r.ok ? `Day ${day} food plan saved — ${rows.length} slots.` : `Saved, but: ${r.error}`, !r.ok);
  toTab(res, 'habitat', day);
});

/* ================================================================ INVENTORY */

router.post('/inventory', (req, res) => {
  const ctx = req.ctx();
  const day = dayParam(req, ctx);
  const keys = db.prepare('SELECT key FROM inventory_item').all().map((i) => i.key);
  const changed = [];
  const r = content.edit('inventory-levels.json', (obj) => {
    const entry = obj[String(day)] || {};
    for (const k of keys) {                                                   // what differs from the day's levels as they were
      const was = entry[k] || {}, q = req.body[`q_${k}`], c = req.body[`c_${k}`];
      if (!same(was.quantity, q === '' || q == null ? undefined : Number(q))) changed.push(`q_${k}`);
      if (!same(was.consumption, c === '' || c == null ? undefined : Number(c))) changed.push(`c_${k}`);
    }
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
  noteEdits('inventory', day, changed, req.user.username);
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

/* ================================================================== POWER */

/**
 * Power consumed that day, by category, in kWh — and the categories
 * themselves: each row carries a name field beside its amount, so renaming
 * "Other" to "Greenhouse" is the same save as filing the day's figures.
 * Writes content/power.json, the same file edited by hand.
 */
router.post('/power', (req, res) => {
  const ctx = req.ctx();
  const day = dayParam(req, ctx);
  const cats = content.power().categories;
  const wasDay = content.power().days[String(day)] || {};
  const changed = [];
  const r = content.edit('power.json', (obj) => {
    // The names, as the form has them now. An emptied name keeps the old one.
    obj.categories = cats.map((c) => {
      const name = String(req.body[`name_${c.key}`] ?? '').trim();
      return { key: c.key, label: name || c.label };
    });
    obj.days = obj.days && typeof obj.days === 'object' ? obj.days : {};
    const entry = {};
    for (const c of cats) {
      const v = String(req.body[`kwh_${c.key}`] ?? '').trim();
      if (v === '') continue;              // blank records nothing, not zero
      const n = Number(v);
      if (Number.isFinite(n) && n >= 0) entry[c.key] = Math.round(n * 100) / 100;
    }
    for (const c of cats) {
      if (!same(c.label, (obj.categories.find((x) => x.key === c.key) || {}).label)) changed.push(`name_${c.key}`);
      if (!same(wasDay[c.key], entry[c.key])) changed.push(`kwh_${c.key}`);
    }
    if (Object.keys(entry).length) obj.days[String(day)] = entry;
    else delete obj.days[String(day)];
  });
  audit(req.user.username, 'Power', day, 'update');
  noteEdits('power', day, changed, req.user.username);
  setFlash(req, r.ok ? `Day ${day} power figures saved.` : `Saved, but: ${r.error}`, !r.ok);
  toTab(res, 'habitat', day);
});

/* ============================================================= START AGAIN */

/* The plan is the content as it should be on 15 October. Save it after
   editing the files; reset to it after a rehearsal. */
router.post('/plan/save', (req, res) => {
  const n = content.savePlan();
  audit(req.user.username, 'plan', '1', 'save', `${n} files`);
  setFlash(req, `Snapshot saved: ${n} content files copied to content/plan/.`);
  toTab(res, 'habitat', dayParam(req, req.ctx()));
});

/* Destructive, so it takes the word RESET typed into the form, checked here
   and not only in the browser. */
/* The cloud gallery: read the folder again now, rather than on the next cycle. */
router.post('/cloud/refresh', async (req, res) => {
  await require('../lib/cloud').poll().catch(() => {});
  if (req.get('x-requested-with') === 'fetch') return res.json(require('../lib/cloud').snapshot());
  res.redirect('/control?tab=habitat#cloud');
});

router.post('/reset', (req, res) => {
  const ctx = req.ctx();
  if (String(req.body.confirm || '').trim().toUpperCase() !== 'RESET') {
    setFlash(req, 'Nothing was reset — type RESET in the box to confirm.', true);
    return toTab(res, 'habitat', dayParam(req, ctx));
  }
  if (content.resetLocked(ctx.mission)) {
    setFlash(req, 'Nothing was reset — the run has begun, and the reset is locked from 15 October.', true);
    return toTab(res, 'habitat', dayParam(req, ctx));
  }
  try {
    const r = content.reset(req.user.username);
    const gone = Object.entries(r.wiped).filter(([, n]) => n)
      .map(([t, n]) => `${n} ${t.replace(/_/g, ' ')}`).join(', ');
    setFlash(req, `The station has been reset for 15 October: ${r.slots} blog slots emptied, the mission reloaded from the files in content/; cleared ${gone || 'nothing'}.`);
  } catch (e) {
    setFlash(req, `Reset failed: ${e.message}`, true);
  }
  toTab(res, 'habitat', 1);
});

module.exports = router;
module.exports.currentUser = currentUser;
module.exports.makeHash = makeHash;
