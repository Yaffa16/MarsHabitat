/* MARS!platz — the mission screen's turns (src/views/pages/screens.js, mission; public/screen.css).
 *
 * One thing at a time, and still (9 October: "in the mission screen undo the typing; only show the mission, in large
 * type — the screen glitches and does not show the typing or small type well; then today's schedule, today's meal and the
 * crew's moods, one after another, not on the same page; no typing, no movement"): the day's mission in large type, then
 * the schedule, the meal and the crew's moods, each alone on the screen for its own time (data-hold on the turn), and
 * round again. A turn changes at once — no fade, nothing types, nothing moves — and is fitted to the screen before it is
 * drawn (screen.js, MCSScreenFit), so it never shows at the last one's size first. (Until then the mission was typed out
 * letter by letter, and the page was fitted again with every letter: the screen jumped as it typed.)
 * Nothing here is sent anywhere. */
(function () {
  'use strict';
  var root = document.getElementById('screen-turns'); if (!root) return;
  var turns = [], kids = root.children, i;
  for (i = 0; i < kids.length; i++) if (kids[i].classList.contains('turn')) turns.push(kids[i]);
  if (!turns.length) return;
  var at = 0, timer = 0;
  function show(n) {
    at = n;
    for (var k = 0; k < turns.length; k++) turns[k].classList.toggle('is-on', k === n);
    if (window.MCSScreenFit) window.MCSScreenFit();                     // fitted now, before the screen is drawn again
    clearTimeout(timer);
    if (turns.length > 1) timer = setTimeout(function () { show((at + 1) % turns.length); }, Number(turns[n].getAttribute('data-hold')) || 20000);
  }
  // (for the station's tests and a look at one turn: MCSTurns.show('galley') — it carries on round from there)
  window.MCSTurns = { show: function (name) { for (var k = 0; k < turns.length; k++) if (turns[k].getAttribute('data-turn') === name) { show(k); return true; } return false; } };
  show(0);
})();
