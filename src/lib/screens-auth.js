'use strict';
/**
 * The screens' door. The installation's screens — /screens and every
 * /screen/<name>, with the writing screen's composer and its post — open
 * only to a browser that has signed in with the screens' user and password
 * (SCREENS_USER and SCREENS_PASSWORD in .env; panolab / panolab123 unless
 * they are set) or that holds mission control's session. Anyone who types
 * the address into a browser lands on the sign-in page instead.
 *
 * The sign-in is a cookie, mcs_screens, that carries a signature of the
 * credentials — never the credentials themselves. It holds for a year, so a
 * display in the square stays signed in across its own reloads (every five
 * minutes, and at midnight) and across the station's restarts; and it stops
 * working the moment the password is changed, since the signature changes
 * with it. The sign-in page is throttled: ten wrong tries from one address
 * in ten minutes and it answers 429 for a while.
 */
const crypto = require('crypto');

const USER = (process.env.SCREENS_USER || 'panolab').trim();
const PASSWORD = process.env.SCREENS_PASSWORD || 'panolab123';
const fromEnv = !!(process.env.SCREENS_USER || process.env.SCREENS_PASSWORD);

/** The cookie's value: a signature of the credentials under the station's salt. */
const token = () => crypto.createHmac('sha256', `${process.env.IP_SALT || 'mcs'}|screens`).update(`${USER}\n${PASSWORD}`).digest('hex');

/** Equal, in constant time (the lengths may differ: that much is told). */
function same(a, b) {
  const x = Buffer.from(String(a)), y = Buffer.from(String(b));
  return x.length === y.length && crypto.timingSafeEqual(x, y);
}

/** Are these the screens' credentials? */
function accepted(user, password) {
  return same(String(user || '').trim(), USER) && same(String(password || ''), PASSWORD);
}

/** Has this browser signed in to the screens? */
function signedIn(req) {
  return !!(req.cookies && req.cookies.mcs_screens && same(req.cookies.mcs_screens, token()));
}

function signIn(res) {
  res.cookie('mcs_screens', token(), { httpOnly: true, sameSite: 'lax', maxAge: 365 * 86400000, path: '/', secure: process.env.SECURE_COOKIES === 'true' });
}
function signOut(res) { res.clearCookie('mcs_screens', { path: '/' }); }

/* ---- the throttle: wrong tries per address, within a window */
const TRIES = 10, WINDOW_MS = 10 * 60 * 1000;
const tries = new Map();                                    // ip -> [timestamps of wrong tries within the window]
function throttled(ip) {
  const now = Date.now(), recent = (tries.get(ip) || []).filter((t) => now - t < WINDOW_MS);
  tries.set(ip, recent);
  return recent.length >= TRIES;
}
function failed(ip) { tries.set(ip, (tries.get(ip) || []).concat(Date.now())); }
function cleared(ip) { tries.delete(ip); }

/** The addresses the door guards: /screens, /screen/<name> and what the writing screen posts and fetches. Only an address
 *  among them may be the way on after signing in (no open redirect). */
const guarded = (p) => /^\/screens?(\/|\?|$)/.test(String(p || '')) && !/^\/screens\/(login|logout)(\/|\?|$)/.test(String(p || ''));

module.exports = { USER, fromEnv, accepted, signedIn, signIn, signOut, throttled, failed, cleared, guarded };
