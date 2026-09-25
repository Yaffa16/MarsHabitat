'use strict';
/**
 * The complete mission record as one PDF: for every day that has happened,
 * what was entered on the station that day and what its sensors measured —
 * the schedule as it was run, the meals, the stores as they were counted,
 * the power and the crew's figures as they were filed, every mission note,
 * every blog entry with its photographs in place, every state filed for the
 * crew, what was sent out, the habitat's daily summary and every reading
 * behind it — then the crew log whole and the media index with hashes. The
 * messages from Earth and the crew's replies are not part of the record,
 * and neither is mission control's audit trail. Before the run, a marked
 * rehearsal chapter for today shows the shape of a day's record.
 *
 * Nothing in it is generated: no chart, no projection, no total, no figure
 * carried from one day to the next, no plan for a day that has not come. A
 * store that was not counted on a day has no figure for that day; a day
 * that has not happened has no chapter. It is built from the same queries
 * as the archive pages and the Markdown export, so the three never
 * disagree, and composed with src/lib/pdf.js — no browser, no image
 * library, no font file — so it can be produced on the venue laptop with
 * the network unplugged.
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
const readingsLog = require('./readings-log');
const critical = require('./critical');
// What the Habitat panel is read from: the habitat sensor through Home
// Assistant, or the external node.
const habitatSource = () => (critical.source() === 'home-assistant' ? 'the habitat sensor' : 'the sensor node');

/* ---------------------------------------------------------------- palette */
const INK = [26, 26, 26], GREY = [107, 107, 107], LIGHT = [160, 160, 160], ORANGE = [232, 83, 26];
const PALE = [243, 241, 238], RULE = [216, 212, 206];

const PAGE = { w: 595.28, h: 841.89 };
const M = { top: 64, bottom: 60, left: 52, right: 52 };
const CW = PAGE.w - M.left - M.right;   // content width

const dd = (n) => String(n).padStart(2, '0');
const ddd = (n) => String(n).padStart(3, '0');
const fmtBytes = (b) => (b >= 1073741824 ? (b / 1073741824).toFixed(2) + ' GB' : b >= 1048576 ? (b / 1048576).toFixed(1) + ' MB' : b >= 1024 ? Math.round(b / 1024) + ' kB' : b + ' B');
const fmtNum = (v, d = 1) => (v == null || Number.isNaN(v) ? '—' : Number.isInteger(v) ? String(v) : Number(v).toFixed(d));
/** A figure exactly as it was entered — no rounding, no formatting. */
const asIs = (v) => (v == null || v === '' ? '—' : String(v));
const cap = (s) => (s ? s.charAt(0) + s.slice(1).toLowerCase() : '');
const longDate = (iso) => new Date(iso + 'T12:00:00Z').toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' });

/* ================================================================= LAYOUT */

/**
 * A cursor that flows down the page and starts a new one when it runs out,
 * with headings, paragraphs, tables and images that all understand page
 * breaks. Headers and footers are drawn last, once the page count is known.
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

/** Everything the record needs, gathered once. Only the days that have
    happened are read; the days ahead are known by date alone. */
function gather() {
  archive.rollupPending();
  const st = mission.state();
  const total = st.totalDays;
  const pre = st.phase === 'PRE_LAUNCH';
  const today = pre ? 0 : st.clampedDay;
  const upTo = archive.recordedUpTo(st);
  const crew = db.prepare('SELECT * FROM crew ORDER BY sort_order, id').all();
  const items = db.prepare('SELECT * FROM inventory_item ORDER BY sort_order, label').all();
  const channels = db.prepare('SELECT * FROM sensor_metric ORDER BY sort_order, metric').all();
  const days = Array.from({ length: upTo }, (_, i) => archive.dayRecord(i + 1));
  const media = mediaLib.list({ includeHidden: true });
  const moods = db.prepare("SELECT cm.*, c.designation FROM crew_mood cm JOIN crew c ON c.id = cm.crew_id WHERE cm.set_by != 'content' ORDER BY cm.effective_at").all();
  const readings = db.prepare(
    `SELECT COUNT(*) n FROM sensor_reading WHERE device_id NOT IN (${archive.FAKE_DEVICES.map(() => '?').join(', ')})`
  ).get(...archive.FAKE_DEVICES);
  const written = days.map((r) => r.entries.filter((e) => !content.isPlaceholder(e.body)).length);
  const log = safe(() => readingsLog.counts(), { total: 0, bytes: 0, bySource: {} });
  const readingsInRecord = days.reduce((n, r) => n + r.readings.count, 0);
  // before the run: today's rehearsal record, shown marked, never part of the record
  const rehearsal = pre ? archive.rehearsalRecord(st) : null;
  return { st, log, total, pre, today, upTo, crew, items, channels, days, media, moods, rehearsal,
    readings, readingsInRecord, written, mediaCounts: mediaLib.counts(), carriedIn: content.inventoryStart() };
}
const safe = (fn, fallback) => { try { return fn(); } catch { return fallback; } };

const localHM = (iso, st) => (iso ? mission.localTime(new Date(iso), st.timezone).slice(0, 5) : '—');

/* ============================================================== SECTIONS */

function cover(L, G) {
  const { st } = G;
  L.newPage({ plain: true });
  const pdf = L.pdf, p = L.page;
  pdf.rect(p, M.left, 150, CW, 4, { fill: ORANGE });
  pdf.text(p, M.left, 200, 'ZKM | Hertzlab', { size: 10, color: GREY });
  pdf.text(p, M.left, 250, 'MARS!platz', { font: 'bold', size: 42 });
  pdf.text(p, M.left, 282, 'Communication Station', { font: 'bold', size: 20, color: ORANGE });
  pdf.text(p, M.left, 330, 'The mission record', { size: 16 });
  pdf.text(p, M.left, 350, st.name, { size: 11, color: GREY });
  let y = 400;
  const line = (k, v) => { pdf.text(p, M.left, y, k, { size: 8.5, color: GREY }); pdf.text(p, M.left + 130, y, v, { size: 10 }); y += 17; };
  line('The run', `${st.runLabelLong} · ${st.totalDays} days · ${st.timezone}`);
  line('Days recorded', G.pre ? `none yet — the run opens ${st.startLabel}` : st.phase === 'COMPLETE' ? `all ${st.totalDays} days` : `${G.upTo} of ${st.totalDays} (day ${ddd(G.today)} in progress)`);
  line('Crew log', `${G.written.reduce((a, b) => a + b, 0)} entries written · ${G.moods.length} states filed`);
  line('Media sent out', `${G.mediaCounts.total} files · ${fmtBytes(G.mediaCounts.bytes)} · ${G.mediaCounts.images} photographs, ${G.mediaCounts.videos} video, ${G.mediaCounts.audio} sound, ${G.mediaCounts.documents} documents`);
  line('Habitat readings', `${G.readingsInRecord.toLocaleString('en-GB')} in this record, every one printed · ${G.readings.n.toLocaleString('en-GB')} from the station's channels stored in all`);
  line('Days sealed', `${G.days.filter((d) => d.sealed).length} of ${st.totalDays}`);
  line('Readings log', G.log.total ? `${G.log.total.toLocaleString('en-GB')} files · ${fmtBytes(G.log.bytes)} · every reading ever pulled, in /archive/readings.zip` : 'empty');
  line('This record', `generated ${new Date().toISOString().slice(0, 16).replace('T', ' ')} UTC`);
  y += 30;
  for (const t of pdf.wrap('This record holds only what was entered on the station and what its sensors measured, day by day: the schedule as it was run, the meals, the stores as they were counted, the power and the crew\'s figures as they were filed, what the crew wrote and sent out, the states filed for them, and every reading of every day — the station\'s channels, the habitat sensor (or the external node) and the hardware, each as it was stored. Nothing in it is generated — no chart, no projection, no total, no figure carried from one day to the next, and no plan for a day that has not come. The messages from Earth and the crew\'s replies are not part of the record. The photographs are placed in the entries they were sent with; the originals, byte for byte, are in the media ZIP under the hashes printed here.', 'regular', 9.5, CW - 60)) { pdf.text(p, M.left, y, t, { size: 9.5, color: INK }); y += 13.5; }
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
  const { st, crew, items, channels, carriedIn } = G;
  L.h1('The mission');
  L.para(`${st.name}. ${st.runLabelLong}, ${st.totalDays} days, on ${st.timezone} time. Three people inside a sealed habitat, and a channel between them and everyone outside it.`);
  L.h2('Crew');
  L.table([{ label: 'Designation', w: 1.2, font: 'bold' }, { label: 'Role', w: 2 }], crew.map((c) => [c.designation, c.role]));
  L.h2('The stores tracked');
  L.para('What the habitat set out with, as written in crew-and-inventory.json. Each day\'s counts are in that day\'s record; a store not counted on a day has no figure for it.', { color: GREY, size: 8.5 });
  L.table([{ label: 'Store', w: 1.6, font: 'bold' }, { label: 'Category', w: 1 }, { label: 'Carried in', w: 0.8, align: 'right' }, { label: 'Unit', w: 0.5 }, { label: 'Warning below', w: 0.8, align: 'right' }, { label: 'Critical', w: 0.5 }],
    items.map((i) => [i.label, i.category, asIs(carriedIn[i.key]), i.unit, asIs(i.warn_below), i.critical ? 'yes' : '']));
  L.h2('Monitored channels');
  L.para('The habitat\'s sensor channels as configured in sensors.json: the channel code, what it measures, its unit and the bands the station reads it against.', { color: GREY, size: 8.5 });
  L.table([{ label: 'Channel', w: 0.6, font: 'mono' }, { label: 'Metric', w: 1.6 }, { label: 'Unit', w: 0.6 }, { label: 'Expected band', w: 1, align: 'right' }, { label: 'Hard limits', w: 1, align: 'right' }, { label: 'Shown', w: 0.5 }],
    channels.map((c) => [c.channel || '—', c.label, c.unit, c.warn_min != null ? `${fmtNum(c.warn_min)} – ${fmtNum(c.warn_max)}` : '—', c.ok_min != null ? `${fmtNum(c.ok_min)} – ${fmtNum(c.ok_max)}` : '—', c.visible ? 'yes' : 'no']));
  L.h2('How to read this record');
  L.para('Days run in order, and only the days that have happened are here. Each holds the schedule with every task\'s status as it stands, the meals as entered, the stores counted that day with the figures as they were written, the power and the steps and calories as they were filed, the mission notes, the crew log with its photographs in place, the states filed for the crew with the value chosen and the sentence the station shows for it, what was sent out, the day\'s sensor summary — each channel\'s lowest, highest and mean reading and how many readings that is — and then every reading of the day: the station\'s channels as one row per instant with a column per channel, the habitat sensor (or the external node) one row per reading, the hardware one table per device, every value as it was stored, times in habitat time to the second. No figure is totalled, projected or carried from one day to the next, and the messages from Earth and the crew\'s replies are not part of this record. "The crew log" gathers every blog entry in full, in order; "Media" lists every file with its SHA-256, which can be checked against the ZIP at /media/export.zip with sha256sum. The same readings, as the station received them — one JSON file per pull, with the stores and figures as they changed and each day\'s summary — are in the readings log, downloadable whole at /archive/readings.zip.', { size: 9 });
}

/** One mission day, whole. */
function daySection(L, G, r, { asChapter = true } = {}) {
  const { st, today } = G;
  const n = r.missionDay;
  const title = r.rehearsal ? `Today · ${longDate(r.date)} · rehearsal, not the record` : `Day ${ddd(n)} · ${longDate(r.date)}`;
  if (asChapter) { L.section = title; L.newPage(); L.pdf.bookmark(title, L.pageIndex, 40, 1); L.pdf.rect(L.page, M.left, L.y, CW, 3, { fill: n === today || r.rehearsal ? ORANGE : INK }); L.y += 26; for (const line of L.pdf.wrap(title, 'bold', 22, CW)) { L.pdf.text(L.page, M.left, L.y, line, { font: 'bold', size: 22 }); L.y += 26; } L.y += 4; }
  else L.h1(title);
  const status = r.rehearsal ? 'before the run' : n < today ? (r.sealed ? 'sealed' : 'past, not yet sealed') : 'today — in progress';
  const written = r.officers.filter((o) => o.entry).length + r.officers.reduce((n, o) => n + (o.reports.length ? 1 : 0), 0);
  L.para(`${r.rehearsal ? `Today, ${st.today}` : `Mission day ${ddd(n)} of ${ddd(st.totalDays)}`} · ${status} · ${written} daily ${written === 1 ? 'blog' : 'blogs'} · ${r.moods.length} ${r.moods.length === 1 ? 'state' : 'states'} filed · ${r.media.length} ${r.media.length === 1 ? 'file' : 'files'} sent out · ${r.readings.count.toLocaleString('en-GB')} ${r.readings.count === 1 ? 'reading' : 'readings'}`, { color: GREY, size: 8.5, after: 10 });
  if (r.rehearsal) L.para(`REHEARSAL, NOT THE RECORD. A preview of a day's record with what there is today: today's readings from every source and the states filed today, and whatever has been put into the opening day (SOL 001) so far — its plan, blogs, reports, counts, figures and media. This chapter disappears on ${st.startLabel}, when day 001 takes its place.`, { font: 'italic', color: ORANGE, size: 8.5, after: 10 });
  if (r.isEmpty) { L.para('Nothing was recorded on this day.', { font: 'italic', color: GREY }); return; }
  const day = r.day;
  const placed = new Set();
  const when = (iso) => (iso ? `${mission.localDate(new Date(iso), st.timezone)} ${localHM(iso, st)}` : '');

  /* ---- the officers: the three blogs, crew state ----------------------- */
  for (const o of r.officers) {
    L.h2(`${cap(o.designation)}${o.role ? ` · ${o.role}` : ''}`, { keep: 120 });
    if (o.hasBlog) {
      L.h3('Commander Blog', { keep: 80 });
      if (o.entry) {
        L.para(`Written ${when(o.entry.written_at)}${o.entry.updated_at && o.entry.updated_at !== o.entry.written_at ? ` · last edited ${when(o.entry.updated_at)}` : ''} habitat time`, { color: GREY, size: 7.5, after: 4 });
        entryBlock(L, G, o.entry.body, o.media, { used: placed });
      } else L.para('No Commander Blog written for this day.', { font: 'italic', color: GREY, size: 9 });
    }
    if (o.reportKind) {
      L.h3(o.reportLabel, { keep: 80 });
      if (o.reports.length) for (const x of o.reports) entryBlock(L, G, x.body, [], { used: placed });
      else L.para(`No ${o.reportLabel} written for this day.`, { font: 'italic', color: GREY, size: 9 });
    }
    L.h3('Crew state', { keep: 60 });
    if (o.states.length) {
      L.table([{ label: 'Time', w: 0.55, font: 'mono' }, { label: 'Value (0 calm – 100 angry)', w: 1.2, align: 'right' }, { label: 'Condition', w: 0.8 }, { label: 'Shown on the station as', w: 2.3 }, { label: 'Activity', w: 1 }, { label: 'Filed by', w: 0.7 }],
        o.states.map((m) => { const t = moodLib.translate(m); return [localHM(m.effective_at, st), asIs(m.calm_tense), t.condition, t.lines[0] || '', m.activity || '', m.set_by || '']; }), { size: 8 });
    } else L.para('No state filed for this day.', { font: 'italic', color: GREY, size: 9 });
  }
  if (r.reportsUnassigned.length) {
    L.h2('Daily reports');
    for (const x of r.reportsUnassigned) { L.eyebrow(x.kind); entryBlock(L, G, x.body, [], { used: placed }); }
  }
  if (r.notesOther.length) {
    L.h2('Mission notes');
    for (const x of r.notesOther) { L.eyebrow(x.kind); entryBlock(L, G, x.body, [], { size: 9.5, used: placed }); }
  }
  const loose = r.media.filter((m) => !placed.has(m.id));
  if (loose.length) { L.h2('Also sent out that day'); for (const m of loose) { placeMedia(L, G, m); placed.add(m.id); } }

  /* ---- the Habitat tab, as it stands --------------------------------- */
  L.h2('Habitat', { keep: 100 });
  L.para('The Habitat tab of mission control for this day, as it stands at the time of this record: the schedule, the meals, the steps and calories, the inventory levels and the power. The same tab is written to the readings log automatically at the end of each day (the daily record, /archive/readings.zip).', { color: GREY, size: 8.5 });
  L.h3('Schedule', { keep: 70 });
  if (day && day.tasks.length) {
    L.table([{ label: 'Time', w: 0.5, font: 'mono' }, { label: 'Task', w: 3.5 }, { label: 'Status', w: 0.7 }],
      day.tasks.map((t) => [t.time, t.detail ? `${t.label} — ${t.detail}` : t.label, String(t.status || 'PLANNED').toLowerCase()]));
  } else L.para('No schedule for this day.', { font: 'italic', color: GREY, size: 9 });
  L.h3('Meals', { keep: 70 });
  if (day && day.meals.length) {
    L.table([{ label: 'Slot', w: 0.7, font: 'bold' }, { label: 'Meal', w: 2.4 }, { label: 'kcal', w: 0.5, align: 'right' }, { label: 'Water L', w: 0.6, align: 'right' }, { label: 'Prep min', w: 0.6, align: 'right' }, { label: 'Wh', w: 0.5, align: 'right' }],
      day.meals.map((m) => { const eco = archive.mealEcoLine(m); return [m.slot === 'RATION' ? 'Other' : cap(m.slot), [m.name, m.components ? m.components.split('\n').join(' · ') : '', m.notes || '', eco].filter(Boolean).join('\n'), asIs(m.kcal), asIs(m.water_litres), asIs(m.prep_minutes), asIs(m.energy_wh)]; }));
  } else L.para('No meals entered for this day.', { font: 'italic', color: GREY, size: 9 });
  L.h3('Steps taken and calories consumed', { keep: 70 });
  if (r.figures && r.figures.crew && Object.keys(r.figures.crew).length) {
    const rows = Object.entries(r.figures.crew).map(([who, f]) => [who, asIs(f.steps), asIs(f.calories)]);
    if (r.figures.calories != null || r.figures.steps != null) rows.push(['Crew (as filed)', asIs(r.figures.steps), asIs(r.figures.calories)]);
    L.table([{ label: 'Officer', w: 1.6, font: 'bold' }, { label: 'Steps taken', w: 1, align: 'right' }, { label: 'Calories consumed (kcal)', w: 1.2, align: 'right' }], rows);
  } else L.para('Not filed for this day.', { font: 'italic', color: GREY, size: 9 });
  L.h3('Inventory levels', { keep: 90 });
  if (r.stores.length) {
    L.para('As the tab shows them: available at the start of the day, used today, left for the future. "counted" means the figure was filed for this day; "carried" means it follows from the day before at its draw.', { color: GREY, size: 8 });
    L.table([{ label: 'Resource', w: 1.6, font: 'bold' }, { label: 'Available amount', w: 1, align: 'right' }, { label: 'Amount used today', w: 1, align: 'right' }, { label: 'Amount left for future', w: 1.1, align: 'right' }, { label: 'Unit', w: 0.5 }, { label: 'Used figure', w: 0.7 }, { label: 'Left figure', w: 0.7 }],
      r.stores.map((i) => [i.label, asIs(i.available), asIs(i.used), asIs(i.left), i.unit, i.counted.used ? 'counted' : 'carried', i.counted.left ? 'counted' : 'carried']), { size: 8 });
    if (r.filed.why) L.para(r.filed.why, { font: 'italic', size: 8.5, color: GREY });
  } else L.para('No stores tracked.', { font: 'italic', color: GREY, size: 9 });
  L.h3('Power consumed', { keep: 60 });
  if (r.power && r.power.filed) {
    L.table([{ label: 'Category', w: 1.6, font: 'bold' }, { label: 'kWh that day', w: 1, align: 'right' }],
      r.power.categories.map((c) => [c.label, asIs(c.kwh)]));
  } else L.para('Not filed for this day.', { font: 'italic', color: GREY, size: 9 });

  /* ---- the sensors: names as on the dashboard ------------------------ */
  L.h2('Habitat sensors', { keep: 100 });
  L.para(`Every channel as it is named on the dashboard: ${habitatSource()} (the Habitat panel), the station's own channels, and the habitat hardware (the Habitat hardware panel). First each channel's lowest, highest and mean reading over the day and how many readings that is; then every reading, as stored.`, { color: GREY, size: 8.5 });
  if (r.external.length) {
    L.h3(`Habitat · ${habitatSource()}`, { keep: 70 });
    L.table([{ label: 'Channel', w: 2, font: 'bold' }, { label: 'Low', w: 0.7, align: 'right' }, { label: 'High', w: 0.7, align: 'right' }, { label: 'Mean', w: 0.7, align: 'right' }, { label: 'Unit', w: 0.6 }, { label: 'Readings', w: 0.7, align: 'right' }],
      r.external.map((h) => [h.label, fmtNum(h.low, 2), fmtNum(h.high, 2), fmtNum(h.mean, 2), h.unit || '', h.samples]));
  }
  if (r.habitat.length) {
    L.h3('Habitat · the station\'s channels', { keep: 70 });
    L.table([{ label: 'Channel', w: 0.6, font: 'mono' }, { label: 'Metric', w: 1.6 }, { label: 'Low', w: 0.7, align: 'right' }, { label: 'High', w: 0.7, align: 'right' }, { label: 'Mean', w: 0.7, align: 'right' }, { label: 'Unit', w: 0.6 }, { label: 'Readings', w: 0.7, align: 'right' }, { label: 'Sealed', w: 0.8 }],
      r.habitat.map((h) => [h.channel || '—', h.label || h.metric, fmtNum(h.min_value), fmtNum(h.max_value), fmtNum(h.avg_value), h.unit || '', h.samples, h.sealed_at ? localHM(h.sealed_at, st) : 'open']));
  }
  if ((r.hardware || []).length) {
    L.h3('Habitat hardware', { keep: 70 });
    L.table([{ label: 'Device', w: 2, font: 'bold' }, { label: 'Low', w: 0.7, align: 'right' }, { label: 'High', w: 0.7, align: 'right' }, { label: 'Mean', w: 0.7, align: 'right' }, { label: 'Added today', w: 0.9, align: 'right' }, { label: 'Unit', w: 0.6 }, { label: 'Readings', w: 0.7, align: 'right' }],
      r.hardware.map((h) => [h.label, fmtNum(h.low), fmtNum(h.high), fmtNum(h.mean), h.added == null ? '—' : fmtNum(h.added), h.unit || '', h.samples]));
  }
  if (!r.external.length && !r.habitat.length && !(r.hardware || []).length) L.para('No reading was stored for this day.', { font: 'italic', color: GREY, size: 9 });
  readingsSection(L, r.readings);

  /* ---- what was sent out ---------------------------------------------- */
  if (r.media.length) {
    L.h2('Media sent out');
    L.table([{ label: 'File', w: 2, font: 'bold' }, { label: 'Kind', w: 0.6 }, { label: 'Size', w: 0.6, align: 'right' }, { label: 'Officer', w: 1.2 }, { label: 'Caption', w: 1.8 }, { label: 'SHA-256 (full hash in Media)', w: 1.2, font: 'mono' }],
      r.media.map((m) => [m.filename, m.kind, fmtBytes(m.bytes), m.designation || '—', m.caption || '', m.sha256.slice(0, 16) + '…']), { size: 7.5 });
  }
}

/**
 * Every reading of the day, as stored: the station's channels as one row
 * per instant with a column per channel, the external node one row per
 * reading, the hardware one table per device. Values exactly as stored,
 * times in habitat time to the second. Long tables run over the pages;
 * the header repeats.
 */
function readingsSection(L, R) {
  if (!R || !R.count) return;
  L.h3(`Every reading of the day · ${R.count.toLocaleString('en-GB')} readings`, { keep: 90 });
  L.para('Each as it was stored. Times are habitat time, to the second.', { color: GREY, size: 8.5 });
  const opts = { size: 7, headSize: 6.5, pad: 2.5, maxRowLines: 3 };
  // Column heads are short — the channel code and unit — with the full names
  // on a line above, so ten columns fit the page.
  const short = (c) => (c.channel && !/\?/.test(c.channel) ? c.channel : c.metric.slice(0, 8)) + (c.unit ? ` ${c.unit}` : '');
  if (R.station.rows.length) {
    L.h3(`Habitat · the station's channels · every reading · ${R.station.readings.toLocaleString('en-GB')} readings`, { keep: 80 });
    L.para(R.station.columns.map((c) => `${short(c)} = ${c.label}`).join(' · '), { color: GREY, size: 7.5, after: 4 });
    const cols = [{ label: 'Time', w: 1.1, font: 'mono' }, ...R.station.columns.map((c) => ({ label: short(c), w: 1, align: 'right' }))];
    L.table(cols, R.station.rows.map((row) => [row.at, ...R.station.columns.map((c) => asIs(row.values[c.metric]))]), opts);
  }
  if (R.external.rows.length) {
    L.h3(`Habitat · ${habitatSource()} · every reading · ${R.external.readings.toLocaleString('en-GB')} readings`, { keep: 70 });
    const cols = [{ label: 'Time', w: 1.1, font: 'mono' }, ...R.external.columns.map((c) => ({ label: `${c.label} ${c.unit}`, w: 1, align: 'right' }))];
    L.table(cols, R.external.rows.map((row) => [row.at, ...R.external.columns.map((c) => asIs(row.values[c.key]))]), opts);
  }
  for (const h of R.hardware) {
    L.h3(`Habitat hardware · ${h.label} · every reading · ${h.rows.length.toLocaleString('en-GB')} readings`, { keep: 70 });
    L.table([{ label: 'Time', w: 0.9, font: 'mono' }, { label: `Value${h.unit ? ` (${h.unit})` : ''}`, w: 1, align: 'right' }, { label: 'As reported', w: 1.4 }],
      h.rows.map((row) => [row.at, asIs(row.value), row.state]), opts);
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

/** Every blog entry, whole, in one place: day by day, officer by officer, held ones included. */
function crewLogSection(L, G) {
  const { st, upTo, days } = G;
  L.h1('The crew log');
  L.para('Everything the crew wrote, in full, day by day and officer by officer — the same text as in each day\'s record, gathered so the log can be read straight through. Photographs sit where they were placed in the entry; video and sound are listed. An entry held back from the public station is included and marked, because this is mission control\'s record.', { color: GREY, size: 8.5 });
  let any = 0;
  for (let n = 1; n <= upTo; n++) {
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

/* ================================================================ BUILDS */

/** The whole mission. Returns a Buffer. */
function fullRecord() {
  imageCache.clear();
  const G = gather();
  const { st } = G;
  const pdf = new PDF({ title: `${st.name} — mission record`, author: 'ZKM | Hertzlab — Mars Communication Station', subject: `${st.runLabelLong}, ${st.totalDays} days` });
  const L = new Layout(pdf, { runningTitle: `${st.name} · mission record` });
  cover(L, G);
  // The contents list is known before the body is laid out: the sections and
  // the days. Its pages are reserved here and written once the page numbers exist.
  const toc = [];
  const rehearsalTitle = G.rehearsal ? `Today · ${longDate(G.rehearsal.date)} · rehearsal, not the record` : null;
  const sectionTitles = ['The mission', 'The days', ...G.days.map((r) => `Day ${ddd(r.missionDay)} · ${longDate(r.date)}`), ...(rehearsalTitle ? [rehearsalTitle] : []), 'The crew log', 'Media'];
  const tocPages = contentsPages(L, sectionTitles);
  const startOf = (title) => (L.sections.find((s) => s[1] === title) || [L.pageIndex])[0];
  const sec = (title, level = 0) => toc.push({ title, level, page: startOf(title), y: 0 });

  missionSection(L, G); sec('The mission');
  L.h1('The days'); sec('The days');
  L.para(G.upTo === 0
    ? `The run opens ${st.startLabel}. No day has been recorded yet; the ${st.totalDays} days are listed below by date.${G.rehearsal ? ' Until then a rehearsal chapter for today follows the list — marked, and not part of the record — so the shape of a day\'s record can be seen with what there is now.' : ''}`
    : `${G.upTo} of ${st.totalDays} days recorded, each whole: the schedule as it was run, the meals, the stores counted that day, the power and the crew's figures as filed, the mission notes, the crew log with its photographs, the states filed, what was sent out, the day's sensor summary and every reading of the day. A day that has not happened has no chapter.`, { color: GREY, size: 8.5 });
  const rows = [];
  for (let n = 1; n <= st.totalDays; n++) {
    const r = G.days[n - 1];
    if (r) rows.push([ddd(n), longDate(r.date), n < G.today ? (r.sealed ? 'sealed' : 'past') : 'today', G.written[n - 1], r.moods.length, r.media.length, r.habitat.length, r.readings.count.toLocaleString('en-GB')]);
    else rows.push([ddd(n), longDate(mission.dateForDay(n)), 'not yet', '', '', '', '', '']);
  }
  L.table([{ label: 'Day', w: 0.5, font: 'mono' }, { label: 'Date', w: 1.6 }, { label: 'State', w: 1 }, { label: 'Entries', w: 0.6, align: 'right' }, { label: 'States filed', w: 0.7, align: 'right' }, { label: 'Files', w: 0.5, align: 'right' }, { label: 'Channels', w: 0.6, align: 'right' }, { label: 'Readings', w: 0.7, align: 'right' }], rows);
  for (const r of G.days) { const title = `Day ${ddd(r.missionDay)} · ${longDate(r.date)}`; daySection(L, G, r); sec(title, 1); }
  if (G.rehearsal) { daySection(L, G, G.rehearsal); sec(rehearsalTitle, 1); }
  crewLogSection(L, G); sec('The crew log');
  mediaSection(L, G); sec('Media');
  fillContents(L, tocPages, toc);
  L.finish({ footerLeft: `ZKM | Hertzlab · ${st.runLabelLong} · generated ${new Date().toISOString().slice(0, 10)}` });
  return pdf.build();
}

/** One day, whole. Null for a day that has not happened. */
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

/** Today, before the run — the rehearsal record as its own PDF. Null once the run has begun. */
function todayRecord() {
  imageCache.clear();
  const G = gather();
  const { st } = G;
  const r = G.rehearsal;
  if (!r) return null;
  const pdf = new PDF({ title: `${st.name} — today, before the run · ${longDate(r.date)} · rehearsal`, author: 'ZKM | Hertzlab — Mars Communication Station' });
  const L = new Layout(pdf, { runningTitle: `${st.name} · today · rehearsal, not the record` });
  daySection(L, G, r, { asChapter: false });
  L.finish({ footerLeft: `ZKM | Hertzlab · ${st.runLabelLong} · rehearsal · generated ${new Date().toISOString().slice(0, 10)}` });
  return pdf.build();
}

/* ============================================================ MESSAGES */

/**
 * All the messages from Earth, as one PDF of their own — not the record,
 * which leaves them out, but the complete correspondence for mission
 * control to keep: every message that ever reached the station, in the
 * order it was sent, whatever became of it — published with its reply,
 * rejected with the reason, still waiting, or in transit — with its
 * callsign, tags, day and time, and the signal delay stored with it.
 */
const STATE_WORD = { PUBLISHED: 'published', REJECTED: 'rejected', PENDING_APPROVAL: 'awaiting reply', APPROVED: 'awaiting reply', IN_TRANSIT: 'in transit', TRANSMITTED: 'in transit', ARRIVED: 'arrived' };
const WASH = [252, 240, 233];
const fmtLight = (sec) => (sec == null ? '—' : `${Math.floor(sec / 60)} min ${String(Math.round(sec % 60)).padStart(2, '0')} s`);
function dayOf(iso, st) {
  const date = mission.localDate(new Date(iso), st.timezone);
  return mission.daysBetween(st.start_date, date) + 1;
}

/** Every message with its reply, oldest first — the one query the PDF, the CSV and the JSON share. */
function allMessages() {
  return db.prepare(
    `SELECT m.*, r.body AS response_body, r.published_at AS response_at, r.written_at AS response_written, c.designation AS responder
     FROM message m LEFT JOIN response r ON r.message_id = m.id LEFT JOIN crew c ON c.id = r.crew_id
     ORDER BY m.submitted_at, m.id`).all();
}

function messagesPdf() {
  const st = mission.state();
  const messages = allMessages();
  const counts = data.counts();
  const callsigns = db.prepare('SELECT COUNT(DISTINCT callsign) n FROM message').get().n;
  const pdf = new PDF({ title: `${st.name} — all messages from Earth`, author: 'ZKM | Hertzlab — Mars Communication Station' });
  const L = new Layout(pdf, { runningTitle: `${st.name} · all messages from Earth` });
  L.h1('All messages from Earth');
  L.para(`Every message that reached the station, in the order it was sent: ${counts.total} from ${callsigns} callsigns — ${counts.published} published with a reply, ${counts.rejected} rejected, ${counts.pending + counts.awaitingResponse} still awaiting a reply, ${counts.inTransit} in transit. Messages sent before the habitat was occupied carry day 000. Generated ${new Date().toISOString().slice(0, 16).replace('T', ' ')} UTC. The messages are not part of the mission record; this is mission control's own copy.`, { color: GREY, size: 8.5 });
  let day = null;
  for (const m of messages) {
    if (m.mission_day !== day) { day = m.mission_day; L.h2(day < 1 ? 'Before the mission · day 000' : `Day ${ddd(day)}`, { keep: 90 }); }
    const tags = (m.tags || '').split(',').filter(Boolean).map((t) => '#' + t).join(' ');
    L.need(48);
    L.pdf.text(L.page, M.left, L.y, m.callsign, { font: 'bold', size: 9.5, color: ORANGE });
    L.pdf.text(L.page, M.left + L.pdf.textWidth(m.callsign, 'bold', 9.5) + 6, L.y, `· Ref ${String(m.id).padStart(5, '0')} · day ${ddd(m.mission_day)} · ${mission.localDate(new Date(m.submitted_at), st.timezone)} ${localHM(m.submitted_at, st)}${tags ? ` · ${tags}` : ''} · ${STATE_WORD[m.state] || m.state.toLowerCase()}${m.flagged ? ' · flagged' : ''}`, { size: 8, color: GREY });
    L.y += 14;
    L.para(m.body, { size: 9.5, after: 4 });
    if (m.response_body) {
      L.quote(`${m.responder || 'Mars habitat'} — ${m.response_body}${m.response_at ? '' : '  [draft, not published]'}`, { color: ORANGE, fill: WASH });
    } else if (m.state === 'REJECTED') L.para(`Rejected without a reply${m.reject_reason ? `: ${m.reject_reason}` : ''}${m.reviewed_by ? ` · by ${m.reviewed_by}` : ''}${m.reviewed_at ? ` · ${localHM(m.reviewed_at, st)}` : ''}.`, { font: 'italic', color: GREY, size: 8.5 });
    else L.para('No reply yet.', { font: 'italic', color: GREY, size: 8.5 });
    L.para(`Signal delay stored with the message: ${fmtLight(m.light_seconds)} one way at ${m.distance_au != null ? m.distance_au.toFixed(3) : '—'} au${m.response_at ? ` · reply published day ${ddd(dayOf(m.response_at, st))} ${localHM(m.response_at, st)}` : ''}`, { size: 7.5, color: GREY, after: 12 });
  }
  if (!messages.length) L.para('No messages have been sent.', { font: 'italic', color: GREY });
  L.finish({ footerLeft: `ZKM | Hertzlab · ${st.runLabelLong} · all messages · generated ${new Date().toISOString().slice(0, 10)}` });
  return pdf.build();
}

/** The same, as one row per message for a spreadsheet. */
function messagesCsv() {
  const cell = (v) => { const t = v == null ? '' : String(v); return /[",\n\r]/.test(t) ? `"${t.replace(/"/g, '""')}"` : t; };
  const head = ['id', 'callsign', 'mission_day', 'submitted_at', 'arrived_at', 'state', 'flagged', 'tags', 'message',
    'reply', 'replied_by', 'reply_written_at', 'reply_published_at', 'reviewed_at', 'reviewed_by', 'reject_reason', 'light_seconds', 'distance_au'];
  const rows = allMessages().map((m) => [m.id, m.callsign, m.mission_day, m.submitted_at, m.arrival_at, m.state, m.flagged ? 1 : 0, m.tags, m.body,
    m.response_body, m.responder, m.response_written, m.response_at, m.reviewed_at, m.reviewed_by, m.reject_reason, m.light_seconds, m.distance_au]);
  return [head, ...rows].map((r) => r.map(cell).join(',')).join('\r\n') + '\r\n';
}

/** And as JSON, for machines. */
function messagesJson() {
  const st = mission.state();
  return {
    mission: { name: st.name, start: st.start_date, end: st.end_date, timezone: st.timezone },
    exportedAt: new Date().toISOString(),
    note: 'Every message that reached the station, in the order it was sent, whatever became of it. Not part of the mission record.',
    counts: data.counts(),
    messages: allMessages().map((m) => ({ id: m.id, callsign: m.callsign, missionDay: m.mission_day, submittedAt: m.submitted_at, arrivedAt: m.arrival_at,
      state: m.state, flagged: !!m.flagged, tags: (m.tags || '').split(',').filter(Boolean), body: m.body,
      reply: m.response_body ? { body: m.response_body, by: m.responder, writtenAt: m.response_written, publishedAt: m.response_at } : null,
      reviewedAt: m.reviewed_at, reviewedBy: m.reviewed_by, rejectReason: m.reject_reason, lightSeconds: m.light_seconds, distanceAu: m.distance_au })),
  };
}

module.exports = { fullRecord, dayRecord, todayRecord, gather, messagesPdf, messagesCsv, messagesJson };
