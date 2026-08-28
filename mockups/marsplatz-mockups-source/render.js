const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch();
  for (const [file, w] of [['landing', 1440], ['control', 1440], ['phone', 430]]) {
    try {
      const p = await b.newPage({ viewport: { width: w, height: 900 }, deviceScaleFactor: 1 });
      p.on('pageerror', e => console.log(file, 'PAGE ERROR', e.message));
      await p.goto('file:///tmp/work/reimagine/' + file + '.html'); await p.waitForTimeout(600);
      await p.screenshot({ path: 'marsplatz-' + file + '.png', fullPage: true });
      console.log(file, 'ok');
      await p.close();
    } catch (e) { console.log(file, 'skip:', e.message.split('\n')[0]); }
  }
  await b.close();
})();
