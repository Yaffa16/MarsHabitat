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
  /* ?probe=1 on the address (9 October, the kiosk at the venue, where the key seemed deaf): a small log at the foot of the
     screen of what the browser hands the page for every press — down, up, click, and on what; a press, a release and no
     click says the screen's browser (or what shows the page) sends no clicks, which the key and the tags no longer need.
     Nothing in it leaves the screen. */
  if (/[?&]probe=1(&|$)/.test(location.search)) {
    var log = document.createElement('div'), lines = [];
    log.setAttribute('style', 'position:fixed;left:8px;bottom:8px;z-index:99;max-width:60vw;padding:8px 10px;border-radius:8px;background:rgba(0,0,0,.82);color:#9f9;font:12px/1.35 ui-monospace,Menlo,Consolas,monospace;pointer-events:none;white-space:pre');
    document.body.appendChild(log);
    var what = function (el) {
      if (!el || !el.tagName) return '?';
      var c = typeof el.className === 'string' && el.className ? '.' + el.className.trim().split(/\s+/).slice(0, 2).join('.') : '';
      return el.tagName.toLowerCase() + c;
    };
    var note = function (txt) {
      var d = new Date();
      lines.push(('0' + d.getMinutes()).slice(-2) + ':' + ('0' + d.getSeconds()).slice(-2) + '.' + ('00' + d.getMilliseconds()).slice(-3) + ' ' + txt);
      if (lines.length > 12) lines.shift();
      log.textContent = lines.join('\n');
    };
    ['pointerdown', 'pointerup', 'pointercancel', 'mousedown', 'mouseup', 'click', 'touchstart', 'touchend', 'submit'].forEach(function (type) {
      document.addEventListener(type, function (e) {
        note(type + ' ' + what(e.target) + (e.pointerType ? ' ' + e.pointerType : '') + (typeof e.button === 'number' && type.indexOf('touch') < 0 ? ' b' + e.button : '') + (typeof e.detail === 'number' && /mouse|click/.test(type) ? ' n' + e.detail : '') + (e.defaultPrevented ? ' (held)' : ''));
      }, true);
    });
    document.addEventListener('mcs:sending', function () { note('→ SENDING'); });
    note('probe on — ' + navigator.userAgent.replace(/^Mozilla\/5\.0 /, '').slice(0, 90));
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
