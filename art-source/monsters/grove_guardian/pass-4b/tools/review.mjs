// Disposable review sheets (test-results/guardian-art-review): per-state contacts, all states, and a field
// hierarchy lineup on one feet line at true relative world scale (monsters 0.5, Warrior 40/125), shown 2x.
import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { readAnyPng, encodePng } from '../../../crypt_brute/pass-4b/tools/png.mjs';
const base = 'art-source/monsters/grove_guardian/pass-4b/fit/', dest = 'test-results/guardian-art-review';
mkdirSync(dest, { recursive: true });
const CW = 208, CH = 160, FEET = 158;
function canvas(w, h) { const data = new Uint8Array(w * h * 4); for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) { const v = (Math.floor(x / 12) + Math.floor(y / 12)) % 2 ? 64 : 82; data.set([v, v, v, 255], (y * w + x) * 4); } return { width: w, height: h, data }; }
function paint(out, img, sx, sy, sw, sh, dx, dy, scale = 1) {
  for (let y = 0; y < Math.ceil(sh * scale); y++) for (let x = 0; x < Math.ceil(sw * scale); x++) {
    const xx = dx + x, yy = dy + y; if (xx < 0 || yy < 0 || xx >= out.width || yy >= out.height) continue;
    const a = (Math.min(img.height - 1, sy + Math.floor(y / scale)) * img.width + Math.min(img.width - 1, sx + Math.floor(x / scale))) * 4, o = (yy * out.width + xx) * 4, al = img.data[a + 3] / 255;
    for (let c = 0; c < 3; c++) out.data[o + c] = Math.round(img.data[a + c] * al + out.data[o + c] * (1 - al));
  }
}
const line = (img, y, rgb) => { for (let x = 0; x < img.width; x++) img.data.set([...rgb, 255], (y * img.width + x) * 4); };
const states = ['idle', 'walk', 'attack', 'special', 'hit'].filter((s) => existsSync(base + s + '.png'));
const full = canvas(5 * CW, states.length * (CH + 8));
states.forEach((s, row) => {
  const img = readAnyPng(base + s + '.png'), n = img.width / CW, sheet = canvas(5 * CW, Math.ceil(n / 5) * (CH + 8));
  for (let f = 0; f < n; f++) {
    paint(sheet, img, f * CW, 0, CW, CH, (f % 5) * CW, Math.floor(f / 5) * (CH + 8));
    paint(full, img, f * CW, 0, CW, CH, f * (CW / 2), row * (CH + 8), 0.5);
  }
  for (let r = 0; r < Math.ceil(n / 5); r++) line(sheet, r * (CH + 8) + FEET, [110, 200, 120]);
  writeFileSync(`${dest}/${s}.png`, encodePng(sheet.width, sheet.height, sheet.data));
});
writeFileSync(`${dest}/all-states.png`, encodePng(full.width, full.height, full.data));
// [path, cell w, cell h, feet row, world px per source px]; drawn 2x so small monsters stay legible.
const W = 0.32;
const entries = [
  ['public/assets/characters/warrior/anims/warrior_idle_south.png', 192, 192, 157, W],
  ['public/assets/monsters/slime.png', 56, 48, 46, 0.5],
  ['public/assets/monsters/wolf.png', 86, 60, 58, 0.5 * 1.08],
  ['public/assets/monsters/elite_boar.png', 110, 80, 78, 0.5],
  ['public/assets/monsters/grove_guardian.png', 142, 136, 134, 0.5],
  [base + 'idle.png', CW, CH, FEET, 0.5],
];
const lineup = canvas(760, 200), ground = 180;
let x = 20;
for (const [p, w, h, feet, k] of entries) { const s = k * 2; paint(lineup, readAnyPng(p), 0, 0, w, h, x, Math.round(ground - feet * s), s); x += Math.round(w * s) + 14; }
line(lineup, ground, [100, 190, 110]);
writeFileSync(`${dest}/hierarchy.png`, encodePng(lineup.width, lineup.height, lineup.data));
console.log(dest, states.join(','));
