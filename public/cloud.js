/* The cloud gallery, kept live. The station checks the folder every
   CLOUD_CHECK_SECONDS and copies what is new; this asks /api/cloud on the
   same beat and, when the version stamp moves, brings the page's tiles into
   line with the station's — not by rebuilding the strip, which would make
   every picture blink, but tile by tile: a picture already on the page stays
   exactly where it is (its image untouched), a new one is slid in where it
   belongs and fades up, one that has gone fades out and is taken away.
   Polling pauses while the tab is hidden; a failed fetch changes nothing;
   without JavaScript the server-rendered markup stands. */
(function () {
  'use strict';
  var targets = [
    { el: document.getElementById('gallery'), field: 'html' },
    { el: document.getElementById('cloud-latest'), field: 'latestHtml' }
  ].filter(function (t) { return t.el; });
  if (!targets.length) return;
  var pollMs = Math.max(5000, Number(targets[0].el.getAttribute('data-poll')) || 20000);
  var version = targets[0].el.getAttribute('data-version') || '';

  /** Bring `box` into line with `html`, keeping every tile that is still there. */
  function reconcile(box, html) {
    var tpl = document.createElement('template'); tpl.innerHTML = html;
    var next = tpl.content;
    var oldGrid = box.querySelector('.mgrid, .mstrip'), newGrid = next.querySelector('.mgrid, .mstrip');
    // the head line (count, frequency): swap only if its words changed
    var oldHead = box.querySelector('.log-day-head, .cloud-latest-head'), newHead = next.querySelector('.log-day-head, .cloud-latest-head');
    if (oldHead && newHead && oldHead.innerHTML !== newHead.innerHTML) oldHead.innerHTML = newHead.innerHTML;
    if (!oldGrid || !newGrid) {
      // empty ↔ pictures: the one case where the whole thing is replaced
      box.innerHTML = html; return;
    }
    var want = [].slice.call(newGrid.children);
    var have = {};
    [].slice.call(oldGrid.children).forEach(function (el) { have[el.getAttribute('data-id')] = el; });
    var keep = {};
    want.forEach(function (w) { keep[w.getAttribute('data-id')] = true; });
    // take away what has gone, gently
    Object.keys(have).forEach(function (id) {
      if (keep[id]) return;
      var el = have[id]; el.classList.add('is-leaving');
      setTimeout(function () { if (el.parentNode) el.parentNode.removeChild(el); }, 260);
      delete have[id];
    });
    // put every wanted tile in its place, reusing the element already on the page
    var cursor = oldGrid.firstElementChild;
    want.forEach(function (w) {
      var id = w.getAttribute('data-id');
      var el = have[id];
      if (!el) { el = w; el.classList.add('is-arriving'); requestAnimationFrame(function () { requestAnimationFrame(function () { el.classList.remove('is-arriving'); }); }); }
      // skip over tiles on their way out
      while (cursor && cursor.classList.contains('is-leaving')) cursor = cursor.nextElementSibling;
      if (el !== cursor) oldGrid.insertBefore(el, cursor);
      else cursor = cursor.nextElementSibling;
    });
  }

  function tick() {
    if (document.hidden) return;
    fetch('/api/cloud', { cache: 'no-store' })
      .then(function (r) { return r.ok ? r.json() : null; })
      .then(function (j) {
        if (!j || !j.configured || !j.version || j.version === version) return;
        version = j.version;
        targets.forEach(function (t) { if (j[t.field]) { t.el.setAttribute('data-version', version); reconcile(t.el, j[t.field]); } });
      })
      .catch(function () { /* stands as it is; the next tick tries again */ });
  }
  document.addEventListener('visibilitychange', function () { if (!document.hidden) tick(); });
  setInterval(tick, pollMs);
})();
