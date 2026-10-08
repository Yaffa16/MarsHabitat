/* MARS!platz — the installation's Livestream screen (src/views/pages/screens.js, livestream; public/screen.css).
 *
 * The habitat's stream, full screen, playing by itself (8 October: "add a page called Livestream — this stream embedded,
 * playing automatically, with a play button"). The stream comes through the station (server.js,
 * /screen/livestream/stream.m3u8): hls.js plays it where the browser has Media Source (public/vendor/hls.min.js), the
 * browser itself where it plays HLS on its own (Safari). It starts at once — with its sound where the screen lets a page
 * play sound unasked (a kiosk browser set so), else muted, the Sound on key in the corner; and should even that be
 * refused, the large play key in the middle. The play key stands whenever the stream stands still. LIVE in the corner
 * while it plays. Off the air, or the station out of reach: a word, and the stream is taken up again every ten seconds;
 * a stream that stops moving while it should play is taken up again after half a minute. A stream of sound alone shows
 * the station's name and its rings rather than a black picture. The page's own reloads (screen.js) wait while it plays.
 * Nothing here is ever sent anywhere. */
(function () {
  'use strict';
  var root = document.getElementById('screen-live'); if (!root) return;
  var video = document.getElementById('live-video');
  var badge = document.getElementById('live-badge'), word = document.getElementById('live-word');
  var playKey = document.getElementById('live-play'), soundKey = document.getElementById('live-sound');
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

  // playing by itself: with its sound where the screen allows it, else without, the key to turn it on beside it
  function play() {
    video.muted = false;
    var p = video.play();
    if (p && p.then) p.then(null, function () {
      video.muted = true;
      var q = video.play();
      if (q && q.then) q.then(null, function () { show(playKey, true); });
    });
  }

  playKey.addEventListener('click', function () {
    video.muted = false;
    var p = video.play();
    if (p && p.then) p.then(null, function () { video.muted = true; video.play(); });
  });
  soundKey.addEventListener('click', function () {
    video.muted = false; video.volume = 1;
    if (video.paused) video.play();
  });

  video.addEventListener('playing', function () { playedOnce = true; say(''); show(badge, true); show(playKey, false); });
  video.addEventListener('pause', function () { show(badge, false); if (!video.ended) show(playKey, true); });
  video.addEventListener('volumechange', function () { show(soundKey, video.muted); });
  video.addEventListener('loadedmetadata', function () { root.classList.toggle('is-audio', !video.videoWidth); });
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
})();
