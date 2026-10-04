import { EXP_ANCHORS, MAX_LEVEL, SERVER_LEVEL_CAPS } from '../data/progressionData';

/**
 * Cumulative EXP per level, built once from the anchors with monotone cubic
 * (Fritsch–Carlson) interpolation: smooth between anchors, exact at them,
 * never decreasing. Values are rounded to whole EXP.
 */
function buildCumulative(anchors: Readonly<Record<number, number>>, maxLevel: number): number[] {
  const xs = Object.keys(anchors).map(Number).sort((a, b) => a - b);
  const ys = xs.map((x) => anchors[x]);
  if (xs[0] !== 1 || ys[0] !== 0 || xs[xs.length - 1] !== maxLevel) throw new Error('EXP anchors must start at Lv1 = 0 and end at MAX_LEVEL');

  const n = xs.length;
  const h = xs.slice(1).map((x, i) => x - xs[i]);
  const d = h.map((hi, i) => (ys[i + 1] - ys[i]) / hi);
  if (d.some((s) => s <= 0)) throw new Error('EXP anchors must strictly increase');

  // Tangents: weighted harmonic mean inside, one-sided three-point at the ends.
  const m = new Array<number>(n);
  for (let i = 1; i < n - 1; i++) {
    const w1 = 2 * h[i] + h[i - 1];
    const w2 = h[i] + 2 * h[i - 1];
    m[i] = (w1 + w2) / (w1 / d[i - 1] + w2 / d[i]);
  }
  const endTangent = (h0: number, h1: number, d0: number, d1: number) => {
    const t = ((2 * h0 + h1) * d0 - h0 * d1) / (h0 + h1);
    if (Math.sign(t) !== Math.sign(d0)) return 0;
    if (Math.sign(d0) !== Math.sign(d1) && Math.abs(t) > Math.abs(3 * d0)) return 3 * d0;
    return t;
  };
  m[0] = n > 2 ? endTangent(h[0], h[1], d[0], d[1]) : d[0];
  m[n - 1] = n > 2 ? endTangent(h[n - 2], h[n - 3], d[n - 2], d[n - 3]) : d[n - 2];

  const out = new Array<number>(maxLevel + 1).fill(0);
  for (let i = 0; i < n - 1; i++) {
    for (let level = xs[i]; level <= xs[i + 1]; level++) {
      const t = (level - xs[i]) / h[i];
      const t2 = t * t;
      const t3 = t2 * t;
      const y = (2 * t3 - 3 * t2 + 1) * ys[i] + (t3 - 2 * t2 + t) * h[i] * m[i] + (-2 * t3 + 3 * t2) * ys[i + 1] + (t3 - t2) * h[i] * m[i + 1];
      out[level] = Math.round(y);
    }
  }
  return out;
}

const CUMULATIVE = buildCumulative(EXP_ANCHORS, MAX_LEVEL);

/** Total EXP from Lv1 needed to reach `level`. */
export function cumulativeExp(level: number): number {
  if (!Number.isInteger(level) || level < 1 || level > MAX_LEVEL) throw new RangeError(`level ${level} out of range`);
  return CUMULATIVE[level];
}

/** EXP needed to go from `level` to `level + 1`; 0 at MAX_LEVEL (nothing further). */
export function expToNext(level: number): number {
  if (level >= MAX_LEVEL) return 0;
  return cumulativeExp(level + 1) - cumulativeExp(level);
}

/** Level cap on server day `day` (day 1 = launch). */
export function serverLevelCap(day: number): number {
  let cap = SERVER_LEVEL_CAPS[0].cap;
  for (const entry of SERVER_LEVEL_CAPS) if (day >= entry.fromDay) cap = entry.cap;
  return Math.min(cap, MAX_LEVEL);
}
