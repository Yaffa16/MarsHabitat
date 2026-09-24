/* Mission control. One page: the reply queue at the top, the day's editing
   work in tabs beneath. No framework, no dependencies, no external requests. */

/* ------------------------------------------------------------------ tabs */
/* The four officer/habitat panes are all in the page; the tab bar only
   chooses which is visible. The address is kept in step so a save, which
   round-trips through the server, lands back on the same tab. Without
   JavaScript the tab links still work — they are ordinary links. */
(function () {
  'use strict';
  var bar = document.getElementById('tabs');
  if (!bar) return;
  var tabs = Array.prototype.slice.call(bar.querySelectorAll('a[data-tab]'));
  var panes = Array.prototype.slice.call(document.querySelectorAll('.tab-pane[data-pane]'));

  function show(key) {
    tabs.forEach(function (t) {
      var on = t.getAttribute('data-tab') === key;
      t.classList.toggle('on', on);
      t.setAttribute('aria-selected', on ? 'true' : 'false');
    });
    panes.forEach(function (p) { p.classList.toggle('on', p.getAttribute('data-pane') === key); });
    // the messages queue is not a day's work: no day picker there
    var dp = document.querySelector('.daypick-wrap'); if (dp) dp.hidden = key === 'messages';
    // Day-picker links follow the tab, so changing day keeps you where you were.
    document.querySelectorAll('.daypick a[data-day]').forEach(function (a) {
      a.setAttribute('href', '/control?tab=' + key + '&day=' + a.getAttribute('data-day') + '#work');
    });
  }

  bar.addEventListener('click', function (e) {
    var a = e.target.closest ? e.target.closest('a[data-tab]') : null;
    if (!a) return;
    e.preventDefault();
    var key = a.getAttribute('data-tab');
    show(key);
    try { history.replaceState(null, '', a.getAttribute('href')); } catch (err) { /* fine */ }
  });
})();

/* ----------------------------------------------------------------- queue */
(function () {
  'use strict';

  // Ctrl+Enter (Cmd+Enter on a Mac) in a reply box sends and publishes, so a
  // reply is one keystroke from the last word rather than a reach for the mouse.
  document.querySelectorAll('form.reply').forEach(function (form) {
    var box = form.querySelector('textarea');
    var send = form.querySelector('button[value="publish"]');
    if (!box || !send) return;
    box.addEventListener('keydown', function (e) {
      if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) { e.preventDefault(); send.click(); }
    });
    // The box grows with the reply instead of scrolling inside two lines.
    // never below four lines (the stylesheet's min-height holds too), never above 400px
    var grow = function () { box.style.height = 'auto'; box.style.height = Math.max(112, Math.min(400, box.scrollHeight + 2)) + 'px'; };
    box.addEventListener('input', grow);
    grow();
  });

  // Destructive forms ask first.
  document.querySelectorAll('form[data-confirm]').forEach(function (form) {
    form.addEventListener('submit', function (e) {
      if (!window.confirm(form.getAttribute('data-confirm'))) e.preventDefault();
    });
  });

  // A message arriving while the desk is open is announced, not discovered on
  // the next reload. Polls the count only; the page is not rebuilt underneath
  // someone who is mid-reply.
  var queue = document.getElementById('queue');
  var banner = document.getElementById('queue-new');
  var text = document.getElementById('queue-new-text');
  if (!queue || !banner) return;
  var known = Number(queue.getAttribute('data-waiting') || 0);
  var wait = 8000;
  function poll() {
    if (document.hidden || !window.fetch) { setTimeout(poll, wait); return; }
    fetch('/control/api/queue', { cache: 'no-store', credentials: 'same-origin' })
      .then(function (r) { return r.ok ? r.json() : null; })
      .then(function (d) {
        if (d && d.waiting > known) {
          var n = d.waiting - known;
          if (text) text.textContent = n + ' new message' + (n === 1 ? ' has' : 's have') + ' arrived from Earth.';
          banner.hidden = false;
        }
        wait = 8000;
      })
      .catch(function () { wait = Math.min(60000, wait * 2); })
      .then(function () { setTimeout(poll, wait); });
  }
  setTimeout(poll, wait);
  document.addEventListener('visibilitychange', function () { if (!document.hidden) poll(); });
})();

/* ------------------------------------------------------------------ edits */
/* Every field remembers what it held when the page was drawn. A field that
   now holds something else is marked — the field itself, its row in a table,
   the caption over it, the face chosen — and the form's buttons carry a count
   of the fields that differ, so what a save is about to change is plain
   before it is saved. Undo the change and the mark goes; save, and the page
   is drawn afresh with nothing marked. The blog composer's sheet writes into
   its textarea (entry-editor.js), so the textarea's text is what is compared. */
(function () {
  'use strict';
  var norm = function (v) {
    return String(v == null ? '' : v).replace(/\r/g, '').split(/\n\s*\n/).map(function (p) { return p.trim(); }).filter(Boolean).join('\n\n');
  };
  var skip = /^(hidden|submit|button|file)$/;
  function differs(el) {
    if (el.type === 'checkbox' || el.type === 'radio') return el.checked !== el.defaultChecked;
    if (el.tagName === 'SELECT') {
      var was = -1;
      for (var k = 0; k < el.options.length; k++) if (el.options[k].defaultSelected) { was = k; break; }
      return el.selectedIndex !== (was < 0 ? 0 : was);
    }
    return norm(el.value) !== norm(el.defaultValue);
  }
  var forms = Array.prototype.slice.call(document.querySelectorAll('.tab-pane form'));
  forms.forEach(function (form) {
    var fields = function () {
      return Array.prototype.slice.call(form.querySelectorAll('input, textarea, select')).filter(function (el) { return !skip.test(el.type) && !el.closest('.ed-fig'); });
    };
    if (!fields().length) return;
    var note = null;
    var noteFor = function () {
      if (note) return note;
      var primary = form.querySelector('button.primary'), bar = form.querySelector('.actions, .reply-bar');
      var home = primary ? primary.parentNode : bar;
      if (!home) return null;
      note = document.createElement('span'); note.className = 'edits'; note.hidden = true; note.setAttribute('aria-live', 'polite');
      if (primary && primary.nextSibling) home.insertBefore(note, primary.nextSibling); else home.appendChild(note);
      return note;
    };
    var read = function () {
      var radios = {}, n = 0;
      Array.prototype.forEach.call(form.querySelectorAll('.is-edited'), function (el) { el.classList.remove('is-edited'); });
      fields().forEach(function (el) {
        if (el.type === 'radio') {                                             // a group counts once; the face now chosen carries the mark
          var g = radios[el.name] || (radios[el.name] = { on: false, chosen: null });
          if (differs(el)) g.on = true;
          if (el.checked) g.chosen = el;
          return;
        }
        var on = differs(el);
        el.classList.toggle('is-edited', on);
        if (on) n += 1;
      });
      Object.keys(radios).forEach(function (k) { var g = radios[k]; if (g.on) { n += 1; if (g.chosen) g.chosen.classList.add('is-edited'); } });
      fields().forEach(function (el) {
        if (!el.classList.contains('is-edited')) return;
        var row = el.closest('tr'), cap = el.closest('label.f'), face = el.closest('.mood-face'), fig = el.closest('.fig-officer');
        var prev = el.previousElementSibling;                                  // the composer's sheet stands before its textarea (text mode: around it)
        var ed = el.closest('.ed') || (prev && prev.classList.contains('ed') ? prev : null);
        if (row) row.classList.add('is-edited');
        if (cap) cap.classList.add('is-edited');
        if (face) face.classList.add('is-edited');
        if (ed) ed.classList.add('is-edited');
        if (fig) fig.classList.add('is-edited');
      });
      form.classList.toggle('has-edits', n > 0);
      var tag = noteFor();
      if (tag) { tag.hidden = n === 0; tag.textContent = n ? (n === 1 ? '1 field changed' : n + ' fields changed') + ' — not saved yet' : ''; }
    };
    form.addEventListener('input', read);
    form.addEventListener('change', read);
    form.addEventListener('reset', function () { setTimeout(read, 0); });
    read();
  });
})();

/* ------------------------------------------------------------------ folds */
/* Every block's head folds and unfolds its block on a click — the schedule,
   the galley, an officer's blog, the queue — and the desk remembers which
   blocks were folded (this browser only), so a save, which redraws the page,
   brings it back as it was arranged. */
(function () {
  'use strict';
  var STORE = 'mcs-control-folds';
  var folded = {};
  try { folded = JSON.parse(localStorage.getItem(STORE) || '{}') || {}; } catch (e) { folded = {}; }
  var remember = function () { try { localStorage.setItem(STORE, JSON.stringify(folded)); } catch (e) { /* private mode */ } };
  var blocks = Array.prototype.slice.call(document.querySelectorAll('.tab-pane .panel, .tab-pane .queue'));
  blocks.forEach(function (block, i) {
    var head = block.querySelector(':scope > .eyebrow, :scope > .block-head, :scope > .sechead');
    if (!head) return;
    var chan = block.querySelector(':scope > .chan');
    var key = (chan ? chan.textContent.trim() : '') || (block.id ? '#' + block.id : 'block-' + i);   // the channel code names the block wherever it stands
    head.classList.add('fold-head');
    head.setAttribute('role', 'button'); head.tabIndex = 0;
    var chev = document.createElement('span'); chev.className = 'fold-chev'; chev.setAttribute('aria-hidden', 'true'); chev.textContent = '\u25be';
    var title = head.querySelector('.block-title, .bigsec');                   // next to the name where the head has one, else at the end of the line
    (title || head).appendChild(chev);
    var set = function (on) { block.classList.toggle('is-folded', on); head.setAttribute('aria-expanded', on ? 'false' : 'true'); };
    set(!!folded[key]);
    var flip = function () { var on = !block.classList.contains('is-folded'); set(on); if (on) folded[key] = 1; else delete folded[key]; remember(); };
    head.addEventListener('click', function (e) { if (e.target.closest && e.target.closest('a, button, input, select, textarea')) return; flip(); });
    head.addEventListener('keydown', function (e) { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); flip(); } });
  });
})();

/* ------------------------------------------------------------------ moods */
/* Mirrors src/lib/mood.js so the operator picks a face while reading the
   exact words the public will get. Keep the two in step. */
(function () {
  'use strict';
  var BANDS = ['calm, at ease with the day', 'settled, working steadily',
    'level \u2014 neither calm nor cross', 'tense, short with the others', 'angry, needing distance'];
  document.querySelectorAll('.mood-faces input[type="radio"]').forEach(function (r) {
    r.addEventListener('change', function () {
      var target = document.getElementById('read-' + r.dataset.crew + '-calm_tense');
      if (target) target.textContent = '\u201c' + BANDS[Number(r.dataset.band)] + '\u201d';
    });
  });
})();

/* -------------------------------------------------------------- templates */
/* A press fills the textarea in the same form, after checking nothing is
   about to be thrown away. */
(function () {
  'use strict';
  document.querySelectorAll('button.tpl').forEach(function (btn) {
    btn.addEventListener('click', function () {
      var form = btn.closest('form');
      var box = form && form.querySelector('textarea');
      if (!box) return;
      var body = btn.dataset.body || '';
      if (box.value.trim() && box.value.trim() !== body.trim()) {
        if (!window.confirm('Replace what is already in this box?')) return;
      }
      box.value = body;
      box.focus();
      var gap = body.indexOf(': \n');
      var at = gap > -1 ? gap + 2 : box.value.length;
      box.setSelectionRange(at, at);
    });
  });
})();

/* ---------------------------------------------------------- recipe book */
/* Breakfast, Lunch and Dinner each have a dropdown over the recipe book
   (content/recipes.json, carried into the page as #recipe-book). Choosing a
   recipe fills the slot's name, kcal, prep time, nutrients, CO2e and water
   footprint; every field stays editable, and the save keeps what the fields
   hold. The dropdown opens on "Choose meal"; "Empty" clears the slot to be filled in by hand — saved for that
   day only, never added to the book. Without JavaScript the dropdown is still posted, and the
   server records the recipe the slot names. */
(function () {
  'use strict';
  var src = document.getElementById('recipe-book');
  if (!src) return;
  var book = [];
  try { book = JSON.parse(src.textContent || '[]') || []; } catch (e) { book = []; }
  var NUTR = ['protein_g', 'fat_g', 'carb_g', 'fiber_g', 'sugar_g', 'sodium_mg'];
  var round = function (v, dp) { return v == null || v === '' || isNaN(v) ? '' : String(+Number(v).toFixed(dp)); };

  function set(form, name, value) {
    var el = form.querySelector('[name="' + name + '"]');
    if (!el) return;
    el.value = value;
    el.dispatchEvent(new Event('input', { bubbles: true }));
    el.dispatchEvent(new Event('change', { bubbles: true }));
  }

  document.querySelectorAll('select.recipe-pick').forEach(function (sel) {
    var slot = sel.getAttribute('data-slot');
    var form = sel.form;
        sel.addEventListener('change', function () {
      var v = sel.value;
      var figs = form.querySelector('.meal-slot-edit[data-slot="' + slot + '"] .meal-recipe-figs');
      if (v === '__empty') {                                          // a one-off: the recipe's figures go, the name is typed
        set(form, slot + '_name', '');
        set(form, slot + '_components', '');
        set(form, slot + '_kcal', '');
        set(form, slot + '_prep', '');
        NUTR.forEach(function (k) { set(form, slot + '_' + k, ''); });
        set(form, slot + '_co2e', ''); set(form, slot + '_wfp', '');
        var name = form.querySelector('[name="' + slot + '_name"]'); if (name) name.focus();
        return;
      }
      var r = null;
      for (var i = 0; i < book.length; i++) if (book[i].slug === v) { r = book[i]; break; }
      if (!r) return;
      set(form, slot + '_name', r.name);
      set(form, slot + '_components', '');                   // the previous dish's components are not this recipe's
      set(form, slot + '_kcal', r.kcal == null ? '' : String(Math.round(r.kcal)));
      set(form, slot + '_prep', r.prep_minutes == null ? '' : String(r.prep_minutes));
      NUTR.forEach(function (k) { set(form, slot + '_' + k, round((r.nutrients || {})[k], 2)); });
      set(form, slot + '_co2e', round(r.co2e_kg, 4));
      set(form, slot + '_wfp', round(r.water_total_l, 1));
      if (figs) {
        figs.open = true;
        figs.classList.add('just-filled');
        setTimeout(function () { figs.classList.remove('just-filled'); }, 1200);
      }
    });
  });

})();
