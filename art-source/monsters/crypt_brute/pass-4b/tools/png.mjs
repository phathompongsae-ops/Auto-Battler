// Any 8-bit non-interlaced PNG (gray, RGB, palette, gray+alpha, RGBA) -> { width, height, data: RGBA }, plus RGBA encode.
import { readFileSync } from 'node:fs';
import { inflateSync } from 'node:zlib';
export { encodePng } from '../../../../../tools/monster-art/stripMetrics.mjs';
export function readAnyPng(file) {
  const b = readFileSync(file);
  let pos = 8, W = 0, H = 0, depth = 0, type = 0, lace = 0, plte = null, trns = null; const idat = [];
  while (pos < b.length) {
    const len = b.readUInt32BE(pos), kind = b.toString('latin1', pos + 4, pos + 8), body = b.subarray(pos + 8, pos + 8 + len);
    if (kind === 'IHDR') { W = body.readUInt32BE(0); H = body.readUInt32BE(4); depth = body[8]; type = body[9]; lace = body[12]; }
    else if (kind === 'PLTE') plte = body; else if (kind === 'tRNS') trns = body;
    else if (kind === 'IDAT') idat.push(body); else if (kind === 'IEND') break;
    pos += 12 + len;
  }
  if (depth !== 8 || lace) throw new Error(`unsupported depth ${depth} / interlace ${lace}`);
  const ch = { 0: 1, 2: 3, 3: 1, 4: 2, 6: 4 }[type], stride = W * ch, raw = inflateSync(Buffer.concat(idat)), px = new Uint8Array(stride * H);
  for (let y = 0; y < H; y++) {
    const f = raw[y * (stride + 1)], s = y * (stride + 1) + 1, r = y * stride;
    for (let x = 0; x < stride; x++) {
      const a = x >= ch ? px[r + x - ch] : 0, u = y ? px[r - stride + x] : 0, c = y && x >= ch ? px[r - stride + x - ch] : 0;
      let p = 0; if (f === 1) p = a; else if (f === 2) p = u; else if (f === 3) p = (a + u) >> 1;
      else if (f === 4) { const q = a + u - c, pa = Math.abs(q - a), pb = Math.abs(q - u), pc = Math.abs(q - c); p = pa <= pb && pa <= pc ? a : pb <= pc ? u : c; }
      px[r + x] = (raw[s + x] + p) & 255;
    }
  }
  const data = new Uint8Array(W * H * 4);
  for (let i = 0; i < W * H; i++) {
    const o = i * 4, v = px.subarray(i * ch, i * ch + ch);
    if (type === 0) data.set([v[0], v[0], v[0], 255], o);
    else if (type === 2) data.set([v[0], v[1], v[2], 255], o);
    else if (type === 3) data.set([plte[v[0] * 3], plte[v[0] * 3 + 1], plte[v[0] * 3 + 2], trns && v[0] < trns.length ? trns[v[0]] : 255], o);
    else if (type === 4) data.set([v[0], v[0], v[0], v[1]], o);
    else data.set(v, o);
  }
  return { width: W, height: H, type, data };
}
