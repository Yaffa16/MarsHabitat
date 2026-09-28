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

/* The cards' line into space — "This message is currently … from Earth!" —
   kept running: every message is beamed out by radio as well
   (src/lib/spacespeak.js), and from the moment it was launched (the card's
   data-launched) it is 299,792 km further from Earth every second. The
   figure is drawn by the page (public.js, spaceLine) and moved on here, a
   second at a time, in the visitor's figures — every digit while it is
   small, then in words: 4.36 million, 3.95 billion, 1.02 trillion (in
   German Milliarde and Billion, in French milliard and billion). LAUNCHED …
   AGO follows. New cards — the board swaps them in as it polls — are picked
   up as they come. Works on every page with cards: the board, the messages
   page, the installation's board screen, a single exchange.

   And a tap on a card opens its journey: where the message has got to, stop
   by stop — the Moon, the Sun, Mars as it stood the day it was sent, the
   orbits of the outer planets, the heliopause, Voyager 1, a light-day, the
   Oort cloud, then the nearest stars as a share of the way — each with what
   it is, in the visitor's language, and a key to it on Wikipedia. The
   figures are real: the distances are the accepted ones (semi-major axes
   for the planets' orbits, the measured distances of the stars), Mars is
   the message's own distance that day (orbital.js), Voyager 1's is worked
   out for today from its speed and the day it reaches one light-day. */
(function () {
  'use strict';
  var t = window.t || function (s) { return s; };
  var MILES = 186282.397, KM = 299792.458;
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
  var fmtThree; try { fmtThree = new Intl.NumberFormat(locale, { minimumFractionDigits: 3, maximumFractionDigits: 3 }); } catch (e) { fmtThree = { format: function (n) { return n.toFixed(3); } }; }
  function pct(share) {                                                      // a share of the way: 12.3 %, 0.13 %, 0.004 %
    var p = share * 100;
    return (p < 0.01 ? fmtThree : p < 0.1 ? fmtTwo : fmtPct).format(p) + ' %';
  }
  function big(n, words) {                                                   // as public.js fmtBig: in words once the km pass ten million
    if (words === undefined) words = n >= 1e7;
    if (!words || n < 1e6) return fmtInt.format(n);
    var i = 0; while (n < SCALES[i][0]) i++;
    var num = fmtTwo.format(n / SCALES[i][0]), word = SCALES[i][1], plural = t(word + 's');
    return num + ' ' + (/^1([.,]00)?$/.test(num) || plural === word + 's' ? t(word) : plural);   // English has no plural for it
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
    var words = secs * KM >= 1e7;
    set(box.querySelector('.sp-mi'), big(secs * MILES, words));
    set(box.querySelector('.sp-km'), big(secs * KM, words));
    set(box.querySelector('.sp-ago'), ago(secs));
  }
  function tick() {
    var boxes = document.querySelectorAll('.card-space[data-launched]');
    if (!boxes.length) return;
    var now = Date.now();
    for (var i = 0; i < boxes.length; i++) move(boxes[i], now);
    if (journey) refresh();
  }
  tick();
  setInterval(tick, 1000);

  /* ---------------------------------------------------------- the journey */
  var AU = 149597870.7, LY = 9460730472580.8, LIGHT_DAY = KM * 86400;
  // Voyager 1: one light-day (25.9 billion km) from Earth on 15 November 2026, moving away at about 17 km/s
  function voyagerKm() { return LIGHT_DAY - (Date.parse('2026-11-15T00:00:00Z') - Date.now()) / 1000 * 17.0; }
  function wiki(page) { return 'https://' + (lang === 'de' ? 'de' : lang === 'fr' ? 'fr' : 'en') + '.wikipedia.org/wiki/' + page; }
  var W = {                                                                  // the articles, per language
    moon: { en: 'Moon', de: 'Mond', fr: 'Lune' }, sun: { en: 'Sun', de: 'Sonne', fr: 'Soleil' }, mars: { en: 'Mars', de: 'Mars', fr: 'Mars_(planète)' },
    jupiter: { en: 'Jupiter', de: 'Jupiter_(Planet)', fr: 'Jupiter_(planète)' }, saturn: { en: 'Saturn', de: 'Saturn_(Planet)', fr: 'Saturne_(planète)' },
    uranus: { en: 'Uranus', de: 'Uranus_(Planet)', fr: 'Uranus_(planète)' }, neptune: { en: 'Neptune', de: 'Neptun_(Planet)', fr: 'Neptune_(planète)' },
    pluto: { en: 'Pluto', de: 'Pluto', fr: 'Pluton_(planète_naine)' }, heliopause: { en: 'Heliosphere#Heliopause', de: 'Heliopause', fr: 'Héliopause' },
    voyager1: { en: 'Voyager_1', de: 'Voyager_1', fr: 'Voyager_1' }, lightday: { en: 'Light-year', de: 'Lichtjahr', fr: 'Année-lumière' },
    oort: { en: 'Oort_cloud', de: 'Oortsche_Wolke', fr: 'Nuage_de_Oort' }, proxima: { en: 'Proxima_Centauri', de: 'Proxima_Centauri', fr: 'Proxima_Centauri' },
    alphacen: { en: 'Alpha_Centauri', de: 'Alpha_Centauri', fr: 'Alpha_Centauri' }, barnard: { en: "Barnard's_Star", de: 'Barnards_Pfeilstern', fr: 'Étoile_de_Barnard' },
    sirius: { en: 'Sirius', de: 'Sirius', fr: 'Sirius' }, vega: { en: 'Vega', de: 'Wega', fr: 'Véga' }
  };
  function stops(box) {
    var au = Number(box.getAttribute('data-au')) || 0, ls = Number(box.getAttribute('data-ls')) || 0;
    var marsKm = au * AU;
    var marsFact = t('Where this station’s habitat stands in the story. On the day this message was sent, Mars was {au} au from Earth — {km} — and a radio signal needed {lt} to get there; the distance changes through the year as the two planets move.')
      .replace('{au}', fmtTwo.format(au)).replace('{km}', big(marsKm) + ' km').replace('{lt}', span(ls));
    return [
      { key: 'moon', km: 384400, name: 'The Moon', fact: 'Earth’s only natural satellite, 384,400 km away on average — light crosses that in 1.3 seconds. The only other world people have walked on, from 1969 to 1972.' },
      { key: 'sun', km: AU, name: 'The Sun', fact: 'The star the Solar System turns around, 149.6 million km away — one astronomical unit (au), the yardstick of the Solar System. Its light takes 8 minutes 19 seconds to reach Earth.' },
      { key: 'mars', km: marsKm, name: 'Mars', fact: marsFact, plain: true, note: t('the distance to Mars that day') },
      { key: 'jupiter', km: 5.2026 * AU, name: 'The orbit of Jupiter', fact: 'The largest planet, eleven times Earth’s width, orbiting 778 million km from the Sun (5.2 au). Its Great Red Spot is a storm wider than Earth that has raged for centuries.' },
      { key: 'saturn', km: 9.5549 * AU, name: 'The orbit of Saturn', fact: 'The ringed planet, 1.43 billion km from the Sun (9.5 au). Its rings are mostly water ice, hundreds of thousands of km across and mostly less than a kilometre thick.' },
      { key: 'uranus', km: 19.2184 * AU, name: 'The orbit of Uranus', fact: 'An ice giant 2.87 billion km from the Sun (19.2 au), tipped almost on its side: its axis leans 98°, so each pole gets 42 years of sunlight, then 42 of dark.' },
      { key: 'neptune', km: 30.11 * AU, name: 'The orbit of Neptune', fact: 'The outermost planet, 4.5 billion km from the Sun (30.1 au), with the strongest winds in the Solar System — around 2,000 km/h. Sunlight takes 4 hours 10 minutes to reach it.' },
      { key: 'pluto', km: 39.482 * AU, name: 'The orbit of Pluto', fact: 'The dwarf planet of the Kuiper belt, on average 5.9 billion km from the Sun (39.5 au). New Horizons flew past it in July 2015, the only visit so far.' },
      { key: 'heliopause', km: 121 * AU, name: 'The heliopause', fact: 'Where the Sun’s wind gives way to the gas between the stars — the edge of the heliosphere, about 121 au (18 billion km) out. Voyager 1 crossed it in August 2012, Voyager 2 in November 2018.' },
      { key: 'voyager1', km: voyagerKm(), name: 'Voyager 1', plain: true, fact: t('Launched in 1977 and still sending data, the most distant human-made object — now about {km} from Earth, moving away at 17 km/s. On 15 November 2026 it will be a full light-day away.').replace('{km}', big(voyagerKm()) + ' km') },
      { key: 'lightday', km: LIGHT_DAY, name: 'One light-day', fact: 'The distance light — and this message — covers in 24 hours: 25.9 billion km. Voyager 1 reaches it in November 2026, after 49 years of flight.' },
      { key: 'oort', km: 2000 * AU, name: 'The Oort cloud', fact: 'The cloud of icy bodies around the whole Solar System, where long-period comets come from. Its inner edge is thought to lie some 2,000 au out — 300 billion km, 11.6 light-days; its outer reaches may stretch halfway to the nearest star.' },
      { key: 'proxima', km: 4.2465 * LY, ly: 4.25, name: 'Proxima Centauri', star: true, fact: 'The nearest star to the Sun, 4.25 light-years away: a small red dwarf in the Alpha Centauri system, too faint to see without a telescope. At least one planet, Proxima b, orbits in its habitable zone. This message needs 4 years and 3 months to get there.' },
      { key: 'alphacen', km: 4.37 * LY, ly: 4.37, name: 'Alpha Centauri', star: true, fact: 'Alpha Centauri A and B, 4.37 light-years away — the nearest Sun-like stars, a pair orbiting each other every 80 years; with Proxima they form the closest star system, and the third-brightest star in the night sky.' },
      { key: 'barnard', km: 5.96 * LY, ly: 5.96, name: 'Barnard’s Star', star: true, fact: 'A red dwarf 5.96 light-years away, the nearest star in the northern sky — and the star that moves fastest across it, the width of the Moon every 180 years.' },
      { key: 'sirius', km: 8.6 * LY, ly: 8.6, name: 'Sirius', star: true, fact: 'The brightest star in the night sky, in Canis Major, the great dog, 8.6 light-years away — nearly twice as bright as Canopus, the next brightest. A binary: Sirius A, a hot white star of twice the Sun’s mass, and Sirius B, a white dwarf the size of Earth with the mass of the Sun.' },
      { key: 'vega', km: 25.04 * LY, ly: 25, name: 'Vega', star: true, fact: 'The brightest star of Lyra and the fifth-brightest in the night sky, 25 light-years away — around 12,000 BC it was the northern pole star, as it will be again in about 13,700 AD.' }
    ];
  }
  /** A span of time, in words: "1.3 seconds", "43 minutes", "4 hours 10 minutes", "11.6 days". */
  function span(secs) {
    if (secs < 60) return fmtPct.format(secs) + ' ' + t('seconds');
    if (secs < 3600) return Math.round(secs / 60) + ' ' + t('minutes');
    if (secs < 86400) { var h = Math.floor(secs / 3600), m = Math.round((secs - h * 3600) / 60); return h + ' ' + t(h === 1 ? 'hour' : 'hours') + (m ? ' ' + m + ' ' + t('minutes') : ''); }
    var d = secs / 86400;
    return (d < 10 ? fmtPct.format(d) : fmtInt.format(d)) + ' ' + t(d < 1.5 ? 'day' : 'days');
  }
  function esc(s) { return String(s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }

  var journey = null, box = null;
  function render() {
    var now = Date.now(), secs = secsOf(box, now) || 0, km = secs * KM;
    var rows = stops(box).map(function (s) {
      var done = km >= s.km, share = Math.min(1, km / s.km);
      var status = done ? t('reached after') + ' ' + span(s.km / KM) : pct(share) + ' ' + t('of the way');
      var name = t(s.name);
      return '<li class="jr-stop' + (done ? ' is-done' : '') + (s.star ? ' is-star' : '') + '" data-key="' + s.key + '">' +
        '<span class="jr-mark" aria-hidden="true"></span>' +
        '<div class="jr-body">' +
          '<div class="jr-head"><b class="jr-name">' + esc(name) + '</b><span class="jr-status">' + esc(status) + '</span></div>' +
          (done ? '' : '<div class="jr-bar"><i style="width:' + Math.max(0.4, share * 100).toFixed(2) + '%"></i></div>') +
          (s.star ? '<p class="jr-you">' + esc(t('Your message is')) + ' <b>' + esc(pct(share)) + '</b> ' + esc(t('of the way to')) + ' ' + esc(name) + '.</p>' : '') +
          '<p class="jr-fact">' + esc(s.plain ? s.fact : t(s.fact)) + ' <a href="' + wiki(W[s.key][lang] || W[s.key].en) + '" target="_blank" rel="noopener">' + esc(t('On Wikipedia')) + ' ↗</a></p>' +
        '</div></li>';
    }).join('');
    var who = box.getAttribute('data-callsign') || '';
    return '<div class="jr-panel" role="dialog" aria-modal="true" aria-labelledby="jr-title">' +
      '<button type="button" class="jr-close" aria-label="' + esc(t('Close')) + '">✕</button>' +
      '<div class="jr-top"><span class="jr-kicker">' + esc(t('Where this message has got to')) + '</span>' +
        '<h2 id="jr-title" class="jr-title">' + esc(t('The message of')) + ' <span class="cs">' + esc(who) + '</span></h2>' +
        '<p class="jr-lead">' + esc(t('left Earth {ago} and has covered {km} ({mi}) — as far as light travels in {span}.'))
          .replace('{ago}', '<b class="jr-ago">' + esc(ago(secs)) + '</b>').replace('{km}', '<b class="jr-km">' + esc(big(km) + ' km') + '</b>')
          .replace('{mi}', '<span class="jr-mi">' + esc(big(secs * MILES) + ' ' + t('miles')) + '</span>').replace('{span}', '<b class="jr-span">' + esc(span(secs)) + '</b>') +
          ' ' + esc(t('It goes out as radio waves, at the speed of light, and will not stop.')) + '</p></div>' +
      '<ol class="jr-stops">' + rows + '</ol></div>';
  }
  function refresh() {                                                       // the figures in the open journey follow the clock
    var now = Date.now(), secs = secsOf(box, now) || 0, km = secs * KM;
    set(journey.querySelector('.jr-km'), big(km) + ' km');
    set(journey.querySelector('.jr-mi'), big(secs * MILES) + ' ' + t('miles'));
    set(journey.querySelector('.jr-span'), span(secs));
    set(journey.querySelector('.jr-ago'), ago(secs));
    var list = stops(box), items = journey.querySelectorAll('.jr-stop');
    for (var i = 0; i < items.length && i < list.length; i++) {
      var s = list[i], el = items[i];
      if (el.classList.contains('is-done')) continue;
      if (km >= s.km) { open(box); return; }                                 // a stop reached while the journey is open: drawn again
      var share = km / s.km, p = pct(share);
      set(el.querySelector('.jr-status'), p + ' ' + t('of the way'));
      var bar = el.querySelector('.jr-bar i'); if (bar) bar.style.width = Math.max(0.4, share * 100).toFixed(2) + '%';
      var you = el.querySelector('.jr-you b'); if (you) set(you, p);
    }
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
