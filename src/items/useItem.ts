import { ITEMS, type ItemId, type ItemUse } from '../data/itemData';
import type { DungeonEntitlements } from '../dungeon/entitlements';
import type { Inventory } from '../loot/Inventory';
import { resetAllocatedStats, type StatOwner } from '../progression/statActions';

export type UseItemResult =
  | { ok: true; effect: ItemUse['kind']; refundedStatPoints?: number; dungeonFullRewardsLeft?: number }
  | { ok: false; reason: 'unknown_item' | 'not_owned' | 'not_usable' | 'daily_extra_limit' };

/** Systems some item effects act on. */
export interface ItemUseServices {
  dungeon?: DungeonEntitlements;
}

/**
 * Use one item from the inventory: check, apply its effect, consume it. An
 * item is consumed only when its effect actually applied.
 */
export function useItem(inventory: Inventory, owner: StatOwner, itemId: string, services: ItemUseServices = {}): UseItemResult {
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
    case 'addDungeonFullReward': {
      if (!services.dungeon) return { ok: false, reason: 'not_usable' };
      const added = services.dungeon.addExtraFullReward();
      if (!added.ok) return { ok: false, reason: added.reason };
      inventory.remove(id);
      return { ok: true, effect: use.kind, dungeonFullRewardsLeft: added.fullRewardsLeft };
    }
  }
}
