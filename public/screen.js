/* MARS!platz — the installation's screens (src/views/pages/screens.js, public/screen.css).
 *
 * What the page does for a screen that must show the whole of one thing at a glance:
 *  - fits the stage's body to the screen: where the body's content is taller (or wider) than the room it has, it is
 *    scaled down until it fits (the browser's zoom where it has one, a transform where not) — the habitat's instruments,
 *    a long mission, the blogs; on the board and in the gallery nothing is scaled: the cards or tiles that would be cut
 *    at the foot are hidden instead, so the last row is whole (data-fit="clip"); the trends, landscape, are drawn to the
 *    height by the stylesheet alone (data-fit-landscape="fill" — screens.js says which way each screen is fitted);
 *  - fits again whenever the content changes (the board's cards, the gallery's tiles, the habitat's readings arrive by
 *    themselves, a graph drawn again), whenever the screen changes size or turns, and every other second if the last
 *    fitting was overtaken by a drawing that grew after it;
 *  - keeps the clock in the head on the venue's time;
 *  - reloads the page every five minutes (a little apart on every screen, so the station is not asked by all at once)
 *    and at the venue's midnight, when the sol turns — not while someone is writing on the writing screen.
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
  var zoomable = typeof CSS !== 'undefined' && CSS.supports && CSS.supports('zoom', '1');

  /* ------------------------------------------------------------ fitting */
  function extent() {                                                  // how far the content reaches, in the screen's pixels
    var r = body.getBoundingClientRect(), b = r.top, right = r.left, kids = fitEl.children, i;
    for (i = 0; i < kids.length; i++) {
      var k = kids[i].getBoundingClientRect();
      if (k.bottom > b) b = k.bottom; if (k.right > right) right = k.right;
    }
    return { have: r.height, need: b - r.top, haveW: r.width, needW: right - r.left };
  }
  function scale(z) {
    if (zoomable) { fitEl.style.zoom = z === 1 ? '' : String(z); return; }
    fitEl.style.transformOrigin = 'top left';
    fitEl.style.transform = z === 1 ? '' : 'scale(' + z + ')';
    fitEl.style.width = z === 1 ? '' : (100 / z) + '%';
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
    curZ = z; wideBound = e.needW > e.haveW * 0.97 && e.need < e.have * 0.92;
    // the scripts that draw to the width they are given (the trends' graph draws itself for a narrow panel) are told the
    // width changed — once per change of scale, not on every fitting, so the fitting and the drawing do not chase each other
    if (Math.abs(z - lastZ) > 0.05) { lastZ = z; setTimeout(function () { window.dispatchEvent(new Event('resize')); }, 30); }
  }
  // the board and the gallery are not scaled to fit — their rows are cut — but read larger on a large screen
  function baseZoom() {
    if (fit !== 'clip') return;
    var z = Math.max(1, Math.min(1.6, Math.min(window.innerWidth, window.innerHeight * 1.5) / 1440));
    scale(z);
  }
  function fitClip() {
    // (hiding is by visibility, which moves nothing: one look at each card or tile says whether it is over the edge; a
    // class is touched only where it changes, so a fitting that changes nothing is silent — the watcher below would
    // otherwise have it fitted again, and again)
    var items = fitEl.querySelectorAll('.card, .mtile'), r = body.getBoundingClientRect();
    r = { bottom: r.bottom - 2, right: r.right + 1 };                     // a hair inside the body's foot
    [].forEach.call(items, function (el) {
      var k = el.getBoundingClientRect(), cut = k.bottom > r.bottom || k.right > r.right;
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
    if (fit === 'clip') { baseZoom(); fitClip(); } else if (fit === 'scale') fitScale();
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
  if (window.MutationObserver) new MutationObserver(function (ms) {
    for (var i = 0; i < ms.length; i++) if (ms[i].target !== fitEl) { refit(); return; }
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
  var day0 = venueDate();
  (function later(ms) { setTimeout(function () { if (busy()) return later(60000); location.reload(); }, ms); })(5 * 60 * 1000 + Math.floor(Math.random() * 20000));
  setInterval(function () { if (venueDate() !== day0 && !busy()) location.reload(); }, 30000);
})();
