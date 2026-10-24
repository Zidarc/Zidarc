// assets/projects.svg — `ls ~/projects` as a 2x2 grid of featured projects. Edit PROJECTS below.
const L = require('./lib');
const { C, CW, X0, esc, wrap } = L;

const PROJECTS = [
  ['recursion-hell', 'Competitive puzzle platform with a Stranger Things aesthetic. Graph-based puzzles, a live leaderboard on Supabase Realtime, ember particles and glassmorphism UI.', ['Node.js', 'TypeScript', 'React', 'Supabase']],
  ['bmp-editor', '24-bit BMP image processor in C with a Raylib GUI. Binary file I/O, manual memory management and image processing, no image libraries.', ['C', 'Raylib', 'Binary I/O']],
  ['synergy', 'Real-time stock exchange simulator with sub-second updates across 300+ transactions. Admin dashboard cut oversight by 40%, schemas cut data errors by 30%.', ['React', 'Supabase', 'WebSockets']],
  ['pixel-town', 'Top-down pixel art RPG built from scratch in C++ and Raylib. NPC dialogue system, mini-game state machine and hand-made world assets.', ['C++', 'Raylib', 'Pixel Art']],
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
