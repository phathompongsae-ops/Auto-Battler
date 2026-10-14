import type { EventBus } from '../core/EventBus';
import type { OnHitStatus, SkillId } from '../data/skillData';
import type { GameEvents } from '../game/GameEvents';
import type { CombatSystem } from './CombatSystem';
import type { StatusSystem } from './StatusSystem';
import type { CombatEntity } from './types';

/** One lingering ground area (Frost Storm). Pure data; the renderer reads it through events. */
export interface GroundZone {
  id: number;
  caster: CombatEntity;
  skillId: SkillId;
  x: number;
  y: number;
  radius: number;
  power: number;
  tickMs: number;
  ticks: number;
  /** Ticks resolved so far. */
  applied: number;
  /** Game time of the next tick. */
  nextAt: number;
  onHit: OnHitStatus | null;
}

export interface ZoneSpec {
  x: number;
  y: number;
  radius: number;
  power: number;
  durationMs: number;
  tickMs: number;
  onHit?: OnHitStatus;
}

/** Hard cap on zones alive at once (a cast beyond it replaces the caster's oldest). */
const MAX_ZONES = 8;

/**
 * Lingering areas owned by their caster. Ticks are on a fixed game-clock
 * schedule (start + n x tickMs, n = 1..ticks) and each one is resolved once,
 * however long the frame, so a zone deals exactly `ticks` hits per enemy that
 * stays inside. Who is inside is decided per tick from real positions. Every
 * tick goes through the normal damage path (kill, loot and quest credit).
 * Zones end when their ticks are done, when the caster dies, or on clear()
 * (map change, encounter reset).
 */
export class GroundZoneSystem {
  readonly active: GroundZone[] = [];
  private nextId = 1;

  constructor(
    private readonly events: EventBus<GameEvents>,
    private readonly combat: CombatSystem,
    private readonly statuses: StatusSystem,
  ) {}

  start(caster: CombatEntity, skillId: SkillId, spec: ZoneSpec, now: number): GroundZone {
    const ticks = Math.max(1, Math.floor(spec.durationMs / spec.tickMs));
    if (this.active.length >= MAX_ZONES) {
      const oldest = this.active.findIndex((z) => z.caster === caster);
      this.end(oldest >= 0 ? oldest : 0, 'cleared');
    }
    const zone: GroundZone = {
      id: this.nextId++,
      caster,
      skillId,
      x: spec.x,
      y: spec.y,
      radius: spec.radius,
      power: spec.power,
      tickMs: spec.tickMs,
      ticks,
      applied: 0,
      nextAt: now + spec.tickMs,
      onHit: spec.onHit ?? null,
    };
    this.active.push(zone);
    this.events.emit('zoneStarted', {
      zoneId: zone.id,
      casterId: caster.id,
      skillId,
      x: zone.x,
      y: zone.y,
      radius: zone.radius,
      durationMs: ticks * spec.tickMs,
      tickMs: spec.tickMs,
      ticks,
    });
    return zone;
  }

  update(now: number, entities: readonly CombatEntity[]): void {
    for (let i = this.active.length - 1; i >= 0; i--) {
      const zone = this.active[i];
      if (zone.caster.combat.dead) {
        this.end(i, 'cleared');
        continue;
      }
      while (zone.applied < zone.ticks && zone.nextAt <= now) {
        zone.applied++;
        zone.nextAt += zone.tickMs;
        this.tick(zone, entities, now);
        // A tick's events (a kill) may have cleared every zone.
        if (this.active[i] !== zone) break;
      }
      if (this.active[i] === zone && zone.applied >= zone.ticks) this.end(i, 'done');
    }
  }

  clear(): void {
    for (let i = this.active.length - 1; i >= 0; i--) this.end(i, 'cleared');
  }

  /** Living enemies of the zone's caster whose edge is inside it right now. */
  inside(zone: GroundZone, entities: readonly CombatEntity[]): CombatEntity[] {
    return entities.filter(
      (e) => !e.combat.dead && e.combat.team !== zone.caster.combat.team && Math.hypot(e.x - zone.x, e.y - zone.y) - e.hitRadius <= zone.radius,
    );
  }

  private tick(zone: GroundZone, entities: readonly CombatEntity[], now: number): void {
    const targets = this.inside(zone, entities);
    for (const target of targets) {
      const result = this.combat.dealDamage(zone.caster, target, zone.skillId, zone.power, { delivery: 'area' });
      if (result?.hit && zone.onHit && !target.combat.dead) this.statuses.apply(target, zone.onHit.statusId, zone.onHit.duration, now);
    }
    this.events.emit('zoneTick', { zoneId: zone.id, tick: zone.applied, hits: targets.length });
  }

  private end(index: number, reason: 'done' | 'cleared'): void {
    const [zone] = this.active.splice(index, 1);
    if (zone) this.events.emit('zoneEnded', { zoneId: zone.id, reason });
  }
}
