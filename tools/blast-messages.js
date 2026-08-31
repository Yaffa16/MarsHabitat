#!/usr/bin/env node
/* Simulates many visitors sending messages to the station at once.
   Each "device" first loads the landing page to be issued its own callsign
   cookie, then posts to /communicate as that visitor — so the transit lock
   and the queue see genuinely distinct senders.

     node tools/blast-messages.js                      # 5 devices, 1 message each
     node tools/blast-messages.js --devices 12 --each 2 --gap 800

   NOTE on the rate limit: it counts by visitor OR ip hash, and from one
   machine every device shares the ip hash — so after HOURLY_LIMIT messages
   the rest are refused ("uplink is saturated"), which this script reports.
   That refusal is itself worth seeing once. For a bigger blast, raise
   HOURLY_LIMIT in .env and restart first.                                   */

'use strict';
const http = require('http');

const arg = (name, dflt) => {
  const i = process.argv.indexOf('--' + name);
  return i > -1 ? process.argv[i + 1] : dflt;
};
const HOST = arg('host', 'localhost');
const PORT = Number(arg('port', 8080));
const DEVICES = Number(arg('devices', 5));
const EACH = Number(arg('each', 1));
const GAP = Number(arg('gap', 500)); // ms between sends per device

const LINES = [
  'Testing, testing — can you hear Earth?',
  'What does the habitat smell like by now?',
  'Greetings from the gallery floor.',
  'Is the water really recycled from yesterday?',
  'How many steps today?',
  'The dome looks small from out here.',
  'Did the crickets survive the night?',
  'What is for dinner on Mars?',
];
const TAGS = ['QUESTION', 'PERSONAL', 'SCIENCE', 'EARTH', 'FOOD', 'HUMOUR'];

function request(method, path, { cookie, body } = {}) {
  return new Promise((resolve, reject) => {
    const data = body ? Buffer.from(body) : null;
    const req = http.request({
      host: HOST, port: PORT, path, method,
      headers: Object.assign(
        {},
        cookie ? { Cookie: cookie } : {},
        data ? { 'Content-Type': 'application/x-www-form-urlencoded',
                 'Content-Length': data.length } : {}
      ),
    }, (res) => {
      let chunks = [];
      res.on('data', (c) => chunks.push(c));
      res.on('end', () => resolve({
        status: res.statusCode,
        setCookie: res.headers['set-cookie'] || [],
        text: Buffer.concat(chunks).toString('utf8'),
      }));
    });
    req.on('error', reject);
    if (data) req.write(data);
    req.end();
  });
}

async function device(n) {
  // load the page once to be issued a visitor identity
  const first = await request('GET', '/');
  const cookie = first.setCookie.map((c) => c.split(';')[0]).join('; ');
  const callsign = (first.text.match(/YOU ARE\s*<[^>]*>([A-Z]+-\d+)/) || [])[1] || `device-${n}`;

  let sent = 0, refused = 0;
  for (let i = 0; i < EACH; i++) {
    const line = LINES[(n + i) % LINES.length] + ` [test ${n}.${i + 1}]`;
    const tag = TAGS[(n + i) % TAGS.length];
    const body = 'body=' + encodeURIComponent(line) + '&tags=' + encodeURIComponent(tag);
    const res = await request('POST', '/communicate', { cookie, body });
    if (res.text.includes('saturated')) { refused++; }
    else if (res.status === 302 || res.status === 200) { sent++; }
    else { refused++; }
    await new Promise((r) => setTimeout(r, GAP));
  }
  console.log(`  ${callsign.padEnd(12)} sent ${sent}, refused ${refused}`);
  return { sent, refused };
}

(async () => {
  console.log(`Blasting http://${HOST}:${PORT} with ${DEVICES} devices × ${EACH} message(s)…`);
  const results = await Promise.all(
    Array.from({ length: DEVICES }, (_, n) =>
      new Promise((r) => setTimeout(() => r(device(n)), n * 150)))
  );
  const sent = results.reduce((a, r) => a + r.sent, 0);
  const refused = results.reduce((a, r) => a + r.refused, 0);
  console.log(`Done: ${sent} sent, ${refused} refused by the rate limit.`);
  console.log('Open /control — the queue should be full and the arrival banner up.');
})();
