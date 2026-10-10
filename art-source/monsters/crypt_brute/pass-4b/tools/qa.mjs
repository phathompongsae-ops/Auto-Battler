// Per-strip QA for crypt_brute candidates: validator, body height, root drift, scale proxy, alpha.
//   node qa.mjs <state> <strip.png> [<state> <strip.png> ...]
import { readFileSync } from 'node:fs';
import { decodePng, checkStrip } from '../../../../../tools/monster-art/stripMetrics.mjs';
import { isStone } from './figures.mjs';
const FRAMES = { idle: 2, walk: 6, attack: 5, special: 10, hit: 3 }, CW = 176, CH = 144, FEET = 142;
const args = process.argv.slice(2);
for (let k = 0; k < args.length; k += 2) {
  const state = args[k], png = decodePng(readFileSync(args[k + 1])), W = png.width, D = png.data;
  const stand = state === 'idle' || state === 'walk' ? [88, 100] : null;
  const { problems, metrics } = checkStrip(png, { cellWidth: CW, cellHeight: CH, feetRow: FEET, frames: FRAMES[state], stand });
  const A = (f, x, y) => D[(y * W + f * CW + x) * 4 + 3];
  const rows = [];
  for (let f = 0; f < metrics.cells.length; f++) {
    // body top: highest row holding skull-ivory (bright, warm) pixels, so a raised hammer does not count as body height
    let bodyTop = -1;
    for (let y = 0; y < CH && bodyTop < 0; y++) for (let x = 0; x < CW; x++) { const i = (y * W + f * CW + x) * 4; if (D[i + 3] < 200) continue; const r = D[i], g = D[i + 1], b = D[i + 2]; if (r > 190 && g > 160 && b > 110 && r - b > 40) { bodyTop = y; break; } }
    let heel = -1; for (let x = 0; x < CW && heel < 0; x++) for (let y = 136; y <= 141; y++) if (A(f, x, y) >= 128) { heel = x; break; }
    let n = 0, sx = 0; for (let y = 130; y <= 140; y++) for (let x = 0; x < CW; x++) { const i = (y * W + f * CW + x) * 4; if (D[i + 3] < 128 || isStone(D[i], D[i + 1], D[i + 2])) continue; n++; sx += x + 0.5; }
    let clear = true; for (const y of [142, 143]) for (let x = 0; x < CW; x++) if (A(f, x, y)) clear = false;
    let haze = 0, deepSemi = 0; for (let y = 0; y < CH; y++) for (let x = 0; x < CW; x++) { const a = A(f, x, y); if (!a) continue; if (a < 32) haze++;
      if (a < 255) { let deep = true; for (let dy = -2; dy <= 2 && deep; dy++) for (let dx = -2; dx <= 2; dx++) { const xx = x + dx, yy = y + dy; if (xx < 0 || yy < 0 || xx >= CW || yy >= CH || !A(f, xx, yy)) { deep = false; break; } } if (deep) deepSemi++; } }
    const c = metrics.cells[f];
    rows.push({ f, top: c.top, bottom: c.bottom, l: c.left, r: c.right, bodyH: bodyTop < 0 ? null : FEET - bodyTop, heel, feetBand: +(sx / n).toFixed(1), clear142: clear, faint: haze, deepSemi });
  }
  console.log(`\n== ${state}  ${png.width}x${png.height}  frames ${metrics.cells.length}  ${problems.length ? 'FAIL: ' + problems.join('; ') : 'PASS'}`);
  for (const r of rows) console.log('  ' + JSON.stringify(r));
}
