import type { StatusDef } from '../data/statusData';
import type { CombatStats, StatKey } from './types';

/** Base stats plus `growth` for every level above 1. */
export function statsForLevel(
  base: CombatStats,
  growth: Partial<CombatStats>,
  level: number,
): CombatStats {
  const stats = { ...base };
  for (const key of Object.keys(growth) as StatKey[]) {
    stats[key] += (growth[key] ?? 0) * (level - 1);
  }
  return stats;
}

/** Applies status modifiers (multipliers first, then flat additions) into `out`. */
export function applyStatusModifiers(
  base: CombatStats,
  statuses: readonly StatusDef[],
  out: CombatStats,
): CombatStats {
  Object.assign(out, base);
  for (const status of statuses) {
    for (const key of Object.keys(status.modifiers) as StatKey[]) {
      const mod = status.modifiers[key];
      if (!mod) continue;
      out[key] = out[key] * (mod.mul ?? 1) + (mod.add ?? 0);
    }
  }
  return out;
}
