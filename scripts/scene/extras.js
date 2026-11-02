// Things layered onto Huna's walk from the real world: the viewer's theme (day/night), Karachi's weather, the season,
// the friends who visited (polaroids on a string), secret-command effects and party confetti.
// Each effect returns { back, front, css, defs, lines }: back sits over the sky, front over everything but her speech.
const S = require('./scenes');

const { VW, VH, GY } = S;
const CELL = 3, W = VW * CELL, H = VH * CELL;

// ---------- day mode: the same night scene, relit ----------
function hsl([r, g, b]) {
  r /= 255; g /= 255; b /= 255;
  const mx = Math.max(r, g, b), mn = Math.min(r, g, b), l = (mx + mn) / 2, d = mx - mn;
  if (!d) return [0, 0, l];
  const s = d / (1 - Math.abs(2 * l - 1));
  const h = mx === r ? ((g - b) / d + 6) % 6 : mx === g ? (b - r) / d + 2 : (r - g) / d + 4;
  return [h * 60, s, l];
}
function rgb([h, s, l]) {
  const c = (1 - Math.abs(2 * l - 1)) * s, x = c * (1 - Math.abs(((h / 60) % 2) - 1)), m = l - c / 2;
  const [r, g, b] = h < 60 ? [c, x, 0] : h < 120 ? [x, c, 0] : h < 180 ? [0, c, x] : h < 240 ? [0, x, c] : h < 300 ? [x, 0, c] : [c, 0, x];
  return [r, g, b].map(v => (v + m) * 255);
}
const dayCache = new Map();
function dayColor(c) {
  if (dayCache.has(c)) return dayCache.get(c);
  const [r, g, b] = S.hex(c);
  let out;
  if (r > 200 && g > 120 && b < 170 && r > b + 60) out = '#cfe2ef'; // lit windows become sky reflections
  else {
    const [h, s, l] = hsl([r, g, b]);
    out = l > 0.62 ? c : S.toHex(rgb([h, Math.min(1, s * 1.1 + 0.06), 0.2 + l * 1.6]));
  }
  dayCache.set(c, out);
  return out;
}
const dayify = svg => svg.replace(/#[0-9a-fA-F]{6}\b/g, dayColor);
// Night-only glows that make no sense at noon.
const DAY_CSS = '.dayst .ff,.dayst .lhA,.dayst .lhB,.dayst .au,.dayst .au2,.dayst .lg,.dayst .fl,.dayst .tw{display:none}';

// ---------- helpers ----------
const scaled = s => `<g transform="scale(${CELL})">${s}</g>`;
const esc = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const empty = () => ({ back: '', front: '', css: '', defs: '', lines: [] });
// The string across the top of the stage that polaroids and bunting hang from (px).
const stringY = x => 5 + 14 * (x / W) * (1 - x / W) * 4 * 0.5;
const STRING = `<path d="M0 ${stringY(0)}${Array.from({ length: 29 }, (_, i) => ` L${(i + 1) * 30} ${stringY((i + 1) * 30).toFixed(1)}`).join('')}" stroke="#2a1a22" stroke-width="1.2" fill="none" opacity=".9"/>`;

// ---------- weather (Open-Meteo WMO codes) ----------
function weatherKind(code) {
  if (code == null) return null;
  if (code >= 95) return 'storm';
  if ((code >= 51 && code <= 67) || (code >= 80 && code <= 82)) return 'rain';
  if ((code >= 71 && code <= 77) || code === 85 || code === 86) return 'snow';
  if (code === 45 || code === 48) return 'fog';
  if (code === 3) return 'cloudy';
  return code <= 1 ? 'clear' : 'partly';
}
const WEATHER_LABEL = { clear: '☀ clear', partly: '⛅ partly cloudy', cloudy: '☁ overcast', fog: '≋ hazy', rain: '☂ raining', storm: '⚡ thunderstorm', snow: '❄ snowing' };
const WEATHER_LINES = {
  rain: ['rain in karachi!', 'wet paws…', 'drip drop', 'i hate rain'],
  storm: ['*hides from thunder*', 'BOOM?!', 'scary sky…'],
  snow: ['snow in karachi?!', 'cold paws!'],
  fog: ['so foggy…', 'where did the city go'],
  cloudy: ['grey sky today', 'cloudy…'],
  clear: [], partly: [],
};

function streaks(id, r, n, col, dur, dx, len = 3) {
  const cv = S.canvas();
  for (let i = 0; i < n; i++) cv.rect(S.ri(r, 0, VW + Math.abs(dx)), S.ri(r, 0, VH - 1), 1, len, col);
  return {
    defs: `<g id="${id}">${cv.svg()}</g>`,
    svg: scaled(`<g class="${id}"><use href="#${id}"/><use href="#${id}" y="-${VH}"/></g>`),
    css: `.${id}{animation:${id} ${dur}s linear infinite}@keyframes ${id}{to{transform:translate(${dx}px,${VH}px)}}`,
  };
}

function weatherFx(r, kind, day) {
  const fx = empty();
  if (!kind) return fx;
  fx.lines = WEATHER_LINES[kind] || [];
  const dim = (o, col = '#05060c') => `<rect width="${W}" height="${H}" fill="${day ? '#5a6a80' : col}" opacity="${o}"/>`;
  if (kind === 'rain' || kind === 'storm') {
    const a = streaks('rnA', r, 140, day ? '#e8f2ff|0.55' : '#9fb4d8|0.45', 0.9, -10), b = streaks('rnB', r, 60, day ? '#ffffff|0.7' : '#c6d4ee|0.6', 0.6, -16, 4);
    fx.back = dim(day ? 0.35 : 0.3);
    fx.front = dim(day ? 0.12 : 0.15) + a.svg + b.svg;
    fx.defs = a.defs + b.defs;
    fx.css = a.css + b.css;
    if (kind === 'storm') {
      fx.front += `<rect class="lt" width="${W}" height="${H}" fill="#eef2ff"/>`;
      fx.css += '.lt{opacity:0;animation:lt 7.3s linear infinite}@keyframes lt{0%,90%,100%{opacity:0}91%{opacity:.55}92%{opacity:0}93.5%{opacity:.35}95%{opacity:0}}';
    }
  } else if (kind === 'snow') {
    const a = S.fall('wsA', r, 120, ['#ffffff|0.8', '#dfe8ff|0.6'], 11, -14);
    fx.front = a.svg; fx.defs = a.defs; fx.css = a.css;
  } else if (kind === 'fog') {
    fx.front = [0, 1, 2].map(i => `<rect class="fog fog${i}" x="-${W}" y="${60 + i * 46}" width="${W * 3}" height="${36 + i * 10}" fill="${day ? '#ffffff' : '#8a94b0'}" opacity="${(day ? 0.05 : 0.06) + i * (day ? 0.02 : 0.025)}"/>`).join('') + `<rect width="${W}" height="${H}" fill="${day ? '#eef2f6' : '#6a7290'}" opacity="${day ? 0.03 : 0.04}"/>`;
    fx.css = '.fog{animation:fog 40s ease-in-out infinite alternate}.fog1{animation-duration:55s}.fog2{animation-duration:33s}@keyframes fog{to{transform:translateX(220px)}}';
  } else if (kind === 'cloudy') {
    fx.back = dim(day ? 0.25 : 0.2);
  }
  return fx;
}

// ---------- seasons (Pakistan time) ----------
const EID = ['2026-03-20', '2026-05-27', '2027-03-10', '2027-05-17', '2028-02-27', '2028-05-05', '2029-02-14', '2029-04-24', '2030-02-04', '2030-04-13'];
function season(now, birthday) {
  const d = new Date(now.getTime() + 5 * 3600000).toISOString(), ymd = d.slice(0, 10), md = d.slice(5, 10);
  if (birthday && md === birthday) return { id: 'birthday', hat: 'party', label: '🎂 birthday!' };
  if (md >= '12-31' || md <= '01-02') return { id: 'newyear', hat: 'party', label: '✨ happy new year' };
  if (EID.some(e => { const dd = (new Date(ymd) - new Date(e)) / 86400000; return dd >= -1 && dd <= 2; })) return { id: 'eid', hat: 'cap', label: '☪ eid mubarak' };
  if (md >= '08-13' && md <= '08-15') return { id: 'azadi', hat: null, label: '♥ jashn-e-azadi' };
  if (md >= '10-15' && md <= '11-05') return { id: 'halloween', hat: 'witch', label: '🎃 spooky season' };
  if (md >= '12-01') return { id: 'winter', hat: md >= '12-15' ? 'santa' : null, label: '❄ winter' };
  return null;
}
const SEASON_LINES = {
  birthday: ['happy birthday Ali!', 'cake?!', 'birthday purrs ♥'],
  newyear: ['happy new year!', 'new year, new fish', 'ooh fireworks'],
  eid: ['eid mubarak!', 'eidi pls?', 'chaand raat ✧'],
  azadi: ['pakistan zindabad!', 'happy 14 august', 'green and white ♥'],
  halloween: ['boo!', 'trick or treat?', 'i am a witch now', 'spooky~'],
  winter: ['cold nose', 'merry meowmas', 'cozy season'],
};

// Little things hung along the string, every `gap` px from x0.
function bunting(x0, gap, draw) {
  let s = '';
  for (let x = x0, i = 0; x < W - 10; x += gap, i++) s += `<g transform="translate(${x} ${stringY(x).toFixed(1)})">${draw(i, x)}</g>`;
  return s;
}
const pennant = col => `<path d="M-7 0h14l-7 13z" fill="${col}"/><path d="M-7 0h14" stroke="#000" stroke-opacity=".25"/>`;
const pumpkin = () => `<rect x="-1" y="0" width="2" height="4" fill="#3a5a2a"/><rect x="-6" y="3" width="12" height="9" rx="3" fill="#ff8a2a"/><rect x="-2" y="3" width="4" height="9" fill="#e06a12"/><rect x="-4" y="6" width="2" height="2" fill="#3a1a05"/><rect x="2" y="6" width="2" height="2" fill="#3a1a05"/><rect x="-3" y="9" width="6" height="1" fill="#3a1a05"/>`;
const lantern = i => `<rect x="-.5" y="0" width="1" height="5" fill="#d89a26"/><g class="${i % 2 ? 'lgA' : 'lgB'}"><circle cx="0" cy="11" r="9" fill="#ffcf73" opacity=".18"/></g><rect x="-4" y="5" width="8" height="2" fill="#d89a26"/><rect x="-5" y="7" width="10" height="8" fill="#ffcf73"/><rect x="-5" y="7" width="2" height="8" fill="#d89a26"/><rect x="3" y="7" width="2" height="8" fill="#d89a26"/><rect x="-4" y="15" width="8" height="2" fill="#d89a26"/>`;
const bulb = (i, cols) => `<rect x="-.5" y="0" width="1" height="3" fill="#2a1a22"/><g class="${i % 2 ? 'blA' : 'blB'}"><circle cx="0" cy="6" r="5" fill="${cols[i % cols.length]}" opacity=".25"/><rect x="-2" y="3" width="4" height="5" rx="1.5" fill="${cols[i % cols.length]}"/></g>`;
const BLINK_CSS = '.blA,.lgA{animation:bl 2.2s steps(1,end) infinite}.blB,.lgB{animation:bl 2.2s steps(1,end) -1.1s infinite}@keyframes bl{50%{opacity:.35}}';

function bats(r) {
  const bat = k => `<g class="bt${k}"><path class="wA" d="M-6 -2 l3 2 l2 -1 l1 1 l1 -1 l2 1 l3 -2 l-1 3 l-3 0 l-2 1 l-2 -1 l-3 0z" fill="#120a14"/><path class="wB" d="M-6 2 l3 -1 l2 -1 l1 1 l1 -1 l2 1 l3 1 l-3 1 l-2 0 l-2 1 l-2 -1 l-2 0z" fill="#120a14"/></g>`;
  let svg = '', css = '.wB{opacity:0}.wA{animation:wf .36s steps(1,end) infinite}.wB{animation:wf .36s steps(1,end) -.18s infinite}@keyframes wf{50%{opacity:0}0%{opacity:1}}';
  for (let k = 0; k < 3; k++) {
    const y = S.ri(r, 30, 80), dur = (16 + r() * 10).toFixed(1), delay = -(r() * 20).toFixed(1);
    svg += `<g transform="translate(0 ${y})">${bat(k)}</g>`;
    css += `.bt${k}{animation:bt${k} ${dur}s linear ${delay}s infinite}@keyframes bt${k}{0%{transform:translate(-20px,0)}25%{transform:translate(${W * 0.25}px,-8px)}50%{transform:translate(${W * 0.5}px,6px)}75%{transform:translate(${W * 0.75}px,-6px)}100%{transform:translate(${W + 20}px,0)}}`;
  }
  return { svg, css };
}
function fireworks(r) {
  const cols = ['#ff6f91', '#ffd34d', '#59d0e8', '#9cff8a', '#ffffff'];
  let svg = '', css = '.fw{opacity:0;animation:fw 3.4s ease-out infinite}@keyframes fw{0%{opacity:0;transform:scale(.1)}8%{opacity:1}70%{opacity:.8;transform:scale(1)}100%{opacity:0;transform:scale(1.15) translateY(6px)}}';
  for (let k = 0; k < 4; k++) {
    const x = S.ri(r, 260, 800), y = S.ri(r, 25, 70), col = cols[k % cols.length];
    const dots = Array.from({ length: 12 }, (_, i) => { const a = (i / 12) * Math.PI * 2; return `<rect x="${(Math.cos(a) * 18).toFixed(1)}" y="${(Math.sin(a) * 18).toFixed(1)}" width="3" height="3" fill="${col}"/>`; }).join('');
    svg += `<g transform="translate(${x} ${y})"><g class="fw" style="animation-delay:-${(k * 0.85).toFixed(2)}s">${dots}</g></g>`;
  }
  return { svg, css };
}
function confetti(r, id = 'cfA') {
  const f = S.fall(id, r, 70, ['#ff6f91', '#ffd34d', '#59d0e8', '#9cff8a', '#c77dff'], 9, -20);
  return f;
}

function seasonFx(r, sz) {
  const fx = empty();
  if (!sz) return fx;
  fx.lines = SEASON_LINES[sz.id] || [];
  const X0 = 200;
  if (sz.id === 'halloween') {
    const b = bats(r);
    fx.back = b.svg; fx.css = b.css;
    fx.front = bunting(X0, 46, () => pumpkin());
  } else if (sz.id === 'azadi') {
    fx.front = bunting(X0, 26, i => pennant(i % 2 ? '#f4f4f4' : '#0b7a3b'));
  } else if (sz.id === 'eid') {
    fx.front = bunting(X0, 60, i => lantern(i));
    fx.back = `<path d="M604 30a14 14 0 1 0 14 18a11 11 0 1 1 -14 -18z" fill="#ffe680" opacity=".9"/>`;
    fx.css = BLINK_CSS;
  } else if (sz.id === 'winter') {
    fx.front = bunting(X0, 30, i => bulb(i, ['#ff5a6e', '#ffd34d', '#59d0e8', '#9cff8a']));
    const s = S.fall('xmA', r, 90, ['#ffffff|0.8', '#dfe8ff|0.6'], 12, -12);
    fx.front += s.svg; fx.defs = s.defs; fx.css = BLINK_CSS + s.css;
  } else if (sz.id === 'newyear') {
    const f = fireworks(r);
    fx.back = f.svg; fx.css = f.css;
    fx.front = bunting(X0, 26, i => pennant(['#ffd34d', '#ff6f91', '#59d0e8'][i % 3]));
  } else if (sz.id === 'birthday') {
    const c = confetti(r, 'cfB');
    fx.front = bunting(X0, 26, i => pennant(['#ff6f91', '#ffd34d', '#59d0e8', '#9cff8a'][i % 4])) + c.svg;
    fx.defs = c.defs; fx.css = c.css;
  }
  return fx;
}

// ---------- party (daily community goal reached) ----------
function partyFx(r) {
  const c = confetti(r), f = fireworks(r);
  return { back: f.svg, front: c.svg, css: c.css + f.css, defs: c.defs, lines: ['party!!', 'yay friends!', 'best day ever', 'confetti!'] };
}

// ---------- polaroids of recent visitors ----------
// friends: [{ user, avatar: (x, y, cell) => svg, or null }]. Avatars are 10×10, drawn at 3px like the rest of her world.
function polaroids(friends) {
  if (!friends.length) return empty();
  const front = friends.slice(0, 4).map((f, i) => {
    const x = 30 + i * 46, y = stringY(x);
    const name = f.user.length > 9 ? f.user.slice(0, 8) + '…' : f.user;
    const pic = f.avatar
      ? f.avatar(-15, 6, 3)
      : `<rect x="-15" y="6" width="30" height="30" fill="#3a2a40"/><rect x="-5" y="11" width="10" height="10" fill="#7a6a90"/><rect x="-10" y="24" width="20" height="12" fill="#7a6a90"/>`;
    return `<g transform="translate(${x} ${y.toFixed(1)})"><g class="pol" style="animation-delay:-${(i * 0.7).toFixed(1)}s">
<rect x="-18" y="3" width="36" height="44" fill="#f3efe6"/><rect x="-18" y="45" width="36" height="2" fill="#cfc8b8"/>${pic}
<text x="0" y="43" font-size="6.5" text-anchor="middle" fill="#4a3a44">@${esc(name)}</text><rect x="-2" y="-1" width="4" height="6" fill="#ff2266"/></g></g>`;
  }).join('');
  return { back: '', front, css: '.pol{animation:pol 4s ease-in-out infinite}@keyframes pol{0%,100%{transform:rotate(-4deg)}50%{transform:rotate(4deg)}}', defs: '', lines: [] };
}

// ---------- secret commands ----------
const SPECIAL_LINES = {
  catnip: ['✧ catnip!!! ✧', 'WHEEE', 'i can see sounds', 'everything is sparkly', 'zoomies!!'],
  laser: ['dot!!', 'DOT!!!', 'i will get u', 'red dot… mine', '*wiggles butt*'],
};
function specialFx(r, kind) {
  const fx = empty();
  if (!kind) return fx;
  fx.lines = SPECIAL_LINES[kind] || [];
  if (kind === 'catnip') {
    const sparks = Array.from({ length: 14 }, (_, i) => {
      const x = S.ri(r, 10, W - 10), y = S.ri(r, 10, H - 40);
      return `<g transform="translate(${x} ${y})"><g class="spk" style="animation-delay:-${(r() * 2.4).toFixed(2)}s"><rect x="-1" y="-4" width="2" height="8" fill="#fff2a8"/><rect x="-4" y="-1" width="8" height="2" fill="#fff2a8"/></g></g>`;
    }).join('');
    fx.front = `<rect class="nip" width="${W}" height="${H}"/>` + sparks;
    fx.css = '.nip{mix-blend-mode:hue;opacity:.55;animation:nip 5s linear infinite}@keyframes nip{0%,100%{fill:#ff3b6b}25%{fill:#ffd33b}50%{fill:#3bff9a}75%{fill:#3bb8ff}}'
      + '.spk{opacity:0;animation:spk 2.4s ease-in-out infinite}@keyframes spk{0%,100%{opacity:0;transform:scale(.3)}50%{opacity:1;transform:scale(1) rotate(45deg)}}';
  } else if (kind === 'laser') {
    const gy = GY * CELL - 3;
    fx.front = `<g class="lz"><circle r="12" fill="#ff2a2a" opacity=".18"/><circle r="6" fill="#ff2a2a" opacity=".35"/><rect x="-3" y="-3" width="6" height="6" fill="#ff4040"/><rect x="-1.5" y="-1.5" width="3" height="3" fill="#ffe0e0"/></g>`;
    const pts = [[470, gy], [560, gy - 10], [520, gy], [700, gy - 4], [610, gy], [780, gy - 8], [480, gy]];
    fx.css = `.lz{animation:lz 6.5s ease-in-out infinite}@keyframes lz{${pts.map(([x, y], i) => `${Math.round(i / (pts.length - 1) * 100)}%{transform:translate(${x}px,${y}px)}`).join('')}}`;
  }
  return fx;
}

module.exports = { CELL, dayify, DAY_CSS, STRING, weatherKind, WEATHER_LABEL, weatherFx, season, seasonFx, partyFx, polaroids, specialFx };
