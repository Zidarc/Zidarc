// Huna's night walk: she keeps walking to the right through a chain of scenes (the camera follows and the
// background scrolls in parallax), and every so often she stops to sit, yawn or lie down. On a ledge she lies
// with her tail hanging over the edge; on grass she curls into a loaf. While she walks, one scene crossfades
// into the next. A seeded script is baked into CSS keyframes on one shared loop.
const M = require('./cat-model');
const S = require('./scenes');

const CELL = 3;
const WALK_T = 0.8; // seconds per stride cycle
const SPEED = M.STRIDE / (M.DUTY * WALK_T); // cells per second, so planted paws don't slide
const STEP = 0.12; // seconds per in-between frame
const FADE = 1.6; // scene crossfade, always while she's walking

const WEIGHTS = {
  normal: { sit: 3, lie: 2, yawn: 0.7 },
  happy: { sit: 3, lie: 1, yawn: 0.4 },
  hungry: { sit: 3, lie: 0.6, yawn: 0.6 },
  bored: { sit: 2, lie: 3, yawn: 1.2 },
  sleepy: { sit: 1, lie: 4, yawn: 1.5 },
};

function choreograph(r, mood, kinds) {
  const vis = {}, scenes = [];
  let t = 0, state = 'walk';
  const show = (el, d) => { (vis[el] ||= []).push([t, t + d]); };
  const hold = (el, d, tailEl) => { show(el, d); if (tailEl) show(tailEl, d); t += d; };
  const seq = els => els.forEach(el => hold(el, STEP));
  const rand = (a, b) => a + r() * (b - a);
  const W = WEIGHTS[mood] || WEIGHTS.normal;
  const pickAction = () => {
    let k = r() * Object.values(W).reduce((a, b) => a + b, 0);
    for (const [name, w] of Object.entries(W)) if ((k -= w) < 0) return name;
    return 'sit';
  };

  kinds.forEach((kind, i) => {
    const ledge = kind === 'ledge';
    const sc = { start: i ? t - FADE : -FADE, walks: [] };
    scenes.push(sc);
    const sitTail = ledge ? 'tailH' : 'tailG', up = ledge ? ['sh3', 'sh2', 'sh1'] : ['ss3', 'ss2', 'ss1'];
    const walk = d => {
      if (state === 'sit') seq(up);
      sc.walks.push([t, t + d]); show('walk', d); t += d; state = 'walk';
    };
    const sitDown = () => { if (state === 'walk') seq(up.slice().reverse()); state = 'sit'; };
    const sitIdle = d => {
      sitDown();
      const end = t + d;
      let front = r() < 0.5;
      while (t < end - 0.01) { hold(front ? 'sitFront' : 'sit', Math.min(end - t, rand(1.5, 3.5)), sitTail); front = !front; }
    };
    const actions = {
      sit: () => sitIdle(rand(3, 6)),
      yawn: () => { sitIdle(rand(1, 2)); hold('yawn', 1.3, sitTail); sitIdle(rand(1, 2)); },
      lie: () => {
        sitIdle(rand(1, 2));
        const down = ledge ? ['sl1', 'sl2', 'sl3'] : ['sf1', 'sf2', 'sf3'];
        seq(down);
        const end = t + rand(5, mood === 'sleepy' || mood === 'bored' ? 11 : 8);
        let k = 0;
        while (t < end - 0.01) {
          const el = ledge ? (k % 2 ? 'ledgeFront' : 'ledge') : (k % 2 ? 'loafSnooze' : 'loaf');
          hold(el, Math.min(end - t, rand(2, 4)), ledge ? 'tailL' : 'tailF');
          k++;
        }
        seq(down.slice().reverse());
      },
    };
    walk(i ? rand(3, 5) : rand(1.5, 3));
    const n = 1 + (r() < 0.5 ? 1 : 0);
    for (let k = 0; k < n; k++) {
      let a = pickAction();
      if (k === n - 1 && !scenes.some(s => s.lay) && a !== 'lie' && r() < 0.6) a = 'lie';
      if (a === 'lie') sc.lay = true;
      actions[a]();
      if (k < n - 1) walk(rand(2.5, 4));
    }
    walk(rand(3.5, 5));
    sc.end = t;
  });
  return { L: t, vis, scenes };
}

// ---------- keyframes ----------
const pct = (t, L) => `${+(Math.min(Math.max(t, 0), L) / L * 100).toFixed(3)}%`;
function visKeyframes(name, wins, L) {
  wins = wins.slice().sort((a, b) => a[0] - b[0]);
  const merged = [];
  for (const w of wins) {
    const p = merged[merged.length - 1];
    if (p && w[0] <= p[1] + 1e-6) p[1] = Math.max(p[1], w[1]); else merged.push([...w]);
  }
  const on0 = merged.some(([a, b]) => a <= 1e-6 && b > 0);
  const kf = [`0%{opacity:${on0 ? 1 : 0}}`];
  for (const [a, b] of merged) {
    if (a > 1e-6) kf.push(`${pct(a, L)}{opacity:1}`);
    if (b < L - 1e-6) kf.push(`${pct(b, L)}{opacity:0}`);
  }
  return `@keyframes ${name}{${kf.join('')}}.${name}{animation:${name} ${L.toFixed(2)}s steps(1,end) infinite}`;
}
// A linear keyframe track from [time, value] points (two points at the same time make a jump).
function track(name, pts, L, fmt) {
  const kf = pts.map(([t, v]) => `${pct(t, L)}{${fmt(v)}}`);
  return `@keyframes ${name}{${kf.join('')}}.${name}{animation:${name} ${L.toFixed(2)}s linear infinite}`;
}

// Camera position (cells travelled) of one scene over the loop. Scene 0 starts FADE seconds before the loop wraps.
function cameraPoints(sc, L, first) {
  const walks = sc.walks.map(([a, b]) => [a, b]);
  if (first) walks.unshift([-FADE, 0]);
  const pts = [];
  let x = 0;
  for (const [a, b] of walks) { pts.push([a, x]); x += (b - a) * SPEED; pts.push([b, x]); }
  if (!first) return { pts: [[0, 0], ...pts, [L, x]], len: x };
  // Shift the pre-roll to the end of the loop: hold at the far end, jump back, walk in again.
  const shifted = pts.filter(([t]) => t >= 0);
  return { pts: [[0, FADE * SPEED], ...shifted, [L - FADE - 1e-3, x], [L - FADE, 0], [L, FADE * SPEED]], len: x };
}

// ---------- frames ----------
function sway(base, offs) {
  return offs.map(o => { const p = { ...base, tail: base.tail.slice() }; p.tail[4] += o * 0.5; p.tail[6] += o; return p; });
}
function flick(base) {
  const b = base.tail.slice(), c = base.tail.slice();
  b[6] -= 1; b[7] += 2.2; c[6] -= 2; c[7] += 4; c[5] += 1;
  return [base.tail, b, c, b].map(tail => ({ ...base, tail }));
}
function buildFrames() {
  const P = M.POSES, F = {};
  F.walk = Array.from({ length: 8 }, (_, i) => M.frame(M.walkPose(i / 8)));
  for (const k of ['sit', 'sitFront', 'yawn', 'ledge', 'ledgeFront', 'loaf', 'loafSnooze']) F[k] = M.frame(P[k], { withTail: false });
  [1, 2, 3].forEach(i => {
    F[`ss${i}`] = M.frame(M.blend(P.stand, P.sit, i / 4));
    F[`sh${i}`] = M.frame(M.blend(P.stand, P.sitHang, i / 4));
    F[`sl${i}`] = M.frame(M.blend(P.sitHang, P.ledge, i / 4));
    F[`sf${i}`] = M.frame(M.blend(P.sit, P.loaf, i / 4));
  });
  const tails = ps => ps.map(p => M.frame(p, { tailOnly: true }));
  const pend = [0, 0.8, 1.5, 0.8, 0, -0.8, -1.5, -0.8];
  F.tailG = tails(flick(P.sit));
  F.tailH = tails(sway(P.sitHang, pend));
  F.tailL = tails(sway(P.ledge, pend));
  F.tailF = tails(flick(P.loaf));
  return F;
}

// Cycles child frames on their own short loop (walk cycle, tail sway and flicks).
function cycle(cls, frames, period, weights) {
  const total = weights ? weights.reduce((a, b) => a + b, 0) : frames.length;
  let acc = 0, css = '';
  const body = frames.map((f, i) => {
    const w = weights ? weights[i] : 1;
    const a = acc / total * 100, b = (acc + w) / total * 100; acc += w;
    const kf = `${cls}${i}`;
    css += `@keyframes ${kf}{0%{opacity:${a === 0 ? 1 : 0}}${a > 0 ? `${+a.toFixed(3)}%{opacity:1}` : ''}${b < 100 ? `${+b.toFixed(3)}%{opacity:0}` : ''}}.${kf}{animation:${kf} ${period}s steps(1,end) infinite}`;
    return `<g class="${kf}">${f.body}</g>`;
  }).join('');
  return { body, css };
}

// x, y: top-left of the viewport in the card. Returns { svg, css }.
function renderStage({ x: VX, y: VY, seed, mood, bubble }) {
  const r = S.rng(seed);
  const names = Object.keys(S.SCENES);
  for (let i = names.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [names[i], names[j]] = [names[j], names[i]]; }
  const kinds = names.map(n => (n === 'meadow' ? 'ground' : 'ledge'));
  const plan = choreograph(r, mood, kinds);
  const { L } = plan;
  const W = S.VW * CELL, H = S.VH * CELL;
  const sky = S.sky(r);
  let css = sky.css, defs = sky.defs;

  // Scenes stack in order. Each fades in over the previous one while she walks; the last one fades out to reveal the first.
  const scenesSvg = names.map((name, i) => {
    const sc = plan.scenes[i];
    const cam = cameraPoints(sc, L, i === 0);
    const built = S.SCENES[name](r, cam.len);
    css += built.css || '';
    const ops = i === 0
      ? [[0, 1], [sc.end, 1], [sc.end + 1e-3, 0], [L - FADE - 1e-3, 0], [L - FADE, 1], [L, 1]]
      : i === names.length - 1
        ? [[0, 0], [sc.start, 0], [sc.start + FADE, 1], [L - FADE, 1], [L, 0]]
        : [[0, 0], [sc.start, 0], [sc.start + FADE, 1], [sc.end, 1], [sc.end + 1e-3, 0], [L, 0]];
    css += track(`sc${i}`, ops, L, v => `opacity:${v}`);
    const layer = ([f, svg], k) => {
      css += track(`c${i}_${k}`, cam.pts, L, x => `transform:translateX(${(-x * f * CELL).toFixed(1)}px)`);
      return `<g class="c${i}_${k}"><g transform="scale(${CELL})">${svg}</g></g>`;
    };
    const back = built.layers.map(layer).join('');
    const front = built.fg.map((l, k) => layer(l, 10 + k)).join('') + (built.fixedFg || '');
    return { back: `<g class="sc${i}">${back}</g>`, front: front && `<g class="sc${i}">${front}</g>` };
  });

  const F = buildFrames();
  const parts = [];
  const vis = (name, inner) => { css += visKeyframes(`v${name}`, plan.vis[name] || [], L); parts.push(`<g class="v${name}">${inner}</g>`); };
  const walk = cycle('wc', F.walk, WALK_T);
  const pendW = [1, 1, 1, 1, 1, 1, 1, 1];
  const tails = {
    tailG: cycle('tg', F.tailG, 5.2, [16, 1, 2, 1]),
    tailH: cycle('th', F.tailH, 3.6, pendW),
    tailL: cycle('tl', F.tailL, 4.4, pendW),
    tailF: cycle('tf', F.tailF, 4.6, [14, 1, 2, 1]),
  };
  css += walk.css + Object.values(tails).map(c => c.css).join('');
  vis('walk', walk.body);
  const withBlink = f => f.body + (f.blink ? `<g class="hb">${f.blink}</g>` : '');
  for (const k of ['sit', 'sitFront', 'yawn', 'ledge', 'ledgeFront', 'loaf', 'loafSnooze',
    'ss1', 'ss2', 'ss3', 'sh1', 'sh2', 'sh3', 'sl1', 'sl2', 'sl3', 'sf1', 'sf2', 'sf3'])
    if (plan.vis[k]) vis(k, withBlink(F[k]));
  for (const [k, c] of Object.entries(tails)) if (plan.vis[k]) vis(k, c.body);
  css += '.hb{opacity:0;animation:hb 4.7s steps(1,end) infinite}@keyframes hb{0%{opacity:0}91%{opacity:1}94%{opacity:0}}';

  const catX = 300, sy = S.GY * CELL - M.TOP * CELL;
  const shadow = `<ellipse cx="${catX + M.OX * CELL - 6}" cy="${S.GY * CELL + 1}" rx="42" ry="3" fill="#000" opacity=".35"/>`;
  const cat = `<g transform="translate(${catX} ${sy}) scale(${CELL})" shape-rendering="crispEdges">${parts.join('\n')}</g>`;

  // Z's float up whenever she's lying down and sleepy.
  let extra = '';
  if (mood === 'sleepy') {
    const lying = ['ledge', 'ledgeFront', 'loaf', 'loafSnooze'].flatMap(k => plan.vis[k] || []);
    css += visKeyframes('vzz', lying, L);
    extra += `<g class="vzz">${[[11, 0], [14, 1.2], [17, 2.4]].map(([s, d], i) =>
      `<text class="zz" x="${catX + M.OX * CELL + 44 + i * 10}" y="${sy + 50 - i * 6}" font-size="${s}" font-weight="700" fill="#e8ecf8" style="animation-delay:${d}s">z</text>`).join('')}</g>`;
    css += '.zz{opacity:0;animation:zz 3.6s ease-out infinite}@keyframes zz{0%{opacity:0;transform:none}20%{opacity:.9}100%{opacity:0;transform:translate(14px,-22px)}}';
  }
  if (bubble) {
    const bw = [...bubble.text].length * 8 + 20, bx = catX + M.OX * CELL - bw / 2 + 20, byy = sy - 4;
    extra += `<g class="bob"><rect x="${bx}" y="${byy}" width="${bw}" height="24" rx="8" fill="#16050d" fill-opacity=".85" stroke="${bubble.color}"/>
<path d="M${bx + bw / 2 - 6} ${byy + 24} l6 8 l6 -8z" fill="${bubble.color}"/>
<text x="${bx + bw / 2}" y="${byy + 16}" font-size="13" text-anchor="middle" fill="${bubble.color}">${bubble.text}</text></g>`;
  }

  const svg = `<defs>${defs}<clipPath id="stage"><rect x="0" y="0" width="${W}" height="${H}" rx="6"/></clipPath></defs>
<g transform="translate(${VX} ${VY})"><g clip-path="url(#stage)">
${sky.svg}
${scenesSvg.map(s => s.back).join('\n')}
${shadow}
${cat}
${scenesSvg.map(s => s.front).join('\n')}
${extra}
</g><rect x=".5" y=".5" width="${W - 1}" height="${H - 1}" rx="6" fill="none" stroke="#ff2266" stroke-opacity=".45"/></g>`;
  return { svg, css, L };
}

module.exports = { renderStage };
