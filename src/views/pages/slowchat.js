'use strict';
/**
 * "The world's slowest chat": what becomes of a message written here, in four
 * steps — the crew go in, a message leaves Earth, the signal crosses, the crew
 * answer — as the v6 mock-up of the app explains it on its first screen. It
 * follows the habitat on the landing page: on a phone as a column of four
 * steps with a door to the composer at its foot, as the mock-up has it; on a
 * desk as a section of its own between the habitat and the portal — a window
 * high, where the wheel stops (data-stop, public/section-scroll.js) — the four
 * steps in a row and the door at the right of the heading (aura.css;
 * station.css leaves it undrawn without the landing page's dress).
 *
 * The words are the mock-up's; the figures in them are the station's own: the
 * day the run begins (the mission's first day), the distance to Mars and the
 * one-way light-time today (the geometry the portal shows beside the
 * composer), the length of the crossing as the station simulates it
 * (TRANSIT_SECONDS, read the way server.js reads it), the visitor's own
 * callsign on the example message (the one the composer carries); the hour
 * the crew's communication window opens is the production's (WINDOW_TIME),
 * written with the venue's zone as it is on the day the page is read — CEST
 * until the clocks go back on 25 October, CET after.
 */
const { esc } = require('../layout');
const orbital = require('../../lib/orbital');

const ENTRY_TIME = '17:00';                                  // the crew go in at five on the first afternoon (the mock-up's hour)
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

const ICON = {
  entry: '<path d="M2.5 19.5h19"/><path d="M4.5 19.5a7.5 7.5 0 0 1 15 0"/><path d="M10.4 19.5v-2.6a1.6 1.6 0 0 1 3.2 0v2.6"/><path d="M7.2 14.2a5 5 0 0 1 2.3-2.4" style="opacity:.55"/><circle cx="16" cy="15" r=".9" fill="currentColor" stroke="none"/>',
  uplink: '<path d="M4.6 12.8a6 6 0 0 0 8.5 0L4.6 4.3a6 6 0 0 0 0 8.5z"/><path d="M8.8 8.6l3-3"/><circle cx="12.4" cy="5" r="1" fill="currentColor" stroke="none"/><path d="M8 14.5l-1.6 5.5h5"/><path d="M15.5 3.5a4 4 0 0 1 4 4"/><path d="M16 .9a6.8 6.8 0 0 1 6.1 6.1" style="opacity:.55"/>',
  transit: '<circle cx="5" cy="18.5" r="2.6"/><circle cx="19" cy="5.5" r="2.6" fill="currentColor" style="fill-opacity:.18"/><path d="M7.4 16.4C8 10 11 7.2 16.4 6.3" style="stroke-dasharray:1.6 2.6"/><circle cx="11.2" cy="9.4" r="1.2" fill="currentColor" stroke="none"/>',
  downlink: '<path d="M5 4.5h14a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2h-7.5L7 20v-3.5H5a2 2 0 0 1-2-2v-8a2 2 0 0 1 2-2z"/><path d="M12 7.3l.95 2.25 2.25.95-2.25.95L12 13.7l-.95-2.25-2.25-.95 2.25-.95z" fill="currentColor" stroke="none"/>',
};
const icon = (k) => `<span class="slow-ic" aria-hidden="true"><svg viewBox="0 0 24 24">${ICON[k]}</svg></span>`;

function slowestChat(ctx) {
  const T = ctx.T, m = ctx.mission, lang = ctx.lang || 'en';
  const b = (s) => `<b>${esc(s)}</b>`;
  // a sentence of the dictionary with its live figures put in ({range}, {now}, {time})
  const say = (key, vals) => Object.entries(vals).reduce((s, [k, v]) => s.split(`{${k}}`).join(v), esc(T(key)));

  const zone = zoneName(m.start_date, m.timezone, lang);
  const entry = `${dayMonth(m.start_date, lang)} · ${ENTRY_TIME}${zone ? ' ' + zone : ''}`;
  const km = Math.round(ctx.geo.distanceKm / 1e6);
  const secs = Number(process.env.TRANSIT_SECONDS || 12);
  const crossing = `${secs} ${T(secs === 1 ? 'second' : 'seconds')}`;
  const winZone = zoneName(m.today || m.start_date, m.timezone, lang);
  const me = ctx.callsign || ctx.offer || '';

  return `
  <section class="slow-chat" id="slowest-chat" aria-labelledby="slow-chat-title" data-stop>
    <header class="slow-head">
      <span class="slow-eyebrow">CH-09 · ${T('Wait, what is this?')}</span>
      <h2 id="slow-chat-title">${T('The world’s slowest chat.')}</h2>
      <p class="slow-sub">${T('Communicate with the crew.')}</p>
    </header>
    <ol class="slow-steps" aria-label="${esc(T('How a message reaches the crew'))}">
      <li class="slow-step s-entry">
        ${icon('entry')}
        <div class="slow-txt">
          <h3>${T('Habitat entry')}</h3>
          <p class="slow-k">${esc(entry)}</p>
          <p>${T('Three crew members enter the Mars habitat at Marktplatz.')}</p>
        </div>
      </li>
      <li class="slow-step s-uplink">
        ${icon('uplink')}
        <div class="slow-txt">
          <h3>${T('Uplink received')}</h3>
          <div class="slow-bubble is-earth">${me ? `<span class="slow-bk">${esc(me)}</span>` : ''}${T('What does it smell like in there?')}</div>
          <p>${T('A message from Earth enters the communications queue. It will take time to reach the crew.')}</p>
        </div>
      </li>
      <li class="slow-step s-transit">
        ${icon('transit')}
        <div class="slow-txt">
          <h3>${T('Signal in transit')}</h3>
          <p class="slow-route"><span class="slow-earth">${T('Earth')}</span><span class="slow-line" aria-hidden="true"><i></i></span><span class="slow-mars">${T('Mars')} · ${km} ${T('M km')}</span></p>
          <p>${T('The signal is on its way.')} ${say('Under real conditions, a message can take {range} to reach Mars — today it takes {now}.', { range: b(T('4 to 22 minutes')), now: b(orbital.formatLightTime(ctx.geo.lightSeconds)) })}
            ${say('Each chat response will require {range}.', { range: b(T('8 to 44 minutes')) })}
            ${say('For this simulation, the transmission takes {time}.', { time: b(crossing) })}</p>
        </div>
      </li>
      <li class="slow-step s-downlink">
        ${icon('downlink')}
        <div class="slow-txt">
          <h3>${T('Crew response')}</h3>
          <p class="slow-k">${T('Downlink received')}</p>
          <div class="slow-bubble is-crew"><span class="slow-bk">✧ ${T('Crew answer')}</span>${T('Lentils. Mostly lentils.')}</div>
          <p>${say('At {time}, the communications window opens. Messages from Earth are answered by the crew.', { time: b(`${WINDOW_TIME}${winZone ? ' ' + winZone : ''}`) })}</p>
        </div>
      </li>
    </ol>
    <p class="slow-cta"><a class="btn primary masthead-btn slow-write" href="#write">${T('Write to the crew')} <span aria-hidden="true">↓</span></a>
      <a class="btn primary masthead-btn slow-write slow-write-page" href="/messages#write">${T('Write to the crew')} <span aria-hidden="true">→</span></a></p>
  </section>`;
}

module.exports = { slowestChat };
