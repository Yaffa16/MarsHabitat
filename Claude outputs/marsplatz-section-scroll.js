/* MARS!platz — scrolling section by section.
 *
 * Mark each stop in the page with data-stop, in reading order:
 *   <section id="portal" data-stop> … </section>          the Communication Portal (composer + board)
 *   <div data-stop> <h2>Mission dashboard</h2> … </div>     the dashboard's heading
 *   <section id="habitat" data-stop> … </section>          the Habitat panel
 *   <section id="blogs" data-stop> <h2>Daily Blog</h2> … </section>
 * The top of the page is always the first stop.
 *
 * One turn of the wheel, one trackpad swipe, Page Down or the arrow keys carries the page to the next stop.
 * A stop taller than the window (the Habitat with the Trends beneath it) is walked a screen at a time; the next turn
 * then jumps on. Below 760 px (phones) the page keeps its ordinary scroll.
 * Wheel events over a box that scrolls on its own (mark it data-own-scroll: a blog entry, the menu) keep their meaning.
 * Wheel units are normalised (Firefox reports lines, not pixels), a notch of a mouse wheel always counts as a fresh turn,
 * and a trackpad's stream of small ticks counts once — until it pauses, reverses or speeds up again.
 */
(function () {
  var OFFSET = 28;                                                                  // breathing room above each stop
  var wide = function () { return window.innerWidth >= 760; };
  var calm = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var busy = false, lastWheel = 0, lastDir = 0, lastMag = 0;

  function stops() {
    var out = [0];
    document.querySelectorAll('[data-stop]').forEach(function (el) {
      out.push(Math.max(0, Math.round(el.getBoundingClientRect().top + window.pageYOffset - OFFSET)));
    });
    return out;
  }
  function current(S) { var y = window.pageYOffset, i = 0; for (var k = 0; k < S.length; k++) if (y >= S[k] - 2) i = k; return i; }
  function go(top) {
    busy = true;
    window.scrollTo({ top: top, behavior: calm ? 'auto' : 'smooth' });
    var done = function () { busy = false; window.removeEventListener('scrollend', done); };
    window.addEventListener('scrollend', done);
    setTimeout(done, 900);                                                          // for browsers without scrollend
  }
  function ownScroll(target, dy) {                                                  // a scrolling box under the pointer that can still move that way
    var box = target && target.closest ? target.closest('[data-own-scroll], textarea') : null;
    if (!box || box.scrollHeight <= box.clientHeight + 1) return false;
    return dy > 0 ? box.scrollTop + box.clientHeight < box.scrollHeight - 1 : box.scrollTop > 0;
  }
  function step(dir) {                                                              // +1 down, -1 up; true when the page is on its way
    var S = stops(), i = current(S), y = window.pageYOffset, vh = window.innerHeight, docH = document.documentElement.scrollHeight;
    var screen = vh - 80;                                                           // a screen's worth, with a little overlap
    if (dir > 0) {
      var end = i + 1 < S.length ? S[i + 1] : docH;                                 // the foot of this stop is the next stop's head, or the page's
      var last = Math.max(S[i], end - vh);                                          // the lowest position that still belongs to this stop
      if (y < last - 2 && last - y > vh * 0.25) { go(Math.min(y + screen, last)); return true; }   // a tall stop: its next screen
      if (i + 1 >= S.length) { if (y < docH - vh - 2) { go(docH - vh); return true; } return false; }   // the last stop: the page's foot
      go(S[i + 1]); return true;
    }
    if (y > S[i] + 2 && y - S[i] > vh * 0.25) { go(Math.max(y - screen, S[i])); return true; }        // back up through a tall stop
    if (i === 0) { if (y > 2) { go(0); return true; } return false; }
    go(S[i - 1]); return true;
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
