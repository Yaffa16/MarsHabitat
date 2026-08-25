'use strict';
const fs = require('fs');
const path = require('path');

/**
 * Reads .env from the project root. Docker Compose does this for you; running
 * `npm start` directly does not, and having the two behave differently is the
 * kind of difference that only shows up at the worst moment.
 *
 * Values already in the environment win, so an explicit
 * `PORT=... npm start` still overrides the file. (The run's dates are not
 * read from here at all — see src/lib/run.js.)
 */
const file = path.join(__dirname, '../../.env');
if (fs.existsSync(file)) {
  for (const line of fs.readFileSync(file, 'utf8').split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eq = trimmed.indexOf('=');
    if (eq < 1) continue;
    const key = trimmed.slice(0, eq).trim();
    let value = trimmed.slice(eq + 1).trim();
    if ((value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    if (process.env[key] === undefined) process.env[key] = value;
  }
}
