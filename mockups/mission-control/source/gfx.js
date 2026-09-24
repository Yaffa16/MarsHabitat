// Procedural imagery for the mission-control mockups: Mars, Earth, camera feeds,
// the geodesic dome, the orbital plot, trend lines. Deterministic (seeded).
const G = (() => {
  let uid = 0;
  const id = p => p + (++uid);
  const rng = s => () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; };

  function mars(size, { seed = 3, grid = true } = {}) {
    const g = id('m'), f = id('f'), c = id('c'), sh = id('s');
    const r = size / 2;
    return `<svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
      <defs>
        <radialGradient id="${g}" cx="38%" cy="34%" r="75%">
          <stop offset="0" stop-color="#ffb07a"/><stop offset=".35" stop-color="#e2692f"/>
          <stop offset=".75" stop-color="#8e2f12"/><stop offset="1" stop-color="#3a1206"/></radialGradient>
        <radialGradient id="${sh}" cx="30%" cy="30%" r="85%">
          <stop offset=".55" stop-color="#000" stop-opacity="0"/><stop offset="1" stop-color="#000" stop-opacity=".85"/></radialGradient>
        <filter id="${f}" x="0" y="0" width="100%" height="100%">
          <feTurbulence type="fractalNoise" baseFrequency="${3.2 / size * 10}" numOctaves="5" seed="${seed}"/>
          <feColorMatrix values="0 0 0 0 .25  0 0 0 0 .07  0 0 0 0 .02  0 0 0 1.6 -.55"/>
        </filter>
        <clipPath id="${c}"><circle cx="${r}" cy="${r}" r="${r - 1}"/></clipPath>
      </defs>
      <circle cx="${r}" cy="${r}" r="${r + 6}" fill="none" stroke="#ff5a1f" stroke-opacity=".12" stroke-width="10"/>
      <g clip-path="url(#${c})">
        <rect width="${size}" height="${size}" fill="url(#${g})"/>
        <rect width="${size}" height="${size}" filter="url(#${f})" opacity=".9"/>
        <ellipse cx="${r * 1.02}" cy="${r * 1.05}" rx="${r * .9}" ry="${r * .09}" fill="#3a0f04" opacity=".35"/>
        <ellipse cx="${r * .9}" cy="${r * .12}" rx="${r * .35}" ry="${r * .09}" fill="#fff4ec" opacity=".75"/>
        ${grid ? Array.from({ length: 5 }, (_, i) => `<ellipse cx="${r}" cy="${r}" rx="${r * (i + 1) / 6}" ry="${r - 1}" fill="none" stroke="#ffd2b8" stroke-opacity=".13"/>`).join('')
          + Array.from({ length: 5 }, (_, i) => { const y = size * (i + 1) / 6; const w = Math.sqrt(r * r - (y - r) ** 2); return `<line x1="${r - w}" x2="${r + w}" y1="${y}" y2="${y}" stroke="#ffd2b8" stroke-opacity=".13"/>`; }).join('') : ''}
        <rect width="${size}" height="${size}" fill="url(#${sh})"/>
      </g></svg>`;
  }

  function earth(size) {
    const g = id('e'), f = id('ef'), c = id('ec');
    const r = size / 2;
    return `<svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}"><defs>
      <radialGradient id="${g}" cx="35%" cy="32%" r="75%"><stop offset="0" stop-color="#9ec5ff"/><stop offset=".5" stop-color="#2d62c9"/><stop offset="1" stop-color="#081a44"/></radialGradient>
      <filter id="${f}"><feTurbulence type="fractalNoise" baseFrequency="${2.4 / size * 10}" numOctaves="4" seed="9"/>
      <feColorMatrix values="0 0 0 0 .35  0 0 0 0 .55  0 0 0 0 .3  0 0 0 2.2 -1.1"/></filter>
      <clipPath id="${c}"><circle cx="${r}" cy="${r}" r="${r}"/></clipPath></defs>
      <circle cx="${r}" cy="${r}" r="${r}" fill="url(#${g})"/>
      <g clip-path="url(#${c})"><rect width="${size}" height="${size}" filter="url(#${f})"/></g>
      <circle cx="${r}" cy="${r}" r="${r - .5}" fill="none" stroke="#bcd6ff" stroke-opacity=".5"/></svg>`;
  }

  // a CCTV frame from inside the habitat
  const SCENES = {
    galley: { wall: ['#2b1d14', '#120a06'], lamp: '#ffb46a', lx: .3 },
    lab: { wall: ['#0f2320', '#050c0b'], lamp: '#7dffd0', lx: .7 },
    hydro: { wall: ['#1a2a10', '#070b04'], lamp: '#d4ff7a', lx: .5 },
    airlock: { wall: ['#2a1208', '#0c0402'], lamp: '#ff6a2f', lx: .5 },
    bunk: { wall: ['#121a33', '#04060e'], lamp: '#8aa6ff', lx: .25 },
    bike: { wall: ['#26211a', '#0a0806'], lamp: '#ffd79a', lx: .65 },
  };
  function cam(w, h, { scene = 'galley', label = 'CAM-01', time = '14:22:08', seed = 1 } = {}) {
    const s = SCENES[scene], R = rng(seed), g = id('cg'), l = id('cl'), n = id('cn');
    const lx = s.lx * w;
    let props = '';
    // floor line and perspective
    props += `<polygon points="0,${h} ${w},${h} ${w * .78},${h * .62} ${w * .22},${h * .62}" fill="#000" opacity=".45"/>`;
    props += `<line x1="${w * .22}" y1="${h * .62}" x2="${w * .78}" y2="${h * .62}" stroke="${s.lamp}" stroke-opacity=".25"/>`;
    // panels on the back wall
    for (let i = 0; i < 4; i++) { const x = w * (.24 + i * .135); props += `<rect x="${x}" y="${h * .2}" width="${w * .11}" height="${h * .38}" fill="#fff" opacity="${.03 + R() * .05}"/>`; }
    if (scene === 'hydro') for (let i = 0; i < 3; i++) { const y = h * (.28 + i * .12); props += `<rect x="${w * .2}" y="${y}" width="${w * .6}" height="${h * .025}" fill="${s.lamp}" opacity=".5"/>`; for (let k = 0; k < 14; k++) props += `<circle cx="${w * (.22 + k * .042)}" cy="${y - 2}" r="${2 + R() * 3}" fill="#6fbf3a" opacity=".8"/>`; }
    if (scene === 'lab') props += `<rect x="${w * .15}" y="${h * .5}" width="${w * .7}" height="${h * .06}" fill="#9fffe0" opacity=".2"/><rect x="${w * .56}" y="${h * .3}" width="${w * .14}" height="${h * .18}" fill="#7dffd0" opacity=".25" rx="2"/>`;
    if (scene === 'airlock') props += `<circle cx="${w * .5}" cy="${h * .42}" r="${h * .24}" fill="none" stroke="#ff8a5a" stroke-opacity=".5" stroke-width="3"/><circle cx="${w * .5}" cy="${h * .42}" r="${h * .18}" fill="#ff5a1f" opacity=".12"/>`;
    if (scene === 'bunk') for (let i = 0; i < 2; i++) props += `<rect x="${w * .12}" y="${h * (.3 + i * .22)}" width="${w * .5}" height="${h * .12}" rx="3" fill="#8aa6ff" opacity=".14"/>`;
    if (scene === 'bike') props += `<circle cx="${w * .42}" cy="${h * .72}" r="${h * .13}" fill="none" stroke="#ffd79a" stroke-opacity=".6" stroke-width="2"/><circle cx="${w * .66}" cy="${h * .72}" r="${h * .13}" fill="none" stroke="#ffd79a" stroke-opacity=".6" stroke-width="2"/><path d="M${w * .42} ${h * .72} L${w * .52} ${h * .52} L${w * .66} ${h * .72} M${w * .52} ${h * .52} L${w * .6} ${h * .5}" stroke="#ffd79a" stroke-opacity=".6" stroke-width="2" fill="none"/>`;
    if (scene === 'galley') props += `<rect x="${w * .18}" y="${h * .52}" width="${w * .64}" height="${h * .05}" fill="#ffb46a" opacity=".25"/><circle cx="${w * .4}" cy="${h * .48}" r="${h * .04}" fill="#ffcf9a" opacity=".4"/><circle cx="${w * .52}" cy="${h * .49}" r="${h * .03}" fill="#ffcf9a" opacity=".35"/>`;
    // figures: soft silhouettes
    const figs = scene === 'bunk' || scene === 'airlock' ? 0 : 1 + (R() > .5 ? 1 : 0);
    for (let i = 0; i < figs; i++) { const x = w * (.3 + R() * .4), hh = h * (.36 + R() * .08); props += `<g opacity=".85"><ellipse cx="${x}" cy="${h * .92 - hh}" rx="${h * .05}" ry="${h * .06}" fill="#050505"/><path d="M${x - h * .1} ${h * .95} Q${x - h * .1} ${h * .92 - hh + h * .1} ${x} ${h * .92 - hh + h * .07} Q${x + h * .1} ${h * .92 - hh + h * .1} ${x + h * .1} ${h * .95}Z" fill="#050505"/></g>`; }
    return `<svg width="${w}" height="${h}" viewBox="0 0 ${w} ${h}" preserveAspectRatio="xMidYMid slice"><defs>
      <linearGradient id="${g}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${s.wall[0]}"/><stop offset="1" stop-color="${s.wall[1]}"/></linearGradient>
      <radialGradient id="${l}" cx="${s.lx}" cy=".05" r=".8"><stop offset="0" stop-color="${s.lamp}" stop-opacity=".38"/><stop offset="1" stop-color="${s.lamp}" stop-opacity="0"/></radialGradient>
      <filter id="${n}"><feTurbulence type="fractalNoise" baseFrequency=".9" numOctaves="2" seed="${seed}"/><feColorMatrix values="0 0 0 0 1 0 0 0 0 1 0 0 0 0 1 0 0 0 .09 0"/></filter></defs>
      <rect width="${w}" height="${h}" fill="url(#${g})"/>
      <rect width="${w}" height="${h}" fill="url(#${l})"/>
      ${props}
      <rect width="${w}" height="${h}" filter="url(#${n})"/>
      <rect x="${lx - 20}" y="0" width="40" height="3" fill="${s.lamp}" opacity=".9"/>
      <g font-family="ZKM Serendipity" font-size="${Math.max(8, h * .075)}" fill="#fff" fill-opacity=".85" letter-spacing="1">
        <text x="6" y="${h * .12}">${label}</text><text x="${w - 6}" y="${h * .12}" text-anchor="end">${time}</text></g>
      <circle cx="${w - 8}" cy="${h - 9}" r="3" fill="#ff5a1f"/>
      <path d="M6 ${h * .78} v${h * .16} h${h * .16} M${w - 6} ${h * .22} v-${h * .12}" stroke="#fff" stroke-opacity=".35" fill="none"/></svg>`;
  }

  // the geodesic dome: a hemisphere of triangles, projected with a slight tilt
  function dome(w, h, { color = '#ffb454', nodes = [], r: opts_r } = {}) {
    const R = Math.min(w * (opts_r||.44), h * .9), cx = w / 2, cy = h * .92, tilt = .32;
    const rings = 6, pts = [];
    for (let i = 0; i <= rings; i++) {
      const lat = (i / rings) * Math.PI / 2, n = i === rings ? 1 : Math.max(5, (rings - i) * 5);
      const row = [];
      for (let k = 0; k < n; k++) {
        const lon = (k / n) * Math.PI * 2 + (i % 2) * Math.PI / n;
        const x = Math.cos(lat) * Math.cos(lon), z = Math.cos(lat) * Math.sin(lon), y = Math.sin(lat);
        const yy = y * Math.cos(tilt) - z * Math.sin(tilt), zz = y * Math.sin(tilt) + z * Math.cos(tilt);
        row.push({ x: cx + x * R, y: cy - yy * R, z: zz });
      }
      pts.push(row);
    }
    const lines = [];
    const seg = (a, b) => { const front = (a.z + b.z) / 2 < 0.05; lines.push(`<line x1="${a.x.toFixed(1)}" y1="${a.y.toFixed(1)}" x2="${b.x.toFixed(1)}" y2="${b.y.toFixed(1)}" stroke="${color}" stroke-opacity="${front ? .55 : .12}" stroke-width="${front ? 1.1 : .8}"/>`); };
    for (let i = 0; i < pts.length; i++) {
      const row = pts[i];
      for (let k = 0; k < row.length; k++) {
        if (row.length > 1) seg(row[k], row[(k + 1) % row.length]);
        const up = pts[i + 1]; if (!up) continue;
        const t = k / row.length; const j = Math.floor(t * up.length) % up.length;
        seg(row[k], up[j]); if (up.length > 1) seg(row[k], up[(j + 1) % up.length]);
      }
    }
    const pad = pts[0].map(p => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ');
    const hex = (x, y, r) => Array.from({ length: 6 }, (_, i) => { const a = Math.PI / 3 * i + Math.PI / 6; return `${(x + r * Math.cos(a)).toFixed(1)},${(y + r * Math.sin(a)).toFixed(1)}`; }).join(' ');
    const nd = nodes.map(n => {
      const x = cx + n.x * R, y = cy - n.y * R, r = n.r || 22;
      const side = n.side || (n.x < 0 ? -1 : 1);
      const hot = n.hot, col = hot ? '#ff5a1f' : color;
      let lead = '', tag = '';
      if (n.to) lead = `<polyline points="${x + r * .9},${y} ${x + r + 20},${y} ${n.to[0]},${n.to[1]}" fill="none" stroke="#ff5a1f" stroke-width="1.2"/>`;
      else {
        const lx = x + side * (r + 30), tw = Math.max(n.name.length * 9.6, (n.code.length + 3 + (n.state || 'NOMINAL').length) * 7.2) + 16;
        const bx = Math.max(6, Math.min(w - 6 - tw, side < 0 ? lx - tw : lx));
        lead = `<line x1="${x + side * r * .9}" y1="${y}" x2="${lx}" y2="${y}" stroke="${col}" stroke-opacity=".6"/>`;
        tag = `<rect x="${bx}" y="${y - 17}" width="${tw}" height="34" rx="2" fill="rgba(5,8,11,.88)" stroke="${col}" stroke-opacity=".35"/>
          <text x="${bx + 8}" y="${y - 2}" font-family="ZKM Serendipity" font-size="11.5" letter-spacing="1.3" fill="${hot ? '#ff5a1f' : '#e6edf3'}">${n.name.toUpperCase()}</text>
          <text x="${bx + 8}" y="${y + 11}" font-family="ZKM Serendipity" font-size="8.5" letter-spacing="1.3" fill="${n.state ? '#ffb454' : '#5e6b78'}">${n.code} · ${n.state || 'NOMINAL'}</text>`;
      }
      return `<g>${lead}<polygon points="${hex(x, y, r + 6)}" fill="none" stroke="${col}" stroke-opacity="${hot ? .5 : .18}"/>
        <polygon points="${hex(x, y, r)}" fill="${hot ? 'rgba(255,90,31,.25)' : 'rgba(5,8,11,.9)'}" stroke="${col}" stroke-width="1.5"/>
        <text x="${x}" y="${y + 4}" text-anchor="middle" font-family="ZKM Serendipity" font-size="${r * .5}" letter-spacing="1" fill="${col}">${n.icon || ''}</text>${tag}</g>`;
    }).join('');
    return `<svg width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">
      <ellipse cx="${cx}" cy="${cy}" rx="${R * 1.25}" ry="${R * .12}" fill="none" stroke="${color}" stroke-opacity=".12"/>
      <ellipse cx="${cx}" cy="${cy}" rx="${R * 1.5}" ry="${R * .16}" fill="none" stroke="${color}" stroke-opacity=".07" stroke-dasharray="3 5"/>
      <polygon points="${pad}" fill="${color}" fill-opacity=".04"/>
      ${lines.join('')}${nd}</svg>`;
  }

  // Earth–Mars plot for 19 Oct 2026
  function orbit(w, h, { t = .62 } = {}) {
    const cx = w * .5, cy = h * .52, rE = h * .24, rM = h * .40;
    const aE = -2.2, aM = -0.05; // radians
    const E = [cx + rE * Math.cos(aE), cy + rE * Math.sin(aE)], M = [cx + rM * Math.cos(aM), cy + rM * Math.sin(aM)];
    const P = [E[0] + (M[0] - E[0]) * t, E[1] + (M[1] - E[1]) * t];
    return `<svg width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">
      ${[.1, .2, .3, .4, .5].map(k => `<circle cx="${cx}" cy="${cy}" r="${h * k}" fill="none" stroke="#243040" stroke-dasharray="${k === .5 ? '0' : '2 4'}"/>`).join('')}
      <line x1="${cx - h * .5}" y1="${cy}" x2="${cx + h * .5}" y2="${cy}" stroke="#243040"/><line x1="${cx}" y1="${cy - h * .5}" x2="${cx}" y2="${cy + h * .5}" stroke="#243040"/>
      <circle cx="${cx}" cy="${cy}" r="${rE}" fill="none" stroke="#4d7cff" stroke-opacity=".6"/>
      <circle cx="${cx}" cy="${cy}" r="${rM}" fill="none" stroke="#ff5a1f" stroke-opacity=".6"/>
      <circle cx="${cx}" cy="${cy}" r="7" fill="#ffd27a"/><circle cx="${cx}" cy="${cy}" r="16" fill="#ffd27a" opacity=".12"/>
      <line x1="${E[0]}" y1="${E[1]}" x2="${M[0]}" y2="${M[1]}" stroke="#ffb454" stroke-dasharray="4 4" stroke-opacity=".7"/>
      <line x1="${E[0]}" y1="${E[1]}" x2="${P[0]}" y2="${P[1]}" stroke="#ff5a1f" stroke-width="2.5"/>
      <circle cx="${P[0]}" cy="${P[1]}" r="4" fill="#fff"/><circle cx="${P[0]}" cy="${P[1]}" r="10" fill="#ff5a1f" opacity=".3"/>
      <circle cx="${E[0]}" cy="${E[1]}" r="7" fill="#4d7cff"/><circle cx="${M[0]}" cy="${M[1]}" r="6" fill="#ff5a1f"/>
      <g font-family="ZKM Serendipity" font-size="10" letter-spacing="1.5" fill="#9aa8b6">
        <text x="${E[0] - 12}" y="${E[1] - 12}" text-anchor="end">EARTH · ZKM</text>
        <text x="${M[0]}" y="${M[1] + 24}" text-anchor="middle">MARS · HAB-01</text>
        <text x="${cx + 10}" y="${cy + 18}" fill="#5e6b78">SOL</text></g></svg>`;
  }

  function series(n, seed, base, amp, drift = 0, noise = .15) {
    const R = rng(seed); return Array.from({ length: n }, (_, i) => base + amp * Math.sin(i / n * Math.PI * 2 * 1.5 + seed) + drift * i / n + (R() - .5) * amp * noise * 2);
  }
  function spark(vals, w, h, { color = '#ffb454', fill = true, lo, hi, dash = 0 } = {}) {
    lo = lo ?? Math.min(...vals); hi = hi ?? Math.max(...vals);
    const px = i => (i / (vals.length - 1)) * w, py = v => h - 2 - ((v - lo) / (hi - lo || 1)) * (h - 4);
    const d = vals.map((v, i) => `${i ? 'L' : 'M'}${px(i).toFixed(1)} ${py(v).toFixed(1)}`).join('');
    const gid = id('sg');
    return `<svg width="${w}" height="${h}" viewBox="0 0 ${w} ${h}" preserveAspectRatio="none"><defs><linearGradient id="${gid}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${color}" stop-opacity=".28"/><stop offset="1" stop-color="${color}" stop-opacity="0"/></linearGradient></defs>
      ${fill ? `<path d="${d}L${w} ${h}L0 ${h}Z" fill="url(#${gid})"/>` : ''}<path d="${d}" fill="none" stroke="${color}" stroke-width="1.5" ${dash ? `stroke-dasharray="${dash}"` : ''} vector-effect="non-scaling-stroke"/></svg>`;
  }

  function stars(w, h, n = 160, seed = 4) {
    const R = rng(seed);
    return `<svg width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">${Array.from({ length: n }, () => `<circle cx="${(R() * w).toFixed(1)}" cy="${(R() * h).toFixed(1)}" r="${(R() * 1.1 + .2).toFixed(2)}" fill="#fff" opacity="${(R() * .7 + .1).toFixed(2)}"/>`).join('')}</svg>`;
  }

  return { mars, earth, cam, dome, orbit, series, spark, stars, rng };
})();
// fill any [data-g] placeholder
function paint() {
  document.querySelectorAll('[data-g]').forEach(el => {
    const o = JSON.parse(el.dataset.o || '{}');
    const w = +el.dataset.w || el.clientWidth, h = +el.dataset.h || el.clientHeight;
    const k = el.dataset.g;
    if (k === 'mars') el.innerHTML = G.mars(w, o);
    else if (k === 'earth') el.innerHTML = G.earth(w);
    else if (k === 'cam') el.innerHTML = G.cam(w, h, o);
    else if (k === 'orbit') el.innerHTML = G.orbit(w, h, o);
    else if (k === 'stars') el.innerHTML = G.stars(w, h, o.n, o.seed);
    else if (k === 'spark') el.innerHTML = G.spark(G.series(o.n || 48, o.seed || 1, o.base || 50, o.amp || 10, o.drift || 0, o.noise ?? .15), w, h, o);
  });
}
document.addEventListener('DOMContentLoaded', paint);
