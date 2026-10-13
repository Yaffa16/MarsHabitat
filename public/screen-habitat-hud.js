/* MARS!platz — the habitat screen as a head-up display (src/views/pages/screens.js, habitatHud; public/screen.css, "the
 * habitat as a head-up display").
 *
 * 12 October: "make the actual screens/habitat look like this" (the mock-up in the screens' own dress) — "make all the
 * tiles from the original screen show up one after another". The display stands still — its head, the way from the
 * Earth to the habitat in the middle, the running line along its foot — and at its left and at its right a column of
 * the Sensors panel's own tiles, every one of them in its turn:
 *  - the tiles stay where the page has them (the panel, unseen under the display: what holds them stands aside —
 *    display: contents — so each is placed for itself), each laid out at the width the rolled screen gave it (an
 *    instrument 387 wide, two side by side; the steps, the bike, the stores, the power and the crew 798) and shown smaller
 *    to fit its column, so it reads as it did; the hardware's charts, the trends and the panel's words are laid out at the
 *    column's own width, drawn for it (hardware.js, habitat.js);
 *  - a column's rows, in their order, make its pages — as many rows as its height holds, a smaller tile further on
 *    taking the room a large one leaves (plan, below: the habitat's air at the left, the crew and their energy at the
 *    right) — and every twelve seconds (data-hold) a column turns its page: the tiles standing fade, and the next page's
 *    come in one after another, each rising a little into its place; the two columns turn half a turn apart, never
 *    together;
 *  - the readings stay live as they always were (habitat.js, hardware.js, live.js, screen-habitat-fx.js); a page is laid
 *    out again before it is shown when anything in its tiles has changed, and at once when the hardware's charts are
 *    drawn anew or the screen changes size;
 *  - beside the line in the middle, the latest exchange — the board's newest answered one, asked for every minute
 *    (/api/board, in the screen's language) — and the latest picture, from the pictures' strip that cloud.js keeps in
 *    line with the folder (unseen); the clock in the head on the venue's time;
 *  - when the station has been started anew (screen.js), the page is reloaded at a turn, everything faded first.
 * On a screen drawn light (?lite=1; screen-lite.css) the pages turn at once, nothing fading or rising. Nothing here is
 * ever sent anywhere: the board is only read. */
(function () {
  'use strict';
  var hud = document.getElementById('hab-hud'), deck = document.getElementById('hh-deck');
  if (!hud || !deck) return;
  var LITE = document.documentElement.classList.contains('lite');
  var calm = LITE || !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
  var HOLD = Math.max(5000, Number(hud.getAttribute('data-hold')) || 12000);   // how long a page stands
  var GAP = 18;                 // between the rows of a column, in the display's pixels
  var PAIR = 24;                // between the two instruments of a row, in their own pixels (the rolled screen's gap)
  var SMALL = 387, WIDE = 798;  // the widths the rolled screen laid the tiles out at: an instrument, a tile two wide
  var SMALL_H = 340;            // an instrument at least this tall (its own pixels), so that the rows of them match
  var RISE = calm ? 0 : 18;     // how far a tile rises into its place
  var FADE = LITE ? 0 : 600, STEP = calm ? 0 : 150;   // the fade, and the time between one tile and the next
  var cols = { left: document.getElementById('hh-left'), right: document.getElementById('hh-right') };
  var state = { left: { rows: [], pages: [], at: 0, dirty: true }, right: { rows: [], pages: [], at: 0, dirty: true } };
  var q = function (sel) { return deck.querySelector(sel); };
  var qa = function (sel) { return [].slice.call(deck.querySelectorAll(sel)); };

  /* ------------------------------------------------------------ the rows of each column, in the order they come */
  /* At the left the habitat's air: the eight instruments two by two (the oxygen and the carbon dioxide, the temperature
     and the humidity, the air pressure and the air quality, the light and the volatile organic compounds), the sensors'
     word when there is one, and the hardware's charts of the air (the crickets' terrarium, the air quality). At the right
     the crew and their energy: the current crew, the power consumed, the steps; the hardware's power chart — with the
     word on the hardware before it, when there is one —, the bike, the stores; the trends, and Karlsruhe beside the
     astronauts. A tile the plan does not name stands at the foot of the left column, an instrument beside another. */
  function plan() {
    var used = [];
    function one(x) { var el = typeof x === 'string' ? q(x) : x; if (el && used.indexOf(el) < 0) { used.push(el); return el; } return null; }
    function pair(a, b) { var x = one(a), y = b ? one(b) : null; return x && y ? { kind: 'pair', els: [x, y] } : (x || y) ? { kind: 'small', els: [x || y] } : null; }
    function wide(x) { var el = one(x); return el ? { kind: 'wide', els: [el] } : null; }
    function full(x) { var el = one(x); return el ? { kind: 'full', els: [el] } : null; }   // the column's own width
    var left = [pair('.t-o2', '.t-co2'), pair('.t-temp', '.t-hum'), pair('.t-pres', '.t-iaq'), pair('.t-light', '.t-voc'), full('#hbt-notes')];
    var right = [wide('#hh-crew'), wide('#power'), wide('.t-steps')];
    // the hardware's charts — the power's at the right, the others at the left — and a word on the hardware (the bridge
    // not reached: the last stored readings), kept on the page of the chart after it
    var charts = [], words = [];
    qa('#hw-live > *').forEach(function (el) {
      if (el.classList.contains('hw-charts')) [].forEach.call(el.children, function (f) { if (f.classList.contains('hw-chart')) charts.push(f); });
      else words.push(el);
    });
    var power = charts.filter(function (f) { return f.classList.contains('hw-power'); });
    var air = charts.filter(function (f) { return !f.classList.contains('hw-power'); });
    words.forEach(function (el) { var w = full(el); if (w) { w.glue = true; (power.length ? right : left).push(w); } });
    power.forEach(function (f) { right.push(full(f)); });
    air.forEach(function (f) { left.push(full(f)); });
    right.push(wide('#bike'), wide('#stores'), full('#trends'), pair('.t-viz-city', '.t-viz-radar'));
    var smalls = [];
    qa('#hbt-bento > section.tile').forEach(function (t) {
      if (used.indexOf(t) >= 0) return;
      if (t.classList.contains('t-sens') || t.classList.contains('t-viz')) smalls.push(t); else left.push(wide(t));
    });
    for (var i = 0; i < smalls.length; i += 2) left.push(pair(smalls[i], smalls[i + 1] || null));
    // what does not stand in a column stays unseen
    qa('.hh-item').forEach(function (el) { if (used.indexOf(el) < 0) { el.classList.remove('hh-item', 'is-on'); } });
    used.forEach(function (el) { el.classList.add('hh-item'); });
    state.left.rows = left.filter(Boolean); state.right.rows = right.filter(Boolean);
  }

  /* ------------------------------------------------------------ a column laid out: its rows measured, its pages made */
  function shows(row) { return row.els.some(function (el) { return el.isConnected && (el.textContent || '').trim() !== '' || el.querySelector('svg, img'); }); }
  function tf(el, rise) { return 'translate3d(0,' + rise + 'px,0) scale(' + (el.__hhS || 1) + ')'; }
  function layout(name) {
    var c = state[name], col = cols[name]; if (!col) return;
    var W = col.offsetWidth, H = col.offsetHeight, X = col.offsetLeft, Y = col.offsetTop;
    if (!(W > 40 && H > 40)) return;
    // each row measured: the width its tiles are laid out at, the scale they are shown at, the height they take
    var rows = c.rows.filter(function (row) {
      row.on = shows(row);
      if (!row.on) row.els.forEach(function (el) { el.classList.remove('is-on'); });
      return row.on;
    });
    rows.forEach(function (row) {
      var small = row.kind === 'pair' || row.kind === 'small';
      var w = small ? SMALL : row.kind === 'wide' ? WIDE : W;
      var s = row.kind === 'full' ? 1 : W / (row.kind === 'wide' ? WIDE : 2 * SMALL + PAIR);
      var h = small ? SMALL_H : 0;
      row.els.forEach(function (el) { el.style.width = w + 'px'; el.style.height = ''; h = Math.max(h, el.offsetHeight); });
      if (small) row.els.forEach(function (el) { el.style.height = h + 'px'; });   // the two the same height
      if (h * s > H) s = H / h;                                          // taller than the column: smaller, to fit
      var span = (row.kind === 'pair' ? 2 * SMALL + PAIR : w) * s;
      row.s = s; row.h = h * s; row.x = row.kind === 'small' ? 0 : Math.max(0, (W - span) / 2);
    });
    // the pages: each begun with the first row not yet shown, then filled with the rows after it that still fit, in
    // their order — a smaller tile further on takes the room a large one leaves (and comes the sooner); a word on the
    // hardware stays with the chart after it
    var units = [];
    for (var i = 0; i < rows.length; i++) {
      if (rows[i].glue && rows[i + 1]) { units.push([rows[i], rows[i + 1]]); i++; } else units.push([rows[i]]);
    }
    var tall = function (u) { return u.reduce(function (t, r, k) { return t + r.h + (k ? GAP : 0); }, 0); };
    var pages = [];
    while (units.length) {
      var page = [], y = 0;
      for (var k = 0; k < units.length;) {
        var u = units[k];
        if (page.length && y + GAP + tall(u) > H) { k++; continue; }
        u.forEach(function (row) {
          row.y = page.length ? y + GAP : 0; y = row.y + row.h; page.push(row);
          row.els.forEach(function (el, n) {
            el.__hhS = row.s;
            el.style.left = Math.round(X + row.x + n * (SMALL + PAIR) * row.s) + 'px';
            el.style.top = Math.round(Y + row.y) + 'px';
            el.style.transform = tf(el, el.classList.contains('is-on') ? 0 : RISE);
          });
        });
        units.splice(k, 1);
      }
      pages.push(page);
    }
    c.pages = pages; c.dirty = false;
    if (c.at >= pages.length) c.at = 0;
  }

  /* ------------------------------------------------------------ a page shown, a page put away */
  function ready(el) {                                                   // just under its place, unseen, at once
    el.style.setProperty('transition', 'none', 'important');
    el.style.transform = tf(el, RISE);
    void el.offsetWidth;
    el.style.removeProperty('transition');
  }
  function on(el, delay) { el.style.setProperty('--hh-d', Math.round(delay) + 'ms'); el.style.transform = tf(el, 0); el.classList.add('is-on'); }
  function off(el) { el.style.setProperty('--hh-d', '0ms'); el.classList.remove('is-on'); }
  function show(name, at, now) {
    var c = state[name], page = c.pages[at] || [], k = 0, mine = [];
    page.forEach(function (row) { row.els.forEach(function (el) { mine.push(el); }); });
    c.rows.forEach(function (row) { row.els.forEach(function (el) { if (mine.indexOf(el) < 0 && el.classList.contains('is-on')) off(el); }); });
    mine.forEach(function (el) {
      if (el.classList.contains('is-on')) { el.style.transform = tf(el, 0); return; }
      if (now) { el.style.setProperty('transition', 'none', 'important'); on(el, 0); void el.offsetWidth; el.style.removeProperty('transition'); return; }
      ready(el); on(el, k++ * STEP);
    });
  }
  var reloadDue = false;
  function turn(name) {
    var c = state[name];
    if (reloadDue) { reload(); return; }
    if (c.dirty) layout(name);
    if (c.pages.length < 2) { show(name, c.at, true); return; }
    var was = c.pages[c.at] || [];
    was.forEach(function (row) { row.els.forEach(off); });
    c.at = (c.at + 1) % c.pages.length;
    setTimeout(function () { if (state[name].dirty) layout(name); show(name, state[name].at); }, FADE);
  }
  function relayoutAll(now) { plan(); layout('left'); layout('right'); show('left', state.left.at, now); show('right', state.right.at, now); }

  /* ------------------------------------------------------------ reloading at a turn (screen.js: the station started anew) */
  function reload() {
    qa('.hh-item.is-on').forEach(off);
    setTimeout(function () { location.reload(); }, FADE + 100);
  }
  window.MCSScreenRoll = { reloadAtTurn: function () { reloadDue = true; setTimeout(reload, 2 * HOLD + 1000); } };

  /* ------------------------------------------------------------ what changes, noticed */
  // a change in a tile marks its column, to be laid out again before its next page is shown; the hardware's charts drawn
  // anew (hardware.js: the panel's markup swapped) are new tiles: the plan is made again, and both columns laid out
  function columnOf(node) {
    var el = node && node.nodeType === 1 ? node : node && node.parentNode;
    var item = el && el.closest ? el.closest('.hh-item') : null; if (!item) return null;
    return state.left.rows.some(function (r) { return r.els.indexOf(item) >= 0; }) ? 'left' : 'right';
  }
  // (at once, before the screen is drawn again: the new charts take the old ones' places with nothing in between)
  if (window.MutationObserver) {
    new MutationObserver(function (ms) {
      var swapped = false;
      for (var i = 0; i < ms.length; i++) {
        var t = ms[i].target;
        if (t.id === 'hw-live' && ms[i].type === 'childList') { swapped = true; continue; }
        var name = columnOf(t); if (name) state[name].dirty = true;
      }
      if (swapped) relayoutAll(true);
    }).observe(deck, { childList: true, subtree: true, characterData: true });
  }
  var resized = null;
  window.addEventListener('resize', function () { clearTimeout(resized); resized = setTimeout(function () { relayoutAll(true); }, 200); });

  /* ------------------------------------------------------------ the start */
  plan(); layout('left'); layout('right');
  show('left', 0); setTimeout(function () { show('right', 0); }, calm ? 0 : 450);
  // the tiles fill in a moment after the page (the readings, the charts, the trends): laid out again, as they stand; and
  // the drawings that draw to the width they are given told theirs (hardware.js, habitat.js listen for a resize)
  setTimeout(function () { window.dispatchEvent(new Event('resize')); }, 300);
  setTimeout(function () { relayoutAll(true); }, 2500);
  setTimeout(function () { relayoutAll(true); }, 6000);
  setTimeout(function () {
    turn('left'); setInterval(function () { turn('left'); }, HOLD);
  }, HOLD);
  setTimeout(function () {
    turn('right'); setInterval(function () { turn('right'); }, HOLD);
  }, HOLD + HOLD / 2);

  /* ------------------------------------------------------------ the clock, on the venue's time */
  var clock = document.getElementById('hh-clock'), tz = hud.getAttribute('data-tz') || 'Europe/Berlin';
  /* the zone the venue's clock keeps at a moment — CEST, or CET from 25 October 2026 at 03:00, when the clocks go back
     (13 October: "for most places on the website where time is shown, intelligently add CEST and change to CET") */
  function zoneAt(ms, zone) {
    try {
      var p = {};
      new Intl.DateTimeFormat('en-GB', { timeZone: zone || 'Europe/Berlin', hourCycle: 'h23', year: 'numeric', month: 'numeric', day: 'numeric', hour: 'numeric', minute: 'numeric' })
        .formatToParts(new Date(ms)).forEach(function (x) { p[x.type] = x.value; });
      var off = Math.round((Date.UTC(+p.year, +p.month - 1, +p.day, +p.hour % 24, +p.minute) - Math.floor(ms / 60000) * 60000) / 60000);
      return off === 120 ? 'CEST' : off === 60 ? 'CET' : '';
    } catch (e) { return ''; }
  }
  function tick() {
    if (!clock) return;
    var z = zoneAt(Date.now(), tz);
    try { clock.textContent = new Intl.DateTimeFormat('en-GB', { timeZone: tz, hour: '2-digit', minute: '2-digit', hour12: false }).format(new Date()) + (z ? ' ' + z : ''); } catch (e) { /* as it stands */ }
  }
  tick(); setInterval(tick, 15000);

  /* ------------------------------------------------------------ the latest exchange: the board's newest answered one */
  var msg = document.getElementById('hh-msg'), lang = hud.getAttribute('data-lang') || 'de';
  var CLIP = 90;
  function clip(t) { t = String(t || '').replace(/\s+/g, ' ').trim(); return t.length > CLIP ? t.slice(0, CLIP - 1).replace(/\s+$/, '') + '…' : t; }
  function stamp(iso) {
    var d = new Date(iso); if (!iso || isNaN(d.getTime())) return '';
    try {
      var o = {}; new Intl.DateTimeFormat('en-GB', { timeZone: tz, hour12: false, day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })
        .formatToParts(d).forEach(function (p) { o[p.type] = p.value; });
      var z = zoneAt(d.getTime(), tz);
      return o.day + '.' + o.month + ' · ' + (o.hour === '24' ? '00' : o.hour) + ':' + o.minute + (z ? ' ' + z : '');
    } catch (e) { return ''; }
  }
  // (the board's notes, as the Write page's wall has them — public.js, noteCard: they name the officer who answered)
  function newest(html) {
    var tpl = document.createElement('template'); tpl.innerHTML = html || '';
    var best = null;
    [].forEach.call(tpl.content.querySelectorAll('article.card'), function (c) {
      var rp = c.querySelector('.note-answer > p'); if (c.hasAttribute('data-pending') || !rp) return;
      var sent = c.querySelector('.note-when'), cs = c.querySelector('.note-who .cs'), body = c.querySelector('.note-title'), aw = c.querySelector('.note-awho .cs');
      var row = { id: /^m\d+$/.test(c.id || '') ? c.id.slice(1) : '', at: sent ? sent.getAttribute('datetime') || '' : '', who: cs ? cs.textContent.trim() : '',
        text: body ? body.textContent : '', reply: rp.textContent, rwho: aw ? aw.textContent.trim() : '' };
      if (!best || row.at > best.at) best = row;
    });
    return best;
  }
  function setMsg(x) {
    if (!msg || !x || !x.id || msg.getAttribute('data-id') === x.id) return;
    var Q = msg.getAttribute('data-q') || 'Question', A = msg.getAttribute('data-a') || 'Answer', when = stamp(x.at);
    msg.querySelector('.hh-q-k').textContent = Q + ' · ' + x.who + (when ? ' · ' + when : '');
    msg.querySelector('.hh-q').textContent = clip(x.text);
    msg.querySelector('.hh-a-k').textContent = A + ' · ✧ ' + (x.rwho || '');
    msg.querySelector('.hh-a-t').textContent = clip(x.reply);
    msg.querySelector('.hh-a').hidden = false;
    msg.setAttribute('data-id', x.id); msg.hidden = false;
    if (!calm) { msg.classList.remove('is-new'); void msg.offsetWidth; msg.classList.add('is-new'); }
  }
  function ask() {
    if (document.hidden || !window.fetch) return;
    fetch('/api/board?lang=' + encodeURIComponent(lang) + '&limit=12&wall=1', { cache: 'no-store', credentials: 'same-origin' })
      .then(function (r) { return r.ok ? r.json() : null; })
      .then(function (j) { if (j && typeof j.cards === 'string') setMsg(newest(j.cards)); })
      .catch(function () { /* the note stands as it is; the next minute asks again */ });
  }
  if (msg) setInterval(ask, 60000);

  /* ------------------------------------------------------------ the latest picture: the strip's first */
  var pic = document.getElementById('hh-pic'), strip = document.getElementById('cloud-latest'), soon = null;
  function setPic() {
    var t = [].filter.call(strip.querySelectorAll('.mtile'), function (m) { return !m.classList.contains('is-leaving'); })[0];
    var im = t && t.querySelector('img'), w = t && t.querySelector('.mtile-when'), id = t && t.getAttribute('data-id');
    if (!pic || !im || !id || pic.getAttribute('data-id') === id) return;
    pic.querySelector('img').src = im.getAttribute('src') || '';
    pic.querySelector('.hh-pic-when').textContent = (w ? w.textContent : '').replace(/(\d{2})\.(\d{2})\.\d{4}/, '$1.$2');
    pic.setAttribute('data-id', id); pic.hidden = false;
    if (!calm) { pic.classList.remove('is-new'); void pic.offsetWidth; pic.classList.add('is-new'); }
  }
  if (pic && strip && window.MutationObserver) {
    new MutationObserver(function () { clearTimeout(soon); soon = setTimeout(setPic, 400); }).observe(strip, { childList: true, subtree: true });
  }
})();
