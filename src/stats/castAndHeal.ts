import { MIN_CAST_TIME_MS } from '../data/combatRules';

/*
 * Hooks for the Cast Time and Heal Power derived stats. No casting system
 * exists yet, so nothing calls effectiveCastTime; heals use effectiveHeal.
 */

/** Cast time after the cast-time modifier (negative = faster): base × (1 + modifier), never below 0. */
export function effectiveCastTime(baseCastMs: number, castTimeModifier: number): number {
  return Math.max(MIN_CAST_TIME_MS, baseCastMs * (1 + castTimeModifier));
}

/** Heal amount after Heal Power: base × (1 + healPower). Unrounded; HP application rounds. */
export function effectiveHeal(baseHeal: number, healPowerModifier: number): number {
  return Math.max(0, baseHeal * (1 + healPowerModifier));
}
