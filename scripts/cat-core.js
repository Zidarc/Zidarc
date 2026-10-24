// Byte the cat: state in cat/state.json, rendered to assets/cat.svg and the README CAT section.
const fs = require('fs');
const path = require('path');
const L = require('./lib');
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
    feed: `${a.emoji} *nom nom nom* — thank you @${user}! Byte's belly is now **${st.fullness}%** full. (=^･ω･^=)`,
    play: `${a.emoji} Byte chased the yarn ball all over the terminal. Happiness: **${st.happiness}%**. ฅ^•ﻌ•^ฅ`,
    pet: `${a.emoji} *purrrr~* Byte leans into your hand, @${user}. Happiness: **${st.happiness}%**.`,
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

function renderCat(st, now) {
  const W = 900, H = 290, P = 8;
  const m = MOODS[mood(st, now)];
  const T = L.typer();
  const IX = 360, VX = IX + 11 * CW;
  const last = st.recent[0];
  const friends = Object.keys(st.friends).length;
  const bubbleW = [...m.say].length * 8 + 20;
  const row = (y, d, s) => `<g class="slide" style="animation-delay:${d}s">${s}</g>`;
  const key = (y, k) => `<text x="${IX}" y="${y}" fill="${C.key}" font-weight="700">${k}</text>`;

  const body = `
${T.command(74, 'cat ~/byte.status', 0.2, 0.8, 1)}
<g class="fi" style="animation-delay:1s">${L.catSprite({ x: 70, y: 104, P, mood: mood(st, now) })}</g>
<g class="fi bob" style="animation-delay:1.3s">
  <rect x="200" y="96" width="${bubbleW}" height="26" rx="8" fill="${C.bar}" stroke="${m.color}"/>
  <path d="M200 112 l-10 6 l10 -1z" fill="${m.color}"/>
  <text x="${200 + bubbleW / 2}" y="114" font-size="13" text-anchor="middle" fill="${m.color}">${esc(m.say)}</text>
</g>
${row(118, 1.1, `<text x="${IX}" y="118" font-weight="700" font-size="17"><tspan fill="${C.text}">${esc(st.name)}</tspan><tspan fill="${C.dim}"> · </tspan><tspan fill="${m.color}">${m.label}</tspan></text>`)}
${row(152, 1.2, key(152, 'fullness') + L.blockBar(VX, 152, st.fullness, 1.4) + `<text x="${VX + 290}" y="152" fill="${C.text}">${st.fullness}%</text>`)}
${row(178, 1.3, key(178, 'happiness') + L.blockBar(VX, 178, st.happiness, 1.5) + `<text x="${VX + 290}" y="178" fill="${C.text}">${st.happiness}%</text>`)}
${row(210, 1.4, `<text x="${IX}" y="210" fill="${C.text}">fed ${st.counts.feed || 0}× · played ${st.counts.play || 0}× · petted ${st.counts.pet || 0}× · ${friends} friend${friends === 1 ? '' : 's'}</text>`)}
${row(234, 1.5, `<text x="${IX}" y="234" fill="${C.dim}">${last ? `last: @${esc(last.user)} ${ACTIONS[last.action].past} her · ${L.fmtDate(last.at)}` : 'no visitors yet. be the first!'}</text>`)}
${row(262, 1.6, `<text x="${IX}" y="262" fill="${C.pink}">↓ press a button · it opens an issue · Byte reacts in ~30s</text>`)}`;

  const css = L.catCss(P, 2) + `
.bob{animation:fadein .2s 1.3s ease-out both, bob 2.4s 1.5s ease-in-out infinite}
@keyframes bob{50%{transform:translateY(-3px)}}
${T.css()}`;
  return L.chrome({ w: W, h: H, title: `${st.name.toLowerCase()}.exe — status`, body, css, emberCount: 8, seed: 41, label: 'cat' });
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

function readmeSection(st) {
  const rows = st.recent.map(r => `| \`${L.fmtDate(r.at)}\` | [@${r.user}](https://github.com/${r.user}) | ${ACTIONS[r.action].emoji} ${r.action} |`);
  const best = Object.entries(st.friends).sort((a, b) => b[1] - a[1]).slice(0, 5)
    .map(([u, n], i) => `${['🥇', '🥈', '🥉', '🏅', '🏅'][i]} [@${u}](https://github.com/${u}) ×${n}`).join(' · ');
  return rows.length
    ? `| when | who | did |\n|:--|:--|:--|\n${rows.join('\n')}\n\n**Byte's best friends:** ${best}`
    : '_No visitors yet. Be the first to say hi to Byte!_';
}

function writeAll(st, now) {
  save(st);
  L.write('assets/cat.svg', renderCat(st, now));
  for (const fn of ['feed', 'play', 'pet']) L.write(`assets/btn-${fn}.svg`, renderButton(fn));
  L.updateReadme('CAT', readmeSection(st));
}

module.exports = { ACTIONS, load, decay, apply, writeAll };
