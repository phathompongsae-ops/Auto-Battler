import type { Rng } from '../core/rng';
import type { CombatStats } from './types';

export interface DamageRoll {
  amount: number;
  crit: boolean;
}

export const DAMAGE_VARIANCE = 0.1; // ±10%
export const DEFENSE_FACTOR = 0.5; // each point of defense blocks this much damage

/** Pure damage formula. Always deals at least 1. */
export function rollDamage(
  attacker: Readonly<CombatStats>,
  defender: Readonly<CombatStats>,
  power: number,
  rng: Rng,
): DamageRoll {
  const crit = rng() < attacker.critChance;
  const variance = 1 - DAMAGE_VARIANCE + rng() * DAMAGE_VARIANCE * 2;
  const raw = attacker.attack * power * variance - defender.defense * DEFENSE_FACTOR;
  const amount = Math.max(1, Math.round(raw * (crit ? attacker.critMultiplier : 1)));
  return { amount, crit };
}
