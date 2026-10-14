import type { EventBus } from '../core/EventBus';
import type { SkillId } from '../data/skillData';
import { STATUSES, type StatusId } from '../data/statusData';
import type { GameEvents } from '../game/GameEvents';
import type { CombatSystem } from './CombatSystem';
import type { CombatEntity } from './types';

/** Who applied a status and how strongly: required for damage-over-time statuses (StatusDef.dot). */
export interface StatusSource {
  source: CombatEntity;
  skillId: SkillId;
  /** Damage multiplier per tick (MATK / ATK x magnitude, mitigated like a hit). */
  magnitude: number;
}

/**
 * Timed buffs/debuffs. Re-applying a status refreshes its duration (a Slow
 * or Burn refresh only ever extends it).
 * Damage-over-time statuses tick on a fixed rhythm from their first
 * application (a refresh extends them and keeps the rhythm; the stronger
 * magnitude wins), so ticks never double up however often they are refreshed.
 */
export class StatusSystem {
  constructor(
    private readonly events: EventBus<GameEvents>,
    /** Deals damage-over-time ticks (through the normal damage path). Without it DoT statuses only show. */
    private readonly combat?: CombatSystem,
  ) {}

  apply(target: CombatEntity, statusId: StatusId, duration: number, now: number, from?: StatusSource): void {
    const c = target.combat;
    if (c.dead) return;
    const def = STATUSES[statusId];
    const expiresAt = now + duration;
    const existing = c.statuses.find((s) => s.def.id === statusId);
    const status = existing ?? { def, expiresAt };
    // A Slow / Burn refresh never shortens what is left (Frost Storm's short Chill must not cut a longer one).
    status.expiresAt = existing && (def.dot || def.slow) ? Math.max(existing.expiresAt, expiresAt) : expiresAt;
    if (def.dot && from) {
      const magnitude = Math.max(from.magnitude, status.dot?.magnitude ?? 0);
      status.dot = { source: from.source, skillId: from.skillId, magnitude, nextTickAt: status.dot?.nextTickAt ?? now + def.dot.intervalMs };
    }
    if (!existing) c.statuses.push(status);
    c.refreshStats();
    this.events.emit('statusApplied', { targetId: target.id, statusId, expiresAt: status.expiresAt });
  }

  update(entities: readonly CombatEntity[], now: number): void {
    for (const entity of entities) {
      const statuses = entity.combat.statuses;
      for (let i = statuses.length - 1; i >= 0; i--) {
        const status = statuses[i];
        // Ticks due by now (never past the expiry) land before the status can expire, so its last tick still counts.
        if (status.dot && status.def.dot) this.tick(entity, status, now);
        if (entity.combat.dead) break;
        if (status.expiresAt > now) continue;
        const index = statuses.indexOf(status);
        if (index < 0) continue;
        statuses.splice(index, 1);
        entity.combat.refreshStats();
        this.events.emit('statusExpired', { targetId: entity.id, statusId: status.def.id as StatusId });
      }
    }
  }

  remaining(entity: CombatEntity, statusId: StatusId, now: number): number {
    const status = entity.combat.statuses.find((s) => s.def.id === statusId);
    return status ? Math.max(0, status.expiresAt - now) : 0;
  }

  private tick(entity: CombatEntity, status: (typeof entity.combat.statuses)[number], now: number): void {
    const dot = status.dot!;
    const interval = status.def.dot!.intervalMs;
    while (dot.nextTickAt <= now && dot.nextTickAt <= status.expiresAt && !entity.combat.dead) {
      dot.nextTickAt += interval;
      this.combat?.dealPeriodicDamage(dot.source, entity, dot.skillId, dot.magnitude, status.def.id as StatusId);
    }
  }
}
