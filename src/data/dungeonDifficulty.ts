/*
 * Dungeon difficulty tiers, locked v1. Difficulty never gates entry and
 * never scales to the player's level: a dungeon (and its monsters) keeps its
 * fixed base level, and each tier only applies these multipliers and shows a
 * higher Recommended Level.
 */

export type DifficultyId = 'normal' | 'hard' | 'hell';

export interface StatMultipliers {
  hp: number;
  atk: number;
  def: number;
  mdef: number;
}

export interface DifficultyDef {
  id: DifficultyId;
  name: string;
  /** Recommended Level = dungeon base level + this. Advisory only. */
  recommendedLevelOffset: number;
  monster: StatMultipliers;
  /**
   * Boss DEF/MDEF were not specified for v1, so they use the monster
   * multipliers; tune independently here if needed.
   */
  boss: StatMultipliers;
  rewards: { exp: number; currency: number; material: number };
  /**
   * Hook: multiplier on rare-drop chances. null = not designed yet (no
   * scaling). Final rare-drop numbers are intentionally undecided.
   */
  rareDropMultiplier: number | null;
}

const DIFFICULTY_DEFS = {
  normal: {
    id: 'normal',
    name: 'Normal',
    recommendedLevelOffset: 0,
    monster: { hp: 1, atk: 1, def: 1, mdef: 1 },
    boss: { hp: 1, atk: 1, def: 1, mdef: 1 },
    rewards: { exp: 1, currency: 1, material: 1 },
    rareDropMultiplier: null,
  },
  hard: {
    id: 'hard',
    name: 'Hard',
    recommendedLevelOffset: 5,
    monster: { hp: 1.45, atk: 1.2, def: 1.1, mdef: 1.1 },
    boss: { hp: 1.6, atk: 1.25, def: 1.1, mdef: 1.1 },
    rewards: { exp: 1.3, currency: 1.5, material: 1.5 },
    rareDropMultiplier: null,
  },
  hell: {
    id: 'hell',
    name: 'Hell',
    recommendedLevelOffset: 10,
    monster: { hp: 2, atk: 1.45, def: 1.25, mdef: 1.25 },
    boss: { hp: 2.3, atk: 1.55, def: 1.25, mdef: 1.25 },
    rewards: { exp: 1.7, currency: 2, material: 2 },
    rareDropMultiplier: null,
  },
} satisfies Record<DifficultyId, DifficultyDef>;

export const DIFFICULTIES: Record<DifficultyId, DifficultyDef> = DIFFICULTY_DEFS;
export const DIFFICULTY_ORDER: readonly DifficultyId[] = ['normal', 'hard', 'hell'];
