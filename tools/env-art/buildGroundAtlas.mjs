// Builds the Town ground atlas from PixelLab corner (Wang) tilesets:
//   node tools/env-art/buildGroundAtlas.mjs <dir with ts_<lower>_<upper>.png/.json ...>
// - applies one uniform colour grade (greens desaturated toward the style lock: ground calmer than characters)
// - slices every tile by its metadata bounding box
// - packs 64 px frames with 2 px extruded borders (margin 2, spacing 4) so linear filtering never bleeds
// - writes public/assets/environment/town/ground/town_ground_wang.png and the corner lookup
//   src/data/environment/townGroundWang.ts (generated; do not edit by hand)
import { readdirSync, readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Browser } from '../../tests/browser/cdp.mjs';

const root = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const dir = process.argv[2];
const sets = readdirSync(dir)
  .filter((f) => /^ts_[a-z]+_[a-z]+\.json$/.test(f))
  .sort()
  .map((f) => {
    const [, lower, upper] = f.match(/^ts_([a-z]+)_([a-z]+)\.json$/);
    const meta = JSON.parse(readFileSync(join(dir, f), 'utf8'));
    const png = readFileSync(join(dir, f.replace('.json', '.png'))).toString('base64');
    const tiles = meta.tileset_data.tiles.map((t) => ({ corners: t.corners, box: t.bounding_box }));
    return { lower, upper, png, tiles, source: meta.id };
  });
if (!sets.length) throw new Error(`no ts_<lower>_<upper>.json tilesets in ${dir}`);

const b = await Browser.launch({ port: 9339 });
try {
  await b.goto('about:blank');
  const out = await b.eval(`(async () => {
    const sets = ${JSON.stringify(sets)};
    const T = 64, CELL = T + 4, COLS = 8;
    const frames = [];
    const lookup = {};
    // Colour grade: greens (and yellow-greens) lose ~40% saturation and a little brightness; stone / dirt untouched.
    const grade = (ctx, w, h) => {
      const img = ctx.getImageData(0, 0, w, h);
      const d = img.data;
      for (let i = 0; i < d.length; i += 4) {
        const r = d[i] / 255, g = d[i + 1] / 255, b = d[i + 2] / 255;
        const max = Math.max(r, g, b), min = Math.min(r, g, b), l = (max + min) / 2;
        if (max === min) continue;
        const s0 = l > 0.5 ? (max - min) / (2 - max - min) : (max - min) / (max + min);
        let hue = max === r ? (g - b) / (max - min) + (g < b ? 6 : 0) : max === g ? (b - r) / (max - min) + 2 : (r - g) / (max - min) + 4;
        hue *= 60;
        if (hue < 65 || hue > 165) continue;
        const s = s0 * 0.58, nl = l * 0.97 + 0.015, nh = hue - 6;
        const q = nl < 0.5 ? nl * (1 + s) : nl + s - nl * s, p = 2 * nl - q;
        const conv = (t) => { t = (t + 360) % 360 / 360; if (t < 1 / 6) return p + (q - p) * 6 * t; if (t < 0.5) return q; if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6; return p; };
        d[i] = Math.round(conv(nh + 120) * 255); d[i + 1] = Math.round(conv(nh) * 255); d[i + 2] = Math.round(conv(nh - 120) * 255);
      }
      ctx.putImageData(img, 0, 0);
    };
    for (const set of sets) {
      const blob = await (await fetch('data:image/png;base64,' + set.png)).blob();
      const bmp = await createImageBitmap(blob);
      const sheet = document.createElement('canvas'); sheet.width = bmp.width; sheet.height = bmp.height;
      const sg = sheet.getContext('2d'); sg.drawImage(bmp, 0, 0); grade(sg, bmp.width, bmp.height);
      const masks = new Array(16).fill(-1);
      for (const t of set.tiles) {
        const c = t.corners;
        const mask = (c.NW === 'upper' ? 8 : 0) | (c.NE === 'upper' ? 4 : 0) | (c.SW === 'upper' ? 2 : 0) | (c.SE === 'upper' ? 1 : 0);
        const f = document.createElement('canvas'); f.width = T; f.height = T;
        f.getContext('2d').drawImage(sheet, t.box.x, t.box.y, t.box.width, t.box.height, 0, 0, T, T);
        masks[mask] = frames.length;
        frames.push(f);
      }
      lookup[set.lower + '|' + set.upper] = masks;
    }
    const rows = Math.ceil(frames.length / COLS);
    const atlas = document.createElement('canvas'); atlas.width = COLS * CELL - 0; atlas.height = rows * CELL;
    const ctx = atlas.getContext('2d');
    frames.forEach((f, i) => {
      const x = (i % COLS) * CELL + 2, y = Math.floor(i / COLS) * CELL + 2;
      ctx.drawImage(f, 0, 0, T, 1, x, y - 2, T, 2); ctx.drawImage(f, 0, T - 1, T, 1, x, y + T, T, 2);
      ctx.drawImage(f, 0, 0, 1, T, x - 2, y, 2, T); ctx.drawImage(f, T - 1, 0, 1, T, x + T, y, 2, T);
      ctx.drawImage(f, 0, 0, 1, 1, x - 2, y - 2, 2, 2); ctx.drawImage(f, T - 1, 0, 1, 1, x + T, y - 2, 2, 2);
      ctx.drawImage(f, 0, T - 1, 1, 1, x - 2, y + T, 2, 2); ctx.drawImage(f, T - 1, T - 1, 1, 1, x + T, y + T, 2, 2);
      ctx.drawImage(f, x, y);
    });
    return { png: atlas.toDataURL('image/png'), lookup, frames: frames.length, size: [atlas.width, atlas.height] };
  })()`);
  const pngOut = join(root, 'public', 'assets', 'environment', 'town', 'ground', 'town_ground_wang.png');
  writeFileSync(pngOut, Buffer.from(out.png.split(',')[1], 'base64'));
  const tsOut = join(root, 'src', 'data', 'environment', 'townGroundWang.ts');
  mkdirSync(dirname(tsOut), { recursive: true });
  const pairs = Object.entries(out.lookup)
    .map(([pair, masks]) => `  '${pair}': [${masks.join(', ')}],`)
    .join('\n');
  writeFileSync(
    tsOut,
    `// GENERATED by tools/env-art/buildGroundAtlas.mjs from PixelLab corner tilesets (${sets.map((s) => s.source).join(', ')}).\n` +
      `// Do not edit by hand. Frame index per corner mask (bit 8 NW, 4 NE, 2 SW, 1 SE; set = the "upper" terrain), per terrain pair "lower|upper".\n` +
      `export const TOWN_GROUND_WANG: Readonly<Record<string, readonly number[]>> = {\n${pairs}\n};\n\nexport const TOWN_GROUND_WANG_FRAMES = ${out.frames};\n`,
  );
  console.log(JSON.stringify({ frames: out.frames, size: out.size, pairs: Object.keys(out.lookup) }));
} finally {
  await b.close();
}
