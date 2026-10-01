/* MARS!platz — the day's mission, typed, on the installation's mission screen (/screen/mission, src/views/pages/
 * screens.js: the Today's Mission panel the dashboard shows still; the styles under "the dashboard, alive" in aura.css).
 *
 * The mission's words — its title, its central question, the three parts of the day, the question for the community
 * hour — appear as if someone were typing them: letter by letter, a short halt at a full stop, a cursor after the last
 * letter typed. Every word is on the page from the start and keeps its place; the ones not yet typed are simply not
 * seen (colour: transparent), so nothing moves while the typing goes on, and a reader with assistive technology reads
 * the whole text as written. Typed to the end, the words stay for a few minutes (HOLD); then the panel is cleared and
 * typed again. The typing waits until the panel is in view, so it is seen from its first letter; it stands still where
 * the visitor asks for less motion (the words then shown whole). Nothing here is sent anywhere. */
(function () {
  'use strict';
  var body = document.querySelector('#mission-today .mission-body'); if (!body) return;
  var calm = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (calm || !window.requestAnimationFrame) return;

  var HOLD = 3 * 60 * 1000;                     // typed to the end, the words stay this long before they are typed again
  var PER = 22, JITTER = 24;                     // ms a letter, and the most added at random
  var REST = { '.': 420, '?': 520, '!': 420, ':': 300, ',': 160, ';': 200 }, LINE = 260;   // halts after punctuation and at a line's end
  var SLOW = 1.3;                                // the screen types a third slower than those figures: every wait is stretched by it

  /* ------------------------------------------------------------ the words, each text node split in two spans */
  var slots = [];                                // { on, off, text, li } in reading order
  (function walk(n) {
    for (var c = n.firstChild; c; c = c.nextSibling) {
      if (c.nodeType === 1) { if (c.getAttribute('aria-hidden') === 'true' || /^(script|style)$/i.test(c.tagName)) continue; walk(c); }
      else if (c.nodeType === 3 && /\S/.test(c.nodeValue)) {
        var text = c.nodeValue, wrap = document.createElement('span'), on = document.createElement('span'), off = document.createElement('span');
        wrap.className = 'tw'; on.className = 'tw-on'; off.className = 'tw-off'; off.textContent = text;
        wrap.appendChild(on); wrap.appendChild(off);
        c.parentNode.replaceChild(wrap, c); c = wrap;
        slots.push({ on: on, off: off, text: text, li: wrap.closest ? wrap.closest('li') : null });
      }
    }
  })(body);
  if (!slots.length) return;
  var cursor = document.createElement('i'); cursor.className = 'tw-cursor'; cursor.setAttribute('aria-hidden', 'true');

  /* ------------------------------------------------------------ typing */
  var seen = false, timer = null, at = 0, pos = 0;
  function clear() {
    slots.forEach(function (s) { s.on.textContent = ''; s.off.textContent = s.text; if (s.li) s.li.classList.remove('tw-seen'); });
    at = 0; pos = 0; body.classList.add('is-typing');
  }
  function showAll() {
    slots.forEach(function (s) { s.on.textContent = s.text; s.off.textContent = ''; if (s.li) s.li.classList.add('tw-seen'); });
    if (cursor.parentNode) cursor.parentNode.removeChild(cursor);
    body.classList.remove('is-typing');
  }
  function step() {
    timer = null;
    if (!seen) return;                           // out of view: the typing waits where it is
    var s = slots[at];
    if (!s) { showAll(); timer = setTimeout(function () { clear(); step(); }, HOLD); return; }
    if (pos === 0 && s.li) s.li.classList.add('tw-seen');
    // the next letter — leading blanks all at once, they are not typed
    var next = pos; while (next < s.text.length && /\s/.test(s.text.charAt(next))) next++;
    if (next < s.text.length) next++;
    pos = next;
    s.on.textContent = s.text.slice(0, pos); s.off.textContent = s.text.slice(pos);
    s.on.appendChild(cursor);
    var ch = s.text.charAt(pos - 1), wait = PER + Math.random() * JITTER + (REST[ch] || 0);
    if (pos >= s.text.length) { at++; pos = 0; wait += LINE; }
    timer = setTimeout(step, wait * SLOW);
  }
  function resume() { if (seen && !timer && at < slots.length) step(); }

  // typed from the first letter when the panel comes into view; carried on when it comes back
  clear();
  if ('IntersectionObserver' in window) {
    new IntersectionObserver(function (es) { es.forEach(function (e) { seen = e.isIntersecting; }); resume(); }, { threshold: 0.15 }).observe(body);
  } else { seen = true; resume(); }
})();
