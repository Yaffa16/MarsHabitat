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
    url: '/api/habitat/data?days=30',
    refreshMs: 20 * 60 * 1000,       // the node's transmit cycle
    rangeHours: 24,                  // window feeding the instrument tiles
    spanDays: 15,                    // the daily-average charts
    timeWeighted: true,
    gapAfterMs: 45 * 60 * 1000,
    dedupeWindowMs: 5 * 60 * 1000,
    localKey: 'mcs-habitat-rows',
    localMaxDays: 365,
    staleAfterMs: 50 * 60 * 1000
  };

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

  var state = { rows: [], lastReadAt: null, nextReadAt: Date.now(), inFlight: false, failure: null };
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
      return { rows: rows, savedAt: obj.savedAt || null };
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
      localStorage.setItem(CFG.localKey, JSON.stringify({ savedAt: Date.now(), rows: rows }));
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
  function renderDial(view) {
    var ch = chan('co2');
    var host = $('hbt-dial'); host.innerHTML = '';
    var S = 320, C = S / 2, R0 = 92, RMAX = 148;
    var svg = svgRoot(S, S, { 'aria-label': 'CO2 readings around the window' });

    var pts = view.filter(function (r) { return r.co2 !== null; });
    if (!pts.length) { host.appendChild(svg); return; }
    if (pts.length > 96) {
      var stride = Math.ceil(pts.length / 96);
      pts = pts.filter(function (_, i) { return i % stride === 0 || i === pts.length - 1; });
    }
    var vals = pts.map(function (p) { return p.co2; });
    var lo = Math.min.apply(null, vals), hi = Math.max.apply(null, vals);
    var norm = function (v) { return hi === lo ? 0.45 : (v - lo) / (hi - lo); };

    svg.appendChild(el('circle', { cx: C, cy: C, r: R0 - 10, fill: 'none', stroke: HAIR, 'stroke-width': 1 }));

    var sweep = 344, start = -90;
    pts.forEach(function (p, i) {
      var a = (start + (pts.length === 1 ? 0 : sweep * i / (pts.length - 1))) * Math.PI / 180;
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
    $('co2Sub').textContent = pts.length + ' readings · ' + lo + '–' + hi +
      ' ppm in view · limit ' + ch.alertAbove + ' ppm';
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
  function drawBars(ch, days, W) {
    var H = 78, pad = 6;
    var svg = svgRoot(W, H, { preserveAspectRatio: 'none', 'aria-label': ch.name + ', daily average' });
    var y = scaler(ch, H, pad, pad);
    var lo = ch.domain[0], hi = ch.domain[1];
    var slot = W / days.length;
    var gap = Math.min(6, slot * 0.18);
    var base = y(lo);

    if (ch.alertAbove != null && ch.alertAbove > lo && ch.alertAbove < hi) {
      var yl = y(ch.alertAbove);
      svg.appendChild(el('line', { x1: 0, x2: W, y1: yl, y2: yl, stroke: ALERT, 'stroke-width': 1, opacity: '.35' }));
    }
    var now = Date.now();
    days.forEach(function (d, i) {
      var x = i * slot + gap / 2;
      var w = slot - gap;
      if (d.avg[ch.key] === null) {
        svg.appendChild(el('rect', { x: x, y: base - 1, width: w, height: 1.5, fill: HAIR }));
        return;
      }
      var top = y(d.avg[ch.key]);
      var hot = isHot(ch, d.avg[ch.key]);
      svg.appendChild(el('rect', {
        x: x, y: top, width: w, height: Math.max(1.5, base - top), rx: 3,
        fill: hot ? ALERT : ACCENT, opacity: d.start > now ? '.35' : '1'
      }));
    });
    svg.appendChild(el('line', { x1: 0, x2: W, y1: base, y2: base, stroke: HAIR, 'stroke-width': 1 }));
    return svg;
  }
  function spanWindow() {
    var t1 = Math.max(Date.now(), state.rows.length ? state.rows[state.rows.length - 1].t : 0);
    var start = new Date(t1); start.setHours(0, 0, 0, 0);
    start.setDate(start.getDate() - (CFG.spanDays - 1));
    return { t0: start.getTime(), t1: t1 };
  }
  function renderSpanCharts() {
    var host = $('days15'), axis = $('days15Axis');
    host.innerHTML = ''; axis.innerHTML = '';
    var win = spanWindow();

    var fmtD = function (ms) {
      return new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short' }).format(new Date(ms));
    };
    $('days15Title').textContent = fmtD(win.t0) + ' – ' + fmtD(win.t1);

    var days = eachDay(win.t0, win.t1 + 1);
    days.forEach(function (d) {
      d.samples = state.rows.filter(function (r) { return r.t >= d.start && r.t < d.end; });
      d.avg = {};
      CHANNELS.forEach(function (ch) { d.avg[ch.key] = average(d.samples, ch.key); });
    });

    var W = 1000;
    CHANNELS.forEach(function (ch) {
      var row = document.createElement('div');
      row.className = 'drow';
      row.innerHTML = '<div class="dkey"><span class="k">' + ch.name + '</span>' +
        '<span class="v">' + ch.domain[0] + '–' + ch.domain[1] + ' ' + ch.unit + '</span></div>' +
        '<div class="dplot"></div>';
      row.querySelector('.dplot').appendChild(drawBars(ch, days, W));
      host.appendChild(row);
    });

    var today = new Date(); today.setHours(0, 0, 0, 0);
    var ticks = document.createElement('div');
    ticks.className = 'dticks';
    days.forEach(function (d, i) {
      var dt = new Date(d.start);
      var month = new Intl.DateTimeFormat('en-GB', { month: 'short' }).format(dt);
      var showMonth = i === 0 || dt.getDate() === 1;
      var cell = document.createElement('div');
      cell.className = 'dtick' + (d.start === today.getTime() ? ' today' : '');
      cell.innerHTML = dt.getDate() + (showMonth ? '<span class="mo">' + month + '</span>' : '');
      ticks.appendChild(cell);
    });
    axis.innerHTML = '<div class="dkey"></div>';
    axis.appendChild(ticks);
  }

  /* ----------------------------------------------------------- notes */
  function notesHTML() {
    if (state.failure) {
      return '<div class="note alert"><b>Could not reach the sensor feed.</b> ' +
        (state.rows.length
          ? 'Showing the last good data, read ' + fmtAgo(Date.now() - (state.lastReadAt || Date.now())) + '.'
          : 'Nothing has been read yet.') + '</div>';
    }
    if (state.lastReadAt && Date.now() - state.lastReadAt > CFG.staleAfterMs) {
      return '<div class="note"><b>The node has gone quiet.</b> Last reading ' +
        fmtAgo(Date.now() - state.lastReadAt) + '.</div>';
    }
    return '';
  }

  /* ---------------------------------------------------------- render */
  function render() {
    var view = windowed(state.rows, CFG.rangeHours);
    if (!view.length) {
      $('hbt-empty').hidden = false; HOST.hidden = true;
      $('hbt-notes').innerHTML = notesHTML();
      return;
    }
    $('hbt-empty').hidden = true; HOST.hidden = false;
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
        state.rows = mergeRows(state.rows, rows);
        // Prefer the server's own read time; it is the one polling the node.
        state.lastReadAt = data.rows && data.rows.length
          ? data.rows[data.rows.length - 1].t : (data.lastReadAt || state.lastReadAt);
        state.failure = data.lastError || null;
        saveLocal();
        state.nextReadAt = Date.now() + CFG.refreshMs;
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
    state.lastReadAt = stored.savedAt;
    render();
  }
  setInterval(function () {
    if (!state.inFlight && Date.now() >= state.nextReadAt) refresh();
  }, 1000);
  refresh();
})();
