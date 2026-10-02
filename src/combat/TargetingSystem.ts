import type { EventBus } from '../core/EventBus';
import { distance } from '../core/math';
import type { GameEvents } from '../game/GameEvents';
import type { CombatEntity } from './types';

/**
 * Owns the player's current target. Pure selection logic: rendering the
 * highlight is done elsewhere by listening to `targetChanged`.
 */
export class TargetingSystem {
  current: CombatEntity | null = null;

  constructor(
    private readonly events: EventBus<GameEvents>,
    private readonly acquireRange: number,
    private readonly loseRange: number,
  ) {}

  isValid(from: CombatEntity, target: CombatEntity | null): target is CombatEntity {
    return (
      !!target &&
      !target.combat.dead &&
      target.combat.team !== from.combat.team &&
      distance(from, target) <= this.loseRange
    );
  }

  /** Living enemies within acquire range, nearest first. */
  candidates(from: CombatEntity, entities: readonly CombatEntity[]): CombatEntity[] {
    return entities
      .filter(
        (e) =>
          !e.combat.dead &&
          e.combat.team !== from.combat.team &&
          distance(from, e) <= this.acquireRange,
      )
      .sort((a, b) => distance(from, a) - distance(from, b));
  }

  select(target: CombatEntity | null): void {
    if (target === this.current) return;
    this.current = target;
    this.events.emit('targetChanged', { target });
  }

  selectNearest(from: CombatEntity, entities: readonly CombatEntity[]): CombatEntity | null {
    const nearest = this.candidates(from, entities)[0] ?? null;
    if (nearest) this.select(nearest);
    return nearest;
  }

  /** Tab-style cycling through nearby enemies, nearest first. */
  cycle(from: CombatEntity, entities: readonly CombatEntity[]): CombatEntity | null {
    const list = this.candidates(from, entities);
    if (list.length === 0) {
      this.select(null);
      return null;
    }
    const index = this.current ? list.indexOf(this.current) : -1;
    const next = list[(index + 1) % list.length];
    this.select(next);
    return next;
  }

  /** Drops the target if it died or moved out of range. */
  validate(from: CombatEntity): void {
    if (this.current && !this.isValid(from, this.current)) this.select(null);
  }
}
