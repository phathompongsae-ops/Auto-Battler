import type { EventBus } from '../core/EventBus';
import { distance, type Point } from '../core/math';
import { SKILLS, type OnHitStatus, type SkillDef, type SkillId } from '../data/skillData';
import type { GameEvents } from '../game/GameEvents';
import { MAX_MP_COST_REDUCTION, MAX_SKILL_COOLDOWN_REDUCTION } from '../data/combatRules';
import { effectiveHeal } from '../stats/castAndHeal';
import { attackInterval } from './attackSpeed';
import type { CombatSystem } from './CombatSystem';
import { GroundZoneSystem } from './GroundZoneSystem';
import type { ProjectileSystem } from './ProjectileSystem';
import type { StatusSystem } from './StatusSystem';
import type { CombatEntity } from './types';

export type HitCancelReason = 'moved' | 'out_of_range' | 'dead';

/** not_learned: the caster can't use this skill (e.g. a skill-tree skill at rank 0). */
export type SkillFailReason = 'dead' | 'cooldown' | 'no_target' | 'out_of_range' | 'no_mp' | 'not_learned';

export type SkillResult = { ok: true } | { ok: false; reason: SkillFailReason };

/**
 * A homing projectile cast at a target may chase it this far past the skill's
 * range (the target keeps moving after the cast was validated).
 */
export const HOMING_RANGE_SLACK = 48;

export interface CastOptions {
  target?: CombatEntity | null;
  /** Direction for 'enemy_or_direction' skills when there is no target. */
  aim?: Point;
  /** Don't emit skillFailed (used for held/auto-repeat input and AI). */
  quiet?: boolean;
}

/** World hooks some skill effects need. Defaults keep monsters and tests working without them. */
export interface SkillWorld {
  /** Presentation action duration used only to guard utility actions; no change to skill balance. */
  actionDuration?: (caster: CombatEntity, skillId: SkillId) => number;
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
 * An area hit waiting for its wind-up: it strikes whoever is inside the radius when it lands. Around the caster
 * (wherever it is then), or around a fixed ground point chosen at cast (target_area).
 */
interface PendingArea {
  caster: CombatEntity;
  skillId: SkillId;
  power: number;
  radius: number;
  point: Point | null;
  onHit?: OnHitStatus;
  at: number;
}

/** A projectile or ground zone released on its wind-up's frame (the caster's release pose). */
interface PendingRelease {
  caster: CombatEntity;
  at: number;
  run: (now: number) => void;
}

/**
 * One code path for every skill, player or monster: validate (learned,
 * alive, cooldown, target, range, MP), pay, then run the data-defined effect.
 */
export class SkillSystem {
  /** Lingering ground areas (Frost Storm). */
  readonly zones: GroundZoneSystem;
  /** Melee hits waiting for their wind-up (see SkillDef.windup). */
  private readonly pending: PendingHit[] = [];
  /** Area hits waiting for their wind-up (telegraphed elite / boss attacks, Meteor Burst). */
  private readonly pendingAreas: PendingArea[] = [];
  /** Projectiles / zones waiting for their release frame. */
  private readonly pendingReleases: PendingRelease[] = [];

  constructor(
    private readonly events: EventBus<GameEvents>,
    private readonly combat: CombatSystem,
    private readonly statuses: StatusSystem,
    private readonly projectiles: ProjectileSystem,
    private readonly world: SkillWorld = {},
  ) {
    this.zones = new GroundZoneSystem(events, combat, statuses);
  }

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

  /** MP this caster pays for a skill: its cost less the caster's MP cost reduction (Mana Flow), rounded. */
  mpCost(caster: CombatEntity, skill: SkillDef): number {
    const reduction = Math.min(MAX_MP_COST_REDUCTION, Math.max(0, caster.combat.stats.mpCostReduction ?? 0));
    return reduction > 0 ? Math.round(skill.mpCost * (1 - reduction)) : skill.mpCost;
  }

  check(caster: CombatEntity, skill: SkillDef, target: CombatEntity | null, now: number): SkillFailReason | null {
    const c = caster.combat;
    if (c.dead) return 'dead';
    if ((c.cooldowns.get(skill.id as SkillId) ?? 0) > now) return 'cooldown';
    if (skill.target === 'enemy') {
      if (!target || target.combat.dead || target.combat.team === c.team) return 'no_target';
      if (reach(caster, target) > skill.range) return 'out_of_range';
    }
    if (c.mp < this.mpCost(caster, skill)) return 'no_mp';
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

    caster.combat.mp -= this.mpCost(caster, skill);
    caster.combat.actionLockedUntil = Math.max(caster.combat.actionLockedUntil, now + Math.max(skill.windup?.ms ?? 0, this.world.actionDuration?.(caster, skillId) ?? 0));
    caster.combat.cooldowns.set(skillId, now + this.cooldownDuration(caster, skillId));
    this.events.emit('skillUsed', { casterId: caster.id, skillId, targetId: target?.id ?? null });
    this.execute(caster, skillId, skill, target, options.aim, now);
    return { ok: true };
  }

  /**
   * Land wind-up hits that are due. A hit is lost if either side died, or if
   * its skill rechecks range and the target is now out of reach. Then release
   * due projectiles / zones and tick the ground zones.
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
    for (let i = this.pendingAreas.length - 1; i >= 0; i--) {
      const area = this.pendingAreas[i];
      if (area.at > now) continue;
      this.pendingAreas.splice(i, 1);
      if (area.caster.combat.dead) continue;
      this.landArea(area.caster, area.skillId, area.point ?? area.caster, area.radius, area.power, area.onHit, now);
    }
    for (let i = this.pendingReleases.length - 1; i >= 0; i--) {
      const release = this.pendingReleases[i];
      if (release.at > now) continue;
      this.pendingReleases.splice(i, 1);
      if (!release.caster.combat.dead) release.run(now);
    }
    this.zones.update(now, this.world.entities?.() ?? []);
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

  /** Drop every pending hit, release and ground zone (world reset, map change). */
  clear(): void {
    this.pending.length = 0;
    this.pendingAreas.length = 0;
    this.pendingReleases.length = 0;
    this.zones.clear();
  }

  /** The caster has a wind-up in progress (telegraphed attacks root the monster until they land). */
  windingUp(caster: CombatEntity): boolean {
    return this.pending.some((h) => h.caster === caster) || this.pendingAreas.some((a) => a.caster === caster) || this.pendingReleases.some((r) => r.caster === caster);
  }

  /** Wind-up hits (single-target and area) not landed yet. */
  pendingCount(): number {
    return this.pending.length + this.pendingAreas.length + this.pendingReleases.length;
  }

  private validTarget(caster: CombatEntity, target: CombatEntity | null): CombatEntity | null {
    if (!target || target.combat.dead || target.combat.team === caster.combat.team) return null;
    return target;
  }

  /** One damaging hit; its on-hit status (e.g. a stun) applies only if the hit lands. */
  private strike(caster: CombatEntity, target: CombatEntity, skillId: SkillId, power: number, critBonus: number, onHit: OnHitStatus | undefined, now: number, area = false): void {
    const result = this.combat.dealDamage(caster, target, skillId, power, area ? { critBonus, delivery: 'area' } : { critBonus });
    if (result?.hit && onHit && !target.combat.dead) this.applyStatus(caster, target, skillId, onHit, now);
  }

  /** A status from one of the caster's hits; a damage-over-time one ticks at the hit's magnitude, for the caster. */
  private applyStatus(caster: CombatEntity, target: CombatEntity, skillId: SkillId, onHit: OnHitStatus, now: number): void {
    const from = onHit.magnitude !== undefined ? { source: caster, skillId, magnitude: onHit.magnitude } : undefined;
    this.statuses.apply(target, onHit.statusId, onHit.duration, now, from);
  }

  private windup(caster: CombatEntity, skillId: SkillId, target: CombatEntity | null, radius: number | null, ms: number, point?: Point): void {
    this.events.emit('skillWindup', { casterId: caster.id, skillId, targetId: target?.id ?? null, radius, ms, ...(point ? { x: point.x, y: point.y } : {}) });
  }

  /** Living enemies of the caster whose edge is within `radius` px of `center`. */
  private enemiesWithin(caster: CombatEntity, center: Point, radius: number): CombatEntity[] {
    return (this.world.entities?.() ?? []).filter(
      (e) => e !== caster && !e.combat.dead && e.combat.team !== caster.combat.team && distance(center, e) - e.hitRadius <= radius,
    );
  }

  /** Resolve an area: one hit on every enemy inside it now, then report where it landed. */
  private landArea(caster: CombatEntity, skillId: SkillId, center: Point, radius: number, power: number, onHit: OnHitStatus | undefined, now: number): void {
    const at = { x: center.x, y: center.y };
    const enemies = this.enemiesWithin(caster, at, radius);
    for (const enemy of enemies) this.strike(caster, enemy, skillId, power, 0, onHit, now, true);
    this.events.emit('areaLanded', { casterId: caster.id, skillId, x: at.x, y: at.y, radius, hits: enemies.length });
  }

  /** Where a ground-targeted skill lands: the target's position now, else `range` px along the aim. */
  private groundPoint(caster: CombatEntity, skill: SkillDef, target: CombatEntity | null, aim: Point | undefined): Point {
    if (target) return { x: target.x, y: target.y };
    const dir = aim ?? { x: 0, y: 1 };
    const len = Math.hypot(dir.x, dir.y) || 1;
    return { x: caster.x + (dir.x / len) * skill.range, y: caster.y + (dir.y / len) * skill.range };
  }

  /** Run now, or on the wind-up's release frame. */
  private release(caster: CombatEntity, skill: SkillDef, now: number, run: (now: number) => void): void {
    if (skill.windup) this.pendingReleases.push({ caster, at: now + skill.windup.ms, run });
    else run(now);
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
          this.windup(caster, skillId, target, null, skill.windup.ms);
          this.pending.push({ caster, target, skillId, skill, power: effect.power, critBonus, onHit: effect.onHit, at: now + skill.windup.ms });
        } else this.strike(caster, target, skillId, effect.power, critBonus, effect.onHit, now);
        break;
      }
      case 'aoe_damage':
        if (skill.windup) {
          this.windup(caster, skillId, null, effect.radius, skill.windup.ms);
          this.pendingAreas.push({ caster, skillId, power: effect.power, radius: effect.radius, point: null, onHit: effect.onHit, at: now + skill.windup.ms });
        } else this.landArea(caster, skillId, caster, effect.radius, effect.power, effect.onHit, now);
        break;
      case 'target_area': {
        // The point is fixed now: the target (or anyone else) can walk out before a wind-up lands.
        const point = this.groundPoint(caster, skill, target, aim);
        if (skill.windup) {
          this.windup(caster, skillId, target, effect.radius, skill.windup.ms, point);
          this.pendingAreas.push({ caster, skillId, power: effect.power, radius: effect.radius, point, onHit: effect.onHit, at: now + skill.windup.ms });
        } else this.landArea(caster, skillId, point, effect.radius, effect.power, effect.onHit, now);
        break;
      }
      case 'ground_zone': {
        const point = this.groundPoint(caster, skill, target, aim);
        this.release(caster, skill, now, (at) => this.zones.start(caster, skillId, { ...point, radius: effect.radius, power: effect.power, durationMs: effect.durationMs, tickMs: effect.tickMs, onHit: effect.onHit }, at));
        break;
      }
      case 'taunt':
        for (const enemy of this.enemiesWithin(caster, caster, effect.radius)) {
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
        const castDir = target ? { x: target.x - caster.x, y: target.y - caster.y } : (aim ?? { x: 0, y: 1 });
        // A homing shot at a target may follow it a little past the range checked at cast.
        const maxDistance = skill.range + (effect.homing && target ? HOMING_RANGE_SLACK : 0);
        this.release(caster, skill, now, () => {
          // Released later: aim at where the (living) target is now.
          const live = target && !target.combat.dead ? target : null;
          const dir = live ? { x: live.x - caster.x, y: live.y - caster.y } : castDir;
          this.projectiles.spawn(caster, skillId, { ...effect, maxDistance }, dir.x, dir.y, live);
        });
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
