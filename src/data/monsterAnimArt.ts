import type { MonsterAnimSet, MonsterArtDef, MonsterSpecialStrip, MonsterStrip } from './monsterArt';

/*
 * Visual Pass 4 animation art contracts: the exact files, cell sizes, feet rows
 * and timings the runtime (graphics/monsterArt.ts, rendering/MonsterAnimator.ts)
 * expects for the three priority monsters. A contract stays `pending` until its
 * five strips exist; only `integrated` contracts are loaded. Until then each
 * monster keeps its Pass 2 idle sheet (or the borrowed, tinted Skeleton sheet
 * for the Brute) with procedural motion.
 *
 * Shared rules for every strip:
 *   - one horizontal transparent PNG per state, `frames` cells of frameWidth x frameHeight
 *     (all five strips of one monster share the cell size and feetRow);
 *   - source faces right (east); the runtime mirrors it for left-facing;
 *   - 2 source px per world px (drawn at 0.5); feet centred horizontally on the
 *     cell and standing ON `feetRow`: the lowest visible pixel is feetRow - 1, as in
 *     every approved sheet, leaving the last 2 rows clear (checked by
 *     tools/monster-art/stripMetrics.mjs; standing height = feetRow - top row);
 *   - no baked ground shadow (WorldOverlays draws it), no text, no UI, no background;
 *   - basic attack is contact-first (frame 0 = contact, drawn on the damage tick);
 *   - special: raise -> held loop until the wind-up ends -> impact (drawn on the
 *     gameplay impact tick) -> recovery.
 * The world-space body, hit radius, shadow and anchors are computed from the
 * tier scale, never from the cell, so they are unchanged by these sizes.
 */

export type AnimContractStatus = 'pending' | 'integrated';

export interface MonsterAnimContract extends MonsterArtDef {
  anims: MonsterAnimSet;
  status: AnimContractStatus;
  /** Standing (idle / walk) silhouette height, source px, top of head to feet: [min, max]. */
  standHeight: readonly [number, number];
}

const DIR = 'assets/monsters';

function contract(
  id: string,
  cell: { w: number; h: number; feetRow: number },
  homeScale: number,
  standHeight: readonly [number, number],
  walk: { frames: number; fps: number },
  special: Omit<MonsterSpecialStrip, 'url' | 'frames' | 'fps'>,
): MonsterAnimContract {
  const strip = (state: string, frames: number, fps: number): MonsterStrip => ({ url: `${DIR}/${id}/${state}.png`, frames, fps });
  const specialFrames = special.raise + special.hold + special.impact + special.recovery;
  return {
    key: `monster-anim-${id}`,
    url: `${DIR}/${id}/idle.png`,
    frameWidth: cell.w,
    frameHeight: cell.h,
    feetRow: cell.feetRow,
    homeScale,
    status: 'pending',
    standHeight,
    anims: {
      idle: strip('idle', 2, 3),
      walk: strip('walk', walk.frames, walk.fps),
      attack: strip('attack', 5, 12),
      special: { ...strip('special', specialFrames, 12), ...special },
      hit: strip('hit', 3, 15),
    },
  };
}

/** By art id (`MonsterDef.artId ?? MonsterDef.texture`). homeScale = the owner's tier scale, so it draws at exactly 0.5. */
export const MONSTER_ANIM_ART: Readonly<Record<string, MonsterAnimContract>> = {
  // Boss. Grave Slam (Lv20 and Story) winds up 1100 ms; the raised weapon may use the headroom above the head.
  crypt_lord: contract('crypt_lord', { w: 224, h: 192, feetRow: 190 }, 2.5, [150, 168], { frames: 8, fps: 8 }, {
    raise: 3, hold: 2, impact: 2, recovery: 3, skills: ['crypt_slam', 'crypt_slam_story'], windupMs: 1100,
  }),
  // Mini boss. Stomp winds up 1000 ms.
  grove_guardian: contract('grove_guardian', { w: 208, h: 160, feetRow: 158 }, 2.1, [124, 140], { frames: 8, fps: 8 }, {
    raise: 3, hold: 2, impact: 2, recovery: 3, skills: ['guardian_stomp'], windupMs: 1000,
  }),
  // Story Brute: dedicated art replacing the tinted Skeleton. Taller than the Skeleton (40.5 world px),
  // shorter than the Knight (53 world px = 106 source px). Bone Smash winds up 1400 ms.
  crypt_brute: contract('crypt_brute', { w: 112, h: 108, feetRow: 106 }, 1.45, [88, 100], { frames: 6, fps: 9 }, {
    raise: 3, hold: 2, impact: 2, recovery: 3, skills: ['brute_smash_story'], windupMs: 1400,
  }),
};

/** Texture key of one state's strip. */
export const animStripKey = (art: MonsterArtDef, state: string): string => `${art.key}-${state}`;
