import type { Rng } from '../core/rng';
import { HIT_CHANCE, MAX_DAMAGE_REDUCTION, MITIGATION_SCALE } from '../data/combatRules';
import type { DamageType } from '../data/skillData';
import type { CombatStats } from './types';

/*
 * Pure damage rules (locked v1). No engine code; randomness comes from the
 * injected Rng so tests and a future server control every roll.
 */

export type AttackResult = { hit: false } | { hit: true; amount: number; crit: boolean };

/** Hit chance = 95% + attacker accuracy - defender evasion, clamped to 70%..100%. */
export function hitChance(accuracy: number, evasion: number): number {
  return Math.min(HIT_CHANCE.max, Math.max(HIT_CHANCE.min, HIT_CHANCE.base + accuracy - evasion));
}

/** Damage after DEF / MDEF, before crit: ATK × multiplier × 100 / (100 + defense). */
export function mitigatedDamage(attack: number, multiplier: number, defense: number): number {
  return (attack * multiplier * MITIGATION_SCALE) / (MITIGATION_SCALE + Math.max(0, defense));
}

/**
 * Resolve one damaging attack: hit roll, then mitigation, then crit (applied
 * after DEF/MDEF), then the defender's damage reduction. Physical uses ATK vs DEF, magic uses MATK vs MDEF. A miss
 * deals nothing; a hit deals at least 1.
 *
 * Roll order: rng() for hit (hit when below the hit chance), then rng() for
 * crit (crit when below the crit chance) only on a hit.
 */
export function resolveAttack(
  attacker: Readonly<CombatStats>,
  defender: Readonly<CombatStats>,
  multiplier: number,
  type: DamageType,
  rng: Rng,
  /** Extra crit chance for this attack only (e.g. Heavy Strike); never changes the attacker's stats. */
  critBonus = 0,
): AttackResult {
  if (rng() >= hitChance(attacker.accuracy, defender.evasion)) return { hit: false };
  const base =
    type === 'magic'
      ? mitigatedDamage(attacker.magicAttack, multiplier, defender.magicDefense)
      : mitigatedDamage(attacker.attack, multiplier, defender.defense);
  const crit = rng() < attacker.critChance + critBonus;
  const reduction = Math.min(MAX_DAMAGE_REDUCTION, Math.max(0, defender.damageReduction));
  const amount = Math.max(1, Math.round(base * (crit ? attacker.critMultiplier : 1) * (1 - reduction)));
  return { hit: true, amount, crit };
}
