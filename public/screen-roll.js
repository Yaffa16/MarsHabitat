/* MARS!platz — the installation's Habitat screen, rolled (src/views/pages/screens.js, habitat; public/screen.css).
 *
 * The Sensors panel read from across a room (8 October: "the screen/habitat should have a vertical layout with
 * scrolling, to show all the content clearly and slowly — no overlap of text, no glitching"): the panel fills the
 * screen and its head stays; everything in it — the instruments, the steps and the stores, the power, Karlsruhe and the
 * astronauts, the hardware's charts — stands at its full size, one row under the other, and rolls by under the head at
 * a slow, even pace. At the top it rests a while; at the end it rests, fades, and comes back from the top. What fits the
 * screen is simply shown. The readings stay live underneath (habitat.js, hardware.js, live.js): a figure changes in its
 * place, and a change of height — a note arriving, a chart drawn anew — is taken into account at once. The sheet's edge
 * fades where it passes under the head and where more is still to come (screen.css, .is-rolled / .has-more).
 * Moved by transform, not scrolled: nothing on the screen can be dragged. Asked for less motion, the sheet turns over a
 * screenful at a time instead of rolling. The page's own reloads (screen.js) wait for the moment the sheet is faded out,
 * so a reload never cuts the roll short. Nothing here is ever sent anywhere.
 * Speed and pauses can be set on the wrapper: data-speed (pixels a second), data-hold (ms at the top and at the end). */
(function () {
  'use strict';
  var root = document.getElementById('screen-roll'); if (!root) return;
  var view = root.querySelector('.dpanel-body'); if (!view) return;
  var SPEED = Number(root.getAttribute('data-speed')) || 28;              // pixels a second, in the layout's own pixels: a slow read
  var HOLD = Number(root.getAttribute('data-hold')) || 8000;               // at the top before rolling, and at the end
  var FADE = 900;                                                          // the sheet fading out at the end, and in at the top
  var calm = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

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
    if (y > need) { y = need; place(); }
  }
  function place() {
    sheet.style.transform = y > 0 ? 'translate3d(0,' + (-y).toFixed(1) + 'px,0)' : '';
    if (view.classList.contains('is-rolled') !== (y > 2)) view.classList.toggle('is-rolled', y > 2);
    if (view.classList.contains('has-more') !== (need - y > 2)) view.classList.toggle('has-more', need - y > 2);
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
      if (calm) { turnPage(); return; }
      phase = 'down'; last = 0; raf = requestAnimationFrame(roll);
    }, HOLD);
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

  // the page's reloads (screen.js) wait for the sheet's turn: the moment it is faded out at the end, or at once when
  // all of it is in view; a turn that never comes (the screen hidden, a stall) reloads it anyway after four minutes
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
    if (!document.hidden && phase === 'down' && !calm) { cancelAnimationFrame(raf); last = 0; raf = requestAnimationFrame(roll); }
  });
  // a moment for the fonts, the readings and the charts to arrive, then the first rest at the top
  setTimeout(atTop, 600);
})();
