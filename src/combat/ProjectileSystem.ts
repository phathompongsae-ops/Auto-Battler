import type { EventBus } from '../core/EventBus';
import type { OnHitStatus, ProjectileSplash, SkillId } from '../data/skillData';
import type { GameEvents, ProjectileEndReason } from '../game/GameEvents';
import type { CombatSystem } from './CombatSystem';
import type { StatusSystem } from './StatusSystem';
import type { CombatEntity } from './types';

export interface Projectile {
  id: number;
  owner: CombatEntity;
  skillId: SkillId;
  power: number;
  x: number;
  y: number;
  dirX: number;
  dirY: number;
  speed: number;
  radius: number;
  color: number;
  traveled: number;
  maxDistance: number;
  /** Homing: steers toward this target while it lives (null = straight line). */
  target: CombatEntity | null;
  splash: ProjectileSplash | null;
  onHit: OnHitStatus | null;
}

export interface ProjectileSpec {
  power: number;
  speed: number;
  radius: number;
  color: number;
  maxDistance: number;
  /** Steer toward `target` while it lives. */
  homing?: boolean;
  splash?: ProjectileSplash;
  onHit?: OnHitStatus;
}

/** Answers whether a world position stops projectiles (walls, map edge). */
export interface ProjectileWorld {
  blocksProjectile(x: number, y: number): boolean;
}

/**
 * Moves projectiles and resolves hits. Projectile objects are pooled; the
 * renderer only reads them.
 */
export class ProjectileSystem {
  readonly active: Projectile[] = [];
  private readonly pool: Projectile[] = [];
  private nextId = 1;

  constructor(
    private readonly events: EventBus<GameEvents>,
    private readonly combat: CombatSystem,
    /** Applies on-hit statuses (Burn, Slow); without it projectiles only deal damage. */
    private readonly statuses?: StatusSystem,
  ) {}

  spawn(owner: CombatEntity, skillId: SkillId, spec: ProjectileSpec, dirX: number, dirY: number, target: CombatEntity | null = null): Projectile {
    const len = Math.hypot(dirX, dirY) || 1;
    const p = this.pool.pop() ?? ({} as Projectile);
    p.id = this.nextId++;
    p.owner = owner;
    p.skillId = skillId;
    p.power = spec.power;
    p.dirX = dirX / len;
    p.dirY = dirY / len;
    p.x = owner.x + p.dirX * owner.hitRadius;
    p.y = owner.y + p.dirY * owner.hitRadius;
    p.speed = spec.speed;
    p.radius = spec.radius;
    p.color = spec.color;
    p.traveled = 0;
    p.maxDistance = spec.maxDistance;
    p.target = spec.homing ? target : null;
    p.splash = spec.splash ?? null;
    p.onHit = spec.onHit ?? null;
    this.active.push(p);
    this.events.emit('projectileSpawned', {
      projectileId: p.id,
      ownerId: owner.id,
      skillId,
      x: p.x,
      y: p.y,
      radius: p.radius,
      color: p.color,
    });
    return p;
  }

  update(dtMs: number, targets: readonly CombatEntity[], world: ProjectileWorld): void {
    for (let i = this.active.length - 1; i >= 0; i--) {
      const p = this.active[i];
      const travel = (p.speed * dtMs) / 1000;
      // Sub-step so fast projectiles can't skip over small targets.
      const steps = Math.max(1, Math.ceil(travel / p.radius));
      const step = travel / steps;
      let removed = false;

      for (let s = 0; s < steps && !removed; s++) {
        if (p.target) this.steer(p);
        p.x += p.dirX * step;
        p.y += p.dirY * step;
        p.traveled += step;

        const hit = this.findHit(p, targets);
        if (hit) {
          this.impact(p, hit, targets);
          this.remove(i, 'hit');
          removed = true;
        } else if (world.blocksProjectile(p.x, p.y)) {
          this.remove(i, 'wall');
          removed = true;
        } else if (p.traveled >= p.maxDistance) {
          this.remove(i, 'expired');
          removed = true;
        }
      }
    }
  }

  clear(): void {
    for (let i = this.active.length - 1; i >= 0; i--) this.remove(i, 'expired');
  }

  /** Homing: aim straight at the living target (it was valid and in range when cast); a dead one releases it. */
  private steer(p: Projectile): void {
    const t = p.target!;
    if (t.combat.dead) {
      p.target = null;
      return;
    }
    const dx = t.x - p.x;
    const dy = t.y - p.y;
    const len = Math.hypot(dx, dy);
    if (len < 1e-6) return;
    p.dirX = dx / len;
    p.dirY = dy / len;
  }

  /** The primary hit, its on-hit status, then the splash around the impact (every other enemy inside it). */
  private impact(p: Projectile, hit: CombatEntity, targets: readonly CombatEntity[]): void {
    const result = this.combat.dealDamage(p.owner, hit, p.skillId, p.power);
    if (result?.hit && p.onHit && !hit.combat.dead) this.applyStatus(p, hit, p.onHit);
    const splash = p.splash;
    if (!splash || splash.radius <= 0 || splash.power <= 0) return;
    for (const t of targets) {
      if (t === hit || t.combat.dead || t.combat.team === p.owner.combat.team) continue;
      if (Math.hypot(t.x - p.x, t.y - p.y) - t.hitRadius > splash.radius) continue;
      this.combat.dealDamage(p.owner, t, p.skillId, p.power * splash.power, { delivery: 'splash' });
    }
  }

  private applyStatus(p: Projectile, target: CombatEntity, onHit: OnHitStatus): void {
    const from = onHit.magnitude !== undefined ? { source: p.owner, skillId: p.skillId, magnitude: onHit.magnitude } : undefined;
    this.statuses?.apply(target, onHit.statusId, onHit.duration, this.combat.now, from);
  }

  private findHit(p: Projectile, targets: readonly CombatEntity[]): CombatEntity | null {
    for (const t of targets) {
      if (t.combat.dead || t.combat.team === p.owner.combat.team) continue;
      if (Math.hypot(t.x - p.x, t.y - p.y) <= p.radius + t.hitRadius) return t;
    }
    return null;
  }

  private remove(index: number, reason: ProjectileEndReason): void {
    const p = this.active[index];
    this.active[index] = this.active[this.active.length - 1];
    this.active.pop();
    this.events.emit('projectileRemoved', {
      projectileId: p.id,
      skillId: p.skillId,
      reason,
      x: p.x,
      y: p.y,
      color: p.color,
    });
    // Drop references so a pooled projectile never keeps a removed monster alive.
    p.target = null;
    this.pool.push(p);
  }
}
