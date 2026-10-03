import type { PrimaryStats } from '../stats/primaryStats';
import type { DerivedStatKey } from '../stats/modifiers';
import type { EquipmentSlotType, Rarity, WeaponType } from './equipmentData';
import type { JobId } from './jobData';
import type { SetId } from './setData';

/** Stats enhancement scales. Everything else on an item is never enhanced. */
export type BaseStatKey = 'physicalAtk' | 'magicAtk' | 'def' | 'mdef' | 'maxHp' | 'maxMp';

export interface EquipmentDef {
  id: string;
  name: string;
  slotType: EquipmentSlotType;
  /** Item tier; separate from player level and rarity. Not an equip gate in v1. */
  equipmentLevel: number;
  rarity: Rarity;
  /** Jobs that may equip it; empty = any job (including Novice). */
  classes: readonly JobId[];
  weaponType?: WeaponType;
  /** Base equipment stats; the only values enhancement multiplies. */
  base: Partial<Record<BaseStatKey, number>>;
  /** Fixed extras (never enhanced). */
  primary?: Partial<PrimaryStats>;
  flat?: Partial<Record<DerivedStatKey, number>>;
  percent?: Partial<Record<DerivedStatKey, number>>;
  setId?: SetId;
}

/*
 * DEMO item catalogue: test fixtures for the systems, not final content.
 * Every stat value here is a placeholder.
 */
const defs: EquipmentDef[] = [
  // Lv10, usable by any job (the demo character is a Novice)
  { id: 'traveler_cap', name: "Traveler's Cap", slotType: 'head', equipmentLevel: 10, rarity: 'common', classes: [], base: { def: 4, maxHp: 30 } },
  { id: 'traveler_vest', name: "Traveler's Vest", slotType: 'armor', equipmentLevel: 10, rarity: 'common', classes: [], base: { def: 8, maxHp: 60 } },
  { id: 'traveler_gloves', name: "Traveler's Gloves", slotType: 'gloves', equipmentLevel: 10, rarity: 'common', classes: [], base: { def: 3 } },
  { id: 'traveler_boots', name: "Traveler's Boots", slotType: 'boots', equipmentLevel: 10, rarity: 'common', classes: [], base: { def: 3 } },
  { id: 'copper_ring', name: 'Copper Ring', slotType: 'ring', equipmentLevel: 10, rarity: 'common', classes: [], base: {}, primary: { str: 1 } },
  { id: 'quartz_ring', name: 'Quartz Ring', slotType: 'ring', equipmentLevel: 10, rarity: 'uncommon', classes: [], base: {}, primary: { int: 2 } },
  { id: 'bead_necklace', name: 'Bead Necklace', slotType: 'necklace', equipmentLevel: 10, rarity: 'common', classes: [], base: { maxMp: 20 } },

  // Warrior weapons
  { id: 'iron_sword', name: 'Iron Sword', slotType: 'weapon', equipmentLevel: 10, rarity: 'common', classes: ['warrior'], weaponType: 'sword', base: { physicalAtk: 20 } },
  { id: 'oak_shield', name: 'Oak Shield', slotType: 'off_hand', equipmentLevel: 10, rarity: 'common', classes: ['warrior', 'cleric'], weaponType: 'shield', base: { def: 10 } },
  { id: 'steel_greatsword', name: 'Steel Greatsword', slotType: 'weapon', equipmentLevel: 20, rarity: 'uncommon', classes: ['warrior'], weaponType: 'two_handed_sword', base: { physicalAtk: 55 } },
  { id: 'knight_sword', name: 'Knight Sword', slotType: 'weapon', equipmentLevel: 40, rarity: 'rare', classes: ['warrior'], weaponType: 'sword', base: { physicalAtk: 110 } },

  // Other classes (compatibility fixtures)
  { id: 'hunter_bow', name: 'Hunter Bow', slotType: 'weapon', equipmentLevel: 10, rarity: 'common', classes: ['archer'], weaponType: 'bow', base: { physicalAtk: 22 } },
  { id: 'oak_staff', name: 'Oak Staff', slotType: 'weapon', equipmentLevel: 10, rarity: 'common', classes: ['mage', 'cleric'], weaponType: 'staff', base: { magicAtk: 24 } },
  { id: 'iron_mace', name: 'Iron Mace', slotType: 'weapon', equipmentLevel: 10, rarity: 'common', classes: ['cleric'], weaponType: 'mace', base: { physicalAtk: 16, magicAtk: 10 } },
  { id: 'twin_fangs', name: 'Twin Fangs', slotType: 'weapon', equipmentLevel: 10, rarity: 'common', classes: ['ninja'], weaponType: 'dual_blade', base: { physicalAtk: 21 } },

  // Lv40 Warrior sets (rare) + a legendary Guardian piece in the same set
  { id: 'guardian_helm', name: 'Guardian Helm', slotType: 'head', equipmentLevel: 40, rarity: 'rare', classes: ['warrior'], base: { def: 30, maxHp: 200 }, setId: 'guardian' },
  { id: 'guardian_helm_legendary', name: 'Guardian Crown', slotType: 'head', equipmentLevel: 40, rarity: 'legendary', classes: ['warrior'], base: { def: 36, maxHp: 260 }, setId: 'guardian' },
  { id: 'guardian_plate', name: 'Guardian Plate', slotType: 'armor', equipmentLevel: 40, rarity: 'rare', classes: ['warrior'], base: { def: 60, maxHp: 400 }, setId: 'guardian' },
  { id: 'guardian_gauntlets', name: 'Guardian Gauntlets', slotType: 'gloves', equipmentLevel: 40, rarity: 'rare', classes: ['warrior'], base: { def: 22 }, setId: 'guardian' },
  { id: 'guardian_greaves', name: 'Guardian Greaves', slotType: 'boots', equipmentLevel: 40, rarity: 'rare', classes: ['warrior'], base: { def: 22 }, setId: 'guardian' },

  { id: 'warborn_helm', name: 'Warborn Helm', slotType: 'head', equipmentLevel: 40, rarity: 'rare', classes: ['warrior'], base: { def: 24 }, primary: { str: 2 }, setId: 'warborn' },
  { id: 'warborn_plate', name: 'Warborn Plate', slotType: 'armor', equipmentLevel: 40, rarity: 'rare', classes: ['warrior'], base: { def: 48 }, primary: { str: 3 }, setId: 'warborn' },
  { id: 'warborn_gauntlets', name: 'Warborn Gauntlets', slotType: 'gloves', equipmentLevel: 40, rarity: 'rare', classes: ['warrior'], base: { def: 18 }, primary: { str: 2 }, setId: 'warborn' },
  { id: 'warborn_greaves', name: 'Warborn Greaves', slotType: 'boots', equipmentLevel: 40, rarity: 'rare', classes: ['warrior'], base: { def: 18 }, primary: { str: 1 }, setId: 'warborn' },

  { id: 'berserker_helm', name: 'Berserker Helm', slotType: 'head', equipmentLevel: 40, rarity: 'rare', classes: ['warrior'], base: { def: 20 }, primary: { agi: 2 }, setId: 'berserker' },
  { id: 'berserker_plate', name: 'Berserker Plate', slotType: 'armor', equipmentLevel: 40, rarity: 'rare', classes: ['warrior'], base: { def: 40 }, primary: { agi: 2, luk: 1 }, setId: 'berserker' },
  { id: 'berserker_gauntlets', name: 'Berserker Gauntlets', slotType: 'gloves', equipmentLevel: 40, rarity: 'rare', classes: ['warrior'], base: { def: 15 }, primary: { luk: 2 }, setId: 'berserker' },
  { id: 'berserker_greaves', name: 'Berserker Greaves', slotType: 'boots', equipmentLevel: 40, rarity: 'rare', classes: ['warrior'], base: { def: 15 }, primary: { agi: 2 }, setId: 'berserker' },
];

export const EQUIPMENT_DEFS: Readonly<Record<string, EquipmentDef>> = Object.fromEntries(defs.map((d) => [d.id, d]));

export function isEquipmentDefId(id: unknown): id is string {
  return typeof id === 'string' && id in EQUIPMENT_DEFS;
}
