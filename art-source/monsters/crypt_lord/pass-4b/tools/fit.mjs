// Reproducible frame fitting with one explicit scale per source sheet. No per-frame scaling.
// node fit.mjs <spec.json>; premultiplied-alpha area resampling, shared repo PNG codec.
import { readFileSync, writeFileSync } from 'node:fs';
import { readAnyPng, encodePng } from '../../../crypt_brute/pass-4b/tools/png.mjs';
import { components } from './components.mjs';
const spec = JSON.parse(readFileSync(process.argv[2], 'utf8'));
const src = readAnyPng(spec.source), W = src.width, CW = 224, CH = 192, FEET = 190;
const s = spec.scale, count = spec.frames.length;
const isolated = spec.frames.some(f => f.componentIds) ? components(src).labels : null;
for (let i = 3; i < src.data.length; i += 4) {
  if (src.data[i] < 12) src.data[i] = 0;
}
const out = new Uint8Array(CW * count * CH * 4);
spec.frames.forEach((f, k) => {
  const ox = (f.targetX ?? 112) - f.rootX * s;
  const oy = FEET - (f.ground + 1) * s + (f.dy ?? 0);
  for (let ty = 0; ty < CH; ty++) for (let tx = 0; tx < CW; tx++) {
    const x0 = (tx - ox) / s, x1 = (tx + 1 - ox) / s;
    const y0 = (ty - oy) / s, y1 = (ty + 1 - oy) / s;
    let r = 0, g = 0, b = 0, a = 0, area = 0;
    for (let sy = Math.floor(y0); sy < Math.ceil(y1); sy++) {
      const wy = Math.min(y1, sy + 1) - Math.max(y0, sy); if (wy <= 0) continue;
      for (let sx = Math.floor(x0); sx < Math.ceil(x1); sx++) {
        const wx = Math.min(x1, sx + 1) - Math.max(x0, sx); if (wx <= 0) continue;
        const weight = wx * wy; area += weight;
        if (sx < f.box[0] || sx > f.box[2] || sy < f.box[1] || sy > f.box[3]) continue;
        if (isolated && f.componentIds && !f.componentIds.includes(isolated[sy * W + sx])) continue;
        const i = (sy * W + sx) * 4, al = src.data[i + 3] / 255;
        r += src.data[i] * al * weight; g += src.data[i + 1] * al * weight;
        b += src.data[i + 2] * al * weight; a += al * weight;
      }
    }
    const A = Math.round(255 * a / area), i = (ty * CW * count + k * CW + tx) * 4;
    if (A >= 4) { out[i] = Math.round(r / a); out[i+1] = Math.round(g / a); out[i+2] = Math.round(b / a); out[i+3] = A; }
  }
});
writeFileSync(spec.out, encodePng(CW * count, CH, out));
console.log(JSON.stringify({ out: spec.out, scale: s, frames: count }));
