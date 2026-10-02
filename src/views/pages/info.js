'use strict';
const L = require('../layout');
const { esc, panel, eyebrow } = L;
const orbital = require('../../lib/orbital');
const officer = require('../../lib/officer');

/**
 * The project, the station's behaviour and the credits — About, What this is
 * and Who we are — as one page of their own, /about (aboutPage, below): the
 * About key on a phone's bar of keys and the rows of the ticker's menu lead
 * there, each row to its section.
 */

/* Who we are: the crew's portraits — public/crew, made by tools/crew-pictures.py from the photographs in
   public/Astronaut_Pictures (Firstname_Lastname.jpg): one picture per person at 800 × 1200 and crew.json, the people in
   the order of their surnames with the two names as the file names give them, read here once at start — and the partners
   (public/partners — the logos from public/PartnerLogo, in the order the folder gives them: 1 and 2 in cooperation with,
   3 to 5 supporters). */
const CREW = (() => {
  try { return JSON.parse(require('fs').readFileSync(require('path').join(__dirname, '../../../public/crew/crew.json'), 'utf8')).filter((x) => x && x.file && x.last); }
  catch { return []; }
})();
const PARTNERS = {
  cooperation: [['staatstheater-karlsruhe', 'Badisches Staatstheater Karlsruhe'], ['naturkundemuseum-karlsruhe', 'Naturkundemuseum Karlsruhe']],
  supporters: [['eon-foundation', 'E.ON Foundation'], ['lbbw-stiftung', 'LBBW Stiftung'], ['innovationsfonds-kunst', 'Innovationsfonds Kunst Baden-Württemberg']],
};
const logos = (list) => `<div class="logos">${list.map(([f, name]) => `<span class="logo"><img src="/partners/${f}.png" alt="${esc(name)}" title="${esc(name)}" loading="lazy" decoding="async"></span>`).join('')}</div>`;

/* The prose is written in English and carried, paragraph by paragraph, in
   src/lib/i18n.js — one key per paragraph, so a paragraph can be reworded
   in one language without touching the other two. */
const p = (T, text) => `<p>${T(text)}</p>`;

function aboutFold(ctx) {
  const T = ctx.T;
  const n = ctx.mission.totalDays;
  /* The project, as the ZKM announces it — zkm.de/de/2026/10/marsplatz-red-dust-city — paragraph by paragraph; then
     what this station adds to it. Nothing here is invented: the run, the dome, the crew's brief, the EVAs, the ways to
     reach the crew, the question and the closing line, the opening, the project's name and its funders are the
     announcement's. */
  return `
  <div class="about-full">
    <div class="prose">
      <h3>MARS!platz: Red Dust City</h3>
      ${p(T, 'A durational performance on Karlsruhe’s Marktplatz, Thursday 15 to Tuesday 27 October 2026. Admission is free.')}
      ${p(T, 'Large space agencies and private companies are hard at work on a future for people on Mars. What would that future look like — and shouldn’t the people be part of designing it? MARS!platz asks exactly that.')}
      ${p(T, 'For six months Hertzlab, the artistic research and development department of the ZKM, worked with artists, experts and the citizen scientists of the open group Red Dust Society on how people could live on Mars: how to build and use a habitat, how to keep a crew mentally well, how to feed it and grow food, how to organise living together, and how to keep track of and save resources. What came out of it now goes into an analogue simulation — a large public experiment that tests which of the ideas hold up.')}
      ${p(T, 'A white dome on the Marktplatz marks the outpost of the first people to land: Red Dust City. For the thirteen days of the run three crew members are always in the habitat — a Commanding Officer, a Science Officer and a Health Officer — living and working under the conditions of a long-duration mission and testing what visitors of the ZKM and citizens of Karlsruhe have developed: the design and use of the habitat, strategies for the crew’s mental health, a balanced plan for food and growing, rules for organising a community, and the documenting and saving of resources.')}
      ${p(T, 'Every day the crew go out in their spacesuits on an EVA — an extra-vehicular activity — to run experiments on the Marktplatz. A detailed hourly programme says what is being tested when, and what came of it.')}
      ${p(T, 'You can talk to the crew: online, right here, through the world’s slowest chat; over the radio; at the ZKM; or on the Marktplatz itself. How would you live on Mars? Help design a possible future — solutions for Mars are also solutions for life on Earth.')}
      ${p(T, 'MARS!platz: Red Dust City is part of MARS! Mobilizing Awareness for Resilient Societies!, the ZKM’s programme for 2026, which the exhibition MARS! opened at the ZKM from 6 June to 13 September 2026. The opening on the Marktplatz is on Thursday 15 October 2026 from 16:00 to 17:00.')}

      <h3>${T('Distance as the material')}</h3>
      ${p(T, 'Networked communication is built to remove distance. A message is written and delivered in the same breath, and the gap between two people becomes invisible. That invisibility is the thing this piece takes apart.')}
      ${p(T, 'Here a message has to travel. You watch it go. You wait. It is read by someone who decides whether it goes further. A reply is written and comes back the other way. The exchange that a messaging app would have completed in under a second is stretched out until you can feel its shape — and the number in the rail above reminds you that the real crossing is longer still.')}
      ${p(T, 'The delay is not friction added for effect. It is the subject.')}

      <h3>${T('The archive as the work')}</h3>
      ${p(T, 'Every published exchange stays here. Over the run the archive accumulates into something neither the artists nor the audience wrote alone: a record of what people on Earth wanted to ask the three crew members in the habitat, and how those questions shifted as the mission went on.')}

      <h3 id="more-than-human">${T('More than Human')}</h3>
      ${p(T, 'The crew are not the habitat’s only inhabitants. Three live crickets share it with them, a robot dog goes with them on the EVA, and an emotional support robot keeps them company; on the hydroponic shelves the fresh food grows without soil, its roots in nutrient water. Each is cared for, counted and written into the record like the people — the mission’s question of who and what gets cared for begins at home.')}
      ${p(T, 'The More than Human room of the habitat drawing on the first page leads here; what the crickets, the dog, the robot and the plants are doing today is in the crew’s entries.')}

      <h3>${T('The readings')}</h3>
      ${p(T, 'The sensors that produce the readings on this page are mounted in the habitat on the Marktplatz. When the habitat warms up because a crowd is standing around it, the number moves. The data is not a simulation of a Mars habitat; it is a measurement of the real one, with the crew in it.')}

      <h3>${T('Messages sent to space')}</h3>
      ${p(T, 'Every message the crew answer is also beamed into space, by radio, through SpaceSpeak — a small network of transmitters around the world that sends short messages out of the atmosphere on request. The station hands the message over the moment its reply is published; SpaceSpeak encodes it and transmits it on a frequency between 2.4 and 5 gigahertz, a band chosen because it passes through the air and its water vapour almost untouched, from a directional antenna that gathers the transmitter’s power into a narrow cone pointed at the sky. Radio waves are light: they leave at the speed of light, 299,792 km every second.')}
      ${p(T, 'From then on the message is on its way for good. It passes the Moon’s orbit within two seconds, the orbit of Mars within minutes and Jupiter’s within the hour, leaves the planets behind in a matter of hours, and after two years is nearly halfway to Proxima Centauri, the nearest star. The signal grows fainter with every kilometre, spreading out as it goes — but there is no distance at which it stops: what leaves Earth by radio keeps travelling outwards, long after everyone who wrote or read it. The Message Board counts each message’s distance from the moment it was sent, and a tap on it names the object in the sky it has just passed.')}
    </div>
    ${panel('MISSION', `
      ${eyebrow(T('This mission'))}
      <dl class="kv kv-row">
        <div><dt>${T('DESIGNATION')}</dt><dd>${esc(ctx.mission.name)}</dd></div>
        <div><dt>${T('RUN')}</dt><dd>${esc(ctx.mission.runLabelLong)}</dd></div>
        <div><dt>${T('START')}</dt><dd>${esc(ctx.mission.startLabel)} · ${esc(ctx.mission.start_date)}</dd></div>
        <div><dt>${T('END')}</dt><dd>${esc(ctx.mission.endLabel)} · ${esc(ctx.mission.end_date)}</dd></div>
        <div><dt>${T('DURATION')}</dt><dd>${n} ${T(n === 1 ? 'day' : 'days')}</dd></div>
        <div><dt>${T('CREW')}</dt><dd>3</dd></div>
        <div><dt>${T('TIMEZONE')}</dt><dd>${esc(ctx.mission.timezone)}</dd></div>
      </dl>`, 'mars-side')}
  </div>`;
}

function whatFold(ctx) {
  const T = ctx.T;
  const light = orbital.formatLightTime(ctx.geo.lightSeconds);
  const cs = `<b style="font-family:var(--mono);color:var(--earth)">${esc(ctx.callsign)}</b>`;
  return `
  <div class="about-full">
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
    ${panel('SEQUENCE', `
      ${eyebrow(T('The path of a message'))}
      <div class="rows steps-row">
        ${[
          ['Write', 'You are writing. Nothing has left Earth.'],
          ['Transmit', 'You pressed send. The station timestamps it, and the message crosses the gap — you cannot send again until it has arrived.'],
          ['Reached MARS!platz', 'It has reached the habitat on the Marktplatz.'],
          ['Pending approval', 'A human at mission control reads it and decides whether it goes to the crew.'],
          ['Transmitted to space', 'Cleared, it is beamed on into space by radio, through SpaceSpeak.'],
          ['Replied back', 'The crew write back; question and answer are published on the board.'],
        ].map(([a, b], i) => `<div class="row"><div class="t">${String(i + 1).padStart(2, '0')}</div>
          <div class="m"><b>${T(a)}</b><span>${T(b)}</span></div></div>`).join('')}
      </div>`, 'earth-side')}
  </div>`;
}

function whoFold(crew, T) {
  return `
  ${panel('CREW', `
    <div class="grid g3">
    ${crew.map((c) => `
      <div>
        <div class="eyebrow">${esc(c.role)}</div>
        <h3 style="font-family:var(--mono);letter-spacing:.06em">${esc(officer.shown(c.designation))}</h3>
        <p class="note">${esc(c.status)} · ${T('currently')} ${esc(c.activity ? c.activity.toLowerCase() : T('unlogged'))}</p>
      </div>`).join('')}
    </div>`, 'mars-side')}
  ${CREW.length ? panel('THE CREW', `
    <div class="crew-wall">
      ${CREW.map((c) => `<figure class="crew-pic"><img src="/crew/${esc(c.file)}" alt="" width="800" height="1200" loading="lazy" decoding="async"><figcaption>${esc(c.first)} ${esc(c.last)}</figcaption></figure>`).join('')}
    </div>`, 'mars-side') : ''}
  ${panel('PRODUCTION', `
    ${eyebrow(T('Produced by'))}
    <p>ZKM | ${T('Center for Art and Media Karlsruhe')}<br>
    Hertzlab<br>
    Lorenzstraße 19, 76135 Karlsruhe, ${T('Germany')}</p>
    <div class="partners">
      <div class="partner-row">${eyebrow(T('In cooperation with'))}${logos(PARTNERS.cooperation)}</div>
      <div class="partner-row">${eyebrow(T('Supporters'))}${logos(PARTNERS.supporters)}</div>
    </div>`, 'earth-side')}`;
}

/**
 * The reading matter as a page: About, What this is and Who we are one after
 * another, each under its own head — its name and the line beneath, in the
 * dress of the dashboard's heads — with a row of three pills
 * at the top that jump to them. Once three pop-ups over the landing page; now
 * the page the About key opens (layout.js, tabbar()), where the ticker's menu
 * rows lead (public.js, ticker()) and where the old addresses land: /what and
 * /who-we-are (server.js), and the landing page's #about, #about-project,
 * #what and #who-we-are (public.js, mission()). Beside the prose, the panels
 * that remain: the mission's facts (About), the path of a message in six
 * steps (What this is), the crew — the three officers and the portraits — and the producer with the partners (Who we are).
 */
const PARTS = [
  ['about-project', 'About', 'The project, the distance, the archive'],
  ['what', 'What this is', 'How the station behaves, in plain terms'],
  ['who-we-are', 'Who we are', 'The crew, the producer, the partners'],
];

function aboutPage(ctx, { crew = [] } = {}) {
  const T = ctx.T;
  const inner = { 'about-project': () => aboutFold(ctx), what: () => whatFold(ctx), 'who-we-are': () => whoFold(crew, T) };
  const body = `
  <nav class="about-jump" aria-label="${esc(T('About, What this is, Who we are'))}">
    ${PARTS.map(([id, title]) => `<a href="#${id}">${esc(T(title))}</a>`).join('')}
  </nav>
  ${PARTS.map(([id, title, sub]) => `
  <section class="about-sec" id="${id}" aria-labelledby="${id}-title">
    <header class="about-sec-head">
      <h2 class="bigsec" id="${id}-title">${esc(T(title))}</h2>
      <p class="dash-sub">${esc(T(sub))}</p>
    </header>
    ${inner[id]()}
  </section>`).join('')}`;
  return L.page({ title: 'About', ctx, body, current: '/about', bodyClass: 'about' });   // layout.js dresses it as an inner page
}

module.exports = { aboutPage };
