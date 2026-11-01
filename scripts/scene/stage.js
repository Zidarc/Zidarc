// Puts Huna in a scene and choreographs a loop: sit and watch, walk (the camera follows and the
// background scrolls in parallax), lie down, groom, yawn, stretch. A seeded script is baked into CSS
// keyframes that share one timeline, so each rebuild of the card plays a different short film.
const M = require('./cat-model');
const S = require('./scenes');

const CELL = 3;
const WALK_T = 1; // seconds per stride cycle
const SPEED = M.STRIDE / (M.DUTY * WALK_T); // cells per second, so planted paws don't slide
const HOME = S.RANGE / 2;
const STEP = 0.12; // seconds per in-between frame

const WEIGHTS = {
  normal: { idle: 4, walk: 2.2, lie: 1.2, groom: 1, yawn: 0.6, stretch: 0.6 },
  happy: { idle: 2.5, walk: 3, lie: 0.5, groom: 1, yawn: 0.3, stretch: 1 },
  hungry: { idle: 2, walk: 3, lie: 0.3, groom: 0.2, yawn: 0.4, stretch: 0.3 },
  bored: { idle: 2, walk: 0.7, lie: 3, groom: 0.5, yawn: 1.2, stretch: 0.5 },
};

function choreograph(r, mood) {
  const vis = {}, cam = [[0, HOME]], dir = [[0, 1]];
  let t = 0, x = HOME, facing = 1;
  const show = (el, d) => { (vis[el] ||= []).push([t, t + d]); };
  const hold = (el, d, tailEl) => { show(el, d); if (tailEl) show(tailEl, d); t += d; };
  const seq = els => els.forEach(el => hold(el, STEP));
  const rand = (a, b) => a + r() * (b - a);

  if (mood === 'sleepy') { hold('sleep', 14); return { L: t, vis, cam, dir }; }

  const sitIdle = d => {
    const end = t + d;
    let front = false;
    while (t < end - 0.01) {
      hold(front ? 'sitFront' : 'sit', Math.min(end - t, rand(1.6, 4)), 'sitTail');
      front = !front && r() < 0.6;
    }
  };
  const turn = () => {
    hold('sitFront', 0.45, 'sitTail');
    facing = -facing; dir.push([t, facing]);
    hold('sitFront', 0.6, 'sitTail');
  };
  const walkTo = target => {
    if (Math.sign(target - x) !== facing) turn();
    seq(['ss3', 'ss2', 'ss1']);
    const d = Math.abs(target - x) / SPEED;
    cam.push([t, x]); show('walk', d); t += d; x = target; cam.push([t, x]);
    seq(['ss1', 'ss2', 'ss3']);
  };
  const actions = {
    idle: () => sitIdle(rand(3, 7)),
    walk: () => {
      let target;
      do target = Math.round(rand(0, S.RANGE)); while (Math.abs(target - x) < 25);
      walkTo(target);
      sitIdle(rand(1.5, 3));
    },
    lie: () => {
      seq(['sl1', 'sl2', 'sl3']);
      const end = t + rand(5, 11);
      let front = false;
      while (t < end - 0.01) { hold(front ? 'lieFront' : 'lie', Math.min(end - t, rand(2, 4.5)), 'lieTail'); front = !front && r() < 0.5; }
      seq(['sl3', 'sl2', 'sl1']);
    },
    groom: () => hold('groom', rand(2.4, 4), 'sitTail'),
    yawn: () => { hold('sit', 0.4, 'sitTail'); hold('yawn', 1.3, 'sitTail'); },
    stretch: () => { seq(['st1', 'st2']); hold('stretch', 1.6); seq(['st2', 'st1']); },
  };
  const W = WEIGHTS[mood] || WEIGHTS.normal;
  const pickAction = () => {
    let k = r() * Object.values(W).reduce((a, b) => a + b, 0);
    for (const [name, w] of Object.entries(W)) if ((k -= w) < 0) return name;
    return 'idle';
  };

  sitIdle(rand(3, 5));
  let last = 'idle';
  while (t < 44) {
    let a = pickAction();
    if (a === last && a !== 'walk') a = pickAction();
    actions[a](); last = a;
  }
  if (Math.abs(x - HOME) > 0.5) walkTo(HOME);
  if (facing !== 1) turn();
  sitIdle(rand(2, 3.5));
  return { L: t, vis, cam, dir };
}

// ---------- keyframes ----------
const pct = (t, L) => `${+(t / L * 100).toFixed(3)}%`;
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
function camKeyframes(name, cam, f, L) {
  const kf = cam.map(([t, x]) => `${pct(t, L)}{transform:translateX(${(-x * f * CELL).toFixed(1)}px)}`);
  kf.push(`100%{transform:translateX(${(-HOME * f * CELL).toFixed(1)}px)}`);
  return `@keyframes ${name}{${kf.join('')}}.${name}{animation:${name} ${L.toFixed(2)}s linear infinite}`;
}

// ---------- frames ----------
function tailVariants(base) {
  const b = base.tail.slice(), c = base.tail.slice();
  b[6] -= 1; b[7] += 2.2; c[6] -= 2; c[7] += 4; c[5] += 1;
  return [base.tail, b, c].map(tail => ({ ...base, tail }));
}
function buildFrames(rim) {
  const P = M.POSES, F = {};
  const full = (p, o) => M.frame(p, rim, o);
  F.walk = Array.from({ length: 8 }, (_, i) => full(M.walkPose(i / 8)));
  for (const k of ['sit', 'sitFront', 'yawn', 'lie', 'lieFront']) F[k] = full(P[k], { withTail: false });
  F.groom = [full(P.groomA, { withTail: false }), full(P.groomB, { withTail: false })];
  F.sleep = full(P.sleep);
  F.stretch = full(P.stretch);
  [1, 2, 3].forEach(i => {
    F[`ss${i}`] = full(M.blend(P.stand, P.sit, i / 4));
    F[`sl${i}`] = full(M.blend(P.sit, P.lie, i / 4));
  });
  F.st1 = full(M.blend(P.sit, P.stretch, 0.33));
  F.st2 = full(M.blend(P.sit, P.stretch, 0.66));
  F.sitTail = tailVariants(P.sit).map(p => full(p, { tailOnly: true }));
  F.lieTail = tailVariants(P.lie).map(p => full(p, { tailOnly: true }));
  return F;
}

// Cycles a set of child frames on its own short loop (walk cycle, grooming licks, tail flicks).
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

function blinkWrap(f) {
  return f.body + (f.blink ? `<g class="hb">${f.blink}</g>` : '');
}

// x, y: top-left of the viewport in the card. Returns { svg, css }.
function renderStage({ x: VX, y: VY, now, seed, mood, bubble }) {
  const tod = S.todOf(now);
  const r = S.rng(seed);
  const sceneName = S.pickScene(tod, S.rng(Math.floor(now / 10800000)));
  const sc = S.SCENES[sceneName](tod, S.rng(Math.floor(now / 10800000) * 31 + 7));
  const plan = choreograph(r, mood);
  const { L } = plan;
  const W = S.VW * CELL, H = S.VH * CELL;
  let css = sc.css;

  const layer = ([f, svg, raw], i) => {
    if (raw) return svg;
    css += camKeyframes(`cm${i}`, plan.cam, f, L);
    return `<g class="cm${i}"><g transform="scale(${CELL})">${svg}</g></g>`;
  };
  const back = sc.layers.map(layer).join('\n');
  const front = sc.fg.map((l, i) => layer(l, 100 + i)).join('\n');

  // Hungry: an empty bowl waits in front of her usual spot.
  let bowl = '';
  if (mood === 'hungry') {
    const bx = (HOME + 40) * CELL + 150, by = sc.GY * CELL;
    bowl = `<g class="cm${sc.layers.length - 1}"><ellipse cx="${bx}" cy="${by - 4}" rx="16" ry="5" fill="#2f5d8c"/><rect x="${bx - 16}" y="${by - 9}" width="32" height="5" fill="#3b6ea8"/><ellipse cx="${bx}" cy="${by - 9}" rx="16" ry="3" fill="#1d3550"/></g>`;
  }

  const F = buildFrames(S.RIM[tod]);
  const parts = [];
  const vis = (name, inner) => { css += visKeyframes(`v${name}`, plan.vis[name] || [], L); parts.push(`<g class="v${name}">${inner}</g>`); };
  const walk = cycle('wc', F.walk, WALK_T);
  css += walk.css;
  const groom = cycle('gr', F.groom.map(f => ({ body: f.body })), 0.9);
  css += groom.css;
  // Tail flicks: rest, lift, flick, lift.
  const flick = ([a, b, c]) => [a, b, c, b];
  const sitTail = cycle('tsa', flick(F.sitTail), 5.2, [16, 1, 2, 1]);
  const lieTail = cycle('tla', flick(F.lieTail), 3.4, [9, 1, 2, 1]);
  css += sitTail.css + lieTail.css;
  if (plan.vis.walk) vis('walk', walk.body);
  if (plan.vis.groom) vis('groom', groom.body);
  for (const k of ['sit', 'sitFront', 'yawn', 'lie', 'lieFront', 'sleep', 'stretch', 'ss1', 'ss2', 'ss3', 'sl1', 'sl2', 'sl3', 'st1', 'st2'])
    if (plan.vis[k]) vis(k, blinkWrap(F[k]));
  if (plan.vis.sitTail) vis('sitTail', sitTail.body);
  if (plan.vis.lieTail) vis('lieTail', lieTail.body);

  const catX = 300, sy = sc.GY * CELL - M.ROWS * CELL;
  const pivot = catX + M.OX * CELL;
  css += `@keyframes face{${plan.dir.map(([t, d]) => `${pct(t, L)}{transform:scaleX(${d})}`).join('')}}.face{transform-origin:${pivot}px 0;animation:face ${L.toFixed(2)}s steps(1,end) infinite}`;
  css += '.hb{opacity:0;animation:hb 4.7s steps(1,end) infinite}@keyframes hb{0%{opacity:0}91%{opacity:1}94%{opacity:0}}';

  const shadow = `<ellipse cx="${catX + M.OX * CELL - 6}" cy="${sc.GY * CELL + 1}" rx="54" ry="4" fill="#000" opacity=".28"/>`;
  const cat = `<g class="face"><g transform="translate(${catX} ${sy}) scale(${CELL})" shape-rendering="crispEdges">${parts.join('\n')}</g></g>`;

  let extra = '';
  if (mood === 'sleepy') {
    extra = [[11, 0], [14, 1.2], [17, 2.4]].map(([s, d], i) =>
      `<text class="zz" x="${catX + M.OX * CELL + 50 + i * 10}" y="${sy + 50 - i * 6}" font-size="${s}" font-weight="700" fill="#e8ecf8" style="animation-delay:${d}s">z</text>`).join('');
    css += '.zz{opacity:0;animation:zz 3.6s ease-out infinite}@keyframes zz{0%{opacity:0;transform:none}20%{opacity:.9}100%{opacity:0;transform:translate(14px,-22px)}}';
  }
  if (bubble) {
    const bw = [...bubble.text].length * 8 + 20, bx = catX + M.OX * CELL - bw / 2 + 20, byy = sy - 6;
    extra += `<g class="bob"><rect x="${bx}" y="${byy}" width="${bw}" height="24" rx="8" fill="#16050d" fill-opacity=".85" stroke="${bubble.color}"/>
<path d="M${bx + bw / 2 - 6} ${byy + 24} l6 8 l6 -8z" fill="${bubble.color}"/>
<text x="${bx + bw / 2}" y="${byy + 16}" font-size="13" text-anchor="middle" fill="${bubble.color}">${bubble.text}</text></g>`;
  }

  const svg = `<defs>${sc.defs}<clipPath id="stage"><rect x="0" y="0" width="${W}" height="${H}" rx="6"/></clipPath></defs>
<g transform="translate(${VX} ${VY})"><g clip-path="url(#stage)">
${sc.back}
${back}
${bowl}
${shadow}
${cat}
${front}
${extra}
</g><rect x=".5" y=".5" width="${W - 1}" height="${H - 1}" rx="6" fill="none" stroke="#ff2266" stroke-opacity=".45"/></g>`;
  return { svg, css, scene: sceneName, tod, L };
}

module.exports = { renderStage };
