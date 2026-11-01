// Huna as a pixel black cat built from simple rounded shapes (ellipses, capsules, ears) and shaded per cell,
// so poses can be blended into smooth in-between frames. Units are cells; x points where the cat faces, y is up from the ground.
const OX = 34, ROWS = 36, COLS = 64;

const lerp = (a, b, t) => a + (b - a) * t;
// Blend two poses: numbers and arrays interpolate, anything else switches halfway.
function blend(a, b, t) {
  if (typeof a === 'number') return lerp(a, b, t);
  if (Array.isArray(a)) return a.map((v, i) => blend(v, b[i], t));
  if (a && typeof a === 'object') return Object.fromEntries(Object.keys(a).map(k => [k, blend(a[k], b[k], t)]));
  return t < 0.5 ? a : b;
}

// ---------- shapes: (x, y) -> surface normal, or null when outside ----------
function ellipse(cx, cy, rx, ry, rot = 0) {
  const c = Math.cos(rot), s = Math.sin(rot);
  return (x, y) => {
    const dx = x - cx, dy = y - cy;
    const u = (dx * c + dy * s) / rx, v = (-dx * s + dy * c) / ry;
    return u * u + v * v > 1 ? null : [u * c - v * s, u * s + v * c];
  };
}
function capsule(ax, ay, bx, by, r0, r1) {
  const vx = bx - ax, vy = by - ay, len2 = vx * vx + vy * vy || 1;
  return (x, y) => {
    const t = Math.max(0, Math.min(1, ((x - ax) * vx + (y - ay) * vy) / len2));
    const r = lerp(r0, r1, t), dx = x - ax - vx * t, dy = y - ay - vy * t;
    return Math.hypot(dx, dy) > r ? null : [dx / r, dy / r];
  };
}
function tri(p, q, w, n = [0.2, 0.2]) {
  const side = (a, b, x, y) => (x - b[0]) * (a[1] - b[1]) - (a[0] - b[0]) * (y - b[1]);
  return (x, y) => {
    const d1 = side(p, q, x, y), d2 = side(q, w, x, y), d3 = side(w, p, x, y);
    return (d1 < 0 || d2 < 0 || d3 < 0) && (d1 > 0 || d2 > 0 || d3 > 0) ? null : n;
  };
}

// Key light from the upper left and slightly toward the viewer.
const LIGHT = (() => { const v = [-0.35, 0.8, 0.5], m = Math.hypot(...v); return v.map(x => x / m); })();
function tone(n, far) {
  const z = Math.sqrt(Math.max(0, 1 - n[0] * n[0] - n[1] * n[1]));
  let l = n[0] * LIGHT[0] + n[1] * LIGHT[1] + z * LIGHT[2];
  if (far) l = l * 0.6 - 0.15;
  return l > 0.62 ? 3 : l > 0.3 ? 2 : l > 0 ? 1 : 0;
}

// ---------- raster ----------
function raster() {
  const g = Array.from({ length: ROWS }, () => Array(COLS).fill(null));
  const at = (x, y) => [ROWS - 1 - Math.floor(y), Math.floor(x) + OX];
  const R = {
    g,
    shape(fn, far = false) {
      const hit = new Map();
      for (let r = 0; r < ROWS; r++) for (let c = 0; c < COLS; c++) {
        const n = fn(c - OX + 0.5, ROWS - 1 - r + 0.5);
        if (n) hit.set(r * COLS + c, n);
      }
      for (const [k, n] of hit) {
        const r = Math.floor(k / COLS), c = k % COLS;
        let t = tone(n, far);
        // Where a part overlaps one drawn earlier, its shadowed edge becomes a contour line.
        const edge = !hit.has(k - COLS) || !hit.has(k + COLS) || !hit.has(k - 1) || !hit.has(k + 1);
        if (edge && g[r][c] != null && t < 2) t = 0;
        g[r][c] = String(t);
      }
    },
    dot(x, y, ch) {
      const [r, c] = at(x, y);
      if (r >= 0 && r < ROWS && c >= 0 && c < COLS) g[r][c] = ch;
    },
    // Thin highlight along the top of the silhouette so a black cat still reads on a dark background.
    rim() {
      for (let r = 1; r < ROWS; r++) for (let c = 1; c < COLS; c++) {
        if (!'0123'.includes(g[r][c] ?? 'x')) continue;
        if (g[r - 1][c] == null || (g[r][c - 1] == null && g[r - 1][c - 1] == null)) g[r][c] = '4';
      }
    },
  };
  return R;
}

// ---------- body parts ----------
function ik(ax, ay, bx, by, l1, l2, bend) {
  const d = Math.max(Math.abs(l1 - l2) + 1e-3, Math.min(Math.hypot(bx - ax, by - ay), l1 + l2 - 1e-3));
  const a = Math.atan2(by - ay, bx - ax), al = Math.acos((l1 * l1 + d * d - l2 * l2) / (2 * l1 * d));
  return [ax + l1 * Math.cos(a + bend * al), ay + l1 * Math.sin(a + bend * al)];
}
function frontLeg(R, [sx, sy, fx, fy], far) {
  const [kx, ky] = ik(sx, sy, fx, fy + 0.9, 5, 6.2, -1);
  R.shape(capsule(sx, sy, kx, ky, 2.2, 1.6), far);
  R.shape(capsule(kx, ky, fx, fy + 0.9, 1.5, 1.25), far);
  R.shape(ellipse(fx + 0.5, fy + 0.9, 1.7, 1.0), far);
}
function hindLeg(R, [hx, hy, kx2, ky2, px, py], far) {
  const [kx, ky] = ik(hx, hy, kx2, ky2, 5.5, 5.2, 1);
  R.shape(capsule(hx, hy, kx, ky, 2.8, 2.0), far);
  R.shape(capsule(kx, ky, kx2, ky2, 1.7, 1.3), far);
  R.shape(capsule(kx2, ky2, px, py + 0.9, 1.3, 1.2), far);
  R.shape(ellipse(px + 0.5, py + 0.9, 1.8, 1.0), far);
}
function tail(R, p, [r0, r1]) {
  const pt = t => {
    const u = 1 - t;
    return [0, 1].map(i => u * u * u * p[i] + 3 * u * u * t * p[2 + i] + 3 * u * t * t * p[4 + i] + t * t * t * p[6 + i]);
  };
  const N = 14;
  for (let i = 0; i < N; i++) {
    const [ax, ay] = pt(i / N), [bx, by] = pt((i + 1) / N);
    R.shape(capsule(ax, ay, bx, by, lerp(r0, r1, i / N), lerp(r0, r1, (i + 1) / N)));
  }
}

// mode: profile | front | groom (profile, eyes shut) | sleep | yawn (front, mouth open)
function head(R, [hx, hy], mode) {
  if (mode === 'front' || mode === 'yawn') {
    hx = Math.floor(hx) + 0.5;
    R.shape(tri([hx - 5.4, hy + 1.8], [hx - 1.2, hy + 3.9], [hx - 4.8, hy + 8.4]));
    R.shape(tri([hx + 5.4, hy + 1.8], [hx + 1.2, hy + 3.9], [hx + 4.8, hy + 8.4]));
    R.shape(ellipse(hx, hy, 5.4, 4.6));
    R.shape(ellipse(hx, hy - 1.6, 6.1, 3.1));
    R.shape(ellipse(hx, hy - 2.2, 2.7, 1.9));
    return;
  }
  R.shape(tri([hx + 0.6, hy + 2.6], [hx + 3.6, hy + 3.0], [hx + 2.6, hy + 7.4]), true);
  R.shape(ellipse(hx, hy, 5.0, 4.3));
  R.shape(ellipse(hx + 1.4, hy - 1.5, 4.2, 3.0));
  R.shape(ellipse(hx + 4.2, hy - 1.3, 2.1, 1.7));
  R.shape(tri([hx - 2.9, hy + 2.6], [hx + 0.9, hy + 3.6], [hx - 1.6, hy + 7.8]));
}

// Eyes, ears, nose. Returns whisker strokes in cell units.
function face(R, [hx, hy], mode, shut) {
  if (mode === 'front' || mode === 'yawn') {
    hx = Math.floor(hx) + 0.5;
    for (const s of [-1, 1]) {
      for (const [dx, dy] of [[4.2, 5.2], [4.0, 4.2], [3.2, 4.2]]) R.dot(hx + s * dx - (s > 0 ? 1 : 0) + 0.5, hy + dy, 'i');
      const ex = s < 0 ? hx - 3.5 : hx + 1.5;
      if (shut || mode === 'yawn') for (let i = 0; i < 3; i++) R.dot(ex + i, hy + 0.4 + (i === 1 ? -0.4 : 0), 'k');
      else for (let i = 0; i < 3; i++) { R.dot(ex + i, hy + 1.2, 'e'); R.dot(ex + i, hy + 0.2, i === 1 ? 'p' : 'E'); }
    }
    R.dot(hx - 0.5, hy - 1.4, 'n'); R.dot(hx + 0.5, hy - 1.4, 'n');
    if (mode === 'yawn') for (let x = -1; x <= 2; x++) for (let y = 0; y < 3; y++) R.dot(hx - 1.5 + x, hy - 2.6 - y, x === -1 || x === 2 || y === 2 ? '0' : 'm');
    return [-1, 1].flatMap(s => [[0.3, 0.6], [-0.4, 0], [-1.2, -0.7]].map(([d0, d1]) =>
      [hx + s * 2.6, hy - 1.9 + d0 * 0.3, hx + s * 10, hy - 1.9 + d1 + d0]));
  }
  for (const [dx, dy] of [[-1.6, 5.6], [-1.4, 4.6], [-0.5, 4.6]]) R.dot(hx + dx, hy + dy, 'i');
  const ex = hx + 1.6, ey = hy + 0.2;
  if (shut || mode !== 'profile') { R.dot(ex, ey, 'k'); R.dot(ex + 1, ey, 'k'); R.dot(ex + 2, ey + 0.6, 'k'); }
  else { R.dot(ex + 1, ey + 1, 'e'); R.dot(ex + 2, ey + 1, 'e'); R.dot(ex, ey, 'E'); R.dot(ex + 1, ey, 'p'); R.dot(ex + 2, ey, 'E'); }
  R.dot(hx + 5.8, hy - 0.9, 'n');
  return [[0.5, 0.9], [0.1, -0.4], [-0.4, -1.8]].map(([a, b]) => [hx + 4.6, hy - 1.6 + a, hx + 11, hy - 1.6 + b]);
}

// ---------- poses ----------
// haunch/torso/chest: [x, y, rx, ry, rot]; neck: [x0, y0, x1, y1, r0, r1]; legs: shoulder→paw, hip→hock→paw.
const STAND = {
  haunch: [-9, 13.2, 6, 6.2, 0], torso: [-0.5, 13.6, 11, 5.0, 0.03], chest: [8, 12.8, 5.4, 5.8, 0],
  neck: [10.5, 15.5, 13.5, 20, 3.8, 3.0], head: [15.5, 21.5], mode: 'profile',
  fN: [9, 10.5, 9.5, 0], fF: [8, 10.5, 7.5, 0],
  hN: [-9, 11, -10, 3.8, -8.6, 0], hF: [-10, 11, -11, 3.8, -9.6, 0],
  tail: [-14, 15, -21, 14, -24, 21, -21, 26], tailR: [1.9, 1.2], tailFront: false,
};
const SIT = {
  haunch: [-6, 6.6, 7.4, 6.6, 0], torso: [-1.5, 11, 5.6, 9, -0.35], chest: [3.2, 12.5, 4.8, 6.5, -0.2],
  neck: [4, 16.5, 5.5, 20.5, 3.7, 3.1], head: [6.5, 23.5], mode: 'profile',
  fN: [4.5, 11.2, 5.4, 0], fF: [3.3, 11.2, 3.6, 0],
  hN: [-5.5, 6.5, -10, 1.4, -3, 0], hF: [-6.5, 6.5, -11, 1.4, -4.5, 0],
  tail: [-11, 3, -15.5, 0.9, -5, 0.6, 4, 1.3], tailR: [1.4, 0.9], tailFront: true,
};
const LIE = {
  haunch: [-8.5, 5.9, 6.8, 5.9, 0], torso: [-1, 5.4, 10.5, 5.2, 0], chest: [7, 6, 5.2, 5.8, 0],
  neck: [9, 8.5, 11.5, 12.5, 3.7, 3.0], head: [13, 15], mode: 'profile',
  fN: [8.5, 4, 16, 0], fF: [7.5, 4.2, 14.5, 0.3],
  hN: [-8, 5, -11, 1.3, -4, 0], hF: [-9, 5, -12, 1.3, -5, 0],
  tail: [-14, 3.2, -19, 1.2, -23, 1.2, -27, 2.4], tailR: [1.7, 1.1], tailFront: true,
};
const POSES = {
  stand: STAND,
  sit: SIT,
  sitFront: { ...SIT, mode: 'front' },
  yawn: { ...SIT, head: [6.5, 24], mode: 'yawn' },
  groomA: { ...SIT, head: [7.6, 23], mode: 'groom', fN: [4.5, 11.2, 10.6, 18.6] },
  groomB: { ...SIT, head: [7.9, 22.2], mode: 'groom', fN: [4.5, 11.2, 10.2, 17.6] },
  lie: LIE,
  lieFront: { ...LIE, mode: 'front' },
  sleep: { ...LIE, neck: [9, 8, 12, 9.5, 3.7, 3.1], head: [14, 8.8], mode: 'sleep', tail: [-14, 3.2, -18, 1.2, -6, -0.2, 6, 1.4] },
  stretch: {
    ...STAND, haunch: [-9, 13.5, 6, 6.2, 0], torso: [-1.5, 10, 10.5, 4.6, -0.32], chest: [6.5, 6.2, 5, 5, 0],
    neck: [8.5, 7.5, 11.5, 9.5, 3.4, 2.9], head: [13.5, 10.5], fN: [7.5, 4.5, 17, 0], fF: [6.5, 4.5, 15.5, 0],
    tail: [-14, 16, -18, 20, -17, 26, -13, 28],
  },
};

// Lateral-sequence walk: near hind, near front, far hind, far front, a quarter cycle apart.
const STRIDE = 8, DUTY = 0.6;
function walkPose(ph) {
  const p = JSON.parse(JSON.stringify(STAND));
  const bob = 0.35 * Math.cos(4 * Math.PI * ph);
  for (const k of ['haunch', 'torso', 'chest']) p[k][1] += bob;
  p.neck[1] += bob; p.neck[3] += bob; p.head[1] += bob * 0.6;
  for (const k of ['fN', 'fF', 'hN', 'hF']) p[k][1] += bob;
  const foot = (q, lift) => {
    q = ((q % 1) + 1) % 1;
    if (q < DUTY) return [STRIDE / 2 - STRIDE * (q / DUTY), 0];
    const s = (q - DUTY) / (1 - DUTY);
    return [-STRIDE / 2 + STRIDE * (0.5 - 0.5 * Math.cos(Math.PI * s)), lift * Math.sin(Math.PI * s)];
  };
  const fr = (leg, q) => { const [dx, y] = foot(q, 2.2); leg[2] = leg[0] + 0.5 + dx; leg[3] = y; };
  const hi = (leg, q) => { const [dx, y] = foot(q, 2.0); leg[4] = leg[0] + 0.4 + dx; leg[5] = y; leg[2] = leg[4] - 1.5; leg[3] = y + 3.8; };
  fr(p.fN, ph + 0.75); fr(p.fF, ph + 0.25); hi(p.hN, ph); hi(p.hF, ph + 0.5);
  const sw = Math.sin(2 * Math.PI * ph);
  p.tail[4] += 0.8 * sw; p.tail[6] += 1.2 * Math.sin(2 * Math.PI * ph - 0.6); p.tail[7] += 0.4 * sw;
  return p;
}

function draw(p, { shut = false, withTail = true, tailOnly = false } = {}) {
  const R = raster();
  if (tailOnly) { tail(R, p.tail, p.tailR); R.rim(); return { g: R.g, whiskers: [] }; }
  hindLeg(R, p.hF, true);
  frontLeg(R, p.fF, true);
  if (withTail && !p.tailFront) tail(R, p.tail, p.tailR);
  R.shape(ellipse(...p.haunch));
  R.shape(ellipse(...p.torso));
  R.shape(ellipse(...p.chest));
  hindLeg(R, p.hN, false);
  R.shape(capsule(...p.neck));
  head(R, p.head, p.mode);
  frontLeg(R, p.fN, false);
  if (withTail && p.tailFront) tail(R, p.tail, p.tailR);
  R.rim();
  const whiskers = face(R, p.head, p.mode, shut || p.mode === 'sleep' || p.mode === 'groom');
  return { g: R.g, whiskers };
}

// ---------- output ----------
const PAL = { 0: '#060608', 1: '#0e0e13', 2: '#17171e', 3: '#22222b', i: '#3a2530', n: '#2b1c23', e: '#c6d84c', E: '#93a833', p: '#050505', k: '#040405', m: '#7a3444' };

function paths(g, pal, only = null) {
  const by = {};
  g.forEach((row, r) => {
    let c = 0;
    while (c < COLS) {
      const ch = row[c];
      if (ch == null || (only && !only(r, c))) { c++; continue; }
      const s = c;
      while (c < COLS && row[c] === ch && (!only || only(r, c))) c++;
      (by[ch] ||= []).push(`M${s} ${r}h${c - s}v1h${s - c}z`);
    }
  });
  return Object.entries(by).map(([ch, d]) => `<path fill="${pal[ch]}" d="${d.join('')}"/>`).join('');
}

// One frame: body, plus an eyelid overlay that a blink animation can flash on top.
function frame(pose, rim, opts = {}) {
  const pal = { ...PAL, 4: rim };
  const open = draw(pose, opts);
  let blink = '';
  if (!opts.tailOnly && (pose.mode === 'profile' || pose.mode === 'front')) {
    const shut = draw(pose, { ...opts, shut: true });
    blink = paths(shut.g, pal, (r, c) => shut.g[r][c] !== open.g[r][c]);
  }
  const wh = open.whiskers.map(([a, b, c, d]) => `M${(a + OX).toFixed(1)} ${(ROWS - b).toFixed(1)}L${(c + OX).toFixed(1)} ${(ROWS - d).toFixed(1)}`).join('');
  return {
    body: paths(open.g, pal) + (wh ? `<path d="${wh}" stroke="#9a9aab" stroke-width=".3" opacity=".45" fill="none"/>` : ''),
    blink,
  };
}

module.exports = { OX, ROWS, COLS, POSES, STAND, SIT, LIE, STRIDE, DUTY, blend, walkPose, frame };
