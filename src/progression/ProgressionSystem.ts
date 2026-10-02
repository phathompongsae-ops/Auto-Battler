import type { CombatEntity } from '../combat/types';
import type { EventBus } from '../core/EventBus';
import { expToNext, MAX_LEVEL } from '../data/progressionData';
import type { GameEvents } from '../game/GameEvents';

/** EXP and levelling. Curve and stat growth live in data files. */
export class ProgressionSystem {
  constructor(private readonly events: EventBus<GameEvents>) {}

  grantExp(entity: CombatEntity, amount: number): void {
    const c = entity.combat;
    if (amount <= 0 || c.level >= MAX_LEVEL) return;
    c.exp += amount;
    this.events.emit('expGained', { entityId: entity.id, amount });

    while (c.level < MAX_LEVEL && c.exp >= expToNext(c.level)) {
      c.exp -= expToNext(c.level);
      c.level += 1;
      c.refreshStats();
      c.restore();
      this.events.emit('levelUp', { entityId: entity.id, level: c.level });
    }
    if (c.level >= MAX_LEVEL) c.exp = 0;
  }
}
