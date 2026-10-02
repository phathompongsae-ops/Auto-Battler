import type { EventBus } from '../core/EventBus';
import { distance, type Point } from '../core/math';
import { SKILLS, type SkillDef, type SkillId } from '../data/skillData';
import { STATUSES } from '../data/statusData';
import type { GameEvents } from '../game/GameEvents';
import type { CombatSystem } from './CombatSystem';
import type { ProjectileSystem } from './ProjectileSystem';
import type { StatusSystem } from './StatusSystem';
import type { CombatEntity } from './types';

export type SkillFailReason = 'dead' | 'cooldown' | 'no_target' | 'out_of_range' | 'no_mp';

export type SkillResult = { ok: true } | { ok: false; reason: SkillFailReason };

export interface CastOptions {
  target?: CombatEntity | null;
  /** Direction for 'enemy_or_direction' skills when there is no target. */
  aim?: Point;
  /** Don't emit skillFailed (used for held/auto-repeat input and AI). */
  quiet?: boolean;
}

/** Distance from the caster's centre to the target's edge. */
export function reach(caster: CombatEntity, target: CombatEntity): number {
  return distance(caster, target) - target.hitRadius;
}

/**
 * One code path for every skill, player or monster: validate (alive,
 * cooldown, target, range, MP), pay, then run the data-defined effect.
 */
export class SkillSystem {
  constructor(
    private readonly events: EventBus<GameEvents>,
    private readonly combat: CombatSystem,
    private readonly statuses: StatusSystem,
    private readonly projectiles: ProjectileSystem,
  ) {}

  cooldownRemaining(caster: CombatEntity, skillId: SkillId, now: number): number {
    return Math.max(0, (caster.combat.cooldowns.get(skillId) ?? 0) - now);
  }

  check(caster: CombatEntity, skill: SkillDef, target: CombatEntity | null, now: number): SkillFailReason | null {
    const c = caster.combat;
    if (c.dead) return 'dead';
    if ((c.cooldowns.get(skill.id as SkillId) ?? 0) > now) return 'cooldown';
    if (skill.target === 'enemy') {
      if (!target || target.combat.dead || target.combat.team === c.team) return 'no_target';
      if (reach(caster, target) > skill.range) return 'out_of_range';
    }
    if (c.mp < skill.mpCost) return 'no_mp';
    return null;
  }

  use(caster: CombatEntity, skillId: SkillId, now: number, options: CastOptions = {}): SkillResult {
    const skill = SKILLS[skillId];
    const target = this.validTarget(caster, options.target ?? null);
    const reason = this.check(caster, skill, target, now);
    if (reason) {
      if (!options.quiet) this.events.emit('skillFailed', { caster, skill, reason });
      return { ok: false, reason };
    }

    caster.combat.mp -= skill.mpCost;
    caster.combat.cooldowns.set(skillId, now + skill.cooldown);
    this.events.emit('skillUsed', { caster, skill, target });
    this.execute(caster, skill, target, options.aim, now);
    return { ok: true };
  }

  private validTarget(caster: CombatEntity, target: CombatEntity | null): CombatEntity | null {
    if (!target || target.combat.dead || target.combat.team === caster.combat.team) return null;
    return target;
  }

  private execute(
    caster: CombatEntity,
    skill: SkillDef,
    target: CombatEntity | null,
    aim: Point | undefined,
    now: number,
  ): void {
    const effect = skill.effect;
    switch (effect.kind) {
      case 'damage':
        if (target) this.combat.dealDamage(caster, target, skill, effect.power);
        break;
      case 'projectile': {
        const dir = target
          ? { x: target.x - caster.x, y: target.y - caster.y }
          : (aim ?? { x: 0, y: 1 });
        this.projectiles.spawn(
          caster,
          skill,
          { ...effect, maxDistance: skill.range },
          dir.x,
          dir.y,
        );
        break;
      }
      case 'status':
        this.statuses.apply(caster, STATUSES[effect.statusId], effect.duration, now);
        break;
      case 'heal':
        this.combat.heal(caster, effect.amount);
        break;
    }
  }
}
