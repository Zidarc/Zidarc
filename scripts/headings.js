// assets/h-*.svg — section headings drawn in the terminal theme (markdown ## headings render in GitHub's own style).
const L = require('./lib');
const { C, CW, esc } = L;

const HEADINGS = [
  ['projects', 'projects', 'things i built'],
  ['huna', 'say hi to huna', 'the resident cat'],
  ['stats', 'stats', 'refreshed every 6h'],
  ['activity', 'recent activity', 'public events'],
  ['fortune', "today's fortune", 'new one daily'],
];

function renderHeading(i, title, note) {
  const W = 900, H = 56, Y = 35;
  const label = `${String(i + 1).padStart(2, '0')}  ${title.toUpperCase()}`;
  const lineX = 54 + [...label].length * 11 + 16, noteW = [...note].length * 8, lineEnd = W - 30 - noteW - 22;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" font-family="'JetBrains Mono','Fira Code','Cascadia Code',Consolas,monospace">
<title>${esc(title)}</title>
<style>.cur{animation:b 1s step-end infinite}@keyframes b{50%{opacity:0}}</style>
<rect x="10" y="8" width="${W - 20}" height="${H - 16}" rx="8" fill="${C.bg}" stroke="${C.key}" stroke-opacity=".55"/>
<rect x="10" y="8" width="5" height="${H - 16}" rx="2" fill="${C.key}"/>
<text x="30" y="${Y}" font-size="17" font-weight="700" fill="${C.key}">❯</text>
<text x="54" y="${Y}" font-size="17" font-weight="700" fill="${C.text}" textLength="${[...label].length * 11}" lengthAdjust="spacing" xml:space="preserve">${esc(label)}</text>
<rect class="cur" x="${lineX - 10}" y="${Y - 13}" width="${CW}" height="16" fill="${C.key}" opacity=".9"/>
<line x1="${lineX + 6}" y1="${Y - 5}" x2="${lineEnd}" y2="${Y - 5}" stroke="${C.dim}" stroke-dasharray="4 5"/>
<text x="${W - 30}" y="${Y - 1}" font-size="13" text-anchor="end" fill="${C.dim}"># ${esc(note)}</text>
</svg>
`;
}

const renderHeadings = () => HEADINGS.forEach(([slug, title, note], i) => L.write(`assets/h-${slug}.svg`, renderHeading(i, title, note)));

module.exports = renderHeadings;
if (require.main === module) renderHeadings();
