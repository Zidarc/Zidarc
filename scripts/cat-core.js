// Huna the cat: state in cat/state.json, rendered to assets/cat.svg and the README CAT section.
const fs = require('fs');
const path = require('path');
const L = require('./lib');
const { renderStage } = require('./scene/stage');
const { C, CW, esc } = L;

const STATE = path.join(L.ROOT, 'cat', 'state.json');
const ACTIONS = {
  feed: { fullness: 30, happiness: 5, emoji: '🐟', past: 'fed' },
  play: { fullness: -5, happiness: 25, emoji: '🧶', past: 'played with' },
  pet: { fullness: 0, happiness: 12, emoji: '🐾', past: 'petted' },
};
// Per hour; full to empty in roughly 2.5–4 days.
const DECAY = { fullness: 1.5, happiness: 1 };
const clamp = v => Math.max(0, Math.min(100, Math.round(v)));

const load = () => JSON.parse(fs.readFileSync(STATE, 'utf8'));
const save = st => fs.writeFileSync(STATE, JSON.stringify(st, null, 2) + '\n');

function decay(st, now) {
  const hours = Math.max(0, (now - new Date(st.updated)) / 3600000);
  st.fullness = clamp(st.fullness - hours * DECAY.fullness);
  st.happiness = clamp(st.happiness - hours * DECAY.happiness);
  st.updated = now.toISOString();
}

function apply(st, action, user, now) {
  const a = ACTIONS[action];
  st.fullness = clamp(st.fullness + a.fullness);
  st.happiness = clamp(st.happiness + a.happiness);
  st.counts[action] = (st.counts[action] || 0) + 1;
  st.friends[user] = (st.friends[user] || 0) + 1;
  st.recent = [{ user, action, at: now.toISOString() }, ...st.recent].slice(0, 6);
  st.lastInteraction = now.toISOString();
  const lines = {
    feed: `${a.emoji} *nom nom nom* — thank you @${user}! Huna's belly is now **${st.fullness}%** full. (=^･ω･^=)`,
    play: `${a.emoji} Huna chased the yarn ball all over the terminal. Happiness: **${st.happiness}%**. ฅ^•ﻌ•^ฅ`,
    pet: `${a.emoji} *purrrr~* Huna leans into your hand, @${user}. Happiness: **${st.happiness}%**.`,
  };
  return `${lines[action]}\n\nYou're on the profile now. This issue closes itself — thanks for visiting! ♥`;
}

function mood(st, now) {
  const pktHour = (now.getUTCHours() + 5) % 24;
  const recent = st.lastInteraction && now - new Date(st.lastInteraction) < 3600000;
  if (!recent && pktHour >= 1 && pktHour < 7) return 'sleepy';
  if (st.fullness < 35) return 'hungry';
  if (st.happiness < 35) return 'bored';
  if (recent || (st.fullness >= 70 && st.happiness >= 70)) return 'happy';
  return 'normal';
}

const MOODS = {
  happy: { label: 'happy', say: 'purr~ ♥', color: C.key },
  normal: { label: 'chilling', say: 'meow.', color: C.text },
  hungry: { label: 'HUNGRY', say: 'feed me!!', color: C.gold },
  bored: { label: 'bored', say: 'play with me?', color: C.pink },
  sleepy: { label: 'asleep', say: 'zzz…', color: C.dim },
};

// Scene strip on top (Huna living her life, see scene/stage.js), stats underneath.
function renderCat(st, now) {
  const W = 900, H = 464, SX = 30, SY = 88;
  const md = mood(st, now), m = MOODS[md];
  const T = L.typer();
  const RX = 470, VX = RX + 11 * CW;
  const last = st.recent[0];
  const friends = Object.keys(st.friends).length;
  const visits = Object.values(st.counts).reduce((a, b) => a + b, 0);
  // A new scene every 3 hours; a new choreography whenever someone visits.
  const slot = Math.floor(now / 10800000);
  const stage = renderStage({ x: SX, y: SY, now, seed: slot * 1000 + visits, mood: md, bubble: { text: esc(m.say), color: m.color } });
  const row = (d, s) => `<g class="slide" style="animation-delay:${d}s">${s}</g>`;
  const key = (y, k) => `<text x="${RX}" y="${y}" fill="${C.key}" font-weight="700">${k}</text>`;
  const bar = (y, k, v, d) => key(y, k) + L.blockBar(VX, y, v, d, { n: 16 }) + `<text x="${VX + 234}" y="${y}" fill="${C.text}">${v}%</text>`;

  const body = `
${T.command(70, 'cat ~/huna.status', 0.2, 0.8, 1)}
<g class="fi" style="animation-delay:.3s">${stage.svg}</g>
${row(1.1, `<text x="${SX}" y="362" font-weight="700" font-size="17"><tspan fill="${C.text}">${esc(st.name)}</tspan><tspan fill="${C.dim}"> · </tspan><tspan fill="${m.color}">${m.label}</tspan><tspan fill="${C.dim}" font-size="13" font-weight="400">  · ${stage.scene} · ${stage.tod}</tspan></text>`)}
${row(1.2, bar(362, 'fullness', st.fullness, 1.4))}
${row(1.3, `<text x="${SX}" y="390" fill="${C.text}">fed ${st.counts.feed || 0}× · played ${st.counts.play || 0}× · petted ${st.counts.pet || 0}× · ${friends} friend${friends === 1 ? '' : 's'}</text>`)}
${row(1.3, bar(390, 'happiness', st.happiness, 1.5))}
${row(1.4, `<text x="${SX}" y="418" fill="${C.dim}">${last ? `last: @${esc(last.user)} ${ACTIONS[last.action].past} her · ${L.fmtDate(last.at)}` : 'no visitors yet. be the first!'}</text>`)}
${row(1.5, `<text x="${SX}" y="444" fill="${C.pink}">↓ press a button · it opens an issue · Huna reacts in ~30s</text>`)}`;

  const css = `
.bob{animation:bob 2.4s ease-in-out infinite}
@keyframes bob{50%{transform:translateY(-3px)}}
${stage.css}
${T.css()}`;
  return L.chrome({ w: W, h: H, title: `${st.name.toLowerCase()}.exe — status`, body, css, emberCount: 4, seed: 41, label: 'cat' });
}

function renderButton(fn) {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="180" height="48" viewBox="0 0 180 48" font-family="'JetBrains Mono','Fira Code',Consolas,monospace" font-size="16">
<style>.p{animation:p 2.4s ease-in-out infinite}@keyframes p{50%{stroke-opacity:.15}}</style>
<rect class="p" x="3" y="3" width="174" height="42" rx="9" fill="none" stroke="${C.key}" stroke-width="5" stroke-opacity=".5"/>
<rect x="3" y="3" width="174" height="42" rx="9" fill="${C.bg}" stroke="${C.key}" stroke-width="1.5"/>
<text x="90" y="30" text-anchor="middle" font-weight="700"><tspan fill="${C.key}">&gt;_ </tspan><tspan fill="${C.text}">${fn}()</tspan></text>
</svg>
`;
}

// assets/visitors.svg — recent visits on the left, best-friends leaderboard on the right.
const CHIP = { feed: ['FEED', C.gold], play: ['PLAY', C.pink], pet: ['PET', C.key] };
function renderVisitors(st) {
  const T = L.typer();
  const TOP = 116, LH = 28, RX = 560;
  const n = Math.max(st.recent.length, 1);
  const user = (u, max) => '@' + (u.length > max ? u.slice(0, max - 1) + '…' : u);
  const recent = st.recent.map((r, i) => {
    const y = TOP + i * LH, [label, col] = CHIP[r.action];
    return `<g class="slide" style="animation-delay:${(1 + i * 0.1).toFixed(2)}s">
<text x="${L.X0}" y="${y}" fill="${C.dim}">${L.fmtDate(r.at).slice(5, 16)}</text>
<text x="${L.X0 + 13 * CW}" y="${y}" fill="${C.text}">${esc(user(r.user, 18))}</text>
<rect x="${L.X0 + 33 * CW}" y="${y - 14}" width="56" height="19" rx="3" fill="${C.track}" stroke="${col}" stroke-opacity=".7"/>
<text x="${L.X0 + 33 * CW + 28}" y="${y}" font-size="12" font-weight="700" text-anchor="middle" fill="${col}">${label}</text></g>`;
  }).join('\n');

  const best = Object.entries(st.friends).sort((a, b) => b[1] - a[1]).slice(0, 5);
  const top = best[0]?.[1] || 1;
  const friends = best.map(([u, c], i) => {
    const y = TOP + i * LH, col = i ? C.pink : C.gold;
    return `<g class="slide" style="animation-delay:${(1.2 + i * 0.1).toFixed(2)}s">
<text x="${RX}" y="${y}" fill="${col}" font-weight="700">#${i + 1}</text>
<text x="${RX + 4 * CW}" y="${y}" fill="${C.text}">${esc(user(u, 14))}</text>
<rect x="${RX + 20 * CW}" y="${y - 11}" width="80" height="12" fill="${C.track}"/>
<rect x="${RX + 20 * CW}" y="${y - 11}" width="${((80 * c) / top).toFixed(1)}" height="12" fill="${col}"/>
<text x="870" y="${y}" fill="${C.text}" text-anchor="end">×${c}</text></g>`;
  }).join('\n');

  const head = (x, s) => `<text x="${x}" y="${TOP - 26}" font-size="13" fill="${C.key}" font-weight="700">${s}</text>`;
  const body = `
${T.command(64, 'tail ~/huna/visitors.log', 0.2, 0.8, 1)}
${L.show(0.9, head(L.X0, '── recent visits ──') + head(RX, '── best friends ──') + `<rect x="${RX - 22}" y="${TOP - 40}" width="1" height="${n * LH + 20}" fill="${C.dim}" opacity=".6"/>`)}
${st.recent.length ? recent : L.show(1, `<text x="${L.X0}" y="${TOP}" fill="${C.dim}">no visitors yet. be the first!</text>`)}
${friends || L.show(1.2, `<text x="${RX}" y="${TOP}" fill="${C.dim}">still waiting for a friend…</text>`)}`;
  return L.chrome({ w: 900, h: TOP + (n - 1) * LH + 34, title: 'visitors.log — huna', body, css: T.css(), emberCount: 5, seed: 53, label: 'cat' });
}

function writeAll(st, now) {
  save(st);
  L.write('assets/cat.svg', renderCat(st, now));
  for (const fn of ['feed', 'play', 'pet']) L.write(`assets/btn-${fn}.svg`, renderButton(fn));
  L.write('assets/visitors.svg', renderVisitors(st));
}

module.exports = { ACTIONS, load, decay, apply, writeAll };
