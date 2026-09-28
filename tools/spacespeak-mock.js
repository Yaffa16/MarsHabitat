#!/usr/bin/env node
'use strict';
/**
 * A stand-in for spacespeak.com, for testing the relay to space
 * (src/lib/spacespeak.js) without the real site: the same shape of pages —
 * a sign-in form at /Account/Login, the Send page at /Messages/Create (a
 * title and a message, behind the sign-in), the message's own page at
 * /Messages/<n> with its distance from Earth — and nothing else.
 *
 *   node tools/spacespeak-mock.js                # on port 8090
 *   MOCK_PORT=8091 MOCK_USER=me MOCK_PASSWORD=pw node tools/spacespeak-mock.js
 *
 * Then, for the station: SPACESPEAK_URL=http://localhost:8090
 * SPACESPEAK_USER=station SPACESPEAK_PASSWORD=secret. The test suite
 * (tools/e2e.sh) runs one. /_mock/messages lists what was sent, as JSON;
 * POST /_mock/fail with on=1 makes every send fail (500) until on=0 — for
 * seeing the relay try again.
 */
const express = require('express');
const app = express();
app.use(express.urlencoded({ extended: false }));

const USER = process.env.MOCK_USER || 'station', PASSWORD = process.env.MOCK_PASSWORD || 'secret';
const PORT = Number(process.env.MOCK_PORT || 8090);
const messages = [];
let failing = false, nextId = 142900;

const page = (title, body) => `<!doctype html><html><head><meta charset="utf-8"><title>${title} — SpaceSpeak (mock)</title></head>
<body><nav><a href="/">Home</a> · <a href="/Messages/Create">Send</a> · <a href="/Account/Login">Log in</a></nav><main>${body}</main></body></html>`;
const signedIn = (req) => /(?:^|;\s*)mockauth=1(?:;|$)/.test(req.headers.cookie || '');

app.get('/', (req, res) => res.send(page('Home', `<h1>Reach out to the Universe!</h1><ul>${messages.slice(-10).reverse().map((m) => `<li>${m.by} · Launched · <a href="/Messages/${m.id}">Message ${m.id}</a></li>`).join('')}</ul>`)));

app.get('/Account/Login', (req, res) => res.send(page('Log in', `
  <h2>Log in</h2>${req.query.failed ? '<p class="error">Invalid login attempt.</p>' : ''}
  <form method="post" action="/Account/Login">
    <input type="hidden" name="__RequestVerificationToken" value="mock-token">
    <label>Username <input type="text" name="UserName" required></label>
    <label>Password <input type="password" name="Password" required></label>
    <label><input type="checkbox" name="RememberMe" value="true"> Remember me?</label>
    <button type="submit">Log in</button>
  </form>`)));
app.post('/Account/Login', (req, res) => {
  if (req.body.UserName === USER && req.body.Password === PASSWORD) {
    res.set('Set-Cookie', 'mockauth=1; Path=/; HttpOnly').redirect(req.query.ReturnUrl || '/Messages/Create');
  } else res.redirect('/Account/Login?failed=1');
});

app.get('/Messages/Create', (req, res) => {
  if (!signedIn(req)) return res.redirect('/Account/Login?ReturnUrl=%2FMessages%2FCreate');
  res.send(page('Send a message', `
  <h2>Send a MESSAGE</h2>
  <form method="post" action="/Messages/Create">
    <input type="hidden" name="__RequestVerificationToken" value="mock-token">
    <label>Title <input type="text" name="Title" required placeholder="A title for your message"></label>
    <label>Message <textarea name="MessageText" rows="6" placeholder="Your message to the universe"></textarea></label>
    <button type="submit">Send Message</button>
  </form>`));
});
app.post('/Messages/Create', (req, res) => {
  if (!signedIn(req)) return res.redirect('/Account/Login?ReturnUrl=%2FMessages%2FCreate');
  if (failing) return res.status(500).send(page('Error', '<h2>Server Error in \'/\' Application.</h2>'));
  const text = String(req.body.MessageText || '').trim();
  if (!text) return res.send(page('Send a message', '<h2>Send a MESSAGE</h2><p class="error">The Message field is required.</p>'));
  const m = { id: nextId++, title: String(req.body.Title || ''), text, by: USER, at: new Date().toISOString() };
  messages.push(m);
  res.redirect(`/Messages/${m.id}`);
});
app.get('/Messages/:id', (req, res) => {
  const m = messages.find((x) => x.id === Number(req.params.id));
  if (!m) return res.status(404).send(page('Not found', '<p>The page you requested cannot be found.</p>'));
  const secs = (Date.now() - Date.parse(m.at)) / 1000, miles = Math.round(secs * 186282.397), km = Math.round(secs * 299792.458);
  res.send(page(`Message ${m.id}`, `<h2>${m.title}</h2><blockquote>${m.text.replace(/</g, '&lt;')}</blockquote>
    <p>Launched ${Math.round(secs)} seconds ago. This message is currently ${miles.toLocaleString('en-US')} miles (${km.toLocaleString('en-US')} km) from Earth! <a href="/Messages/${m.id}">Update distance</a></p>`));
});

app.get('/_mock/messages', (req, res) => res.json(messages));
app.post('/_mock/fail', (req, res) => { failing = String(req.body.on || '') === '1'; res.json({ failing }); });
app.post('/_mock/reset', (req, res) => { messages.length = 0; failing = false; res.json({ ok: true }); });

app.listen(PORT, () => console.log(`[spacespeak-mock] listening on http://localhost:${PORT} — user ${USER}`));
