/** What using an item does. Items without one are materials (not usable). */
export type ItemUse = { kind: 'resetAllocatedStats' } | { kind: 'addDungeonFullReward' };

export interface ItemDef {
  id: string;
  name: string;
  color: number;
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
  slime_gel: { id: 'slime_gel', name: 'Slime Gel', color: 0x9be36b },
  // Free during Alpha/Test: returns every allocated stat point.
  stat_reset_test: {
    id: 'stat_reset_test',
    name: 'Stat Reset (Test)',
    color: 0xb781ff,
    use: { kind: 'resetAllocatedStats' },
    testOnly: true,
  },
  // Progression materials
  enhancement_stone: { id: 'enhancement_stone', name: 'Enhancement Stone', color: 0x9fb7d9 },
  enchant_stone: { id: 'enchant_stone', name: 'Enchant Stone', color: 0xb781ff },
  protection_stone: { id: 'protection_stone', name: 'Protection Stone', color: 0x7fd4ff, enhancementSupport: { kind: 'protection' } },
  // DEMO: +10 percentage points is a placeholder; the production bonus is not locked.
  success_booster: { id: 'success_booster', name: 'Success Booster', color: 0xffd166, enhancementSupport: { kind: 'booster', successBonus: 0.1 } },
  boss_fragment: { id: 'boss_fragment', name: 'Boss Fragment', color: 0xe0524a },
  rare_craft_material: { id: 'rare_craft_material', name: 'Rare Craft Material', color: 0xe3c27a },
  blueprint_guardian: { id: 'blueprint_guardian', name: 'Guardian Blueprint', color: 0xc9d1e3 },
  blueprint_warborn: { id: 'blueprint_warborn', name: 'Warborn Blueprint', color: 0xc9d1e3 },
  // Pets
  egg_basic: { id: 'egg_basic', name: 'Basic Egg', color: 0xd8d2c4 },
  egg_fine: { id: 'egg_fine', name: 'Fine Egg', color: 0x7fd4ff },
  egg_mystic: { id: 'egg_mystic', name: 'Mystic Egg', color: 0xb781ff },
  egg_ancient: { id: 'egg_ancient', name: 'Ancient Egg', color: 0xffc845 },
  random_egg_ticket: { id: 'random_egg_ticket', name: 'Random Egg Ticket', color: 0xf3d898 },
  // Travel
  town_warp_scroll: { id: 'town_warp_scroll', name: 'Town Warp Scroll', color: 0x7ee787 },
  dungeon_warp_scroll: { id: 'dungeon_warp_scroll', name: 'Dungeon Warp Scroll', color: 0xff9e64 },
  // Dungeon: +1 Full Reward claim today (max +2 a day). DEMO: price is a placeholder; not sold yet.
  additional_dungeon_ticket: {
    id: 'additional_dungeon_ticket',
    name: 'Additional Dungeon Ticket',
    color: 0xff7eb6,
    use: { kind: 'addDungeonFullReward' },
  },
  // Quest items: always drop for quests, even at 0 Field Energy. DEMO quest item.
  slime_sample: { id: 'slime_sample', name: 'Slime Sample', color: 0x5fd3a7 },
} satisfies Record<string, ItemDef>;

export type ItemId = keyof typeof ITEM_DEFS;
export const ITEMS: Record<ItemId, ItemDef> = ITEM_DEFS;

/**
 * farming: normal field farming drop; rare: rare field farming drop. Both
 * need Field Energy. quest: a quest-specific drop that ignores Field Energy.
 */
export type LootCategory = 'farming' | 'rare' | 'quest';

export interface LootEntry {
  itemId: ItemId;
  chance: number; // 0..1
  /** Default 'farming'. */
  category?: LootCategory;
}

const LOOT_TABLE_DEFS = {
  slime: [
    { itemId: 'slime_gel', chance: 0.5 },
    // DEMO: until a Quest Engine exists, quest drops roll whether or not the quest is active.
    { itemId: 'slime_sample', chance: 0.4, category: 'quest' },
  ],
} satisfies Record<string, LootEntry[]>;

export type LootTableId = keyof typeof LOOT_TABLE_DEFS;
export const LOOT_TABLES: Record<LootTableId, LootEntry[]> = LOOT_TABLE_DEFS;

export const LOOT_DROP = {
  lifetime: 15000, // ms on the ground before it disappears
  blinkBefore: 3000, // starts blinking this long before expiring
  pickupRadius: 22,
};
