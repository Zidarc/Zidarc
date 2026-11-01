// Night-time pixel backdrops for Huna's walk: a shared sky, then scenes she walks through one after another
// (rooftop ledge, balcony railing, window ledge, meadow). Each scene is split into parallax layers.
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

function windowLedge(r, len) {
  const far = skyline(W(len, 0.1), 40, { r, minH: 8, maxH: 26, minW: 6, maxW: 13, cols: ['#121728', '#151b2e', '#0f1322'], lit: 0.2, haze: 0.15 });
  const w = W(len, 1), cv = canvas();
  const wall = '#262230', top = 12;
  cv.rect(0, top, w, VH - top, wall);
  cv.rect(0, top - 2, w, 2, '#3a3546'); cv.rect(0, top, w, 1, '#14121a');
  for (let i = 0; i < w * 1.5; i++) cv.px(ri(r, 0, w), ri(r, top + 1, VH - 1), '#2e2a3a|0.8');
  for (let x = ri(r, 4, 16); x < w; x += ri(r, 46, 62)) {
    litWindow(cv, x, top + 10, 22, GY - top - 12, r);
    cv.rect(x - 2, top + 8, 26, 1, '#3a3546');
    cv.rect(x - 4, GY + 1, 30, 14, '#ffb35c|0.05');
  }
  for (let x = ri(r, 10, 40); x < w; x += ri(r, 50, 70)) litWindow(cv, x, GY + 14, 16, 10, r);
  cv.rect(0, GY, w, 1, '#6a6478'); cv.rect(0, GY + 1, w, 2, '#4a4558'); cv.rect(0, GY + 3, w, 1, '#16141c');
  cv.rect(0, GY + 4, w, 1, '#000000|0.4');
  for (let x = ri(r, 60, 100); x < w; x += ri(r, 120, 180)) { cv.rect(x, GY + 4, 2, VH - GY - 4, '#3a3546'); cv.rect(x, GY + 4, 1, VH - GY - 4, '#4a4558'); }
  return { kind: 'ledge', layers: [[0.1, far], [1, cv.svg()]], fg: [] };
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
  // Fireflies drift and blink in front of everything.
  const ff = Array.from({ length: 9 }, (_, i) =>
    `<rect class="ff" x="${ri(r, 10, VW - 10)}" y="${ri(r, 30, GY + 6)}" width="1" height="1" fill="#e8ff8a" style="animation-delay:-${(i * 0.9).toFixed(1)}s;animation-duration:${(4 + r() * 4).toFixed(1)}s"/>`).join('');
  return {
    kind: 'ground', layers: [[0.04, far], [0.12, mid], [0.35, hills], [1, cv.svg()]], fg: [[1, fg.svg()]], fixedFg: `<g transform="scale(3)">${ff}</g>`,
    css: '.ff{animation:ff 6s ease-in-out infinite}@keyframes ff{0%,100%{opacity:0;transform:translate(0,0)}30%{opacity:1}50%{opacity:.2;transform:translate(5px,-4px)}70%{opacity:1;transform:translate(9px,1px)}}',
  };
}

const SCENES = { rooftop, balcony, windowLedge, meadow };

module.exports = { VW, VH, GY, SCENES, sky, rng, pick, ri };
