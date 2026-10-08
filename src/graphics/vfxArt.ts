import Phaser from 'phaser';
import { VFX_ART, type VfxId } from '../data/vfxArt';

/*
 * Loads the production combat VFX strips (data/vfxArt.ts) and registers one
 * animation per strip. `?vfxArt=off` skips them (code-drawn effects only).
 */

export function vfxArtDisabled(): boolean {
  return new URLSearchParams(window.location.search).get('vfxArt') === 'off';
}

export function preloadVfxArt(scene: Phaser.Scene): void {
  if (vfxArtDisabled()) return;
  for (const v of Object.values(VFX_ART)) scene.load.spritesheet(v.key, v.url, { frameWidth: v.frameWidth, frameHeight: v.frameHeight });
}

/** Linear filtering (painted 2x art) and the strip animations; call after loading. */
export function applyVfxArtFilter(scene: Phaser.Scene): void {
  for (const v of Object.values(VFX_ART)) {
    if (!scene.textures.exists(v.key)) continue;
    scene.textures.get(v.key).setFilter(Phaser.Textures.FilterMode.LINEAR);
    if (scene.anims.exists(v.key)) continue;
    scene.anims.create({
      key: v.key,
      frames: scene.anims.generateFrameNumbers(v.key, { start: 0, end: v.frames - 1 }),
      ...(v.durationMs ? { duration: v.durationMs, repeat: 0 } : { frameRate: v.fps ?? 12, repeat: -1 }),
    });
  }
}

/** Whether a strip is available (loaded); otherwise callers draw the code effect. */
export function hasVfxArt(scene: Phaser.Scene, id: VfxId): boolean {
  return scene.textures.exists(VFX_ART[id].key) && scene.anims.exists(VFX_ART[id].key);
}
