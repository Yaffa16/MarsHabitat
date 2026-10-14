'use strict';
/**
 * A visitor's GIF or sticker, sent with their message (14 October: "In the messages from people, ALLOW stickers and
 * Gifs. Display the Gifs and stickers on the website properly and also on the control page" — their own, one with a
 * message, up to 5 MB).
 *
 * One image a message, of the kinds a phone's keyboard, its gallery or a clipboard hand over as a GIF or a sticker:
 * GIF, PNG (APNG too) and WebP (animated too) — told by the file's own first bytes, never by its name or the type the
 * browser claims; anything else is refused, an SVG above all (it can carry script). At most 5 MB and 4096 pixels a
 * side. Before it is kept, what the file says about where and when it was made goes: a PNG's text, time and EXIF
 * chunks, a WebP's EXIF and XMP chunks (the extended header's flags cleared with them), a GIF's comments and XMP — the
 * picture itself, its frames, colours and timing, are left as they are.
 *
 * Kept on the station-data volume under message-media/, a name of its own for each (never the visitor's), and served
 * by /message-media/<name> (server.js) only where the message may be seen: to everyone once it is published, to
 * mission control always (the queue shows it before anything is decided), and to its own sender — never a message
 * waiting or turned down to anyone else.
 */
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { DATA_DIR } = require('../db');

const DIR = path.join(DATA_DIR, 'message-media');
const MAX_BYTES = 5 * 1024 * 1024;
const MAX_SIDE = 4096;
const MIME = { gif: 'image/gif', png: 'image/png', webp: 'image/webp' };
const NAME = /^[a-z0-9]{6,14}-[0-9a-f]{16}\.(gif|png|webp)$/;

/** The kind the file's first bytes say it is — 'gif', 'png', 'webp' — or null. */
function sniff(buf) {
  if (!Buffer.isBuffer(buf) || buf.length < 16) return null;
  const a = buf.toString('latin1', 0, 6);
  if (a === 'GIF87a' || a === 'GIF89a') return 'gif';
  if (buf.readUInt32BE(0) === 0x89504e47 && buf.readUInt32BE(4) === 0x0d0a1a0a) return 'png';
  if (buf.toString('latin1', 0, 4) === 'RIFF' && buf.toString('latin1', 8, 12) === 'WEBP') return 'webp';
  return null;
}

/* ------------------------------------------------------------------ GIF */
/** A GIF walked block by block: its size, and the file again without its comments and XMP (or null: not a GIF that
 *  holds together). */
function gif(buf) {
  if (buf.length < 13) return null;
  const w = buf.readUInt16LE(6), h = buf.readUInt16LE(8);
  const packed = buf[10];
  let i = 13;
  if (packed & 0x80) i += 3 * (1 << ((packed & 7) + 1));               // the global colour table
  if (i > buf.length) return null;
  const keep = [buf.subarray(0, i)];
  const subBlocks = (j) => {                                           // the end of a run of sub-blocks, or -1
    while (j < buf.length) { const n = buf[j]; j += 1; if (n === 0) return j; j += n; }
    return -1;
  };
  while (i < buf.length) {
    const b = buf[i];
    if (b === 0x3b) { keep.push(buf.subarray(i, i + 1)); return { w, h, out: Buffer.concat(keep) }; }   // the trailer
    if (b === 0x21) {                                                  // an extension
      if (i + 2 > buf.length) return null;
      const label = buf[i + 1];
      const end = subBlocks(i + 2);
      if (end < 0) return null;
      let drop = label === 0xfe;                                       // a comment
      if (label === 0xff && buf[i + 2] === 11) {                       // an application's: kept for the loop (NETSCAPE2.0, ANIMEXTS1.0), not for XMP
        const app = buf.toString('latin1', i + 3, i + 14);
        drop = /^XMP Data/.test(app);
      }
      if (!drop) keep.push(buf.subarray(i, end));
      i = end;
      continue;
    }
    if (b === 0x2c) {                                                  // an image: its descriptor, its colours, its data
      if (i + 10 > buf.length) return null;
      const p = buf[i + 9];
      let j = i + 10;
      if (p & 0x80) j += 3 * (1 << ((p & 7) + 1));
      j += 1;                                                          // the LZW minimum code size
      if (j > buf.length) return null;
      const end = subBlocks(j);
      if (end < 0) return null;
      keep.push(buf.subarray(i, end));
      i = end;
      continue;
    }
    return null;                                                       // nothing a GIF holds
  }
  // no trailer: a file cut short after a whole block — closed here
  keep.push(Buffer.from([0x3b]));
  return { w, h, out: Buffer.concat(keep) };
}

/* ------------------------------------------------------------------ PNG */
const PNG_DROP = new Set(['eXIf', 'tEXt', 'zTXt', 'iTXt', 'tIME']);
function png(buf) {
  let i = 8, w = 0, h = 0;
  const keep = [buf.subarray(0, 8)];
  let first = true;
  while (i + 12 <= buf.length) {
    const len = buf.readUInt32BE(i), type = buf.toString('latin1', i + 4, i + 8);
    const end = i + 12 + len;
    if (end > buf.length || !/^[A-Za-z]{4}$/.test(type)) return null;
    if (first) { if (type !== 'IHDR' || len < 8) return null; w = buf.readUInt32BE(i + 8); h = buf.readUInt32BE(i + 12); first = false; }
    if (!PNG_DROP.has(type)) keep.push(buf.subarray(i, end));
    i = end;
    if (type === 'IEND') return { w, h, out: Buffer.concat(keep) };
  }
  return null;                                                         // no IEND: not a whole PNG
}

/* ----------------------------------------------------------------- WebP */
function webp(buf) {
  let i = 12, w = 0, h = 0, vp8x = -1;
  const chunks = [];
  while (i + 8 <= buf.length) {
    const type = buf.toString('latin1', i, i + 4), len = buf.readUInt32LE(i + 4);
    const end = i + 8 + len + (len & 1);
    if (i + 8 + len > buf.length) return null;
    const data = buf.subarray(i + 8, i + 8 + len);
    if (!chunks.length) {                                              // the first chunk says the size
      if (type === 'VP8X' && len >= 10) { vp8x = 0; w = 1 + data.readUIntLE(4, 3); h = 1 + data.readUIntLE(7, 3); }
      else if (type === 'VP8 ' && len >= 10 && data[3] === 0x9d && data[4] === 0x01 && data[5] === 0x2a) { w = data.readUInt16LE(6) & 0x3fff; h = data.readUInt16LE(8) & 0x3fff; }
      else if (type === 'VP8L' && len >= 5 && data[0] === 0x2f) { const v = data.readUInt32LE(1); w = 1 + (v & 0x3fff); h = 1 + ((v >>> 14) & 0x3fff); }
      else return null;
    }
    if (type !== 'EXIF' && type !== 'XMP ') chunks.push(buf.subarray(i, Math.min(end, buf.length)));
    i = end;
  }
  if (!chunks.length) return null;
  if (vp8x === 0) {                                                    // the extended header no longer promises what went
    const head = Buffer.from(chunks[0]);
    head[8] &= ~(0x08 | 0x04);
    chunks[0] = head;
  }
  const body = Buffer.concat(chunks);
  const riff = Buffer.alloc(12);
  riff.write('RIFF', 0, 'latin1'); riff.writeUInt32LE(4 + body.length, 4); riff.write('WEBP', 8, 'latin1');
  return { w, h, out: Buffer.concat([riff, body]) };
}

/**
 * The file a visitor sent, checked and cleaned: { kind, mime, w, h, out } — or { error } in words a visitor can act on.
 */
function check(buf) {
  if (!Buffer.isBuffer(buf) || !buf.length) return { error: 'empty' };
  if (buf.length > MAX_BYTES) return { error: 'too big' };
  const kind = sniff(buf);
  if (!kind) return { error: 'not a GIF or sticker' };
  let r = null;
  try { r = kind === 'gif' ? gif(buf) : kind === 'png' ? png(buf) : webp(buf); } catch { r = null; }
  if (!r || !r.w || !r.h) return { error: 'unreadable' };
  if (r.w > MAX_SIDE || r.h > MAX_SIDE) return { error: 'too large' };
  return { kind, mime: MIME[kind], w: r.w, h: r.h, out: r.out };
}

/** Keep a checked file on the volume, under a name of its own: { file, mime, bytes, w, h }. */
function save(c) {
  fs.mkdirSync(DIR, { recursive: true });
  const file = `${Date.now().toString(36)}-${crypto.randomBytes(8).toString('hex')}.${c.kind}`;
  fs.writeFileSync(path.join(DIR, file), c.out);
  return { file, mime: c.mime, bytes: c.out.length, w: c.w, h: c.h };
}

/** The file on the volume for a stored name — null for anything that is not one of ours. */
function pathOf(file) {
  if (!NAME.test(String(file || ''))) return null;
  const p = path.join(DIR, file);
  return fs.existsSync(p) ? p : null;
}

function remove(file) { const p = pathOf(file); if (p) { try { fs.unlinkSync(p); } catch { /* gone already */ } } }

/** Every kept file gone — the reset to 15 October, which empties the messages they belonged to. */
function clearAll() {
  let n = 0;
  try { for (const f of fs.readdirSync(DIR)) if (NAME.test(f)) { fs.unlinkSync(path.join(DIR, f)); n++; } } catch { /* none kept */ }
  return n;
}

module.exports = { DIR, MAX_BYTES, MAX_SIDE, MIME, NAME, sniff, check, save, pathOf, remove, clearAll };
