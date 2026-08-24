'use strict';
const L = require('../layout');
const { esc, panel, eyebrow } = L;

const dd = (n) => String(n).padStart(3, '0');

/**
 * The whole mission on one page. Day by day is useful once you are inside the
 * run; this is the view that shows its shape — nine days of the same waking
 * hour, the same communication window, and a schedule that quietly changes
 * character around the middle.
 */
function schedule(ctx, { days }) {
  const today = ctx.mission.clampedDay;
  const running = ctx.mission.phase === 'ACTIVE';

  const body = `
  <div class="hatch" style="margin:0 calc(var(--gutter) * -1)"></div>
  <div style="padding:24px 0 22px">
    <div class="eyebrow">Channel group 30 · Mission schedule
      <span class="brk">${ctx.mission.totalDays} days</span></div>
    <h1>Schedule</h1>
    <div class="spec">
      <span>${esc(ctx.mission.start_date)} to ${esc(ctx.mission.end_date)}</span>
      <span><b>${days.reduce((n, d) => n + d.tasks.length, 0)}</b> scheduled tasks</span>
      <span>${running ? `on day <b>${dd(today)}</b>` : 'not yet running'}</span>
    </div>
    <p class="lede" style="margin:20px 0 0">Every day of the mission, as it was planned. The crew
    wake at the same hour, eat at the same hours, and open the channel to Earth at sixteen
    hundred every single day. What changes is everything in between.</p>
  </div>

  ${L.scaleStrip(ctx.mission)}

  <div class="days">
    ${days.map((d) => {
      const state = !running ? 'ahead'
        : d.missionDay < today ? 'past' : d.missionDay === today ? 'now' : 'ahead';
      return `<section class="dayblock ${state}">
        <div class="dayblock-head">
          <span class="daynum">${dd(d.missionDay)}</span>
          <div>
            <b>${esc(d.date)}</b>
            <span>${d.tasks.length} tasks${d.meals.length ? ` · ${d.meals.length} meals` : ''}</span>
          </div>
          ${state === 'now' ? '<span class="badge warn">Today</span>' : ''}
          <a class="btn" href="/day/${d.missionDay}" style="margin-left:auto">Open the day</a>
        </div>
        ${d.tasks.length ? `<div class="rows">${d.tasks.map((t) => `
          <div class="row">
            <div class="t">${esc(t.time)}</div>
            <div class="m"><b>${esc(t.label)}</b>${t.detail ? `<span>${esc(t.detail)}</span>` : ''}</div>
          </div>`).join('')}</div>`
        : '<div class="empty">No schedule filed for this day</div>'}
      </section>`;
    }).join('')}
  </div>

  ${panel('CH-30 / NOTE', `
    ${eyebrow('What a schedule is doing here')}
    <p class="note">This is not a calendar. It is the structure three people agreed to live
    inside for ${ctx.mission.totalDays} days, published in advance so that anyone writing to the
    habitat knows what the crew were doing when the message arrived. The communication window at
    16:00 is the hour your message is read.</p>`)}`;

  return L.page({ title: 'Schedule', ctx, body, current: '/schedule' });
}

module.exports = { schedule };
