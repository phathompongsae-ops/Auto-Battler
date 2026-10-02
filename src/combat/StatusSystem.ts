import type { EventBus } from '../core/EventBus';
import type { StatusDef } from '../data/statusData';
import type { GameEvents } from '../game/GameEvents';
import type { CombatEntity } from './types';

/** Timed buffs/debuffs. Re-applying a status refreshes its duration. */
export class StatusSystem {
  constructor(private readonly events: EventBus<GameEvents>) {}

  apply(target: CombatEntity, def: StatusDef, duration: number, now: number): void {
    const c = target.combat;
    if (c.dead) return;
    const expiresAt = now + duration;
    const existing = c.statuses.find((s) => s.def.id === def.id);
    if (existing) existing.expiresAt = expiresAt;
    else c.statuses.push({ def, expiresAt });
    c.refreshStats();
    this.events.emit('statusApplied', { target, status: def, expiresAt });
  }

  update(entities: readonly CombatEntity[], now: number): void {
    for (const entity of entities) {
      const statuses = entity.combat.statuses;
      for (let i = statuses.length - 1; i >= 0; i--) {
        if (statuses[i].expiresAt > now) continue;
        const [expired] = statuses.splice(i, 1);
        entity.combat.refreshStats();
        this.events.emit('statusExpired', { target: entity, status: expired.def });
      }
    }
  }

  remaining(entity: CombatEntity, statusId: string, now: number): number {
    const status = entity.combat.statuses.find((s) => s.def.id === statusId);
    return status ? Math.max(0, status.expiresAt - now) : 0;
  }
}
