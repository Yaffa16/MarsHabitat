'use strict';
const crypto = require('crypto');
const express = require('express');
const { db, audit, now } = require('../db');
const data = require('../lib/data');
const V = require('../views/pages/logbook');
const control = require('./control');

const router = express.Router();

/**
 * One account opens both mission control and this terminal. Which crew member
 * is writing is chosen on the screen rather than by signing in as them --
 * three performers sharing a tablet inside a habitat should not be juggling
 * three passphrases.
 */
function session(req) {
  const user = control.currentUser(req);
  if (!user) return null;
  const id = Number(req.cookies.mcs_who || 0);
  const member = id ? db.prepare('SELECT * FROM crew WHERE id = ?').get(id) : null;
  return { user, member };
}

const flashes = new Map();
const setFlash = (name, msg, err = false) => flashes.set(name, { msg, err });
function takeFlash(name) { const f = flashes.get(name); flashes.delete(name); return f || null; }

/** Choosing who is at the terminal. Cheap to switch: the crew hand it over. */
router.post('/who', (req, res) => {
  if (!control.currentUser(req)) return res.redirect('/control/login?next=log');
  const id = Number(req.body.crew_id || 0);
  if (id) {
    res.cookie('mcs_who', String(id), { httpOnly: true, sameSite: 'lax',
      maxAge: 30 * 86400000, secure: process.env.SECURE_COOKIES === 'true' });
  }
  res.redirect('/log');
});

router.get('/out', (req, res) => { res.clearCookie('mcs_who'); res.redirect('/log'); });

router.get('/', (req, res) => {
  const ctx = req.ctx();
  const who = session(req);
  if (!who) return res.redirect('/control/login?next=log');
  const crew = db.prepare('SELECT * FROM crew ORDER BY sort_order').all();
  if (!who.member) return res.send(V.chooseCrew(ctx, { crew }));

  const n = ctx.mission.clampedDay;
  res.send(V.terminal(ctx, {
    member: who.member,
    crew,
    today: data.day(n),
    entry: data.entry(who.member.id, n),
    mood: db.prepare('SELECT * FROM crew_mood WHERE crew_id = ? ORDER BY effective_at DESC LIMIT 1')
      .get(who.member.id),
    mine: data.entriesByCrew(who.member.id, { includeHeld: true }),
    f: takeFlash(who.user.username),
    phase: ctx.mission.phase,
  }));
});

/**
 * The crew file their own state now that mission control is messages only.
 * Values stay private: the public sees the sentences they map to, never a number.
 */
router.post('/state', (req, res) => {
  const who = session(req);
  if (!who || !who.member) return res.redirect('/log');
  // Two axes are reported; the other two columns are kept at centre so the
  // older four-axis history still averages sensibly.
  const v = (k) => Math.max(0, Math.min(100, Number(req.body[k] ?? 50) || 0));
  const activity = String(req.body.activity || who.member.activity);
  db.prepare(
    `INSERT INTO crew_mood (crew_id, calm_tense, energetic_exhausted, optimistic_uncertain,
       connected_isolated, activity, status, effective_at, set_by)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(who.member.id, v('calm_tense'), v('energetic_exhausted'), 50, 50,
        activity, who.member.status, now(), who.member.designation);
  db.prepare('UPDATE crew SET activity = ? WHERE id = ?').run(activity, who.member.id);
  audit(who.member.designation, 'CrewMood', who.member.id, 'file');
  setFlash(who.user.username, 'State filed. The crew page has been updated.');
  res.redirect('/log');
});

router.post('/entry', (req, res) => {
  const who = session(req);
  if (!who || !who.member) return res.redirect('/log');
  const ctx = req.ctx();
  const n = ctx.mission.clampedDay;
  const body = String(req.body.body || '').trim();

  if (body.length < 2) {
    setFlash(who.user.username, 'An entry needs text before it can be filed.', true);
    return res.redirect('/log');
  }

  const existing = data.entry(who.member.id, n);
  if (existing) {
    // Claim the entry for the terminal, so a later edit to content/logbook.json
    // cannot take back something a performer has typed.
    db.prepare("UPDATE crew_entry SET body = ?, updated_at = ?, source = 'terminal' WHERE id = ?")
      .run(body, now(), existing.id);
    setFlash(who.user.username, 'Entry updated. The change is live on Earth.');
  } else {
    db.prepare(
      `INSERT INTO crew_entry (crew_id, mission_day, body, written_at, updated_at, published, source)
       VALUES (?, ?, ?, ?, ?, 1, 'terminal')`
    ).run(who.member.id, n, body, now(), now());
    setFlash(who.user.username, `Day ${String(n).padStart(3, '0')} filed. It is on the public logbook now.`);
  }
  audit(who.user.username, 'CrewEntry', `${who.member.designation} day ${n}`,
        existing ? 'update' : 'file');
  res.redirect('/log');
});

module.exports = router;
