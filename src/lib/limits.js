'use strict';
/**
 * How long a message may be, and the crew's answer to it: five hundred characters, both (8 October: "everywhere the
 * message count should be 500 in the write box"; "for all messages in /control the same limit for the answer and the
 * question: 500 — so that everything fits well" — the board's cards, the screens, the sky). MESSAGE_MAX_CHARS in .env
 * may set it lower, never higher: a .env written when the limit was a thousand keeps the five hundred.
 */
const CAP = 500;
const env = Number(process.env.MESSAGE_MAX_CHARS);
const MESSAGE_MAX = Number.isFinite(env) && env >= 50 ? Math.min(CAP, Math.round(env)) : CAP;

module.exports = { MESSAGE_MAX, REPLY_MAX: MESSAGE_MAX, CAP };
