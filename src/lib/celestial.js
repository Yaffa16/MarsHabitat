'use strict';
/**
 * The celestial objects a message's distance is compared with — content/celestial.json: some 590 things in the sky, from
 * the meteors burning up 90 km overhead to the oldest light there is, each with its distance from Earth in kilometres,
 * what kind of distance that is (how: the height a satellite orbits at, how close an asteroid passed, a planet's mean
 * distance, a probe's distance this year, a light-time mark…), its name, and one line about it, in English, German and
 * French. A hundred and twenty of them lie within the first five light-minutes, so a message just sent passes something
 * new every few seconds; the rest reach out through the two light-weeks a message travels during the run, and on to the
 * stars and galaxies. A tap on a card (public/board.js) names the last of them the message has passed — "Your message
 * is 6.1 times farther away than Saturn. Saturn is on average about 1.43 billion km from Earth — the ringed planet…" —
 * from /api/celestial, which hands the list over in the visitor's language, nearest first. The file is read fresh
 * whenever it changes, so an object added or corrected is live at once; a missing or broken file is an empty list, and
 * the tap then shows nothing.
 */
const fs = require('fs');
const path = require('path');

const FILE = path.join(process.env.CONTENT_DIR || path.join(__dirname, '../../content'), 'celestial.json');
const HOW = ['avg', 'orbit', 'flew', 'reached', 'flyby', 'will', 'closest', 'farthest', 'now', 'mark', 'height', 'ly'];

let cache = { mtime: 0, objects: [] };

/** Every object as the file has it, nearest first — read again when the file has changed. */
function all() {
  let stat;
  try { stat = fs.statSync(FILE); } catch { return []; }
  if (stat.mtimeMs !== cache.mtime) {
    try {
      const obj = JSON.parse(fs.readFileSync(FILE, 'utf8'));
      const objects = (Array.isArray(obj.objects) ? obj.objects : [])
        .filter((o) => o && o.id && Number(o.km) > 0 && o.name && o.name.en)
        .sort((a, b) => Number(a.km) - Number(b.km));
      cache = { mtime: stat.mtimeMs, objects };
    } catch { cache = { mtime: stat.mtimeMs, objects: [] }; }
  }
  return cache.objects;
}

/** The list in one language: name, the line about it, and how its distance is to be read — English where a translation is missing. */
function list(lang = 'en') {
  const l = ['de', 'fr'].includes(lang) ? lang : 'en';
  return all().map((o) => {
    const pick = (field) => (o[field] && (o[field][l] || o[field].en)) || '';
    const how = HOW.includes(o.how) ? o.how : o.ly != null ? 'ly' : 'avg';
    return { id: o.id, kind: o.kind || 'other', km: Number(o.km), ly: o.ly != null ? Number(o.ly) : undefined, how,
      name: pick('name'), about: pick('about') };
  });
}

module.exports = { all, list, FILE, HOW };
