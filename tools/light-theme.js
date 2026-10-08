#!/usr/bin/env node
'use strict';
/**
 * The light theme in blue (October, 7 October: "for the light theme, replace the orange theme with blue").
 *
 * Writes public/light.css — loaded last on every public page and every screen (layout.js, screens.js) — from the
 * station's own stylesheets (station.css, aura.css, sheet.css, screen.css): every rule that draws in Mars orange on a
 * light page is laid over, in the light theme only, with the same declaration in blue — each orange turned to the
 * blue of the same strength and lightness (hue 211°, a touch deeper where it is a fill), its transparency kept, the
 * dark browns written on the orange keys turned to a dark navy — and the station's colour tokens (--mars, --mars-ink,
 * --orange, …) are re-pointed on the public pages' body, so everything drawn from them follows.
 *
 * Left as they are:
 *   - the dark theme — it keeps its orange;
 *   - mission control and the archive's desk — they never load these sheets (layout.js);
 *   - the night screens, dark in both themes: the first page's room, where the white signal climbs from Earth to the
 *     habitat and the crew's answer comes back down in orange (October, the same evening: "show the original signal
 *     … in white and orange as before"), and the composer's crossing dial;
 *   - the trend graphs' series colours (public/habitat.js, public.js HW_PALETTE): they name the series, not the theme.
 *
 * Then, by hand (HAND, below): inside the night screens the tokens are orange again; the states that warn — a store
 * running low, a reading out of range, an error, the channel shut — are red, not blue; the Commander's blog head is
 * indigo beside the Health blog's sky blue; on the notes' round trip Earth is ink beside the blue loop; the notes'
 * sheet is cool.
 *
 *   node tools/light-theme.js            writes public/light.css
 *   node tools/light-theme.js --check    exits 1 when public/light.css is not what the stylesheets give (the suite)
 *
 * Run it after changing an orange in a stylesheet.
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const SOURCES = ['station.css', 'aura.css', 'sheet.css', 'screen.css'];
const OUT = path.join(ROOT, 'public', 'light.css');
const L = ':root[data-theme="light"]';
const HUE = 211;                                                    // the blue: an azure, apart from the cobalt (233°)
const HUES = [[/#blog-commander\b/, 236, 0.8]];                     // [selector, hue, saturation ×] — beside the Health blog's sky blue

/* ------------------------------------------------------------------------------------------- colours */
function hsl(r, g, b) {
  r /= 255; g /= 255; b /= 255;
  const mx = Math.max(r, g, b), mn = Math.min(r, g, b), l = (mx + mn) / 2;
  if (mx === mn) return [0, 0, l];
  const d = mx - mn, s = l > 0.5 ? d / (2 - mx - mn) : d / (mx + mn);
  const h = mx === r ? (g - b) / d + (g < b ? 6 : 0) : mx === g ? (b - r) / d + 2 : (r - g) / d + 4;
  return [h * 60, s, l];
}
function rgb(h, s, l) {
  const c = (1 - Math.abs(2 * l - 1)) * s, x = c * (1 - Math.abs(((h / 60) % 2) - 1)), m = l - c / 2;
  const [r, g, b] = h < 60 ? [c, x, 0] : h < 120 ? [x, c, 0] : h < 180 ? [0, c, x] : h < 240 ? [0, x, c] : h < 300 ? [x, 0, c] : [c, 0, x];
  return [r, g, b].map((v) => Math.round((v + m) * 255));
}
/** Mars orange and its family: the station's oranges, its glows and tints, the dark browns written on them. */
const isOrange = (r, g, b) => { const [h, s, l] = hsl(r, g, b); return h >= 5 && h <= 38 && s >= 0.45 && l >= 0.04 && l <= 0.97; };
/** The blue of the same strength and lightness; a fill a touch deeper, so the type on it keeps its contrast. */
function toBlue(r, g, b, hue = HUE, sat = 1) {
  const [, s, l] = hsl(r, g, b);
  return rgb(hue, Math.min(1, s * sat), l >= 0.45 && l <= 0.75 ? l - 0.04 : l);
}
const hex2 = (n) => n.toString(16).padStart(2, '0');
function mapValue(v, hue, sat) {
  let hit = false;
  const out = v
    .replace(/#([0-9a-fA-F]{8}|[0-9a-fA-F]{6}|[0-9a-fA-F]{3})\b/g, (m, h) => {
      const full = h.length === 3 ? h.split('').map((c) => c + c).join('') : h;
      const r = parseInt(full.slice(0, 2), 16), g = parseInt(full.slice(2, 4), 16), b = parseInt(full.slice(4, 6), 16);
      if (!isOrange(r, g, b)) return m;
      hit = true;
      const [R, G, B] = toBlue(r, g, b, hue, sat);
      return `#${hex2(R)}${hex2(G)}${hex2(B)}${full.length === 8 ? full.slice(6) : ''}`;
    })
    .replace(/rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*(,\s*[\d.]+%?\s*)?\)/g, (m, r, g, b, a) => {
      if (!isOrange(+r, +g, +b)) return m;
      hit = true;
      const [R, G, B] = toBlue(+r, +g, +b, hue, sat);
      return a ? `rgba(${R},${G},${B},${a.replace(/^,\s*/, '').trim()})` : `rgb(${R},${G},${B})`;
    });
  return hit ? out : null;
}
function mapTriplet(v, hue, sat) {                                 // --accent-rgb: 255,90,31
  const m = /^\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*$/.exec(v);
  if (!m || !isOrange(+m[1], +m[2], +m[3])) return null;
  return toBlue(+m[1], +m[2], +m[3], hue, sat).join(',');
}

/* ------------------------------------------------------------------------------------------- the parser */
function strip(css) { return css.replace(/\/\*[\s\S]*?\*\//g, (m) => ' '.repeat(m.length)); }
function parse(css) {
  css = strip(css);
  const out = []; let i = 0;
  const skipString = (q) => { i++; while (i < css.length && css[i] !== q) { if (css[i] === '\\') i++; i++; } i++; };
  function block(ctx) {
    while (i < css.length) {
      while (i < css.length && /\s/.test(css[i])) i++;
      if (i >= css.length) return;
      if (css[i] === '}') { i++; return; }
      const start = i; let paren = 0;
      while (i < css.length) {
        const c = css[i];
        if (c === '"' || c === "'") { skipString(c); continue; }
        if (c === '(') paren++; else if (c === ')') paren--;
        else if ((c === '{' || c === ';') && paren <= 0) break;
        i++;
      }
      const prelude = css.slice(start, i).trim();
      if (css[i] === ';') { i++; continue; }
      i++;
      if (/^@(media|supports|layer|container)\b/i.test(prelude)) { block(ctx.concat([prelude])); continue; }
      const bstart = i; let depth = 1;
      while (i < css.length && depth > 0) {
        const c = css[i];
        if (c === '"' || c === "'") { skipString(c); continue; }
        if (c === '{') depth++; else if (c === '}') depth--;
        i++;
      }
      const body = css.slice(bstart, i - 1);
      out.push(prelude.startsWith('@') ? { type: 'at', prelude, body, ctx } : { type: 'rule', selector: prelude, body, ctx });
    }
  }
  block([]);
  return out;
}
function splitTop(s, sep) {
  const parts = []; let depth = 0, q = null, cur = '';
  for (let i = 0; i < s.length; i++) {
    const c = s[i];
    if (q) { cur += c; if (c === '\\') { cur += s[++i] || ''; continue; } if (c === q) q = null; continue; }
    if (c === '"' || c === "'") { q = c; cur += c; continue; }
    if (c === '(' || c === '[') depth++; else if (c === ')' || c === ']') depth--;
    if (c === sep && depth === 0) { parts.push(cur); cur = ''; continue; }
    cur += c;
  }
  if (cur.trim()) parts.push(cur);
  return parts.map((x) => x.replace(/\s+/g, ' ').trim()).filter(Boolean);
}
const decls = (body) => splitTop(body, ';').map((d) => { const k = d.indexOf(':'); return k < 0 ? null : { prop: d.slice(0, k).trim(), value: d.slice(k + 1).trim() }; }).filter(Boolean);

/* ------------------------------------------------------------------------------------------- selectors */
const DARK = /^(?::root|html)\[data-theme="dark"\]/;
const NIGHT = /\.space(?:-[a-z-]+)?(?![\w-])|\.sky-|\.dome-sky\b|\.xdial/;      // the room (.space, .space-room, .space-tag-dome …), its sky, the dial: dark in both themes
const DESK = /(?:^|[\s>+~(,])\.control\b|body\.control\b|body\.habitat\b/;                                          // mission control: never loads these sheets
/* The twin's selector: the original's, in the light theme only and on the public pages only — both conditions inside
   :where(), which weighs nothing, so the twin has exactly its original's specificity: it wins where the orange rule won
   (it comes later, in the last sheet) and loses where a weightier rule beat the orange one. */
const W = `:where(${L})`, WL = `:where(${L} body.landing)`;
function lightSel(sel) {
  if (/^(?::root|html)\[data-theme="light"\]/.test(sel)) return sel;
  if (sel === ':root' || sel === 'html') return WL;                    // the tokens: on the public pages' body
  if (/^(?::root|html)\b/.test(sel)) return null;
  if (/^body\.(?:landing|screen)\b/.test(sel)) return `${W} ${sel}`;
  if (/^body\b/.test(sel)) return `${W} body:where(.landing)${sel.slice(4)}`;
  return `${WL} ${sel}`;
}

/* A shorthand resets its longhands: laid over in blue, it would undo what the rule sets after it — the text gradient's
   background-clip, a border's coloured side — so those come along, as they are. */
const FAMILY = {
  background: /^(?:-webkit-)?background-/, border: /^border-(?:top|right|bottom|left|width|style|color|image)/,
  'border-top': /^border-top-/, 'border-right': /^border-right-/, 'border-bottom': /^border-bottom-/, 'border-left': /^border-left-/,
  outline: /^outline-/, 'text-decoration': /^text-decoration-/, 'column-rule': /^column-rule-/,
};

/* ------------------------------------------------------------------------------------------- the dress */
function generate() {
  const blocks = [], keyframes = new Map(), all = [];               // keyframes: source name → light name; all: every rule, in order
  for (const file of SOURCES) {
    const rules = parse(fs.readFileSync(path.join(ROOT, 'public', file), 'utf8'));
    for (const r of rules) {
      if (r.type !== 'at' || !/^@(-webkit-)?keyframes\s/i.test(r.prelude)) continue;
      const name = r.prelude.replace(/^@(-webkit-)?keyframes\s+/i, '').trim();
      const body = mapValue(r.body, HUE, 1);
      if (body) keyframes.set(name, { file, ctx: r.ctx, text: `@keyframes ${name}-light {${body.replace(/\s+/g, ' ')}}` });
    }
    for (const r of rules) {
      if (r.type !== 'rule') continue;
      const sels = splitTop(r.selector, ',').filter((x) => !DARK.test(x) && !NIGHT.test(x) && !DESK.test(x));
      all.push({ file, ctx: r.ctx, selector: r.selector, sels, ds: decls(r.body), restore: [] });
    }
  }
  // each rule's blue twin: its orange declarations in blue (and the longhands a laid-over shorthand would undo)
  for (const r of all) {
    r.twin = [];
    if (!r.sels.length) continue;
    const own = HUES.find(([re]) => re.test(r.selector));
    const [hue, sat] = own ? [own[1], own[2]] : [HUE, 1];
    let family = null;
    for (const d of r.ds) {
      const imp = /!important\s*$/.test(d.value);
      const val = d.value.replace(/\s*!important\s*$/, '');
      let mapped = /^--[\w-]*rgb$/.test(d.prop) ? mapTriplet(val, hue, sat) : mapValue(val, hue, sat);
      if (!mapped && family && family.test(d.prop)) mapped = val;   // background-clip: text after a background, a border-left after a border
      if (mapped) r.twin.push({ prop: d.prop, text: `${d.prop}: ${mapped.replace(/\s+/g, ' ')}${imp ? ' !important' : ''}` });
      if (mapped && FAMILY[d.prop]) family = FAMILY[d.prop];
      if (/^animation(-name)?$/.test(d.prop)) {                    // an animation whose keyframes are orange: its light twin
        const parts = splitTop(val, ',');
        let any = false;
        const names = parts.map((p) => { const t = p.split(/\s+/).find((w) => keyframes.has(w)); if (t) { any = true; return `${t}-light`; } return d.prop === 'animation-name' ? p : (p.split(/\s+/).find((w) => /^[a-z][\w-]*$/i.test(w) && !/^(?:linear|ease|ease-in|ease-out|ease-in-out|infinite|alternate|reverse|forwards|backwards|both|none|normal|running|paused|step-start|step-end)$/.test(w)) || 'none'); });
        if (any) r.twin.push({ prop: 'animation-name', text: `animation-name: ${names.join(', ')}${imp ? ' !important' : ''}` });
      }
    }
  }
  // A twin comes after every original rule, in the last sheet: where a LATER rule with the same selector set the same
  // property (and so won over the orange one), that later rule is laid over again at its own place, after the twin, so
  // it wins again — the original winner, as before.
  const overlaps = (p, q) => p === q || (FAMILY[p] && FAMILY[p].test(q)) || (FAMILY[q] && FAMILY[q].test(p));
  all.forEach((a, ai) => {
    if (!a.twin.length) return;
    for (const b of all.slice(ai + 1)) {
      const shared = a.sels.filter((x) => b.sels.includes(x));
      if (!shared.length) continue;
      for (const q of b.ds) {
        if (!a.twin.some((t) => overlaps(t.prop, q.prop))) continue;
        for (const x of shared) if (!b.restore.some((z) => z.sel === x && z.prop === q.prop)) b.restore.push({ sel: x, prop: q.prop, value: q.value });
      }
    }
  });
  const emitted = new Set();
  for (const r of all) {
    for (const [name, k] of keyframes) if (!emitted.has(name) && r.twin.some((t) => t.text.includes(`${name}-light`))) { blocks.push(k); emitted.add(name); }
    const lights = r.sels.map(lightSel).filter(Boolean);
    if (r.twin.length && lights.length) blocks.push({ file: r.file, ctx: r.ctx, text: `${lights.join(', ')} { ${r.twin.map((t) => t.text).join('; ')}; }` });
    const bySel = new Map();
    for (const z of r.restore) {                                   // the later rule again, its own values (in blue where they are orange)
      if (r.twin.some((t) => t.prop === z.prop) && r.sels.includes(z.sel)) continue;   // its own twin already says it
      const v = mapValue(z.value, HUE, 1) || z.value;
      if (!bySel.has(z.sel)) bySel.set(z.sel, []);
      bySel.get(z.sel).push(`${z.prop}: ${v.replace(/\s+/g, ' ')}`);
    }
    for (const [x, ds] of bySel) { const sel = lightSel(x); if (sel) blocks.push({ file: r.file, ctx: r.ctx, text: `${sel} { ${ds.join('; ')}; } /* as it stood */` }); }
  }
  // the blocks in their sheets' order, those under the same @media gathered
  const lines = [];
  let file = null, open = [];
  const close = () => { while (open.length) { lines.push(`${'  '.repeat(open.length - 1)}}`); open.pop(); } };
  for (const b of blocks) {
    if (b.file !== file) { close(); lines.push('', `/* ---------------------------------------------------------------- from ${b.file} */`); file = b.file; }
    const same = b.ctx.length === open.length && b.ctx.every((c, k) => c === open[k]);
    if (!same) { close(); for (const c of b.ctx) { lines.push(`${'  '.repeat(open.length)}${c} {`); open.push(c); } }
    lines.push(`${'  '.repeat(open.length)}${b.text}`);
  }
  close();
  return HEAD + lines.join('\n') + '\n' + HAND;
}

const HEAD = `/* The light theme in blue — WRITTEN BY tools/light-theme.js from the station's stylesheets; do not edit by hand:
   change the stylesheets (or the hand-written part at the end of the tool) and run  node tools/light-theme.js
   October, 7 October: "for the light theme, replace the orange theme with blue". Every rule that draws in Mars orange
   on a light page, laid over in the light theme only with its blue twin (hue 211°, its strength, lightness and
   transparency kept); the dark theme keeps its orange, mission control never loads this, and the night screens — the
   first page's room with its white signal up and orange answer down, the composer's crossing dial — stay as they are. */
`;

const HAND = `
/* ---------------------------------------------------------------- by hand (tools/light-theme.js, HAND) */
/* the night screens keep their orange in the light theme too: the first page's room — the white signal climbing from
   Earth to the habitat, the crew's answer coming back down in orange, as before (October) — and the composer's dial */
${L} body.landing .space-room, ${L} body.landing .xdial-wrap { --mars: #ff5a1f; --mars-ink: #c23600; --orange: #ff5a1f; --orange-deep: #e24a12; --orange-soft: rgba(255,90,31,.12); --sh-orange: 0 14px 30px -10px rgba(255,70,0,.55); }
/* the states that warn — a store running low, a reading out of range, an error, the channel shut — in red, not blue */
${L} body.landing { --alarm: #d92d20; }
${L} body.landing :is(.sym.bad, .dot.bad, .badge.bad, .bar i.bad, .bar i.warn, .counter.over, .flash.err, .gauge.low, .gauge.round.low, .kpi.warn, .dial.alert, .dcard-note.anomaly, .hbt .hot, .hbt .note.alert, .transit.closed, .cloud-fail, button.danger) { --mars: #d92d20; --mars-ink: #b42318; --orange: #d92d20; --orange-deep: #b42318; --orange-soft: rgba(217,45,32,.12); --sh-orange: 0 14px 30px -10px rgba(217,45,32,.45); }
/* the notes: a cool sheet; on the round trip Earth in ink, beside the blue loop and Mars */
${L} body.landing { --note-edge: #d5deeb; }
${L} body.landing .card.note .note-mark .nm-earth { fill: var(--ink); }
`;

const css = generate();
if (process.argv.includes('--check')) {
  const now = fs.existsSync(OUT) ? fs.readFileSync(OUT, 'utf8') : '';
  if (now !== css) { console.error('public/light.css is not what the stylesheets give — run: node tools/light-theme.js'); process.exit(1); }
  console.log('public/light.css is up to date');
} else {
  fs.writeFileSync(OUT, css);
  console.log(`public/light.css written: ${css.split('\n').filter((l) => l.includes('{') && !l.trim().startsWith('@') && !l.trim().startsWith('/*')).length} rules`);
}
