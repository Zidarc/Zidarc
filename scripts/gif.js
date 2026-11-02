// A tiny animated-GIF encoder (GIF89a, global palette, LZW). Frames are arrays of palette indices.
function lzw(minSize, data) {
  const clear = 1 << minSize, eoi = clear + 1, out = [];
  let size = minSize + 1, next = eoi + 1, dict = new Map(), cur = 0, bits = 0;
  const emit = c => { cur |= c << bits; bits += size; while (bits >= 8) { out.push(cur & 255); cur >>>= 8; bits -= 8; } };
  emit(clear);
  let prefix = data[0];
  for (let i = 1; i < data.length; i++) {
    const k = data[i], key = prefix * 256 + k;
    const hit = dict.get(key);
    if (hit !== undefined) { prefix = hit; continue; }
    emit(prefix);
    if (next < 4096) { dict.set(key, next++); if (next > 1 << size && size < 12) size++; }
    else { emit(clear); dict = new Map(); size = minSize + 1; next = eoi + 1; }
    prefix = k;
  }
  emit(prefix); emit(eoi);
  if (bits > 0) out.push(cur & 255);
  return out;
}

// palette: [[r, g, b]] (up to 256); frames: [{ px: Uint8Array(w*h), delay: centiseconds }]
function encode(w, h, palette, frames) {
  let bitsPer = 1;
  while (1 << bitsPer < palette.length) bitsPer++;
  const out = [];
  const u16 = v => out.push(v & 255, (v >> 8) & 255);
  out.push(...Buffer.from('GIF89a'));
  u16(w); u16(h);
  out.push(0xf0 | (bitsPer - 1), 0, 0);
  for (let i = 0; i < 1 << bitsPer; i++) out.push(...(palette[i] || [0, 0, 0]));
  out.push(0x21, 0xff, 11, ...Buffer.from('NETSCAPE2.0'), 3, 1, 0, 0, 0);
  const minSize = Math.max(2, bitsPer);
  for (const f of frames) {
    out.push(0x21, 0xf9, 4, 0x04); u16(f.delay); out.push(0, 0);
    out.push(0x2c); u16(0); u16(0); u16(w); u16(h); out.push(0);
    out.push(minSize);
    const data = lzw(minSize, f.px);
    for (let i = 0; i < data.length; i += 255) { const blk = data.slice(i, i + 255); out.push(blk.length, ...blk); }
    out.push(0);
  }
  out.push(0x3b);
  return Buffer.from(out);
}

module.exports = { encode };
