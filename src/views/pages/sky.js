'use strict';
/**
 * The sky of the first page, as the v6 mock-up of the app draws its first
 * screen — on a desk and on a phone alike: in the room between the Earth and
 * the habitat (landing.js, space), either side of the line between them, the latest
 * exchanges with Earth come and go — each as one block headed LATEST
 * MESSAGE:, the visitor's QUESTION under its callsign and the time and the
 * crew's ANSWER under ✧ and the officer, so that what they are is plain — one
 * or two of them at a time; and the newest pictures out of the cloud folder
 * appear as small snapshots headed LATEST IMAGE, the moment each was taken
 * at its foot, one or two at a time, and fade away again (October asked for
 * the two heads; the words come with the page, data-latest-msg and
 * data-latest-pic, in the visitor's language).
 *
 * Nothing in it is new: the exchanges are the board's published ones — the
 * rows the board itself shows, never a message still waiting for mission
 * control — and the pictures are the cloud gallery's newest, the same the
 * Habitat panel's strip shows. This draws the room and the first lines into
 * the page (a JSON block); public/sky.js places them, lets them rise and fade,
 * and keeps them current from what the page already fetches. A touch on a
 * snapshot or an exchange brings a note beside it saying what it is — the
 * live feed from the habitat, the latest communication from it — whose words
 * come with the page too (skyNotes, below). With nothing to
 * show — no exchange yet, no picture — there is no sky and the room stands as
 * it is: the Earth, the line and the habitat.
 *
 * Drawn into the first page's room (landing.js, `space`); shown by aura.css
 * and sheet.css over the whole of the room, on a phone and on a desk alike,
 * its items placed clear of the Earth, the habitat and the line.
 * Decorative: the same exchanges are on the board and the same pictures on
 * the Media page, so the sky is hidden from assistive technology.
 */
const { esc } = require('../layout');
const officer = require('../../lib/officer');

const EXCHANGES = 6;     // the newest published exchanges carried in the sky (at least five, as asked): each its question and its answer
const PICTURES = 5;      // the newest pictures from the cloud folder
const AT_ONCE = 2;       // how many exchanges, and how many pictures, are in the sky at one time at most (one at least, when there are any)
const CLIP = 90;         // a line in the sky is two lines at most; the rest is on the board

const clip = (t) => { t = String(t || '').replace(/\s+/g, ' ').trim(); return t.length > CLIP ? t.slice(0, CLIP - 1).trimEnd() + '…' : t; };

/** "22.09 · 16:49", in the venue's clock (the line under the dome, landing.js, writes its exchanges' times so). */
function stamp(iso, tz) {
  const d = new Date(iso);
  if (!iso || isNaN(d.getTime())) return '';
  try {
    const o = {};
    new Intl.DateTimeFormat('en-GB', { timeZone: tz, hour12: false, day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })
      .formatToParts(d).forEach((p) => { o[p.type] = p.value; });
    return `${o.day}.${o.month} · ${o.hour === '24' ? '00' : o.hour}:${o.minute}`;
  } catch { return ''; }
}

/** The officer who answered, as the board names them — the first officer as the Commanding Officer (lib/officer.js). */
const responder = (m, T) => (m.responder ? T(officer.shown(m.responder)) : T('Mars habitat'));

/** The exchanges, in the order they rise: the newest first — each its question (the visitor's callsign, when it was
    sent, the words) and its answer (the officer as the board names them, public.js messageCard; when it left Mars; the
    words). Each carries its message's id, so the same exchange is never in the sky twice at once. */
function exchanges(recent, T) {
  const shown = recent.filter((m) => m.state === 'PUBLISHED')
    .sort((a, b) => String(b.submitted_at).localeCompare(String(a.submitted_at)))
    .slice(0, EXCHANGES);
  return shown.map((m) => ({
    id: m.id, who: m.callsign, at: m.submitted_at, text: clip(m.body),
    reply: m.response_body ? clip(m.response_body) : '', rwho: m.response_body ? responder(m, T) : '', rat: m.response_body ? m.response_at : '',
  }));
}

/** The snapshots: the newest pictures, with the moment each was taken as the gallery writes it. */
function pictures(cloud, tz) {
  if (!cloud || !Array.isArray(cloud.items)) return [];
  const { cloudWhen } = require('./media');
  return cloud.items.slice(0, PICTURES).map((x) => {
    const when = cloudWhen(x, tz);
    return { id: x.id, url: x.url, thumb: x.thumb, when: when ? when.text : '' };
  });
}

/**
 * The sky, for the first page: `html` goes inside the page's room, `on`
 * says whether there is anything to show. The landing page loads
 * public/sky.js to set it going.
 */
function habitatSky(ctx, { recent = [], cloud = null } = {}) {
  const T = ctx.T, m = ctx.mission;
  const model = { ex: exchanges(recent, T), pics: pictures(cloud, m.timezone) };
  const on = !!(model.ex.length || model.pics.length);
  const json = JSON.stringify(model).replace(/</g, '\\u003c');
  const html = `
      <div class="dome-sky" id="dome-sky" aria-hidden="true" data-tz="${esc(m.timezone)}" data-start="${esc(m.start_date)}" data-days="${m.totalDays}"
           data-exchanges="${EXCHANGES}" data-pictures="${PICTURES}" data-at-once="${AT_ONCE}" data-clip="${CLIP}"
           data-q="${esc(T('Question'))}" data-a="${esc(T('Answer'))}" data-latest-msg="${esc(T('Latest message:'))}" data-latest-pic="${esc(T('Latest image'))}">
        <script type="application/json" id="dome-sky-data">${json}</script>
        ${skyNotes(T)}
      </div>`;
  return { html, on };
}

/**
 * The notes a touch on the sky brings (public/sky.js clones one and stands it
 * beside what was touched): on a snapshot, that this is the live feed from
 * the habitat, and a key to the Media gallery; on an exchange, that this is
 * the latest communication from the habitat, and a key to it on the board.
 * A name and a key — no more words: the picture and the exchange say the rest.
 */
function skyNotes(T) {
  const x = `<button type="button" class="sky-note-x" aria-label="${esc(T('Close'))}"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18"/></svg></button>`;
  return `
        <template id="sky-note-pic">
          <div class="sky-note is-pic" role="note">${x}
            <b class="sky-note-k"><i></i>${T('LIVE FEED')}</b>
            <span class="sky-note-t">${T('Live feed from the habitat')}</span>
            <a class="sky-note-btn" href="/media">${T('Media Gallery')}</a>
          </div>
        </template>
        <template id="sky-note-msg">
          <div class="sky-note is-msg" role="note">${x}
            <b class="sky-note-k"><i></i>${T('LATEST COMMUNICATION')}</b>
            <span class="sky-note-t">${T('The latest communication from the habitat')}</span>
            <a class="sky-note-btn sky-note-open" href="/write#exchanges">${T('Message Board')}</a>
          </div>
        </template>`;
}

/* ------------------------------------------------------------------ the sheet under it */
/*
 * The sheet the habitat stands on, after a sequencer's layout sheet (the reference the design took its ground from: a grey
 * sheet ruled in fine columns, a ruler across its top, tracks running across it — dashed, doubled, dotted, one carrying a
 * wave, one a row of steps — a line or two of small figures on them, and one great glow in the middle, ultramarine going
 * over into red). Here the columns are the run's sols, thirteen of them, a ruler of their numbers across the top with the
 * sol the run is on in Mars orange and an orange line down its column; the station's name, large, in the top left corner
 * under the ruler (a phone's first screen is the sheet, so the sheet carries the name; the sky keeps clear of it like
 * the small figure) and LIVE in the top right corner opposite it; the figure is the station's own — the crew and the
 * sol (not the one-way signal: that is read where a message is written); and the glow stands
 * behind the dome, from Earth's blue to Mars's red, and ends at the ground the dome stands on. The dome is glass over it
 * (aura.css); the sky's snapshots and lines come and go on top (above). public/sky.js keeps the day's line on the day
 * and the glow behind the dome.
 * Decorative: hidden from assistive technology; the same figures are on the page in words.
 */
const TRACKS = [                     // across the sheet: where (a part of its height), how drawn, from and to (parts of its width)
  { y: 0.17, k: 'double', a: 0, b: 1 },
  { y: 0.31, k: 'dash', a: 0.52, b: 1 },
  { y: 0.44, k: 'solid', a: 0, b: 0.34 },
  { y: 0.58, k: 'dot', a: 0, b: 1 },
  { y: 0.73, k: 'dash', a: 0, b: 0.62 },
  { y: 0.86, k: 'solid', a: 0.4, b: 1 },
];
const WAVES = [                      // a wave on a track: where it starts, how wide, which (a sine, a square, a burst)
  { x: 0.74, y: 0.31, w: 0.2, k: 'sine' },
  { x: 0.06, y: 0.73, w: 0.16, k: 'square' },
  { x: 0.8, y: 0.86, w: 0.14, k: 'burst' },
];
const STEPS = [{ x: 0.08, y: 0.44, n: 5 }, { x: 0.83, y: 0.58, n: 4 }];   // a row of steps on a track

function wave(k) {
  if (k === 'square') return 'M0 9 H6 V3 H12 V9 H18 V3 H24 V9 H30 V3 H36 V9 H42 V3 H48 V9 H54 V3 H60 V9';
  if (k === 'burst') return 'M0 6 L4 6 L6 2 L8 10 L10 1 L12 11 L14 3 L16 9 L18 5 L20 7 L22 6 L60 6';
  let d = 'M0 6';
  for (let i = 0; i < 6; i++) d += ` Q${i * 10 + 2.5} ${i % 2 ? 11 : 1} ${i * 10 + 5} 6 T${i * 10 + 10} 6`;
  return d;
}

function habitatSheet(ctx) {
  const T = ctx.T, m = ctx.mission, days = m.totalDays;
  const on = m.phase === 'ACTIVE' ? m.clampedDay : 0;
  const pct = (v) => `${(v * 100).toFixed(2)}%`;
  const ruler = Array.from({ length: days }, (_, i) => `<span class="seq-n${i + 1 === on ? ' is-now' : ''}">${String(i + 1).padStart(2, '0')}</span>`).join('');
  // the day the performance is on: an orange line down its column, from under its number (the page moves it on at
  // midnight, public/sky.js); before the run and after it there is none
  const head = on ? `<i class="seq-head" style="--day:${on}"></i>` : '';
  const sol = on ? `SOL ${String(on).padStart(2, '0')}/${days}` : m.phase === 'PRE_LAUNCH' ? `T−${m.countdown.days}D` : `SOL ${days}/${days}`;
  const figures = [
    { x: 0.015, y: 0.58, t: `${T('CREW')} 3 · ${sol}` },
  ];
  // LIVE in the top right corner, opposite the name, while there is a habitat to be live: the readings, the pictures
  // and the exchanges on the sheet are the habitat as it is now (after the run the sheet is the record)
  const live = m.phase === 'COMPLETE' ? '' : `<span class="seq-fig seq-live" title="${esc(T('Live — the habitat as it is now: its readings, the newest pictures and the latest exchanges'))}"><i></i>${T('LIVE')}</span>`;
  return `
      <div class="dome-seq${on ? ' has-day' : ''}" id="dome-seq" aria-hidden="true" style="--seq-days:${days}">
        <div class="seq-glow"><i class="seq-orb"></i></div>
        <div class="seq-grid"></div>
        <div class="seq-ruler">${ruler}</div>
        <span class="seq-fig seq-brand">MARS<b class="bang">!</b>platz</span>${live}
        ${TRACKS.map((t) => `<i class="seq-t seq-${t.k}" style="top:${pct(t.y)};left:${pct(t.a)};right:${pct(1 - t.b)}"></i>`).join('')}
        ${WAVES.map((w) => `<svg class="seq-wave" viewBox="0 0 60 12" preserveAspectRatio="none" style="left:${pct(w.x)};top:${pct(w.y)};width:${pct(w.w)}"><path d="${wave(w.k)}"/></svg>`).join('')}
        ${STEPS.map((st) => `<i class="seq-steps" style="left:${pct(st.x)};top:${pct(st.y)}">${'<b></b>'.repeat(st.n)}</i>`).join('')}
        ${figures.map((f) => `<span class="seq-fig" style="left:${pct(f.x)};top:${pct(f.y)}">${esc(f.t)}</span>`).join('')}
        ${head}
      </div>`;
}

module.exports = { habitatSky, habitatSheet, stamp, responder };
