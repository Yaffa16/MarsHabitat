'use strict';

/**
 * The public never sees numbers. Control sets four axes 0-100; this file is
 * the only place where those values become language. Keeping the mapping in
 * one file means the tone of the whole crew section can be retuned without
 * touching any template.
 */

/**
 * Two axes: how they feel, and how much they have left. Four was more
 * resolution than anyone can honestly report on at the end of a working day,
 * and the two that mattered were always these.
 *
 * The database columns are unchanged so the history filed under the old
 * four-axis scheme still reads: `calm_tense` carries mood, and
 * `energetic_exhausted` carries energy.
 */
const AXES = [
  {
    key: 'calm_tense', low: 'SETTLED', high: 'STRAINED', label: 'Mood',
    bands: [
      'settled, working without urgency',
      'steady, minor irritation reported',
      'watchful, holding tension in the body',
      'strained, short with the others',
    ],
  },
  {
    key: 'energetic_exhausted', low: 'RESTED', high: 'SPENT', label: 'Energy',
    bands: [
      'well rested, moving quickly',
      'functional, pacing carefully',
      'tired, tasks taking longer than planned',
      'depleted, running on routine alone',
    ],
  },
];

const bandIndex = (v) => (v < 25 ? 0 : v < 50 ? 1 : v < 75 ? 2 : 3);

/** Single-word overall condition, shown as the crew card headline. */
function condition(mood) {
  if (!mood) return 'NO DATA';
  const load = (mood.calm_tense + mood.energetic_exhausted) / 2;
  if (load < 20) return 'STEADY';
  if (load < 38) return 'NOMINAL';
  if (load < 55) return 'VARIABLE';
  if (load < 72) return 'STRAINED';
  if (load < 86) return 'FATIGUED';
  return 'CRITICAL';
}

/** Full public reading for one crew member. */
function translate(mood) {
  if (!mood) {
    return { condition: 'NO DATA', lines: [], axes: [], load: 0,
             summary: 'No psychological report has been received from this crew member.' };
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
  const load = Math.round(axes.reduce((s, a) => s + a.value, 0) / axes.length);
  const summary = axes.map((a) => a.text).join('; ') + '.';
  return { condition: condition(mood), axes, lines: axes.map((a) => a.text), load, summary };
}

module.exports = { AXES, translate, condition };
