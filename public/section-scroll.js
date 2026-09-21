/* MARS!platz — the landing page scrolls section by section.
 *
 * The stops are the elements marked data-stop, in reading order — the
 * Communication Portal (#write), the Mission dashboard's heading, the stack
 * of folders that holds the dashboard's panels — and the top of the page is
 * always the first. Loaded on the landing page only
 * (src/views/pages/public.js); without it the page scrolls as it always did.
 *
 * One turn of the wheel, one trackpad swipe, Page Down or the arrow keys carries the page to the next stop — heading to
 * heading, always (the stylesheet sizes every section to the window, see --u in aura.css); past the last stop a turn
 * shows the page's foot. Below 760 px (phones) the page keeps its ordinary scroll.
 * A box that scrolls on its own (a panel's list, the open folder, the board, a blog, a dialog, the textarea) takes the wheel only once the
 * pointer has actually been moved onto it since the page last turned — a pointer that merely happens to rest over such a
 * box after a turn does not stop the next turn. Wheel units are normalised (Firefox reports lines, not pixels), a notch of
 * a mouse wheel always counts as a fresh turn, and a trackpad's stream of small ticks counts once — until it pauses,
 * reverses or speeds up again. Below 760 px across or 520 px down (a phone, held either way) the page keeps its ordinary scroll.
 */
(function () {
  var OFFSET = 28;                                                                  // breathing room above each stop
  var wide = function () { return window.innerWidth >= 760 && window.innerHeight >= 520; };   // not on phones, however they are held
  var calm = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var busy = false, lastWheel = 0, lastDir = 0, lastMag = 0;
  var armed = false, px = null, py = null;                                          // armed: the pointer has moved since the page last turned
  document.addEventListener('mousemove', function (e) {
    if (px !== null && (e.clientX !== px || e.clientY !== py)) armed = true;        // a real move — not the browser's re-hover after a scroll
    px = e.clientX; py = e.clientY;
  }, { passive: true });

  function stops() {
    var out = [0], max = document.documentElement.scrollHeight - window.innerHeight;
    document.querySelectorAll('[data-stop]').forEach(function (el) {
      var top = Math.round(el.getBoundingClientRect().top + window.pageYOffset - OFFSET);
      out.push(Math.max(0, Math.min(max, top)));                                    // a stop the page cannot reach is the page's foot
    });
    return out;
  }
  function current(S) { var y = window.pageYOffset, i = 0; for (var k = 0; k < S.length; k++) if (y >= S[k] - 2) i = k; return i; }
  function go(top) {
    busy = true; armed = false;
    var quiet = null, fallback = null;
    var done = function () { busy = false; window.removeEventListener('scrollend', done); window.removeEventListener('scroll', tick); clearTimeout(quiet); clearTimeout(fallback); };
    var tick = function () { clearTimeout(quiet); quiet = setTimeout(done, 160); };   // no scroll event for a moment: the page has come to rest
    window.addEventListener('scrollend', done);
    window.addEventListener('scroll', tick);
    fallback = setTimeout(done, 1600);                                              // for a scroll that never reports at all
    window.scrollTo({ top: top, behavior: calm ? 'auto' : 'smooth' });
    tick();
  }
  function ownScroll(target, dy) {                                                  // a scrolling box under the pointer that can still move that way
    var box = target && target.closest ? target.closest('[data-own-scroll], .scroller, .blog-scroll, .log-scroll, .popup-body, .dpanel.scroll .dpanel-body, .folder-body, textarea') : null;
    if (!box || box.scrollHeight <= box.clientHeight + 1) return false;
    if (!armed && !box.closest('dialog, textarea')) return false;                   // the pointer only happens to rest here: the page turns
    return dy > 0 ? box.scrollTop + box.clientHeight < box.scrollHeight - 1 : box.scrollTop > 0;
  }
  function step(dir) {                                                              // +1 down, -1 up; true when the page is on its way
    var S = stops(), i = current(S), y = window.pageYOffset, vh = window.innerHeight, docH = document.documentElement.scrollHeight;
    if (dir > 0) {
      if (i + 1 < S.length) { go(S[i + 1]); return true; }                          // the next heading
      if (y < docH - vh - 2) { go(docH - vh); return true; }                        // past the last heading: the page's foot
      return false;
    }
    if (y > S[i] + 2) { go(S[i]); return true; }                                    // between headings (a dragged scrollbar): this one first
    if (i === 0) return false;
    go(S[i - 1]); return true;                                                      // the heading before
  }

  window.addEventListener('wheel', function (e) {
    if (!wide() || e.ctrlKey) return;                                               // phones scroll as usual; pinch-zoom is not a scroll
    var dy = e.deltaY * (e.deltaMode === 1 ? 20 : e.deltaMode === 2 ? window.innerHeight : 1);   // lines and pages as pixels
    var mag = Math.abs(dy); if (mag < 4) return;
    if (ownScroll(e.target, dy)) return;
    var now = performance.now(), dir = dy > 0 ? 1 : -1;
    var fresh = mag >= 50 || now - lastWheel > 260 || dir !== lastDir || mag > lastMag * 1.5;   // a notch, a pause, a reversal, a new swipe
    lastWheel = now; lastDir = dir; lastMag = mag;
    if (busy || !fresh) { e.preventDefault(); return; }                             // on its way, or the tail of the same gesture
    if (step(dir)) e.preventDefault();
  }, { passive: false });                                                           // passive: false — otherwise preventDefault is ignored

  document.addEventListener('keydown', function (e) {
    if (!wide() || e.altKey || e.ctrlKey || e.metaKey) return;
    var t = e.target, typing = t && (t.tagName === 'TEXTAREA' || t.tagName === 'INPUT' || t.isContentEditable);
    if (typing) return;
    if (e.key === 'ArrowDown' || e.key === 'PageDown' || (e.key === ' ' && !e.shiftKey)) { if (busy || step(1)) e.preventDefault(); }
    else if (e.key === 'ArrowUp' || e.key === 'PageUp' || (e.key === ' ' && e.shiftKey)) { if (busy || step(-1)) e.preventDefault(); }
  });
})();
