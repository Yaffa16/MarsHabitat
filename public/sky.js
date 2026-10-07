/* MARS!platz — the sky of the first page (src/views/pages/sky.js draws it and its first lines, landing.js the page:
 * the Earth at the foot, the habitat far above, the dashed line between them; sheet.css shows it on a phone and on a
 * desk alike).
 *
 * The first screen: on either side of the line, close to it, between the habitat and the Earth, the latest exchanges
 * with Earth fade in and out — each one block, its QUESTION under the visitor's callsign and its ANSWER under ✧ and the
 * officer, one or two of them at a time — and the newest pictures from the cloud folder appear as snapshots, one or two
 * at a time, and fade again. Each comes somewhere else each time, clear of the Earth, the habitat and the line (the page
 * marks them: data-sky-round, data-sky-solid) and of everything else in the sky: nothing is ever drawn over anything
 * else. What it shows comes with
 * the page (the JSON block in the sky); what it learns later it takes from what the page already fetches, never polling
 * on its own:
 *  - the dome's own refresh (/api/dome, every 20 s, dome.js) rewrites the communication pop-up's latest-exchange line
 *    when there is a new exchange — only then is the board asked for (/api/board) and its published cards read, the way
 *    the board itself shows them (a message still waiting for mission control is never among them);
 *  - public/cloud.js keeps the Habitat panel's strip of newest pictures (#cloud-latest) in line with the folder, and the
 *    snapshots follow the strip.
 * A touch on a snapshot or an exchange brings a note beside it saying what it is (the live feed from the habitat; the
 * latest communication from it) with the way to the whole of it; what was touched stays while the note stands.
 * It runs only while it can be seen — the page in front, the first page on the screen — and stops otherwise. With
 * nothing to show there is no sky (has-sky marks the room while there is one). A phone set to reduce motion sees the
 * lines and snapshots come and go by fading alone (aura.css). Nothing here is ever sent anywhere. The sizes are the
 * phone's or the desk's, whichever layout is showing — a window resized across the line takes the other set from the
 * next line or snapshot on.
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

  /* ------------------------------------------------------------ the nudge under the dome (landing.js, scrollNudge)
     The arrow on the floor under the ground line bobs until the page is scrolled, and is gone from then on; back at the
     top it returns. It is a link to the next page as well, so a press on it scrolls there. */
  (function () {
    var nudge = document.getElementById('dome-nudge'); if (!nudge) return;
    var gone = false;
    function look() {
      var g = (window.scrollY || document.documentElement.scrollTop || 0) > 80;
      if (g === gone) return;
      gone = g; nudge.classList.toggle('is-gone', g);
    }
    window.addEventListener('scroll', look, { passive: true });
    look();
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
     A phone held upright goes from one page of the landing to the next with a swipe — the words and the room under them,
     the room whole, the two calls, the chat, the foot. The room a page has is the screen between the header and the bar of keys with the
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
    var CAND = 'body.landing:not(.inner) :is([data-page], .space-room, .call, .steps, .step, .foot)';   // the room is a stop under the first page's words (sheet.css)
    var PART = 'body.landing:not(.inner) [data-page] :is(.call, .steps, .step)';
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
  var panel = sky && sky.closest ? sky.closest('.space-room, .dome-panel') : null;   // the room the sky is in: the first page's
  if (!sky || !panel) return;

  var model = { ex: [], pics: [] };
  try { var d0 = JSON.parse((document.getElementById('dome-sky-data') || {}).textContent || '{}'); if (d0 && d0.ex) model = d0; } catch (e) { /* an empty sky */ }
  var num = function (a, dflt) { var v = Number(sky.getAttribute(a)); return v > 0 ? v : dflt; };
  var tz = sky.getAttribute('data-tz') || 'Europe/Berlin', start = sky.getAttribute('data-start') || '', days = num('data-days', 13);
  var EXCHANGES = num('data-exchanges', 6), PICTURES = num('data-pictures', 5), AT_ONCE = num('data-at-once', 3), CLIP = num('data-clip', 90);
  var WORD = { q: sky.getAttribute('data-q') || 'Question', a: sky.getAttribute('data-a') || 'Answer' };   // in the page's language
  var HEAD = { msg: sky.getAttribute('data-latest-msg') || 'Latest message:', pic: sky.getAttribute('data-latest-pic') || 'Latest image' };   // the items' heads (October)
  var upright = window.matchMedia ? window.matchMedia('(max-width: 760px) and (min-height: 521px)') : null;
  var desk = window.matchMedia ? window.matchMedia('(min-width: 761px) and (min-height: 521px)') : null;
  var shown = function () { return getComputedStyle(sky).display !== 'none'; };   // aura.css decides where there is a sky
  var phone = function () { return !!(upright && upright.matches); };

  // How long an exchange and a snapshot stay — fading in over FADE, standing, fading out over FADE, each a little longer
  // or shorter than the last (VARY) so that they never all go at once — and how often the sky is topped up: every TICK
  // it adds one exchange and one snapshot while fewer than AT_ONCE of each are standing, and the moment one begins to
  // fade (AHEAD before, and again as it fades) its successor is brought in, so there is always something in the sky:
  // between one and two of each standing, as long as there are any (a turn with no free place passes).
  var FADE = 1200, LIFE_MSG = 10000, LIFE_PIC = 9000, TICK = 1200, VARY = 0.3, AHEAD = 700;
  // Their sizes: a snapshot's width, and the width an exchange may take for its words — on a phone as wide as the room
  // beside the line allows (LANE, below), on a desk a fixed width.
  var SIZE = { phone: { pic: 176, line: 184 }, desk: { pic: 136, line: 300 } };   // a desk's are small, to stand beside the line
  var GAP = 16, EDGE = 6, STEP = 8;                // the room kept around each; from the sky's edges; the grid the places are on
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
  // "25.09.2026 · 16:41"), as the gallery shows it — without the year on a narrow snapshot (a phone's), where the plate
  // would not hold it
  function picStamp(when, w) { when = when || ''; return w && w < 200 ? when.replace(/(\d{2})\.(\d{2})\.\d{4}/, '$1.$2') : when; }
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

  /* ------------------------------------------------------------ the trajectory (a desk; landing.js, trajectory)
     The way a message goes, drawn from where the layout has put the Earth and the habitat: a straight line from the
     Earth's horizon to the habitat's front foot — the horizon is a circle, the picture turned about its centre
     (sheet.css); the launch point is on it, a little up the limb from the radius through the habitat's foot, so the line
     leaves the ground nearly straight up, as a launch does, and runs straight to the habitat — and on from the far side
     of the habitat in the same direction, out of the room (a second line, drawn fading): the drawing's silhouette is
     near enough a circle, and the second line begins where the way leaves it, so no line crosses the habitat. The
     signal, the answer and the one that goes on ride these paths (SMIL, in the markup); the flare stands at the
     habitat's foot. The sky keeps its items off the line and close to it (onWay,
     nearWay, below). Drawn again whenever the room changes size. */
  var arc = panel.querySelector('.space-arc'), way = [];
  function arcShown() { return !!(arc && getComputedStyle(arc).display !== 'none'); }
  function trajectory() {
    way = [];
    if (!arcShown()) return;
    var earth = panel.querySelector('.space-earth'), globe = panel.querySelector('.space-globe'), dome = panel.querySelector('.space-dome');
    var up = arc.querySelector('#arc-up'), on = arc.querySelector('#arc-on'), flare = arc.querySelector('.arc-flare'), grad = arc.querySelector('#arc-fade');
    if (!earth || !globe || !dome || !up || !on) return;
    var W = sky.clientWidth, H = sky.clientHeight;
    var gb = box(globe), C = { x: gb.x + gb.w / 2, y: gb.y + gb.h / 2 }, R = earth.offsetWidth * 997 / 1414;   // the horizon's circle on the screen
    var db = box(dome), F = { x: db.x + db.w / 2, y: db.y + db.h * 0.971 };                                  // the habitat's front foot
    if (!(R > 0) || !db.w) return;
    var a = Math.atan2(F.y - C.y, F.x - C.x) - 10 * Math.PI / 180;                                           // the launch point: on the horizon, a little up the limb from the radius through the foot, so it stands clear of the room's foot
    var S = { x: C.x + R * Math.cos(a), y: C.y + R * Math.sin(a) };
    var tx = F.x - S.x, ty = F.y - S.y, tl = Math.hypot(tx, ty) || 1; tx /= tl; ty /= tl;                   // the way: straight from the launch point to the foot
    // on from the far side of the habitat: the drawing's silhouette is near enough a circle about a point a little
    // below its middle (public/space/habitat.png, measured), cut off at the foot — the second line begins where the way
    // leaves that circle, a little clear of the drawing, and runs straight to where it leaves the room (and a little beyond)
    var cd = { x: db.x + db.w / 2, y: db.y + db.h * 0.73 }, rd = db.w * 0.48;
    var dx = F.x - cd.x, dy = F.y - cd.y, bq = dx * tx + dy * ty, s = -bq + Math.sqrt(Math.max(0, bq * bq - (dx * dx + dy * dy - rd * rd))) + 10;
    var X = { x: F.x + tx * s, y: F.y + ty * s };
    var t = Infinity;
    if (tx > 0) t = Math.min(t, (W + 30 - X.x) / tx); else if (tx < 0) t = Math.min(t, (-30 - X.x) / tx);
    if (ty > 0) t = Math.min(t, (H + 30 - X.y) / ty); else if (ty < 0) t = Math.min(t, (-30 - X.y) / ty);
    if (!isFinite(t) || t < 40) t = 40;
    var E = { x: X.x + tx * t, y: X.y + ty * t };
    var f = function (p) { return p.x.toFixed(1) + ' ' + p.y.toFixed(1); };
    up.setAttribute('d', 'M' + f(S) + ' L' + f(F));
    on.setAttribute('d', 'M' + f(X) + ' L' + f(E));
    if (flare) { flare.setAttribute('cx', F.x.toFixed(1)); flare.setAttribute('cy', F.y.toFixed(1)); }
    if (grad) { grad.setAttribute('x1', X.x.toFixed(1)); grad.setAttribute('y1', X.y.toFixed(1)); grad.setAttribute('x2', E.x.toFixed(1)); grad.setAttribute('y2', E.y.toFixed(1)); }
    var i, n, L = Math.hypot(F.x - S.x, F.y - S.y);
    for (i = 0, n = Math.max(8, Math.round(L / 22)); i <= n; i++) way.push({ x: S.x + (F.x - S.x) * i / n, y: S.y + (F.y - S.y) * i / n });
    for (i = 0, n = Math.max(8, Math.round(t / 22)); i <= n; i++) way.push({ x: X.x + (E.x - X.x) * i / n, y: X.y + (E.y - X.y) * i / n });
  }
  // does the box come within the margin of the line?
  function onWay(a) {
    var m = GAP + 4, i, p;
    for (i = 0; i < way.length; i++) { p = way[i]; if (p.x > a.x - m && p.x < a.x + a.w + m && p.y > a.y - m && p.y < a.y + a.h + m) return true; }
    return false;
  }
  // is the box near the line — within NEAR_WAY of it (its nearest edge), where the sky keeps the exchanges and the pictures?
  var NEAR_WAY = 48;
  function nearWay(a) {
    if (!way.length) return true;
    var m = GAP + NEAR_WAY, i, p;
    for (i = 0; i < way.length; i++) { p = way[i]; if (p.x > a.x - m && p.x < a.x + a.w + m && p.y > a.y - m && p.y < a.y + a.h + m) return true; }
    return false;
  }
  var drawn = null;
  function redraw() { clearTimeout(drawn); drawn = setTimeout(trajectory, 60); }
  if (arc) {
    trajectory();
    window.addEventListener('resize', redraw);
    window.addEventListener('load', redraw);
    if (window.ResizeObserver) new ResizeObserver(redraw).observe(panel);
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(redraw);
    [upright, desk].forEach(function (mq) { if (!mq) return; if (mq.addEventListener) mq.addEventListener('change', redraw); else if (mq.addListener) mq.addListener(redraw); });
  }

  /* ------------------------------------------------------------ placing: in the room, clear of everything */
  // Where the next one comes is picked afresh among the places free: on a grid of a few pixels, in the band between the
  // habitat and the Earth, close to the line — its margin, or a little way out from it — clear of the room's solids (the
  // habitat's drawing and its name, the nudge: data-sky-solid; the Earth's globe and a margin: data-sky-round), of the line
  // (the lanes keep off it), of every snapshot and line still there (while it fades out
  // too), and away from where the last few were. No place free: the turn passes, and the next tick tries again (as
  // one goes, its place comes free) — nothing is ever laid over anything else. Nothing moves: each fades in, stands,
  // and fades out.
  var held = [], lately = [];
  function box(el) { var r = el.getBoundingClientRect(), k = sky.getBoundingClientRect(); return { x: r.left - k.left, y: r.top - k.top, w: r.width, h: r.height }; }
  // the discs, in the sky's own coordinates: a disc's centre is its box's, a half disc's the middle of its box's foot;
  // its radius half the box's width, or the part of it the page gives (data-r — the Earth's air reaches past its globe)
  // (the globe's radius from its laid-out width, not its box: on a desk the Earth is turned about the globe's centre,
  // sheet.css, which leaves the centre where it is and makes the box larger than the globe)
  function rounds() {
    return [].map.call(panel.querySelectorAll('[data-sky-round]'), function (el) {
      var b = box(el), half = el.getAttribute('data-sky-round') === 'half', f = Number(el.getAttribute('data-r')) || 0.5, w = el.offsetWidth || b.w;
      return { cx: b.x + b.w / 2, cy: half ? b.y + b.h : b.y + b.h / 2, r: w * f };
    }).filter(function (c) { return c.r > 0; });
  }
  // (the line itself is kept clear of by the lanes, below, not as a solid)
  function solids() { return [].map.call(panel.querySelectorAll('[data-sky-solid]:not(.space-line)'), box).filter(function (b) { return b.w && b.h; }); }
  function clash(a, b) { return a.x < b.x + b.w + GAP && b.x < a.x + a.w + GAP && a.y < b.y + b.h + GAP && b.y < a.y + a.h + GAP; }
  function inRound(a, c) {                                         // does the box come within the margin of a disc?
    var nx = Math.max(a.x, Math.min(c.cx, a.x + a.w)), ny = Math.max(a.y, Math.min(c.cy, a.y + a.h));
    var dx = c.cx - nx, dy = c.cy - ny, m = c.r + GAP;
    return dx * dx + dy * dy < m * m;
  }
  function clear(a, discs) { return discs.every(function (c) { return !inRound(a, c); }); }
  function shuffle(a) { for (var i = a.length - 1; i > 0; i--) { var j = Math.floor(Math.random() * (i + 1)), t = a[i]; a[i] = a[j]; a[j] = t; } return a; }
  // the two lanes of the room, either side of the line — from the sky's edge (a little in from the sides on a wide
  // screen) to the line's margin (a phone's lanes come closer to the line: they are narrow) — or the whole width
  // where there is no line
  function edge() { return phone() ? EDGE : Math.max(EDGE, Math.round(sky.clientWidth * 0.05)); }
  function lanes() {
    var W = sky.clientWidth, e = edge(), g = phone() ? 10 : GAP, l = panel.querySelector('.space-line'), b = l ? box(l) : null;
    return b && b.w ? [{ a: e, b: b.x - g, line: 'left' }, { a: b.x + b.w + g, b: W - e, line: 'right' }] : [{ a: e, b: W - e }];
  }
  // the room a lane has for a line or a snapshot: a phone's are as wide as its lanes allow
  function lane() { return Math.max(120, Math.floor(Math.min.apply(null, lanes().map(function (l) { return l.b - l.a; })))); }
  // the band of the room the sky is in: between the habitat (its drawing and the name under it) and the Earth (the
  // highest point of what the sky keeps clear of — its horizon and a margin) — never beside the habitat, never on the Earth
  function band() {
    var H = sky.clientHeight, d = panel.querySelector('.space-dome'), b = d ? box(d) : null, top = b && b.h ? b.y + b.h + 26 : EDGE, bottom = H - EDGE;
    if (arcShown()) return { top: EDGE, bottom: H - EDGE };                   // a desk: the whole room — the habitat is a solid, the Earth a disc, the arc is kept off below
    rounds().forEach(function (c) { bottom = Math.min(bottom, c.cy - c.r - GAP); });
    return { top: Math.max(EDGE, Math.round(top)), bottom: Math.round(bottom) };
  }
  var NEAR = { phone: 6, desk: 44 };               // how far from the line's margin a line or a snapshot may stand
  function spot(w, h) {
    var W = sky.clientWidth, H = sky.clientHeight, now = Date.now();
    held = held.filter(function (b) { return b.until > now; });
    var busy = held.concat(solids()), discs = rounds(), tries = [], xs = [], x, y, i, near = phone() ? NEAR.phone : NEAR.desk, bd = band();
    lanes().forEach(function (l) {                                 // the places in a lane: close to the line, a little way out at most
      if (l.line === 'left') { for (x = l.b - w; x >= l.a && x >= l.b - w - near; x -= STEP) xs.push(Math.round(x)); }
      else if (l.line === 'right') { for (x = l.a; x + w <= l.b + 0.5 && x <= l.a + near; x += STEP) xs.push(Math.round(x)); }
      else { for (x = l.a; x + w <= l.b + 0.5; x += STEP) xs.push(Math.round(x)); }
    });
    for (i = 0; i < xs.length; i++) for (y = bd.top; y + h <= bd.bottom; y += STEP) tries.push({ x: xs[i], y: y, w: w, h: h });
    shuffle(tries);
    var far = function (t) { return lately.every(function (p) { return Math.abs(p.x - t.x) + Math.abs(p.y - t.y) > Math.min(W, H) / 3; }); };
    var ok = function (t, list) { return clear(t, discs) && !onWay(t) && nearWay(t) && list.every(function (b) { return !clash(t, b); }); };
    var best = null;
    for (i = 0; i < tries.length; i++) { if (ok(tries[i], busy)) { if (far(tries[i])) return tries[i]; if (!best) best = tries[i]; } }
    if (best) return best;                                         // somewhere free, if not somewhere new
    return null;                                                   // nothing free: the sky waits for a place to come free
  }
  function show(el, at, life) {
    el.style.left = at.x + 'px'; el.style.top = at.y + 'px';
    el.__held = { x: at.x, y: at.y, w: at.w, h: at.h, until: Date.now() + life + 200 };
    held.push(el.__held);
    lately.push({ x: at.x, y: at.y }); if (lately.length > 4) lately.shift();
    requestAnimationFrame(function () { requestAnimationFrame(function () { el.classList.add('is-on'); }); });
    later(el, life);
  }
  // it stands for `life`, then fades and goes — its place kept that long, though marked as going once it fades — and
  // as it begins to fade its successor is brought in, so the sky is never left empty between one and the next
  function later(el, life) {
    clearTimeout(el.__fade); clearTimeout(el.__gone); clearTimeout(el.__next);
    if (el.__held) el.__held.until = Date.now() + life + 200;
    var kind = el.classList.contains('sky-pic') ? 'pic' : 'msg';
    el.__next = setTimeout(function () { refill(kind); }, Math.max(0, life - FADE - AHEAD));   // the successor, a little before this one fades
    el.__fade = setTimeout(function () {
      el.classList.remove('is-on');                                // its place stays its own until it is gone
      refill(kind);
    }, Math.max(0, life - FADE));
    el.__gone = setTimeout(function () { if (el.parentNode) el.parentNode.removeChild(el); }, life + 150);
  }
  // a little longer or shorter each time, so that what came in together does not go out together
  function vary(life) { return Math.round(life * (1 - VARY / 2 + Math.random() * VARY)); }
  // it stays as it is, and keeps its place, until it is let go (a note stands beside it: below)
  function stay(el) { clearTimeout(el.__fade); clearTimeout(el.__gone); clearTimeout(el.__next); el.classList.add('is-on'); if (el.__held) el.__held.until = Infinity; }
  var n = { msg: 0, pic: 0 };
  // a phone's line or snapshot is as wide as the room beside the line allows, up to its size; a desk's has its size
  function size() { var s = phone() ? SIZE.phone : SIZE.desk, l = lane(); return { pic: Math.min(s.pic, l), line: Math.min(s.line, l) }; }
  // what is standing in the sky now — one fading out no longer counts, so its successor can come as it goes — so that
  // no more than AT_ONCE of each kind are, and never the same exchange or picture twice at once
  function onSky(cls) { return [].slice.call(sky.querySelectorAll('.' + cls + '.is-on')); }
  function onIds(cls) { return onSky(cls).map(function (e) { return e.getAttribute('data-id') || ''; }); }
  // one part of an exchange: QUESTION or ANSWER, who and when in small type, the words beneath (a phone's lane is too
  // narrow for the time on the plate, and for the officer on the answer's — the crew's mark stands for them; the board
  // has it all)
  function part(kind, who, at, text) {
    var d = document.createElement('div'); d.className = 'sky-part ' + (kind === 'a' ? 'is-crew' : 'is-earth');
    var w = document.createElement('span'); w.className = 'sky-who';
    var k = document.createElement('b'); k.className = 'sky-k'; k.textContent = WORD[kind]; w.appendChild(k);
    var st = phone() ? '' : lineStamp(at), by = kind === 'a' ? '✧ ' + (phone() ? '' : who) : who;
    w.appendChild(document.createTextNode(' · ' + by.replace(/\s+$/, '') + (st ? ' · ' + st : '')));
    var tx = document.createElement('span'); tx.className = 'sky-text'; tx.textContent = text;
    d.appendChild(w); d.appendChild(tx);
    return d;
  }
  function nextExchange() {
    if (!model.ex.length || onSky('sky-msg').length >= Math.min(AT_ONCE, model.ex.length)) return;
    var there = onIds('sky-msg'), m = null, i;
    for (i = 0; i < model.ex.length; i++) {                        // the next one round that is not in the sky already
      var c = model.ex[(n.msg + i) % model.ex.length];
      if (there.indexOf(String(c.id)) < 0) { m = c; n.msg = (n.msg + i + 1) % model.ex.length; break; }
    }
    if (!m) return;
    var el = document.createElement('div'); el.className = 'sky-msg ' + (m.reply ? 'is-crew' : 'is-earth'); el.setAttribute('data-id', String(m.id));
    var hd = document.createElement('span'); hd.className = 'sky-head'; hd.textContent = HEAD.msg; el.appendChild(hd);   // LATEST MESSAGE: over the exchange
    el.appendChild(part('q', m.who, m.at, m.text));
    if (m.reply) el.appendChild(part('a', m.rwho, m.rat, m.reply));
    el.style.maxWidth = size().line + 'px'; el.style.left = '0px'; el.style.top = '0px';
    sky.appendChild(el);                                           // measured where it cannot be seen (it is not on yet)
    var at = spot(Math.ceil(el.offsetWidth), Math.ceil(el.offsetHeight));
    if (!at) { sky.removeChild(el); return; }                      // no room this turn: the next tick tries again
    window.MCS_SKY_NOW = m.id != null ? m.id : null;
    show(el, at, vary(LIFE_MSG));
  }
  function nextPicture() {
    var ok = model.pics.filter(ready); if (!ok.length) return;
    if (onSky('sky-pic').length >= Math.min(AT_ONCE, ok.length)) return;
    var there = onIds('sky-pic'), p = null, i;
    for (i = 0; i < ok.length; i++) { var c = ok[(n.pic + i) % ok.length]; if (there.indexOf(String(c.id)) < 0) { p = c; n.pic = (n.pic + i + 1) % ok.length; break; } }
    if (!p) return;
    var w = size().pic;
    // its frame: the brackets' padding around the picture, and its plate — LATEST IMAGE — with the gap under it
    // (sheet.css); the moment the picture was taken stands at the foot of the frame, over the picture
    var PAD = 6, PLATE = 21, st = picStamp(p.when, w);
    var ph = Math.round((w - 2 * PAD) / PIC_RATIO), h = ph + 2 * PAD + PLATE;
    var at = spot(w, h);
    if (!at) return;
    var a = document.createElement('a'); a.className = 'sky-pic'; a.href = p.url; a.target = '_blank'; a.rel = 'noopener'; a.tabIndex = -1; a.setAttribute('data-id', String(p.id));
    a.style.width = w + 'px'; a.style.height = h + 'px';
    var fr = document.createElement('span'); fr.className = 'sky-frame';
    var im = loaded[p.id].cloneNode(); im.alt = ''; fr.appendChild(im);
    if (st) { var sp = document.createElement('span'); sp.className = 'sky-stamp'; sp.textContent = st; fr.appendChild(sp); }
    var s = document.createElement('span'); s.className = 'sky-when'; s.textContent = HEAD.pic; a.appendChild(s);
    a.appendChild(fr);
    sky.appendChild(a); show(a, at, vary(LIFE_PIC));
  }
  // as one goes, its successor of the same kind — and one of the other kind only if none of that kind is standing (the
  // tick tops the rest up): so a small sky keeps its mix of lines and pictures, neither crowding the other out
  function refill(kind) {
    if (!running) return;
    if (kind === 'pic') { nextPicture(); if (!onSky('sky-msg').length) nextExchange(); }
    else { nextExchange(); if (!onSky('sky-pic').length) nextPicture(); }
  }

  /* ------------------------------------------------------------ a touch on a snapshot or an exchange: a note beside it
     What was touched stays, and a note stands beside it (under it, over it, at its side — the first place inside the sky
     and clear of the dome) saying what it is — a snapshot: the live feed from the habitat, with a key to the Media
     gallery; an exchange: the latest communication from the habitat, with a key to it on the board (the notes' words come
     with the page: sky.js, skyNotes). Nothing else is placed over the note while it stands. The cross, a touch anywhere
     else, Escape, or a while (NOTE_LIFE) closes it, and what was touched fades a moment later. */
  var NOTE_LIFE = 12000, NOTE_W = { phone: 300, desk: 340 }, NOTE_GAP = 10;
  var open = null;                                                 // { el: the note, on: what was touched, rec: its place, t: its timer }
  function closeNote(now) {
    if (!open) return;
    var o = open; open = null;
    clearTimeout(o.t);
    if (o.rec) o.rec.until = Date.now();                             // its place is free again
    o.el.classList.remove('is-on');
    setTimeout(function () { if (o.el.parentNode) o.el.parentNode.removeChild(o.el); }, now ? 0 : 260);
    if (o.on && o.on.parentNode) later(o.on, FADE + 1400);           // what was touched fades a moment later
  }
  function note(on) {
    var pic = on.classList.contains('sky-pic');
    var tpl = document.getElementById(pic ? 'sky-note-pic' : 'sky-note-msg');
    if (!tpl || !tpl.content) return;
    var same = open && open.on === on;
    closeNote(true);
    if (same) return;                                                // touched again: the note goes, and that is all
    stay(on);
    var el = tpl.content.firstElementChild.cloneNode(true);
    var link = el.querySelector('.sky-note-open'), id = on.getAttribute('data-id');
    if (!pic && link) link.href = '/write' + (id ? '#m' + id : '#exchanges');   // the key leads to this exchange on the board, on the Write page

    var W = sky.clientWidth, H = sky.clientHeight, w = Math.min(W - 2 * EDGE, phone() ? NOTE_W.phone : NOTE_W.desk);
    el.style.width = w + 'px'; el.style.left = '0px'; el.style.top = '0px';
    sky.appendChild(el);                                             // measured before it can be seen
    var h = el.offsetHeight, b = box(on), discs = rounds();
    // under it, over it, at its right, at its left — the first that is inside the sky and clear of the Earth and the
    // habitat; failing all four, under or over it, kept inside the sky
    var fits = function (t) { return t.x >= EDGE && t.y >= EDGE && t.x + w <= W - EDGE && t.y + h <= H - EDGE && clear({ x: t.x, y: t.y, w: w, h: h }, discs); };
    var tries = [{ x: b.x, y: b.y + b.h + NOTE_GAP }, { x: b.x, y: b.y - NOTE_GAP - h }, { x: b.x + b.w + NOTE_GAP, y: b.y }, { x: b.x - NOTE_GAP - w, y: b.y }];
    var at = null, i, x, y;
    for (i = 0; i < tries.length && !at; i++) if (fits(tries[i])) at = tries[i];
    if (at) { x = at.x; y = at.y; }
    else {
      x = Math.max(EDGE, Math.min(W - EDGE - w, b.x)); y = b.y + b.h + NOTE_GAP;
      if (y + h > H - EDGE) y = b.y - NOTE_GAP - h;
      if (y < EDGE) y = Math.max(EDGE, Math.min(H - EDGE - h, b.y));
    }
    el.style.left = Math.round(x) + 'px'; el.style.top = Math.round(y) + 'px';
    var rec = { x: x, y: y, w: w, h: h, until: Infinity };
    held.push(rec);
    open = { el: el, on: on, rec: rec, t: setTimeout(function () { closeNote(); }, NOTE_LIFE) };
    requestAnimationFrame(function () { requestAnimationFrame(function () { el.classList.add('is-on'); }); });
  }
  sky.addEventListener('click', function (e) {
    var on = e.target.closest ? e.target.closest('.sky-pic, .sky-msg') : null;
    if (on && sky.contains(on)) { e.preventDefault(); e.stopPropagation(); note(on); return; }
    if (e.target.closest && e.target.closest('.sky-note-x')) { e.preventDefault(); closeNote(); }
  });
  document.addEventListener('click', function (e) { if (open && !(e.target.closest && e.target.closest('.sky-note'))) closeNote(); });
  document.addEventListener('keydown', function (e) { if (e.key === 'Escape') closeNote(); });

  /* ------------------------------------------------------------ running only while it can be seen */
  var timers = [], running = false, inView = true;
  function stop() { timers.forEach(function (t) { clearInterval(t); clearTimeout(t); }); timers = []; running = false; }
  function go() {
    stop(); running = true;
    // every tick the sky is topped up to AT_ONCE exchanges and AT_ONCE snapshots; an exchange and a snapshot never come
    // in the same instant, so the eye can follow each arriving
    var tick = 0;
    timers.push(setTimeout(nextExchange, 400));
    timers.push(setTimeout(nextPicture, 1100));
    timers.push(setInterval(function () {
      tick++;
      // a kind with nothing left in the sky comes first, so there is always at least one of each; otherwise they take turns
      if (model.ex.length && !onSky('sky-msg').length) nextExchange();
      else if (model.pics.length && !onSky('sky-pic').length) nextPicture();
      else if (tick % 2) nextExchange(); else nextPicture();
    }, TICK));
  }
  function any() { return !!(model.ex.length || model.pics.length); }
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
    return rows.slice(0, EXCHANGES).map(function (r) {
      return { id: r.id, who: r.who, at: r.at, text: clip(r.text), reply: r.reply ? clip(r.reply) : '', rwho: r.reply ? r.rwho : '', rat: r.reply ? r.rat : '' };
    });
  }
  var latest = document.querySelector('[data-field="comms-text"]'), asking = false;
  if (latest && window.MutationObserver && window.fetch) {
    new MutationObserver(function () {
      if (asking) return; asking = true;
      fetch('/api/board', { cache: 'no-store', credentials: 'same-origin' })
        .then(function (r) { return r.ok ? r.json() : null; })
        .then(function (d) { if (d && typeof d.cards === 'string') { model.ex = fromCards(d.cards); renew(); } })
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
