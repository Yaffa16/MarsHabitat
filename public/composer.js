/* Composer + transit. No framework, no dependencies.

   Sending a message never leaves the page. The form posts itself with fetch,
   the server answers with the composer fragment alone — the dial while the
   message crosses, the form again with an error if it did not leave — and
   the fragment is swapped into the device in place. When the crossing ends
   the fresh composer is fetched the same way. Nothing scrolls, nothing
   reloads, and the device keeps its size throughout. Without JavaScript the
   form posts normally and the server redirects, as it always did. */
(function () {
  'use strict';
  /* The visitor's language, from the table in the page head (see
     src/lib/i18n.js); English when there is none. */
  var t = window.t || function (s) { return s; };

  var device = document.querySelector('.composer-device');
  var stage = document.getElementById('dev-body');
  var transitTimer = null;

  /* --------------------------------------------------------------- forms */
  function bindForms(root) {
    var forms = root.querySelectorAll('form.composer:not(.ghost)');
    Array.prototype.forEach.call(forms, function (form) {
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
      if (stage && window.fetch && window.FormData) {
        form.addEventListener('submit', function (e) {
          if (form.dataset.native) return;   // falling back to a plain post
          e.preventDefault();
          send(form);
        });
      }
    });
  }

  function send(form) {
    var button = form.querySelector('button[type=submit]');
    if (button) button.disabled = true;
    fetch(form.getAttribute('action') || '/communicate', {
      method: 'POST',
      body: new URLSearchParams(new FormData(form)),   // urlencoded, as a plain post would be
      credentials: 'same-origin',
      headers: { 'X-Requested-With': 'fetch' },
    })
      .then(function (r) { if (!r.ok) throw new Error('HTTP ' + r.status); return r.text(); })
      .then(function (html) {
        swap(html);
        if (window.MCSBoard) window.MCSBoard.refresh('');
      })
      .catch(function () {
        // The station could not be reached this way: let the form post
        // normally, which the server answers with a redirect.
        if (button) button.disabled = false;
        form.dataset.native = '1';
        HTMLFormElement.prototype.submit.call(form);
      });
  }

  /* Replace what the device shows and bind whatever arrived. A visitor who had
     no callsign when the page was drawn gets one with their first message: the
     fragment carries it (data-callsign), and the device's head takes it up. */
  function swap(html) {
    if (transitTimer) { cancelAnimationFrame(transitTimer); transitTimer = null; }
    stage.innerHTML = html;
    init(stage);
    var tagged = stage.querySelector('[data-callsign]');
    var chip = device && device.querySelector('.dev-chip');
    if (tagged && chip && tagged.getAttribute('data-callsign')) {
      chip.textContent = tagged.getAttribute('data-callsign');
      chip.classList.remove('dev-chip-later');
    }
  }

  function refresh() {
    fetch('/api/composer', { credentials: 'same-origin', cache: 'no-store',
      headers: { 'X-Requested-With': 'fetch' } })
      .then(function (r) { if (!r.ok) throw new Error('HTTP ' + r.status); return r.text(); })
      .then(function (html) {
        swap(html);
        if (window.MCSBoard) window.MCSBoard.refresh('');
      })
      .catch(function () { window.location.reload(); });
  }

  /* --------------------------------------------------------- launch countdown */
  function bindCountdown(root) {
    var cd = root.querySelector('#countdown');
    if (!cd) return;
    var opens = Date.parse(cd.dataset.opens);
    var pad = function (n, w) { return String(n).padStart(w || 2, '0'); };
    (function tickDown() {
      if (!cd.isConnected) return;
      var left = opens - Date.now();
      if (left <= 0) { cd.textContent = 'T+000:00:00:00'; window.location.reload(); return; }
      var s = Math.floor(left / 1000);
      cd.textContent = 'T−' + pad(Math.floor(s / 86400), 3) + ':' +
        pad(Math.floor(s / 3600) % 24) + ':' + pad(Math.floor(s / 60) % 60) + ':' + pad(s % 60);
      setTimeout(tickDown, 1000);
    })();
  }

  /* ------------------------------------------------------------- transit view */
  function bindTransit(root) {
    var block = root.querySelector('.transit-block');
    if (device) device.classList.toggle('sending', !!block);
    if (!block) return;

    var arrival = Date.parse(block.dataset.arrival);
    var departure = Date.parse(block.dataset.departure);
    var span = Math.max(1, arrival - departure);
    var clock = block.querySelector('#tclock');
    var bar = block.querySelector('#tbar');
    var pct = block.querySelector('#tpct');
    var word = block.querySelector('#xword');
    var orbitPacket = document.getElementById('orbit-packet');
    var chord = document.getElementById('orbit-chord');

    /* The dial: the packet rides the route, the trail is the route drawn as
       far as the packet has come. */
    var route = block.querySelector('#xroute');
    var trail = block.querySelector('#xtrail');
    var packet = block.querySelector('#xpacket');
    var routeLen = 0;
    if (route && route.getTotalLength) {
      routeLen = route.getTotalLength();
      if (trail) trail.setAttribute('stroke-dasharray', '0 ' + (routeLen + 10));
    }
    function place(p) {
      if (!routeLen) return;
      var pt = route.getPointAtLength(routeLen * p);
      if (packet) { packet.setAttribute('cx', pt.x.toFixed(2)); packet.setAttribute('cy', pt.y.toFixed(2)); }
      if (trail) trail.setAttribute('stroke-dasharray', (routeLen * p).toFixed(2) + ' ' + (routeLen + 10));
    }

    var x1 = 0, y1 = 0, x2 = 0, y2 = 0;
    if (chord) {
      x1 = parseFloat(chord.getAttribute('x1')); y1 = parseFloat(chord.getAttribute('y1'));
      x2 = parseFloat(chord.getAttribute('x2')); y2 = parseFloat(chord.getAttribute('y2'));
    }

    function arrived() {
      if (clock) clock.textContent = t('ARRIVED');
      if (bar) bar.style.width = '100%';
      if (pct) pct.textContent = '100%';
      place(1);
      if (word) word.textContent = t('Arrived');
      block.classList.add('done');
      var state = block.querySelector('.state');
      if (state) state.textContent = t('Delivered · awaiting review');
      // Hold on ARRIVED for a moment, then bring the composer back with the
      // real server-side state — in place, without a reload.
      setTimeout(function () {
        if (!block.isConnected) return;
        if (stage && window.fetch) refresh(); else window.location.reload();
      }, 2600);
    }

    function tick() {
      if (!block.isConnected) return;
      var now = Date.now();
      var left = arrival - now;
      if (left <= 0) { arrived(); return; }

      var p = 1 - left / span;
      var s = Math.ceil(left / 1000);
      if (clock) {
        clock.textContent = 'T−' + String(Math.floor(s / 60)).padStart(2, '0') + ':' +
          String(s % 60).padStart(2, '0');
      }
      if (bar) bar.style.width = (p * 100).toFixed(1) + '%';
      if (pct) pct.textContent = Math.round(p * 100) + '%';

      /* The packet crosses the dial, and the trail behind it keeps the
         distance already covered visible. */
      place(p);

      /* And the same journey on the orbital plot, where one is drawn. */
      if (orbitPacket && chord) {
        orbitPacket.setAttribute('cx', (x1 + (x2 - x1) * p).toFixed(2));
        orbitPacket.setAttribute('cy', (y1 + (y2 - y1) * p).toFixed(2));
        orbitPacket.setAttribute('opacity', '1');
      }
      transitTimer = requestAnimationFrame(tick);
    }
    tick();
  }

  function init(root) {
    bindForms(root);
    bindCountdown(root);
    bindTransit(root);
  }

  init(document);
})();
