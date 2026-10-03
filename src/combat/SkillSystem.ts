import type { EventBus } from '../core/EventBus';
import { distance, type Point } from '../core/math';
import { SKILLS, type SkillDef, type SkillId } from '../data/skillData';
import type { GameEvents } from '../game/GameEvents';
import { effectiveHeal } from '../stats/castAndHeal';
import { attackInterval } from './attackSpeed';
import type { CombatSystem } from './CombatSystem';
import type { ProjectileSystem } from './ProjectileSystem';
import type { StatusSystem } from './StatusSystem';
import type { CombatEntity } from './types';

export type HitCancelReason = 'moved' | 'out_of_range' | 'dead';

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
interface PendingHit {
  caster: CombatEntity;
  target: CombatEntity;
  skillId: SkillId;
  power: number;
  at: number;
}

export class SkillSystem {
  /** Melee hits waiting for their wind-up (see SkillDef.windup). */
  private readonly pending: PendingHit[] = [];

  constructor(
    private readonly events: EventBus<GameEvents>,
    private readonly combat: CombatSystem,
    private readonly statuses: StatusSystem,
    private readonly projectiles: ProjectileSystem,
  ) {}

  /**
   * Cooldown a use of this skill starts. Basic attacks (usesAttackSpeed) use
   * their cooldown as the base attack interval, shortened by the caster's ASPD;
   * every other skill keeps its configured cooldown.
   */
  cooldownDuration(caster: CombatEntity, skillId: SkillId): number {
    const skill = SKILLS[skillId];
    return skill.usesAttackSpeed ? attackInterval(skill.cooldown, caster.combat.stats.attackSpeed) : skill.cooldown;
  }

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
      if (!options.quiet) this.events.emit('skillFailed', { casterId: caster.id, skillId, reason });
      return { ok: false, reason };
    }

    caster.combat.mp -= skill.mpCost;
    caster.combat.cooldowns.set(skillId, now + this.cooldownDuration(caster, skillId));
    this.events.emit('skillUsed', { casterId: caster.id, skillId, targetId: target?.id ?? null });
    this.execute(caster, skillId, skill, target, options.aim, now);
    return { ok: true };
  }

  /**
   * Land wind-up hits that are due. A hit is lost if either side died, or if
   * its skill rechecks range and the target is now out of reach.
   */
  update(now: number): void {
    for (let i = this.pending.length - 1; i >= 0; i--) {
      const hit = this.pending[i];
      if (hit.at > now) continue;
      this.pending.splice(i, 1);
      const skill = SKILLS[hit.skillId];
      if (hit.caster.combat.dead || hit.target.combat.dead) this.cancelled(hit, 'dead');
      else if (skill.windup?.recheckRange && reach(hit.caster, hit.target) > skill.range) this.cancelled(hit, 'out_of_range');
      else this.combat.dealDamage(hit.caster, hit.target, hit.skillId, hit.power);
    }
  }

  /**
   * The caster moved: drop its pending hits whose skill cancels on movement.
   * Hits that already landed are unaffected; nothing is refunded.
   */
  interruptMovement(caster: CombatEntity): void {
    for (let i = this.pending.length - 1; i >= 0; i--) {
      const hit = this.pending[i];
      if (hit.caster !== caster || !SKILLS[hit.skillId].windup?.cancelOnMove) continue;
      this.pending.splice(i, 1);
      this.cancelled(hit, 'moved');
    }
  }

  private cancelled(hit: PendingHit, reason: HitCancelReason): void {
    this.events.emit('hitCancelled', { casterId: hit.caster.id, targetId: hit.target.id, skillId: hit.skillId, reason });
  }

  /** Drop every pending hit (world reset). */
  clear(): void {
    this.pending.length = 0;
  }

  private validTarget(caster: CombatEntity, target: CombatEntity | null): CombatEntity | null {
    if (!target || target.combat.dead || target.combat.team === caster.combat.team) return null;
    return target;
  }

  private execute(
    caster: CombatEntity,
    skillId: SkillId,
    skill: SkillDef,
    target: CombatEntity | null,
    aim: Point | undefined,
    now: number,
  ): void {
    const effect = skill.effect;
    switch (effect.kind) {
      case 'damage':
        if (!target) break;
        if (skill.windup) this.pending.push({ caster, target, skillId, power: effect.power, at: now + skill.windup.ms });
        else this.combat.dealDamage(caster, target, skillId, effect.power);
        break;
      case 'projectile': {
        const dir = target
          ? { x: target.x - caster.x, y: target.y - caster.y }
          : (aim ?? { x: 0, y: 1 });
        this.projectiles.spawn(
          caster,
          skillId,
          { ...effect, maxDistance: skill.range },
          dir.x,
          dir.y,
        );
        break;
      }
      case 'status':
        this.statuses.apply(caster, effect.statusId, effect.duration, now);
        break;
      case 'heal':
        this.combat.heal(caster, effectiveHeal(effect.amount, caster.combat.stats.healPower));
        break;
    }
  }
}
