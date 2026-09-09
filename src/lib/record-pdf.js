'use strict';
/**
 * The complete mission record as one PDF: every exchange, every blog entry
 * with its photographs in place, every mission note, schedule, meal and
 * inventory count, every state filed for the crew, the habitat summaries,
 * the stores' daily use, the trend charts, the complete correspondence
 * including what was never published, and the media index with hashes.
 *
 * It is built from the same queries as the archive pages and the Markdown
 * export, so the three never disagree; it exists because a PDF is the form
 * a record gets handed to someone in, printed, and kept. It is composed
 * with src/lib/pdf.js — no browser, no image library, no font file — so it
 * can be produced on the venue laptop with the network unplugged.
 */
const fs = require('fs');
const { db } = require('../db');
const { PDF } = require('./pdf');
const mission = require('./mission');
const data = require('./data');
const archive = require('./archive');
const mediaLib = require('./media');
const moodLib = require('./mood');
const content = require('./content');
const critical = require('./critical');
const orbital = require('./orbital');
const readingsLog = require('./readings-log');

/* ---------------------------------------------------------------- palette */
const INK = [26, 26, 26], GREY = [107, 107, 107], LIGHT = [160, 160, 160], ORANGE = [232, 83, 26];
const PALE = [243, 241, 238], RULE = [216, 212, 206], WASH = [252, 240, 233];
const SERIES = [[232, 83, 26], [26, 26, 26], [70, 110, 190], [40, 150, 110], [150, 80, 170], [200, 150, 20]];

const PAGE = { w: 595.28, h: 841.89 };
const M = { top: 64, bottom: 60, left: 52, right: 52 };
const CW = PAGE.w - M.left - M.right;   // content width

const dd = (n) => String(n).padStart(2, '0');
const ddd = (n) => String(n).padStart(3, '0');
const fmtLight = (s) => (s == null ? '—' : `${Math.floor(s / 60)} min ${String(Math.round(s % 60)).padStart(2, '0')} s`);
const fmtBytes = (b) => (b >= 1073741824 ? (b / 1073741824).toFixed(2) + ' GB' : b >= 1048576 ? (b / 1048576).toFixed(1) + ' MB' : b >= 1024 ? Math.round(b / 1024) + ' kB' : b + ' B');
const fmtNum = (v, d = 1) => (v == null || Number.isNaN(v) ? '—' : Number.isInteger(v) ? String(v) : Number(v).toFixed(d));
const cap = (s) => (s ? s.charAt(0) + s.slice(1).toLowerCase() : '');
const longDate = (iso) => new Date(iso + 'T12:00:00Z').toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' });

/* ================================================================= LAYOUT */

/**
 * A cursor that flows down the page and starts a new one when it runs out,
 * with headings, paragraphs, tables, images and charts that all understand
 * page breaks. Headers and footers are drawn last, once the page count is
 * known.
 */
class Layout {
  constructor(pdf, { runningTitle }) {
    this.pdf = pdf;
    this.runningTitle = runningTitle;
    this.page = null; this.y = 0;
    this.section = '';
    this.plain = new Set();         // pages without header/footer (cover)
    this.sections = [];             // [pageIndex, section title] for running headers
  }
  get pageIndex() { return this.pdf.pages.indexOf(this.page); }
  newPage({ plain = false } = {}) {
    this.page = this.pdf.addPage(PAGE);
    this.y = M.top;
    if (plain) this.plain.add(this.pageIndex);
    this.sections.push([this.pageIndex, this.section]);
    return this.page;
  }
  /** Make room for `h` points; start a new page if there is not. */
  need(h) { if (!this.page || this.y + h > PAGE.h - M.bottom) this.newPage(); }
  gap(h) { this.y += h; }
  bottomSpace() { return PAGE.h - M.bottom - this.y; }

  text(x, str, opts = {}) { this.pdf.text(this.page, x, this.y, str, opts); }

  h1(title, { bookmark = true, section = true } = {}) {
    if (section) this.section = title;
    this.newPage();
    if (bookmark) this.pdf.bookmark(title, this.pageIndex, this.y - 20, 0);
    this.pdf.rect(this.page, M.left, this.y, CW, 3, { fill: ORANGE });
    this.y += 26;
    for (const line of this.pdf.wrap(title, 'bold', 24, CW)) { this.pdf.text(this.page, M.left, this.y, line, { font: 'bold', size: 24 }); this.y += 28; }
    this.y += 10;
  }
  h2(title, { bookmark = false, level = 1, keep = 60 } = {}) {
    this.need(keep);
    this.y += 10;
    if (bookmark) this.pdf.bookmark(title, this.pageIndex, this.y - 14, level);
    this.pdf.text(this.page, M.left, this.y, title, { font: 'bold', size: 14, color: ORANGE });
    this.y += 20;
  }
  h3(title, { keep = 48 } = {}) {
    this.need(keep);
    this.y += 6;
    this.pdf.text(this.page, M.left, this.y, title, { font: 'bold', size: 10.5 });
    this.y += 15;
  }
  eyebrow(text) {
    this.need(14);
    this.pdf.text(this.page, M.left, this.y, text.toUpperCase(), { font: 'regular', size: 7.5, color: GREY });
    this.y += 12;
  }
  rule({ color = RULE, gap = 8 } = {}) {
    this.need(gap + 2);
    this.y += gap / 2;
    this.pdf.line(this.page, M.left, this.y, M.left + CW, this.y, { color, width: 0.5 });
    this.y += gap / 2;
  }
  /** A paragraph, wrapped, flowing across pages. */
  para(text, { font = 'regular', size = 9.5, color = INK, indent = 0, width = CW, after = 7, lead = null, x = M.left } = {}) {
    const lh = lead || size * 1.38;
    const lines = this.pdf.wrap(text, font, size, width - indent);
    for (const line of lines) {
      this.need(lh);
      if (line) this.pdf.text(this.page, x + indent, this.y, line, { font, size, color });
      this.y += lh;
    }
    this.y += after;
    return lines.length;
  }
  /** Label on the left, value wrapped on the right. */
  kv(label, value, { labelW = 120, size = 9 } = {}) {
    const lh = size * 1.4;
    const lines = this.pdf.wrap(value == null ? '—' : String(value), 'regular', size, CW - labelW);
    this.need(lh * Math.max(1, lines.length));
    this.pdf.text(this.page, M.left, this.y, label, { font: 'regular', size: size - 1, color: GREY });
    lines.forEach((l, i) => { if (i) this.need(lh); this.pdf.text(this.page, M.left + labelW, this.y, l, { size }); this.y += lh; });
    this.y += 2;
  }
  /** A quoted block: a bar down the left, text beside it. */
  quote(text, { color = ORANGE, font = 'regular', size = 9.5, fill = null } = {}) {
    const lh = size * 1.38, indent = 12;
    const lines = this.pdf.wrap(text, font, size, CW - indent - 6);
    let start = null;
    const flush = () => { if (start != null) { this.pdf.rect(this.page, M.left, start, 2, this.y - start, { fill: color }); } };
    for (const line of lines) {
      if (this.y + lh > PAGE.h - M.bottom) { flush(); this.newPage(); start = null; }
      if (start == null) start = this.y - 2;
      if (fill) this.pdf.rect(this.page, M.left + 3, this.y - lh + 3, CW - 3, lh, { fill });
      if (line) this.pdf.text(this.page, M.left + indent, this.y, line, { font, size });
      this.y += lh;
    }
    flush();
    this.y += 6;
  }

  /**
   * A table. cols: [{ label, w (share of width), align, font }]. rows: arrays
   * of strings. Header repeats after a page break; a row never splits.
   */
  table(cols, rows, { size = 8.5, headSize = 7.5, zebra = true, pad = 4, maxRowLines = 12 } = {}) {
    const total = cols.reduce((s, c) => s + (c.w || 1), 0);
    const widths = cols.map((c) => (CW * (c.w || 1)) / total);
    const lh = size * 1.3;
    const head = () => {
      this.need(lh + pad * 2 + 4);
      this.pdf.rect(this.page, M.left, this.y - 1, CW, lh + pad * 2 - 2, { fill: PALE });
      let x = M.left;
      cols.forEach((c, i) => {
        this.pdf.text(this.page, x + pad, this.y + pad + headSize, c.label, { font: 'bold', size: headSize, align: c.align || 'left', maxWidth: widths[i] - pad * 2 });
        x += widths[i];
      });
      this.y += lh + pad * 2;
    };
    head();
    rows.forEach((row, r) => {
      const cells = row.map((v, i) => this.pdf.wrap(v == null ? '' : String(v), cols[i].font || 'regular', size, widths[i] - pad * 2).slice(0, maxRowLines));
      const n = Math.max(1, ...cells.map((c) => c.length));
      const h = n * lh + pad * 2 - 2;
      if (this.y + h > PAGE.h - M.bottom) { this.newPage(); head(); }
      if (zebra && r % 2) this.pdf.rect(this.page, M.left, this.y - 1, CW, h, { fill: [249, 248, 246] });
      let x = M.left;
      cells.forEach((lines, i) => {
        lines.forEach((l, k) => this.pdf.text(this.page, x + pad, this.y + pad + size + k * lh - 1, l, { font: cols[i].font || 'regular', size, align: cols[i].align || 'left', maxWidth: widths[i] - pad * 2, color: cols[i].color || INK }));
        x += widths[i];
      });
      this.y += h;
      this.pdf.line(this.page, M.left, this.y - 1, M.left + CW, this.y - 1, { color: RULE, width: 0.3 });
    });
    this.y += 8;
  }

  /** An image scaled into maxW × maxH, kept on one page, with a caption. */
  image(img, { maxW = CW, maxH = 300, caption = '', x = M.left } = {}) {
    let w = maxW, h = (img.height / img.width) * w;
    if (h > maxH) { h = maxH; w = (img.width / img.height) * h; }
    const capLines = caption ? this.pdf.wrap(caption, 'italic', 8.5, w) : [];
    this.need(h + capLines.length * 12 + 10);
    this.pdf.image(this.page, img, x, this.y, w, h);
    this.pdf.rect(this.page, x, this.y, w, h, { stroke: RULE, width: 0.3 });
    this.y += h + 4;
    for (const l of capLines) { this.pdf.text(this.page, x, this.y + 8, l, { font: 'italic', size: 8.5, color: GREY }); this.y += 12; }
    this.y += 8;
  }

  /** A framed placeholder for a file the PDF cannot show: video, audio, a document. */
  fileBox(m, { thumb = null } = {}) {
    const boxH = thumb ? 96 : 70;
    this.need(boxH + 10);
    this.pdf.rect(this.page, M.left, this.y, CW, boxH, { fill: PALE, stroke: RULE, width: 0.3 });
    let tx = M.left + 12;
    if (thumb) { const dh = boxH - 16; const dw = Math.min(160, (thumb.width / thumb.height) * dh); const hh = (thumb.height / thumb.width) * dw; this.pdf.image(this.page, thumb, M.left + 8, this.y + 8 + (dh - hh) / 2, dw, hh); tx = M.left + 8 + dw + 12; }
    const avail = CW - (tx - M.left) - 10;
    const kind = m.kind === 'video' ? 'Video' : m.kind === 'audio' ? 'Sound' : m.kind === 'document' ? 'Document' : 'File';
    this.pdf.text(this.page, tx, this.y + 20, this.fit(`${kind} · ${m.filename}`, 'bold', 9.5, avail), { font: 'bold', size: 9.5 });
    const meta = [fmtBytes(m.bytes), m.duration_s ? `${Math.floor(m.duration_s / 60)}:${dd(Math.round(m.duration_s % 60))} min` : null, m.width && m.height ? `${m.width}×${m.height}` : null, m.designation || null].filter(Boolean).join(' · ');
    this.pdf.text(this.page, tx, this.y + 33, this.fit(meta, 'regular', 8.5, avail), { size: 8.5, color: GREY });
    if (m.caption) for (const [i, l] of this.pdf.wrap(m.caption, 'italic', 8.5, avail).slice(0, 2).entries()) this.pdf.text(this.page, tx, this.y + 46 + i * 11, l, { font: 'italic', size: 8.5 });
    this.pdf.text(this.page, tx, this.y + boxH - 8, this.fit(`SHA-256 ${m.sha256} · the original is in the media ZIP`, 'mono', 6.5, avail), { font: 'mono', size: 6.5, color: GREY });
    this.y += boxH + 8;
  }
  /** Cut a string with an ellipsis until it fits `w`. */
  fit(str, font, size, w) {
    let s = String(str);
    if (this.pdf.textWidth(s, font, size) <= w) return s;
    while (s.length > 1 && this.pdf.textWidth(s + '…', font, size) > w) s = s.slice(0, -1);
    return s + '…';
  }

  /**
   * A small chart: days on the x axis, one or more series. Each series is
   * { name, color, points: {day: v}, planned: {day: v} } — points solid,
   * planned dashed. `band` draws a min–max wash behind a series.
   */
  chart({ title, unit = '', series, totalDays, today, domain = null, w = CW, h = 120, x = M.left, band = null, legend = true, xStep = 1, xLabel = null }) {
    const padL = 34, padR = 10, padT = 18, padB = 18;
    const legendH = legend && series.length > 1 ? 12 : 0;
    this.need(h + legendH + 8);
    const top = this.y;
    const px = x + padL, pw = w - padL - padR, py = top + padT, ph = h - padT - padB;
    // domain
    let lo = domain ? domain[0] : Infinity, hi = domain ? domain[1] : -Infinity;
    if (!domain) {
      for (const s of series) for (const src of [s.points || {}, s.planned || {}]) for (const v of Object.values(src)) { if (v == null) continue; lo = Math.min(lo, v); hi = Math.max(hi, v); }
      if (band) for (const b of Object.values(band)) { lo = Math.min(lo, b[0]); hi = Math.max(hi, b[1]); }
      if (!Number.isFinite(lo)) { lo = 0; hi = 1; }
      if (lo > 0 && lo < hi * 0.6) lo = 0;      // most things are read against zero
      if (lo === hi) { if (hi > 0) { lo = 0; hi *= 1.25; } else if (hi < 0) { hi = 0; lo *= 1.25; } else { lo = 0; hi = 1; } }
      const span = hi - lo; hi += span * 0.08; if (lo !== 0) lo -= span * 0.08;
    }
    const X = (day) => px + ((day - 1) / Math.max(1, totalDays - 1)) * pw;
    const Y = (v) => py + ph - ((v - lo) / (hi - lo)) * ph;
    // frame and grid
    this.pdf.text(this.page, x, top + 8, title, { font: 'bold', size: 8.5 });
    if (unit) this.pdf.text(this.page, x + w, top + 8, unit, { size: 7.5, color: GREY, align: 'right' });
    this.pdf.rect(this.page, px, py, pw, ph, { stroke: RULE, width: 0.4 });
    for (const t of [0, 0.5, 1]) {
      const v = lo + (hi - lo) * t, yy = Y(v);
      if (t > 0 && t < 1) this.pdf.line(this.page, px, yy, px + pw, yy, { color: RULE, width: 0.3, dash: [1, 2] });
      this.pdf.text(this.page, px - 4, yy + 2.5, fmtNum(Math.abs(v) >= 100 ? Math.round(v) : v, 1), { size: 6.5, color: GREY, align: 'right' });
    }
    for (let d = 1; d <= totalDays; d += xStep) {
      const xx = X(d);
      this.pdf.text(this.page, xx, py + ph + 10, xLabel ? xLabel(d) : dd(d), { size: 6.5, color: d === today ? INK : GREY, align: 'center' });
      if (d === today) this.pdf.line(this.page, xx, py, xx, py + ph, { color: ORANGE, width: 0.6, dash: [2, 2] });
    }
    if (band) {
      const pts = [];
      for (let d = 1; d <= totalDays; d++) if (band[d]) pts.push([X(d), Y(band[d][1])]);
      for (let d = totalDays; d >= 1; d--) if (band[d]) pts.push([X(d), Y(band[d][0])]);
      if (pts.length > 2) this.pdf.path(this.page, pts, { stroke: null, fill: WASH, close: true });
    }
    series.forEach((s, i) => {
      const color = s.color || SERIES[i % SERIES.length];
      const pts = [], planned = [];
      for (let d = 1; d <= totalDays; d++) {
        const v = (s.points || {})[d];
        if (v != null) pts.push([X(d), Y(v)]);
      }
      // the planned line runs from the last real point onward
      const lastReal = pts.length ? Math.max(...Object.keys(s.points).map(Number).filter((d) => s.points[d] != null)) : 0;
      for (let d = Math.max(1, lastReal); d <= totalDays; d++) {
        const v = d === lastReal ? (s.points || {})[d] : (s.planned || {})[d];
        if (v != null) planned.push([X(d), Y(v)]);
      }
      if (planned.length > 1) this.pdf.path(this.page, planned, { stroke: color, width: 0.9, dash: [3, 2] });
      if (pts.length > 1) this.pdf.path(this.page, pts, { stroke: color, width: 1.3 });
      for (const [xx, yy] of pts) this.pdf.circle(this.page, xx, yy, 1.6, { fill: color });
      if (planned.length > 1 && pts.length <= 1 && !pts.length) { /* nothing yet */ }
    });
    this.y = top + h;
    if (legendH) {
      let lx = px;
      series.forEach((s, i) => {
        const color = s.color || SERIES[i % SERIES.length];
        this.pdf.line(this.page, lx, this.y + 4, lx + 10, this.y + 4, { color, width: 1.3 });
        this.pdf.text(this.page, lx + 13, this.y + 7, s.name, { size: 7, color: GREY });
        lx += 13 + this.pdf.textWidth(s.name, 'regular', 7) + 12;
      });
      this.y += legendH;
    }
    this.y += 8;
  }

  /** Two charts side by side, or one on the left when the list is odd. */
  chartPair(a, b) {
    const w = (CW - 12) / 2;
    const y0 = this.y;
    this.need((a.h || 120) + 20);
    const start = this.y;
    this.chart({ ...a, w, x: M.left });
    const yA = this.y;
    if (b) { this.y = start; this.chart({ ...b, w, x: M.left + w + 12 }); this.y = Math.max(yA, this.y); }
    void y0;
  }

  /** Headers and footers on every page but the plain ones. Call last. */
  finish({ footerLeft }) {
    const n = this.pdf.pages.length;
    let section = '';
    this.pdf.pages.forEach((page, i) => {
      const s = this.sections.find((x) => x[0] === i); if (s) section = s[1];
      if (this.plain.has(i)) return;
      this.pdf.text(page, M.left, 34, this.runningTitle, { size: 7.5, color: GREY });
      if (section) this.pdf.text(page, PAGE.w - M.right, 34, section, { size: 7.5, color: GREY, align: 'right' });
      this.pdf.line(page, M.left, 40, PAGE.w - M.right, 40, { color: RULE, width: 0.4 });
      this.pdf.text(page, M.left, PAGE.h - 30, footerLeft, { size: 7.5, color: GREY });
      this.pdf.text(page, PAGE.w - M.right, PAGE.h - 30, `${i + 1} / ${n}`, { size: 7.5, color: GREY, align: 'right' });
    });
  }
}

/* ================================================================== DATA */

/** Everything the record needs, gathered once. */
function gather() {
  archive.rollupPending();
  const st = mission.state();
  const total = st.totalDays;
  const pre = st.phase === 'PRE_LAUNCH';
  const today = pre ? 0 : st.clampedDay;
  const crew = db.prepare('SELECT * FROM crew ORDER BY sort_order, id').all();
  const items = db.prepare('SELECT * FROM inventory_item ORDER BY sort_order, label').all();
  const channels = db.prepare('SELECT * FROM sensor_metric ORDER BY sort_order, metric').all();
  const days = Array.from({ length: total }, (_, i) => archive.dayRecord(i + 1));
  const allDays = days.map((r) => r.day);
  const figures = content.crewFigures();
  const power = content.power();
  const activity = data.dailyActivity();
  const resourceLog = content.resourceLogRows();
  const messages = db.prepare(
    `SELECT m.*, r.body AS response_body, r.published_at AS response_at, r.written_at AS response_written, c.designation AS responder
     FROM message m LEFT JOIN response r ON r.message_id = m.id LEFT JOIN crew c ON c.id = r.crew_id
     ORDER BY m.submitted_at, m.id`).all();
  const media = mediaLib.list({ includeHidden: true });
  const moods = db.prepare('SELECT cm.*, c.designation FROM crew_mood cm JOIN crew c ON c.id = cm.crew_id ORDER BY cm.effective_at').all();
  const sensorDaily = db.prepare('SELECT sd.*, sm.label, sm.unit, sm.channel, sm.sort_order FROM sensor_daily sd LEFT JOIN sensor_metric sm ON sm.metric = sd.metric ORDER BY sm.sort_order, sd.metric, sd.mission_day').all();
  const readings = db.prepare('SELECT COUNT(*) n, MIN(recorded_at) a, MAX(recorded_at) b FROM sensor_reading').get();
  const external = safe(() => critical.rows(400), []);
  const audit = db.prepare('SELECT * FROM audit ORDER BY created_at DESC, id DESC LIMIT 400').all().reverse();
  const counts = data.counts();
  const entryCounts = data.entryCounts();
  const callsigns = db.prepare('SELECT COUNT(DISTINCT callsign) n FROM message').get().n;
  const written = days.map((r) => r.entries.filter((e) => !content.isPlaceholder(e.body)).length);
  const byId = new Map(messages.map((m) => [m.id, m]));
  const log = safe(() => readingsLog.counts(), { total: 0, bytes: 0, bySource: {} });
  return { st, byId, log, total, pre, today, crew, items, channels, days, allDays, figures, power, activity, resourceLog, messages, media, moods,
    sensorDaily, readings, external, audit, counts, entryCounts, callsigns, written, mediaCounts: mediaLib.counts() };
}
const safe = (fn, fallback) => { try { return fn(); } catch { return fallback; } };

/** Which mission day an ISO instant falls on, by the venue clock. */
function dayOf(iso, st) {
  const date = mission.localDate(new Date(iso), st.timezone);
  return mission.daysBetween(st.start_date, date) + 1;
}
const localHM = (iso, st) => (iso ? mission.localTime(new Date(iso), st.timezone).slice(0, 5) : '—');

/* ============================================================== SECTIONS */

function cover(L, G) {
  const { st } = G;
  L.newPage({ plain: true });
  const pdf = L.pdf, p = L.page;
  pdf.rect(p, M.left, 150, CW, 4, { fill: ORANGE });
  pdf.text(p, M.left, 200, 'ZKM | Hertzlab', { size: 10, color: GREY });
  pdf.text(p, M.left, 250, 'Mars!platz', { font: 'bold', size: 42 });
  pdf.text(p, M.left, 282, 'Communication Station', { font: 'bold', size: 20, color: ORANGE });
  pdf.text(p, M.left, 330, 'The complete mission record', { size: 16 });
  pdf.text(p, M.left, 350, st.name, { size: 11, color: GREY });
  let y = 400;
  const line = (k, v) => { pdf.text(p, M.left, y, k, { size: 8.5, color: GREY }); pdf.text(p, M.left + 130, y, v, { size: 10 }); y += 17; };
  line('The run', `${st.runLabelLong} · ${st.totalDays} days · ${st.timezone}`);
  line('Mission days', G.pre ? `not yet begun — opens ${st.startLabel}` : st.phase === 'COMPLETE' ? `complete — all ${st.totalDays} days` : `day ${ddd(G.today)} of ${ddd(st.totalDays)} in progress`);
  line('Exchanges published', String(G.counts.published));
  line('Messages from Earth', `${G.counts.total} from ${G.callsigns} callsigns · ${G.counts.rejected} rejected · ${G.counts.pending + G.counts.awaitingResponse} awaiting reply`);
  line('Crew log', `${G.written.reduce((a, b) => a + b, 0)} entries written · ${G.moods.length} states filed`);
  line('Media sent out', `${G.mediaCounts.total} files · ${fmtBytes(G.mediaCounts.bytes)} · ${G.mediaCounts.images} photographs, ${G.mediaCounts.videos} video, ${G.mediaCounts.audio} sound, ${G.mediaCounts.documents} documents`);
  line('Habitat readings', `${G.readings.n.toLocaleString('en-GB')} stored${G.external.length ? ` · ${G.external.length.toLocaleString('en-GB')} from the external node` : ''}`);
  line('Days sealed', `${G.days.filter((d) => d.sealed).length} of ${st.totalDays}`);
  line('Readings log', G.log.total ? `${G.log.total.toLocaleString('en-GB')} files · ${fmtBytes(G.log.bytes)} · every reading ever pulled, in /archive/readings.zip` : 'empty');
  line('This record', `generated ${new Date().toISOString().slice(0, 16).replace('T', ' ')} UTC`);
  y += 30;
  for (const t of pdf.wrap('Every day below holds the schedule as it was run, the meals, the inventory, what the crew wrote and sent out, the states filed for them, every exchange with the public and the real time each message took to cross, and the habitat as the sensors saw it. Nothing is summarised away. The photographs are placed in the entries they were sent with; the originals, byte for byte, are in the media ZIP under the hashes printed here.', 'regular', 9.5, CW - 60)) { pdf.text(p, M.left, y, t, { size: 9.5, color: INK }); y += 13.5; }
  pdf.text(p, M.left, PAGE.h - 70, 'Mission control only. The archive is part of the work.', { size: 8, color: GREY });
}

/** Contents: rendered into pages reserved before the body; filled at the end. */
function contentsPages(L, entries) {
  const perPage = 44;
  const n = Math.max(1, Math.ceil((entries.length + 2) / perPage));
  const pages = [];
  for (let i = 0; i < n; i++) { L.section = 'Contents'; L.newPage(); pages.push(L.page); }
  return pages;
}
function fillContents(L, pages, entries) {
  const pdf = L.pdf;
  let pi = 0, y = M.top;
  pdf.text(pages[0], M.left, y, 'Contents', { font: 'bold', size: 20 }); y += 34;
  for (const e of entries) {
    if (y > PAGE.h - M.bottom - 10 && pi < pages.length - 1) { pi++; y = M.top; }
    const p = pages[pi];
    const x = M.left + (e.level ? 16 : 0);
    const font = e.level ? 'regular' : 'bold';
    const label = e.title;
    const num = String(e.page + 1);
    const nw = pdf.textWidth(num, 'regular', 9.5);
    pdf.text(p, x, y, label, { font, size: 9.5 });
    const lw = pdf.textWidth(label, font, 9.5);
    // dotted leader
    let dx = x + lw + 6; const end = M.left + CW - nw - 6;
    while (dx < end) { pdf.circle(p, dx, y - 1, 0.4, { fill: LIGHT }); dx += 4; }
    pdf.text(p, M.left + CW, y, num, { size: 9.5, align: 'right' });
    pdf.link(p, M.left, y - 10, CW, 13, e.page, e.y);
    y += e.level ? 14 : 17;
  }
}

function missionSection(L, G) {
  const { st, crew, items, channels } = G;
  L.h1('The mission');
  L.para(`${st.name}. ${st.runLabelLong}, ${st.totalDays} days, on ${st.timezone} time. Three people inside a sealed habitat, and a channel between them and everyone outside it.`);
  L.h2('Crew');
  L.table([{ label: 'Designation', w: 1.2, font: 'bold' }, { label: 'Role', w: 2 }], crew.map((c) => [c.designation, c.role]));
  L.h2('What was carried in');
  L.para('Nothing is resupplied. Every store below is drawn down over the run; the day-by-day figures are in "Daily usage", and each day\'s closing count is in that day\'s record.', { color: GREY, size: 8.5 });
  L.table([{ label: 'Store', w: 1.6, font: 'bold' }, { label: 'Category', w: 1 }, { label: 'Carried in', w: 0.8, align: 'right' }, { label: 'Unit', w: 0.5 }, { label: 'Warning below', w: 0.8, align: 'right' }, { label: 'Critical', w: 0.5 }],
    items.map((i) => { const first = db.prepare('SELECT quantity FROM inventory_level WHERE item_id = ? ORDER BY mission_day LIMIT 1').get(i.id); return [i.label, i.category, fmtNum(first ? first.quantity : null), i.unit, fmtNum(i.warn_below), i.critical ? 'yes' : '']; }));
  L.h2('Monitored channels');
  L.para('Readings arrive at the station from the habitat\'s sensor node; a channel silent for more than the stale limit reads SIGNAL LOST rather than a stale number. Expected band: outside it reads CAUTION; outside the hard limits, OUT OF RANGE.', { color: GREY, size: 8.5 });
  L.table([{ label: 'Channel', w: 0.6, font: 'mono' }, { label: 'Metric', w: 1.6 }, { label: 'Unit', w: 0.6 }, { label: 'Expected band', w: 1, align: 'right' }, { label: 'Hard limits', w: 1, align: 'right' }, { label: 'Shown', w: 0.5 }],
    channels.map((c) => [c.channel || '—', c.label, c.unit, c.warn_min != null ? `${fmtNum(c.warn_min)} – ${fmtNum(c.warn_max)}` : '—', c.ok_min != null ? `${fmtNum(c.ok_min)} – ${fmtNum(c.ok_max)}` : '—', c.visible ? 'yes' : 'no']));
  L.h2('The distance');
  const rows = [];
  for (const n of [1, Math.ceil(st.totalDays / 2), st.totalDays]) {
    const g = orbital.geometry(new Date(mission.dateForDay(n) + 'T20:00:00Z'));
    rows.push([`Day ${ddd(n)} · ${longDate(mission.dateForDay(n))}`, `${g.distanceAu.toFixed(3)} au`, `${Math.round(g.distanceAu * orbital.AU_KM / 1e6)} M km`, fmtLight(g.lightSeconds), fmtLight(g.lightSeconds * 2)]);
  }
  L.table([{ label: 'When', w: 2 }, { label: 'Distance', w: 0.8, align: 'right' }, { label: '', w: 0.8, align: 'right' }, { label: 'One-way signal', w: 1, align: 'right' }, { label: 'Round trip', w: 1, align: 'right' }], rows);
  L.para('Positions are computed from Keplerian elements (src/lib/orbital.js), not fetched. The animated crossing on the station is compressed to seconds and says so; the real light-time is stored with every message and printed beside each exchange in this record.', { color: GREY, size: 8.5 });
  L.h2('How to read this record');
  L.para('Days run in order; each holds the schedule as it was run with every task\'s final status, the meals and their cost, the inventory at the close, the mission notes, the crew log with its photographs in place, the states filed for the crew with the sentences they became, every exchange published that day, what was sent out and the habitat summary. "Trends" shows the whole run on one axis; "Daily usage" tabulates every store on every day; "The crew log" gathers every blog entry in full, in order; "The complete correspondence" lists every message that reached the station, including those never published; "Media" lists every file with its SHA-256, which can be checked against the ZIP at /media/export.zip with sha256sum. Every reading the station ever pulled — each poll of the sensor node, each batch posted to the ingest endpoint, the stores and figures as they changed, each day\'s summary — is kept as one JSON file per pull in the readings log, downloadable whole at /archive/readings.zip.', { size: 9 });
}

function trendsSection(L, G) {
  const { st, total, today, items, allDays, figures, power, activity, crew, channels, sensorDaily, external, moods, written } = G;
  L.h1('Trends');
  L.para(`The run on one axis: mission days ${dd(1)}–${dd(total)}. Solid lines are days that have happened; dashed lines are what was planned for the days ahead, which turn solid as each day is filed. Today is marked.`, { color: GREY, size: 8.5 });
  const upTo = (n) => today >= n;
  const byDay = (fn, { ahead = false } = {}) => {
    const points = {}, planned = {};
    for (let n = 1; n <= total; n++) { const v = fn(n); if (v == null) continue; if (upTo(n)) points[n] = v; if (ahead) planned[n] = v; }
    return { points, planned };
  };
  const rowOf = (n, key) => { const d = allDays[n - 1]; return d && d.inventory ? d.inventory.find((i) => i.key === key) : null; };
  const chartSpec = (o) => ({ totalDays: total, today, h: 118, ...o });
  const pairs = (list) => { for (let i = 0; i < list.length; i += 2) L.chartPair(list[i], list[i + 1]); };

  L.h2('Stores — what is left');
  pairs(items.map((it) => {
    const first = rowOf(1, it.key);
    return chartSpec({ title: it.label, unit: it.unit, domain: [0, Math.max(1, first ? first.start_quantity || first.quantity : 1)], series: [{ name: it.label, ...byDay((n) => { const r = rowOf(n, it.key); return r ? r.quantity : null; }, { ahead: true }) }] });
  }));
  L.h2('Stores — daily use');
  pairs(items.map((it) => chartSpec({ title: `${it.label} · use per day`, unit: `${it.unit}/day`, series: [{ name: it.label, color: INK, ...byDay((n) => { const r = rowOf(n, it.key); return r ? r.consumption : null; }, { ahead: true }) }] })));
  L.h2('Power — consumed by category');
  const pwrAt = (n, key) => (power.days[String(n)] || {})[key] ?? null;
  pairs([
    ...power.categories.map((c) => chartSpec({ title: `Power · ${c.label}`, unit: 'kWh',
      series: [{ name: c.label, color: INK, ...byDay((n) => pwrAt(n, c.key), { ahead: true }) }] })),
    chartSpec({ title: 'Power · all categories', unit: 'kWh',
      series: [{ name: 'total', ...byDay((n) => {
        const d = power.days[String(n)]; if (!d) return null;
        const vals = power.categories.map((c) => d[c.key]).filter((v) => v != null);
        return vals.length ? Math.round(vals.reduce((s, v) => s + v, 0) * 100) / 100 : null;
      }, { ahead: true }) }] }),
  ]);
  L.h2('Meals and the crew\'s figures');
  const mealSum = (f) => byDay((n) => { const d = allDays[n - 1]; return d && d.meals.length ? d.meals.reduce((s, x) => s + (x[f] || 0), 0) : null; }, { ahead: true });
  const fig = (k) => byDay((n) => (figures[String(n)] || {})[k] ?? null, { ahead: true });
  pairs([
    chartSpec({ title: 'Meals · energy', unit: 'kcal', series: [{ name: 'planned', ...mealSum('kcal') }] }),
    chartSpec({ title: 'Meals · water', unit: 'L', series: [{ name: 'planned', ...mealSum('water_litres') }] }),
    chartSpec({ title: 'Meals · preparation power', unit: 'Wh', series: [{ name: 'planned', ...mealSum('energy_wh') }] }),
    chartSpec({ title: 'Calories consumed (crew total)', unit: 'kcal', series: [{ name: 'calories', color: INK, ...fig('calories') }] }),
    chartSpec({ title: 'Steps taken (crew total)', unit: 'steps', series: [{ name: 'steps', color: INK, ...fig('steps') }] }),
  ]);
  L.h2('Habitat — the station\'s channels');
  L.para('One point per day: the day\'s mean, with the day\'s low–high range washed behind it. From the readings the habitat node posted to the station.', { color: GREY, size: 8.5 });
  const metrics = [...new Set(sensorDaily.map((r) => r.metric))];
  const habCharts = metrics.map((metric) => {
    const rows = sensorDaily.filter((r) => r.metric === metric);
    const ch = channels.find((c) => c.metric === metric) || {};
    const points = {}, band = {};
    for (const r of rows) { if (r.avg_value != null) { points[r.mission_day] = Math.round(r.avg_value * 100) / 100; band[r.mission_day] = [r.min_value, r.max_value]; } }
    return chartSpec({ title: `${ch.channel ? ch.channel + ' · ' : ''}${ch.label || metric}`, unit: ch.unit || '', series: [{ name: ch.label || metric, points, planned: {} }], band });
  });
  if (habCharts.length) pairs(habCharts); else L.para('No readings were stored.', { color: GREY });
  if (external.length) {
    L.h2('Habitat — the external sensor node');
    L.para(`Daily means from the critical-sensors.de node (sensor ${critical.CFG.sensorId}), polled and stored by the station.`, { color: GREY, size: 8.5 });
    const keys = [['co2', 'CO₂', 'ppm'], ['temp', 'Temperature', '°C'], ['hum', 'Humidity', '%'], ['pres', 'Pressure', 'hPa'], ['light', 'Light', 'raw'], ['bat', 'Node battery', 'V']];
    const acc = {};
    for (const r of external) { const n = dayOf(new Date(r.t).toISOString(), st); if (n < 1 || n > total) continue; for (const [k] of keys) { if (r[k] == null) continue; (acc[k] = acc[k] || {})[n] = acc[k][n] || { s: 0, c: 0 }; acc[k][n].s += r[k]; acc[k][n].c++; } }
    pairs(keys.filter(([k]) => acc[k]).map(([k, name, unit]) => { const points = {}; for (const [n, v] of Object.entries(acc[k])) points[n] = Math.round((v.s / v.c) * 100) / 100; return chartSpec({ title: name, unit, series: [{ name, points, planned: {} }] }); }));
  }
  // The habitat's own hardware, through Home Assistant: one point per day —
  // a gauge's daily mean with its low–high band, a meter's daily added amount.
  {
    const haLib = require('./home-assistant');
    const perDay = {};
    for (let n = 1; n <= total; n++) {
      if (!upTo(n)) continue;
      for (const h of haLib.daySummary(archive.windowFor(n))) {
        const p = (perDay[h.id] = perDay[h.id] || { label: h.label, unit: h.unit, kind: h.kind, points: {}, band: {} });
        const v = h.kind === 'counter' ? (h.added != null ? h.added : null) : h.mean;
        if (v == null) continue;
        p.points[n] = Math.round(v * 100) / 100;
        if (h.kind !== 'counter') p.band[n] = [h.low, h.high];
      }
    }
    const charts = Object.values(perDay).filter((p) => Object.keys(p.points).length).map((p) => chartSpec({
      title: p.label, unit: p.kind === 'counter' ? `${p.unit || ''}/day` : (p.unit || ''),
      series: [{ name: p.label, points: p.points, planned: {} }],
      band: p.kind === 'counter' ? undefined : p.band }));
    if (charts.length) {
      L.h2('Habitat — the hardware (Home Assistant)');
      L.para('One point per day: a gauge\'s daily mean with the day\'s low–high range washed behind it; a meter\'s daily added amount. From the devices the station polls through Home Assistant.', { color: GREY, size: 8.5 });
      pairs(charts);
    }
  }
  L.h2('Crew states');
  L.para('The last state filed for each officer on each day. 0 is calm, 100 is angry. These numbers are never shown on the public station — only the sentence each maps to — and appear here because this is mission control\'s record.', { color: GREY, size: 8.5 });
  const lastOfDay = (crewId, key) => { const points = {}; for (const m of moods) { if (m.crew_id !== crewId) continue; const n = dayOf(m.effective_at, st); if (n >= 1 && n <= total) points[n] = m[key]; } return points; };
  L.chartPair(
    chartSpec({ title: 'Mood · calm → angry', unit: '0–100', domain: [0, 100], series: crew.map((c) => ({ name: cap(c.designation.split(' ')[0]), points: lastOfDay(c.id, 'calm_tense'), planned: {} })) }));
  L.h2('What happened each day');
  const count = (k) => byDay((n) => (activity[n] || {})[k] || 0);
  const tasksDone = byDay((n) => { const d = allDays[n - 1]; return d && d.tasks.length ? d.tasks.filter((t) => t.status === 'DONE').length : null; });
  const entries = byDay((n) => written[n - 1]);
  pairs([
    chartSpec({ title: 'Tasks done', series: [{ name: 'done', color: INK, ...tasksDone }] }),
    chartSpec({ title: 'Messages from Earth · exchanges published', series: [{ name: 'messages', ...count('messages') }, { name: 'exchanges', color: INK, ...count('exchanges') }] }),
    chartSpec({ title: 'Crew log entries written', series: [{ name: 'entries', color: INK, ...entries }] }),
    chartSpec({ title: 'Media sent out', series: [{ name: 'files', color: INK, ...count('media') }] }),
  ]);
}

function usageSection(L, G) {
  const { items, resourceLog } = G;
  L.h1('Daily usage');
  L.para('Every store on every day of the run: the quantity at the close of the day, that day\'s use, how much has gone since it was carried in, and how many days it would last at that draw. "Filed" means the day\'s figure was counted and written into inventory-levels.json (or the Habitat tab); "carried" means it is yesterday\'s figure less the daily draw. The same rows are at /resources/log.csv.', { color: GREY, size: 8.5 });
  for (const it of items) {
    const rows = resourceLog.filter((r) => r.item === it.key);
    if (!rows.length) continue;
    L.h3(`${it.label} · ${it.unit}`, { keep: 120 });
    L.table([{ label: 'Day', w: 0.5, font: 'mono' }, { label: 'Date', w: 1.2 }, { label: 'At close', w: 0.9, align: 'right' }, { label: 'Daily use', w: 0.9, align: 'right' }, { label: 'Used since start', w: 1.1, align: 'right' }, { label: 'Remaining', w: 0.9, align: 'right' }, { label: 'Days left at this use', w: 1.2, align: 'right' }, { label: 'Counted', w: 0.8 }],
      rows.map((r) => [ddd(r.mission_day), r.date, fmtNum(r.quantity_at_close), fmtNum(r.daily_use), fmtNum(r.used_since_start), r.remaining_pct == null ? '—' : r.remaining_pct + ' %', r.days_left_at_this_use == null ? '—' : fmtNum(r.days_left_at_this_use), r.source]), { size: 8 });
  }
}

/** One mission day, whole. */
function daySection(L, G, r, { asChapter = true } = {}) {
  const { st, today } = G;
  const n = r.missionDay;
  const title = `Day ${ddd(n)} · ${longDate(r.date)}`;
  if (asChapter) { L.section = title; L.newPage(); L.pdf.bookmark(title, L.pageIndex, 40, 1); L.pdf.rect(L.page, M.left, L.y, CW, 3, { fill: n === today ? ORANGE : INK }); L.y += 26; L.pdf.text(L.page, M.left, L.y, title, { font: 'bold', size: 22 }); L.y += 30; }
  else L.h1(title);
  const status = n < today ? (r.sealed ? 'sealed' : 'past, not yet sealed') : n === today ? 'today — in progress' : 'planned, ahead';
  const written = r.entries.filter((e) => !content.isPlaceholder(e.body));
  L.para(`Mission day ${ddd(n)} of ${ddd(st.totalDays)} · ${status} · ${written.length} crew ${written.length === 1 ? 'entry' : 'entries'} · ${r.messages.length} ${r.messages.length === 1 ? 'exchange' : 'exchanges'} published · ${r.traffic.sent} messages sent from Earth by ${r.traffic.callsigns} callsigns · ${r.media.length} files sent out`, { color: GREY, size: 8.5, after: 10 });
  if (r.isEmpty) { L.para('Nothing was recorded on this day.', { font: 'italic', color: GREY }); return; }
  const day = r.day;

  if (day && day.tasks.length) {
    L.h2('Schedule');
    L.table([{ label: 'Time', w: 0.5, font: 'mono' }, { label: 'Task', w: 3.5 }, { label: 'Status', w: 0.7 }],
      day.tasks.map((t) => [t.time, t.detail ? `${t.label} — ${t.detail}` : t.label, t.status === 'PLANNED' ? (n < today ? 'planned' : '') : t.status.toLowerCase()]));
  }
  if (day && day.meals.length) {
    L.h2('Meals');
    L.table([{ label: 'Slot', w: 0.7, font: 'bold' }, { label: 'Meal', w: 2.4 }, { label: 'kcal', w: 0.5, align: 'right' }, { label: 'Water L', w: 0.6, align: 'right' }, { label: 'Prep min', w: 0.6, align: 'right' }, { label: 'Wh', w: 0.5, align: 'right' }],
      [...day.meals.map((m) => [cap(m.slot), m.components ? `${m.name}\n${m.components.split('\n').join(' · ')}${m.notes ? `\n${m.notes}` : ''}` : m.name, m.kcal, fmtNum(m.water_litres, 2), m.prep_minutes, m.energy_wh]),
        ['', 'Day total', day.kcalPlanned, fmtNum(day.waterPlanned, 2), day.meals.reduce((s, m) => s + (m.prep_minutes || 0), 0), day.energyPlanned]]);
  }
  if (day && day.inventory.length) {
    L.h2('Inventory at the close of the day');
    const log = G.resourceLog.filter((x) => x.mission_day === n);
    L.table([{ label: 'Store', w: 1.6, font: 'bold' }, { label: 'Remaining', w: 0.9, align: 'right' }, { label: 'Of carried in', w: 0.8, align: 'right' }, { label: 'Daily draw', w: 0.8, align: 'right' }, { label: 'Days left', w: 0.7, align: 'right' }, { label: 'Counted', w: 0.6 }],
      day.inventory.map((i) => { const lg = log.find((x) => x.item === i.key) || {}; const left = i.consumption > 0 ? (i.quantity / i.consumption).toFixed(1) : '—'; const pct = i.start_quantity ? Math.round((i.quantity / i.start_quantity) * 100) + ' %' : '—'; return [i.label, `${fmtNum(i.quantity)} ${i.unit}`, pct, fmtNum(i.consumption), left, lg.source === 'filed' ? 'filed' : 'carried']; }));
    const why = (log.find((x) => x.note) || {}).note || (day.inventory.find((i) => i.note) || {}).note;
    if (why) L.para(why, { font: 'italic', size: 8.5, color: GREY });
  }
  if (r.power && r.power.filed) {
    L.h2('Power consumed');
    L.table([{ label: 'Category', w: 1.6, font: 'bold' }, { label: 'kWh that day', w: 1, align: 'right' }],
      [...r.power.categories.map((c) => [c.label, c.kwh == null ? '—' : fmtNum(c.kwh, 2)]),
        ['Day total', fmtNum(r.power.total, 2)]]);
  }
  const notes = day ? day.notes.filter((x) => x.published_at) : [];
  const findings = notes.filter((x) => x.kind === 'SCIENCE'), health = notes.filter((x) => x.kind === 'HEALTH'), other = notes.filter((x) => x.kind !== 'SCIENCE' && x.kind !== 'HEALTH');
  const placed = new Set();
  if (other.length) {
    L.h2('Mission notes');
    for (const x of other) { L.eyebrow(x.kind); entryBlock(L, G, x.body, [], { size: 9.5, used: placed }); }
  }
  const inNotes = new Set(notes.flatMap((x) => [...String(x.body).matchAll(/\[media:(\d+)\]/g)].map((m) => Number(m[1]))));
  if (r.entries.length) {
    L.h2('Crew log');
    for (const e of r.entries) {
      if (content.isPlaceholder(e.body)) { L.h3(e.designation); L.para(`Not written. (${content.placeholderPublic(e.body)})`, { font: 'italic', color: GREY, size: 9 }); continue; }
      L.h3(e.designation, { keep: 80 });
      L.para(`Written ${e.written_at ? `${mission.localDate(new Date(e.written_at), st.timezone)} ${localHM(e.written_at, st)}` : ''}${e.updated_at && e.updated_at !== e.written_at ? ` · last edited ${localHM(e.updated_at, st)}` : ''} habitat time`, { color: GREY, size: 7.5, after: 4 });
      entryBlock(L, G, e.body, r.media.filter((m) => m.crew_id === e.crew_id && !inNotes.has(m.id)), { used: placed });
    }
  } else if (n <= today) { L.h2('Crew log'); L.para('Nothing written by the crew on this day.', { font: 'italic', color: GREY, size: 9 }); }
  if (findings.length) { L.h2('Science findings'); for (const x of findings) entryBlock(L, G, x.body, [], { used: placed }); }
  if (health.length) { L.h2('Health activities'); for (const x of health) entryBlock(L, G, x.body, [], { used: placed }); }
  const loose = r.media.filter((m) => !placed.has(m.id));
  if (loose.length) { L.h2('Also sent out that day'); for (const m of loose) { placeMedia(L, G, m); placed.add(m.id); } }
  if (r.moods.length) {
    L.h2('Crew states filed');
    L.table([{ label: 'Time', w: 0.55, font: 'mono' }, { label: 'Officer', w: 1.3, font: 'bold' }, { label: 'Condition', w: 0.8 }, { label: 'Mood · calm to angry', w: 2.8 }, { label: 'Activity', w: 1 }],
      r.moods.map((m) => { const t = moodLib.translate(m); return [localHM(m.effective_at, st), m.designation, t.condition, `${t.lines[0] || ''} (${m.calm_tense})`, m.activity || '']; }), { size: 8 });
  }
  const unpublished = G.messages.filter((m) => m.mission_day === n && m.state !== 'PUBLISHED');
  if (r.messages.length || unpublished.length) {
    L.h2('Exchanges');
    for (const m of r.messages) exchange(L, G, m);
    if (unpublished.length) L.para(`${unpublished.length} more ${unpublished.length === 1 ? 'message' : 'messages'} sent from Earth that day ${unpublished.length === 1 ? 'was' : 'were'} not published — ${unpublished.filter((m) => m.state === 'REJECTED').length} rejected, ${unpublished.filter((m) => m.state !== 'REJECTED').length} still awaiting a reply. All of them are in "The complete correspondence".`, { font: 'italic', size: 8.5, color: GREY });
  }
  if (r.media.length) {
    L.h2('Media sent out');
    L.table([{ label: 'File', w: 2, font: 'bold' }, { label: 'Kind', w: 0.6 }, { label: 'Size', w: 0.6, align: 'right' }, { label: 'Officer', w: 1.2 }, { label: 'Caption', w: 1.8 }, { label: 'SHA-256 (full hash in Media)', w: 1.2, font: 'mono' }],
      r.media.map((m) => [m.filename, m.kind, fmtBytes(m.bytes), m.designation || '—', m.caption || '', m.sha256.slice(0, 16) + '…']), { size: 7.5 });
  }
  if (r.habitat.length) {
    L.h2('Habitat');
    L.table([{ label: 'Channel', w: 0.6, font: 'mono' }, { label: 'Metric', w: 1.6 }, { label: 'Low', w: 0.7, align: 'right' }, { label: 'High', w: 0.7, align: 'right' }, { label: 'Mean', w: 0.7, align: 'right' }, { label: 'Unit', w: 0.6 }, { label: 'Samples', w: 0.7, align: 'right' }, { label: 'Sealed', w: 0.8 }],
      r.habitat.map((h) => [h.channel || '—', h.label || h.metric, fmtNum(h.min_value), fmtNum(h.max_value), fmtNum(h.avg_value), h.unit || '', h.samples, h.sealed_at ? localHM(h.sealed_at, st) : 'open']));
  }
  if ((r.hardware || []).length) {
    L.h2('Habitat hardware');
    L.table([{ label: 'Device', w: 2, font: 'bold' }, { label: 'Low', w: 0.7, align: 'right' }, { label: 'High', w: 0.7, align: 'right' }, { label: 'Mean', w: 0.7, align: 'right' }, { label: 'Added today', w: 0.9, align: 'right' }, { label: 'Unit', w: 0.6 }, { label: 'Samples', w: 0.7, align: 'right' }],
      r.hardware.map((h) => [h.label, fmtNum(h.low), fmtNum(h.high), fmtNum(h.mean), h.added == null ? '—' : fmtNum(h.added), h.unit || '', h.samples]));
  }
  /* The day over its 24 hours: every reading pulled that day — the station's
     channels, the external node and the hardware — one point per hour on an
     00–24 axis; then the two-point day, each store from open to close and
     the calories from zero to the day's total. */
  {
    const HOURS = { totalDays: 25, today: -1, h: 104, xStep: 2, xLabel: (p) => String(p - 1).padStart(2, '0') };
    const two = (a, b) => { for (let i = 0; i < a.length; i += 2) L.chartPair(a[i], a[i + 1]); void b; };
    const hourCharts = [
      ...(r.habitatHours || []).map((c) => ({ ...HOURS, title: `${c.channel ? c.channel + ' · ' : ''}${c.label}`, unit: c.unit || '', series: [{ name: c.label, points: c.points, planned: {} }] })),
      ...(r.externalHours || []).map((c) => ({ ...HOURS, title: c.label, unit: c.unit || '', series: [{ name: c.label, points: c.points, planned: {} }] })),
      ...(r.hardwareHours || []).map((c) => ({ ...HOURS, title: c.label, unit: c.unit || '', series: [{ name: c.label, points: c.points, planned: {} }] })),
    ];
    if (hourCharts.length) {
      L.h2('The day, hour by hour');
      L.para('Every reading pulled that day — the station\'s own channels, the external node and the habitat hardware — one point per hour, 00 to 24 venue time. A gauge\'s hour is its mean; a meter shows its level.', { color: GREY, size: 8.5 });
      two(hourCharts);
    }
    const twoPoint = [
      ...(r.resourcesDay || []).map((s) => ({ ...HOURS, title: `${s.label} — open to close`, unit: s.unit || '', series: [{ name: s.label, points: { 1: s.open, 25: s.close }, planned: {} }] })),
      ...(r.caloriesDay ? [{ ...HOURS, title: 'Calories consumed — open to close', unit: 'kcal', series: [{ name: 'calories', points: { 1: r.caloriesDay.open, 25: r.caloriesDay.close }, planned: {} }] }] : []),
    ];
    if (twoPoint.length) {
      L.h2('Resources over the day');
      L.para('Two points per line: what the store held at the start of the day and at its close; the calories run from zero to the day\'s total.', { color: GREY, size: 8.5 });
      two(twoPoint);
    }
  }
}

/** An entry body with its media set where its markers are. */
function entryBlock(L, G, body, attached = [], { size = 9.5, used = new Set() } = {}) {
  const parts = String(body || '').split(/(\[media:\d+\])/);
  for (const part of parts) {
    const mm = /^\[media:(\d+)\]$/.exec(part);
    if (mm) { const m = attached.find((x) => x.id === Number(mm[1])) || mediaLib.get(Number(mm[1])); if (m) { used.add(m.id); placeMedia(L, G, m); } continue; }
    const text = part.replace(/\n{3,}/g, '\n\n').trim();
    if (text) for (const p of text.split(/\n{2,}/)) L.para(p, { size });
  }
  for (const m of attached) if (!used.has(m.id)) placeMedia(L, G, m);
}

const imageCache = new Map();
function loadImage(L, m) {
  if (imageCache.has(m.id)) return imageCache.get(m.id);
  const tryFile = (p, limit) => { try { if (p && fs.existsSync(p) && fs.statSync(p).size <= limit) return L.pdf.addImage(fs.readFileSync(p)); } catch { /* unreadable */ } return null; };
  // The preview the browser made at upload is the right size for a page and
  // is a JPEG whatever the original was; the original goes in only when there
  // is no preview and it is small enough to carry.
  let img = tryFile(mediaLib.thumbPathOf(m), 4 * 1024 * 1024);
  if (!img && m.kind === 'image') img = tryFile(mediaLib.pathOf(m), 3 * 1024 * 1024);
  imageCache.set(m.id, img);
  return img;
}
function placeMedia(L, G, m) {
  if (m.hidden) { L.para(`[${m.kind} withdrawn: ${m.filename}]`, { font: 'italic', color: GREY, size: 8.5 }); return; }
  const label = `${m.filename}${m.caption ? ` — ${m.caption}` : ''}${m.designation ? ` · ${m.designation}` : ''} · ${fmtBytes(m.bytes)} · SHA-256 ${m.sha256.slice(0, 16)}…`;
  if (m.kind === 'image') {
    const img = loadImage(L, m);
    if (img) { L.image(img, { maxW: CW * 0.8, maxH: 320, caption: label }); return; }
    L.fileBox(m); return;
  }
  L.fileBox(m, { thumb: loadImage(L, m) });
}

/** One exchange as it is shown on the board: the message, then the reply. */
function exchange(L, G, m, { withState = false } = {}) {
  const { st } = G;
  const full = G.byId.get(m.id) || m;
  if (m.response_at === undefined) m = { ...m, response_at: full.response_at, response_written: full.response_written };
  const tags = (m.tags || '').split(',').filter(Boolean).map(cap).join(', ');
  const state = withState ? ` · ${({ PUBLISHED: 'published', REJECTED: 'rejected', PENDING_APPROVAL: 'awaiting reply', APPROVED: 'awaiting reply', IN_TRANSIT: 'in transit', TRANSMITTED: 'in transit', ARRIVED: 'arrived' })[m.state] || m.state.toLowerCase()}` : '';
  L.need(48);
  L.pdf.text(L.page, M.left, L.y, m.callsign, { font: 'bold', size: 9.5, color: ORANGE });
  L.pdf.text(L.page, M.left + L.pdf.textWidth(m.callsign, 'bold', 9.5) + 6, L.y, `· Ref ${String(m.id).padStart(5, '0')} · day ${ddd(m.mission_day)} · ${localHM(m.submitted_at, st)}${tags ? ` · ${tags}` : ''}${state}`, { size: 8, color: GREY });
  L.y += 14;
  L.para(m.body, { size: 9.5, after: 4 });
  if (m.response_body) {
    L.quote(`${m.responder || 'Mars habitat'} — ${m.response_body}${m.response_at ? '' : '  [draft, not published]'}`, { color: ORANGE, fill: WASH });
  } else if (m.state === 'REJECTED') L.para(`Rejected without a reply${m.reject_reason ? `: ${m.reject_reason}` : ''}.`, { font: 'italic', color: GREY, size: 8.5 });
  else if (withState) L.para('No reply yet.', { font: 'italic', color: GREY, size: 8.5 });
  L.para(`Crossed in ${fmtLight(m.light_seconds)} at ${m.distance_au != null ? m.distance_au.toFixed(3) : '—'} au${m.response_at ? ` · reply published day ${ddd(dayOf(m.response_at, st))} ${localHM(m.response_at, st)}` : ''}`, { size: 7.5, color: GREY, after: 12 });
}

/** Every blog entry, whole, in one place: day by day, officer by officer, held ones included. */
function crewLogSection(L, G) {
  const { st, total, days } = G;
  L.h1('The crew log');
  L.para('Everything the crew wrote, in full, day by day and officer by officer — the same text as in each day\'s record, gathered so the log can be read straight through. Photographs sit where they were placed in the entry; video and sound are listed. An entry held back from the public station is included and marked, because this is mission control\'s record.', { color: GREY, size: 8.5 });
  let any = 0;
  for (let n = 1; n <= total; n++) {
    const entries = data.entriesForDay(n, { includeHeld: true }).filter((e) => !content.isPlaceholder(e.body));
    if (!entries.length) continue;
    const r = days[n - 1];
    const inNotes = new Set((r.day ? r.day.notes : []).flatMap((x) => [...String(x.body).matchAll(/\[media:(\d+)\]/g)].map((m) => Number(m[1]))));
    L.h2(`Day ${ddd(n)} · ${longDate(r.date)}`, { keep: 100 });
    for (const e of entries) {
      any++;
      L.h3(`${e.designation}${e.published ? '' : ' — held, not public'}`, { keep: 80 });
      L.para(`Written ${e.written_at ? `${mission.localDate(new Date(e.written_at), st.timezone)} ${localHM(e.written_at, st)}` : ''}${e.updated_at && e.updated_at !== e.written_at ? ` · last edited ${mission.localDate(new Date(e.updated_at), st.timezone)} ${localHM(e.updated_at, st)}` : ''} habitat time${e.held_reason ? ` · held: ${e.held_reason}` : ''}`, { color: GREY, size: 7.5, after: 4 });
      entryBlock(L, G, e.body, r.media.filter((m) => m.crew_id === e.crew_id && !inNotes.has(m.id)));
    }
  }
  if (!any) L.para('Nothing has been written yet.', { font: 'italic', color: GREY });
}

function correspondenceSection(L, G) {
  const { messages, counts, callsigns } = G;
  L.h1('The complete correspondence');
  L.para(`Every message that reached the station, in the order it was sent: ${counts.total} from ${callsigns} callsigns — ${counts.published} published with a reply, ${counts.rejected} rejected, ${counts.pending + counts.awaitingResponse} still awaiting a reply, ${counts.inTransit} in transit. Messages sent before the habitat was occupied carry day 000.`, { color: GREY, size: 8.5 });
  let day = null;
  for (const m of messages) {
    if (m.mission_day !== day) { day = m.mission_day; L.h2(day < 1 ? 'Before the mission · day 000' : `Day ${ddd(day)}`, { keep: 90 }); }
    exchange(L, G, m, { withState: true });
  }
  if (!messages.length) L.para('No messages have been sent.', { font: 'italic', color: GREY });
}

function mediaSection(L, G) {
  const { media, mediaCounts, st } = G;
  L.h1('Media');
  L.para(`Every file the crew sent out: ${mediaCounts.total} visible (${fmtBytes(mediaCounts.bytes)})${media.length - mediaCounts.total ? `, ${media.length - mediaCounts.total} withdrawn from view but kept` : ''}. Each is stored once under its SHA-256 in the station-data volume and is in /media/export.zip under its filename; sha256sum on any copy must give the hash printed here.`, { color: GREY, size: 8.5 });
  const sorted = [...media].sort((a, b) => a.mission_day - b.mission_day || a.sort_order - b.sort_order || a.id - b.id);
  let day = null;
  for (const m of sorted) {
    if (m.mission_day !== day) { day = m.mission_day; L.h2(`Day ${ddd(day)}`, { keep: 70 }); }
    L.need(40);
    L.pdf.text(L.page, M.left, L.y, `${m.filename}${m.hidden ? '  (withdrawn from view)' : ''}`, { font: 'bold', size: 9 });
    L.pdf.text(L.page, M.left + CW, L.y, `${m.kind} · ${fmtBytes(m.bytes)}${m.width && m.height ? ` · ${m.width}×${m.height}` : ''}${m.duration_s ? ` · ${Math.round(m.duration_s)} s` : ''}`, { size: 8, color: GREY, align: 'right' });
    L.y += 12;
    L.pdf.text(L.page, M.left, L.y, `${m.designation || 'unattributed'} · sent ${mission.localDate(new Date(m.uploaded_at), st.timezone)} ${localHM(m.uploaded_at, st)} habitat time${m.caption ? ` · ${m.caption}` : ''}`, { size: 8, color: GREY });
    L.y += 11;
    L.pdf.text(L.page, M.left, L.y, `SHA-256 ${m.sha256}`, { font: 'mono', size: 7.5 });
    L.y += 14;
  }
  if (!media.length) L.para('Nothing has been sent out.', { font: 'italic', color: GREY });
}

function auditSection(L, G) {
  const { audit, st } = G;
  L.h1('Audit trail');
  L.para(`What mission control did, as the station logged it${audit.length >= 400 ? ' (the most recent 400 entries)' : ''}: replies, rejections, entries, states, uploads, edits, the reset.`, { color: GREY, size: 8.5 });
  if (audit.length) L.table([{ label: 'When (habitat time)', w: 1.1, font: 'mono' }, { label: 'Who', w: 0.7 }, { label: 'Action', w: 0.8 }, { label: 'On', w: 1.6 }, { label: 'Detail', w: 2.4 }],
    audit.map((a) => [`${mission.localDate(new Date(a.created_at), st.timezone)} ${localHM(a.created_at, st)}`, a.actor, a.action, `${a.entity} ${a.entity_id}`, a.detail || '']), { size: 7.5 });
  else L.para('Nothing logged.', { font: 'italic', color: GREY });
}

/* ================================================================ BUILDS */

/** The whole mission. Returns a Buffer. */
function fullRecord() {
  imageCache.clear();
  const G = gather();
  const { st } = G;
  const pdf = new PDF({ title: `${st.name} — complete mission record`, author: 'ZKM | Hertzlab — Mars Communication Station', subject: `${st.runLabelLong}, ${st.totalDays} days` });
  const L = new Layout(pdf, { runningTitle: `${st.name} · complete mission record` });
  cover(L, G);
  // The contents list is known before the body is laid out: the sections and
  // the days. Its pages are reserved here and written once the page numbers exist.
  const toc = [];
  const sectionTitles = ['The mission', 'Trends', 'Daily usage', 'The days', ...G.days.map((r) => `Day ${ddd(r.missionDay)} · ${longDate(r.date)}`), 'The crew log', 'The complete correspondence', 'Media', 'Audit trail'];
  const tocPages = contentsPages(L, sectionTitles);
  const startOf = (title) => (L.sections.find((s) => s[1] === title) || [L.pageIndex])[0];
  const sec = (title, level = 0) => toc.push({ title, level, page: startOf(title), y: 0 });

  missionSection(L, G); sec('The mission');
  trendsSection(L, G); sec('Trends');
  usageSection(L, G); sec('Daily usage');
  L.h1('The days'); sec('The days');
  L.para(`${st.totalDays} days, each whole: the schedule as it was run, the meals, the inventory at the close, the mission notes, the crew log with its photographs, the states filed, the exchanges, what was sent out and the habitat summary. Days ahead show the plan.`, { color: GREY, size: 8.5 });
  L.table([{ label: 'Day', w: 0.5, font: 'mono' }, { label: 'Date', w: 1.6 }, { label: 'State', w: 1 }, { label: 'Entries', w: 0.6, align: 'right' }, { label: 'Exchanges', w: 0.7, align: 'right' }, { label: 'Sent from Earth', w: 0.9, align: 'right' }, { label: 'Files', w: 0.5, align: 'right' }, { label: 'Channels', w: 0.6, align: 'right' }],
    G.days.map((r, i) => [ddd(r.missionDay), longDate(r.date), r.missionDay < G.today ? (r.sealed ? 'sealed' : 'past') : r.missionDay === G.today ? 'today' : 'ahead', G.written[i], r.messages.length, r.traffic.sent, r.media.length, r.habitat.length]));
  for (const r of G.days) { const title = `Day ${ddd(r.missionDay)} · ${longDate(r.date)}`; daySection(L, G, r); sec(title, 1); }
  crewLogSection(L, G); sec('The crew log');
  correspondenceSection(L, G); sec('The complete correspondence');
  mediaSection(L, G); sec('Media');
  auditSection(L, G); sec('Audit trail');
  fillContents(L, tocPages, toc);
  L.finish({ footerLeft: `ZKM | Hertzlab · ${st.runLabelLong} · generated ${new Date().toISOString().slice(0, 10)}` });
  return pdf.build();
}

/** One day, whole. */
function dayRecord(n) {
  imageCache.clear();
  const G = gather();
  const { st } = G;
  const r = G.days[n - 1];
  if (!r) return null;
  const pdf = new PDF({ title: `${st.name} — day ${ddd(n)} · ${longDate(r.date)}`, author: 'ZKM | Hertzlab — Mars Communication Station' });
  const L = new Layout(pdf, { runningTitle: `${st.name} · day ${ddd(n)}` });
  daySection(L, G, r, { asChapter: false });
  L.finish({ footerLeft: `ZKM | Hertzlab · ${st.runLabelLong} · generated ${new Date().toISOString().slice(0, 10)}` });
  return pdf.build();
}

module.exports = { fullRecord, dayRecord, gather };
