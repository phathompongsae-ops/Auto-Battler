import type { EventBus } from '../core/EventBus';
import { defaultRng, type Rng } from '../core/rng';
import { SKILLS, type SkillId } from '../data/skillData';
import type { GameEvents } from '../game/GameEvents';
import { rollDamage, type DamageRoll } from './damage';
import type { CombatEntity } from './types';

/** Resolves damage, healing and death. The only place HP goes down. */
export class CombatSystem {
  rng: Rng = defaultRng;

  constructor(private readonly events: EventBus<GameEvents>) {}

  dealDamage(
    source: CombatEntity,
    target: CombatEntity,
    skillId: SkillId,
    power: number,
  ): DamageRoll | null {
    if (target.combat.dead) return null;

    const roll = rollDamage(source.combat.stats, target.combat.stats, power, this.rng);
    target.combat.hp = Math.max(0, target.combat.hp - roll.amount);
    this.events.emit('damage', {
      sourceId: source.id,
      targetId: target.id,
      skillId,
      amount: roll.amount,
      crit: roll.crit,
      heavy: roll.crit || !!SKILLS[skillId].heavy,
    });

    if (target.combat.hp === 0) this.kill(target, source);
    return roll;
  }

  heal(target: CombatEntity, amount: number): number {
    const c = target.combat;
    if (c.dead) return 0;
    const healed = Math.min(amount, c.stats.maxHp - c.hp);
    c.hp += healed;
    this.events.emit('heal', { targetId: target.id, amount: healed });
    return healed;
  }

  kill(target: CombatEntity, killer: CombatEntity | null): void {
    const c = target.combat;
    if (c.dead) return;
    c.hp = 0;
    c.dead = true;
    c.statuses.length = 0;
    c.refreshStats();
    this.events.emit('death', { entityId: target.id, killerId: killer?.id ?? null });
  }
}
