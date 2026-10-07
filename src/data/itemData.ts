import type { Rarity } from './equipmentData';

/** What using an item does. Items without one are materials (not usable). */
export type ItemUse = { kind: 'resetAllocatedStats' } | { kind: 'addDungeonFullReward' }
  | { kind: 'potion'; resource: 'hp' | 'mp'; instant: number; hotPercent: number };

/** Bag grouping and sort order (equipment instances sort before every item type). */
export type ItemType = 'consumable' | 'material' | 'quest' | 'misc';

export interface ItemDef {
  id: string;
  name: string;
  color: number;
  type: ItemType;
  rarity: Rarity;
  /**
   * Gold one unit sells for (metadata for the future Shop; 0 = not sellable).
   * DEMO values.
   */
  sellValue: number;
  /** Units per bag slot (default DEFAULT_MAX_STACK). */
  maxStack?: number;
  use?: ItemUse;
  /** Alpha/test tooling; never sold or dropped. */
  testOnly?: boolean;
  /**
   * Optional enhancement support. A Protection Stone prevents level loss on
   * failure; a Success Booster adds successBonus (absolute, 0.1 = +10
   * percentage points) to that attempt. Neither does the other's job.
   */
  enhancementSupport?: { kind: 'protection' } | { kind: 'booster'; successBonus: number };
}

const ITEM_DEFS = {
  small_hp_potion: { id: 'small_hp_potion', name: 'Small HP Potion', color: 0x77cc88, type: 'consumable', rarity: 'common', sellValue: 0, maxStack: 20, use: { kind: 'potion', resource: 'hp', instant: 100, hotPercent: 0.05 } },
  medium_hp_potion: { id: 'medium_hp_potion', name: 'Medium HP Potion', color: 0x77cc88, type: 'consumable', rarity: 'uncommon', sellValue: 0, maxStack: 20, use: { kind: 'potion', resource: 'hp', instant: 180, hotPercent: 0.08 } },
  small_mp_potion: { id: 'small_mp_potion', name: 'Small MP Potion', color: 0x7fd4ff, type: 'consumable', rarity: 'common', sellValue: 0, maxStack: 20, use: { kind: 'potion', resource: 'mp', instant: 50, hotPercent: 0.05 } },
  medium_mp_potion: { id: 'medium_mp_potion', name: 'Medium MP Potion', color: 0x7fd4ff, type: 'consumable', rarity: 'uncommon', sellValue: 0, maxStack: 20, use: { kind: 'potion', resource: 'mp', instant: 90, hotPercent: 0.08 } },
  slime_gel: { id: 'slime_gel', name: 'Slime Gel', color: 0x9be36b, type: 'material', rarity: 'common', sellValue: 2 },
  // Field monster materials (PLACEHOLDER roster drops; the monster content pass may rename / rebalance).
  wolf_fang: { id: 'wolf_fang', name: 'Wolf Fang', color: 0xd8d4c4, type: 'material', rarity: 'common', sellValue: 3 },
  mushroom_cap: { id: 'mushroom_cap', name: 'Mushroom Cap', color: 0xd0524c, type: 'material', rarity: 'common', sellValue: 3 },
  boar_tusk: { id: 'boar_tusk', name: 'Boar Tusk', color: 0xe0b07a, type: 'material', rarity: 'uncommon', sellValue: 15 },
  guardian_bark: { id: 'guardian_bark', name: 'Guardian Bark', color: 0x7cc46a, type: 'material', rarity: 'rare', sellValue: 60 },
  // Free during Alpha/Test: returns every allocated stat point.
  stat_reset_test: {
    id: 'stat_reset_test',
    name: 'Stat Reset (Test)',
    color: 0xb781ff,
    type: 'consumable',
    rarity: 'common',
    sellValue: 0,
    use: { kind: 'resetAllocatedStats' },
    testOnly: true,
  },
  // Progression materials
  enhancement_stone: { id: 'enhancement_stone', name: 'Enhancement Stone', color: 0x9fb7d9, type: 'material', rarity: 'uncommon', sellValue: 20 },
  enchant_stone: { id: 'enchant_stone', name: 'Enchant Stone', color: 0xb781ff, type: 'material', rarity: 'rare', sellValue: 40 },
  protection_stone: { id: 'protection_stone', name: 'Protection Stone', color: 0x7fd4ff, type: 'material', rarity: 'rare', sellValue: 100, enhancementSupport: { kind: 'protection' } },
  // DEMO: +10 percentage points is a placeholder; the production bonus is not locked.
  success_booster: { id: 'success_booster', name: 'Success Booster', color: 0xffd166, type: 'material', rarity: 'rare', sellValue: 80, enhancementSupport: { kind: 'booster', successBonus: 0.1 } },
  boss_fragment: { id: 'boss_fragment', name: 'Boss Fragment', color: 0xe0524a, type: 'material', rarity: 'rare', sellValue: 50 },
  rare_craft_material: { id: 'rare_craft_material', name: 'Rare Craft Material', color: 0xe3c27a, type: 'material', rarity: 'rare', sellValue: 60 },
  blueprint_guardian: { id: 'blueprint_guardian', name: 'Guardian Blueprint', color: 0xc9d1e3, type: 'material', rarity: 'rare', sellValue: 0 },
  blueprint_warborn: { id: 'blueprint_warborn', name: 'Warborn Blueprint', color: 0xc9d1e3, type: 'material', rarity: 'rare', sellValue: 0 },
  // Pets
  egg_basic: { id: 'egg_basic', name: 'Basic Egg', color: 0xd8d2c4, type: 'misc', rarity: 'common', sellValue: 10 },
  egg_fine: { id: 'egg_fine', name: 'Fine Egg', color: 0x7fd4ff, type: 'misc', rarity: 'uncommon', sellValue: 30 },
  egg_mystic: { id: 'egg_mystic', name: 'Mystic Egg', color: 0xb781ff, type: 'misc', rarity: 'rare', sellValue: 100 },
  egg_ancient: { id: 'egg_ancient', name: 'Ancient Egg', color: 0xffc845, type: 'misc', rarity: 'legendary', sellValue: 300 },
  random_egg_ticket: { id: 'random_egg_ticket', name: 'Random Egg Ticket', color: 0xf3d898, type: 'misc', rarity: 'uncommon', sellValue: 0 },
  // Travel
  town_warp_scroll: { id: 'town_warp_scroll', name: 'Town Warp Scroll', color: 0x7ee787, type: 'consumable', rarity: 'common', sellValue: 10 },
  dungeon_warp_scroll: { id: 'dungeon_warp_scroll', name: 'Dungeon Warp Scroll', color: 0xff9e64, type: 'consumable', rarity: 'uncommon', sellValue: 20 },
  // Dungeon: +1 Full Reward claim today (max +2 a day). DEMO: price is a placeholder; not sold yet.
  additional_dungeon_ticket: {
    id: 'additional_dungeon_ticket',
    name: 'Additional Dungeon Ticket',
    color: 0xff7eb6,
    type: 'consumable',
    rarity: 'rare',
    sellValue: 0,
    use: { kind: 'addDungeonFullReward' },
  },
  // Weekly milestone rewards. DEMO placeholders: no drop tables / opening yet.
  material_box: { id: 'material_box', name: 'Material Box', color: 0xc9a46b, type: 'misc', rarity: 'uncommon', sellValue: 0 },
  weekly_chest: { id: 'weekly_chest', name: 'Weekly Chest', color: 0xffc845, type: 'misc', rarity: 'rare', sellValue: 0 },
  // Quest items: always drop for quests, even at 0 Field Energy. DEMO quest item.
  slime_sample: { id: 'slime_sample', name: 'Slime Sample', color: 0x5fd3a7, type: 'quest', rarity: 'common', sellValue: 0 },
} satisfies Record<string, ItemDef>;

export type ItemId = keyof typeof ITEM_DEFS;
export const ITEMS: Record<ItemId, ItemDef> = ITEM_DEFS;

/**
 * farming: normal field farming drop; rare: rare field farming drop. Both
 * need Field Energy. quest: a quest-specific drop that ignores Field Energy.
 */
export type LootCategory = 'farming' | 'rare' | 'quest';

interface LootEntryBase {
  chance: number; // 0..1
  /** Default 'farming'. */
  category?: LootCategory;
}

/** A stackable item (material, consumable, quest item...). */
export interface ItemLootEntry extends LootEntryBase {
  itemId: ItemId;
}

/** An equipment piece: a fresh +0 instance with rolled enchants is created when it is picked up. */
export interface EquipmentLootEntry extends LootEntryBase {
  equipmentId: string;
}

export type LootEntry = ItemLootEntry | EquipmentLootEntry;

const LOOT_TABLE_DEFS = {
  slime: [
    { itemId: 'slime_gel', chance: 0.5 },
    // DEMO: until a Quest Engine exists, quest drops roll whether or not the quest is active.
    { itemId: 'slime_sample', chance: 0.4, category: 'quest' },
  ],
  // Field roster (combat vertical slice). Chances are placeholders until the monster content pass.
  // Equipment drops are rare (Field Energy-gated, left on the ground to pick up).
  wolf: [
    { itemId: 'wolf_fang', chance: 0.45 },
    { equipmentId: 'traveler_boots', chance: 0.05, category: 'rare' },
  ],
  mushroom: [
    { itemId: 'mushroom_cap', chance: 0.5 },
    { equipmentId: 'traveler_cap', chance: 0.05, category: 'rare' },
  ],
  /** Elite: its material always drops, plus a chance at a progression material. */
  elite_boar: [
    { itemId: 'boar_tusk', chance: 1 },
    { itemId: 'enhancement_stone', chance: 0.35, category: 'rare' },
    { equipmentId: 'iron_sword', chance: 0.3, category: 'rare' },
    { equipmentId: 'traveler_vest', chance: 0.25, category: 'rare' },
  ],
  /** Mini Boss: guaranteed material and stone, a chance at an Enchant Stone. */
  grove_guardian: [
    { itemId: 'guardian_bark', chance: 1 },
    { itemId: 'enhancement_stone', chance: 1, category: 'rare' },
    { itemId: 'enchant_stone', chance: 0.5, category: 'rare' },
    { equipmentId: 'oak_shield', chance: 0.5, category: 'rare' },
    { equipmentId: 'quartz_ring', chance: 0.35, category: 'rare' },
  ],
  /** Dungeon monsters: never rolled (dungeon kills grant nothing; the boss claim is the reward). */
  placeholder: [],
} satisfies Record<string, LootEntry[]>;

export type LootTableId = keyof typeof LOOT_TABLE_DEFS;
export const LOOT_TABLES: Record<LootTableId, LootEntry[]> = LOOT_TABLE_DEFS;

export const LOOT_DROP = {
  lifetime: 15000, // ms on the ground before it disappears
  blinkBefore: 3000, // starts blinking this long before expiring
  pickupRadius: 22,
};
