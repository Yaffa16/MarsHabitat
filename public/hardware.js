/* The Habitat hardware panel, kept live. The server polls Home Assistant and
   renders the panel (src/lib/home-assistant.js, src/views/pages/public.js);
   this asks /api/hardware for the rendered panel on the same cycle and swaps
   it in place when the change mark moves — the same pattern as the board.
   Losing JavaScript simply leaves the server-rendered panel standing.
   Polling pauses while the tab is hidden, stops for good once the record is
   closed, and a failed fetch changes nothing on screen.

   The charts are drawn for the width they are shown at: the page measures
   its charts' tiles and asks for that width (?w=), so the plot fills the
   tile and its type keeps its size on a desk and on a phone alike. The
   server-rendered panel is drawn for a desk (data-w); where the tiles are
   another size the page asks again at once, and again whenever the window
   is resized. On the rolled Habitat screen (screen-roll.js), read from
   across a room, the charts are drawn smaller than they are shown — their
   lines and type come out larger — and taller, as the roll gives them room.
   The panel comes back in the page's own language (?lang=, the language the
   page is in: a screen carries no cookie, it says its language in its
   address).

   What the pointer reads (9 October: "in the power graph, for all lines,
   when I hover show the current power rating"): over a chart's drawing a
   line stands at the hour under the pointer, a dot on every line there, and a
   card names every line's figure at that hour, the highest first — at the
   lines' ends, their latest. A finger: the same where it touches; a touch
   anywhere else puts it away. The chart brings its figures with it
   (data-hw: public.js, hwChart). */
(function () {
  'use strict';

  var box = document.getElementById('hw-live');
  if (!box) return;   // the bridge is not configured; no panel, nothing to do

  var pollMs = Math.max(15000, Number(box.getAttribute('data-poll')) || 60000);
  var version = box.getAttribute('data-version') || '';
  var drawnW = Number(box.getAttribute('data-w')) || 720, drawnH = Number(box.getAttribute('data-h')) || 240;
  var timer = null, busy = false, again = false, born = Date.now();
  var onScreen = document.documentElement.classList.contains('screen');   // one of the installation's screens (screens.js)
  var rolled = onScreen && document.body.getAttribute('data-fit') === 'roll';   // the Habitat screen, rolling (screen-roll.js)
  var BIG = rolled ? 1.3 : 1;                                             // shown this much larger than drawn: the lines and the type with it
  var lang = document.documentElement.getAttribute('lang') || '';

  // the width a chart has on the screen: its own, else what a tile would give one (the charts stand two across on a
  // desk, one on a phone — aura.css, .hw-charts); nothing while the panel is not laid out
  function want() {
    var svg = box.querySelector('.hw-chart > svg');                         // the chart's own drawing, not the sign in its caption
    var w = svg ? svg.getBoundingClientRect().width : 0;
    if (!w) { var r = box.getBoundingClientRect().width; if (r) w = (window.innerWidth > 760 ? (r - 16) / 2 : r) - 32; }
    return w > 0 ? Math.max(240, Math.min(1400, Math.round(w / BIG))) : 0;   // within what the server draws for
  }
  // the height: the usual 240; on the rolled Habitat screen half the chart's width (the roll gives it room); on the other
  // screens that show the panel a fifth of the screen's height, 130 at the least — a short screen has no room under the
  // instruments for a tall chart, and the chart keeps its height whatever the scale the screen is fitted at (screen.js)
  function wantH() {
    if (rolled) { var w = want(); return w ? Math.max(200, Math.min(700, Math.round(w * 0.5))) : 320; }
    return onScreen ? Math.max(130, Math.min(240, Math.round(window.innerHeight * 0.2))) : 240;
  }
  function differs(w) { return (w > 0 && Math.abs(w - drawnW) > Math.max(12, drawnW * 0.08)) || Math.abs(wantH() - drawnH) > 8; }

  function tick() {
    if (document.hidden) return;
    if (busy) { again = true; return; }
    busy = true;
    var w = want(), h = wantH();
    fetch('/api/hardware?' + (w ? 'w=' + w + '&' : '') + 'h=' + h + (lang ? '&lang=' + encodeURIComponent(lang) : ''), { cache: 'no-store' })
      .then(function (r) { return r.ok ? r.json() : null; })
      .then(function (j) {
        if (!j) return;
        if (j.frozen) { stop(); }
        var pw = document.getElementById('pwr-live');                        // the power tile, on the same cycle
        if (pw && j.power && pw.innerHTML !== j.power) pw.innerHTML = j.power;
        var o2 = document.getElementById('o2-live');                         // and the oxygen tile, the panel's first instrument
        if (o2 && j.o2 && o2.innerHTML !== j.o2) o2.innerHTML = j.o2;
        var w2 = Number(j.w) || drawnW, h2 = Number(j.h) || drawnH;
        if (j.html && j.version && (j.version !== version || w2 !== drawnW || h2 !== drawnH)) {
          version = j.version; drawnW = w2; drawnH = h2;
          // the lines draw themselves in when the panel first arrives (aura.css) — and when it is drawn again for its
          // width a moment after; a fresh reading swapped in later is simply there: the charts do not redraw
          // themselves every minute (is-live)
          if (Date.now() - born > 4000) box.classList.add('is-live');
          box.innerHTML = j.html;
        }
      })
      .catch(function () { /* the panel stands as it is; the next tick tries again */ })
      .then(function () { busy = false; if (again) { again = false; tick(); } });
  }

  function stop() { if (timer) { clearInterval(timer); timer = null; } }
  function startTimer() { if (!timer) timer = setInterval(tick, pollMs); }

  document.addEventListener('visibilitychange', function () {
    if (!document.hidden) tick();
  });
  // the tiles another width than the panel was drawn for: ask at once, and again after the window is resized
  var resizeT = null;
  function fitNow() { if (differs(want())) tick(); }
  window.addEventListener('resize', function () { clearTimeout(resizeT); resizeT = setTimeout(fitNow, 350); });
  if ('ResizeObserver' in window) new ResizeObserver(function () { clearTimeout(resizeT); resizeT = setTimeout(fitNow, 350); }).observe(box);
  setTimeout(fitNow, 50);

  startTimer();

  /* ---- what the pointer reads */
  var SVGNS = 'http://www.w3.org/2000/svg';
  var tip = null, mark = null;
  function readOf(fig) {
    if (fig.__hwSrc !== fig.getAttribute('data-hw')) {
      fig.__hwSrc = fig.getAttribute('data-hw');
      try { fig.__hw = JSON.parse(fig.__hwSrc || 'null'); } catch (e) { fig.__hw = null; }
    }
    return fig.__hw;
  }
  function clockOf(d, minutes) {
    try { return new Date(d.since + minutes * 60000).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', timeZone: d.tz || 'Europe/Berlin' }); }
    catch (e) { return ''; }
  }
  function fmt(v, dec) { return v == null || isNaN(v) ? '\u2014' : Number(v).toLocaleString('en-GB', { minimumFractionDigits: 0, maximumFractionDigits: dec }); }
  function el(tag, cls, text) { var n = document.createElement(tag); if (cls) n.className = cls; if (text != null) n.textContent = text; return n; }
  function hide() {
    if (tip) tip.hidden = true;
    if (mark && mark.parentNode) mark.parentNode.removeChild(mark);
    mark = null;
  }
  function show(fig, clientX) {
    var d = readOf(fig), svg = fig.querySelector(':scope > svg');             // the chart's drawing, not the sign in its caption
    if (!d || !svg || !d.s || !d.s.length) return hide();
    var r = svg.getBoundingClientRect(); if (!r.width) return hide();
    var x = (clientX - r.left) / r.width * d.W;                              // in the drawing's own units
    var at = (x - d.pl) / d.iw * d.span / 60000;                             // minutes since midnight
    if (x < d.pl - 12 || x > d.pl + d.iw + 12) return hide();
    // the hour under the pointer: the nearest point any line has
    var best = null;
    d.s.forEach(function (s) { s.p.forEach(function (p) { var dm = Math.abs(p[0] - at); if (!best || dm < best.dm) best = { dm: dm, m: p[0] }; }); });
    if (!best) return hide();
    var rows = [];
    d.s.forEach(function (s) {
      var pt = null;
      s.p.forEach(function (p) { if (!pt || Math.abs(p[0] - best.m) < Math.abs(pt[0] - best.m)) pt = p; });
      if (pt && Math.abs(pt[0] - best.m) <= 45) rows.push({ s: s, v: pt[1], m: pt[0] });
    });
    if (!rows.length) return hide();
    rows.sort(function (a, b) { return b.v - a.v; });
    var sx = function (m) { return d.pl + m * 60000 / d.span * d.iw; };
    var sy = function (v) { var k = (Math.min(d.hi, Math.max(d.lo, v)) - d.lo) / ((d.hi - d.lo) || 1); return d.pt + d.ih - k * d.ih; };
    // the line at that hour and a dot on every line
    if (mark && (!mark.isConnected || mark.ownerSVGElement !== svg)) { if (mark.parentNode) mark.parentNode.removeChild(mark); mark = null; }
    if (!mark) { mark = document.createElementNS(SVGNS, 'g'); mark.setAttribute('class', 'hw-hover'); svg.appendChild(mark); }
    while (mark.firstChild) mark.removeChild(mark.firstChild);
    var gx = sx(best.m), line = document.createElementNS(SVGNS, 'line');
    line.setAttribute('x1', gx.toFixed(1)); line.setAttribute('x2', gx.toFixed(1)); line.setAttribute('y1', d.pt); line.setAttribute('y2', d.pt + d.ih);
    mark.appendChild(line);
    rows.forEach(function (row) {
      var c = document.createElementNS(SVGNS, 'circle');
      c.setAttribute('cx', sx(row.m).toFixed(1)); c.setAttribute('cy', sy(row.v).toFixed(1)); c.setAttribute('r', '4.5'); c.setAttribute('fill', row.s.c);
      mark.appendChild(c);
    });
    // the card: the hour, then every line's figure
    if (!tip) { tip = el('div', 'hw-tip'); tip.setAttribute('role', 'status'); }
    if (tip.parentNode !== fig) fig.appendChild(tip);
    while (tip.firstChild) tip.removeChild(tip.firstChild);
    tip.appendChild(el('b', 'hw-tip-t', clockOf(d, best.m)));
    var ul = el('ul');
    rows.forEach(function (row) {
      var li = el('li'), dot = el('i');
      dot.style.background = row.s.c;
      li.appendChild(dot); li.appendChild(el('span', 'hw-tip-n', row.s.n)); li.appendChild(el('b', 'hw-tip-v', fmt(row.v, row.s.d) + (d.unit ? ' ' + d.unit : '')));
      ul.appendChild(li);
    });
    tip.appendChild(ul);
    tip.hidden = false;
    // beside the line, on the side with room; level with the top of the plot
    var fr = fig.getBoundingClientRect(), px = r.left - fr.left + gx / d.W * r.width, tw = tip.offsetWidth;
    var left = px + 14 + tw <= fr.width - 6 ? px + 14 : Math.max(6, px - 14 - tw);
    tip.style.left = Math.round(left) + 'px';
    tip.style.top = Math.round(r.top - fr.top + d.pt / d.H * r.height) + 'px';
  }
  box.addEventListener('pointermove', function (e) {
    if (e.pointerType === 'touch') return;                                   // a finger reads where it touches (below)
    var fig = e.target.closest ? e.target.closest('.hw-chart[data-hw]') : null;
    if (!fig || !e.target.closest('.hw-chart > svg')) return hide();
    show(fig, e.clientX);
  });
  box.addEventListener('pointerleave', function (e) { if (e.pointerType !== 'touch') hide(); });
  box.addEventListener('pointerdown', function (e) {
    var fig = e.target.closest ? e.target.closest('.hw-chart[data-hw]') : null;
    if (fig && e.target.closest('.hw-chart > svg')) show(fig, e.clientX); else hide();
  });
  document.addEventListener('pointerdown', function (e) { if (!box.contains(e.target)) hide(); });
})();
