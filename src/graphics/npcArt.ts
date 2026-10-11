import Phaser from 'phaser';
import { NPC_ART, npcArtKey } from '../data/npcArt';
import { characterArtDisabled } from './characterArt';

/*
 * Production NPC masters (data/npcArt.ts): loaded once at boot under
 * `npc-art-<id>`, linear-filtered like the character sheets (drawn at 0.32).
 * A file that fails to load leaves its NPC on the code-drawn chibi;
 * `?art=placeholder` skips them with the rest of the character art.
 */

export function preloadNpcArt(scene: Phaser.Scene): void {
  if (characterArtDisabled()) return;
  for (const [npcId, url] of Object.entries(NPC_ART)) if (url) scene.load.image(npcArtKey(npcId), url);
}

export function applyNpcArtFilter(scene: Phaser.Scene): void {
  for (const npcId of Object.keys(NPC_ART)) {
    const key = npcArtKey(npcId);
    if (scene.textures.exists(key)) scene.textures.get(key).setFilter(Phaser.Textures.FilterMode.LINEAR);
  }
}

const topRows = new Map<string, number>();

/**
 * First source row with visible pixels (alpha >= 32) of an NPC master: its real top, a held staff or a hat
 * included. Measured once per texture (a 192×192 read) and cached; the contract's head row if unreadable.
 */
export function npcArtTopRow(scene: Phaser.Scene, key: string): number {
  const cached = topRows.get(key);
  if (cached !== undefined) return cached;
  let top = 153 + 1 - 121;
  try {
    const img = scene.textures.get(key).getSourceImage() as CanvasImageSource & { width: number; height: number };
    const canvas = document.createElement('canvas');
    canvas.width = img.width;
    canvas.height = img.height;
    const g = canvas.getContext('2d', { willReadFrequently: true });
    if (g) {
      g.drawImage(img, 0, 0);
      const d = g.getImageData(0, 0, img.width, img.height).data;
      const first = Array.from({ length: img.height }, (_, y) => y).find((y) => {
        for (let x = 0; x < img.width; x++) if (d[(y * img.width + x) * 4 + 3] >= 32) return true;
        return false;
      });
      if (first !== undefined) top = first;
    }
  } catch {
    // Keep the contract head row.
  }
  topRows.set(key, top);
  return top;
}
