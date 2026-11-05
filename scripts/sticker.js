// assets/stickers/<login>.svg: a "friend of Billo" card for each visitor, with a cat coloured from their username.
// Visitors paste it into their own README; it links back to this profile.
const M = require('./scene/cat-model');
const { C, esc } = require('./lib');

const hash = s => { let h = 2166136261; for (const ch of s) { h ^= ch.charCodeAt(0); h = Math.imul(h, 16777619); } return h >>> 0; };
const hslHex = (h, s, l) => {
  l = Math.max(0, Math.min(1, l)); s = Math.max(0, Math.min(1, s));
  const k = n => (n + h / 30) % 12, a = s * Math.min(l, 1 - l);
  const f = n => Math.round(255 * (l - a * Math.max(-1, Math.min(k(n) - 3, 9 - k(n), 1))));
  return '#' + [f(0), f(8), f(4)].map(v => v.toString(16).padStart(2, '0')).join('');
};

// Same username, same cat: fur hue and shade, eye colour and card colour all come from the hash.
function palette(user) {
  const h = hash(user.toLowerCase());
  const hue = h % 360, sat = 0.15 + ((h >>> 9) % 50) / 100, base = [0.08, 0.2, 0.34, 0.5][(h >>> 15) % 4];
  const eye = (hue + 140 + ((h >>> 19) % 80)) % 360;
  return {
    hue,
    pal: {
      0: hslHex(hue, sat, base), 1: hslHex(hue, sat, base + 0.06), 2: hslHex(hue, sat, base + 0.12), 3: hslHex(hue, sat, base + 0.2),
      4: hslHex(hue, sat + 0.2, base + 0.38), e: hslHex(eye, 0.85, 0.6), E: hslHex(eye, 0.85, 0.42),
    },
  };
}

function renderSticker({ user, no, visits, since, badges, avatar, profile }) {
  const { hue, pal } = palette(user);
  const accent = hslHex(hue, 0.85, 0.65), deep = hslHex(hue, 0.5, 0.1);
  const f = M.frame(M.POSES.sitFront, { pal });
  const pic = avatar ? avatar(344, 22, 5) : `<rect x="344" y="22" width="50" height="50" fill="${deep}"/>`;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="420" height="150" viewBox="0 0 420 150" font-family="'JetBrains Mono','Fira Code',Consolas,monospace">
<style>.hb{opacity:0;animation:hb 4.7s steps(1,end) infinite}@keyframes hb{0%{opacity:0}91%{opacity:1}94%{opacity:0}}
.bob{animation:bob 2.6s ease-in-out infinite}@keyframes bob{50%{transform:translateY(-2px)}}
.glow{animation:gl 3s ease-in-out infinite}@keyframes gl{50%{stroke-opacity:.2}}</style>
<defs><linearGradient id="bg" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${deep}"/><stop offset="1" stop-color="${C.bg}"/></linearGradient></defs>
<rect class="glow" x="3" y="3" width="414" height="144" rx="14" fill="none" stroke="${accent}" stroke-width="5" stroke-opacity=".45"/>
<rect x="3" y="3" width="414" height="144" rx="14" fill="url(#bg)" stroke="${accent}" stroke-width="1.5"/>
<ellipse cx="72" cy="131" rx="38" ry="4" fill="#000" opacity=".35"/>
<g class="bob"><g transform="translate(-21 28) scale(3)" shape-rendering="crispEdges">${f.body}<g class="hb">${f.blink}</g></g></g>
<rect x="341" y="19" width="56" height="56" fill="none" stroke="${accent}" stroke-opacity=".6"/>${pic}
<text x="150" y="40" font-size="20" font-weight="700" fill="${C.text}">@${esc(user.length > 15 ? user.slice(0, 14) + '…' : user)}</text>
<text x="150" y="66" font-size="14" fill="${accent}" font-weight="700">friend of Billo #${no}</text>
<text x="150" y="88" font-size="12" fill="${C.text}" opacity=".8">${visits} visit${visits === 1 ? '' : 's'} · since ${since.slice(0, 10)}</text>
<text x="150" y="112" font-size="16">${badges.join(' ')}</text>
<text x="150" y="134" font-size="11" fill="${C.pink}">feed her too → github.com/${esc(profile)}</text>
</svg>
`;
}

module.exports = { renderSticker, palette };
