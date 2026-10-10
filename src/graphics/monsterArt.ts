import Phaser from 'phaser';
import { MONSTER_ANIM_STATES, MONSTER_ART, MONSTER_ART_TINT, type MonsterAnimState, type MonsterArtDef } from '../data/monsterArt';
import { animStripKey, MONSTER_ANIM_ART } from '../data/monsterAnimArt';
import type { MonsterDef } from '../data/monsterData';

/*
 * Loads the production monster sheets (data/monsterArt.ts) and the integrated
 * Visual Pass 4 animation strips (data/monsterAnimArt.ts; pending contracts are
 * never requested). A sheet that fails to load leaves its monster on the next
 * art in line, ending at the code-drawn placeholder; `?monsterArt=off` skips them all.
 */

export function monsterArtDisabled(): boolean {
  return new URLSearchParams(window.location.search).get('monsterArt') === 'off';
}

const integrated = () => Object.values(MONSTER_ANIM_ART).filter((a) => a.status === 'integrated');

/** Queue every monster sheet. Call from a scene's preload(). */
export function preloadMonsterArt(scene: Phaser.Scene): void {
  if (monsterArtDisabled()) return;
  for (const art of Object.values(MONSTER_ART)) scene.load.spritesheet(art.key, art.url, { frameWidth: art.frameWidth, frameHeight: art.frameHeight });
  for (const art of integrated()) {
    for (const state of MONSTER_ANIM_STATES) {
      scene.load.spritesheet(animStripKey(art, state), art.anims[state].url, { frameWidth: art.frameWidth, frameHeight: art.frameHeight });
    }
  }
}

/** Painted 2x art drawn at half scale: smooth (linear) filtering, not the global pixel-art nearest filter. */
export function applyMonsterArtFilter(scene: Phaser.Scene): void {
  const keys = [
    ...Object.values(MONSTER_ART).map((a) => a.key),
    ...Object.values(MONSTER_ANIM_ART).flatMap((a) => MONSTER_ANIM_STATES.map((s) => animStripKey(a, s))),
  ];
  for (const key of keys) if (scene.textures.exists(key)) scene.textures.get(key).setFilter(Phaser.Textures.FilterMode.LINEAR);
}

/** Texture key per animation state of a monster drawn with real strips. */
export type MonsterStripKeys = Readonly<Record<MonsterAnimState, string>>;

export interface ResolvedMonsterArt {
  art: MonsterArtDef;
  /** Texture key of the idle sheet / strip (the sprite's initial texture). */
  key: string;
  /** Real animation strips, or null: the 2-frame idle sheet with procedural motion. */
  strips: MonsterStripKeys | null;
  /** Rest tint: only while a borrowed sheet stands in for missing dedicated art. */
  tint: number | null;
}

/**
 * The art a monster draws with, best first: real animation strips for its art id; that id's idle
 * sheet; the `texture` sheet it borrows (tinted, when it has a dedicated art id); null = placeholder.
 * Every strip of a set must be loaded for the set to be used (never a half-animated monster).
 */
export function resolveMonsterArt(scene: Phaser.Scene, def: MonsterDef): ResolvedMonsterArt | null {
  const id = def.artId ?? def.texture;
  const anim = MONSTER_ANIM_ART[id];
  if (anim) {
    const strips = Object.fromEntries(MONSTER_ANIM_STATES.map((s) => [s, animStripKey(anim, s)])) as Record<MonsterAnimState, string>;
    if (MONSTER_ANIM_STATES.every((s) => scene.textures.exists(strips[s]))) return { art: anim, key: strips.idle, strips, tint: null };
  }
  for (const [artId, borrowed] of [[id, false], [def.texture, id !== def.texture]] as const) {
    const art = MONSTER_ART[artId];
    if (art && scene.textures.exists(art.key)) return { art, key: art.key, strips: null, tint: borrowed ? (MONSTER_ART_TINT[def.id] ?? null) : null };
  }
  return null;
}
