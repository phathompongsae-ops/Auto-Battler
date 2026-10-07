import type { CombatEntity } from './types';
import { cardinalFacing, DIRECTION_VECTORS, type Direction, type MoveIntent } from '../input/Direction';

export const BASIC_DODGE = { cooldown: 5000, iframe: 300, distance: 72, duration: 200, minimum: 8 } as const;
export function dodgeDirection(input: MoveIntent | null, facing: Direction): Direction {
  if (!input) return facing;
  if (typeof input === 'string') return input;
  return input.x || input.y ? cardinalFacing(input) : facing;
}
export interface DodgeWorld {
  blocked(actor: CombatEntity, x: number, y: number): boolean;
  move(actor: CombatEntity, x: number, y: number): void;
}
/** Shared ability: actor-owned timing, controller-independent request, swept collision. */
export class DodgeSystem {
  constructor(private readonly world: DodgeWorld) {}

  start(actor: CombatEntity, input: MoveIntent | null, facing: Direction, now: number): boolean {
    const c = actor.combat;
    if (c.dead || c.actionLocked(now) || c.dodge || (c.utilityCooldowns.get('dodge') ?? 0) > now) return false;
    const direction = dodgeDirection(input, facing);
    const v = DIRECTION_VECTORS[direction];
    let available = 0;
    for (let d = 2; d <= BASIC_DODGE.distance; d += 2) {
      if (this.world.blocked(actor, actor.x + v.x * d, actor.y + v.y * d)) break;
      available = d;
    }
    if (available < BASIC_DODGE.minimum) return false;
    c.dodge = { direction, startX: actor.x, startY: actor.y, startedAt: now, distance: available, travelled: 0 };
    c.utilityCooldowns.set('dodge', now + BASIC_DODGE.cooldown);
    c.invulnerableUntil = Math.max(c.invulnerableUntil, now + BASIC_DODGE.iframe);
    c.actionLockedUntil = Math.max(c.actionLockedUntil, now + BASIC_DODGE.duration);
    return true;
  }

  update(actor: CombatEntity, now: number): void {
    const motion = actor.combat.dodge;
    if (!motion) return;
    if (actor.combat.dead) { actor.combat.dodge = null; return; }
    const v = DIRECTION_VECTORS[motion.direction];
    const desired = Math.min(motion.distance, BASIC_DODGE.distance * (now - motion.startedAt) / BASIC_DODGE.duration);
    while (motion.travelled < desired) {
      const next = Math.min(desired, motion.travelled + 2);
      const x = motion.startX + v.x * next, y = motion.startY + v.y * next;
      if (this.world.blocked(actor, x, y)) { actor.combat.dodge = null; return; }
      this.world.move(actor, x, y);
      motion.travelled = next;
    }
    if (motion.travelled >= motion.distance || now >= motion.startedAt + BASIC_DODGE.duration) actor.combat.dodge = null;
  }
}
