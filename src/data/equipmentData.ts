import type { JobId } from './jobData';

/*
 * Equipment foundation v1: slots, rarity, weapon rules and enhancement
 * tuning. Every number here is data; logic lives in src/equipment.
 * Values marked DEMO are placeholders until the economy is locked.
 */

// ---------------------------------------------------------------- slots

export const EQUIPMENT_SLOTS = ['weapon', 'off_hand', 'head', 'armor', 'gloves', 'boots', 'necklace', 'ring_1', 'ring_2'] as const;
export type EquipmentSlot = (typeof EQUIPMENT_SLOTS)[number];

/** What kind of item goes where: a 'ring' item fits ring_1 or ring_2. */
export type EquipmentSlotType = 'weapon' | 'off_hand' | 'head' | 'armor' | 'gloves' | 'boots' | 'necklace' | 'ring';

export const SLOTS_FOR_TYPE: Record<EquipmentSlotType, readonly EquipmentSlot[]> = {
  weapon: ['weapon'],
  off_hand: ['off_hand'],
  head: ['head'],
  armor: ['armor'],
  gloves: ['gloves'],
  boots: ['boots'],
  necklace: ['necklace'],
  ring: ['ring_1', 'ring_2'],
};

/** Which enhancement curve and enchant pool a slot type uses. */
export type EquipmentCategory = 'weapon' | 'armor' | 'accessory';

export const CATEGORY_FOR_TYPE: Record<EquipmentSlotType, EquipmentCategory> = {
  weapon: 'weapon',
  off_hand: 'armor',
  head: 'armor',
  armor: 'armor',
  gloves: 'armor',
  boots: 'armor',
  necklace: 'accessory',
  ring: 'accessory',
};

// --------------------------------------------------------------- rarity

/**
 * Locked rarities. Rarity does NOT scale base stats: item definitions set
 * their own base values. It drives drop weighting, enchant lines/quality,
 * presentation and crafting.
 */
export const RARITIES = ['common', 'uncommon', 'rare', 'legendary'] as const;
export type Rarity = (typeof RARITIES)[number];

export const RARITY_INFO: Record<Rarity, { name: string; color: string }> = {
  common: { name: 'Common', color: '#ffffff' },
  uncommon: { name: 'Uncommon', color: '#4f8cff' },
  rare: { name: 'Rare', color: '#b781ff' },
  legendary: { name: 'Legendary', color: '#ffc845' },
};

// -------------------------------------------------------------- weapons

export type WeaponType = 'sword' | 'two_handed_sword' | 'bow' | 'staff' | 'mace' | 'dual_blade' | 'shield';

/** 2 = occupies weapon and off_hand. 'shield' is an off-hand type. */
export const WEAPON_HANDS: Record<Exclude<WeaponType, 'shield'>, 1 | 2> = {
  sword: 1,
  two_handed_sword: 2,
  bow: 2,
  staff: 2,
  mace: 1,
  dual_blade: 2,
};

/** Main-hand weapon types and off-hand types each class may use. Novice uses none of the class weapons. */
export const CLASS_WEAPONS: Record<JobId, { weapons: readonly WeaponType[]; offHands: readonly WeaponType[] }> = {
  novice: { weapons: [], offHands: [] },
  warrior: { weapons: ['sword', 'two_handed_sword'], offHands: ['shield'] },
  archer: { weapons: ['bow'], offHands: [] },
  mage: { weapons: ['staff'], offHands: [] },
  cleric: { weapons: ['mace', 'staff'], offHands: ['shield'] },
  ninja: { weapons: ['dual_blade'], offHands: [] },
};

// ---------------------------------------------------------- enhancement

export const MAX_ENHANCEMENT = 15;

/**
 * Bonus on the item's BASE stats per enhancement level (index = level).
 * Weapon: +2.5% per level to +10 (25%), then +1.8% to +15 (34%).
 * Armor:  +2.0% per level to +10 (20%), then +1.2% to +15 (26%).
 * Accessories use the armor curve (DEMO: not separately locked).
 */
export const ENHANCEMENT_CURVE: Record<EquipmentCategory, readonly number[]> = {
  weapon: [0, 0.025, 0.05, 0.075, 0.1, 0.125, 0.15, 0.175, 0.2, 0.225, 0.25, 0.268, 0.286, 0.304, 0.322, 0.34],
  armor: [0, 0.02, 0.04, 0.06, 0.08, 0.1, 0.12, 0.14, 0.16, 0.18, 0.2, 0.212, 0.224, 0.236, 0.248, 0.26],
  accessory: [0, 0.02, 0.04, 0.06, 0.08, 0.1, 0.12, 0.14, 0.16, 0.18, 0.2, 0.212, 0.224, 0.236, 0.248, 0.26],
};

/** Locked success chance by TARGET level (index = target level; index 0 unused). */
export const ENHANCEMENT_SUCCESS: readonly number[] = [
  1, 1, 1, 1, 1, 0.95, 0.9, 0.85, 0.75, 0.65, 0.55, 0.45, 0.35, 0.25, 0.18, 0.12,
];

/**
 * Failure: from +10 upward a failed attempt drops one level, never below
 * safeFloor; at +0..+9 the level never drops. Items never break.
 */
export const ENHANCEMENT_FAILURE = { dropsWhenAtOrAbove: 10, levelsLost: 1, safeFloor: 10 } as const;

/** DEMO: cost per attempt by target level, consumed on every attempt. */
export const ENHANCEMENT_COST: readonly { stones: number; gold: number }[] = [
  { stones: 0, gold: 0 },
  ...Array.from({ length: MAX_ENHANCEMENT }, (_, i) => ({ stones: 1 + Math.floor(i / 5), gold: 100 * (i + 1) })),
];

/** Visual tier by enhancement level (purely cosmetic, never stats). */
export const ENHANCEMENT_VFX_TIERS: readonly { minLevel: number; tier: 0 | 1 | 2 | 3 }[] = [
  { minLevel: 15, tier: 3 },
  { minLevel: 12, tier: 2 },
  { minLevel: 10, tier: 1 },
  { minLevel: 0, tier: 0 },
];
