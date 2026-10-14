/*
 * Production combat VFX strips (Visual Production Pass 2, from the reviewed
 * candidates; see tools/env-art/pass2-jobs.json; Mage strips from the Mage art
 * handoff, docs/art/mage-codex-handoff.md). Presentation only: every effect is
 * started by an existing simulation event (hit frame, damage, projectile, area
 * landing, zone start) and never drives timing, range or damage. A strip that
 * fails to load keeps the code-drawn effect; `?vfxArt=off` forces the code-drawn set.
 */

export type VfxId =
  | 'slash'
  | 'power_slash'
  | 'hit'
  | 'heavy_hit'
  | 'fire_bolt'
  | 'fire_bolt_impact'
  | 'magic_bolt'
  | 'magic_bolt_impact'
  | 'flame_burst'
  | 'frost_nova'
  | 'frost_storm'
  | 'meteor_fall'
  | 'meteor_impact';

export interface VfxArtDef {
  key: string;
  url: string;
  frameWidth: number;
  frameHeight: number;
  frames: number;
  /** World px per source px. Ground effects with a `footprint` are scaled to their real radius instead. */
  scale: number;
  /** One-shot effects: total playback time. Loops (projectiles): frames per second. */
  durationMs?: number;
  fps?: number;
  /** Source px of the cell placed on the effect's position (default: the cell centre). */
  anchor?: { x: number; y: number };
  /**
   * Ground effects: source px width of the painted ground footprint (measured on the widest frame). Played at a
   * radius, the strip is scaled so this width spans the real diameter, so the art shows the true area.
   */
  footprint?: number;
  /** Additive blending (glow strips with no dark parts). Default: normal. */
  blend?: 'add';
}

const DIR = 'assets/vfx/combat';
const MAGE = 'assets/vfx/mage';

export const VFX_ART: Readonly<Record<VfxId, VfxArtDef>> = {
  // Crescent sweeps; the arc spans most of the 128 px frame (~44 / ~56 world px at these scales).
  slash: { key: 'vfx-melee-slash', url: `${DIR}/melee_slash.png`, frameWidth: 128, frameHeight: 128, frames: 6, scale: 0.34, durationMs: 180 },
  power_slash: { key: 'vfx-power-slash', url: `${DIR}/power_slash.png`, frameWidth: 128, frameHeight: 128, frames: 6, scale: 0.44, durationMs: 220 },
  // Impact stars on the target (~30 / ~38 world px).
  hit: { key: 'vfx-hit-impact', url: `${DIR}/hit_impact.png`, frameWidth: 96, frameHeight: 96, frames: 6, scale: 0.32, durationMs: 200 },
  heavy_hit: { key: 'vfx-heavy-impact', url: `${DIR}/heavy_impact.png`, frameWidth: 96, frameHeight: 96, frames: 6, scale: 0.4, durationMs: 240 },
  // Projectile loop drawn along its travel direction (~22 world px long). Fireball reuses it larger.
  fire_bolt: { key: 'vfx-fire-bolt', url: `${DIR}/fire_bolt.png`, frameWidth: 64, frameHeight: 64, frames: 4, scale: 0.36, fps: 14 },
  fire_bolt_impact: { key: 'vfx-fire-bolt-impact', url: `${DIR}/fire_bolt_impact.png`, frameWidth: 96, frameHeight: 96, frames: 6, scale: 0.36, durationMs: 260 },

  // --- Mage (measured: docs/design/mage-class-implementation.md, "Art wiring").
  // Arcane orb with a short tail, pointing +X (~18 world px long).
  magic_bolt: { key: 'vfx-magic-bolt', url: `${MAGE}/magic_bolt.png`, frameWidth: 64, frameHeight: 64, frames: 4, scale: 0.36, fps: 14, blend: 'add' },
  magic_bolt_impact: { key: 'vfx-magic-bolt-impact', url: `${MAGE}/magic_bolt_impact.png`, frameWidth: 96, frameHeight: 96, frames: 6, scale: 0.34, durationMs: 220, blend: 'add' },
  // Ground bursts: the footprint ellipse is centred at y≈120 of the 192 px cell.
  flame_burst: { key: 'vfx-flame-burst', url: `${MAGE}/flame_burst.png`, frameWidth: 192, frameHeight: 192, frames: 8, scale: 1, durationMs: 400, anchor: { x: 96, y: 120 }, footprint: 140, blend: 'add' },
  frost_nova: { key: 'vfx-frost-nova', url: `${MAGE}/frost_nova.png`, frameWidth: 192, frameHeight: 192, frames: 8, scale: 1, durationMs: 380, anchor: { x: 96, y: 120 }, footprint: 165, blend: 'add' },
  // Seamless 6-frame loop for the zone's whole life. Normal blend: its own soft mist alpha reads as blue snow; ADD
  // washed it to white over the bright dirt paths.
  frost_storm: { key: 'vfx-frost-storm', url: `${MAGE}/frost_storm.png`, frameWidth: 192, frameHeight: 192, frames: 6, scale: 1, fps: 10, anchor: { x: 96, y: 120 }, footprint: 154 },
  // The falling rock and its impact keep dark rock / smoke detail, so they blend normally.
  meteor_fall: { key: 'vfx-meteor-fall', url: `${MAGE}/meteor_fall.png`, frameWidth: 128, frameHeight: 256, frames: 6, scale: 0.85, durationMs: 300, anchor: { x: 64, y: 230 } },
  meteor_impact: { key: 'vfx-meteor-impact', url: `${MAGE}/meteor_impact.png`, frameWidth: 256, frameHeight: 256, frames: 8, scale: 1, durationMs: 450, anchor: { x: 128, y: 160 }, footprint: 226 },
};
