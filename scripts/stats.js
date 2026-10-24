// assets/stats.svg (an htop-style stats card) and the README activity feed, from the GitHub API.
const L = require('./lib');
const { C, CW, X0, esc } = L;

async function api(token, url, body) {
  const res = await fetch(url, {
    method: body ? 'POST' : 'GET',
    headers: { Authorization: `bearer ${token}`, 'User-Agent': 'zidarc-profile', 'Content-Type': 'application/json' },
    body: body && JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`${url} → ${res.status} ${await res.text()}`);
  return res.json();
}

const QUERY = `query($login:String!){user(login:$login){
  createdAt followers{totalCount} pullRequests{totalCount} issues{totalCount}
  repositories(ownerAffiliations:OWNER,isFork:false,first:100,orderBy:{field:PUSHED_AT,direction:DESC}){
    totalCount nodes{stargazerCount languages(first:8,orderBy:{field:SIZE,direction:DESC}){edges{size node{name}}}}}
  contributionsCollection{totalCommitContributions restrictedContributionsCount
    contributionCalendar{totalContributions weeks{contributionDays{contributionCount date}}}}}}`;

async function fetchStats(login, token) {
  const { data, errors } = await api(token, 'https://api.github.com/graphql', { query: QUERY, variables: { login } });
  if (errors) throw new Error(JSON.stringify(errors));
  const u = data.user;
  const sizes = {};
  for (const r of u.repositories.nodes) for (const e of r.languages.edges) sizes[e.node.name] = (sizes[e.node.name] || 0) + e.size;
  const total = Object.values(sizes).reduce((a, b) => a + b, 0) || 1;
  const langs = Object.entries(sizes).sort((a, b) => b[1] - a[1]).slice(0, 6).map(([name, s]) => ({ name, pct: (s / total) * 100 }));

  const cc = u.contributionsCollection;
  const days = cc.contributionCalendar.weeks.flatMap(w => w.contributionDays).map(d => d.contributionCount);
  // Today may not have contributions yet; don't let that break the streak.
  const forStreak = days[days.length - 1] === 0 ? days.slice(0, -1) : days;
  let current = 0;
  for (let i = forStreak.length - 1; i >= 0 && forStreak[i] > 0; i--) current++;
  let longest = 0, run = 0;
  for (const d of days) { run = d > 0 ? run + 1 : 0; longest = Math.max(longest, run); }
  const avg = n => (days.slice(-n).reduce((a, b) => a + b, 0) / Math.min(n, days.length)).toFixed(1);
  const age = (Date.now() - new Date(u.createdAt)) / 86400000;

  return {
    langs,
    repos: u.repositories.totalCount,
    stars: u.repositories.nodes.reduce((a, r) => a + r.stargazerCount, 0),
    commits: cc.totalCommitContributions + cc.restrictedContributionsCount,
    prs: u.pullRequests.totalCount,
    issues: u.issues.totalCount,
    followers: u.followers.totalCount,
    contributions: cc.contributionCalendar.totalContributions,
    current, longest,
    load: [avg(7), avg(30), avg(365)],
    uptime: `${Math.floor(age / 365)}y ${Math.floor((age % 365) / 30)}m`,
    spark: days.slice(-60),
  };
}

function renderStats(s, login) {
  const W = 900, H = 400;
  const T = L.typer();
  const top = Math.max(...s.langs.map(l => l.pct), 1);
  const meters = s.langs.map((l, i) => {
    const y = 114 + i * 24, d = (0.9 + i * 0.1).toFixed(2);
    return `<g class="slide" style="animation-delay:${d}s">
<text x="${X0}" y="${y}" fill="${C.dim}">${i + 1}</text><text x="48" y="${y}" fill="${C.text}">[</text>
<rect x="62" y="${y - 11}" width="220" height="12" fill="${C.track}"/>
<rect class="grow" style="animation-delay:${d}s" x="62" y="${y - 11}" width="${((220 * l.pct) / top).toFixed(1)}" height="12" fill="url(#bars)"/>
<text x="288" y="${y}" fill="${C.text}">]</text>
<text x="306" y="${y}" fill="${C.key}" font-weight="700">${l.pct.toFixed(1).padStart(4, ' ')}%</text>
<text x="370" y="${y}" fill="${C.text}">${esc(l.name)}</text></g>`;
  }).join('\n');

  const rows = [
    ['Tasks', `${s.repos} repos, ${s.stars} ★`],
    ['Commits', `${s.commits} this year`],
    ['PRs', `${s.prs} PRs · ${s.issues} issues`],
    ['Streak', `${s.current}d now · best ${s.longest}d`],
    ['Load avg', s.load.join(' ')],
    ['Uptime', `${s.uptime} on GitHub`],
    ['Followers', String(s.followers)],
    ['Contribs', `${s.contributions} in 1 year`],
  ].map(([k, v], i) => {
    const y = 114 + i * 24;
    return `<g class="slide" style="animation-delay:${(1 + i * 0.1).toFixed(2)}s"><text x="540" y="${y}" fill="${C.key}" font-weight="700">${k}:</text><text x="${540 + 11 * CW}" y="${y}" fill="${C.text}">${esc(v)}</text></g>`;
  }).join('\n');

  const max = Math.max(...s.spark, 1), bw = 840 / s.spark.length;
  const spark = s.spark.map((n, i) => {
    const h = n ? Math.max(4, (n / max) * 52) : 2;
    const col = n ? L.RAMP[Math.min(7, 2 + Math.ceil((n / max) * 4))] : C.track;
    return `<rect class="growy" style="animation-delay:${(1.6 + i * 0.015).toFixed(2)}s" x="${(X0 + i * bw).toFixed(1)}" y="${360 - h}" width="${(bw - 4).toFixed(1)}" height="${h}" fill="${col}"/>`;
  }).join('');

  const body = `
<defs><pattern id="bars" width="4" height="12" patternUnits="userSpaceOnUse"><rect width="3" height="12" fill="${C.key}"/></pattern></defs>
${T.command(74, `htop --user ${login.toLowerCase()}`, 0.2, 0.7, 0.9)}
${meters}
${rows}
<g shape-rendering="crispEdges">${spark}</g>
${L.show(1.6, `<text x="${X0}" y="380" font-size="12" fill="${C.dim}">contributions · last 60 days</text><text x="870" y="380" font-size="12" fill="${C.dim}" text-anchor="end">today</text>`)}`;

  const css = `
.grow{transform-box:fill-box;transform-origin:left;animation:growx .8s ease-out both}
.growy{transform-box:fill-box;transform-origin:bottom;animation:growy .5s ease-out both}
@keyframes growx{from{transform:scaleX(0)}}
@keyframes growy{from{transform:scaleY(0)}}
${T.css()}`;
  return L.chrome({ w: W, h: H, title: `htop — ali@${L.HOST}`, body, css, emberCount: 8, seed: 5 });
}

// ---------- activity feed ----------
const link = repo => `[${repo}](https://github.com/${repo})`;
function describe(e, login) {
  const p = e.payload, repo = e.repo.name;
  const own = repo.toLowerCase() === `${login}/${login}`.toLowerCase();
  switch (e.type) {
    case 'PushEvent': {
      const n = p.size ?? p.commits?.length ?? p.distinct_size;
      return own ? null : `⬆️ Pushed ${n ? `${n} commit${n > 1 ? 's' : ''}` : 'commits'} to ${link(repo)}`;
    }
    case 'PullRequestEvent': {
      const verb = p.action === 'closed' ? (p.pull_request?.merged ? 'Merged' : 'Closed') : p.action === 'opened' ? 'Opened' : null;
      return verb && `🔀 ${verb} PR [#${p.number}](${p.pull_request.html_url}) in ${link(repo)}`;
    }
    case 'IssuesEvent': return own || p.action !== 'opened' ? null : `❗ Opened issue [#${p.issue.number}](${p.issue.html_url}) in ${link(repo)}`;
    case 'CreateEvent': return p.ref_type === 'repository' ? `🆕 Created ${link(repo)}` : null;
    case 'WatchEvent': return `⭐ Starred ${link(repo)}`;
    case 'ForkEvent': return `🍴 Forked ${link(repo)}`;
    case 'ReleaseEvent': return `🚀 Released [${esc(p.release.tag_name)}](${p.release.html_url}) in ${link(repo)}`;
    case 'PublicEvent': return `🎉 Open-sourced ${link(repo)}`;
    default: return null;
  }
}

async function fetchActivity(login, token) {
  const events = await api(token, `https://api.github.com/users/${login}/events/public?per_page=60`);
  const lines = [];
  for (const e of events) {
    const d = describe(e, login);
    if (d && lines[lines.length - 1]?.text !== d) lines.push({ text: d, date: e.created_at.slice(0, 10) });
    if (lines.length === 6) break;
  }
  return lines.length
    ? lines.map(l => `\`${l.date}\` ${l.text}  `).join('\n')
    : '_Quiet lately... probably deep in a refactor._';
}

module.exports = { fetchStats, renderStats, fetchActivity };
