/* The Habitat hardware panel, kept live. The server polls Home Assistant and
   renders the panel (src/lib/home-assistant.js, src/views/pages/public.js);
   this asks /api/hardware for the rendered panel on the same cycle and swaps
   it in place when the change mark moves — the same pattern as the board.
   Losing JavaScript simply leaves the server-rendered panel standing.
   Polling pauses while the tab is hidden, stops for good once the record is
   closed, and a failed fetch changes nothing on screen. */
(function () {
  'use strict';

  var box = document.getElementById('hw-live');
  if (!box) return;   // the bridge is not configured; no panel, nothing to do

  var pollMs = Math.max(15000, Number(box.getAttribute('data-poll')) || 60000);
  var version = box.getAttribute('data-version') || '';
  var timer = null;

  function tick() {
    if (document.hidden) return;
    fetch('/api/hardware', { cache: 'no-store' })
      .then(function (r) { return r.ok ? r.json() : null; })
      .then(function (j) {
        if (!j) return;
        if (j.frozen) { stop(); }
        if (j.html && j.version && j.version !== version) {
          version = j.version;
          box.innerHTML = j.html;
        }
      })
      .catch(function () { /* the panel stands as it is; the next tick tries again */ });
  }

  function stop() { if (timer) { clearInterval(timer); timer = null; } }
  function startTimer() { if (!timer) timer = setInterval(tick, pollMs); }

  document.addEventListener('visibilitychange', function () {
    if (!document.hidden) tick();
  });

  startTimer();
})();
