// Fit frames from a pose sheet into a crypt_brute strip (176x144, feet row 142) at the idle's scale.
//   node fit.mjs <spec.json>
// spec: { sheet, out, anchor: figIndex, anchorHeight (idle px the anchor copy stands for, default 94.5),
//         frames: [{ fig, dx?, dy?, x?: 'upper'|'feet', y?: 'bottom'|number (source ground row) }], x: default mode, ground?: source row }
import { readFileSync, writeFileSync } from 'node:fs';
import { readAnyPng, encodePng } from './png.mjs';
import { figures, isStone } from './figures.mjs';
const spec = JSON.parse(readFileSync(process.argv[2], 'utf8'));
const CW = 176, CH = 144, FEET = 142;
const img = readAnyPng(spec.sheet), W = img.width, src = img.data;
for (let i = 3; i < src.length; i += 4) { const a = src[i]; src[i] = a < 16 ? 0 : a >= 224 ? 255 : a; } // same matte cleanup as the idle
const figs = figures(img);
const s = (spec.anchorHeight ?? 94.5) / (figs[spec.anchor].b - figs[spec.anchor].t + 1);
// Upper-body centre: mean x of opaque non-stone pixels in the top 15-55 % of the STANDING height (skull, shoulders, chest).
const standH = figs[spec.anchor].b - figs[spec.anchor].t + 1;
function upperCentre(f, groundRow) {
  const y0 = Math.round(groundRow - standH * 0.85), y1 = Math.round(groundRow - standH * 0.45); let n = 0, sx = 0;
  for (let y = Math.max(f.t, y0); y <= y1; y++) for (let x = f.l; x <= f.r; x++) { const i = (y * W + x) * 4; if (src[i + 3] < 128 || isStone(src[i], src[i + 1], src[i + 2])) continue; n++; sx += x; }
  return sx / n;
}
// Back-foot heel: leftmost opaque pixel within the lowest 5 % of the standing height above the ground row.
function backFoot(f, groundRow) {
  let l = 1e9; for (let y = Math.round(groundRow - standH * 0.05); y <= groundRow; y++) for (let x = f.l; x <= f.r; x++) if (src[(y * W + x) * 4 + 3] >= 128) { l = Math.min(l, x); break; }
  return l;
}
// Hips: mean x of opaque non-stone pixels 8-35 % of the standing height above the ground (legs, loincloth).
function hips(f, groundRow) {
  let n = 0, sx = 0; for (let y = Math.round(groundRow - standH * (spec.hipsBand?.[1] ?? 0.12)); y <= Math.round(groundRow - standH * (spec.hipsBand?.[0] ?? 0.02)); y++) for (let x = f.l; x <= f.r; x++) { const i = (y * W + x) * 4; if (src[i + 3] < 128 || isStone(src[i], src[i + 1], src[i + 2])) continue; n++; sx += x; }
  return sx / n;
}
// The idle's own upper-body centre, in cell px (measured the same way on the staged idle strip).
const idleUpper = spec.idleUpper ?? 0;
const out = new Uint8Array(CW * spec.frames.length * CH * 4), report = [];
spec.frames.forEach((fr, k) => {
  const f = figs[fr.fig], ground = typeof fr.y === 'number' ? fr.y : (spec.ground ?? f.b);
  const mode = fr.x ?? spec.x ?? 'upper';
  const cx = mode === 'upper' ? upperCentre(f, ground) : mode === 'backfoot' ? backFoot(f, ground) : mode === 'hips' ? hips(f, ground) : (f.l + f.r) / 2;
  const target = mode === 'backfoot' ? spec.idleBackFoot : mode === 'hips' ? spec.idleHips : idleUpper;
  const ox = target + (fr.dx ?? 0) - (mode === 'backfoot' ? cx : cx + 0.5) * s, oy = FEET - (ground + 1) * s + (fr.dy ?? 0);
  for (let ty = 0; ty < CH; ty++) for (let tx = 0; tx < CW; tx++) {
    const x0 = (tx - ox) / s, x1 = (tx + 1 - ox) / s, y0 = (ty - oy) / s, y1 = (ty + 1 - oy) / s;
    let r = 0, g = 0, b = 0, a = 0, area = 0;
    for (let sy = Math.floor(y0); sy < Math.ceil(y1); sy++) { const wy = Math.min(y1, sy + 1) - Math.max(y0, sy); if (wy <= 0) continue;
      for (let sx = Math.floor(x0); sx < Math.ceil(x1); sx++) { const wx = Math.min(x1, sx + 1) - Math.max(x0, sx); if (wx <= 0) continue;
        const w = wx * wy; area += w; if (sx < f.l || sx > f.r || sy < f.t || sy > f.b) continue;
        const i = (sy * W + sx) * 4, al = src[i + 3] / 255; r += src[i] * al * w; g += src[i + 1] * al * w; b += src[i + 2] * al * w; a += al * w; } }
    let A8 = Math.round(255 * a / area); if (A8 < 4) A8 = 0;
    const o = (ty * CW * spec.frames.length + k * CW + tx) * 4;
    if (A8) { out[o] = Math.round(r / a); out[o + 1] = Math.round(g / a); out[o + 2] = Math.round(b / a); out[o + 3] = A8; }
  }
  report.push({ frame: k, fig: fr.fig, srcH: f.b - f.t + 1, anchorX: +((mode === 'backfoot' ? cx : cx + 0.5) * s + ox).toFixed(2), mode, ground });
});
writeFileSync(spec.out, encodePng(CW * spec.frames.length, CH, out));
console.log(JSON.stringify({ scale: +s.toFixed(4), frames: report }));
