/* The entry composer — every blog box in mission control.
   One sheet, written like a document: the text flows, Enter starts a new
   paragraph, and a photograph or a film sits in the flow where the cursor
   was when it was added — under a toolbar with Photo / video on the left
   and Visual | Text on the right, like a classic post editor. A picture
   uploads there and then, shows its preview in place, can be captioned
   under itself, and ✕ takes it out of the post. Underneath, the same plain
   text the station has always stored — paragraphs with [media:id] lines —
   is kept in sync in the form's textarea, so saving needs nothing new, and
   without this script the box is still a textarea and a file picker. */
(function () {
  'use strict';
  if (!window.FormData || !window.XMLHttpRequest || !window.fetch) return;
  var MARK = /(\[media:\d+\])/;
  var THUMB = 640;
  var ACCEPT_VISUAL = '.jpg,.jpeg,.png,.gif,.webp,.avif,.heic,.heif,.tif,.tiff,.mp4,.m4v,.mov,.webm,.mkv';
  var ACCEPT_DOC = '.pdf,.txt,.md,.csv,.json';

  /* ------------------------------------------------------------ previews */
  function toJpeg(source, w, h) {
    var scale = Math.min(1, THUMB / Math.max(w, h));
    var c = document.createElement('canvas');
    c.width = Math.max(1, Math.round(w * scale)); c.height = Math.max(1, Math.round(h * scale));
    var g = c.getContext('2d');
    g.fillStyle = '#111'; g.fillRect(0, 0, c.width, c.height);
    g.drawImage(source, 0, 0, c.width, c.height);
    return c.toDataURL('image/jpeg', 0.82);
  }
  function previewImage(file) {
    return new Promise(function (resolve) {
      var url = URL.createObjectURL(file), img = new Image();
      img.onload = function () {
        var out = { width: img.naturalWidth, height: img.naturalHeight };
        try { out.thumb = toJpeg(img, img.naturalWidth, img.naturalHeight); } catch (e) { /* no preview */ }
        URL.revokeObjectURL(url); resolve(out);
      };
      img.onerror = function () { URL.revokeObjectURL(url); resolve({}); };
      img.src = url;
    });
  }
  function previewVideo(file) {
    return new Promise(function (resolve) {
      var url = URL.createObjectURL(file), v = document.createElement('video');
      var done = false, out = {};
      var finish = function () { if (done) return; done = true; URL.revokeObjectURL(url); resolve(out); };
      v.muted = true; v.playsInline = true; v.preload = 'auto';
      v.addEventListener('loadedmetadata', function () {
        out.width = v.videoWidth; out.height = v.videoHeight; out.duration = v.duration;
        try { v.currentTime = Math.min(1.5, Math.max(0, (v.duration || 0) * 0.1)); } catch (e) { finish(); }
      });
      v.addEventListener('seeked', function () { try { out.thumb = toJpeg(v, v.videoWidth, v.videoHeight); } catch (e) { /* fine */ } finish(); });
      v.addEventListener('error', finish);
      setTimeout(finish, 8000);
      v.src = url;
    });
  }
  function preview(file) {
    if (/^image\//.test(file.type)) return previewImage(file);
    if (/^video\//.test(file.type)) return previewVideo(file);
    return Promise.resolve({});
  }
  function kindOf(file) {
    if (/^image\//.test(file.type)) return 'image';
    if (/^video\//.test(file.type)) return 'video';
    if (/^audio\//.test(file.type)) return 'audio';
    return 'document';
  }

  /* -------------------------------------------------------------- upload */
  function upload(file, meta, fields, onProgress) {
    return new Promise(function (resolve) {
      var fd = new FormData();
      fd.append('day', fields.day); fd.append('crew_id', fields.crew_id); fd.append('caption', '');
      if (meta.thumb) fd.append('thumb', meta.thumb);
      if (meta.width) fd.append('width', meta.width);
      if (meta.height) fd.append('height', meta.height);
      if (meta.duration) fd.append('duration', meta.duration);
      fd.append('file', file, file.name);
      var xhr = new XMLHttpRequest();
      xhr.open('POST', '/control/media/upload', true);
      xhr.setRequestHeader('X-Requested-With', 'fetch');
      xhr.upload.addEventListener('progress', function (e) { if (e.lengthComputable) onProgress(e.loaded / e.total); });
      xhr.addEventListener('load', function () {
        try { var j = JSON.parse(xhr.responseText); resolve(j.ok ? { ok: true, item: j.items[0] } : { ok: false, error: j.error || 'refused' }); }
        catch (e) { resolve({ ok: false, error: 'server error ' + xhr.status }); }
      });
      xhr.addEventListener('error', function () { resolve({ ok: false, error: 'network error' }); });
      xhr.send(fd);
    });
  }
  function withdraw(id) {
    return fetch('/control/media/' + id + '/hide', { method: 'POST', headers: { 'X-Requested-With': 'fetch' } })
      .then(function (r) { return r.ok; }).catch(function () { return false; });
  }
  function saveCaption(id, caption, day, crewId) {
    var fd = new URLSearchParams();
    fd.append('caption', caption); fd.append('day', day); fd.append('crew_id', crewId || '');
    return fetch('/control/media/' + id + '/edit', { method: 'POST', headers: { 'X-Requested-With': 'fetch', 'Content-Type': 'application/x-www-form-urlencoded' }, body: fd.toString() })
      .then(function (r) { return r.ok; }).catch(function () { return false; });
  }

  /* --------------------------------------------------------------- editor */
  function el(tag, cls, html) { var e = document.createElement(tag); if (cls) e.className = cls; if (html != null) e.innerHTML = html; return e; }
  function escAttr(s) { return String(s || '').replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;'); }
  var ICON = {
    image: '<svg viewBox="0 0 20 20" width="16" height="16" aria-hidden="true"><path fill="currentColor" d="M2 4h16v12H2zm2 2v8h12V6zm2 7l2.5-3 2 2.4L12 9l3 4z"/></svg>'
  };
  try { document.execCommand('defaultParagraphSeparator', false, 'p'); } catch (e) { /* older engines */ }

  function Editor(form) {
    var self = this;
    this.form = form;
    this.body = form.querySelector('textarea[name=body]');
    this.day = form.elements.day ? form.elements.day.value : '';
    this.crewId = form.getAttribute('data-crew-id') || '';
    this.cue = this.body.getAttribute('placeholder') || 'Write the entry…';
    this.uploads = 0;
    var known = [];
    try { known = JSON.parse(form.getAttribute('data-media') || '[]'); } catch (e) { known = []; }
    this.media = {};
    known.forEach(function (m) { self.media[m.id] = m; });

    // the plain controls step aside; they still exist for the form itself
    this.body.classList.add('ed-hidden');
    var attach = form.querySelector('.attach'); if (attach) attach.classList.add('ed-hidden');
    var pick = form.querySelector('.attach input[type=file]'); if (pick) pick.disabled = true;

    // The editor: a toolbar strip (Photo / video; Visual | Text), one
    // editable sheet, and a foot with the word count.
    this.root = el('div', 'ed');
    this.root.innerHTML =
      '<div class="ed-bar">' +
        '<div class="ed-bar-add">' +
          '<button type="button" data-add="visual" title="Add a photograph or video where the cursor is">' + ICON.image + '<span>Photo / video</span></button>' +
        '</div>' +
        '<div class="ed-bar-tabs" role="tablist">' +
          '<button type="button" data-mode="visual" class="on" role="tab" aria-selected="true">Visual</button>' +
          '<button type="button" data-mode="text" role="tab" aria-selected="false">Text</button>' +
        '</div>' +
      '</div>' +
      '<div class="ed-doc" contenteditable="true" spellcheck="true"></div>' +
      '<div class="ed-foot"><span class="ed-count">Word count: 0</span><span class="ed-hint"></span></div>';
    this.doc = this.root.querySelector('.ed-doc');
    this.doc.setAttribute('data-placeholder', this.cue);
    this.count = this.root.querySelector('.ed-count');
    this.body.parentNode.insertBefore(this.root, this.body);

    this.doc.addEventListener('input', function () { self.sync(); });
    // paste as plain text: the entry is text and pictures, nothing else
    this.doc.addEventListener('paste', function (e) {
      var t = e.clipboardData ? e.clipboardData.getData('text/plain') : '';
      if (!e.clipboardData) return;
      e.preventDefault();
      if (t) document.execCommand('insertText', false, t);
    });
    // a picture is taken out with its ✕, so it is withdrawn on the station
    // too; Backspace / Delete against one asks the same question
    this.doc.addEventListener('keydown', function (e) {
      if (e.key !== 'Backspace' && e.key !== 'Delete') return;
      var fig = self.figureAtCaret(e.key === 'Backspace' ? -1 : 1);
      if (!fig) return;
      e.preventDefault();
      self.removeFigure(fig);
    });
    this.doc.addEventListener('click', function (e) {
      var b = e.target.closest('button[data-do=remove]');
      if (b) { e.preventDefault(); self.removeFigure(b.closest('.ed-fig')); }
    });
    this.root.querySelector('.ed-bar-add').addEventListener('click', function (e) {
      var b = e.target.closest('button[data-add]'); if (!b) return;
      if (self.mode === 'text') self.setMode('visual');
      var input = document.createElement('input');
      input.type = 'file'; input.multiple = true; input.accept = ACCEPT_VISUAL;
      var at = self.caretBlock();
      input.addEventListener('change', function () { self.insertFiles(at, Array.prototype.slice.call(input.files || [])); });
      input.click();
    });
    this.root.querySelector('.ed-bar-tabs').addEventListener('click', function (e) {
      var b = e.target.closest('button[data-mode]'); if (!b) return;
      self.setMode(b.getAttribute('data-mode'));
    });
    this.body.addEventListener('input', function () { if (self.mode === 'text') { self.dirty = true; self.words(); } });
    this.mode = 'visual';
    ['dragenter', 'dragover'].forEach(function (ev) { self.root.addEventListener(ev, function (e) { e.preventDefault(); self.root.classList.add('over'); }); });
    ['dragleave', 'drop'].forEach(function (ev) { self.root.addEventListener(ev, function (e) { e.preventDefault(); self.root.classList.remove('over'); }); });
    this.root.addEventListener('drop', function (e) {
      var files = e.dataTransfer && e.dataTransfer.files ? Array.prototype.slice.call(e.dataTransfer.files) : [];
      if (!files.length) return;
      if (self.mode === 'text') self.setMode('visual');
      var at = e.target.closest ? e.target.closest('.ed-doc > *') : null;
      self.insertFiles(at || null, files);
    });

    // templates: handled here, ahead of the plain-textarea handler in control.js
    Array.prototype.forEach.call(form.querySelectorAll('button.tpl'), function (b) {
      b.addEventListener('click', function (e) {
        e.stopImmediatePropagation();
        var current = self.body.value.trim();
        if (current && !window.confirm('Replace what is already in this entry?')) return;
        self.load(b.getAttribute('data-body') || '');
        self.dirty = true;
        self.doc.focus();
      }, true);
    });
    form.addEventListener('submit', function (e) {
      if (self.uploads) { e.preventDefault(); window.alert('A file is still uploading — one moment.'); return; }
      self.sync(); self.dirty = false; self.saving = true;
    });

    // A draft stashed when another box on this page was published (see the
    // foot of this file) comes back here, so nothing typed is lost to a
    // Publish elsewhere on the tab.
    var stashed = null;
    try { stashed = window.sessionStorage.getItem(stashKey(form)); } catch (e) { /* no storage */ }
    if (stashed !== null) {
      try { window.sessionStorage.removeItem(stashKey(form)); } catch (e) { /* fine */ }
      this.load(stashed);
      this.dirty = true;
      this.root.classList.add('ed-restored');
      var foot = this.root.querySelector('.ed-hint'); if (foot) foot.textContent = 'Unsaved draft restored — press Publish to keep it';
    } else {
      this.load(this.body.value);
    }
  }

  /** What a form is for, as a key: its action and the day, officer and kind
   *  it writes — the same on the page before and after a Publish. */
  function stashKey(form) {
    var f = form.elements;
    var part = function (n) { return f[n] ? String(f[n].value) : ''; };
    return 'mcs-draft:' + form.getAttribute('action') + ':' + part('day') + ':' + part('designation') + ':' + part('crew_id') + ':' + part('kind');
  }

  /* ---- the document: paragraphs and figures */

  Editor.prototype.paragraph = function (text) {
    var p = el('p');
    var lines = String(text || '').split('\n');
    lines.forEach(function (l, i) { if (i) p.appendChild(el('br')); p.appendChild(document.createTextNode(l)); });
    if (!text) p.appendChild(el('br'));
    return p;
  };

  Editor.prototype.figure = function (id) {
    var self = this, m = this.media[id];
    var f = el('figure', 'ed-fig'); f.setAttribute('data-media-id', id); f.setAttribute('contenteditable', 'false');
    var pic;
    if (m && m.thumb) pic = '<img src="' + m.thumb + '" alt="">' + (m.kind === 'video' ? '<i class="media-play">▶</i>' : '');
    else if (m && m.kind === 'image') pic = '<img src="' + m.url + '" alt="">';
    else if (m && m.kind === 'video') pic = '<video src="' + m.url + '" preload="metadata" muted playsinline></video><i class="media-play">▶</i>';
    else pic = '<span class="ed-kind">' + (m ? m.kind : 'media #' + id) + '</span>';
    f.innerHTML = '<div class="ed-figure">' + pic + '</div>' +
      '<div class="ed-caption"><input type="text" maxlength="2000" placeholder="Caption — what this is, in a line" value="' + escAttr(m && m.caption) + '">' +
      '<span class="ed-caption-state"></span></div>' +
      '<div class="ed-tools"><button type="button" data-do="remove" class="ed-remove" title="Take it out of the entry and off the station">✕</button></div>';
    var inp = f.querySelector('.ed-caption input'), st = f.querySelector('.ed-caption-state'), timer = null;
    inp.addEventListener('input', function () {
      clearTimeout(timer); st.textContent = '…';
      timer = setTimeout(function () {
        saveCaption(id, inp.value, self.day, self.crewId).then(function (ok) { st.textContent = ok ? 'saved' : 'not saved'; if (self.media[id]) self.media[id].caption = inp.value; setTimeout(function () { if (st.textContent === 'saved') st.textContent = ''; }, 1500); });
      }, 600);
    });
    inp.addEventListener('keydown', function (e) { if (e.key === 'Enter') { e.preventDefault(); self.caretAfter(f); } });
    return f;
  };

  /** Text → document. A placeholder body is an empty entry. */
  Editor.prototype.load = function (text) {
    var self = this;
    this.doc.innerHTML = '';
    var t = String(text || '');
    if (/^\s*\[PLACEHOLDER\]/.test(t)) t = '';
    t.split(MARK).forEach(function (part) {
      var mm = /^\[media:(\d+)\]$/.exec(part);
      // a marker for something withdrawn or unknown is dropped: the next save cleans the text
      if (mm) { if (self.media[Number(mm[1])]) self.doc.appendChild(self.figure(Number(mm[1]))); return; }
      part.replace(/\r/g, '').split(/\n\s*\n/).forEach(function (para) { if (para.trim()) self.doc.appendChild(self.paragraph(para.trim())); });
    });
    // media attached to this officer and day but not placed: shown, so it is not lost
    Object.keys(this.media).forEach(function (id) {
      if (!self.doc.querySelector('.ed-fig[data-media-id="' + id + '"]')) self.doc.appendChild(self.figure(Number(id)));
    });
    this.tidy();
    this.loaded = false; this.sync(); this.loaded = true;
  };

  /** The sheet always starts and ends with a paragraph, so there is always
   *  somewhere to put the cursor before the first picture and after the last. */
  Editor.prototype.tidy = function () {
    var d = this.doc;
    if (!d.firstElementChild || d.firstElementChild.classList.contains('ed-fig')) d.insertBefore(this.paragraph(''), d.firstChild);
    if (d.lastElementChild.classList.contains('ed-fig')) d.appendChild(this.paragraph(''));
  };

  /** Document → text, into the form's textarea. */
  Editor.prototype.sync = function () {
    if (this.mode === 'text') { this.words(); return; }   // the textarea is the source while it is being typed in
    var out = [];
    var before = this.body.value;
    var walk = function (node) {
      Array.prototype.forEach.call(node.childNodes, function (n) {
        if (n.nodeType === 3) { if (n.textContent.trim()) out.push(n.textContent.trim()); return; }
        if (n.nodeType !== 1) return;
        if (n.classList.contains('ed-fig')) { if (!n.classList.contains('ed-uploading')) out.push('[media:' + n.getAttribute('data-media-id') + ']'); return; }
        if (n.querySelector && n.querySelector('.ed-fig')) { walk(n); return; }   // a figure wrapped by the browser
        var t = n.innerText.replace(/\u00a0/g, ' ').replace(/\n{2,}/g, '\n').trim();
        if (t) out.push(t);
      });
    };
    walk(this.doc);
    this.body.value = out.join('\n\n');
    if (this.loaded && this.body.value !== before) this.dirty = true;
    this.doc.classList.toggle('is-empty', !this.body.value && !this.doc.querySelector('.ed-fig'));
    this.words();
  };

  /** The foot's word count, from the text the form will send. */
  Editor.prototype.words = function () {
    if (!this.count) return;
    var t = this.body.value.replace(/\[media:\d+\]/g, ' ').trim();
    var n = t ? t.split(/\s+/).length : 0;
    this.count.textContent = 'Word count: ' + n;
  };

  /** Visual: the sheet. Text: the plain textarea the station stores, with
   *  paragraphs and [media:12] lines, editable by hand. Switching back
   *  rebuilds the sheet from the text. */
  Editor.prototype.setMode = function (mode) {
    if (mode === this.mode) return;
    if (mode === 'text') {
      this.sync();
      this.doc.classList.add('ed-hidden');
      this.body.classList.remove('ed-hidden');
      this.root.insertBefore(this.body, this.root.querySelector('.ed-foot'));   // into the sheet, under the toolbar
      this.body.classList.add('ed-source');
      this.body.focus();
    } else {
      this.body.classList.add('ed-hidden');
      this.body.classList.remove('ed-source');
      this.doc.classList.remove('ed-hidden');
      this.load(this.body.value);
    }
    this.mode = mode;
    Array.prototype.forEach.call(this.root.querySelectorAll('.ed-bar-tabs button'), function (b) {
      var on = b.getAttribute('data-mode') === mode;
      b.classList.toggle('on', on); b.setAttribute('aria-selected', on ? 'true' : 'false');
    });
  };

  /* ---- the cursor */

  /** The top-level child of the sheet the cursor is in, or null (→ the end). */
  Editor.prototype.caretBlock = function () {
    var sel = window.getSelection();
    if (!sel || !sel.rangeCount) return null;
    var n = sel.getRangeAt(0).startContainer;
    while (n && n.parentNode !== this.doc) n = n.parentNode;
    return n && n.parentNode === this.doc ? n : null;
  };

  /** Put the cursor at the start of the paragraph after a figure, making one if needed. */
  Editor.prototype.caretAfter = function (node) {
    var next = node.nextElementSibling;
    if (!next || next.classList.contains('ed-fig')) { next = this.paragraph(''); this.doc.insertBefore(next, node.nextSibling); }
    var r = document.createRange(); r.setStart(next, 0); r.collapse(true);
    var sel = window.getSelection(); sel.removeAllRanges(); sel.addRange(r);
    this.doc.focus();
  };

  /** The figure the cursor sits directly against, in the direction of a
   *  Backspace (-1) or Delete (+1); null when it is inside text. */
  Editor.prototype.figureAtCaret = function (dir) {
    var sel = window.getSelection();
    if (!sel || !sel.rangeCount || !sel.isCollapsed) return null;
    var r = sel.getRangeAt(0);
    var block = this.caretBlock(); if (!block) return null;
    if (block.classList.contains('ed-fig')) return block;
    var edge = document.createRange(); edge.selectNodeContents(block);
    if (dir < 0) { edge.setEnd(r.startContainer, r.startOffset); if (edge.toString().length) return null; var prev = block.previousElementSibling; return prev && prev.classList.contains('ed-fig') ? prev : null; }
    edge.setStart(r.startContainer, r.startOffset); if (edge.toString().length) return null;
    var nx = block.nextElementSibling; return nx && nx.classList.contains('ed-fig') ? nx : null;
  };

  Editor.prototype.removeFigure = function (fig) {
    var self = this, id = fig.getAttribute('data-media-id');
    if (fig.classList.contains('ed-uploading') || fig.classList.contains('ed-failed')) { fig.remove(); this.tidy(); this.sync(); return; }
    if (!window.confirm('Take this out of the entry and off the station?')) return;
    var b = fig.querySelector('button[data-do=remove]'); if (b) b.disabled = true;
    withdraw(id).then(function (ok) {
      if (!ok) { if (b) b.disabled = false; window.alert('Could not remove it — try again.'); return; }
      delete self.media[id];
      var after = fig.nextElementSibling;
      fig.remove(); self.tidy(); self.sync();
      if (after) { var r = document.createRange(); r.setStart(after, 0); r.collapse(true); var s = window.getSelection(); s.removeAllRanges(); s.addRange(r); }
      self.doc.focus();
    });
  };

  /** Files go in after the block the cursor is in (or at the end), one figure
   *  each, uploading in place; the cursor lands under the last one. */
  Editor.prototype.insertFiles = function (at, files) {
    var self = this;
    var anchor = at && at.parentNode === this.doc ? at : this.doc.lastElementChild;
    files.forEach(function (file) {
      var f = el('figure', 'ed-fig ed-uploading'); f.setAttribute('contenteditable', 'false');
      f.innerHTML = '<div class="ed-figure"><span class="ed-kind">' + kindOf(file) + '</span></div>' +
        '<div class="ed-progress"><span class="ed-progress-name">' + file.name.replace(/[<>&]/g, '') + '</span><div class="media-bar"><i></i></div><span class="ed-progress-state">preparing…</span></div>';
      self.doc.insertBefore(f, anchor ? anchor.nextSibling : null);
      anchor = f;
      var bar = f.querySelector('.media-bar i'), state = f.querySelector('.ed-progress-state');
      self.uploads++;
      preview(file).then(function (meta) {
        if (meta.thumb) f.querySelector('.ed-figure').innerHTML = '<img src="' + meta.thumb + '" alt="">' + (kindOf(file) === 'video' ? '<i class="media-play">▶</i>' : '');
        state.textContent = 'sending 0%';
        return upload(file, meta, { day: self.day, crew_id: self.crewId }, function (fr) { bar.style.width = Math.round(fr * 100) + '%'; state.textContent = 'sending ' + Math.round(fr * 100) + '%'; });
      }).then(function (res) {
        self.uploads--;
        if (!res.ok) { state.textContent = res.error; f.classList.add('ed-failed'); f.appendChild(el('div', 'ed-tools', '<button type="button" data-do="remove" class="ed-remove" title="Dismiss">✕</button>')); return; }
        var it = res.item;
        self.media[it.id] = { id: it.id, kind: kindOf(file), thumb: it.thumb || null, url: it.fileUrl || ('/media/file/' + it.id), page: it.url, caption: '', filename: it.filename };
        var done = self.figure(it.id);
        self.doc.replaceChild(done, f);
        self.tidy(); self.sync();
        done.querySelector('.ed-caption input').focus();
      });
    });
    this.tidy(); this.sync();
  };

  var editors = [];
  Array.prototype.forEach.call(document.querySelectorAll('form[data-attach-media]'), function (f) {
    if (f.querySelector('textarea[name=body]')) { f.__editor = new Editor(f); editors.push(f.__editor); }
  });
  // Publishing (or saving anything) on this page reloads it. Rather than a
  // "leave the page?" question, whatever is half-written in the OTHER boxes
  // is stashed for the length of the reload and put back — so Publish is
  // never interrupted and nothing typed is lost.
  var submitting = false;
  document.addEventListener('submit', function () {
    submitting = true;
    editors.forEach(function (ed) {
      if (!ed.dirty || ed.saving) return;
      ed.sync();
      try { window.sessionStorage.setItem(stashKey(ed.form), ed.body.value); } catch (e) { /* no storage: the warning below still stands */ submitting = false; }
    });
  }, true);
  // Leaving any other way — a tap on a tab, closing the window — with an
  // entry half-written or a file still uploading still asks first.
  window.addEventListener('beforeunload', function (e) {
    if (submitting && !editors.some(function (ed) { return ed.uploads; })) return;
    if (editors.some(function (ed) { return (ed.dirty || ed.uploads) && !ed.saving; })) { e.preventDefault(); e.returnValue = ''; }
  });
})();
