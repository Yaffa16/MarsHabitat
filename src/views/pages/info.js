'use strict';
const L = require('../layout');
const { esc, panel, eyebrow, pipeline } = L;
const orbital = require('../../lib/orbital');
const officer = require('../../lib/officer');

/**
 * The project, the station's behaviour and the credits — About, What this is
 * and Who we are — as one page of their own, /about (aboutPage, below): the
 * About key on a phone's bar of keys and the rows of the ticker's menu lead
 * there, each row to its section.
 */

const CREDITS = [
  ['Concept and direction', 'To be credited'],
  ['Performance', 'Three performers, credited after the run'],
  ['Scenography and habitat', 'To be credited'],
  ['Sound', 'To be credited'],
  ['Sensor systems and software', 'To be credited'],
  ['Production', 'ZKM | Hertzlab'],
  ['Technical direction', 'To be credited'],
];

/* The prose is written in English and carried, paragraph by paragraph, in
   src/lib/i18n.js — one key per paragraph, so a paragraph can be reworded
   in one language without touching the other two. */
const p = (T, text) => `<p>${T(text)}</p>`;

function aboutFold(ctx) {
  const T = ctx.T;
  const n = ctx.mission.totalDays;
  return `
  <div class="grid g-hero">
    <div class="prose">
      <h3>${T('The habitat')}</h3>
      ${p(T, 'MARS is a durational performance. For the length of the mission the crew do not leave the habitat. They follow a schedule, eat what has been planned for them, work through a set of tasks, and draw down a finite inventory. Visitors to the exhibition can see the habitat from outside. What they cannot do is walk in and talk to the people inside it.')}
      ${p(T, 'The sensors that produce the readings on this page are mounted in that structure. When the habitat warms up because a room full of people is standing around it, the number moves. The data is not a simulation of a Mars habitat; it is a measurement of a real enclosed space with three people in it.')}

      <h3>${T('Distance as the material')}</h3>
      ${p(T, 'Networked communication is built to remove distance. A message is written and delivered in the same breath, and the gap between two people becomes invisible. That invisibility is the thing this piece takes apart.')}
      ${p(T, 'Here a message has to travel. You watch it go. You wait. It is read by someone who decides whether it goes further. A reply is written and comes back the other way. The exchange that a messaging app would have completed in under a second is stretched out until you can feel its shape — and the number in the rail above reminds you that the real crossing is longer still.')}
      ${p(T, 'The delay is not friction added for effect. It is the subject.')}

      <h3>${T('The archive as the work')}</h3>
      ${p(T, 'Every published exchange stays here. Over the run the archive accumulates into something neither the artists nor the audience wrote alone: a record of what people on Earth wanted to ask three strangers in a sealed room, and how those questions shifted as the mission went on.')}

      <h3>Hertzlab</h3>
      ${p(T, 'Hertzlab is the research and production laboratory of the ZKM | Center for Art and Media Karlsruhe, working across performance, sound, media technology and installation. MARS is produced within that context, and this station was built as part of the production rather than as documentation of it.')}
    </div>
    <div>
      ${panel('CH-41 / MISSION', `
        ${eyebrow(T('This mission'))}
        <dl class="kv">
          <dt>${T('DESIGNATION')}</dt><dd>${esc(ctx.mission.name)}</dd>
          <dt>${T('RUN')}</dt><dd>${esc(ctx.mission.runLabelLong)}</dd>
          <dt>${T('START')}</dt><dd>${esc(ctx.mission.startLabel)} · ${esc(ctx.mission.start_date)}</dd>
          <dt>${T('END')}</dt><dd>${esc(ctx.mission.endLabel)} · ${esc(ctx.mission.end_date)}</dd>
          <dt>${T('DURATION')}</dt><dd>${n} ${T(n === 1 ? 'day' : 'days')}</dd>
          <dt>${T('CREW')}</dt><dd>3</dd>
          <dt>${T('TIMEZONE')}</dt><dd>${esc(ctx.mission.timezone)}</dd>
        </dl>`, 'mars-side')}
      ${panel('CH-41 / RIGHT NOW', `
        ${eyebrow(T('At this moment'))}
        <dl class="kv">
          <dt>${T('SEPARATION')}</dt><dd>${ctx.geo.distanceAu.toFixed(3)} au</dd>
          <dt>${T('DISTANCE')}</dt><dd>${(ctx.geo.distanceKm / 1e6).toFixed(1)} M km</dd>
          <dt>${T('TREND')}</dt><dd>${esc(T(ctx.geo.trend))}</dd>
        </dl>
        <p class="note" style="margin-top:12px">${T('Positions are computed from Keplerian elements, not fetched from a service. The station keeps working if the venue loses its connection.')}</p>`, 'earth-side')}
    </div>
  </div>`;
}

function whatFold(ctx) {
  const T = ctx.T;
  const light = orbital.formatLightTime(ctx.geo.lightSeconds);
  const cs = `<b style="font-family:var(--mono);color:var(--earth)">${esc(ctx.callsign)}</b>`;
  return `
  <div class="grid g-hero">
    <div class="prose">
      <h3>${T(ctx.callsign ? 'You already have a callsign' : 'You will get a callsign')}</h3>
      <p>${ctx.callsign ? `${T('The moment you opened this page the station assigned you one — yours is')} ${cs}.`
        : T('The station assigns you one — a word and a number, such as BASALT-625 — the moment you accept its cookie, or the moment you first send.')} ${T('It is stored in a cookie on your device and nowhere else. There is no account, no email, no name. If you clear your browser you will be issued a new one and lose the thread of your earlier messages.')}</p>

      <h3>${T('What happens when you send something')}</h3>
      ${p(T, 'You write a message and choose up to three tags. When you transmit it, the composer is replaced by a transit display and you cannot send again until that message has arrived. The station computes the arrival time on the server, so closing the tab, reloading, or switching devices will not shorten the wait.')}
      <p>${T('The message then joins a queue that a human reads. Mission control decides whether it goes to the crew and whether it is published. Until it is answered it is visible only to you, under')} <b>${T('MY MESSAGES')}</b> ${T('on the board. Not every message is carried forward, and that is a real editorial decision rather than a spam filter.')}</p>

      <h3>${T('The delay is compressed, and we say so')}</h3>
      <p>${T('At this moment a radio signal takes')} <b>${light}</b> ${T('to reach Mars, and the same again to come back. The station shows you that figure where you write. But the animated crossing you watch after pressing transmit runs in about ten seconds. Pretending otherwise would make the piece a lie about physics rather than a piece about distance. The real number is stored with your message and travels with it into the archive.')}</p>

      <h3>${T('Where the habitat readings come from')}</h3>
      ${p(T, 'Temperature, humidity and the other channels in the Habitat section are measured by a sensor node in the physical performance space. When the node stops reporting, the dashboard says so rather than freezing on its last value.')}

      <h3>${T('What the crew readings are not')}</h3>
      ${p(T, 'The crew readings are filed by mission control on two axes and translated into sentences. They are a report about three people, written by people, transmitted deliberately. They are not sentiment analysis and they are not automated.')}
    </div>
    <div>
      ${panel('CH-40 / SEQUENCE', `
        ${eyebrow(T('The path of a message'))}
        <div class="rows">
        ${[
          ['Draft', 'You are writing. Nothing has left Earth.'],
          ['Transmitted', 'You pressed send. The station timestamps it.'],
          ['In transit', 'Crossing the gap. You cannot send again.'],
          ['Arrived', 'It has reached the Mars endpoint.'],
          ['Pending approval', 'A human at mission control reads it.'],
          ['Approved', 'Cleared to be answered.'],
          ['Response', 'The crew write back.'],
          ['Published', 'Both halves enter the archive.'],
        ].map(([a, b], i) => `<div class="row"><div class="t">${String(i + 1).padStart(2, '0')}</div>
          <div class="m"><b>${T(a)}</b><span>${T(b)}</span></div></div>`).join('')}
        </div>`, 'earth-side')}
      ${panel('CH-40 / PRIVACY', `
        ${eyebrow(T('What is kept'))}
        <p class="note">${T('Your callsign, your message text, your tags, and the time you sent it. A one-way hash of your IP address is stored for rate limiting and is never displayed. No analytics, no third-party scripts, no tracking of any kind. Published exchanges stay on this page as part of the work; the complete day-by-day record is held by mission control and is not public.')}</p>`, 'earth-side')}
    </div>
  </div>
  ${panel('CH-40 / STATES', `${eyebrow(T('Message states as shown in the interface'))}${pipeline('IN_TRANSIT', T)}`)}`;
}

function whoFold(crew, T, write = '#write') {
  return `
  ${panel('CH-42 / CREW', `
    ${eyebrow(T('Inside the habitat'))}
    <p class="note" style="max-width:64ch;margin-bottom:20px">${T('The crew are addressed by designation for the length of the mission. That is a condition of the piece, not an administrative convenience — the audience meets them as a role, and the names are published only once the habitat opens.')}</p>
    <div class="grid g3">
    ${crew.map((c) => `
      <div>
        <div class="eyebrow">${esc(c.role)}</div>
        <h3 style="font-family:var(--mono);letter-spacing:.06em">${esc(officer.shown(c.designation))}</h3>
        <p class="note">${esc(c.status)} · ${T('currently')} ${esc(c.activity ? c.activity.toLowerCase() : T('unlogged'))}</p>
      </div>`).join('')}
    </div>`, 'mars-side')}
  <div class="grid g2">
    ${panel('CH-42 / COMPANY', `
      ${eyebrow(T('Outside the habitat'))}
      <div class="tw"><table><tbody>
        ${CREDITS.map(([role, name]) => `<tr>
          <th style="width:46%">${esc(T(role))}</th><td>${esc(T(name))}</td></tr>`).join('')}
      </tbody></table></div>
      <p class="note" style="margin-top:14px">${T('Replace these entries in')}
      <code>src/views/pages/info.js</code> ${T('before the run opens.')}</p>`, 'earth-side')}
    <div>
      ${panel('CH-42 / PRODUCTION', `
        ${eyebrow(T('Produced by'))}
        <p>ZKM | ${T('Center for Art and Media Karlsruhe')}<br>
        Hertzlab<br>
        Lorenzstraße 19, 76135 Karlsruhe, ${T('Germany')}</p>
        <p class="note">${T('Supported by')} — ${T('to be credited')}. ${T('Partners')} — ${T('to be credited')}.</p>`, 'earth-side')}
      ${panel('CH-42 / CONTACT', `
        ${eyebrow(T('Reach the production'))}
        <p class="note">${T('Press and production enquiries reach a person, not this station. Messages sent through the communication channel reach the habitat and are answered there. The two do not mix.')}</p>
        <p><a class="btn" href="${write}">${T('Write to the habitat instead')}</a></p>`, 'earth-side')}
    </div>
  </div>`;
}

/**
 * The reading matter as a page: About, What this is and Who we are one after
 * another, each under its own head — the channel's code, its name, the line
 * beneath, in the dress of the dashboard's heads — with a row of three pills
 * at the top that jump to them. Once three pop-ups over the landing page; now
 * the page the About key opens (layout.js, tabbar()), where the ticker's menu
 * rows lead (public.js, ticker()) and where the old addresses land: /what and
 * /who-we-are (server.js), and the landing page's #about, #about-project,
 * #what and #who-we-are (public.js, mission()). The door to the composer
 * under Who we are is the landing page's (/#write), which a phone held
 * upright turns into the messages page's (tabbar.js).
 */
const PARTS = [
  ['about-project', 'CH-41', 'About', 'The habitat, the distance, the archive'],
  ['what', 'CH-40', 'What this is', 'How the station behaves, in plain terms'],
  ['who-we-are', 'CH-42', 'Who we are', 'Crew, company, production credits'],
];

function aboutPage(ctx, { crew = [] } = {}) {
  const T = ctx.T;
  const inner = { 'about-project': () => aboutFold(ctx), what: () => whatFold(ctx), 'who-we-are': () => whoFold(crew, T, '/#write') };
  const body = `
  <nav class="about-jump" aria-label="${esc(T('About, What this is, Who we are'))}">
    ${PARTS.map(([id, , title]) => `<a href="#${id}">${esc(T(title))}</a>`).join('')}
  </nav>
  ${PARTS.map(([id, code, title, sub]) => `
  <section class="about-sec" id="${id}" aria-labelledby="${id}-title">
    <header class="about-sec-head">
      <span class="dash-code">${code}</span>
      <h2 class="bigsec" id="${id}-title">${esc(T(title))}</h2>
      <p class="dash-sub">${esc(T(sub))}</p>
    </header>
    ${inner[id]()}
  </section>`).join('')}`;
  return L.page({ title: 'About', ctx, body, current: '/about', bodyClass: 'about' });   // layout.js dresses it as an inner page
}

module.exports = { aboutPage };
