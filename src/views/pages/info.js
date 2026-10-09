'use strict';
const L = require('../layout');
const { esc, panel, eyebrow } = L;
const orbital = require('../../lib/orbital');
const { habitatInside } = require('./inside');
const { solFold } = require('./sol');

/**
 * The project, the habitat in section and the credits — About, What's inside
 * the habitat and Who we are — as one page of their own, /about (aboutPage,
 * below): the About key on a phone's bar of keys and the rows of the ticker's
 * menu lead there, each row to its section. (What this is — how the station
 * behaves, with the path of a message — and, under About, More than Human and
 * The readings were on the page until October asked for them to go.)
 */

/* Who we are: the crew's portraits — public/crew, made by tools/crew-pictures.py from the photographs in
   public/Astronaut_Pictures (Firstname_Lastname.jpg): one picture per person at 800 × 1200 and crew.json, the people in
   the order of their surnames with the two names as the file names give them, then the crew with one name — the
   habitat's robot dog, Robodog (8 October) — read here once at start — and the partners
   (public/partners — the logos from public/PartnerLogo, in the order the folder gives them: 1 and 2 in cooperation with,
   3 to 5 supporters). */
const CREW = (() => {
  try { return JSON.parse(require('fs').readFileSync(require('path').join(__dirname, '../../../public/crew/crew.json'), 'utf8')).filter((x) => x && x.file && (x.last || x.first)); }
  catch { return []; }
})();
const PARTNERS = {
  cooperation: [['staatstheater-karlsruhe', 'Badisches Staatstheater Karlsruhe'], ['naturkundemuseum-karlsruhe', 'Naturkundemuseum Karlsruhe']],
  supporters: [['eon-foundation', 'E.ON Foundation'], ['lbbw-stiftung', 'LBBW Stiftung'], ['innovationsfonds-kunst', 'Innovationsfonds Kunst Baden-Württemberg']],
};
/** A member's name as the file gives it: first and last, or the one name alone (Robodog). */
const fullName = (c) => [c.first, c.last].filter(Boolean).join(' ');
const logos = (list) => `<div class="logos">${list.map(([f, name]) => `<span class="logo"><img src="/partners/${f}.png" alt="${esc(name)}" title="${esc(name)}" loading="lazy" decoding="async"></span>`).join('')}</div>`;

/* The prose is written in English and carried, paragraph by paragraph, in
   src/lib/i18n.js — one key per paragraph, so a paragraph can be reworded
   in one language without touching the other two; a translation that breaks
   its paragraph into several (a blank line between them — the French does,
   October's text) is set as several. `fill` puts links (or a figure) into a
   translated paragraph at its {marks}; `pf` sets the result as paragraphs. */
const paras = (text) => String(text).split(/\n\s*\n/).map((x) => `<p>${x.trim()}</p>`).join('\n      ');
const p = (T, text) => paras(T(text));
const fill = (T, key, vals) => Object.entries(vals).reduce((s, [k, v]) => s.split(`{${k}}`).join(v), esc(T(key)));
const pf = (T, key, vals) => paras(fill(T, key, vals));
const out = (href, text) => `<a href="${href}" target="_blank" rel="noopener">${text}</a>`;

/* The run's two moments and the count of its scientific missions, as the About page states them (October's text
   sheet, ABOUT_WEBSITE_TEXTS): the crew go in at 17:00 on the first day and come out at 17:00 on the last, and the
   missions are eleven. (content/missions.json plans a mission for every day but the last, which is twelve; the sheet
   says eleven, and the sheet is what the page says.) */
const START_END_TIME = '17:00';
const SCIENTIFIC_MISSIONS = 11;

function aboutFold(ctx) {
  const T = ctx.T;
  const n = ctx.mission.totalDays;
  /* The project in the words of October's text sheet (ABOUT_WEBSITE_TEXTS): what MARS! is and how it came to the
     Marktplatz — the workshops and the exhibition linked to their pages at zkm.de — then why it is done in the middle
     of the city, the habitat, and the insight; after them what this station adds (More than Human, the readings, the
     messages sent to space). The distance to Mars in the "Why" is the station's own figure for the day the crew go in
     (lib/orbital): the sheet's 26 million kilometres was the distance of a close approach, not October's. */
  const goIn = new Date(`${ctx.mission.start_date}T15:00:00Z`);                         // 17:00 at the venue, in October
  const km = orbital.geometry(goIn).distanceKm;
  const million = Math.round(km / 1e6);
  return `
  <div class="grid g-hero about-wide">
    <div class="prose">
      ${p(T, 'In the project MARS! – Mobilizing Awareness for Resilient Societies!, we want to challenge the signifier the planet Mars has become as a refuge planet for the richest of us, and to use it instead to address very pressing Earth matters. We will imagine for a moment that we, the global society, have decided to make Mars settlements a democratic Commons project. Rather than being left behind on a burning planet and looking on as the wealthy leave towards redder pastures, we will make Mars a democratic project for the rest of us, designing practical and utopian aspects of the question “What would we do if we could start over?”')}
      ${p(T, 'To this end, we invited scientists and citizen scientists to come together at ZKM | Karlsruhe to design and prototype key features of what a Mars settlement would look like: a habitat able to withstand adverse weather conditions; a recycling system that makes the best use of valuable resources; a social order that is able to work under crisis and duress; a care system for a planet that did not ask for human presence.')}
      ${p(T, 'During the project that began in January 2026, we noticed that all the skills needed for a democratic Mars settlement were also needed to adjust to a climate-changed Earth, giving us the necessary competence to start building a better society today. Going to Mars slowly became MARS!, and we became aware of what we need to do in order to become a resilient society right here, where we are.')}
      ${pf(T, 'The five prototype workshops {habitat}, {mental}, {food}, {governance}, and {resources} turned into a {exhibition} that ran at ZKM from June to September 2026. This, the MARS!platz performance, is the third part of the project: a field test where ideas, concepts and prototypes gathered in the workshop and exhibition phase are now tested under analogue conditions, by us, directly in the heart of the city, the Karlsruhe Marktplatz. Turned into MARS!platz for two weeks, we live, eat and sleep under the stars of Karlsruhe, testing out how we, as ordinary citizens and artistic researchers, would cope with a new beginning that is never quite remote from what we’re bringing with us.', {
        habitat: out('https://zkm.de/en/2026/01/open-hertzlab-mars-habitat', T('Habitat')),
        mental: out('https://zkm.de/en/2026/02/open-hertzlab-mars-mental-health', T('Mental Health')),
        food: out('https://zkm.de/en/2026/03/open-hertzlab-mars-food', T('Food')),
        governance: out('https://zkm.de/en/2026/04/open-hertzlab-mars-governance', T('Governance')),
        resources: out('https://zkm.de/en/2026/05/open-hertzlab-mars-resource-management', T('Resource Management')),
        exhibition: out('https://zkm.de/en/2026/06/mars', T('concept exhibition')),
      })}

      <h3>${T('Why are we doing this?')}</h3>
      <p class="kicker">${T('Playacting Mars in the middle of the city')}</p>
      ${pf(T, 'When the three artistic research astronauts of ZKM move into their habitat on Marktplatz in October 2026, the actual planet Mars will be {million} million kilometres away from Earth. It is, as yet, unsure if we would ever be able to get there, or if this is a desirable goal. What we do know is that space travel is a catalyst, a motor of dreams and imaginations and problem solving. Since January 2026, we have seen again and again that the imagination of being a spacefaring society is sparking innovation and solutions that could also be applied here on Earth, to aid in the transformation and change needed to cope with Earth’s changing climate and social parameters.', { million: String(million) })}
      ${p(T, 'Because ZKM is so much more than a museum, ideas born in it cannot be contained by its walls. We needed to go out, to seek new interactions and come into contact with new ideas and new people. Instead of imitating space agencies who host “analogue missions” in remote areas, we decided that the middle of a densely populated city is just the right environment to simulate life on the loneliest planet in our solar system.')}

      <h3>${T('The Habitat – Red Dust City')}</h3>
      ${p(T, 'The dome (lent to us by Staatstheater Karlsruhe) has a diameter of just under 10 m, making it a 75 square metre habitat for three astronauts from ZKM | Hertzlab, the artistic research department at ZKM. In three roles – Commander, Health Officer, Science Officer – we will simulate a Martian settlement, cooking, working and sleeping in the Habitat. The city society is invited to act as our ground station, to write us messages, to look into our daily activities, to meet us while we’re out on walks in our space suits or to communicate with us directly each day. Every day, 11 days in total, we tackle one big question that was raised during the project: How do people collaborate, if communication is disrupted by distance? Does human survival on Mars depend on art and beauty being present? How much is the cost (in terms of energy expenditure) of keeping a human alive? And how do we, from our anthropocentric perspective, perceive the more-than-human spacefaring existences of our “Spaceship Earth”?')}

      <h3>${T('The Insight')}</h3>
      ${p(T, 'What we are offering through this project is an invitation that we’re extending to the city society of Karlsruhe, to engage not only with the real possibility of space flight, but also to imagine themselves as beings in space already, on a spaceship called Earth. In order to remain viable for a broad range of living things, Earth needs care and stewardship as much as a space station would. Through the interaction with us – discussing, writing, receiving messages – we hope to encourage a change of perspective that leads us in turn closer to home.')}

      <h3>${T('Messages sent to space')}</h3>
      ${p(T, 'Every message the crew answer is also beamed into space, by radio, through SpaceSpeak — a small network of transmitters around the world that sends short messages out of the atmosphere on request. The station hands the message over the moment its reply is published; SpaceSpeak encodes it and transmits it on a frequency between 2.4 and 5 gigahertz, a band chosen because it passes through the air and its water vapour almost untouched, from a directional antenna that gathers the transmitter’s power into a narrow cone pointed at the sky. Radio waves are light: they leave at the speed of light, 299,792 km every second.')}
      ${p(T, 'From then on the message is on its way for good. It passes the Moon’s orbit within two seconds, the orbit of Mars within minutes and Jupiter’s within the hour, leaves the planets behind in a matter of hours, and after two years is nearly halfway to Proxima Centauri, the nearest star. The signal grows fainter with every kilometre, spreading out as it goes — but there is no distance at which it stops: what leaves Earth by radio keeps travelling outwards, long after everyone who wrote or read it. The Message Board counts each message’s distance from the moment it was sent, and a tap on it names the object in the sky it has just passed.')}
    </div>
    <div>
      ${panel('MISSION', `
        ${eyebrow(T('This mission'))}
        <dl class="kv">
          <dt>${T('DESIGNATION')}</dt><dd>${esc(ctx.mission.name)}</dd>
          <dt>${T('RUN')}</dt><dd>${esc(ctx.mission.runLabelLong)}</dd>
          <dt>${T('START')}</dt><dd>${esc(ctx.mission.startLabel)} · ${START_END_TIME}</dd>
          <dt>${T('END')}</dt><dd>${esc(ctx.mission.endLabel)} · ${START_END_TIME}</dd>
          <dt>${T('DURATION')}</dt><dd>${n} ${T(n === 1 ? 'day' : 'days')}</dd>
          <dt>${T('CREW')}</dt><dd>3</dd>
          <dt>${T('SCIENTIFIC MISSIONS')}</dt><dd>${SCIENTIFIC_MISSIONS}</dd>
        </dl>`, 'mars-side')}
    </div>
  </div>`;
}

function whoFold(crew, T, ctx) {
  // (the CREW panel — the three officers of the day, each under its brief, their portraits on shift and their states —
  // stood first here until 8 October: "from the About page, under Who we are, remove the Crew tab with all the text";
  // the dashboard's Crew Moods keeps the officers and their states)
  return `
  ${CREW.length ? panel('THE CREW', `
    <div class="crew-wall">
      ${CREW.map((c) => `<figure class="crew-pic"><img src="/crew/${esc(c.file)}" alt="" width="800" height="1200" loading="lazy" decoding="async"><figcaption>${esc(fullName(c))}</figcaption></figure>`).join('')}
    </div>`, 'mars-side') : ''}
  ${panel('PRODUCTION', `
    ${eyebrow(T('Produced by'))}
    <p>ZKM | ${T('Center for Art and Media Karlsruhe')}<br>
    ${esc(T('Department for Artistic Research & Development'))}, ${out('https://zkm.de/en/hertzlab', 'ZKM | Hertzlab')}<br>
    Lorenzstraße 19, 76135 Karlsruhe, ${T('Germany')}</p>
    <div class="partners">
      <div class="partner-row">${eyebrow(T('In cooperation with'))}${logos(PARTNERS.cooperation)}</div>
      <div class="partner-row">${eyebrow(T('Supporters'))}${logos(PARTNERS.supporters)}</div>
    </div>`, 'earth-side')}`;
}

/**
 * The reading matter as a page: About, the habitat in section and Who we are
 * one after another, each under its own head — its name and the line
 * beneath, in the dress of the dashboard's heads — with a row of three pills
 * at the top that jump to them. Once three pop-ups over the landing page;
 * now the page the About key opens (layout.js, tabbar()), where the ticker's
 * menu rows lead (public.js, ticker()) and where the old addresses land:
 * /what and /who-we-are (server.js), and the landing page's #about,
 * #about-project, #what and #who-we-are (public.js, mission()). Beside the
 * prose, the panels that remain: the mission's facts (About), the habitat's
 * picture with every module a key (What's inside the habitat — inside.js,
 * habitatInside, which was the landing page's third page), a sol on
 * MARS!platz — the day's schedule on a rail, hour by hour, with the three on
 * shift beside it (sol.js, solFold; October, 7 October) — the crew — the
 * three officers and the portraits — and the producer with the partners
 * (Who we are).
 */
const PARTS = [
  ['about-project', 'About', 'MARS! – Mobilizing Awareness for Resilient Societies!'],
  ['inside', 'What’s inside the habitat?', null],
  ['sol', 'A sol on MARS!platz', 'The day in the habitat, activity by activity — from breakfast to lights out'],
  ['who-we-are', 'Who we are', 'The crew, the producer, the partners'],
];

function aboutPage(ctx, { crew = [], habitat = null } = {}) {
  const T = ctx.T;
  // the habitat's section: its head's line is the drawing's hint (Point at a room… on a desk, Tap a room… on a touch
  // screen — sheet.css shows the one that applies), and the drawing itself stands under it on the section's sheet
  const hint = `<span class="dome-meta dome-hint"><span class="dome-hint-click">${T('Point at a room to know what is inside.')}</span><span class="dome-hint-tap">${T('Tap a room to know what is inside.')}</span></span>`;
  const inner = { 'about-project': () => aboutFold(ctx), inside: () => `<div class="hab-card">${habitatInside(ctx, habitat || {})}</div>`,
    sol: () => solFold(ctx, { today: (habitat || {}).today || null, crew: CREW }), 'who-we-are': () => whoFold(crew, T, ctx) };
  const body = `
  <nav class="about-jump" aria-label="${esc(T('On this page'))}">
    ${PARTS.map(([id, title]) => `<a href="#${id}">${esc(T(title))}</a>`).join('')}
  </nav>
  ${PARTS.map(([id, title, sub]) => `
  <section class="about-sec${id === 'inside' ? ' habitat-sec' : ''}" id="${id}" aria-labelledby="${id}-title">
    <header class="about-sec-head">
      <h2 class="bigsec" id="${id}-title">${esc(T(title))}</h2>
      <p class="dash-sub">${sub ? esc(T(sub)) : hint}</p>
    </header>
    ${inner[id]()}
  </section>`).join('')}`;
  return L.page({ title: 'About', ctx, body, current: '/about', bodyClass: 'about' });   // layout.js dresses it as an inner page
}

module.exports = { aboutPage };
