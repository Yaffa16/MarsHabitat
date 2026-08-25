/* The post editor page: the toolbar strip talks to the entry composer on
   the sheet. Insert goes in after the block that has focus, else at the end. */
(function () {
  'use strict';
  var form = document.getElementById('post');
  if (!form) return;
  var toolbar = form.querySelector('.post-toolbar');
  if (!toolbar) return;
  toolbar.addEventListener('click', function (e) {
    var b = e.target.closest('button[data-insert]'); if (!b) return;
    var ed = form.__editor; if (!ed) return;
    var focused = document.activeElement && document.activeElement.closest ? document.activeElement.closest('.ed-block') : null;
    var idx = focused ? Array.prototype.indexOf.call(ed.blocks.children, focused) + 1 : ed.blocks.children.length;
    ed.addAt(idx, b.getAttribute('data-insert'));
  });
  // Ctrl/Cmd+S publishes
  document.addEventListener('keydown', function (e) {
    if ((e.ctrlKey || e.metaKey) && (e.key === 's' || e.key === 'S')) { e.preventDefault(); var pub = form.querySelector('.post-publish'); if (pub) pub.click(); }
  });
})();
