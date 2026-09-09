/* The cloud gallery, kept live. The station checks the folder every
   CLOUD_CHECK_SECONDS and copies what is new; this asks /api/cloud on the
   same beat and swaps the grid (on /media) and the latest strip (in the
   Habitat panel on the landing page) in when the version stamp moves — so a
   picture put in the folder appears on every open page without a reload,
   the same pattern as the board. A failed fetch changes nothing; polling
   pauses while the tab is hidden; without JavaScript the server-rendered
   markup stands. */
(function () {
  'use strict';
  var targets = [
    { el: document.getElementById('gallery'), field: 'html' },
    { el: document.getElementById('cloud-latest'), field: 'latestHtml' }
  ].filter(function (t) { return t.el; });
  if (!targets.length) return;
  var pollMs = Math.max(5000, Number(targets[0].el.getAttribute('data-poll')) || 20000);
  var version = targets[0].el.getAttribute('data-version') || '';

  function tick() {
    if (document.hidden) return;
    fetch('/api/cloud', { cache: 'no-store' })
      .then(function (r) { return r.ok ? r.json() : null; })
      .then(function (j) {
        if (!j || !j.configured || !j.version || j.version === version) return;
        version = j.version;
        targets.forEach(function (t) { if (j[t.field]) { t.el.setAttribute('data-version', version); t.el.innerHTML = j[t.field]; } });
      })
      .catch(function () { /* stands as it is; the next tick tries again */ });
  }
  document.addEventListener('visibilitychange', function () { if (!document.hidden) tick(); });
  setInterval(tick, pollMs);
})();
