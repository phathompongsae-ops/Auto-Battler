import type { SkillId } from './skillData';
import type { VfxId } from './vfxArt';

/*
 * Which production strips present a skill (data/vfxArt.ts). Presentation only:
 * every strip is started by a simulation event (projectileSpawned, damage,
 * areaLanded, zoneStarted, skillWindup) and never changes timing, range or
 * damage. Skills not listed keep the shared hit / slash effects.
 */
export interface SkillVfx {
  /** Looping strip drawn along the projectile's flight. */
  projectile?: { vfx: VfxId; scale?: number };
  /** Played on each target the skill damages directly (not on area / splash / Burn hits). */
  impact?: { vfx: VfxId; scale?: number };
  /** Played once where an area lands, fitted to its real radius (replaces the per-target impact). */
  area?: { vfx: VfxId };
  /** Ring drawn at the projectile's impact showing its splash radius. */
  splashColor?: number;
  /** Lingering zone: looping strip plus a soft ground field in this colour, both at the real radius. */
  zone?: { vfx: VfxId; field: number };
  /** Delayed ground strike: the falling strip, timed to end as the area lands. */
  fall?: { vfx: VfxId };
}

export const SKILL_VFX: Partial<Record<SkillId, SkillVfx>> = {
  fire_bolt: { projectile: { vfx: 'fire_bolt' }, impact: { vfx: 'fire_bolt_impact' } },
  magic_bolt: { projectile: { vfx: 'magic_bolt' }, impact: { vfx: 'magic_bolt_impact' } },
  // Reuses the approved Fire Bolt projectile / impact, larger, with a splash ring.
  fireball: { projectile: { vfx: 'fire_bolt', scale: 1.25 }, impact: { vfx: 'fire_bolt_impact', scale: 1.35 }, splashColor: 0xff9e3d },
  flame_burst: { area: { vfx: 'flame_burst' } },
  frost_nova: { area: { vfx: 'frost_nova' } },
  frost_storm: { zone: { vfx: 'frost_storm', field: 0x7fd4ff } },
  meteor_burst: { fall: { vfx: 'meteor_fall' }, area: { vfx: 'meteor_impact' } },
};
