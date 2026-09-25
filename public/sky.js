/* MARS!platz — the sky over the habitat (src/views/pages/sky.js draws it and its first lines; aura.css and sheet.css show
 * it on a phone held upright, where the habitat has the first screen to itself, and on a desk, around and above the dome
 * — not on a phone held sideways).
 *
 * The first screen of the v6 mock-up of the app: around the dome the latest exchanges with Earth fade in and out one
 * after another — a visitor's question under its callsign, the crew's answer under ✧ and the officer — and the newest
 * pictures from the cloud folder appear as snapshots and fade again. Each comes somewhere else each time, on the sheet's
 * grid (a column to a sol), clear of the dome and of everything else in the sky: nothing is ever drawn over anything
 * else. What it shows comes with the page (the JSON block in
 * the sky); what it learns later it takes from what the page already fetches, never polling on its own:
 *  - the dome's own refresh (/api/dome, every 20 s, dome.js) rewrites the communication pop-up's latest-exchange line
 *    when there is a new exchange — only then is the board asked for (/api/board) and its published cards read, the way
 *    the board itself shows them (a message still waiting for mission control is never among them);
 *  - public/cloud.js keeps the Habitat panel's strip of newest pictures (#cloud-latest) in line with the folder, and the
 *    snapshots follow the strip.
 * It runs only while it can be seen — a phone held upright, the page in front, the habitat on the screen — and stops
 * otherwise. With nothing to show there is no sky: the panel keeps no room for it (has-sky). A phone set to reduce
 * motion sees the lines and snapshots come and go by fading alone (aura.css). Nothing here is ever sent anywhere.
 * The places are the phone's or the desk's, whichever layout is showing — a window resized across the line takes the
 * other set from the next line or snapshot on.
 * It also keeps the sheet the habitat stands on (sky.js, habitatSheet) in step: its glow centred behind the dome
 * wherever the layout puts the dome, and the orange line on the day of the run; it turns the line under the dome
 * (below); it moves the signal in the world's slowest chat from Earth to Mars; and on a phone it tells the pages of the
 * scroll that are taller than the screen (below). A snapshot's time is the moment the picture was taken, as its file
 * name writes it. */
(function () {
  'use strict';
  /* ------------------------------------------------------------ the line under the dome (landing.js, underLine)
     It always says something, and turns every six seconds: what the crew are doing now (the header's running line has it,
     tk-now), the signal's one-way time, the habitat's latest reading (tk-hab), the sol or the countdown
     (tk-count), the last answered exchanges — question, then answer — and a few older published messages. An exchange
     the sky is showing at that moment (window.MCS_SKY_NOW) is passed over. It turns only while the habitat is on the
     screen and the page in front. */
  (function () {
    var line = document.getElementById('hab-line'), item = line && line.querySelector('.hab-line-item');
    var pool = null;
    try { pool = JSON.parse((document.getElementById('hab-line-data') || {}).textContent || 'null'); } catch (e) { pool = null; }
    if (!item || !pool) return;
    var calm = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    var EVERY_LINE = 6000, seen = true;
    var tr = function (s) { return typeof t === 'function' ? t(s) : s; };
    var text = function (id) { var n = document.getElementById(id); return n ? (n.textContent || '').replace(/\s+/g, ' ').trim() : ''; };
    var NO_READING = [tr('awaiting reading'), tr('no current reading')];
    // the turn: the activity, then an answered exchange (its question, its answer), a figure, an older message, and round
    function order() {
      var out = [], ex = (pool.ex || []).slice(), old = (pool.old || []).slice(), data = (pool.data || []).slice();
      var rounds = Math.max(ex.length, old.length, data.length, 1);
      for (var r = 0; r < rounds; r++) {
        if (r % 2 === 0 && pool.now) out.push(pool.now);
        if (ex[r]) { out.push(ex[r][0]); out.push(ex[r][1]); }
        if (data[r]) out.push(data[r]);
        if (old[r]) out.push(old[r]);
      }
      return out;
    }
    var seq = order(), at = Math.max(0, seq.indexOf(pool.now)), ticking = null;
    function words(it) {                                         // an item's words now: from the header where they are live
      if (!it.live) return it.text;
      var v = text(it.live);
      if (it.live === 'tk-hab' && (!v || NO_READING.indexOf(v) >= 0)) return '';
      if (it.live === 'tk-count') return v ? v + (it.after ? ' ' + it.after : '') : it.text;
      return v || it.text;
    }
    function show(it) {
      var meta = item.querySelector('.hab-line-meta'), body = item.querySelector('.hab-line-text');
      clearInterval(ticking); ticking = null;
      var put = function () { meta.textContent = it.meta || ''; body.textContent = words(it); item.classList.toggle('is-crew', !!it.crew); };
      item.classList.add('is-out'); setTimeout(function () { put(); item.classList.remove('is-out'); }, calm ? 250 : 350);
      if (it.live === 'tk-count') ticking = setInterval(function () { body.textContent = words(it); }, 1000);
    }
    function next() {
      if (document.hidden || !seen || !seq.length) return;
      for (var k = 0; k < seq.length; k++) {                     // the next item with something to say, and not in the sky
        at = (at + 1) % seq.length;
        var it = seq[at];
        if (it.id != null && it.id === window.MCS_SKY_NOW) continue;
        if (!words(it)) continue;
        show(it); return;
      }
    }
    if ('IntersectionObserver' in window) new IntersectionObserver(function (es) { seen = es[es.length - 1].isIntersecting; }).observe(line);
    setInterval(next, EVERY_LINE);
  })();

  /* ------------------------------------------------------------ the sheet under the habitat (sky.js, habitatSheet) */
  // Its glow stands behind the dome — centred on it, as wide as it, ending at its ground line — wherever the layout puts
  // the dome; and the orange line stands on the day of the run, moved on at midnight. The dome's box is read off its
  // shell: its left and right are the ends of the ground line, its top the crown, the ground line one radius below it.
  (function () {
    var seq = document.getElementById('dome-seq'), shell = seq && document.querySelector('#habitat-dome .dome-shell');
    if (!seq || !shell) return;
    function fit() {
      var s = seq.getBoundingClientRect(), d = shell.getBoundingClientRect();
      if (!s.width || !d.width) return;
      var r = d.width / 2;
      seq.style.setProperty('--orb-x', Math.round(d.left - s.left + r) + 'px');
      seq.style.setProperty('--orb-base', Math.round(d.top - s.top + r) + 'px');
      seq.style.setProperty('--orb-r', Math.round(r) + 'px');
    }
    fit();
    if (window.ResizeObserver) new ResizeObserver(fit).observe(seq.parentNode); else window.addEventListener('resize', fit);
    window.addEventListener('load', fit);
    var head = seq.querySelector('.seq-head');
    var sky0 = document.getElementById('dome-sky');
    var tz = (sky0 && sky0.getAttribute('data-tz')) || 'Europe/Berlin', start = (sky0 && sky0.getAttribute('data-start')) || '';
    var days = Number(sky0 && sky0.getAttribute('data-days')) || 13;
    if (!head || !start) return;
    function move() {                                                  // the day's line: on the day, moved on at midnight
      var o = {};
      try {
        new Intl.DateTimeFormat('en-GB', { timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit' })
          .formatToParts(new Date()).forEach(function (p) { o[p.type] = p.value; });
      } catch (e) { return; }
      var n = Math.round((Date.parse(o.year + '-' + o.month + '-' + o.day + 'T12:00:00Z') - Date.parse(start + 'T12:00:00Z')) / 864e5) + 1;
      if (n < 1 || n > days) return;                                   // the page turns over when the run begins or ends (the ticker)
      head.style.setProperty('--day', n);
      [].forEach.call(seq.querySelectorAll('.seq-n'), function (x, i) { x.classList.toggle('is-now', i + 1 === n); });
    }
    setInterval(move, 60000);
  })();

  /* ------------------------------------------------------------ the signal in transit (landing.js, the second step)
     The dot crosses from Earth to Mars in the time the station takes to carry a message across (TRANSIT_SECONDS), then
     starts again, the way it has come lit behind it. The page moves it itself, a little every frame, rather than leaving
     it to the stylesheet's animation, which a phone can hold still (the setting for less motion, a saver mode) — the dot
     is what says the signal is on its way. It moves only while it can be seen. */
  (function () {
    var tr = document.querySelector('.steps .transit'), dot = tr && tr.querySelector('.transit-track i'), track = dot && dot.parentNode;
    if (!dot || !window.requestAnimationFrame) return;
    var secs = Math.max(2, Number(tr.getAttribute('data-seconds')) || 12), t0 = 0, raf = 0, seen = false;
    document.documentElement.classList.add('transit-js');           // sheet.css stops the stylesheet's own animation then
    function frame(ts) {
      if (!t0) t0 = ts;
      var p = ((ts - t0) / 1000 % secs) / secs, w = track.clientWidth - dot.offsetWidth;
      dot.style.transform = 'translateX(' + (p * Math.max(0, w)).toFixed(1) + 'px)';
      track.style.setProperty('--p', p.toFixed(4));                   // the way it has come, drawn behind it (sheet.css)
      raf = seen && !document.hidden ? requestAnimationFrame(frame) : 0;
    }
    function run() { if (seen && !document.hidden && !raf) raf = requestAnimationFrame(frame); }
    if ('IntersectionObserver' in window) new IntersectionObserver(function (es) { seen = es[es.length - 1].isIntersecting; run(); }).observe(track);
    else { seen = true; run(); }
    document.addEventListener('visibilitychange', run);
  })();

  /* ------------------------------------------------------------ the pages of the scroll, on a phone (sheet.css)
     A phone held upright goes from one page of the landing to the next with a swipe — the habitat, the name and the note,
     the mission, the chat, the foot. The room a page has is the screen between the header and the bar of keys with the
     browser's own bars folded away, as they are once the page is scrolled (100lvh) — so that nothing changes while they
     fold and unfold. A page that does not fit that room as it is drawn is set a little closer (is-snug); one that still
     does not (a small phone, a long language, the chat's three steps) is marked tall, and then its parts are stops of the
     scroll as well, so nothing on it is ever passed over. */
  (function () {
    var pages = document.querySelectorAll('body.landing:not(.inner) [data-page]');
    if (!pages.length || !window.matchMedia) return;
    var mq = window.matchMedia('(max-width: 760px) and (min-height: 521px)');
    var probe = document.createElement('div');                       // as tall as the screen with the browser's bars folded
    probe.setAttribute('aria-hidden', 'true');
    probe.style.cssText = 'position:absolute;left:0;top:0;width:1px;height:100vh;visibility:hidden;pointer-events:none';
    probe.style.height = '100lvh';                                      // where the unit is known; 100vh stays where it is not
    document.body.appendChild(probe);
    function own(p) { var m = p.style.minHeight; p.style.minHeight = '0px'; var h = p.offsetHeight; p.style.minHeight = m; return h; }
    function mark() {
      var top = document.querySelector('.ticker'), bar = document.querySelector('.tabbar');
      var room = Math.max(window.innerHeight, probe.offsetHeight) - (top ? top.offsetHeight : 0)
        - (bar && getComputedStyle(bar).display !== 'none' ? bar.offsetHeight : 0);
      [].forEach.call(pages, function (p) {
        p.classList.remove('is-snug', 'is-tall');
        if (!mq.matches || own(p) <= room + 2) return;
        p.classList.add('is-snug');
        if (own(p) > room + 2) p.classList.add('is-tall');
      });
    }
    // The stops of the scroll are wherever the stylesheet has the scroll stop, read off it, and the end. Two closer than a
    // flick of the thumb (the last step of the chat and the end, often) would make a swipe that hardly moves: the part's
    // stop gives way (no-stop).
    var CAND = 'body.landing:not(.inner) :is([data-page], .note-card, .chapter, .steps, .step, .foot)';
    var PART = 'body.landing:not(.inner) [data-page] :is(.note-card, .chapter, .steps, .step)';
    function marks() {
      var cs = getComputedStyle(document.documentElement), h = window.innerHeight;
      var pt = parseFloat(cs.scrollPaddingTop) || 0, pb = parseFloat(cs.scrollPaddingBottom) || 0;
      var max = document.documentElement.scrollHeight - h, out = [{ el: null, y: 0 }, { el: null, y: max }];
      [].forEach.call(document.querySelectorAll(CAND), function (e) {
        var a = getComputedStyle(e).scrollSnapAlign;
        if (!a || a === 'none') return;
        var r = e.getBoundingClientRect(), y = /end/.test(a) ? r.bottom + window.scrollY - (h - pb) : r.top + window.scrollY - pt;
        out.push({ el: e, y: Math.max(0, Math.min(max, Math.round(y))) });
      });
      return out.sort(function (a, b) { return a.y - b.y; });
    }
    function stops() { return marks().map(function (m) { return m.y; }); }
    function thin() {
      [].forEach.call(document.querySelectorAll(PART.replace(/\)$/, ').no-stop')), function (e) { e.classList.remove('no-stop'); });
      if (!mq.matches) return;
      var m = marks(), i, part = function (x) { return x.el && x.el.matches(PART); };
      for (i = 0; i + 1 < m.length; i++) {
        if (m[i + 1].y - m[i].y >= 100) continue;
        if (part(m[i])) m[i].el.classList.add('no-stop'); else if (part(m[i + 1])) m[i + 1].el.classList.add('no-stop');
      }
    }
    function again() { mark(); thin(); }
    again();
    window.addEventListener('resize', again);
    window.addEventListener('load', again);
    if (mq.addEventListener) mq.addEventListener('change', again);
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(again);

    // A mouse wheel or a touchpad on a window as narrow as a phone: one stop a turn, in the turn's direction — left to
    // itself the browser takes a turn shorter than half a page back to where it began. A stroke on a touchpad and the
    // glide after it are one turn.
    var calm = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    function scrollsItself(el, dy) {                                  // something on the page with a scroll of its own, not at its end
      for (; el && el.nodeType === 1 && el !== document.body && el !== document.documentElement; el = el.parentElement) {
        var o = getComputedStyle(el).overflowY;
        if ((o === 'auto' || o === 'scroll') && el.scrollHeight > el.clientHeight + 1
          && (dy > 0 ? el.scrollTop + el.clientHeight < el.scrollHeight - 1 : el.scrollTop > 0)) return true;
      }
      return false;
    }
    var turn = 0, spent = false, sum = 0;
    window.addEventListener('wheel', function (e) {
      if (!mq.matches || e.ctrlKey || Math.abs(e.deltaY) <= Math.abs(e.deltaX)) return;
      if (document.querySelector('body.landing dialog[open]') || scrollsItself(e.target, e.deltaY)) return;
      e.preventDefault();
      var now = Date.now();
      if (now - turn > 250) { spent = false; sum = 0; }              // a new turn of the wheel, a new stroke on the pad
      turn = now;
      if (spent) return;                                              // the rest of the turn moves nothing more
      sum += e.deltaY * (e.deltaMode === 1 ? 16 : e.deltaMode === 2 ? window.innerHeight : 1);
      if (Math.abs(sum) < 24) return;
      spent = true;
      var y = window.scrollY, list = stops(), to = null, i;
      if (sum > 0) { for (i = 0; i < list.length; i++) if (list[i] > y + 2) { to = list[i]; break; } }
      else { for (i = list.length - 1; i >= 0; i--) if (list[i] < y - 2) { to = list[i]; break; } }
      if (to !== null) window.scrollTo({ top: to, behavior: calm ? 'auto' : 'smooth' });
    }, { passive: false });
  })();

  var sky = document.getElementById('dome-sky');
  var panel = sky && sky.closest ? sky.closest('.dome-panel') : null;
  var stage = panel && panel.querySelector('.dome-stage');
  if (!sky || !panel || !stage) return;

  var model = { msgs: [], pics: [] };
  try { var d0 = JSON.parse((document.getElementById('dome-sky-data') || {}).textContent || '{}'); if (d0 && d0.msgs) model = d0; } catch (e) { /* an empty sky */ }
  var num = function (a, dflt) { var v = Number(sky.getAttribute(a)); return v > 0 ? v : dflt; };
  var tz = sky.getAttribute('data-tz') || 'Europe/Berlin', start = sky.getAttribute('data-start') || '', days = num('data-days', 13);
  var EXCHANGES = num('data-exchanges', 4), PICTURES = num('data-pictures', 5), CLIP = num('data-clip', 90);
  var upright = window.matchMedia ? window.matchMedia('(max-width: 760px) and (min-height: 521px)') : null;
  var desk = window.matchMedia ? window.matchMedia('(min-width: 761px) and (min-height: 521px)') : null;
  var shown = function () { return getComputedStyle(sky).display !== 'none'; };   // aura.css decides where there is a sky
  var phone = function () { return !!(upright && upright.matches); };

  // How long a line and a snapshot stay — fading in over FADE, standing, fading out over FADE — and how often the next one
  // is asked for (a turn with no free place passes).
  var FADE = 1200, LIFE_MSG = 6800, LIFE_PIC = 8800, EVERY_MSG = 3400, EVERY_PIC = 3600;
  // Their sizes on the grid: a snapshot as wide as a whole number of the sheet's columns (a column to a sol), a line as
  // wide as its words need, up to a number of columns — both start on a column's line, a few pixels in.
  var SIZE = { phone: { pic: 5, line: 9 }, desk: { pic: 2, line: 4 } };
  var INSET = 4, GAP = 16, EDGE = 6;               // in from a column's line; the room kept around each; from the sky's edges
  var PIC_RATIO = 1.6;

  /* ------------------------------------------------------------ times, in the venue's clock */
  var pad = function (n) { return (n < 10 ? '0' : '') + n; };
  function parts(d) {
    var o = {};
    try {
      new Intl.DateTimeFormat('en-GB', { timeZone: tz, hour12: false, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' })
        .formatToParts(d).forEach(function (p) { o[p.type] = p.value; });
    } catch (e) { return null; }
    return { date: o.year + '-' + o.month + '-' + o.day, hm: (o.hour === '24' ? '00' : o.hour) + ':' + o.minute };
  }
  function sol(date) {                                             // 'YYYY-MM-DD' → the day of the run, or 0 outside it
    if (!start) return 0;
    var n = Math.round((Date.parse(date + 'T12:00:00Z') - Date.parse(start + 'T12:00:00Z')) / 864e5) + 1;
    return n >= 1 && n <= days ? n : 0;
  }
  // a line's time: the clock alone today; on an earlier day the sol before it (or the date, outside the run)
  function lineStamp(iso) {
    var d = new Date(iso); if (isNaN(d.getTime())) return '';
    var p = parts(d), now = parts(new Date()); if (!p) return '';
    if (now && p.date === now.date) return p.hm;
    var n = sol(p.date);
    return (n ? 'SOL ' + pad(n) : p.date.slice(8, 10) + '.' + p.date.slice(5, 7)) + ' · ' + p.hm;
  }
  // a snapshot's time: the moment it was taken as the picture's own name writes it (greenhouse_2026_09_25-16-41.jpg →
  // "25.09.2026 · 16:41"), as the gallery shows it
  function picStamp(when) { return when || ''; }
  var clip = function (t) { t = String(t || '').replace(/\s+/g, ' ').trim(); return t.length > CLIP ? t.slice(0, CLIP - 1).replace(/\s+$/, '') + '…' : t; };

  /* ------------------------------------------------------------ the snapshots, loaded before they are shown */
  var loaded = {};
  function preload() {
    model.pics.forEach(function (p) {
      if (loaded[p.id] || !p.thumb) return;
      var im = new Image(); im.decoding = 'async'; im.alt = ''; im.src = p.thumb; loaded[p.id] = im;
    });
  }
  function ready(p) { var im = loaded[p.id]; return !!(im && im.complete && im.naturalWidth); }

  /* ------------------------------------------------------------ placing: on the grid, clear of everything */
  // Where the next one comes is picked afresh among the places free: on a column's line, inside the sky, outside the dome
  // (its circle and a margin — the keys and their names are inside it), clear of every snapshot and line still there
  // (while it fades out too) and of the sheet's own small figure, and away from where the last few were. No place free:
  // the turn passes. Nothing moves: each fades in, stands, and fades out.
  var held = [], lately = [];
  function box(el) { var r = el.getBoundingClientRect(), k = sky.getBoundingClientRect(); return { x: r.left - k.left, y: r.top - k.top, w: r.width, h: r.height }; }
  function dome() {                                                // the dome's circle, in the sky's own coordinates
    var shell = panel.querySelector('.dome-shell'); if (!shell) return null;
    var d = shell.getBoundingClientRect(), k = sky.getBoundingClientRect(), r = d.width / 2;
    return r ? { cx: d.left - k.left + r, cy: d.top - k.top + r, r: r } : null;
  }
  function figures() { return [].map.call(document.querySelectorAll('#dome-seq .seq-fig'), box).filter(function (b) { return b.w && b.h; }); }
  function clash(a, b) { return a.x < b.x + b.w + GAP && b.x < a.x + a.w + GAP && a.y < b.y + b.h + GAP && b.y < a.y + a.h + GAP; }
  function inDome(a, c) {                                          // does the box come within the margin of the dome's circle?
    if (!c) return false;
    var nx = Math.max(a.x, Math.min(c.cx, a.x + a.w)), ny = Math.max(a.y, Math.min(c.cy, a.y + a.h));
    var dx = c.cx - nx, dy = c.cy - ny, m = c.r + GAP;
    return dx * dx + dy * dy < m * m;
  }
  function shuffle(a) { for (var i = a.length - 1; i > 0; i--) { var j = Math.floor(Math.random() * (i + 1)), t = a[i]; a[i] = a[j]; a[j] = t; } return a; }
  function spot(w, h) {
    var W = sky.clientWidth, H = sky.clientHeight, col = W / days, now = Date.now();
    held = held.filter(function (b) { return b.until > now; });
    var busy = held.concat(figures()), c = dome(), tries = [], ci, y;
    for (ci = 0; ci * col + INSET + w <= W - EDGE + 0.5; ci++) for (y = EDGE; y + h <= H - EDGE; y += 8) tries.push({ x: Math.round(ci * col + INSET), y: y, w: w, h: h });
    shuffle(tries);
    var far = function (t) { return lately.every(function (p) { return Math.abs(p.x - t.x) + Math.abs(p.y - t.y) > col * 3; }); };
    var ok = function (t) { return !inDome(t, c) && busy.every(function (b) { return !clash(t, b); }); };
    var i, best = null;
    for (i = 0; i < tries.length; i++) { if (ok(tries[i])) { if (far(tries[i])) return tries[i]; if (!best) best = tries[i]; } }
    return best;                                                   // somewhere free, if not somewhere new
  }
  function show(el, at, life) {
    el.style.left = at.x + 'px'; el.style.top = at.y + 'px';
    held.push({ x: at.x, y: at.y, w: at.w, h: at.h, until: Date.now() + life + 200 });
    lately.push({ x: at.x, y: at.y }); if (lately.length > 4) lately.shift();
    requestAnimationFrame(function () { requestAnimationFrame(function () { el.classList.add('is-on'); }); });
    setTimeout(function () { el.classList.remove('is-on'); }, life - FADE);
    setTimeout(function () { if (el.parentNode) el.parentNode.removeChild(el); }, life + 150);
  }
  var n = { msg: 0, pic: 0 };
  function size() { return phone() ? SIZE.phone : SIZE.desk; }
  function nextLine() {
    if (!model.msgs.length) return;
    var m = model.msgs[n.msg % model.msgs.length];
    var el = document.createElement('div'); el.className = 'sky-msg ' + (m.k === 'a' ? 'is-crew' : 'is-earth');
    var who = document.createElement('span'); who.className = 'sky-who';
    var st = lineStamp(m.at); who.textContent = (m.k === 'a' ? '✧ ' : '') + m.who + (st ? ' · ' + st : '');
    var tx = document.createElement('span'); tx.className = 'sky-text'; tx.textContent = m.text;
    el.appendChild(who); el.appendChild(tx);
    var col = sky.clientWidth / days;
    el.style.maxWidth = Math.floor(size().line * col - 2 * INSET) + 'px'; el.style.left = '0px'; el.style.top = '0px';
    sky.appendChild(el);                                           // measured where it cannot be seen (it is not on yet)
    var at = spot(Math.ceil(el.offsetWidth), Math.ceil(el.offsetHeight));
    if (!at) { sky.removeChild(el); return; }                      // no room this turn: the next line tries again
    n.msg++;
    window.MCS_SKY_NOW = m.id != null ? m.id : null;                // the line under the dome passes over this exchange meanwhile
    show(el, at, LIFE_MSG);
  }
  function nextPicture() {
    var ok = model.pics.filter(ready); if (!ok.length) return;
    var p = ok[n.pic % ok.length];
    var col = sky.clientWidth / days, w = Math.floor(size().pic * col - 2 * INSET), ph = Math.round(w / PIC_RATIO);
    var st = picStamp(p.when), sh = st ? 18 : 0;                   // its time over it, inside its place on the grid
    var at = spot(w, ph + sh);
    if (!at) return;
    n.pic++;
    var a = document.createElement('a'); a.className = 'sky-pic'; a.href = p.url; a.target = '_blank'; a.rel = 'noopener'; a.tabIndex = -1;
    a.style.width = w + 'px'; a.style.height = (ph + sh) + 'px';
    var fr = document.createElement('span'); fr.className = 'sky-frame';
    var im = loaded[p.id].cloneNode(); im.alt = ''; fr.appendChild(im);
    if (st) { var s = document.createElement('span'); s.className = 'sky-when'; s.textContent = st; a.appendChild(s); }
    a.appendChild(fr);
    sky.appendChild(a); show(a, at, LIFE_PIC);
  }

  /* ------------------------------------------------------------ running only while it can be seen */
  var timers = [], running = false, inView = true;
  function stop() { timers.forEach(function (t) { clearInterval(t); clearTimeout(t); }); timers = []; running = false; }
  function go() {
    stop(); running = true;
    // with only a few, each comes round no sooner than it has gone — never the same one twice at once
    var em = Math.max(EVERY_MSG, Math.ceil((LIFE_MSG + 300) / Math.max(1, model.msgs.length)));
    var ep = Math.max(EVERY_PIC, Math.ceil((LIFE_PIC + 300) / Math.max(1, model.pics.length)));
    if (model.msgs.length) { timers.push(setTimeout(nextLine, 400)); timers.push(setInterval(nextLine, em)); }
    if (model.pics.length) { timers.push(setTimeout(nextPicture, 1300)); timers.push(setInterval(nextPicture, ep)); }
  }
  function any() { return !!(model.msgs.length || model.pics.length); }
  function check() {
    panel.classList.toggle('has-sky', any());
    var want = any() && shown() && inView && !document.hidden;
    if (want && !running) { preload(); go(); } else if (!want && running) stop();
  }
  function renew() { if (running) go(); else check(); }

  if ('IntersectionObserver' in window) {
    new IntersectionObserver(function (es) { inView = es[es.length - 1].isIntersecting; check(); }).observe(panel);
  }
  document.addEventListener('visibilitychange', check);
  [upright, desk].forEach(function (mq) { if (!mq) return; if (mq.addEventListener) mq.addEventListener('change', check); else if (mq.addListener) mq.addListener(check); });
  check();

  /* ------------------------------------------------------------ new exchanges, when the dome says there are */
  function fromCards(html) {
    var tpl = document.createElement('template'); tpl.innerHTML = html || '';
    var rows = [].slice.call(tpl.content.querySelectorAll('article.card')).filter(function (c) { return !c.hasAttribute('data-pending'); }).map(function (c) {
      var sent = c.querySelector('.card-meta time'), cs = c.querySelector('.card-meta .cs'), body = c.querySelector('.card-body');
      var rp = c.querySelector('.card-reply p'), rm = c.querySelector('.card-reply-meta'), rt = rm && rm.querySelector('time');
      return {
        id: /^m\d+$/.test(c.id || '') ? Number(c.id.slice(1)) : null,
        at: sent ? sent.getAttribute('datetime') || '' : '', who: cs ? cs.textContent : '', text: body ? body.textContent : '',
        reply: rp ? rp.textContent : '', rwho: rm ? (rm.textContent.split(' · ')[0] || '').trim() : '', rat: rt ? rt.getAttribute('datetime') || '' : ''
      };
    });
    rows.sort(function (a, b) { return a.at < b.at ? 1 : a.at > b.at ? -1 : 0; });   // the newest first, as the page drew them
    var out = [];
    rows.slice(0, EXCHANGES).forEach(function (r) {
      out.push({ k: 'q', id: r.id, who: r.who, at: r.at, text: clip(r.text) });
      if (r.reply) out.push({ k: 'a', id: r.id, who: r.rwho, at: r.rat, text: clip(r.reply) });
    });
    return out;
  }
  var latest = document.querySelector('[data-field="comms-text"]'), asking = false;
  if (latest && window.MutationObserver && window.fetch) {
    new MutationObserver(function () {
      if (asking) return; asking = true;
      fetch('/api/board', { cache: 'no-store', credentials: 'same-origin' })
        .then(function (r) { return r.ok ? r.json() : null; })
        .then(function (d) { if (d && typeof d.cards === 'string') { model.msgs = fromCards(d.cards); renew(); } })
        .catch(function () { /* the sky keeps what it has */ })
        .then(function () { asking = false; });
    }).observe(latest, { childList: true, characterData: true, subtree: true });
  }

  /* ------------------------------------------------------------ new pictures, as the Habitat panel's strip changes */
  var strip = document.getElementById('cloud-latest'), soon = null;
  if (strip && window.MutationObserver) {
    new MutationObserver(function () {
      clearTimeout(soon);
      soon = setTimeout(function () {
        model.pics = [].slice.call(strip.querySelectorAll('.mtile')).filter(function (t) { return !t.classList.contains('is-leaving'); }).slice(0, PICTURES).map(function (t) {
          var im = t.querySelector('img'), w = t.querySelector('.mtile-when');
          return { id: t.getAttribute('data-id') || '', url: t.getAttribute('href') || '', thumb: im ? im.getAttribute('src') || '' : '', when: w ? w.textContent : '' };
        }).filter(function (p) { return p.id && p.thumb; });
        preload(); renew();
      }, 400);
    }).observe(strip, { childList: true, subtree: true });
  }
})();
