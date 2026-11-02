// Reaction GIFs for the bot's replies (assets/reactions/<action>.gif), drawn from the same pixel cat as the profile.
const M = require('./scene/cat-model');
const S = require('./scene/scenes');
const { encode } = require('./gif');

const CW = 96, CH = 64, SCALE = 4, SURF = 52;
const SKY = ['#04050c', '#070a17', '#0b1022', '#10172e', '#161f3b'];
const RAINBOW = ['#3a1030', '#10203a', '#0c3424', '#3a2a08'];

const SPR = {
  heart: ['.kk.kk.', 'kkkkkkk', 'kkkkkkk', '.kkkkk.', '..kkk..', '...k...'],
  fish: ['...ff....', '.ffffff.f', 'fwpffffff', '.ffffff.f', '...ff....'],
  fish2: ['.ffff.f', 'fwfffff', '.ffff.f'],
  fish3: ['fff', 'fff'],
  hand: ['.XXXXXXX.', '.XXXXXXX.', '.hhhhhhh.', 'hhhhhhhhh', 'hhhhhhhhh', 'hhhhhhhhh', 'h.h.h.hh.', 'h.h.h....'],
  spark: ['..s..', '..s..', 'ss.ss', '..s..', '..s..'],
  dot: ['.L.', 'LDL', '.L.'],
};
const COL = {
  ...M.PAL, f: '#9cc3e6', h: '#f2c29b', s: '#fff2a8', L: '#ff5050', D: '#ffd0d0', k: '#ff6f91',
  g: '#2a2333', G: '#4a3f5a', z: '#ffffff', q: '#eef2fa', Y: '#ff6fa8', X: '#c43d6a',
};

function scene(sky = SKY) {
  const g = Array.from({ length: CH }, () => Array(CW).fill(null));
  const bands = [10, 10, 11, 11, 12];
  let y = 0;
  bands.forEach((n, i) => { for (let k = 0; k < n && y < SURF; k++, y++) g[y].fill(sky[i]); });
  const r = S.rng(7);
  for (let k = 0; k < 26; k++) { const sx = S.ri(r, 0, CW - 1), sy = S.ri(r, 0, 36); if (Math.hypot(sx - 80, sy - 10) > 6) g[sy][sx] = r() < 0.3 ? '#ffffff' : '#7a84a8'; }
  for (let dy = -4; dy <= 4; dy++) for (let dx = -4; dx <= 4; dx++) if (dx * dx + dy * dy <= 16) g[10 + dy][80 + dx] = '#eef2fa';
  for (let r = SURF; r < CH; r++) g[r].fill(r === SURF ? '#4a3f5a' : r % 4 === 0 ? '#221c2a' : '#2a2333');
  return g;
}
const stamp = (g, rows, x, y, cols = COL) => rows.forEach((row, i) => [...row].forEach((ch, j) => {
  const r = y + i, c = x + j;
  if (ch !== '.' && r >= 0 && r < CH && c >= 0 && c < CW) g[r][c] = cols[ch] || ch;
}));
function cat(g, pose, x, opts = {}) {
  const d = M.draw(pose, opts);
  d.g.forEach((row, r) => row.forEach((ch, c) => {
    const rr = SURF - M.TOP + r, cc = x + c;
    if (ch != null && rr >= 0 && rr < CH && cc >= 0 && cc < CW) g[rr][cc] = M.PAL[ch];
  }));
}
function yarn(g, cx, cy, spin) {
  for (let dy = -4; dy <= 4; dy++) for (let dx = -4; dx <= 4; dx++) {
    if (dx * dx + dy * dy > 18) continue;
    const band = Math.floor((dx * Math.cos(spin) + dy * Math.sin(spin) + 8) / 2) % 2;
    g[cy + dy][cx + dx] = band ? '#ff6fa8' : '#c43d6a';
  }
  g[cy + 4][cx + 5] = '#ff6fa8'; g[cy + 4][cx + 6] = '#ff6fa8'; g[cy + 4][cx + 7] = '#ff6fa8';
}

const P = M.POSES;
const BUILDERS = {
  feed: () => {
    const fr = [];
    for (let i = 0; i < 5; i++) { const g = scene(); cat(g, P.sitFront, 14); stamp(g, SPR.fish, 54, 4 + i * 6); fr.push([g, 9]); }
    const bites = [SPR.fish, SPR.fish2, SPR.fish2, SPR.fish3, null];
    bites.forEach((f, i) => {
      for (const open of [true, false]) {
        const g = scene(); cat(g, open ? P.yawn : P.sitFront, 14);
        if (f) stamp(g, f, 55, 36);
        fr.push([g, open ? 16 : 12]);
      }
    });
    for (let i = 0; i < 6; i++) {
      const g = scene(); cat(g, { ...P.sit, mode: 'snooze' }, 14);
      stamp(g, SPR.heart, 54 + (i % 2), 22 - i * 3); stamp(g, SPR.heart, 30 - (i % 2), 26 - i * 3);
      fr.push([g, 14]);
    }
    return fr;
  },
  play: () => Array.from({ length: 16 }, (_, i) => {
    const g = scene();
    for (let x = 0; x < CW; x += 8) { const c = (x - i * 3 + CW * 4) % CW; g[SURF + 3][c] = '#3a3046'; g[SURF + 3][(c + 1) % CW] = '#3a3046'; }
    cat(g, M.walkPose((i % 8) / 8), 4);
    yarn(g, 66 + Math.round(2 * Math.sin(i / 2.5)), SURF - 5 - Math.round(Math.abs(Math.sin(i / 2.5)) * 5), -i * 0.8);
    return [g, 8];
  }),
  pet: () => Array.from({ length: 12 }, (_, i) => {
    const g = scene();
    cat(g, { ...P.sit, mode: 'snooze' }, 14);
    stamp(g, SPR.hand, 41 + Math.round(4 * Math.sin(i / 12 * Math.PI * 2)), 13 + (i % 2));
    if (i % 4 < 2) stamp(g, SPR.heart, 60, 18 - (i % 4) * 3);
    else stamp(g, SPR.heart, 24, 20 - (i % 4) * 2);
    return [g, 11];
  }),
  catnip: () => Array.from({ length: 16 }, (_, i) => {
    const sky = SKY.map((c, k) => RAINBOW[(k + i) % RAINBOW.length]);
    const g = scene(sky);
    cat(g, M.walkPose((i % 8) / 8), 10, { hat: 'party' });
    for (let k = 0; k < 6; k++) stamp(g, SPR.spark, (k * 29 + i * 5) % (CW - 5), (k * 17 + i * 3) % 40);
    return [g, 8];
  }),
  laser: () => {
    const spots = [[62, 49], [74, 47], [56, 50], [84, 48], [68, 50], [78, 46]];
    return Array.from({ length: 12 }, (_, i) => {
      const g = scene();
      cat(g, i % 4 < 2 ? P.sit : P.sitFront, 10);
      const [x, y] = spots[i % spots.length];
      stamp(g, SPR.dot, x, y);
      return [g, 13];
    });
  },
};

function render(name) {
  const frames = BUILDERS[name]();
  const pal = [], idx = new Map();
  const id = c => { if (!idx.has(c)) { idx.set(c, pal.length); pal.push([1, 3, 5].map(k => parseInt(c.slice(k, k + 2), 16))); } return idx.get(c); };
  id('#000000');
  const W = CW * SCALE, H = CH * SCALE;
  const out = frames.map(([g, delay]) => {
    const px = new Uint8Array(W * H);
    for (let r = 0; r < CH; r++) for (let c = 0; c < CW; c++) {
      const v = id(g[r][c] || '#000000');
      for (let dy = 0; dy < SCALE; dy++) px.fill(v, (r * SCALE + dy) * W + c * SCALE, (r * SCALE + dy) * W + (c + 1) * SCALE);
    }
    return { px, delay };
  });
  if (pal.length > 256) throw new Error(`${name}: too many colours (${pal.length})`);
  return encode(W, H, pal, out);
}

module.exports = { REACTIONS: Object.keys(BUILDERS), render };
