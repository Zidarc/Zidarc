// assets/hero.svg — animated neofetch terminal with a pixel black cat.
// Edit INFO below, then push (the build workflow regenerates it) or run: node scripts/hero.js
const L = require('./lib');
const { C, CW, X0, PROMPT_W, esc } = L;

const INFO = [
  ['OS', 'Fedora Linux · KDE Plasma'],
  ['Host', 'FAST NUCES, Karachi'],
  ['Degree', 'BS Computer Science'],
  ['Editor', 'VS Code'],
  ['Langs', 'C · C++ · TypeScript · JavaScript · Python'],
  ['Stack', 'React · Node · Express · Supabase · Postgres'],
  ['Tools', 'Git · Linux · Vite · Figma'],
  ['Into', 'full-stack web · systems · real-time · low-level C'],
  ['Building', 'real-time collaborative workspace'],
  ['Fuel', 'chai · lo-fi · late-night commits'],
  ['Pet', '1 black cat (currently judging your code)'],
];

function renderHero() {
  const T = L.typer();
  const P = 11, CAT_X = 56, CAT_Y = 128, CAT_T = 1.5, PET_T = 5.9, CMD2_T = 3.9;
  const IX = 300, IY = 132, LH = 22, INFO_T = 1.7;
  // The second command sits below whichever is taller: the cat or the info column.
  const L1 = 74, L2 = Math.max(420, IY + (INFO.length + 2) * LH + 46), L3 = L2 + 24, L4 = L3 + 24, L5 = L4 + 24;
  const W = 900, H = L5 + 23;

  const hearts = [[-26, 0], [2, 0.8], [26, 1.6]].map(([dx, d]) =>
    `<g class="heart" style="animation-delay:${(PET_T + d).toFixed(1)}s">${L.pixels(L.HEART, CAT_X + 7 * P - 14 + dx, CAT_Y - 30, 4, { X: C.key })}</g>`).join('\n');

  const infoLines = [
    `<text x="${IX}" y="${IY}" font-weight="700"><tspan fill="${C.key}">ali</tspan><tspan fill="${C.text}">@</tspan><tspan fill="${C.key}">${L.HOST}</tspan></text>`,
    `<text x="${IX}" y="${IY + LH}" fill="${C.dim}">${'─'.repeat(24)}</text>`,
    ...INFO.map(([k, v], i) => {
      const y = IY + (i + 2) * LH;
      return `<text x="${IX}" y="${y}" fill="${C.key}" font-weight="700">${esc(k)}:</text><text x="${IX + 11 * CW}" y="${y}" fill="${C.text}">${esc(v)}</text>`;
    }),
  ].map((s, i) => `<g class="slide" style="animation-delay:${(INFO_T + i * 0.14).toFixed(2)}s">${s}</g>`).join('\n');

  const blocksT = INFO_T + (INFO.length + 2) * 0.14 + 0.1;
  const blockY = IY + (INFO.length + 2) * LH - 6;
  const blocks = L.RAMP.map((c, i) =>
    `<rect class="fi" style="animation-delay:${(blocksT + i * 0.06).toFixed(2)}s" x="${IX + i * 28}" y="${blockY}" width="26" height="16" fill="${c}"/>`).join('');

  const barX = X0 + 22 * CW;
  const output = `
${L.show(PET_T, `<text x="${X0}" y="${L3}" textLength="${20 * CW}" lengthAdjust="spacing" xml:space="preserve"><tspan fill="${C.key}">♥</tspan><tspan fill="${C.text}"> purrrr~  happiness</tspan></text>`)}
${L.blockBar(barX, L3, 100, PET_T + 0.1, { n: 10, w: 9, gap: 3, h: 11 })}
${L.show(PET_T + 0.85, `<text x="${barX + 128}" y="${L3}" fill="${C.text}" font-weight="700">100%</text>`)}
${L.show(PET_T + 1.1, `<text x="${X0}" y="${L4}" fill="${C.dim}">welcome to my profile. scroll down, the cat insists.</text>`)}
${L.show(PET_T + 1.4, L.prompt(L5) + L.cursor(X0 + PROMPT_W, L5))}`;

  const body = `
${T.command(L1, 'neofetch --cat', 0.6, 0.9, CAT_T)}
${L.catSprite({ x: CAT_X, y: CAT_Y, P, revealAt: CAT_T })}
${hearts}
${infoLines}
${blocks}
${L.show(CMD2_T, T.command(L2, 'sudo pet --cat', CMD2_T + 0.4, 0.9, PET_T))}
${output}`;

  const css = L.catCss(P, 3) + `
.heart{animation:heart 2.4s ease-out infinite both}
@keyframes heart{0%{opacity:0;transform:translateY(0)}20%{opacity:1}100%{opacity:0;transform:translateY(-18px)}}
${T.css()}`;

  return L.chrome({ w: W, h: H, title: `ali@${L.HOST}: ~ — Konsole`, body, css, emberCount: 16 });
}

module.exports = renderHero;
if (require.main === module) L.write('assets/hero.svg', renderHero());
