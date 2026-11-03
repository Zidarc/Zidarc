// Scheduled refresh: hero, headings, projects, stats, activity, quote of the day, and the cat's mood,
// plus Karachi's weather and Ali's latest commits (which feed her), and the bot's reaction GIFs.
// Locally without a token it renders everything except the GitHub data (DEMO=1 fills in sample stats and activity).
const fs = require('fs');
const path = require('path');
const L = require('./lib');
const renderHero = require('./hero');
const renderProjects = require('./projects');
const renderHeadings = require('./headings');
const { fetchStats, renderStats, fetchActivity, renderActivity } = require('./stats');
const { renderQuote } = require('./quote');
const cat = require('./cat-core');
const { REACTIONS, render: renderReaction } = require('./reactions');

// Karachi right now, from Open-Meteo (no key needed). Rain there means rain in her scene.
async function fetchWeather(now) {
  try {
    const res = await fetch('https://api.open-meteo.com/v1/forecast?latitude=24.86&longitude=67.01&current=temperature_2m,weather_code,is_day&timezone=Asia%2FKarachi');
    const { current: c } = await res.json();
    return { code: c.weather_code, temp: c.temperature_2m, isDay: !!c.is_day, at: now.toISOString() };
  } catch (e) {
    console.log('weather unavailable:', e.message);
    return null;
  }
}

const LOGIN = process.env.LOGIN || 'Zidarc';
const TOKEN = process.env.GITHUB_TOKEN;
const DEMO = {
  langs: [['TypeScript', 38.2], ['C++', 21.5], ['C', 16.9], ['JavaScript', 12.4], ['Python', 6.1], ['CSS', 4.9]].map(([name, pct]) => ({ name, pct })),
  repos: 24, stars: 37, commits: 612, prs: 18, issues: 9, followers: 42, contributions: 701,
  current: 6, longest: 23, load: ['3.4', '2.9', '1.9'], uptime: '2y 3m',
  spark: Array.from({ length: 60 }, (_, i) => Math.max(0, Math.round(4 + 4 * Math.sin(i / 3) + ((i * 7) % 5) - 3))),
};

const DEMO_ACTIVITY = [
  ['2026-10-24', 'push', '4 commits → Zidarc/Cyber-Loop'], ['2026-10-23', 'pr', 'merged #12 in Zidarc/Ishara'],
  ['2026-10-21', 'star', 'starred raysan5/raylib'], ['2026-10-20', 'new', 'created Zidarc/Portfolio'],
  ['2026-10-18', 'release', 'v1.2.0 in Zidarc/Cyber-Loop'], ['2026-10-15', 'fork', 'forked Platane/snk'],
].map(([date, kind, text]) => ({ date, kind, text }));

(async () => {
  const now = new Date();
  L.write('assets/hero.svg', renderHero());
  L.write('assets/projects.svg', renderProjects());
  renderHeadings();
  L.write('assets/quote.svg', renderQuote(now));

  const st = cat.load();
  cat.decay(st, now);
  st.weather = (await fetchWeather(now)) || st.weather;

  if (TOKEN) {
    const stats = await fetchStats(LOGIN, TOKEN);
    cat.feedFromCode(st, stats.calendar, now);
    L.write('assets/stats.svg', renderStats(stats, LOGIN));
    L.write('assets/activity.svg', renderActivity(await fetchActivity(LOGIN, TOKEN)));
  } else if (process.env.DEMO) {
    L.write('assets/stats.svg', renderStats(DEMO, LOGIN));
    L.write('assets/activity.svg', renderActivity(DEMO_ACTIVITY));
  } else {
    console.log('No GITHUB_TOKEN: skipped stats and activity.');
  }
  cat.writeAll(st, now);
  fs.mkdirSync(path.join(L.ROOT, 'assets', 'reactions'), { recursive: true });
  for (const name of REACTIONS) fs.writeFileSync(path.join(L.ROOT, 'assets', 'reactions', `${name}.gif`), renderReaction(name));
  L.stampReadme();
  console.log('profile rebuilt');
})().catch(e => { console.error(e); process.exit(1); });
