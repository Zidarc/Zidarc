// Visitors' GitHub avatars as 10×10 pixel art: fetched tiny, decoded, colours snapped to a coarse grid,
// and drawn as SVG rects so they stay crisp (browsers blur upscaled <image>s).
const { PNG } = require('pngjs');
const jpeg = require('jpeg-js');

const SIZE = 10;
const snap = v => Math.min(255, Math.round(v / 32) * 32);

async function fetchAvatar(login) {
  try {
    const res = await fetch(`https://github.com/${encodeURIComponent(login)}.png?size=${SIZE}`);
    const type = res.headers.get('content-type') || '';
    if (!res.ok) return null;
    const buf = Buffer.from(await res.arrayBuffer());
    const img = type === 'image/png' ? PNG.sync.read(buf) : type === 'image/jpeg' ? jpeg.decode(buf, { useTArray: true }) : null;
    if (!img) return null;
    const px = [];
    for (let y = 0; y < SIZE; y++) for (let x = 0; x < SIZE; x++) {
      // Nearest pixel, in case GitHub sent a different size.
      const sx = Math.floor((x + 0.5) * img.width / SIZE), sy = Math.floor((y + 0.5) * img.height / SIZE), i = (sy * img.width + sx) * 4;
      const a = img.data[i + 3] / 255;
      const c = [0, 1, 2].map(k => snap(img.data[i + k] * a + 255 * (1 - a)));
      px.push('#' + c.map(v => v.toString(16).padStart(2, '0')).join(''));
    }
    return { size: SIZE, px };
  } catch (e) {
    console.log('avatar unavailable:', e.message);
    return null;
  }
}

// Merged horizontal runs, one path per colour.
function avatarSvg(av, x, y, cell) {
  const by = {};
  for (let r = 0; r < av.size; r++) {
    let c = 0;
    while (c < av.size) {
      const col = av.px[r * av.size + c], s = c;
      while (c < av.size && av.px[r * av.size + c] === col) c++;
      (by[col] ||= []).push(`M${s} ${r}h${c - s}v1h${s - c}z`);
    }
  }
  return `<g transform="translate(${x} ${y}) scale(${cell})" shape-rendering="crispEdges">${Object.entries(by).map(([c, d]) => `<path fill="${c}" d="${d.join('')}"/>`).join('')}</g>`;
}

module.exports = { fetchAvatar, avatarSvg };
