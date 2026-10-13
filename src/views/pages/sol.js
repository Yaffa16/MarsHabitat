'use strict';
/**
 * (12 October: "from About remove A sol on MARS!platz", then "remove Current Crew from About" — both are gone from the
 * About page, info.js; solFold, crewBox and crewWhen below are kept, unused, should the run want them back. What this
 * file serves now is the landing page's Current Crew — crewList and crewWhenParts — and the crew's portraits, CREW, for
 * the landing page and the About page's Who we are.)
 *
 * A sol on MARS!platz — the About page's section under What's inside the
 * habitat? (October, 7 October: "add a part: A sol on MARS!platz … depending
 * on the daily shift, a very sensible design of the daily activities"): the
 * day in the habitat as the schedule plans it, activity by activity, from
 * breakfast to lights out.
 *
 * The day is the one the dashboard's Today's Schedule shows — the current
 * sol during the run (data.day: the task table, filled from
 * content/schedule.json and edited on the Habitat tab), the first sol before
 * it (every day ships with the typical schedule) and the last after. The
 * activities stand on a rail, one row each, whatever their length (October:
 * "not by hour, by activity"), each with its times and in the colour of its
 * kind, read off its words (kindOf): science blocks in cobalt, EVAs and the
 * communication hour in Mars (the hour the public speaks to the crew),
 * health and movement in green, meals and their preparation in amber, social
 * and personal time in grey. The schedule's shift changes are not shown
 * (October: "do not have shift change anywhere"): an entry that is only the
 * shift change is left out, and one that carries it with something else —
 * "Shift Change / Lights Out" — shows the something else. Where an activity belongs to one
 * officer — the science blocks to the Science Officer, health and movement to
 * the Health Officer, the communication hour to the Commanding Officer — it
 * says so, with the name of the person on shift that day when the shift plan
 * names one (content/shifts.json, content.crewOnShift — the day's crew from
 * 08:00 at the venue). During the run the activity under way is marked NOW
 * — the one whose span holds the venue's clock (mission.venueTime) — and the
 * ones behind it are dimmed. Since 12 October each activity stands once and
 * without its hours, and nothing stands beside the rail (solFold, below).
 */
const { esc } = require('../layout');
const content = require('../../lib/content');
const officer = require('../../lib/officer');
const missionLib = require('../../lib/mission');

const ROLES = ['COMMUNICATION OFFICER', 'HEALTH OFFICER', 'SCIENCE OFFICER'];   // the three, in the order of the text sheet

/* The crew's portraits — public/crew, made by tools/crew-pictures.py from the photographs in public/Astronaut_Pictures
   (Firstname_Lastname.png — 300 × 450 since 13 October): one picture per person at the photograph's size, 800 × 1200 at
   the most, and crew.json, the people in the order of their
   surnames with the two names as the file names give them, then the crew with one name (the habitat's robot dog,
   Robodog). Read here once at start: the About page (info.js — Who we are) and the landing page's second page
   (landing.js — Current Crew over the two calls) show them. */
const CREW = (() => {
  try { return JSON.parse(require('fs').readFileSync(require('path').join(__dirname, '../../../public/crew/crew.json'), 'utf8')).filter((x) => x && x.file && (x.last || x.first)); }
  catch { return []; }
})();

/* The kinds, in the order the key lists them; each with the officer it belongs to, where it belongs to one. The words
   are matched on the activity's label — "Science Block 2 / Hot Water Prep with Bike" is science, "EVA (Extra Vehicular
   Activity) / Science Block 3" an EVA: the first of the day's two names wins, and the order below decides where both
   stand in one. */
const KINDS = [
  { key: 'science', word: 'Science', role: 'SCIENCE OFFICER', test: /science/i },
  { key: 'eva', word: 'EVA', role: null, test: /\bEVA\b|extra vehicular/i },
  { key: 'comms', word: 'Communication', role: 'COMMUNICATION OFFICER', test: /communication|report writing/i },
  { key: 'health', word: 'Health', role: 'HEALTH OFFICER', test: /mental health|movement|health|exercise/i },
  { key: 'meal', word: 'Meals', role: null, test: /breakfast|lunch|dinner|kaffee|kuchen|meal|washing up|prep\b|cooking/i },
  { key: 'social', word: 'Social', role: null, test: /social|personal|free time|rest/i },
];
const SHIFT = /shift\s*change/i;                                                 // never shown (October)
/** The label without its shift change: "Shift Change / Lights Out" → "Lights Out"; "Shift Change" alone → "" (left out). */
function shown(label) {
  return String(label || '').split(/\s*\/\s*/).filter((part) => part && !SHIFT.test(part)).join(' / ').trim();
}
const OTHER = { key: 'other', word: 'Other', role: null };

/** The kind an activity is, from its words: the kind whose words come first in the label wins ("EVA / Science Block 3"
    is an EVA, "Science Block 2 / Hot Water Prep" is science); none of them, Other. */
function kindOf(label) {
  const s = String(label || '');
  let best = null, at = Infinity;
  for (const k of KINDS) {
    const m = s.match(k.test);
    if (m && m.index < at) { best = k; at = m.index; }
  }
  return best || OTHER;
}

const mins = (hhmm) => { const m = /^(\d{1,2}):(\d{2})/.exec(String(hhmm || '')); return m ? Number(m[1]) * 60 + Number(m[2]) : null; };
const cap = (s) => { s = String(s || ''); return s.charAt(0).toUpperCase() + s.slice(1).toLowerCase(); };

/** The role as the page names it, in the visitor's language: "Commanding officer" → T → Kommandantin. */
const roleName = (T, role) => T(cap(officer.shown(role)));

/* Who a name in the shift plan is (content/shifts.json): the member of the crew whose portrait it names — by the
   picture's file (vlaminck-maurer, kloeck) or the surname, else the one first name, in any case — or someone the station
   has no portrait of yet, by the name as written ("Laura B."), shown with the habitat's robot dog's picture (12 October:
   "for any photos that do not exist, show the robot dog"). `{ name, file, photo }`; null for nobody. */
const ROBODOG = 'robodog.jpg';
function personOf(crew, who) {
  const w = String(who || '').trim();
  if (!w) return null;
  const k = w.toLowerCase();
  const people = (crew || []).filter((c) => c && c.file && c.last);
  const c = people.find((x) => String(x.file).replace(/\.jpg$/i, '').toLowerCase() === k || String(x.last).toLowerCase() === k)
    || (() => { const f = people.filter((x) => String(x.first || '').toLowerCase() === k); return f.length === 1 ? f[0] : null; })();
  return c ? { name: `${c.first} ${c.last}`.trim(), file: c.file, photo: true } : { name: w, file: ROBODOG, photo: false };
}

/**
 * The section's inner HTML. `today` is data.day(...) for the day shown (null
 * when the station has no day yet); `crew` the crew rows (crew.json, with
 * file, first, last) for the names of those on shift.
 *
 * 12 October ("remove repeating things — just have the activity irrespective
 * of the hour; remove the note, the keys, the tabs on the right column"): the
 * day's activities, each once and without its hours — an entry that carries
 * on the one before it (the same first activity: EVA / Science Block 3 twice
 * over, Science Block 2 and then Science Block 2 / Hot Water Prep with Bike)
 * is folded into it, and one already on the list is not shown again — on the
 * rail in the colours of their kinds, alone across the section: no word for
 * the kind at the row's end, and no crew, key, fixed hours or note beside it
 * (the crew stand just above it, in Current Crew). The hours still decide which activity is under way
 * during the run (NOW) and which are behind it; they are no longer shown.
 */
function solFold(ctx, { today = null, crew = [] } = {}) {
  const T = ctx.T, m = ctx.mission;
  const all = (today && Array.isArray(today.tasks) ? today.tasks : []).filter((t) => t && t.time && t.label);
  // each entry runs to the next one of the schedule, the shift changes included: the last social hour ends at lights out
  const entries = all.map((t, i) => ({ label: shown(t.label), detail: t.detail || '', start: mins(t.time), next: all[i + 1] ? mins(all[i + 1].time) : null }));
  const same = (a, b) => String(a).toLowerCase() === String(b).toLowerCase();
  const rows = [];
  for (const e of entries) {
    if (!e.label) continue;                                                       // a shift change alone: never shown
    const parts = e.label.split(/\s*\/\s*/).filter(Boolean);
    const prev = rows[rows.length - 1];
    if (prev && same(prev.parts[0], parts[0])) {                                  // carries on the activity before it
      for (const x of parts) if (!prev.parts.some((y) => same(y, x))) prev.parts.push(x);
      prev.spans.push([e.start, e.next]);
      if (!prev.detail && e.detail) prev.detail = e.detail;
      continue;
    }
    const seen = rows.find((r) => r.parts.length === parts.length && r.parts.every((y, i) => same(y, parts[i])));
    if (seen) { seen.spans.push([e.start, e.next]); continue; }                 // on the list already
    rows.push({ parts, detail: e.detail, spans: [[e.start, e.next]] });
  }
  const onShift = content.crewOnShift(m);
  const person = (who) => personOf(crew, who);
  const live = m.phase === 'ACTIVE';
  const nowMin = live ? mins(m.venueTime) : null;                                  // the venue's clock, during the run

  // the rail: one row an activity; the last — lights out — stands as the end of the day; during the run the one under
  // way is NOW and the ones behind it are done
  const items = rows.map((r) => {
    const label = r.parts.join(' / ');
    const kind = kindOf(label);
    const who = kind.role ? onShift[kind.role] : null, p = who ? person(who) : null;
    const isEnd = r.spans.every(([s, n]) => !(s != null && n != null && n > s));
    const now = nowMin != null && r.spans.some(([s, n]) => s != null && nowMin >= s && (n == null || nowMin < n));
    const done = nowMin != null && !now && r.spans.every(([, n]) => n != null && nowMin >= n);
    const cls = ['sol-item', `kind-${kind.key}`, now ? 'is-now' : '', done ? 'is-done' : '', isEnd ? 'is-end' : ''].filter(Boolean).join(' ');
    return `
        <li class="${cls}">
          <span class="sol-bar" aria-hidden="true"></span>
          <span class="sol-what">
            <b class="sol-label">${esc(label)}${now ? ` <span class="sol-now">${esc(T('NOW'))}</span>` : ''}</b>${r.detail ? `<span class="sol-detail">${esc(r.detail)}</span>` : ''}
            ${kind.role ? `<span class="sol-role">${esc(roleName(T, kind.role))}${p ? ` · ${esc(p.name)}` : ''}</span>` : ''}
          </span>
        </li>`;
  }).join('');

  const when = live ? `SOL ${String(m.clampedDay).padStart(2, '0')}${today && today.date ? ` · ${esc(shortDay(today.date))}` : ''}`
    : m.phase === 'PRE_LAUNCH' ? T('The typical sol, as every day of the run is planned') : T('The last sol, as it was planned');

  return `
  <div class="sol">
    <div class="sol-rail">
      <p class="sol-when">${when}</p>
      ${rows.length ? `<ol class="sol-list">${items}
      </ol>` : `<p class="note">${T('No schedule filed for today')}</p>`}
    </div>
  </div>`;
}

/**
 * Current Crew — on the landing page over the two calls (landing.js). It began on the About page (12 October: "add a
 * title, Current Crew: in it show the Three Roles box from A sol on MARS!platz, without the key; instead of the C, H, S
 * display the photo of the astronaut according to who is in there that day and in what role; for any photos that do not
 * exist show the robot dog"), at the top, then above A sol on MARS!platz, then between the habitat and Who we are — and
 * went from there the same day ("remove Current Crew from About"): the three roles, each with the photograph of the astronaut the shift plan puts in it for the day
 * `onShift` holds (content.crewNow — before the run the first day's) and their name; the robot dog's picture for someone
 * the station has no portrait of, and for a role the plan names nobody in (then "to be named"). crewList is the three;
 * crewBox, the About page's box of them under its eyebrow while it was there — three across on a desk, one under the
 * other on a phone (aura.css, .crew-now) — unused now. The pictures load as they come near (loading="lazy"). They are the
 * round pictures' own close-ups, public/crew/face/<file> (12 October: "when the images are shown as icons, it scales
 * weirdly" — one square cut of every photograph had put each face elsewhere): each cut round its face, every face the
 * same size at the same height, square — 400 × 400 at the most, some 200–250 px from the 300 × 450 photographs of 13
 * October (tools/crew-pictures.py, FACES; the width and height below give the shape alone).
 */
function crewList(ctx, { crew = [], onShift = {} } = {}) {
  const T = ctx.T;
  // a name too long for its line breaks between the names, never inside one: Matthieu / Vlaminck-Maurer, not at the hyphen
  const named = (n) => { const i = n.lastIndexOf(' '); return i < 0 ? `<span class="nb">${esc(n)}</span>` : `${esc(n.slice(0, i))} <span class="nb">${esc(n.slice(i + 1))}</span>`; };
  const items = ROLES.map((role) => {
    const p = personOf(crew, onShift[role]);
    return `
        <li class="crew-now-officer${p ? (p.photo ? '' : ' is-robodog') : ' is-robodog is-open'}">
          <img src="/crew/face/${esc(p ? p.file : ROBODOG)}" alt="" width="400" height="400" loading="lazy" decoding="async">
          <span class="sol-officer-who"><b>${esc(roleName(T, role))}</b><span>${p ? named(p.name) : esc(T('to be named'))}</span></span>
        </li>`;
  }).join('');
  return `
    <ul class="crew-now-list">${items}
    </ul>`;
}
function crewBox(ctx, opts = {}) {
  return `
  <div class="crew-now">
    <div class="eyebrow">${esc(ctx.T('The three roles'))}</div>${crewList(ctx, opts)}
  </div>`;
}

/** Whose crew Current Crew shows: before the run the first day's, during it the shift's (from 08:00 at the venue), after
    it the last day's (`now`: content.crewNow) — said by its sol and date alone, "SOL 01 · Thu 15 Oct" (12 October: "from
    the Current Crew remove: The first day’s crew" — the words that stood before it, The first day’s crew, In the habitat
    now, The last day’s crew, went all three). crewWhen was the line under the title on the About page (unused since
    Current Crew went from there); the landing page sets it over its title (crewWhenParts: `day`, the sol and its date — '' while the plan names nobody, and then `what`,
    The crew is not named yet). */
function crewWhenParts(ctx, now) {
  if (!now || now.day == null) return { what: ctx.T('The crew is not named yet'), day: '' };
  return { what: '', day: `SOL ${String(now.day).padStart(2, '0')} · ${shortDay(missionLib.dateForDay(now.day))}` };
}
function crewWhen(ctx, now) {
  const w = crewWhenParts(ctx, now);
  return w.day || w.what;
}

/** "Thu 15 Oct" — the station's short day, as the dashboard's strip writes it. */
function shortDay(iso) {
  const d = new Date(String(iso) + 'T12:00:00Z');
  if (isNaN(d.getTime())) return String(iso);
  return d.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short', timeZone: 'UTC' }).replace(',', '');
}

module.exports = { solFold, crewBox, crewList, crewWhen, crewWhenParts, personOf, shortDay, kindOf, shown, KINDS, ROLES, CREW };
