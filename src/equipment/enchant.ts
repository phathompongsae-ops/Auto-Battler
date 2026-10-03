import { rollInt, weightedPick, type Rng } from '../core/rng';
import { ENCHANT_LINES, ENCHANT_OPTIONS, ENCHANT_POOLS, ENCHANT_QUALITY_WEIGHTS, ENCHANT_REROLL_COST } from '../data/enchantData';
import { CATEGORY_FOR_TYPE } from '../data/equipmentData';
import type { EquipmentDef } from '../data/equipmentItems';
import type { Wallet } from '../economy/Wallet';
import type { Inventory } from '../loot/Inventory';
import { defOf, type EnchantLine, type EquipmentInstance } from './equipment';

/** Option ids this item may roll (its slot category's pool). */
export function enchantPool(def: EquipmentDef): readonly string[] {
  return ENCHANT_POOLS[CATEGORY_FOR_TYPE[def.slotType]];
}

function rollLine(def: EquipmentDef, exclude: ReadonlySet<string>, rng: Rng): EnchantLine {
  const candidates = enchantPool(def).filter((id) => !exclude.has(id));
  if (!candidates.length) throw new Error(`no enchant options left for ${def.id}`);
  const optionId = candidates[Math.floor(rng() * candidates.length)];
  const option = ENCHANT_OPTIONS[optionId];
  const quality = weightedPick(ENCHANT_QUALITY_WEIGHTS[def.rarity], rng);
  const [min, max] = option.ranges[quality];
  const value = option.integer ? rollInt(min, max, rng) : Math.round((min + rng() * (max - min)) * 1000) / 1000;
  return { optionId, quality, value };
}

/** Fresh enchant lines for a new item: line count by rarity, distinct options. */
export function rollEnchants(def: EquipmentDef, rng: Rng): EnchantLine[] {
  const lines: EnchantLine[] = [];
  const used = new Set<string>();
  for (let i = 0; i < ENCHANT_LINES[def.rarity]; i++) {
    const line = rollLine(def, used, rng);
    used.add(line.optionId);
    lines.push(line);
  }
  return lines;
}

/** Reroll price; each locked line makes it more expensive. */
export function rerollCost(lockedCount: number): { stones: number; gold: number } {
  const c = ENCHANT_REROLL_COST;
  return { stones: c.stones.base + c.stones.perLockedLine * lockedCount, gold: c.gold.base + c.gold.perLockedLine * lockedCount };
}

export type RerollResult = { ok: true; lines: EnchantLine[] } | { ok: false; reason: 'invalid_lock' | 'all_locked' | 'not_enough_stones' | 'not_enough_gold' };

/**
 * Reroll the unlocked enchant lines. Locked lines stay exactly as they were
 * (same option, quality and value) and are never re-rolled into duplicates.
 */
export function rerollEnchants(
  item: EquipmentInstance,
  locked: readonly number[],
  ctx: { inventory: Inventory; wallet: Wallet; rng: Rng },
): RerollResult {
  const def = defOf(item);
  const lockedSet = new Set(locked);
  if (locked.some((i) => !Number.isInteger(i) || i < 0 || i >= item.enchants.length) || lockedSet.size !== locked.length) {
    return { ok: false, reason: 'invalid_lock' };
  }
  if (lockedSet.size >= item.enchants.length) return { ok: false, reason: 'all_locked' };
  const cost = rerollCost(lockedSet.size);
  if (ctx.inventory.count('enchant_stone') < cost.stones) return { ok: false, reason: 'not_enough_stones' };
  if (ctx.wallet.get('gold') < cost.gold) return { ok: false, reason: 'not_enough_gold' };
  ctx.inventory.remove('enchant_stone', cost.stones);
  ctx.wallet.spend('gold', cost.gold);

  const keep = new Set(item.enchants.filter((_, i) => lockedSet.has(i)).map((l) => l.optionId));
  item.enchants = item.enchants.map((line, i) => {
    if (lockedSet.has(i)) return line;
    const fresh = rollLine(def, keep, ctx.rng);
    keep.add(fresh.optionId);
    return fresh;
  });
  return { ok: true, lines: item.enchants };
}
