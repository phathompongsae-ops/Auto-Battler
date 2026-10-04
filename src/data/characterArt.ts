import type { Direction } from '../input/Direction';
import type { SkillId } from './skillData';

/*
 * Sprite-sheet art for characters. The PixelLab sheets are used exactly as
 * generated; differences in drawn size between directions are evened out here
 * with per-animation render scale instead of editing the artwork.
 */

export type CharacterAnimState = 'idle' | 'walk';

/** One-shot animations that play over idle and return to it when done. */
export type CharacterAction = 'attack' | 'powerSlash';

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

/**
 * Phaser-drawn effects for an action, all optional. Arc and afterimage play
 * on the hit frame; the impact flash plays on the target when damage lands.
 * Sizes are world pixels; the arc is centred on the facing direction.
 */
export interface ActionVfx {
  readonly arc?: {
    readonly color: number;
    readonly radius: number;
    readonly thickness: number;
    readonly sweepDeg: number;
    /** Distance from the body centre toward the facing. */
    readonly reach: number;
    readonly durationMs: number;
  };
  readonly impact?: { readonly color: number; readonly radius: number; readonly durationMs: number };
  /** Fading additive copy of the hit pose: a short sword trail. */
  readonly afterimage?: { readonly color: number; readonly alpha: number; readonly durationMs: number };
}

export interface CharacterActionArt extends CharacterAnimArt {
  /**
   * Frame index (0-based) where the strike lands. Damage numbers, VFX or a
   * future delayed-damage model sync to this instead of the animation's start.
   */
  readonly hitFrame: number;
  readonly vfx?: ActionVfx;
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
const WARRIOR_FEET_Y = 157;

/** Shared loop speeds of the Class 1 animation set (attack speeds are per class). */
const IDLE_FPS = 5;
const WALK_FPS = 10;

/**
 * @param feetRow Row the feet actually stand on in this strip when it differs
 *   from WARRIOR_FEET_Y: the older Warrior strips were generated at slightly
 *   different heights (153-157), so each is planted through offsetY instead
 *   of editing its pixels. Measured as the lowest row with >= 12 opaque px.
 */
const strip = (
  name: string,
  frames: number,
  frameRate: number,
  visibleHeight: number,
  feetRow = WARRIOR_FEET_Y,
): CharacterAnimArt => ({
  key: `warrior-${name}`,
  url: `${WARRIOR_DIR}/warrior_${name}.png`,
  frames,
  frameRate,
  visibleHeight,
  ...(feetRow !== WARRIOR_FEET_Y ? { offsetY: feetRow - WARRIOR_FEET_Y } : {}),
});

const POWER_SLASH_VFX: ActionVfx = {
  arc: { color: 0xffd166, radius: 22, thickness: 5, sweepDeg: 150, reach: 10, durationMs: 200 },
  impact: { color: 0xfff1a8, radius: 14, durationMs: 160 },
  afterimage: { color: 0xffe2a0, alpha: 0.55, durationMs: 140 },
};

export const WARRIOR_ART: CharacterArt = {
  displayName: 'Warrior',
  portrait: {
    url: 'assets/characters/warrior/warrior_chibi_front_master_v3.png',
    size: '230%',
    position: '50% 22%',
  },
  frameSize: 192,
  feetY: WARRIOR_FEET_Y,
  referenceHeight: 125,
  worldHeight: 40,
  feetOffset: 13,
  bodyWidth: 70,
  effectPadding: { x: 7, y: 5 },
  smooth: true,
  anims: {
    idle: {
      down: strip('idle_south', 4, IDLE_FPS, 120, 153),
      // 4-frame back idle (Class 1 animation set); feet on the same row as walk_north.
      up: strip('idle_v2_north', 4, IDLE_FPS, 124, 156),
      right: strip('idle_east', 4, IDLE_FPS, 128),
    },
    walk: {
      down: strip('walk_south', 8, 10, 121, 154),
      up: strip('walk_north', 8, 10, 126, 155),
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
      right: { ...strip('attack_east', 8, 18, 124, 155), hitFrame: 4 },
    },
    powerSlash: {
      // 10 frames at 16 fps = 625 ms: wind-up 1-4, cut on 5, follow-through, return.
      // Frame 5 lands at 312.5 ms; power_strike's windup.ms matches it.
      down: { ...strip('power_slash_south', 10, 16, 122), hitFrame: 5, vfx: POWER_SLASH_VFX },
    },
  },
  skillActions: {
    basic_attack: 'attack',
    power_strike: 'powerSlash',
  },
};

/*
 * Archer / Mage / Cleric / Ninja: production strips from the Class 1
 * animation set (art-source/characters/class1_animation_manifest.json).
 * Every strip is already normalised to one standard — 192 px cells, feet on
 * row 153, body axis at x=95, one body scale — so they share a single render
 * scale and need no per-animation height correction. West mirrors East.
 */
const CLASS1_FEET_Y = 153;
/** Source height drawn at `worldHeight`; same body scale as the Warrior master (125 px -> 40 px). */
const CLASS1_REFERENCE_HEIGHT = 125;
/** Body axis is x=95 in the 192 px cell; nudging the pivot there keeps the body still when mirrored. */
const CLASS1_AXIS_NUDGE_X = 1;

type ClassArtId = 'archer' | 'mage' | 'cleric' | 'ninja';

interface Class1ArtSpec {
  id: ClassArtId;
  displayName: string;
  /** Basic attack playback rate (8 frames). */
  attackFps: number;
  /**
   * Visually preferred hit / release frame per direction (0-based; East also
   * serves West). Presentation only: combat damage timing is the skill's own.
   */
  attackHitFrame: Record<ArtDirection, number>;
}

const ART_DIRS: Record<ArtDirection, string> = { down: 'south', up: 'north', right: 'east' };

function class1Art(spec: Class1ArtSpec): CharacterArt {
  const dir = `assets/characters/${spec.id}`;
  const anim = (name: string, art: ArtDirection, frames: number, frameRate: number): CharacterAnimArt => ({
    key: `${spec.id}-${name}_${ART_DIRS[art]}`,
    url: `${dir}/anims/${spec.id}_${name}_${ART_DIRS[art]}.png`,
    frames,
    frameRate,
    visibleHeight: CLASS1_REFERENCE_HEIGHT,
    offsetX: CLASS1_AXIS_NUDGE_X,
  });
  const loop = (name: 'idle' | 'walk', frames: number, fps: number) =>
    ({ down: anim(name, 'down', frames, fps), up: anim(name, 'up', frames, fps), right: anim(name, 'right', frames, fps) });
  const attack = (art: ArtDirection): CharacterActionArt => ({ ...anim('attack', art, 8, spec.attackFps), hitFrame: spec.attackHitFrame[art] });
  return {
    displayName: spec.displayName,
    portrait: { url: `${dir}/${spec.id}_south_master.png`, size: '230%', position: '50% 22%' },
    frameSize: 192,
    feetY: CLASS1_FEET_Y,
    referenceHeight: CLASS1_REFERENCE_HEIGHT,
    worldHeight: 40,
    feetOffset: 13,
    bodyWidth: 70,
    effectPadding: { x: 7, y: 5 },
    smooth: true,
    anims: { idle: loop('idle', 4, IDLE_FPS), walk: loop('walk', 8, WALK_FPS) },
    actions: { attack: { down: attack('down'), up: attack('up'), right: attack('right') }, powerSlash: {} },
    skillActions: {
      basic_attack: 'attack',
      // TEMPORARY: these classes still play the Warrior demo kit (demoConfig);
      // its strikes reuse the class's own basic attack until real skills exist.
      power_strike: 'attack',
      fire_bolt: 'attack',
    },
  };
}

export const ARCHER_ART = class1Art({ id: 'archer', displayName: 'Archer', attackFps: 16, attackHitFrame: { down: 5, up: 5, right: 4 } });
export const MAGE_ART = class1Art({ id: 'mage', displayName: 'Mage', attackFps: 16, attackHitFrame: { down: 4, up: 3, right: 4 } });
export const CLERIC_ART = class1Art({ id: 'cleric', displayName: 'Cleric', attackFps: 18, attackHitFrame: { down: 4, up: 4, right: 4 } });
export const NINJA_ART = class1Art({ id: 'ninja', displayName: 'Ninja', attackFps: 20, attackHitFrame: { down: 3, up: 3, right: 2 } });

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
