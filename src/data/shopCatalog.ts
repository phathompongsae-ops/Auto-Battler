import type { ItemId } from './itemData';

/*
 * TEMPORARY DEVELOPMENT CATALOGUE — not designed economy.
 *
 * The Shop shell (Visual Production Pass 1) needs entries to lay out. These
 * use existing item ids and carry no prices: the Gold / Diamond economy is
 * not designed yet (see docs/design/gameplay-source-of-truth.md). Nothing
 * here can be bought. Replace this file when the economy design locks
 * prices, stock and limits; do not treat it as balance data.
 */

export type ShopSection = 'gold' | 'diamond';

export interface ShopEntry {
  id: string;
  section: ShopSection;
  itemId: ItemId;
  quantity: number;
  /** null until the economy design sets it; the Shop shows "Price TBD". */
  price: null;
  /** Marks a development placeholder; the Shop shows the preview notice while any entry is temporary. */
  temporary: true;
}

export const SHOP_CATALOG: readonly ShopEntry[] = [
  { id: 'dev_gold_hp_potion', section: 'gold', itemId: 'small_hp_potion', quantity: 1, price: null, temporary: true },
  { id: 'dev_gold_mp_potion', section: 'gold', itemId: 'small_mp_potion', quantity: 1, price: null, temporary: true },
  { id: 'dev_gold_town_warp', section: 'gold', itemId: 'town_warp_scroll', quantity: 1, price: null, temporary: true },
  { id: 'dev_gold_enhancement', section: 'gold', itemId: 'enhancement_stone', quantity: 1, price: null, temporary: true },
  { id: 'dev_diamond_egg_ticket', section: 'diamond', itemId: 'random_egg_ticket', quantity: 1, price: null, temporary: true },
  { id: 'dev_diamond_protection', section: 'diamond', itemId: 'protection_stone', quantity: 1, price: null, temporary: true },
  { id: 'dev_diamond_booster', section: 'diamond', itemId: 'success_booster', quantity: 1, price: null, temporary: true },
  { id: 'dev_diamond_dungeon_ticket', section: 'diamond', itemId: 'additional_dungeon_ticket', quantity: 1, price: null, temporary: true },
];
