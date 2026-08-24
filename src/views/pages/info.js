'use strict';
const L = require('../layout');
const { esc, panel, eyebrow, pipeline } = L;
const orbital = require('../../lib/orbital');

/* ================================================================== WHAT */

function what(ctx) {
  const light = orbital.formatLightTime(ctx.geo.lightSeconds);
  const body = `
  <div style="padding:30px 0 18px">
    <div class="eyebrow">Operating notes</div>
    <h1>What this is</h1>
    <p class="lede">A communication station, not a website about one. Everything below describes
    how it actually behaves, so that nothing about the delay comes as a surprise.</p>
  </div>

  <div class="grid g-hero">
    <div class="prose">
      <h2>You already have a callsign</h2>
      <p>The moment you opened this page the station assigned you one — yours is
      <b style="font-family:var(--mono);color:var(--earth)">${esc(ctx.callsign)}</b>. It is stored in
      a cookie on your device and nowhere else. There is no account, no email, no name. If you clear
      your browser you will be issued a new one and lose the thread of your earlier messages.</p>

      <h2>What happens when you send something</h2>
      <p>You write a message and choose up to three tags. When you transmit it, the composer is
      replaced by a transit display and you cannot send again until that message has arrived. The
      station computes the arrival time on the server, so closing the tab, reloading, or switching
      devices will not shorten the wait.</p>
      <p>The message then joins a queue that a human reads. Mission control decides whether it goes
      to the crew and whether it is published. Not every message is carried forward, and that is a
      real editorial decision rather than a spam filter.</p>

      <h2>The delay is compressed, and we say so</h2>
      <p>At this moment a radio signal takes <b>${light}</b> to reach Mars, and the same again to
      come back. The station shows you that figure constantly — it is in the rail at the top of
      every page. But the animated crossing you watch after pressing transmit runs in about
      ten seconds. Pretending otherwise would make the piece a lie about physics rather than a
      piece about distance. The real number is stored with your message and travels with it into
      the archive.</p>

      <h2>Where the habitat readings come from</h2>
      <p>Temperature, humidity and any other channel shown on the habitat page are measured by
      sensors in the physical performance space and posted to this station as they are taken. When
      a channel stops reporting for more than five minutes it is marked <b>SIGNAL LOST</b> rather
      than being hidden or frozen on its last value.</p>

      <h2>What the crew page is not</h2>
      <p>The crew readings are filed by mission control on four axes and translated into sentences
      here. They are a report about three people, written by people, transmitted deliberately. They
      are not sentiment analysis and they are not automated.</p>
    </div>

    <div>
      ${panel('CH-40 / SEQUENCE', `
        ${eyebrow('The path of a message')}
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
          <div class="m"><b>${a}</b><span>${b}</span></div></div>`).join('')}
        </div>`, 'earth-side')}
      ${panel('CH-40 / PRIVACY', `
        ${eyebrow('What is kept')}
        <p class="note">Your callsign, your message text, your tags, and the time you sent it. A
        one-way hash of your IP address is stored for rate limiting and is never displayed. No
        analytics, no third-party scripts, no tracking of any kind. Published exchanges stay on
        the mission page as part of the work; the complete day-by-day record is held by mission
        control and is not public.</p>`, 'earth-side')}
    </div>
  </div>

  ${panel('CH-40 / STATES', `${eyebrow('Message states as shown in the interface')}${pipeline('IN_TRANSIT')}`)}
  `;
  return L.page({ title: 'What this is', ctx, body, current: '/what' });
}

/* ================================================================= ABOUT */

function about(ctx) {
  const body = `
  <div style="padding:30px 0 18px">
    <div class="eyebrow">MARS · ZKM | Hertzlab</div>
    <h1>About the project</h1>
    <p class="lede">Three performers live in a habitat inside the exhibition space for the duration
    of the run. This station is the only way in.</p>
  </div>

  <div class="grid g-hero">
    <div class="prose">
      <h2>The habitat</h2>
      <p>MARS is a durational performance. For the length of the mission the crew do not leave the
      habitat. They follow a schedule, eat what has been planned for them, work through a set of
      tasks, and draw down a finite inventory. Visitors to the exhibition can see the habitat from
      outside. What they cannot do is walk in and talk to the people inside it.</p>
      <p>The sensors that produce the readings on this site are mounted in that structure. When the
      habitat warms up because a room full of people is standing around it, the number on the
      habitat page moves. The data is not a simulation of a Mars habitat; it is a measurement of a
      real enclosed space with three people in it.</p>

      <h2>Distance as the material</h2>
      <p>Networked communication is built to remove distance. A message is written and delivered in
      the same breath, and the gap between two people becomes invisible. That invisibility is the
      thing this piece takes apart.</p>
      <p>Here a message has to travel. You watch it go. You wait. It is read by someone who decides
      whether it goes further. A reply is written and comes back the other way. The exchange that a
      messaging app would have completed in under a second is stretched out until you can feel its
      shape — and the number in the rail above reminds you that the real crossing is longer still.</p>
      <p>The delay is not friction added for effect. It is the subject.</p>

      <h2>The archive as the work</h2>
      <p>Every published exchange stays here. Over the run the archive accumulates into something
      neither the artists nor the audience wrote alone: a record of what people on Earth wanted to
      ask three strangers in a sealed room, and how those questions shifted as the mission went on.
      Early messages tend to be curious and technical. Later ones are usually not.</p>

      <h2>Hertzlab</h2>
      <p>Hertzlab is the research and production laboratory of the ZKM | Center for Art and Media
      Karlsruhe, working across performance, sound, media technology and installation. MARS is
      produced within that context, and this station was built as part of the production rather
      than as documentation of it.</p>
    </div>

    <div>
      ${panel('CH-41 / MISSION', `
        ${eyebrow('This mission')}
        <dl class="kv">
          <dt>DESIGNATION</dt><dd>${esc(ctx.mission.name)}</dd>
          <dt>START</dt><dd>${esc(ctx.mission.start_date)}</dd>
          <dt>END</dt><dd>${esc(ctx.mission.end_date)}</dd>
          <dt>DURATION</dt><dd>${ctx.mission.totalDays} days</dd>
          <dt>CREW</dt><dd>3</dd>
          <dt>TIMEZONE</dt><dd>${esc(ctx.mission.timezone)}</dd>
        </dl>`, 'mars-side')}
      ${panel('CH-41 / RIGHT NOW', `
        ${eyebrow('At this moment')}
        <dl class="kv">
          <dt>SEPARATION</dt><dd>${ctx.geo.distanceAu.toFixed(3)} au</dd>
          <dt>DISTANCE</dt><dd>${(ctx.geo.distanceKm / 1e6).toFixed(1)} M km</dd>
          <dt>ONE WAY</dt><dd>${orbital.formatLightTime(ctx.geo.lightSeconds)}</dd>
          <dt>ROUND TRIP</dt><dd>${orbital.formatLightTime(ctx.geo.lightSeconds * 2)}</dd>
          <dt>TREND</dt><dd>${esc(ctx.geo.trend)}</dd>
        </dl>
        <p class="note" style="margin-top:12px">Positions are computed from Keplerian elements,
        not fetched from a service. The station keeps working if the venue loses its connection.</p>`, 'earth-side')}
    </div>
  </div>`;
  return L.page({ title: 'About', ctx, body, current: '/about' });
}

/* =========================================================== WHO WE ARE */

function who(ctx, { crew }) {
  const CREDITS = [
    ['Concept and direction', 'To be credited'],
    ['Performance', 'Three performers, credited after the run'],
    ['Scenography and habitat', 'To be credited'],
    ['Sound', 'To be credited'],
    ['Sensor systems and software', 'To be credited'],
    ['Production', 'ZKM | Hertzlab'],
    ['Technical direction', 'To be credited'],
  ];
  const body = `
  <div style="padding:30px 0 18px">
    <div class="eyebrow">Crew, company and credits</div>
    <h1>Who we are</h1>
    <p class="lede">Two registers, kept deliberately apart: the three people inside the habitat,
    and the people who built the thing around them.</p>
  </div>

  ${panel('CH-42 / CREW', `
    ${eyebrow('Inside the habitat')}
    <p class="note" style="max-width:64ch;margin-bottom:20px">The crew are addressed by
    designation for the length of the mission. That is a condition of the piece, not an
    administrative convenience — the audience meets them as a role, and the names are published
    only once the habitat opens.</p>
    <div class="grid g3">
    ${crew.map((c) => `
      <div>
        <div class="eyebrow">${esc(c.role)}</div>
        <h3 style="font-family:var(--mono);letter-spacing:.06em">${esc(c.designation)}</h3>
        <p class="note">${esc(c.status)} · currently ${esc((c.activity || 'unlogged').toLowerCase())}</p>
      </div>`).join('')}
    </div>`, 'mars-side')}

  <div class="grid g2">
    ${panel('CH-42 / COMPANY', `
      ${eyebrow('Outside the habitat')}
      <div class="tw"><table>
        <tbody>
        ${CREDITS.map(([role, name]) => `<tr>
          <th style="width:46%">${esc(role)}</th><td>${esc(name)}</td></tr>`).join('')}
        </tbody>
      </table></div>
      <p class="note" style="margin-top:14px">Replace these entries in
      <code>src/views/pages/info.js</code> before the run opens.</p>`, 'earth-side')}

    <div>
      ${panel('CH-42 / PRODUCTION', `
        ${eyebrow('Produced by')}
        <p>ZKM | Center for Art and Media Karlsruhe<br>
        Hertzlab<br>
        Lorenzstraße 19, 76135 Karlsruhe, Germany</p>
        <p class="note">Supported by — to be credited. Partners — to be credited.</p>`, 'earth-side')}
      ${panel('CH-42 / CONTACT', `
        ${eyebrow('Reach the production')}
        <p class="note">Press and production enquiries reach a person, not this station.
        Messages sent through the communication channel reach the habitat and are answered
        there. The two do not mix.</p>
        <p><a class="btn" href="/communicate">Write to the habitat instead</a></p>`, 'earth-side')}
    </div>
  </div>`;
  return L.page({ title: 'Who we are', ctx, body, current: '/who-we-are' });
}

module.exports = { what, about, who };
