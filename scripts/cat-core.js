// Huna the cat: state in cat/state.json, rendered to assets/cat.svg (+ cat-day.svg for light mode), the visitor log,
// per-visitor stickers and the bot's replies.
const fs = require('fs');
const path = require('path');
const L = require('./lib');
const S = require('./scene/scenes');
const X = require('./scene/extras');
const { renderStage } = require('./scene/stage');
const { renderSticker } = require('./sticker');
const { avatarSvg } = require('./avatar');
const { C, CW, esc } = L;

const OWNER = 'Ali';
const REPO = process.env.GITHUB_REPOSITORY || 'Zidarc/Zidarc';
const PROFILE = REPO.split('/')[0];
const RAW = `https://raw.githubusercontent.com/${REPO}/main`;
const STATE = path.join(L.ROOT, 'cat', 'state.json');
const AVATARS = path.join(L.ROOT, 'cat', 'avatars');
const GOAL = 10; // visits in one (Pakistan) day for a party
const ACTIONS = {
  feed: { fullness: 30, happiness: 5, emoji: '🐟', past: 'fed' },
  play: { fullness: -5, happiness: 25, emoji: '🧶', past: 'played with' },
  pet: { fullness: 0, happiness: 12, emoji: '🐾', past: 'petted' },
};
// Unlisted: only hinted at in her dialogue. Each turns on a special effect for a few hours.
const SECRETS = {
  catnip: { fullness: 0, happiness: 20, emoji: '🌿', past: 'gave catnip to' },
  laser: { fullness: -3, happiness: 22, emoji: '🔴', past: 'played laser with' },
};
const ALL = { ...ACTIONS, ...SECRETS };
const SPECIAL_HOURS = 6;
const BADGES = {
  og: { icon: '🥇', name: 'OG', desc: 'one of her first 10 friends' },
  streak: { icon: '🔥', name: '7-day streak', desc: 'visited 7 days in a row' },
  owl: { icon: '🦉', name: 'night owl', desc: 'visited while she was asleep' },
  party: { icon: '🎉', name: 'party starter', desc: "the visit that hit the day's goal" },
  secret: { icon: '🔮', name: 'secret finder', desc: 'found a secret command' },
  regular: { icon: '💯', name: 'regular', desc: '50 visits' },
};
// Per hour; full to empty in roughly 2.5–4 days.
const DECAY = { fullness: 1.5, happiness: 1 };
// Ali's commits feed her too: per contribution, capped per refresh.
const CODE_FEED = { per: 2, max: 24 };
const clamp = v => Math.max(0, Math.min(100, Math.round(v)));
const pktDay = d => new Date(new Date(d).getTime() + 5 * 3600000).toISOString().slice(0, 10);
const dayDiff = (a, b) => Math.round((new Date(a) - new Date(b)) / 86400000);
const safeUser = u => /^[A-Za-z0-9-]{1,39}$/.test(u || '');

// Fills in fields added after the first version of state.json.
function norm(st) {
  st.counts ||= {}; st.friends ||= {}; st.recent ||= [];
  st.ids ||= {}; st.joined ||= {}; st.badges ||= {}; st.streaks ||= {};
  let n = Math.max(0, ...Object.values(st.ids));
  for (const u of Object.keys(st.friends)) if (!st.ids[u]) st.ids[u] = ++n;
  for (const [u, id] of Object.entries(st.ids)) {
    if (id <= 10) (st.badges[u] ||= []).includes('og') || st.badges[u].push('og');
    st.joined[u] ||= st.recent.filter(r => r.user === u).at(-1)?.at || st.updated;
  }
  st.daily ||= { day: null, n: 0 };
  st.code ||= { credited: {}, lastDay: null };
  st.birthday ??= '';
  return st;
}
const load = () => norm(JSON.parse(fs.readFileSync(STATE, 'utf8')));
const save = st => fs.writeFileSync(STATE, JSON.stringify(st, null, 2) + '\n');

function decay(st, now) {
  const hours = Math.max(0, (now - new Date(st.updated)) / 3600000);
  st.fullness = clamp(st.fullness - hours * DECAY.fullness);
  st.happiness = clamp(st.happiness - hours * DECAY.happiness);
  st.updated = now.toISOString();
}

// days: [{ date: 'YYYY-MM-DD', count }] from the contribution calendar. New contributions since the last refresh feed her.
function feedFromCode(st, days, now) {
  const c = st.code;
  let n = 0;
  for (const { date, count } of days.slice(-7)) {
    n += Math.max(0, count - (c.credited[date] || 0));
    c.credited[date] = Math.max(count, c.credited[date] || 0);
    if (count > 0 && (!c.lastDay || date > c.lastDay)) c.lastDay = date;
  }
  for (const d of Object.keys(c.credited)) if (dayDiff(pktDay(now), d) > 10) delete c.credited[d];
  if (n) {
    const gain = Math.min(CODE_FEED.max, n * CODE_FEED.per);
    st.fullness = clamp(st.fullness + gain);
    st.happiness = clamp(st.happiness + Math.min(10, n));
    Object.assign(c, { gained: gain, commits: n, at: now.toISOString() });
  }
}

// Avatars are stored as 10×10 colour grids (see avatar.js); avatar() returns a drawer for one, or null.
function setAvatar(user, av) {
  if (!safeUser(user) || !av) return;
  fs.mkdirSync(AVATARS, { recursive: true });
  fs.writeFileSync(path.join(AVATARS, `${user}.json`), JSON.stringify(av) + '\n');
}
function avatar(user) {
  try {
    const av = JSON.parse(fs.readFileSync(path.join(AVATARS, `${user}.json`), 'utf8'));
    return (x, y, cell) => avatarSvg(av, x, y, cell);
  } catch { return null; }
}

function award(st, user, id, fresh) {
  const list = st.badges[user] ||= [];
  if (!list.includes(id)) { list.push(id); fresh.push(id); }
}

function apply(st, action, user, now) {
  const a = ALL[action];
  const asleep = mood(st, now) === 'sleepy';
  const today = pktDay(now), fresh = [];
  st.fullness = clamp(st.fullness + a.fullness);
  st.happiness = clamp(st.happiness + a.happiness);
  st.counts[action] = (st.counts[action] || 0) + 1;
  st.friends[user] = (st.friends[user] || 0) + 1;
  if (!st.ids[user]) { st.ids[user] = Math.max(0, ...Object.values(st.ids)) + 1; st.joined[user] = now.toISOString(); }
  st.recent = [{ user, action, at: now.toISOString() }, ...st.recent].slice(0, 6);
  st.lastInteraction = now.toISOString();

  // Streak of days in a row (Pakistan time).
  const sk = st.streaks[user] ||= { day: null, n: 0 };
  if (sk.day !== today) { sk.n = sk.day && dayDiff(today, sk.day) === 1 ? sk.n + 1 : 1; sk.day = today; }
  // The community goal: GOAL visits in a day throws her a party for 24 hours.
  if (st.daily.day !== today) st.daily = { day: today, n: 0 };
  st.daily.n++;
  const partyNow = st.daily.n === GOAL;
  if (partyNow) st.party = new Date(now.getTime() + 86400000).toISOString();
  if (SECRETS[action]) st.special = { kind: action, by: user, until: new Date(now.getTime() + SPECIAL_HOURS * 3600000).toISOString() };

  if (st.ids[user] <= 10) award(st, user, 'og', fresh);
  if (sk.n >= 7) award(st, user, 'streak', fresh);
  if (asleep) award(st, user, 'owl', fresh);
  if (partyNow) award(st, user, 'party', fresh);
  if (SECRETS[action]) award(st, user, 'secret', fresh);
  if (st.friends[user] >= 50) award(st, user, 'regular', fresh);

  const lines = {
    feed: `${a.emoji} *nom nom nom*, thank you @${user}! Huna's belly is now **${st.fullness}%** full. (=^･ω･^=)`,
    play: `${a.emoji} Huna chased the yarn ball all over the ledge. Happiness: **${st.happiness}%**. ฅ^•ﻌ•^ฅ`,
    pet: `${a.emoji} *purrrr~* Huna leans into your hand, @${user}. Happiness: **${st.happiness}%**.`,
    catnip: `${a.emoji} ✧ CATNIP ✧ You found a secret, @${user}! Huna has the zoomies for the next ${SPECIAL_HOURS} hours: go look at the profile.`,
    laser: `${a.emoji} A red dot appears… Huna is OBSESSED. You found a secret, @${user}! The dot stays on the profile for ${SPECIAL_HOURS} hours.`,
  };
  const v = Object.values(st.counts).reduce((x, y) => x + y, 0);
  const sticker = `${RAW}/assets/stickers/${user}.svg`;
  const out = [
    lines[action], '',
    `<img src="${RAW}/assets/reactions/${action}.gif?v=${v}" width="288" alt="Huna reacting" />`, '',
  ];
  if (partyNow) out.push(`🎉 **That was visit ${GOAL} today: you threw Huna a party!** She's wearing a party hat on the profile for 24 hours.`, '');
  else out.push(`Today's goal: **${st.daily.n}/${GOAL}** visits until Huna gets a party 🎉`, '');
  for (const id of fresh) out.push(`🏅 **New badge:** ${BADGES[id].icon} ${BADGES[id].name} (${BADGES[id].desc})`);
  if (fresh.length) out.push('');
  // Stickers only exist for normal logins (bots like "name[bot]" don't get a file).
  if (safeUser(user)) out.push(
    `You're friend **#${st.ids[user]}** of Huna. Here's your sticker:`, '',
    `<img src="${sticker}?v=${v}" width="420" alt="friend of Huna sticker" />`, '',
    'Put it on your own profile README (it updates as you visit):', '',
    '```md', `[![friend of Huna](${sticker})](https://github.com/${PROFILE})`, '```', '',
    'Your face is on her wall now too.',
  );
  else out.push(`You're friend **#${st.ids[user]}** of Huna.`);
  out.push('', 'This issue closes itself. Thanks for visiting! ♥');
  return out.join('\n');
}

function unknownReply() {
  return 'Huna tilts her head. She knows `feed`, `play` and `pet`… and a couple of secrets she sometimes mumbles about 👀 Try a button on the profile!';
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
  happy: { label: 'happy', color: C.key },
  normal: { label: 'chilling', color: C.text },
  hungry: { label: 'HUNGRY', color: C.gold },
  bored: { label: 'bored', color: C.pink },
  sleepy: { label: 'asleep', color: C.dim },
};

const active = (until, now) => until && new Date(until) > now;
function weather(st, now) {
  const w = st.weather;
  return w && now - new Date(w.at) < 12 * 3600000 ? { ...w, kind: X.weatherKind(w.code) } : null;
}
function codeNote(st, now) {
  const c = st.code;
  if (!c.lastDay) return null;
  const n = dayDiff(pktDay(now), c.lastDay);
  if (n >= 2) return { text: `😿 ${OWNER} hasn't committed in ${n} days`, col: C.gold, lines: [`${OWNER}, code pls`, 'no commits… 😿', 'go push something!', 'commits = food'] };
  const gain = c.at && now - new Date(c.at) < 86400000 ? ` · ${c.commits} commit${c.commits === 1 ? '' : 's'} fed her +${c.gained}` : '';
  return { text: `💻 ${OWNER} coded ${n ? 'yesterday' : 'today'}${gain}`, col: C.key, lines: [`${OWNER} coded today ♥`, 'commits = food', 'good dev.'] };
}

// Everything from the outside world that changes her walk.
function stageFx(st, now, day) {
  const r = S.rng(Math.floor(now / 10800000) * 7 + 3);
  const fx = [], w = weather(st, now), sz = X.season(now, st.birthday);
  const party = active(st.party, now), special = active(st.special?.until, now) ? st.special.kind : null;
  fx.push(X.weatherFx(r, w?.kind, day));
  fx.push(X.seasonFx(r, sz));
  if (party) fx.push(X.partyFx(r));
  fx.push(X.specialFx(r, special));
  const seen = new Set(), friends = [];
  for (const v of st.recent) if (!seen.has(v.user)) { seen.add(v.user); friends.push({ user: v.user, avatar: avatar(v.user) }); }
  fx.push(X.polaroids(friends));
  const lines = [];
  const last = st.recent[0];
  if (last && now - new Date(last.at) < 86400000) lines.push(`thx @${last.user}!`, `hi @${last.user} ♥`, `@${last.user} ${ALL[last.action].past} me`);
  const cn = codeNote(st, now);
  if (cn) lines.push(...cn.lines);
  fx.push({ lines });
  return { fx, hat: party ? 'party' : sz?.hat || null, hang: friends.length > 0 || !!sz, sz, w, party, special };
}

// Scene strip on top (Huna living her life, see scene/stage.js), stats underneath.
function renderCat(st, now, day = false) {
  const W = 900, H = 500, SX = 30, SY = 88;
  const md = mood(st, now), m = MOODS[md];
  const T = L.typer();
  const RX = 470, VX = RX + 11 * CW;
  const last = st.recent[0];
  const friends = Object.keys(st.friends).length;
  const visits = Object.values(st.counts).reduce((a, b) => a + b, 0);
  const env = stageFx(st, now, day);
  // A new walk (scene order and choreography) every 3 hours, and whenever someone visits.
  const slot = Math.floor(now / 10800000);
  const stage = renderStage({ x: SX, y: SY, seed: slot * 1000 + visits, mood: md, moodColor: m.color, day, hat: env.hat, fx: env.fx, hang: env.hang });
  const row = (d, s) => `<g class="slide" style="animation-delay:${d}s">${s}</g>`;
  const key = (y, k) => `<text x="${RX}" y="${y}" fill="${C.key}" font-weight="700">${k}</text>`;
  const bar = (y, k, v, d, label = `${v}%`) => key(y, k) + L.blockBar(VX, y, v, d, { n: 16 }) + `<text x="${VX + 234}" y="${y}" fill="${C.text}">${label}</text>`;
  const today = st.daily.day === pktDay(now) ? st.daily.n : 0;
  const goal = env.party
    ? key(418, 'party') + `<text x="${VX}" y="418" fill="${C.gold}" font-weight="700">🎉 goal reached! party hat on</text>`
    : bar(418, 'goal', clamp((today / GOAL) * 100), 1.6, `${today}/${GOAL}`);
  const sky = env.w && `${Math.round(env.w.temp)}°C · ${X.WEATHER_LABEL[env.w.kind] || ''}`;
  const special = env.special && `${env.special === 'catnip' ? '🌿 catnip mode' : '🔴 laser mode'} (thanks @${st.special.by})`;
  const extras = [env.sz?.label, env.party && '🎉 party day', special].filter(Boolean).join('  ·  ');
  const cn = codeNote(st, now);
  const where = day ? 'out on her afternoon walk' : 'out on her night walk';

  const body = `
${T.command(70, 'cat ~/huna.status', 0.2, 0.8, 1)}
<g class="fi" style="animation-delay:.3s">${stage.svg}</g>
${row(1.1, `<text x="${SX}" y="362" font-weight="700" font-size="17"><tspan fill="${C.text}">${esc(st.name)}</tspan><tspan fill="${C.dim}"> · </tspan><tspan fill="${m.color}">${m.label}</tspan><tspan fill="${C.dim}" font-size="13" font-weight="400">  · ${where}</tspan></text>`)}
${row(1.2, bar(362, 'fullness', st.fullness, 1.4))}
${row(1.3, `<text x="${SX}" y="390" fill="${C.text}">fed ${st.counts.feed || 0}× · played ${st.counts.play || 0}× · petted ${st.counts.pet || 0}× · ${friends} friend${friends === 1 ? '' : 's'}</text>`)}
${row(1.3, bar(390, 'happiness', st.happiness, 1.5))}
${row(1.4, `<text x="${SX}" y="418" fill="${C.dim}">${last ? `last: @${esc(last.user.length > 16 ? last.user.slice(0, 15) + '…' : last.user)} ${ALL[last.action].past} her · ${L.fmtDate(last.at).slice(5, 16)}` : 'no visitors yet. be the first!'}</text>`)}
${row(1.5, goal)}
${row(1.6, cn ? `<text x="${SX}" y="446" fill="${cn.col}">${esc(cn.text)}</text>` : '')}
${row(1.6, sky ? key(446, 'Karachi') + `<text x="${VX}" y="446" fill="${C.text}">${esc(sky)}</text>` : '')}
${row(1.7, extras ? `<text x="${SX}" y="474" fill="${C.gold}">${esc(extras)}</text>` : '')}
${row(1.8, `<text x="${SX}" y="${extras ? 508 : 480}" fill="${C.pink}">↓ press a button · it opens an issue · Huna reacts in ~30s · you get a sticker</text>`)}`;

  const css = `
.bob{animation:bob 2.4s ease-in-out infinite}
@keyframes bob{50%{transform:translateY(-3px)}}
${stage.css}
${T.css()}`;
  return L.chrome({ w: W, h: extras ? H + 28 : H, title: `${st.name.toLowerCase()}.exe — status`, body, css, emberCount: 4, seed: 41, label: 'cat' });
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

// assets/visitors.svg — recent visits on the left, best-friends leaderboard (with badges) on the right.
const CHIP = { feed: ['FEED', C.gold], play: ['PLAY', C.pink], pet: ['PET', C.key], catnip: ['NIP', '#9cff8a'], laser: ['LASER', '#ff5050'] };
function renderVisitors(st) {
  const T = L.typer();
  const TOP = 116, LH = 28, RX = 500;
  const best = Object.entries(st.friends).sort((a, b) => b[1] - a[1]).slice(0, 6);
  const n = Math.max(st.recent.length, best.length, 1);
  const user = (u, max) => '@' + (u.length > max ? u.slice(0, max - 1) + '…' : u);
  const recent = st.recent.map((r, i) => {
    const y = TOP + i * LH, [label, col] = CHIP[r.action] || ['???', C.dim];
    return `<g class="slide" style="animation-delay:${(1 + i * 0.1).toFixed(2)}s">
<text x="${L.X0}" y="${y}" fill="${C.dim}">${L.fmtDate(r.at).slice(5, 16)}</text>
<text x="${L.X0 + 13 * CW}" y="${y}" fill="${C.text}">${esc(user(r.user, 18))}</text>
<rect x="${L.X0 + 33 * CW}" y="${y - 14}" width="56" height="19" rx="3" fill="${C.track}" stroke="${col}" stroke-opacity=".7"/>
<text x="${L.X0 + 33 * CW + 28}" y="${y}" font-size="12" font-weight="700" text-anchor="middle" fill="${col}">${label}</text></g>`;
  }).join('\n');

  const top = best[0]?.[1] || 1;
  const friends = best.map(([u, c], i) => {
    const y = TOP + i * LH, col = i ? C.pink : C.gold;
    const icons = (st.badges[u] || []).map(b => BADGES[b]?.icon).filter(Boolean).join('');
    return `<g class="slide" style="animation-delay:${(1.2 + i * 0.1).toFixed(2)}s">
<text x="${RX}" y="${y}" fill="${col}" font-weight="700">#${i + 1}</text>
<text x="${RX + 4 * CW}" y="${y}" fill="${C.text}">${esc(user(u, 13))}</text>
<text x="${RX + 18 * CW}" y="${y}" font-size="13">${icons}</text>
<rect x="${RX + 29 * CW}" y="${y - 11}" width="64" height="12" fill="${C.track}"/>
<rect x="${RX + 29 * CW}" y="${y - 11}" width="${((64 * c) / top).toFixed(1)}" height="12" fill="${col}"/>
<text x="870" y="${y}" fill="${C.text}" text-anchor="end">×${c}</text></g>`;
  }).join('\n');

  const head = (x, s) => `<text x="${x}" y="${TOP - 26}" font-size="13" fill="${C.key}" font-weight="700">${s}</text>`;
  const legendY = TOP + (n - 1) * LH + 40;
  const legend = Object.values(BADGES).map(b => `${b.icon} ${b.name}`).join('  ·  ');
  const body = `
${T.command(64, 'tail ~/huna/visitors.log', 0.2, 0.8, 1)}
${L.show(0.9, head(L.X0, '── recent visits ──') + head(RX, '── best friends ──') + `<rect x="${RX - 22}" y="${TOP - 40}" width="1" height="${n * LH + 20}" fill="${C.dim}" opacity=".6"/>`)}
${st.recent.length ? recent : L.show(1, `<text x="${L.X0}" y="${TOP}" fill="${C.dim}">no visitors yet. be the first!</text>`)}
${friends || L.show(1.2, `<text x="${RX}" y="${TOP}" fill="${C.dim}">still waiting for a friend…</text>`)}
${L.show(1.6, `<text x="${L.X0}" y="${legendY}" font-size="12" fill="${C.dim}">badges: ${esc(legend)}</text>`)}`;
  return L.chrome({ w: 900, h: legendY + 22, title: 'visitors.log — huna', body, css: T.css(), emberCount: 5, seed: 53, label: 'cat' });
}

function writeSticker(st, user) {
  if (!safeUser(user)) return;
  fs.mkdirSync(path.join(L.ROOT, 'assets', 'stickers'), { recursive: true });
  L.write(`assets/stickers/${user}.svg`, renderSticker({
    user, no: st.ids[user], visits: st.friends[user], since: st.joined[user] || st.updated,
    badges: (st.badges[user] || []).map(b => BADGES[b].icon), avatar: avatar(user), profile: PROFILE,
  }));
}

function writeAll(st, now) {
  save(st);
  L.write('assets/cat.svg', renderCat(st, now));
  L.write('assets/cat-day.svg', renderCat(st, now, true));
  for (const fn of ['feed', 'play', 'pet']) L.write(`assets/btn-${fn}.svg`, renderButton(fn));
  L.write('assets/visitors.svg', renderVisitors(st));
}

module.exports = { ACTIONS, ALL, renderCat, load, decay, apply, unknownReply, feedFromCode, setAvatar, writeSticker, writeAll };
