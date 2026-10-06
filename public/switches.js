/* The theme and language switches (layout.js, themeSwitch and langSwitch) without losing the place.
   The theme: a press turns the page at once — data-theme on <html>, the switch's own words with it — and tells the
   station in the background (POST /theme, answered 204 to a fetch), so the page never reloads and never moves: the
   dashboard's folder, the About page's section, the scroll stay where they are. Without JavaScript the form still
   posts and the station sends the browser back where it was.
   The language has to reload (the words are the server's), so its form carries the whole address — path, query and
   the #part the browser never sends in the Referer — in a field the station redirects to, and the page comes back
   to the same part, not to the top. Mission control and the archive carry the theme switch too; the same holds. */
(function () {
  'use strict';
  var root = document.documentElement;
  var here = function () { return location.pathname + location.search + location.hash; };
  var words = { en: { light: 'Light', dark: 'Dark', toLight: 'Switch to light mode', toDark: 'Switch to dark mode' },
                de: { light: 'Licht', dark: 'Dunkel', toLight: 'Zum hellen Modus wechseln', toDark: 'Zum dunklen Modus wechseln' },
                fr: { light: 'Lumière', dark: 'Sombre', toLight: 'Passer en mode clair', toDark: 'Passer en mode sombre' } };
  function wordsOf() { var t = window.MCS_T || {}; var lang = root.getAttribute('lang') || 'en'; var w = words[lang] || words.en;
    // the page's own dictionary, where it carries one (clientTable), says the words in its language
    return { light: t['Light'] || w.light, dark: t['Dark'] || w.dark, toLight: t['Switch to light mode'] || w.toLight, toDark: t['Switch to dark mode'] || w.toDark }; }
  function relabel(form, to) {
    var w = wordsOf(), dark = to === 'dark', btn = form.querySelector('button'), word = form.querySelector('.theme-word'), input = form.querySelector('input[name=to]');
    if (input) input.value = dark ? 'light' : 'dark';
    if (word) word.textContent = dark ? w.light : w.dark;
    if (btn) { btn.title = dark ? w.toLight : w.toDark; btn.setAttribute('aria-label', dark ? w.toLight : w.toDark); }
  }
  // a press must not move the page either: the switches stand in the sticky header, and a browser that gives a pressed
  // button the focus scrolls to where that header would stand unstuck — so the press takes no focus (a keyboard still
  // reaches the keys with Tab)
  document.addEventListener('mousedown', function (e) {
    var b = e.target && e.target.closest ? e.target.closest('form[action="/theme"] button, form[action="/lang"] button') : null;
    if (b) e.preventDefault();
  });
  document.addEventListener('submit', function (e) {
    var form = e.target;
    if (!form || !form.getAttribute) return;
    var action = form.getAttribute('action') || '';
    if (action === '/theme') {
      e.preventDefault();
      var input = form.querySelector('input[name=to]'), to = input && input.value === 'light' ? 'light' : 'dark';
      root.setAttribute('data-theme', to);
      document.querySelectorAll('form[action="/theme"]').forEach(function (f) { relabel(f, to); });
      try {
        fetch('/theme', { method: 'POST', credentials: 'same-origin', headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'X-Requested-With': 'fetch' }, body: 'to=' + encodeURIComponent(to) }).catch(function () {});
      } catch (err) { /* the choice holds on the page; the cookie comes with the next post */ }
      return;
    }
    if (action === '/lang') {
      var back = form.querySelector('input[name=back]');
      if (!back) { back = document.createElement('input'); back.type = 'hidden'; back.name = 'back'; form.appendChild(back); }
      back.value = here();
    }
  }, true);
})();
