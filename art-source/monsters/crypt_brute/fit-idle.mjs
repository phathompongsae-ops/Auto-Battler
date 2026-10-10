// Fits the locked reference's two poses into the crypt_brute idle strip (176x144, feet row 142).
//   node art-source/monsters/crypt_brute/fit-idle.mjs art-source/monsters/crypt_brute/source/reference-idle-pair.png art-source/monsters/crypt_brute/idle.png 93.5
// One scale for both frames (pose A fitted to 93.5 px -> measured 94 / 95). The back foot is pinned (identical in both poses) and
// the mean feet-span centre sits on the cell centre. Area resampling in premultiplied alpha keeps the anti-aliased edges.
import { readFileSync, writeFileSync } from 'node:fs';
import { decodePng, encodePng } from '../../../tools/monster-art/stripMetrics.mjs';
const [ref, out, tA] = process.argv.slice(2);
const CW = 176, CH = 144, FEET = 142;
const src = decodePng(readFileSync(ref)); const W = src.width;
// Matte cleanup: haze (a < 16) -> 0; the near-opaque body (252-254, any a >= 224) -> 255; the 16-223 edge ramp is kept.
let haze = 0, lifted = 0;
for (let i = 3; i < src.data.length; i += 4) { const a = src.data[i]; if (a && a < 16) { src.data[i] = 0; haze++; } else if (a >= 224 && a < 255) { src.data[i] = 255; lifted++; } }
const P = [{ l:122, r:877, b:775, backL:175, fl:175, fr:642 }, { l:1029, r:1779, b:775, backL:1083, fl:1083, fr:1537 }];
const rel = P.map(p => (p.fl + p.fr) / 2 - p.backL), meanRel = (rel[0] + rel[1]) / 2;
const s = +tA / (P[0].b + 1 - 134);
const anchorX = CW / 2; // continuous cell centre = pixel centre 87.5
const outData = new Uint8Array(CW * 2 * CH * 4);
P.forEach((p, f) => {
  const ox = anchorX - (p.backL + meanRel) * s, oy = FEET - (p.b + 1) * s;
  for (let ty = 0; ty < CH; ty++) for (let tx = 0; tx < CW; tx++) {
    const x0 = (tx - ox) / s, x1 = (tx + 1 - ox) / s, y0 = (ty - oy) / s, y1 = (ty + 1 - oy) / s;
    let r = 0, g = 0, b = 0, a = 0, area = 0;
    for (let sy = Math.floor(y0); sy < Math.ceil(y1); sy++) {
      const wy = Math.min(y1, sy + 1) - Math.max(y0, sy); if (wy <= 0) continue;
      for (let sx = Math.floor(x0); sx < Math.ceil(x1); sx++) {
        const wx = Math.min(x1, sx + 1) - Math.max(x0, sx); if (wx <= 0) continue;
        const w = wx * wy; area += w;
        if (sx < p.l || sx > p.r || sy < 0 || sy >= src.height) continue;
        const i = (sy * W + sx) * 4, al = src.data[i+3] / 255;
        r += src.data[i] * al * w; g += src.data[i+1] * al * w; b += src.data[i+2] * al * w; a += al * w;
      }
    }
    const o = (ty * CW * 2 + f * CW + tx) * 4;
    let A8 = Math.round(255 * a / area);
    if (A8 < 4) A8 = 0; // no sub-visible fringe from resampling
    if (A8) { outData[o] = Math.round(r / a); outData[o+1] = Math.round(g / a); outData[o+2] = Math.round(b / a); outData[o+3] = A8; }
  }
  const fc = ox + ((p.fl + p.fr) / 2) * s, back = ox + p.backL * s;
  console.log(`frame ${f}: feet centre ${(fc - 0.5).toFixed(2)} px (cell centre 87.5), back-foot left ${(back).toFixed(2)}`);
});
writeFileSync(out, encodePng(CW * 2, CH, outData));
console.log(JSON.stringify({ scale: +s.toFixed(4), hazeRemoved: haze, alphaLifted: lifted }));
