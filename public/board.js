/* Message board: filtering and live refresh. No framework, no dependencies.

   Filtering — the cards are already in the page, so filtering by tag or by
   "my messages" is instant, and losing JavaScript simply leaves the published
   board visible. The viewer's own messages come first, under a MY MESSAGES
   heading, whatever state they are in — cards stamped data-pending are the
   ones mission control has not published yet, and they only ever reach
   their own sender's page. Everyone else's published exchanges follow under
   ALL MESSAGES. The MY MESSAGES chip narrows the board to the viewer's own.

   Live refresh — the board polls /api/board every few seconds and swaps the
   cards in place when the server reports a change, so a reply published from
   mission control, or another visitor's exchange, appears on every open phone
   in the room without a reload. The filter you chose and your scroll position
   are kept. Polling pauses while the tab is hidden and backs off when the
   network is down; the LIVE mark in the foot dims while it cannot reach the
   station.

   On a phone held upright the board flows with the page instead of scrolling
   inside its own box (aura.css), so it shows twenty exchanges of the current
   view at a time and a Show more key beneath them brings the next twenty;
   a change of filter starts again from the first twenty. Wider screens list
   every card, as before. */
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

  // The page decides which chip starts active (MY MESSAGES once you have
  // sent something); the script follows it.
  var initial = bar.querySelector('button.active');
  var filter = initial ? (initial.getAttribute('data-filter') || '') : '';
  var cards = [];

  var groups = [];
  function collect() {
    cards = Array.prototype.slice.call(cardsBox.querySelectorAll('.card'));
    groups = Array.prototype.slice.call(cardsBox.querySelectorAll('.board-group'));
  }

  /* ------------------------------------------------------------- filtering */
  function apply() {
    var f = filter;
    var shown = 0;
    var shownMine = 0, shownRest = 0;
    cards.forEach(function (c) {
      var show = true;
      var mine = c.hasAttribute('data-mine');
      if (f === 'mine') {
        show = mine;
      } else if (f.indexOf('tag:') === 0) {
        var tags = ',' + (c.getAttribute('data-tags') || '') + ',';
        show = tags.indexOf(',' + f.slice(4) + ',') !== -1;
      }
      c.classList.toggle('is-hidden', !show);
      c.classList.toggle('is-listed', show);
      if (show) { shown++; if (mine) shownMine++; else shownRest++; }
    });
    // The two headings stand only when both groups have something under them
    // in this view; the MY MESSAGES view needs no heading at all.
    groups.forEach(function (g) {
      var which = g.getAttribute('data-group');
      g.hidden = f === 'mine' || (which === 'mine' ? !shownMine : !shownRest || !shownMine);
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
  }

  /* ------------------------------------------------- a phone: twenty at a time */
  var PAGE = 20, limit = PAGE;
  var more = document.getElementById('feed-more');
  var upright = window.matchMedia ? window.matchMedia('(max-width: 760px) and (min-height: 521px)') : null;
  function page() {
    var cap = upright && upright.matches ? limit : Infinity;
    var listed = cards.filter(function (c) { return c.classList.contains('is-listed'); });
    listed.forEach(function (c, i) { c.classList.toggle('is-more', i >= cap); });
    if (more) {
      var left = listed.length - Math.min(cap, listed.length);
      more.hidden = left <= 0;
      more.textContent = t('Show more') + ' \u00b7 ' + left;
    }
  }
  if (more) more.addEventListener('click', function () { limit += PAGE; page(); });
  if (upright) {
    var onUpright = function () { limit = PAGE; page(); };
    if (upright.addEventListener) upright.addEventListener('change', onUpright); else if (upright.addListener) upright.addListener(onUpright);
  }

  bar.addEventListener('click', function (e) {
    var btn = e.target.closest ? e.target.closest('button[data-filter]') : null;
    if (!btn) return;
    Array.prototype.forEach.call(bar.querySelectorAll('button'), function (b) {
      b.classList.remove('active');
    });
    btn.classList.add('active');
    filter = btn.getAttribute('data-filter') || '';
    limit = PAGE;
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
    groups.forEach(function (g) { cardsBox.removeChild(g); });
    if (empty) empty.insertAdjacentHTML('beforebegin', data.cards);
    else cardsBox.insertAdjacentHTML('afterbegin', data.cards);
    collect();
    apply();
    if (scroller && top > 0) scroller.scrollTop = top + (scroller.scrollHeight - before);

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
        if (data.phase === 'COMPLETE') { window.location.reload(); return; }
        if (data.version !== version) {
          swap(data);
          version = data.version;
        }
        wait = BASE_MS;
        if (live) { live.classList.remove('stale'); live.textContent = t('LIVE'); }
      })
      .catch(function () {
        wait = Math.min(MAX_MS, wait * 2);
        if (live) { live.classList.add('stale'); live.textContent = t('RECONNECTING'); }
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
     arrives: go back to ALL (where the viewer's own messages head the board),
     scroll to the top and fetch the board straight away, so the message you
     just sent is on the screen without waiting for the next poll. */
  window.MCSBoard = {
    refresh: function (which) {
      if (typeof which === 'string') {
        var btn = bar.querySelector('button[data-filter="' + which + '"]');
        if (btn) {
          Array.prototype.forEach.call(bar.querySelectorAll('button'), function (b) { b.classList.remove('active'); });
          btn.classList.add('active');
          filter = which;
          limit = PAGE;
          apply();
          if (scroller) scroller.scrollTop = 0;
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
   milliard and billion). LAUNCHED … AGO follows. New cards — the board
   swaps them in as it polls — are picked up as they come. Works on every
   page with cards: the board, the messages page, the installation's board
   screen, a single exchange.

   A tap on a card says, in two lines, what the message is closest to: the
   last of some 590 things in the sky it has passed — the meteors overhead,
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
  function ago(secs) {
    var n = Math.max(0, Math.floor(secs));
    if (n < 45) return t('just now');
    var m = Math.round(n / 60);
    if (m < 60) return m <= 1 ? t('a minute ago') : t('{n} minutes ago').replace('{n}', String(m));
    var h = Math.round(n / 3600);
    if (h < 24) return h <= 1 ? t('an hour ago') : t('{n} hours ago').replace('{n}', String(h));
    var d = Math.round(n / 86400);
    return d <= 1 ? t('a day ago') : t('{n} days ago').replace('{n}', String(d));
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
    set(box.querySelector('.sp-ago'), ago(secs));
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
  function render() {
    var secs = secsOf(box, Date.now()) || 0, km = secs * KM, o = closest(km);
    if (!o) return '<div class="jr-panel jr-one" role="dialog" aria-modal="true"><button type="button" class="jr-close" aria-label="' + esc(t('Close')) + '">✕</button><p class="jr-line">…</p></div>';
    shownId = o.id;
    var r = km / o.km;
    var what = '<span class="jr-what">' + esc(o.name) + '</span>';
    var line = r < 1.15
      ? esc(t('Your message is just about as far as {name}.')).replace('{name}', what)
      : esc(t('Your message is {r} times farther away than {name}.')).replace('{r}', '<b class="jr-r">' + esc(ratio(km, o)) + '</b>').replace('{name}', what);
    if (lang === 'fr' && /^[aeiouyâéèêîôûAEIOUÉ]/.test(o.name)) line = line.replace(/\bque <span/, 'qu’<span');   // "qu’un jour-lumière"
    return '<div class="jr-panel jr-one" role="dialog" aria-modal="true" aria-labelledby="jr-title">' +
      '<button type="button" class="jr-close" aria-label="' + esc(t('Close')) + '">✕</button>' +
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
