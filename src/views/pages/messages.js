'use strict';
const L = require('../layout');
const { esc, panel, eyebrow } = L;
const { messageCard } = require('./public');
const { TAGS } = require('../../lib/data');

/**
 * Every exchange the station has published, in one scrollable field. The
 * landing page shows the most recent few; this is where the whole
 * correspondence lives, which is the part that accumulates into the work.
 */
function messages(ctx, { list, counts, tags, filter }) {
  const body = `
  <div class="hatch" style="margin:0 calc(var(--gutter) * -1)"></div>
  <div style="padding:24px 0 20px">
    <div class="eyebrow">Channel group 20 · Public exchange
      <span class="brk">${counts.published} published</span></div>
    <h1>Messages</h1>
    <div class="spec">
      <span><b>${counts.published}</b> exchanges</span>
      <span><b>${counts.visitors}</b> callsigns issued</span>
      <span><b>${counts.today}</b> sent in the last 24 hours</span>
      <span>one way <b>${esc(require('../../lib/orbital').formatLightTime(ctx.geo.lightSeconds))}</b></span>
    </div>
    <p class="lede" style="margin:20px 0 0">Everything written to the habitat and answered from
    it. Each one crossed the distance shown above, was read by a person, and came back.</p>
    <p><a class="btn" href="/#write">Write to the habitat</a></p>
  </div>

  ${tags.length ? panel('CH-21 / DISTRIBUTION', `
    ${eyebrow('What people asked about')}
    <div class="tagbars">
      ${tags.map((t) => `
        <a href="/messages${filter === t.tag ? '' : `?tag=${encodeURIComponent(t.tag)}`}"
           class="tagbar ${filter === t.tag ? 'on' : ''}">
          <span class="tagbar-k">${esc(t.tag)}</span>
          <span class="tagbar-t"><i style="width:${(t.n / tags[0].n * 100).toFixed(0)}%"></i></span>
          <span class="tagbar-n">${t.n}</span>
        </a>`).join('')}
    </div>
    ${filter ? `<p class="note" style="margin-top:12px">Showing ${esc(filter)} only.
      <a href="/messages">Show everything</a></p>` : ''}`, 'earth-side') : ''}

  ${list.length
    ? `<div class="scroller tall"><div class="cards">${list.map(messageCard).join('')}</div></div>`
    : `<div class="empty">${filter
        ? 'No exchanges carry that tag yet'
        : 'Nothing published yet — the first message could be yours'}</div>`}`;

  return L.page({ title: 'Messages', ctx, body, current: '/messages' });
}

module.exports = { messages, TAGS };
