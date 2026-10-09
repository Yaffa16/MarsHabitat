/* MARS!platz — the mission screen's turns (src/views/pages/screens.js, mission; public/screen.css).
 *
 * The day's mission, typed (public/typed.js); ten seconds after it stands whole (data-after), the day — the schedule,
 * the meal and the crew's moods, as the Today screen shows them — for half a minute (data-hold); then the mission again,
 * typed from its first letter, and so on, round and round (8 October: "in /screen/mission display the daily mission as
 * it is currently shown; once it is fully shown wait ten seconds, then display what /screen/day shows; keep looping").
 * Where the mission is not typed (less motion asked for, or no words to type) it stands whole for half a minute before
 * the day. The screen fits each turn as it comes (screen.js sees the change). Nothing here is sent anywhere. */
(function () {
  'use strict';
  var root = document.getElementById('screen-turns'); if (!root) return;
  var mission = root.querySelector('.turn[data-turn="mission"]'), day = root.querySelector('.turn[data-turn="day"]');
  if (!mission || !day) return;
  var AFTER = Number(root.getAttribute('data-after')) || 10000, HOLD = Number(root.getAttribute('data-hold')) || 30000;
  var STILL = 30000;                                                     // an untyped mission's time on the screen
  var timer = 0, typing = false;
  function show(t) { [mission, day].forEach(function (x) { x.classList.toggle('is-on', x === t); }); }
  function toDay() { clearTimeout(timer); show(day); timer = setTimeout(toMission, HOLD); }
  function toMission() {
    clearTimeout(timer); show(mission);
    if (typing && window.MCSTyped) window.MCSTyped.restart();          // typed again; it says when it is done (below)
    else timer = setTimeout(toDay, STILL);
  }
  document.addEventListener('mcs:typed', function () {                  // typed to its end: ten seconds, then the day
    typing = true;
    if (!mission.classList.contains('is-on')) return;
    clearTimeout(timer); timer = setTimeout(toDay, AFTER);
  });
  // typed.js is there and types (it set MCSTyped): it will say when it is done — else the mission stands whole for a while
  typing = !!window.MCSTyped && !!root.querySelector('#mission-today .mission-body .tw');
  if (!typing) timer = setTimeout(toDay, STILL);
})();
