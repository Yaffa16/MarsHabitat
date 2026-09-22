'use strict';
const crypto = require('crypto');
const { db, now } = require('../db');

/**
 * Words are drawn from Martian surface geology, orbital mechanics and radio
 * operations -- the vocabulary the station itself would use. No sci-fi nouns.
 */
const WORDS = [
  'DUST', 'ORBIT', 'RED', 'BASALT', 'RELAY', 'VECTOR', 'REGOLITH', 'OLYMPUS',
  'CRATER', 'SOLAR', 'DELTA', 'APOGEE', 'DRIFT', 'IRON', 'SILICA', 'AEOLIS',
  'CARRIER', 'BEACON', 'TERMINAL', 'AZIMUTH', 'PERIGEE', 'OXIDE', 'PLAIN',
  'SIGNAL', 'VALLES', 'ARCADIA', 'SHIELD', 'CANYON', 'ELYSIUM', 'DOWNLINK',
  'HORIZON', 'LATITUDE', 'CIRRUS', 'FROST', 'ALBEDO', 'TRANSIT', 'ANCHOR',
];

function generate() {
  for (let attempt = 0; attempt < 60; attempt++) {
    const word = WORDS[crypto.randomInt(WORDS.length)];
    const num = String(crypto.randomInt(100, 1000));
    const callsign = `${word}-${num}`;
    const taken = db.prepare('SELECT 1 FROM visitor WHERE callsign = ?').get(callsign);
    if (!taken) return callsign;
  }
  // Vanishingly unlikely, but never hand back a duplicate.
  return `RELAY-${crypto.randomInt(1000, 9999)}`;
}

/**
 * Find the visitor for this request by their cookie; with `create`, mint one
 * when there is none. The cookie lasts a year when the visitor has accepted
 * the station's cookie (`persist`), and only until the browser closes when
 * they have not — the station asks on first contact (server.js, /consent):
 * a page view mints nothing until they accept; sending a message mints a
 * callsign either way, since the message needs one, kept for the visit only
 * unless they accepted.
 */
function identify(req, res, { create = true, persist = true } = {}) {
  const token = req.cookies.mcs_id;
  if (token) {
    const v = db.prepare('SELECT * FROM visitor WHERE token = ?').get(token);
    if (v) {
      db.prepare('UPDATE visitor SET last_seen = ? WHERE id = ?').run(now(), v.id);
      return v;
    }
  }
  if (!create) return null;
  const newToken = crypto.randomBytes(24).toString('hex');
  const callsign = generate();
  const stamp = now();
  const info = db.prepare(
    'INSERT INTO visitor (callsign, token, created_at, last_seen) VALUES (?, ?, ?, ?)'
  ).run(callsign, newToken, stamp, stamp);

  res.cookie('mcs_id', newToken, {
    httpOnly: true,
    sameSite: 'lax',
    maxAge: persist ? 1000 * 60 * 60 * 24 * 365 : undefined,  // none: a cookie for the visit only
    secure: process.env.SECURE_COOKIES === 'true',
  });
  return { id: info.lastInsertRowid, callsign, token: newToken, created_at: stamp };
}

module.exports = { identify, generate, WORDS };
