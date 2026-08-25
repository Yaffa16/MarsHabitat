/* The entry composer — every blog box in mission control.
   The entry is built as it will be read: a column of blocks, paragraphs and
   pictures, with a ＋ text · ＋ photo / video · ＋ sound rule between every
   two of them and under the last — that rule is the whole interface. Adding a photograph,
   a film or a recording is one press where you want it; it uploads there and
   then, shows its preview in place, and can be captioned, moved or taken out
   of the post without leaving the box. Underneath, the same plain text the
   station has always stored — paragraphs with [media:id] lines — is kept in
   sync in the form's textarea, so saving needs nothing new, and without this
   script the box is still a textarea and a file picker. */
(function () {
  'use strict';
  if (!window.FormData || !window.XMLHttpRequest || !window.fetch) return;
  var MARK = /(\[media:\d+\])/;
  var THUMB = 640;
  var ACCEPT_VISUAL = '.jpg,.jpeg,.png,.gif,.webp,.avif,.heic,.heif,.tif,.tiff,.mp4,.m4v,.mov,.webm,.mkv';
  var ACCEPT_SOUND = '.mp3,.m4a,.aac,.wav,.ogg,.flac';
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
  function autosize(t) { t.style.height = 'auto'; t.style.height = Math.max(48, t.scrollHeight + 2) + 'px'; }

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

    this.root = el('div', 'ed');
    this.root.innerHTML = '<div class="ed-blocks"></div>';
    this.blocks = this.root.querySelector('.ed-blocks');
    this.body.parentNode.insertBefore(this.root, this.body);
    this.root.addEventListener('input', function (e) { if (e.target.classList.contains('ed-text')) { autosize(e.target); self.sync(); } });
    ['dragenter', 'dragover'].forEach(function (ev) { self.root.addEventListener(ev, function (e) { e.preventDefault(); self.root.classList.add('over'); }); });
    ['dragleave', 'drop'].forEach(function (ev) { self.root.addEventListener(ev, function (e) { e.preventDefault(); self.root.classList.remove('over'); }); });
    this.root.addEventListener('drop', function (e) {
      var files = e.dataTransfer && e.dataTransfer.files ? Array.prototype.slice.call(e.dataTransfer.files) : [];
      if (!files.length) return;
      var after = e.target.closest ? e.target.closest('.ed-block') : null;
      var idx = after ? Array.prototype.indexOf.call(self.blocks.children, after) + 1 : self.blocks.children.length;
      self.insertFiles(idx, files);
    });

    // templates: handled here, ahead of the plain-textarea handler in control.js
    Array.prototype.forEach.call(form.querySelectorAll('button.tpl'), function (b) {
      b.addEventListener('click', function (e) {
        e.stopImmediatePropagation();
        var current = self.body.value.trim();
        if (current && !window.confirm('Replace what is already in this entry?')) return;
        self.load(b.getAttribute('data-body') || '');
        self.dirty = true;
        var first = self.blocks.querySelector('.ed-text'); if (first) first.focus();
      }, true);
    });
    form.addEventListener('submit', function (e) {
      if (self.uploads) { e.preventDefault(); window.alert('A file is still uploading — one moment.'); return; }
      self.sync(); self.dirty = false; self.saving = true;
    });

    this.load(this.body.value);
  }

  /** Text → blocks. A placeholder body is an empty entry. */
  Editor.prototype.load = function (text) {
    var self = this;
    this.blocks.innerHTML = '';
    var t = String(text || '');
    if (/^\s*\[PLACEHOLDER\]/.test(t)) t = '';
    var parts = t.split(MARK), any = false;
    parts.forEach(function (p) {
      var mm = /^\[media:(\d+)\]$/.exec(p);
      // a marker for something withdrawn or unknown is dropped: the next save cleans the text
      if (mm) { if (self.media[Number(mm[1])]) { self.blocks.appendChild(self.mediaBlock(Number(mm[1]))); any = true; } }
      else if (p.trim()) { self.blocks.appendChild(self.textBlock(p.trim())); any = true; }
    });
    if (!any) this.blocks.appendChild(this.textBlock(''));
    // media attached to this officer and day but not placed: shown, so it is not lost
    Object.keys(this.media).forEach(function (id) {
      if (!self.blocks.querySelector('.ed-block[data-media-id="' + id + '"]')) self.blocks.appendChild(self.mediaBlock(Number(id)));
    });
    Array.prototype.forEach.call(this.blocks.querySelectorAll('.ed-text'), autosize);
    this.loaded = false; this.sync(); this.loaded = true;
  };

  /** Blocks → text, into the form's textarea. */
  Editor.prototype.sync = function () {
    var out = [];
    var before = this.body.value;
    Array.prototype.forEach.call(this.blocks.children, function (b) {
      if (b.classList.contains('ed-uploading')) return;
      var id = b.getAttribute('data-media-id');
      if (id) out.push('[media:' + id + ']');
      else { var t = b.querySelector('.ed-text'); if (t && t.value.trim()) out.push(t.value.trim()); }
    });
    this.body.value = out.join('\n\n');
    if (this.loaded && this.body.value !== before) this.dirty = true;
  };

  Editor.prototype.gap = function () {
    var g = el('div', 'ed-gap',
      '<button type="button" data-add="text" title="Add a paragraph here">＋ text</button>' +
      '<button type="button" data-add="visual" title="Add a photograph or video here">＋ photo / video</button>' +
      '<button type="button" data-add="sound" title="Add a recording here">＋ sound</button>');
    var self = this;
    g.addEventListener('click', function (e) {
      var b = e.target.closest('button[data-add]'); if (!b) return;
      var block = g.parentNode;
      var idx = Array.prototype.indexOf.call(self.blocks.children, block) + 1;
      self.addAt(idx, b.getAttribute('data-add'));
    });
    return g;
  };

  Editor.prototype.tools = function (block, extra) {
    var t = el('div', 'ed-tools',
      '<button type="button" data-do="up" title="Move up">↑</button>' +
      '<button type="button" data-do="down" title="Move down">↓</button>' +
      (extra || '') +
      '<button type="button" data-do="remove" class="ed-remove" title="Delete from the entry and the station">✕</button>');
    var self = this;
    t.addEventListener('click', function (e) {
      var b = e.target.closest('button[data-do]'); if (!b) return;
      var what = b.getAttribute('data-do');
      if (what === 'up' && block.previousElementSibling) self.blocks.insertBefore(block, block.previousElementSibling);
      if (what === 'down' && block.nextElementSibling) self.blocks.insertBefore(block.nextElementSibling, block);
      if (what === 'remove') {
        var id = block.getAttribute('data-media-id');
        var txt = block.querySelector('.ed-text');
        if (id) {
          if (!window.confirm('Delete?')) return;
          b.disabled = true;
          withdraw(id).then(function (ok) {
            if (!ok) { b.disabled = false; window.alert('Could not remove it — try again.'); return; }
            delete self.media[id];
            block.remove();
            if (!self.blocks.children.length) self.blocks.appendChild(self.textBlock(''));
            self.sync();
          });
          return;
        }
        if (!txt || !txt.value.trim() || window.confirm('Delete?')) block.remove();
        if (!self.blocks.children.length) self.blocks.appendChild(self.textBlock(''));
      }
      self.sync();
    });
    return t;
  };

  Editor.prototype.textBlock = function (text) {
    var b = el('div', 'ed-block ed-block-text');
    var ta = el('textarea', 'ed-text'); ta.rows = 1; ta.placeholder = this.cue; ta.value = text || '';
    b.appendChild(ta);
    b.appendChild(this.tools(b));
    b.appendChild(this.gap());
    return b;
  };

  Editor.prototype.mediaBlock = function (id) {
    var self = this, m = this.media[id];
    var b = el('div', 'ed-block ed-block-media'); b.setAttribute('data-media-id', id);
    var fig = el('div', 'ed-figure');
    if (m && m.thumb) fig.innerHTML = '<img src="' + m.thumb + '" alt="">' + (m.kind === 'video' ? '<i class="media-play">▶</i>' : '');
    else if (m && m.kind === 'image') fig.innerHTML = '<img src="' + m.url + '" alt="">';
    else if (m && m.kind === 'video') fig.innerHTML = '<video src="' + m.url + '" preload="metadata" muted playsinline></video><i class="media-play">▶</i>';
    else if (m && m.kind === 'audio') fig.innerHTML = '<audio src="' + m.url + '" controls preload="metadata"></audio>';
    else fig.innerHTML = '<span class="ed-kind">' + (m ? m.kind : 'media #' + id) + '</span>';
    b.appendChild(fig);
    var cap = el('div', 'ed-caption');
    cap.innerHTML = '<input type="text" maxlength="2000" placeholder="Caption — what this is, in a line" value="' + (m && m.caption ? m.caption.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;') : '') + '">' +
      '<span class="ed-caption-state"></span>' +
      (m ? '<a href="' + (m.page || '/media/' + id) + '" target="_blank" rel="noopener">open</a>' : '');
    var inp = cap.querySelector('input'), st = cap.querySelector('.ed-caption-state'), timer = null;
    inp.addEventListener('input', function () {
      clearTimeout(timer); st.textContent = '…';
      timer = setTimeout(function () {
        saveCaption(id, inp.value, self.day, self.crewId).then(function (ok) { st.textContent = ok ? 'saved' : 'not saved'; if (self.media[id]) self.media[id].caption = inp.value; setTimeout(function () { if (st.textContent === 'saved') st.textContent = ''; }, 1500); });
      }, 600);
    });
    b.appendChild(cap);
    b.appendChild(this.tools(b));
    b.appendChild(this.gap());
    return b;
  };

  Editor.prototype.addAt = function (idx, what) {
    var self = this;
    if (what === 'text') {
      var b = this.textBlock('');
      this.blocks.insertBefore(b, this.blocks.children[idx] || null);
      b.querySelector('.ed-text').focus(); this.sync(); return;
    }
    var input = document.createElement('input');
    input.type = 'file'; input.multiple = true;
    input.accept = what === 'sound' ? ACCEPT_SOUND : what === 'doc' ? ACCEPT_DOC : ACCEPT_VISUAL;
    input.addEventListener('change', function () { self.insertFiles(idx, Array.prototype.slice.call(input.files || [])); });
    input.click();
  };

  /** Files go in at a position, one block each, uploading in place. */
  Editor.prototype.insertFiles = function (idx, files) {
    var self = this;
    files.forEach(function (file, i) {
      var b = el('div', 'ed-block ed-block-media ed-uploading');
      b.innerHTML = '<div class="ed-figure"><span class="ed-kind">' + kindOf(file) + '</span></div>' +
        '<div class="ed-progress"><span class="ed-progress-name">' + file.name.replace(/[<>&]/g, '') + '</span><div class="media-bar"><i></i></div><span class="ed-progress-state">preparing…</span></div>';
      self.blocks.insertBefore(b, self.blocks.children[idx + i] || null);
      var bar = b.querySelector('.media-bar i'), state = b.querySelector('.ed-progress-state');
      self.uploads++;
      preview(file).then(function (meta) {
        if (meta.thumb) b.querySelector('.ed-figure').innerHTML = '<img src="' + meta.thumb + '" alt="">' + (kindOf(file) === 'video' ? '<i class="media-play">▶</i>' : '');
        state.textContent = 'sending 0%';
        return upload(file, meta, { day: self.day, crew_id: self.crewId }, function (f) { bar.style.width = Math.round(f * 100) + '%'; state.textContent = 'sending ' + Math.round(f * 100) + '%'; });
      }).then(function (res) {
        self.uploads--;
        if (!res.ok) { state.textContent = res.error; b.classList.add('ed-failed'); var x = el('div', 'ed-tools', '<button type="button" class="ed-remove" title="Dismiss">✕</button>'); x.querySelector('button').addEventListener('click', function () { b.remove(); self.sync(); }); b.appendChild(x); return; }
        var it = res.item;
        self.media[it.id] = { id: it.id, kind: kindOf(file), thumb: it.thumb || null, url: it.fileUrl || ('/media/file/' + it.id), page: it.url, caption: '', filename: it.filename };
        var done = self.mediaBlock(it.id);
        self.blocks.replaceChild(done, b);
        done.querySelector('.ed-caption input').focus();
        self.sync();
      });
    });
  };

  var editors = [];
  Array.prototype.forEach.call(document.querySelectorAll('form[data-attach-media]'), function (f) {
    if (f.querySelector('textarea[name=body]')) { f.__editor = new Editor(f); editors.push(f.__editor); }
  });
  // an entry half-written should not be lost to a stray tap on a tab
  window.addEventListener('beforeunload', function (e) {
    if (editors.some(function (ed) { return (ed.dirty || ed.uploads) && !ed.saving; })) { e.preventDefault(); e.returnValue = ''; }
  });
})();
