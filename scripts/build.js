// Scheduled refresh: hero, stats, activity, quote of the day, and the cat's mood.
// Locally without a token it renders everything except the GitHub data (DEMO=1 fills in sample stats).
const L = require('./lib');
const renderHero = require('./hero');
const { fetchStats, renderStats, fetchActivity } = require('./stats');
const { renderQuote } = require('./quote');
const cat = require('./cat-core');

const LOGIN = process.env.LOGIN || 'Zidarc';
const TOKEN = process.env.GITHUB_TOKEN;
const DEMO = {
  langs: [['TypeScript', 38.2], ['C++', 21.5], ['C', 16.9], ['JavaScript', 12.4], ['Python', 6.1], ['CSS', 4.9]].map(([name, pct]) => ({ name, pct })),
  repos: 24, stars: 37, commits: 612, prs: 18, issues: 9, followers: 42, contributions: 701,
  current: 6, longest: 23, load: ['3.4', '2.9', '1.9'], uptime: '2y 3m',
  spark: Array.from({ length: 60 }, (_, i) => Math.max(0, Math.round(4 + 4 * Math.sin(i / 3) + ((i * 7) % 5) - 3))),
};

(async () => {
  const now = new Date();
  L.write('assets/hero.svg', renderHero());
  L.write('assets/quote.svg', renderQuote(now));

  const st = cat.load();
  cat.decay(st, now);
  cat.writeAll(st, now);

  if (TOKEN) {
    L.write('assets/stats.svg', renderStats(await fetchStats(LOGIN, TOKEN), LOGIN));
    L.updateReadme('ACTIVITY', await fetchActivity(LOGIN, TOKEN));
  } else if (process.env.DEMO) {
    L.write('assets/stats.svg', renderStats(DEMO, LOGIN));
  } else {
    console.log('No GITHUB_TOKEN: skipped stats and activity.');
  }
  console.log('profile rebuilt');
})().catch(e => { console.error(e); process.exit(1); });
