/*
 * The six primary stats. Engine-independent: no Phaser imports anywhere in
 * src/stats, so the whole stat layer runs in plain Node tests or on a server.
 */

export const PRIMARY_STATS = ['str', 'agi', 'vit', 'int', 'dex', 'luk'] as const;

export type PrimaryStat = (typeof PRIMARY_STATS)[number];

export type PrimaryStats = Record<PrimaryStat, number>;

export function zeroPrimary(): PrimaryStats {
  return { str: 0, agi: 0, vit: 0, int: 0, dex: 0, luk: 0 };
}

export function clonePrimary(stats: Readonly<PrimaryStats>): PrimaryStats {
  return { ...stats };
}

/** `into += add`, for every stat present in `add`. Returns `into`. */
export function addPrimary(into: PrimaryStats, add: Partial<Readonly<PrimaryStats>>): PrimaryStats {
  for (const stat of PRIMARY_STATS) into[stat] += add[stat] ?? 0;
  return into;
}

export function sumPrimary(stats: Partial<Readonly<PrimaryStats>>): number {
  let total = 0;
  for (const stat of PRIMARY_STATS) total += stats[stat] ?? 0;
  return total;
}

export function isPrimaryStat(value: unknown): value is PrimaryStat {
  return typeof value === 'string' && (PRIMARY_STATS as readonly string[]).includes(value);
}
