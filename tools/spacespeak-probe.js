#!/usr/bin/env node
'use strict';
/**
 * Try the relay to space by hand (src/lib/spacespeak.js): sign in to
 * SpaceSpeak with the account in .env, open the Send page, type a line —
 * and stop there, with a screenshot and the page's HTML saved under
 * DATA_DIR/spacespeak/, so the account and the form can be checked before
 * the run opens. With --send the line is really sent, and the message's
 * number and address on SpaceSpeak are printed.
 *
 *   node tools/spacespeak-probe.js                      a dry run: nothing is pressed
 *   node tools/spacespeak-probe.js --send               really sends the test line
 *   node tools/spacespeak-probe.js --text "Hello …"     your own line
 *   node tools/spacespeak-probe.js --show               with the browser window in view (not in Docker)
 *
 * In Docker:  docker compose exec station node tools/spacespeak-probe.js [--send]
 * Exit code 0 when every step went through, 1 when one did not (the step
 * and the site's own words are printed, and the screenshot named).
 */
require('../src/lib/env');
const args = process.argv.slice(2);
const has = (k) => args.includes(k);
const after = (k) => { const i = args.indexOf(k); return i > -1 ? args[i + 1] : undefined; };

process.env.SPACESPEAK_DRY_RUN = has('--send') ? 'false' : 'true';
if (has('--show')) process.env.SPACESPEAK_HEADLESS = 'false';
if (!process.env.SPACESPEAK_ENABLED) process.env.SPACESPEAK_ENABLED = 'true';

const sp = require('../src/lib/spacespeak');
const text = after('--text') || `Test transmission from MARS!platz, Karlsruhe — ${new Date().toISOString().slice(0, 16).replace('T', ' ')} UTC.`;

(async () => {
  console.log(`[probe] ${sp.CFG.dryRun ? 'dry run' : 'REALLY SENDING'} to ${sp.CFG.site} as ${sp.CFG.user || '(no SPACESPEAK_USER set)'}`);
  console.log(`[probe] the line: ${JSON.stringify(text)}`);
  try {
    const r = await sp.deliver({ id: 'probe', body: text, callsign: 'PROBE' });
    for (const s of r.steps || []) console.log(`[probe]  ✓ ${s}`);
    if (r.dryRun) console.log(`[probe] every step went through; nothing was pressed. Run again with --send to send a real line.`);
    else console.log(`[probe] sent${r.remoteId ? ` — SpaceSpeak No. ${r.remoteId}` : ''}${r.remoteUrl ? ` — ${r.remoteUrl}` : ''}`);
    process.exit(0);
  } catch (e) {
    for (const s of e.steps || []) console.log(`[probe]  ✓ ${s}`);
    console.log(`[probe]  ✗ ${e.message}`);
    console.log(`[probe] screenshots and pages are kept in ${sp.CFG.dir}`);
    process.exit(1);
  }
})();
