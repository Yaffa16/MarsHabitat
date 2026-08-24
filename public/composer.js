/* Composer + transit. No framework, no dependencies. */
(function () {
  'use strict';

  /* The composer appears more than once on the mission page, so everything
     below binds per form rather than by a single id. */
  document.querySelectorAll('form.composer').forEach(function (form) {
    var body = form.querySelector('textarea[name=body]');
    var count = form.querySelector('.counter');
    if (body && count) {
      var max = Number(body.getAttribute('maxlength')) || 500;
      var update = function () {
        count.textContent = body.value.length + ' / ' + max;
        count.classList.toggle('over', body.value.length > max * 0.9);
      };
      body.addEventListener('input', update);
      update();
    }
    var tagBox = form.querySelector('.tags');
    if (tagBox) {
      var boxes = tagBox.querySelectorAll('input[type=checkbox]');
      tagBox.addEventListener('change', function () {
        var on = 0;
        boxes.forEach(function (b) { if (b.checked) on++; });
        boxes.forEach(function (b) { b.disabled = !b.checked && on >= 3; });
      });
    }
  });

  /* --------------------------------------------------------- launch countdown */
  var cd = document.getElementById('countdown');
  if (cd) {
    var opens = Date.parse(cd.dataset.opens);
    var pad = function (n, w) { return String(n).padStart(w || 2, '0'); };
    (function tickDown() {
      var left = opens - Date.now();
      if (left <= 0) { cd.textContent = 'T+000:00:00:00'; window.location.reload(); return; }
      var s = Math.floor(left / 1000);
      cd.textContent = 'T\u2212' + pad(Math.floor(s / 86400), 3) + ':' +
        pad(Math.floor(s / 3600) % 24) + ':' + pad(Math.floor(s / 60) % 60) + ':' + pad(s % 60);
      setTimeout(tickDown, 1000);
    })();
  }

  /* ------------------------------------------------------------- transit view */
  var t = document.querySelector('.transit-block');
  if (!t) return;

  var arrival = Date.parse(t.dataset.arrival);
  var departure = Date.parse(t.dataset.departure);
  var span = Math.max(1, arrival - departure);
  var clock = document.getElementById('tclock');
  var bar = document.getElementById('tbar');
  var pct = document.getElementById('tpct');
  var packet = document.getElementById('packet');
  var trail = document.getElementById('trail');
  var orbitPacket = document.getElementById('orbit-packet');
  var chord = document.getElementById('orbit-chord');
  var reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  var x1 = 0, y1 = 0, x2 = 0, y2 = 0;
  if (chord) {
    x1 = parseFloat(chord.getAttribute('x1')); y1 = parseFloat(chord.getAttribute('y1'));
    x2 = parseFloat(chord.getAttribute('x2')); y2 = parseFloat(chord.getAttribute('y2'));
  }

  function arrived() {
    clock.textContent = 'ARRIVED';
    if (bar) bar.style.width = '100%';
    if (pct) pct.textContent = '100%';
    if (packet) { packet.style.left = '100%'; packet.classList.add('landed'); }
    if (trail) trail.style.width = '100%';
    t.classList.add('done');
    var state = t.querySelector('.state');
    if (state) state.textContent = 'Delivered · awaiting review';
    // Reload so the composer comes back with the real server-side state.
    setTimeout(function () { window.location.reload(); }, 2600);
  }

  function tick() {
    var now = Date.now();
    var left = arrival - now;
    if (left <= 0) { arrived(); return; }

    var p = 1 - left / span;
    var s = Math.ceil(left / 1000);
    clock.textContent = 'T\u2212' + String(Math.floor(s / 60)).padStart(2, '0') + ':' +
      String(s % 60).padStart(2, '0');
    if (bar) bar.style.width = (p * 100).toFixed(1) + '%';
    if (pct) pct.textContent = Math.round(p * 100) + '%';

    /* The packet crosses its own track, and drags a trail behind it so the
       distance already covered stays visible. */
    if (packet) packet.style.left = (p * 100).toFixed(2) + '%';
    if (trail) trail.style.width = (p * 100).toFixed(2) + '%';

    /* And the same journey on the orbital plot, so the schematic and the
       animation are showing one event rather than two. */
    if (orbitPacket && chord) {
      orbitPacket.setAttribute('cx', (x1 + (x2 - x1) * p).toFixed(2));
      orbitPacket.setAttribute('cy', (y1 + (y2 - y1) * p).toFixed(2));
      orbitPacket.setAttribute('opacity', '1');
    }
    requestAnimationFrame(tick);
  }
  tick();
})();
