import type { Rng } from '../core/rng';
import {
  ENHANCEMENT_COST,
  ENHANCEMENT_FAILURE,
  ENHANCEMENT_SUCCESS,
  ENHANCEMENT_VFX_TIERS,
  MAX_ENHANCEMENT,
} from '../data/equipmentData';
import { ITEMS, type ItemId } from '../data/itemData';
import type { Wallet } from '../economy/Wallet';
import type { Inventory } from '../loot/Inventory';
import type { EquipmentInstance } from './equipment';

const STONE: ItemId = 'enhancement_stone';
const PROTECTION: ItemId = 'protection_stone';
const BOOSTER: ItemId = 'success_booster';

export interface EnhanceOptions {
  /** Spend a Protection Stone: a failure cannot lower the level. Adds no success chance. */
  protectionStone?: boolean;
  /** Spend a Success Booster: adds its configured bonus to this attempt's chance. Protects nothing. */
  successBooster?: boolean;
}

export type EnhanceResult =
  | { ok: true; success: boolean; from: number; to: number; chance: number }
  | { ok: false; reason: 'max_level' | 'not_enough_stones' | 'not_enough_gold' | 'missing_protection_stone' | 'missing_success_booster' };

/** Success chance for reaching `target`, with an optional absolute bonus, capped at 100%. */
export function enhancementChance(target: number, bonus = 0): number {
  const base = ENHANCEMENT_SUCCESS[target];
  if (base === undefined || target < 1) throw new Error(`no enhancement level ${target}`);
  return Math.min(1, base + bonus);
}

/** Level after a failed attempt from `current` (data-driven; never breaks the item). */
export function levelAfterFailure(current: number, protectedByStone: boolean): number {
  const f = ENHANCEMENT_FAILURE;
  if (protectedByStone || current < f.dropsWhenAtOrAbove) return current;
  return Math.max(f.safeFloor, current - f.levelsLost);
}

export function boosterBonus(): number {
  const support = ITEMS[BOOSTER].enhancementSupport;
  return support?.kind === 'booster' ? support.successBonus : 0;
}

/**
 * One enhancement attempt. Costs and chosen support items are checked first
 * and consumed only when the attempt is made. No pity: the chance depends
 * only on the target level and this attempt's booster.
 */
export function attemptEnhancement(
  item: EquipmentInstance,
  ctx: { inventory: Inventory; wallet: Wallet; rng: Rng },
  options: EnhanceOptions = {},
): EnhanceResult {
  const from = item.enhancement;
  if (from >= MAX_ENHANCEMENT) return { ok: false, reason: 'max_level' };
  const target = from + 1;
  const cost = ENHANCEMENT_COST[target];
  if (ctx.inventory.count(STONE) < cost.stones) return { ok: false, reason: 'not_enough_stones' };
  if (ctx.wallet.get('gold') < cost.gold) return { ok: false, reason: 'not_enough_gold' };
  if (options.protectionStone && ctx.inventory.count(PROTECTION) < 1) return { ok: false, reason: 'missing_protection_stone' };
  if (options.successBooster && ctx.inventory.count(BOOSTER) < 1) return { ok: false, reason: 'missing_success_booster' };

  if (cost.stones > 0) ctx.inventory.remove(STONE, cost.stones);
  ctx.wallet.spend('gold', cost.gold);
  if (options.protectionStone) ctx.inventory.remove(PROTECTION);
  if (options.successBooster) ctx.inventory.remove(BOOSTER);

  const chance = enhancementChance(target, options.successBooster ? boosterBonus() : 0);
  const success = ctx.rng() < chance;
  item.enhancement = success ? target : levelAfterFailure(from, !!options.protectionStone);
  return { ok: true, success, from, to: item.enhancement, chance };
}

/** Cosmetic weapon glow tier: 0 none, 1 at +10, 2 at +12, 3 at +15. Never affects stats. */
export function enhancementVfxTier(level: number): 0 | 1 | 2 | 3 {
  return ENHANCEMENT_VFX_TIERS.find((t) => level >= t.minLevel)?.tier ?? 0;
}
