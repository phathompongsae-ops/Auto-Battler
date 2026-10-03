/** Random source returning a value in [0, 1). Injectable so tests and a future server can control it. */
export type Rng = () => number;

export const defaultRng: Rng = Math.random;

/**
 * Deterministic seeded generator (mulberry32). Same seed, same sequence: used
 * by tests and dev tools ("generate a dungeon reward from seed 42").
 */
export function seededRng(seed: number): Rng {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Pick a key from integer or fractional weights. Throws if the weights don't sum to more than zero. */
export function weightedPick<K extends string>(weights: Readonly<Partial<Record<K, number>>>, rng: Rng): K {
  const entries = Object.entries(weights).filter(([, w]) => (w as number) > 0) as [K, number][];
  const total = entries.reduce((n, [, w]) => n + w, 0);
  if (total <= 0) throw new Error('weightedPick: no positive weights');
  let roll = rng() * total;
  for (const [key, w] of entries) {
    if (roll < w) return key;
    roll -= w;
  }
  return entries[entries.length - 1][0];
}

/** Integer in [min, max], inclusive. */
export function rollInt(min: number, max: number, rng: Rng): number {
  return min + Math.floor(rng() * (max - min + 1));
}
