/*
 * Production combat VFX strips (Visual Production Pass 2, from the reviewed
 * candidates; see tools/env-art/pass2-jobs.json). Presentation only: every
 * effect is started by an existing simulation event (hit frame, damage,
 * projectile) and never drives timing, range or damage. A strip that fails to
 * load keeps the code-drawn effect; `?vfxArt=off` forces the code-drawn set.
 */

export type VfxId = 'slash' | 'power_slash' | 'hit' | 'heavy_hit' | 'fire_bolt' | 'fire_bolt_impact';

export interface VfxArtDef {
  key: string;
  url: string;
  frameWidth: number;
  frameHeight: number;
  frames: number;
  /** World px per source px. */
  scale: number;
  /** One-shot effects: total playback time. Loops (projectiles): frames per second. */
  durationMs?: number;
  fps?: number;
}

const DIR = 'assets/vfx/combat';

export const VFX_ART: Readonly<Record<VfxId, VfxArtDef>> = {
  // Crescent sweeps; the arc spans most of the 128 px frame (~44 / ~56 world px at these scales).
  slash: { key: 'vfx-melee-slash', url: `${DIR}/melee_slash.png`, frameWidth: 128, frameHeight: 128, frames: 6, scale: 0.34, durationMs: 180 },
  power_slash: { key: 'vfx-power-slash', url: `${DIR}/power_slash.png`, frameWidth: 128, frameHeight: 128, frames: 6, scale: 0.44, durationMs: 220 },
  // Impact stars on the target (~30 / ~38 world px).
  hit: { key: 'vfx-hit-impact', url: `${DIR}/hit_impact.png`, frameWidth: 96, frameHeight: 96, frames: 6, scale: 0.32, durationMs: 200 },
  heavy_hit: { key: 'vfx-heavy-impact', url: `${DIR}/heavy_impact.png`, frameWidth: 96, frameHeight: 96, frames: 6, scale: 0.4, durationMs: 240 },
  // Projectile loop drawn along its travel direction (~22 world px long).
  fire_bolt: { key: 'vfx-fire-bolt', url: `${DIR}/fire_bolt.png`, frameWidth: 64, frameHeight: 64, frames: 4, scale: 0.36, fps: 14 },
  fire_bolt_impact: { key: 'vfx-fire-bolt-impact', url: `${DIR}/fire_bolt_impact.png`, frameWidth: 96, frameHeight: 96, frames: 6, scale: 0.36, durationMs: 260 },
};
