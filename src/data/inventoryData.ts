import { RARITIES, type EquipmentSlotType, type Rarity } from './equipmentData';
import type { EquipmentDef } from './equipmentItems';
import type { ItemType } from './itemData';

/*
 * Bag rules v1. DEMO numbers; the economy pass may tune them.
 */

/** Bag slots. Unequipped equipment takes one slot each; a material stack takes one slot. */
export const BAG_CAPACITY = 48;

/** Units of one item per slot unless the item sets its own maxStack. */
export const DEFAULT_MAX_STACK = 999;

/** Sort order of bag entries: equipment first (by slot), then item types. */
export const EQUIPMENT_SLOT_TYPE_ORDER: readonly EquipmentSlotType[] = ['weapon', 'off_hand', 'head', 'armor', 'gloves', 'boots', 'necklace', 'ring'];
export const ITEM_TYPE_ORDER: readonly ItemType[] = ['consumable', 'material', 'quest', 'misc'];

/** Higher first when sorting. */
export const rarityRank = (r: Rarity) => RARITIES.indexOf(r);

/** DEMO sell value of an equipment piece by rarity, scaled by its equipment level (per 10 levels). */
export const EQUIPMENT_SELL_BASE: Record<Rarity, number> = { common: 20, uncommon: 60, rare: 200, legendary: 800 };

/** Gold one equipment instance sells for (metadata only; no Shop selling yet). Enhancement adds 10% per level. */
export function equipmentSellValue(def: EquipmentDef, enhancement = 0): number {
  return Math.round(EQUIPMENT_SELL_BASE[def.rarity] * Math.max(1, def.equipmentLevel / 10) * (1 + enhancement * 0.1));
}
