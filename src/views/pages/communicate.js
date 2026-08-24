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
    <div class="transit" style="text-align:left">
      <div class="state">CHANNEL CLOSED</div>
      ${phase === 'PRE_LAUNCH' ? `
        <div class="clock" id="countdown" data-opens="${esc(ctx.mission.opensAt)}">T−${String(ctx.mission.countdown.days).padStart(3, '0')}:${String(ctx.mission.countdown.hours).padStart(2, '0')}:${String(ctx.mission.countdown.minutes).padStart(2, '0')}:${String(ctx.mission.countdown.seconds).padStart(2, '0')}</div>
        <p class="note" style="margin-top:12px">There is nobody in the habitat to read this yet.
        The channel opens on ${esc(ctx.mission.start_date)} at 00:00 ${esc(ctx.mission.timezone)},
        and stays open for ${ctx.mission.totalDays} days.</p>
        <p><a class="btn" href="/what">How it will work</a></p>`
      : `
        <p class="note" style="margin-top:12px">The crew left the habitat on
        ${esc(ctx.mission.end_date)}. Nothing sent now would reach anyone.</p>
        <p><a class="btn" href="/archive">Read what was sent</a></p>`}
      <div class="honesty">
        YOUR CALLSIGN <b>${esc(ctx.callsign)}</b> IS STILL RESERVED.<br>
        IT WILL BE WAITING IF YOU COME BACK.
      </div>
    </div>` : null;

  const form = `
  <form method="post" action="/communicate" id="${uid('composer')}" class="composer">
    <label class="f msgfield"><span class="sr-only">Message</span>
      <div class="msgbox">
        <textarea name="body" id="${uid('body')}" maxlength="${MAX}" required
          placeholder="Write to the crew. They will read this ${orbital.formatLightTime(g.lightSeconds)} from now, if the relay holds.">${esc(draft || '')}</textarea>
        <span class="counter" id="${uid('count')}">0 / ${MAX}</span>
      </div>
    </label>
    <div class="counter tags-note">CHOOSE UP TO 3 TAGS</div>
    <div class="tags" id="${uid('tags')}">
      ${TAGS.map((t) => `<label><input type="checkbox" name="tags" value="${t}"><span>${t}</span></label>`).join('')}
    </div>
    <hr>
    <button type="submit" class="primary">Transmit to Mars</button>
    <p class="note" style="margin-top:14px">Messages are read by mission control before they reach
    the board. You will be able to send again once this one has arrived.</p>
  </form>`;

  const transitBlock = inFlight ? `
    <div class="transit transit-block"
         data-arrival="${esc(inFlight.arrival_at)}"
         data-departure="${esc(inFlight.submitted_at)}"
         data-light="${inFlight.light_seconds}">

      <div class="state">Message in transit · Earth → Mars</div>

      <!-- The crossing, drawn as its own thing rather than left to the plot.
           Earth at one end, Mars at the other, and the packet actually
           travelling the gap between them. -->
      <div class="crossing" aria-hidden="true">
        <div class="crossing-track">
          <span class="body earth"></span>
          <span class="trail" id="trail"></span>
          <span class="packet" id="packet"></span>
          <span class="body mars"></span>
        </div>
        <div class="crossing-labels"><span>Earth</span><span>Mars</span></div>
      </div>

      <div class="clock" id="tclock">--:--</div>
      <div class="bar" style="height:8px"><i class="warn" id="tbar" style="width:0%"></i></div>
      <div class="note" style="margin-top:10px;font-family:var(--mono);font-size:10px;letter-spacing:.14em;text-transform:uppercase">
        <span id="tpct">0%</span> of the crossing · arrives
        <span id="tarr">${esc(inFlight.arrival_at.slice(11, 19))} UTC</span>
      </div>

      <div class="honesty">
        The real crossing would take <b>${orbital.formatLightTime(inFlight.light_seconds)}</b>
        at ${inFlight.distance_au.toFixed(3)} au.<br>
        This interface compresses it. The wait you are having is shorter than the one the crew have.
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
