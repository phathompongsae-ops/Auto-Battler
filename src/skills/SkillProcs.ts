import type { StatusSystem } from '../combat/StatusSystem';
import type { CombatEntity } from '../combat/types';
import type { EventBus } from '../core/EventBus';
import type { GameEvents } from '../game/GameEvents';
import type { StatOwner } from '../progression/statActions';
import { rankOf, treeForJob } from './skillTreeRules';

/**
 * Proc passives from the character's skill tree, driven by damage events
 * (which fire only for hits that land, so misses never count).
 *
 * low_hp: a hit taken that leaves HP below the threshold applies the status,
 * then nothing more until the internal cooldown has passed and another hit
 * lands below the threshold.
 * hit_streak: the character's own successful damaging hits (basic attacks and
 * damaging skills) within a rolling window; reaching the count applies (or
 * refreshes — statuses never stack) the status and starts a new streak.
 */
export class SkillProcs {
  private readonly icdUntil = new Map<string, number>();
  private hits: number[] = [];
  private readonly unsubscribe: () => void;

  constructor(
    private readonly owner: CombatEntity & StatOwner,
    events: EventBus<GameEvents>,
    private readonly statuses: StatusSystem,
    private readonly now: () => number,
  ) {
    this.unsubscribe = events.on('damage', (e) => {
      if (e.targetId === owner.id) this.onHitTaken(events);
      if (e.sourceId === owner.id) this.onHitLanded(events);
    });
  }

  destroy(): void {
    this.unsubscribe();
  }

  /** Forget streaks and internal cooldowns (skill reset, world reset). */
  reset(): void {
    this.icdUntil.clear();
    this.hits = [];
  }

  private learned() {
    const tree = treeForJob(this.owner.progress.classId);
    return (tree?.nodes ?? []).filter((n) => n.proc && rankOf(this.owner.progress.skillRanks, n.id) > 0);
  }

  private onHitTaken(events: EventBus<GameEvents>): void {
    const c = this.owner.combat;
    if (c.dead) return;
    const now = this.now();
    for (const node of this.learned()) {
      const p = node.proc!;
      if (p.kind !== 'low_hp' || c.hp >= c.stats.maxHp * p.threshold) continue;
      if (now < (this.icdUntil.get(node.id) ?? -Infinity)) continue;
      this.icdUntil.set(node.id, now + p.icdMs);
      this.statuses.apply(this.owner, p.statusId, p.durationMs, now);
      events.emit('skillProc', { entityId: this.owner.id, nodeId: node.id, statusId: p.statusId });
    }
  }

  private onHitLanded(events: EventBus<GameEvents>): void {
    const now = this.now();
    for (const node of this.learned()) {
      const p = node.proc!;
      if (p.kind !== 'hit_streak') continue;
      this.hits = this.hits.filter((t) => now - t < p.windowMs);
      this.hits.push(now);
      if (this.hits.length < p.hits) continue;
      this.hits = [];
      this.statuses.apply(this.owner, p.statusId, p.durationMs, now);
      events.emit('skillProc', { entityId: this.owner.id, nodeId: node.id, statusId: p.statusId });
    }
  }
}
