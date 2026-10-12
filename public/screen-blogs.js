/* MARS!platz — the installation's Blogs screen (src/views/pages/screens.js, blogs).
 *
 * The three blogs one at a time, each filling the screen: its head — the name, the sol and the date — stays; the day's
 * post rolls by underneath from top to bottom at reading pace, and when its end has been in view for a moment the next
 * blog takes the screen: the Commander Log, then the Daily Mission Report, then the Health Report, round and
 * round. A post short enough to fit is simply shown for a while; a blog with nothing written yet shows its note and
 * passes the turn on. The post is moved by transform, not scrolled, so nothing on the screen can be dragged.
 * It rolls as fast as the habitat's roll on the same screen (9 October: "make the speed of the blog scroll the same as
 * the sensor scroll"): the habitat rolls 14 of its layout's pixels a second (screen-roll.js), its layout zoomed to the
 * screen's width — laid out 1920 wide, 1080 upright (screen.js, rollZoom) — while a blog is drawn at the screen's own
 * pixels, so a blog rolls 14 times that zoom: 14 pixels a second on a screen 1920 wide (or 1080 upright), 28 on a 4K
 * screen. (28 a second on any screen until then: twice the habitat's pace on a screen 1920 wide.)
 * On a light screen — one whose address says ?lite=1 (html.lite; screens.js, screen-lite.css; 12 October:
 * "make the pages very very light … computers with not so much graphics power … glitching and giving artifacts") — the
 * post does not roll: it turns a page at a time, at once, each page beginning with the first paragraph (or picture) the
 * page before showed only in part, what lies under its last whole one out of sight until the next (clipped), a
 * paragraph taller than the screen a screenful at a time; each page stands as long as the roll would have taken to bring
 * it by at the habitat's pace — ten seconds at the least, seventy-five at the most — and after the last, the next blog.
 * Speed and pauses can be set on the wrapper: data-speed (pixels a second), data-hold (ms at the top and at the end). */
(function () {
  'use strict';
  var wrap = document.getElementById('screen-blogs'); if (!wrap) return;
  var panels = [].slice.call(wrap.querySelectorAll('.dpanel.blogp')); if (!panels.length) return;
  var SPEED = Number(wrap.getAttribute('data-speed')) || 0;               // pixels a second, if set; otherwise the habitat's pace
  function habitatPace() {
    var z = Math.max(0.5, Math.min(2, window.innerWidth / (window.innerWidth > window.innerHeight ? 1920 : 1080)));
    return 20 * z;
  }
  var HOLD = Number(wrap.getAttribute('data-hold')) || 5000;               // at the top before rolling, and at the end
  var SHORT = Number(wrap.getAttribute('data-short')) || 14000;            // a post that fits, or nothing written: this long
  var LITE = document.documentElement.classList.contains('lite');         // a light screen: a page at a time (above)
  var current = -1, raf = 0, timer = 0;
  function stop() { cancelAnimationFrame(raf); raf = 0; clearTimeout(timer); timer = 0; }
  function next() { show((current + 1) % panels.length); }
  function show(n) {
    stop();
    current = n;
    panels.forEach(function (p, k) { p.classList.toggle('is-on', k === n); });
    var panel = panels[n], body = panel.querySelector('.dpanel-body'), roll = panel.querySelector('.blog-scroll');
    if (roll) { roll.style.transition = 'none'; roll.style.transform = 'translateY(0)'; roll.style.clipPath = ''; }
    // a moment for the fonts and pictures, then measure: how far the post reaches below the body
    timer = setTimeout(function () {
      var need = roll ? roll.scrollHeight - body.clientHeight : 0;
      if (!roll || need <= 8) { timer = setTimeout(next, SHORT); return; }
      if (LITE) { pages(roll, body); return; }
      timer = setTimeout(function () {
        var start = 0, y = 0, pace = SPEED || habitatPace();              // the pace set once a roll, so it never jumps
        function frame(t) {
          if (!start) start = t;
          y = Math.min(need, (t - start) / 1000 * pace);
          roll.style.transform = 'translateY(' + (-y).toFixed(1) + 'px)';
          if (y < need) raf = requestAnimationFrame(frame);
          else timer = setTimeout(next, HOLD);
        }
        raf = requestAnimationFrame(frame);
      }, HOLD);
    }, 400);
  }
  // a light screen: the post a page at a time (above) — the page that stands at `at` (the post moved up by `at`, in its
  // own pixels) ends where the next begins: at the top of the first paragraph or picture the page shows only in part (one
  // no taller than most of the screen, which the next page shows whole), or, where nothing is cut so, with the first one
  // under the page; one taller than the screen is broken a screenful on. Null: the page is the last.
  function breakAfter(roll, body, at) {
    var H = body.clientHeight, foot = at - roll.offsetTop + H, k = roll.getBoundingClientRect();
    var f = k.height ? roll.offsetHeight / k.height : 1, end = roll.offsetHeight;
    if (end <= foot + 1) return null;
    var cut = Infinity, under = Infinity, els = roll.querySelectorAll('*'), i, el, r, t, h;
    for (i = 0; i < els.length; i++) {
      el = els[i];
      if (!(el instanceof HTMLElement) || el.offsetHeight < 16) continue;
      r = el.getBoundingClientRect(); t = (r.top - k.top) * f; h = r.height * f;
      if (h > H * 0.9) continue;
      if (t > at + 1 && t < foot - 1 && t + h > foot + 1) cut = Math.min(cut, t);
      else if (t >= foot - 1) under = Math.min(under, t);
    }
    var to = cut < Infinity ? cut : under < foot + H * 0.5 ? under : foot - 40;
    return to >= end - 1 ? null : Math.round(to);
  }
  function pages(roll, body) {
    var y = 0, pace = SPEED || habitatPace();                            // (the roll's pace: how long a page stands)
    function page() {
      roll.style.transform = 'translateY(' + (-Math.round(y)) + 'px)';
      var to = breakAfter(roll, body, y), foot = y - roll.offsetTop + body.clientHeight;
      roll.style.clipPath = to != null && to < foot - 1 ? 'inset(0 0 ' + Math.max(0, Math.round(roll.offsetHeight - to) + 3) + 'px 0)' : '';
      var shown = (to != null ? to : roll.offsetHeight) - y;              // the height of what the page shows
      timer = setTimeout(function () {
        if (to == null) { next(); return; }
        y = to; page();
      }, Math.max(10000, Math.min(75000, shown / pace * 1000)));
    }
    page();
  }
  // a picture that finishes loading changes the post's height: measured again from the top
  wrap.addEventListener('load', function (e) { if (e.target && e.target.tagName === 'IMG' && current >= 0) show(current); }, true);
  show(0);
})();
