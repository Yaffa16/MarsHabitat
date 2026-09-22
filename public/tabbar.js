/* MARS!platz — the bottom bar on a phone (src/views/layout.js, tabbar()),
 * and the little a phone held upright needs besides.
 *
 * Five keys under the thumb: Home (the landing page), Dashboard, Write (the
 * messages page — the composer and the board) and Media, which are pages of
 * their own — the landing page keeps the dashboard and the portal for wider
 * screens only — and More, which opens the ticker's menu — the same list the
 * three-lines button opens on a wider screen — as a sheet from the foot of
 * the screen. The bar is drawn on every public page; the stylesheet shows it
 * only on a phone held upright, and what follows runs only there:
 *  - every door into the portal or the dashboard (the dome's keys, a link
 *    into #write or #habitat) leads to the messages page or the dashboard
 *    page instead, since the landing page shows neither;
 *  - on the messages page the composer is a pop-up over the foot of the
 *    screen: /messages#write opens the page with it shown, the Write key
 *    shows and hides it, a touch on the page beside it (or Escape) hides
 *    it; its writing box grows with the text, while the keyboard is up the
 *    bar of keys steps aside and the pop-up rides the keyboard's edge, and a
 *    press on Transmit brings the board's head into view, where the message
 *    just sent appears while the pop-up, keeping its size, shows the crossing.
 */
(function () {
  var upright = window.matchMedia ? window.matchMedia('(max-width: 760px) and (min-height: 521px)') : null;
  var phone = function () { return !!(upright && upright.matches); };
  var onUpright = function (fn) { if (!upright) return; if (upright.addEventListener) upright.addEventListener('change', fn); else if (upright.addListener) upright.addListener(fn); };

  // the cookie question sends the visitor back to where they were — with the hash, which only the browser knows
  var back = document.querySelector('#consent input[name="back"]');
  if (back) back.value = location.pathname + location.search + location.hash;

  var bar = document.querySelector('.tabbar');
  // More: the ticker's menu, opened and closed through its own button so the two never disagree
  var more = bar && bar.querySelector('.tab-more'), menu = document.getElementById('tk-menu'), drop = document.getElementById('tk-dropdown');
  if (more && menu && drop) {
    more.addEventListener('click', function (e) { e.stopPropagation(); menu.click(); });
    var sync = function () { more.setAttribute('aria-expanded', drop.hidden ? 'false' : 'true'); more.classList.toggle('is-open', !drop.hidden); };
    new MutationObserver(sync).observe(drop, { attributes: true, attributeFilter: ['hidden'] });
    sync();
  }

  // the doors into the portal and the dashboard lead to their pages on a phone held upright — the composer's doors with it open
  var DASH = /^\/?#(mission|habitat|hardware|trends|schedule|galley|crew|blog-commander|blog-health|blog-science)$/;
  function doors() {
    if (!phone() || document.body.classList.contains('dashboard')) return;      // on the dashboard page a link into a panel is right as it is
    [].forEach.call(document.querySelectorAll('a[href^="#"], a[href^="/#"]'), function (a) {
      var href = a.getAttribute('href');
      if (a.closest('.tabbar') || a.classList.contains('masthead-btn')) return;   // the masthead's doors have twins for the phone (aura.css)
      if (/^\/?#write$/.test(href)) a.setAttribute('href', '/messages#write');
      else if (/^\/?#exchanges$/.test(href)) a.setAttribute('href', '/messages');
      else if (DASH.test(href)) a.setAttribute('href', '/dashboard' + href.replace(/^\//, ''));
    });
  }
  doors();
  onUpright(doors);

  // the messages page's pop-up
  var dock = document.body.classList.contains('messages') && document.querySelector('.portal-main');
  if (dock) {
    var writeKey = bar && bar.querySelector('.tab-write');
    var isOpen = function () { return dock.classList.contains('is-open'); };
    // a phone's keyboard covers the lower part of the page without shrinking it, and only the visible part (the visual
    // viewport) says where the keyboard's edge is: the keyboard is up when the visible part is shorter than the window
    // by more than a thumb (pinched in, the visible part is small for another reason)
    var vv = window.visualViewport;
    var kbGap = function () {
      if (!vv || !phone() || (vv.scale && vv.scale > 1.01)) return 0;
      var gap = window.innerHeight - (vv.height + vv.offsetTop);
      return gap > 120 ? gap : 0;
    };
    var room = function () {                                                     // the list ends above the pop-up, not under it
      document.body.style.setProperty('--dock-h', (dock.getBoundingClientRect().height + kbGap()) + 'px');
    };
    var setOpen = function (open, focus) {
      dock.classList.toggle('is-open', open);
      document.body.classList.toggle('dock-open', open);
      if (writeKey) writeKey.setAttribute('aria-expanded', open ? 'true' : 'false');
      if (open) {
        room();
        var box = dock.querySelector('form.composer:not(.ghost) textarea');
        if (focus && box) setTimeout(function () { try { box.focus({ preventScroll: true }); } catch (e) { box.focus(); } }, 320);
      }
    };
    if (window.ResizeObserver) new ResizeObserver(function () { if (isOpen()) room(); }).observe(dock);
    setOpen(location.hash === '#write' || !phone(), false);                      // opened by its door; a wider screen simply has it
    window.addEventListener('hashchange', function () { if (phone() && location.hash === '#write') setOpen(true, true); });   // a door on this page
    if (writeKey) writeKey.addEventListener('click', function (e) {
      if (!phone()) return;                                                      // sideways the key is the link it says
      e.preventDefault();
      setOpen(!isOpen(), !isOpen());
    });
    document.addEventListener('click', function (e) {                            // a touch beside the pop-up closes it
      if (!phone() || !isOpen()) return;
      if (dock.contains(e.target) || (bar && bar.contains(e.target))) return;
      setOpen(false, false);
    });
    document.addEventListener('keydown', function (e) { if (e.key === 'Escape' && phone() && isOpen()) setOpen(false, false); });
    onUpright(function () { setOpen(isOpen() || !phone(), false); });

    // the keyboard: while it is up the bar of keys steps aside (aura.css, body.kb) and the pop-up is seated on the
    // keyboard's upper edge, so what is typed is in view. Read from the viewport, never from the focus: the focus leaves
    // the box the moment Transmit is touched, and a pop-up that moved at that moment would take the button from under
    // the finger; the keyboard folds away a moment later, and the pop-up follows it down then.
    var seated = 0;
    var seat = function () {
      var gap = kbGap();
      if (gap === seated) return;                                                // the visible part scrolls far more often than it changes size
      seated = gap;
      document.body.classList.toggle('kb', gap > 0);
      dock.style.bottom = gap > 0 ? gap + 'px' : '';
      boxes().forEach(grow);                                                     // the box keeps the pop-up within the visible part
      if (isOpen()) room();
    };
    if (vv) { vv.addEventListener('resize', seat); vv.addEventListener('scroll', seat); }

    // the writing box grows with its text
    var grow = function (box) {
      if (!phone()) { box.style.height = ''; return; }
      var base = 216, cap = 320;                                                 // the box at rest: seven lines; it grows with the text to nine
      if (kbGap() > 0) {                                                         // the keyboard up: the box is what fits between the top bar and the keyboard
        var dev = box.closest('.device'), bar = document.querySelector('.ticker');
        var around = dev ? dev.getBoundingClientRect().height - box.getBoundingClientRect().height : 200;
        base = cap = Math.max(120, Math.min(216, vv.height - (bar ? bar.getBoundingClientRect().bottom : 0) - around - 8));
      }
      box.style.height = '0px';                                                  // measured from nothing, whatever rows the box was given
      box.style.height = Math.min(cap, Math.max(base, box.scrollHeight)) + 'px';
    };
    var boxes = function () { return [].slice.call(document.querySelectorAll('.composer-device form.composer:not(.ghost) textarea')); };
    document.addEventListener('input', function (e) { if (e.target && e.target.matches && e.target.matches('.composer-device textarea')) grow(e.target); });
    // the pop-up keeps its size through the crossing: the transit display that takes the form's place (composer.js, swap)
    // is given the room the form had when Transmit was pressed — the pop-up's height then, less its title and head as
    // they are now — and sits centred in it; the form that comes back after the crossing has its own size again
    var stage = document.getElementById('dev-body'), device = stage && stage.closest('.device'), held = 0;
    var hold = function () {
      if (!stage || !device) return;
      var transit = stage.querySelector('.transit-block');
      document.body.classList.toggle('crossing', !!transit);                    // aura.css: the list blurred while writing, clear while crossing
      stage.style.minHeight = ''; stage.classList.remove('is-held');
      if (!transit) { held = 0; return; }
      if (!held || !phone()) return;
      var own = stage.getBoundingClientRect().height;
      var want = held - (device.getBoundingClientRect().height - own);
      if (want > own) { stage.style.minHeight = want + 'px'; stage.classList.add('is-held'); }
    };
    if (stage) new MutationObserver(function () { boxes().forEach(grow); hold(); }).observe(stage, { childList: true });   // the form comes back after a crossing
    boxes().forEach(grow); hold();
    onUpright(function () { boxes().forEach(grow); hold(); });
    // Transmit: the pop-up's size is noted, and the board's head comes into view, where the message just sent appears
    // under MY MESSAGES while the pop-up shows the crossing
    document.addEventListener('submit', function (e) {
      if (!phone() || !e.target.matches || !e.target.matches('.composer-device form.composer')) return;
      held = device ? Math.round(device.getBoundingClientRect().height) : 0;
      var feed = document.getElementById('feed'); if (!feed) return;
      var top = feed.getBoundingClientRect().top + window.pageYOffset - 92;
      window.scrollTo({ top: Math.max(0, top), behavior: 'smooth' });
    });
  }
})();
