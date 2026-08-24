/* Mission control. One page: the reply queue at the top, the day's editing
   work in tabs beneath. No framework, no dependencies, no external requests. */

/* ------------------------------------------------------------------ tabs */
/* The four officer/habitat panes are all in the page; the tab bar only
   chooses which is visible. The address is kept in step so a save, which
   round-trips through the server, lands back on the same tab. Without
   JavaScript the tab links still work — they are ordinary links. */
(function () {
  'use strict';
  var bar = document.getElementById('tabs');
  if (!bar) return;
  var tabs = Array.prototype.slice.call(bar.querySelectorAll('a[data-tab]'));
  var panes = Array.prototype.slice.call(document.querySelectorAll('.tab-pane[data-pane]'));

  function show(key) {
    tabs.forEach(function (t) {
      var on = t.getAttribute('data-tab') === key;
      t.classList.toggle('on', on);
      t.setAttribute('aria-selected', on ? 'true' : 'false');
    });
    panes.forEach(function (p) { p.classList.toggle('on', p.getAttribute('data-pane') === key); });
    // Day-picker links follow the tab, so changing day keeps you where you were.
    document.querySelectorAll('.daypick a[data-day]').forEach(function (a) {
      a.setAttribute('href', '/control?tab=' + key + '&day=' + a.getAttribute('data-day') + '#work');
    });
  }

  bar.addEventListener('click', function (e) {
    var a = e.target.closest ? e.target.closest('a[data-tab]') : null;
    if (!a) return;
    e.preventDefault();
    var key = a.getAttribute('data-tab');
    show(key);
    try { history.replaceState(null, '', a.getAttribute('href')); } catch (err) { /* fine */ }
  });
})();

/* ----------------------------------------------------------------- queue */
(function () {
  'use strict';

  // Ctrl+Enter (Cmd+Enter on a Mac) in a reply box sends and publishes, so a
  // reply is one keystroke from the last word rather than a reach for the mouse.
  document.querySelectorAll('form.reply').forEach(function (form) {
    var box = form.querySelector('textarea');
    var send = form.querySelector('button[value="publish"]');
    if (!box || !send) return;
    box.addEventListener('keydown', function (e) {
      if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) { e.preventDefault(); send.click(); }
    });
    // The box grows with the reply instead of scrolling inside two lines.
    var grow = function () { box.style.height = 'auto'; box.style.height = Math.min(320, box.scrollHeight + 2) + 'px'; };
    box.addEventListener('input', grow);
    grow();
  });

  // Destructive forms ask first.
  document.querySelectorAll('form[data-confirm]').forEach(function (form) {
    form.addEventListener('submit', function (e) {
      if (!window.confirm(form.getAttribute('data-confirm'))) e.preventDefault();
    });
  });

  // A message arriving while the desk is open is announced, not discovered on
  // the next reload. Polls the count only; the page is not rebuilt underneath
  // someone who is mid-reply.
  var queue = document.getElementById('queue');
  var banner = document.getElementById('queue-new');
  var text = document.getElementById('queue-new-text');
  if (!queue || !banner) return;
  var known = Number(queue.getAttribute('data-waiting') || 0);
  var wait = 8000;
  function poll() {
    if (document.hidden || !window.fetch) { setTimeout(poll, wait); return; }
    fetch('/control/api/queue', { cache: 'no-store', credentials: 'same-origin' })
      .then(function (r) { return r.ok ? r.json() : null; })
      .then(function (d) {
        if (d && d.waiting > known) {
          var n = d.waiting - known;
          if (text) text.textContent = n + ' new message' + (n === 1 ? ' has' : 's have') + ' arrived from Earth.';
          banner.hidden = false;
        }
        wait = 8000;
      })
      .catch(function () { wait = Math.min(60000, wait * 2); })
      .then(function () { setTimeout(poll, wait); });
  }
  setTimeout(poll, wait);
  document.addEventListener('visibilitychange', function () { if (!document.hidden) poll(); });
})();

/* ------------------------------------------------------------------ moods */
/* Mirrors src/lib/mood.js so the operator sets a number while reading the
   exact words the public will get. Keep the two in step. */
(function () {
  'use strict';
  var BANDS = {
    calm_tense: ['settled, working without urgency', 'steady, minor irritation reported',
      'watchful, holding tension in the body', 'strained, short with the others'],
    energetic_exhausted: ['well rested, moving quickly', 'functional, pacing carefully',
      'tired, tasks taking longer than planned', 'depleted, running on routine alone'],
  };
  function band(v) { return v < 25 ? 0 : v < 50 ? 1 : v < 75 ? 2 : 3; }
  function paint(slider) {
    var target = document.getElementById('read-' + slider.dataset.crew + '-' + slider.dataset.axis);
    if (!target) return;
    var list = BANDS[slider.dataset.axis];
    if (!list) return;
    target.textContent = '“' + list[band(Number(slider.value))] + '”';
  }
  document.querySelectorAll('.mood-slider').forEach(function (s) {
    paint(s);
    s.addEventListener('input', function () { paint(s); });
  });
})();

/* -------------------------------------------------------------- templates */
/* A press fills the textarea in the same form, after checking nothing is
   about to be thrown away. */
(function () {
  'use strict';
  document.querySelectorAll('button.tpl').forEach(function (btn) {
    btn.addEventListener('click', function () {
      var form = btn.closest('form');
      var box = form && form.querySelector('textarea');
      if (!box) return;
      var body = btn.dataset.body || '';
      if (box.value.trim() && box.value.trim() !== body.trim()) {
        if (!window.confirm('Replace what is already in this box?')) return;
      }
      box.value = body;
      box.focus();
      var gap = body.indexOf(': \n');
      var at = gap > -1 ? gap + 2 : box.value.length;
      box.setSelectionRange(at, at);
    });
  });
})();
