/* MARS!platz — the dashboard, alive (the ornaments are drawn by src/views/pages/public.js, dashLive and vizTile, and
 * styled under "the dashboard, alive" in aura.css; the stylesheet does the blinking, the sweep and the pulses on its own).
 *
 * Two things the stylesheet cannot do:
 *  - the astronauts on the radar (Astronauts tracked): one dot each, wandering about the disc — each glides on a slow
 *    spring towards a place of its own inside the rings and, arriving, picks another; two never sit on each other; a
 *    dot is lit as the sweep passes over it and dims until it comes round again. As many dots as the crew (public.js).
 *    They wander at a third of the pace they first had (8 October: "reduce the movement of the dots to a third"): their
 *    clock runs at PACE, the sweep's at the page's;
 *  - the figures in the dashboard's head roll up from zero to their value when the page opens (the sol, the crew), as a
 *    readout settling — the values themselves are the page's, untouched.
 * Where the visitor asks for less motion the dots stand where they are, lit, and the figures stand as written.
 * Nothing here is sent anywhere. */
(function () {
  'use strict';
  var calm = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* ------------------------------------------------------------ the astronauts, wandering about the radar */
  var radar = document.querySelector('.dl-radar');
  if (radar && !calm && window.requestAnimationFrame) {
    var TURN = 4000, LIM = 40, C = 60;                       // the sweep's period (aura.css); how far from the centre a dot may go; the centre
    var PACE = 1 / 3;                                        // the dots' own clock against the page's: a third of their first pace
    var dots = [].slice.call(radar.querySelectorAll('.dl-astro')).map(function (el, i) {
      var x = Number(el.getAttribute('cx')) - C, y = Number(el.getAttribute('cy')) - C;
      return { el: el, x: x, y: y, vx: 0, vy: 0, to: null, until: 0, lit: 0.55, seen: -1 + i * 0.1 };
    });
    if (dots.length) {
      // somewhere else inside the rings, well away from where the others are heading
      function somewhere(me) {
        var best = null, bestD = -1;
        for (var c = 0; c < 6; c++) {
          var a = Math.random() * Math.PI * 2, r = 6 + Math.sqrt(Math.random()) * (LIM - 6), q = [r * Math.cos(a), r * Math.sin(a)], near = Infinity;
          dots.forEach(function (o) { if (o === me || !o.to) return; var dx = o.to[0] - q[0], dy = o.to[1] - q[1]; near = Math.min(near, dx * dx + dy * dy); });
          if (near > bestD) { bestD = near; best = q; }
        }
        return best;
      }
      dots.forEach(function (d) { d.to = somewhere(d); d.until = 6 + Math.random() * 8; });
      var last = null, t0 = null, sw = radar.querySelector('.dl-sweep');
      function frame(now) {
        var real = last == null ? 0.016 : Math.min(0.05, (now - last) / 1000); last = now; if (t0 == null) t0 = now;
        var dt = real * PACE;                                                          // the dots move, wait and part on their own, slower clock
        // the sweep: where the stylesheet's turn is at this moment (a turn in TURN ms from twelve o'clock, clockwise),
        // read off its animation where the browser tells it, else counted from the first frame
        var anim = sw && sw.getAnimations ? sw.getAnimations()[0] : null, at = anim && typeof anim.currentTime === 'number' ? anim.currentTime : now - t0;
        var sweep = ((at % TURN) + TURN) % TURN / TURN;
        dots.forEach(function (d) {
          var dx = d.to[0] - d.x, dy = d.to[1] - d.y, dist = Math.sqrt(dx * dx + dy * dy);
          d.until -= dt;
          if (dist < 1.5 || d.until <= 0) { d.to = somewhere(d); d.until = 6 + Math.random() * 8; }
          d.vx += (dx * 0.6 - d.vx * 1.4) * dt; d.vy += (dy * 0.6 - d.vy * 1.4) * dt;
        });
        // two dots that would sit on each other ease apart
        for (var i = 0; i < dots.length; i++) for (var j = i + 1; j < dots.length; j++) {
          var a = dots[i], b = dots[j], ex = b.x - a.x, ey = b.y - a.y, dd = Math.sqrt(ex * ex + ey * ey) || 0.01;
          if (dd < 9) { var push = (9 - dd) / 9 * 14 * dt; a.vx -= ex / dd * push; a.vy -= ey / dd * push; b.vx += ex / dd * push; b.vy += ey / dd * push; }
        }
        dots.forEach(function (d) {
          var speed = Math.sqrt(d.vx * d.vx + d.vy * d.vy), cap = 7;                   // units a second, at most
          if (speed > cap) { d.vx *= cap / speed; d.vy *= cap / speed; }
          d.x += d.vx * dt; d.y += d.vy * dt;
          var r = Math.sqrt(d.x * d.x + d.y * d.y); if (r > LIM) { d.x *= LIM / r; d.y *= LIM / r; }
          d.el.setAttribute('cx', (C + d.x).toFixed(1)); d.el.setAttribute('cy', (C + d.y).toFixed(1));
          // lit as the sweep passes: the dot's bearing from twelve o'clock, clockwise, as a part of a turn
          var bearing = (Math.atan2(d.x, -d.y) / (Math.PI * 2) + 1) % 1, since = (sweep - bearing + 1) % 1;
          d.el.style.opacity = (0.4 + 0.6 * (1 - since)).toFixed(3);
        });
        if (!document.hidden) requestAnimationFrame(frame);
      }
      requestAnimationFrame(frame);
      document.addEventListener('visibilitychange', function () { if (!document.hidden) { last = null; requestAnimationFrame(frame); } });
    }
  }

  /* ------------------------------------------------------------ the figures, rolling up to their value once */
  var figs = [].slice.call(document.querySelectorAll('.dash-figs .dash-fig > b'));
  if (figs.length && !calm && window.requestAnimationFrame) {
    figs.forEach(function (b) {
      var text = b.firstChild && b.firstChild.nodeType === 3 ? b.firstChild : null; if (!text) return;
      var m = /^(\D*)(\d+)(.*)$/.exec(text.nodeValue); if (!m) return;
      var lead = m[1], target = Number(m[2]), width = m[2].length, tail = m[3], t0 = null, D = 1100;
      function frame(ts) {
        if (!t0) t0 = ts;
        var p = Math.min(1, (ts - t0) / D), e = 1 - Math.pow(1 - p, 3);
        text.nodeValue = lead + String(Math.round(target * e)).padStart(width, '0') + tail;
        if (p < 1) requestAnimationFrame(frame); else text.nodeValue = lead + m[2] + tail;
      }
      text.nodeValue = lead + '0'.padStart(width, '0') + tail;
      requestAnimationFrame(frame);
    });
  }
})();
