/* MARS!platz — the installation's writing screen (src/views/pages/screens.js, write; public/screen.css).
 *
 * The composer full screen, in the square. composer.js does the writing and the sending (the form posts to the
 * screen's own address, server.js POST /screen/write, and every message is a new visitor's). This keeps the screen
 * tidy between people: what was left half-written is cleared after a while with nobody touching the screen (IDLE),
 * the tags with it; and the page's own reloads (screen.js: every five minutes, at midnight) wait while someone is
 * writing or a message is crossing (MCSScreenBusy). Nothing here is sent anywhere. */
(function () {
  'use strict';
  var device = document.querySelector('.composer-device'); if (!device) return;
  var IDLE = 3 * 60 * 1000, last = Date.now();
  function box() { return device.querySelector('form.composer:not(.ghost) textarea[name=body]'); }
  function busy() {
    var ta = box();
    return !!(ta && ta.value.trim()) || device.classList.contains('sending') || Date.now() - last < 20000;
  }
  window.MCSScreenBusy = busy;
  ['input', 'keydown', 'pointerdown', 'touchstart', 'change'].forEach(function (ev) {
    document.addEventListener(ev, function () { last = Date.now(); }, true);
  });
  setInterval(function () {
    var ta = box();
    if (!ta || Date.now() - last < IDLE) return;
    if (ta.value) { ta.value = ''; ta.dispatchEvent(new Event('input', { bubbles: true })); }
    [].forEach.call(device.querySelectorAll('.tags input[type=checkbox]'), function (b) { b.checked = false; b.disabled = false; });
    if (document.activeElement === ta) ta.blur();
  }, 15000);
})();
