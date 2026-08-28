'use strict';
/**
 * A PDF writer with no dependencies, in the spirit of zip.js: the record has
 * to be producible on the venue laptop with the network unplugged and no
 * browser, image library or font file to hand, and it has to be readable
 * in twenty years by anything that opens a PDF.
 *
 * What it does: A4 pages, the standard Helvetica family and Courier (built
 * into every PDF reader since 1993, so nothing is embedded), text in
 * WinAnsi encoding with real widths for wrapping, lines, rectangles and
 * paths for the charts, JPEG photographs placed as they are, PNGs decoded
 * here and stored losslessly, bookmarks for every section and day, internal
 * links for the contents page, and Flate-compressed content streams.
 *
 * What it does not do: embed fonts, so the few characters WinAnsi lacks
 * (✧, ₂, arrows) are substituted with something close.
 *
 * Coordinates handed to this module are from the top-left corner in
 * points, like a page in a word processor; the conversion to PDF's
 * bottom-left origin happens here and nowhere else.
 */
const zlib = require('zlib');
const crypto = require('crypto');

/* ------------------------------------------------------------- font widths */
// Glyph widths per 1000 em for WinAnsiEncoding, from the Adobe core AFMs.
// Helvetica and Helvetica-Oblique share one table.
const W_HELV = [
  0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0, 0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,
  278,278,355,556,556,889,667,191,333,333,389,584,278,333,278,278,
  556,556,556,556,556,556,556,556,556,556,278,278,584,584,584,556,
  1015,667,667,722,722,667,611,778,722,278,500,667,556,833,722,778,
  667,778,722,667,611,722,667,944,667,667,611,278,278,278,469,556,
  333,556,556,500,556,556,278,556,556,222,222,500,222,833,556,556,
  556,556,333,500,278,556,500,722,500,500,500,334,260,334,584,350,
  556,350,222,556,333,1000,556,556,333,1000,667,333,1000,350,611,350,
  350,222,222,333,333,350,556,1000,333,1000,500,333,944,350,500,667,
  278,333,556,556,556,556,260,556,333,737,370,556,584,333,737,333,
  400,584,333,333,333,556,537,278,333,333,365,556,834,834,834,611,
  667,667,667,667,667,667,1000,722,667,667,667,667,278,278,278,278,
  722,722,778,778,778,778,778,584,778,722,722,722,722,667,667,611,
  556,556,556,556,556,556,889,500,556,556,556,556,278,278,278,278,
  556,556,556,556,556,556,556,584,611,556,556,556,556,500,556,500,
];
const W_HELV_BOLD = [
  0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0, 0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,
  278,333,474,556,556,889,722,238,333,333,389,584,278,333,278,278,
  556,556,556,556,556,556,556,556,556,556,333,333,584,584,584,611,
  975,722,722,722,722,667,611,778,722,278,556,722,611,833,722,778,
  667,778,722,667,611,722,667,944,667,667,611,333,278,333,584,556,
  333,556,611,556,611,556,333,611,611,278,278,556,278,889,611,611,
  611,611,389,556,333,611,556,778,556,556,500,389,280,389,584,350,
  556,350,278,556,500,1000,556,556,333,1000,667,333,1000,350,611,350,
  350,278,278,500,500,350,556,1000,333,1000,556,333,944,350,500,667,
  278,333,556,556,556,556,280,556,333,737,370,556,584,333,737,333,
  400,584,333,333,333,611,556,278,333,333,365,556,834,834,834,611,
  722,722,722,722,722,722,1000,722,667,667,667,667,278,278,278,278,
  722,722,778,778,778,778,778,584,778,722,722,722,722,667,667,611,
  556,556,556,556,556,556,889,556,556,556,556,556,278,278,278,278,
  611,611,611,611,611,611,611,584,611,611,611,611,611,556,611,556,
];
const W_COURIER = new Array(256).fill(600);

const FONTS = {
  regular: { base: 'Helvetica', widths: W_HELV },
  bold: { base: 'Helvetica-Bold', widths: W_HELV_BOLD },
  italic: { base: 'Helvetica-Oblique', widths: W_HELV },
  bolditalic: { base: 'Helvetica-BoldOblique', widths: W_HELV_BOLD },
  mono: { base: 'Courier', widths: W_COURIER },
  monobold: { base: 'Courier-Bold', widths: W_COURIER },
};

/* ---------------------------------------------------------------- encoding */
// Unicode → WinAnsi byte. 0x00–0x7F and 0xA0–0xFF are Latin-1; the 0x80–0x9F
// block holds the typographic characters the station uses most.
const WIN = new Map([
  [0x20AC, 0x80], [0x201A, 0x82], [0x0192, 0x83], [0x201E, 0x84], [0x2026, 0x85], [0x2020, 0x86],
  [0x2021, 0x87], [0x02C6, 0x88], [0x2030, 0x89], [0x0160, 0x8A], [0x2039, 0x8B], [0x0152, 0x8C],
  [0x017D, 0x8E], [0x2018, 0x91], [0x2019, 0x92], [0x201C, 0x93], [0x201D, 0x94], [0x2022, 0x95],
  [0x2013, 0x96], [0x2014, 0x97], [0x02DC, 0x98], [0x2122, 0x99], [0x0161, 0x9A], [0x203A, 0x9B],
  [0x0153, 0x9C], [0x017E, 0x9E], [0x0178, 0x9F],
  [0x03BC, 0xB5], [0x00A0, 0x20], [0x2212, 0x2D], [0x2010, 0x2D], [0x2011, 0x2D],
]);
// Characters WinAnsi cannot show, replaced by something that reads the same.
const SUBST = new Map([
  ['✧', '·'], ['✕', 'x'], ['✓', 'v'], ['→', '->'], ['←', '<-'], ['↔', '<->'], ['↑', '^'], ['↓', 'v'],
  ['₀', '0'], ['₁', '1'], ['₂', '2'], ['₃', '3'], ['₄', '4'], ['＋', '+'], ['…', '…'], ['−', '-'],
  ['°', '°'], ['′', "'"], ['″', '"'], [' ', ' '], [' ', ' '], ['\t', '    '],
]);

function toWinAnsi(str) {
  const out = [];
  for (const ch of String(str)) {
    const s = SUBST.has(ch) ? SUBST.get(ch) : ch;
    for (const c of s) {
      const cp = c.codePointAt(0);
      if (cp < 0x80 || (cp >= 0xA0 && cp <= 0xFF)) out.push(cp);
      else if (WIN.has(cp)) out.push(WIN.get(cp));
      else if (cp === 0x0A || cp === 0x0D) out.push(0x20);
      else if (cp >= 0x300 && cp <= 0x36F) { /* combining mark: drop */ }
      else out.push(0x3F);
    }
  }
  return Buffer.from(out);
}

/* ------------------------------------------------------------------ images */

/** Width, height and colour components of a JPEG from its SOF marker. */
function jpegInfo(buf) {
  if (buf.length < 4 || buf[0] !== 0xFF || buf[1] !== 0xD8) return null;
  let i = 2;
  while (i + 9 < buf.length) {
    if (buf[i] !== 0xFF) { i++; continue; }
    const marker = buf[i + 1];
    if (marker === 0xD8 || (marker >= 0xD0 && marker <= 0xD7) || marker === 0x01 || marker === 0xFF) { i += 2; continue; }
    const len = buf.readUInt16BE(i + 2);
    if ([0xC0, 0xC1, 0xC2, 0xC3, 0xC5, 0xC6, 0xC7, 0xC9, 0xCA, 0xCB, 0xCD, 0xCE, 0xCF].includes(marker)) {
      return { height: buf.readUInt16BE(i + 5), width: buf.readUInt16BE(i + 7), components: buf[i + 9],
        progressive: marker === 0xC2 || marker === 0xC6 || marker === 0xCA || marker === 0xCE, adobe: false };
    }
    i += 2 + len;
  }
  return null;
}

/**
 * Decode a PNG to raw samples so it can be stored losslessly with Flate.
 * Handles every non-interlaced PNG: grey, RGB, palette, with or without
 * alpha, 1–16 bits. Interlaced files return null and get a placeholder.
 */
function pngDecode(buf) {
  const SIG = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  if (buf.length < 33 || !buf.subarray(0, 8).equals(SIG)) return null;
  let i = 8, w = 0, h = 0, depth = 8, ctype = 0, interlace = 0, plte = null, trns = null;
  const idat = [];
  while (i + 8 <= buf.length) {
    const len = buf.readUInt32BE(i), type = buf.toString('latin1', i + 4, i + 8);
    const body = buf.subarray(i + 8, i + 8 + len);
    if (type === 'IHDR') { w = body.readUInt32BE(0); h = body.readUInt32BE(4); depth = body[8]; ctype = body[9]; interlace = body[12]; }
    else if (type === 'PLTE') plte = body;
    else if (type === 'tRNS') trns = body;
    else if (type === 'IDAT') idat.push(body);
    else if (type === 'IEND') break;
    i += 12 + len;
  }
  if (!w || !h || interlace) return null;
  const channels = { 0: 1, 2: 3, 3: 1, 4: 2, 6: 4 }[ctype];
  if (!channels) return null;
  let raw;
  try { raw = zlib.inflateSync(Buffer.concat(idat)); } catch { return null; }
  const bitsPerPixel = channels * depth;
  const stride = Math.ceil((w * bitsPerPixel) / 8);
  const bpp = Math.max(1, Math.ceil(bitsPerPixel / 8));
  if (raw.length < h * (stride + 1)) return null;
  // unfilter, in place, into `lines`
  const lines = Buffer.alloc(h * stride);
  let prev = Buffer.alloc(stride);
  for (let y = 0; y < h; y++) {
    const ft = raw[y * (stride + 1)];
    const src = raw.subarray(y * (stride + 1) + 1, (y + 1) * (stride + 1));
    const cur = lines.subarray(y * stride, (y + 1) * stride);
    for (let x = 0; x < stride; x++) {
      const a = x >= bpp ? cur[x - bpp] : 0, b = prev[x], c = x >= bpp ? prev[x - bpp] : 0;
      let v = src[x];
      if (ft === 1) v += a;
      else if (ft === 2) v += b;
      else if (ft === 3) v += (a + b) >> 1;
      else if (ft === 4) { const p = a + b - c, pa = Math.abs(p - a), pb = Math.abs(p - b), pc = Math.abs(p - c); v += pa <= pb && pa <= pc ? a : pb <= pc ? b : c; }
      cur[x] = v & 0xFF;
    }
    prev = cur;
  }
  // read one sample (0–255) at channel k of pixel x on line y
  const max = (1 << depth) - 1;
  const sample = (line, x, k) => {
    if (depth === 8) return line[x * channels + k];
    if (depth === 16) return line[(x * channels + k) * 2];
    const bit = (x * channels + k) * depth, byte = line[bit >> 3];
    const v = (byte >> (8 - depth - (bit & 7))) & max;
    return ctype === 3 ? v : Math.round((v * 255) / max);
  };
  const gray = ctype === 0 || ctype === 4;
  const outC = gray ? 1 : 3;
  const rgb = Buffer.alloc(w * h * outC);
  let alpha = null;
  const hasAlpha = ctype === 4 || ctype === 6 || (trns && (ctype === 3 || ctype === 0 || ctype === 2));
  if (hasAlpha) alpha = Buffer.alloc(w * h, 255);
  const tKey = trns && ctype === 0 ? trns.readUInt16BE(0) : trns && ctype === 2 ? [trns.readUInt16BE(0), trns.readUInt16BE(2), trns.readUInt16BE(4)] : null;
  for (let y = 0; y < h; y++) {
    const line = lines.subarray(y * stride, (y + 1) * stride);
    for (let x = 0; x < w; x++) {
      const o = (y * w + x);
      if (ctype === 3) {
        const idx = sample(line, x, 0);
        if (plte) { rgb[o * 3] = plte[idx * 3]; rgb[o * 3 + 1] = plte[idx * 3 + 1]; rgb[o * 3 + 2] = plte[idx * 3 + 2]; }
        if (alpha) alpha[o] = trns && idx < trns.length ? trns[idx] : 255;
      } else if (gray) {
        const g = sample(line, x, 0);
        rgb[o] = g;
        if (ctype === 4) alpha[o] = sample(line, x, 1);
        else if (tKey != null && alpha) alpha[o] = (depth === 16 ? line.readUInt16BE(x * 2) : g) === tKey ? 0 : 255;
      } else {
        const r = sample(line, x, 0), g = sample(line, x, 1), b = sample(line, x, 2);
        rgb[o * 3] = r; rgb[o * 3 + 1] = g; rgb[o * 3 + 2] = b;
        if (ctype === 6) alpha[o] = sample(line, x, 3);
        else if (tKey && alpha) alpha[o] = (depth === 16
          ? line.readUInt16BE(x * 6) === tKey[0] && line.readUInt16BE(x * 6 + 2) === tKey[1] && line.readUInt16BE(x * 6 + 4) === tKey[2]
          : r === tKey[0] && g === tKey[1] && b === tKey[2]) ? 0 : 255;
      }
    }
  }
  return { width: w, height: h, gray, data: rgb, alpha };
}

/* ------------------------------------------------------------------ writer */

class PDF {
  constructor({ title = '', author = '', subject = '', creator = 'Mars Communication Station' } = {}) {
    this.meta = { title, author, subject, creator };
    this.pages = [];
    this.images = new Map();     // sha → { id, ... }
    this.imageList = [];
    this.outline = [];           // { title, page, y, level }
    this.usedFonts = new Set();
  }

  addPage({ width = 595.28, height = 841.89 } = {}) {
    const page = { width, height, ops: [], fonts: new Set(), images: new Set(), annots: [] };
    this.pages.push(page);
    return page;
  }
  get pageCount() { return this.pages.length; }

  /* ---- text */
  font(name) { return FONTS[name] || FONTS.regular; }
  textWidth(str, font = 'regular', size = 10) {
    const f = this.font(font);
    const bytes = toWinAnsi(str);
    let w = 0;
    for (const b of bytes) w += f.widths[b] || 0;
    return (w * size) / 1000;
  }
  /** Break a string into lines that fit `maxWidth`. Words longer than a line are cut. */
  wrap(str, font, size, maxWidth) {
    const out = [];
    for (const para of String(str == null ? '' : str).replace(/\r/g, '').split('\n')) {
      const words = para.split(/(\s+)/).filter((w) => w.length);
      let line = '';
      for (const w of words) {
        if (/^\s+$/.test(w)) { if (line) line += ' '; continue; }
        const cand = line + w;
        if (this.textWidth(cand, font, size) <= maxWidth) { line = cand; continue; }
        if (line) { out.push(line.trimEnd()); line = ''; }
        // a single word wider than the line: cut it
        let piece = '';
        for (const ch of w) {
          if (this.textWidth(piece + ch, font, size) > maxWidth && piece) { out.push(piece); piece = ''; }
          piece += ch;
        }
        line = piece;
      }
      out.push(line.trimEnd());
    }
    return out;
  }
  text(page, x, y, str, { font = 'regular', size = 10, color = [0, 0, 0], align = 'left', maxWidth = null } = {}) {
    const bytes = toWinAnsi(str);
    if (!bytes.length) return;
    let dx = 0;
    if (align !== 'left') {
      const w = this.textWidth(str, font, size);
      dx = align === 'right' ? -(w) : -(w / 2);
      if (maxWidth != null) dx = align === 'right' ? maxWidth - w : (maxWidth - w) / 2;
    }
    const f = this.font(font);
    page.fonts.add(font); this.usedFonts.add(font);
    page.ops.push(`BT /F_${font} ${num(size)} Tf ${rgb(color)} rg 1 0 0 1 ${num(x + dx)} ${num(page.height - y)} Tm <${bytes.toString('hex')}> Tj ET`);
    void f;
  }

  /* ---- vector */
  line(page, x1, y1, x2, y2, { width = 0.5, color = [0, 0, 0], dash = null } = {}) {
    page.ops.push(`q ${num(width)} w ${rgb(color)} RG ${dash ? `[${dash.map(num).join(' ')}] 0 d` : ''} ${num(x1)} ${num(page.height - y1)} m ${num(x2)} ${num(page.height - y2)} l S Q`);
  }
  rect(page, x, y, w, h, { fill = null, stroke = null, width = 0.5 } = {}) {
    if (!fill && !stroke) return;
    const op = fill && stroke ? 'B' : fill ? 'f' : 'S';
    page.ops.push(`q ${fill ? rgb(fill) + ' rg' : ''} ${stroke ? rgb(stroke) + ' RG ' + num(width) + ' w' : ''} ${num(x)} ${num(page.height - y - h)} ${num(w)} ${num(h)} re ${op} Q`);
  }
  /** Polyline through points [[x,y],...]; `fill` closes and fills it. */
  path(page, pts, { stroke = [0, 0, 0], width = 1, dash = null, fill = null, close = false, cap = 1, join = 1 } = {}) {
    if (!pts.length) return;
    const d = pts.map(([x, y], i) => `${num(x)} ${num(page.height - y)} ${i ? 'l' : 'm'}`).join(' ');
    const op = fill && stroke ? 'B' : fill ? 'f' : close ? 's' : 'S';
    page.ops.push(`q ${num(width)} w ${cap} J ${join} j ${stroke ? rgb(stroke) + ' RG' : ''} ${fill ? rgb(fill) + ' rg' : ''} ${dash ? `[${dash.map(num).join(' ')}] 0 d` : ''} ${d} ${op} Q`);
  }
  circle(page, cx, cy, r, { fill = null, stroke = null, width = 0.5 } = {}) {
    const k = 0.5523 * r, y = page.height - cy;
    const op = fill && stroke ? 'B' : fill ? 'f' : 'S';
    page.ops.push(`q ${fill ? rgb(fill) + ' rg' : ''} ${stroke ? rgb(stroke) + ' RG ' + num(width) + ' w' : ''} ` +
      `${num(cx + r)} ${num(y)} m ${num(cx + r)} ${num(y + k)} ${num(cx + k)} ${num(y + r)} ${num(cx)} ${num(y + r)} c ` +
      `${num(cx - k)} ${num(y + r)} ${num(cx - r)} ${num(y + k)} ${num(cx - r)} ${num(y)} c ` +
      `${num(cx - r)} ${num(y - k)} ${num(cx - k)} ${num(y - r)} ${num(cx)} ${num(y - r)} c ` +
      `${num(cx + k)} ${num(y - r)} ${num(cx + r)} ${num(y - k)} ${num(cx + r)} ${num(y)} c ${op} Q`);
  }

  /* ---- images */
  /**
   * Register an image. JPEGs are stored byte for byte; PNGs are decoded and
   * stored losslessly. Returns { id, width, height } or null if the file is
   * not something this writer can place.
   */
  addImage(buf) {
    if (!buf || !buf.length) return null;
    const sha = crypto.createHash('sha256').update(buf).digest('hex');
    if (this.images.has(sha)) return this.images.get(sha);
    let img = null;
    const j = jpegInfo(buf);
    if (j && j.width && j.height) {
      img = { kind: 'jpeg', width: j.width, height: j.height, components: j.components, data: buf };
    } else {
      const p = pngDecode(buf);
      if (p) img = { kind: 'raw', width: p.width, height: p.height, gray: p.gray, data: zlib.deflateSync(p.data), alpha: p.alpha ? zlib.deflateSync(p.alpha) : null };
    }
    if (!img) return null;
    img.id = this.imageList.length + 1;
    this.images.set(sha, img);
    this.imageList.push(img);
    return img;
  }
  image(page, img, x, y, w, h) {
    page.images.add(img.id);
    page.ops.push(`q ${num(w)} 0 0 ${num(h)} ${num(x)} ${num(page.height - y - h)} cm /Im${img.id} Do Q`);
  }

  /* ---- structure */
  bookmark(title, pageIndex, y = 0, level = 0) { this.outline.push({ title, page: pageIndex, y, level }); }
  /** An internal link: clicking the rectangle jumps to a page. */
  link(page, x, y, w, h, targetPageIndex, targetY = 0) { page.annots.push({ x, y, w, h, page: targetPageIndex, ty: targetY }); }

  /* ---- output */
  build() {
    const objects = [];            // strings or Buffers, index+1 = object number
    const add = (body) => { objects.push(body); return objects.length; };
    const reserve = () => { objects.push(null); return objects.length; };
    const set = (n, body) => { objects[n - 1] = body; };

    const catalogId = reserve(), pagesId = reserve(), infoId = reserve();
    // fonts
    const fontIds = {};
    for (const name of this.usedFonts) {
      fontIds[name] = add(`<< /Type /Font /Subtype /Type1 /BaseFont /${this.font(name).base} /Encoding /WinAnsiEncoding >>`);
    }
    // images
    const imageIds = {};
    for (const img of this.imageList) {
      if (img.kind === 'jpeg') {
        const cs = img.components === 1 ? '/DeviceGray' : img.components === 4 ? '/DeviceCMYK' : '/DeviceRGB';
        const decode = img.components === 4 ? ' /Decode [1 0 1 0 1 0 1 0]' : '';
        imageIds[img.id] = add(stream(`<< /Type /XObject /Subtype /Image /Width ${img.width} /Height ${img.height} /ColorSpace ${cs} /BitsPerComponent 8 /Filter /DCTDecode${decode}`, img.data));
      } else {
        let smask = '';
        if (img.alpha) {
          const sid = add(stream(`<< /Type /XObject /Subtype /Image /Width ${img.width} /Height ${img.height} /ColorSpace /DeviceGray /BitsPerComponent 8 /Filter /FlateDecode`, img.alpha));
          smask = ` /SMask ${sid} 0 R`;
        }
        imageIds[img.id] = add(stream(`<< /Type /XObject /Subtype /Image /Width ${img.width} /Height ${img.height} /ColorSpace ${img.gray ? '/DeviceGray' : '/DeviceRGB'} /BitsPerComponent 8 /Filter /FlateDecode${smask}`, img.data));
      }
    }
    // pages
    const pageIds = this.pages.map(() => reserve());
    this.pages.forEach((page, i) => {
      const content = add(stream('<<', zlib.deflateSync(Buffer.from(page.ops.join('\n'), 'latin1')), ' /Filter /FlateDecode'));
      const fonts = [...page.fonts].map((n) => `/F_${n} ${fontIds[n]} 0 R`).join(' ');
      const xobjs = [...page.images].map((id) => `/Im${id} ${imageIds[id]} 0 R`).join(' ');
      const annots = page.annots.map((a) => add(
        `<< /Type /Annot /Subtype /Link /Rect [${num(a.x)} ${num(page.height - a.y - a.h)} ${num(a.x + a.w)} ${num(page.height - a.y)}] /Border [0 0 0] ` +
        `/Dest [${pageIds[a.page]} 0 R /XYZ null ${num(this.pages[a.page].height - a.ty)} null] >>`));
      set(pageIds[i], `<< /Type /Page /Parent ${pagesId} 0 R /MediaBox [0 0 ${num(page.width)} ${num(page.height)}] ` +
        `/Resources << /Font << ${fonts} >> /XObject << ${xobjs} >> /ProcSet [/PDF /Text /ImageC /ImageB] >> ` +
        `/Contents ${content} 0 R${annots.length ? ` /Annots [${annots.map((n) => n + ' 0 R').join(' ')}]` : ''} >>`);
    });
    set(pagesId, `<< /Type /Pages /Kids [${pageIds.map((n) => n + ' 0 R').join(' ')}] /Count ${pageIds.length} >>`);

    // outline: two levels, built as a tree from the flat list
    let outlinesId = null;
    if (this.outline.length) {
      outlinesId = reserve();
      const items = this.outline.map((o) => ({ ...o, id: reserve(), children: [] }));
      const roots = [];
      let lastRoot = null;
      for (const it of items) {
        if (it.level === 0 || !lastRoot) { roots.push(it); lastRoot = it; }
        else lastRoot.children.push(it);
      }
      const write = (list, parentId) => {
        list.forEach((it, i) => {
          const dest = `/Dest [${pageIds[it.page]} 0 R /XYZ null ${num(this.pages[it.page].height - it.y)} null]`;
          const kids = it.children.length ? ` /First ${it.children[0].id} 0 R /Last ${it.children[it.children.length - 1].id} 0 R /Count ${it.children.length}` : '';
          set(it.id, `<< /Title ${pdfString(it.title)} /Parent ${parentId} 0 R${i ? ` /Prev ${list[i - 1].id} 0 R` : ''}${i < list.length - 1 ? ` /Next ${list[i + 1].id} 0 R` : ''}${kids} ${dest} >>`);
          if (it.children.length) write(it.children, it.id);
        });
      };
      write(roots, outlinesId);
      set(outlinesId, `<< /Type /Outlines /First ${roots[0].id} 0 R /Last ${roots[roots.length - 1].id} 0 R /Count ${roots.length} >>`);
    }

    set(catalogId, `<< /Type /Catalog /Pages ${pagesId} 0 R${outlinesId ? ` /Outlines ${outlinesId} 0 R /PageMode /UseOutlines` : ''} >>`);
    const d = new Date();
    const stamp = `D:${d.toISOString().replace(/[-:T]/g, '').slice(0, 14)}Z`;
    set(infoId, `<< /Title ${pdfString(this.meta.title)} /Author ${pdfString(this.meta.author)} /Subject ${pdfString(this.meta.subject)} /Creator ${pdfString(this.meta.creator)} /Producer (mars-station pdf.js) /CreationDate (${stamp}) /ModDate (${stamp}) >>`);

    // serialise
    const parts = [Buffer.from('%PDF-1.5\n%\xE2\xE3\xCF\xD3\n', 'latin1')];
    const offsets = [];
    let pos = parts[0].length;
    objects.forEach((body, i) => {
      offsets.push(pos);
      const head = Buffer.from(`${i + 1} 0 obj\n`, 'latin1');
      const b = Buffer.isBuffer(body) ? body : Buffer.from(String(body), 'latin1');
      const tail = Buffer.from('\nendobj\n', 'latin1');
      parts.push(head, b, tail);
      pos += head.length + b.length + tail.length;
    });
    const xref = [`xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`];
    for (const o of offsets) xref.push(`${String(o).padStart(10, '0')} 00000 n \n`);
    xref.push(`trailer\n<< /Size ${objects.length + 1} /Root ${catalogId} 0 R /Info ${infoId} 0 R /ID [<${randomId()}> <${randomId()}>] >>\nstartxref\n${pos}\n%%EOF\n`);
    parts.push(Buffer.from(xref.join(''), 'latin1'));
    return Buffer.concat(parts);
  }
}

/* ----------------------------------------------------------------- helpers */
const num = (v) => (Number.isInteger(v) ? String(v) : (Math.round(v * 100) / 100).toString());
const rgb = (c) => c.map((v) => num(v / 255)).join(' ');
const randomId = () => crypto.randomBytes(16).toString('hex');
function stream(dictHead, data, extra = '') {
  return Buffer.concat([Buffer.from(`${dictHead}${extra} /Length ${data.length} >>\nstream\n`, 'latin1'), data, Buffer.from('\nendstream', 'latin1')]);
}
/** A PDF text string: UTF-16BE with BOM so bookmarks keep their accents. */
function pdfString(s) {
  const b = Buffer.from('\uFEFF' + String(s || ''), 'utf16le');
  b.swap16();
  return `<${b.toString('hex')}>`;
}

module.exports = { PDF, toWinAnsi, jpegInfo, pngDecode, FONTS };
