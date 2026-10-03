import type { PrimaryStat } from '../stats/primaryStats';
import type { DerivedStatKey } from '../stats/modifiers';
import type { EquipmentCategory, Rarity } from './equipmentData';

/*
 * Enchant options v1. Line counts per rarity are LOCKED. Every number range,
 * quality weight and reroll cost below is DEMO tuning data, kept here so
 * reroll logic never contains balance values.
 */

export const ENCHANT_QUALITIES = ['normal', 'good', 'excellent', 'perfect'] as const;
export type EnchantQuality = (typeof ENCHANT_QUALITIES)[number];

/** Locked: Common 1, Uncommon 2, Rare 3, Legendary 3 (with a better quality ceiling). */
export const ENCHANT_LINES: Record<Rarity, number> = { common: 1, uncommon: 2, rare: 3, legendary: 3 };

/** DEMO: quality odds by rarity. Only Legendary can reach Perfect. */
export const ENCHANT_QUALITY_WEIGHTS: Record<Rarity, Partial<Record<EnchantQuality, number>>> = {
  common: { normal: 80, good: 20 },
  uncommon: { normal: 65, good: 30, excellent: 5 },
  rare: { normal: 50, good: 35, excellent: 15 },
  legendary: { normal: 30, good: 35, excellent: 25, perfect: 10 },
};

/** What an option adds: a primary stat, a flat derived stat, or a combat effect. */
export type EnchantTarget =
  | { kind: 'primary'; stat: PrimaryStat }
  | { kind: 'flat'; stat: DerivedStatKey }
  | { kind: 'effect'; effect: 'damageReduction' };

export interface EnchantOptionDef {
  id: string;
  target: EnchantTarget;
  /** DEMO: [min, max] per quality. Integer stats roll integers; fractions roll to 0.001. */
  ranges: Record<EnchantQuality, readonly [number, number]>;
  integer: boolean;
}

const primary = (id: string, stat: PrimaryStat, scale = 1): EnchantOptionDef => ({
  id,
  target: { kind: 'primary', stat },
  integer: true,
  ranges: { normal: [1, 2 * scale], good: [2, 3 * scale], excellent: [3, 4 * scale], perfect: [5, 5 * scale] },
});

const flat = (id: string, stat: DerivedStatKey, r: Record<EnchantQuality, readonly [number, number]>, integer: boolean): EnchantOptionDef => ({
  id,
  target: { kind: 'flat', stat },
  integer,
  ranges: r,
});

const OPTIONS: EnchantOptionDef[] = [
  primary('str', 'str'),
  primary('agi', 'agi'),
  primary('vit', 'vit'),
  primary('int', 'int'),
  primary('dex', 'dex'),
  primary('luk', 'luk'),
  flat('physical_atk', 'physicalAtk', { normal: [4, 8], good: [8, 12], excellent: [12, 16], perfect: [18, 20] }, true),
  flat('magic_atk', 'magicAtk', { normal: [4, 8], good: [8, 12], excellent: [12, 16], perfect: [18, 20] }, true),
  flat('max_hp', 'maxHp', { normal: [40, 80], good: [80, 120], excellent: [120, 160], perfect: [180, 200] }, true),
  flat('def', 'def', { normal: [2, 4], good: [4, 6], excellent: [6, 8], perfect: [9, 10] }, true),
  flat('mdef', 'mdef', { normal: [2, 4], good: [4, 6], excellent: [6, 8], perfect: [9, 10] }, true),
  flat('crit_rate', 'critRate', { normal: [0.005, 0.01], good: [0.01, 0.015], excellent: [0.015, 0.02], perfect: [0.025, 0.03] }, false),
  flat('crit_damage', 'critDamage', { normal: [0.01, 0.02], good: [0.02, 0.04], excellent: [0.04, 0.06], perfect: [0.07, 0.08] }, false),
  flat('aspd', 'aspd', { normal: [0.005, 0.01], good: [0.01, 0.015], excellent: [0.015, 0.02], perfect: [0.025, 0.03] }, false),
  flat('accuracy', 'accuracy', { normal: [0.005, 0.01], good: [0.01, 0.015], excellent: [0.015, 0.02], perfect: [0.025, 0.03] }, false),
  flat('evasion', 'evasion', { normal: [0.003, 0.006], good: [0.006, 0.01], excellent: [0.01, 0.014], perfect: [0.016, 0.02] }, false),
  flat('heal_power', 'healPower', { normal: [0.01, 0.02], good: [0.02, 0.03], excellent: [0.03, 0.04], perfect: [0.05, 0.06] }, false),
  flat('cast_time', 'castTime', { normal: [-0.01, -0.005], good: [-0.015, -0.01], excellent: [-0.02, -0.015], perfect: [-0.03, -0.025] }, false),
  {
    id: 'damage_reduction',
    target: { kind: 'effect', effect: 'damageReduction' },
    integer: false,
    ranges: { normal: [0.005, 0.01], good: [0.01, 0.015], excellent: [0.015, 0.02], perfect: [0.025, 0.03] },
  },
];

export const ENCHANT_OPTIONS: Readonly<Record<string, EnchantOptionDef>> = Object.fromEntries(OPTIONS.map((o) => [o.id, o]));

/** Which options each equipment category can roll. Not every slot rolls everything. */
export const ENCHANT_POOLS: Record<EquipmentCategory, readonly string[]> = {
  weapon: ['str', 'dex', 'int', 'physical_atk', 'magic_atk', 'crit_rate', 'aspd', 'accuracy'],
  armor: ['vit', 'max_hp', 'def', 'mdef', 'evasion', 'damage_reduction'],
  accessory: ['str', 'agi', 'dex', 'int', 'luk', 'crit_rate', 'crit_damage', 'aspd', 'accuracy', 'heal_power', 'cast_time'],
};

/** DEMO: reroll price; more locked lines cost more. */
export const ENCHANT_REROLL_COST = {
  stones: { base: 1, perLockedLine: 2 },
  gold: { base: 500, perLockedLine: 1000 },
} as const;
