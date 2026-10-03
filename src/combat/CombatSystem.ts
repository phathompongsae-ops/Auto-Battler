import type { EventBus } from '../core/EventBus';
import { defaultRng, type Rng } from '../core/rng';
import { SKILLS, type DamageType, type SkillId } from '../data/skillData';
import type { GameEvents } from '../game/GameEvents';
import { resolveAttack, type AttackResult } from './damage';
import type { CombatEntity } from './types';

/** A skill's damage type from data; non-damage skills are never resolved here. */
function damageTypeOf(skillId: SkillId): DamageType {
  const effect = SKILLS[skillId].effect;
  if (effect.kind === 'damage' || effect.kind === 'projectile') return effect.damageType;
  throw new Error(`${skillId} is not a damaging skill`);
}

/** Resolves damage, healing and death. The only place HP goes down. */
export class CombatSystem {
  rng: Rng = defaultRng;

  constructor(private readonly events: EventBus<GameEvents>) {}

  /**
   * One damaging hit: hit roll, mitigation by DEF/MDEF, crit. Returns null if
   * the target was already dead, otherwise whether it hit. Callers attaching
   * extra effects (crowd control, on-hit procs) must only apply them on a hit.
   */
  dealDamage(source: CombatEntity, target: CombatEntity, skillId: SkillId, power: number): AttackResult | null {
    if (target.combat.dead) return null;

    // Skill-specific damage bonuses (e.g. a set bonus on one skill) scale the skill multiplier.
    const multiplier = power * (1 + (source.combat.stats.skillDamageBonus[skillId] ?? 0));
    const result = resolveAttack(source.combat.stats, target.combat.stats, multiplier, damageTypeOf(skillId), this.rng);
    if (!result.hit) {
      this.events.emit('miss', { sourceId: source.id, targetId: target.id, skillId });
      return result;
    }

    target.combat.hp = Math.max(0, target.combat.hp - result.amount);
    this.events.emit('damage', {
      sourceId: source.id,
      targetId: target.id,
      skillId,
      amount: result.amount,
      crit: result.crit,
      heavy: result.crit || !!SKILLS[skillId].heavy,
    });

    if (target.combat.hp === 0) this.kill(target, source);
    return result;
  }

  /** Healing always succeeds (no hit roll). */
  heal(target: CombatEntity, amount: number): number {
    const c = target.combat;
    if (c.dead) return 0;
    const healed = Math.min(Math.round(amount), c.stats.maxHp - c.hp);
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
