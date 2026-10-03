import type { Direction } from '../input/Direction';
import type { SkillId } from './skillData';

/*
 * Sprite-sheet art for characters. The PixelLab sheets are used exactly as
 * generated; differences in drawn size between directions are evened out here
 * with per-animation render scale instead of editing the artwork.
 */

export type CharacterAnimState = 'idle' | 'walk';

/** One-shot animations that play over idle and return to it when done. */
export type CharacterAction = 'attack';

/** Directions that have their own art. `left` is drawn by mirroring `right`. */
export type ArtDirection = Exclude<Direction, 'left'>;

export interface CharacterAnimArt {
  /** Texture key; also the loader key. */
  readonly key: string;
  /** Path under `public/`, resolved relative to the page. */
  readonly url: string;
  /** Number of frames in the horizontal strip. */
  readonly frames: number;
  readonly frameRate: number;
  /**
   * Height in source pixels of the character as drawn in this strip (median
   * over frames). Used to normalise apparent size between directions.
   */
  readonly visibleHeight: number;
  /** Optional nudge in source pixels after scaling, for pivot fine-tuning. */
  readonly offsetX?: number;
  readonly offsetY?: number;
}

export interface CharacterActionArt extends CharacterAnimArt {
  /**
   * Frame index (0-based) where the strike lands. Damage numbers, VFX or a
   * future delayed-damage model sync to this instead of the animation's start.
   */
  readonly hitFrame: number;
}

/**
 * Where a character is drawn relative to its world position (x, y), in world
 * pixels. Overhead UI and body-surrounding effects are placed from this, so
 * each character's art can size them without hard-coded offsets.
 */
export interface CharacterVisualLayout {
  /** Distance below the position where the feet are drawn. */
  readonly feetOffset: number;
  /** Visible height from feet to top of head. */
  readonly height: number;
  /** Visible body width, ignoring weapons and capes that stick out. */
  readonly bodyWidth: number;
  /** Room left around the body by surrounding effects such as auras. */
  readonly effectPadding: { readonly x: number; readonly y: number };
}

/** Face crop for the HUD portrait, taken from one of the character's images. */
export interface CharacterPortrait {
  readonly url: string;
  /** CSS background-size / background-position that frame the face. */
  readonly size: string;
  readonly position: string;
}

export interface CharacterArt {
  /** Class name shown in the UI. */
  readonly displayName: string;
  readonly portrait: CharacterPortrait;
  /** Square cell size of every strip, in source pixels. */
  readonly frameSize: number;
  /** Source-pixel row the feet stand on in every frame. */
  readonly feetY: number;
  /** Source height every animation is normalised to. */
  readonly referenceHeight: number;
  /** On-screen height of a character drawn at `referenceHeight`, in world pixels. */
  readonly worldHeight: number;
  /** World pixels below the position where the feet are drawn. */
  readonly feetOffset: number;
  /** Body width in source pixels at `referenceHeight` (shoulders, without sword/cape). */
  readonly bodyWidth: number;
  /** World pixels of space between the body and surrounding effects. */
  readonly effectPadding: { readonly x: number; readonly y: number };
  /** Smooth filtering for art that is drawn well below its source size. */
  readonly smooth: boolean;
  readonly anims: Record<CharacterAnimState, Record<ArtDirection, CharacterAnimArt>>;
  /** Action strips per direction. Directions without art simply don't play the action. */
  readonly actions: Record<CharacterAction, Partial<Record<ArtDirection, CharacterActionArt>>>;
  /** Which action a skill plays when this character uses it. */
  readonly skillActions: Partial<Record<SkillId, CharacterAction>>;
}

const WARRIOR_DIR = 'assets/characters/warrior/anims';

const strip = (
  name: string,
  frames: number,
  frameRate: number,
  visibleHeight: number,
): CharacterAnimArt => ({
  key: `warrior-${name}`,
  url: `${WARRIOR_DIR}/warrior_${name}.png`,
  frames,
  frameRate,
  visibleHeight,
});

export const WARRIOR_ART: CharacterArt = {
  displayName: 'Warrior',
  portrait: {
    url: 'assets/characters/warrior/warrior_chibi_front_master_v3.png',
    size: '230%',
    position: '50% 22%',
  },
  frameSize: 192,
  feetY: 157,
  referenceHeight: 125,
  worldHeight: 40,
  feetOffset: 13,
  bodyWidth: 70,
  effectPadding: { x: 7, y: 5 },
  smooth: true,
  anims: {
    idle: {
      down: strip('idle_south', 4, 4, 120),
      // Single static frame: the back sprite (no generated back idle yet).
      up: strip('idle_north', 1, 1, 125),
      right: strip('idle_east', 4, 4, 128),
    },
    walk: {
      down: strip('walk_south', 8, 10, 121),
      up: strip('walk_north', 8, 10, 126),
      right: strip('walk_east', 8, 10, 121),
    },
  },
  actions: {
    attack: {
      // 8 frames at 18 fps = 444 ms, inside the 500 ms basic-attack cooldown.
      // Frame 4 is the blade sweeping across the front of the body.
      down: { ...strip('attack_south', 8, 18, 124), hitFrame: 4 },
      // 7 frames = 389 ms. Frame 4 is the downward cut to the right hip.
      up: { ...strip('attack_north', 7, 18, 125), hitFrame: 4 },
      // 8 frames = 444 ms. Frame 4 is the forward cut. West mirrors this strip.
      right: { ...strip('attack_east', 8, 18, 124), hitFrame: 4 },
    },
  },
  skillActions: {
    basic_attack: 'attack',
  },
};

/** Render scale that brings an animation to the shared on-screen height. */
export function artScale(art: CharacterArt, anim: CharacterAnimArt): number {
  const normalise = art.referenceHeight / anim.visibleHeight;
  return (art.worldHeight / art.referenceHeight) * normalise;
}

/** World-space layout of a character drawn with this art. */
export function artLayout(art: CharacterArt): CharacterVisualLayout {
  return {
    feetOffset: art.feetOffset,
    height: art.worldHeight,
    bodyWidth: art.bodyWidth * (art.worldHeight / art.referenceHeight),
    effectPadding: art.effectPadding,
  };
}

/** Time from the start of an action to its hit frame, in ms. */
export function actionHitDelayMs(anim: CharacterActionArt): number {
  return (anim.hitFrame * 1000) / anim.frameRate;
}

export function allAnimArt(art: CharacterArt): CharacterAnimArt[] {
  const loops = Object.values(art.anims).flatMap((byDir) => Object.values(byDir));
  const actions = Object.values(art.actions).flatMap((byDir) => Object.values(byDir));
  return [...loops, ...actions];
}
