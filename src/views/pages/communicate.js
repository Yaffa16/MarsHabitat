'use strict';
const L = require('../layout');
const { esc, panel, eyebrow, orbitPlot, pipeline } = L;
const orbital = require('../../lib/orbital');
const { TAGS } = require('../../lib/data');

const MAX = Number(process.env.MESSAGE_MAX_CHARS || 500);
// The channel is open by default before the run so the station can be used and
// shown in full. Set this to hold it shut until the crew are actually inside.
const HOLD_BEFORE_LAUNCH = process.env.HOLD_CHANNEL_BEFORE_LAUNCH === 'true';

function stateLabel(s) {
  return { PENDING_APPROVAL: 'Waiting to be read in the habitat',
           APPROVED: 'Read and cleared for the board',
           REJECTED: 'Not carried forward',
           PUBLISHED: 'Published with a reply',
           ARRIVED: 'Arrived at Mars' }[s] || s.replace(/_/g, ' ');
}

/**
 * The crossing dial. A bezel, a dark glass face with a faint grid, Earth at
 * the lower left, Mars at the upper right, and the route between them as an
 * arc. Static here; composer.js runs the packet along #xroute and lengthens
 * #xtrail behind it.
 */
function crossingDial() {
  const S = 320, C = 160;
  const earth = [80, 232], mars = [236, 106];
  const route = `M${earth[0]},${earth[1]} Q 96,112 ${mars[0]},${mars[1]}`;
  const grid = [];
  for (let i = -5; i <= 5; i++) {
    const o = C + i * 26;
    grid.push(`<line x1="${o}" y1="${C - 134}" x2="${o}" y2="${C + 134}" class="xdial-grid"/>`);
    grid.push(`<line x1="${C - 134}" y1="${o}" x2="${C + 134}" y2="${o}" class="xdial-grid"/>`);
  }
  const screws = [[C, 22], [C + 138, C], [C, C + 138], [22, C]]
    .map(([x, y]) => `<circle cx="${x}" cy="${y}" r="4" class="xdial-screw"/>`).join('');
  return `<svg class="xdial" viewBox="0 0 ${S} ${S}" role="img" aria-label="The message crossing from Earth to Mars">
    <defs>
      <radialGradient id="bezelGrad" cx="50%" cy="30%" r="80%">
        <stop offset="0" stop-color="#3a3a40"/><stop offset="1" stop-color="#151518"/>
      </radialGradient>
      <radialGradient id="faceGrad" cx="50%" cy="38%" r="75%">
        <stop offset="0" stop-color="#232327"/><stop offset="1" stop-color="#0b0b0d"/>
      </radialGradient>
      <clipPath id="faceClip"><circle cx="${C}" cy="${C}" r="134"/></clipPath>
    </defs>
    <circle cx="${C}" cy="${C}" r="158" class="xdial-bezel"/>
    <circle cx="${C}" cy="${C}" r="150" fill="none" stroke="rgba(0,0,0,.45)" stroke-width="3"/>
    ${screws}
    <circle cx="${C}" cy="${C}" r="134" class="xdial-face"/>
    <g clip-path="url(#faceClip)">${grid.join('')}</g>
    <circle cx="${C}" cy="${C}" r="118" class="xdial-ring"/>
    <circle cx="${C}" cy="${C}" r="70" class="xdial-ring"/>
    <path id="xroute" d="${route}" class="xdial-route"/>
    <path id="xtrail" d="${route}" class="xdial-trail" stroke-dasharray="0 1000"/>
    <line x1="${mars[0] - 44}" y1="${mars[1]}" x2="${mars[0] - 12}" y2="${mars[1]}" stroke="rgba(255,255,255,.2)" stroke-dasharray="2 3"/>
    <circle cx="${mars[0]}" cy="${mars[1]}" r="12" class="xdial-mars-halo" style="transform-origin:${mars[0]}px ${mars[1]}px"/>
    <circle cx="${mars[0]}" cy="${mars[1]}" r="9" class="xdial-mars"/>
    <text x="${mars[0]}" y="${mars[1] - 20}" text-anchor="middle" class="xdial-label mars">Mars</text>
    <circle cx="${earth[0]}" cy="${earth[1]}" r="7" class="xdial-earth"/>
    <text x="${earth[0]}" y="${earth[1] + 22}" text-anchor="middle" class="xdial-label">Earth</text>
    <circle id="xpacket" cx="${earth[0]}" cy="${earth[1]}" r="5" class="xdial-packet"/>
    <text x="${C}" y="${C + 122}" class="xdial-word" id="xword">Sending</text>
  </svg>`;
}

/**
 * The composer, the transit view, or the closed notice — whichever applies.
 * Shared so the landing page and /communicate cannot drift apart: there is one
 * writing surface on this site and it behaves identically wherever it appears.
 */
function composerBlock(ctx, { inFlight, error, draft, idSuffix = '' }) {
  // The composer appears twice on the mission page. Ids are suffixed so the
  // character counter and tag limiter bind to the right one.
  const uid = (base) => base + idSuffix;
  const phase = ctx.mission.phase;
  const g = ctx.geo;

  // After the run the channel always closes -- there is nobody left to read
  // anything. Before it, closing is optional.
  const closed = (phase === 'COMPLETE' || (phase === 'PRE_LAUNCH' && HOLD_BEFORE_LAUNCH)) ? `
    <div class="transit closed" style="text-align:left">
      <div class="state">CHANNEL CLOSED</div>
      ${phase === 'PRE_LAUNCH' ? `
        <div class="clock" id="countdown" data-opens="${esc(ctx.mission.opensAt)}">T−${String(ctx.mission.countdown.days).padStart(3, '0')}:${String(ctx.mission.countdown.hours).padStart(2, '0')}:${String(ctx.mission.countdown.minutes).padStart(2, '0')}:${String(ctx.mission.countdown.seconds).padStart(2, '0')}</div>
        <p class="note" style="margin-top:12px">There is nobody in the habitat to read this yet.
        The channel opens on ${esc(ctx.mission.start_date)} at 00:00 ${esc(ctx.mission.timezone)},
        and stays open for ${ctx.mission.totalDays} days.</p>
        <p><a class="btn" href="#what">How it will work</a></p>`
      : `
        <p class="note" style="margin-top:12px">The crew left the habitat on
        ${esc(ctx.mission.end_date)}. Nothing sent now would reach anyone.</p>
        <p><a class="btn" href="/archive">Read what was sent</a></p>`}
      <div class="honesty">
        YOUR CALLSIGN <b>${esc(ctx.callsign)}</b> IS STILL RESERVED.<br>
        IT WILL BE WAITING IF YOU COME BACK.
      </div>
    </div>` : null;

  // `ghost` renders the same form without ids or a destination, invisible
  // and inert, purely to hold the device at the size it has while writing:
  // the transit view is laid over it, so pressing transmit changes what the
  // box shows and nothing about the box.
  const formHtml = (ghost = false) => `
  <form ${ghost ? 'class="composer ghost" inert aria-hidden="true"' :
    `method="post" action="/communicate" id="${uid('composer')}" class="composer"`}>
    <label class="f msgfield"><span class="sr-only">Message</span>
      <div class="msgbox">
        <textarea ${ghost ? '' : `name="body" id="${uid('body')}" required`} maxlength="${MAX}"
          placeholder="Write to the crew. They will read this ${orbital.formatLightTime(g.lightSeconds)} from now, if the relay holds.">${ghost ? '' : esc(draft || '')}</textarea>
        <span class="counter" ${ghost ? '' : `id="${uid('count')}"`}>0 / ${MAX}</span>
      </div>
    </label>
    <div class="tagbar">
      <span class="lbl">Tags · choose 3</span>
      <span class="counter tags-note">CHOOSE UP TO 3 TAGS</span>
      <div class="tags" ${ghost ? '' : `id="${uid('tags')}"`}>
        ${TAGS.map((t) => `<label><input type="checkbox" ${ghost ? '' : 'name="tags"'} value="${t}"><span>${t}</span></label>`).join('')}
      </div>
    </div>
    <hr>
    <div class="dev-foot">
      <p class="note">Messages are read by mission control before they reach the board.
      You will be able to send again once this one has arrived.</p>
      <button type="${ghost ? 'button' : 'submit'}" class="primary">Transmit</button>
    </div>
  </form>`;
  const form = formHtml(false);

  const transitBlock = inFlight ? `
    <div class="dev-stage">
    ${formHtml(true)}
    <div class="transit transit-block"
         data-arrival="${esc(inFlight.arrival_at)}"
         data-departure="${esc(inFlight.submitted_at)}"
         data-light="${inFlight.light_seconds}">

      <!-- The crossing as a dial: a dark screen behind glass, Earth at the
           foot, Mars at the head, the message travelling the arc between
           them. composer.js moves the packet along #xroute and draws the
           trail behind it. -->
      <div class="xdial-wrap" aria-hidden="true">
        ${crossingDial()}
      </div>

      <div class="transit-read">
        <div class="state"><span class="sr-only">Message in transit · </span>Sending · Earth → Mars ·
          <b id="tpct">0%</b> of the crossing</div>
        <div class="clock" id="tclock">--:--</div>
        <div class="tbar"><i id="tbar" style="width:0%"></i></div>
        <div class="honesty">
          Real crossing <b>${orbital.formatLightTime(inFlight.light_seconds)}</b>
          at ${inFlight.distance_au.toFixed(3)} au — this dial compresses it.<br>
          The wait you are having is shorter than the one the crew have.
          <span class="sr-only">Arrives <span id="tarr">${esc(inFlight.arrival_at.slice(11, 19))} UTC</span></span>
        </div>
      </div>
    </div>
    </div>` : '';

  if (closed) return closed;
  if (inFlight) return transitBlock;
  return (error ? `<div class="flash err">${esc(error)}</div>` : '') + form;
}

function compose(ctx, { inFlight, mine, error, draft }) {
  const g = ctx.geo;
  const phase = ctx.mission.phase;
  const body = `
  <div style="padding:30px 0 18px">
    <div class="eyebrow">Channel group 09 · Uplink</div>
    <h1>${phase === 'ACTIVE' ? 'Write to the habitat' : 'The channel'}</h1>
    <p class="lede">You have been assigned the callsign <b style="font-family:var(--mono);color:var(--earth)">${esc(ctx.callsign)}</b>
    for this visit. No account, no name. It is how the crew will know you.</p>
    ${phase === 'PRE_LAUNCH' && !HOLD_BEFORE_LAUNCH ? `<p class="note">The habitat is not occupied until
    ${esc(ctx.mission.start_date)}. You can write now, but nobody will read it until the crew
    are inside — your message waits with them.</p>` : ''}
  </div>

  ${error ? `<div class="flash err">${esc(error)}</div>` : ''}

  <div class="grid g-hero">
    ${panel('CH-09 / COMPOSER', composerBlock(ctx, { inFlight, error, draft }), 'earth-side')}
    <div>
      ${orbitPlot(ctx.geo, { size: 400, id: 'orbit' })}
      ${panel('CH-09 / LINK BUDGET', `
        ${eyebrow(phase === 'ACTIVE' ? 'This transmission' : 'The gap, right now')}
        <dl class="kv">
          <dt>RANGE</dt><dd>${(g.distanceKm / 1e6).toFixed(2)} million km</dd>
          <dt>ONE WAY</dt><dd>${orbital.formatLightTime(g.lightSeconds)}</dd>
          <dt>ROUND TRIP</dt><dd>${orbital.formatLightTime(g.lightSeconds * 2)}</dd>
          <dt>GEOMETRY</dt><dd>${esc(g.trend)} ${Math.abs(g.rateKmPerDay / 1e3).toFixed(0)} thousand km/day</dd>
        </dl>`, 'earth-side')}
    </div>
  </div>

  ${mine.length ? panel('CH-09 / YOUR TRAFFIC', `
    ${eyebrow('Messages you have sent')}
    ${mine.map((m) => `
      <div style="border-bottom:1px solid var(--rule);padding:12px 0">
        <div style="display:flex;gap:12px;align-items:baseline;flex-wrap:wrap">
          <span style="font-family:var(--mono);font-size:11px;color:var(--dim)">${esc(m.submitted_at.slice(0, 16).replace('T', ' '))} UTC</span>
          <span class="badge ${m.state === 'PUBLISHED' ? 'ok' : m.state === 'REJECTED' ? 'bad' : 'warn'}">${esc(stateLabel(m.state))}</span>
        </div>
        <p style="margin:8px 0 6px">${esc(m.body)}</p>
        ${m.response_body ? `<div class="msg-reply"><div class="who">MARS HABITAT REPLIED</div><p>${esc(m.response_body)}</p></div>` : ''}
        ${pipeline(m.state === 'REJECTED' ? 'PENDING_APPROVAL' : m.state === 'PUBLISHED' ? 'PUBLISHED' : m.state)}
      </div>`).join('')}`, 'earth-side') : ''}
  `;

  return L.page({
    title: 'Communicate', ctx, body, current: '/communicate',
    scripts: ['/composer.js'],
  });
}


module.exports = { compose, composerBlock, MAX };
