// Fit one delivered NPC image (any size; transparent, or on a flat background) to the NPC master contract
// (src/data/npcArt.ts, same as the Class 1 character masters): 192×192 transparent, boots on row 153,
// body axis between columns 94 and 95, one uniform scale so head top → boot bottom is ~121 px.
//
//   node art-source/npcs/tools/fit-npc.mjs <npcId> <raw.png> [--top=<row>] [--feet=<row>] [--axis=<col>] [--height=<px>]
//
// --top / --feet: source rows of the head top and the last boot row when a held prop (staff, banner) rises above
// the head or a base / shadow sits under the feet; default: the opaque bounding box. --axis: source column of the
// body's mirror axis; default: the bounding-box centre. --height: target body height (118–125; default 121).
// Writes public/<target path from NPC_ART_TARGETS> and art-source/npcs/<npcId>/fit.json (scale, boxes, checks).
// Premultiplied-alpha area resampling; one scale for the whole figure; never per-part resizing.
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { encodePng, readAnyPng } from '../../monsters/crypt_brute/pass-4b/tools/png.mjs';

const C = 192, FEET_ROW = 153, AXIS = 95;
const [npcId, rawPath, ...flags] = process.argv.slice(2);
if (!npcId || !rawPath) throw new Error('usage: fit-npc.mjs <npcId> <raw.png> [--top=] [--feet=] [--axis=] [--height=]');
const opt = Object.fromEntries(flags.map((f) => f.replace(/^--/, '').split('=')).map(([k, v]) => [k, Number(v)]));
const targets = Object.fromEntries([...readFileSync('src/data/npcArt.ts', 'utf8').matchAll(/^\s+([a-z_]+): `\$\{DIR\}\/([a-z_]+\.png)`,$/gm)].map((m) => [m[1], m[2]]));
if (!targets[npcId]) throw new Error(`unknown NPC ${npcId}; expected one of ${Object.keys(targets).join(', ')}`);

const src = readAnyPng(rawPath), W = src.width, H = src.height, d = src.data;
// A flat opaque background (all four corners the same colour) is keyed out; soft fringes fade with distance.
const corner = (x, y) => [...d.subarray((y * W + x) * 4, (y * W + x) * 4 + 4)];
const corners = [corner(0, 0), corner(W - 1, 0), corner(0, H - 1), corner(W - 1, H - 1)];
const flat = corners.every((c) => c[3] === 255 && c.slice(0, 3).every((v, i) => Math.abs(v - corners[0][i]) < 10));
if (flat) {
  const [br, bg, bb] = corners[0];
  for (let i = 0; i < W * H; i++) {
    const dist = Math.hypot(d[i * 4] - br, d[i * 4 + 1] - bg, d[i * 4 + 2] - bb);
    if (dist < 18) d[i * 4 + 3] = 0;
    else if (dist < 48) d[i * 4 + 3] = Math.round(d[i * 4 + 3] * (dist - 18) / 30);
  }
}
for (let i = 3; i < d.length; i += 4) if (d[i] < 12) d[i] = 0;

let x0 = W, y0 = H, x1 = -1, y1 = -1;
for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) if (d[(y * W + x) * 4 + 3]) { x0 = Math.min(x0, x); x1 = Math.max(x1, x); y0 = Math.min(y0, y); y1 = Math.max(y1, y); }
if (x1 < 0) throw new Error('no opaque pixels');
const top = opt.top ?? y0, feet = opt.feet ?? y1, axis = opt.axis ?? (x0 + x1 + 1) / 2;
const s = (opt.height ?? 121) / (feet + 1 - top);
const ox = AXIS - axis * s, oy = FEET_ROW + 1 - (feet + 1) * s;

const out = new Uint8Array(C * C * 4);
for (let ty = 0; ty < C; ty++) for (let tx = 0; tx < C; tx++) {
  const sx0 = (tx - ox) / s, sx1 = (tx + 1 - ox) / s, sy0 = (ty - oy) / s, sy1 = (ty + 1 - oy) / s;
  let r = 0, g = 0, b = 0, a = 0, area = 0;
  for (let sy = Math.floor(sy0); sy < Math.ceil(sy1); sy++) {
    const wy = Math.min(sy1, sy + 1) - Math.max(sy0, sy); if (wy <= 0) continue;
    for (let sx = Math.floor(sx0); sx < Math.ceil(sx1); sx++) {
      const wx = Math.min(sx1, sx + 1) - Math.max(sx0, sx); if (wx <= 0) continue;
      const w = wx * wy; area += w;
      if (sx < 0 || sy < 0 || sx >= W || sy >= H) continue;
      const i = (sy * W + sx) * 4, al = d[i + 3] / 255;
      r += d[i] * al * w; g += d[i + 1] * al * w; b += d[i + 2] * al * w; a += al * w;
    }
  }
  if (!area || !a) continue;
  const o = (ty * C + tx) * 4;
  out[o] = Math.round(r / a); out[o + 1] = Math.round(g / a); out[o + 2] = Math.round(b / a);
  out[o + 3] = Math.min(255, Math.round((a / area) * 255));
}

// Checks: feet on the contract row, nothing touching the canvas edge, centred on the axis.
let fx0 = C, fy0 = C, fx1 = -1, fy1 = -1;
for (let y = 0; y < C; y++) for (let x = 0; x < C; x++) if (out[(y * C + x) * 4 + 3] >= 128) { fx0 = Math.min(fx0, x); fx1 = Math.max(fx1, x); fy0 = Math.min(fy0, y); fy1 = Math.max(fy1, y); }
const report = {
  npcId, source: rawPath, sourceSize: [W, H], keyedBackground: flat, sourceBox: [x0, y0, x1, y1], top, feet, axis, scale: Number(s.toFixed(4)),
  outputBox: [fx0, fy0, fx1, fy1], bodyHeight: (opt.height ?? 121),
  checks: { feetOnRow153: Math.abs(fy1 - FEET_ROW) <= 1 || opt.feet !== undefined, clearOfEdges: fx0 > 0 && fy0 > 0 && fx1 < C - 1 && fy1 < C - 1 },
};
const outPath = join('public/assets/npcs', targets[npcId]);
mkdirSync(dirname(outPath), { recursive: true });
writeFileSync(outPath, encodePng(C, C, out));
mkdirSync(join('art-source/npcs', npcId), { recursive: true });
writeFileSync(join('art-source/npcs', npcId, 'fit.json'), JSON.stringify(report, null, 2) + '\n');
console.log(JSON.stringify(report));
