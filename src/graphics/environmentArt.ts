import Phaser from 'phaser';
import { ENV_DRAW_SCALE, environmentTextureFiles } from '../data/environmentArt';

/*
 * Loads the high-resolution environment PNGs (data/environmentArt.ts) under
 * their texture keys. A loaded PNG wins over the code-drawn placeholder of
 * the same key (placeholders are only created for keys still missing after
 * loading); `?envArt=off` skips the PNGs entirely.
 */

/** `?envArt=off` keeps every environment texture code-drawn. */
export function environmentArtDisabled(): boolean {
  return new URLSearchParams(window.location.search).get('envArt') === 'off';
}

/** Queue every environment PNG. Call from a scene's preload(). */
export function preloadEnvironmentArt(scene: Phaser.Scene): void {
  if (environmentArtDisabled()) return;
  for (const { key, url } of environmentTextureFiles()) scene.load.image(key, url);
}

/**
 * Loaded environment PNGs are 2x art drawn at half scale: smooth (linear)
 * filtering like the character sheets, and a draw scale stored on the
 * texture for the scene to apply. Call after loading, before placeholders.
 */
export function applyEnvironmentArtFilter(scene: Phaser.Scene): void {
  for (const { key } of environmentTextureFiles()) {
    if (!scene.textures.exists(key)) continue;
    const texture = scene.textures.get(key);
    texture.setFilter(Phaser.Textures.FilterMode.LINEAR);
    (texture.customData as Record<string, unknown>).envDrawScale = ENV_DRAW_SCALE;
  }
}

/** Scale to draw a texture at in world units: 0.5 for 2x environment PNGs, 1 for code-drawn art. */
export function envDrawScale(scene: Phaser.Scene, key: string): number {
  if (!scene.textures.exists(key)) return 1;
  const scale = (scene.textures.get(key).customData as Record<string, unknown>).envDrawScale;
  return typeof scale === 'number' ? scale : 1;
}
