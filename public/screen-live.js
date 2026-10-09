/* MARS!platz — the installation's Livestream screen (src/views/pages/screens.js, livestream; public/screen.css).
 *
 * The habitat's stream, full screen, playing by itself (8 October: "add a page called Livestream — this stream embedded,
 * playing automatically, with a play button"). The stream comes through the station (server.js,
 * /screen/livestream/stream.m3u8): hls.js plays it where the browser has Media Source (public/vendor/hls.min.js), the
 * browser itself where it plays HLS on its own (Safari). It plays without its sound, always (8 October: "remove the
 * sound from the livestream page") — which every browser lets a page start unasked; should even that be refused, the
 * large play key in the middle. The play key stands whenever the stream stands still. LIVE in the HUD's corner while it
 * plays. Off the air, or the station out of reach: a word, and the stream is taken up again every ten seconds; a stream
 * that stops moving while it should play is taken up again after half a minute. A stream of sound alone shows the
 * station's name and its rings rather than a black picture. The page's own reloads (screen.js) wait while it plays.
 *
 * The space HUD round it (8 October): the picture framed in its four brackets, in its own shape (9 October: "frame the
 * image inside the brackets" — shape(), below); the venue's clock to the second, the day of the run and the date — kept
 * current here, since the page is not reloaded while the stream plays. Nothing here is ever sent anywhere. */
(function () {
  'use strict';
  var root = document.getElementById('screen-live'); if (!root) return;
  var video = document.getElementById('live-video');
  var badge = document.getElementById('live-badge'), word = document.getElementById('live-word');
  var playKey = document.getElementById('live-play');
  var src = root.getAttribute('data-src');
  var tt = window.t || function (s) { return s; };
  var hls = null, again = 0, lastT = -1, lastMove = Date.now(), playedOnce = false;

  function show(el, on) { if (el) el.hidden = !on; }
  function say(words) { if (!word) return; word.textContent = words || ''; word.hidden = !words; }

  function detach() {
    clearTimeout(again);
    if (hls) { try { hls.destroy(); } catch (e) { /* gone */ } hls = null; }
    video.removeAttribute('src');
    try { video.load(); } catch (e) { /* nothing loaded */ }
  }
  // off the air, or the station out of reach: said, and tried again in ten seconds
  function offAir() {
    detach();
    show(badge, false); show(playKey, false);
    say(tt('The livestream is not on air right now — it comes back by itself.'));
    again = setTimeout(attach, 10000);
  }
  function attach() {
    detach();
    say(tt('Connecting to the livestream…'));
    lastMove = Date.now();
    if (window.Hls && window.Hls.isSupported()) {
      hls = new window.Hls({ liveSyncDurationCount: 3, backBufferLength: 30, manifestLoadingMaxRetry: 2, levelLoadingMaxRetry: 4, fragLoadingMaxRetry: 6 });
      hls.on(window.Hls.Events.MANIFEST_PARSED, play);
      hls.on(window.Hls.Events.ERROR, function (ev, data) {
        if (!data || !data.fatal) return;                          // hls.js mends the small things itself
        if (data.type === window.Hls.ErrorTypes.MEDIA_ERROR) { try { hls.recoverMediaError(); return; } catch (e) { /* taken up again below */ } }
        offAir();
      });
      hls.loadSource(src);
      hls.attachMedia(video);
    } else if (video.canPlayType('application/vnd.apple.mpegurl')) {
      video.src = src;
      video.addEventListener('loadedmetadata', play, { once: true });
    } else {
      say(tt('This screen’s browser cannot play the livestream.'));
    }
  }

  // playing by itself, without its sound; refused even so, the play key
  function play() {
    video.muted = true;
    var p = video.play();
    if (p && p.then) p.then(null, function () { show(playKey, true); });
  }

  playKey.addEventListener('click', function () {
    video.muted = true;
    var p = video.play();
    if (p && p.then) p.then(null, function () { /* the key stays */ });
  });
  // the sound stays off, whatever asks for it (a kiosk's media keys, the browser's own controls)
  video.addEventListener('volumechange', function () { if (!video.muted) video.muted = true; });

  video.addEventListener('playing', function () { playedOnce = true; say(''); show(badge, true); show(playKey, false); });
  video.addEventListener('pause', function () { show(badge, false); if (!video.ended) show(playKey, true); });
  video.addEventListener('loadedmetadata', function () { root.classList.toggle('is-audio', !video.videoWidth); shape(); });
  // the frame takes the picture's own shape (9 October: "frame the image inside the brackets"): 16:9 until the stream
  // says otherwise, and again whenever its picture changes size
  function shape() { if (video.videoWidth && video.videoHeight) root.style.setProperty('--ar', (video.videoWidth / video.videoHeight).toFixed(4)); }
  video.addEventListener('resize', shape);
  video.addEventListener('timeupdate', function () {
    if (video.currentTime !== lastT) { lastT = video.currentTime; lastMove = Date.now(); }
  });
  video.addEventListener('error', function () { if (!hls) offAir(); });   // the browser's own player gave up
  // a stream that stops moving for half a minute while it should play is taken up again from the station
  setInterval(function () {
    if (!video.paused && Date.now() - lastMove > 30000) { lastMove = Date.now(); attach(); }
  }, 5000);

  // the page's reloads wait while the stream plays (a reload would break it off); stopped, it may be reloaded
  window.MCSScreenBusy = function () { return playedOnce && !video.paused; };

  attach();

  /* ---- the HUD's clock and day, in the venue's zone and the screen's language */
  var tz = root.getAttribute('data-tz') || 'Europe/Berlin', lang = root.getAttribute('data-lang') || 'de';
  var start = root.getAttribute('data-start') || '', days = Number(root.getAttribute('data-days')) || 13;
  var opens = Date.parse(root.getAttribute('data-opens') || '') || 0, over = root.getAttribute('data-over') === '1';
  var clockEl = document.getElementById('hud-clock'), solEl = document.getElementById('hud-sol'), dateEl = document.getElementById('hud-date');
  var LOCALE = { de: 'de-DE', fr: 'fr-FR', en: 'en-GB' }[lang] || 'de-DE';
  var pad = function (n) { return (n < 10 ? '0' : '') + n; };
  function venueDate(d) {                                            // 'YYYY-MM-DD' at the venue
    try { return new Intl.DateTimeFormat('en-CA', { timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit' }).format(d); }
    catch (e) { return d.toISOString().slice(0, 10); }
  }
  var lastDay = '';
  function hud() {
    var now = new Date();
    if (clockEl) {
      try { clockEl.textContent = new Intl.DateTimeFormat('en-GB', { timeZone: tz, hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false }).format(now); }
      catch (e) { clockEl.textContent = pad(now.getHours()) + ':' + pad(now.getMinutes()) + ':' + pad(now.getSeconds()); }
    }
    var today = venueDate(now);
    if (today === lastDay && !(opens && now.getTime() < opens)) return;   // the day changes at midnight; the countdown by the minute
    lastDay = today;
    if (dateEl) {
      try { dateEl.textContent = new Intl.DateTimeFormat(LOCALE, { timeZone: tz, weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }).format(now); }
      catch (e) { dateEl.textContent = today; }
    }
    if (solEl && start) {
      var n = Math.round((Date.parse(today + 'T12:00:00Z') - Date.parse(start + 'T12:00:00Z')) / 864e5) + 1;
      if (over || n > days) solEl.textContent = tt('Mission complete');
      else if (n >= 1) solEl.textContent = 'SOL ' + pad(n) + ' / ' + pad(days);
      else solEl.textContent = 'T\u2212' + Math.max(0, Math.floor(((opens || Date.parse(start + 'T00:00:00Z')) - now.getTime()) / 864e5)) + 'D';   // as the ticker counts
    }
  }
  hud();
  setInterval(hud, 1000);
})();
