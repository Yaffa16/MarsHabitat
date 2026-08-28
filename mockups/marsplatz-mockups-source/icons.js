/* Pictograms in the moodboard's style: heavy black, flat. Each is a 48x48 symbol. */
const ICONS = {
  flask: `<path d="M18 4h12v3h-2v11l10 18a3 3 0 0 1-2.6 4.5H12.6A3 3 0 0 1 10 36l10-18V7h-2z" fill="#111"/><circle cx="20" cy="33" r="2" fill="#c9c9c9"/><circle cx="27" cy="29" r="1.6" fill="#c9c9c9"/>`,
  bike: `<circle cx="12" cy="33" r="8" fill="none" stroke="#111" stroke-width="3.2"/><circle cx="36" cy="33" r="8" fill="none" stroke="#111" stroke-width="3.2"/><path d="M12 33l8-14h10l6 14M20 19h-6M24 33l6-14" fill="none" stroke="#111" stroke-width="3.2" stroke-linejoin="round"/><path d="M40 4l-6 10h6l-6 10" fill="none" stroke="#111" stroke-width="3" stroke-linejoin="round"/>`,
  antenna: `<circle cx="24" cy="24" r="3.5" fill="#111"/><path d="M24 27v17M16 44h16" stroke="#111" stroke-width="3.2" fill="none"/><path d="M14 14a14 14 0 0 1 20 0M9 9a21 21 0 0 1 30 0" fill="none" stroke="#111" stroke-width="3.2" stroke-linecap="round"/>`,
  plant: `<path d="M14 34h20l-2 11H16z" fill="#111"/><path d="M24 34V14" stroke="#111" stroke-width="3.2"/><path d="M24 22c-8 0-12-5-12-11 7 0 12 4 12 11zM24 18c8 0 12-5 12-11-7 0-12 4-12 11zM24 30c-7 0-10-4-10-9 6 0 10 3 10 9zM24 28c7 0 10-4 10-9-6 0-10 3-10 9z" fill="#111"/>`,
  doc: `<rect x="11" y="5" width="26" height="38" fill="none" stroke="#111" stroke-width="3.2"/><path d="M17 14h14M17 21h14M17 28h14M17 35h9" stroke="#111" stroke-width="2.6"/>`,
  bunk: `<rect x="6" y="6" width="36" height="36" fill="none" stroke="#111" stroke-width="3.2"/><path d="M6 20h36M6 34h36" stroke="#111" stroke-width="3.2"/><rect x="10" y="12" width="10" height="6" fill="#111"/><rect x="10" y="26" width="10" height="6" fill="#111"/><rect x="21" y="13" width="17" height="5" fill="#111"/><rect x="21" y="27" width="17" height="5" fill="#111"/>`,
  astro: `<circle cx="24" cy="9" r="5.5" fill="#111"/><rect x="16" y="15" width="16" height="16" rx="3" fill="#111"/><path d="M12 17v12M36 17v12" stroke="#111" stroke-width="4" stroke-linecap="round"/><path d="M19 31v13M29 31v13" stroke="#111" stroke-width="5"/><path d="M15 44h9M24 44h9" stroke="#111" stroke-width="4"/>`,
  dome: `<path d="M4 40a20 20 0 0 1 40 0z" fill="none" stroke="#111" stroke-width="3"/><path d="M4 40h40M12 28h24M8 34h32M24 20v20M14 40l10-20 10 20M8 34l16-14 16 14M12 28l12-8 12 8" stroke="#111" stroke-width="1.6" fill="none"/>`,
};
function icon(name, size = 36) {
  return `<svg width="${size}" height="${size}" viewBox="0 0 48 48" aria-hidden="true">${ICONS[name]}</svg>`;
}

/* A geodesic dome as line-work: a hemisphere of triangulated rings, seen from
   just above the horizon, in the magenta of the moodboard. */
function dome(w, h, rings = 6, stroke = '#e6007e', sw = 1.4, opacity = 1) {
  // Rings of a hemisphere, each with more points than the last (as a geodesic
  // frequency grows towards the base), seen from just above the horizon.
  const cx = w / 2, R = w * 0.64, squash = h / R;
  const pts = [];
  for (let r = 0; r <= rings; r++) {
    const phi = (Math.PI / 2) * (1 - r / rings);
    const rr = Math.cos(phi) * R, y = h - Math.sin(phi) * R * squash;
    const n = r === 0 ? 3 : 3 + r * 3;                       // 3, 6, 9, 12 … points across the front half
    const row = [];
    for (let i = 0; i < n; i++) {
      const th = Math.PI + (Math.PI * (i + 0.5)) / n;
      row.push([cx + Math.cos(th) * rr * (r === 0 ? 0.35 : 1), y + (r === 0 ? 6 : 0)]);
    }
    pts.push(row);
  }
  const L = (a, b) => `M${a[0].toFixed(1)},${a[1].toFixed(1)}L${b[0].toFixed(1)},${b[1].toFixed(1)}`;
  let d = '';
  for (let r = 0; r <= rings; r++) {
    const row = pts[r];
    for (let i = 0; i < row.length - 1; i++) d += L(row[i], row[i + 1]);
    if (r === 0) continue;
    const prev = pts[r - 1];
    for (let i = 0; i < row.length; i++) {                   // zig-zag struts to the ring above
      const u = (i + 0.5) / row.length;
      const j = Math.min(prev.length - 1, Math.floor(u * prev.length));
      d += L(row[i], prev[j]);
      const k = Math.min(prev.length - 1, Math.max(0, u * prev.length - j < 0.5 ? j - 1 : j + 1));
      if (k !== j) d += L(row[i], prev[k]);
    }
  }
  return `<svg viewBox="0 0 ${w} ${h}" preserveAspectRatio="none" style="opacity:${opacity}"><path d="${d}" fill="none" stroke="${stroke}" stroke-width="${sw}" vector-effect="non-scaling-stroke"/></svg>`;
}

/* The crossing: Earth and Mars as gradient orbs, the message's path dashed
   between them, the distance and one-way time on the line. */
function orbit(w = 210, h = 150, label = '1.514 au · closing') {
  return `<svg viewBox="0 0 ${w} ${h}" width="${w}" height="${h}">
    <defs>
      <radialGradient id="ge" cx="40%" cy="35%"><stop offset="0" stop-color="#fff6a8"/><stop offset=".65" stop-color="#ffb04a"/><stop offset="1" stop-color="#ff8a3c"/></radialGradient>
      <radialGradient id="gm" cx="45%" cy="45%"><stop offset="0" stop-color="#ffa11a"/><stop offset=".35" stop-color="#ff7a3d"/><stop offset="1" stop-color="#e6007e"/></radialGradient>
    </defs>
    <line x1="30" y1="${h - 26}" x2="${w - 40}" y2="34" stroke="#e6007e" stroke-width="2" stroke-dasharray="5 6"/>
    <circle cx="22" cy="${h - 22}" r="11" fill="url(#ge)"/>
    <circle cx="${w - 32}" cy="30" r="24" fill="url(#gm)"/>
    <text x="8" y="14" font-family="Space Grotesk" font-size="10" letter-spacing=".06em">EARTH – MARS</text>
    <text x="8" y="27" font-family="Space Grotesk" font-size="10" letter-spacing=".06em">${label.toUpperCase()}</text>
  </svg>`;
}

/* The habitat plan: an octagon with rings and spokes, the central module and
   three ring sectors, pictograms for what lives where. */
function plan(size = 760, labels = true) {
  const c = size / 2, R = size * 0.34;
  const oct = (r, rot = Math.PI / 8) => Array.from({ length: 8 }, (_, i) => {
    const a = rot + (i * Math.PI) / 4; return [c + Math.cos(a) * r, c + Math.sin(a) * r];
  });
  const poly = (p, extra = '') => `<polygon points="${p.map((q) => q.map((v) => v.toFixed(1)).join(',')).join(' ')}" ${extra}/>`;
  let s = `<svg viewBox="0 0 ${size} ${size}" width="100%" style="max-width:${size}px;display:block;margin:0 auto">`;
  s += poly(oct(R * 1.42, 0), 'fill="none" stroke="#111" stroke-width="1" stroke-dasharray="3 4"');      // site boundary
  s += poly(oct(R), 'fill="#bdbdbd" stroke="#111" stroke-width="1.6"');
  s += poly(oct(R * 0.78), 'fill="#b3b3b3" stroke="#111" stroke-width="1.2"');
  s += poly(oct(R * 0.56), 'fill="#aaaaaa" stroke="#111" stroke-width="1.2"');
  s += poly(oct(R * 0.34), 'fill="#a0a0a0" stroke="#111" stroke-width="1.2"');
  for (let i = 0; i < 8; i++) {                                                                      // spokes, extended as corridors
    const a = Math.PI / 8 + (i * Math.PI) / 4;
    const x2 = c + Math.cos(a) * R * 1.32, y2 = c + Math.sin(a) * R * 1.32;
    s += `<line x1="${c}" y1="${c}" x2="${x2.toFixed(1)}" y2="${y2.toFixed(1)}" stroke="#111" stroke-width="1.4"/>`;
    const px = -Math.sin(a) * 5, py = Math.cos(a) * 5;
    s += `<polygon points="${(c + Math.cos(a) * R * 0.98 + px).toFixed(1)},${(c + Math.sin(a) * R * 0.98 + py).toFixed(1)} ${(x2 + px).toFixed(1)},${(y2 + py).toFixed(1)} ${(x2 - px).toFixed(1)},${(y2 - py).toFixed(1)} ${(c + Math.cos(a) * R * 0.98 - px).toFixed(1)},${(c + Math.sin(a) * R * 0.98 - py).toFixed(1)}" fill="#c9c9c9" stroke="#111" stroke-width="1.2"/>`;
  }
  s += `<circle cx="${c}" cy="${c}" r="${R * 0.16}" fill="#a8a8a8" stroke="#111" stroke-width="1.6"/>`;
  s += `<text x="${c}" y="${c + 12}" text-anchor="middle" font-family="Space Grotesk" font-weight="700" font-size="34">M</text>`;
  ['A', 'B', 'C'].forEach((l, i) => {
    s += `<text x="${(c + R * (0.26 + i * 0.21)).toFixed(1)}" y="${c + 10}" text-anchor="middle" font-family="Space Grotesk" font-weight="700" font-size="30">${l}</text>`;
  });
  const put = (name, ang, rad, label) => {
    const x = c + Math.cos(ang) * rad - 22, y = c + Math.sin(ang) * rad - 22;
    s += `<g transform="translate(${x.toFixed(1)},${y.toFixed(1)})">${icon(name, 44).replace('<svg', '<svg x="0" y="0"')}</g>`;
    if (label && labels) s += `<text x="${(c + Math.cos(ang) * rad).toFixed(1)}" y="${(c + Math.sin(ang) * rad + 46).toFixed(1)}" text-anchor="middle" font-family="Space Grotesk" font-size="10" letter-spacing=".08em" fill="#111">${label}</text>`;
  };
  put('antenna', -Math.PI * 0.68, R * 0.67, 'COMMS');
  put('doc', -Math.PI * 0.5, R * 0.67, 'LOG');
  put('plant', -Math.PI * 0.32, R * 0.67, 'GREENHOUSE');
  put('flask', Math.PI, R * 0.67, 'LAB');
  put('bunk', Math.PI * 0.27, R * 0.67, 'SLEEP');
  put('bike', Math.PI * 0.63, R * 0.67, 'POWER');
  s += `<text x="${(c + R * 0.98).toFixed(1)}" y="${(c + R * 0.62).toFixed(1)}" font-family="Space Grotesk" font-weight="700" font-size="30">R75-2</text>`;
  s += `<g transform="translate(${(c - R * 1.3).toFixed(1)},${(c - R * 1.15).toFixed(1)})">${icon('astro', 44)}</g>`;
  s += '</svg>';
  return s;
}
