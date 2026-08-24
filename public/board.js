/* Message board: filtering and live refresh. No framework, no dependencies.

   Filtering — the cards are already in the page, so filtering by tag or by
   "my messages" is instant, and losing JavaScript simply leaves the published
   board visible. Cards stamped data-pending are the viewer's own messages
   that mission control has not published yet. The stylesheet hides them by
   default; they are shown only under MY MESSAGES, so the common board (ALL
   and every tag) carries nothing that has not been approved.

   Live refresh — the board polls /api/board every few seconds and swaps the
   cards in place when the server reports a change, so a reply published from
   mission control, or another visitor's exchange, appears on every open phone
   in the room without a reload. The filter you chose and your scroll position
   are kept. Polling pauses while the tab is hidden and backs off when the
   network is down; the LIVE mark in the foot dims while it cannot reach the
   station. */
(function () {
  'use strict';

  var feed = document.getElementById('feed');
  var bar = document.getElementById('feed-filter');
  if (!feed || !bar) return;
  var cardsBox = document.getElementById('feed-cards');
  var empty = document.getElementById('feed-empty');
  var note = document.getElementById('feed-mine-note');
  var scroller = document.querySelector('.scroller.feed');
  var foot = document.querySelector('.feed-foot');
  var mineCount = document.getElementById('feed-mine-count');
  var allLink = document.getElementById('feed-all');
  var counter = document.getElementById('feed-counter');
  var live = document.getElementById('feed-live');

  var filter = '';
  var cards = [];

  function collect() {
    cards = Array.prototype.slice.call(cardsBox.querySelectorAll('.card'));
  }

  /* ------------------------------------------------------------- filtering */
  function apply() {
    var f = filter;
    var shown = 0;
    cards.forEach(function (c) {
      var show = true;
      if (f === 'mine') {
        show = c.hasAttribute('data-mine');
      } else {
        // The common board: published exchanges only.
        if (c.hasAttribute('data-pending')) show = false;
        if (show && f.indexOf('tag:') === 0) {
          var tags = ',' + (c.getAttribute('data-tags') || '') + ',';
          show = tags.indexOf(',' + f.slice(4) + ',') !== -1;
        }
      }
      c.classList.toggle('is-hidden', !show);
      c.classList.toggle('is-listed', show);
      if (show) shown++;
    });
    if (empty) {
      empty.textContent = cards.length
        ? empty.getAttribute('data-filtered') : empty.getAttribute('data-none');
      empty.style.display = shown ? 'none' : '';
    }
    var anyPending = cards.some(function (c) { return c.hasAttribute('data-pending'); });
    if (note) note.hidden = !(f === 'mine' && anyPending);
    bar.hidden = cards.length === 0;
    if (foot) foot.hidden = cards.length === 0;
  }

  bar.addEventListener('click', function (e) {
    var btn = e.target.closest ? e.target.closest('button[data-filter]') : null;
    if (!btn) return;
    Array.prototype.forEach.call(bar.querySelectorAll('button'), function (b) {
      b.classList.remove('active');
    });
    btn.classList.add('active');
    filter = btn.getAttribute('data-filter') || '';
    apply();
    if (scroller) scroller.scrollTop = 0;
  });

  /* ---------------------------------------------------------- live refresh */
  var url = feed.getAttribute('data-poll');
  // The page carries the version of the board it was rendered with, so even
  // a change in the seconds between render and first poll is picked up.
  var version = feed.getAttribute('data-version') || null;
  var BASE_MS = 5000, MAX_MS = 60000;
  var wait = BASE_MS;
  var timer = null;

  function swap(data) {
    // Keep the reader's place: if they have scrolled into the board, new
    // cards arriving above them must not shove the one they are reading.
    var top = scroller ? scroller.scrollTop : 0;
    var before = scroller ? scroller.scrollHeight : 0;
    cards.forEach(function (c) { cardsBox.removeChild(c); });
    if (empty) empty.insertAdjacentHTML('beforebegin', data.cards);
    else cardsBox.insertAdjacentHTML('afterbegin', data.cards);
    collect();
    apply();
    if (scroller && top > 0) scroller.scrollTop = top + (scroller.scrollHeight - before);

    if (mineCount) {
      mineCount.textContent = String(data.pendingMine);
      mineCount.hidden = !data.pendingMine;
    }
    if (allLink) allLink.textContent = 'All ' + data.published + ' exchanges';
    if (counter) counter.textContent = data.total + ' SENT · ' + data.published + ' REPLIED';
  }

  function poll() {
    clearTimeout(timer);
    if (document.hidden || !url || !window.fetch) { schedule(); return; }
    fetch(url, { cache: 'no-store', credentials: 'same-origin' })
      .then(function (r) { if (!r.ok) throw new Error('HTTP ' + r.status); return r.json(); })
      .then(function (data) {
        if (data.phase === 'COMPLETE') { window.location.reload(); return; }
        if (data.version !== version) {
          swap(data);
          version = data.version;
        }
        wait = BASE_MS;
        if (live) { live.classList.remove('stale'); live.textContent = 'LIVE'; }
      })
      .catch(function () {
        wait = Math.min(MAX_MS, wait * 2);
        if (live) { live.classList.add('stale'); live.textContent = 'RECONNECTING'; }
      })
      .then(schedule);
  }

  function schedule() {
    clearTimeout(timer);
    timer = setTimeout(poll, wait);
  }

  document.addEventListener('visibilitychange', function () {
    if (!document.hidden) { wait = BASE_MS; poll(); }
  });
  window.addEventListener('online', function () { wait = BASE_MS; poll(); });

  collect();
  apply();
  poll();
})();
