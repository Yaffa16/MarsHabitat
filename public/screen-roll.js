/* MARS!platz — the installation's Habitat screen, rolled (src/views/pages/screens.js, habitat; public/screen.css).
 *
 * The Sensors panel read from across a room (8 October: "the screen/habitat should have a vertical layout with
 * scrolling, to show all the content clearly and slowly — no overlap of text, no glitching"): the panel fills the
 * screen and its head stays; everything in it — the instruments and Karlsruhe, the steps and the stores, the power and
 * the astronauts, the hardware's charts — stands at its full size, one row under the other, and rolls by under the head at
 * a slow, even pace. At the top it rests a while; at the end it rests, fades, and comes back from the top. What fits the
 * screen is simply shown. The readings stay live underneath (habitat.js, hardware.js, live.js): a figure changes in its
 * place, and a change of height — a note arriving, a chart drawn anew — is taken into account at once. The sheet's edge
 * fades where it passes under the head and where more is still to come (screen.css, .is-rolled / .has-more).
 * Moved by transform, not scrolled: nothing on the screen can be dragged. Asked for less motion, the sheet turns over a
 * screenful at a time instead of rolling. The page's own reloads (screen.js) wait for the moment the sheet is faded out,
 * so a reload never cuts the roll short. Nothing here is ever sent anywhere.
 * On a light screen — one whose address says ?lite=1 (html.lite; screens.js, screen-lite.css; 12 October:
 * "make the pages very very light … computers with not so much graphics power … glitching and giving artifacts") — the
 * sheet does not roll: it turns a page at a time, at once — no movement, no fade, no layer held for it. Each page begins
 * with the first row the page before showed only in part, and what lies under the page's last whole row is out of sight
 * until the next (clipped), so every page shows whole rows; a row taller than the screen is shown a screenful at a time.
 * Each page stands for data-page-hold (15 s); after the last, back to the top (where a reload that is due comes).
 * Speed and pauses can be set on the wrapper: data-speed (pixels a second), data-hold (ms at the top and at the end). */
(function () {
  'use strict';
  var root = document.getElementById('screen-roll'); if (!root) return;
  var view = root.querySelector('.dpanel-body'); if (!view) return;
  var SPEED = Number(root.getAttribute('data-speed')) || 14;              // pixels a second, in the layout's own pixels: a slow read (half the first 28 — 8 October)
  var HOLD = Number(root.getAttribute('data-hold')) || 8000;               // at the top before rolling, and at the end
  var FADE = 900;                                                          // the sheet fading out at the end, and in at the top
  var calm = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var LITE = document.documentElement.classList.contains('lite');           // a light screen: a page at a time (above)
  var PAGE = Number(root.getAttribute('data-page-hold')) || 15000;         // a light screen: how long each page stands

  // everything in the panel's body on one sheet, moved as one (the scripts that keep it live hold on to their own
  // elements, which move with it)
  var sheet = document.createElement('div');
  sheet.className = 'roll-in';
  while (view.firstChild) sheet.appendChild(view.firstChild);
  view.appendChild(sheet);
  view.classList.add('roll-view');

  var y = 0, need = 0, phase = '', raf = 0, timer = 0, last = 0, reloadWanted = false;
  function measure() {
    // how far the sheet reaches below the body's foot (both in the layout's pixels, whatever the screen's zoom)
    need = Math.max(0, Math.round(sheet.offsetTop + sheet.offsetHeight - view.clientHeight));
    if (y > need && !LITE) { y = need; place(); }                          // (a light screen's last page may stand past the end: its rows whole)
  }
  function place() {
    if (LITE) {                                                             // a light screen: whole pixels, no layer, the rows under the page's last whole one out of sight
      sheet.style.transform = y > 0 ? 'translateY(' + (-Math.round(y)) + 'px)' : '';
      var nb = breakAfter(y), foot = y - sheet.offsetTop + view.clientHeight;
      sheet.style.clipPath = nb != null && nb < foot - 1 ? 'inset(0 0 ' + Math.max(0, Math.round(sheet.offsetHeight - nb) + 3) + 'px 0)' : '';   // (3 px over the break: no hairline of the next row's edge)
    } else sheet.style.transform = y > 0 ? 'translate3d(0,' + (-y).toFixed(1) + 'px,0)' : '';
    if (view.classList.contains('is-rolled') !== (y > 2)) view.classList.toggle('is-rolled', y > 2);
    if (view.classList.contains('has-more') !== (need - y > 2)) view.classList.toggle('has-more', need - y > 2);
  }
  // a light screen's page breaks: where the page that stands at `at` ends — in the sheet's own pixels, the page beginning
  // at its top (the sheet moved up by `at`) — the next page begins: at the top of the first row the page shows only in
  // part (a row no taller than most of the screen, which the next page then shows whole), or, where nothing is cut so,
  // with the first row under the page; a row taller than the screen is broken a screenful on. Null: the page is the last.
  function breakAfter(at) {
    var H = view.clientHeight, foot = at - sheet.offsetTop + H, k = sheet.getBoundingClientRect();
    var f = k.height ? sheet.offsetHeight / k.height : 1, end = sheet.offsetHeight;   // (the layout's pixels for the screen's)
    if (end <= foot + 1) return null;                                       // all of the rest is on the page
    var cut = Infinity, under = Infinity, els = sheet.querySelectorAll('*'), i, el, r, t, h;
    for (i = 0; i < els.length; i++) {
      el = els[i];
      if (!(el instanceof HTMLElement) || el.offsetHeight < 24) continue;
      r = el.getBoundingClientRect(); t = (r.top - k.top) * f; h = r.height * f;
      if (h > H * 0.9) continue;                                            // too tall to stand whole: broken inside
      if (t > at + 1 && t < foot - 1 && t + h > foot + 1) cut = Math.min(cut, t);
      else if (t >= foot - 1) under = Math.min(under, t);
    }
    var to = cut < Infinity ? cut : under < foot + H * 0.5 ? under : foot - 40;   // (a screenful on, a little of it again)
    return to >= end - 1 ? null : Math.round(to);
  }
  // a light screen: the next page, at once; after the last, a while, then the top again
  function nextPage() {
    phase = 'down';
    var to = breakAfter(y);
    if (to == null) { atEnd(); return; }
    y = to; place();
    if (breakAfter(y) == null) { atEnd(); return; }                         // the last page: it stands its while (atEnd), then the top
    timer = setTimeout(nextPage, PAGE);
  }
  function stop() { cancelAnimationFrame(raf); raf = 0; clearTimeout(timer); timer = 0; }

  // at rest at the top: a while, then down — or, all of it in view, simply shown (looked at again now and then: a
  // chart or a note may make it taller)
  function atTop() {
    stop(); phase = 'top'; y = 0; measure(); place();
    if (reloadWanted) { location.reload(); return; }
    timer = setTimeout(function () {
      measure();
      if (need <= 8) { atTop(); return; }
      if (LITE) { nextPage(); return; }
      if (calm) { turnPage(); return; }
      phase = 'down'; last = 0; raf = requestAnimationFrame(roll);
    }, LITE ? PAGE : HOLD);
  }
  function roll(now) {
    var dt = last ? Math.min(0.1, (now - last) / 1000) : 0; last = now;
    y = Math.min(need, y + SPEED * dt);
    place();
    if (y >= need - 0.5) { atEnd(); return; }
    raf = requestAnimationFrame(roll);
  }
  // less motion: a screenful at a time, the sheet fading over to the next
  function turnPage() {
    phase = 'down';
    var step = Math.max(120, view.clientHeight * 0.8);
    fade(function () { y = Math.min(need, y + step); place(); }, function () {
      if (y >= need - 0.5) atEnd(); else timer = setTimeout(turnPage, HOLD);
    });
  }
  // at rest at the end: a while, then faded out, back to the top, and in again
  function atEnd() {
    stop(); phase = 'end';
    if (LITE) {                                                             // a light screen: the last page stands its while, then the top at once
      timer = setTimeout(function () { if (reloadWanted) { location.reload(); return; } atTop(); }, PAGE);
      return;
    }
    timer = setTimeout(function () {
      fade(function () {
        if (reloadWanted) { location.reload(); return true; }
        y = 0; measure(); place();
      }, atTop);
    }, HOLD);
  }
  function fade(between, after) {
    sheet.classList.add('is-faded');
    timer = setTimeout(function () {
      if (between() === true) return;
      sheet.classList.remove('is-faded');
      timer = setTimeout(after, FADE);
    }, FADE);
  }

  // the page's reloads (screen.js) wait for the sheet's turn: the moment it is faded out at the end (a light screen's:
  // the moment it goes back to the top), or at once when all of it is in view; a turn that never comes (the screen
  // hidden, a stall) reloads it anyway after four minutes
  window.MCSScreenRoll = {
    reloadAtTurn: function () {
      if (reloadWanted) return;
      reloadWanted = true;
      if (phase === 'top' && need <= 8) { location.reload(); return; }
      setTimeout(function () { location.reload(); }, 4 * 60 * 1000);
    },
  };

  // the sheet or the room changing size: measured again (a roll in progress carries on from where it is)
  if ('ResizeObserver' in window) {
    var ro = new ResizeObserver(function () { measure(); place(); });
    ro.observe(sheet); ro.observe(view);
  } else window.addEventListener('resize', function () { measure(); place(); });
  // away and back: a roll picks up where it was, without a jump
  document.addEventListener('visibilitychange', function () {
    if (!document.hidden && phase === 'down' && !calm && !LITE) { cancelAnimationFrame(raf); last = 0; raf = requestAnimationFrame(roll); }
  });
  // a moment for the fonts, the readings and the charts to arrive, then the first rest at the top
  setTimeout(atTop, 600);
})();
