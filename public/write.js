/* MARS!platz — the composer's pop-up (src/views/layout.js, writeKit; src/views/pages/public.js, portal): the composer
 * in a box over the page, on every public page. On a wider screen (a phone has the box as the Write page's dock at the
 * foot of the screen, public/tabbar.js — nothing here runs there):
 *  - any #write door on the page opens it, with the hand in its box (the note's, the chat's); /write#write — the
 *    header's Write key — opens the Write page with it open, and on the Write page that key opens it in place (the
 *    Write key that floated at the foot of the window is gone, October: "remove the floating Write to the crew button");
 *  - its cross, Escape, and a click on the page beside it close it — the words written stay, the box only folds away;
 *  - a message sent from it crosses in it (composer.js swaps the dial in), with a Message Board key: on the Write page
 *    the key closes the box and brings the wall into view, where the note just sent stands at the head; elsewhere it
 *    leads to the Write page. Once the message has arrived the box closes by itself and the wall is brought into view
 *    on the Write page, and any other page goes to the Write page's wall (October: the board, as soon as the message
 *    is through).
 *  A page opened while a message is still crossing keeps the box closed (the note stands on the wall, in transit);
 *  #write opens it on the crossing.
 */
(function () {
  'use strict';
  var pop = document.getElementById('write'); if (!pop || !pop.classList.contains('portal-pop')) return;
  var onWrite = document.body.classList.contains('write');
  var opener = null;                                                           // the door it was opened by: the focus goes back to it
  var upright = window.matchMedia ? window.matchMedia('(max-width: 760px) and (min-height: 521px)') : null;
  var phone = function () { return !!(upright && upright.matches); };
  var isOpen = function () { return pop.classList.contains('is-open'); };
  var box = function () { return pop.querySelector('form.composer:not(.ghost) textarea'); };
  function setOpen(open, focus) {
    pop.classList.toggle('is-open', open);
    document.body.classList.toggle('write-open', open);
    if (open && focus) { var b = box(); if (b) setTimeout(function () { try { b.focus({ preventScroll: true }); } catch (e) { b.focus(); } }, 260); }
  }
  // opened by its door
  if (!phone() && location.hash === '#write') setOpen(true, true);
  window.addEventListener('hashchange', function () { if (!phone() && location.hash === '#write') setOpen(true, true); });
  document.addEventListener('click', function (e) {
    if (phone() || !e.target.closest) return;
    // the Message Board key in the crossing: on the Write page the wall is right here
    var board = e.target.closest('.transit-board');
    if (board) {
      if (!onWrite) return;                                                     // elsewhere the key is the link it says
      e.preventDefault(); setOpen(false, false);
      var wall = document.getElementById('exchanges'); if (wall) wall.scrollIntoView({ behavior: 'smooth', block: 'start' });
      return;
    }
    // any #write door; on the Write page the header's Write key too
    var a = e.target.closest('a[href="#write"], a[href="/#write"]' + (onWrite ? ', a[href="/write#write"]' : ''));
    if (a) {
      e.preventDefault();
      opener = a;
      setOpen(true, true);
      if (location.hash !== '#write') history.replaceState(null, '', '#write');
      return;
    }
    if (!isOpen()) return;
    if (pop.contains(e.target) || e.target.closest('.ticker, .journey, dialog, .tabbar')) return;
    setOpen(false, false);                                                      // a click on the page beside it
  });
  pop.addEventListener('click', function (e) {                                  // the cross at its top right
    if (phone() || !e.target.closest || !e.target.closest('.dev-close')) return;
    e.preventDefault(); setOpen(false, false); if (opener && opener.isConnected) opener.focus({ preventScroll: true });
  });
  document.addEventListener('keydown', function (e) { if (e.key === 'Escape' && !phone() && isOpen()) setOpen(false, false); });
  // once the message has arrived — the dial says ARRIVED and holds a moment (composer.js, mcs:arrived) — the visitor is
  // taken to the board (October: "as soon as the message is transmitted fully, close the pop-up and go to the message
  // board; do not show the write box again"): before the empty composer could come back, on the Write page the window
  // closes by itself and the wall comes into view, the note just sent at its head; on any other page the Write page
  // opens on the wall
  var leaving = false;
  function leave() {
    if (leaving) return; leaving = true;
    if (!onWrite) { window.location.href = '/write#exchanges'; return; }
    if (isOpen()) setOpen(false, false);
    if (location.hash === '#write') history.replaceState(null, '', '#exchanges');   // a reload would open the window again otherwise
    var wall = document.getElementById('exchanges'); if (wall) wall.scrollIntoView({ behavior: 'smooth', block: 'start' });
    setTimeout(function () { leaving = false; }, 1500);
  }
  document.addEventListener('mcs:arrived', function (e) {
    if (phone()) return;
    var hold = Math.max(300, (e.detail && e.detail.hold) || 2600);
    setTimeout(leave, hold - 250);                                             // a breath before the swap: the box is never seen again
  });
  var stage = document.getElementById('dev-body');                             // the window's stage: the composer, or the crossing
  if (stage && window.MutationObserver) {
    var crossing = !!stage.querySelector('.transit-block');
    new MutationObserver(function () {
      var now = !!stage.querySelector('.transit-block');
      if (crossing && !now && !phone() && isOpen()) leave();                   // the swap came first (an old browser): leave now
      crossing = now;
    }).observe(stage, { childList: true });
  }
})();
