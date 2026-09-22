/* MARS!platz — the stack of folders on the dashboard (src/views/pages/public.js, folder()).
 *
 * Nine panels — the habitat's (Habitat, Habitat hardware, Trends), the
 * day's (Today's Schedule, Meal, Crew Moods), the three blogs — one folder
 * each, their keys in three named rows; on a phone the rows are one at a
 * time, chosen by a segmented control of the three names. A press on a key
 * brings that folder to the front: its panel shows, the others wait. A link into one
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
  // the rows and, on a phone, the groups above them: the row of the open folder is the current one (aura.css shows only
  // that row under 760 px, with the groups as a segmented control above it; wider screens show every row)
  var rows = [].slice.call(stack.querySelectorAll('.frow[data-group]'));
  var groups = [].slice.call(stack.querySelectorAll('.fgroup[data-group]'));
  function setGroup(g) {
    rows.forEach(function (r) { r.classList.toggle('is-cur', r.getAttribute('data-group') === g); });
    groups.forEach(function (b) { var on = b.getAttribute('data-group') === g; b.classList.toggle('is-cur', on); b.setAttribute('aria-pressed', on ? 'true' : 'false'); });
  }
  function front(id, focus) {
    if (!tabOf(id)) return false;
    tabs.forEach(function (t) {
      var on = t.getAttribute('data-folder') === id;
      t.classList.toggle('is-front', on); t.setAttribute('aria-selected', on ? 'true' : 'false'); t.tabIndex = on ? 0 : -1;
    });
    pages.forEach(function (p) { p.hidden = p.getAttribute('data-folder') !== id; });
    var row = tabOf(id).closest('.frow'); if (row && row.getAttribute('data-group') !== null) setGroup(row.getAttribute('data-group'));
    if (focus) tabOf(id).focus();
    try { window.dispatchEvent(new Event('resize')); } catch (e) { /* old browsers */ }   // anything inside that sizes itself
    return true;
  }
  // a group's button: its first folder to the front (its row then shows on a phone)
  groups.forEach(function (b) {
    b.addEventListener('click', function () {
      var row = rows.filter(function (r) { return r.getAttribute('data-group') === b.getAttribute('data-group'); })[0];
      var first = row && row.querySelector('.ftab[data-folder]');
      if (first) front(first.getAttribute('data-folder'));
    });
  });
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
  // a link into a panel: that folder to the front, and the stack where the page's own stops land (28 px under the top; on a
  // phone, under the bar that stays at the top) — the browser's own jump to the panel would put the tabs above the top of
  // the window, so the stack is placed again after it (once the page has loaded, and once more a moment later, for a
  // browser that jumps late)
  function fromHash() {
    var id = (location.hash || '').slice(1);
    if (!id || !tabOf(id)) return;
    front(id);
    var body = stack.querySelector('.folder-body'); if (body) body.scrollTop = 0;
    var bar = document.querySelector('.ticker'), room = 28;
    if (bar && getComputedStyle(bar).position === 'sticky') room = bar.getBoundingClientRect().height + 9;
    var top = stack.getBoundingClientRect().top + window.pageYOffset - room;
    window.scrollTo(0, Math.max(0, top));
  }
  window.addEventListener('hashchange', fromHash);
  fromHash();
  if (location.hash) { window.addEventListener('load', fromHash); setTimeout(fromHash, 400); }
})();
