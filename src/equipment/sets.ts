import type { EquipmentSlot } from '../data/equipmentData';
import { EQUIPMENT_DEFS } from '../data/equipmentItems';
import { SET_PIECE_SLOTS, SETS, type SetBonusDef, type SetId, type SetThreshold } from '../data/setData';
import { effectKey, type StatModifier } from '../stats/modifiers';

export interface ActiveSetBonus {
  setId: SetId;
  threshold: SetThreshold;
  bonus: SetBonusDef;
}

/**
 * Special effects that become stat effects once their numbers are tuned.
 * While a param is null the effect is inert (hook only).
 */
const TUNABLE_SPECIALS: Record<string, (params: Readonly<Record<string, number | null>>) => StatModifier['effects'] | null> = {
  warborn_power_slash_cooldown: (p) => (p.cooldownReduction == null ? null : { [effectKey.skillCooldown('power_strike')]: p.cooldownReduction }),
};

/**
 * Count set pieces from equipped head / armor / gloves / boots and return the
 * active bonuses as 'equipment' modifiers. Pure: recomputed from what is
 * equipped, so removing a piece removes its bonus immediately.
 */
export function evaluateSets(
  equipped: Readonly<Record<EquipmentSlot, string | null>>,
  items: ReadonlyMap<string, { defId: string }>,
): { counts: Partial<Record<SetId, number>>; active: ActiveSetBonus[]; modifiers: StatModifier[] } {
  const counts: Partial<Record<SetId, number>> = {};
  for (const slot of SET_PIECE_SLOTS) {
    const id = equipped[slot];
    const setId = id ? EQUIPMENT_DEFS[items.get(id)?.defId ?? '']?.setId : undefined;
    if (setId) counts[setId] = (counts[setId] ?? 0) + 1;
  }
  const active: ActiveSetBonus[] = [];
  for (const [setId, count] of Object.entries(counts) as [SetId, number][]) {
    for (const threshold of [2, 4] as const) {
      if (count >= threshold) active.push({ setId, threshold, bonus: SETS[setId].bonuses[threshold] });
    }
  }
  const modifiers: StatModifier[] = [];
  for (const { setId, threshold, bonus } of active) {
    const tuned = bonus.special ? TUNABLE_SPECIALS[bonus.special.effectId]?.(bonus.special.params) : null;
    if (!bonus.modifier && !tuned) continue;
    modifiers.push({
      source: 'equipment',
      id: `set:${setId}:${threshold}`,
      ...bonus.modifier,
      effects: { ...bonus.modifier?.effects, ...tuned },
    });
  }
  return { counts, active, modifiers };
}
