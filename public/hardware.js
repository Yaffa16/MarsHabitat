/* The Habitat hardware panel, kept live. The server polls Home Assistant and
   renders the panel (src/lib/home-assistant.js, src/views/pages/public.js);
   this asks /api/hardware for the rendered panel on the same cycle and swaps
   it in place when the change mark moves — the same pattern as the board.
   Losing JavaScript simply leaves the server-rendered panel standing.
   Polling pauses while the tab is hidden, stops for good once the record is
   closed, and a failed fetch changes nothing on screen.

   The charts are drawn for the width they are shown at: the page measures
   its charts' tiles and asks for that width (?w=), so the plot fills the
   tile and its type keeps its size on a desk and on a phone alike. The
   server-rendered panel is drawn for a desk (data-w); where the tiles are
   another size the page asks again at once, and again whenever the window
   is resized. */
(function () {
  'use strict';

  var box = document.getElementById('hw-live');
  if (!box) return;   // the bridge is not configured; no panel, nothing to do

  var pollMs = Math.max(15000, Number(box.getAttribute('data-poll')) || 60000);
  var version = box.getAttribute('data-version') || '';
  var drawnW = Number(box.getAttribute('data-w')) || 720, drawnH = Number(box.getAttribute('data-h')) || 240;
  var timer = null, busy = false, again = false;
  var onScreen = document.documentElement.classList.contains('screen');   // one of the installation's screens (screens.js)

  // the width a chart has on the screen: its own, else what a tile would give one (the charts stand two across on a
  // desk, one on a phone — aura.css, .hw-charts); nothing while the panel is not laid out
  function want() {
    var svg = box.querySelector('.hw-chart svg');
    var w = svg ? svg.getBoundingClientRect().width : 0;
    if (!w) { var r = box.getBoundingClientRect().width; if (r) w = (window.innerWidth > 760 ? (r - 16) / 2 : r) - 32; }
    return w > 0 ? Math.max(240, Math.min(1400, Math.round(w))) : 0;   // within what the server draws for
  }
  // the height: the usual 240, but on one of the installation's screens a fifth of the screen's height, 130 at the least
  // — a short screen has no room under the instruments for a tall chart, and the chart keeps its height whatever the
  // scale the screen is fitted at (screen.js), so it has to be short of itself
  function wantH() { return onScreen ? Math.max(130, Math.min(240, Math.round(window.innerHeight * 0.2))) : 240; }
  function differs(w) { return (w > 0 && Math.abs(w - drawnW) > Math.max(12, drawnW * 0.08)) || Math.abs(wantH() - drawnH) > 8; }

  function tick() {
    if (document.hidden) return;
    if (busy) { again = true; return; }
    busy = true;
    var w = want(), h = wantH();
    fetch('/api/hardware?' + (w ? 'w=' + w + '&' : '') + 'h=' + h, { cache: 'no-store' })
      .then(function (r) { return r.ok ? r.json() : null; })
      .then(function (j) {
        if (!j) return;
        if (j.frozen) { stop(); }
        var pw = document.getElementById('pwr-live');                        // the power tile, on the same cycle
        if (pw && j.power && pw.innerHTML !== j.power) pw.innerHTML = j.power;
        var w2 = Number(j.w) || drawnW, h2 = Number(j.h) || drawnH;
        if (j.html && j.version && (j.version !== version || w2 !== drawnW || h2 !== drawnH)) {
          version = j.version; drawnW = w2; drawnH = h2;
          box.innerHTML = j.html;
        }
      })
      .catch(function () { /* the panel stands as it is; the next tick tries again */ })
      .then(function () { busy = false; if (again) { again = false; tick(); } });
  }

  function stop() { if (timer) { clearInterval(timer); timer = null; } }
  function startTimer() { if (!timer) timer = setInterval(tick, pollMs); }

  document.addEventListener('visibilitychange', function () {
    if (!document.hidden) tick();
  });
  // the tiles another width than the panel was drawn for: ask at once, and again after the window is resized
  var resizeT = null;
  function fitNow() { if (differs(want())) tick(); }
  window.addEventListener('resize', function () { clearTimeout(resizeT); resizeT = setTimeout(fitNow, 350); });
  if ('ResizeObserver' in window) new ResizeObserver(function () { clearTimeout(resizeT); resizeT = setTimeout(fitNow, 350); }).observe(box);
  setTimeout(fitNow, 50);

  startTimer();
})();
