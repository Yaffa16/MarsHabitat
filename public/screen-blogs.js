/* MARS!platz — the installation's Blogs screen (src/views/pages/screens.js, blogs).
 *
 * The three blogs one at a time, each filling the screen: its head — the name, the sol and the date — stays; the day's
 * post rolls by underneath from top to bottom at reading pace, and when its end has been in view for a moment the next
 * blog takes the screen: the Commander Log, then the Daily Mission Report, then the Health Report, round and
 * round. A post short enough to fit is simply shown for a while; a blog with nothing written yet shows its note and
 * passes the turn on. The post is moved by transform, not scrolled, so nothing on the screen can be dragged.
 * Speed and pauses can be set on the wrapper: data-speed (pixels a second), data-hold (ms at the top and at the end). */
(function () {
  'use strict';
  var wrap = document.getElementById('screen-blogs'); if (!wrap) return;
  var panels = [].slice.call(wrap.querySelectorAll('.dpanel.blogp')); if (!panels.length) return;
  var SPEED = Number(wrap.getAttribute('data-speed')) || 28;              // pixels a second: a slow read
  var HOLD = Number(wrap.getAttribute('data-hold')) || 5000;               // at the top before rolling, and at the end
  var SHORT = Number(wrap.getAttribute('data-short')) || 14000;            // a post that fits, or nothing written: this long
  var current = -1, raf = 0, timer = 0;
  function stop() { cancelAnimationFrame(raf); raf = 0; clearTimeout(timer); timer = 0; }
  function next() { show((current + 1) % panels.length); }
  function show(n) {
    stop();
    current = n;
    panels.forEach(function (p, k) { p.classList.toggle('is-on', k === n); });
    var panel = panels[n], body = panel.querySelector('.dpanel-body'), roll = panel.querySelector('.blog-scroll');
    if (roll) { roll.style.transition = 'none'; roll.style.transform = 'translateY(0)'; }
    // a moment for the fonts and pictures, then measure: how far the post reaches below the body
    timer = setTimeout(function () {
      var need = roll ? roll.scrollHeight - body.clientHeight : 0;
      if (!roll || need <= 8) { timer = setTimeout(next, SHORT); return; }
      timer = setTimeout(function () {
        var start = 0, y = 0;
        function frame(t) {
          if (!start) start = t;
          y = Math.min(need, (t - start) / 1000 * SPEED);
          roll.style.transform = 'translateY(' + (-y).toFixed(1) + 'px)';
          if (y < need) raf = requestAnimationFrame(frame);
          else timer = setTimeout(next, HOLD);
        }
        raf = requestAnimationFrame(frame);
      }, HOLD);
    }, 400);
  }
  // a picture that finishes loading changes the post's height: measured again from the top
  wrap.addEventListener('load', function (e) { if (e.target && e.target.tagName === 'IMG' && current >= 0) show(current); }, true);
  show(0);
})();
