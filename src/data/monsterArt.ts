/*
 * Production monster sprites (Visual Production Pass 2). Each sheet is a
 * 2-frame idle strip refitted from the reviewed candidates
 * (tools/env-art/pass2-jobs.json) at 2 source px per world px, like the
 * environment art. Presentation only: the physics body, hit radius, shadow,
 * HP-bar and damage-number anchors keep their existing world-space values (see
 * entities/Monster.ts); a missing or failed sheet falls back to the code-drawn
 * placeholder of the same monster. `?monsterArt=off` forces the placeholders.
 *
 * These sheets have no walk / attack / hit / death frames: movement reuses the
 * idle strip with Pass 3's temporary procedural poses (rendering/MonsterMotion.ts).
 * Monsters with real animation strips (Visual Pass 4, data/monsterAnimArt.ts)
 * replace that; death always keeps the code-driven squash and fade.
 */

/** Real animation states (rendering/monsterAnimState.ts picks one per frame; death stays code-driven). */
export type MonsterAnimState = 'idle' | 'walk' | 'attack' | 'special' | 'hit';
export const MONSTER_ANIM_STATES: readonly MonsterAnimState[] = ['idle', 'walk', 'attack', 'special', 'hit'];

/** One horizontal strip: `frames` cells of the art's shared frame size, played at `fps`. */
export interface MonsterStrip {
  url: string;
  frames: number;
  fps: number;
}

/**
 * A telegraphed special in four consecutive segments (frame counts): raise, a held loop until the
 * gameplay wind-up ends, impact (its first frame is drawn on the gameplay impact tick), recovery.
 */
export interface MonsterSpecialStrip extends MonsterStrip {
  raise: number;
  hold: number;
  impact: number;
  recovery: number;
  /** Skills this strip animates; all must share `windupMs` (a unit test checks it against SKILLS). */
  skills: readonly string[];
  windupMs: number;
}

/**
 * Real strips for every state. The basic attack is contact-first: frame 0 is the contact pose, drawn
 * on the tick its damage lands (monster basic attacks have no wind-up), then follow-through / recovery.
 */
export type MonsterAnimSet = Record<Exclude<MonsterAnimState, 'special'>, MonsterStrip> & { special: MonsterSpecialStrip };

export interface MonsterArtDef {
  /** Spritesheet texture key. */
  key: string;
  url: string;
  frameWidth: number;
  frameHeight: number;
  /** Source pixel row the feet stand on (bottom of the drawn content, frame 0). */
  feetRow: number;
  /**
   * Display scale (`MonsterDef.scale`, default 1) of the monster this art was
   * fitted for. Another monster reusing the art (the Skeleton Brute uses the
   * Skeleton's) draws at its own scale relative to this one.
   */
  homeScale: number;
  /** Presentation-only multiplier; world-space bodies retain their tier dimensions. */
  displayScale?: number;
  /** Real animation strips sharing frameWidth / frameHeight / feetRow (key `${key}-${state}`); absent = idle sheet only. */
  anims?: MonsterAnimSet;
}

/** World px per source px of the monster sheets. */
export const MONSTER_ART_DRAW_SCALE = 0.5;

const art = (id: string, frameWidth: number, frameHeight: number, feetRow: number, homeScale: number): MonsterArtDef => ({
  key: `monster-art-${id}`,
  url: `assets/monsters/${id}.png`,
  frameWidth,
  frameHeight,
  feetRow,
  homeScale,
});

/** By monster texture id (`MonsterDef.texture`). Visual heights: about 2x the frame's content rows at draw scale 0.5. */
export const MONSTER_ART: Readonly<Record<string, MonsterArtDef>> = {
  slime: art('slime', 56, 48, 46, 1),
  wolf: { ...art('wolf', 86, 60, 58, 1.15), displayScale: 1.08 },
  mushroom: art('mushroom', 68, 60, 58, 1.15),
  elite_boar: art('elite_boar', 110, 80, 78, 1.6),
  grove_guardian: art('grove_guardian', 142, 136, 134, 2.1),
  crypt_skeleton: art('crypt_skeleton', 70, 84, 81, 1.15),
  crypt_knight: art('crypt_knight', 120, 108, 106, 1.6),
  crypt_lord: art('crypt_lord', 146, 164, 162, 2.5),
};

/**
 * Rest tint (multiply) for monsters that reuse another monster's sheet, so the
 * variant reads as its own enemy until it has dedicated art. The Skeleton
 * Brute: the Skeleton sheet at its larger tier scale, in heavier, darker bone.
 * Applies only while that borrowed sheet is drawn; dedicated art (`MonsterDef.artId`) is never tinted.
 */
export const MONSTER_ART_TINT: Readonly<Record<string, number>> = {
  crypt_brute: 0xc8b2a4,
};
