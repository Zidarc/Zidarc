// assets/projects.svg — `ls ~/projects` as a 2x2 grid of featured projects. Edit PROJECTS below.
const L = require('./lib');
const { C, CW, X0, esc, wrap } = L;

// Matches the pinned repos on github.com/Zidarc.
const PROJECTS = [
  ['cyber-loop', "Real-time team puzzle game made for DevDay'26. Teams race through graph-based puzzles on a live Supabase Realtime leaderboard, with ember particles and a glassmorphism UI.", ['React', 'Vite', 'TypeScript', 'Express', 'Supabase']],
  ['portfolio', 'Personal portfolio site showcasing my projects and skills. Built for the ICT project at FAST NUCES Karachi.', ['TypeScript', 'React', 'CSS']],
  ['ishara', 'AI campus accessibility app for visually and hearing-impaired students: real-time AR wayfinding and adaptive safety alerts where static, single-sense infrastructure fails.', ['Python', 'AI', 'C#', 'AR']],
  ['zidarc', 'This profile. Pixel-art cards rebuilt by GitHub Actions every 3 hours, and Billo, a cat you can feed by opening an issue. No server: the repo is her database.', ['Node.js', 'SVG', 'GitHub Actions']],
];

function renderProjects() {
  const T = L.typer();
  const COLS = [X0, 465], COL_CH = 44, LH = 20, TOP = 112;
  const cells = PROJECTS.map(([name, desc, tags]) => ({ name, lines: wrap(desc, COL_CH - 2), tags }));
  const rowH = r => Math.max(...cells.slice(r * 2, r * 2 + 2).map(c => c.lines.length)) * LH + 70;

  let y = TOP, out = '';
  for (let r = 0; r < cells.length / 2; r++) {
    cells.slice(r * 2, r * 2 + 2).forEach((c, k) => {
      const x = COLS[k], d = 1 + (r * 2 + k) * 0.25;
      const desc = c.lines.map((s, i) => `<text x="${x + 2 * CW}" y="${y + 26 + i * LH}" fill="${C.text}">${esc(s)}</text>`).join('');
      let tx = x + 2 * CW;
      const tagY = y + 26 + c.lines.length * LH + 6;
      const chips = c.tags.map(t => {
        const w = t.length * 7.2 + 14, chip = `<rect x="${tx}" y="${tagY - 13}" width="${w}" height="19" rx="3" fill="${C.track}" stroke="${C.key}" stroke-opacity=".6"/><text x="${tx + 7}" y="${tagY + 1}" font-size="12" fill="${C.pink}" textLength="${t.length * 7.2}" lengthAdjust="spacing">${esc(t)}</text>`;
        tx += w + 8;
        return chip;
      }).join('');
      out += `<g class="slide" style="animation-delay:${d.toFixed(2)}s"><text x="${x}" y="${y}" font-weight="700"><tspan fill="${C.dim}">drwxr-xr-x </tspan><tspan fill="${C.key}">${esc(c.name)}/</tspan></text>${desc}${chips}</g>\n`;
    });
    y += rowH(r);
  }

  const H = y + 20;
  const body = `
${T.command(74, 'ls -l ~/projects', 0.2, 0.6, 0.9)}
${out}`;
  return L.chrome({ w: 900, h: H, title: `~/projects — ali@${L.HOST}`, body, css: T.css(), emberCount: 8, seed: 31 });
}

module.exports = renderProjects;
if (require.main === module) L.write('assets/projects.svg', renderProjects());
