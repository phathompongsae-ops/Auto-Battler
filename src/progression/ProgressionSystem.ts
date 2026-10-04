import type { CombatEntity } from '../combat/types';
import type { EventBus } from '../core/EventBus';
import type { ServerDayProvider } from '../core/serverDay';
import { MAX_LEVEL } from '../data/progressionData';
import type { GameEvents } from '../game/GameEvents';
import { expToNext, serverLevelCap } from './expCurve';

export interface ExpGrantResult {
  /** EXP kept (as level progress or Overflow EXP). */
  gained: number;
  /** EXP thrown away because the Overflow was full (or at MAX_LEVEL). */
  discarded: number;
  levelsGained: number;
}

/**
 * EXP and levelling. The curve lives in data (progressionData.ts).
 *
 * `combat.exp` is progress toward the next level. While the character sits at
 * its level cap it is the Overflow EXP instead: it keeps filling up to exactly
 * one level's worth but never levels, and anything beyond that is discarded.
 * When the cap rises, settle() applies the stored Overflow normally.
 *
 * The cap is the lowest of MAX_LEVEL, the class's growth range (Class 1 ends
 * at Lv40) and the server-day cap. Nothing here ever levels past it.
 */
export class ProgressionSystem {
  constructor(
    private readonly events: EventBus<GameEvents>,
    private readonly serverDay: ServerDayProvider,
  ) {}

  levelCap(entity: CombatEntity): number {
    return Math.min(MAX_LEVEL, entity.combat.maxLevel(), serverLevelCap(this.serverDay.day()));
  }

  /** Overflow EXP currently stored (0 when not at the cap). */
  overflowExp(entity: CombatEntity): number {
    return entity.combat.level >= this.levelCap(entity) ? entity.combat.exp : 0;
  }

  grantExp(entity: CombatEntity, amount: number): ExpGrantResult {
    if (!(amount > 0)) return { gained: 0, discarded: 0, levelsGained: 0 };
    const c = entity.combat;
    c.exp += Math.floor(amount);
    const levelsGained = this.levelUpTo(entity, this.levelCap(entity));
    const discarded = this.clampOverflow(entity);
    const gained = Math.floor(amount) - discarded;
    this.events.emit('expGained', { entityId: entity.id, amount: gained, discarded });
    return { gained, discarded, levelsGained };
  }

  /** Apply stored EXP after the cap rises (new server day, job change, load). */
  settle(entity: CombatEntity): number {
    const levels = this.levelUpTo(entity, this.levelCap(entity));
    this.clampOverflow(entity);
    return levels;
  }

  private levelUpTo(entity: CombatEntity, cap: number): number {
    const c = entity.combat;
    let levels = 0;
    while (c.level < cap && c.exp >= expToNext(c.level)) {
      c.exp -= expToNext(c.level);
      c.level += 1;
      levels += 1;
      c.refreshStats();
      c.restore();
      this.events.emit('levelUp', { entityId: entity.id, level: c.level });
    }
    return levels;
  }

  /** At the cap, keep at most one level's worth of Overflow EXP; returns what was dropped. */
  private clampOverflow(entity: CombatEntity): number {
    const c = entity.combat;
    if (c.level < this.levelCap(entity)) return 0;
    const max = expToNext(c.level);
    if (c.exp <= max) return 0;
    const dropped = c.exp - max;
    c.exp = max;
    return dropped;
  }
}
