'use strict';
/**
 * The landing page: three pages — the habitat (dome.js, sky.js) and the
 * station's name; a note on what MARS is and what this website is for, with a
 * key to the About page (Know more) for the rest; and the world's slowest
 * chat — its welcome, then what becomes of a message written here, in three
 * steps: uplink, transit, downlink. (The mission's two chapters that stood
 * between the note and the chat are gone: the About page tells the mission.)
 * A phone opens on the habitat alone, the whole screen, and has the name at
 * the head of the note (the next page); a wider screen has the name in a band
 * over the habitat. On a phone the chat ends in the door to the composer; on
 * a wider screen the portal and the dashboard follow on the same page
 * (public.js).
 *
 * The words are the handoff's; the figures in them are the station's own: the
 * day the run begins, the distance to Mars and the one-way light-time today,
 * the length of the crossing as the station simulates it (TRANSIT_SECONDS,
 * read the way server.js reads it), the visitor's own callsign on the example
 * message (the one the composer carries), and the hour the crew's
 * communication window opens (WINDOW_TIME, windowWhen), written with the
 * venue's zone as it is on the day the page is read — CEST until the clocks
 * go back on 25 October, CET after — and, for a visitor reading from
 * anywhere, that this is Berlin time.
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
/** When the crew answer, as every page writes it — the hour, the venue's zone as it is that day and, since the portal
    is read from anywhere, whose clock that is: "16:00 CEST (Berlin time)". The ticker (public.js) writes it too. */
function windowWhen(ctx) {
  const m = ctx.mission, T = ctx.T || ((s) => s);
  const zone = zoneName(m.today || m.start_date, m.timezone, ctx.lang || 'en');
  return `${WINDOW_TIME}${zone ? ' ' + zone : ''} (${T('Berlin time')})`;
}

/** A sentence of the dictionary with its live figures put in ({date}, {time}, …), the figures already escaped. */
const fill = (T, key, vals) => Object.entries(vals).reduce((s, [k, v]) => s.split(`{${k}}`).join(v), esc(T(key)));

/** A sheet's label row: its subject, in small capitals (a page's number and name used to stand at its left; none now). */
const meta = (left, right = '', cls = '') => `<div class="sheet-meta${cls ? ' ' + cls : ''}"><span>${left}</span>${right ? `<span>${right}</span>` : ''}</div>`;

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

/* ---------------------------------------------------------------- the note */
/** What MARS is and what this website is for — and, under it, the two doors (Write to the crew, Mission dashboard) and
    the key to the About page, where the mission is told. */
function note(ctx) {
  const T = ctx.T;
  // the first word is the performance's name, set bold, in every language
  const lead = esc(T('MARS is a durational performance in which three crew members are always in the habitat for the thirteen days of the run.')).replace(/^MARS\b/, '<b>MARS</b>');
  return `
  <section class="sheet sheet-p2" id="note" aria-label="${esc(T('Durational performance'))}" data-page>
    ${intro(ctx, 'phone')}
    <div class="note-card">
      ${meta(T('Durational performance'), '', 'is-ruled')}
      <div class="note-body">
        <p class="note-lead">${lead}</p>
        <div class="note-aside">
          <p class="note-more">${T('This website is your portal into the mission: a space to communicate with the astronauts, follow their activities, and observe life inside the habitat throughout the duration of the performance.')}</p>
          <!-- the two doors under the description — to the composer and to the mission dashboard (on a phone held upright
               tabbar.js leads them to the messages page and the dashboard page) — and the key to the About page -->
          <p class="note-cta note-doors">
            <a class="know-more is-write" href="#write"><span>${T('Write to the crew')}</span><span aria-hidden="true">→</span></a>
            <a class="know-more is-dash" href="#mission"><span>${T('Mission dashboard')}</span><span aria-hidden="true">→</span></a>
            <a class="know-more" href="/about"><span>${T('Know more')}</span><span aria-hidden="true">→</span></a>
          </p>
        </div>
      </div>
    </div>
  </section>`;
}

/* ---------------------------------------------------------------- the chat's heading */
/** A part's heading: its name, large and bold; a short orange rule — and its welcome under it. */
function partHead(T, { title, id = '', lead = '' }) {
  return `
    <header class="part-head">
      <h2 class="part-title"${id ? ` id="${id}"` : ''}>${esc(T(title))}</h2>
      <i class="part-rule" aria-hidden="true"></i>${lead ? `\n      <p class="part-lead">${lead}</p>` : ''}
    </header>`;
}

/* ---------------------------------------------------------------- the world's slowest chat */
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
  const T = ctx.T;
  const b = (s) => `<b>${esc(s)}</b>`;
  const km = Math.round(ctx.geo.distanceKm / 1e6);
  const light = orbital.formatLightTime(ctx.geo.lightSeconds);
  const secs = Number(process.env.TRANSIT_SECONDS || 12);
  const crossing = `${secs} ${T(secs === 1 ? 'second' : 'seconds')}`;
  const when = windowWhen(ctx);                                            // "16:00 CEST (Berlin time)"
  const me = ctx.callsign || ctx.offer || '';
  return `
  <section class="sheet sheet-p4" id="slowest-chat" aria-labelledby="ch-03-title" data-page>
    ${partHead(T, { title: 'Welcome to the World’s Slowest Chat', id: 'ch-03-title',
      lead: fill(T, 'Every day at {time}, the Habitat opens its communication window. Come to MARS!platz at Karlsruhe’s Marktplatz or connect through the online portal to speak with the astronauts and discover what is happening inside the Habitat.', { time: esc(when) }) })}
    <ol class="steps" aria-label="${esc(T('How a message reaches the crew'))}">
      <li class="step s-up">
        ${stepHead('up', '01', T('Uplink'))}
        <div class="step-body">
          <h3>${T('Send a message')}</h3>
          <div class="step-card is-earth">${me ? `<span class="step-who">${esc(me)}</span>` : ''}${T('What does it smell like in there?')}</div>
          <p>${T('A message from Earth enters the communications queue. It will take time to reach the crew.')}
            <span class="step-space">${T('Every message goes two ways: to the crew in the Mars habitat — and, by radio, out into space, where it travels on at the speed of light. Tap it on the Message Board to see how far it has come.')}</span></p>
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
          <p>${fill(T, 'At {time}, the communications window opens. Messages from Earth are answered by the crew; answered questions can be seen on the Message Board.', { time: b(when) })}</p>
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
    now: pre ? { meta: T('Now in the habitat'), text: T('The run has not begun yet.') }
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

/* ---------------------------------------------------------------- the nudge under the dome */
/**
 * What stands on the floor under the habitat's ground line now: an arrow
 * pointing down, on its own, that bobs gently, nudging the visitor to scroll
 * on to the pages beneath (public/sky.js hides it once the page has been
 * scrolled). It is a link to the next page, so it works as a key too. The
 * line that used to turn there (underLine, above) is kept for the run, unused.
 */
function scrollNudge(ctx) {
  const T = ctx.T;
  return `
      <a class="dome-nudge" id="dome-nudge" href="#note" aria-label="${esc(T('Scroll down'))}" title="${esc(T('Scroll down'))}">
        <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 4v15"/><path d="M5.5 12.5 12 19l6.5-6.5"/></svg>
      </a>`;
}

module.exports = { intro, note, slowChat, underLine, scrollNudge, WINDOW_TIME, windowWhen, dayMonth, zoneName };
