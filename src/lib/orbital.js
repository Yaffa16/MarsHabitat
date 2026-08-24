'use strict';
/**
 * Earth + Mars heliocentric positions from Keplerian elements.
 * Elements and per-century rates: Standish, JPL "Keplerian Elements for
 * Approximate Positions of the Major Planets", valid 1800-2050 AD.
 * Accuracy is a few arcminutes -- far beyond what this interface needs,
 * and it removes any dependency on an external ephemeris service.
 */

const DEG = Math.PI / 180;
const AU_KM = 149597870.7;
const AU_LIGHT_SECONDS = 499.004784;

const BODIES = {
  earth: {
    label: 'EARTH',
    // a, e, I, L, longPeri, longNode  (au, --, deg, deg, deg, deg)
    el: [1.00000261, 0.01671123, -0.00001531, 100.46457166, 102.93768193, 0.0],
    rate: [0.00000562, -0.00004392, -0.01294668, 35999.37244981, 0.32327364, 0.0],
    periodDays: 365.256,
  },
  mars: {
    label: 'MARS',
    el: [1.52371034, 0.09339410, 1.84969142, -4.55343205, -23.94362959, 49.55953891],
    rate: [0.00001847, 0.00007882, -0.00813131, 19140.30268499, 0.44441088, -0.29257343],
    periodDays: 686.980,
  },
};

function julianDay(date) {
  return date.getTime() / 86400000 + 2440587.5;
}

function wrapDeg(d) {
  let x = d % 360;
  if (x > 180) x -= 360;
  if (x < -180) x += 360;
  return x;
}

function norm360(d) {
  const x = d % 360;
  return x < 0 ? x + 360 : x;
}

/** Solve Kepler's equation by Newton-Raphson. M in degrees, returns E in degrees. */
function eccentricAnomaly(Mdeg, e) {
  const M = Mdeg * DEG;
  let E = M + e * Math.sin(M);
  for (let i = 0; i < 12; i++) {
    const dM = M - (E - e * Math.sin(E));
    const dE = dM / (1 - e * Math.cos(E));
    E += dE;
    if (Math.abs(dE) < 1e-12) break;
  }
  return E / DEG;
}

/** Heliocentric ecliptic position in au for one body at `date`. */
function position(bodyKey, date) {
  const body = BODIES[bodyKey];
  const T = (julianDay(date) - 2451545.0) / 36525;

  const a = body.el[0] + body.rate[0] * T;
  const e = body.el[1] + body.rate[1] * T;
  const I = (body.el[2] + body.rate[2] * T) * DEG;
  const L = body.el[3] + body.rate[3] * T;
  const peri = body.el[4] + body.rate[4] * T;
  const node = (body.el[5] + body.rate[5] * T) * DEG;

  const M = wrapDeg(L - peri);
  const E = eccentricAnomaly(M, e) * DEG;

  // Position in the orbital plane
  const xp = a * (Math.cos(E) - e);
  const yp = a * Math.sqrt(1 - e * e) * Math.sin(E);

  const w = peri * DEG - node; // argument of perihelion
  const cw = Math.cos(w), sw = Math.sin(w);
  const cn = Math.cos(node), sn = Math.sin(node);
  const ci = Math.cos(I), si = Math.sin(I);

  const x = (cw * cn - sw * sn * ci) * xp + (-sw * cn - cw * sn * ci) * yp;
  const y = (cw * sn + sw * cn * ci) * xp + (-sw * sn + cw * cn * ci) * yp;
  const z = (sw * si) * xp + (cw * si) * yp;

  return {
    key: bodyKey,
    label: body.label,
    x, y, z,
    r: Math.hypot(x, y, z),
    // Ecliptic longitude, used for placing the marker on the schematic plot
    lonDeg: norm360(Math.atan2(y, x) / DEG),
    semiMajor: a,
    eccentricity: e,
  };
}

/**
 * Full Earth-Mars geometry for a moment in time.
 * `separationDeg` is the Sun-centred angle between the two planets, which is
 * what the schematic orbital plot actually draws.
 */
function geometry(date = new Date()) {
  const earth = position('earth', date);
  const mars = position('mars', date);

  const dx = mars.x - earth.x;
  const dy = mars.y - earth.y;
  const dz = mars.z - earth.z;
  const distanceAu = Math.hypot(dx, dy, dz);

  const lightSeconds = distanceAu * AU_LIGHT_SECONDS;
  let separationDeg = Math.abs(mars.lonDeg - earth.lonDeg);
  if (separationDeg > 180) separationDeg = 360 - separationDeg;

  // Compare with the same measurement 24 h ago so the interface can say
  // whether the planets are currently closing or separating.
  const then = new Date(date.getTime() - 86400000);
  const e0 = position('earth', then);
  const m0 = position('mars', then);
  const prevAu = Math.hypot(m0.x - e0.x, m0.y - e0.y, m0.z - e0.z);
  const trend = distanceAu < prevAu ? 'CLOSING' : 'SEPARATING';
  const rateKmPerDay = (distanceAu - prevAu) * AU_KM;

  return {
    at: date.toISOString(),
    earth,
    mars,
    distanceAu,
    distanceKm: distanceAu * AU_KM,
    lightSeconds,
    lightMinutes: lightSeconds / 60,
    separationDeg,
    trend,
    rateKmPerDay,
  };
}

/** "14 min 22 s" -- used wherever the real transmission time is shown. */
function formatLightTime(seconds) {
  const m = Math.floor(seconds / 60);
  const s = Math.round(seconds % 60);
  return `${m} min ${String(s).padStart(2, '0')} s`;
}

module.exports = { geometry, position, formatLightTime, AU_KM, AU_LIGHT_SECONDS };
