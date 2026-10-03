import Phaser from 'phaser';
import { allAnimArt, type CharacterArt } from '../data/characterArt';

/** `?art=placeholder` skips the sprite sheets and uses the canvas placeholders. */
export function characterArtDisabled(): boolean {
  return new URLSearchParams(window.location.search).get('art') === 'placeholder';
}

/** Queue every strip of a character for loading. Call from a scene's preload(). */
export function preloadCharacterArt(scene: Phaser.Scene, art: CharacterArt): void {
  for (const anim of allAnimArt(art)) {
    scene.load.spritesheet(anim.key, anim.url, { frameWidth: art.frameSize, frameHeight: art.frameSize });
  }
}

/** True when every strip loaded; otherwise callers fall back to placeholder art. */
export function isCharacterArtReady(scene: Phaser.Scene, art: CharacterArt): boolean {
  return allAnimArt(art).every((anim) => scene.textures.exists(anim.key));
}

/**
 * The game runs with `pixelArt: true` (nearest filtering). Sheets drawn at a
 * fraction of their source size alias badly that way, so they opt into linear.
 */
export function applyCharacterArtFilter(scene: Phaser.Scene, art: CharacterArt): void {
  if (!art.smooth) return;
  for (const anim of allAnimArt(art)) {
    if (scene.textures.exists(anim.key)) scene.textures.get(anim.key).setFilter(Phaser.Textures.FilterMode.LINEAR);
  }
}
