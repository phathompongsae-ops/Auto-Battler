import { ITEMS, type ItemId, type ItemUse } from '../data/itemData';
import type { Inventory } from '../loot/Inventory';
import { resetAllocatedStats, type StatOwner } from '../progression/statActions';

export type UseItemResult =
  | { ok: true; effect: ItemUse['kind']; refundedStatPoints?: number }
  | { ok: false; reason: 'unknown_item' | 'not_owned' | 'not_usable' };

/** Use one item from the inventory: check, apply its effect, consume it. */
export function useItem(inventory: Inventory, owner: StatOwner, itemId: string): UseItemResult {
  if (!(itemId in ITEMS)) return { ok: false, reason: 'unknown_item' };
  const id = itemId as ItemId;
  const use = ITEMS[id].use;
  if (!use) return { ok: false, reason: 'not_usable' };
  if (inventory.count(id) < 1) return { ok: false, reason: 'not_owned' };

  switch (use.kind) {
    case 'resetAllocatedStats': {
      inventory.remove(id);
      return { ok: true, effect: use.kind, refundedStatPoints: resetAllocatedStats(owner) };
    }
  }
}
