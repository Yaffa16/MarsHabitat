'use strict';
const crypto = require('crypto');
const { db, now } = require('../db');

/**
 * Every generated name is a space name (13 October: "make sure the generative names for all people are space
 * themes"): a word from the sky — a star, a constellation, a planet's moon, a thing seen through a telescope, a place
 * on Mars, a probe that went out there — and a number, NEBULA-417, as a callsign is written. The words are nine letters
 * at the most, so a callsign fits wherever one is shown. (Until 13 October the words were the station's own vocabulary
 * — the planet's geology, orbital mechanics, radio — DUST, IRON, RELAY; callsigns given before then stay as they are.)
 */
const WORDS = [
  // stars
  'SIRIUS', 'VEGA', 'ALTAIR', 'RIGEL', 'POLARIS', 'ARCTURUS', 'ANTARES', 'DENEB', 'CAPELLA', 'ALDEBARAN', 'PROCYON',
  'SPICA', 'CASTOR', 'POLLUX', 'REGULUS', 'MIRA',
  // constellations
  'ORION', 'LYRA', 'CYGNUS', 'DRACO', 'PERSEUS', 'ANDROMEDA', 'PEGASUS', 'AQUILA', 'CARINA', 'PHOENIX', 'CENTAURUS',
  // moons and small worlds
  'PHOBOS', 'DEIMOS', 'TITAN', 'EUROPA', 'GANYMEDE', 'CALLISTO', 'ENCELADUS', 'TRITON', 'CHARON', 'CERES', 'VESTA',
  'OBERON', 'MIRANDA', 'LUNA',
  // what the telescopes see
  'NEBULA', 'QUASAR', 'PULSAR', 'COMET', 'METEOR', 'NOVA', 'SUPERNOVA', 'AURORA', 'ECLIPSE', 'ZENITH', 'PHOTON',
  'STARDUST', 'MAGNETAR', 'COSMOS', 'ORBIT', 'APOGEE', 'PERIGEE', 'PARSEC', 'EQUINOX', 'BLAZAR',
  // Mars
  'OLYMPUS', 'THARSIS', 'ELYSIUM', 'ARCADIA', 'JEZERO',
  // the probes
  'VOYAGER', 'PIONEER', 'CASSINI', 'KEPLER', 'MARINER',
];

/* Every callsign issued is counted on its day at the venue as it is issued (visitor_count, schema.sql), so the tally of
   visitors keeps every one — a callsign that never wrote is dropped from the visitor table after a week (server.js,
   pruneVisitors), its count stays (13 October: "make sure nothing is missed or no data point is lost"). */
const countOne = db.prepare('INSERT INTO visitor_count (date, n) VALUES (?, 1) ON CONFLICT(date) DO UPDATE SET n = n + 1');
function counted(stamp) {
  try {
    const mission = require('./mission');
    countOne.run(mission.localDate(new Date(stamp), (mission.config() || {}).timezone || 'Europe/Berlin'));
  } catch (e) { console.warn('[callsign] a visitor was not counted:', e.message); }
}

function generate() {
  for (let attempt = 0; attempt < 60; attempt++) {
    const word = WORDS[crypto.randomInt(WORDS.length)];
    const num = String(crypto.randomInt(100, 1000));
    const callsign = `${word}-${num}`;
    const taken = db.prepare('SELECT 1 FROM visitor WHERE callsign = ?').get(callsign);
    if (!taken) return callsign;
  }
  // Vanishingly unlikely, but never hand back a duplicate (a four-figure number: no word with three figures was free).
  for (let attempt = 0; attempt < 60; attempt++) {
    const callsign = `${WORDS[crypto.randomInt(WORDS.length)]}-${crypto.randomInt(1000, 10000)}`;
    if (!db.prepare('SELECT 1 FROM visitor WHERE callsign = ?').get(callsign)) return callsign;
  }
  return `COMET-${crypto.randomInt(1000, 10000)}`;
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
/** A callsign offered on the cookie card, if it is well formed and still free. */
function usable(cs) {
  const m = /^([A-Z]+)-(\d{3,4})$/.exec(String(cs || ''));
  if (!m || !WORDS.includes(m[1])) return null;
  return db.prepare('SELECT 1 FROM visitor WHERE callsign = ?').get(cs) ? null : cs;
}

/** Keep the visitor's cookie for a year from now (they agreed to the cookie). */
function keep(res, visitor) {
  res.cookie('mcs_id', visitor.token, { httpOnly: true, sameSite: 'lax', maxAge: 1000 * 60 * 60 * 24 * 365,
    secure: process.env.SECURE_COOKIES === 'true' });
}

function identify(req, res, { create = true, persist = true, callsign: wanted = null } = {}) {
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
  const callsign = usable(wanted) || generate();
  const stamp = now();
  const info = db.prepare(
    'INSERT INTO visitor (callsign, token, created_at, last_seen) VALUES (?, ?, ?, ?)'
  ).run(callsign, newToken, stamp, stamp);
  counted(stamp);

  res.cookie('mcs_id', newToken, {
    httpOnly: true,
    sameSite: 'lax',
    maxAge: persist ? 1000 * 60 * 60 * 24 * 365 : undefined,  // none: a cookie for the visit only
    secure: process.env.SECURE_COOKIES === 'true',
  });
  return { id: info.lastInsertRowid, callsign, token: newToken, created_at: stamp };
}

/**
 * A visitor minted without a cookie — for the installation's writing screen
 * (server.js, POST /screen/write), where every message is a new visitor's:
 * a callsign of its own, a token nobody holds. The message keeps the
 * callsign, and the visitor can look for it on the board.
 */
function mint() {
  const token = crypto.randomBytes(24).toString('hex');
  const cs = generate(), stamp = now();
  const info = db.prepare('INSERT INTO visitor (callsign, token, created_at, last_seen) VALUES (?, ?, ?, ?)').run(cs, token, stamp, stamp);
  counted(stamp);
  return { id: info.lastInsertRowid, callsign: cs, token, created_at: stamp };
}

/**
 * The ground station's own name — the operator every message from the
 * installation's writing screen goes out under (server.js, POST /screen/write),
 * and whose messages the installation's board screen shows as its own,
 * answered or not (data.board, callsign). BODENSTATION — the ground station,
 * in German — unless SCREEN_OPERATOR in .env says another.
 */
const STATION = (process.env.SCREEN_OPERATOR || 'BODENSTATION').trim().slice(0, 40) || 'BODENSTATION';

module.exports = { identify, generate, usable, keep, mint, WORDS, STATION };
