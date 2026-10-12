/* MARS!platz — the Habitat screen, blinking (src/views/pages/screens.js, habitat; public/screen.css, *the habitat screen,
 * blinking*).
 *
 * 12 October: "make it look more urgent and alive and blinky — keep the original aesthetic". The stylesheet blinks the
 * status lights by the tiles' names and throbs a tile over its limit; this lights a tile's edge once when its reading
 * changes (not when a reading first arrives, nor when it goes): it marks the tile (is-pulse) and adds the layer the edge
 * is drawn on. Nothing on a screen drawn light (html.lite, ?lite=1). Nothing is ever sent anywhere.
 */
(function () {
  'use strict';
  if (document.documentElement.classList.contains('lite')) return;
  var bento = document.getElementById('hbt-bento'); if (!bento) return;
  var tiles = [].filter.call(bento.children, function (e) { return e.matches('section.tile'); });
  tiles.forEach(function (t) {
    var ring = document.createElement('i'); ring.className = 'hab-ring'; ring.setAttribute('aria-hidden', 'true'); t.appendChild(ring);
    // a reading that changes (habitat.js writes the figures anew at every reading; only a different one counts)
    var fig = t.querySelector('.big, .fig-total, .bike-pc, .pwr-total'); if (!fig) return;
    var last = fig.textContent.trim();
    new MutationObserver(function () {
      var now = fig.textContent.trim();
      if (now === last) return;
      var was = last; last = now;
      if (!/\d/.test(now) || !/\d/.test(was)) return;                    // a reading arriving, or gone: no change of one
      t.classList.remove('is-pulse'); void t.offsetWidth; t.classList.add('is-pulse');
      setTimeout(function () { t.classList.remove('is-pulse'); }, 1800);
    }).observe(fig, { childList: true, characterData: true, subtree: true });
  });
})();
