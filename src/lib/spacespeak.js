'use strict';
/**
 * The relay to space. Every message a visitor sends to the habitat is also
 * handed to SpaceSpeak (spacespeak.com), which encodes it and beams it out of
 * the atmosphere by radio — so what is written to the crew on the Marktplatz
 * is really on its way, and its card on the board can say how far it has got
 * ("This message is currently … from Earth!", public.js / board.js).
 *
 * SpaceSpeak is used the way a person uses it: the relay opens the site in a
 * browser of its own (Playwright's Chromium, headless), signs in with the
 * station's account — SPACESPEAK_USER and SPACESPEAK_PASSWORD in .env — opens
 * the Send page, types the message into the box and presses the key. The
 * sign-in is kept in a browser profile under DATA_DIR/spacespeak/, so most
 * sends need no signing in at all.
 *
 * Only what the crew have answered goes out: a message is handed to the
 * relay when mission control publishes its reply (routes/control.js), never
 * before — nothing a visitor sends is beamed by itself, and what is rejected
 * or deleted is never sent. The relay runs behind the page — one message at
 * a time, a pause between sends (SPACESPEAK_GAP_SECONDS), and a later try
 * when the site does not answer, up to SPACESPEAK_ATTEMPTS; a message that
 * is unpublished or rejected before its turn is skipped. Mission control
 * shows every message's state — queued, sent (with SpaceSpeak's number and
 * address), failed (and why).
 *
 * On unless the account is missing (SPACESPEAK_ENABLED=false turns it off
 * with the account set; =true asks for it without one, and every send then
 * fails, visibly). SPACESPEAK_DRY_RUN=true goes through every step but the
 * last — sign in, open the page, type the message — and files the message
 * as a dry run with a screenshot, without pressing send: the way to check
 * the account and the form before the run opens (tools/spacespeak-probe.js
 * does the same from the command line). SPACESPEAK_URL points the relay at
 * another site — the mock in tools/spacespeak-mock.js is what the test suite
 * sends to.
 */
const fs = require('fs');
const path = require('path');
const { db, now, DATA_DIR } = require('../db');

const flag = String(process.env.SPACESPEAK_ENABLED || '').trim().toLowerCase();
const CFG = {
  user: process.env.SPACESPEAK_USER || '',
  password: process.env.SPACESPEAK_PASSWORD || '',
  enabled: flag === 'true' || (flag === '' && !!process.env.SPACESPEAK_USER && !!process.env.SPACESPEAK_PASSWORD),
  site: (process.env.SPACESPEAK_URL || 'https://www.spacespeak.com').replace(/\/+$/, ''),
  loginPath: process.env.SPACESPEAK_LOGIN_PATH || '/Account/Login',
  sendPath: process.env.SPACESPEAK_SEND_PATH || '/Messages/Create',
  gapMs: Math.max(2000, Number(process.env.SPACESPEAK_GAP_SECONDS || 20) * 1000),
  dryRun: String(process.env.SPACESPEAK_DRY_RUN || '').toLowerCase() === 'true',
  headless: String(process.env.SPACESPEAK_HEADLESS || '').toLowerCase() !== 'false',
  signature: process.env.SPACESPEAK_SIGNATURE || '',            // a line set under every message, e.g. "— MARS!platz, Karlsruhe"
  maxAttempts: Math.max(1, Number(process.env.SPACESPEAK_ATTEMPTS || 6)),
  timeoutMs: Math.max(5000, Number(process.env.SPACESPEAK_TIMEOUT_SECONDS || 45) * 1000),
  browserPath: process.env.SPACESPEAK_BROWSER_PATH || '',        // a Chromium/Chrome of your own instead of Playwright's
  dir: path.join(DATA_DIR, 'spacespeak'),
};
const log = (...a) => console.log('[spacespeak]', ...a);

/* ------------------------------------------------------------------ the queue */

/** File a message for sending — once: a message already sent, or on its way, is left as it is. Nothing happens when the
 *  relay is off. A message skipped earlier (unpublished before its turn) is queued again when its reply is published. */
function enqueue(messageId) {
  if (!CFG.enabled) return false;
  const t = now();
  const r = db.prepare('SELECT id, state FROM space_relay WHERE message_id = ?').get(messageId);
  if (!r) db.prepare("INSERT INTO space_relay (message_id, state, queued_at) VALUES (?, 'QUEUED', ?)").run(messageId, t);
  else if (r.state === 'SKIPPED') db.prepare("UPDATE space_relay SET state = 'QUEUED', attempts = 0, next_at = NULL, error = '', queued_at = ? WHERE id = ?").run(t, r.id);
  else return true;
  setTimeout(() => tick().catch(() => {}), 50);
  return true;
}

/** The relay's rows for a set of messages, by message id. */
function statesOf(ids) {
  if (!ids.length) return {};
  const rows = db.prepare(`SELECT * FROM space_relay WHERE message_id IN (${ids.map(() => '?').join(',')})`).all(...ids);
  return Object.fromEntries(rows.map((r) => [r.message_id, r]));
}

let busy = false, lastSentAt = 0, lastError = null, timer = null, open = null;   // `open`: the browser while a send is on

/** How the relay stands, for mission control. */
function status() {
  const counts = Object.fromEntries(db.prepare('SELECT state, COUNT(*) n FROM space_relay GROUP BY state').all().map((r) => [r.state, r.n]));
  return {
    enabled: CFG.enabled, configured: !!(CFG.user && CFG.password), site: CFG.site, dryRun: CFG.dryRun, gapSeconds: CFG.gapMs / 1000,
    busy, lastSentAt: lastSentAt ? new Date(lastSentAt).toISOString() : null, lastError,
    counts: { queued: counts.QUEUED || 0, sending: counts.SENDING || 0, sent: counts.SENT || 0, dryRun: counts.DRY_RUN || 0, failed: counts.FAILED || 0, skipped: counts.SKIPPED || 0 },
  };
}

/** Start the worker: a look at the queue every few seconds. */
function start() {
  if (!CFG.enabled) { log('off — no SPACESPEAK_USER / SPACESPEAK_PASSWORD (or SPACESPEAK_ENABLED=false)'); return; }
  fs.mkdirSync(CFG.dir, { recursive: true });
  log(`on — sending to ${CFG.site}${CFG.dryRun ? ' as a DRY RUN (nothing is pressed)' : ''}, one message every ${CFG.gapMs / 1000} s at most`);
  // a send cut short by a restart is queued again
  db.prepare("UPDATE space_relay SET state = 'QUEUED' WHERE state = 'SENDING'").run();
  timer = setInterval(() => tick().catch((e) => log('tick failed', e.message)), 5000);
  if (timer.unref) timer.unref();
  setTimeout(() => tick().catch(() => {}), 3000);
  // Playwright would otherwise take the process's SIGTERM for itself (it closes the browser and lets the process run
  // on), and the station could no longer be stopped: the browser is closed here, then the station goes down as usual.
  for (const sig of ['SIGTERM', 'SIGINT']) {
    process.once(sig, async () => {
      try { if (open) await open.close(); } catch { /* it may be gone */ }
      process.exit(sig === 'SIGINT' ? 130 : 143);
    });
  }
}

async function tick() {
  if (busy || !CFG.enabled) return;
  // only what stands published with its reply goes out: a message unpublished or rejected before its turn is skipped
  db.prepare("UPDATE space_relay SET state = 'SKIPPED', error = 'no longer published when its turn came' WHERE state = 'QUEUED' AND message_id IN (SELECT id FROM message WHERE state != 'PUBLISHED')").run();
  if (Date.now() < lastSentAt + CFG.gapMs) return;
  const t = now();
  const job = db.prepare(
    `SELECT r.id AS relay_id, r.attempts, m.* FROM space_relay r JOIN message m ON m.id = r.message_id
     WHERE r.state = 'QUEUED' AND (r.next_at IS NULL OR r.next_at <= ?) AND m.state = 'PUBLISHED'
     ORDER BY r.queued_at, r.id LIMIT 1`
  ).get(t);
  if (!job) return;
  busy = true;
  db.prepare("UPDATE space_relay SET state = 'SENDING', attempts = attempts + 1 WHERE id = ?").run(job.relay_id);
  try {
    const r = await deliver(job);
    lastSentAt = Date.now(); lastError = null;
    db.prepare("UPDATE space_relay SET state = ?, remote_id = ?, remote_url = ?, launched_at = ?, sent_at = ?, error = '', steps = ? WHERE id = ?")
      .run(r.dryRun ? 'DRY_RUN' : 'SENT', r.remoteId || null, r.remoteUrl || null, r.launchedAt, now(), (r.steps || []).join(' · '), job.relay_id);
    log(`${r.dryRun ? 'dry run' : 'sent'} message ${job.id}${r.remoteId ? ` → SpaceSpeak No. ${r.remoteId}` : ''}`);
  } catch (e) {
    lastSentAt = Date.now();
    const attempts = job.attempts + 1, failed = attempts >= CFG.maxAttempts;
    const backoff = Math.min(6 * 3600000, 60000 * Math.pow(4, attempts - 1));    // a minute, four, sixteen, an hour, four hours, six
    const msg = String(e && e.message ? e.message : e).slice(0, 600);
    lastError = { at: now(), messageId: job.id, error: msg };
    db.prepare("UPDATE space_relay SET state = ?, next_at = ?, error = ?, steps = ? WHERE id = ?")
      .run(failed ? 'FAILED' : 'QUEUED', new Date(Date.now() + backoff).toISOString(), msg, (e && e.steps ? e.steps : []).join(' · '), job.relay_id);
    log(`message ${job.id} not sent (try ${attempts}${failed ? ', given up' : `, again in ${Math.round(backoff / 60000)} min`}): ${msg}`);
  } finally { busy = false; }
}

/* ------------------------------------------------------------------ the browser */

const remoteIdOf = (url) => ((url || '').match(/\/Messages\/(\d+)/i) || [])[1] || null;
const stamp = () => new Date().toISOString().replace(/[:.]/g, '-');

/** A screenshot and the page's HTML under DATA_DIR/spacespeak/, for reading what went wrong. */
async function keep(page, name) {
  const files = [];
  try {
    fs.mkdirSync(CFG.dir, { recursive: true });
    const base = path.join(CFG.dir, `${name}-${stamp()}`);
    await page.screenshot({ path: `${base}.png`, fullPage: true }); files.push(`${base}.png`);
    fs.writeFileSync(`${base}.html`, await page.content()); files.push(`${base}.html`);
  } catch { /* the page may be gone */ }
  return files;
}
async function fail(page, why, steps) {
  const files = await keep(page, 'failed');
  const e = new Error(why + (files.length ? ` — see ${path.basename(files[0])} in ${CFG.dir}` : ''));
  e.steps = steps;
  return e;
}
const pageSays = (text) => {
  const t = String(text || '').replace(/\s+/g, ' ').trim();
  return t ? `the page says: “${t.slice(0, 160)}${t.length > 160 ? '…' : ''}”` : 'the page is blank';
};

/** Whether the page in front of us is asking for a sign-in. */
async function asksForSignIn(page) {
  if (/\/Account\/Log(in|on)/i.test(page.url())) return true;
  return (await page.locator('input[type=password]:visible').count()) > 0;
}

/** Sign in: the password box, the box before it for the name, the form's key (or Enter). */
async function signIn(page, steps) {
  if (!(await page.locator('input[type=password]:visible').count())) {
    await page.goto(CFG.site + CFG.loginPath, { waitUntil: 'domcontentloaded' });
  }
  const pw = page.locator('input[type=password]:visible').first();
  await pw.waitFor({ timeout: CFG.timeoutMs });
  const form = pw.locator('xpath=ancestor::form[1]');
  const scope = (await form.count()) ? form : page;
  const user = scope.locator('input[type=email]:visible, input[type=text]:visible, input:not([type]):visible').first();
  if (!(await user.count())) throw await fail(page, 'the sign-in page has a password box but no box for the name', steps);
  await user.fill(CFG.user);
  await pw.fill(CFG.password);
  const remember = scope.locator('input[type=checkbox]:visible').first();
  if (await remember.count()) await remember.check().catch(() => {});      // "remember me": fewer sign-ins
  const key = scope.locator('button[type=submit]:visible, input[type=submit]:visible, button:not([type]):visible').first();
  await Promise.all([
    page.waitForNavigation({ waitUntil: 'domcontentloaded', timeout: CFG.timeoutMs }).catch(() => null),
    (await key.count()) ? key.click() : pw.press('Enter'),
  ]);
  await page.waitForTimeout(600);
  if (await asksForSignIn(page)) {
    const text = await page.evaluate(() => (document.body && document.body.innerText) || '').catch(() => '');
    throw await fail(page, `the sign-in was refused — check SPACESPEAK_USER and SPACESPEAK_PASSWORD in .env; ${pageSays(text)}`, steps);
  }
  steps.push('signed in');
}

/** The box the message goes into: a textarea named for it, else the first, else an editable area. */
async function messageBox(page, steps) {
  const areas = page.locator('textarea:visible');
  const n = await areas.count();
  for (let i = 0; i < n; i++) {
    const el = areas.nth(i);
    const about = [await el.getAttribute('name'), await el.getAttribute('id'), await el.getAttribute('placeholder'), await el.getAttribute('aria-label')].join(' ');
    if (/message|text|body|content|say/i.test(about)) return el;
  }
  if (n) return areas.first();
  const editable = page.locator('[contenteditable="true"]:visible').first();
  if (await editable.count()) return editable;
  throw await fail(page, 'no box for the message on the send page', steps);
}

/** The form's other required boxes, if any — a title, a name — filled so the form goes through. */
async function fillTheRest(form, m, steps) {
  const inputs = form.locator('input[type=text]:visible, input:not([type]):visible');
  const n = await inputs.count();
  for (let i = 0; i < n; i++) {
    const el = inputs.nth(i);
    const required = (await el.getAttribute('required')) != null || (await el.getAttribute('data-val-required')) != null;
    if (!required || (await el.inputValue())) continue;
    const about = [await el.getAttribute('name'), await el.getAttribute('id'), await el.getAttribute('placeholder')].join(' ');
    if (/mail/i.test(about)) continue;
    await el.fill(`MARS!platz · ${m.callsign}`);
    steps.push(`filled the required box "${(await el.getAttribute('name')) || (await el.getAttribute('id')) || i}"`);
  }
}

/** Press send: the form's key named for it, else its first submit key, else the form itself. */
async function press(page, form) {
  const keys = form.locator('button:visible, input[type=submit]:visible, input[type=button]:visible');
  const n = await keys.count();
  let pick = null;
  for (let i = 0; i < n && !pick; i++) {
    const el = keys.nth(i);
    const label = ((await el.innerText().catch(() => '')) + ' ' + ((await el.getAttribute('value')) || '')).trim();
    if (/send|launch|submit|transmit|broadcast|beam/i.test(label)) pick = el;
  }
  if (!pick) pick = form.locator('button[type=submit]:visible, input[type=submit]:visible').first();
  if (await pick.count()) return pick.click();
  return form.evaluate((f) => (f.requestSubmit ? f.requestSubmit() : f.submit()));
}

/** One message through the site, start to finish. Resolves with SpaceSpeak's number and address; rejects with why not. */
async function deliver(m) {
  if (!CFG.user || !CFG.password) throw new Error('no SpaceSpeak account — set SPACESPEAK_USER and SPACESPEAK_PASSWORD in .env');
  let chromium;
  try { ({ chromium } = require('playwright')); } catch { throw new Error('Playwright is not installed — npm install, and npx playwright install chromium (the Docker image has it)'); }
  const text = (String(m.body || '').trim() + (CFG.signature ? `\n${CFG.signature}` : '')).trim();
  const steps = [];
  fs.mkdirSync(CFG.dir, { recursive: true });
  const context = await chromium.launchPersistentContext(path.join(CFG.dir, 'profile'), {
    headless: CFG.headless, viewport: { width: 1280, height: 900 }, locale: 'en-GB', timezoneId: 'Europe/Berlin',
    handleSIGINT: false, handleSIGTERM: false, handleSIGHUP: false,           // the station's own signals stay the station's
    args: ['--disable-background-networking', '--disable-component-update', '--no-first-run', '--no-default-browser-check'],   // the browser talks to the site and nobody else
    ...(CFG.browserPath ? { executablePath: CFG.browserPath } : {}),
  });
  open = context;
  const page = context.pages()[0] || (await context.newPage());
  page.setDefaultTimeout(CFG.timeoutMs);
  try {
    await page.goto(CFG.site + CFG.sendPath, { waitUntil: 'domcontentloaded' });
    steps.push('opened the send page');
    if (await asksForSignIn(page)) {
      await signIn(page, steps);
      await page.goto(CFG.site + CFG.sendPath, { waitUntil: 'domcontentloaded' });
      if (await asksForSignIn(page)) throw await fail(page, 'signed in, and the send page still asks for a sign-in', steps);
    }
    const box = await messageBox(page, steps);
    steps.push('found the message box');
    await box.click();
    await box.fill('');
    await box.type(text, { delay: 4 });                                          // typed, as a person would
    steps.push('typed the message');
    const form = box.locator('xpath=ancestor::form[1]');
    if (await form.count()) await fillTheRest(form, m, steps);
    if (CFG.dryRun) {
      const files = await keep(page, `dry-run-${m.id}`);
      steps.push(`dry run — nothing pressed${files.length ? `; ${path.basename(files[0])}` : ''}`);
      return { dryRun: true, launchedAt: now(), steps };
    }
    const before = page.url();
    await Promise.all([
      page.waitForNavigation({ waitUntil: 'domcontentloaded', timeout: CFG.timeoutMs }).catch(() => null),
      (await form.count()) ? press(page, form) : box.press('Control+Enter'),
    ]);
    await page.waitForTimeout(800);
    const url = page.url(), id = remoteIdOf(url);
    const said = await page.evaluate(() => (document.body && document.body.innerText) || '').catch(() => '');
    const confirmed = !!id || /launched|has been sent|message sent|was sent|thank you|success/i.test(said);
    if (!confirmed) throw await fail(page, `no confirmation after pressing send${url === before ? ' — the page did not change' : ''}; ${pageSays(said)}`, steps);
    steps.push(id ? `sent — SpaceSpeak No. ${id}` : 'sent');
    return { remoteId: id, remoteUrl: id ? `${CFG.site}/Messages/${id}` : url, launchedAt: now(), steps };
  } catch (e) {
    if (e && !e.steps) e.steps = steps;
    throw e;
  } finally {
    open = null;
    await context.close().catch(() => {});
  }
}

module.exports = { CFG, enqueue, statesOf, status, start, tick, deliver };
