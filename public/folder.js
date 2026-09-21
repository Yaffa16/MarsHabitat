/* MARS!platz — the stack of folders on the dashboard (src/views/pages/public.js, folder()).
 *
 * Nine panels — Habitat, Habitat hardware and Trends at the back, Today's
 * Schedule, Meal and Crew Moods before them, the three blogs in front — one
 * folder each, their tabs in three rows. A press on a tab brings that folder
 * to the front: its panel shows, the others wait behind it. A link into one
 * of the panels (#habitat, #crew, #galley, #schedule — from the dome's keys,
 * the foot, or an address someone typed) does the same and brings the stack
 * into view. The arrow keys walk the tabs; Home and End go to the ends.
 * Nothing is remembered: every page opens on the first folder, the Habitat.
 */
(function () {
  var stack = document.getElementById('day-folder'); if (!stack) return;
  var tabs = [].slice.call(stack.querySelectorAll('.ftab[data-folder]'));
  var pages = [].slice.call(stack.querySelectorAll('.fpage[data-folder]'));
  function tabOf(id) { return tabs.filter(function (t) { return t.getAttribute('data-folder') === id; })[0] || null; }
  function front(id, focus) {
    if (!tabOf(id)) return false;
    tabs.forEach(function (t) {
      var on = t.getAttribute('data-folder') === id;
      t.classList.toggle('is-front', on); t.setAttribute('aria-selected', on ? 'true' : 'false'); t.tabIndex = on ? 0 : -1;
    });
    pages.forEach(function (p) { p.hidden = p.getAttribute('data-folder') !== id; });
    if (focus) tabOf(id).focus();
    try { window.dispatchEvent(new Event('resize')); } catch (e) { /* old browsers */ }   // anything inside that sizes itself
    return true;
  }
  tabs.forEach(function (t, i) {
    t.addEventListener('click', function () { front(t.getAttribute('data-folder')); });
    t.addEventListener('keydown', function (e) {
      var n = null;
      if (e.key === 'ArrowRight' || e.key === 'ArrowDown') n = (i + 1) % tabs.length;
      else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') n = (i - 1 + tabs.length) % tabs.length;
      else if (e.key === 'Home') n = 0;
      else if (e.key === 'End') n = tabs.length - 1;
      if (n === null) return;
      e.preventDefault(); front(tabs[n].getAttribute('data-folder'), true);
    });
  });
  // a link into a panel: that folder to the front, and the stack where the page's own stops land (28 px under the top) —
  // the browser's own jump to the panel would put the tabs above the top of the window, so the stack is placed again
  // after it (once the page has loaded, and once more a moment later, for a browser that jumps late)
  function fromHash() {
    var id = (location.hash || '').slice(1);
    if (!id || !tabOf(id)) return;
    front(id);
    var body = stack.querySelector('.folder-body'); if (body) body.scrollTop = 0;
    var top = stack.getBoundingClientRect().top + window.pageYOffset - 28;
    window.scrollTo(0, Math.max(0, top));
  }
  window.addEventListener('hashchange', fromHash);
  fromHash();
  if (location.hash) { window.addEventListener('load', fromHash); setTimeout(fromHash, 400); }
})();
