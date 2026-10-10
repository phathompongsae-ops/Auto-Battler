import Phaser from 'phaser';
import { MONSTER_ANIM_STATES, type MonsterAnimState } from '../data/monsterArt';
import { animStripKey, MONSTER_ANIM_ART } from '../data/monsterAnimArt';

/*
 * DEBUG / TEST ONLY: code-drawn stand-ins for a pending Visual Pass 4 contract,
 * at its exact cell size, feet row and frame counts, so the real-strip runtime
 * path (resolver, MonsterAnimator, facing, body geometry) can be exercised before
 * final art exists. Monsters pick them up when they are next created (map reset).
 * `real` swaps in staged production strips for some states (e.g. a reviewed idle
 * while the other states are still pending art): each must match the contract size
 * exactly. Review only: the contract stays `pending` and nothing here ships.
 */

const COLORS: Record<MonsterAnimState, string> = { idle: '#8fa3b8', walk: '#6fbf73', attack: '#e0a040', special: '#d04ad0', hit: '#ffffff' };

export function installMonsterAnimFixture(scene: Phaser.Scene, artId: string, real: Partial<Record<MonsterAnimState, HTMLImageElement>> = {}): boolean {
  const art = MONSTER_ANIM_ART[artId];
  if (!art) return false;
  for (const [state, img] of Object.entries(real) as [MonsterAnimState, HTMLImageElement][]) {
    if (img.naturalWidth !== art.frameWidth * art.anims[state].frames || img.naturalHeight !== art.frameHeight) return false;
  }
  const { frameWidth: w, frameHeight: h, feetRow } = art;
  const stand = Math.round((art.standHeight[0] + art.standHeight[1]) / 2);
  for (const state of MONSTER_ANIM_STATES) {
    const key = animStripKey(art, state);
    if (scene.textures.exists(key)) scene.textures.remove(key);
    const img = real[state];
    if (img) {
      // Painted 2x art: smooth filtering, as the production loader applies.
      scene.textures.addSpriteSheet(key, img, { frameWidth: w, frameHeight: h })?.setFilter(Phaser.Textures.FilterMode.LINEAR);
      continue;
    }
    const frames = art.anims[state].frames;
    const tex = scene.textures.createCanvas(key, w * frames, h);
    if (!tex) return false;
    const ctx = tex.getContext();
    for (let i = 0; i < frames; i++) {
      const ox = i * w;
      const bw = Math.round(w * 0.3);
      // Standing silhouette, feet centred on the cell at feetRow; a marker shows the frame index; nose points east.
      ctx.fillStyle = COLORS[state];
      ctx.fillRect(ox + (w - bw) / 2, feetRow - stand, bw, stand);
      ctx.fillRect(ox + w / 2 + bw / 2, feetRow - stand * 0.7, Math.round(w * 0.12), 6);
      ctx.fillStyle = '#000000';
      ctx.fillRect(ox + (w - bw) / 2 + 2 + ((i * 6) % Math.max(6, bw - 8)), feetRow - stand + 2, 6, 6);
      tex.add(i, 0, ox, 0, w, h);
    }
    tex.refresh();
  }
  return true;
}

export function removeMonsterAnimFixture(scene: Phaser.Scene, artId: string): void {
  const art = MONSTER_ANIM_ART[artId];
  if (!art) return;
  for (const state of MONSTER_ANIM_STATES) {
    const key = animStripKey(art, state);
    if (scene.textures.exists(key)) scene.textures.remove(key);
  }
}
