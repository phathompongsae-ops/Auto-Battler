import type { StatusDef } from '../data/statusData';
import type { DerivedStatKey, StatModifier } from '../stats/modifiers';
import type { CombatStats } from './types';

/** Active statuses as stat-pipeline modifiers (source 'buff' / 'debuff'). */
export function statusModifiers(statuses: readonly { def: StatusDef }[]): StatModifier[] {
  return statuses.map(({ def }) => ({ source: def.kind, id: `status:${def.id}`, ...def.modifier }));
}

type NumericCombatKey = { [K in keyof CombatStats]-?: CombatStats[K] extends number ? K : never }[keyof CombatStats];

/** Where each derived stat lives on CombatStats, for entities without a primary-stat pipeline. */
const COMBAT_KEY: Record<DerivedStatKey, NumericCombatKey | null> = {
  maxHp: 'maxHp',
  maxMp: 'maxMp',
  physicalAtk: 'attack',
  magicAtk: 'magicAttack',
  def: 'defense',
  mdef: 'magicDefense',
  accuracy: 'accuracy',
  evasion: 'evasion',
  aspd: 'attackSpeed',
  critRate: 'critChance',
  critDamage: 'critMultiplier',
  castTime: 'castTime',
  healPower: 'healPower',
};

/**
 * Status effects on plain data stats (monsters): same flat-then-percent order
 * as the player's pipeline. Primary-stat parts don't apply to monsters.
 */
export function applyStatusModifiers(base: CombatStats, statuses: readonly { def: StatusDef }[]): CombatStats {
  const out = { ...base };
  const percent: Partial<Record<NumericCombatKey, number>> = {};
  for (const m of statusModifiers(statuses)) {
    for (const [k, v] of Object.entries(m.flat ?? {}) as [DerivedStatKey, number][]) {
      const key = COMBAT_KEY[k];
      if (key) out[key] += v;
    }
    for (const [k, v] of Object.entries(m.percent ?? {}) as [DerivedStatKey, number][]) {
      const key = COMBAT_KEY[k];
      if (key) percent[key] = (percent[key] ?? 0) + v;
    }
  }
  for (const [key, v] of Object.entries(percent) as [NumericCombatKey, number][]) out[key] *= 1 + v;
  return out;
}
