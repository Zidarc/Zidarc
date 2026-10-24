// Wraps Platane/snk output in the terminal window: pads its viewBox so the snake never leaves the grid area
// visibly, recolours the empty cells to the theme (:root:root beats snk's own :root), and clips to the window.
// Usage (from the snake workflow): node scripts/snake.js dist/snake-raw.svg site/snake.svg
const fs = require('fs');
const L = require('./lib');
const { C, X0 } = L;

const [src, out] = process.argv.slice(2);
const raw = fs.readFileSync(src, 'utf8');
const [, attrs, inner] = raw.match(/<svg([^>]*)>([\s\S]*)<\/svg>\s*$/);
const [vx, vy, vw, vh] = attrs.match(/viewBox="([^"]+)"/)[1].trim().split(/[\s,]+/).map(Number);

// The snake can travel a cell or two beyond the grid; give it room on every side.
const PAD = 32, W = 900, TOP = 96;
const box = [vx - PAD, vy - PAD, vw + 2 * PAD, vh + 2 * PAD];
const w = W - 2 * X0, h = (w * box[3]) / box[2];

const T = L.typer();
const body = `
${T.command(74, 'snake --eat ~/contributions', 0.2, 1, 1)}
<rect x="${X0}" y="${TOP}" width="${w}" height="${h}" rx="6" fill="${C.bar}" stroke="${C.dim}" stroke-opacity=".5"/>
<svg x="${X0}" y="${TOP}" width="${w}" height="${h}" viewBox="${box.join(' ')}" overflow="hidden">${inner}</svg>`;
const css = `
:root:root{--ce:${C.track};--c0:${C.track};--cb:#0000}
${T.css()}`;

fs.writeFileSync(out, L.chrome({ w: W, h: TOP + h + 24, title: `snake — ali@${L.HOST}`, body, css, emberCount: 6, seed: 7 }));
console.log(`wrapped ${src} → ${out}`);
