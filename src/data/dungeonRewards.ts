import type { DifficultyId } from './dungeonDifficulty';
import type { Rarity } from './equipmentData';

/*
 * Dungeon boss rewards v1. A cleared boss always gives Equipment x1, Boss
 * Fragments, Enhancement Stones and Gold; other drops are chance-based.
 * Gold scaling reuses DIFFICULTIES[...].rewards.currency (x1 / x1.5 / x2).
 */

export interface BossRewardTable {
  /** LOCKED: guaranteed equipment rarity odds (percent, totals 100). */
  equipmentRarity: Record<Rarity, number>;
  /** LOCKED. */
  bossFragments: number;
  /** LOCKED: inclusive range. */
  enhancementStones: readonly [number, number];
  /** Chance drops (0..1). null = hook only: not decided, never dropped yet. */
  chances: {
    enchantStone: number;
    rareCraftMaterial: number;
    extraEquipment: number;
    blueprint: number | null;
    protectionStone: number | null;
    successBooster: number | null;
  };
}

export const BOSS_REWARDS: Record<DifficultyId, BossRewardTable> = {
  normal: {
    equipmentRarity: { common: 60, uncommon: 32, rare: 7.5, legendary: 0.5 },
    bossFragments: 1,
    enhancementStones: [2, 4],
    chances: { enchantStone: 0.25, rareCraftMaterial: 0.15, extraEquipment: 0.05, blueprint: null, protectionStone: null, successBooster: null },
  },
  hard: {
    equipmentRarity: { common: 35, uncommon: 45, rare: 18, legendary: 2 },
    bossFragments: 2,
    enhancementStones: [4, 7],
    chances: { enchantStone: 0.5, rareCraftMaterial: 0.35, extraEquipment: 0.12, blueprint: null, protectionStone: null, successBooster: null },
  },
  hell: {
    equipmentRarity: { common: 15, uncommon: 40, rare: 40, legendary: 5 },
    bossFragments: 3,
    enhancementStones: [7, 12],
    chances: { enchantStone: 0.8, rareCraftMaterial: 0.65, extraEquipment: 0.2, blueprint: null, protectionStone: null, successBooster: null },
  },
};

/** DEMO: quantity when a chance drop happens. */
export const CHANCE_DROP_QUANTITY = { enchantStone: 1, rareCraftMaterial: 1, blueprint: 1, protectionStone: 1, successBooster: 1 } as const;

export interface DungeonDef {
  id: string;
  name: string;
  /** Fixed content level (difficulty never changes it). */
  baseLevel: number;
  /** DEMO: boss gold before the difficulty multiplier. */
  bossGold: number;
  /** DEMO: equipment the boss can drop, by rarity. */
  equipmentPool: Record<Rarity, readonly string[]>;
  /** Blueprint item this dungeon can drop once the hook is tuned. */
  blueprintItem: string;
}

/** DEMO dungeon used as a fixture until real dungeons exist. */
export const DUNGEONS: Record<string, DungeonDef> = {
  demo_dungeon: {
    id: 'demo_dungeon',
    name: 'Demo Dungeon',
    baseLevel: 40,
    bossGold: 900,
    equipmentPool: {
      common: ['traveler_cap', 'traveler_vest', 'traveler_gloves', 'traveler_boots'],
      uncommon: ['quartz_ring', 'steel_greatsword'],
      rare: ['guardian_helm', 'warborn_plate', 'berserker_gauntlets', 'knight_sword'],
      legendary: ['guardian_helm_legendary'],
    },
    blueprintItem: 'blueprint_guardian',
  },
};
