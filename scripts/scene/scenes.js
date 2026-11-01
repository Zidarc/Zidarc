// Night-time pixel backdrops for Huna's walk: a shared sky, then scenes she walks through one after another
// (rooftop, balcony railing, meadow, lake, cherry blossoms, snow, seaside wall). Each scene is split into parallax layers.
// Everything is drawn in 3px cells. The surface she walks on is always row GY so she never jumps between scenes.
const VW = 280, VH = 80, GY = 56;

function rng(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const ri = (r, a, b) => a + Math.floor(r() * (b - a + 1));
const pick = (r, a) => a[Math.floor(r() * a.length)];

const hex = c => [1, 3, 5].map(i => parseInt(c.slice(i, i + 2), 16));
const toHex = a => '#' + a.map(v => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, '0')).join('');
const mix = (a, b, t) => { const B = hex(b); return toHex(hex(a).map((v, i) => v + (B[i] - v) * t)); };

const SKY = ['#04050c', '#070a17', '#0b1022', '#10172e', '#161f3b'];
const HORIZON = SKY[4];
const LIGHTS = ['#ffcf73', '#ffe3a1', '#f2b257', '#fff0cc'];

// ---------- drawing ----------
function canvas() {
  const by = new Map();
  const cv = {
    rect(x, y, w, h, col) {
      x = Math.round(x); y = Math.round(y); w = Math.round(w); h = Math.round(h);
      if (w <= 0 || h <= 0) return;
      const d = `M${x} ${y}h${w}v${h}h${-w}z`;
      by.has(col) ? by.get(col).push(d) : by.set(col, [d]);
    },
    px(x, y, col) { cv.rect(x, y, 1, 1, col); },
    disc(cx, cy, rad, col) {
      for (let y = -Math.floor(rad); y <= rad; y++) {
        const hw = Math.floor(Math.sqrt(rad * rad - y * y));
        cv.rect(cx - hw, cy + y, hw * 2 + 1, 1, col);
      }
    },
    // col may carry an opacity as '#rrggbb|0.4'.
    svg: () => [...by].map(([c, d]) => {
      const [f, o] = c.split('|');
      return `<path fill="${f}"${o ? ` fill-opacity="${o}"` : ''} d="${d.join('')}"/>`;
    }).join(''),
  };
  return cv;
}

// Night sky shared by every scene: dithered bands, stars, a moon and slow clouds.
function sky(r) {
  const cv = canvas(), H = [14, 14, 16, 18, 18];
  let defs = '', y = 0;
  SKY.forEach((c, i) => {
    cv.rect(0, y, VW, H[i], c);
    if (i) {
      defs += `<pattern id="dz${i}" width="2" height="2" patternUnits="userSpaceOnUse"><rect width="2" height="2" fill="${SKY[i - 1]}"/><rect width="1" height="1" fill="${c}"/><rect x="1" y="1" width="1" height="1" fill="${c}"/></pattern>`;
      cv.rect(0, y - 1, VW, 1, `url(#dz${i})`);
    }
    y += H[i];
  });
  for (let i = 0; i < 80; i++) cv.px(ri(r, 0, VW - 1), ri(r, 0, 44), `#ffffff|${(0.2 + r() * 0.6).toFixed(2)}`);
  const tw = canvas();
  for (let i = 0; i < 12; i++) tw.px(ri(r, 0, VW - 1), ri(r, 0, 30), '#fff6e0');
  cv.disc(226, 13, 9, '#dfe8ff|0.07'); cv.disc(226, 13, 6, '#dfe8ff|0.08');
  cv.disc(226, 13, 4, '#eef2fa'); cv.px(225, 12, '#d5dbe8'); cv.px(227, 14, '#d5dbe8'); cv.px(224, 14, '#dde3ef');
  const cl = canvas();
  for (let i = 0; i < 4; i++) {
    const cx = ri(r, 0, VW - 1), cy = ri(r, 8, 28), w = ri(r, 16, 30);
    const puffs = Array.from({ length: Math.ceil(w / 6) }, (_, k) => [cx - w / 2 + k * 6 + 3, cy - ri(r, 0, 2), ri(r, 3, 4)]);
    for (let yy = cy - 7; yy <= cy + 1; yy++) for (let xx = cx - w / 2 - 5; xx < cx + w / 2 + 5; xx++) {
      if (!puffs.some(([px, py, pr]) => (xx - px) ** 2 + ((yy - py) * 1.4) ** 2 <= pr * pr)) continue;
      cl.px(((xx % VW) + VW) % VW, yy, yy >= cy - 1 ? '#1a2034|0.9' : '#2a3150|0.9');
    }
  }
  defs += `<g id="clouds">${cl.svg()}</g>`;
  const css = '.tw{animation:tw 3.3s ease-in-out infinite}@keyframes tw{50%{opacity:.1}}'
    + `.clouds{animation:clouds 300s linear infinite}@keyframes clouds{to{transform:translateX(-${VW * 3}px)}}`;
  const svg = `<g transform="scale(3)">${cv.svg()}<g class="tw">${tw.svg()}</g></g>
<g class="clouds"><g transform="scale(3)"><use href="#clouds"/><use href="#clouds" x="${VW}"/></g></g>`;
  return { defs, svg, css };
}

// Dark city silhouettes with scattered lit windows.
function skyline(w, base, { r, minH, maxH, minW, maxW, cols, lit = 0.3, tanks = false, haze = 0 }) {
  const cv = canvas(), fade = c => mix(c, HORIZON, haze);
  let x = -2;
  while (x < w) {
    const bw = ri(r, minW, maxW), bh = ri(r, minH, maxH), top = base - bh, c = pick(r, cols);
    cv.rect(x, top, bw, VH - top, fade(c));
    cv.rect(x, top, bw, 1, fade(mix(c, '#8090c0', 0.18)));
    if (tanks && r() < 0.55) {
      const tw = ri(r, 3, 5), tx = x + ri(r, 1, Math.max(1, bw - tw - 1));
      cv.rect(tx, top - 3, tw, 3, fade(mix(c, '#000000', 0.3))); cv.rect(tx, top - 3, tw, 1, fade(mix(c, '#8090c0', 0.15)));
    }
    if (r() < 0.25) { const ah = ri(r, 4, 10); cv.rect(x + ri(r, 1, bw - 2), top - ah, 1, ah, fade(c)); }
    const sx = bw > 9 ? 3 : 2;
    for (let wy = top + 2; wy < Math.min(base + 6, VH); wy += 3)
      for (let wx = x + 2; wx < x + bw - 1; wx += sx) if (r() < lit) cv.px(wx, wy, fade(pick(r, LIGHTS)));
    x += bw + ri(r, 0, 2);
  }
  return cv.svg();
}

function ridge(w, base, { r, minH, maxH, col, scale = 1, trees = 0, treeCol }) {
  const cv = canvas();
  const ph = [r() * 6.3, r() * 6.3, r() * 6.3];
  const h = x => minH + (maxH - minH) * (0.5 + 0.3 * Math.sin(x / (23 * scale) + ph[0]) + 0.14 * Math.sin(x / (9.7 * scale) + ph[1]) + 0.06 * Math.sin(x / (4.1 * scale) + ph[2]));
  const lit = mix(col, '#7f8cc0', 0.12);
  for (let x = 0; x < w; x++) {
    const top = Math.round(base - h(x));
    cv.rect(x, top, 1, VH - top, col);
    if (h(x + 1) > h(x - 1)) cv.px(x, top, lit);
  }
  for (let i = 0; i < trees; i++) {
    const tx = ri(r, 0, w - 1), ty = Math.round(base - h(tx)) + 1, th = ri(r, 6, 11);
    for (let k = 0; k < th; k++) cv.rect(tx - Math.floor((k + 1) / 2.4), ty - 2 - th + k, Math.floor((k + 1) / 2.4) * 2 + 1, 1, treeCol);
    cv.rect(tx, ty - 2, 1, 2, treeCol);
  }
  return cv.svg();
}

// A lit window: warm interior, sash bars, sometimes a curtain or a plant silhouette.
function litWindow(cv, x, y, w, h, r) {
  cv.rect(x - 1, y - 1, w + 2, h + 2, '#1c1a22');
  cv.rect(x, y, w, h, '#e9a654');
  cv.rect(x, y, w, Math.ceil(h / 3), '#f2bd6c');
  cv.rect(x + Math.floor(w / 2), y, 1, h, '#5a3a22');
  cv.rect(x, y + Math.floor(h / 2), w, 1, '#5a3a22');
  if (r() < 0.6) { const cw = Math.max(2, Math.floor(w / 4)); cv.rect(x, y, cw, h, '#9e4a3c'); cv.rect(x + w - cw, y, cw, h, '#9e4a3c'); }
  if (r() < 0.5) { const px = x + ri(r, 2, w - 5); cv.rect(px, y + h - 3, 3, 3, '#3a2418'); cv.rect(px - 1, y + h - 6, 5, 3, '#2a3a20'); }
}

// ---------- scenes: (r, len) -> layers; len is how far the camera travels (cells) while it's on screen ----------
const W = (len, f) => VW + Math.ceil(len * f) + 4;

function rooftop(r, len) {
  const far = skyline(W(len, 0.08), 58, { r, minH: 12, maxH: 32, minW: 6, maxW: 14, cols: ['#121728', '#151b2e', '#0f1322'], lit: 0.22, haze: 0.15 });
  const mid = canvas(), mw = W(len, 0.3);
  for (let x = -4; x < mw;) {
    const bw = ri(r, 22, 46), top = ri(r, 44, 52), c = pick(r, ['#0c0f1a', '#0e1220', '#0b0d17']);
    mid.rect(x, top, bw, VH - top, c); mid.rect(x, top, bw, 1, '#1f2638');
    if (r() < 0.8) {
      const tx = x + ri(r, 3, bw - 10), th = ri(r, 5, 7);
      mid.rect(tx, top - th, 7, th, '#07080d'); mid.rect(tx, top - th, 7, 1, '#2a3048');
      mid.rect(tx + 1, top - 1, 1, 1, '#07080d'); mid.rect(tx + 5, top - 1, 1, 1, '#07080d');
    }
    if (r() < 0.5) { const ax = x + ri(r, 2, bw - 3), ah = ri(r, 10, 18); mid.rect(ax, top - ah, 1, ah, '#141826'); mid.rect(ax - 3, top - ah + 2, 7, 1, '#141826'); mid.rect(ax - 2, top - ah + 5, 5, 1, '#141826'); }
    if (r() < 0.45) for (let k = 0; k < bw; k += 3) mid.px(x + k, top - 5 + Math.round(2 * Math.sin(k / 5)), pick(r, ['#ffd27a', '#ff9e6e', '#fff2cf', '#9fd0ff']));
    for (let k = 0; k < 3; k++) if (r() < 0.5) litWindow(mid, x + ri(r, 2, bw - 8), top + ri(r, 4, 12), 5, 4, r);
    x += bw + ri(r, 2, 8);
  }
  const w = W(len, 1), cv = canvas();
  cv.rect(0, GY, w, 1, '#4c5064'); cv.rect(0, GY + 1, w, 2, '#363949'); cv.rect(0, GY + 3, w, 1, '#16171f');
  cv.rect(0, GY + 4, w, VH - GY - 4, '#23252f');
  for (let i = 0; i < w * 1.2; i++) cv.px(ri(r, 0, w), ri(r, GY + 4, VH - 1), '#1a1b23|0.8');
  for (let x = ri(r, 0, 40); x < w; x += ri(r, 60, 110)) cv.rect(x, GY + 4, 1, VH - GY - 4, '#191a22');
  for (let x = ri(r, 30, 80); x < w; x += ri(r, 110, 170)) litWindow(cv, x, GY + 10, 12, 10, r);
  for (let x = ri(r, 60, 120); x < w; x += ri(r, 130, 200)) {
    cv.rect(x, GY + 6, 14, 8, '#3a3d4a'); cv.rect(x, GY + 6, 14, 1, '#4c5064');
    for (let k = 1; k < 13; k += 2) cv.rect(x + k, GY + 8, 1, 5, '#262833');
  }
  return { kind: 'ledge', layers: [[0.08, far], [0.3, mid.svg()], [1, cv.svg()]], fg: [] };
}

function balcony(r, len) {
  const far = skyline(W(len, 0.1), 60, { r, minH: 10, maxH: 28, minW: 6, maxW: 13, cols: ['#121728', '#151b2e', '#0f1322'], lit: 0.22, haze: 0.15 });
  const mid = skyline(W(len, 0.35), 64, { r, minH: 20, maxH: 40, minW: 14, maxW: 26, cols: ['#0d101b', '#10141f', '#0b0e18'], lit: 0.32, tanks: true });
  const w = W(len, 1), cv = canvas();
  // The railing she walks on: concrete coping over a jaali (breeze-block) panel with warm light behind it.
  cv.rect(0, GY, w, 1, '#55596d'); cv.rect(0, GY + 1, w, 2, '#3c3f50'); cv.rect(0, GY + 3, w, 1, '#14151c');
  cv.rect(0, GY + 4, w, 12, '#2a2c38');
  for (let x = 0; x < w; x += 6) for (let y = GY + 5; y < GY + 15; y += 5) { cv.rect(x + 1, y, 4, 3, '#6a4a2a'); cv.rect(x + 2, y + 1, 2, 1, '#c98a45'); }
  cv.rect(0, GY + 16, w, 3, '#3a3d4c'); cv.rect(0, GY + 19, w, 1, '#121318');
  cv.rect(0, GY + 20, w, VH - GY - 20, '#1d1f28');
  for (let x = ri(r, 10, 50); x < w; x += ri(r, 70, 120)) litWindow(cv, x, GY + 22, 14, 6, r);
  // Fairy lights strung along the railing.
  const lights = canvas();
  for (let x = 0; x < w; x += 5) lights.px(x, GY + 5 + Math.round(1.5 * Math.sin(x / 8)), pick(r, ['#ffd27a', '#ff8fa8', '#9fe0ff', '#c6ff9a']));
  for (let x = ri(r, 30, 70); x < w; x += ri(r, 120, 190)) {
    cv.rect(x, GY - 6, 7, 6, '#7a3d27'); cv.rect(x - 1, GY - 7, 9, 1, '#8f4a30');
    for (let k = 0; k < 10; k++) cv.rect(x + 3 + ri(r, -4, 3), GY - 8 - ri(r, 0, 7), ri(r, 1, 3), 2, pick(r, ['#1f3a22', '#2a4a2a', '#183019']));
  }
  return { kind: 'ledge', layers: [[0.1, far], [0.35, mid], [1, cv.svg() + `<g class="fl">${lights.svg()}</g>`]], fg: [], css: '.fl{animation:tw 1.7s ease-in-out infinite}' };
}

// ---------- shared animated bits ----------
// Fireflies that drift and blink (fixed to the viewport).
function fireflies(r, n, y0, y1) {
  return Array.from({ length: n }, (_, i) =>
    `<rect class="ff" x="${ri(r, 10, VW - 10)}" y="${ri(r, y0, y1)}" width="1" height="1" fill="#e8ff8a" style="animation-delay:-${(i * 0.9).toFixed(1)}s;animation-duration:${(4 + r() * 4).toFixed(1)}s"/>`).join('');
}
const FF_CSS = '.ff{animation:ff 6s ease-in-out infinite}@keyframes ff{0%,100%{opacity:0;transform:translate(0,0)}30%{opacity:1}50%{opacity:.2;transform:translate(5px,-4px)}70%{opacity:1;transform:translate(9px,1px)}}';
// Two groups that take turns dimming: water shimmer and moon glitter.
const GL_CSS = '.gl1{animation:gl 1.8s steps(1,end) infinite}.gl2{animation:gl 1.8s steps(1,end) -.9s infinite}@keyframes gl{50%{opacity:.2}}';
const LG_CSS = '.lg{animation:lg 2.6s ease-in-out infinite}@keyframes lg{50%{opacity:.55}}';

// Snow or petals falling on a loop: one tile drawn twice, stacked, sliding down (and sideways).
function fall(id, r, n, cols, dur, dx) {
  const cv = canvas();
  for (let i = 0; i < n; i++) cv.px(ri(r, 0, VW + Math.abs(dx)), ri(r, 0, VH - 1), pick(r, cols));
  return {
    defs: `<g id="${id}">${cv.svg()}</g>`,
    svg: `<g transform="scale(3)"><g class="${id}"><use href="#${id}"/><use href="#${id}" y="-${VH}"/></g></g>`,
    css: `.${id}{animation:${id} ${dur}s linear infinite}@keyframes ${id}{to{transform:translate(${dx}px,${VH}px)}}`,
  };
}

// The moon's reflection on water, right under the moon.
function glitter(r, y0, y1) {
  const a = canvas(), b = canvas();
  for (let y = y0; y < y1; y++) {
    const cv = y % 2 ? a : b, w = 2 + Math.round((y - y0) * 0.5) + ri(r, 0, 2);
    cv.rect(Math.round(226 - w / 2) + ri(r, -1, 1), y, w, 1, '#dfe8ff|0.45');
  }
  return `<g class="gl1">${a.svg()}</g><g class="gl2">${b.svg()}</g>`;
}

function grassTop(cv, r, w, cols, tip) {
  for (let x = 0; x < w; x++) if (r() < 0.75) {
    const h = ri(r, 1, 2);
    cv.rect(x, GY - h, 1, h, pick(r, cols));
    if (tip && r() < 0.3) cv.px(x, GY - h, tip);
  }
}

function pine(cv, x, base, th, col, snow) {
  for (let k = 0; k < th; k++) {
    const hw = Math.floor((k + 1) / 2.2), y = base - 2 - th + k;
    cv.rect(x - hw, y, hw * 2 + 1, 1, col);
    if (snow && k % 3 === 0) cv.rect(x - hw, y, hw + 1, 1, snow);
  }
  cv.rect(x, base - 2, 1, 2, '#1a120e');
}

// ---------- more scenes ----------
function lake(r, len) {
  const far = ridge(W(len, 0.04), 36, { r, minH: 8, maxH: 20, col: '#121a30' });
  const trees = ridge(W(len, 0.12), 39, { r, minH: 1, maxH: 4, col: '#0a1222', scale: 0.6, trees: 40, treeCol: '#070e1c' });
  const ww = W(len, 0.5), water = canvas(), s1 = canvas(), s2 = canvas();
  water.rect(0, 38, ww, VH - 38, '#0a1430'); water.rect(0, 38, ww, 2, '#060c1c'); water.rect(0, 40, ww, 3, '#0b1736');
  for (let i = 0; i < ww * 0.6; i++) (r() < 0.5 ? s1 : s2).rect(ri(r, 0, ww), ri(r, 41, GY + 6), ri(r, 2, 5), 1, '#3a5590|0.55');
  for (let x = ri(r, 0, 30); x < ww; x += ri(r, 25, 60)) {
    const y = ri(r, 44, GY - 1);
    water.rect(x, y, 5, 1, '#163a26'); water.rect(x + 1, y - 1, 3, 1, '#1d4a30');
    if (r() < 0.5) { water.px(x + 2, y - 2, '#e7a5c0'); water.px(x + 1, y - 2, '#c97a9e'); }
  }
  const w = W(len, 1), cv = canvas(), fg = canvas();
  const grass = ['#16251a', '#1b2d1f', '#22382a', '#0f1a12'];
  cv.rect(0, GY, w, VH - GY, '#111a14');
  grassTop(cv, r, w, grass, '#3a5560');
  for (let i = 0; i < w * 2; i++) cv.px(ri(r, 0, w), ri(r, GY, VH - 1), pick(r, grass));
  for (let i = 0; i < 14; i++) { const x = ri(r, 0, w), y = ri(r, GY + 3, VH - 3); cv.rect(x, y, 3, 2, '#2a2e38'); cv.rect(x, y, 3, 1, '#3e4352'); }
  // Cattails and reeds in the foreground.
  for (let x = ri(r, 10, 60); x < w; x += ri(r, 45, 100)) for (let k = 0; k < 4; k++) {
    const sx = x + k * 2 + ri(r, 0, 1), h = ri(r, 9, 16), base = GY + ri(r, 4, 8);
    fg.rect(sx, base - h, 1, h, pick(r, ['#132018', '#17261c', '#0f1a13']));
    if (r() < 0.6) fg.rect(sx, base - h + 1, 1, 3, '#3a281a');
  }
  return {
    kind: 'ground', css: GL_CSS + FF_CSS,
    layers: [[0.04, far], [0.12, trees], [0.5, water.svg() + `<g class="gl1">${s1.svg()}</g><g class="gl2">${s2.svg()}</g>`], [null, glitter(r, 40, GY)], [1, cv.svg()]],
    fg: [[1, fg.svg()]], fixedFg: `<g transform="scale(3)">${fireflies(r, 10, 36, GY + 4)}</g>`,
  };
}

function sakura(r, len) {
  const far = ridge(W(len, 0.05), 48, { r, minH: 6, maxH: 20, col: '#1a1430' });
  const tree = (cv, x, base, h, [dark, mid, light, trunk]) => {
    cv.rect(x, base - h, 2, h, trunk);
    cv.rect(x - 4, base - h + 4, 4, 1, trunk); cv.rect(x + 2, base - h + 2, 5, 1, trunk);
    const puffs = Array.from({ length: 7 }, () => [x + ri(r, -8, 9), base - h - ri(r, -2, 5), ri(r, 3, 5)]);
    for (const [px, py, pr] of puffs) cv.disc(px, py + 1, pr, dark);
    for (const [px, py, pr] of puffs) cv.disc(px, py, pr - 1, mid);
    for (const [px, py, pr] of puffs) if (pr > 3) cv.disc(px - 1, py - 1, pr - 3, light);
  };
  const mid = canvas(), mw = W(len, 0.25);
  mid.rect(0, 52, mw, VH - 52, '#120e1a');
  for (let x = ri(r, 0, 20); x < mw; x += ri(r, 26, 44)) tree(mid, x, 53, ri(r, 9, 14), ['#5a2742', '#7d3a5c', '#a04e76', '#140c12']);
  const near = canvas(), nw = W(len, 0.6);
  for (let x = ri(r, 20, 60); x < nw; x += ri(r, 80, 130)) tree(near, x, GY + 1, ri(r, 20, 28), ['#7a3456', '#a94d74', '#d97ba3', '#1c1018']);
  const w = W(len, 1), cv = canvas(), glow = canvas();
  cv.rect(0, GY, w, VH - GY, '#1b1822'); cv.rect(0, GY, w, 1, '#2e2a38');
  grassTop(cv, r, w, ['#141d18', '#18241c', '#101712']);
  for (let x = ri(r, 0, 10); x < w; x += ri(r, 12, 18)) { cv.rect(x, GY + 2, 8, 2, '#302c3a'); cv.rect(x, GY + 2, 8, 1, '#3e3a4a'); }
  for (let i = 0; i < w * 0.8; i++) cv.px(ri(r, 0, w), ri(r, GY, VH - 1), pick(r, ['#c97a9e', '#9e4f74', '#e9a3c0']));
  // Stone lanterns, glowing.
  for (let x = ri(r, 40, 90); x < w; x += ri(r, 110, 160)) {
    glow.disc(x + 3, GY - 9, 8, '#ffcf73|0.12');
    cv.rect(x, GY - 3, 7, 3, '#3a3644'); cv.rect(x + 3, GY - 7, 1, 4, '#3a3644');
    cv.rect(x + 1, GY - 11, 5, 4, '#2c2834'); cv.rect(x + 2, GY - 10, 3, 2, '#ffcf73');
    cv.rect(x - 1, GY - 12, 9, 1, '#4a4656'); cv.rect(x + 2, GY - 13, 3, 1, '#4a4656');
  }
  const p1 = fall('petA', r, 70, ['#e9a3c0', '#c97a9e', '#f6c1d6'], 16, -40);
  const p2 = fall('petB', r, 25, ['#f6c1d6', '#ffd6e6'], 9, -60);
  return {
    kind: 'ground', defs: p1.defs + p2.defs, css: p1.css + p2.css + LG_CSS,
    layers: [[0.05, far], [0.25, mid.svg()], [0.6, near.svg()], [1, `<g class="lg">${glow.svg()}</g>` + cv.svg()]],
    fg: [], fixedFg: p1.svg + p2.svg,
  };
}

function snowfield(r, len) {
  // Northern lights swaying across the sky.
  const au = canvas(), au2 = canvas(), ph = [r() * 6, r() * 6, r() * 6];
  for (let x = 0; x < VW; x++) {
    const y = 8 + 5 * Math.sin(x / 23 + ph[0]) + 3 * Math.sin(x / 9 + ph[1]), h = 7 + 5 * Math.sin(x / 17 + ph[2]);
    au.rect(x, y, 1, h, '#5cffb0|0.12');
    if (x % 3 === 0) au.rect(x, y - 3, 1, h + 6, '#5cffb0|0.06');
    au2.rect(x, y + h - 2, 1, 4, '#7dd3ff|0.1');
  }
  const far = canvas(), fw = W(len, 0.04), fph = [r() * 6, r() * 6];
  for (let x = 0; x < fw; x++) {
    const top = Math.round(48 - (14 + 9 * Math.sin(x / 21 + fph[0]) + 4 * Math.sin(x / 7 + fph[1])));
    far.rect(x, top, 1, VH - top, '#1a2240'); far.rect(x, top, 1, 3, x % 2 ? '#7d8db8' : '#6a7aa6');
  }
  const mid = canvas(), mw = W(len, 0.2);
  mid.rect(0, 52, mw, VH - 52, '#46557e');
  for (let x = ri(r, 0, 8); x < mw; x += ri(r, 6, 14)) pine(mid, x, 53, ri(r, 7, 13), '#0d1724', '#8a9ac4');
  const cab = canvas(), cw = W(len, 0.4);
  cab.rect(0, 54, cw, VH - 54, '#56658e'); cab.rect(0, 54, cw, 1, '#8090b8');
  let smoke = '';
  for (let x = ri(r, 60, 140); x < cw; x += ri(r, 160, 240)) {
    cab.rect(x, 44, 18, 10, '#2a1c18');
    for (let y = 46; y < 54; y += 2) cab.rect(x, y, 18, 1, '#22160f');
    for (let k = 0; k < 5; k++) cab.rect(x - 2 + k, 39 + k, 22 - 2 * k, 1, k < 2 ? '#c4d0ec' : '#a8b8d8');
    cab.rect(x + 13, 36, 2, 5, '#3a2a24');
    cab.disc(x + 5, 48, 4, '#ffcf73|0.15'); cab.rect(x + 3, 47, 4, 3, '#ffcf73'); cab.rect(x + 5, 47, 1, 3, '#7a4a20');
    cab.rect(x + 10, 48, 3, 6, '#160e0a');
    smoke += [0, 1.3, 2.6].map(d => `<rect class="sm" x="${x + 13}" y="34" width="2" height="2" fill="#9aa4c0" style="animation-delay:-${d}s"/>`).join('');
  }
  const w = W(len, 1), cv = canvas(), sp = canvas();
  cv.rect(0, GY, w, VH - GY, '#62719a'); cv.rect(0, GY, w, 1, '#a9b8da'); cv.rect(0, GY + 1, w, 1, '#8696c0');
  for (let i = 0; i < w * 1.5; i++) cv.px(ri(r, 0, w), ri(r, GY + 2, VH - 1), pick(r, ['#5a6890', '#6a79a2']));
  for (let i = 0; i < w * 0.4; i++) sp.px(ri(r, 0, w), ri(r, GY, VH - 1), '#eef3ff');
  const s1 = fall('snA', r, 110, ['#ffffff|0.7', '#dfe8ff|0.6'], 12, -14);
  const s2 = fall('snB', r, 40, ['#ffffff'], 7, -24);
  return {
    kind: 'ground', defs: s1.defs + s2.defs,
    css: s1.css + s2.css + '.au{animation:au 9s ease-in-out infinite alternate}.au2{animation:au 7s ease-in-out -3s infinite alternate}@keyframes au{from{opacity:.45;transform:translateX(-6px)}to{opacity:1;transform:translateX(6px)}}'
      + '.sm{animation:sm 3.9s ease-out infinite}@keyframes sm{0%{opacity:.7;transform:none}100%{opacity:0;transform:translate(5px,-14px)}}',
    layers: [[null, `<g class="au">${au.svg()}</g><g class="au2">${au2.svg()}</g>`], [0.04, far.svg()], [0.2, mid.svg()], [0.4, cab.svg() + smoke], [1, cv.svg() + `<g class="tw">${sp.svg()}</g>`]],
    fg: [], fixedFg: s1.svg + s2.svg,
  };
}

function seaside(r, len) {
  const head = canvas(), hw = W(len, 0.05);
  for (let x = 0; x < hw; x++) { const h = Math.max(0, Math.round(7 * Math.sin(x / 30 + 1) + 2)); if (h) head.rect(x, 41 - h, 1, h, '#0c1224'); }
  // Lighthouse on the headland, sweeping its beam left and right.
  const lx = ri(r, 150, 200), ly = 23;
  head.rect(lx - 2, 38, 7, 3, '#0c1224');
  for (let y = 24; y < 38; y++) head.rect(lx, y, 3, 1, Math.floor((y - 24) / 3) % 2 ? '#7a2f3a' : '#c8c8d4');
  head.rect(lx - 1, 21, 5, 1, '#2a2a34'); head.rect(lx, 22, 3, 2, '#fff2b0'); head.rect(lx, 20, 3, 1, '#2a2a34');
  const beam = d => `<path d="M${lx + 1.5} ${ly}L${lx + 1.5 + d * 120} ${ly - 9}L${lx + 1.5 + d * 120} ${ly + 7}z" fill="#fff2b0" opacity=".14"/>`;
  const sea = canvas(), sw = W(len, 0.2), w1 = canvas(), w2 = canvas();
  sea.rect(0, 41, sw, VH - 41, '#081530'); sea.rect(0, 41, sw, 1, '#1a2a50');
  for (let i = 0; i < sw * 0.8; i++) (r() < 0.5 ? w1 : w2).rect(ri(r, 0, sw), ri(r, 43, VH - 1), ri(r, 2, 6), 1, '#2a4a80|0.6');
  const boats = canvas(), bw = W(len, 0.3);
  for (let x = ri(r, 20, 80); x < bw; x += ri(r, 90, 150)) {
    const y = ri(r, 47, 51);
    boats.rect(x, y, 10, 2, '#140f14'); boats.rect(x + 1, y + 2, 8, 1, '#140f14');
    boats.rect(x + 4, y - 8, 1, 8, '#2a2630');
    for (let k = 0; k < 6; k++) boats.rect(x + 5, y - 7 + k, Math.ceil(k / 1.5), 1, '#3a3446');
    boats.px(x + 4, y - 9, '#ffcf73');
  }
  // The harbour wall she walks on, with lamp posts.
  const w = W(len, 1), cv = canvas(), glow = canvas();
  cv.rect(0, GY, w, 1, '#62667a'); cv.rect(0, GY + 1, w, 2, '#454959'); cv.rect(0, GY + 3, w, 1, '#15171e');
  cv.rect(0, GY + 4, w, VH - GY - 4, '#262a36');
  for (let y = GY + 8; y < VH; y += 5) cv.rect(0, y, w, 1, '#1c1f28');
  for (let y = GY + 4; y < VH; y += 5) for (let x = Math.floor(y / 5) % 2 ? 0 : 6; x < w; x += 12) cv.rect(x, y, 1, 4, '#1c1f28');
  for (let i = 0; i < w * 0.5; i++) cv.px(ri(r, 0, w), GY + ri(r, 4, 7), pick(r, ['#1f3a2a', '#2a4a34']));
  for (let x = ri(r, 50, 100); x < w; x += ri(r, 130, 190)) {
    glow.disc(x + 1, GY - 21, 9, '#ffd27a|0.1');
    cv.rect(x, GY - 20, 2, 20, '#2a2c36'); cv.rect(x - 1, GY - 23, 4, 3, '#ffe3a1'); cv.rect(x - 1, GY - 24, 4, 1, '#2a2c36');
    cv.rect(x + 14, GY - 3, 4, 3, '#2a2c36'); cv.rect(x + 14, GY - 3, 4, 1, '#3a3d4a');
  }
  return {
    kind: 'ledge',
    css: GL_CSS + LG_CSS + '.lhA{animation:lh 6s ease-in-out infinite}.lhB{animation:lh 6s ease-in-out -3s infinite}@keyframes lh{0%,60%,100%{opacity:0}30%{opacity:1}}'
      + '.bb{animation:bb 2.4s ease-in-out infinite alternate}@keyframes bb{to{transform:translateY(1px)}}',
    layers: [[0.05, head.svg() + `<g class="lhA">${beam(-1)}</g><g class="lhB">${beam(1)}</g>`],
      [0.2, sea.svg() + `<g class="gl1">${w1.svg()}</g><g class="gl2">${w2.svg()}</g>`], [null, glitter(r, 42, GY)],
      [0.3, `<g class="bb">${boats.svg()}</g>`], [1, `<g class="lg">${glow.svg()}</g>` + cv.svg()]],
    fg: [],
  };
}

function meadow(r, len) {
  const far = ridge(W(len, 0.04), 50, { r, minH: 12, maxH: 30, col: '#141a2e' });
  const mid = ridge(W(len, 0.12), 54, { r, minH: 4, maxH: 16, col: '#10172a', scale: 0.7, trees: 10, treeCol: '#0b1120' });
  const hills = ridge(W(len, 0.35), GY + 2, { r, minH: 2, maxH: 8, col: '#0c1418', scale: 1.4, trees: 14, treeCol: '#081013' });
  const w = W(len, 1), cv = canvas(), fg = canvas();
  const grass = ['#16251a', '#1b2d1f', '#22382a', '#0f1a12'];
  cv.rect(0, GY, w, VH - GY, '#132016');
  for (let x = 0; x < w; x++) if (r() < 0.75) { const h = ri(r, 1, 2); cv.rect(x, GY - h, 1, h, pick(r, grass)); if (r() < 0.3) cv.px(x, GY - h, '#3a5560'); }
  for (let i = 0; i < w * 3; i++) cv.px(ri(r, 0, w), ri(r, GY, VH - 1), pick(r, grass));
  for (let i = 0; i < 20; i++) cv.px(ri(r, 0, w), GY - ri(r, 1, 3), pick(r, ['#c9b8f0', '#e7a5c0', '#d8e0ff']));
  for (let i = 0; i < 24; i++) {
    const x = ri(r, 0, w), base = GY + ri(r, 5, 12);
    for (let k = 0; k < 5; k++) { const h = ri(r, 3, 7); fg.rect(x + k, base - h, 1, h, pick(r, ['#0b140d', '#101c12', '#0e1810'])); }
  }
  return {
    kind: 'ground', layers: [[0.04, far], [0.12, mid], [0.35, hills], [1, cv.svg()]], fg: [[1, fg.svg()]], fixedFg: `<g transform="scale(3)">${fireflies(r, 9, 30, GY + 6)}</g>`,
    css: FF_CSS,
  };
}

const SCENES = { rooftop, balcony, meadow, lake, sakura, snowfield, seaside };
// Ledges get a hanging tail when she lies down; ground gets a loaf.
const KIND = { rooftop: 'ledge', balcony: 'ledge', seaside: 'ledge', meadow: 'ground', lake: 'ground', sakura: 'ground', snowfield: 'ground' };

module.exports = { VW, VH, GY, SCENES, KIND, sky, rng, pick, ri };
