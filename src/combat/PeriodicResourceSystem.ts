import type { CombatantState } from './CombatantState';

export type Resource = 'hp' | 'mp';
export interface PeriodicResourceEffect {
  resource: Resource;
  sourceId: string;
  total: number;
  ticks: number;
  appliedTicks: number;
  interval: number;
  nextAt: number;
}
export function restoreResource(c: CombatantState, resource: Resource, amount: number): number {
  if (c.dead) return 0;
  const max = resource === 'hp' ? c.stats.maxHp : c.stats.maxMp;
  const actual = Math.min(Math.max(0, Math.round(amount)), Math.max(0, max - c[resource]));
  c[resource] += actual;
  return actual;
}
/** Actor-owned effects; fixed cumulative rounding makes tick partitioning/frame size irrelevant. */
export class PeriodicResourceSystem {
  add(c: CombatantState, group: string, effect: { resource: Resource; sourceId: string; amount?: number; percentage?: number; duration: number; interval: number }, now: number): void {
    const ticks = Math.floor(effect.duration / effect.interval);
    if (effect.interval <= 0 || ticks < 1 || ticks > 1000) return;
    const max = effect.resource === 'hp' ? c.stats.maxHp : c.stats.maxMp;
    c.periodicResources.set(group, { resource: effect.resource, sourceId: effect.sourceId, total: Math.round((effect.amount ?? 0) + max * (effect.percentage ?? 0)), ticks, appliedTicks: 0, interval: effect.interval, nextAt: now + effect.interval });
  }
  update(c: CombatantState, now: number): void {
    if (c.dead) { c.periodicResources.clear(); return; }
    for (const [group, effect] of c.periodicResources) {
      while (effect.nextAt <= now && effect.appliedTicks < effect.ticks) {
        const before = Math.round(effect.total * effect.appliedTicks / effect.ticks);
        effect.appliedTicks++;
        restoreResource(c, effect.resource, Math.round(effect.total * effect.appliedTicks / effect.ticks) - before);
        effect.nextAt += effect.interval;
      }
      if (effect.appliedTicks === effect.ticks) c.periodicResources.delete(group);
    }
  }
}
