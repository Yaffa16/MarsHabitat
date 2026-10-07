'use strict';
/**
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
 * ones behind it are dimmed. Beside the rail: the three on shift, the key to
 * the colours, the day's fixed hours — the communication hour and lights
 * out, read off the schedule, not written here — and a line on where the
 * schedule is changed.
 */
const { esc } = require('../layout');
const content = require('../../lib/content');
const officer = require('../../lib/officer');

const ROLES = ['COMMUNICATION OFFICER', 'HEALTH OFFICER', 'SCIENCE OFFICER'];   // the three, in the order of the text sheet

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

/**
 * The section's inner HTML. `today` is data.day(...) for the day shown (null
 * when the station has no day yet); `crew` the crew rows (crew.json, with
 * file, first, last) for the portraits of those on shift.
 */
function solFold(ctx, { today = null, crew = [] } = {}) {
  const T = ctx.T, m = ctx.mission;
  const all = (today && Array.isArray(today.tasks) ? today.tasks : []).filter((t) => t && t.time && t.label);
  const tasks = all.map((t) => ({ ...t, label: shown(t.label), next: null })).filter((t) => t.label);   // the shift changes left out
  // each activity runs to the next entry of the schedule, the shift changes included: the last social hour ends at lights out
  all.forEach((t, i) => { const own = tasks.find((x) => x.time === t.time && x.label === shown(t.label)); if (own) own.next = all[i + 1] ? all[i + 1].time : null; });
  const onShift = content.crewOnShift(m);
  const person = (who) => crew.find((c) => c && c.file && (String(c.file).replace(/\.jpg$/i, '').toLowerCase() === who || String(c.last || '').toLowerCase() === who)) || null;
  const live = m.phase === 'ACTIVE';
  const nowMin = live ? mins(m.venueTime) : null;                                  // the venue's clock, during the run

  // the rail: one row an activity, its time and the time the next entry begins; the last — lights out — stands as the
  // end of the day; during the run the one under way is NOW and the ones behind it are done
  const items = tasks.map((t) => {
    const start = mins(t.time), next = t.next ? mins(t.next) : null;
    const spans = start != null && next != null && next > start;
    const kind = kindOf(t.label);
    const who = kind.role ? onShift[kind.role] : null, p = who ? person(who) : null;
    const now = nowMin != null && start != null && nowMin >= start && (next == null || nowMin < next);
    const done = nowMin != null && next != null && nowMin >= next;
    const cls = ['sol-item', `kind-${kind.key}`, now ? 'is-now' : '', done ? 'is-done' : '', spans ? '' : 'is-end'].filter(Boolean).join(' ');
    return `
        <li class="${cls}">
          <span class="sol-time"><b>${esc(t.time)}</b>${spans ? `<i>–${esc(t.next)}</i>` : ''}</span>
          <span class="sol-bar" aria-hidden="true"></span>
          <span class="sol-what">
            <b class="sol-label">${esc(t.label)}</b>${t.detail ? `<span class="sol-detail">${esc(t.detail)}</span>` : ''}
            ${kind.role ? `<span class="sol-role">${esc(roleName(T, kind.role))}${p ? ` · ${esc(p.first)} ${esc(p.last)}` : ''}</span>` : ''}
          </span>
          <span class="sol-kind">${esc(T(kind.word))}</span>${now ? `<span class="sol-now">${esc(T('NOW'))}</span>` : ''}
        </li>`;
  }).join('');

  // the day's fixed hours, read off the schedule: the communication hour and lights out (the entry that says so, else
  // the day's last)
  const last = tasks[tasks.length - 1];
  const comms = tasks.find((t) => kindOf(t.label).key === 'comms');
  const out = tasks.find((t) => /lights\s*out/i.test(t.label)) || last;
  const fixed = [
    comms ? [T('Communication hour'), comms.time] : null,
    out && out !== comms ? [T('Lights out'), out.time] : null,
  ].filter(Boolean);

  // the three on shift: the portrait and the name where the plan names someone, the role alone where not
  const shift = ROLES.map((role) => {
    const who = onShift[role], p = who ? person(who) : null;
    return `
          <li class="sol-officer${p ? '' : ' is-open'}">
            ${p ? `<img src="/crew/${esc(p.file)}" alt="" width="96" height="144" loading="lazy" decoding="async">` : `<span class="sol-officer-disc" aria-hidden="true">${esc(cap(officer.shown(role)).charAt(0))}</span>`}
            <span class="sol-officer-who"><b>${esc(roleName(T, role))}</b><span>${p ? `${esc(p.first)} ${esc(p.last)}` : T('to be named')}</span></span>
          </li>`;
  }).join('');

  const when = live ? `SOL ${String(m.clampedDay).padStart(2, '0')}${today && today.date ? ` · ${esc(shortDay(today.date))}` : ''}`
    : m.phase === 'PRE_LAUNCH' ? T('The typical sol, as every day of the run is planned') : T('The last sol, as it was planned');
  const kinds = KINDS.map((k) => `<li class="kind-${k.key}"><i aria-hidden="true"></i>${esc(T(k.word))}</li>`).join('');

  return `
  <div class="sol">
    <div class="sol-rail">
      <p class="sol-when">${when}</p>
      ${tasks.length ? `<ol class="sol-list">${items}
      </ol>` : `<p class="note">${T('No schedule filed for today')}</p>`}
    </div>
    <aside class="sol-side">
      <div class="sol-block">
        <div class="eyebrow">${esc(live ? T('Today’s crew') : T('The three roles'))}</div>
        <ul class="sol-shift">${shift}
        </ul>
      </div>
      <div class="sol-block">
        <div class="eyebrow">${esc(T('Key'))}</div>
        <ul class="sol-key">${kinds}</ul>
      </div>
      ${fixed.length ? `<div class="sol-block">
        <div class="eyebrow">${esc(T('Fixed hours'))}</div>
        <dl class="sol-fixed">${fixed.map(([k, v]) => `<div><dt>${esc(k)}</dt><dd>${esc(v)}</dd></div>`).join('')}</dl>
      </div>` : ''}
      <p class="note sol-note">${T('Times are habitat-local. Every sol follows the typical schedule; mission control changes a day on the Habitat tab.')}</p>
    </aside>
  </div>`;
}

/** "Thu 15 Oct" — the station's short day, as the dashboard's strip writes it. */
function shortDay(iso) {
  const d = new Date(String(iso) + 'T12:00:00Z');
  if (isNaN(d.getTime())) return String(iso);
  return d.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short', timeZone: 'UTC' }).replace(',', '');
}

module.exports = { solFold, kindOf, shown, KINDS };
