import { MONSTER_BALANCE, type MonsterBalanceValues, type MonsterTier } from '../data/monsterBalance';
import type { MonsterStats } from '../data/monsterData';

export class MonsterBalanceRangeError extends Error {}

const KEYS = ['hp', 'atk', 'def', 'mdef', 'exp', 'gold'] as const;

/**
 * Balance values for a monster tier at a fixed content level. Exact anchors
 * return the locked values; between anchors values are linear and rounded to
 * the nearest integer. Outside the supported range it throws: no silent
 * extrapolation, and never any player-level input.
 */
export function monsterBalance(tier: MonsterTier, level: number): MonsterBalanceValues {
  const anchors = MONSTER_BALANCE[tier];
  const levels = Object.keys(anchors).map(Number).sort((a, b) => a - b);
  if (!Number.isInteger(level) || level < levels[0] || level > levels[levels.length - 1]) {
    throw new MonsterBalanceRangeError(`${tier} balance covers Lv${levels[0]}–${levels[levels.length - 1]}, not Lv${level}`);
  }
  const hi = levels.find((l) => l >= level)!;
  if (hi === level) return { ...anchors[hi] };
  const lo = levels[levels.indexOf(hi) - 1];
  const t = (level - lo) / (hi - lo);
  const out: MonsterBalanceValues = { hp: 0, atk: 0, def: 0, mdef: 0 };
  for (const k of KEYS) {
    const a = anchors[lo][k];
    const b = anchors[hi][k];
    if (a !== undefined && b !== undefined) out[k] = Math.round(a + (b - a) * t);
  }
  return out;
}

/** Combat stats for a monster definition built on a balance tier; behaviour fields come from the caller. */
export function monsterStatsFromBalance(
  tier: MonsterTier,
  level: number,
  behaviour: Pick<MonsterStats, 'moveSpeed' | 'critChance' | 'critMultiplier'>,
): MonsterStats {
  const b = monsterBalance(tier, level);
  return { maxHp: b.hp, maxMp: 0, attack: b.atk, defense: b.def, magicDefense: b.mdef, mpRegen: 0, ...behaviour };
}
