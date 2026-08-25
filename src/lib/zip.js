'use strict';
/**
 * A streaming ZIP writer with no dependencies. Files are stored, not
 * deflated — photographs and video are already compressed, and a stored
 * archive can be verified byte for byte against the manifest. Sizes and
 * CRCs are written in a data descriptor after each file, so nothing is read
 * twice; Zip64 is used wherever a file or the archive passes 4 GB, so a
 * whole run of video is one download.
 *
 *   await writeZip(res, [
 *     { name: 'day-001/photo.jpg', path: '/data/media/ab/ab12….jpg', size, mtime },
 *     { name: 'manifest.json', data: Buffer.from(json) },
 *   ]);
 */
const fs = require('fs');

/* ------------------------------------------------------------------ crc32 */
const TABLE = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
})();
function crcUpdate(crc, buf) {
  let c = crc ^ 0xFFFFFFFF;
  for (let i = 0; i < buf.length; i++) c = TABLE[(c ^ buf[i]) & 0xFF] ^ (c >>> 8);
  return (c ^ 0xFFFFFFFF) >>> 0;
}

/* ---------------------------------------------------------------- helpers */
const SENTINEL = 0xFFFFFFFF;                      // what the 32-bit fields hold when Zip64 carries the value
const ZIP64_AT = Number(process.env.ZIP64_AT || SENTINEL);   // threshold; lowered only by the tests
function dosTime(date) {
  const d = date instanceof Date && !isNaN(date) ? date : new Date();
  const time = ((d.getHours() & 31) << 11) | ((d.getMinutes() & 63) << 5) | ((d.getSeconds() >> 1) & 31);
  const day = (((d.getFullYear() - 1980) & 127) << 9) | (((d.getMonth() + 1) & 15) << 5) | (d.getDate() & 31);
  return { time, day };
}
function u16(n) { const b = Buffer.alloc(2); b.writeUInt16LE(n & 0xFFFF); return b; }
function u32(n) { const b = Buffer.alloc(4); b.writeUInt32LE(n >>> 0); return b; }
function u64(n) { const b = Buffer.alloc(8); b.writeBigUInt64LE(BigInt(n)); return b; }

/** Write to a stream and wait for drain when it asks. */
function write(out, buf) {
  return new Promise((resolve, reject) => {
    if (out.destroyed) return reject(new Error('stream closed'));
    if (out.write(buf)) return resolve();
    const onDrain = () => { cleanup(); resolve(); };
    const onClose = () => { cleanup(); reject(new Error('stream closed')); };
    const cleanup = () => { out.off('drain', onDrain); out.off('close', onClose); out.off('error', onClose); };
    out.on('drain', onDrain); out.on('close', onClose); out.on('error', onClose);
  });
}

/* ---------------------------------------------------------------- writer */
async function writeZip(out, entries, { comment = '' } = {}) {
  let offset = 0;
  const central = [];
  const push = async (buf) => { await write(out, buf); offset += buf.length; };

  for (const e of entries) {
    const name = Buffer.from(String(e.name).replace(/\\/g, '/'), 'utf8');
    const size = e.data ? e.data.length : Number(e.size);
    const big = size >= ZIP64_AT;
    const { time, day } = dosTime(e.mtime);
    const localOffset = offset;
    const flags = 0x0008 | 0x0800;            // data descriptor follows · names are UTF-8
    const version = big ? 45 : 20;

    // local file header — sizes come later, in the descriptor
    const extra = big ? Buffer.concat([u16(0x0001), u16(16), u64(0), u64(0)]) : Buffer.alloc(0);
    await push(Buffer.concat([
      u32(0x04034b50), u16(version), u16(flags), u16(0), u16(time), u16(day),
      u32(0), u32(big ? SENTINEL : 0), u32(big ? SENTINEL : 0),
      u16(name.length), u16(extra.length), name, extra,
    ]));

    // the file itself, hashed as it goes
    let crc = 0, written = 0;
    if (e.data) {
      crc = crcUpdate(crc, e.data); written = e.data.length;
      await push(e.data);
    } else {
      const stream = fs.createReadStream(e.path);
      for await (const chunk of stream) {
        crc = crcUpdate(crc, chunk); written += chunk.length;
        await push(chunk);
      }
    }
    if (written !== size) throw new Error(`${e.name}: size changed while streaming (${written} vs ${size})`);

    // data descriptor
    await push(big
      ? Buffer.concat([u32(0x08074b50), u32(crc), u64(size), u64(size)])
      : Buffer.concat([u32(0x08074b50), u32(crc), u32(size), u32(size)]));

    central.push({ name, size, crc, time, day, localOffset, flags, version });
  }

  // central directory
  const cdStart = offset;
  for (const c of central) {
    const needZip64 = c.size >= ZIP64_AT || c.localOffset >= ZIP64_AT;
    const parts = [];
    if (c.size >= ZIP64_AT) { parts.push(u64(c.size), u64(c.size)); }
    if (c.localOffset >= ZIP64_AT) parts.push(u64(c.localOffset));
    const extra = needZip64 ? Buffer.concat([u16(0x0001), u16(parts.reduce((n, b) => n + b.length, 0)), ...parts]) : Buffer.alloc(0);
    await push(Buffer.concat([
      u32(0x02014b50), u16(needZip64 ? 45 : 20), u16(needZip64 ? 45 : c.version), u16(c.flags), u16(0),
      u16(c.time), u16(c.day), u32(c.crc),
      u32(c.size >= ZIP64_AT ? SENTINEL : c.size), u32(c.size >= ZIP64_AT ? SENTINEL : c.size),
      u16(c.name.length), u16(extra.length), u16(0), u16(0), u16(0), u32(0),
      u32(c.localOffset >= ZIP64_AT ? SENTINEL : c.localOffset),
      c.name, extra,
    ]));
  }
  const cdSize = offset - cdStart;
  const count = central.length;
  const zip64 = count >= 0xFFFF || cdSize >= ZIP64_AT || cdStart >= ZIP64_AT || central.some((c) => c.size >= ZIP64_AT || c.localOffset >= ZIP64_AT);

  if (zip64) {
    const z64Offset = offset;
    await push(Buffer.concat([
      u32(0x06064b50), u64(44), u16(45), u16(45), u32(0), u32(0),
      u64(count), u64(count), u64(cdSize), u64(cdStart),
    ]));
    await push(Buffer.concat([u32(0x07064b50), u32(0), u64(z64Offset), u32(1)]));
  }
  const cmt = Buffer.from(comment, 'utf8');
  await push(Buffer.concat([
    u32(0x06054b50), u16(0), u16(0),
    u16(count >= 0xFFFF ? 0xFFFF : count), u16(count >= 0xFFFF ? 0xFFFF : count),
    u32(cdSize >= ZIP64_AT ? SENTINEL : cdSize), u32(cdStart >= ZIP64_AT ? SENTINEL : cdStart),
    u16(cmt.length), cmt,
  ]));
  return offset;
}

module.exports = { writeZip, crcUpdate };
