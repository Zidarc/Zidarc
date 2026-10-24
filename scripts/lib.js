// Shared pieces for every terminal-style SVG card: theme, window chrome, typing effect, pixel cat.
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const HOST = 'zidarc';
const CW = 9; // character width; typed lines are forced to it with textLength
const FAMILY = `'JetBrains Mono','Fira Code','Cascadia Code',Consolas,'DejaVu Sans Mono',Menlo,monospace`;
const C = {
  bg: '#0d0008', bar: '#16050d', text: '#ffe0e8', key: '#ff2266', pink: '#ff6f91',
  dim: '#7a3a4c', gold: '#ffcc33', fur: '#1f0712', chest: '#3a0f20', track: '#24060f',
};
const RAMP = ['#2a0a14', '#4d0f24', '#880022', '#c4143f', '#ff2266', '#ff6f91', '#ffb3c6', '#ffe0e8'];

const esc = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const write = (rel, s) => fs.writeFileSync(path.join(ROOT, rel), s);

// Greedy word wrap to a column width.
function wrap(text, width) {
  const lines = [];
  let line = '';
  for (const word of text.split(' ')) {
    if (line && (line + ' ' + word).length > width) { lines.push(line); line = word; }
    else line = line ? line + ' ' + word : word;
  }
  return [...lines, line];
}

// ---------- terminal text ----------
const X0 = 30;
const promptText = `ali@${HOST}`;
const PROMPT_W = (promptText.length + 5) * CW; // "ali@host ~ $ "
const prompt = y => `<text x="${X0}" y="${y}" textLength="${(promptText.length + 4) * CW}" lengthAdjust="spacing" xml:space="preserve"><tspan fill="${C.key}" font-weight="700">${promptText}</tspan><tspan fill="${C.pink}"> ~ </tspan><tspan fill="${C.text}">$</tspan></text>`;
const show = (t, body) => `<g class="show" style="animation-delay:${t}s">${body}</g>`;
const cursor = (x, y) => `<rect class="cur" x="${x}" y="${y - 13}" width="${CW}" height="17" fill="${C.key}"/>`;

// Text revealed char by char by sliding a background-coloured cover with the cursor on its edge.
function typer() {
  let n = 0;
  const kf = [];
  return {
    typed(x, y, str, start, dur, hideAt) {
      const id = ++n, len = [...str].length, w = len * CW;
      kf.push(`@keyframes ty${id}{to{transform:translateX(${w}px)}}`);
      const anim = `ty${id} ${dur}s steps(${len}) ${start}s forwards` + (hideAt != null ? `, hide .01s linear ${hideAt}s forwards` : '');
      return `<text x="${x}" y="${y}" textLength="${w}" lengthAdjust="spacing" fill="${C.text}">${esc(str)}</text>
<g style="animation:${anim}"><rect x="${x + CW}" y="${y - 15}" width="${w + CW * 2}" height="21" fill="${C.bg}"/>${cursor(x, y)}</g>`;
    },
    // A prompt line that types a command, then hides its cursor.
    command(y, cmd, start, dur, hideAt) {
      return prompt(y) + this.typed(X0 + PROMPT_W, y, cmd, start, dur, hideAt);
    },
    css: () => kf.join('\n'),
  };
}

// ---------- pixel art ----------
function pixels(rows, ox, oy, P, colors, wrapRow) {
  return rows.map((row, r) => {
    const ch = [...row];
    let out = '', c = 0;
    while (c < ch.length) {
      const k = ch[c];
      if (!colors[k]) { c++; continue; }
      const s = c;
      while (c < ch.length && ch[c] === k) c++;
      out += `<rect x="${ox + s * P}" y="${oy + r * P}" width="${(c - s) * P}" height="${P}" fill="${colors[k]}"/>`;
    }
    return wrapRow ? wrapRow(out, r) : out;
  }).join('\n');
}

const CAT = [
  '.O..........O.',
  '.OO........OO.',
  '.OPO......OPO.',
  '.OPPOOOOOOPPO.',
  'OFFFFFFFFFFFFO',
  'OFFFFFFFFFFFFO',
  'OFFEEFFFFEEFFO',
  'OFFEEFFFFEEFFO',
  'OFFFFFNNFFFFFO',
  'OFFFFOFFOFFFFO',
  '.OFFFFOOFFFFO.',
  '..OOFFFFFFOO..',
  '..OFFFFFFFFO..',
  '.OFFFWWWWFFFO.',
  '.OFFFWWWWFFFO.',
  '.OFFFFWWFFFFO.',
  '.OFFOFFFFOFFO.',
  '.OOOOOOOOOOOO.',
];
const CAT_COL = { O: C.key, F: C.fur, E: C.fur, P: C.pink, N: C.pink, W: C.chest };
// Two tail frames (columns 12..18, rows 11..17) swapped for a pixel-art swish.
const TAIL_A = ['....O..', '...OFO.', '...OFO.', '..OFFO.', '.OFFO..', 'OFFO...', 'OOO....'];
const TAIL_B = ['.......', '.....OO', '....OFO', '...OFO.', '.OOFFO.', 'OFFFO..', 'OOOO...'];
const HEART = ['.XX.XX.', 'XXXXXXX', 'XXXXXXX', '.XXXXX.', '..XXX..', '...X...'];

// mood: normal | hungry | happy | bored | sleepy. revealAt: seconds to start a row-by-row draw-in.
function catSprite({ x, y, P, mood = 'normal', revealAt = null }) {
  const wrap = (r, s) => revealAt == null ? s : `<g class="fi" style="animation-delay:${(revealAt + r * 0.04).toFixed(2)}s">${s}</g>`;
  const px = (c, r, w, h, fill) => `<rect x="${x + c * P}" y="${y + r * P}" width="${w * P}" height="${h * P}" fill="${fill}"/>`;
  const tx = x + 12 * P, ty = y + 11 * P;
  const tail = `<g class="fa">${pixels(TAIL_A, tx, ty, P, CAT_COL)}</g><g class="fb">${pixels(TAIL_B, tx, ty, P, CAT_COL)}</g>`;
  const wt = Math.max(2, Math.round(P / 4));
  const whiskers = [8, 9].map(r =>
    `<rect x="${x - 2 * P}" y="${y + r * P + (P - wt) / 2}" width="${2 * P}" height="${wt}" fill="${C.dim}"/>` +
    `<rect x="${x + 14 * P}" y="${y + r * P + (P - wt) / 2}" width="${2 * P}" height="${wt}" fill="${C.dim}"/>`).join('');
  let eyes;
  switch (mood) {
    case 'happy': eyes = px(3, 6, 2, 1, C.gold) + px(9, 6, 2, 1, C.gold) + px(2, 8, 1, 1, C.pink) + px(11, 8, 1, 1, C.pink); break;
    case 'sleepy': eyes = px(3, 7, 2, 1, C.dim) + px(9, 7, 2, 1, C.dim); break;
    case 'bored': eyes = px(3, 7, 2, 1, C.gold) + px(9, 7, 2, 1, C.gold) + px(4, 7, 1, 1, C.bg) + px(10, 7, 1, 1, C.bg); break;
    default: eyes = `<g class="blink">${px(3, 6, 2, 2, C.gold)}${px(9, 6, 2, 2, C.gold)}<g class="look">${px(4, 6, 1, 2, C.bg)}${px(10, 6, 1, 2, C.bg)}</g></g>`;
  }
  return `<g shape-rendering="crispEdges">${wrap(11, tail)}
${pixels(CAT, x, y, P, CAT_COL, (s, r) => wrap(r, s))}
${wrap(8, whiskers)}${wrap(6, eyes)}</g>`;
}

const catCss = (P, start) => `
.blink{transform-box:fill-box;transform-origin:center;animation:shut 4.5s ${start}s infinite}
.look{animation:look 7s ${start + 0.5}s infinite steps(1,end)}
.fa{animation:fa 1.4s steps(1,end) infinite}
.fb{opacity:0;animation:fb 1.4s steps(1,end) infinite}
@keyframes shut{0%,90%,100%{transform:scaleY(1)}93%,96%{transform:scaleY(.12)}}
@keyframes look{0%{transform:translateX(0)}40%{transform:translateX(-${P}px)}70%{transform:translateX(0)}}
@keyframes fa{0%{opacity:1}50%{opacity:0}}
@keyframes fb{0%{opacity:0}50%{opacity:1}}`;

// A row of pixel blocks that fill in one by one (used for meters).
function blockBar(x, y, value, start, { n = 20, w = 11, gap = 3, h = 12 } = {}) {
  const on = Math.round((value / 100) * n);
  return Array.from({ length: n }, (_, i) => i < on
    ? `<rect class="fi" style="animation-delay:${(start + i * 0.05).toFixed(2)}s" x="${x + i * (w + gap)}" y="${y - h + 1}" width="${w}" height="${h}" fill="${C.key}"/>`
    : `<rect x="${x + i * (w + gap)}" y="${y - h + 1}" width="${w}" height="${h}" fill="${C.track}"/>`).join('');
}

// ---------- window chrome ----------
function embers(n, w, h, seed) {
  const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
  return Array.from({ length: n }, () => {
    const s = 2 + Math.floor(rnd() * 2), dur = 7 + rnd() * 7;
    return `<rect class="ember" x="${(20 + rnd() * (w - 40)).toFixed(0)}" y="${h - 20}" width="${s}" height="${s}" fill="${rnd() > 0.5 ? C.key : C.pink}" style="animation-duration:${dur.toFixed(1)}s;animation-delay:-${(rnd() * dur).toFixed(1)}s"/>`;
  }).join('\n');
}

function chrome({ w, h, title, body, css = '', emberCount = 10, seed = 11, label = 'zsh' }) {
  const baseCss = `
.show{opacity:0;animation:show .01s linear forwards}
.fi{animation:fadein .2s ease-out both}
.slide{animation:slide .35s ease-out both}
.cur{animation:blink 1s step-end infinite}
.ember{animation:rise linear infinite}
@keyframes show{to{opacity:1}}
@keyframes hide{to{opacity:0}}
@keyframes fadein{from{opacity:0}to{opacity:1}}
@keyframes slide{from{opacity:0;transform:translateX(-8px)}to{opacity:1;transform:none}}
@keyframes blink{50%{opacity:0}}
@keyframes rise{0%{opacity:0;transform:translate(0,0)}15%{opacity:.6}100%{opacity:0;transform:translate(18px,-${h - 40}px)}}`;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}" font-family="${FAMILY}" font-size="15">
<title>${esc(title)}</title>
<style>${baseCss}${css}</style>
<defs>
  <clipPath id="win"><rect x="10" y="10" width="${w - 20}" height="${h - 20}" rx="12"/></clipPath>
  <filter id="glow" x="-10%" y="-10%" width="120%" height="120%"><feGaussianBlur stdDeviation="5"/></filter>
  <radialGradient id="vign" cx="20%" cy="45%" r="70%"><stop offset="0" stop-color="${C.key}" stop-opacity=".09"/><stop offset="1" stop-color="${C.key}" stop-opacity="0"/></radialGradient>
  <pattern id="scan" width="4" height="4" patternUnits="userSpaceOnUse"><rect width="4" height="1" fill="#fff" opacity=".025"/></pattern>
</defs>
<rect x="10" y="10" width="${w - 20}" height="${h - 20}" rx="12" fill="none" stroke="${C.key}" stroke-width="3" opacity=".45" filter="url(#glow)"/>
<g clip-path="url(#win)">
  <rect x="10" y="10" width="${w - 20}" height="${h - 20}" fill="${C.bg}"/>
  ${embers(emberCount, w, h, seed)}
  <rect x="10" y="10" width="${w - 20}" height="34" fill="${C.bar}"/>
  <rect x="10" y="44" width="${w - 20}" height="1" fill="${C.key}" opacity=".35"/>
  <text x="${w / 2}" y="32" text-anchor="middle" font-size="13" fill="${C.text}" opacity=".75">${esc(title)}</text>
  <text x="26" y="32" font-size="12" fill="${C.dim}">▸_ ${esc(label)}</text>
  <g stroke="${C.text}" stroke-width="1.6" fill="none" opacity=".7"><line x1="${w - 92}" y1="28" x2="${w - 80}" y2="28"/><rect x="${w - 64}" y="21" width="11" height="11"/></g>
  <circle cx="${w - 31}" cy="27" r="8" fill="${C.key}"/>
  <g stroke="${C.bg}" stroke-width="2"><line x1="${w - 34.5}" y1="23.5" x2="${w - 27.5}" y2="30.5"/><line x1="${w - 27.5}" y1="23.5" x2="${w - 34.5}" y2="30.5"/></g>
  ${body}
  <rect x="10" y="10" width="${w - 20}" height="${h - 20}" fill="url(#vign)"/>
  <rect x="10" y="10" width="${w - 20}" height="${h - 20}" fill="url(#scan)"/>
</g>
<rect x="10.5" y="10.5" width="${w - 21}" height="${h - 21}" rx="12" fill="none" stroke="${C.key}" stroke-opacity=".7"/>
</svg>
`;
}

const fmtDate = d => new Date(d).toISOString().slice(0, 16).replace('T', ' ') + ' UTC';

module.exports = {
  ROOT, HOST, CW, C, RAMP, X0, PROMPT_W, esc, write, wrap, prompt, show, cursor, typer,
  pixels, catSprite, catCss, HEART, blockBar, chrome, fmtDate,
};
