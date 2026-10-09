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

  /* The box keeps one size (9 October: "does the size of the box change when the message has been delivered? Do not have
     this effect — keep the box the same size"). The crossing's view is shorter than the form, and the day's question
     goes while a message crosses: the box shrank as the message left, grew on the screen the moment it arrived (the
     screen's fitting, screen.js, gave the shorter piece a larger scale as soon as the crossing stood still) and shrank
     back with the form. Its height with the form is now held as its least through the crossing and the arrival — the
     dial in the middle of the room the form had — so the box stands as it stood and the fitting gives it the same scale.
     Measured with the form alone, again whenever the form comes back or the box is laid out anew. */
  function holdSize() {
    if (device.classList.contains('sending') || !box()) return;
    var was = device.style.minHeight;
    device.style.minHeight = '';
    var h = device.offsetHeight;                                           // (the layout's pixels, whatever the screen's zoom)
    device.style.minHeight = h > 0 ? h + 'px' : was;
  }
  var again = null;
  function soon() { clearTimeout(again); again = setTimeout(holdSize, 60); }
  holdSize();
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(holdSize);
  window.addEventListener('resize', soon);
  if (window.MutationObserver) {
    var body = device.querySelector('.dev-body');
    if (body) new MutationObserver(soon).observe(body, { childList: true });   // the form back after the crossing
  }
})();
