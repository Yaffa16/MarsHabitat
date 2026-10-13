/* THE DASHBOARD REDESIGN, ON TRIAL — /dashboard/next (src/views/pages/dashboard-next.js). The habitat's clock and the
   countdown to the run, by the second; what the crew are doing — the bar of the activity under way and the needle on the
   day's track — by the half minute; and every minute the parts the station renders afresh (/api/dashboard/next): the
   readings, the rooms of the cutaway, the light time, the energy, the hardware — swapped in only when they changed. The
   bar of sections marks the one in view. Nothing here is needed to read the page: without it the page is complete as
   served. Delete this folder with the page. */
(function () {
  'use strict';
  var root = document.getElementById('dn');
  if (!root) return;
  // the cookie card's way back is here, not the current dashboard: tabbar.js writes this page's path into it, which has two
  // parts and /consent takes one — so /dashboard-next, which server.js sends on here (the hash rides along)
  document.addEventListener('submit', function (e) {
    var f = e.target, b = f && f.getAttribute('action') === '/consent' ? f.querySelector('input[name="back"]') : null;
    if (b) b.value = '/dashboard-next' + location.hash;
  }, true);
  if (!window.fetch) return;
  var tz = root.getAttribute('data-tz') || 'Europe/Berlin';
  var poll = Math.max(20000, Number(root.getAttribute('data-poll')) || 60000);
  var opens = Date.parse(root.getAttribute('data-opens') || '') || 0;
  var phase = root.getAttribute('data-phase') || '';
  var version = root.getAttribute('data-v') || '';
  var each = function (sel, fn) { var l = document.querySelectorAll(sel); for (var i = 0; i < l.length; i++) fn(l[i]); };
  var pad = function (n) { return (n < 10 ? '0' : '') + n; };
  var fmt = null;
  try { fmt = new Intl.DateTimeFormat('en-GB', { timeZone: tz, hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' }); } catch (e) { fmt = null; }
  function hms() {
    if (!fmt) { var d = new Date(); return pad(d.getHours()) + ':' + pad(d.getMinutes()) + ':' + pad(d.getSeconds()); }
    return fmt.format(new Date()).replace(/^24/, '00');
  }
  function nowMinutes() { var p = hms().split(':'); return Number(p[0]) * 60 + Number(p[1]); }

  /* the clock and the countdown */
  var turning = false;
  function tick() {
    var t = hms();
    each('[data-dn-clock]', function (el) { el.textContent = t; });
    each('[data-dn-clock-hm]', function (el) { el.textContent = t.slice(0, 5); });
    if (phase === 'PRE_LAUNCH' && opens) {
      var left = opens - Date.now();
      if (left <= 0 && !turning) { turning = true; setTimeout(refresh, 1500); }           // the station says when the run has begun
      var s = Math.max(0, Math.floor(left / 1000));
      var txt = Math.floor(s / 86400) + ' d ' + pad(Math.floor(s % 86400 / 3600)) + ':' + pad(Math.floor(s % 3600 / 60)) + ':' + pad(s % 60);
      each('[data-dn-count]', function (el) { el.textContent = txt; });
    }
  }

  /* the activity under way: its minutes and its bar; the needle on the day's track */
  function progress() {
    var now = nowMinutes();
    each('[data-dn-span]', function (el) {
      var p = el.getAttribute('data-dn-span').split(','), a = Number(p[0]), b = Number(p[1]), len = Math.max(1, b - a);
      var gone = Math.max(0, Math.min(len, now - a));
      var g = el.querySelector('[data-dn-gone]'); if (g) g.textContent = gone;
      var card = el.parentNode, bar = card && card.querySelector('.dn-now-bar i');
      if (bar) bar.style.width = (gone / len * 100).toFixed(1) + '%';
    });
    each('[data-dn-needle]', function (el) {
      var p = el.getAttribute('data-dn-needle').split(','), a = Number(p[0]), b = Number(p[1]);
      if (now >= a && now <= b) el.style.left = ((now - a) / (b - a) * 100).toFixed(2) + '%';
    });
  }

  /* the live parts */
  var busy = false;
  function set(key, html) {
    if (typeof html !== 'string') return;
    each('[data-dn-part="' + key + '"]', function (el) { el.innerHTML = html; });
  }
  function refresh() {
    if (busy || document.hidden) return;
    busy = true;
    fetch('/api/dashboard/next', { cache: 'no-store', credentials: 'same-origin' })
      .then(function (r) { return r.ok ? r.json() : null; })
      .then(function (d) {
        busy = false;
        if (!d || !d.parts) return;
        // the run began (or ended) under the open page: come back as what the station is now
        if (d.phase && phase && d.phase !== phase) { window.location.reload(); return; }
        set('link', d.parts.link); set('linkcard', d.parts.linkcard);
        if (d.v && d.v === version) return;
        version = d.v || '';
        ['now', 'chips', 'air', 'lifestatus', 'energy', 'hw'].forEach(function (k) { set(k, d.parts[k]); });
        progress();
      })
      .catch(function () { busy = false; });
  }

  /* the bar of sections: under the header, the one in view marked */
  var head = document.querySelector('.ticker');
  function measure() { if (head) document.body.style.setProperty('--dn-top', Math.round(head.getBoundingClientRect().height) + 'px'); }
  measure();
  window.addEventListener('resize', measure);
  var tabs = [].slice.call(document.querySelectorAll('.dn-tabs a'));
  var targets = tabs.map(function (a) { return document.getElementById(a.getAttribute('href').slice(1)); });
  function mark() {
    var line = (head ? head.getBoundingClientRect().height : 0) + 140, on = 0;
    for (var i = 0; i < targets.length; i++) if (targets[i] && targets[i].getBoundingClientRect().top <= line) on = i;
    tabs.forEach(function (a, i) { a.classList.toggle('is-on', i === on); });
    var t = tabs[on], strip = t && t.parentNode;
    if (strip && strip.scrollWidth > strip.clientWidth) {
      var l = t.offsetLeft - strip.offsetLeft, r = l + t.offsetWidth;
      if (l < strip.scrollLeft || r > strip.scrollLeft + strip.clientWidth) strip.scrollLeft = Math.max(0, l - 24);
    }
  }
  var raf = 0;
  window.addEventListener('scroll', function () { if (!raf) raf = requestAnimationFrame(function () { raf = 0; mark(); }); }, { passive: true });
  mark();

  tick(); progress();
  setInterval(tick, 1000);
  setInterval(progress, 30000);
  setInterval(refresh, poll);
  document.addEventListener('visibilitychange', function () { if (!document.hidden) { tick(); progress(); refresh(); } });
})();
