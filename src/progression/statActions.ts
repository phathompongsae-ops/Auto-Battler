import type { CombatantState } from '../combat/CombatantState';
import type { PrimaryStat } from '../stats/primaryStats';
import type { CharacterProgress } from './CharacterProgress';

/** Anything with persistent stat inputs and live combat stats (the player, a test double, a server record). */
export interface StatOwner {
  readonly progress: CharacterProgress;
  readonly combat: CombatantState;
}

/** Spend free points; combat stats update immediately. */
export function allocateStat(owner: StatOwner, stat: PrimaryStat, amount: number) {
  const result = owner.progress.allocate(stat, amount, owner.combat.level);
  if (result.ok) owner.combat.refreshStats();
  return result;
}

/** Return every allocated point (the Stat Reset item's effect). Returns the refunded count. */
export function resetAllocatedStats(owner: StatOwner): number {
  const refunded = owner.progress.resetAllocated();
  owner.combat.refreshStats();
  return refunded;
}

/** Take a job at the current level and apply its Job Bonus. */
export function changeJob(owner: StatOwner, jobId: string) {
  const result = owner.progress.changeJob(jobId, owner.combat.level);
  if (result.ok) owner.combat.refreshStats();
  return result;
}
