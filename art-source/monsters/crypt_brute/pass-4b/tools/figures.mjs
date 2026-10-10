// Detect figures in a pose sheet (alpha >= 128 connected by projection), row-major. Exports measure() for reuse.
import { readAnyPng } from './png.mjs';
export function figures(img, { minGap = -4 } = {}) {
  const { width: W, height: H, data } = img, A = (x, y) => data[(y * W + x) * 4 + 3];
  // 1. connected components on a 4x-downsampled occupancy grid, then merge components whose boxes overlap
  const G = 4, gw = Math.ceil(W / G), gh = Math.ceil(H / G), occ = new Uint8Array(gw * gh);
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) if (A(x, y) >= 128) occ[((y / G) | 0) * gw + ((x / G) | 0)] = 1;
  const lab = new Int32Array(gw * gh).fill(-1), boxes = [];
  for (let i = 0; i < occ.length; i++) {
    if (!occ[i] || lab[i] >= 0) continue;
    const st = [i], b = { l: 1e9, r: -1, t: 1e9, b: -1, n: 0 }; lab[i] = boxes.length;
    while (st.length) { const j = st.pop(), x = j % gw, y = (j / gw) | 0; b.l = Math.min(b.l, x); b.r = Math.max(b.r, x); b.t = Math.min(b.t, y); b.b = Math.max(b.b, y); b.n++;
      for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) { const nx = x + dx, ny = y + dy; if (nx < 0 || ny < 0 || nx >= gw || ny >= gh) continue; const k = ny * gw + nx; if (occ[k] && lab[k] < 0) { lab[k] = boxes.length; st.push(k); } } }
    boxes.push(b);
  }
  let figs = boxes.filter((b) => b.n > 200).map((b) => ({ l: b.l * G, r: Math.min(W - 1, b.r * G + G - 1), t: b.t * G, b: Math.min(H - 1, b.b * G + G - 1) }));
  // merge overlapping boxes (e.g. a hammer separated from the hands)
  for (let merged = true; merged;) { merged = false;
    for (let i = 0; i < figs.length && !merged; i++) for (let j = i + 1; j < figs.length && !merged; j++) { const a = figs[i], c = figs[j];
      if (a.l <= c.r + minGap && c.l <= a.r + minGap && a.t <= c.b + minGap && c.t <= a.b + minGap) { figs[i] = { l: Math.min(a.l, c.l), r: Math.max(a.r, c.r), t: Math.min(a.t, c.t), b: Math.max(a.b, c.b) }; figs.splice(j, 1); merged = true; } } }
  // tighten to exact alpha >= 32 bounds
  figs = figs.map((f) => { let l = 1e9, r = -1, t = 1e9, b = -1; for (let y = f.t; y <= f.b; y++) for (let x = f.l; x <= f.r; x++) if (A(x, y) >= 32) { l = Math.min(l, x); r = Math.max(r, x); t = Math.min(t, y); b = Math.max(b, y); } return { l, r, t, b }; });
  // split boxes much wider than the median figure (touching neighbours) at the emptiest column near each expected seam
  const med = [...figs].map((f) => f.r - f.l + 1).sort((x, y) => x - y)[Math.floor(figs.length / 2)];
  figs = figs.flatMap((f) => {
    const w = f.r - f.l + 1, k = Math.round(w / med); if (k < 2 || w < med * 1.6) return [f];
    const col = (x) => { let n = 0; for (let y = f.t; y <= f.b; y++) if (A(x, y) >= 128) n++; return n; };
    const cuts = []; for (let i = 1; i < k; i++) { const c = f.l + (i * w) / k; let best = c, bv = 1e9; for (let x = Math.round(c - med * 0.3); x <= Math.round(c + med * 0.3); x++) { const v = col(x); if (v < bv) { bv = v; best = x; } } cuts.push(best); }
    const edges = [f.l, ...cuts, f.r + 1]; return edges.slice(0, -1).map((l, i) => ({ l, r: edges[i + 1] - 1, t: f.t, b: f.b }));
  });
  figs = figs.map((f) => { let l = 1e9, r = -1, t = 1e9, b = -1; for (let y = f.t; y <= f.b; y++) for (let x = f.l; x <= f.r; x++) if (A(x, y) >= 32) { l = Math.min(l, x); r = Math.max(r, x); t = Math.min(t, y); b = Math.max(b, y); } return { l, r, t, b }; });
  const rowOf = (f) => figs.filter((g) => g.t <= f.b && f.t <= g.b).reduce((m, g) => Math.min(m, g.t), f.t);
  return figs.sort((a, c) => rowOf(a) - rowOf(c) || a.l - c.l);
}
/** Grey stone (hammer head): low saturation, mid value. */
export const isStone = (r, g, b) => { const mx = Math.max(r, g, b), mn = Math.min(r, g, b); return mx - mn < 28 && mx > 60; };
export function measure(img, f) {
  const { width: W, data } = img, h = f.b - f.t + 1;
  const span = (y0, y1, skipStone) => { let l = 1e9, r = -1, n = 0, sx = 0;
    for (let y = y0; y <= y1; y++) for (let x = f.l; x <= f.r; x++) { const i = (y * W + x) * 4; if (data[i + 3] < 128) continue; if (skipStone && isStone(data[i], data[i + 1], data[i + 2])) continue; l = Math.min(l, x); r = Math.max(r, x); n++; sx += x; }
    return n ? { l, r, c: (l + r) / 2, mean: sx / n } : null; };
  return { ...f, w: f.r - f.l + 1, h, feet: span(f.b - Math.round(h * 0.06), f.b, true) };
}
if (process.argv[1]?.endsWith('figures.mjs')) {
  const img = readAnyPng(process.argv[2]);
  figures(img).forEach((f, i) => { const m = measure(img, f); console.log(i, JSON.stringify({ l: m.l, r: m.r, t: m.t, b: m.b, w: m.w, h: m.h, aspect: +(m.w / m.h).toFixed(3), feet: m.feet && [m.feet.l, m.feet.r, m.feet.c] })); });
}
