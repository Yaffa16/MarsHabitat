/* Message board: filtering and live refresh. No framework, no dependencies.

   Filtering — the cards are already in the page, so filtering by tag or by
   "my messages" is instant, and losing JavaScript simply leaves the published
   board visible. The cards stand in one sequence, the newest first, by the
   moment each was sent — the viewer's own among the rest, whatever state
   they are in; cards stamped data-pending are the ones mission control has
   not published yet, and they only ever reach their own sender's page. The
   MY MESSAGES chip narrows the board to the viewer's own.

   Live refresh — the board polls /api/board every few seconds and swaps the
   cards in place when the server reports a change, so a reply published from
   mission control, or another visitor's exchange, appears on every open phone
   in the room without a reload. The filter you chose and your scroll position
   are kept. Polling pauses while the tab is hidden and backs off when the
   network is down; the LIVE mark in the foot dims while it cannot reach the
   station.

   The wall of notes (the Write page, public.js boardWall; the feed carries
   data-wall) flows with the page and has no end of its own: the first page
   of exchanges is drawn by the server, and as the reader nears its last
   card the page before it is fetched (/api/board?before=<the oldest id on
   the wall>) and laid on, until the beginning of the correspondence. A
   live refresh there lays the fresh cards in by their ids — new ones at
   the top, changed ones in their place — and keeps what the reader has
   scrolled on to; the reader's place on the page is kept too. The band at
   the foot of a note names its tags: a press on one narrows the wall to it.
   (The installation's board screen keeps the older way: every card swapped
   for the fresh set.) The Show more key of the old phone board is gone;
   a phone's wall loads as it scrolls like any other.

   The installation's board (the board screen, and the ground station's
   beside its composer) shows the latest exchanges that fit on the screen
   and no more — nine at the most — fitted the moment its cards arrive,
   before they are painted (fitScreen, below). */
(function () {
  'use strict';
  /* The visitor's language: t() reads the table the page carries in its
     head (window.MCS_T, from src/lib/i18n.js) and falls back to English. */
  var t = window.t || function (s) { return s; };

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
  var wall = feed.hasAttribute('data-wall');
  var end = document.getElementById('feed-end');

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
      } else if (f.indexOf('tag:') === 0) {
        var tags = ',' + (c.getAttribute('data-tags') || '') + ',';
        show = tags.indexOf(',' + f.slice(4) + ',') !== -1;
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
    var anyPending = cards.some(function (c) { return c.hasAttribute('data-pending') && !c.classList.contains('is-hidden'); });
    if (note) note.hidden = !anyPending;
    bar.hidden = cards.length === 0;
    if (foot) foot.hidden = cards.length === 0;
    page();
    if (typeof setEnd === 'function') setEnd();
  }

  /* ----------------------------------------- the wall: the page before, as the reader nears the end */
  var PAGE = 20, limit = PAGE;
  function page() { /* every card listed: the wall grows as it scrolls (below), the screens hold every card */ }
  var idOf = function (c) { return Number((c.id || '').replace(/^m/, '')) || 0; };
  var loading = false, exhausted = !wall || feed.getAttribute('data-more') !== '1';
  function sentAt(c) { var t = c.querySelector('time.note-when[datetime]') || c.querySelector('time[datetime]'); return t ? t.getAttribute('datetime') : ''; }   // the moment sent (the answer's time stands first in an answered note)
  function oldest() {                                                        // the oldest published exchange on the wall that is not the reader's own: its id and the moment it was sent
    var last = null;
    cards.forEach(function (c) {
      if (!idOf(c) || c.hasAttribute('data-mine')) return;
      if (!last || sentAt(c) < sentAt(last) || (sentAt(c) === sentAt(last) && idOf(c) < idOf(last))) last = c;
    });
    return last ? { id: idOf(last), at: sentAt(last) } : null;
  }
  function setEnd() {
    if (!end) return;
    end.hidden = cards.length === 0;
    end.classList.toggle('is-done', exhausted);
    var span = end.querySelector('span'); if (span) span.textContent = end.getAttribute(exhausted ? 'data-done' : 'data-loading');
  }
  function loadOlder() {
    if (!wall || loading || exhausted || !window.fetch) return;
    var before = oldest(); if (!before) { exhausted = true; setEnd(); return; }
    loading = true;
    fetch(url + (url.indexOf('?') === -1 ? '?' : '&') + 'before=' + before.id + (before.at ? '&at=' + encodeURIComponent(before.at) : ''), { cache: 'no-store', credentials: 'same-origin' })
      .then(function (r) { if (!r.ok) throw new Error('HTTP ' + r.status); return r.json(); })
      .then(function (data) {
        if (data.cards) {
          var box = document.createElement('div'); box.innerHTML = data.cards;
          Array.prototype.slice.call(box.querySelectorAll('.card')).forEach(function (c) {
            if (document.getElementById(c.id)) return;                        // already on the wall (it arrived in the meantime)
            c.setAttribute('data-older', '1');
            cardsBox.insertBefore(c, empty);
          });
        }
        if (!data.more || !data.count) exhausted = true;
        collect(); apply();
      })
      .catch(function () { /* the next approach to the end tries again */ })
      .then(function () { loading = false; setEnd(); if (seek) sought(); else if (!exhausted && nearEnd()) loadOlder(); });
  }
  function nearEnd() {
    if (!end || end.hidden) return false;
    var r = end.getBoundingClientRect();
    return r.top < (window.innerHeight || document.documentElement.clientHeight) + 600;
  }
  // a link to one exchange (/write#m57, from the sky's notes) that is further down than the first page: the pages before
  // are fetched until the note is on the wall (or the wall is at its beginning), and the page goes to it
  var seek = wall ? /^#m(\d+)$/.exec(location.hash || '') : null, seeking = 0;
  function sought() {
    if (!seek) return;
    var el = document.getElementById('m' + seek[1]);
    if (el) { seek = null; setTimeout(function () { el.scrollIntoView({ block: 'center' }); el.classList.add('is-sought'); }, 50); return; }
    if (!exhausted && seeking++ < 40) loadOlder();
    else seek = null;
  }
  if (wall && end) {
    if ('IntersectionObserver' in window) {
      new IntersectionObserver(function (entries) { if (entries.some(function (e) { return e.isIntersecting; })) loadOlder(); }, { rootMargin: '600px 0px' }).observe(end);
    } else {
      var onScroll = function () { if (nearEnd()) loadOlder(); };
      window.addEventListener('scroll', onScroll, { passive: true }); window.addEventListener('resize', onScroll);
    }
    setEnd();
  }

  function choose(which) {
    Array.prototype.forEach.call(bar.querySelectorAll('button'), function (b) {
      b.classList.toggle('active', (b.getAttribute('data-filter') || '') === which);
    });
    filter = which;
    limit = PAGE;
    apply();
    if (scroller) scroller.scrollTop = 0;
  }
  bar.addEventListener('click', function (e) {
    var btn = e.target.closest ? e.target.closest('button[data-filter]') : null;
    if (!btn) return;
    choose(btn.getAttribute('data-filter') || '');
  });
  // the band at the foot of a note: its tags are keys that narrow the wall to that tag, and bring its chip into view
  cardsBox.addEventListener('click', function (e) {
    var key = e.target.closest ? e.target.closest('.note-tag[data-filter]') : null;
    if (!key || document.body.classList.contains('screen')) return;           // (the screens' notes narrow nothing: nothing on a screen is tappable)
    e.preventDefault(); e.stopPropagation();
    var which = key.getAttribute('data-filter') || '';
    var chip = bar.querySelector('button[data-filter="' + which + '"]');
    choose(chip ? which : '');
    var top = bar.getBoundingClientRect().top;
    if (top < 0 || top > 160) bar.scrollIntoView({ behavior: 'smooth', block: 'start' });
  });

  /* ------------------------------------- the board screen: the latest that fit, nine at the most */
  /* On the installation's board (screens.js: the board screen, and the ground station's beside its composer) the board
     stands whole: the newest exchanges that fit on the screen and no more — the last three where three fit, the last one
     where only one does, nine at the most (the station sends no more than nine: server.js, stationBoard) — none of them
     cut at the foot. Each card is measured at its own height (a row as tall as its tallest card), and the cards that
     would not fit are taken out of the grid altogether — in the same moment as the cards arrive, before the browser
     draws them, so the screen never shows a card and takes it away again (8 October: "the board is glitching on and off
     — make it very smart and stable"). Where fewer, wider columns hold more of the latest — a long message and a long
     answer stand shorter across two columns' width than in one — the board is laid out in fewer (the stylesheet's own
     three where fewer hold no more); the latest alone too tall for any is faded out at its foot. The first fitting waits
     for the fonts and for the zoom screen.js gives the screen (the cards are not shown until then — screen.css); after
     that the count moves only when it must: one fewer the moment the cards standing grow over the foot, one more only
     when there is room to spare for it — a line that wraps, a figure a digit longer, never has a card come and go. A
     fresh set of cards and a new size of board are fitted anew, the columns chosen again. */
  var onScreen = document.body.classList.contains('screen');
  var MOST = 9, fitted = 0, across = 0, started = false, size = '';
  function rowsHeight(hs, n, cols, gap, foot) {                              // the height the first n cards take, row by row
    var total = 0, rows = 0;
    for (var i = 0; i < n; i += cols) {
      var h = 0;
      for (var j = i; j < n && j < i + cols; j++) if (hs[j] > h) h = hs[j];
      total += h; rows++;
    }
    return total + gap * Math.max(0, rows - 1) - (foot || 0);                // (the last row's margin under it is no part of what shows)
  }
  function fitScreen(fresh) {
    if (!onScreen || !cardsBox || !started) return;
    var list = cards.filter(function (c) { return !c.classList.contains('is-hidden'); });
    var box = scroller || cardsBox.parentElement;
    // (layout pixels throughout — offsetHeight, clientHeight, the computed gap — which the screen's zoom does not change)
    var bs = getComputedStyle(box);
    var room = box.clientHeight - (parseFloat(bs.paddingTop) || 0) - (parseFloat(bs.paddingBottom) || 0);
    if (!list.length || room <= 0) { if (!list.length) fitted = 0; cardsBox.classList.add('is-fitted'); return; }   // nothing to fit, or not laid out yet
    var now = Math.round(room) + 'x' + box.clientWidth;                      // a board of another size is fitted anew
    if (now !== size) { size = now; fresh = true; }
    // every card in the grid for the moment, the rows not stretched: each card at its own height, in the stylesheet's
    // columns and in fewer (nothing of this is painted — the cards are put back before the browser draws)
    list.forEach(function (c) { c.classList.remove('is-off', 'is-tall'); c.style.maxHeight = ''; });
    cardsBox.classList.add('is-measuring');
    cardsBox.style.gridTemplateColumns = '';
    var cs = getComputedStyle(cardsBox);
    var base = Math.max(1, String(cs.gridTemplateColumns || '').trim().split(/\s+/).length);   // the stylesheet's columns, for this screen
    var gap = parseFloat(cs.rowGap) || 0, mb = parseFloat(getComputedStyle(list[0]).marginBottom) || 0;
    // a few pixels kept for the rounding of the measures; and more — some 3 % of the board — before one more is let in
    // on a second look, so that a card that has just gone does not come straight back
    var most = Math.min(MOST, list.length), slack = 4, spare = Math.max(24, room * 0.03);
    var lay = function (c) { cardsBox.style.gridTemplateColumns = c === base ? '' : 'repeat(' + c + ', minmax(0, 1fr))'; };
    var heights = function (c) {
      lay(c);
      return list.map(function (el) { var m = getComputedStyle(el); return el.offsetHeight + (parseFloat(m.marginTop) || 0) + (parseFloat(m.marginBottom) || 0); });
    };
    var upTo = function (hs, c, limit) {                                     // how many of the latest fit, c across (0: not even the latest)
      if (rowsHeight(hs, 1, c, gap, mb) > limit) return 0;
      var n = 1; while (n < most && rowsHeight(hs, n + 1, c, gap, mb) <= limit) n++; return n;
    };
    var c = Math.min(across || base, base), hs = null, n = 0;
    if (!fresh && fitted) {
      // a second look: in the columns standing, one fewer if the cards run over the foot, one more only with room to spare
      hs = heights(c);
      var keep = Math.min(fitted, most), fit = upTo(hs, c, room - slack);
      if (!fit) fresh = true;                                                // not even the latest fits as it stands: fitted anew
      else if (rowsHeight(hs, keep, c, gap, mb) > room + 1) n = fit;
      else n = Math.max(keep, upTo(hs, c, room - spare));
    }
    if (fresh || !fitted) {
      // the columns that hold the most of the latest: the stylesheet's own, or fewer only where they hold more
      var best = null;
      for (var k = base; k >= 1; k--) {
        var h = heights(k), m = upTo(h, k, room - slack);
        if (!best || m > best.n) best = { c: k, hs: h, n: m };
        if (m >= most) break;                                                // all of them already: no fewer columns needed
      }
      if (!best.n) best = { c: 1, hs: heights(1), n: 1 };                     // the latest too tall even across the whole board
      c = best.c; hs = best.hs; n = best.n;
    }
    lay(c);
    cardsBox.classList.remove('is-measuring');
    list.forEach(function (el, i) { el.classList.toggle('is-off', i >= n); });
    // the latest alone taller than the whole board (an exchange written before the limit of five hundred): faded out at
    // its foot rather than cut
    if (rowsHeight(hs, 1, c, gap, mb) > room) { list[0].classList.add('is-tall'); list[0].style.maxHeight = Math.floor(room) + 'px'; }
    fitted = n; across = c;
    cardsBox.classList.add('is-fitted');
  }
  if (onScreen && cardsBox) {
    cardsBox.setAttribute('data-fit-own', '');                               // (screen.js leaves these cards to this script)
    // the first fitting: once the fonts are in and screen.js has given the screen its zoom (it calls MCSBoardFit when it
    // has) — or after a second and a half, whatever is late
    var zoomed = !document.getElementById('stage-fit'), late = false;
    var start = function () {
      if (started || (!zoomed && !late)) return;
      if (!late && document.fonts && document.fonts.status === 'loading') { document.fonts.ready.then(start); return; }
      started = true;
      fitScreen(true);
    };
    window.MCSBoardFit = function () { zoomed = true; if (started) fitScreen(false); else start(); };
    setTimeout(function () { late = true; start(); }, 1500);
    // the cards growing or shrinking (a line wrapping, a figure longer), or the board's room changing: looked at again
    if (window.ResizeObserver) {
      var ro = new ResizeObserver(function () { fitScreen(false); });
      ro.observe(scroller || cardsBox.parentElement); ro.observe(cardsBox);
    } else window.addEventListener('resize', function () { setTimeout(function () { fitScreen(false); }, 350); });
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(function () { if (started) fitScreen(true); });
    setInterval(function () { if (!document.hidden) fitScreen(false); }, 30000);   // and now and then, for whatever was missed
  }

  /* ---------------------------------------------------------- live refresh */
  var url = feed.getAttribute('data-poll');
  // The page carries the version of the board it was rendered with, so even
  // a change in the seconds between render and first poll is picked up.
  var version = feed.getAttribute('data-version') || null;
  var BASE_MS = 5000, MAX_MS = 60000;
  var wait = BASE_MS;
  var timer = null;

  /* the wall lays the fresh set in by id: a card already there is replaced where it stands, a new one goes in above the
     first card older than it (the wall is in order of sending), a card of the reader's own that is gone goes, and a card
     the fresh set has left behind (older than its oldest) stays as the wall's older part. The reader's place is kept:
     the card at the top of the window stays where it was. */
  function merge(html) {
    var box = document.createElement('div'); box.innerHTML = html;
    var fresh = Array.prototype.slice.call(box.querySelectorAll('.card'));
    var key = function (c) { return sentAt(c) + '|' + String(idOf(c) + 1e9); };    // the order of the wall: the moment sent, the id breaking a tie
    var minPub = null;
    fresh.forEach(function (c) { if (!c.hasAttribute('data-mine') && (minPub === null || key(c) < minPub)) minPub = key(c); });
    var ids = {}; fresh.forEach(function (c) { ids[c.id] = true; });
    var anchor = null, anchorTop = 0, headH = 0;
    var bar0 = document.querySelector('.ticker'); if (bar0 && getComputedStyle(bar0).position === 'sticky') headH = bar0.getBoundingClientRect().height;
    for (var i = 0; i < cards.length; i++) { var r = cards[i].getBoundingClientRect(); if (r.bottom > headH + 8) { anchor = cards[i]; anchorTop = r.top; break; } }
    cards.forEach(function (c) {
      if (ids[c.id]) return;
      if (c.hasAttribute('data-mine') || minPub === null || key(c) >= minPub) { cardsBox.removeChild(c); if (anchor === c) anchor = null; }   // gone from the station's set
      else c.setAttribute('data-older', '1');                                      // older than the fresh set's oldest: the wall's older part now
    });
    fresh.forEach(function (c) {
      var old = document.getElementById(c.id);
      if (old) { if (old.getAttribute('data-older')) c.setAttribute('data-older', '1'); cardsBox.replaceChild(c, old); if (anchor === old) anchor = c; return; }
      var k = key(c), at = null;
      var now = Array.prototype.slice.call(cardsBox.querySelectorAll('.card'));
      for (var j = 0; j < now.length; j++) { if (key(now[j]) < k) { at = now[j]; break; } }
      cardsBox.insertBefore(c, at || empty);
    });
    collect();
    apply();
    if (anchor && anchor.parentNode) {
      var d = anchor.getBoundingClientRect().top - anchorTop;
      if (d) window.scrollBy(0, d);
    }
  }

  function swap(data) {
    if (wall) { merge(data.cards); counts(data); return; }
    // Keep the reader's place: if they have scrolled into the board, new
    // cards arriving above them must not shove the one they are reading.
    var top = scroller ? scroller.scrollTop : 0;
    var before = scroller ? scroller.scrollHeight : 0;
    cards.forEach(function (c) { cardsBox.removeChild(c); });
    if (empty) empty.insertAdjacentHTML('beforebegin', data.cards);
    else cardsBox.insertAdjacentHTML('afterbegin', data.cards);
    collect();
    apply();
    fitScreen(true);                                                         // the board screen: fitted before it is painted
    if (scroller && top > 0) scroller.scrollTop = top + (scroller.scrollHeight - before);
    counts(data);
  }
  function counts(data) {
    if (mineCount) {
      mineCount.textContent = String(data.pendingMine);
      mineCount.hidden = !data.pendingMine;
    }
    if (allLink) allLink.textContent = t('All') + ' ' + data.published + ' ' + t('exchanges');
    if (counter) counter.textContent = data.published + ' ' + t('exchanges') + ' \u00b7 ' + data.total + ' ' + t('sent');
  }

  function poll() {
    clearTimeout(timer);
    // no fetch while the tab is hidden, or while the board itself is not shown (a phone held upright keeps the
    // landing page's portal off the screen — the messages page carries it; see aura.css)
    if (document.hidden || !url || !window.fetch || feed.offsetParent === null) { schedule(); return; }
    fetch(url, { cache: 'no-store', credentials: 'same-origin' })
      .then(function (r) { if (!r.ok) throw new Error('HTTP ' + r.status); return r.json(); })
      .then(function (data) {
        // the station has closed under this open page (the end of the day after the run): it turns into the closed record
        if (data.open === false && feed.getAttribute('data-open') !== '0') { window.location.reload(); return; }
        if (data.version !== version) {
          swap(data);
          version = data.version;
        }
        wait = BASE_MS;
        window.MCSBoardAlive = Date.now();                                   // (a board screen alive: screen.js does not reload it)
        if (live) live.classList.remove('stale');
      })
      .catch(function () {
        // a poll that fails backs off and tries again; the LIVE mark only loses its pulse, it never says anything else
        wait = Math.min(MAX_MS, wait * 2);
        if (live) live.classList.add('stale');
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
  fitScreen(true);                                                           // (on a screen: once it has started, above)
  poll();
  if (seek && !document.getElementById('m' + seek[1])) sought();              // a link to an exchange further down the wall

  /* composer.js calls this the moment a message leaves and again when it
     arrives: go back to ALL (where the viewer's own messages head the board),
     scroll to the top and fetch the board straight away, so the message you
     just sent is on the screen without waiting for the next poll. */
  window.MCSBoard = {
    refresh: function (which) {
      if (typeof which === 'string' && bar.querySelector('button[data-filter="' + which + '"]')) choose(which);
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

/* Links into a closed fold (About · What this is · Who we are) open it, so
   arriving by hash never lands on a shut summary. */
(function () {
  'use strict';
  function openTarget() {
    var id = window.location.hash.slice(1);
    if (!id) return;
    var el = document.getElementById(id);
    if (el && el.tagName === 'DETAILS') el.open = true;
  }
  window.addEventListener('hashchange', openTarget);
  openTarget();
})();

/* The cards' line into space — "This message is currently … km from
   Earth!" — kept running: from the moment a message was sent (the card's
   data-launched) it is counted as 299,792 km further from Earth every
   second (and once the crew answer, it really is on its way:
   src/lib/spacespeak.js). The figure is drawn by the page (public.js,
   spaceLine) and moved on here, a second at a time, in the visitor's
   figures — every digit while it is small, then in words: 4.36 million,
   3.95 billion, 1.02 trillion (in German Milliarde and Billion, in French
   milliard and billion). (How long ago it was launched is not said any more —
   8 October.) New cards — the board swaps them in as it polls — are picked
   up as they come. Works on every
   page with cards: the board, the messages page, the installation's board
   screen, a single exchange.

   A tap on a card says, in two lines, what the message is closest to: the
   last of some 600 things in the sky it has passed — the meteors overhead,
   the satellites and space stations, the asteroids that flew by, the Moon,
   the planets and their moons, the probes on their way out, the light-time
   marks a message reaches over the run's two weeks, the stars, nebulae,
   clusters and galaxies (content/celestial.json, handed over by
   /api/celestial in the page's language) — "Your message is 6.1 times
   farther away than Saturn", and under it the object's distance from
   Earth, said the way its kind of distance wants (how), and one line about
   it. Nothing on the panel is a link. */
(function () {
  'use strict';
  var t = window.t || function (s) { return s; };
  var KM = 299792.458;
  var lang = (document.documentElement.getAttribute('lang') || 'en').slice(0, 2);
  var locale = { de: 'de-DE', fr: 'fr-FR' }[lang] || 'en-GB';
  var fmtInt, fmtTwo, fmtPct;
  try {
    fmtInt = new Intl.NumberFormat(locale, { maximumFractionDigits: 0 });
    fmtTwo = new Intl.NumberFormat(locale, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    fmtPct = new Intl.NumberFormat(locale, { minimumFractionDigits: 1, maximumFractionDigits: 1 });
  } catch (e) {
    var plain = function (d) { return { format: function (n) { return n.toFixed(d); } }; };
    fmtInt = plain(0); fmtTwo = plain(2); fmtPct = plain(1);
  }
  var SCALES = [[1e15, 'quadrillion'], [1e12, 'trillion'], [1e9, 'billion'], [1e6, 'million']];
  var fmtLoose; try { fmtLoose = new Intl.NumberFormat(locale, { maximumFractionDigits: 2 }); } catch (e) { fmtLoose = { format: function (n) { return String(Math.round(n * 100) / 100); } }; }
  function big(n, loose) {                                                   // as public.js fmtBig: in words once it passes ten million
    if (n < 1e7) return fmtInt.format(n);
    var i = 0; while (n < SCALES[i][0]) i++;
    var num = (loose ? fmtLoose : fmtTwo).format(n / SCALES[i][0]), word = SCALES[i][1];
    var w = lang === 'en' || /^1([.,]00)?$/.test(num) ? t(word) : t(word + 's');   // English has no plural for it; German and French do
    return num + ' ' + w + (lang === 'fr' ? ' de' : '');                     // French: "7,78 milliards de km"
  }
  function set(el, text) { if (el && el.textContent !== text) el.textContent = text; }
  function secsOf(box, now) {
    var at = Date.parse(box.getAttribute('data-launched') || '');
    return isNaN(at) ? null : Math.max(0, (now - at) / 1000);
  }
  function move(box, now) {
    var secs = secsOf(box, now);
    if (secs === null) return;
    set(box.querySelector('.sp-km'), big(secs * KM));
  }
  function tick() {
    var boxes = document.querySelectorAll('.card-space[data-launched]');
    if (!boxes.length) return;
    var now = Date.now();
    for (var i = 0; i < boxes.length; i++) move(boxes[i], now);
    if (box) refresh();
  }
  tick();
  setInterval(tick, 1000);

  /* ------------------------------------------------- what it is closest to */
  // the objects from content/celestial.json, in the page's language, nearest first — fetched once, the first time a card
  // is tapped
  var LY = 9460730472580.8;
  var objects = null, loading = null;
  function load() {
    if (objects) return Promise.resolve(objects);
    if (!loading) loading = fetch('/api/celestial?lang=' + lang, { cache: 'default' })
      .then(function (r) { return r.ok ? r.json() : { objects: [] }; })
      .then(function (j) { objects = (j.objects || []).filter(function (o) { return o.km > 0; }); return objects; })
      .catch(function () { loading = null; return []; });
    return loading;
  }
  /** The last object the message has passed — the farthest one nearer than the message — or the nearest of all. */
  function closest(km) {
    if (!objects || !objects.length) return null;
    var pick = objects[0];
    for (var i = 0; i < objects.length && objects[i].km <= km; i++) pick = objects[i];
    return pick;
  }
  function ratio(km, o) {
    var r = km / o.km;
    return (r >= 100 ? fmtInt : fmtPct).format(r);
  }
  function cap(s) { return s.charAt(0).toUpperCase() + s.slice(1); }
  function esc(s) { return String(s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
  // the sentence for each kind of distance the file gives (content/celestial.json, how) — the stars' in light-years
  var WHERE = {
    avg: '{name} is on average about {km} km from Earth',
    orbit: '{name} orbits about {km} km above Earth',
    flew: '{name} flew about {km} km above Earth',
    reached: '{name} reached {km} km from Earth',
    flyby: '{name} passed about {km} km from Earth',
    will: '{name} will pass about {km} km from Earth',
    now: '{name} is now about {km} km from Earth',
    mark: '{name} is {km} km from Earth',
    closest: '{name} is {km} km from Earth',
    farthest: '{name} is {km} km from Earth',
    height: '{name} is about {km} km above the ground'
  };
  /** The object's own line: how far it is, said the way its kind of distance wants, then the line about it. */
  function aboutLine(o) {
    var ly = o.ly != null ? o.ly : o.km / LY;
    var where = (o.how === 'ly' || (!WHERE[o.how] && ly >= 0.1))
      ? t('{name} is {ly} light-years from Earth').replace('{ly}', ly >= 1e6 ? big(ly, true) : (ly >= 100 ? fmtInt : ly >= 10 ? fmtPct : fmtTwo).format(ly))
      : t(WHERE[o.how] || WHERE.avg).replace('{km}', big(o.km, true));
    if (lang === 'fr') where = where.replace(' de années-lumière', ' d’années-lumière');   // "2,54 millions d’années-lumière"
    return cap(where.replace('{name}', o.name)) + (o.about ? ' — ' + o.about : '') + '.';
  }

  var journey = null, box = null, shownId = null;
  // the close key's cross drawn, not typed: a glyph sits on its font's baseline, off the middle of the round (October)
  var CROSS = '<svg class="jr-x" viewBox="0 0 14 14" width="14" height="14" aria-hidden="true"><path d="M2.5 2.5l9 9M11.5 2.5l-9 9" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>';
  function render() {
    var secs = secsOf(box, Date.now()) || 0, km = secs * KM, o = closest(km);
    if (!o) return '<div class="jr-panel jr-one" role="dialog" aria-modal="true"><button type="button" class="jr-close" aria-label="' + esc(t('Close')) + '">' + CROSS + '</button><p class="jr-line">…</p></div>';
    shownId = o.id;
    var r = km / o.km;
    var what = '<span class="jr-what">' + esc(o.name) + '</span>';
    var line = r < 1.15
      ? esc(t('Your message is just about as far as {name}.')).replace('{name}', what)
      : esc(t('Your message is {r} times farther away than {name}.')).replace('{r}', '<b class="jr-r">' + esc(ratio(km, o)) + '</b>').replace('{name}', what);
    if (lang === 'fr' && /^[aeiouyâéèêîôûAEIOUÉ]/.test(o.name)) line = line.replace(/\bque <span/, 'qu’<span');   // "qu’un jour-lumière"
    return '<div class="jr-panel jr-one" role="dialog" aria-modal="true" aria-labelledby="jr-title">' +
      '<button type="button" class="jr-close" aria-label="' + esc(t('Close')) + '">' + CROSS + '</button>' +
      '<p class="jr-line" id="jr-title">' + line + '</p>' +
      '<p class="jr-fact">' + esc(aboutLine(o)) + '</p>' +
      '</div>';
  }
  function refresh() {                                                       // the open panel follows the clock; a new object passed is drawn anew
    if (!objects) return;
    var secs = secsOf(box, Date.now()) || 0, km = secs * KM, o = closest(km);
    if (!o || o.id !== shownId || (km / o.km < 1.15) !== !journey.querySelector('.jr-r')) { journey.innerHTML = render(); return; }
    set(journey.querySelector('.jr-r'), ratio(km, o));
  }
  function open(b) {
    box = b;
    if (!journey) {
      journey = document.createElement('div');
      journey.className = 'journey';
      journey.addEventListener('click', function (e) { if (e.target === journey || e.target.closest('.jr-close')) close(); });
      document.body.appendChild(journey);
    }
    journey.innerHTML = render();
    journey.classList.add('is-open');
    document.body.classList.add('journey-open');
    load().then(function () { if (box === b && journey.classList.contains('is-open')) journey.innerHTML = render(); });
    var c = journey.querySelector('.jr-close'); if (c) c.focus();
  }
  function close() {
    if (!journey) return;
    journey.classList.remove('is-open');
    document.body.classList.remove('journey-open');
    journey.innerHTML = '';
    box = null;
  }
  // nothing on the installation's screens is tappable: no panel opens there (the cards' Follow its journey is not drawn either)
  if (document.body.classList.contains('screen')) return;
  document.addEventListener('click', function (e) {
    if (!e.target.closest) return;
    if (e.target.closest('a, button, input, textarea, select, .journey')) return;
    var card = e.target.closest('.card.xc');
    if (!card) return;
    var b = card.querySelector('.card-space[data-launched]');
    if (!b) return;
    e.preventDefault();
    open(b);
  });
  document.addEventListener('keydown', function (e) { if (e.key === 'Escape' && journey && journey.classList.contains('is-open')) close(); });
})();
