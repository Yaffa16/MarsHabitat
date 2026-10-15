'use strict';
/**
 * THE DASHBOARD REDESIGN, ON TRIAL — /dashboard/next (12 October: "I like the redesign. Keep the current design also,
 * add a page to test the new design. This page should be easily removable later if I don't like the design. Make a very
 * very chic thing.")
 *
 * The mission dashboard after the redesign mock-up of 12 October, built from the station's own data — the same
 * stationData the current /dashboard is drawn from (src/server.js) — and kept live by its own little script: the habitat
 * cutaway as the head of the page, the room-by-room readings set into it and the signal line from the comms dish to
 * Earth with the one-way light time; the sol, the habitat's clock and what the crew are doing now; then life support,
 * the crew on shift, the day as a track, today's mission, the meal, the energy, the resources, the hardware, the trends,
 * the three blogs and the latest exchange — dark glass in ZKM Serendipity and Mars orange. It is dark by design (the
 * page wears the site's dark chrome whatever the theme cookie says, and hides the theme key); it speaks the visitor's
 * language like every public page (the words the dictionary does not know yet are in WORDS, below). Unlisted: nothing
 * links here, the page asks not to be indexed, and the current dashboard is untouched.
 *
 * Its pieces, and nothing else uses them:
 *   src/views/pages/dashboard-next.js   this file — the page and the parts its script refreshes
 *   public/next/dashboard-next.css      its look (everything under body.dnext)
 *   public/next/dashboard-next.js       the clock, the countdown, the live refresh, the section bar
 *   src/server.js                       the block "THE DASHBOARD REDESIGN, ON TRIAL": /dashboard/next, /api/dashboard/next
 *   tools/e2e.sh                        the block of the same name
 * To take it away: delete the three files and the two blocks (and its section in the README). To make it the dashboard:
 * point /dashboard at page() — the data is the same.
 */
const crypto = require('crypto');
const L = require('../layout');
const { esc } = L;
const content = require('../../lib/content');
const data = require('../../lib/data');
const missionLib = require('../../lib/mission');
const moodLib = require('../../lib/mood');
const officer = require('../../lib/officer');
const orbital = require('../../lib/orbital');
const SOL = require('./sol');
const MV = require('./media');

const safe = (fn, fallback = null) => { try { const v = fn(); return v === undefined ? fallback : v; } catch { return fallback; } };

/* ------------------------------------------------------------------ words */
/* The page's own words in German and French — the ones the station's dictionary (src/lib/i18n.js) does not carry yet;
   everything else goes through ctx.T as on every page. Kept here so the page leaves nothing behind when it goes. */
const WORDS = {
  'Habitat time': ['Habitatzeit', 'Heure de l’habitat'],
  'habitat time': ['Habitatzeit', 'heure de l’habitat'],
  'Now in the habitat': ['Jetzt im Habitat', 'En ce moment dans l’habitat'],
  'Next': ['Danach', 'Ensuite'],
  'minutes': ['Minuten', 'minutes'],
  'Countdown': ['Countdown', 'Compte à rebours'],
  'days to go': ['Tage bis zum Start', 'jours avant le départ'],
  'The rehearsal day — NOW': ['Der Probetag — JETZT', 'La journée de répétition — MAINTENANT'],
  'One way to Earth': ['Einfache Strecke zur Erde', 'Aller simple vers la Terre'],
  'million km': ['Mio. km', 'millions de km'],
  'closing': ['nähert sich', 'se rapproche'],
  'receding': ['entfernt sich', 's’éloigne'],
  'there and back': ['hin und zurück', 'aller-retour'],
  'Science lab': ['Labor', 'Laboratoire'],
  'Air': ['Luft', 'Air'],
  'Water': ['Wasser', 'Eau'],
  'Bike': ['Fahrrad', 'Vélo'],
  'Health': ['Gesundheit', 'Santé'],
  'Power': ['Energie', 'Énergie'],
  'today': ['heute', 'aujourd’hui'],
  'no meal filed': ['keine Mahlzeit erfasst', 'aucun repas saisi'],
  'Overview': ['Übersicht', 'Aperçu'],
  'Life support': ['Lebenserhaltung', 'Survie'],
  'The day': ['Der Tag', 'La journée'],
  'Mission': ['Mission', 'Mission'],
  'Meal': ['Mahlzeit', 'Repas'],
  'Energy': ['Energie', 'Énergie'],
  'Hardware': ['Hardware', 'Matériel'],
  'Transmissions': ['Übertragungen', 'Transmissions'],
  'Sections': ['Abschnitte', 'Sections'],
  'Latest pictures': ['Neueste Bilder', 'Dernières images'],
  'Pictures': ['Bilder', 'Images'],
  'Newest': ['Neuestes', 'Le plus récent'],
  'All pictures': ['Alle Bilder', 'Toutes les images'],
  'Nothing in the folder yet': ['Noch nichts im Ordner', 'Rien dans le dossier pour l’instant'],
  'Sensors': ['Sensoren', 'Capteurs'],
  'read every': ['gelesen alle', 'lus toutes les'],
  'All systems nominal': ['Alle Systeme im Normalbereich', 'Tous les systèmes nominaux'],
  'Check': ['Prüfen', 'À vérifier'],
  'Habitat sensor': ['Habitat-Sensor', 'Capteur de l’habitat'],
  'Waiting for readings': ['Warten auf Messwerte', 'En attente de mesures'],
  'The crew': ['Die Crew', 'L’équipage'],
  'on shift': ['im Dienst', 'en service'],
  'How they are': ['Wie es ihnen geht', 'Comment ils vont'],
  'The day in the habitat': ['Der Tag im Habitat', 'La journée dans l’habitat'],
  'done': ['erledigt', 'fait'],
  'Communication hour': ['Kommunikationsstunde', 'Heure de communication'],
  'The crew asks you': ['Die Crew fragt dich', 'L’équipage te demande'],
  'Answer the crew': ['Der Crew antworten', 'Répondre à l’équipage'],
  'Preparation': ['Zubereitung', 'Préparation'],
  'Food meter': ['Küchenzähler', 'Compteur de cuisine'],
  'Energy content': ['Brennwert', 'Énergie'],
  'Water footprint': ['Wasser-Fußabdruck', 'Empreinte eau'],
  'today, from the meters': ['heute, von den Zählern', 'aujourd’hui, aux compteurs'],
  'today, as filed': ['heute, wie erfasst', 'aujourd’hui, tel que saisi'],
  'the bike': ['das Fahrrad', 'le vélo'],
  'Not filed yet': ['Noch nicht erfasst', 'Pas encore saisi'],
  'used today': ['heute verbraucht', 'utilisé aujourd’hui'],
  'none used': ['nichts verbraucht', 'rien d’utilisé'],
  'left at the close of each sol': ['übrig am Ende jedes Sols', 'restant à la fin de chaque sol'],
  'carried in': ['mitgebracht', 'emporté'],
  'counted from SOL 01': ['gezählt ab SOL 01', 'compté à partir du SOL 01'],
  'The habitat’s own devices': ['Die eigenen Geräte des Habitats', 'Les appareils de l’habitat'],
  'Power draw': ['Leistungsaufnahme', 'Puissance appelée'],
  'Gases': ['Gase', 'Gaz'],
  'now': ['jetzt', 'maintenant'],
  'No readings yet today': ['Heute noch keine Messwerte', 'Pas encore de mesures aujourd’hui'],
  'one point a day': ['ein Punkt pro Tag', 'un point par jour'],
  'daily mean': ['Tagesmittel', 'moyenne du jour'],
  'per day': ['pro Tag', 'par jour'],
  'no figures yet': ['noch keine Werte', 'pas encore de valeurs'],
  'so far today': ['bisher heute', 'jusqu’ici aujourd’hui'],
  'on the day before': ['zum Vortag', 'par rapport à la veille'],
  'steady': ['gleichbleibend', 'stable'],
  'Written in the habitat': ['Im Habitat geschrieben', 'Écrit dans l’habitat'],
  'Read on': ['Weiterlesen', 'Lire la suite'],
  'Not written yet': ['Noch nicht geschrieben', 'Pas encore écrit'],
  'The world’s slowest chat': ['Der langsamste Chat der Welt', 'Le chat le plus lent du monde'],
  'Latest exchange': ['Letzter Austausch', 'Dernier échange'],
  'from Earth': ['von der Erde', 'depuis la Terre'],
  'from the habitat': ['aus dem Habitat', 'depuis l’habitat'],
  'No exchange published yet': ['Noch kein Austausch veröffentlicht', 'Aucun échange publié pour l’instant'],
  'The new dashboard, on trial': ['Das neue Dashboard, zum Ausprobieren', 'Le nouveau tableau de bord, à l’essai'],
  'Back to the current dashboard': ['Zurück zum jetzigen Dashboard', 'Retour au tableau de bord actuel'],
  'Crew on shift': ['Crew im Dienst', 'Équipage en service'],
  'Steps': ['Schritte', 'Pas'],
  'Drinking water': ['Trinkwasser', 'Eau potable'],
  'Oxygen · daily mean': ['Sauerstoff · Tagesmittel', 'Oxygène · moyenne du jour'],
  'CO₂ · daily mean': ['CO₂ · Tagesmittel', 'CO₂ · moyenne du jour'],
  'Rounds pedalled · per day': ['Pedalumdrehungen · pro Tag', 'Tours de pédale · par jour'],
  'Steps · the crew': ['Schritte · die Crew', 'Pas · l’équipage'],
  'Power consumed · per day': ['Verbrauchte Energie · pro Tag', 'Énergie consommée · par jour'],
};
function wordsFor(ctx) {
  const i = ctx.lang === 'de' ? 0 : ctx.lang === 'fr' ? 1 : -1;
  const T = ctx.T || ((s) => s);
  return (s) => { const row = WORDS[s]; return row && i >= 0 && row[i] ? row[i] : T(s); };
}

/* ---------------------------------------------------------------- helpers */
const pad2 = (n) => String(n).padStart(2, '0');
const num = (v) => (v == null || v === '' || !Number.isFinite(Number(v)) ? null : Number(v));
const fx = (v, dp = 0) => (num(v) == null ? '—' : Number(v).toFixed(dp));
const fint = (v) => (num(v) == null ? '—' : Math.round(Number(v)).toLocaleString('en-GB'));
const trimNum = (v, dp) => (num(v) == null ? '—' : String(+Number(v).toFixed(dp)));
const LOCALE = { de: 'de-DE', fr: 'fr-FR', en: 'en-GB' };
const capFirst = (s) => (s ? s.charAt(0).toUpperCase() + s.slice(1) : s);
const longDate = (iso, lang) => safe(() => capFirst(new Date(iso + 'T12:00:00Z').toLocaleDateString(LOCALE[lang] || 'en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' })), iso);
const shortDate = (iso, lang) => safe(() => new Date(iso + 'T12:00:00Z').toLocaleDateString(LOCALE[lang] || 'en-GB', { weekday: 'short', day: 'numeric', month: 'short', timeZone: 'UTC' }).replace(/,/g, ''), iso);
const dayMonth = (iso, lang) => safe(() => new Date(iso + 'T12:00:00Z').toLocaleDateString(LOCALE[lang] || 'en-GB', { day: 'numeric', month: 'short', timeZone: 'UTC' }).replace(/\.$/, ''), iso);
const mins = (hhmm) => { const m = /^(\d{1,2}):(\d{2})/.exec(String(hhmm || '')); return m ? Number(m[1]) * 60 + Number(m[2]) : null; };
const clock = (min) => `${pad2(Math.floor(min / 60) % 24)}:${pad2(min % 60)}`;
const sentence = (s) => { s = String(s || ''); return s.charAt(0).toUpperCase() + s.slice(1).toLowerCase(); };
const roleWord = (T, role) => T(sentence(officer.shown(role)));
const ICON = {
  o2: '<text x="12" y="15.5" text-anchor="middle" font-size="9" font-weight="600" fill="currentColor" stroke="none">O₂</text>',
  co2: '<circle cx="12" cy="12" r="3"/><circle cx="4.5" cy="12" r="2"/><circle cx="19.5" cy="12" r="2"/>',
  temp: '<path d="M10 14V5a2 2 0 0 1 4 0v9a4 4 0 1 1-4 0z"/>',
  hum: '<path d="M12 3.5s6 6.3 6 10.6a6 6 0 0 1-12 0C6 9.8 12 3.5 12 3.5z"/>',
  pres: '<path d="M4 16a8 8 0 1 1 16 0"/><path d="M12 16l4-5"/>',
  iaq: '<path d="M3 9h11a3 3 0 1 0-3-3"/><path d="M3 15h15a3 3 0 1 1-3 3"/>',
  light: '<circle cx="12" cy="12" r="4"/><path d="M12 2.5v2M12 19.5v2M2.5 12h2M19.5 12h2M5.3 5.3l1.4 1.4M17.3 17.3l1.4 1.4M5.3 18.7l1.4-1.4M17.3 6.7l1.4-1.4"/>',
  voc: '<path d="M9 3h6M10 3v6l-5 9a2 2 0 0 0 1.8 3h10.4a2 2 0 0 0 1.8-3l-5-9V3"/>',
  arrow: '<path d="M5 12h14M13 6l6 6-6 6"/>',
  ext: '<path d="M7 17L17 7M9 7h8v8"/>',
};
const icon = (k, cls = 'dn-ic') => (k === 'o2' ? `<span class="${cls} is-txt" aria-hidden="true">O₂</span>` : `<span class="${cls}" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">${ICON[k] || ''}</svg></span>`);
const arrow = `<svg class="dn-arrow" viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">${ICON.arrow}</svg>`;
const livePill = (T) => `<span class="dn-live"><i></i>${esc(T('LIVE'))}</span>`;
const hash = (s) => crypto.createHash('sha1').update(String(s)).digest('hex').slice(0, 12);
const MARS = '#ff5a1f', ICE = '#93c5ff';

/* ------------------------------------------------------------- the readings */
/* The habitat sensor's channels as the Sensors tab shows them (public.js, SENSOR_TILES; public/habitat.js, CHANNELS):
   the scale each is read against, its limit where it has one, the words on a reading (habitat.js, the verdicts). */
const CHANNELS = [
  { k: 'co2', name: 'Carbon dioxide', unit: 'ppm', dp: 0, lo: 0, hi: 2000, sub: 'limit 800 ppm' },
  { k: 'temp', name: 'Temperature', unit: '°C', dp: 1, lo: 0, hi: 40 },
  { k: 'hum', name: 'Humidity', unit: '%RH', dp: 0, lo: 0, hi: 100 },
  { k: 'pres', name: 'Air pressure', unit: 'hPa', dp: 1, lo: 950, hi: 1050 },
  { k: 'iaq', name: 'Air quality', unit: 'IAQ', dp: 0, lo: 0, hi: 500, sub: 'IAQ index' },
  { k: 'light', name: 'Light::sensor', unit: 'lx', dp: 0, lo: 0, hi: 1000 },
  { k: 'voc', name: 'Volatile organic compounds', unit: 'ppm', dp: 2, lo: 0, hi: 10 },
];
const O2 = { lo: 16, hi: 24, safeLo: 19.5, safeHi: 23.5 };
function verdict(k, v, T, extra = '') {
  if (v == null) return { text: T('No current reading'), hot: false, none: true };
  if (k === 'co2') return v > 800 ? { text: `${T('Over')} 800 ppm`, hot: true } : { text: T('Within limit') };
  if (k === 'temp') return { text: T(v < 18 ? 'Cool' : v > 26 ? 'Warm' : 'Comfortable') };
  if (k === 'hum') return { text: T(v < 30 ? 'Dry' : v > 60 ? 'Humid' : 'Comfortable') };
  if (k === 'pres') return { text: T(v < 990 ? 'Low' : v > 1030 ? 'High' : 'Normal') };
  if (k === 'iaq') return { text: extra ? T(extra) : (v <= 50 ? T('Excellent') : v <= 100 ? T('Good') : T('Lightly polluted')), hot: v > 150 };
  if (k === 'light') return { text: T(v < 100 ? 'Dim' : v > 750 ? 'Bright' : 'Normal') };
  if (k === 'voc') return { text: T(v < 1 ? 'Low' : v > 3 ? 'High' : 'Moderate') };
  if (k === 'o2') return v < O2.safeLo || v > O2.safeHi ? { text: T(v < O2.safeLo ? 'Low oxygen' : 'High oxygen'), hot: true } : { text: T('Normal air') };
  return { text: '' };
}

/** The habitat sensor now: its latest stored reading and whether it is current, today's readings, how often it is read. */
function airNow() {
  const critical = safe(() => require('../../lib/critical'));
  if (!critical) return { last: null, current: false, rows: [], pollMs: 300000 };
  const last = safe(() => critical.lastStored());
  const stale = safe(() => critical.staleMs(), 15 * 60000);
  const frozen = safe(() => critical.frozen(), false);
  const current = !!last && (frozen || Date.now() - last.t <= stale);
  const start = safe(() => critical.todayStartMs(), Date.now() - 86400000);
  const rows = safe(() => critical.rows(1).filter((r) => r.t >= start), []) || [];
  const src = safe(() => critical.source(), 'home-assistant');
  const pollMs = safe(() => (src === 'home-assistant' ? critical.CFG.habitatPollMs : critical.CFG.pollMs), 300000) || 300000;
  return { last, current, rows, pollMs, dayStart: start };
}

/** The habitat's own hardware through Home Assistant: the day's snapshot, its oxygen sensor, whether a reading is current. */
function hardwareNow() {
  const ha = safe(() => require('../../lib/home-assistant'));
  if (!ha || !safe(() => ha.configured(), false)) return null;
  const snap = safe(() => ha.snapshot(24));
  if (!snap || !Array.isArray(snap.sensors)) return null;
  const staleMs = Number(snap.staleMs) > 0 ? Number(snap.staleMs) : 15 * 60000;
  const current = (s) => !!s && s.value != null && (snap.frozen || Date.now() - (s.seen || s.t || 0) <= staleMs);
  const o2 = snap.sensors.find((x) => /(^|[^a-z])o2([^a-z]|$)|oxygen/i.test(`${x.id} ${x.label}`)) || null;
  return { snap, current, o2 };
}

/* ---------------------------------------------------------------- the day */
/** The day's schedule as the habitat lives it: each activity once, an entry that carries on the one before it folded into
 *  it (EVA / Science Block 3 twice over is one block, 16:00–17:30), the shift changes left out (views/pages/sol.js), each
 *  with its span — to the next entry — and, during the run, whether it is done, under way or ahead. */
function dayRows(tasks, m) {
  const all = (tasks || []).filter((t) => t && t.time && t.label);
  const entries = all.map((t, i) => ({ label: SOL.shown(t.label), detail: t.detail || '', start: mins(t.time), end: all[i + 1] ? mins(all[i + 1].time) : null }));
  const rows = [];
  for (const e of entries) {
    if (!e.label || e.start == null) continue;
    const parts = e.label.split(/\s*\/\s*/).filter(Boolean);
    const first = parts[0].toLowerCase();
    const prev = rows[rows.length - 1];
    if (prev && prev.first === first) {
      prev.end = e.end;
      for (const p of parts) if (!prev.parts.some((y) => y.toLowerCase() === p.toLowerCase())) prev.parts.push(p);
      continue;
    }
    rows.push({ first, parts, detail: e.detail, start: e.start, end: e.end });
  }
  const liveNow = m.phase === 'ACTIVE' ? mins(m.venueTime) : null;
  return rows.map((r) => {
    const label = r.parts.join(' / ');
    const head = r.parts[0].replace(/\s*\([^)]*\)/g, '').trim();
    const tail = r.parts.slice(1).join(' · ').replace(/\s*\([^)]*\)/g, '').trim() || r.detail || '';
    const now = liveNow != null && liveNow >= r.start && (r.end == null || liveNow < r.end);
    const done = liveNow != null && !now && r.end != null && liveNow >= r.end;
    return { label, head, tail, start: r.start, end: r.end, kind: SOL.kindOf(label).key, now, done };
  });
}

/* ------------------------------------------------------------------- crew */
function crewOnShift(ctx, d) {
  const m = ctx.mission, T = ctx.T;
  const now = safe(() => content.crewNow(m), { day: null, crew: {} }) || { day: null, crew: {} };
  const rows = d.crew || safe(() => data.crewWithMood(), []) || [];
  const figures = d.crewFigures || safe(() => content.crewFigures(), {}) || {};
  // the steps of the day shown: today's once filed, else the last day filed (the Steps taken tile, public.js figureTile)
  const n0 = m.phase === 'PRE_LAUNCH' ? (m.nowDay ? 0 : null) : m.clampedDay;   // (before the run with NOW gone, nothing filed yet)
  const filed = (n) => { const f = figures[String(n)]; return !!f && (f.steps != null || Object.values(f.crew || {}).some((x) => x && x.steps != null)); };
  let stepsDay = filed(n0) ? n0 : null;
  if (stepsDay == null && n0 > 0) for (let n = n0 - 1; n >= 1; n--) if (filed(n)) { stepsDay = n; break; }
  const order = rows.length ? rows.map((r) => String(r.designation).toUpperCase()) : SOL.ROLES;
  return order.filter((role) => SOL.ROLES.includes(role)).map((role) => {
    const p = SOL.personOf(SOL.CREW, (now.crew || {})[role]);
    const row = rows.find((c) => String(c.designation).toUpperCase() === role) || null;
    const mood = row && row.mood ? row.mood : null;
    const face = mood ? moodLib.FACES.reduce((best, f) => (Math.abs(f.v - mood.calm_tense) < Math.abs(best.v - mood.calm_tense) ? f : best), moodLib.FACES[0]) : null;
    const t = mood ? moodLib.translate(mood) : null;
    const steps = stepsDay == null ? null : num((((figures[String(stepsDay)] || {}).crew || {})[row ? row.designation : role] || {}).steps);
    return {
      role, roleName: roleWord(T, role), short: officer.shown(role).split(' ').map((w) => w[0]).join(''),
      name: p ? p.name : null, file: p ? p.file : 'robodog.jpg', photo: !!(p && p.photo),
      face, faceIndex: face ? moodLib.FACES.indexOf(face) : -1,
      word: t ? T(t.condition) : null, line: t && t.lines[0] ? T(t.lines[0]) : null, steps, stepsDay,
    };
  });
}

/* ------------------------------------------------------------- the energy */
function energyToday(ctx, d) {
  const m = ctx.mission, pre = m.phase === 'PRE_LAUNCH';
  const power = d.power || safe(() => content.powerLive(), { categories: [], days: {} }) || { categories: [], days: {} };
  const day = pre ? 1 : m.clampedDay;
  const of = power.days[String(day)] || {};
  const meterNow = (c) => safe(() => require('../../lib/home-assistant').counterToday(c.sensor));
  const cats = (power.categories || []).map((c) => ({ key: c.key, label: c.label, sensor: c.sensor, kwh: num(pre && c.sensor ? meterNow(c) : of[c.key]) }));
  const filed = cats.filter((c) => c.kwh != null);
  const total = filed.length ? filed.reduce((s, c) => s + c.kwh, 0) : null;
  const metered = cats.length && cats.every((c) => c.sensor);
  // the bike's day: NOW's before the run, today's or the last day filed during it (public.js, bikeTile)
  const bike = d.bike || safe(() => content.bike(), {}) || {};
  const has = (n) => { const b = bike[String(n)]; return !!b && (b.rounds != null || b.battery != null); };
  let bday = null;
  if (pre) bday = has(0) ? 0 : null;
  else for (let n = m.clampedDay; n >= 1; n--) if (has(n)) { bday = n; break; }
  const b = bday == null ? null : bike[String(bday)];
  const rounds = b && b.rounds != null && b.rounds !== '' ? Math.max(0, Math.round(Number(b.rounds)) || 0) : null;
  const pct = b ? safe(() => content.bikeBattery(b)) : null;
  return { cats, total, metered, bike: { day: bday, rounds, pct: num(pct) } };
}

/* ---------------------------------------------------------------- the meal */
/** The meal to feature: the one being eaten or prepared now — by its time, else its slot's hours — or the next one; once
 *  the day's are over, the last. */
function featuredMeal(meals, m) {
  if (!meals || !meals.length) return null;
  const now = mins(m.venueTime);
  const slotStart = { BREAKFAST: 6 * 60, LUNCH: 11 * 60, DINNER: 17 * 60 };
  const at = (x) => mins(x.served_at) ?? slotStart[String(x.slot).toUpperCase()] ?? null;
  const list = meals.map((x, i) => ({ x, i, t: at(x) })).filter((y) => y.t != null).sort((a, b) => a.t - b.t);
  if (!list.length) return meals[0];
  if (m.phase !== 'ACTIVE') return list[0].x;
  for (let i = 0; i < list.length; i++) { const nxt = list[i + 1]; if (now < (nxt ? nxt.t : 24 * 60) && now >= list[i].t - 90) return list[i].x; }
  return (list.find((y) => y.t > now) || list[list.length - 1]).x;
}

/* ------------------------------------------------------------------ trends */
/** Six of the trends, a point a day for the last days that have one: the air's carbon dioxide and its oxygen (daily
 *  means), the drinking water left at the close of each sol, the power consumed, the bike's rounds and the crew's steps. */
function trendSeries(ctx, d) {
  const m = ctx.mission, T = ctx.T, tz = m.timezone, pre = m.phase === 'PRE_LAUNCH';
  const dates = [];
  for (let i = 6; i >= 0; i--) { const t = new Date(Date.parse(m.today + 'T12:00:00Z') - i * 86400000); dates.push(t.toISOString().slice(0, 10)); }
  const solOf = (iso) => { const k = Math.round((Date.parse(iso + 'T12:00:00Z') - Date.parse(m.start_date + 'T12:00:00Z')) / 864e5) + 1; return k >= 1 && k <= m.totalDays ? k : null; };
  const label = (iso) => { const s = solOf(iso); return s ? `SOL ${pad2(s)}` : dayMonth(iso, ctx.lang); };
  // the habitat sensor's daily means, from its stored readings
  const critical = safe(() => require('../../lib/critical'));
  const rows = safe(() => critical.rows(8, { thin: true }), []) || [];
  const byDay = new Map();
  for (const r of rows) {
    const k = safe(() => missionLib.localDate(new Date(r.t), tz), null); if (!k) continue;
    let b = byDay.get(k); if (!b) byDay.set(k, b = { co2: [0, 0] });
    if (num(r.co2) != null) { b.co2[0] += Number(r.co2); b.co2[1] += 1; }
  }
  const co2 = dates.map((iso) => { const b = byDay.get(iso); return b && b.co2[1] ? Math.round(b.co2[0] / b.co2[1]) : null; });
  // the hardware's daily series: the oxygen sensor's mean; the power meters' added energy, summed (the Power categories)
  const hwDaily = d.hardwareDaily || [];
  const o2s = hwDaily.find((h) => /(^|[^a-z])o2([^a-z]|$)|oxygen/i.test(`${h.id} ${h.label}`));
  const o2 = dates.map((iso) => (o2s && num(o2s.points[iso]) != null ? +Number(o2s.points[iso]).toFixed(1) : null));
  const power = d.power || { categories: [], days: {} };
  const meters = new Set((power.categories || []).map((c) => c.sensor).filter(Boolean));
  const kwh = dates.map((iso) => {
    const s = solOf(iso);
    if (s && !pre && power.days[String(s)]) { const v = Object.values(power.days[String(s)]).map(num).filter((x) => x != null); if (v.length) return +v.reduce((a, b) => a + b, 0).toFixed(2); }
    const v = hwDaily.filter((h) => meters.has(h.id)).map((h) => num(h.points[iso])).filter((x) => x != null);
    return v.length ? +v.reduce((a, b) => a + b, 0).toFixed(2) : null;
  });
  // the stores and the crew's counts are the run's: by its sol (NOW's under today before it)
  const nOf = (iso) => (pre ? (iso === m.today ? 0 : null) : (solOf(iso) && solOf(iso) <= m.clampedDay ? solOf(iso) : null));
  const dayAt = (n) => (n === 0 ? d.nowDay : (d.allDays || [])[n - 1]);
  const water = dates.map((iso) => { const n = nOf(iso); if (n == null || (pre && n === 0)) return null; const r = ((dayAt(n) || {}).inventory || []).find((i) => i.key === 'water'); return r ? num(r.quantity) : null; });
  const bikeRounds = dates.map((iso) => { const n = nOf(iso); const b = n == null ? null : (d.bike || {})[String(n)]; return b && b.rounds != null && b.rounds !== '' ? Math.round(Number(b.rounds)) || 0 : null; });
  const steps = dates.map((iso) => { const n = nOf(iso); const f = n == null ? null : (d.crewFigures || {})[String(n)]; if (!f) return null; if (num(f.steps) != null) return Number(f.steps); const v = Object.values(f.crew || {}).map((x) => num(x && x.steps)).filter((x) => x != null); return v.length ? v.reduce((a, b) => a + b, 0) : null; });
  const series = [
    { key: 'co2', title: 'CO₂ · daily mean', unit: 'ppm', values: co2, dp: 0, warm: true },
    { key: 'o2', title: 'Oxygen · daily mean', unit: '%', values: o2, dp: 1 },
    { key: 'water', title: 'Drinking water', unit: 'L', values: water, dp: 1, empty: 'counted from SOL 01' },
    { key: 'kwh', title: 'Power consumed · per day', unit: 'kWh', values: kwh, dp: 2, today: true },
    { key: 'bike', title: 'Rounds pedalled · per day', unit: T('rounds'), values: bikeRounds, dp: 0, warm: true },
    { key: 'steps', title: 'Steps · the crew', unit: T('steps'), values: steps, dp: 0, warm: true },
  ];
  return { dates, labels: dates.map(label), series };
}

/* ------------------------------------------------------------------ blogs */
function blogPosts(ctx, d) {
  const m = ctx.mission, pre = m.phase === 'PRE_LAUNCH';
  const days = d.logDays || [];
  const BLOG = [['commander', 'Commander Log', 'COMMUNICATION OFFICER'], ['science', 'Daily Mission Report', 'SCIENCE OFFICER'], ['health', 'Health Report', 'HEALTH OFFICER']];
  return BLOG.map(([key, title, role]) => {
    let entry = null, day = null;
    if (pre && d.nowLog) { const e = (d.nowLog.entries || []).find((x) => x.blog === key && !x.placeholder); if (e) { entry = e; day = 0; } }
    if (!entry) for (let n = m.clampedDay; n >= 1; n--) { const e = ((days[n - 1] || {}).entries || []).find((x) => x.blog === key && !x.placeholder); if (e) { entry = e; day = n; break; } }
    const who = day ? SOL.personOf(SOL.CREW, safe(() => content.crewForDay(day), {})[role]) : null;
    let head = '', text = '';
    if (entry) {
      const plain = MV.entryText(entry.body).replace(/\s+/g, ' ').trim();
      const first = /^(.{12,96}?[.!?])\s+(.*)$/.exec(plain);
      if (first) { head = first[1]; text = first[2]; } else text = plain;
      if (text.length > 260) text = text.slice(0, 260).replace(/\s+\S*$/, '') + ' …';
    }
    return { key, title, role, entry, day, who, head, text, at: entry && entry.written_at ? entry.written_at : null };
  });
}

/* ================================================================ RENDERING */

/* The instruments' drawings — each its own small SVG in the tile's top right, the carbon dioxide's day under it. */
function arcPath(cx, cy, r, a0, a1) { const p = (a) => [cx + r * Math.cos(a), cy + r * Math.sin(a)]; const [x0, y0] = p(a0), [x1, y1] = p(a1); return `M${x0.toFixed(2)} ${y0.toFixed(2)}A${r} ${r} 0 ${a1 - a0 > Math.PI ? 1 : 0} 1 ${x1.toFixed(2)} ${y1.toFixed(2)}`; }
function dial(v, lo, hi, b0, b1) {
  const a0 = Math.PI * 0.75, a1 = Math.PI * 2.25, f = (x) => a0 + (a1 - a0) * Math.max(0, Math.min(1, (x - lo) / (hi - lo)));
  const ticks = Array.from({ length: 9 }, (_, i) => { const a = a0 + (a1 - a0) * i / 8; return `<line x1="${(48 + 28 * Math.cos(a)).toFixed(1)}" y1="${(50 + 28 * Math.sin(a)).toFixed(1)}" x2="${(48 + 31 * Math.cos(a)).toFixed(1)}" y2="${(50 + 31 * Math.sin(a)).toFixed(1)}"/>`; }).join('');
  const needle = v == null ? '' : (() => { const a = f(v); return `<path class="dn-arc" d="${arcPath(48, 50, 38, a0, Math.max(a0 + 0.01, a))}"/><line class="dn-needle" x1="48" y1="50" x2="${(48 + 24 * Math.cos(a)).toFixed(1)}" y2="${(50 + 24 * Math.sin(a)).toFixed(1)}"/><circle class="dn-hub" cx="48" cy="50" r="3.2"/>`; })();
  return `<svg class="dn-dial" viewBox="0 0 96 96" aria-hidden="true"><path class="dn-track" d="${arcPath(48, 50, 38, a0, a1)}"/><path class="dn-band" d="${arcPath(48, 50, 38, f(b0), f(b1))}"/><g class="dn-ticks">${ticks}</g>${needle}</svg>`;
}
function spark(rows, k, lo, hi, limit) {
  const pts = rows.map((r) => [r.t, num(r[k])]).filter(([, v]) => v != null);
  if (pts.length < 2) return '<svg class="dn-spark" viewBox="0 0 200 64" preserveAspectRatio="none" aria-hidden="true"></svg>';
  const t0 = pts[0][0], t1 = Math.max(pts[pts.length - 1][0], t0 + 1);
  const y = (v) => 60 - (Math.max(lo, Math.min(hi, v)) - lo) / (hi - lo) * 52;
  const line = pts.map(([t, v], i) => `${i ? 'L' : 'M'}${((t - t0) / (t1 - t0) * 200).toFixed(1)} ${y(v).toFixed(1)}`).join(' ');
  return `<svg class="dn-spark" viewBox="0 0 200 64" preserveAspectRatio="none" aria-hidden="true">
      <defs><linearGradient id="dn-sg-${k}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${ICE}" stop-opacity=".34"/><stop offset="1" stop-color="${ICE}" stop-opacity="0"/></linearGradient></defs>
      <path d="${line} L200 64 L0 64 Z" fill="url(#dn-sg-${k})"/><path class="dn-spark-line" d="${line}"/>
      ${limit != null ? `<line class="dn-limit" x1="0" x2="200" y1="${y(limit).toFixed(1)}" y2="${y(limit).toFixed(1)}"/>` : ''}</svg>`;
}
function thermo(v) {
  const y = (x) => 88 - Math.max(0, Math.min(40, x)) / 40 * 82;
  return `<svg class="dn-thermo" viewBox="0 0 40 112" aria-hidden="true"><rect class="dn-tube" x="14" y="4" width="12" height="86" rx="6"/><rect class="dn-comfy" x="15.5" y="${y(26).toFixed(1)}" width="9" height="${(y(18) - y(26)).toFixed(1)}"/>
      ${v == null ? '' : `<rect class="dn-merc" x="17" y="${y(v).toFixed(1)}" width="6" height="${(92 - y(v)).toFixed(1)}" rx="3"/>`}<circle class="dn-bulb${v == null ? ' is-off' : ''}" cx="20" cy="96" r="10"/>
      ${[0, 10, 20, 30, 40].map((t) => `<line class="dn-tick" x1="28" x2="33" y1="${y(t).toFixed(1)}" y2="${y(t).toFixed(1)}"/>`).join('')}</svg>`;
}
function vessel(v) {
  const lvl = 77 - 70 * Math.max(0, Math.min(100, v == null ? 0 : v)) / 100;
  let d1 = `M0 ${lvl.toFixed(1)}`; for (let x = 0; x <= 84; x += 4) d1 += ` L${x} ${(lvl + Math.sin(x / 9) * 2.4).toFixed(1)}`;
  let d2 = `M0 ${(lvl + 4).toFixed(1)}`; for (let x = 0; x <= 84; x += 4) d2 += ` L${x} ${(lvl + 4 + Math.sin(x / 7 + 2) * 2).toFixed(1)}`;
  return `<svg class="dn-vessel" viewBox="0 0 84 84" aria-hidden="true"><defs><clipPath id="dn-vc"><circle cx="42" cy="42" r="35"/></clipPath></defs><circle class="dn-glass" cx="42" cy="42" r="38"/>
      ${v == null ? '' : `<path class="dn-water" d="${d1} L84 84 L0 84 Z" clip-path="url(#dn-vc)"/><path class="dn-water2" d="${d2} L84 84 L0 84 Z" clip-path="url(#dn-vc)"/>`}</svg>`;
}
function bands(v) {
  const cols = ['#7fe0b0', '#b9e27a', '#f2d16b', '#f4a35c', '#f0734d', '#d9475a', '#9a3a8c'], edges = [0, 50, 100, 150, 200, 250, 350, 500], w = 168 / 7;
  const at = v == null ? -1 : edges.findIndex((e, i) => i < 7 && v >= e && v < edges[i + 1] + (i === 6 ? 1 : 0));
  const px = v == null ? null : (() => { const i = Math.max(0, at); const f = (Math.min(v, 500) - edges[i]) / (edges[i + 1] - edges[i]); return i * w + Math.max(0.1, Math.min(0.9, f)) * w; })();
  return `<svg class="dn-bands" viewBox="0 0 168 40" aria-hidden="true">${cols.map((c, i) => `<rect x="${(i * w + 1).toFixed(1)}" y="18" width="${(w - 2).toFixed(1)}" height="7" rx="3.5" fill="${c}" opacity="${i === at ? 1 : 0.28}"/>`).join('')}
      ${px == null ? '' : `<path class="dn-pointer" d="M${px.toFixed(1)} 15 l-5 -8 h10 z"/>`}${['0', '50', '100', '150', '200', '250', '350'].map((t, i) => `<text x="${(i * w + 1).toFixed(1)}" y="37">${t}</text>`).join('')}</svg>`;
}
function sun(v) {
  const on = v == null ? 0 : Math.max(1, Math.min(16, Math.round(v / 1000 * 16)));
  const rays = Array.from({ length: 16 }, (_, i) => { const a = i / 16 * Math.PI * 2 - Math.PI / 2, lit = i < on; return `<line class="${lit ? 'on' : ''}" x1="${(47 + 21 * Math.cos(a)).toFixed(1)}" y1="${(47 + 21 * Math.sin(a)).toFixed(1)}" x2="${(47 + (lit ? 36 : 31) * Math.cos(a)).toFixed(1)}" y2="${(47 + (lit ? 36 : 31) * Math.sin(a)).toFixed(1)}"/>`; }).join('');
  return `<svg class="dn-sun${v == null ? ' is-off' : ''}" viewBox="0 0 94 94" aria-hidden="true"><circle class="dn-disc" cx="47" cy="47" r="14"/><g class="dn-rays">${rays}</g></svg>`;
}
function columns(rows, k, dayStart) {
  const hours = new Map();
  for (const r of rows) { const v = num(r[k]); if (v == null) continue; const h = Math.floor((r.t - dayStart) / 3600000); if (h < 0 || h > 23) continue; const b = hours.get(h) || [0, 0]; b[0] += v; b[1] += 1; hours.set(h, b); }
  const keys = [...hours.keys()].sort((a, b) => a - b).slice(-11);
  if (!keys.length) return '<svg class="dn-cols" viewBox="0 0 96 66" aria-hidden="true"></svg>';
  const vals = keys.map((h) => hours.get(h)[0] / hours.get(h)[1]);
  const top = Math.max(1, ...vals);
  return `<svg class="dn-cols" viewBox="0 0 96 66" aria-hidden="true">${vals.map((v, i) => { const h = Math.max(2, v / top * 56); return `<rect class="${i === vals.length - 1 ? 'is-now' : ''}" x="${(i * 8.8).toFixed(1)}" y="${(62 - h).toFixed(1)}" width="5.6" height="${h.toFixed(1)}" rx="1.5"/>`; }).join('')}<line x1="0" x2="96" y1="63.5" y2="63.5"/></svg>`;
}

/** The instruments, tile by tile — the oxygen from the hardware first, then the habitat sensor's channels. */
function lifeTiles(ctx, air, hw) {
  const T = ctx.T;
  const last = air.current ? air.last : null;
  const o2v = hw && hw.o2 && hw.current(hw.o2) ? num(hw.o2.value) : null;
  const o2dp = hw && hw.o2 && Number.isFinite(Number(hw.o2.decimals)) ? Math.min(2, Number(hw.o2.decimals)) : 1;
  const tiles = [];
  const o2vd = o2v == null && !(hw && hw.o2) ? { text: T('No oxygen sensor connected'), none: true } : verdict('o2', o2v, T);
  tiles.push({ k: 'o2', name: T('Oxygen'), sub: `${T('Scale')} ${O2.lo}–${O2.hi} %`, value: o2v == null ? '—' : fx(o2v, o2dp), unit: '%', vd: o2vd, viz: dial(o2v, O2.lo, O2.hi, O2.safeLo, O2.safeHi), cls: 'viz-dial' });
  for (const c of CHANNELS) {
    const v = last ? num(last[c.k]) : null;
    const vd = verdict(c.k, v, T, c.k === 'iaq' && last ? last.iaqc : '');
    const sub = c.sub ? (c.k === 'co2' ? `${T('Scale')} 0–2000 ppm` : T(c.sub)) : `${T('Scale')} ${c.lo}–${c.hi} ${c.unit}`;
    let viz = '', cls = '';
    if (c.k === 'co2') { viz = spark(air.rows, 'co2', 400, 1000, 800); cls = 'viz-spark'; }
    else if (c.k === 'temp') { viz = thermo(v); cls = 'viz-thermo'; }
    else if (c.k === 'hum') { viz = vessel(v); cls = 'viz-vessel'; }
    else if (c.k === 'pres') { viz = dial(v, c.lo, c.hi, 990, 1030); cls = 'viz-dial'; }
    else if (c.k === 'iaq') { viz = bands(v); cls = 'viz-bands'; }
    else if (c.k === 'light') { viz = sun(v); cls = 'viz-sun'; }
    else if (c.k === 'voc') { viz = columns(air.rows, 'voc', air.dayStart); cls = 'viz-cols'; }
    tiles.push({ k: c.k, name: T(c.name), sub, value: v == null ? '—' : fx(v, c.dp), unit: c.unit, vd, viz, cls });
  }
  return tiles.map((t) => `
        <article class="dn-tile is-${t.k} ${t.cls}${t.vd.hot ? ' is-hot' : ''}${t.vd.none ? ' is-none' : ''}">
          <header><h3>${esc(t.name)}</h3><p>${esc(t.sub)}</p>${icon(t.k)}</header>
          <div class="dn-viz">${t.viz}</div>
          <div class="dn-val"><b>${esc(t.value)}</b><em>${esc(t.unit)}</em></div>
          <p class="dn-vd"><i></i>${esc(t.vd.text)}</p>
        </article>`).join('');
}
/** One word on the instruments: a reading over its limit named; all nominal only while the habitat sensor itself is
 *  current — with only the oxygen in, the sensor's silence is said instead. */
function lifeStatus(ctx, air, hw, w) {
  const T = ctx.T, last = air.current ? air.last : null;
  const o2v = hw && hw.o2 && hw.current(hw.o2) ? num(hw.o2.value) : null;
  if (!last && o2v == null) return `<span class="dn-chip is-none"><i></i>${esc(w('Waiting for readings'))}</span>`;
  const hot = [];
  if (last && num(last.co2) > 800) hot.push(T('Carbon dioxide'));
  if (last && num(last.iaq) > 150) hot.push(T('Air quality'));
  if (o2v != null && (o2v < O2.safeLo || o2v > O2.safeHi)) hot.push(T('Oxygen'));
  if (hot.length) return `<span class="dn-chip is-hot"><i></i>${esc(w('Check'))} · ${esc(hot.join(', '))}</span>`;
  if (!last) return `<span class="dn-chip is-none"><i></i>${esc(w('Habitat sensor'))} · ${esc(T('No current reading'))}</span>`;
  return `<span class="dn-chip is-ok"><i></i>${esc(w('All systems nominal'))}</span>`;
}

/* The hero's parts the script refreshes: what the crew are doing now (or the countdown before the run), the light time
   to Earth, and the readings set into the rooms of the cutaway. */
function nowCard(ctx, rows, w) {
  const m = ctx.mission, T = ctx.T;
  if (m.phase === 'PRE_LAUNCH') {
    const c = m.countdown || { days: 0, hours: 0, minutes: 0, seconds: 0 };
    const opensOn = ctx.lang === 'de' || ctx.lang === 'fr' ? safe(() => new Date(m.start_date + 'T12:00:00Z').toLocaleDateString(LOCALE[ctx.lang], { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' }), m.startLabel) : m.startLabel;
    return `<div class="dn-now-k"><i></i>${esc(w('Countdown'))}</div>
      <div class="dn-now-t dn-count" data-dn-count>${c.days} d ${pad2(c.hours)}:${pad2(c.minutes)}:${pad2(c.seconds)}</div>
      <div class="dn-now-time">${esc(T('to occupation'))} · ${esc(opensOn)} · 00:00</div>
      ${m.nowPre ? `<div class="dn-now-next"><span>${esc(T('Today'))}</span>${esc(w('The rehearsal day — NOW'))}</div>` : ''}`;
  }
  const i = rows.findIndex((r) => r.now);
  if (i < 0) {
    const next = rows.find((r) => r.start > mins(m.venueTime));
    return `<div class="dn-now-k"><i></i>${esc(w('Now in the habitat'))}</div>
      <div class="dn-now-t">${esc(T('off the schedule'))}</div>
      ${next ? `<div class="dn-now-next"><span>${esc(w('Next'))}</span>${esc(clock(next.start))} ${esc(next.head)}</div>` : ''}`;
  }
  const r = rows[i], nx = rows.slice(i + 1, i + 3);
  const end = r.end == null ? r.start + 60 : r.end, len = Math.max(1, end - r.start), gone = Math.max(0, Math.min(len, mins(m.venueTime) - r.start));
  return `<div class="dn-now-k"><i></i>${esc(w('Now in the habitat'))}</div>
      <div class="dn-now-t">${esc(r.head)}${r.tail ? ` <span>· ${esc(r.tail)}</span>` : ''}</div>
      <div class="dn-now-time" data-dn-span="${r.start},${end}">${esc(clock(r.start))} – ${esc(clock(end))} · <span data-dn-gone>${gone}</span> ${esc(T('of'))} ${len} ${esc(w('minutes'))}</div>
      <div class="dn-now-bar"><i style="width:${(gone / len * 100).toFixed(1)}%"></i></div>
      ${nx.length ? `<div class="dn-now-next"><span>${esc(w('Next'))}</span>${nx.map((x) => `${esc(clock(x.start))} ${esc(x.head)}`).join(' &nbsp;·&nbsp; ')}</div>` : ''}`;
}
function linkFigure(ctx, w, { card = false } = {}) {
  const g = safe(() => orbital.geometry(new Date()));
  if (!g) return '';
  const s = Math.round(g.lightSeconds), mm = Math.floor(s / 60), ss = s % 60;
  const trip = Math.round(2 * g.lightSeconds), tm = Math.floor(trip / 60), ts = trip % 60;
  const trend = g.trend === 'CLOSING' ? w('closing') : g.trend ? w('receding') : '';
  const km = (g.distanceKm / 1e6).toFixed(1);
  return card
    ? `<span class="dn-earth-dot" aria-hidden="true"></span><div><b>${mm}<small> min </small>${pad2(ss)}<small> s</small></b><span>${esc(w('One way to Earth'))} · <em>${km} ${esc(w('million km'))}</em></span></div>`
    : `<div class="dn-link-big">${mm}<small> min </small>${pad2(ss)}<small> s</small></div>
      <div class="dn-link-sub">${esc(w('One way to Earth'))}</div>
      <div class="dn-link-sub"><em>${km} ${esc(w('million km'))}</em> · ${g.distanceAu.toFixed(3)} au${trend ? ` · ${esc(trend)}` : ''}</div>
      <div class="dn-link-sub is-trip">${tm} min ${pad2(ts)} s ${esc(w('there and back'))}</div>`;
}
/* The rooms of the cutaway, in its own pixels (public/habitat/cutaway-colour.webp, 1536 × 720), set into a scene 1536 ×
   1000 whose top 280 are sky: each chip at the top of its room, so it labels the room it stands in. */
const SCENE = { w: 1536, h: 1000, img: 280 };
const pct = (v, of) => `${(v / of * 100).toFixed(2)}%`;
function chips(ctx, w, { air, hw, today, energy }) {
  const T = ctx.T;
  const last = air.current ? air.last : null;
  const meal = featuredMeal(today ? today.meals : [], ctx.mission);
  const water = ((today && today.inventory) || []).find((i) => i.key === 'water');
  const o2v = hw && hw.o2 && hw.current(hw.o2) ? num(hw.o2.value) : null;
  const list = [
    { x: 232, y: 626, k: w('Kitchen'), v: meal ? meal.name : w('no meal filed'), x2: meal && num(meal.kcal) ? `${fint(meal.kcal)} kcal` : '' },
    { x: 600, y: 626, k: w('Air'), v: last && num(last.temp) != null ? `${fx(last.temp, 1)} °C` : '—', x2: last && num(last.co2) != null ? `CO₂ ${fint(last.co2)}` : '' },
    { x: 1172, y: 626, k: 'O₂', v: o2v == null ? '—' : `${fx(o2v, 1)} %`, x2: '' },
    { x: 268, y: 806, k: w('Water'), v: water && num(water.quantity) != null && (water.start_quantity || water.quantity) ? `${trimNum(water.quantity, 1)} ${water.unit || 'L'}` : '—', x2: '' },
    { x: 932, y: 806, k: w('Bike'), v: energy.bike.pct != null ? `${Math.round(energy.bike.pct)} %` : '—', x2: energy.bike.rounds != null ? `${fint(energy.bike.rounds)} ${T('rounds')}` : '' },
  ];
  // each chip as wide as the room to the next one on its row allows — a long meal's name ends in an ellipsis rather than
  // running under its neighbour (on a phone the chips leave the picture for the readouts under it: dashboard-next.css)
  const room = (c) => { const next = list.filter((o) => o.y === c.y && o.x > c.x).map((o) => o.x); return ((next.length ? Math.min(...next) : SCENE.w - 4) - c.x - 18) / SCENE.w * 100; };
  return list.map((c) => `<div class="dn-chip-ar" style="left:${pct(c.x, SCENE.w)};top:${pct(c.y, SCENE.h)};max-width:${room(c).toFixed(2)}%"${c.x2 ? ` title="${esc(`${c.v} · ${c.x2}`)}"` : ''}><i></i><em>${esc(c.k)}</em><b>${esc(c.v)}</b>${c.x2 ? `<b class="x">· ${esc(c.x2)}</b>` : ''}</div>`).join('');
}
function scene(ctx, w, parts) {
  const T = ctx.T, mission = parts.mission, energy = parts.energy;
  const hydro = energy.cats.find((c) => /hydro/i.test(c.key + c.label));
  const P = 'M690 432 C 700 240, 1080 120, 1428 96';
  const pk = (begin, r = 9) => `<g class="dn-pkt"><circle r="${r}" fill="url(#dn-pkt)"/><circle r="2.6" fill="#fff"/><animateMotion dur="7.5s" begin="${begin}s" repeatCount="indefinite" path="${P}" keyPoints="0;1" keyTimes="0;1" calcMode="linear"/></g>`;
  return `
      <div class="dn-scene" role="img" aria-label="${esc(T('The habitat in section: its rooms under the dome, on the Mars plain'))}">
        <img class="dn-cut" src="/habitat/cutaway-colour.webp" alt="" width="1536" height="720" decoding="async" fetchpriority="high">
        <svg class="dn-hud" viewBox="0 0 ${SCENE.w} ${SCENE.h}" aria-hidden="true">
          <defs>
            <linearGradient id="dn-sig" gradientUnits="userSpaceOnUse" x1="690" y1="432" x2="1428" y2="96"><stop offset="0" stop-color="${MARS}"/><stop offset="1" stop-color="${ICE}"/></linearGradient>
            <radialGradient id="dn-pkt"><stop offset="0" stop-color="#fff"/><stop offset=".42" stop-color="${ICE}"/><stop offset="1" stop-color="${ICE}" stop-opacity="0"/></radialGradient>
          </defs>
          <path d="${P}" class="dn-sigglow"/>
          <path d="${P}" class="dn-sigline"/>
          ${pk(0)}${pk(2.5, 7)}${pk(5, 7)}
          <circle class="dn-dish" cx="690" cy="432" r="7"/><circle class="dn-dish-ring" cx="690" cy="432" r="18"/><circle class="dn-dish-ring is-2" cx="690" cy="432" r="32"/>
          <path class="dn-leader" d="M312 352 L 352 352 L 435 520"/><circle class="dn-pin" cx="435" cy="520" r="6"/><circle class="dn-pin-ring" cx="435" cy="520" r="15"/>
          <path class="dn-leader" d="M1238 352 L 1198 352 L 1080 525"/><circle class="dn-pin" cx="1080" cy="525" r="6"/><circle class="dn-pin-ring" cx="1080" cy="525" r="15"/>
          <text class="dn-cap" x="18" y="984">HABITAT · CUTAWAY · LIVE</text>
          <text class="dn-cap" x="1518" y="984" text-anchor="end">RED DUST CITY · 49.01° N 8.40° E</text>
        </svg>
        <span class="dn-earth" style="left:${pct(1408, SCENE.w)};top:${pct(70, SCENE.h)}" aria-hidden="true"></span>
        <div class="dn-link" data-dn-part="link">${parts.live ? parts.live.link : linkFigure(ctx, w)}</div>
        <div class="dn-lab is-l" style="left:${pct(30, SCENE.w)};top:${pct(300, SCENE.h)}"><em>${esc(T('Hydroponics'))}</em><b>${hydro && hydro.kwh != null ? `${hydro.kwh.toFixed(2)} kWh ${esc(w('today'))}` : '—'}</b></div>
        <div class="dn-lab is-r" style="right:${pct(24, SCENE.w)};top:${pct(300, SCENE.h)}"><em>${esc(w('Science lab'))}</em><b>${mission ? `${esc(T('Mission No.'))} ${pad2(mission.no)} · ${esc(mission.title)}` : '—'}</b></div>
        <div class="dn-chips" data-dn-part="chips">${parts.live ? parts.live.chips : chips(ctx, w, parts)}</div>
      </div>`;
}

function heroHead(ctx, w, { name }) {
  const m = ctx.mission, T = ctx.T, pre = m.phase === 'PRE_LAUNCH';
  const run = Array.from({ length: m.totalDays }, (_, i) => { const n = i + 1; return `<i class="${pre ? '' : n < m.clampedDay ? 'past' : n === m.clampedDay ? 'cur' : ''}"></i>`; }).join('');
  const left = m.totalDays - m.clampedDay;
  const sol = pre
    ? `<span class="k">T−</span><span class="n">${m.countdown ? m.countdown.days : '—'}</span><span class="of">${esc(w('days to go'))}</span>`
    : `<span class="k">SOL</span><span class="n">${pad2(m.clampedDay)}</span><span class="of">/ ${pad2(m.totalDays)}</span>`;
  return `
      <div class="dn-head">
        <div class="dn-eyebrow">${livePill(T)}<span>${esc(T('Live Mission Dashboard'))} · ${esc(name)}</span></div>
        <div class="dn-sol${pre ? ' is-pre' : ''}">${sol}</div>
        <p class="dn-date">${esc(longDate(m.today, ctx.lang))}</p>
        <p class="dn-meta">${esc(w('Habitat time'))} <b data-dn-clock>${esc(`${m.venueTime} ${missionLib.zoneAbbr(new Date(), m.timezone)}`.trim())}</b> · Karlsruhe, MARS!platz</p>
        <div class="dn-run">
          <div class="dn-run-bar">${run}</div>
          <div class="dn-run-lab"><span>${esc(shortDate(m.start_date, ctx.lang))}</span><span>${pre ? `<b>${m.totalDays}</b> sols` : `<b>${left}</b> ${esc(T(left === 1 ? 'sol remaining' : 'sols remaining'))}`}</span><span>${esc(shortDate(m.end_date, ctx.lang))}</span></div>
        </div>
      </div>`;
}

function bar(ctx, w, { hasHardware }) {
  const m = ctx.mission, T = ctx.T, pre = m.phase === 'PRE_LAUNCH';
  const tabs = [['dn-overview', w('Overview')],
    ['dn-life', w('Life support')], ['dn-crew', T('Crew')], ['dn-day', w('The day')], ['dn-mission', w('Mission')], ['dn-meal', w('Meal')],
    ['dn-energy', w('Energy')], ['dn-resources', T('Resources')], hasHardware ? ['dn-hardware', w('Hardware')] : null, ['dn-trends', T('Trends')], ['dn-transmissions', w('Transmissions')]].filter(Boolean);
  const sols = Array.from({ length: m.totalDays }, (_, i) => {
    const n = i + 1, past = !pre && n < m.clampedDay, cur = !pre && n === m.clampedDay;
    return past || cur ? `<a class="${cur ? 'is-cur' : ''}" href="/at-a-glance#day-${n}" title="SOL ${pad2(n)} · ${esc(shortDate(missionLib.dateForDay(n), ctx.lang))}">${pad2(n)}</a>` : `<span title="SOL ${pad2(n)} · ${esc(shortDate(missionLib.dateForDay(n), ctx.lang))}">${pad2(n)}</span>`;
  }).join('');
  return `
    <nav class="dn-bar" aria-label="${esc(w('Sections'))}">
      <div class="dn-tabs">${tabs.map(([id, label], i) => `<a href="#${id}"${i === 0 ? ' class="is-on"' : ''}>${esc(label)}</a>`).join('')}</div>
      <div class="dn-sols"><span class="k">SOL</span>${sols}</div>
    </nav>`;
}

function picturesPanel(ctx, w, cloud) {
  const T = ctx.T, tz = ctx.mission.timezone;
  const items = cloud && cloud.items ? cloud.items.slice(0, 6) : [];
  const when = (x) => safe(() => MV.cloudWhen(x, tz), null);
  return `
    <section class="dn-panel dn-pics" id="dn-pictures">
      <header class="dn-sec"><div><p class="dn-eye">${esc(T('Live images from the Habitat'))}</p><h2>${esc(w('Latest pictures'))}</h2></div>
        <div class="dn-sec-r">${livePill(T)}<span class="dn-muted">${esc(T('Updates by itself as pictures arrive'))}</span><a class="dn-ghost" href="/media">${esc(w('All pictures'))} ${arrow}</a></div></header>
      ${items.length ? `<div class="dn-film" data-dn-cloud="${esc((cloud.snapshot && cloud.snapshot.version) || '')}">${items.map((x, i) => { const t = when(x); return `
        <a class="dn-shot${i === 0 ? ' is-big' : ''}" href="${esc(x.url)}" target="_blank" rel="noopener" title="${esc(x.name)}">
          <img src="${esc(i === 0 ? x.thumb : (x.small || x.thumb))}" alt="${esc(x.name)}" loading="lazy" decoding="async">
          <span class="dn-shot-cap">${i === 0 ? `<b><i></i>${esc(w('Newest'))}</b>` : ''}${t ? `<time datetime="${esc(t.iso)}">${esc(i === 0 ? t.text : t.text.split(' · ').pop())}</time>` : ''}</span>
        </a>`; }).join('')}
      </div>` : `<p class="dn-empty">${esc(w('Nothing in the folder yet'))}.</p>`}
    </section>`;
}

function crewPanel(ctx, w, crew) {
  const m = ctx.mission, T = ctx.T;
  const now = safe(() => content.crewNow(m), { day: null }) || { day: null };
  const when = now.day != null ? `SOL ${pad2(now.day)}` : '';
  const radar = `<svg class="dn-radar" viewBox="0 0 120 120" aria-hidden="true"><circle cx="60" cy="60" r="54"/><circle class="d" cx="60" cy="60" r="36"/><circle class="d" cx="60" cy="60" r="18"/>
      <g class="dn-sweep"><path d="M60 60 L60 6 A54 54 0 0 1 98 22 Z"/><line x1="60" y1="60" x2="60" y2="6"/></g>${crew.map((c, i) => `<circle class="dn-blip" cx="${[44, 78, 52][i % 3]}" cy="${[40, 70, 84][i % 3]}" r="4.2"/>`).join('')}</svg>`;
  const faces = moodLib.FACES.map((f, i) => {
    const who = crew.filter((c) => c.faceIndex === i);
    return `<li class="${who.length ? 'is-on' : ''}"><span class="dn-face">${moodLib.faceSvg(f)}</span><span class="dn-who">${who.map((c) => esc(c.short)).join(' ')}</span></li>`;
  }).join('');
  return `
      <section class="dn-panel dn-crew" id="dn-crew">
        <header class="dn-sec"><div><p class="dn-eye">${esc(when ? `${when} · ${w('on shift')}` : w('Crew on shift'))}</p><h2>${esc(w('The crew'))}</h2></div><div class="dn-sec-r">${radar}</div></header>
        <ul class="dn-crew-list">${crew.map((c) => `
          <li class="dn-cm${c.photo ? '' : ' is-dog'}">
            <img src="/crew/face/${esc(c.file)}" alt="" width="400" height="400" loading="lazy" decoding="async">
            <div class="dn-cm-id">
              <p class="dn-cm-role">${esc(c.roleName)}</p>
              <p class="dn-cm-name">${esc(c.name || T('to be named'))}</p>
              <p class="dn-cm-mood">${c.face ? `<span class="dn-face">${moodLib.faceSvg(c.face)}</span><b>${esc(c.word)}</b>` : `<span class="dn-face is-blank">${moodLib.faceSvg({ mouth: 'M11 20 h10', eyes: 'dot' })}</span>${esc(T('No state filed yet'))}`}</p>
              ${c.face && c.line ? `<p class="dn-cm-line">${esc(capFirst(c.line.replace(/^[^,—]*[,—]\s*/, '') || c.line))}</p>` : ''}
            </div>
            <div class="dn-cm-steps"><b>${c.steps == null ? '—' : fint(c.steps)}</b><span>${esc(T('steps'))}</span></div>
          </li>`).join('')}
        </ul>
        <div class="dn-scale">
          <div class="dn-scale-lab"><span>${esc(T('THRILLED'))}</span><span>${esc(w('How they are'))}</span><span>${esc(T('ANGRY'))}</span></div>
          <ul class="dn-faces">${faces}</ul>
        </div>
      </section>`;
}

function dayPanel(ctx, w, rows) {
  const m = ctx.mission, T = ctx.T, live = m.phase === 'ACTIVE';
  const doneN = rows.filter((r) => r.done).length, cur = rows.find((r) => r.now);
  const win = safe(() => require('./landing').windowWhen(ctx), '19:00');
  if (!rows.length) return `
      <section class="dn-panel dn-day" id="dn-day">
        <header class="dn-sec"><div><p class="dn-eye">${esc(T('Today'))} · ${esc(longDate(m.today, ctx.lang))}</p><h2>${esc(w('The day in the habitat'))}</h2></div></header>
        <p class="dn-empty">${esc(T('No schedule filed for today'))}</p>
      </section>`;
  const t0 = Math.floor(rows[0].start / 60) * 60;
  const lastEnd = rows[rows.length - 1].end == null ? rows[rows.length - 1].start + 60 : rows[rows.length - 1].end;
  const t1 = Math.ceil(lastEnd / 60) * 60;
  const X = (min) => (min - t0) / (t1 - t0) * 100;
  const hours = [];
  for (let h = t0; h <= t1; h += 60) hours.push(`<span class="dn-hour${(h / 60) % 2 ? ' is-odd' : ''}" style="left:${X(h).toFixed(2)}%">${clock(h)}</span>`);
  const blocks = rows.map((r) => { const end = r.end == null ? r.start + 30 : r.end; return `<span class="dn-blk kind-${r.kind}${r.done ? ' is-done' : ''}${r.now ? ' is-now' : ''}" style="left:${X(r.start).toFixed(2)}%;width:${Math.max(0.6, X(end) - X(r.start) - 0.25).toFixed(2)}%"></span>`; }).join('');
  const labels = rows.map((r, i) => {
    const up = i % 2 === 0, nextSame = rows[i + 2];
    const room = (nextSame ? X(nextSame.start) : 100) - X(r.start) - 0.8;
    return `<span class="dn-tl${up ? ' is-up' : ' is-down'}${r.done ? ' is-done' : ''}${r.now ? ' is-now' : ''}" style="left:${X(r.start).toFixed(2)}%;max-width:${Math.max(6, room).toFixed(2)}%">
          <em>${esc(clock(r.start))}${r.done ? ' · ✓' : r.now ? ` · ${esc(T('NOW'))}` : ''}</em><b>${esc(r.head)}</b>${r.tail ? `<small>${esc(r.tail)}</small>` : ''}</span>`;
  }).join('');
  const nowMin = live ? mins(m.venueTime) : null;
  const needle = nowMin != null && nowMin >= t0 && nowMin <= t1 ? `<span class="dn-needle-now" style="left:${X(nowMin).toFixed(2)}%" data-dn-needle="${t0},${t1}"><i></i><b data-dn-clock-hm>${esc(`${m.venueTime.slice(0, 5)} ${missionLib.zoneAbbr(new Date(), m.timezone)}`.trim())}</b></span>` : '';
  const list = rows.map((r) => `
          <li class="dn-li${r.done ? ' is-done' : ''}${r.now ? ' is-now' : ''}"><span class="dn-li-t">${esc(clock(r.start))}</span><span class="dn-li-dot" aria-hidden="true"></span>
            <span class="dn-li-x"><b>${esc(r.head)}${r.now ? ` <span class="dn-nowtag">${esc(T('NOW'))}</span>` : ''}</b>${r.tail ? `<small>${esc(r.tail)}</small>` : ''}</span></li>`).join('');
  return `
      <section class="dn-panel dn-day" id="dn-day">
        <header class="dn-sec"><div><p class="dn-eye">${esc(T('Today'))} · ${esc(longDate(m.today, ctx.lang))} · ${esc(w('habitat time'))}</p><h2>${esc(w('The day in the habitat'))}</h2></div>
          <div class="dn-sec-r">${live ? `<span class="dn-chip">${doneN} / ${rows.length} ${esc(w('done'))}</span>` : ''}${cur ? `<span class="dn-chip is-mars">${esc(T('NOW'))} · ${esc(cur.head)}</span>` : ''}<span class="dn-chip">${esc(w('Communication hour'))} ${esc(String(win).replace(/\s*\(.*\)/, ''))}</span></div></header>
        <div class="dn-track" aria-hidden="true">
          <div class="dn-hours">${hours.join('')}</div>
          <div class="dn-blocks">${blocks}</div>
          <div class="dn-labels">${labels}</div>
          ${needle}
        </div>
        <ol class="dn-list">${list}
        </ol>
      </section>`;
}

function missionPanel(ctx, w, mission) {
  const m = ctx.mission, T = ctx.T;
  // the part's first line that is not a heading — and when it only announces a list ("Classify the following
  // situations:"), the list's first items after it
  const firstLine = (arr) => {
    const isHead = (l) => l === l.toUpperCase() && /[A-Z]/.test(l);
    const lines = (arr || []).map((raw) => String(raw).replace(/^[•\d.→\s]+/, '').trim()).filter(Boolean);
    const i = lines.findIndex((l) => !isHead(l));
    if (i < 0) return '';
    let l = lines[i];
    if (/:$/.test(l)) { const more = lines.slice(i + 1).filter((x) => !isHead(x)).slice(0, 3); if (more.length) l = `${l} ${more.join(' · ')}`; }
    return l.length > 96 ? l.slice(0, 96).replace(/\s+\S*$/, '').replace(/[\s·,;:–-]+$/, '') + ' …' : l;
  };
  const photo = `/mission/mission-0${mission ? (Number(mission.no) % 3) + 1 : 1}.jpg`;
  if (!mission) return `
      <section class="dn-panel dn-mission" id="dn-mission">
        <div class="dn-card-img"><img src="${photo}" alt="" loading="lazy"><p class="dn-eye">${esc(T('Today’s Mission'))}</p></div>
        <p class="dn-empty">${esc(T('No mission filed for'))} SOL ${pad2(m.clampedDay)}</p>
      </section>`;
  const c = mission.community || {}, cq = ctx.lang === 'de' ? (c.de || c.en) : (c.en || c.de);
  const parts = [['morning', 'Morning'], ['afternoon', 'Afternoon'], ['eva', 'EVA']].map(([k, label]) => [label, firstLine(mission[k])]).filter(([, l]) => l);
  return `
      <section class="dn-panel dn-mission" id="dn-mission">
        <div class="dn-card-img"><img src="${photo}" alt="" loading="lazy"><p class="dn-eye">${esc(T('Today’s Mission'))} · SOL ${pad2(m.clampedDay)}</p></div>
        <div class="dn-mission-head"><span class="dn-mno" aria-label="${esc(T('Mission No.'))} ${pad2(mission.no)}">${pad2(mission.no)}</span>
          <div><h2>${esc(mission.title)}</h2>${mission.question ? `<p class="dn-mq">${esc(mission.question)}</p>` : ''}</div></div>
        ${parts.length ? `<div class="dn-parts">${parts.map(([label, l]) => `<div><em>${esc(T(label))}</em><span>${esc(l)}</span></div>`).join('')}</div>` : ''}
        ${cq ? `<div class="dn-ask"><em>${esc(w('The crew asks you'))}</em><p>${esc(cq)}</p></div>` : ''}
        <a class="dn-btn" href="#write">${esc(w('Answer the crew'))} ${arrow}</a>
      </section>`;
}

function mealPanel(ctx, w, today) {
  const T = ctx.T, meals = today ? today.meals : [];
  const f = featuredMeal(meals, ctx.mission);
  if (!f) return `
      <section class="dn-panel dn-meal" id="dn-meal">
        <header class="dn-sec"><div><p class="dn-eye">${esc(T('Today’s Meal'))}</p><h2>${esc(w('Meal'))}</h2></div></header>
        <div class="dn-void"><svg viewBox="0 0 64 64" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"><circle cx="32" cy="34" r="17"/><circle cx="32" cy="34" r="10" stroke-dasharray="2 4"/><path d="M8 14v12a4 4 0 0 0 4 4v20M12 14v10M16 14v12a4 4 0 0 1-4 4"/><path d="M56 14c-4 3-5 9-5 14h5v22"/></svg><p>${esc(T('No meals filed for today'))}</p></div>
      </section>`;
  const wh = f.power_wh != null ? f.power_wh : f.energy_source === 'filed' ? f.energy_wh : null;
  const figs = [
    [num(f.kcal) != null ? fint(f.kcal) : null, 'kcal', w('Energy content')],
    [num(f.co2e_kg) != null ? trimNum(f.co2e_kg, 2) : null, 'kg', 'CO₂e'],
    [num(f.water_footprint_l) != null ? fint(f.water_footprint_l) : null, 'L', w('Water footprint')],
    [num(f.prep_minutes) != null ? fint(f.prep_minutes) : null, 'min', w('Preparation')],
    [num(wh) != null ? fint(wh) : null, 'Wh', w('Food meter')],
    [num(f.water_litres) != null ? trimNum(f.water_litres, 1) : null, 'L', T('Water')],
  ].filter(([v]) => v != null);
  const n = f.nutrients || {};
  const macro = [['protein_g', 'Protein', 60], ['fat_g', 'Fat', 60], ['carb_g', 'Carbohydrate', 60], ['fiber_g', 'Fibre', 40]].filter(([k]) => num(n[k]) != null);
  const others = meals.filter((x) => x !== f);
  return `
      <section class="dn-panel dn-meal" id="dn-meal">
        <header class="dn-sec"><div><p class="dn-eye">${esc(T('Today’s Meal'))} · ${esc(L.slotName(T, f.slot))}${f.served_at ? ` ${esc(`${f.served_at} ${missionLib.zoneOfWall((today && today.date) || ctx.mission.today, f.served_at, ctx.mission.timezone)}`.trim())}` : ''}</p><h2>${esc(f.name)}</h2></div></header>
        ${figs.length ? `<div class="dn-figs">${figs.slice(0, 6).map(([v, u, k]) => `<div><b>${esc(v)}<small>${esc(u)}</small></b><span>${esc(k)}</span></div>`).join('')}</div>` : ''}
        ${macro.length ? `<div class="dn-macro">${macro.map(([k, label, max]) => `<div><span>${esc(T(label))}</span><i><s style="width:${Math.min(100, Number(n[k]) / max * 100).toFixed(0)}%"></s></i><b>${trimNum(n[k], 1)} g</b></div>`).join('')}</div>` : ''}
        ${others.length ? `<ul class="dn-meals">${others.map((x) => `<li><span><em>${esc(L.slotName(T, x.slot))}</em>${esc(x.name)}</span><b>${num(x.kcal) != null ? `${fint(x.kcal)} kcal` : ''}</b></li>`).join('')}</ul>` : ''}
      </section>`;
}

function energyBody(ctx, w, energy) {
  const T = ctx.T;
  const max = Math.max(0.001, ...energy.cats.map((c) => c.kwh || 0));
  const b = energy.bike;
  const cells = Array.from({ length: 10 }, (_, i) => `<i class="${b.pct != null && i < Math.max(b.pct > 0 ? 1 : 0, Math.round(b.pct / 10)) ? 'on' : ''}"></i>`).join('');
  return `
        <header class="dn-sec"><div><p class="dn-eye">${esc(T('Power consumed'))} · ${esc(w(energy.metered ? 'today, from the meters' : 'today, as filed'))}</p><h2>${esc(w('Energy'))}</h2></div>
          <div class="dn-big"><b>${energy.total == null ? '—' : energy.total.toFixed(2)}</b><em>kWh</em></div></header>
        ${energy.cats.length ? `<div class="dn-pw">${energy.cats.map((c) => `<div${c.kwh == null ? ' class="is-none"' : ''}><span>${esc(c.label)}</span><i>${c.kwh == null ? '' : `<s style="width:${Math.max(2, c.kwh / max * 100).toFixed(1)}%"></s>`}</i><b>${c.kwh == null ? '—' : c.kwh.toFixed(2)}</b></div>`).join('')}</div>` : `<p class="dn-empty">${esc(w('Not filed yet'))}</p>`}
        <div class="dn-gen">
          <div><p class="dn-gen-k">${esc(T('Power generated'))} · ${esc(w('the bike'))}</p><p class="dn-gen-t">${b.rounds == null ? esc(w('Not filed yet')) : `<b>${fint(b.rounds)}</b> ${esc(T('rounds pedalled'))}`}</p></div>
          <div class="dn-gen-pc${b.pct == null ? ' is-none' : ''}">${b.pct == null ? '—' : `${Math.round(b.pct)}<small>%</small>`}</div>
          <div class="dn-cells" aria-hidden="true">${cells}</div>
          <p class="dn-gen-sub">${esc(T('Battery charged'))}</p>
        </div>`;
}

function resourcesPanel(ctx, w, today, allDays) {
  const m = ctx.mission, T = ctx.T, pre = m.phase === 'PRE_LAUNCH';
  const inv = (today && today.inventory && today.inventory.length) ? today.inventory : (((allDays || [])[0] || {}).inventory || []);
  const ring = (i) => {
    const ph = !(i.start_quantity || i.quantity);
    const start = i.start_quantity || i.quantity || 1;
    const f = ph ? 0 : Math.max(0, Math.min(1, i.quantity / start));
    const low = !ph && i.warn_below > 0 && i.quantity <= i.warn_below;
    const r = 46, C = 2 * Math.PI * r;
    const used = num(i.consumption);
    return `<div class="dn-store${low ? ' is-low' : ''}${ph ? ' is-ph' : ''}">
          <div class="dn-ring"><svg viewBox="0 0 104 104" aria-hidden="true"><circle class="t" cx="52" cy="52" r="${r}"/>${f > 0 ? `<circle class="a" cx="52" cy="52" r="${r}" stroke-dasharray="${(C * f).toFixed(1)} ${C.toFixed(1)}" transform="rotate(-90 52 52)"/>` : ''}</svg>
            <div class="c"><b>${ph ? '—' : esc(trimNum(i.quantity, 1))}</b><span>${ph ? '' : `${esc(T('of'))} ${esc(trimNum(start, 1))} ${esc(i.unit)}`}</span></div></div>
          <p class="dn-store-n">${esc(i.label)}</p>
          <p class="dn-store-s">${ph ? '' : used ? `−${esc(trimNum(used, 1))} ${esc(i.unit)} ${esc(w('today'))}` : esc(w('none used'))}</p>
        </div>`;
  };
  const water = inv.find((i) => i.key === 'water');
  const level = water ? Array.from({ length: m.totalDays }, (_, k) => {
    const n = k + 1, row = !pre && n <= m.clampedDay ? (((allDays || [])[n - 1] || {}).inventory || []).find((i) => i.key === 'water') : null;
    const start = water.start_quantity || water.quantity || 1;
    return row && num(row.quantity) != null ? `<i class="${n === m.clampedDay ? 'is-today' : ''}" style="height:${Math.max(4, Math.min(100, row.quantity / start * 100)).toFixed(0)}%" title="SOL ${pad2(n)}: ${trimNum(row.quantity, 1)} ${esc(water.unit)}"></i>` : '<i class="is-ahead"></i>';
  }).join('') : '';
  return `
      <section class="dn-panel dn-res" id="dn-resources">
        <header class="dn-sec"><div><p class="dn-eye">${esc(T('Carried in · never resupplied'))}</p><h2>${esc(T('Resources'))}</h2></div></header>
        ${inv.length ? `<div class="dn-stores">${inv.map(ring).join('')}</div>` : `<p class="dn-empty">${esc(T('No inventory filed for today'))}</p>`}
        ${water ? `<div class="dn-level">
          <div class="dn-level-k"><span>${esc(water.label)} · ${esc(w('left at the close of each sol'))}</span><b>${esc(trimNum(water.start_quantity || water.quantity, 1))} ${esc(water.unit)} ${esc(w('carried in'))}</b></div>
          <div class="dn-level-bars">${level}</div>
          <div class="dn-level-lab">${Array.from({ length: m.totalDays }, (_, k) => `<span${!pre && k + 1 === m.clampedDay ? ' class="is-today"' : ''}>${pad2(k + 1)}</span>`).join('')}</div>
          ${pre ? `<p class="dn-level-note">${esc(w('counted from SOL 01'))}</p>` : ''}
        </div>` : ''}
      </section>`;
}

/* The hardware's day as three charts: the power draw of each channel, the cricket terrarium, the gases — hourly points
   from midnight at the venue, the hours still to come shaded. */
const PALETTE = ['#ff8b4d', '#93c5ff', '#ff5a1f', '#f2d16b', '#7fe0b0', '#b48cff', '#5b8dff', '#d9d9d9', '#f08bb4', '#5fd3c8'];
function hwBody(ctx, w, hw) {
  const T = ctx.T;
  if (!hw) return '';
  const snap = hw.snap, list = snap.sensors;
  const dayStart = snap.since, dayEnd = snap.now || dayStart + 86400000, nowT = Math.min(Date.now(), dayEnd);
  const xOf = (t) => (t - dayStart) / (dayEnd - dayStart) * 420;
  const nowX = xOf(nowT);
  const chart = (sensors, { H = 150, lo = null, hi = null, area = false } = {}) => {
    const all = sensors.flatMap((s) => s.points.map(([, v]) => v)).filter((v) => num(v) != null);
    if (!all.length) return `<p class="dn-empty is-chart">${esc(w('No readings yet today'))}</p>`;
    let a = lo != null ? lo : Math.min(...all), b = hi != null ? hi : Math.max(...all);
    if (b - a < 1e-9) { a -= 1; b += 1; }
    const pad = (b - a) * 0.12; a -= pad; b += pad;
    const y = (v) => H - 6 - (v - a) / (b - a) * (H - 12);
    const grid = [0.25, 0.5, 0.75].map((f) => `<line class="g" x1="0" x2="420" y1="${(H * f).toFixed(1)}" y2="${(H * f).toFixed(1)}"/>`).join('');
    const lines = sensors.map((s, i) => {
      const pts = s.points.filter(([, v]) => num(v) != null);
      if (!pts.length) return '';
      const d = pts.map(([t, v], k) => `${k ? 'L' : 'M'}${xOf(t).toFixed(1)} ${y(v).toFixed(1)}`).join(' ');
      const col = s.colour || PALETTE[i % PALETTE.length];
      return `${area ? `<path d="${d} L${xOf(pts[pts.length - 1][0]).toFixed(1)} ${H} L${xOf(pts[0][0]).toFixed(1)} ${H} Z" fill="${col}" opacity=".16"/>` : ''}<path class="l" d="${d}" stroke="${col}"/>`;
    }).join('');
    return `<svg class="dn-chart" viewBox="0 0 420 ${H}" preserveAspectRatio="none" aria-hidden="true">${grid}<rect class="ahead" x="${nowX.toFixed(1)}" y="0" width="${Math.max(0, 420 - nowX).toFixed(1)}" height="${H}"/>${lines}<line class="now" x1="${nowX.toFixed(1)}" x2="${nowX.toFixed(1)}" y1="0" y2="${H}"/></svg>
      <div class="dn-hrs"><span>00</span><span>06</span><span>12</span><span>18</span><span>24</span></div>`;
  };
  const isW = (s) => s.kind === 'gauge' && /^w$/i.test(String(s.unit || '').trim());
  const power = list.filter(isW).map((s, i) => ({ ...s, colour: PALETTE[i % PALETTE.length] }));
  const temp = list.filter((s) => /°c|celsius/i.test(String(s.unit || '')) && !/o2|oxygen/i.test(s.id + s.label));
  const gases = list.filter((s) => /ppm/i.test(String(s.unit || '')) && !/(^|[^a-z])o2([^a-z]|$)|oxygen/i.test(`${s.id} ${s.label}`)).map((s, i) => ({ ...s, colour: ['#7fe0b0', '#b48cff', '#f2d16b'][i % 3] }));
  const nowSum = power.filter((s) => hw.current(s)).reduce((acc, s) => acc + Number(s.value || 0), 0);
  const val = (s, dp) => (hw.current(s) ? fx(s.value, dp) : '—');
  // the terrarium's figure in red while it is above its range of normal readings (content/home-assistant.json, ok — 15 October)
  const tHot = !!(temp.length && temp[0].ok && hw.current(temp[0]) && Number(temp[0].value) > temp[0].ok[1]);
  const name = (s) => s.label.replace(/\s*·\s*power draw$/i, '');
  return `
        <header class="dn-sec"><div><p class="dn-eye">${esc(w('The habitat’s own devices'))} · ${esc(T('hourly average'))}</p><h2>${esc(T('Habitat hardware'))}</h2></div><div class="dn-sec-r">${livePill(T)}</div></header>
        <div class="dn-hw">
          ${power.length ? `<div class="dn-cht is-power"><div class="dn-cht-h"><span>${esc(w('Power draw'))} · W</span><b>${power.some((s) => hw.current(s)) ? fint(nowSum) : '—'}<small> W ${esc(w('now'))}</small></b></div>${chart(power, { H: 220 })}
            <div class="dn-legend">${power.map((s) => `<span><i style="background:${s.colour}"></i>${esc(name(s))}</span>`).join('')}</div></div>` : ''}
          <div class="dn-cht-col">
            ${temp.length ? `<div class="dn-cht"><div class="dn-cht-h"><span>${esc(T(temp[0].label))}</span><b${tHot ? ' class="is-over" style="color:#e0322b"' : ''}>${val(temp[0], 1)}<small> °C</small></b></div>${chart(temp.slice(0, 1).map((s) => ({ ...s, colour: '#ff8b4d' })), { H: 92, area: true })}</div>` : ''}
            ${gases.length ? `<div class="dn-cht"><div class="dn-cht-h"><span>${esc(w('Gases'))} · ${gases.map((s) => esc(s.label.split(' ·')[0])).join(' · ')}</span><b>${gases.map((s) => val(s, 2)).join(' · ')}<small> ppm</small></b></div>${chart(gases, { H: 92, area: true })}</div>` : ''}
          </div>
        </div>`;
}

function trendsPanel(ctx, w, tr) {
  const T = ctx.T;
  const card = (s) => {
    const vals = s.values, pts = vals.map((v, i) => [i, v]).filter(([, v]) => v != null);
    const lastV = pts.length ? pts[pts.length - 1][1] : null;
    const prevV = pts.length > 1 ? pts[pts.length - 2][1] : null;
    let delta = '';
    if (lastV != null && prevV != null) {
      const dlt = lastV - prevV;
      delta = Math.abs(dlt) < (s.dp ? Math.pow(10, -s.dp) : 1) ? w('steady') : `${dlt > 0 ? '+' : '−'}${trimNum(Math.abs(dlt), s.dp)} ${w('on the day before')}`;
    }
    const lo = pts.length ? Math.min(...pts.map(([, v]) => v)) : 0, hi = pts.length ? Math.max(...pts.map(([, v]) => v)) : 1;
    const X = (i) => 8 + i * (168 / (vals.length - 1)), Y = (v) => (hi === lo ? 24 : 40 - (v - lo) / (hi - lo) * 32);
    const segs = []; let run = [];
    vals.forEach((v, i) => { if (v == null) { if (run.length) segs.push(run); run = []; } else run.push([X(i), Y(v)]); });
    if (run.length) segs.push(run);
    const line = segs.map((sg) => sg.map(([x, y], k) => `${k ? 'L' : 'M'}${x.toFixed(1)} ${y.toFixed(1)}`).join(' ')).join(' ');
    const col = s.warm ? '#ff8b4d' : ICE;
    const svg = pts.length ? `<svg class="dn-tsv" viewBox="0 0 184 48" aria-hidden="true">${segs.map((sg) => sg.length > 1 ? `<path d="${sg.map(([x, y], k) => `${k ? 'L' : 'M'}${x.toFixed(1)} ${y.toFixed(1)}`).join(' ')} L${sg[sg.length - 1][0].toFixed(1)} 46 L${sg[0][0].toFixed(1)} 46 Z" fill="${col}" opacity=".12"/>` : '').join('')}
        <path d="${line}" fill="none" stroke="${col}" stroke-width="1.6" stroke-linejoin="round" stroke-linecap="round"/>
        ${pts.map(([i, v], k) => `<circle cx="${X(i).toFixed(1)}" cy="${Y(v).toFixed(1)}" r="${k === pts.length - 1 ? 3.4 : 2.1}" class="${k === pts.length - 1 ? 'is-last' : ''}" stroke="${col}"/>`).join('')}</svg>` : '<svg class="dn-tsv" viewBox="0 0 184 48" aria-hidden="true"><line x1="8" x2="176" y1="30" y2="30" class="dn-tsv-empty"/></svg>';
    return `<article class="dn-tr${s.warm ? ' is-warm' : ''}"><p class="dn-tr-k">${esc(w(s.title))}</p>
        <p class="dn-tr-v">${lastV == null ? '—' : esc(s.dp ? trimNum(lastV, s.dp) : fint(lastV))}<small>${esc(s.unit)}</small></p>
        <p class="dn-tr-d">${lastV == null ? esc(w(s.empty || 'no figures yet')) : esc(delta || (s.today ? w('so far today') : ''))}</p>${svg}
        <div class="dn-tr-x">${tr.labels.map((l, i) => `<span${i === tr.labels.length - 1 ? ' class="is-last"' : ''}>${esc(i === 0 || i === tr.labels.length - 1 || i === 3 ? l : '·')}</span>`).join('')}</div></article>`;
  };
  return `
    <section class="dn-panel dn-trends" id="dn-trends">
      <header class="dn-sec"><div><p class="dn-eye">${esc(w('one point a day'))} · ${esc(tr.labels[0])} – ${esc(tr.labels[tr.labels.length - 1])}</p><h2>${esc(T('Trends'))}</h2></div><div class="dn-sec-r"><a class="dn-ghost" href="/dashboard#trends">${esc(T('Trends'))} ${arrow}</a></div></header>
      <div class="dn-trs">${tr.series.map(card).join('')}</div>
    </section>`;
}

function transmissionsPanel(ctx, w, posts) {
  const T = ctx.T, m = ctx.mission;
  const card = (p) => `
        <article class="dn-post${p.entry ? '' : ' is-empty'}">
          <header>${p.who ? `<img src="/crew/face/${esc(p.who.file)}" alt="" width="400" height="400" loading="lazy">` : '<span class="dn-post-av" aria-hidden="true"></span>'}
            <div><p class="dn-post-k">${esc(T(p.title))}</p><p class="dn-post-n">${esc(p.who ? p.who.name : roleWord(T, p.role))}<small>${esc(roleWord(T, p.role))}</small></p></div></header>
          ${p.entry ? `${p.head ? `<h3>${esc(p.head)}</h3>` : ''}<p class="dn-post-x">${esc(p.text)}</p>` : `<p class="dn-post-x">${esc(w('Not written yet'))}${m.phase === 'PRE_LAUNCH' ? '' : ` — SOL ${pad2(m.clampedDay)}`}</p>`}
          <footer><span>${p.day === 0 ? esc(T('NOW')) : p.day ? `SOL ${pad2(p.day)}` : ''}${p.at ? ` · ${esc(safe(() => missionLib.clockAt(new Date(p.at), m.timezone), ''))}` : ''}</span>${p.entry ? `<a href="/at-a-glance${p.day ? `#day-${p.day}` : ''}">${esc(w('Read on'))} ${arrow}</a>` : ''}</footer>
        </article>`;
  return `
      <section class="dn-panel dn-tx" id="dn-transmissions">
        <header class="dn-sec"><div><p class="dn-eye">${esc(w('Written in the habitat'))}</p><h2>${esc(w('Transmissions'))}</h2></div><div class="dn-sec-r"><a class="dn-ghost" href="/at-a-glance">${esc(T('At a Glance'))} ${arrow}</a></div></header>
        <div class="dn-posts">${posts.map(card).join('')}</div>
      </section>`;
}

function chatPanel(ctx, w) {
  const T = ctx.T;
  const ex = safe(() => data.board(1, null)[0], null);
  const g = safe(() => orbital.geometry(new Date()));
  const trip = g ? Math.round(2 * g.lightSeconds) : null;
  return `
      <section class="dn-panel dn-chat" id="dn-chat">
        <header class="dn-sec"><div><p class="dn-eye">${esc(w('The world’s slowest chat'))}</p><h2>${esc(w('Latest exchange'))}</h2></div></header>
        ${ex ? `<div class="dn-q"><em>${esc(ex.callsign)} · ${esc(w('from Earth'))}</em><p>${esc(ex.body)}</p></div>
        ${trip ? `<div class="dn-delay"><i></i>${Math.floor(trip / 60)} min ${pad2(trip % 60)} s ${esc(w('there and back'))}<i></i></div>` : ''}
        ${ex.response_body ? `<div class="dn-a"><em>${esc(ex.responder ? roleWord(T, ex.responder) : T('Crew'))} · ${esc(w('from the habitat'))}</em><p>${esc(ex.response_body)}</p></div>` : ''}`
        : `<p class="dn-empty">${esc(w('No exchange published yet'))}</p>`}
        <a class="dn-btn" href="#write">${esc(T('Write to the crew'))} ${arrow}</a>
      </section>`;
}

/* ===================================================================== PAGE */

/** Everything the page and its refresh are built from, read once. `d` is server.js's stationData — or, for the refresh,
 *  just what the refreshed parts need. */
function partsOf(ctx, d) {
  const m = ctx.mission;
  const today = d.today || safe(() => data.day(m.clampedDay, { powerDay: m.nowPre ? 0 : null }));
  return {
    today,
    air: airNow(),
    hw: hardwareNow(),
    energy: energyToday(ctx, d),
    rows: dayRows(today ? today.tasks : [], m),
    mission: d.mission !== undefined ? d.mission : safe(() => content.missionForDay(m.clampedDay)),
  };
}

function page(ctx, d) {
  // the redesign wears the site's dark chrome whatever the theme cookie says (the theme key is hidden on it)
  ctx = Object.assign(Object.create(Object.getPrototypeOf(ctx)), ctx, { theme: 'dark', current: '/dashboard' });
  const w = wordsFor(ctx), T = ctx.T, m = ctx.mission;
  const p = partsOf(ctx, d);
  const name = m.name || 'MARS — RED DUST CITY';
  const hasPictures = !!(d.cloud && d.cloud.items && d.cloud.items.length);
  const lp = livePartsOf(ctx, w, p);
  const body = `
  <div class="dn" id="dn" data-tz="${esc(m.timezone)}" data-phase="${esc(m.phase)}" data-opens="${esc(m.opensAt || '')}" data-poll="60000" data-v="${esc(lp.v)}">
    <h1 class="dn-sr">${esc(T('Live Mission Dashboard'))}</h1>
    <section class="dn-hero" id="dn-overview">
      <div class="dn-hero-sky" aria-hidden="true"></div>
      ${heroHead(ctx, w, { name })}
      <div class="dn-now${m.phase === 'PRE_LAUNCH' ? ' is-count' : ''}" data-dn-part="now">${lp.parts.now}</div>
      <div class="dn-linkcard" data-dn-part="linkcard">${lp.parts.linkcard}</div>
      ${scene(ctx, w, { ...p, live: lp.parts })}
      <div class="dn-readouts" data-dn-part="chips">${lp.parts.chips}</div>
    </section>
    ${bar(ctx, w, { hasHardware: !!p.hw, hasPictures })}
    ${hasPictures ? picturesPanel(ctx, w, d.cloud) : ''}
    <div class="dn-row is-life">
      <section class="dn-panel dn-life" id="dn-life">
        <header class="dn-sec"><div><p class="dn-eye">${esc(w('Sensors'))} · ${esc(w('read every'))} ${Math.max(1, Math.round(p.air.pollMs / 60000))} ${esc(w('minutes'))}</p><h2>${esc(w('Life support'))}</h2></div><div class="dn-sec-r" data-dn-part="lifestatus">${lp.parts.lifestatus}</div></header>
        <div class="dn-tiles" data-dn-part="air">${lp.parts.air}</div>
      </section>
      ${crewPanel(ctx, w, crewOnShift(ctx, d))}
    </div>
    ${dayPanel(ctx, w, p.rows)}
    <div class="dn-row is-three">
      ${missionPanel(ctx, w, p.mission)}
      ${mealPanel(ctx, w, p.today)}
      <section class="dn-panel dn-energy" id="dn-energy" data-dn-part="energy">${lp.parts.energy}</section>
    </div>
    <div class="dn-row is-two${p.hw ? '' : ' is-solo'}">
      ${resourcesPanel(ctx, w, p.today, d.allDays)}
      ${p.hw ? `<section class="dn-panel dn-hwp" id="dn-hardware" data-dn-part="hw">${lp.parts.hw}</section>` : ''}
    </div>
    ${trendsPanel(ctx, w, trendSeries(ctx, d))}
    <div class="dn-row is-tx">
      ${transmissionsPanel(ctx, w, blogPosts(ctx, d))}
      ${chatPanel(ctx, w)}
    </div>
    <p class="dn-trial"><span>${esc(w('The new dashboard, on trial'))}</span><a href="/dashboard">${esc(w('Back to the current dashboard'))} ${arrow}</a></p>
  </div>`;
  const v = require('../layout').ASSET_V;
  const html = L.page({
    title: 'Live Mission Dashboard', ctx, body, current: '/dashboard', bodyClass: 'landing inner dnext', masthead: false, hideNav: true, hideRail: true,
    head: `<meta name="robots" content="noindex">\n<link rel="stylesheet" href="/next/dashboard-next.css?v=${v}">`,
    scripts: ['/next/dashboard-next.js'],
  });
  // the cookie card's way back: here, not the current dashboard the header marks — by /dashboard-next, a path of one
  // part as /consent takes it (server.js sends it on here)
  return html.replace('<input type="hidden" name="back" value="/dashboard">', '<input type="hidden" name="back" value="/dashboard-next">');
}

/** The parts the page's script swaps in on its beat (public/next/dashboard-next.js, /api/dashboard/next): rendered here as
 *  the page renders them, with a version so an unchanged minute changes nothing on the page. */
function livePartsOf(ctx, w, p) {
  const parts = {
    now: nowCard(ctx, p.rows, w),
    link: linkFigure(ctx, w),
    linkcard: linkFigure(ctx, w, { card: true }),
    chips: chips(ctx, w, p),
    air: lifeTiles(ctx, p.air, p.hw),
    lifestatus: lifeStatus(ctx, p.air, p.hw, w),
    energy: energyBody(ctx, w, p.energy),
    hw: p.hw ? hwBody(ctx, w, p.hw) : '',
  };
  // the light time moves by the second, and the page's script keeps the countdown and the minutes of the activity under
  // way itself: the version leaves them out, so a minute in which nothing else changed swaps nothing
  const { link, linkcard, ...rest } = parts;   // eslint-disable-line no-unused-vars
  const steady = (html) => String(html).replace(/(data-dn-count>)[^<]*/g, '$1').replace(/(data-dn-gone>)[^<]*/g, '$1').replace(/(class="dn-now-bar"><i style="width:)[\d.]+%/g, '$1');
  return { v: hash(JSON.stringify({ ...rest, now: steady(rest.now) })), parts };
}
function live(ctx) {
  ctx = Object.assign(Object.create(Object.getPrototypeOf(ctx)), ctx, { theme: 'dark' });
  const w = wordsFor(ctx);
  const d = { power: safe(() => content.powerLive()), bike: safe(() => content.bike()) };
  const lp = livePartsOf(ctx, w, partsOf(ctx, d));
  return { v: lp.v, phase: ctx.mission.phase, parts: lp.parts };
}

module.exports = { page, live, WORDS };
