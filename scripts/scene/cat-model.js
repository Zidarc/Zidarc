// Billo as a cute pixel black cat: big round head, big shiny eyes, short legs and a fluffy tail.
// She's built from rounded shapes and shaded per cell, so poses can be blended into in-between frames.
// Units are cells; x points where she faces, y is up from the surface she stands on (negative = below a ledge).
const OX = 30, TOP = 34, BELOW = 16, ROWS = TOP + BELOW, COLS = 56;

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
function tri(p, q, w, n = [0.1, 0.35]) {
  const side = (a, b, x, y) => (x - b[0]) * (a[1] - b[1]) - (a[0] - b[0]) * (y - b[1]);
  return (x, y) => {
    const d1 = side(p, q, x, y), d2 = side(q, w, x, y), d3 = side(w, p, x, y);
    return (d1 < 0 || d2 < 0 || d3 < 0) && (d1 > 0 || d2 > 0 || d3 > 0) ? null : n;
  };
}

// Soft key light from the upper left (moonlight).
const LIGHT = (() => { const v = [-0.4, 0.75, 0.55], m = Math.hypot(...v); return v.map(x => x / m); })();
function tone(n, far) {
  const z = Math.sqrt(Math.max(0, 1 - n[0] * n[0] - n[1] * n[1]));
  let l = n[0] * LIGHT[0] + n[1] * LIGHT[1] + z * LIGHT[2];
  if (far) l = l * 0.6 - 0.12;
  return l > 0.7 ? 3 : l > 0.32 ? 2 : l > -0.05 ? 1 : 0;
}

// ---------- raster ----------
function raster() {
  const g = Array.from({ length: ROWS }, () => Array(COLS).fill(null));
  const at = (x, y) => [TOP - 1 - Math.floor(y), Math.floor(x) + OX];
  const each = (fn, cb) => {
    for (let r = 0; r < ROWS; r++) for (let c = 0; c < COLS; c++) {
      const n = fn(c - OX + 0.5, TOP - 1 - r + 0.5);
      if (n) cb(r, c, n);
    }
  };
  return {
    g,
    // contour: where this part overlaps one drawn earlier, its shadowed edge becomes a dark line (legs, chin).
    shape(fn, { far = false, contour = false } = {}) {
      const hit = new Map();
      each(fn, (r, c, n) => hit.set(r * COLS + c, n));
      for (const [k, n] of hit) {
        const r = Math.floor(k / COLS), c = k % COLS;
        let t = tone(n, far);
        const edge = !hit.has(k - COLS) || !hit.has(k + COLS) || !hit.has(k - 1) || !hit.has(k + 1);
        if (contour && edge && g[r][c] != null && t < 2) t = 0;
        g[r][c] = String(t);
      }
    },
    fill(fn, ch) { each(fn, (r, c) => { g[r][c] = ch; }); },
    dot(x, y, ch) {
      const [r, c] = at(x, y);
      if (r >= 0 && r < ROWS && c >= 0 && c < COLS) g[r][c] = ch;
    },
    // Moonlit rim along the top of the silhouette so a black cat reads on a dark night.
    rim() {
      for (let r = 1; r < ROWS; r++) for (let c = 1; c < COLS; c++) {
        if (!'0123'.includes(g[r][c] ?? 'x')) continue;
        if (g[r - 1][c] == null || (g[r][c - 1] == null && g[r - 1][c - 1] == null)) g[r][c] = '4';
      }
    },
  };
}

// ---------- body parts ----------
function ik(ax, ay, bx, by, l1, l2, bend) {
  const d = Math.max(Math.abs(l1 - l2) + 1e-3, Math.min(Math.hypot(bx - ax, by - ay), l1 + l2 - 1e-3));
  const a = Math.atan2(by - ay, bx - ax), al = Math.acos((l1 * l1 + d * d - l2 * l2) / (2 * l1 * d));
  return [ax + l1 * Math.cos(a + bend * al), ay + l1 * Math.sin(a + bend * al)];
}
function frontLeg(R, [sx, sy, fx, fy], far) {
  const [kx, ky] = ik(sx, sy, fx, fy + 0.9, 3.6, 4.4, -1);
  R.shape(capsule(sx, sy, kx, ky, 2.0, 1.6), { far, contour: true });
  R.shape(capsule(kx, ky, fx, fy + 0.9, 1.6, 1.4), { far, contour: true });
  R.shape(ellipse(fx + 0.4, fy + 1.0, 1.8, 1.1), { far, contour: true });
}
function hindLeg(R, [hx, hy, kx2, ky2, px, py], far) {
  const [kx, ky] = ik(hx, hy, kx2, ky2, 3.8, 3.4, 1);
  R.shape(capsule(hx, hy, kx, ky, 2.6, 1.9), { far, contour: true });
  R.shape(capsule(kx, ky, kx2, ky2, 1.6, 1.4), { far, contour: true });
  R.shape(capsule(kx2, ky2, px, py + 1.0, 1.4, 1.4), { far, contour: true });
  R.shape(ellipse(px + 0.4, py + 1.0, 1.9, 1.1), { far, contour: true });
}
function tail(R, p, [r0, r1]) {
  const pt = t => {
    const u = 1 - t;
    return [0, 1].map(i => u * u * u * p[i] + 3 * u * u * t * p[2 + i] + 3 * u * t * t * p[4 + i] + t * t * t * p[6 + i]);
  };
  const N = 14;
  for (let i = 0; i < N; i++) {
    const [ax, ay] = pt(i / N), [bx, by] = pt((i + 1) / N);
    R.shape(capsule(ax, ay, bx, by, lerp(r0, r1, i / N), lerp(r0, r1, (i + 1) / N)), { contour: i < 2 });
  }
}

const isFront = m => m === 'front' || m === 'yawn' || m === 'snooze';
// mode: profile | front | yawn (front, mouth open) | snooze (front, eyes shut)
function head(R, [hx, hy], mode) {
  if (isFront(mode)) {
    hx = Math.floor(hx) + 0.5;
    for (const s of [-1, 1]) R.shape(tri([hx + s * 6.2, hy + 2.2], [hx + s * 1.6, hy + 4.6], [hx + s * 5.2, hy + 9.4]));
    R.shape(ellipse(hx, hy, 6.4, 5.4), { contour: true });
    R.shape(ellipse(hx, hy - 1.7, 7.1, 3.6));
    for (const s of [-1, 1]) R.fill(tri([hx + s * 5.4, hy + 3.4], [hx + s * 2.7, hy + 4.7], [hx + s * 4.9, hy + 7.8]), 'i');
    return;
  }
  R.shape(tri([hx + 0.8, hy + 3.2], [hx + 4.2, hy + 3.0], [hx + 3.4, hy + 8.6]), { far: true });
  R.shape(ellipse(hx, hy, 6.2, 5.4), { contour: true });
  R.shape(ellipse(hx + 1.2, hy - 1.8, 5.2, 3.6));
  R.shape(ellipse(hx + 5.2, hy - 1.6, 2.0, 1.7));
  R.shape(tri([hx - 3.6, hy + 3.2], [hx + 0.8, hy + 4.6], [hx - 2.4, hy + 9.4]));
  R.fill(tri([hx - 2.7, hy + 4.3], [hx - 0.1, hy + 5.0], [hx - 2.2, hy + 7.9]), 'i');
}

// Eyes, nose, mouth, blush. Returns whisker strokes in cell units.
function face(R, [hx, hy], mode, shut) {
  if (isFront(mode)) {
    hx = Math.floor(hx) + 0.5;
    const closed = shut || mode !== 'front';
    for (const ex of [hx - 4.5, hx + 1.5]) {
      if (closed) { R.dot(ex, hy + 0.4, '0'); R.dot(ex + 1, hy + 0.9, '0'); R.dot(ex + 2, hy + 0.4, '0'); continue; }
      [['e', 'e', 'e'], ['e', 'w', 'p'], ['E', 'p', 'p']].forEach((row, i) => row.forEach((ch, j) => R.dot(ex + j, hy + 1.5 - i, ch)));
    }
    R.dot(hx - 0.5, hy - 1.9, 'n'); R.dot(hx + 0.5, hy - 1.9, 'n');
    if (mode === 'yawn') for (let x = -1; x <= 2; x++) for (let y = 0; y < 3; y++) R.dot(hx - 1.5 + x, hy - 2.9 - y, x === -1 || x === 2 || y === 2 ? '0' : 'm');
    else { R.dot(hx - 1.5, hy - 2.9, '0'); R.dot(hx - 0.5, hy - 3.3, '0'); R.dot(hx + 0.5, hy - 3.3, '0'); R.dot(hx + 1.5, hy - 2.9, '0'); }
    for (const x of [hx - 5.5, hx - 4.5, hx + 3.5, hx + 4.5]) R.dot(x, hy - 2.2, 'b');
    return [-1, 1].flatMap(s => [[0.6, 1.2], [0, 0], [-0.6, -1.3]].map(([d0, d1]) =>
      [hx + s * 4.5, hy - 2.6 + d0, hx + s * 11, hy - 2.6 + d1]));
  }
  const ex = hx + 2.2;
  if (shut) { R.dot(ex, hy + 0.3, '0'); R.dot(ex + 1, hy + 0.7, '0'); R.dot(ex + 2, hy + 0.3, '0'); }
  else [['e', 'e'], ['w', 'p'], ['E', 'p']].forEach((row, i) => row.forEach((ch, j) => R.dot(ex + j, hy + 1.4 - i, ch)));
  R.dot(hx + 6.8, hy - 1.0, 'n');
  R.dot(hx + 5.8, hy - 2.8, '0');
  R.dot(hx + 2.6, hy - 2.5, 'b'); R.dot(hx + 3.6, hy - 2.5, 'b');
  return [[0.6, 1.2], [0, -0.2], [-0.6, -1.6]].map(([a, b]) => [hx + 5.6, hy - 2.2 + a, hx + 12, hy - 2.2 + b]);
}

// ---------- poses ----------
// haunch/torso/chest: [x, y, rx, ry, rot]; neck: [x0, y0, x1, y1, r0, r1]; legs: shoulder→paw, hip→hock→paw.
const STAND = {
  haunch: [-6.5, 9.6, 5.4, 5.6, 0], torso: [0, 10, 9, 5.0, 0], chest: [6, 9.8, 4.8, 5.2, 0],
  neck: [8, 12, 10, 14.5, 3.6, 3.4], head: [12, 17], mode: 'profile',
  fN: [7, 7.5, 7.5, 0], fF: [6, 7.5, 6, 0],
  hN: [-6.5, 8, -7.5, 2.8, -6.2, 0], hF: [-7.5, 8, -8.5, 2.8, -7.2, 0],
  tail: [-11, 12, -16, 13, -18, 19, -14.5, 22.5], tailR: [2.2, 1.9], tailFront: false,
};
const SIT = {
  haunch: [-4.5, 5.4, 6.2, 5.4, 0], torso: [-1, 8.8, 4.8, 7.2, -0.3], chest: [2.6, 9.6, 4.2, 5.4, -0.15],
  neck: [3, 12.5, 4.5, 15, 3.4, 3.2], head: [5.5, 19.5], mode: 'profile',
  fN: [3.6, 8, 4.4, 0], fF: [2.6, 8, 2.8, 0],
  hN: [-4, 5, -7.5, 1.1, -1.8, 0], hF: [-5, 5, -8.5, 1.1, -3, 0],
  tail: [-9, 2.6, -12.5, 0.9, -4, 0.4, 3.5, 1.4], tailR: [1.9, 1.5], tailFront: true,
};
// Lying along a ledge, tail hanging over the edge.
const LEDGE = {
  haunch: [-6.5, 4.6, 5.6, 4.6, 0], torso: [-0.5, 4.4, 9, 4.4, 0], chest: [5.5, 4.8, 4.4, 4.8, 0],
  neck: [7, 6.5, 9, 9.5, 3.4, 3.2], head: [10.5, 12.5], mode: 'profile',
  fN: [6.8, 3, 12.5, 0], fF: [6, 3.2, 11.2, 0.2],
  hN: [-6, 4, -8.5, 1.1, -3, 0], hF: [-7, 4, -9.5, 1.1, -4, 0],
  tail: [-11, 2.6, -14, 1.2, -14.5, -5, -13, -11], tailR: [1.9, 1.5], tailFront: true,
};
// A loaf: paws tucked, tail wrapped round the front.
const LOAF = {
  haunch: [-5, 5, 5.6, 5, 0], torso: [-0.5, 5.4, 8.6, 5.4, 0], chest: [4.8, 5.4, 4.6, 5.4, 0],
  neck: [6, 7.5, 7.5, 10, 3.4, 3.2], head: [8.5, 13], mode: 'front',
  fN: [5.5, 2.5, 7.2, 0], fF: [4.5, 2.5, 6.2, 0],
  hN: [-5, 3, -6, 1, -3, 0], hF: [-6, 3, -7, 1, -4, 0],
  tail: [-9.5, 2.5, -11, 0.8, -4, 0.5, 4, 1.2], tailR: [1.9, 1.5], tailFront: true,
};
const HANG = [-9, 2.6, -11.5, 1.5, -11.8, -4, -10.8, -10];
const POSES = {
  stand: STAND,
  sit: SIT, sitFront: { ...SIT, mode: 'front' }, yawn: { ...SIT, head: [5.5, 20], mode: 'yawn' },
  sitHang: { ...SIT, tail: HANG },
  ledge: LEDGE, ledgeFront: { ...LEDGE, mode: 'front' },
  loaf: LOAF, loafSnooze: { ...LOAF, head: [8.5, 12.2], mode: 'snooze' },
};

// Lateral-sequence walk: near hind, near front, far hind, far front, a quarter cycle apart.
const STRIDE = 6, DUTY = 0.6;
function walkPose(ph) {
  const p = JSON.parse(JSON.stringify(STAND));
  const bob = 0.3 * Math.cos(4 * Math.PI * ph);
  for (const k of ['haunch', 'torso', 'chest']) p[k][1] += bob;
  p.neck[1] += bob; p.neck[3] += bob; p.head[1] += bob * 0.5;
  for (const k of ['fN', 'fF', 'hN', 'hF']) p[k][1] += bob;
  const foot = (q, lift) => {
    q = ((q % 1) + 1) % 1;
    if (q < DUTY) return [STRIDE / 2 - STRIDE * (q / DUTY), 0];
    const s = (q - DUTY) / (1 - DUTY);
    return [-STRIDE / 2 + STRIDE * (0.5 - 0.5 * Math.cos(Math.PI * s)), lift * Math.sin(Math.PI * s)];
  };
  const fr = (leg, q) => { const [dx, y] = foot(q, 1.8); leg[2] = leg[0] + 0.5 + dx; leg[3] = y; };
  const hi = (leg, q) => { const [dx, y] = foot(q, 1.6); leg[4] = leg[0] + 0.3 + dx; leg[5] = y; leg[2] = leg[4] - 1.3; leg[3] = y + 2.8; };
  fr(p.fN, ph + 0.75); fr(p.fF, ph + 0.25); hi(p.hN, ph); hi(p.hF, ph + 0.5);
  const sw = Math.sin(2 * Math.PI * ph);
  p.tail[4] += 0.7 * sw; p.tail[6] += 1.0 * Math.sin(2 * Math.PI * ph - 0.6); p.tail[7] += 0.3 * sw;
  return p;
}

// Hats for parties and holidays, top row first; the bottom row sits on top of her head between the ears.
const HATS = {
  party: ['...y...', '..yYy..', '...k...', '..kkk..', '..ccc..', '.kkkkk.', '.ccccc.', 'kkkkkkk'],
  witch: ['.......VV....', '......vV.....', '.....vvV.....', '....vvvV.....', '....vvvvV....', '....ooooo....', '...vvvvvvV...', 'VvvvvvvvvvvvV'],
  santa: ['........WW', '......rRWW', '....rrrR..', '...rrrrr..', '..rrrrrr..', '.WWWWWWWW.', 'WWWWWWWWWW'],
  cap: ['...WWW...', '.WYWYWYW.', 'YyyyyyyyY'],
};
function hatOn(R, [hx, hy], mode, name) {
  const rows = HATS[name];
  if (!rows) return;
  const cx = isFront(mode) ? Math.floor(hx) + 0.5 : hx + 0.3, base = hy + 4.6;
  rows.forEach((row, i) => [...row].forEach((ch, j) => {
    if (ch !== '.') R.dot(cx - (row.length - 1) / 2 + j, base + (rows.length - 1 - i), ch);
  }));
}

function draw(p, { shut = false, withTail = true, tailOnly = false, hat = null } = {}) {
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
  const whiskers = face(R, p.head, p.mode, shut);
  if (hat) hatOn(R, p.head, p.mode, hat);
  return { g: R.g, whiskers };
}

// ---------- output ----------
const PAL = {
  0: '#0a0a10', 1: '#13131b', 2: '#1c1c27', 3: '#292a38', 4: '#6a72a6',
  i: '#c9708a', n: '#e08a9e', e: '#f4c34f', E: '#d6942c', w: '#ffffff', p: '#140c08', m: '#b5475f', b: '#6e3046',
  // hats
  r: '#d8344c', R: '#962033', y: '#ffd34d', Y: '#d89a26', v: '#5b3a8c', V: '#36214f', o: '#ff8a2a', W: '#eef0f6', k: '#ff6fa8', c: '#59d0e8',
};

function paths(g, only = null, pal = PAL) {
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
  return Object.entries(by).map(([ch, d]) => `<path fill="${pal[ch] || PAL[ch]}" d="${d.join('')}"/>`).join('');
}

// One frame: body, plus an eyelid overlay that a blink animation can flash on top.
function frame(pose, opts = {}) {
  const open = draw(pose, opts);
  let blink = '';
  if (!opts.tailOnly && (pose.mode === 'profile' || pose.mode === 'front')) {
    const shut = draw(pose, { ...opts, shut: true });
    blink = paths(shut.g, (r, c) => shut.g[r][c] !== open.g[r][c], opts.pal);
  }
  const wh = open.whiskers.map(([a, b, c, d]) => `M${(a + OX).toFixed(1)} ${(TOP - b).toFixed(1)}L${(c + OX).toFixed(1)} ${(TOP - d).toFixed(1)}`).join('');
  return {
    body: paths(open.g, null, opts.pal) + (wh ? `<path d="${wh}" stroke="#b8bccc" stroke-width=".3" opacity=".5" fill="none"/>` : ''),
    blink,
  };
}

module.exports = { OX, TOP, ROWS, COLS, PAL, HATS, draw, POSES, STAND, SIT, LEDGE, LOAF, HANG, STRIDE, DUTY, blend, walkPose, frame };
