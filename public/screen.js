/* MARS!platz — the installation's screens (src/views/pages/screens.js, public/screen.css).
 *
 * What the page does for a screen that must show the whole of one thing at a glance:
 *  - fits the stage's body to the screen: where the body's content is taller (or wider) than the room it has, it is
 *    scaled down until it fits (the browser's zoom where it has one, a transform where not) — a long mission, the day;
 *    on the board and in the gallery nothing is scaled: the cards or tiles that would be cut at the foot are hidden
 *    instead, so the last row is whole (data-fit="clip"); the trends, landscape, are drawn to the height by the
 *    stylesheet alone (data-fit-landscape="fill"); the habitat is laid out at a screen's width of its own — 1920 wide
 *    landscape, 1080 upright — and zoomed to the screen's actual width, its panel rolling by under its head
 *    (data-fit="roll", screen-roll.js) — screens.js says which way each screen is fitted; the browser's zoom is used
 *    only where it measures what it zooms as it is shown (a browser from before the zoom was standardised — Chrome
 *    before 128, Safari — reports a zoomed piece at its size before the zoom, and the fitting would chase it to twice
 *    the size, over the screen's edges: 8 October, the writing screen at the venue); else a transform;
 *  - fits again whenever the content changes (the board's cards, the gallery's tiles, the habitat's readings arrive by
 *    themselves, a graph drawn again), whenever the screen changes size or turns, and every other second if the last
 *    fitting was overtaken by a drawing that grew after it;
 *  - keeps the clock in the head on the venue's time;
 *  - reloads the page every five minutes (a little apart on every screen, so the station is not asked by all at once)
 *    and at the venue's midnight, when the sol turns — not while someone is writing on the writing screen, and on the
 *    rolled habitat at the roll's turn, while its sheet is faded out (screen-roll.js).
 * The screens are display-only but for the writing screen (screen-write.js): nothing here is ever sent anywhere. */
(function () {
  'use strict';
  var body = document.getElementById('stage-body'), fitEl = document.getElementById('stage-fit'); if (!body || !fitEl) return;
  // how the piece is fitted: data-fit, or data-fit-landscape while the screen is wider than tall (the trends: scaled
  // upright, drawn to the height landscape — screen.css, data-fit="fill"); the body carries the way in use, for the
  // stylesheet
  var fitBase = document.body.getAttribute('data-fit') || 'scale', fitLand = document.body.getAttribute('data-fit-landscape') || '';
  var fit = fitBase;
  function chooseFit() {
    var f = (fitLand && window.innerWidth > window.innerHeight) ? fitLand : fitBase;
    if (f !== fit) { fit = f; scale(1); }
    if (document.body.getAttribute('data-fit') !== fit) {
      document.body.setAttribute('data-fit', fit);
      // the stylesheet lays the piece out anew for this way of fitting: the drawings that draw to their room (the
      // trends' graph, habitat.js) are told, once the layout has settled
      setTimeout(function () { window.dispatchEvent(new Event('resize')); }, 60);
    }
  }
  var minWidth = Number(document.body.getAttribute('data-min-width')) || 0;    // the width the piece keeps its layout at
  var tz = document.body.getAttribute('data-tz') || 'Europe/Berlin';
  // the browser's zoom, where it has one and measures a zoomed piece as it is shown; a transform where not (above)
  var zoomable = typeof CSS !== 'undefined' && CSS.supports && CSS.supports('zoom', '1') && zoomMeasured();
  function zoomMeasured() {
    var o = document.createElement('div'), i = document.createElement('div'), h = 0;
    o.style.cssText = 'position:absolute;left:0;top:0;width:10px;visibility:hidden;pointer-events:none;zoom:2';
    i.style.height = '50px'; o.appendChild(i); document.body.appendChild(o);
    try { h = i.getBoundingClientRect().height; } catch (e) { h = 0; }
    document.body.removeChild(o);
    return Math.abs(h - 100) < 3;                                         // 50 px zoomed twice is shown — and measured — 100 high
  }
  // and, once zoomed, looked at again: a piece shown no larger than it is laid out was not measured as shown — the
  // transform from then on
  function zoomHonest(z) {
    if (!zoomable || Math.abs(z - 1) < 0.05) return true;
    var k = fitEl.firstElementChild; if (!k || k.offsetHeight < 20) return true;
    var shown = k.getBoundingClientRect().height, laid = k.offsetHeight;
    if (Math.abs(shown - laid * z) <= Math.abs(shown - laid)) return true;
    zoomable = false; fitEl.style.zoom = ''; return false;
  }

  /* ------------------------------------------------------------ fitting */
  function extent() {                                                  // how far the content reaches, in the screen's pixels
    var r = body.getBoundingClientRect(), b = r.top, right = r.left, kids = [].slice.call(fitEl.children), i;
    // (the composer's box as well as what holds it: the writing screen's box must be whole, its foot and its head)
    kids = kids.concat([].slice.call(fitEl.querySelectorAll('.composer-device')));
    for (i = 0; i < kids.length; i++) {
      var k = kids[i].getBoundingClientRect();
      if (k.bottom > b) b = k.bottom; if (k.right > right) right = k.right;
    }
    return { have: r.height, need: b - r.top, haveW: r.width, needW: right - r.left };
  }
  function scale(z) {
    var s = fitEl.style;
    if (zoomable) { s.zoom = z === 1 ? '' : String(z); return; }
    if (z === 1) { s.transform = s.transformOrigin = s.width = s.height = s.position = s.top = s.left = ''; return; }
    s.transformOrigin = 'top left';
    s.width = (100 / z) + '%';                                            // laid out at the width the scale leaves
    if (fit === 'scale') {
      // centred in the body by its height before the scale — a transform moves nothing — so moved by half of what the
      // scale takes off (or adds): the piece stands in the middle as it is shown
      s.height = s.position = s.top = s.left = '';
      var h = fitEl.offsetHeight;
      s.transform = 'translateY(' + (h * (1 - z) / 2).toFixed(1) + 'px) scale(' + z + ')';
    } else {
      // the board, the gallery, the habitat fill the body from its top: laid out as tall as the body divided by the
      // scale, held at the body's top left (out of the body's centring)
      s.position = 'absolute'; s.top = '0'; s.left = '0'; s.height = (100 / z) + '%';
      s.transform = 'scale(' + z + ')';
    }
  }
  // scaled to fit: up as well as down, so a screen larger than the piece shows it large (up to twice, and never so far
  // that the piece is made narrower than its layout stands — data-min-width — or that it no longer fits), a screen
  // smaller shows it whole
  var lastZ = 1, curZ = 1, wideBound = false;                             // the scale the drawings were last told of, the scale now, and whether the width, not the height, set it
  function fitScale() {
    scale(1);
    var z = 1, e = extent(), i, top = Math.min(2, minWidth ? Math.max(1, window.innerWidth / minWidth) : 2);
    for (i = 0; i < 5; i++) {
      // by the height: the piece is as wide as the screen at any scale (the layout reflows to the width the scale leaves)
      var want = z * (e.have / Math.max(1, e.need)) * 0.985;
      want = Math.max(0.3, Math.min(top, want));                        // down to a third: a short screen's habitat is small rather than cut
      if (Math.abs(want - z) < 0.01) break;
      z = want; scale(z); e = extent();
    }
    // never over the edge: a last step down if the layout at this size runs out
    for (i = 0; i < 3 && (e.need > e.have + 1 || e.needW > e.haveW + 1); i++) { z = z * 0.97; scale(z); e = extent(); }
    if (!zoomHonest(z)) { fitScale(); return; }                          // the zoom not measured as shown: fitted again, by a transform
    curZ = z; wideBound = e.needW > e.haveW * 0.97 && e.need < e.have * 0.92;
    // the scripts that draw to the width they are given (the trends' graph draws itself for a narrow panel) are told the
    // width changed — once per change of scale, not on every fitting, so the fitting and the drawing do not chase each other
    if (Math.abs(z - lastZ) > 0.05) { lastZ = z; setTimeout(function () { window.dispatchEvent(new Event('resize')); }, 30); }
  }
  // the rolled habitat (screen-roll.js): laid out as on a screen 1920 wide, landscape, or 1080, upright, and zoomed to
  // the width it actually has — the same rows and the same type on any screen, larger on a larger one; its height is
  // the roll's business
  function rollZoom() {
    var z = Math.max(0.5, Math.min(2, window.innerWidth / (window.innerWidth > window.innerHeight ? 1920 : 1080)));
    if (Math.abs(z - curZ) > 0.005) { curZ = z; scale(z); }
  }
  // the board and the gallery are not scaled to fit — their rows are cut — but read larger on a large screen
  function baseZoom() {
    if (fit !== 'clip') return;
    var z = Math.max(1, Math.min(1.6, Math.min(window.innerWidth, window.innerHeight * 1.5) / 1440));
    scale(z);
    if (!zoomHonest(z)) scale(z);
  }
  function fitClip() {
    // (hiding is by visibility, which moves nothing: one look at each card or tile says whether it is over the edge; a
    // class is touched only where it changes, so a fitting that changes nothing is silent — the watcher below would
    // otherwise have it fitted again, and again)
    // A card is over the edge where it reaches past the body's foot — or past the foot of any box round it that cuts
    // what runs over (the board's list: its cards end above the panel's own foot, 8 October), less that box's padding,
    // which is there for the cards' shadows: a card reaching into it would have its shadow cut square.
    var items = fitEl.querySelectorAll('.card, .mtile'), r = body.getBoundingClientRect(), run = {};
    var foot = r.bottom - 2, edge = r.right + 1;                          // a hair inside the body's foot
    function limits(el) {
      var b = foot, rt = edge, p = el.parentElement;
      for (; p && p !== fitEl && p !== body; p = p.parentElement) {
        var c = p.__fitClip;
        if (!c || c.run !== run) {
          var cs = window.getComputedStyle(p), k = null;
          if (cs.overflowY !== 'visible' || cs.overflowX !== 'visible') {
            var q = p.getBoundingClientRect(), f = p.offsetHeight ? q.height / p.offsetHeight : 1;   // its scale as shown
            k = { b: q.bottom - ((parseFloat(cs.borderBottomWidth) || 0) + (parseFloat(cs.paddingBottom) || 0)) * f + 2,
                  r: q.right - ((parseFloat(cs.borderRightWidth) || 0) + (parseFloat(cs.paddingRight) || 0)) * f + 1 };
          }
          c = p.__fitClip = { run: run, k: k };
        }
        if (c.k) { if (c.k.b < b) b = c.k.b; if (c.k.r < rt) rt = c.k.r; }
      }
      return { b: b, r: rt };
    }
    [].forEach.call(items, function (el) {
      var k = el.getBoundingClientRect(), lim = limits(el), cut = k.bottom > lim.b || k.right > lim.r;
      if (el.classList.contains('is-cut') !== cut) el.classList.toggle('is-cut', cut);
    });
    // a day's head in the gallery with every picture under it cut is cut too
    [].forEach.call(fitEl.querySelectorAll('.cloud-day'), function (d) {
      var tiles = d.querySelectorAll('.mtile'), shown = 0;
      [].forEach.call(tiles, function (t) { if (!t.classList.contains('is-cut')) shown++; });
      var cut = tiles.length > 0 && !shown;
      if (d.classList.contains('is-cut') !== cut) d.classList.toggle('is-cut', cut);
    });
  }
  var pending = null;
  function fitNow() {
    chooseFit();
    if (fit === 'clip') { baseZoom(); fitClip(); } else if (fit === 'scale') fitScale(); else if (fit === 'roll') rollZoom();
  }
  function refit() {
    clearTimeout(pending);
    pending = setTimeout(fitNow, 120);
  }
  chooseFit();
  refit();
  window.addEventListener('resize', refit);
  window.addEventListener('load', refit);
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(refit);
  // anything that changes under the wrapper — a card arriving, a reading, a graph drawn again for its width (an
  // attribute of the drawing's, as much as a new child) — has the piece fitted again; the fitting's own changes to the
  // wrapper are not a change of content
  // (not on the rolled habitat: its zoom is the screen's width's alone, and its sheet and its astronauts move every
  // frame — a fitting put off until they stopped would never come)
  // (nor while someone types or presses the key on the writing screen: what changes in its form — the count of
  // characters, the key held while a message leaves — changes nothing of its size, and a fitting then could move the key
  // from under a finger; the form's swap for the crossing, and back, is a change of the device and is fitted)
  var inForm = function (n) { var e = n && n.nodeType === 1 ? n : n && n.parentNode; return !!(e && e.closest && e.closest('form.composer')); };
  if (window.MutationObserver) new MutationObserver(function (ms) {
    if (fit === 'roll') return;
    for (var i = 0; i < ms.length; i++) if (ms[i].target !== fitEl && !inForm(ms[i].target)) { refit(); return; }
  }).observe(fitEl, { childList: true, subtree: true, attributes: true });
  setTimeout(refit, 1500); setTimeout(refit, 4000);                    // the habitat's instruments and the trends draw themselves a moment after the page
  // and, whatever was missed — a drawing that grew after the last fitting without a word — the fit is looked at every
  // other second: over the edge, or with room to spare it could take, the piece is fitted again (a cheap look otherwise)
  setInterval(function () {
    if (pending || document.hidden) return;
    if (fit === 'scale') {
      var e = extent(), top = Math.min(2, minWidth ? Math.max(1, window.innerWidth / minWidth) : 2);
      if (e.need > e.have + 1 || e.needW > e.haveW + 1 || (e.need < e.have * 0.92 && curZ < top - 0.02 && !wideBound)) fitNow();
    } else if (fit === 'clip') fitClip();
  }, 2000);

  /* ------------------------------------------------------------ the clock, on the venue's time */
  var clock = document.getElementById('stage-clock');
  function tick() {
    if (!clock) return;
    try { clock.textContent = new Intl.DateTimeFormat('en-GB', { timeZone: tz, hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false }).format(new Date()); }
    catch (e) { clock.textContent = new Date().toTimeString().slice(0, 8); }
  }
  tick(); setInterval(tick, 1000);

  /* ------------------------------------------------------------ reloading: every five minutes, and at the venue's midnight */
  function venueDate() {
    try { return new Intl.DateTimeFormat('en-CA', { timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date()); }
    catch (e) { return new Date().toISOString().slice(0, 10); }
  }
  // (the writing screen says when someone is writing — screen-write.js, MCSScreenBusy — and a reload waits for them)
  var busy = function () { return !!(window.MCSScreenBusy && window.MCSScreenBusy()); };
  // (a rolled screen reloads at its roll's turn, while its sheet is faded out — screen-roll.js, MCSScreenRoll)
  var reload = function () { if (window.MCSScreenRoll) window.MCSScreenRoll.reloadAtTurn(); else location.reload(); };
  var day0 = venueDate();
  (function later(ms) { setTimeout(function () { if (busy()) return later(60000); reload(); }, ms); })(5 * 60 * 1000 + Math.floor(Math.random() * 20000));
  setInterval(function () { if (venueDate() !== day0 && !busy()) reload(); }, 30000);
})();
