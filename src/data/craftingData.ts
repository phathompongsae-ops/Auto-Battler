import type { Rarity } from './equipmentData';
import type { ItemId } from './itemData';
import type { SetId } from './setData';

/*
 * Crafting v1: the deterministic long-term path to high-rarity gear
 * (alongside rare direct drops). Only the data model is defined; the two
 * recipes below are DEMO fixtures — every quantity, price and duration is a
 * placeholder.
 */

export interface RecipeDef {
  id: string;
  /** Equipment definition produced. */
  outputDefId: string;
  /** Must match the output's definition (validated). */
  equipmentLevel: number;
  rarity: Rarity;
  setId?: SetId;
  blueprint: ItemId | null;
  bossFragments: number;
  materials: readonly { itemId: ItemId; count: number }[];
  gold: number;
  /** Real time to finish; keeps running offline once time is server-authoritative. */
  durationMs: number;
}

const HOUR = 3_600_000;

export const RECIPES: Readonly<Record<string, RecipeDef>> = {
  demo_guardian_crown: {
    id: 'demo_guardian_crown',
    outputDefId: 'guardian_helm_legendary',
    equipmentLevel: 40,
    rarity: 'legendary',
    setId: 'guardian',
    blueprint: 'blueprint_guardian',
    bossFragments: 10,
    materials: [{ itemId: 'rare_craft_material', count: 5 }],
    gold: 20000,
    durationMs: 8 * HOUR,
  },
  demo_warborn_plate: {
    id: 'demo_warborn_plate',
    outputDefId: 'warborn_plate',
    equipmentLevel: 40,
    rarity: 'rare',
    setId: 'warborn',
    blueprint: 'blueprint_warborn',
    bossFragments: 4,
    materials: [{ itemId: 'rare_craft_material', count: 2 }],
    gold: 6000,
    durationMs: 2 * HOUR,
  },
};
