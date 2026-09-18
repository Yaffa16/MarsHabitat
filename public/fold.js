/* MARS!platz — folding the big sections away and opening them again.
 *
 * Each heading that can fold carries a button (.fold-toggle[data-fold]):
 *   dash      the Mission dashboard — its links, figures, the strip of days and the day's three panels
 *   habitat   the Habitat panel's body            hardware   the hardware panel's body
 *   trends    the Trends panel's body             blogs      the three blogs
 * A press hides that section's body and turns the button into "Expand"; the next press brings it back.
 * The heading itself stays where it is, so the page keeps its order and the wheel still lands on it.
 * Nothing is remembered between visits: every page opens with everything shown.
 */
(function () {
  var MEMBERS = {
    dash: '.dash-links, .kpis, .run-strip, #schedule, #galley, #crew',
    blogs: '#blog-commander, #blog-health, #blog-science',
  };
  function members(key, btn) {
    if (MEMBERS[key]) return [].slice.call(document.querySelectorAll(MEMBERS[key]));
    var panel = btn.closest('.dpanel');                                          // a panel folds everything but its heading
    return panel ? [].filter.call(panel.children, function (el) { return !el.classList.contains('dpanel-head'); }) : [];
  }
  function set(btn, open) {
    var key = btn.getAttribute('data-fold'), list = members(key, btn);
    list.forEach(function (el) { el.hidden = !open; });
    btn.setAttribute('aria-expanded', open ? 'true' : 'false');
    btn.classList.toggle('is-shut', !open);
    var panel = btn.closest('.dpanel'); if (panel) panel.classList.toggle('folded', !open);
    var head = btn.closest('.dash-head, .dash-subhead'); if (head) head.classList.toggle('folded', !open);
    // charts and the like size themselves to their box: let them know it changed
    try { window.dispatchEvent(new Event('resize')); } catch (e) { /* old browsers */ }
  }
  document.querySelectorAll('.fold-toggle[data-fold]').forEach(function (btn) {
    btn.addEventListener('click', function (e) {
      e.preventDefault(); e.stopPropagation();
      set(btn, btn.getAttribute('aria-expanded') !== 'true');
    });
  });
})();
