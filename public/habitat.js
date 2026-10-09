/* Habitat dashboard — the habitat's readings as instruments, drawn from the
   station's own /api/habitat/data: each a tile with its figure and a meter
   under it, the racing dash's way (8 October) — the carbon dioxide and the air
   pressure and the volatile organic compounds as thin bars, the temperature and
   the light as dots, the humidity and the air quality index (its bands, with
   the sensor's own word for the band) as segments. The station server does the polling and the
   saving (SQLite) — from the habitat sensor through Home Assistant, or from
   the external node; this script does not know which — and this script
   additionally merges each read into localStorage so a phone that loses the
   venue network keeps showing the last good data. No framework, no external
   requests. */
(function () {
  'use strict';

  var HOST = document.getElementById('hbt-bento');
  if (!HOST) return;
  /* The visitor's language: the page head carries the dictionary for it
     (window.MCS_T, from src/lib/i18n.js); t() reads it, English otherwise. */
  var tr = window.t || function (s) { var i = String(s).indexOf('::'); return i > 0 ? String(s).slice(0, i) : s; };

  /* ------------------------------------------------------------ config */
  var CFG = {
    refreshMs: 60 * 1000,            // until the station says how often it reads (data.pollMs)
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
    staleAfterMs: 15 * 60 * 1000,    // a reading counts as current for this long (the station sends its own, data.staleMs)
    // The record closes with the run. From the end of 27 October 2026 — the
    // run's last day — the page stops asking for new readings and the graph
    // stands still on the run. (The server stops polling the node at the
    // same moment — see src/lib/critical.js.)
    freezeDate: '2026-10-27',
    freezeMs: Date.parse('2026-10-27T23:59:59+01:00')   // end of that day, Berlin (winter time)
  };
  function frozen() { return Date.now() > CFG.freezeMs; }
  CFG.url = '/api/habitat/data?days=30&thin=1';

  // the drawing's colours, read off the page: the accent from the body (where a theme laid over the page, like the blue day of
  // public/light.css, now laid aside, sets it), ink and hairline from the root; read again when the theme turns (switches.js)
  // and the tiles drawn afresh
  var ACCENT, INK, HAIR;
  function colours() {
    var root = getComputedStyle(document.documentElement), body = document.body ? getComputedStyle(document.body) : root;
    ACCENT = (body.getPropertyValue('--orange') || root.getPropertyValue('--orange') || '#ff6a00').trim() || '#ff6a00';
    INK = (root.getPropertyValue('--ink') || '#101012').trim() || '#101012';
    HAIR = (root.getPropertyValue('--rule') || '#c9c9c2').trim() || '#c9c9c2';
  }
  colours();
  if (window.MutationObserver) {
    new MutationObserver(function () { colours(); if (typeof state !== 'undefined' && state.rows && state.rows.length) render(); })
      .observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
  }

  var CHANNELS = [
    { key: 'co2', name: 'CO₂', unit: 'ppm', decimals: 0, domain: [0, 2000], step: 500, alertAbove: 800 },
    { key: 'temp', name: tr('Temperature'), unit: '°C', decimals: 1, domain: [0, 40], step: 10 },
    { key: 'hum', name: tr('Humidity'), unit: '%RH', decimals: 0, domain: [0, 100], step: 25 },
    { key: 'pres', name: tr('Air pressure'), unit: 'hPa', decimals: 1, domain: [950, 1050], step: 25 },
    { key: 'voc', name: tr('Volatile organic compounds'), unit: 'ppm', decimals: 2, domain: [0, 10], step: 2.5 },
    // The air quality index, 0–500, in BSEC's bands: excellent to 50, good
    // to 100, lightly polluted to 150, moderately to 200, heavily to 250,
    // severely to 350, extremely beyond. The sensor names the band itself
    // (the `iaqc` channel); the bands here draw the ticks.
    { key: 'iaq', name: tr('Air quality'), unit: 'IAQ', decimals: 0, domain: [0, 500], step: 100, bands: [50, 100, 150, 200, 250, 350], alertAbove: 150 },
    // The light sensor beside it: illuminance in lux — dim indoors is a few
    // dozen, a lit room a few hundred; the scale widens when a reading passes it.
    { key: 'light', name: tr('Light::sensor'), unit: 'lx', decimals: 0, domain: [0, 1000], step: 250 }
  ];
  var KEYS = ['co2', 'temp', 'hum', 'light', 'pres', 'bat', 'rssi', 'voc', 'iaq', 'iaqc'];
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
      return { rows: rows, savedAt: obj.savedAt || null, stamp: obj.stamp, fullAt: Number(obj.fullAt) || 0 };
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
      localStorage.setItem(CFG.localKey, JSON.stringify({ savedAt: Date.now(), stamp: state.stamp, fullAt: state.fullAt || 0, rows: rows }));
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
  /* The text in a drawing is set in the drawing's own units, and a drawing is scaled to the room it is given — on a phone
     to half its size or less, and its figures with it. fitText sets every text of a drawing to the size it is to be read at
     on the screen (the page's --fs-tag, never smaller than it was drawn); in a drawing stretched to its box
     (preserveAspectRatio none) the text is unstretched as well. Labels that would then run into each other along one line
     (a scale's numbers on a narrow tile) are thinned, the first and the last always kept. Run again whenever the drawing
     is redrawn or the page is resized. */
  function readPx() { return parseFloat(getComputedStyle(document.body).getPropertyValue('--fs-tag')) || 11; }
  function fitText(svg, px) {
    if (!svg || !svg.getScreenCTM || !svg.isConnected) return;
    var m = svg.getScreenCTM(); if (!m) return;
    var sx = Math.sqrt(m.a * m.a + m.b * m.b), sy = Math.sqrt(m.c * m.c + m.d * m.d);
    if (!(sx > 0) || !(sy > 0)) return;                                           // not drawn (a folder not open): next time
    px = px || readPx();
    svg.style.overflow = 'visible';                                               // a label enlarged at a scale's end may pass its edge by a little
    var texts = [].slice.call(svg.querySelectorAll('text'));
    texts.forEach(function (t) {
      if (t.__drawn == null) t.__drawn = parseFloat(getComputedStyle(t).fontSize) || 9;
      var fs = Math.max(t.__drawn, px / sy);
      t.style.fontSize = fs.toFixed(2) + 'px';
      var x = parseFloat(t.getAttribute('x')), y = parseFloat(t.getAttribute('y'));
      if (Math.abs(sx - sy) / sy > 0.02 && isFinite(x) && isFinite(y)) {
        var k = sy / sx;
        t.setAttribute('transform', 'translate(' + x + ' ' + y + ') scale(' + k.toFixed(4) + ' 1) translate(' + -x + ' ' + -y + ')');
      } else t.removeAttribute('transform');
      t.style.visibility = '';
    });
    // along each line of labels (the same baseline), a label that would touch the one before it is left out
    var rows = {};
    texts.forEach(function (t) { var y = t.getAttribute('y'); if (y != null) (rows[Math.round(parseFloat(y))] = rows[Math.round(parseFloat(y))] || []).push(t); });
    Object.keys(rows).forEach(function (k) {
      var row = rows[k]; if (row.length < 3) return;
      var boxes = row.map(function (t) { return { t: t, r: t.getBoundingClientRect() }; }).sort(function (a, b) { return a.r.left - b.r.left; });
      var last = boxes[0].r, end = boxes[boxes.length - 1];
      for (var i = 1; i < boxes.length - 1; i++) {
        var b = boxes[i];
        if (b.r.left < last.right + 6 || b.r.right > end.r.left - 6) b.t.style.visibility = 'hidden';
        else last = b.r;
      }
    });
  }
  function fitAll(scope) {
    [].forEach.call((scope || document).querySelectorAll('.hw-chart > svg, .gauge.round svg'), function (svg) { fitText(svg); });
  }

  function chan(k) { return CHANNELS.find(function (c) { return c.key === k; }); }
  function isHot(ch, v) { return ch.alertAbove != null && v !== null && v > ch.alertAbove; }
  function fmtAgo(ms) {
    var s = Math.max(0, Math.round(ms / 1000));
    if (s < 60) return s + 's ' + tr('ago');
    var m = Math.round(s / 60);
    if (m < 60) return m + ' min ' + tr('ago');
    return Math.floor(m / 60) + 'h ' + (m % 60) + 'm ' + tr('ago');
  }

  /* ------------------------------------------------- the instruments' tiles */
  /* Every instrument a tile of one make — its figure large, a word on the reading where there is one (the carbon
     dioxide's limit, the air quality's band as the sensor names it, how the humidity feels) — and each with a drawing of
     its own (8 October: "for the sensors' visualisation use more than just the horizontal filling line — varied but
     beautiful"): the carbon dioxide the day's curve under its limit; the temperature a thermometer, its comfortable
     range marked; the humidity a round vessel of water, its surface moving; the air pressure a barometer's needle over
     its normal range; the air quality the sensor's seven bands with a pointer on the one it reads; the light a sun whose
     rays light up with it; the compounds the day's hours as columns, this hour's in Mars (the oxygen's ring is the
     server's, public.js, oxygenTileInner). Each is drawn in its host's own pixels — the wide ones measure it — in the
     theme's colours (aura.css, .viz), red past a limit, and only drawn again when what it shows has changed. */
  function iaqClass(view) {
    for (var i = view.length - 1; i >= 0; i--) {
      var c = view[i].iaqc;
      if (c !== null && c !== undefined && String(c).trim()) return String(c).trim();
    }
    return null;
  }
  function titled(s) { s = String(s || ''); return s.charAt(0).toUpperCase() + s.slice(1).toLowerCase(); }
  function iaqBand(v) { var b = chan('iaq').bands; for (var i = 0; i < b.length; i++) if (v <= b[i]) return i; return b.length; }
  var TILE_KEYS = ['co2', 'temp', 'hum', 'pres', 'iaq', 'light', 'voc'];
  var r1 = function (v) { return Math.round(v * 10) / 10; };
  var clamp01 = function (v) { return Math.max(0, Math.min(1, v)); };
  function svg(w, h, inner, fit) {
    return '<svg viewBox="0 0 ' + w + ' ' + h + '" width="100%" height="100%"' + (fit ? '' : ' preserveAspectRatio="none"') + ' aria-hidden="true">' + inner + '</svg>';
  }
  // a point on a circle: the angle in degrees, 0 at the right, clockwise (the screen's y goes down)
  function on(cx, cy, r, deg) { var a = deg * Math.PI / 180; return [r1(cx + r * Math.cos(a)), r1(cy + r * Math.sin(a))]; }
  function arc(cx, cy, r, d0, d1) {
    var p = on(cx, cy, r, d0), q = on(cx, cy, r, d1);
    return 'M' + p[0] + ' ' + p[1] + 'A' + r + ' ' + r + ' 0 ' + (Math.abs(d1 - d0) > 180 ? 1 : 0) + ' 1 ' + q[0] + ' ' + q[1];
  }
  // the day's readings of one channel, thinned to about one a pixel or two (a mean in each bucket), with their times
  function series(view, key, buckets) {
    var pts = view.filter(function (r) { return r[key] !== null && r[key] !== undefined && isFinite(r[key]); });
    if (pts.length <= buckets) return pts.map(function (r) { return [r.t, Number(r[key])]; });
    var t0 = pts[0].t, t1 = pts[pts.length - 1].t, span = Math.max(1, t1 - t0), out = [], b = -1, sum = 0, n = 0, ts = 0;
    pts.forEach(function (r) {
      var k = Math.min(buckets - 1, Math.floor((r.t - t0) / span * buckets));
      if (k !== b && n) { out.push([ts / n, sum / n]); sum = 0; n = 0; ts = 0; }
      b = k; sum += Number(r[key]); ts += r.t; n++;
    });
    if (n) out.push([ts / n, sum / n]);
    return out;
  }
  // the carbon dioxide: the day's curve, midnight at the left and now at the right, under its limit (dashed), the latest
  // reading a dot with a halo; red past the limit
  function drawSpark(W, H, view, key, lo, hi, limit, hot) {
    var x0 = 2, x1 = W - 6, y0 = 6, y1 = H - 3, t0 = dayStart(), t1 = Math.max(Date.now(), t0 + 3600000);
    var pts = series(view, key, Math.max(24, Math.round(W / 2)));
    // the height drawn: the day's readings and the limit, with a little room above and below — so the curve has its shape
    var vs = pts.map(function (p) { return p[1]; }).concat([limit]), mn = Math.min.apply(null, vs), mx = Math.max.apply(null, vs), pad = Math.max(40, (mx - mn) * 0.18);
    var bot = Math.max(lo, mn - pad), top = Math.min(Math.max(hi, mx + pad), mx + pad);
    var X = function (t) { return r1(x0 + (x1 - x0) * clamp01((t - t0) / (t1 - t0))); }, Y = function (v) { return r1(y1 - (y1 - y0) * clamp01((v - bot) / ((top - bot) || 1))); };
    var g = '<defs><linearGradient id="vz-g-' + key + '" x1="0" y1="0" x2="0" y2="1"><stop offset="0" class="vz-stop-a"/><stop offset="1" class="vz-stop-b"/></linearGradient></defs>';
    var out = g + '<line class="vz-base" x1="' + x0 + '" y1="' + y1 + '" x2="' + x1 + '" y2="' + y1 + '"/>';
    out += '<line class="vz-limit" x1="' + x0 + '" y1="' + Y(limit) + '" x2="' + x1 + '" y2="' + Y(limit) + '"/>';
    if (pts.length) {
      var line = pts.map(function (p, i) { return (i ? 'L' : 'M') + X(p[0]) + ' ' + Y(p[1]); }).join('');
      var last = pts[pts.length - 1];
      if (pts.length > 1) out += '<path class="vz-area" fill="url(#vz-g-' + key + ')" d="' + line + 'L' + X(last[0]) + ' ' + y1 + 'L' + X(pts[0][0]) + ' ' + y1 + 'Z"/><path class="vz-line" d="' + line + '"/>';
      out += '<circle class="vz-halo" cx="' + X(last[0]) + '" cy="' + Y(last[1]) + '" r="6.5"/><circle class="vz-dot" cx="' + X(last[0]) + '" cy="' + Y(last[1]) + '" r="3.2"/>';
    }
    return svg(W, H, out) ;
  }
  // the temperature: a thermometer, its column risen to the reading, the comfortable range (18–26 °C) marked beside it
  function drawThermo(val, lo, hi) {
    var Y = function (v) { return r1(72 - 62 * clamp01((v - lo) / (hi - lo))); };
    var out = '<rect class="vz-band" x="30" y="' + Y(26) + '" width="4" height="' + r1(Y(18) - Y(26)) + '" rx="2"/>';
    for (var t = lo; t <= hi; t += 10) out += '<line class="vz-tick" x1="30" x2="' + (t % 20 === 0 ? 36 : 34) + '" y1="' + Y(t) + '" y2="' + Y(t) + '"/>';
    out += '<rect class="vz-glass" x="13" y="5" width="14" height="74" rx="7"/><circle class="vz-glass" cx="20" cy="84" r="12"/>';
    if (val !== null) out += '<rect class="vz-fill" x="16.5" y="' + Y(val) + '" width="7" height="' + r1(84 - Y(val)) + '" rx="3.5"/><circle class="vz-fill" cx="20" cy="84" r="8.5"/>';
    else out += '<circle class="vz-empty" cx="20" cy="84" r="8.5"/>';
    return svg(40, 100, out, true);
  }
  // the humidity: a round vessel, water to the reading, its surface two waves drifting (still where less motion is asked for)
  function drawLiquid(val, key) {
    var lev = val === null ? 96 : r1(92 - 84 * clamp01(val / 100));
    var wave = function (d) { return '<path class="vz-wave' + (d ? ' is-back' : '') + '" d="M-100 ' + (d ? 1 : 0) + 'Q-87.5 ' + (d ? 5 : -4) + ' -75 ' + (d ? 1 : 0) + 'T-50 ' + (d ? 1 : 0) + 'T-25 ' + (d ? 1 : 0) + 'T0 ' + (d ? 1 : 0) + 'T25 ' + (d ? 1 : 0) + 'T50 ' + (d ? 1 : 0) + 'T75 ' + (d ? 1 : 0) + 'T100 ' + (d ? 1 : 0) + 'T125 ' + (d ? 1 : 0) + 'T150 ' + (d ? 1 : 0) + 'T175 ' + (d ? 1 : 0) + 'T200 ' + (d ? 1 : 0) + 'V120H-100Z"/>'; };
    var out = '<defs><clipPath id="vz-c-' + key + '"><circle cx="50" cy="50" r="41"/></clipPath></defs>';
    out += '<circle class="vz-vessel" cx="50" cy="50" r="46"/><circle class="vz-inside" cx="50" cy="50" r="41"/>';
    if (val !== null) out += '<g clip-path="url(#vz-c-' + key + ')"><g transform="translate(0 ' + lev + ')">' + wave(1) + wave(0) + '</g></g>';
    return svg(100, 100, out, true);
  }
  // the air pressure: a barometer — a half dial, its normal range (990–1030 hPa) along the rim, a tick every 10 hPa, the
  // needle on the reading
  function drawDial(W, H, val, lo, hi) {
    var R = Math.max(10, Math.min(W / 2 - 18, H - 12)), cx = r1(W / 2), cy = H - 4;
    var A = function (v) { return 180 + 180 * clamp01((v - lo) / (hi - lo)); };
    var out = '<path class="vz-rim" d="' + arc(cx, cy, R, 180, 360) + '"/>';
    out += '<path class="vz-normal" d="' + arc(cx, cy, R, A(990), A(1030)) + '"/>';
    for (var v = lo; v <= hi; v += 10) { var long = (v - lo) % 50 === 0, p = on(cx, cy, R - 4, A(v)), q = on(cx, cy, R - (long ? 12 : 8), A(v)); out += '<line class="vz-tick' + (long ? ' is-long' : '') + '" x1="' + p[0] + '" y1="' + p[1] + '" x2="' + q[0] + '" y2="' + q[1] + '"/>'; }
    out += '<text class="vz-k" x="' + r1(cx - R - 3) + '" y="' + (cy - 1) + '" text-anchor="end">' + lo + '</text><text class="vz-k" x="' + r1(cx + R + 3) + '" y="' + (cy - 1) + '" text-anchor="start">' + hi + '</text>';
    if (val !== null) { var n = on(cx, cy, R - 10, A(val)); out += '<line class="vz-needle" x1="' + cx + '" y1="' + cy + '" x2="' + n[0] + '" y2="' + n[1] + '"/>'; }
    out += '<circle class="vz-hub" cx="' + cx + '" cy="' + cy + '" r="4"/>';
    return svg(W, H, out, true);
  }
  // the air quality: the sensor's seven bands, excellent to extreme, the one it reads lit and a pointer over it
  function drawBand(W, H, val, hot) {
    var bands = chan('iaq').bands, edges = [0].concat(bands, [500]), n = edges.length - 1, gap = 3, bw = (W - gap * (n - 1)) / n, y = H - 14;
    var i = val === null ? -1 : iaqBand(val), out = '';
    for (var k = 0; k < n; k++) out += '<rect class="vz-iaq vz-iaq-' + k + (k === i ? ' is-on' : '') + '" x="' + r1(k * (bw + gap)) + '" y="' + y + '" width="' + r1(bw) + '" height="10" rx="5"/>';
    if (val !== null) {
      var f = clamp01((val - edges[i]) / ((edges[i + 1] - edges[i]) || 1)), x = r1(i * (bw + gap) + bw * f);
      out += '<path class="vz-caret' + (hot ? ' is-hot' : '') + '" d="M' + r1(x - 6) + ' ' + (y - 13) + 'L' + r1(x + 6) + ' ' + (y - 13) + 'L' + x + ' ' + (y - 3) + 'Z"/>';
    }
    return svg(W, H, out, true);
  }
  // the light: a sun, its twelve rays lit up with the reading, its heart brighter as it rises
  function drawSun(val, lo, hi) {
    var f = val === null ? 0 : clamp01((val - lo) / (hi - lo)), lit = val === null ? 0 : Math.max(val > 0 ? 1 : 0, Math.round(f * 12)), out = '';
    for (var k = 0; k < 12; k++) { var d = -90 + k * 30, p = on(50, 50, 25, d), q = on(50, 50, 41, d); out += '<line class="vz-ray' + (k < lit ? ' is-on' : '') + '" x1="' + p[0] + '" y1="' + p[1] + '" x2="' + q[0] + '" y2="' + q[1] + '"/>'; }
    out += '<circle class="vz-core' + (val === null ? '' : ' is-on') + '" cx="50" cy="50" r="15" style="opacity:' + (val === null ? 1 : r1(0.4 + 0.6 * f)) + '"/>';
    return svg(100, 100, out, true);
  }
  // the compounds: the day's twenty-four hours as columns, each the hour's mean, this hour's in Mars; the hours to come a dot
  function drawCols(W, H, view, key, hi) {
    var t0 = dayStart(), now = Math.min(23, Math.floor((Date.now() - t0) / 3600000)), sums = [], ns = [], k;
    for (k = 0; k < 24; k++) { sums.push(0); ns.push(0); }
    view.forEach(function (r) { var v = r[key]; if (v === null || v === undefined || !isFinite(v)) return; var h = Math.floor((r.t - t0) / 3600000); if (h >= 0 && h < 24) { sums[h] += Number(v); ns[h]++; } });
    var means = sums.map(function (s, h) { return ns[h] ? s / ns[h] : null; });
    var top = Math.max(1, niceMax(Math.max.apply(null, means.map(function (m) { return m || 0; }).concat([hi * 0.2]))));
    var gap = Math.max(1.5, W / 24 * 0.28), bw = (W - gap * 23) / 24, base = H - 2, out = '<line class="vz-base" x1="0" y1="' + base + '" x2="' + W + '" y2="' + base + '"/>';
    for (k = 0; k < 24; k++) {
      var x = r1(k * (bw + gap));
      if (means[k] === null) { if (k > now) out += '<circle class="vz-later" cx="' + r1(x + bw / 2) + '" cy="' + (base - 2) + '" r="1.3"/>'; continue; }
      var h = Math.max(2, (base - 4) * clamp01(means[k] / top));
      out += '<rect class="vz-col' + (k === now ? ' is-now' : '') + '" x="' + x + '" y="' + r1(base - h) + '" width="' + r1(bw) + '" height="' + r1(h) + '" rx="' + r1(Math.min(2, bw / 2)) + '"/>';
    }
    return svg(W, H, out);
  }
  // the drawing in its host, drawn again only when what it shows has changed (or the host has been resized)
  function drawViz(host, key, view, val, lo, hi, hot) {
    if (!host) return;
    var W = Math.round(host.clientWidth) || 160, H = Math.round(host.clientHeight) || 56, ch = chan(key), html;
    var last = view.length ? view[view.length - 1].t : 0;
    var stamp = [W, H, val, hot, view.length, last, key === 'co2' || key === 'voc' ? Math.floor(Date.now() / 60000) : 0].join('|');
    if (host.__stamp === stamp) return;
    host.__stamp = stamp;
    if (key === 'co2') html = drawSpark(W, H, val === null ? [] : view, key, lo, hi, ch.alertAbove, hot);
    else if (key === 'temp') html = drawThermo(val, lo, hi);
    else if (key === 'hum') html = drawLiquid(val, key);
    else if (key === 'pres') html = drawDial(W, H, val, lo, hi);
    else if (key === 'iaq') html = drawBand(W, H, val, hot);
    else if (key === 'light') html = drawSun(val, lo, hi);
    else html = drawCols(W, H, val === null ? [] : view, key, hi);
    host.innerHTML = html;
    host.classList.toggle('is-hot', !!hot);
  }
  function renderTile(view, key) {
    var ch = chan(key);
    var pts = view.filter(function (r) { return r[key] !== null && r[key] !== undefined; });
    var val = pts.length ? Number(pts[pts.length - 1][key]) : null;
    var host = $('hbt-m-' + key), valEl = $(key + 'Val'), word = $(key + 'Verdict');
    var tile = host && host.closest ? host.closest('.tile') : null;
    var lo = ch.domain[0], hi = ch.domain[1];
    if (val === null || !isFinite(val)) {
      drawViz(host, key, [], null, lo, hi, false);
      if (valEl) { valEl.innerHTML = '—<em>' + ch.unit + '</em>'; valEl.classList.remove('hot'); }
      if (word) { word.textContent = tr('No current reading'); word.classList.remove('hot'); }
      if (tile) tile.classList.remove('is-hot');
      return;
    }
    if (key === 'light' || key === 'voc') hi = Math.max(hi, niceMax(val));          // the scale widens when a reading passes it
    var hot = isHot(ch, val);
    drawViz(host, key, view, val, lo, hi, hot);
    if (valEl) { valEl.innerHTML = val.toFixed(ch.decimals) + '<em>' + ch.unit + '</em>'; valEl.classList.toggle('hot', hot); }
    var text = '';
    if (key === 'co2') text = hot ? tr('Over') + ' ' + ch.alertAbove + ' ppm' : tr('Within limit');
    else if (key === 'iaq') { var cls = iaqClass(view); text = cls ? tr(titled(cls)) : (hot ? tr('Over') + ' ' + ch.alertAbove : tr('Within limit')); }
    else if (key === 'hum') text = val < 30 ? tr('Dry') : val > 60 ? tr('Humid') : tr('Comfortable');
    else if (key === 'temp') text = val < 18 ? tr('Cool') : val > 26 ? tr('Warm') : tr('Comfortable');
    else if (key === 'pres') text = val < 990 ? tr('Low') : val > 1030 ? tr('High') : tr('Normal');
    else if (key === 'light') text = val < 100 ? tr('Dim') : val > 750 ? tr('Bright') : tr('Normal');
    else if (key === 'voc') text = val < 1 ? tr('Low') : val > 3 ? tr('High') : tr('Moderate');
    if (word) { word.textContent = text; word.classList.toggle('hot', hot); }
    if (tile) tile.classList.toggle('is-hot', hot);
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
    { key: 'temp', name: tr('Temperature'), unit: '°C', domain: [0, 40] },
    { key: 'hum', name: tr('Humidity'), unit: '%RH', domain: [0, 100] },
    { key: 'pres', name: tr('Air pressure'), unit: 'hPa', domain: [950, 1050] },
    { key: 'voc', name: tr('Volatile organic compounds'), unit: 'ppm', domain: [0, 10] },
    { key: 'iaq', name: tr('Air quality'), unit: 'IAQ', domain: [0, 500] },
    { key: 'light', name: tr('Light::sensor'), unit: 'lx', domain: [0, 1000] },
    // the external node's own channels — drawn only while something reports them
    { key: 'bat', name: tr('Node battery'), unit: 'V', domain: [3, 4.5] },
    { key: 'rssi', name: tr('Node signal'), unit: 'dBm', domain: [-100, -30] }
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

  /* The axis: always a fortnight of the calendar (9 October: "the Trends graph should always show trends for 14-day
     periods — 1–14th, 15–29th"): the half of the month today is in, which the station names (data-axis-start /
     data-axis-end: 1 to 14 October until the run, 15 to 29 October from its first day, where it stands still after its
     last). A day of the run is named by its SOL — counted from the run's first day (data-run-start / data-run-end), so
     a rehearsal against other dates gets its own — and carries the plan for that SOL; any other day is named by its
     date. `today` is 1-based within the axis, 0 before it. */
  function dayWindow() {
    var tile = $('hbt-trends');
    if (!tile) return null;
    var today = tile.getAttribute('data-date') || dayKey(Date.now());
    var runStart = tile.getAttribute('data-run-start') || CFG.anchor, runEnd = tile.getAttribute('data-run-end') || CFG.freezeDate;
    var first = tile.getAttribute('data-axis-start') || runStart;
    var lastDay = tile.getAttribute('data-axis-end') || runEnd;
    var days = [], todayIdx = 0, d = new Date(first + 'T00:00:00'), end = new Date(lastDay + 'T00:00:00'), r0 = new Date(runStart + 'T00:00:00').getTime();
    for (var i = 0; d.getTime() <= end.getTime() && i < 60; i++) {
      var e = new Date(d); e.setDate(e.getDate() + 1);
      var k = dayKey(d.getTime());
      if (k === today) todayIdx = i + 1;
      days.push({ start: d.getTime(), end: e.getTime(), sol: k >= runStart && k <= runEnd ? Math.round((d.getTime() - r0) / 864e5) + 1 : 0 });
      d = e;
    }
    if (today > lastDay) todayIdx = days.length;   // the axis is behind us: everything on it has happened
    var anySol = days.some(function (x) { return x.sol > 0; });
    return { days: days, today: todayIdx, total: days.length, first: days.length ? days[0].start : 0, run: anySol };
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
        var sol = win.days[i].sol, v = (s.points || {})[k], p = sol ? (s.planned || {})[String(sol)] : undefined;   // the plan on the run's days, by their SOL
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
  /* On a desk the graph is drawn in a box 1200 wide and scaled to the panel (about its own size), every line named at its
     right-hand end. On a phone it is drawn at the width it is shown at — one unit a pixel, so its figures are read at the
     size they are set — with the sols along the foot as their numbers, and the names of the lines in a legend under it
     (renderTrends), where a touch on a name lifts its line. */
  function drawAll(series, win) {
    var slim = narrow(), host = $('hbt-tcharts');
    var visible = series.filter(function (s) { return !hidden[s.id] && s.lo !== null; }).length;
    var W = slim ? Math.max(260, Math.round(host.clientWidth)) : 1200;
    var padL = slim ? 38 : 50, padR = slim ? 10 : 250, padT = slim ? 14 : 18, padB = slim ? 34 : 50;
    var rowH = 17;
    var H = slim ? Math.round(Math.min(320, Math.max(220, W * 0.72))) : Math.max(380, visible * rowH + padT + padB + 8);
    // on one of the installation's screens, held landscape, the wide graph is drawn to the shape of the room it has
    // (screen.css fills the stage with the panel; data-fit="fill"), so that it fills the screen's height and not only
    // its width — never squatter than the desk's graph
    if (!slim && document.documentElement.classList.contains('screen') && document.body.getAttribute('data-fit') === 'fill') {
      var room = host.getBoundingClientRect();
      if (room.width > 0 && room.height > 0) H = Math.max(H, Math.round(W * room.height / room.width));
    }
    var labelFont = '13px ui-monospace, Menlo, Consolas, monospace';
    var axisPx = slim ? readPx() : 13, datePx = 12, tagPx = slim ? readPx() - 1 : 11.5;
    var n = win.total;
    var x = function (i) { return padL + (n === 1 ? (W - padL - padR) / 2 : (i / (n - 1)) * (W - padL - padR)); };
    var y = function (p) { return padT + (H - padT - padB) * (1 - Math.min(100, Math.max(0, p)) / 100); };

    var svg = svgRoot(W, H, { 'class': 'tchart-svg tone' + (slim ? ' narrow' : ''), role: 'img', 'aria-label': 'Every trend over the ' + n + ' days from ' + fmtDate(win.days[0].start) + ' to ' + fmtDate(win.days[n - 1].start) });
    if (slim) { svg.setAttribute('width', W); svg.style.width = W + 'px'; svg.style.height = H + 'px'; }
    var defs = el('defs', {});
    svg.appendChild(defs);

    // gridlines: the shared 0–100 scale
    [0, 25, 50, 75, 100].forEach(function (p) {
      var gy = y(p);
      svg.appendChild(el('line', { x1: padL, x2: W - padR, y1: gy.toFixed(1), y2: gy.toFixed(1), 'class': 'tgrid' + (p === 0 ? ' base' : '') }));
      var t = el('text', { x: padL - 8, y: (gy + 4).toFixed(1), 'text-anchor': 'end', 'class': 'taxis-t', style: 'font-size:' + axisPx + 'px' });
      t.textContent = p + '%';
      svg.appendChild(t);
    });
    // today's column, faintly
    var onAxis = win.today >= 1 && win.today <= n;
    if (onAxis) svg.appendChild(el('rect', { x: (x(win.today - 1) - 10).toFixed(1), y: padT, width: 20, height: H - padT - padB, 'class': 'ttoday' }));
    // The sols along the foot: on a desk "SOL 01" with the date beneath each, on a phone the number alone (every other one
    // where the day is narrower than a number), today's in orange with a tag above it.
    var every = slim && (W - padL - padR) / Math.max(1, n - 1) < 22 ? 2 : 1;
    for (var i = 0; i < n; i++) {
      var isTodayCol = i + 1 === win.today && !frozen();
      if (slim && i % every && !isTodayCol && i !== n - 1) continue;
      var anchor = 'middle';                                                    // each under its own day, the first and the last too (the margins have room): the last two never run together
      var tx = el('text', { x: x(i).toFixed(1), y: H - (slim ? 12 : 22), 'text-anchor': slim ? 'middle' : anchor,
        'class': 'taxis-t' + (isTodayCol ? ' today' : ''), style: 'font-weight:600;font-size:' + axisPx + 'px' });
      var sol = win.days[i].sol;                                                // a day of the run by its SOL, any other by its date
      tx.textContent = sol ? (slim ? pad2(sol) : 'SOL ' + pad2(sol)) : (slim ? String(new Date(win.days[i].start).getDate()) : fmtDate(win.days[i].start));
      svg.appendChild(tx);
      if (!slim && sol) {
        var dx2 = el('text', { x: x(i).toFixed(1), y: H - 5, 'text-anchor': anchor,
          'class': 'taxis-t' + (isTodayCol ? ' today' : ''), style: 'font-size:' + datePx + 'px;opacity:.75' });
        dx2.textContent = fmtDate(win.days[i].start);
        svg.appendChild(dx2);
      }
      if (isTodayCol) {
        var tag = el('text', { x: x(i).toFixed(1), y: H - (slim ? 29 : 38), 'text-anchor': slim ? 'middle' : anchor,
          'class': 'taxis-t today', style: 'font-size:' + tagPx + 'px;letter-spacing:.06em' });
        tag.textContent = tr('TODAY');
        svg.appendChild(tag);
      }
    }
    if (slim && win.days[0].sol) {                                                // the axis named once, at its start — where it starts with the run
      var solK = el('text', { x: 2, y: H - 12, 'text-anchor': 'start', 'class': 'taxis-t', style: 'font-size:' + (axisPx - 1) + 'px;opacity:.75' });
      solK.textContent = 'SOL';
      svg.appendChild(solK);
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
          var c = el('circle', { cx: pt[0].toFixed(1), cy: pt[1].toFixed(1), r: (isToday ? 4.5 : dot) * (slim ? 1.1 : 1),
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
      // Where the line ends, its name goes (on a desk; a phone lists the names under the graph).
      var last = run[run.length - 1];
      if (!slim) labels.push({ id: s.id, name: s.name, colour: s.colour, x: last[0], y: last[1], ty: last[1] });
      svg.appendChild(g);
    });
    // Every line is named at its right-hand end, in its own colour. Lines that
    // end close together have their names pushed apart, and a short leader
    // joins a moved name back to its line so nothing is ambiguous.
    var gap = 16, top = padT + 5, bottom = H - padB - 3;
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
    // on a phone the names of the lines are a legend under the graph: a touch (or the hand) on one lifts its line
    if (narrow()) {
      var legend = document.createElement('ul');
      legend.className = 'tlegend';
      series.forEach(function (s) {
        if (hidden[s.id] || s.lo === null) return;
        var li = document.createElement('li');
        li.setAttribute('data-series', s.id);
        li.innerHTML = '<i></i><span></span>';
        li.firstChild.style.background = s.colour;
        li.lastChild.textContent = s.name;
        var lift = function (on) { if (on) host.setAttribute('data-lift', s.id); else host.removeAttribute('data-lift'); };
        li.addEventListener('mouseenter', function () { lift(true); });
        li.addEventListener('mouseleave', function () { lift(false); });
        li.addEventListener('click', function () { lift(host.getAttribute('data-lift') !== s.id); });
        legend.appendChild(li);
      });
      chart.appendChild(legend);
    }
    // the lifted line: hovering a line's name raises it above the others
    var style = document.createElement('style');
    style.textContent = series.map(function (s) {
      return '#hbt-tcharts[data-lift="' + s.id + '"] .tseries:not([data-series="' + s.id + '"]) { opacity: .12; }' +
             '#hbt-tcharts[data-lift="' + s.id + '"] .tseries[data-series="' + s.id + '"] .tcurve { stroke-width: 3; }' +
             '#hbt-tcharts[data-lift="' + s.id + '"] .tlegend li:not([data-series="' + s.id + '"]) { opacity: .4; }';
    }).join('\n');
    host.appendChild(style);
    host.appendChild(chart);
  }
  function renderSpanCharts() { renderTrends(); }
  var wasNarrow = narrow(), wasWide = 0, resizeTimer = null;
  window.addEventListener('resize', function () {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(function () {
      var h = $('hbt-tcharts'), w = h ? h.clientWidth : 0;
      // a phone's graph is drawn at its width: again when that changes (the phone turned, the folder opened); a screen's
      // to the shape of its room: again whenever the screen is laid out anew (screen.js says so with a resize)
      if (narrow() !== wasNarrow || (narrow() && Math.abs(w - wasWide) > 4) || document.documentElement.classList.contains('screen')) { wasNarrow = narrow(); wasWide = w; renderTrends(); }
      fitAll();
    }, 150);
  });

  /* ----------------------------------------------------------- notes */
  function notesHTML() {
    if (frozen()) {
      return '<div class="note"><b>' + tr('The record closed on') + ' ' + fmtDate(Date.parse(CFG.freezeDate + 'T12:00:00')) + '.</b> ' +
        (state.lastReadAt ? tr('Last reading') + ' ' + fmtDate(state.lastReadAt) + '. ' : '') + tr('Nothing is updated after that.') + '</div>';
    }
    if (state.failure) {
      return '<div class="note alert"><b>' + tr('Could not reach the sensor feed.') + '</b> ' +
        (state.rows.length
          ? tr('Showing the last good data, read') + ' ' + fmtAgo(Date.now() - (state.lastReadAt || Date.now())) + '.'
          : tr('Nothing has been read yet.')) + '</div>';
    }
    var newest = state.rows.length ? state.rows[state.rows.length - 1].t : null;
    if (!state.rows.length) {
      // Nothing to draw. Say which of the possible reasons it is, so nobody
      // stands in front of empty dials wondering whether the page is broken.
      if (state.polledAt === null) return '<div class="note"><b>' + tr(state.source === 'home-assistant' ? 'Waiting for the station\u2019s first read of the habitat sensor.' : 'Waiting for the station\u2019s first read of the sensor node.') + '</b> ' + tr('It polls on start and every') + ' ' + cadence() + '.</div>';
      if (state.source === 'home-assistant' && state.entities) {
        var dark = Object.keys(state.entities).filter(function (k) { var e = state.entities[k]; return e && (e.missing || e.error || e.state === null || e.state === 'unavailable' || e.state === 'unknown'); });
        if (dark.length) return '<div class="note alert"><b>' + tr('Home Assistant has no reading for') + ' ' + dark.map(function (k) { return 'sensor.' + (state.entities[k].id || k); }).join(', ') + '.</b> ' + tr('Check the entity ids in content/home-assistant.json, and that the habitat sensor is on.') + '</div>';
      }
      if (state.nodeRows === 0) return '<div class="note alert"><b>The sensor feed carries no readings for node ' + (state.sensorId || '?') + '.</b> Check CRITICAL_SENSOR_ID in .env — the node may be off, or registered under another id.</div>';
      if (state.nodeNewest && state.floor && state.nodeNewest < state.floor) return '<div class="note alert"><b>No reading from the node since ' + fmtDateTime(state.nodeNewest) + '.</b> The station\'s readings start ' + fmtDateTime(state.floor) + '; nothing the node has sent falls after that.</div>';
      return '<div class="note"><b>' + tr('No readings yet.') + '</b> ' + tr('The station\u2019s readings start') + ' ' + (state.floor ? fmtDateTime(state.floor) : tr('now')) + '; ' + tr('the node\u2019s next transmission will appear here.') + '</div>';
    }
    if (newest && !isCurrent()) {
      var why = newest < dayStart() ? tr('No reading has arrived today.') : (tr('No reading has arrived in the last') + ' ' + Math.round(staleMs() / 60000) + ' ' + tr('minutes') + '.');
      return '<div class="note alert"><b>' + tr(state.source === 'home-assistant' ? 'No current reading from the habitat sensor.' : 'No current reading from the sensor node.') + '</b> ' + why + ' ' + tr('Its last reading was') + ' ' + fmtDateTime(newest) + ' (' + fmtAgo(Date.now() - newest) + '). ' + tr('The tiles stay empty until it transmits again — earlier readings are on the trend graph.') + '</div>';
    }
    return '';
  }
  /* How often the station reads its source, and how old a reading may be
     and still count as current — both said by the station itself. */
  function cadence() {
    var ms = state.pollMs || CFG.refreshMs;
    return ms >= 120000 ? Math.round(ms / 60000) + ' ' + tr('minutes') : Math.round(ms / 1000) + ' s';
  }
  function staleMs() { return state.staleMs || CFG.staleAfterMs; }

  /* The tiles are the habitat now, or nothing. Put them back to their
     empty state — a dash in every figure, no drawing — when there is no
     current reading, so an old number is never left standing as if it were
     live. The history stays on the trend graph, which is where history
     belongs. */
  function clearTiles() {
    TILE_KEYS.forEach(function (k) { renderTile([], k); });                  // a dash, a dark meter and "No current reading" in every tile
  }
  /* The tiles are today: readings since midnight at the venue, and only
     while the newest of them is current — less than a quarter of an hour old
     for the habitat sensor, half an hour for the node (data.staleMs). Anything
     else — nothing today, or nothing in that time — shows nothing. */
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
    return newest !== null && newest >= dayStart() && Date.now() - newest <= staleMs();
  }

  /* ---------------------------------------------------------- render */
  function render() {
    var view = todayRows();
    state.live = false;
    if (!view.length || !isCurrent()) {
      // Nothing current: the tiles say so. The trend graph still draws
      // whatever history there is.
      clearTiles();
      $('hbt-notes').innerHTML = notesHTML();
      renderTrends();
      fitAll();
      return;
    }
    HOST.hidden = false;
    state.live = true;
    TILE_KEYS.forEach(function (k) { renderTile(view, k); });
    renderSpanCharts();
    fitAll();
    $('hbt-notes').innerHTML = notesHTML();
  }

  /* --------------------------------------------------- fetch + timers
     The month once — the days before today one reading in ten minutes, today every reading (src/lib/critical.js,
     rows) —, then only what is new: from an hour before the newest reading this page holds, so that a reading the
     station stores late is still caught (mergeRows folds the copies). The whole month again every hour, and at once
     whenever the station's record has been reset or its first instant has moved. A page that kept the readings from
     an earlier visit (the local store) asks only for what came after them. (8 October: "the website is very heavy to
     load" — this was the whole month, every minute.) */
  var FULL_EVERY = 3600000, OVERLAP = 3600000;
  function refresh() {
    if (state.inFlight) return;
    state.inFlight = true;
    var newest = state.rows.length ? state.rows[state.rows.length - 1].t : 0;
    var part = state.stamp !== undefined && newest > 0 && Date.now() - (state.fullAt || 0) < FULL_EVERY;
    fetch(CFG.url + (part ? '&since=' + Math.floor(newest - OVERLAP) : ''), { cache: 'no-store' })
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
        if (state.stamp !== undefined && state.stamp !== stamp) {
          state.rows = [];
          // what was asked for was only what is new: the record is read again, whole, at once
          if (part) { state.stamp = stamp; state.fullAt = 0; state.nextReadAt = Date.now(); return; }
        }
        state.stamp = stamp;
        if (!part) state.fullAt = Date.now();
        var floor = Number(data.floor) || -Infinity;
        state.rows = mergeRows(state.rows, rows).filter(function (r) { return r.t >= floor; });
        // Prefer the server's own read time; it is the one polling the node.
        var latest = rows.length ? rows[rows.length - 1].t : part ? newest : 0;
        state.lastReadAt = latest || data.lastReadAt || state.lastReadAt;
        state.failure = data.lastError || null;
        state.polledAt = data.lastReadAt || (data.lastError ? data.lastError.at : null) || null;
        state.nodeRows = data.nodeRows === undefined ? null : data.nodeRows;
        state.nodeNewest = data.nodeNewest || null;
        state.floor = Number(data.floor) || null;
        state.sensorId = data.sensorId || null;
        state.source = data.source || 'node';
        state.entities = data.entities || null;
        state.pollMs = Number(data.pollMs) > 0 ? Math.max(15000, Number(data.pollMs)) : null;
        state.staleMs = Number(data.staleMs) > 0 ? Number(data.staleMs) : null;
        saveLocal();
        // After the record closes, this one read of what the station holds
        // is the last: nothing is asked for again. Otherwise the page asks
        // again on the station's own cadence.
        state.nextReadAt = frozen() ? Infinity : Date.now() + (state.pollMs || CFG.refreshMs);
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
  // a drawing's host taking another size — its folder opened, the layout turned — has it drawn again for that size
  if ('ResizeObserver' in window) {
    var ro = new ResizeObserver(function () { clearTimeout(rz); rz = setTimeout(function () { render(); }, 200); });
    TILE_KEYS.forEach(function (k) { var h = $('hbt-m-' + k); if (h) ro.observe(h); });
  }

  // Stored history first, so something shows instantly; the fetch merges on top.
  var stored = loadLocal();
  if (stored.rows.length) {
    state.rows = stored.rows;
    state.stamp = stored.stamp;
    state.fullAt = stored.fullAt;
    state.lastReadAt = stored.savedAt;
    render();
  }
  setInterval(function () {
    if (!state.inFlight && Date.now() >= state.nextReadAt) refresh();
    // the newest reading going out of date between two reads empties the tiles at that moment, not at the next read
    else if (state.live && !isCurrent()) render();
  }, 1000);
  refresh();
})();
