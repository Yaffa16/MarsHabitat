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

  // The page decides which chip starts active (MY MESSAGES once you have
  // sent something); the script follows it.
  var initial = bar.querySelector('button.active');
  var filter = initial ? (initial.getAttribute('data-filter') || '') : '';
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
    title();
    if (scroller) scroller.scrollTop = 0;
  });

  /* The panel's title follows the filter. */
  var titleEl = document.getElementById('board-title');
  function title() {
    if (!titleEl) return;
    titleEl.textContent = filter === 'mine' ? 'My messages'
      : filter.indexOf('tag:') === 0 ? filter.slice(4).charAt(0) + filter.slice(5).toLowerCase() + ' messages'
      : 'All messages';
  }

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
    if (counter) counter.textContent = data.published + ' exchanges · ' + data.total + ' sent';
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

  /* composer.js calls this the moment a message leaves and again when it
     arrives: switch to MY MESSAGES and fetch the board straight away, so the
     message you just sent is on the screen without waiting for the next poll. */
  window.MCSBoard = {
    refresh: function (which) {
      if (which) {
        var btn = bar.querySelector('button[data-filter="' + which + '"]');
        if (btn) {
          Array.prototype.forEach.call(bar.querySelectorAll('button'), function (b) { b.classList.remove('active'); });
          btn.classList.add('active');
          filter = which;
          apply();
          title();
        }
      }
      wait = BASE_MS;
      poll();
    },
  };
})();

/* Crew log filter: one voice at a time. Days with nothing left to show fold
   away rather than standing as empty headings. */
(function () {
  'use strict';
  var bar = document.getElementById('log-filter');
  if (!bar) return;
  var days = Array.prototype.slice.call(document.querySelectorAll('#log-days .log-day'));
  var empty = document.getElementById('log-empty');
  bar.addEventListener('click', function (e) {
    var btn = e.target.closest ? e.target.closest('button[data-crew]') : null;
    if (!btn) return;
    Array.prototype.forEach.call(bar.querySelectorAll('button'), function (b) { b.classList.remove('active'); });
    btn.classList.add('active');
    var who = btn.getAttribute('data-crew') || '';
    var shownDays = 0;
    days.forEach(function (day) {
      var visible = 0;
      Array.prototype.forEach.call(day.querySelectorAll('.card[data-crew]'), function (c) {
        var show = !who || c.getAttribute('data-crew') === who;
        c.style.display = show ? '' : 'none';
        if (show) visible++;
      });
      day.style.display = visible ? '' : 'none';
      if (visible) shownDays++;
    });
    if (empty) empty.style.display = shownDays ? 'none' : '';
  });
})();

/* The reader: About · What · Who open their text inside the message box,
   over the writing field, and "Back to writing" closes it. Arriving by hash
   (/#about, /#what, /#who-we-are) opens the same way. */
(function () {
  'use strict';
  var box = document.querySelector('.mbox');
  var reader = document.getElementById('mbox-reader');
  if (!box || !reader) return;
  var secs = Array.prototype.slice.call(reader.querySelectorAll('.reader-sec'));
  var links = Array.prototype.slice.call(document.querySelectorAll('[data-reader]'));
  function open(id) {
    var target = null;
    secs.forEach(function (s) { var on = s.id === id; s.hidden = !on; if (on) target = s; });
    if (!target) return false;
    reader.hidden = false;
    box.classList.add('reading');
    links.forEach(function (l) { l.classList.toggle('on', l.getAttribute('data-reader') === id); });
    reader.querySelector('.reader-body').scrollTop = 0;
    return true;
  }
  function close() {
    reader.hidden = true;
    box.classList.remove('reading');
    links.forEach(function (l) { l.classList.remove('on'); });
    if (window.location.hash) history.replaceState(null, '', window.location.pathname);
  }
  links.forEach(function (l) {
    l.addEventListener('click', function (e) {
      e.preventDefault();
      var id = l.getAttribute('data-reader');
      if (l.classList.contains('on')) { close(); return; }
      open(id);
      history.replaceState(null, '', '#' + id);
    });
  });
  var closeBtn = document.getElementById('reader-close');
  if (closeBtn) closeBtn.addEventListener('click', close);
  function fromHash() {
    var id = window.location.hash.slice(1);
    if (id === 'about') id = 'about-project';
    if (!id) return;
    if (open(id)) box.scrollIntoView({ block: 'start' });
  }
  window.addEventListener('hashchange', fromHash);
  fromHash();
})();
