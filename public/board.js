/* Message board filter. No framework, no dependencies, no network:
   the cards are already in the page, so filtering by tag or by "my messages"
   is instant, and losing JavaScript simply leaves the whole board visible. */
(function () {
  'use strict';

  var bar = document.getElementById('feed-filter');
  if (!bar) return;
  var cards = Array.prototype.slice.call(document.querySelectorAll('.feed .card'));
  var empty = document.getElementById('feed-empty');
  var scroller = document.querySelector('.scroller.feed');

  bar.addEventListener('click', function (e) {
    var btn = e.target.closest ? e.target.closest('button[data-filter]') : null;
    if (!btn) return;
    Array.prototype.forEach.call(bar.querySelectorAll('button'), function (b) {
      b.classList.remove('active');
    });
    btn.classList.add('active');

    var f = btn.getAttribute('data-filter') || '';
    var shown = 0;
    cards.forEach(function (c) {
      var show = true;
      if (f === 'mine') {
        show = c.hasAttribute('data-mine');
      } else if (f.indexOf('tag:') === 0) {
        var tags = ',' + (c.getAttribute('data-tags') || '') + ',';
        show = tags.indexOf(',' + f.slice(4) + ',') !== -1;
      }
      c.style.display = show ? '' : 'none';
      if (show) shown++;
    });
    if (empty) empty.style.display = shown ? 'none' : '';
    if (scroller) scroller.scrollTop = 0;
  });
})();
