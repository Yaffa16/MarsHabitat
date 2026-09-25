'use strict';
/**
 * The landing page: four pages — P01 the habitat (dome.js, sky.js) and the
 * station's name; P02 a note on what MARS is and what this website is for;
 * then the two parts of what it is about, each under a heading of its own:
 * part 1, P03, the mission in two chapters, three astronauts landing on Mars
 * and life on Mars as the experiment; part 2, P04, the world's slowest chat —
 * its welcome, then what becomes of a message written here, in three steps:
 * uplink, transit, downlink. A phone opens on the habitat alone, the whole
 * screen, and has the name at the head of the note (the next page); a wider
 * screen has the name in a band over the habitat. On a phone P04 ends in the
 * door to the composer; on a wider screen the portal and the dashboard follow
 * on the same page (public.js).
 *
 * The words are the handoff's; the figures in them are the station's own: the
 * day the run begins, the distance to Mars and the one-way light-time today,
 * the length of the crossing as the station simulates it (TRANSIT_SECONDS,
 * read the way server.js reads it), the visitor's own callsign on the example
 * message (the one the composer carries), and the hour the crew's
 * communication window opens (WINDOW_TIME), written with the venue's zone as
 * it is on the day the page is read — CEST until the clocks go back on 25
 * October, CET after.
 *
 * Also the line under the dome (underLine): it turns every few seconds
 * through what is happening in the habitat now, the signal's time and the
 * habitat's reading, a few older exchanges and the last answered ones — never
 * a message still waiting for mission control or one it turned down.
 */
const { esc } = require('../layout');
const orbital = require('../../lib/orbital');
const { stamp, responder } = require('./sky');

const WINDOW_TIME = '16:00';                                 // the crew answer from four in the afternoon, every day of the run
const LOCALE = { en: 'en-GB', de: 'de-DE', fr: 'fr-FR' };

/** "15 October", "15. Oktober", "15 octobre". */
function dayMonth(iso, lang) {
  try { return new Date(iso + 'T12:00:00Z').toLocaleDateString(LOCALE[lang] || 'en-GB', { day: 'numeric', month: 'long', timeZone: 'UTC' }); }
  catch { return iso; }
}
/** The venue's zone on that day, as it is written there: CEST (MESZ in German) through the run. */
function zoneName(iso, tz, lang) {
  try {
    const p = new Intl.DateTimeFormat(lang === 'de' ? 'de-DE' : 'en-GB', { timeZone: tz, timeZoneName: 'short' })
      .formatToParts(new Date(iso + 'T12:00:00Z')).find((x) => x.type === 'timeZoneName');
    return p ? p.value : '';
  } catch { return ''; }
}

/** A sentence of the dictionary with its live figures put in ({date}, {time}, …), the figures already escaped. */
const fill = (T, key, vals) => Object.entries(vals).reduce((s, [k, v]) => s.split(`{${k}}`).join(v), esc(T(key)));

/** A sheet's label row: the page's number and name at the left, its subject at the right. */
const meta = (left, right, cls = '') => `<div class="sheet-meta${cls ? ' ' + cls : ''}"><span>${left}</span><span>${right}</span></div>`;

/* ---------------------------------------------------------------- P01 */
/** The station's name, the line under it and the run — over the habitat on a wider screen (`desk`), at the head of the
    note on a phone, where the habitat has the first screen to itself (`phone`); each is drawn where it is shown, and the
    other is not drawn at all (sheet.css). */
function intro(ctx, where = 'desk') {
  const T = ctx.T, m = ctx.mission;
  const pre = m.phase === 'PRE_LAUNCH', n = m.daysUntilStart;
  const now = pre ? `${T('opens in')} ${n} ${T(n === 1 ? 'day' : 'days')}`
    : m.phase === 'ACTIVE' ? `SOL ${String(m.clampedDay).padStart(2, '0')} ${T('of')} ${m.totalDays}` : T('Mission complete');
  const H = where === 'desk' ? 'h1' : 'p';                            // one heading for the page: the name over the habitat
  return `
    <div class="sheet-intro is-${where}">
      <${H} class="wordmark">MARS<span class="bang">!</span>platz</${H}>
      <p class="tagline">${T('Communication Station')} · <b>ZKM | Hertzlab</b></p>
      <p class="run-dates"><b>${esc(m.runLabel)}</b> · ${m.totalDays} ${T('sols in the habitat')} · <span class="run-now">${now}</span></p>
    </div>`;
}

/* ---------------------------------------------------------------- P02 */
function note(ctx) {
  const T = ctx.T;
  // the first word is the performance's name, set bold, in every language
  const lead = esc(T('MARS is a durational performance in which three officers live inside the habitat for thirteen consecutive days.')).replace(/^MARS\b/, '<b>MARS</b>');
  return `
  <section class="sheet sheet-p2" id="note" aria-label="${esc(T('Durational performance'))}" data-page>
    ${intro(ctx, 'phone')}
    <div class="note-card">
      ${meta(`P02 / 04 · ${T('Note 00')}`, T('Durational performance'), 'is-ruled')}
      <div class="note-body">
        <p class="note-lead">${lead}</p>
        <p class="note-more">${T('This website is your portal into the mission: a space to communicate with the astronauts, follow their activities, and observe life inside the habitat throughout the duration of the performance.')}</p>
      </div>
    </div>
  </section>`;
}

/* ---------------------------------------------------------------- P03, P04: the two parts */
/** A part's heading: its page in small capitals and which of the two parts it is in an orange pill; its name, large and
    bold; a short orange rule — and, for the chat, its welcome under it. The two parts are the two things the page is about. */
function partHead(T, { page, part, title, id = '', lead = '' }) {
  return `
    <header class="part-head">
      <span class="part-tag"><span>${page} / 04</span><b>${T(part)}</b></span>
      <h2 class="part-title"${id ? ` id="${id}"` : ''}>${esc(T(title))}</h2>
      <i class="part-rule" aria-hidden="true"></i>${lead ? `\n      <p class="part-lead">${lead}</p>` : ''}
    </header>`;
}

/* A chapter: the photograph with a Mars-orange glow behind it and the chapter's subjects beside it, then its number, its
   title, a short orange rule and the text; chapters take turns left and right on a wider screen. */
function chapter(T, { id, n, side, img, alt, title, tags = [], body }) {
  return `
    <article class="chapter is-${side}" id="${id}" aria-labelledby="${id}-title">
      <div class="ch-media">
        <i class="ch-glow" aria-hidden="true"></i>
        <figure class="ch-photo"><img src="${img}" alt="${esc(T(alt))}" loading="lazy" decoding="async"></figure>
        ${tags.length ? `<ul class="ch-tags">${tags.map((t) => `<li>${esc(T(t))}</li>`).join('')}</ul>` : ''}
      </div>
      <div class="ch-text">
        <span class="ch-n" aria-hidden="true">${n}</span>
        <h3 id="${id}-title">${esc(T(title))}</h3>
        <i class="ch-rule" aria-hidden="true"></i>
        <p>${body}</p>
      </div>
    </article>`;
}

function chapters(ctx) {
  const T = ctx.T, m = ctx.mission, lang = ctx.lang || 'en';
  return `
  <section class="sheet sheet-p3" id="story" aria-labelledby="part-1-title" data-page>
    ${partHead(T, { page: 'P03', part: 'Part 1 of 2', title: 'The mission', id: 'part-1-title' })}
    <div class="chapters">${chapter(T, {
      id: 'ch-01', n: '01', side: 'left', img: '/mission/mission-01.jpg', alt: 'An astronaut shading their eyes in front of the golden habitat',
      title: 'Three astronauts land on Mars', tags: ['Commanding officer', 'Science officer', 'Health officer'],
      body: fill(T, 'On {date}, three astronauts enter the Habitat at MARS!platz: a Commanding Officer, a Science Officer and a Health Officer. Life on Mars becomes the experiment.', { date: esc(dayMonth(m.start_date, lang)) }),
    })}${chapter(T, {
      id: 'ch-02', n: '02', side: 'right', img: '/mission/mission-02.jpg', alt: 'An astronaut in red light at the habitat’s foil wall',
      title: 'Life on Mars becomes the experiment', tags: ['Food & growing', 'Resources', 'Mental health', 'Governance'],
      body: esc(T('Inside the Habitat, the crew lives under the conditions of a long-duration mission: isolation, limited space and resources. Each day brings new experiments — from growing food to resource management, EVAs, mental health, governance and understanding how people live together in an unfamiliar environment.')),
    })}
    </div>
  </section>`;
}

/* ---------------------------------------------------------------- P04: the world's slowest chat */
/* The three steps' signs, line drawings in the hand of the habitat's keys: the dish sending the message up, the signal on
   its arc from Earth to Mars, the crew's answer as a speech bubble with a spark in it. */
const ICON = {
  up: '<path d="M4.6 12.8a6 6 0 0 0 8.5 0L4.6 4.3a6 6 0 0 0 0 8.5z"/><path d="M8.8 8.6l3-3"/><circle cx="12.4" cy="5" r="1" fill="currentColor" stroke="none"/><path d="M8 14.5l-1.6 5.5h5"/><path d="M15.5 3.5a4 4 0 0 1 4 4"/><path d="M16 .9a6.8 6.8 0 0 1 6.1 6.1" style="opacity:.55"/>',
  transit: '<circle cx="5" cy="18.5" r="2.6"/><circle cx="19" cy="5.5" r="2.6" fill="currentColor" style="fill-opacity:.18"/><path d="M7.4 16.4C8 10 11 7.2 16.4 6.3" style="stroke-dasharray:1.6 2.6"/><circle cx="11.2" cy="9.4" r="1.2" fill="currentColor" stroke="none"/>',
  down: '<path d="M5 4.5h14a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2h-7.5L7 20v-3.5H5a2 2 0 0 1-2-2v-8a2 2 0 0 1 2-2z"/><path d="M12 7.3l.95 2.25 2.25.95-2.25.95L12 13.7l-.95-2.25-2.25-.95 2.25-.95z" fill="currentColor" stroke="none"/>',
};
/** A step's head: its sign in a small tinted disc, its number and its name. */
const stepHead = (k, n, name) => `<div class="step-k"><span class="step-ic" aria-hidden="true"><svg viewBox="0 0 24 24">${ICON[k]}</svg></span><span class="step-l"><b>${n}</b>${name}</span></div>`;

function slowChat(ctx) {
  const T = ctx.T, m = ctx.mission, lang = ctx.lang || 'en';
  const b = (s) => `<b>${esc(s)}</b>`;
  const km = Math.round(ctx.geo.distanceKm / 1e6);
  const light = orbital.formatLightTime(ctx.geo.lightSeconds);
  const secs = Number(process.env.TRANSIT_SECONDS || 12);
  const crossing = `${secs} ${T(secs === 1 ? 'second' : 'seconds')}`;
  const winZone = zoneName(m.today || m.start_date, m.timezone, lang);
  const me = ctx.callsign || ctx.offer || '';
  return `
  <section class="sheet sheet-p4" id="slowest-chat" aria-labelledby="ch-03-title" data-page>
    ${partHead(T, { page: 'P04', part: 'Part 2 of 2', title: 'Welcome to the World’s Slowest Chat', id: 'ch-03-title',
      lead: fill(T, 'Every day at {time}, the Habitat opens its communication window. Come to MARS!platz at Karlsruhe’s Marktplatz or connect through the online portal to speak with the astronauts and discover what is happening inside the Habitat.', { time: esc(WINDOW_TIME) }) })}
    <ol class="steps" aria-label="${esc(T('How a message reaches the crew'))}">
      <li class="step s-up">
        ${stepHead('up', '01', T('Uplink'))}
        <div class="step-body">
          <h3>${T('Send a message')}</h3>
          <div class="step-card is-earth">${me ? `<span class="step-who">${esc(me)}</span>` : ''}${T('What does it smell like in there?')}</div>
          <p>${T('A message from Earth enters the communications queue. It will take time to reach the crew.')}</p>
        </div>
      </li>
      <li class="step s-transit">
        ${stepHead('transit', '02', T('Transit'))}
        <div class="step-body">
          <h3>${T('Signal in transit')}</h3>
          <div class="transit" aria-hidden="true" data-seconds="${secs}"><span class="transit-earth">${T('Earth')}</span><span class="transit-track"><i style="animation-duration:${secs}s"></i></span><span class="transit-mars">${T('Mars')}</span></div>
          <p class="transit-meta">${km} ${T('M km')} · ${esc(light)}</p>
          <p>${T('The signal is on its way.')} ${fill(T, 'Under real conditions, a message can take {range} to reach Mars — today it takes {now}.', { range: b(T('4 to 22 minutes')), now: b(light) })}
            ${fill(T, 'Each chat response will require {range}.', { range: b(T('8 to 44 minutes')) })}
            ${fill(T, 'For this simulation, the transmission takes {time}.', { time: b(crossing) })}</p>
        </div>
      </li>
      <li class="step s-down">
        ${stepHead('down', '03', T('Downlink'))}
        <div class="step-body">
          <h3>${T('Crew response')}</h3>
          <p class="step-flag">${T('Downlink received')}</p>
          <div class="step-card is-crew"><span class="step-who">${T('Crew answer')}</span>${T('Lentils. Mostly lentils.')}</div>
          <p>${fill(T, 'At {time}, the communications window opens. Messages from Earth are answered by the crew.', { time: b(`${WINDOW_TIME}${winZone ? ' ' + winZone : ''}`) })}</p>
        </div>
      </li>
    </ol>
    <p class="p4-cta"><a class="sheet-cta" href="/messages#write"><span>${T('Write to the crew')}</span><span aria-hidden="true">→</span></a></p>
  </section>`;
}

/* ---------------------------------------------------------------- the line under the dome */
const shuffle = (a) => { a = a.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
const clip = (t, n = 140) => { t = String(t || '').replace(/\s+/g, ' ').trim(); return t.length > n ? t.slice(0, n - 1).trimEnd() + '…' : t; };

/**
 * What the line under the dome takes turns through, as a JSON block and the
 * first of it drawn in place (public/sky.js turns it every six seconds): what
 * the crew are doing now; the signal's one-way time; the habitat's latest
 * reading (the header's running line has it); the sol, or
 * the countdown before the run; the last three answered exchanges, question
 * then answer; and a few older published messages, picked afresh for every
 * page. Only published exchanges are ever in it.
 */
function underLine(ctx, { recent = [], today = null } = {}) {
  const T = ctx.T, m = ctx.mission, g = ctx.geo, tz = m.timezone;
  const pre = m.phase === 'PRE_LAUNCH', over = m.phase === 'COMPLETE';
  // what the crew are doing at this minute, as the header's running line says it (public.js, ticker)
  const hm = String(m.venueTime || '').slice(0, 5);
  let task = null;
  for (const t of (today && today.tasks) || []) if (t.time <= hm) task = t;
  const doing = task ? `${task.time} · ${task.label}${task.detail ? ` — ${task.detail}` : ''}` : T('off the schedule');
  const pub = recent.filter((x) => x.state === 'PUBLISHED');
  const answered = pub.filter((x) => x.response_body)
    .sort((a, b) => String(b.response_at || b.submitted_at).localeCompare(String(a.response_at || a.submitted_at))).slice(0, 3);
  const older = shuffle(pub.filter((x) => !answered.includes(x))).slice(0, 4);
  const q = (x) => ({ id: x.id, meta: [x.callsign, stamp(x.submitted_at, tz)].filter(Boolean).join(' · '), text: clip(x.body) });
  const a = (x) => ({ id: x.id, meta: ['✧ ' + responder(x, T), stamp(x.response_at, tz)].filter(Boolean).join(' · '), text: clip(x.response_body), crew: 1 });
  const left = m.totalDays - m.clampedDay;
  const pool = {
    now: pre ? { meta: T('Now in the habitat'), text: T('Hatch not yet sealed.') }
      : over ? { meta: T('Now in the habitat'), text: T('Mission complete') }
        : { meta: T('Now in the habitat'), live: 'tk-now', text: doing },
    data: [
      { meta: T('One-way signal'), text: `${orbital.formatLightTime(g.lightSeconds)} ${T('at the speed of light')}` },
      { meta: T('Habitat reading'), live: 'tk-hab', text: '' },
      pre ? { meta: T('Countdown'), live: 'tk-count', text: `T−${m.countdown.days}d`, after: T('to occupation') }
        : over ? { meta: `SOL ${m.totalDays}/${m.totalDays}`, text: T('Mission complete') }
          : { meta: `SOL ${String(m.clampedDay).padStart(2, '0')}/${String(m.totalDays).padStart(2, '0')}`,
            text: left > 0 ? `${T('Sol')} ${m.clampedDay} ${T('of')} ${m.totalDays} · ${left} ${T(left === 1 ? 'sol to go' : 'sols to go')}` : `${T('Sol')} ${m.clampedDay} ${T('of')} ${m.totalDays} · ${T('the last day')}` },
    ],
    ex: answered.map((x) => [q(x), a(x)]),
    old: older.map(q),
  };
  const first = pool.now;                                     // the line opens with what is happening now
  const json = JSON.stringify(pool).replace(/</g, '\\u003c');
  return `
      <div class="hab-line" id="hab-line">
        <p class="hab-line-item"><span class="hab-line-meta">${esc(first.meta)}</span><span class="hab-line-text">${esc(first.text)}</span></p>
        <script type="application/json" id="hab-line-data">${json}</script>
      </div>`;
}

module.exports = { intro, note, chapters, slowChat, underLine, WINDOW_TIME, dayMonth, zoneName };
