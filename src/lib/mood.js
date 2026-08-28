'use strict';

/**
 * The public never sees numbers. Control files one value 0–100; this file is
 * the only place where that value becomes language. Keeping the mapping in
 * one file means the tone of the whole crew section can be retuned without
 * touching any template.
 */

/**
 * One scale: how they are. Calm at one end, angry at the other, filed as a
 * row of five faces in mission control — more resolution than that was more
 * than anyone can honestly report at the end of a working day.
 *
 * The database columns are unchanged: `calm_tense` carries the value
 * (0 = calm, 100 = angry), and the older columns still read correctly for
 * anything filed under the earlier schemes.
 */
const AXES = [
  {
    key: 'calm_tense', low: 'CALM', high: 'ANGRY', label: 'Mood',
    bands: [
      'calm, at ease with the day',
      'settled, working steadily',
      'level — neither calm nor cross',
      'tense, short with the others',
      'angry, needing distance',
    ],
  },
];

const bandIndex = (v) => (v < 20 ? 0 : v < 40 ? 1 : v < 60 ? 2 : v < 80 ? 3 : 4);

/** Single-word overall condition, shown as the crew card headline. */
function condition(mood) {
  if (!mood) return 'NO DATA';
  const v = mood.calm_tense;
  if (v < 20) return 'CALM';
  if (v < 40) return 'SETTLED';
  if (v < 60) return 'LEVEL';
  if (v < 80) return 'TENSE';
  return 'ANGRY';
}

/** Full public reading for one crew member. */
function translate(mood) {
  if (!mood) {
    return { condition: 'NO DATA', lines: [], axes: [], load: 0,
             summary: 'No report has been received from this crew member.' };
  }
  const axes = AXES.map((a) => {
    const v = mood[a.key];
    const i = bandIndex(v);
    return {
      key: a.key, label: a.label, value: v, band: i,
      pole: v < 50 ? a.low : a.high,
      low: a.low, high: a.high,
      text: a.bands[i],
    };
  });
  const load = axes[0].value;
  const summary = axes.map((a) => a.text).join('; ') + '.';
  return { condition: condition(mood), axes, lines: axes.map((a) => a.text), load, summary };
}

/** The five faces, calm to angry, as inline SVG for wherever the scale is drawn. */
const FACES = [
  { v: 0,   name: 'Calm',    mouth: 'M10 19 q6 5 12 0', eyes: 'arc' },
  { v: 25,  name: 'Settled', mouth: 'M11 19 q5 3 10 0', eyes: 'dot' },
  { v: 50,  name: 'Level',   mouth: 'M11 20 h10',       eyes: 'dot' },
  { v: 75,  name: 'Tense',   mouth: 'M11 21 q5 -4 10 0', eyes: 'dot' },
  { v: 100, name: 'Angry',   mouth: 'M10 22 q6 -5 12 0', eyes: 'brow' },
];
function faceSvg(f) {
  const eyes = f.eyes === 'arc'
    ? '<path d="M10 13 q2 -2.5 4 0" fill="none"/><path d="M18 13 q2 -2.5 4 0" fill="none"/>'
    : f.eyes === 'brow'
      ? '<circle cx="12" cy="14" r="1.4" fill="currentColor" stroke="none"/><circle cx="20" cy="14" r="1.4" fill="currentColor" stroke="none"/><path d="M9.5 10.5 l5 2"/><path d="M22.5 10.5 l-5 2"/>'
      : '<circle cx="12" cy="13" r="1.4" fill="currentColor" stroke="none"/><circle cx="20" cy="13" r="1.4" fill="currentColor" stroke="none"/>';
  return `<svg viewBox="0 0 32 32" aria-hidden="true" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" fill="none">
    <circle cx="16" cy="16" r="13"/>${eyes}<path d="${f.mouth}"/></svg>`;
}

module.exports = { AXES, translate, condition, FACES, faceSvg };
