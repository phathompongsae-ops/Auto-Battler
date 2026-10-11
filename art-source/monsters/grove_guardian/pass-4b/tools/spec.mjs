// Fit-spec generator for one Guardian pose sheet: figures in row-major order (first = standing scale anchor),
// one scale for the whole sheet (anchor height -> standing height), and a root per frame.
//   node spec.mjs <sheet.png> <state> <standHeight> <root: heart|backfoot> [dropFirst=1]
// heart:    the chest gem stays put (walk: legs alternate under a steady trunk).
// backfoot: the planted back (left) foot stays put (attack, stomp, hit: no root slide during lunges and lifts).
import { writeFileSync } from 'node:fs';
import { readAnyPng } from '../../../crypt_brute/pass-4b/tools/png.mjs';
import { components } from './components.mjs';

const [sheet, state, stand, mode, dropFirst = '1'] = process.argv.slice(2);
const img = readAnyPng(sheet), W = img.width;
const { labels, regions } = components(img);
const figs = regions.filter((r) => r.n > 5000).sort((a, b) => (Math.abs(a.box[1] - b.box[1]) > 120 ? a.box[1] - b.box[1] : a.box[0] - b.box[0]));
const px = (x, y) => img.data.subarray((y * W + x) * 4, (y * W + x) * 4 + 4);

function measure(r) {
  const [x0, y0, x1, y1] = r.box;
  // Amber gems (eye and heart): bright warm pixels; the heart is the lower blob.
  const amber = [];
  for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
    if (labels[y * W + x] !== r.id) continue;
    const [R, G, B, A] = px(x, y);
    if (A > 200 && R > 235 && G > 150 && G < 225 && B < 90) amber.push([x, y]);
  }
  const midY = y0 + (y1 - y0) * 0.38;
  const heart = amber.filter(([, y]) => y > midY);
  const heartX = heart.length ? heart.reduce((s, [x]) => s + x, 0) / heart.length : (x0 + x1) / 2;
  // Ground contact: runs of this figure in the lowest 4% of its height; the back foot is the leftmost run.
  const band = Math.max(3, Math.round((y1 - y0) * 0.04));
  const runs = [];
  for (let x = x0; x <= x1; x++) {
    let hit = false;
    for (let y = y1 - band; y <= y1; y++) if (labels[y * W + x] === r.id && px(x, y)[3] >= 128) { hit = true; break; }
    if (hit) { const last = runs.at(-1); if (last && x - last[1] <= 3) last[1] = x; else runs.push([x, x]); }
  }
  const back = runs[0] ?? [x0, x1];
  return { box: r.box, id: r.id, ground: y1, height: y1 - y0 + 1, heartX, backX: (back[0] + back[1]) / 2, runs };
}

const m = figs.map(measure);
const anchor = m[0];
const scale = Number(stand) / anchor.height;
// Anchor root = midpoint between its outermost ground runs (both feet planted).
const anchorRoot = (anchor.runs[0][0] + anchor.runs.at(-1)[1]) / 2;
const offset = mode === 'heart' ? anchorRoot - anchor.heartX : anchorRoot - anchor.backX;
const frames = m.slice(Number(dropFirst)).map((f) => ({
  componentIds: [f.id],
  box: f.box,
  rootX: Math.round((mode === 'heart' ? f.heartX : f.backX) + offset),
  ground: f.ground,
}));
const out = `art-source/monsters/grove_guardian/pass-4b/fit/${state}.json`;
writeFileSync(out, JSON.stringify({ source: `art-source/monsters/grove_guardian/pass-4b/source/${state}-sheet.png`, out: `art-source/monsters/grove_guardian/pass-4b/fit/${state}.png`, scale, root: mode, frames }, null, 2));
console.log(JSON.stringify({ out, figures: m.length, scale: +scale.toFixed(5), anchorHeight: anchor.height, heights: m.map((f) => f.height), roots: frames.map((f) => f.rootX) }));
