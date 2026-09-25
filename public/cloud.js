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

  /** Bring the tiles of `oldGrid` into line with those of `newGrid`, keeping every tile that is still there. */
  function reconcileGrid(oldGrid, newGrid) {
    var want = [].slice.call(newGrid.children);
    var have = {};
    [].slice.call(oldGrid.children).forEach(function (el) { have[el.getAttribute('data-id')] = el; });
    var keep = {};
    want.forEach(function (w) { keep[w.getAttribute('data-id')] = true; });
    // take away what has gone, gently
    Object.keys(have).forEach(function (id) {
      if (keep[id]) return;
      leave(have[id]);
      delete have[id];
    });
    // put every wanted tile in its place, reusing the element already on the page
    var cursor = oldGrid.firstElementChild;
    want.forEach(function (w) {
      var id = w.getAttribute('data-id');
      var el = have[id];
      if (!el) { el = w; arrive(el); }
      // skip over tiles on their way out
      while (cursor && cursor.classList.contains('is-leaving')) cursor = cursor.nextElementSibling;
      if (el !== cursor) oldGrid.insertBefore(el, cursor);
      else cursor = cursor.nextElementSibling;
    });
  }
  function arrive(el) { el.classList.add('is-arriving'); requestAnimationFrame(function () { requestAnimationFrame(function () { el.classList.remove('is-arriving'); }); }); }
  function leave(el) { el.classList.add('is-leaving'); setTimeout(function () { if (el.parentNode) el.parentNode.removeChild(el); }, 260); }

  /** Bring `box` into line with `html`, keeping every tile that is still there — in the gallery day by day (a day's
      head and its tiles; a new day slides in where it belongs, a day with nothing left in it fades away), in the
      dashboard's strip as one row. */
  function reconcile(box, html) {
    var tpl = document.createElement('template'); tpl.innerHTML = html;
    var next = tpl.content;
    // the head line (count, frequency): swap only if its words changed
    var oldHead = box.querySelector('.log-day-head, .cloud-latest-head'), newHead = next.querySelector('.log-day-head, .cloud-latest-head');
    if (oldHead && newHead && oldHead.innerHTML !== newHead.innerHTML) oldHead.innerHTML = newHead.innerHTML;
    var oldDays = box.querySelector('.cloud-days'), newDays = next.querySelector('.cloud-days');
    if (oldDays && newDays) {
      var want = [].slice.call(newDays.children), have = {}, keep = {};
      [].slice.call(oldDays.children).forEach(function (el) { have[el.getAttribute('data-day')] = el; });
      want.forEach(function (w) { keep[w.getAttribute('data-day')] = true; });
      Object.keys(have).forEach(function (d) { if (!keep[d]) { leave(have[d]); delete have[d]; } });
      var cursor = oldDays.firstElementChild;
      want.forEach(function (w) {
        var el = have[w.getAttribute('data-day')];
        if (el) {
          var oh = el.querySelector('.cloud-day-head'), nh = w.querySelector('.cloud-day-head');
          if (oh && nh && oh.innerHTML !== nh.innerHTML) oh.innerHTML = nh.innerHTML;
          var og = el.querySelector('.mgrid'), ng = w.querySelector('.mgrid');
          if (og && ng) reconcileGrid(og, ng);
        } else { el = w; arrive(el); }
        while (cursor && cursor.classList.contains('is-leaving')) cursor = cursor.nextElementSibling;
        if (el !== cursor) oldDays.insertBefore(el, cursor);
        else cursor = cursor.nextElementSibling;
      });
      return;
    }
    var oldGrid = box.querySelector('.mgrid, .mstrip'), newGrid = next.querySelector('.mgrid, .mstrip');
    if (!oldGrid || !newGrid || !!oldDays !== !!newDays) {
      // empty ↔ pictures: the one case where the whole thing is replaced
      box.innerHTML = html; return;
    }
    reconcileGrid(oldGrid, newGrid);
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
