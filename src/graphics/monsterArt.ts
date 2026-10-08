import Phaser from 'phaser';
import { MONSTER_ART, type MonsterArtDef } from '../data/monsterArt';

/*
 * Loads the production monster sheets (data/monsterArt.ts). A sheet that
 * fails to load leaves its monster on the code-drawn placeholder;
 * `?monsterArt=off` skips them entirely.
 */

export function monsterArtDisabled(): boolean {
  return new URLSearchParams(window.location.search).get('monsterArt') === 'off';
}

/** Queue every monster sheet. Call from a scene's preload(). */
export function preloadMonsterArt(scene: Phaser.Scene): void {
  if (monsterArtDisabled()) return;
  for (const art of Object.values(MONSTER_ART)) scene.load.spritesheet(art.key, art.url, { frameWidth: art.frameWidth, frameHeight: art.frameHeight });
}

/** Painted 2x art drawn at half scale: smooth (linear) filtering, not the global pixel-art nearest filter. */
export function applyMonsterArtFilter(scene: Phaser.Scene): void {
  for (const art of Object.values(MONSTER_ART)) {
    if (scene.textures.exists(art.key)) scene.textures.get(art.key).setFilter(Phaser.Textures.FilterMode.LINEAR);
  }
}

/** The loaded production art for a monster texture id, or null (placeholder). */
export function loadedMonsterArt(scene: Phaser.Scene, texture: string): MonsterArtDef | null {
  const art = MONSTER_ART[texture];
  return art && scene.textures.exists(art.key) ? art : null;
}
