export interface ItemDef {
  id: string;
  name: string;
  color: number;
}

const ITEM_DEFS = {
  slime_gel: { id: 'slime_gel', name: 'Slime Gel', color: 0x9be36b },
} satisfies Record<string, ItemDef>;

export type ItemId = keyof typeof ITEM_DEFS;
export const ITEMS: Record<ItemId, ItemDef> = ITEM_DEFS;

export interface LootEntry {
  itemId: ItemId;
  chance: number; // 0..1
}

const LOOT_TABLE_DEFS = {
  slime: [{ itemId: 'slime_gel', chance: 0.5 }],
} satisfies Record<string, LootEntry[]>;

export type LootTableId = keyof typeof LOOT_TABLE_DEFS;
export const LOOT_TABLES: Record<LootTableId, LootEntry[]> = LOOT_TABLE_DEFS;

export const LOOT_DROP = {
  lifetime: 15000, // ms on the ground before it disappears
  blinkBefore: 3000, // starts blinking this long before expiring
  pickupRadius: 22,
};
