import { MIN_ATTACK_INTERVAL_MS } from '../data/combatRules';

/** The ASPD divisor never drops below this, so extreme debuffs can't stall or reverse attacks. */
const MIN_SPEED_FACTOR = 0.1;

/**
 * Basic-attack interval: base / (1 + attackSpeed), floored at
 * MIN_ATTACK_INTERVAL_MS. Only for skills with usesAttackSpeed; skill
 * cooldowns are never affected by ASPD.
 */
export function attackInterval(baseIntervalMs: number, attackSpeed: number): number {
  const factor = Math.max(MIN_SPEED_FACTOR, 1 + attackSpeed);
  return Math.max(MIN_ATTACK_INTERVAL_MS, baseIntervalMs / factor);
}
