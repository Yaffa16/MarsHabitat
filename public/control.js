/* Mission control. Mirrors src/lib/mood.js so the operator sets numbers while
   reading the exact words the public will get. Keep the two in step. */
(function () {
  'use strict';

  // Mirrors src/lib/mood.js so the operator sets a number while reading the
  // exact words the public will get. Keep the two in step.
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

  var sliders = document.querySelectorAll('.mood-slider');
  sliders.forEach(function (s) {
    paint(s);
    s.addEventListener('input', function () { paint(s); });
  });
})();


/* Report templates. A press fills the textarea in the same form, after checking
   nothing is about to be thrown away. Scoped by form rather than by id, so a
   page can carry several template bars without them reaching across. */
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
