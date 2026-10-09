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
  /* The installation's writing screen (screens.js, write): the fresh composer comes from the screen's own address, in
     the screen's language (data-refresh), and every message there is a new visitor's — once one has crossed, the
     device's head goes back to saying a callsign comes on sending (data-kiosk). */
  var refreshUrl = (stage && stage.getAttribute('data-refresh')) || '/api/composer';
  var kiosk = !!(stage && stage.hasAttribute('data-kiosk'));
  var chip0 = device && device.querySelector('.dev-chip') ? device.querySelector('.dev-chip').textContent : '';

  /* --------------------------------------------------------------- forms */
  /* The Transmit key (8 October: "on the writing screen the send button sometimes does not work — simplify the button
     event catching and make sure it works simply"; 9 October, at the venue: "the button lifts, but the click is not
     registered — make it foolproof"). A press of the key sends — its release on the key or just beside it, its click, or
     the form's own submit, whichever the browser gives, all routed to one place and never twice at once (bindForms). No
     check of the browser's stands between the press and the sending: a box with nothing in it says so in the device, in
     words, instead of a bubble the screen may never show. A touch keeps the writing box's focus when it presses the key,
     so a touch keyboard does not fold away and move the key from under the finger before the press lands. And the key
     can never stay dead: a sending with no answer within fifteen seconds gives the key back, the draft kept, with a word
     on the writing screen (the site falls back to a plain post, as before). */
  var WAIT = 15000;
  /* The press of a Transmit key under way — one at a time, whichever form the device shows (each new one is bound as it
     comes): its release anywhere is looked at once, here, and sends if it lands on the key or within a finger's breadth
     of it, the press having begun on the key. */
  var press = null;
  function pressUp(e) {
    if (!press) return;
    var p = press; press = null;
    if (Date.now() - p.at > 15000 || !p.key.isConnected) return;
    var pt = e.changedTouches && e.changedTouches.length ? e.changedTouches[0] : e;
    if (typeof pt.clientX !== 'number') { send(p.form); return; }
    var r = p.key.getBoundingClientRect(), m = 18;
    if (pt.clientX >= r.left - m && pt.clientX <= r.right + m && pt.clientY >= r.top - m && pt.clientY <= r.bottom + m) send(p.form);
  }
  function pressCancel() { press = null; }
  if (window.PointerEvent) {
    document.addEventListener('pointerup', pressUp, true);
    document.addEventListener('pointercancel', pressCancel, true);
  } else {
    document.addEventListener('mouseup', pressUp, true);
    document.addEventListener('touchend', pressUp, true);
    document.addEventListener('touchcancel', pressCancel, true);
  }
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
          Array.prototype.forEach.call(boxes, function (b) { if (b.checked) on++; });
          Array.prototype.forEach.call(boxes, function (b) { b.disabled = !b.checked && on >= 3; });
        });
        /* A tag pressed and let go on it is ticked even where the browser hands the page the press and the release but no
           click (9 October, the kiosk at the venue — the key's trouble; see bindForms' key below): a quarter of a second
           after the release, a tag whose own click has not come is ticked here, once. */
        var tagPress = null;
        var tagOf = function (e) { return e.target && e.target.closest ? e.target.closest('label') : null; };
        var tagDown = function (e) { var l = tagOf(e); if (!l || e.button) return; tagPress = { label: l, clicked: false }; };
        var tagUp = function (e) {
          var p = tagPress; if (!p) return;
          if (tagOf(e) !== p.label) { tagPress = null; return; }
          setTimeout(function () {
            if (tagPress !== p) return;
            tagPress = null;
            if (p.clicked) return;
            var b = p.label.querySelector('input[type=checkbox]');
            if (!b || b.disabled) return;
            b.checked = !b.checked;
            b.dispatchEvent(new Event('change', { bubbles: true }));
          }, 250);
        };
        tagBox.addEventListener('click', function (e) { if (tagPress && tagOf(e) === tagPress.label) tagPress.clicked = true; }, true);
        if (window.PointerEvent) { tagBox.addEventListener('pointerdown', tagDown); tagBox.addEventListener('pointerup', tagUp); }
        else { tagBox.addEventListener('mousedown', tagDown); tagBox.addEventListener('mouseup', tagUp); tagBox.addEventListener('touchstart', tagDown, { passive: true }); tagBox.addEventListener('touchend', tagUp); }
      }
      if (!stage) return;                                              // no device to swap into: a plain post
      var key = form.querySelector('button[type=submit]');
      if (key) {
        /* (9 October, the writing screen at the venue: "the button lifts when the cursor is over it, but the click is not
           registered". The key rose a pixel under the pointer and sank two when pressed — a press near its edge began on
           the key and ended beside it, and the browser sent no click at all; and a press whose default is held back, as
           the key held back every press to keep the box's focus, is one more way for a browser to send none.) Now the
           key stands still (aura.css) and a press is caught three ways, any of which sends, once: the release — wherever
           it lands, so long as it is on the key or within a finger's breadth of it, the press having begun on the key —
           the click, and the form's own submit. Only a touch or a pen keeps the writing box's focus (a touch keyboard
           must not fold away under the finger); a mouse is left to the browser. */
        var down = function (e) {
          if (e.button) return;                                         // the main button, a finger or a pen only
          press = { form: form, key: key, at: Date.now() };
          if (e.type === 'touchstart' || (e.pointerType && e.pointerType !== 'mouse')) e.preventDefault();
        };
        if (window.PointerEvent) key.addEventListener('pointerdown', down);
        else { key.addEventListener('mousedown', down); key.addEventListener('touchstart', down, { passive: false }); }
        key.addEventListener('click', function (e) { e.preventDefault(); send(form); });
      }
      // and from the keyboard: Ctrl+Enter (or ⌘+Enter) in the writing box sends, as the key does — Enter alone stays a new line
      if (body) body.addEventListener('keydown', function (e) {
        if ((e.ctrlKey || e.metaKey) && (e.key === 'Enter' || e.keyCode === 13)) { e.preventDefault(); send(form); }
      });
      form.addEventListener('submit', function (e) {
        if (form.getAttribute('data-native')) return;                 // falling back to a plain post
        e.preventDefault();
        send(form);
      });
    });
  }

  /* A word in the device over the form — the box left empty, the station out of reach — in place of any before it. */
  function say(form, words) {
    var note = stage.querySelector('.flash.err');
    if (!note) { note = document.createElement('div'); note.className = 'flash err'; form.parentNode.insertBefore(note, form); }
    note.setAttribute('role', 'alert');
    note.textContent = words;
  }

  /* The form's fields as a plain post would send them (a box ticked, a field with a name; never the key itself). */
  function encode(form) {
    var out = [];
    Array.prototype.forEach.call(form.elements, function (el) {
      if (!el.name || el.disabled || el.type === 'submit' || el.type === 'button' || el.type === 'file') return;
      if ((el.type === 'checkbox' || el.type === 'radio') && !el.checked) return;
      out.push(encodeURIComponent(el.name) + '=' + encodeURIComponent(el.value));
    });
    return out.join('&').replace(/%20/g, '+');
  }

  function send(form) {
    if (form.getAttribute('data-sending')) return;                    // one sending at a time
    var key = form.querySelector('button[type=submit]');
    var box = form.querySelector('textarea[name=body]');
    if (box && box.value.replace(/\s+/g, '').length < 2) {             // nothing to send: said, not refused in silence
      say(form, t('Write something before transmitting.'));
      box.focus();
      return;
    }
    form.setAttribute('data-sending', '1');
    try { document.dispatchEvent(new CustomEvent('mcs:sending')); } catch (e) { /* an old browser: nobody listens */ }
    if (key) { key.disabled = true; key.classList.add('is-sending'); }
    var over = false, xhr = new XMLHttpRequest();
    function giveBack() {
      if (over) return false;
      over = true;
      form.removeAttribute('data-sending');
      if (key) { key.disabled = false; key.classList.remove('is-sending'); }
      return true;
    }
    function failed() {
      if (!giveBack()) return;
      if (kiosk) { say(form, t('Not sent — the station could not be reached. Try again.')); return; }
      // the site: the station could not be reached this way — the form posts normally, which the server answers with a
      // redirect
      form.setAttribute('data-native', '1');
      HTMLFormElement.prototype.submit.call(form);
    }
    xhr.open('POST', form.getAttribute('action') || '/communicate', true);
    xhr.setRequestHeader('Content-Type', 'application/x-www-form-urlencoded; charset=UTF-8');
    xhr.setRequestHeader('X-Requested-With', 'fetch');                // the server answers with the device's fragment
    xhr.timeout = WAIT;
    xhr.onload = function () {
      if (over) return;
      if (xhr.status < 200 || xhr.status >= 300 || !xhr.responseText) { failed(); return; }
      over = true;
      swap(xhr.responseText);
      if (window.MCSBoard) window.MCSBoard.refresh('');
    };
    xhr.onerror = failed; xhr.ontimeout = failed; xhr.onabort = failed;
    setTimeout(function () { if (!over) { try { xhr.abort(); } catch (e) { /* gone */ } failed(); } }, WAIT + 2000);   // whatever the browser does
    try { xhr.send(encode(form)); } catch (e) { failed(); }
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
    } else if (tagged && chip && kiosk) {
      chip.textContent = chip0;                                     // the next person at the screen: no callsign yet
      chip.classList.add('dev-chip-later');
    }
  }

  function refresh() {
    fetch(refreshUrl, { credentials: 'same-origin', cache: 'no-store',
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

    // the word that takes the clock's place is longer than the clock in some languages — ANGEKOMMEN where T−00:12 stood
    // (8 October: "fix the Angekommen text", cut off at the column's edge): it is set a size down until it fits its column
    function fitWord(el) {
      if (!el || !el.isConnected) return;
      el.style.fontSize = '';
      var fs = parseFloat(getComputedStyle(el).fontSize) || 0, w = el.clientWidth, sw = el.scrollWidth;
      if (fs && w && sw > w + 1) el.style.fontSize = Math.max(14, Math.floor(fs * w / sw * 0.97)) + 'px';
    }
    function arrived() {
      if (clock) { clock.textContent = t('ARRIVED'); clock.classList.add('is-word'); fitWord(clock); }
      window.addEventListener('resize', function () { if (block.isConnected) fitWord(clock); });
      if (bar) bar.style.width = '100%';
      if (pct) pct.textContent = '100%';
      place(1);
      if (word) word.textContent = t('Arrived');
      block.classList.add('done');
      var state = block.querySelector('.state');
      if (state) state.textContent = t('Delivered · awaiting review');
      // Hold on ARRIVED for a moment (longer on the writing screen, where the
      // read-out names the callsign to take away: data-hold), then bring the
      // composer back with the real server-side state — in place, without a reload.
      // The page is told first (mcs:arrived, with the hold): the pop-up closes and
      // the visitor is taken to the board before the empty box could show again
      // (write.js, tabbar.js — October: "do not show the write box again").
      var hold = Number(block.dataset.hold) || 2600;
      try { document.dispatchEvent(new CustomEvent('mcs:arrived', { detail: { hold: hold, kiosk: !!(stage && stage.getAttribute('data-kiosk')) } })); } catch (e) { /* an old browser: the swap alone */ }
      setTimeout(function () {
        if (!block.isConnected) return;
        if (stage && window.fetch) refresh(); else window.location.reload();
      }, hold);
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
