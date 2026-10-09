// Builds the Field ground atlas (Visual Production Pass 3) from the approved Town ground, with no new generation:
//   node tools/env-art/buildFieldGround.mjs
// - copies the Town grass / dirt plain tiles and its dirt|grass corner set unchanged (same art as the Town)
// - derives two grass-family terrains by colour grade: darkgrass (Guardian stones / tall grass) and moss (grove)
// - paints a calm, motif-free water tile (seamless by construction: periodic shapes only)
// - synthesises grass|darkgrass, grass|moss and water|grass corner sets from the approved dirt|grass shapes: each
//   Town transition tile is turned into a soft mask (how "grass" each pixel is), and the new pair is composited through
//   it, so every Field edge has the same hand-drawn outline as the Town's; shorelines add a thin wet band + soft foam
// - packs 64 px frames in 68 px cells (margin 2, spacing 4, 8 columns) with extruded borders, like the Town atlas
// - writes public/assets/environment/field/ground/field_ground_wang.png and src/data/environment/fieldGroundWang.ts
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Browser } from '../../tests/browser/cdp.mjs';

const root = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const townPng = readFileSync(join(root, 'public/assets/environment/town/ground/town_ground_wang.png')).toString('base64');
const townTs = readFileSync(join(root, 'src/data/environment/townGroundWang.ts'), 'utf8');
const pairFrames = (pair) => townTs.match(new RegExp(`'${pair.replace('|', '\\|')}': \\[([^\\]]+)\\]`))[1].split(',').map(Number);
const plainFrame = (t) => Number(townTs.match(new RegExp(`\\b${t}: \\[(\\d+)`))[1]);
const job = { dirtGrass: pairFrames('dirt|grass'), grass: plainFrame('grass'), dirt: plainFrame('dirt') };

const b = await Browser.launch({ port: 9346 });
try {
  await b.goto('about:blank');
  const out = await b.eval(`(async () => {
    const job = ${JSON.stringify(job)};
    const T = 64, CELL = 68, COLS = 8;
    const town = await createImageBitmap(await (await fetch('data:image/png;base64,${townPng}')).blob());
    const tc = document.createElement('canvas'); tc.width = town.width; tc.height = town.height;
    const tg = tc.getContext('2d', { willReadFrequently: true }); tg.drawImage(town, 0, 0);
    const frame = (i) => tg.getImageData((i % COLS) * CELL + 2, Math.floor(i / COLS) * CELL + 2, T, T);
    const blank = () => new ImageData(T, T);
    const clamp = (v) => Math.max(0, Math.min(255, v));

    const grade = (src, { brightness = 1, saturation = 1, tint }) => {
      const o = blank();
      for (let i = 0; i < src.data.length; i += 4) {
        let r = src.data[i], g = src.data[i + 1], b = src.data[i + 2];
        const l = 0.299 * r + 0.587 * g + 0.114 * b;
        r = (l + (r - l) * saturation) * brightness; g = (l + (g - l) * saturation) * brightness; b = (l + (b - l) * saturation) * brightness;
        if (tint) { r += (tint[0] - r) * tint[3]; g += (tint[1] - g) * tint[3]; b += (tint[2] - b) * tint[3]; }
        o.data[i] = clamp(r); o.data[i + 1] = clamp(g); o.data[i + 2] = clamp(b); o.data[i + 3] = 255;
      }
      return o;
    };

    const G = frame(job.grass), D = frame(job.dirt);
    const mean = (img) => { let r = 0, g = 0, b = 0; for (let i = 0; i < img.data.length; i += 4) { r += img.data[i]; g += img.data[i + 1]; b += img.data[i + 2]; } const n = img.data.length / 4; return [r / n, g / n, b / n]; };
    const gm = mean(G), dm = mean(D), axis = [gm[0] - dm[0], gm[1] - dm[1], gm[2] - dm[2]];
    const axis2 = axis[0] ** 2 + axis[1] ** 2 + axis[2] ** 2;
    // How "grass" (the upper terrain) each pixel of an approved dirt|grass tile is, softened by a 5x5 blur.
    const maskOf = (img) => {
      const raw = new Float32Array(T * T);
      for (let p = 0; p < T * T; p++) {
        const i = p * 4, v = ((img.data[i] - dm[0]) * axis[0] + (img.data[i + 1] - dm[1]) * axis[1] + (img.data[i + 2] - dm[2]) * axis[2]) / axis2;
        raw[p] = Math.max(0, Math.min(1, (v - 0.2) / 0.6));
      }
      const m = new Float32Array(T * T);
      for (let y = 0; y < T; y++) for (let x = 0; x < T; x++) {
        let s = 0, n = 0;
        for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) { const xx = x + dx, yy = y + dy; if (xx >= 0 && yy >= 0 && xx < T && yy < T) { s += raw[yy * T + xx]; n++; } }
        // Re-contrast after the 5x5 blur: pebble specks inside the dirt average out below the threshold and vanish.
        const t = Math.max(0, Math.min(1, (s / n - 0.3) / 0.4));
        m[y * T + x] = t * t * (3 - 2 * t);
      }
      return m;
    };
    const masks = job.dirtGrass.map((f) => maskOf(frame(f)));
    // Corner masks with every corner set / clear must be exactly the plain terrain.
    masks[0].fill(0); masks[15].fill(1);

    const composite = (lower, upper, m, shore) => {
      const o = blank();
      for (let p = 0; p < T * T; p++) {
        const i = p * 4, k = m[p];
        let r = lower.data[i] + (upper.data[i] - lower.data[i]) * k;
        let g = lower.data[i + 1] + (upper.data[i + 1] - lower.data[i + 1]) * k;
        let b = lower.data[i + 2] + (upper.data[i + 2] - lower.data[i + 2]) * k;
        if (shore) {
          // Wet bank just inside the land edge, then a thin soft foam line on the water side.
          const bank = Math.max(0, 1 - Math.abs(k - 0.62) / 0.16) * 0.28;
          r *= 1 - bank; g *= 1 - bank; b *= 1 - bank * 0.6;
          const foam = Math.max(0, 1 - Math.abs(k - 0.3) / 0.12) * 0.35;
          r += (232 - r) * foam; g += (244 - g) * foam; b += (238 - b) * foam;
        }
        o.data[i] = clamp(r); o.data[i + 1] = clamp(g); o.data[i + 2] = clamp(b); o.data[i + 3] = 255;
      }
      return o;
    };

    // Calm water: deep teal with broad, low-contrast ripple bands; every shape is periodic in 64 px, so it tiles.
    const water = (() => {
      const o = blank();
      const TAU = Math.PI * 2;
      for (let y = 0; y < T; y++) for (let x = 0; x < T; x++) {
        const u = x / T, v = y / T;
        const band = Math.sin(TAU * (v * 2 + 0.35 * Math.sin(TAU * u))) * 0.5 + Math.sin(TAU * (u * 1 + v * 3) + 1.3) * 0.35 + Math.sin(TAU * (u * 3 - v * 1) + 0.4) * 0.15;
        const crest = Math.max(0, band - 0.55) / 0.45;
        const i = (y * T + x) * 4;
        o.data[i] = clamp(54 + band * 6 + crest * 34);
        o.data[i + 1] = clamp(128 + band * 8 + crest * 36);
        o.data[i + 2] = clamp(150 + band * 8 + crest * 30);
        o.data[i + 3] = 255;
      }
      return o;
    })();

    const darkgrass = grade(G, { brightness: 0.8, saturation: 0.95, tint: [38, 78, 46, 0.18] });
    const moss = grade(G, { brightness: 0.9, saturation: 0.85, tint: [74, 126, 98, 0.3] });

    // Frame list: plains first, then the four 16-frame corner sets (index = corner mask).
    // Mirrored plain variants break the one-tile stamp (grass is near-uniform at its edges, so mirrors stay seamless).
    const mirror = (src, fx, fy) => { const o = blank(); for (let y = 0; y < T; y++) for (let x = 0; x < T; x++) { const a = (y * T + x) * 4, b = ((fy ? T - 1 - y : y) * T + (fx ? T - 1 - x : x)) * 4; for (let c = 0; c < 4; c++) o.data[a + c] = src.data[b + c]; } return o; };
    const frames = [G, mirror(G, true, false), mirror(G, false, true), mirror(G, true, true), D, mirror(D, true, false), darkgrass, mirror(darkgrass, true, true), moss, mirror(moss, true, true), water];
    const plain = { grass: [0, 1, 2, 3], dirt: [4, 5], darkgrass: [6, 7], moss: [8, 9], water: [10] };
    const lookup = {};
    const addPair = (key, list) => { lookup[key] = list.map((img) => { frames.push(img); return frames.length - 1; }); };
    // The Town dirt|grass set was generated apart from the plain grass: its grass is a little lighter. Shift each tile's
    // grass (and its dirt) toward the plain tiles' mean colours (weighted by the mask), so Field paths show no tile grid.
    const setGrass = mean(frame(job.dirtGrass[15]));
    const setDirt = mean(frame(job.dirtGrass[0]));
    const shift = [gm[0] - setGrass[0], gm[1] - setGrass[1], gm[2] - setGrass[2]];
    const dshift = [dm[0] - setDirt[0], dm[1] - setDirt[1], dm[2] - setDirt[2]];
    const matched = job.dirtGrass.map((f, i) => {
      const src = frame(f), o = blank();
      for (let p = 0; p < T * T; p++) {
        const k = i === 15 ? 1 : i === 0 ? 0 : masks[i][p], q = p * 4;
        for (let c = 0; c < 3; c++) o.data[q + c] = clamp(src.data[q + c] + shift[c] * k + dshift[c] * (1 - k));
        o.data[q + 3] = 255;
      }
      return o;
    });
    addPair('dirt|grass', matched);
    addPair('grass|darkgrass', masks.map((m) => composite(G, darkgrass, m)));
    addPair('grass|moss', masks.map((m) => composite(G, moss, m)));
    addPair('water|grass', masks.map((m) => composite(water, G, m, true)));

    const rows = Math.ceil(frames.length / COLS);
    const atlas = document.createElement('canvas'); atlas.width = COLS * CELL; atlas.height = rows * CELL;
    const ag = atlas.getContext('2d');
    const cell = document.createElement('canvas'); cell.width = cell.height = T; const cg = cell.getContext('2d');
    frames.forEach((img, i) => {
      cg.putImageData(img, 0, 0);
      const x = (i % COLS) * CELL + 2, y = Math.floor(i / COLS) * CELL + 2;
      ag.drawImage(cell, x, y);
      for (let k = 1; k <= 2; k++) {
        ag.drawImage(cell, 0, 0, T, 1, x, y - k, T, 1); ag.drawImage(cell, 0, T - 1, T, 1, x, y + T - 1 + k, T, 1);
        ag.drawImage(cell, 0, 0, 1, T, x - k, y, 1, T); ag.drawImage(cell, T - 1, 0, 1, T, x + T - 1 + k, y, 1, T);
      }
      for (const [sx, sy, dx, dy] of [[0, 0, -2, -2], [T - 1, 0, T, -2], [0, T - 1, -2, T], [T - 1, T - 1, T, T]]) ag.drawImage(cell, sx, sy, 1, 1, x + dx, y + dy, 2, 2);
    });
    return { png: atlas.toDataURL('image/png'), lookup, plain, count: frames.length };
  })()`);
  const pngOut = join(root, 'public/assets/environment/field/ground/field_ground_wang.png');
  mkdirSync(dirname(pngOut), { recursive: true });
  writeFileSync(pngOut, Buffer.from(out.png.split(',')[1], 'base64'));
  const fmt = (o) => Object.entries(o).map(([k, v]) => `  '${k}': [${v.join(', ')}],`).join('\n');
  writeFileSync(join(root, 'src/data/environment/fieldGroundWang.ts'), `// GENERATED by tools/env-art/buildFieldGround.mjs from the approved Town ground atlas (dirt|grass set and plain
// tiles reused; darkgrass / moss graded from grass; water painted; new corner sets composited through the Town
// dirt|grass transition shapes). Do not edit by hand. Frame index per corner mask (bit 8 NW, 4 NE, 2 SW, 1 SE;
// set = the "upper" terrain), per terrain pair "lower|upper".
export const FIELD_GROUND_WANG: Readonly<Record<string, readonly number[]>> = {
${fmt(out.lookup)}
};

/** Plain-tile frames per terrain. */
export const FIELD_GROUND_WANG_PLAIN: Readonly<Record<string, readonly number[]>> = {
${fmt(out.plain)}
};

export const FIELD_GROUND_WANG_FRAMES = ${out.count};
`);
  console.log(JSON.stringify({ frames: out.count, pairs: Object.keys(out.lookup) }));
} finally {
  await b.close();
}
