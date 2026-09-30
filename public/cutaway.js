/* MARS!platz — inside the habitat (src/views/pages/cutaway.js; the styles under "inside the habitat" in sheet.css).
 *
 * The cutaway drawing of Habitat One, a part of it in colour under the hand, and beside it what that part is. One
 * part is selected at a time: the hand over its outline on the drawing, a touch on it, a press on its chip under the
 * drawing, or the keyboard (the outlines and the chips take focus; Enter or Space selects, the arrow keys move along
 * the chips). Selecting a part shows its colour — the coloured drawing clipped to the part, fading in — and its
 * article in the panel; the part stays selected when the hand leaves it, so the panel is read in peace. The live
 * sentences in the panel (what is happening in each part now) are asked for again every twenty seconds from
 * /api/dome, as the dome's keys ask for theirs, while the page is in view. Nothing here is sent anywhere. */
(function () {
  'use strict';
  var root = document.getElementById('cutaway'); if (!root) return;
  var hits = [].slice.call(root.querySelectorAll('.cut-hit')), chips = [].slice.call(root.querySelectorAll('.cut-chips .chip'));
  var colours = [].slice.call(root.querySelectorAll('.cut-colour')), articles = [].slice.call(root.querySelectorAll('.cut-about'));
  var current = root.getAttribute('data-first') || (articles[0] && articles[0].getAttribute('data-module')) || '';

  function select(id, focusChip) {
    if (!id) return;
    current = id;
    colours.forEach(function (c) { c.classList.toggle('is-on', c.getAttribute('data-module') === id); });
    hits.forEach(function (h) { h.classList.toggle('is-on', h.getAttribute('data-module') === id); });
    articles.forEach(function (a) { var on = a.getAttribute('data-module') === id; a.classList.toggle('is-on', on); a.hidden = !on; });
    chips.forEach(function (c) {
      var on = c.getAttribute('data-module') === id;
      c.classList.toggle('active', on); c.setAttribute('aria-selected', on ? 'true' : 'false'); c.tabIndex = on ? 0 : -1;
      if (on && focusChip) c.focus();
    });
  }
  function idOf(el) { return el.getAttribute('data-module'); }
  // the outlines on the drawing: the hand over one, a touch, or the keyboard
  hits.forEach(function (h) {
    h.addEventListener('mouseenter', function () { select(idOf(h)); });
    h.addEventListener('click', function () { select(idOf(h)); });
    h.addEventListener('focus', function () { select(idOf(h)); });
    h.addEventListener('keydown', function (e) { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); select(idOf(h)); } });
  });
  // the chips under it: a press, the hand over one on a desk, the arrow keys along the row
  chips.forEach(function (c, i) {
    c.addEventListener('click', function () { select(idOf(c)); });
    c.addEventListener('mouseenter', function () { if (window.matchMedia && window.matchMedia('(hover: hover)').matches) select(idOf(c)); });
    c.addEventListener('keydown', function (e) {
      var to = e.key === 'ArrowRight' || e.key === 'ArrowDown' ? i + 1 : e.key === 'ArrowLeft' || e.key === 'ArrowUp' ? i - 1 : e.key === 'Home' ? 0 : e.key === 'End' ? chips.length - 1 : -1;
      if (to < 0) return;
      e.preventDefault(); select(idOf(chips[(to + chips.length) % chips.length]), true);
    });
  });
  select(current);

  /* ------------------------------------------------------------ the live sentences, every twenty seconds while in view */
  var seen = true, busy = false;
  function refresh() {
    if (busy || document.hidden || !seen || !window.fetch) return; busy = true;
    fetch('/api/dome', { cache: 'no-store' }).then(function (r) { return r.json(); }).then(function (f) {
      root.querySelectorAll('[data-field]').forEach(function (n) {
        var k = n.getAttribute('data-field'), v;
        if (k === 'stamp') v = f.stamp; else { var m = k.match(/^(\w+)-(text|more)$/); v = m && f[m[1]] ? f[m[1]][m[2]] : null; }
        if (typeof v === 'string' && n.textContent !== v) n.textContent = v;
      });
    }).catch(function () { /* next time */ }).then(function () { busy = false; });
  }
  if ('IntersectionObserver' in window) new IntersectionObserver(function (es) { seen = es[es.length - 1].isIntersecting; }).observe(root);
  setInterval(refresh, 20000);
})();
