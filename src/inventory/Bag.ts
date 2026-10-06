import { EQUIPMENT_DEFS } from '../data/equipmentItems';
import { WEAPON_HANDS, type EquipmentSlot, type Rarity } from '../data/equipmentData';
import { BAG_CAPACITY, DEFAULT_MAX_STACK, EQUIPMENT_SLOT_TYPE_ORDER, equipmentSellValue, ITEM_TYPE_ORDER, rarityRank } from '../data/inventoryData';
import { ITEMS, type ItemId, type ItemType } from '../data/itemData';
import type { EquipmentInstance, EquipmentManager } from '../equipment/equipment';
import type { Inventory } from '../loot/Inventory';

/** One visible bag slot: a material stack (one slot per maxStack units) or one unequipped equipment piece. */
export type BagEntry =
  | { kind: 'item'; key: string; itemId: ItemId; count: number; type: ItemType; rarity: Rarity; name: string; sellValue: number }
  | { kind: 'equipment'; key: string; item: EquipmentInstance; rarity: Rarity; name: string; sellValue: number };

export type BagFilter = 'all' | 'equipment' | 'materials';

export const maxStack = (itemId: ItemId) => ITEMS[itemId].maxStack ?? DEFAULT_MAX_STACK;

/** Slots a count of one item occupies. */
export const stackSlots = (itemId: ItemId, count: number) => Math.ceil(count / maxStack(itemId));

/**
 * The player's bag: stackable items (Inventory counts) and owned equipment
 * that isn't equipped (EquipmentManager), within BAG_CAPACITY slots.
 *
 * Capacity rules: loot only enters with room (otherwise it stays on the
 * ground); unequipping needs a free slot. Guaranteed rewards (quest, dungeon
 * claim, crafting) are never lost and may push the bag over capacity, which
 * then blocks new loot until space is freed.
 */
export class Bag {
  constructor(
    readonly inventory: Inventory,
    readonly equipment: EquipmentManager,
    readonly capacity = BAG_CAPACITY,
  ) {}

  /** Unequipped equipment pieces. */
  equipmentInBag(): EquipmentInstance[] {
    return [...this.equipment.items.values()].filter((i) => !this.equipment.slotOf(i.instanceId));
  }

  usedSlots(): number {
    let used = this.equipmentInBag().length;
    for (const [itemId, count] of this.inventory.entries()) used += stackSlots(itemId, count);
    return used;
  }

  freeSlots(): number {
    return Math.max(0, this.capacity - this.usedSlots());
  }

  isFull(): boolean {
    return this.freeSlots() === 0;
  }

  /** Room for `amount` more units: they fit in existing stacks' free space and free slots. */
  hasRoomForItem(itemId: ItemId, amount = 1): boolean {
    const have = this.inventory.count(itemId);
    const extraSlots = stackSlots(itemId, have + amount) - stackSlots(itemId, have);
    return extraSlots <= this.freeSlots();
  }

  hasRoomForEquipment(pieces = 1): boolean {
    return pieces <= this.freeSlots();
  }

  /**
   * Bag slots an equip would need: pieces coming back into the bag (the
   * slot's current item, an off-hand pushed out by a two-handed weapon) minus
   * the item leaving it. Swapping one-for-one needs no free slot.
   */
  slotsNeededToEquip(instanceId: string, slot?: EquipmentSlot): number {
    const check = this.equipment.canEquip(instanceId, slot);
    if (!check.ok) return 0;
    const item = this.equipment.items.get(instanceId)!;
    const def = EQUIPMENT_DEFS[item.defId];
    let returning = 0;
    const current = this.equipment.equipped[check.slot];
    if (current && current !== instanceId) returning++;
    const twoHanded = check.slot === 'weapon' && !!def.weaponType && def.weaponType !== 'shield' && WEAPON_HANDS[def.weaponType] === 2;
    if (twoHanded && this.equipment.equipped.off_hand) returning++;
    const leaving = this.equipment.slotOf(instanceId) ? 0 : 1;
    return returning - leaving;
  }

  /** Every bag slot, sorted: equipment (slot order, rarity high→low, name), then items (type, rarity, name). */
  entries(filter: BagFilter = 'all'): BagEntry[] {
    const out: BagEntry[] = [];
    if (filter !== 'materials') {
      for (const item of this.equipmentInBag()) {
        const def = EQUIPMENT_DEFS[item.defId];
        out.push({ kind: 'equipment', key: `eq:${item.instanceId}`, item, rarity: def.rarity, name: def.name, sellValue: equipmentSellValue(def, item.enhancement) });
      }
    }
    if (filter !== 'equipment') {
      for (const [itemId, count] of this.inventory.entries()) {
        const def = ITEMS[itemId];
        const stack = maxStack(itemId);
        for (let left = count, n = 0; left > 0; left -= stack, n++) {
          out.push({ kind: 'item', key: `it:${itemId}:${n}`, itemId, count: Math.min(stack, left), type: def.type, rarity: def.rarity, name: def.name, sellValue: def.sellValue });
        }
      }
    }
    return out.sort(compareEntries);
  }
}

/** Bag sort: by type (equipment slot order, then item types), rarity (high first), name, then stack size (full first). */
export function compareEntries(a: BagEntry, b: BagEntry): number {
  const group = (e: BagEntry) =>
    e.kind === 'equipment' ? EQUIPMENT_SLOT_TYPE_ORDER.indexOf(EQUIPMENT_DEFS[e.item.defId].slotType) : 100 + ITEM_TYPE_ORDER.indexOf(e.type);
  return (
    group(a) - group(b) ||
    rarityRank(b.rarity) - rarityRank(a.rarity) ||
    a.name.localeCompare(b.name) ||
    (a.kind === 'item' && b.kind === 'item' ? b.count - a.count : 0) ||
    a.key.localeCompare(b.key)
  );
}
