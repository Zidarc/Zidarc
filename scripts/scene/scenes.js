// Pixel-art backdrops for Huna's card: five scenes, four times of day, each split into parallax layers.
// Everything is drawn in 3px cells; a layer is wide enough for the camera to pan RANGE cells at its depth.
const VW = 280, VH = 80, RANGE = 150;

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

// ---------- colour ----------
const hex = c => [1, 3, 5].map(i => parseInt(c.slice(i, i + 2), 16));
const toHex = a => '#' + a.map(v => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, '0')).join('');
const mix = (a, b, t) => { const B = hex(b); return toHex(hex(a).map((v, i) => v + (B[i] - v) * t)); };
const mul = (a, k) => toHex(hex(a).map(v => v * k));

const TOD = {
  day: { k: 1, tint: '#fff2dc', t: 0.06 },
  dawn: { k: 0.78, tint: '#ff9e80', t: 0.2 },
  dusk: { k: 0.62, tint: '#ff7a50', t: 0.24 },
  night: { k: 0.3, tint: '#24346a', t: 0.42 },
};
const INDOOR = {
  day: { k: 0.95, tint: '#fff2dc', t: 0.05 },
  dawn: { k: 0.8, tint: '#ffb090', t: 0.12 },
  dusk: { k: 0.72, tint: '#ff9a60', t: 0.15 },
  night: { k: 0.5, tint: '#ffa850', t: 0.24 },
};
const lighter = (L, c) => L.k ? mix(mul(c, L.k), L.tint, L.t) : c;
const SKY = {
  day: ['#4f8fd0', '#6aa3da', '#86b6e2', '#a6cbe9', '#c8def0'],
  dawn: ['#34406e', '#5d5488', '#9c6f94', '#d9938e', '#f2c398'],
  dusk: ['#221f48', '#45306a', '#7c3f72', '#c4605f', '#ec9a5c'],
  night: ['#04060d', '#070b18', '#0b1124', '#101931', '#16223d'],
};
const OVERCAST = {
  day: ['#5d6875', '#6d7884', '#7f8994', '#929ba4', '#a5adb4'],
  dawn: ['#3f4352', '#525565', '#676877', '#7d7c88', '#93909a'],
  dusk: ['#2b2a38', '#3b3847', '#4d4756', '#615866', '#756a76'],
  night: ['#07090d', '#0a0d13', '#0d1119', '#11161f', '#151b26'],
};
// Rim light on the cat, matched to the sky.
const RIM = { day: '#5b6077', dawn: '#6b5b7a', dusk: '#7a5658', night: '#3c4868' };
const WINDOW_LIGHTS = ['#ffd27a', '#ffe6a6', '#f3b65a', '#fff2cf'];

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
const layerW = f => VW + Math.ceil(RANGE * f) + 2;

// Sky bands with two dithered rows between them, plus sun or moon, stars and drifting clouds.
function sky(tod, r, { overcast = false } = {}) {
  const bands = (overcast ? OVERCAST : SKY)[tod];
  const cv = canvas();
  let defs = '';
  const H = [14, 14, 16, 18, 18];
  let y = 0;
  bands.forEach((c, i) => {
    cv.rect(0, y, VW, H[i], c);
    if (i) {
      defs += `<pattern id="dz${i}" width="2" height="2" patternUnits="userSpaceOnUse"><rect width="2" height="2" fill="${bands[i - 1]}"/><rect width="1" height="1" fill="${c}"/><rect x="1" y="1" width="1" height="1" fill="${c}"/></pattern>`;
      cv.rect(0, y - 2, VW, 2, `url(#dz${i})`);
    }
    y += H[i];
  });
  let stars = '', css = '';
  if (!overcast && tod !== 'day') {
    const n = tod === 'night' ? 70 : 14;
    for (let i = 0; i < n; i++) cv.px(ri(r, 0, VW - 1), ri(r, 0, tod === 'night' ? 46 : 16), `#ffffff|${(0.25 + r() * 0.6).toFixed(2)}`);
    const tw = canvas();
    for (let i = 0; i < 10; i++) tw.px(ri(r, 0, VW - 1), ri(r, 0, 30), '#fff6e0');
    stars = `<g class="tw">${tw.svg()}</g>`;
    css += '.tw{animation:tw 3.3s ease-in-out infinite}@keyframes tw{50%{opacity:.15}}';
  }
  if (!overcast) {
    if (tod === 'day') { cv.disc(226, 13, 8, '#fff7d6|0.18'); cv.disc(226, 13, 5, '#fff9e2'); }
    if (tod === 'dawn') { cv.disc(54, 50, 11, '#ffd0a0|0.2'); cv.disc(54, 50, 7, '#ffd9a8'); }
    if (tod === 'dusk') { cv.disc(212, 52, 12, '#ffb070|0.2'); cv.disc(212, 52, 8, '#ffbe78'); }
    if (tod === 'night') { cv.disc(222, 14, 9, '#dfe8ff|0.08'); cv.disc(222, 14, 5, '#e8eef8'); cv.disc(224, 12, 4, mix(bands[0], '#dfe8ff', 0.08)); }
  }
  // Clouds tile across one viewport width and loop slowly.
  const cl = canvas(), L = TOD[tod];
  const top = lighter(L, overcast ? '#c3c8cf' : '#ffffff'), under = lighter(L, overcast ? '#8d939b' : '#d6dbe6');
  const nC = overcast ? 9 : tod === 'night' ? 3 : 5;
  for (let i = 0; i < nC; i++) {
    const cx = ri(r, 0, VW - 1), cy = ri(r, 6, 30), w = ri(r, 14, 30);
    const puffs = Array.from({ length: Math.ceil(w / 6) }, (_, k) => [cx - w / 2 + k * 6 + 3, cy - ri(r, 0, 3), ri(r, 3, 5)]);
    for (let yy = cy - 8; yy <= cy + 2; yy++) for (let xx = cx - w / 2 - 6; xx < cx + w / 2 + 6; xx++) {
      if (yy > cy + 1 || !puffs.some(([px, py, pr]) => (xx - px) ** 2 + ((yy - py) * 1.3) ** 2 <= pr * pr)) continue;
      const wx = ((xx % VW) + VW) % VW;
      cl.px(wx, yy, `${yy >= cy ? under : top}|${overcast ? 0.8 : 0.85}`);
    }
  }
  defs += `<g id="clouds">${cl.svg()}</g>`;
  css += `.clouds{animation:clouds ${overcast ? 140 : 260}s linear infinite}@keyframes clouds{to{transform:translateX(-${VW * 3}px)}}`;
  const svg = `<g transform="scale(3)">${cv.svg()}</g>${stars ? `<g transform="scale(3)">${stars}</g>` : ''}
<g class="clouds"><g transform="scale(3)"><use href="#clouds"/><use href="#clouds" x="${VW}"/></g></g>`;
  return { defs, svg, css, horizon: bands[4] };
}

function skyline(w, base, o) {
  const { r, tod, minH, maxH, minW, maxW, cols, haze, horizon, tanks } = o;
  const cv = canvas(), L = TOD[tod];
  const fade = c => mix(lighter(L, c), horizon, haze);
  const litP = { day: 0, dawn: 0.08, dusk: 0.2, night: 0.38 }[tod];
  let x = -2;
  while (x < w) {
    const bw = ri(r, minW, maxW), bh = ri(r, minH, maxH), top = base - bh, c = pick(r, cols);
    cv.rect(x, top, bw, VH - top, fade(c));
    cv.rect(x, top, 1, VH - top, fade(mix(c, '#ffffff', 0.14)));
    cv.rect(x, top, bw, 1, fade(mix(c, '#ffffff', 0.2)));
    if (tanks && r() < 0.55) {
      const tw = ri(r, 3, 4), tx = x + ri(r, 1, Math.max(1, bw - tw - 1));
      cv.rect(tx, top - 3, tw, 3, fade('#24252b')); cv.rect(tx, top - 3, tw, 1, fade('#3b3d45'));
    }
    if (r() < 0.25) { const ah = ri(r, 4, 9); cv.rect(x + ri(r, 1, bw - 2), top - ah, 1, ah, fade('#30323a')); }
    const sx = bw > 9 ? 3 : 2;
    for (let wy = top + 2; wy < Math.min(base, VH); wy += 3)
      for (let wx = x + 2; wx < x + bw - 1; wx += sx)
        cv.px(wx, wy, r() < litP ? pick(r, WINDOW_LIGHTS) : fade(mix(c, '#0b1018', 0.45)));
    x += bw + ri(r, 0, 2);
  }
  return cv.svg();
}

function ridge(w, base, o) {
  const { r, tod, minH, maxH, col, snow, haze, horizon, trees } = o;
  const cv = canvas(), L = TOD[tod];
  const fade = c => mix(lighter(L, c), horizon, haze);
  const ph = [r() * 6.3, r() * 6.3, r() * 6.3], s = o.scale || 1;
  const h = x => minH + (maxH - minH) * (0.5 + 0.3 * Math.sin(x / (23 * s) + ph[0]) + 0.14 * Math.sin(x / (9.7 * s) + ph[1]) + 0.06 * Math.sin(x / (4.1 * s) + ph[2]));
  const lit = fade(mix(col, '#ffffff', 0.12)), shade = fade(mul(col, 0.8));
  for (let x = 0; x < w; x++) {
    const top = Math.round(base - h(x));
    cv.rect(x, top, 1, VH - top, h(x + 1) > h(x - 1) ? lit : shade);
    if (snow && top < base - snow) cv.rect(x, top, 1, Math.min(base - snow - top, 2 + ((x * 7) % 3)), fade(h(x + 1) > h(x - 1) ? '#f4f6fa' : '#c9d2e0'));
    if (r() < 0.12) cv.px(x, top + ri(r, 2, 8), fade(mul(col, 0.7)));
  }
  for (let i = 0; trees && i < trees; i++) {
    const tx = ri(r, 0, w - 1), ty = Math.round(base - h(tx)) + 1, th = ri(r, 6, 11);
    const dark = fade('#1f3b26'), lite = fade('#2f5535');
    cv.rect(tx, ty - 2, 1, 2, fade('#3a2a1e'));
    for (let k = 0; k < th; k++) {
      const hw = Math.floor((k + 1) / 2.4);
      cv.rect(tx - hw, ty - 2 - th + k, hw + 1, 1, lite);
      cv.rect(tx + 1, ty - 2 - th + k, hw, 1, dark);
    }
  }
  return cv.svg();
}

function pots(cv, xs, gy, Li, r) {
  for (const x of xs) {
    const pot = Li('#a85a36'), potD = Li('#80412a');
    cv.rect(x, gy - 6, 8, 6, pot); cv.rect(x - 1, gy - 7, 10, 2, Li('#bd6c45')); cv.rect(x + 5, gy - 5, 3, 5, potD);
    const leaf = [Li('#3f7a3c'), Li('#2f5f2f'), Li('#56924a')];
    for (let i = 0; i < 14; i++) {
      const lx = x + 4 + Math.round((r() - 0.5) * 11), ly = gy - 8 - ri(r, 0, 9);
      cv.rect(lx, ly, ri(r, 1, 3), 2, pick(r, leaf));
    }
  }
}

// ---------- scenes ----------
function windowSill(tod, r, rain) {
  const GY = 62, S = sky(tod, r, { overcast: rain });
  const far = skyline(layerW(0.06), 60, { r, tod, minH: 10, maxH: 26, minW: 6, maxW: 14, cols: ['#5a6578', '#636a7c', '#525c6e'], haze: rain ? 0.6 : 0.45, horizon: S.horizon });
  const mid = skyline(layerW(0.15), 64, { r, tod, minH: 18, maxH: 40, minW: 10, maxW: 22, cols: ['#4a4f5c', '#575a63', '#3f4553', '#6a5f58'], haze: rain ? 0.4 : 0.2, horizon: S.horizon, tanks: true });
  const I = INDOOR[tod], Li = c => lighter(I, c);
  const w = layerW(1), cv = canvas();
  const wall = Li('#b8a48c'), wallD = Li('#9d8a73'), frame = Li('#e6e0d6'), frameD = Li('#b7ae9f');
  for (let x0 = -40; x0 < w; x0 += 120) {
    const wx = x0 + 34, ww = 86;
    cv.rect(x0, 0, 34, GY, wall); cv.rect(wx, 0, ww, 6, wall);
    cv.rect(wx - 3, 4, ww + 6, 3, frame); cv.rect(wx - 3, 7, 3, GY - 7, frame); cv.rect(wx + ww, 7, 3, GY - 7, frame);
    cv.rect(wx, 7, ww, 1, frameD); cv.rect(wx, 7, 1, GY - 7, frameD);
    cv.rect(wx + ww / 2 - 1, 7, 2, GY - 7, frame); cv.rect(wx + ww / 2 + 1, 7, 1, GY - 7, frameD);
    cv.rect(wx, 30, ww, 2, frame); cv.rect(wx, 32, ww, 1, frameD);
    cv.rect(wx + 1, 8, ww - 1, GY - 8, '#bcd4e6|0.08');
    for (let k = 0; k < 2; k++) {
      const sx = wx + 10 + k * 40 + ri(r, 0, 8);
      for (let yy = 9; yy < GY - 2; yy++) cv.rect(sx + Math.floor((GY - yy) / 2), yy, 3 + k, 1, '#ffffff|0.06');
    }
    if (rain) for (let k = 0; k < 40; k++) cv.px(wx + ri(r, 1, ww - 2), ri(r, 8, GY - 2), '#d8e6f2|0.45');
    // Curtains with folds, gathered on a rod.
    const cur = [Li('#8a3e52'), Li('#6e2f40'), Li('#a24f63')];
    cv.rect(wx - 10, 2, ww + 20, 1, Li('#3a2a22'));
    for (const [cx, cw] of [[wx - 8, 13], [wx + ww - 5, 13]])
      for (let k = 0; k < cw; k++) cv.rect(cx + k, 3, 1, GY - 4, cur[k % 4 === 0 ? 1 : k % 4 === 2 ? 2 : 0]);
  }
  for (let i = 0; i < w * 0.6; i++) cv.px(ri(r, 0, w), ri(r, 0, GY - 1), `${wallD}|0.3`);
  cv.rect(0, GY, w, 1, Li('#f6f1e8')); cv.rect(0, GY + 1, w, 2, Li('#e3dbcf'));
  cv.rect(0, GY + 3, w, 3, Li('#c6bcae')); cv.rect(0, GY + 6, w, 1, '#000000|0.35');
  cv.rect(0, GY + 7, w, VH - GY - 7, mul(wall, 0.82));
  pots(cv, [ri(r, 20, 60), ri(r, 300, 360)], GY, Li, r);
  const book = [Li('#2f4a6b'), Li('#7a2f2f'), Li('#c9a24a')];
  const bx = ri(r, 380, 410);
  book.forEach((c, i) => cv.rect(bx + i, GY - 3 * (i + 1), 12 - i * 2, 3, c));
  let rainL = null;
  if (rain) {
    const rc = canvas();
    for (let i = 0; i < 160; i++) rc.rect(ri(r, 0, VW), ri(r, 0, VH), 1, ri(r, 2, 4), '#b9cde0|0.35');
    rainL = `<defs><g id="rain">${rc.svg()}</g></defs><g class="rain"><g transform="scale(3)"><use href="#rain"/><use href="#rain" y="-${VH}"/></g></g>`;
  }
  return {
    GY, defs: S.defs, back: S.svg, css: S.css + (rain ? `.rain{animation:rain .6s linear infinite}@keyframes rain{to{transform:translateY(${VH * 3}px)}}` : ''),
    layers: [[0.06, far], [0.15, mid], ...(rainL ? [[0, rainL, true]] : []), [1, cv.svg()]], fg: [],
  };
}

function balcony(tod, r) {
  const GY = 66, S = sky(tod, r), L = TOD[tod], Lc = c => lighter(L, c);
  const far = skyline(layerW(0.08), 50, { r, tod, minH: 8, maxH: 22, minW: 6, maxW: 13, cols: ['#5a6578', '#636a7c', '#525c6e'], haze: 0.45, horizon: S.horizon });
  const mid = skyline(layerW(0.25), 52, { r, tod, minH: 14, maxH: 34, minW: 12, maxW: 24, cols: ['#c9b9a0', '#b8a68c', '#9c9a94', '#d2c6b2'], haze: 0.12, horizon: S.horizon, tanks: true });
  const w = layerW(1), cv = canvas();
  const conc = Lc('#a69d91'), concL = Lc('#c9c1b5'), concD = Lc('#8a8277'), metal = Lc('#2d3038'), metalL = Lc('#4a4e5a');
  cv.rect(0, 33, w, 2, metalL); cv.rect(0, 35, w, 1, metal);
  for (let x = 0; x < w; x += 4) cv.rect(x, 35, 1, 13, metal);
  cv.rect(0, 47, w, 2, concL); cv.rect(0, 49, w, GY - 49, conc);
  for (let i = 0; i < w * 1.5; i++) cv.px(ri(r, 0, w), ri(r, 49, GY - 1), `${concD}|0.6`);
  for (let x = ri(r, 0, 30); x < w; x += ri(r, 50, 90)) cv.rect(x, 49, 1, GY - 49, concD);
  const tile = Lc('#b9ae9f'), tileL = Lc('#cfc5b6'), grout = Lc('#8d8478');
  cv.rect(0, GY, w, VH - GY, tile); cv.rect(0, GY, w, 1, tileL);
  for (let y = GY + 5; y < VH; y += 6) cv.rect(0, y, w, 1, grout);
  for (let y = GY; y < VH; y += 6) for (let x = (y / 6) % 2 ? 0 : 7; x < w; x += 14) cv.rect(x, y + 1, 1, 5, grout);
  cv.rect(0, GY, w, 2, '#000000|0.18');
  pots(cv, [ri(r, 10, 40), ri(r, 200, 240), ri(r, 380, 420)], GY, Lc, r);
  return { GY, defs: S.defs, back: S.svg, css: S.css, layers: [[0.08, far], [0.25, mid], [1, cv.svg()]], fg: [] };
}

function meadow(tod, r) {
  const GY = 68, S = sky(tod, r), L = TOD[tod], Lc = c => lighter(L, c);
  const far = ridge(layerW(0.04), 54, { r, tod, minH: 12, maxH: 32, col: '#6f7d94', snow: 22, haze: 0.45, horizon: S.horizon });
  const mid = ridge(layerW(0.1), 60, { r, tod, minH: 6, maxH: 20, col: '#4f6a5a', haze: 0.25, horizon: S.horizon, scale: 0.7 });
  const hills = ridge(layerW(0.3), 68, { r, tod, minH: 2, maxH: 9, col: '#4c7a3e', haze: 0.05, horizon: S.horizon, scale: 1.4, trees: 14 });
  const w = layerW(1), cv = canvas(), fg = canvas();
  const grass = [Lc('#5d8f3e'), Lc('#4f7d35'), Lc('#6ea24a'), Lc('#41692c')];
  cv.rect(0, GY, w, VH - GY, Lc('#557f38'));
  for (let x = 0; x < w; x++) if (r() < 0.7) { const h = ri(r, 1, 2); cv.rect(x, GY - h, 1, h, pick(r, grass)); }
  for (let i = 0; i < w * 4; i++) cv.px(ri(r, 0, w), ri(r, GY, VH - 1), pick(r, grass));
  for (let i = 0; i < 10; i++) { const x = ri(r, 0, w), y = ri(r, GY + 3, VH - 3); cv.rect(x, y, 3, 2, Lc('#8b8a84')); cv.rect(x, y, 3, 1, Lc('#a9a8a1')); }
  for (let i = 0; i < 30; i++) cv.px(ri(r, 0, w), GY - ri(r, 1, 3), Lc(pick(r, ['#f4e9b0', '#e7a5c0', '#ffffff', '#c7b8f0'])));
  for (let i = 0; i < 26; i++) {
    const x = ri(r, 0, w), base = GY + ri(r, 4, 9);
    for (let k = 0; k < 5; k++) { const h = ri(r, 3, 7); fg.rect(x + k, base - h, 1, h, Lc(pick(r, ['#3d6a2a', '#4f8034', '#2f5520']))); }
  }
  return { GY, defs: S.defs, back: S.svg, css: S.css, layers: [[0.04, far], [0.1, mid], [0.3, hills], [1, cv.svg()]], fg: [[1, fg.svg()]] };
}

function rooftop(tod, r) {
  const GY = 58, S = sky(tod, r), L = TOD[tod], Lc = c => lighter(L, c);
  const far = skyline(layerW(0.08), 56, { r, tod, minH: 10, maxH: 30, minW: 6, maxW: 14, cols: ['#3e4656', '#47505f', '#383f4d'], haze: 0.35, horizon: S.horizon });
  const mid = canvas(), mw = layerW(0.3);
  const roof = Lc('#59544e'), roofL = Lc('#6d675f');
  for (let x = -4; x < mw;) {
    const bw = ri(r, 24, 50), top = ri(r, 54, 64);
    mid.rect(x, top, bw, VH - top, roof); mid.rect(x, top, bw, 1, roofL);
    if (r() < 0.8) {
      const tx = x + ri(r, 3, bw - 10), th = ri(r, 5, 7);
      mid.rect(tx, top - th, 7, th, Lc('#1d1e22')); mid.rect(tx, top - th, 7, 1, Lc('#3a3c44')); mid.rect(tx + 1, top - th + 1, 1, th - 1, Lc('#2c2d33'));
      mid.rect(tx + 1, top - 1, 1, 1, Lc('#555')); mid.rect(tx + 5, top - 1, 1, 1, Lc('#555'));
    }
    if (r() < 0.5) { const ax = x + ri(r, 2, bw - 3), ah = ri(r, 10, 18); mid.rect(ax, top - ah, 1, ah, Lc('#3a3d45')); mid.rect(ax - 3, top - ah + 2, 7, 1, Lc('#3a3d45')); mid.rect(ax - 2, top - ah + 5, 5, 1, Lc('#3a3d45')); }
    if (r() < 0.3) { const dx = x + ri(r, 4, bw - 6); mid.disc(dx, top - 4, 3, Lc('#8c8f96')); mid.rect(dx, top - 2, 1, 2, Lc('#555')); }
    if (tod !== 'day' && r() < 0.4) for (let k = 0; k < bw; k += 3) mid.px(x + k, top - 6 + Math.round(2 * Math.sin(k / 5)), pick(r, ['#ffd27a', '#ff9e6e', '#fff2cf']));
    x += bw + ri(r, 2, 8);
  }
  const w = layerW(1), cv = canvas();
  const c = Lc('#8f8980'), cL = Lc('#aaa399'), cD = Lc('#6f6a62');
  cv.rect(0, GY, w, 1, cL); cv.rect(0, GY + 1, w, 2, c); cv.rect(0, GY + 3, w, 1, cD);
  cv.rect(0, GY + 4, w, VH - GY - 4, Lc('#7a746b'));
  for (let i = 0; i < w * 2; i++) cv.px(ri(r, 0, w), ri(r, GY + 4, VH - 1), `${cD}|0.7`);
  for (let x = ri(r, 0, 40); x < w; x += ri(r, 60, 110)) { cv.rect(x, GY + 4, 1, VH - GY - 4, cD); cv.rect(x + 1, GY + 4, 1, VH - GY - 4, '#000000|0.15'); }
  for (let x = ri(r, 20, 60); x < w; x += ri(r, 90, 140)) { cv.rect(x, GY + 6, 3, VH - GY - 6, Lc('#4a4d52')); cv.rect(x, GY + 6, 1, VH - GY - 6, Lc('#5d6066')); }
  return { GY, defs: S.defs, back: S.svg, css: S.css, layers: [[0.08, far], [0.3, mid.svg()], [1, cv.svg()]], fg: [] };
}

const SCENES = { sill: (t, r) => windowSill(t, r, false), rainy: (t, r) => windowSill(t, r, true), balcony, meadow, rooftop };

// Rooftop only after dark; everything else any time.
function pickScene(tod, r) {
  const names = Object.keys(SCENES).filter(n => n !== 'rooftop' || tod === 'night' || tod === 'dusk');
  return pick(r, names);
}

function todOf(now) {
  const h = (now.getUTCHours() + 5) % 24;
  return h >= 5 && h < 7 ? 'dawn' : h >= 7 && h < 17 ? 'day' : h >= 17 && h < 19 ? 'dusk' : 'night';
}

module.exports = { VW, VH, RANGE, SCENES, RIM, rng, pick, ri, pickScene, todOf, mix };
