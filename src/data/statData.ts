import type { PrimaryStats } from '../stats/primaryStats';

/*
 * Locked v1 primary-stat rules. Percent-type stats are fractions
 * (0.002 = +0.2%). There is deliberately no elemental resistance anywhere:
 * skills may carry an element later, but characters only have DEF and MDEF.
 */

/** Every character's Level 1 base stats (Novice). */
export const NOVICE_BASE_STATS: Readonly<PrimaryStats> = { str: 5, agi: 5, vit: 5, int: 5, dex: 5, luk: 5 };

/** Free stat points granted per level gained from Level 2 on. Level 1 has none. */
export const FREE_STAT_POINTS_PER_LEVEL = 1;

/** What one point of each primary stat adds. */
export const PRIMARY_STAT_RULES = {
  str: { meleePhysicalAtk: 2 },
  vit: { maxHp: 25, def: 1 },
  agi: { aspd: 0.002, evasion: 0.001 },
  dex: { accuracy: 0.002, rangedPhysicalAtk: 2, castTime: -0.001 },
  int: { magicAtk: 2, maxMp: 15, healPower: 0.004, mdef: 1 },
  luk: { critRate: 0.0015, critDamage: 0.003 },
} as const;
