import type { CombatWorld } from '../game/CombatWorld';
import type { Monster } from '../entities/Monster';

/*
 * Monster motion (Visual Production Pass 3): the presentation layer that keeps
 * production monster art from sliding like stickers. Every pose is driven by
 * the simulation (velocity, wind-up, damage events) and applied through
 * Monster.setPose, which never moves the physics body; timing, ranges and
 * damage stay with the combat systems.
 *
 *   walk    a step cycle whose cadence follows the real speed: a small bob and
 *           a side-to-side lean about the feet (heavier tiers bob less, step slower)
 *   wind-up a lean back away from the target for as long as the telegraph runs
 *   attack  a short lunge toward the target on the hit's own damage event
 *   hit     a small recoil away from the attacker (with the existing hit flash)
 *   death   unchanged: the code squash and fade (Monster.onDeath)
 *
 * Fallback only (Visual Pass 4): monsters drawn with real animation strips
 * (Monster.strips, rendering/MonsterAnimator.ts) get no procedural pose, so the
 * drawn walk / attack / hit is never doubled. Hit flash and shadow are unaffected.
 */

/** Below this speed (world px / s) a monster is standing. */
const MOVING = 6;
const LUNGE_MS = { out: 80, back: 170 };
const RECOIL_MS = { out: 60, back: 140 };

interface Kick {
  start: number;
  dx: number;
  dy: number;
  out: number;
  back: number;
}

interface MotionState {
  actor: Monster;
  phase: number;
  /** 0..1 eased in and out so starting and stopping never snap. */
  stride: number;
  windup: number;
  lunge: Kick | null;
  recoil: Kick | null;
}

/** Offset of a there-and-back kick at time t (0 outside it). */
function kickAt(k: Kick | null, t: number): number {
  if (!k) return 0;
  const e = t - k.start;
  if (e < 0 || e > k.out + k.back) return 0;
  return e < k.out ? e / k.out : 1 - (e - k.out) / k.back;
}

export class MonsterMotion {
  private readonly states = new Map<string, MotionState>();
  /** Presentation clock (ms); real time, so hit stop never freezes the poses mid-swing. */
  private clock = 0;

  constructor(private readonly world: CombatWorld) {
    world.events.on('mapChanged', () => this.states.clear());
    world.events.on('respawn', ({ entityId }) => this.states.delete(entityId));
    world.events.on('miss', ({ sourceId, targetId }) => this.attack(sourceId, targetId));
    world.events.on('damage', ({ sourceId, targetId }) => {
      const source = world.getEntity(sourceId);
      const target = world.getEntity(targetId);
      if (!source || !target) return;
      const ux = target.x - source.x, uy = target.y - source.y;
      const len = Math.hypot(ux, uy) || 1;
      this.attack(sourceId, targetId);
      const victim = world.monsterById(targetId);
      if (victim && !victim.strips) {
        // Heavier tiers barely budge.
        const push = 3 / Math.sqrt(victim.def.scale ?? 1);
        this.state(victim).recoil = { start: this.clock, dx: (ux / len) * push, dy: (uy / len) * push, ...RECOIL_MS };
      }
    });
  }

  private attack(sourceId: string, targetId: string): void {
    const attacker = this.world.monsterById(sourceId);
    const target = this.world.getEntity(targetId);
    if (!attacker || !target || attacker.strips) return;
    const dx = target.x - attacker.x, dy = target.y - attacker.y;
    const length = Math.hypot(dx, dy) || 1;
    const distance = Math.min(7, 5 * Math.sqrt(attacker.def.scale ?? 1));
    this.state(attacker).lunge = { start: this.clock, dx: dx / length * distance, dy: dy / length * distance, ...LUNGE_MS };
  }

  private state(actor: Monster): MotionState {
    let s = this.states.get(actor.id);
    if (!s || s.actor !== actor) this.states.set(actor.id, (s = { actor, phase: Math.random() * Math.PI, stride: 0, windup: 0, lunge: null, recoil: null }));
    return s;
  }

  update(deltaMs: number): void {
    this.clock += deltaMs;
    const dt = Math.min(deltaMs, 50) / 1000;
    for (const m of this.world.monsters) {
      if (m.combat.dead || !m.visible || m.strips) { this.states.delete(m.id); continue; }
      this.pose(m, this.state(m), dt);
    }
  }

  private pose(m: Monster, s: MotionState, dt: number): void {
    const k = m.def.scale ?? 1;
    const heavy = k >= 2;
    const speed = Math.hypot(m.body.velocity.x, m.body.velocity.y);
    // Ease the stride in / out (~0.15 s) so a stop settles instead of freezing mid-step.
    s.stride += ((speed > MOVING ? 1 : 0) - s.stride) * Math.min(1, dt * 7);
    // Steps per second follow the real speed and the body size (big bodies take slower, longer steps).
    s.phase += dt * Math.PI * Math.max(2.2, speed / (9 * Math.sqrt(k)));
    const bob = Math.abs(Math.sin(s.phase)) * (heavy ? 1.2 : 1.8) * Math.sqrt(k) * s.stride;
    let rotation = Math.sin(s.phase) * (heavy ? 0.035 : 0.06) * s.stride;

    // Wind-up: lean back from the target while the telegraph runs, released on the hit.
    const winding = this.world.skills.windingUp(m) ? 1 : 0;
    s.windup += (winding - s.windup) * Math.min(1, dt * (winding ? 6 : 14));
    const target = this.world.player;
    const away = target.x >= m.x ? -1 : 1;
    rotation += away * 0.09 * s.windup;

    const lunge = kickAt(s.lunge, this.clock);
    const recoil = kickAt(s.recoil, this.clock);
    if (s.lunge && this.clock >= s.lunge.start + s.lunge.out + s.lunge.back) s.lunge = null;
    if (s.recoil && this.clock >= s.recoil.start + s.recoil.out + s.recoil.back) s.recoil = null;
    const dx = (s.lunge?.dx ?? 0) * lunge + (s.recoil?.dx ?? 0) * recoil;
    const dy = -bob - 1.5 * Math.sqrt(k) * s.windup + 0.5 * ((s.lunge?.dy ?? 0) * lunge + (s.recoil?.dy ?? 0) * recoil);
    m.setPose(dx, dy, rotation);
  }
}
