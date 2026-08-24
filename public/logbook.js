/* Habitat terminal. Live word count and a warning before losing unsaved text --
   a performer will be interrupted mid-entry, and losing the day's writing to a
   stray tap would be worse here than anywhere else in the system. */
(function () {
  'use strict';
  var box = document.getElementById('entry');
  if (!box) return;

  var out = document.getElementById('wordcount');
  var saved = box.value;

  function count() {
    if (!out) return;
    var n = box.value.trim().split(/\s+/).filter(Boolean).length;
    out.textContent = n + (n === 1 ? ' word' : ' words');
  }
  box.addEventListener('input', count);
  count();

  document.querySelectorAll('form').forEach(function (f) {
    f.addEventListener('submit', function () { saved = box.value; });
  });
  window.addEventListener('beforeunload', function (e) {
    if (box.value === saved) return;
    e.preventDefault();
    e.returnValue = '';
  });
})();
