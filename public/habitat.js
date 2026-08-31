/* Habitat dashboard — the Sensor-11 visualizations, drawn from the station's
   own /api/habitat/data. The station server does the polling and the saving
   (SQLite); this script additionally merges each read into localStorage so a
   phone that loses the venue network keeps showing the last good data.
   No framework, no external requests. */
(function () {
  'use strict';

  var HOST = document.getElementById('hbt-bento');
  if (!HOST) return;

  /* ------------------------------------------------------------ config */
  var CFG = {
    refreshMs: 20 * 60 * 1000,       // the node's transmit cycle
    rangeHours: 24,                  // window feeding the instrument tiles
    // The trend graph: the run itself, 15 to 27 October, every day on the
    // axis. The tile carries the dates (data-run-start / data-run-end), so a
    // rehearsal gets its own; these are the fallback.
    anchor: '2026-10-15',
    timeWeighted: true,
    gapAfterMs: 45 * 60 * 1000,
    dedupeWindowMs: 5 * 60 * 1000,
    localKey: 'mcs-habitat-rows',
    localMaxDays: 365,
    staleAfterMs: 30 * 60 * 1000,    // a reading counts as current for this long
    // The record closes with the run. From the end of 27 October 2026 — the
    // run's last day — the page stops asking for new readings and the graph
    // stands still on the run. (The server stops polling the node at the
    // same moment — see src/lib/critical.js.)
    freezeDate: '2026-10-27',
    freezeMs: Date.parse('2026-10-27T23:59:59+01:00')   // end of that day, Berlin (winter time)
  };
  function frozen() { return Date.now() > CFG.freezeMs; }
  CFG.url = '/api/habitat/data?days=30';

  var css = getComputedStyle(document.documentElement);
  var ACCENT = (css.getPropertyValue('--orange') || '#ff6a00').trim() || '#ff6a00';
  var INK = (css.getPropertyValue('--ink') || '#101012').trim() || '#101012';
  var HAIR = (css.getPropertyValue('--rule') || '#c9c9c2').trim() || '#c9c9c2';
  var ALERT = '#C81E1E';

  var CHANNELS = [
    { key: 'co2', name: 'CO₂', unit: 'ppm', decimals: 0, domain: [0, 2000], step: 500, alertAbove: 800 },
    { key: 'temp', name: 'Temperature', unit: '°C', decimals: 1, domain: [0, 40], step: 10 },
    { key: 'hum', name: 'Humidity', unit: '%RH', decimals: 0, domain: [0, 100], step: 25 },
    { key: 'light', name: 'Light', unit: 'raw', decimals: 0, domain: [0, 1000], step: 250 }
  ];
  var KEYS = ['co2', 'temp', 'hum', 'light', 'pres', 'bat', 'rssi'];
  var DAY = 86400000;

  var state = { rows: [], lastReadAt: null, nextReadAt: Date.now(), inFlight: false, failure: null, polledAt: undefined, nodeRows: null, nodeNewest: null, floor: null, sensorId: null };
  var $ = function (id) { return document.getElementById(id); };

  /* ------------------------------------------------------- local store */
  function loadLocal() {
    try {
      var raw = localStorage.getItem(CFG.localKey);
      if (!raw) return { rows: [], savedAt: null };
      var obj = JSON.parse(raw);
      var rows = (obj.rows || []).map(function (r) {
        var row = { t: r.t };
        KEYS.forEach(function (k) { row[k] = (r[k] === undefined ? null : r[k]); });
        return row;
      }).filter(function (r) { return Number.isFinite(r.t); });
      rows.sort(function (a, b) { return a.t - b.t; });
      return { rows: rows, savedAt: obj.savedAt || null, stamp: obj.stamp };
    } catch (err) { return { rows: [], savedAt: null }; }
  }
  function saveLocal() {
    try {
      var cutoff = Date.now() - CFG.localMaxDays * DAY;
      var rows = state.rows.filter(function (r) { return r.t >= cutoff; }).map(function (r) {
        var o = { t: r.t };
        KEYS.forEach(function (k) { if (r[k] !== null && r[k] !== undefined) o[k] = r[k]; });
        return o;
      });
      localStorage.setItem(CFG.localKey, JSON.stringify({ savedAt: Date.now(), stamp: state.stamp, rows: rows }));
    } catch (err) { /* quota or private mode: the server keeps the real history */ }
  }

  /* Union of two row sets: copies of one transmission (identical readings
     within the dedupe window) collapse to one. */
  function sig(row) { return KEYS.map(function (k) { return row[k]; }).join('|'); }
  function mergeRows(a, b) {
    var all = a.concat(b);
    all.sort(function (x, y) { return x.t - y.t; });
    var seen = new Map(), clean = [];
    all.forEach(function (row) {
      var s = sig(row), kept = seen.get(s);
      if (kept !== undefined && row.t - kept <= CFG.dedupeWindowMs) return;
      seen.set(s, row.t);
      clean.push(row);
    });
    return clean;
  }
  function windowed(rows, hours) {
    if (!rows.length || !hours) return rows;
    var end = rows[rows.length - 1].t;
    return rows.filter(function (r) { return r.t >= end - hours * 3600 * 1000; });
  }

  /* -------------------------------------------------------- SVG helpers */
  var NS = 'http://www.w3.org/2000/svg';
  function el(tag, attrs) {
    var e = document.createElementNS(NS, tag);
    for (var k in attrs) e.setAttribute(k, attrs[k]);
    return e;
  }
  function svgRoot(w, h, extra) {
    var a = { viewBox: '0 0 ' + w + ' ' + h, width: '100%', height: h };
    for (var k in (extra || {})) a[k] = extra[k];
    return el('svg', a);
  }
  function chan(k) { return CHANNELS.find(function (c) { return c.key === k; }); }
  function isHot(ch, v) { return ch.alertAbove != null && v !== null && v > ch.alertAbove; }
  function scaler(ch, h, padTop, padBottom) {
    var lo = ch.domain[0], hi = ch.domain[1];
    return function (v) {
      var c = Math.min(hi, Math.max(lo, v));
      return padTop + (h - padTop - padBottom) * (1 - (c - lo) / (hi - lo || 1));
    };
  }
  function fmtAgo(ms) {
    var s = Math.max(0, Math.round(ms / 1000));
    if (s < 60) return s + 's ago';
    var m = Math.round(s / 60);
    if (m < 60) return m + ' min ago';
    return Math.floor(m / 60) + 'h ' + (m % 60) + 'm ago';
  }

  /* -------------------------------------------------- tile 1: the dial */
  /* The dial is a 24-hour cycle: the ring is the day, midnight at the top,
     and each reading sits at its time-of-day angle — 06:00 to the right,
     12:00 at the bottom, 18:00 to the left — with its value as the spoke's
     length. The day fills the ring as it goes, so the daily rhythm of the
     CO2 (sleep, work, visitors) reads directly off the clock face. */
  function renderDial(view) {
    var ch = chan('co2');
    var host = $('hbt-dial'); host.innerHTML = '';
    var S = 320, C = S / 2, R0 = 92, RMAX = 148;
    var svg = svgRoot(S, S, { 'aria-label': 'CO2 readings over the 24-hour cycle, midnight at the top' });

    // The clock face: the ring, a tick per hour, the quarters labelled.
    svg.appendChild(el('circle', { cx: C, cy: C, r: R0 - 10, fill: 'none', stroke: HAIR, 'stroke-width': 1 }));
    var day0 = dayStart(), DAY = 86400000;
    var rad = function (frac) { return (-90 + 360 * frac) * Math.PI / 180; };
    for (var h = 0; h < 24; h++) {
      var a0 = rad(h / 24), q = h % 6 === 0;
      svg.appendChild(el('line', {
        x1: C + Math.cos(a0) * (R0 - 10), y1: C + Math.sin(a0) * (R0 - 10),
        x2: C + Math.cos(a0) * (R0 - (q ? 18 : 14)), y2: C + Math.sin(a0) * (R0 - (q ? 18 : 14)),
        stroke: HAIR, 'stroke-width': q ? 1.4 : 1
      }));
      if (q) {
        var lx = C + Math.cos(a0) * (R0 - 28), ly = C + Math.sin(a0) * (R0 - 28);
        var lbl = el('text', { x: lx, y: ly + 3, 'text-anchor': 'middle', fill: INK, opacity: '.45',
          'font-family': 'ui-monospace, monospace', 'font-size': '9', 'letter-spacing': '.08em' });
        lbl.textContent = (h < 10 ? '0' : '') + h;
        svg.appendChild(lbl);
      }
    }

    var pts = view.filter(function (r) { return r.co2 !== null; });
    if (!pts.length) { host.appendChild(svg); return; }
    if (pts.length > 144) {
      var stride = Math.ceil(pts.length / 144);
      pts = pts.filter(function (_, i) { return i % stride === 0 || i === pts.length - 1; });
    }
    var vals = pts.map(function (p) { return p.co2; });
    var lo = Math.min.apply(null, vals), hi = Math.max.apply(null, vals);
    var norm = function (v) { return hi === lo ? 0.45 : (v - lo) / (hi - lo); };

    pts.forEach(function (p, i) {
      // The reading's place on the clock: its time of day, midnight at the top.
      var a = rad(Math.min(1, Math.max(0, (p.t - day0) / DAY)));
      var len = R0 + 8 + norm(p.co2) * (RMAX - R0 - 12);
      var hot = isHot(ch, p.co2);
      var col = hot ? ALERT : ACCENT;
      var x1 = C + Math.cos(a) * R0, y1 = C + Math.sin(a) * R0;
      var x2 = C + Math.cos(a) * len, y2 = C + Math.sin(a) * len;
      var newest = i === pts.length - 1;
      svg.appendChild(el('line', {
        x1: x1, y1: y1, x2: x2, y2: y2,
        stroke: newest ? INK : (hot ? ALERT : HAIR),
        'stroke-width': newest ? 1.6 : (hot ? 1.4 : 1)
      }));
      if (newest) svg.appendChild(el('circle', { cx: x2, cy: y2, r: 9, fill: col, opacity: '.18' }));
      svg.appendChild(el('circle', { cx: x2, cy: y2, r: newest ? 5.5 : 3, fill: col, opacity: newest ? 1 : 0.9 }));
    });
    host.appendChild(svg);

    var last = vals[vals.length - 1];
    var hotNow = isHot(ch, last);
    $('co2Val').innerHTML = last.toFixed(0) + '<em>ppm</em>';
    $('co2Val').classList.toggle('hot', hotNow);
    $('co2Verdict').textContent = hotNow ? 'Over ' + ch.alertAbove + ' ppm' : 'Within limit';
    $('co2Verdict').classList.toggle('hot', hotNow);
    $('co2Sub').textContent = 'The ring is the day, midnight at the top · ' + pts.length + ' readings · ' +
      Math.round(lo) + '–' + Math.round(hi) + ' ppm today · limit ' + ch.alertAbove + ' ppm';
  }

  /* ------------------------------------------------- tile 2: the ruler */
  function renderRuler(view) {
    var ch = chan('temp');
    var host = $('hbt-ruler'); host.innerHTML = '';
    var W = 56, H = 220, pad = 8;
    var svg = svgRoot(W, H, { 'aria-label': 'Temperature scale', preserveAspectRatio: 'none' });
    svg.setAttribute('height', '100%');
    var y = scaler(ch, H, pad, pad);
    var lo = ch.domain[0], hi = ch.domain[1];

    svg.appendChild(el('rect', { x: 0, y: 0, width: W, height: H, rx: 12, fill: INK }));

    var pts = view.filter(function (r) { return r.temp !== null; });
    var val = pts.length ? pts[pts.length - 1].temp : null;
    if (val !== null) {
      var top = y(val);
      svg.appendChild(el('path', {
        d: 'M0,' + top + ' L' + W + ',' + top + ' L' + W + ',' + (H - 12) +
           ' Q' + W + ',' + H + ' ' + (W - 12) + ',' + H + ' L12,' + H +
           ' Q0,' + H + ' 0,' + (H - 12) + ' Z',
        fill: ACCENT
      }));
    }
    for (var v = lo; v <= hi + 0.001; v += 2) {
      var major = Math.abs(v % ch.step) < 0.001;
      var yy = y(v);
      svg.appendChild(el('line', {
        x1: W - (major ? 22 : 12), x2: W - 4, y1: yy, y2: yy,
        stroke: '#FFFFFF', 'stroke-width': major ? 1.4 : 1, opacity: major ? 0.9 : 0.45
      }));
      if (major && v > lo && v < hi) {
        var t = el('text', { x: W - 26, y: yy + 3.5, 'text-anchor': 'end',
          fill: '#FFFFFF', 'font-family': 'var(--mono)', 'font-size': '9' });
        t.textContent = v;
        svg.appendChild(t);
      }
    }
    host.appendChild(svg);

    if (val !== null) {
      $('tempVal').innerHTML = val.toFixed(ch.decimals) + '<em>°C</em>';
      var all = pts.map(function (p) { return p.temp; });
      $('tempVerdict').textContent = Math.min.apply(null, all).toFixed(1) + '–' +
        Math.max.apply(null, all).toFixed(1) + ' in view';
    }
  }

  /* --------------------------------------------- tile 3: the level bar */
  function renderLevel(view) {
    var ch = chan('hum');
    var host = $('hbt-level'); host.innerHTML = '';
    var W = 300, H = 54;
    var svg = svgRoot(W, H, { 'aria-label': 'Humidity level', preserveAspectRatio: 'none' });
    var pts = view.filter(function (r) { return r.hum !== null; });
    var val = pts.length ? pts[pts.length - 1].hum : null;
    var lo = ch.domain[0], hi = ch.domain[1];
    var by = 8, bh = 18;

    svg.appendChild(el('rect', { x: 0, y: by, width: W, height: bh, rx: 9, fill: HAIR }));
    if (val !== null) {
      var w = Math.max(6, W * (Math.min(hi, Math.max(lo, val)) - lo) / (hi - lo));
      svg.appendChild(el('rect', { x: 0, y: by, width: w, height: bh, rx: 9, fill: ACCENT }));
    }
    for (var v = lo; v <= hi; v += ch.step) {
      var x = W * (v - lo) / (hi - lo);
      svg.appendChild(el('line', { x1: x, x2: x, y1: by + bh + 5, y2: by + bh + 9, stroke: HAIR }));
      var t = el('text', { x: Math.min(W - 8, Math.max(8, x)), y: by + bh + 20, 'text-anchor': 'middle',
        fill: '#8B8B84', 'font-family': 'var(--mono)', 'font-size': '9' });
      t.textContent = v;
      svg.appendChild(t);
    }
    host.appendChild(svg);
    if (val !== null) $('humVal').innerHTML = val.toFixed(ch.decimals) + '<em>%RH</em>';
  }

  /* ------------------------------------------------ tile 4: the spark */
  function renderSpark(view) {
    var ch = chan('light');
    var host = $('hbt-spark'); host.innerHTML = '';
    var W = 300, H = 76, pad = 6;
    var svg = svgRoot(W, H, { 'aria-label': 'Light over time', preserveAspectRatio: 'none' });
    var pts = view.filter(function (r) { return r.light !== null; });
    if (!pts.length) { host.appendChild(svg); return; }
    var t0 = pts[0].t, t1 = pts[pts.length - 1].t;
    var x = function (t) { return t1 === t0 ? W : ((t - t0) / (t1 - t0)) * W; };
    var y = scaler(ch, H, pad, pad);

    var d = pts.map(function (p, i) {
      return (i ? 'L' : 'M') + x(p.t).toFixed(1) + ',' + y(p.light).toFixed(1);
    }).join('');
    svg.appendChild(el('path', { d: d + 'L' + W + ',' + (H - pad) + 'L0,' + (H - pad) + 'Z',
      fill: HAIR, opacity: '.5', stroke: 'none' }));
    svg.appendChild(el('path', { d: d, fill: 'none', stroke: INK, 'stroke-width': 1.4 }));
    var last = pts[pts.length - 1];
    svg.appendChild(el('circle', { cx: x(last.t), cy: y(last.light), r: 4, fill: ACCENT }));
    host.appendChild(svg);
    $('lightVal').innerHTML = last.light.toFixed(ch.decimals) + '<em>raw</em>';
  }

  /* --------------------------------- tile 5: daily averages over 15 days */
  function eachDay(t0, t1) {
    var out = [];
    var d = new Date(t0); d.setHours(0, 0, 0, 0);
    while (d.getTime() < t1) {
      var start = d.getTime();
      d.setDate(d.getDate() + 1); d.setHours(0, 0, 0, 0);
      out.push({ start: start, end: d.getTime() });
    }
    return out;
  }
  function medianGap(rows) {
    if (rows.length < 3) return Infinity;
    var g = [];
    for (var i = 1; i < rows.length; i++) g.push(rows[i].t - rows[i - 1].t);
    g.sort(function (a, b) { return a - b; });
    return g[Math.floor(g.length / 2)];
  }
  function gapLimit(rows) {
    var m = medianGap(rows);
    return Math.max(CFG.gapAfterMs, Number.isFinite(m) ? m * 4 : 0);
  }
  function average(samples, key) {
    var pts = samples.filter(function (r) { return r[key] !== null && r[key] !== undefined; });
    if (!pts.length) return null;
    var plain = pts.reduce(function (a, r) { return a + r[key]; }, 0) / pts.length;
    if (!CFG.timeWeighted || pts.length < 2) return plain;
    var limit = gapLimit(pts);
    var num = 0, den = 0;
    for (var i = 1; i < pts.length; i++) {
      var dt = pts[i].t - pts[i - 1].t;
      if (dt <= 0 || dt > limit) continue;
      num += (pts[i][key] + pts[i - 1][key]) / 2 * dt;
      den += dt;
    }
    return den > 0 ? num / den : plain;
  }
  /* ------------------------------------------------------------ trends */
  /* Every trend on ONE graph: the last fifteen days, today at the right
     edge. The Sensor-11 feed's channels come from the rows this script holds;
     the station's own ingest channels, each store and the crew's counts come
     from #hbt-trends[data-spec] as maps of venue date → value.

     The series have nothing in common but time — ppm, °C, litres, kcal — so
     each line is drawn on its own 0–100 scale: a store against what was
     carried in, everything else against its own low and high in the window.
     The real value and unit sit on every point; every line is named at its
     right-hand end in its own colour, and hovering the name lifts the line.
     Days with nothing recorded are skipped and the line runs straight on to
     the next day that has one. */
  // Sixteen solid colours, dark enough to read as text; past those, spread hues.
  var PALETTE = ['#ff6a1a', '#4f7bd9', '#8b6fd6', '#3aa66f', '#d94f7b', '#2aa7b8', '#c48a1c', '#6b7a8f',
                 '#e0562e', '#3f5fbf', '#9c4dcc', '#2e8b57', '#b8336a', '#1f8fa3', '#a67c00', '#556677'];
  /* A colour for any number of lines: the fixed palette first, then evenly
     spread hues so the fortieth line is still telling apart from its neighbours. */
  function colourAt(i) {
    if (i < PALETTE.length) return PALETTE[i];
    var k = i - PALETTE.length;
    return 'hsl(' + Math.round((k * 137.508) % 360) + ',' + (k % 2 ? 62 : 48) + '%,' + (k % 3 ? 42 : 34) + '%)';
  }
  /* Each channel with the scale it is drawn against — the instrument's own
     range, so a line that barely moves is drawn barely moving. */
  var TREND_CHANNELS = [
    { key: 'co2', name: 'CO₂', unit: 'ppm', domain: [0, 2000] },
    { key: 'temp', name: 'Temperature', unit: '°C', domain: [0, 40] },
    { key: 'hum', name: 'Humidity', unit: '%RH', domain: [0, 100] },
    { key: 'light', name: 'Light', unit: 'raw', domain: [0, 1000] },
    { key: 'pres', name: 'Air pressure', unit: 'hPa', domain: [950, 1050] },
    { key: 'bat', name: 'Node battery', unit: 'V', domain: [3, 4.5] },
    { key: 'rssi', name: 'Node signal', unit: 'dBm', domain: [-100, -30] }
  ];
  function niceMax(v) {
    if (!(v > 0)) return 1;
    var p = Math.pow(10, Math.floor(Math.log10(v)));
    var f = v / p;
    var n = f <= 1 ? 1 : f <= 2 ? 2 : f <= 2.5 ? 2.5 : f <= 5 ? 5 : 10;
    return n * p;
  }
  /* Every line is always drawn: there is no legend to switch one off, and a
     choice saved by an earlier version of the page is not honoured. */
  var hidden = {};
  try { localStorage.removeItem('mcs-trend-hidden'); } catch (e) { /* fine */ }

  function pad2(n) { return (n < 10 ? '0' : '') + n; }
  function dayKey(ms) { var d = new Date(ms); return d.getFullYear() + '-' + pad2(d.getMonth() + 1) + '-' + pad2(d.getDate()); }

  /* The axis. During and after the run it is the run, first day to last —
     15 to 27 October, SOL 01 to 13. Before the run it starts on the day the
     readings were last started again (the build, or the reset) and runs
     thirteen days from there, so the node's readings are on the graph from
     today. The tile carries the dates (data-axis-start / data-axis-end) and
     whether the axis is the run (data-axis-run), so a rehearsal against
     other dates gets its own. `today` is 1-based within the axis, 0 before it. */
  function dayWindow() {
    var tile = $('hbt-trends');
    if (!tile) return null;
    var today = tile.getAttribute('data-date') || dayKey(Date.now());
    var first = tile.getAttribute('data-axis-start') || tile.getAttribute('data-run-start') || CFG.anchor;
    var lastDay = tile.getAttribute('data-axis-end') || tile.getAttribute('data-run-end') || CFG.freezeDate;
    var isRun = tile.getAttribute('data-axis-run') !== '0';
    var days = [], todayIdx = 0, d = new Date(first + 'T00:00:00'), end = new Date(lastDay + 'T00:00:00');
    for (var i = 0; d.getTime() <= end.getTime() && i < 60; i++) {
      var e = new Date(d); e.setDate(e.getDate() + 1);
      if (dayKey(d.getTime()) === today) todayIdx = i + 1;
      days.push({ start: d.getTime(), end: e.getTime() });
      d = e;
    }
    if (today > lastDay) todayIdx = days.length;   // the axis is behind us: everything on it has happened
    return { days: days, today: todayIdx, total: days.length, first: days.length ? days[0].start : 0, run: isRun };
  }

  /* Monotone cubic (Fritsch–Carlson): smooth, and never overshoots a level. */
  function smoothPath(pts) {
    var n = pts.length;
    if (n < 2) return [];
    var d = [], m = [], i;
    for (i = 0; i < n - 1; i++) d.push((pts[i + 1][1] - pts[i][1]) / ((pts[i + 1][0] - pts[i][0]) || 1));
    m[0] = d[0]; m[n - 1] = d[n - 2];
    for (i = 1; i < n - 1; i++) m[i] = (d[i - 1] * d[i] <= 0) ? 0 : (d[i - 1] + d[i]) / 2;
    for (i = 0; i < n - 1; i++) {
      if (d[i] === 0) { m[i] = 0; m[i + 1] = 0; continue; }
      var a = m[i] / d[i], b = m[i + 1] / d[i], h = a * a + b * b;
      if (h > 9) { var t = 3 / Math.sqrt(h); m[i] = t * a * d[i]; m[i + 1] = t * b * d[i]; }
    }
    // One curve segment per pair of points, so a stretch of the line can be
    // drawn differently (dashed, for held-over values) without the tangents
    // changing: the whole line is still one smooth curve.
    var segs = [];
    for (i = 0; i < n - 1; i++) {
      var dx = (pts[i + 1][0] - pts[i][0]) / 3;
      segs.push('M' + pts[i][0].toFixed(1) + ',' + pts[i][1].toFixed(1) +
        ' C' + (pts[i][0] + dx).toFixed(1) + ',' + (pts[i][1] + m[i] * dx).toFixed(1) +
        ' ' + (pts[i + 1][0] - dx).toFixed(1) + ',' + (pts[i + 1][1] - m[i + 1] * dx).toFixed(1) +
        ' ' + pts[i + 1][0].toFixed(1) + ',' + pts[i + 1][1].toFixed(1));
    }
    return segs;
  }

  function fmtNum(v, unit) {
    if (unit === '%') return Math.round(v) + '%';
    if (Math.abs(v) >= 1000) return Math.round(v).toLocaleString('en-GB');
    return Number.isInteger(v) ? String(v) : v.toFixed(1);
  }
  function fmtVal(v, unit) { return fmtNum(v, unit) + (unit === '%' || !unit ? '' : ' ' + unit); }
  function fmtDate(ms) {
    return new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short' }).format(new Date(ms));
  }
  function fmtDateTime(ms) {
    return new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }).format(new Date(ms));
  }

  /* One series: real values per day, and where each sits on the line's own
     scale — the instrument's range for a channel, 0 to what was carried in
     for a store, 0 to a round top for a count. */
  function buildSeries(s, win) {
    var values = s.values, present = values.filter(function (v) { return v !== null && v !== undefined; });
    var lo = present.length ? Math.min.apply(null, present) : null, hi = present.length ? Math.max.apply(null, present) : null;
    var base, top;
    if (s.domain) { base = s.domain[0]; top = s.domain[1]; }
    else if (s.scaleMax != null) { base = 0; top = s.scaleMax; }
    else { base = 0; top = niceMax((hi || 0) * 1.1); }
    if (hi !== null && hi > top) top = hi;         // never clip a reading off the top
    if (lo !== null && lo < base) base = lo;
    var pos = values.map(function (v) {
      if (v === null || v === undefined) return null;
      return top === base ? 50 : ((v - base) / (top - base)) * 100;
    });
    return { id: s.id, name: s.name, unit: s.unit, colour: s.colour, values: values, pos: pos, lo: lo, hi: hi,
      held: s.held || values.map(function () { return null; }),
      scaleMax: s.scaleMax, domain: [base, top], group: s.group };
  }

  /* All the series, in legend order: the feed, the station's own channels,
     the stores, the crew's counts. */
  function allSeries(win, spec) {
    var out = [], ci = 0;
    var days = win.days.map(function (d) {
      var samples = state.rows.filter(function (r) { return r.t >= d.start && r.t < d.end; });
      var avg = {};
      TREND_CHANNELS.forEach(function (ch) { avg[ch.key] = samples.length ? average(samples, ch.key) : null; });
      return avg;
    });
    TREND_CHANNELS.forEach(function (ch) {
      var reported = state.rows.some(function (r) { return r[ch.key] !== null && r[ch.key] !== undefined; });
      if (!reported) return;      // a channel the node never sends (no battery on mains, say)
      // A point on every day from the first reading on. The node transmits
      // irregularly; a day it was silent carries the last value it did send,
      // marked as held so it is drawn as such and never mistaken for a read.
      // The last value the node sent before the window opened is carried into
      // it, so a node that has gone quiet still shows where it stood.
      var values = [], held = [], last = null, lastDay = null;
      for (var ri = state.rows.length - 1; ri >= 0; ri--) {
        var r0 = state.rows[ri];
        if (r0.t < win.days[0].start && r0[ch.key] !== null && r0[ch.key] !== undefined) { last = Math.round(r0[ch.key] * 10) / 10; lastDay = -2; break; }
      }
      days.forEach(function (d, i) {
        var v = d[ch.key];
        if (i >= win.today) { values.push(null); held.push(null); return; }   // still ahead
        if (v === null || v === undefined) {
          values.push(last); held.push(last === null ? null : lastDay);
        } else {
          last = Math.round(v * 10) / 10; lastDay = i;
          values.push(last); held.push(null);
        }
      });
      out.push({ id: 'feed-' + ch.key, name: ch.name, unit: ch.unit, group: 'Habitat', domain: ch.domain, colour: colourAt(ci++),
        values: values, held: held });
    });
    var keys = win.days.map(function (d) { return dayKey(d.start); });
    // The station's own series: what has happened, and — for anything
    // prepared in advance — what is planned for the days ahead, marked so
    // it is drawn dashed until the real figure replaces it.
    (spec.series || []).forEach(function (s) {
      var values = [], held = [];
      keys.forEach(function (k, i) {
        var v = (s.points || {})[k], p = win.run ? (s.planned || {})[String(i + 1)] : undefined;
        if (v !== undefined && v !== null) { values.push(v); held.push(null); }
        else if (p !== undefined && p !== null) { values.push(p); held.push(-1); }
        else { values.push(null); held.push(null); }
      });
      out.push({ id: s.id, name: s.name, unit: s.unit, group: s.group, scaleMax: s.scaleMax, domain: s.domain || null, colour: colourAt(ci++),
        values: values, held: held });
    });
    return out.map(function (s) { return buildSeries(s, win); });
  }

  function narrow() { var h = $('hbt-tcharts'); return !!h && h.clientWidth > 0 && h.clientWidth < 700; }
  function drawAll(series, win) {
    // A phone gets a squarer drawing, so the graph is not a ribbon.
    // The right margin holds a name at the end of every line, and the drawing
    // grows taller with the number of lines so every name has a row of its own.
    var visible = series.filter(function (s) { return !hidden[s.id] && s.lo !== null; }).length;
    var padL = 40, padR = narrow() ? 130 : 190, padT = 16, padB = narrow() ? 30 : 40;
    var rowH = narrow() ? 15 : 14;
    var W = narrow() ? 640 : 1200, H = Math.max(narrow() ? 400 : 360, visible * rowH + padT + padB + 8);
    var labelFont = (narrow() ? 12 : 11) + 'px ui-monospace, Menlo, Consolas, monospace';
    var n = win.total;
    var x = function (i) { return padL + (n === 1 ? (W - padL - padR) / 2 : (i / (n - 1)) * (W - padL - padR)); };
    var y = function (p) { return padT + (H - padT - padB) * (1 - Math.min(100, Math.max(0, p)) / 100); };

    var svg = svgRoot(W, H, { 'class': 'tchart-svg tone' + (narrow() ? ' narrow' : ''), role: 'img', 'aria-label': win.run ? 'Every trend across the ' + n + ' days of the run' : 'The habitat over ' + n + ' days before the run' });
    var defs = el('defs', {});
    svg.appendChild(defs);

    // gridlines: the shared 0–100 scale
    [0, 25, 50, 75, 100].forEach(function (p) {
      var gy = y(p);
      svg.appendChild(el('line', { x1: padL, x2: W - padR, y1: gy.toFixed(1), y2: gy.toFixed(1), 'class': 'tgrid' + (p === 0 ? ' base' : '') }));
      var t = el('text', { x: padL - 8, y: (gy + 3).toFixed(1), 'text-anchor': 'end', 'class': 'taxis-t' });
      t.textContent = p + '%';
      svg.appendChild(t);
    });
    // today's column, faintly
    var onAxis = win.today >= 1 && win.today <= n;
    if (onAxis) svg.appendChild(el('rect', { x: (x(win.today - 1) - 10).toFixed(1), y: padT, width: 20, height: H - padT - padB, 'class': 'ttoday' }));
    // SOL 1–14 along the foot, the date in small type beneath each; today's
    // in orange with a tag above it. A phone drops the dates to fit.
    for (var i = 0; i < n; i++) {
      var isTodayCol = i + 1 === win.today && !frozen();
      var anchor = i === 0 ? 'start' : i === n - 1 ? 'end' : 'middle';
      var tx = el('text', { x: x(i).toFixed(1), y: H - (narrow() ? 9 : 16), 'text-anchor': anchor,
        'class': 'taxis-t' + (isTodayCol ? ' today' : ''), style: 'font-weight:600' });
      tx.textContent = win.run ? 'SOL ' + (i + 1 < 10 ? '0' : '') + (i + 1) : fmtDate(win.days[i].start);
      svg.appendChild(tx);
      if (!narrow() && win.run) {
        var dx2 = el('text', { x: x(i).toFixed(1), y: H - 5, 'text-anchor': anchor,
          'class': 'taxis-t' + (isTodayCol ? ' today' : ''), style: 'font-size:9px;opacity:.75' });
        dx2.textContent = fmtDate(win.days[i].start);
        svg.appendChild(dx2);
      }
      if (isTodayCol) {
        var tag = el('text', { x: x(i).toFixed(1), y: H - (narrow() ? 20 : 27), 'text-anchor': anchor,
          'class': 'taxis-t today', style: 'font-size:9px;letter-spacing:.08em' });
        tag.textContent = 'TODAY';
        svg.appendChild(tag);
      }
    }

    var drawn = 0, labels = [];
    series.forEach(function (s) {
      if (hidden[s.id] || s.lo === null) return;
      drawn++;
      var g = el('g', { 'class': 'tseries', 'data-series': s.id });
      // One continuous line through every day that has a reading. A day with
      // nothing recorded is skipped, not a break: the node transmits
      // irregularly, and a run of isolated dots reads as no trend at all.
      var run = [];
      s.pos.forEach(function (p, i) {
        if (p === null) return;
        run.push([x(i), y(p), i]);
      });
      var runs = run.length ? [run] : [];
      runs.forEach(function (r) {
        // The curve, one segment per day. Solid only between two actual
        // readings; a segment touching a held-over value is dashed.
        smoothPath(r).forEach(function (d, k) {
          var isHeld = s.held[r[k][2]] !== null || s.held[r[k + 1][2]] !== null;
          g.appendChild(el('path', { d: d, 'class': 'tcurve' + (isHeld ? ' held' : ''), stroke: s.colour,
            'stroke-dasharray': isHeld ? '3 4' : 'none', opacity: isHeld ? 0.75 : 1 }));
        });
        r.forEach(function (pt) {
          var i = pt[2], isToday = i + 1 === win.today, heldFrom = s.held[i];
          var dot = n > 40 ? 2.2 : 3;
          var c = el('circle', { cx: pt[0].toFixed(1), cy: pt[1].toFixed(1), r: (isToday ? 4.5 : dot) * (narrow() ? 1.4 : 1),
            'class': 'tpt' + (isToday ? ' today' : '') + (heldFrom !== null ? ' held' : ''), stroke: s.colour,
            'stroke-dasharray': heldFrom !== null ? '2 2' : 'none',
            fill: isToday && heldFrom === null ? s.colour : 'var(--well)' });
          var t = document.createElementNS(NS, 'title');
          t.textContent = s.name + ' · ' + fmtDate(win.days[i].start) + ': ' + fmtVal(s.values[i], s.unit) +
            (heldFrom === -1 ? ' (planned)' : heldFrom === -2 ? ' (no reading today — the node\u2019s last value)'
              : heldFrom !== null ? ' (no reading — held from ' + fmtDate(win.days[heldFrom].start) + ')' : '');
          c.appendChild(t);
          g.appendChild(c);
        });
      });
      // Where the line ends, its name goes.
      var last = run[run.length - 1];
      labels.push({ id: s.id, name: s.name, colour: s.colour, x: last[0], y: last[1], ty: last[1] });
      svg.appendChild(g);
    });
    // Every line is named at its right-hand end, in its own colour. Lines that
    // end close together have their names pushed apart, and a short leader
    // joins a moved name back to its line so nothing is ambiguous.
    var gap = narrow() ? 14 : 13, top = padT + 5, bottom = H - padB - 3;
    labels.sort(function (a, b) { return a.y - b.y; });
    labels.forEach(function (l, i) { if (i && l.ty < labels[i - 1].ty + gap) l.ty = labels[i - 1].ty + gap; });
    for (var li = labels.length - 1; li >= 0; li--) {
      var cap = li === labels.length - 1 ? bottom : labels[li + 1].ty - gap;
      if (labels[li].ty > cap) labels[li].ty = cap;
    }
    labels.forEach(function (l) { if (l.ty < top) l.ty = top; });
    var lx = x(n - 1) + 14;
    labels.forEach(function (l) {
      var lg = el('g', { 'class': 'tseries tlabel', 'data-series': l.id });
      if (Math.abs(l.ty - l.y) > 1 || lx - l.x > 20) {
        lg.appendChild(el('line', { x1: (l.x + 5).toFixed(1), y1: l.y.toFixed(1), x2: (lx - 4).toFixed(1), y2: l.ty.toFixed(1),
          stroke: l.colour, 'stroke-width': 1, 'stroke-dasharray': '2 3', opacity: 0.7 }));
      }
      var t = el('text', { x: lx.toFixed(1), y: (l.ty + 4).toFixed(1), 'text-anchor': 'start', fill: l.colour,
        style: 'font:600 ' + labelFont + ';fill:' + l.colour + ';letter-spacing:.02em' });
      t.textContent = l.name;
      lg.appendChild(t);
      lg.addEventListener('mouseenter', function () { var h = $('hbt-tcharts'); if (h) h.setAttribute('data-lift', l.id); });
      lg.addEventListener('mouseleave', function () { var h = $('hbt-tcharts'); if (h) h.removeAttribute('data-lift'); });
      svg.appendChild(lg);
    });
    return svg;
  }

  function renderTrends() {
    var host = $('hbt-tcharts');
    if (!host) return;
    var win = dayWindow();
    if (!win) return;
    var spec = {};
    try { spec = JSON.parse($('hbt-trends').getAttribute('data-spec') || '{}'); } catch (e) { spec = {}; }
    var series = allSeries(win, spec);
    host.innerHTML = '';
    var chart = document.createElement('div');
    chart.className = 'tchart tone';
    chart.appendChild(drawAll(series, win));
    // the lifted line: hovering a line's name raises it above the others
    var style = document.createElement('style');
    style.textContent = series.map(function (s) {
      return '#hbt-tcharts[data-lift="' + s.id + '"] .tseries:not([data-series="' + s.id + '"]) { opacity: .12; }' +
             '#hbt-tcharts[data-lift="' + s.id + '"] .tseries[data-series="' + s.id + '"] .tcurve { stroke-width: 3; }';
    }).join('\n');
    host.appendChild(style);
    host.appendChild(chart);
  }
  function renderSpanCharts() { renderTrends(); }
  var wasNarrow = narrow(), resizeTimer = null;
  window.addEventListener('resize', function () {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(function () { if (narrow() !== wasNarrow) { wasNarrow = narrow(); renderTrends(); } }, 150);
  });

  /* ----------------------------------------------------------- notes */
  function notesHTML() {
    if (frozen()) {
      return '<div class="note"><b>The record closed on ' + fmtDate(Date.parse(CFG.freezeDate + 'T12:00:00')) + '.</b> ' +
        (state.lastReadAt ? 'Last reading ' + fmtDate(state.lastReadAt) + '. ' : '') + 'Nothing is updated after that.</div>';
    }
    if (state.failure) {
      return '<div class="note alert"><b>Could not reach the sensor feed.</b> ' +
        (state.rows.length
          ? 'Showing the last good data, read ' + fmtAgo(Date.now() - (state.lastReadAt || Date.now())) + '.'
          : 'Nothing has been read yet.') + '</div>';
    }
    var newest = state.rows.length ? state.rows[state.rows.length - 1].t : null;
    if (!state.rows.length) {
      // Nothing to draw. Say which of the possible reasons it is, so nobody
      // stands in front of empty dials wondering whether the page is broken.
      if (state.polledAt === null) return '<div class="note"><b>Waiting for the station\'s first read of the sensor node.</b> It polls on start and every ' + Math.round(CFG.refreshMs / 60000) + ' minutes.</div>';
      if (state.nodeRows === 0) return '<div class="note alert"><b>The sensor feed carries no readings for node ' + (state.sensorId || '?') + '.</b> Check CRITICAL_SENSOR_ID in .env — the node may be off, or registered under another id.</div>';
      if (state.nodeNewest && state.floor && state.nodeNewest < state.floor) return '<div class="note alert"><b>No reading from the node since ' + fmtDateTime(state.nodeNewest) + '.</b> The station\'s readings start ' + fmtDateTime(state.floor) + '; nothing the node has sent falls after that.</div>';
      return '<div class="note"><b>No readings yet.</b> The station\'s readings start ' + (state.floor ? fmtDateTime(state.floor) : 'now') + '; the node\'s next transmission will appear here.</div>';
    }
    if (newest && !isCurrent()) {
      var why = newest < dayStart() ? 'No reading has arrived today.' : 'No reading has arrived in the last 30 minutes.';
      return '<div class="note alert"><b>No current reading from the sensor node.</b> ' + why + ' Its last reading was ' + fmtDateTime(newest) + ' (' + fmtAgo(Date.now() - newest) + '). The tiles stay empty until it transmits again — earlier readings are on the trend graph.</div>';
    }
    return '';
  }

  /* The tiles are the habitat now, or nothing. Put them back to their
     empty state — a dash in every figure, no drawing — when there is no
     current reading, so an old number is never left standing as if it were
     live. The history stays on the trend graph, which is where history
     belongs. */
  function clearTiles() {
    ['hbt-dial', 'hbt-ruler', 'hbt-level', 'hbt-spark'].forEach(function (id) { var h = $(id); if (h) h.innerHTML = ''; });
    var set = function (id, html) { var e = $(id); if (e) { e.innerHTML = html; e.classList.remove('hot'); } };
    set('co2Val', '—<em>ppm</em>'); set('co2Verdict', 'No current reading'); set('co2Sub', '');
    set('tempVal', '—<em>°C</em>'); set('tempVerdict', 'No current reading');
    set('humVal', '—<em>%</em>'); set('lightVal', '—<em>raw</em>');
  }
  /* The tiles are today: readings since midnight at the venue, and only
     while the newest of them is less than thirty minutes old. Anything else
     — nothing today, or nothing in the last half hour — shows nothing. */
  function dayStart() {
    var tile = $('hbt-trends');
    var v = tile ? Number(tile.getAttribute('data-day-start')) : NaN;
    if (Number.isFinite(v) && v > 0) return v;
    var d = new Date(); d.setHours(0, 0, 0, 0); return d.getTime();
  }
  function todayRows() {
    var since = dayStart();
    return state.rows.filter(function (r) { return r.t >= since; });
  }
  function isCurrent() {
    var newest = state.rows.length ? state.rows[state.rows.length - 1].t : null;
    return newest !== null && newest >= dayStart() && Date.now() - newest <= CFG.staleAfterMs;
  }

  /* ---------------------------------------------------------- render */
  function render() {
    var view = todayRows();
    if (!view.length || !isCurrent()) {
      // Nothing current: the tiles say so. The trend graph still draws
      // whatever history there is.
      clearTiles();
      $('hbt-notes').innerHTML = notesHTML();
      renderTrends();
      return;
    }
    HOST.hidden = false;
    renderDial(view);
    renderRuler(view);
    renderLevel(view);
    renderSpark(view);
    renderSpanCharts();
    $('hbt-notes').innerHTML = notesHTML();
  }

  /* --------------------------------------------------- fetch + timers */
  function refresh() {
    if (state.inFlight) return;
    state.inFlight = true;
    fetch(CFG.url, { cache: 'no-store' })
      .then(function (res) {
        if (!res.ok) throw new Error('HTTP ' + res.status);
        return res.json();
      })
      .then(function (data) {
        var rows = (data.rows || []).map(function (r) {
          var row = { t: r.t };
          KEYS.forEach(function (k) { row[k] = (r[k] === undefined ? null : r[k]); });
          return row;
        });
        // The station is the record: a reset, or the start of the run, means
        // whatever this browser remembered from before is not part of it.
        var stamp = String(data.epoch || '') + '|' + String(data.floor || '');
        if (state.stamp !== undefined && state.stamp !== stamp) state.rows = [];
        state.stamp = stamp;
        var floor = Number(data.floor) || -Infinity;
        state.rows = mergeRows(state.rows, rows).filter(function (r) { return r.t >= floor; });
        // Prefer the server's own read time; it is the one polling the node.
        state.lastReadAt = data.rows && data.rows.length
          ? data.rows[data.rows.length - 1].t : (data.lastReadAt || state.lastReadAt);
        state.failure = data.lastError || null;
        state.polledAt = data.lastReadAt || (data.lastError ? data.lastError.at : null) || null;
        state.nodeRows = data.nodeRows === undefined ? null : data.nodeRows;
        state.nodeNewest = data.nodeNewest || null;
        state.floor = Number(data.floor) || null;
        state.sensorId = data.sensorId || null;
        saveLocal();
        // After the record closes, this one read of what the station holds
        // is the last: nothing is asked for again.
        state.nextReadAt = frozen() ? Infinity : Date.now() + CFG.refreshMs;
        render();
      })
      .catch(function () {
        state.failure = { errors: ['station unreachable'] };
        state.nextReadAt = Date.now() + Math.min(CFG.refreshMs, 60000);
        render();
      })
      .then(function () { state.inFlight = false; });
  }

  document.addEventListener('visibilitychange', function () {
    if (!document.hidden && Date.now() >= state.nextReadAt) refresh();
  });
  window.addEventListener('online', refresh);
  var rz;
  window.addEventListener('resize', function () {
    clearTimeout(rz);
    rz = setTimeout(function () { if (state.rows.length) render(); }, 200);
  });

  // Stored history first, so something shows instantly; the fetch merges on top.
  var stored = loadLocal();
  if (stored.rows.length) {
    state.rows = stored.rows;
    state.stamp = stored.stamp;
    state.lastReadAt = stored.savedAt;
    render();
  }
  setInterval(function () {
    if (!state.inFlight && Date.now() >= state.nextReadAt) refresh();
  }, 1000);
  refresh();
})();
