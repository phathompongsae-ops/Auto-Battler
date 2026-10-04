import type { EventBus } from '../core/EventBus';
import { distance, type Point } from '../core/math';
import { SKILLS, type OnHitStatus, type SkillDef, type SkillId } from '../data/skillData';
import type { GameEvents } from '../game/GameEvents';
import { MAX_SKILL_COOLDOWN_REDUCTION } from '../data/combatRules';
import { effectiveHeal } from '../stats/castAndHeal';
import { attackInterval } from './attackSpeed';
import type { CombatSystem } from './CombatSystem';
import type { ProjectileSystem } from './ProjectileSystem';
import type { StatusSystem } from './StatusSystem';
import type { CombatEntity } from './types';

export type HitCancelReason = 'moved' | 'out_of_range' | 'dead';

/** not_learned: the caster can't use this skill (e.g. a skill-tree skill at rank 0). */
export type SkillFailReason = 'dead' | 'cooldown' | 'no_target' | 'out_of_range' | 'no_mp' | 'not_learned';

export type SkillResult = { ok: true } | { ok: false; reason: SkillFailReason };

export interface CastOptions {
  target?: CombatEntity | null;
  /** Direction for 'enemy_or_direction' skills when there is no target. */
  aim?: Point;
  /** Don't emit skillFailed (used for held/auto-repeat input and AI). */
  quiet?: boolean;
}

/** World hooks some skill effects need. Defaults keep monsters and tests working without them. */
export interface SkillWorld {
  /**
   * The caster's version of a skill (e.g. its learned skill-tree rank), or
   * null when the caster can't use it. Default: the static definition.
   */
  resolve?: (caster: CombatEntity, skillId: SkillId) => SkillDef | null;
  /** Everyone who can be hit by area effects. */
  entities?: () => readonly CombatEntity[];
  /** Move the caster up to `maxDistance` toward `target`, never through walls. */
  dash?: (caster: CombatEntity, target: CombatEntity, maxDistance: number) => void;
}

/** Distance from the caster's centre to the target's edge. */
export function reach(caster: CombatEntity, target: CombatEntity): number {
  return distance(caster, target) - target.hitRadius;
}

interface PendingHit {
  caster: CombatEntity;
  target: CombatEntity;
  skillId: SkillId;
  /** The definition used when cast (rank numbers included). */
  skill: SkillDef;
  power: number;
  critBonus: number;
  onHit?: OnHitStatus;
  at: number;
}

/**
 * One code path for every skill, player or monster: validate (learned,
 * alive, cooldown, target, range, MP), pay, then run the data-defined effect.
 */
export class SkillSystem {
  /** Melee hits waiting for their wind-up (see SkillDef.windup). */
  private readonly pending: PendingHit[] = [];

  constructor(
    private readonly events: EventBus<GameEvents>,
    private readonly combat: CombatSystem,
    private readonly statuses: StatusSystem,
    private readonly projectiles: ProjectileSystem,
    private readonly world: SkillWorld = {},
  ) {}

  /** The caster's definition of a skill, or null if it can't use it. */
  definition(caster: CombatEntity, skillId: SkillId): SkillDef | null {
    return this.world.resolve ? this.world.resolve(caster, skillId) : SKILLS[skillId];
  }

  /**
   * Cooldown a use of this skill starts. Basic attacks (usesAttackSpeed) use
   * their cooldown as the base attack interval, shortened by the caster's ASPD;
   * every other skill keeps its configured (rank) cooldown.
   */
  cooldownDuration(caster: CombatEntity, skillId: SkillId): number {
    const skill = this.definition(caster, skillId) ?? SKILLS[skillId];
    if (skill.usesAttackSpeed) return attackInterval(skill.cooldown, caster.combat.stats.attackSpeed);
    const reduction = Math.min(MAX_SKILL_COOLDOWN_REDUCTION, Math.max(0, caster.combat.stats.skillCooldownReduction[skillId] ?? 0));
    return skill.cooldown * (1 - reduction);
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
    const skill = this.definition(caster, skillId);
    if (!skill) {
      if (!options.quiet) this.events.emit('skillFailed', { casterId: caster.id, skillId, reason: 'not_learned' });
      return { ok: false, reason: 'not_learned' };
    }
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
      if (hit.caster.combat.dead || hit.target.combat.dead) this.cancelled(hit, 'dead');
      else if (hit.skill.windup?.recheckRange && reach(hit.caster, hit.target) > hit.skill.range) this.cancelled(hit, 'out_of_range');
      else this.strike(hit.caster, hit.target, hit.skillId, hit.power, hit.critBonus, hit.onHit, now);
    }
  }

  /**
   * The caster moved: drop its pending hits whose skill cancels on movement.
   * Hits that already landed are unaffected; nothing is refunded.
   */
  interruptMovement(caster: CombatEntity): void {
    for (let i = this.pending.length - 1; i >= 0; i--) {
      const hit = this.pending[i];
      if (hit.caster !== caster || !hit.skill.windup?.cancelOnMove) continue;
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

  /** One damaging hit; its on-hit status (e.g. a stun) applies only if the hit lands. */
  private strike(caster: CombatEntity, target: CombatEntity, skillId: SkillId, power: number, critBonus: number, onHit: OnHitStatus | undefined, now: number): void {
    const result = this.combat.dealDamage(caster, target, skillId, power, { critBonus });
    if (result?.hit && onHit && !target.combat.dead) this.statuses.apply(target, onHit.statusId, onHit.duration, now);
  }

  /** Living enemies of the caster whose edge is within `radius` px. */
  private enemiesAround(caster: CombatEntity, radius: number): CombatEntity[] {
    return (this.world.entities?.() ?? []).filter(
      (e) => e !== caster && !e.combat.dead && e.combat.team !== caster.combat.team && reach(caster, e) <= radius,
    );
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
      case 'damage': {
        if (!target) break;
        const critBonus = effect.critBonus ?? 0;
        if (skill.windup) {
          this.pending.push({ caster, target, skillId, skill, power: effect.power, critBonus, onHit: effect.onHit, at: now + skill.windup.ms });
        } else this.strike(caster, target, skillId, effect.power, critBonus, effect.onHit, now);
        break;
      }
      case 'aoe_damage':
        for (const enemy of this.enemiesAround(caster, effect.radius)) this.strike(caster, enemy, skillId, effect.power, 0, undefined, now);
        break;
      case 'taunt':
        for (const enemy of this.enemiesAround(caster, effect.radius)) {
          this.statuses.apply(enemy, effect.statusId, effect.duration, now);
          this.events.emit('taunted', { casterId: caster.id, targetId: enemy.id });
        }
        break;
      case 'dash_strike':
        if (!target) break;
        this.world.dash?.(caster, target, effect.distance);
        this.strike(caster, target, skillId, effect.power, 0, effect.onHit, now);
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
