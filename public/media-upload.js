/* Media uplink — the upload form on mission control's Media tab.
   Without this script the form still works as a plain multipart post. With
   it, each file goes up on its own request with a progress bar, and a small
   preview is made here first: a downscaled JPEG for a photograph, a frame
   captured from a video, so the gallery has thumbnails without the server
   ever touching the original. The original is what is archived. */
(function () {
  'use strict';
  if (!window.FormData || !window.XMLHttpRequest) return;
  var form = document.getElementById('media-form');
  var input = document.getElementById('media-files');
  var drop = document.getElementById('media-drop');
  var send = document.getElementById('media-send');
  var progress = document.getElementById('media-progress');
  var THUMB = 640;   // longest side of the preview, in pixels

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
        try { out.thumb = toJpeg(img, img.naturalWidth, img.naturalHeight); } catch (e) { /* tainted or huge: no preview */ }
        URL.revokeObjectURL(url); resolve(out);
      };
      img.onerror = function () { URL.revokeObjectURL(url); resolve({}); };   // HEIC and friends: the original still goes up
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
      v.addEventListener('seeked', function () {
        try { out.thumb = toJpeg(v, v.videoWidth, v.videoHeight); } catch (e) { /* no frame: fine */ }
        finish();
      });
      v.addEventListener('error', finish);
      setTimeout(finish, 8000);   // a codec the browser cannot decode: give up on the preview, not the upload
      v.src = url;
    });
  }
  function preview(file) {
    if (/^image\//.test(file.type)) return previewImage(file);
    if (/^video\//.test(file.type)) return previewVideo(file);
    return Promise.resolve({});
  }

  /* -------------------------------------------------------------- upload */
  function row(file, host) {
    var el = document.createElement('div');
    el.className = 'media-row';
    el.innerHTML = '<span class="media-row-name">' + file.name.replace(/[<>&]/g, '') + '</span>' +
      '<span class="media-row-size">' + (file.size / 1048576).toFixed(1) + ' MB</span>' +
      '<div class="media-bar"><i></i></div><span class="media-row-state">preparing…</span>';
    (host || progress).appendChild(el);
    return {
      bar: el.querySelector('.media-bar i'), state: el.querySelector('.media-row-state'), el: el,
      set: function (pct, text, cls) { this.bar.style.width = pct + '%'; this.state.textContent = text; if (cls) el.classList.add(cls); },
    };
  }
  function uploadOne(file, meta, r, fields) {
    return new Promise(function (resolve) {
      var fd = new FormData();
      fd.append('day', fields.day);
      fd.append('crew_id', fields.crew_id);
      fd.append('caption', fields.caption);
      if (meta.thumb) fd.append('thumb', meta.thumb);
      if (meta.width) fd.append('width', meta.width);
      if (meta.height) fd.append('height', meta.height);
      if (meta.duration) fd.append('duration', meta.duration);
      fd.append('file', file, file.name);
      var xhr = new XMLHttpRequest();
      xhr.open('POST', '/control/media/upload', true);
      xhr.setRequestHeader('X-Requested-With', 'fetch');
      xhr.upload.addEventListener('progress', function (e) {
        if (e.lengthComputable) r.set(Math.round(e.loaded / e.total * 100), 'sending ' + Math.round(e.loaded / e.total * 100) + '%');
      });
      xhr.addEventListener('load', function () {
        var ok = false, msg = 'failed', id = null;
        try { var j = JSON.parse(xhr.responseText); ok = !!j.ok; id = ok ? j.items[0].id : null; msg = ok ? 'in the archive · ' + j.items[0].sha256.slice(0, 12) + '…' : (j.error || msg); } catch (e) { msg = 'server error ' + xhr.status; }
        r.set(100, msg, ok ? 'ok' : 'err'); resolve(ok ? { ok: true, id: id } : { ok: false });
      });
      xhr.addEventListener('error', function () { r.set(0, 'network error — try again', 'err'); resolve({ ok: false }); });
      xhr.send(fd);
    });
  }

  /* ------------------------------------------ files attached to an entry */
  /* Every blog form carries a file picker. With this script the files go up
     first, one by one with a preview and a progress bar, under the entry's
     day and officer; then the text is saved as usual. Without it, the same
     form posts everything at once. */
  Array.prototype.forEach.call(document.querySelectorAll('form[data-attach-media]'), function (f) {
    var pick = f.querySelector('input[type=file]');
    var chosen = f.querySelector('.attach-chosen');
    var host = f.querySelector('.attach-progress');
    var box = f.querySelector('textarea[name=body]');
    if (!pick) return;
    pick.addEventListener('change', function () {
      var n = pick.files ? pick.files.length : 0;
      if (chosen) chosen.textContent = n ? n + ' file' + (n === 1 ? '' : 's') + ' chosen' : 'none chosen';
    });
    f.addEventListener('submit', function (e) {
      var files = Array.prototype.slice.call(pick.files || []);
      if (!files.length || f.getAttribute('data-uploaded') === '1') return;   // nothing attached: a plain save
      e.preventDefault();
      var btn = f.querySelector('button.primary'); if (btn) btn.disabled = true;
      if (host) { host.hidden = false; host.innerHTML = ''; }
      var fields = { day: f.elements.day.value, crew_id: f.getAttribute('data-crew-id') || '',
        caption: f.elements.media_caption ? f.elements.media_caption.value : '' };
      var okCount = 0;
      files.reduce(function (p, file) {
        return p.then(function () {
          var r = row(file, host);
          return preview(file).then(function (meta) { r.set(0, 'sending 0%'); return uploadOne(file, meta, r, fields); })
            .then(function (res) {
              if (!res.ok) return;
              okCount++;
              if (box) box.value = (box.value.trim() ? box.value.trim() + '\n\n' : '') + '[media:' + res.id + ']';
            });
        });
      }, Promise.resolve()).then(function () {
        // the files are in and placed; now the words, through the form as normal
        pick.value = '';
        f.setAttribute('data-uploaded', '1');
        if (btn) btn.disabled = false;
        if (okCount < files.length && !window.confirm((files.length - okCount) + ' file(s) failed to upload. Save the text anyway?')) { f.removeAttribute('data-uploaded'); return; }
        f.submit();
      });
    });
  });

  if (!form) return;
  form.addEventListener('submit', function (e) {
    var files = Array.prototype.slice.call(input.files || []);
    if (!files.length) return;                 // let the browser complain
    e.preventDefault();
    send.disabled = true; progress.hidden = false; progress.innerHTML = '';
    var fields = { day: form.elements.day.value, crew_id: form.elements.crew_id.value, caption: form.elements.caption.value };
    var okCount = 0;
    files.reduce(function (p, file) {
      return p.then(function () {
        var r = row(file);
        return preview(file).then(function (meta) { r.set(0, 'sending 0%'); return uploadOne(file, meta, r, fields); })
          .then(function (res) { if (res.ok) okCount++; });
      });
    }, Promise.resolve()).then(function () {
      var note = document.createElement('div');
      note.className = 'media-row-done';
      note.innerHTML = okCount + ' of ' + files.length + ' added. <a href="/control?tab=media&day=' + form.elements.day.value + '#media">Refresh the list</a>';
      progress.appendChild(note);
      send.disabled = false; input.value = '';
      if (okCount === files.length) setTimeout(function () { location.href = '/control?tab=media&day=' + form.elements.day.value + '#media'; }, 900);
    });
  });

  /* ---------------------------------------------------------- drag & drop */
  ['dragenter', 'dragover'].forEach(function (ev) { drop.addEventListener(ev, function (e) { e.preventDefault(); drop.classList.add('over'); }); });
  ['dragleave', 'drop'].forEach(function (ev) { drop.addEventListener(ev, function (e) { e.preventDefault(); drop.classList.remove('over'); }); });
  drop.addEventListener('drop', function (e) {
    if (e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files.length) { input.files = e.dataTransfer.files; showChosen(); }
  });
  function showChosen() {
    var n = input.files ? input.files.length : 0;
    var b = drop.querySelector('b');
    b.textContent = n ? n + ' file' + (n === 1 ? '' : 's') + ' chosen' : 'Choose files';
  }
  input.addEventListener('change', showChosen);
})();
