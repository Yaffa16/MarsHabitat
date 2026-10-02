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
  // the gallery's address: /api/cloud, or the flat grid's (/api/cloud?flat=1) on the installation's media screen
  var api = targets[0].el.getAttribute('data-api') || '/api/cloud';

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
    fetch(api, { cache: 'no-store' })
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

  /* ---- the lightbox (src/views/pages/media.js, lightbox): a click on a tile of the gallery opens its picture in place,
     in a small pop-up over the page, blurred behind it, instead of the original in a new tab — the picture, its
     time under it; the arrows beside it (and the arrow keys) go to the previous and the next tile as the gallery has
     them, the cross, Escape or a click beside the picture close it. A click with a modifier key, or
     without JavaScript, opens the original as the tile's link says. */
  var lb = document.getElementById('lightbox');
  if (lb && typeof lb.showModal === 'function') {
    var img = lb.querySelector('.lb-img'), when = lb.querySelector('.lb-when'), at = -1;
    var tiles = function () { return [].slice.call(document.querySelectorAll('#gallery .mtile.kind-image[href]')); };
    var show = function (i) {
      var ts = tiles(); if (!ts.length) return;
      at = ((i % ts.length) + ts.length) % ts.length;
      var t = ts[at], w = t.querySelector('.mtile-when'), day = t.closest('.cloud-day'), head = day && day.querySelector('.cloud-day-date');
      img.src = t.getAttribute('href'); img.alt = t.getAttribute('title') || '';
      when.textContent = [head ? head.textContent : '', w ? w.textContent : ''].filter(Boolean).join(' · ');
      lb.querySelector('.lb-prev').disabled = lb.querySelector('.lb-next').disabled = ts.length < 2;
      // the neighbours, fetched ahead
      [at + 1, at - 1].forEach(function (k) { var n = ts[((k % ts.length) + ts.length) % ts.length]; if (n) { var pre = new Image(); pre.src = n.getAttribute('href'); } });
    };
    document.addEventListener('click', function (e) {
      var a = e.target.closest ? e.target.closest('#gallery .mtile.kind-image[href]') : null;
      if (!a || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button) return;
      e.preventDefault();
      show(tiles().indexOf(a));
      if (!lb.open) lb.showModal();
    });
    lb.addEventListener('click', function (e) {
      var b = e.target.closest ? e.target.closest('[data-lb]') : null;
      if (b) { var k = b.getAttribute('data-lb'); if (k === 'close') lb.close(); else show(at + (k === 'next' ? 1 : -1)); return; }
      if (e.target === lb || e.target.classList.contains('lb-box') || e.target.classList.contains('lb-fig')) lb.close();   // beside the picture
    });
    lb.addEventListener('keydown', function (e) { if (e.key === 'ArrowRight') show(at + 1); else if (e.key === 'ArrowLeft') show(at - 1); });
    lb.addEventListener('close', function () { img.removeAttribute('src'); });
  }
})();
