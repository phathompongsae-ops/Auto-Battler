import Phaser from 'phaser';
import { PLAYER_WALK_FPS } from '../config';
import { CombatantState } from '../combat/CombatantState';
import type { CombatEntity } from '../combat/types';
import {
  actionHitDelayMs,
  artLayout,
  artScale,
  type ActionVfx,
  type ArtDirection,
  type CharacterAction,
  type CharacterActionArt,
  type CharacterAnimArt,
  type CharacterAnimState,
  type CharacterArt,
  type CharacterVisualLayout,
} from '../data/characterArt';
import { PLAYER_HIT_RADIUS } from '../data/playerData';
import type { SkillId } from '../data/skillData';
import { PLAYER_KEY, PLAYER_PLACEHOLDER_LAYOUT, playerFrame } from '../graphics/placeholderTextures';
import { DIRECTIONS, DIRECTION_VECTORS, type Direction } from '../input/Direction';
import { CharacterProgress } from '../progression/CharacterProgress';
import { ModifierStack } from '../stats/ModifierStack';
import { playerCombatStats } from '../stats/playerCombatStats';
import { classGrowthMaxLevel } from '../stats/classBaseStats';
import { MAX_LEVEL } from '../data/progressionData';

export type PlayerState = 'idle' | 'walk' | 'dead';

type AnimName = CharacterAnimState | CharacterAction;

const animKey = (name: AnimName, dir: Direction) => `player-${name}-${dir}`;

/** Emitted on the sprite when an action reaches its configured hit frame. */
export const PLAYER_ACTION_HIT = 'action-hit';
export interface PlayerActionHit {
  action: CharacterAction;
  direction: Direction;
}

const DEAD_TINT = 0x666677;

/**
 * Collision box in world pixels, relative to the sprite position. Only the
 * feet collide, so the head can overlap walls above.
 */
const BODY = { left: -8, top: 4, width: 16, height: 10 };

/** Left-facing art is the right-facing art mirrored. */
const artDirection = (dir: Direction): ArtDirection => (dir === 'left' ? 'right' : dir);

export class Player extends Phaser.Physics.Arcade.Sprite implements CombatEntity {
  readonly id = 'player';
  readonly hitRadius = PLAYER_HIT_RADIUS;
  readonly combat: CombatantState;
  /** Where the current art is drawn; overhead UI and auras are placed from it. */
  readonly layout: CharacterVisualLayout;
  /** Job, base / allocated stats, job bonuses, skill points (persistent stat inputs). */
  readonly progress = new CharacterProgress();
  /**
   * Stat modifiers from equipment, pets, buffs and debuffs (empty until those
   * systems exist). Changing it re-derives combat stats.
   */
  readonly statModifiers = new ModifierStack(() => this.combat.refreshStats());

  state: PlayerState = 'idle';
  facing: Direction = 'down';
  /** One-shot animation playing over idle, if any. Purely visual. */
  action: CharacterAction | null = null;

  declare body: Phaser.Physics.Arcade.Body;

  /** Animation whose scale/pivot/body fit is currently applied. */
  private viewKey = '';
  /**
   * An action requested in a facing that has no art for it. The combat
   * controller turns toward the target right after the skill fires, so this
   * survives until that turn (same tick) and is dropped on the next move().
   */
  private queuedAction: CharacterAction | null = null;

  /**
   * @param art Sprite-sheet art, or null to use the canvas placeholder.
   */
  constructor(
    scene: Phaser.Scene,
    x: number,
    y: number,
    private readonly art: CharacterArt | null = null,
  ) {
    super(scene, x, y, PLAYER_KEY, playerFrame('down', 0));
    scene.add.existing(this);
    scene.physics.add.existing(this);

    this.combat = new CombatantState(
      'player',
      'Player',
      'player',
      (level, statuses) => playerCombatStats(this.progress, level, this.statModifiers.list(), statuses),
      1,
      // A class can't level past its last base-growth anchor (Class 1: Lv40).
      () => classGrowthMaxLevel(this.progress.classId) ?? MAX_LEVEL,
    );
    this.layout = art ? artLayout(art) : PLAYER_PLACEHOLDER_LAYOUT;

    this.setCollideWorldBounds(true);

    Player.createAnimations(scene, art);
    this.on(Phaser.Animations.Events.ANIMATION_UPDATE, this.onAnimationUpdate, this);
    this.on(Phaser.Animations.Events.ANIMATION_COMPLETE, this.onAnimationComplete, this);
    this.playAnim('idle', 'down');
  }

  /** Apply one frame of movement intent. Pass null to stand still. */
  move(direction: Direction | null): void {
    this.queuedAction = null;
    if (this.combat.dead) {
      this.body.setVelocity(0, 0);
      return;
    }
    if (direction) {
      const v = DIRECTION_VECTORS[direction];
      const speed = this.combat.stats.moveSpeed;
      this.body.setVelocity(v.x * speed, v.y * speed);
      this.facing = direction;
      // Moving always wins over an action so input never feels stuck.
      this.action = null;
      this.setPlayerState('walk');
    } else {
      this.body.setVelocity(0, 0);
      this.setPlayerState('idle');
    }
    // Draw order follows the feet so the player sorts correctly with props later.
    this.setDepth(this.y);
  }

  /** Turn toward a point (e.g. the attack target) along the dominant axis. */
  faceToward(x: number, y: number): void {
    const dx = x - this.x;
    const dy = y - this.y;
    if (dx === 0 && dy === 0) return;
    this.facing = Math.abs(dx) > Math.abs(dy) ? (dx < 0 ? 'left' : 'right') : dy < 0 ? 'up' : 'down';
    if (this.state === 'dead') return;
    const action = this.action ?? this.queuedAction;
    if (action) this.playAction(action);
    else this.playAnim(this.state, this.facing);
  }

  /** Time from an action's start to its hit frame in a facing, or null without art. */
  actionHitDelay(action: CharacterAction, dir: Direction = this.facing): number | null {
    const art = this.actionArt(action, dir);
    return art ? actionHitDelayMs(art) : null;
  }

  /** VFX configured for an action in a facing. */
  actionVfx(action: CharacterAction, dir: Direction = this.facing): ActionVfx | undefined {
    return this.actionArt(action, dir)?.vfx;
  }

  /** VFX of the action a skill plays in the current facing (undefined if none). */
  skillVfx(skillId: SkillId): ActionVfx | undefined {
    const action = this.art?.skillActions[skillId];
    return action ? this.actionVfx(action) : undefined;
  }

  /** Play the animation this character's art assigns to a skill, if any. */
  playSkillAction(skillId: SkillId): void {
    const action = this.art?.skillActions[skillId];
    if (action) this.playAction(action);
  }

  /**
   * Play a one-shot action in the current facing, restarting it if already
   * playing. Returns false (and changes nothing) when there is no art for it.
   */
  playAction(action: CharacterAction): boolean {
    this.queuedAction = null;
    if (this.state === 'dead') return false;
    if (!this.actionArt(action, this.facing)) {
      this.action = null;
      this.queuedAction = action;
      // Without art in this facing, fall back to the plain state animation.
      this.playAnim(this.state, this.facing);
      return false;
    }
    this.action = action;
    this.playAnim(action, this.facing, false);
    return true;
  }

  die(): void {
    this.state = 'dead';
    this.action = null;
    this.body.setVelocity(0, 0);
    this.anims.stop();
    if (this.art) {
      this.setTexture(this.art.anims.idle.down.key, 0);
      this.applyView('idle', 'down');
    } else {
      this.setFrame(playerFrame('down', 0));
    }
    this.setAngle(90);
    this.resetTint();
  }

  respawn(x: number, y: number): void {
    this.combat.reset();
    this.body.reset(x, y);
    this.setAngle(0);
    this.state = 'idle';
    this.facing = 'down';
    this.action = null;
    this.resetTint();
    this.playAnim('idle', 'down');
  }

  /** Restore the normal tint after a hit flash. */
  resetTint(): void {
    this.setTintMode(Phaser.TintModes.MULTIPLY);
    if (this.combat.dead) this.setTint(DEAD_TINT);
    else this.clearTint();
  }

  private setPlayerState(state: CharacterAnimState): void {
    this.state = state;
    // An action keeps playing over idle until it completes.
    if (!this.action) this.playAnim(state, this.facing);
  }

  /**
   * @param ignoreIfPlaying true keeps a running loop going instead of restarting it.
   */
  private playAnim(name: AnimName, dir: Direction, ignoreIfPlaying = true): void {
    this.play(animKey(name, dir), ignoreIfPlaying);
    // After play(): the pivot is measured against the new animation's frame size.
    this.applyView(name, dir);
  }

  private onAnimationUpdate(anim: Phaser.Animations.Animation, frame: Phaser.Animations.AnimationFrame): void {
    if (!this.action || anim.key !== animKey(this.action, this.facing)) return;
    const art = this.actionArt(this.action, this.facing);
    // frame.index is 1-based.
    if (art && frame.index - 1 === art.hitFrame) {
      this.emit(PLAYER_ACTION_HIT, { action: this.action, direction: this.facing } satisfies PlayerActionHit);
    }
  }

  private onAnimationComplete(anim: Phaser.Animations.Animation): void {
    if (!this.action || anim.key !== animKey(this.action, this.facing)) return;
    this.action = null;
    if (this.state !== 'dead') this.playAnim(this.state, this.facing);
  }

  private actionArt(action: CharacterAction, dir: Direction): CharacterActionArt | undefined {
    return this.art?.actions[action][artDirection(dir)];
  }

  private animArt(name: AnimName, dir: Direction): CharacterAnimArt | undefined {
    if (!this.art) return undefined;
    return name === 'idle' || name === 'walk'
      ? this.art.anims[name][artDirection(dir)]
      : this.actionArt(name, dir);
  }

  /**
   * Sets scale, pivot and mirroring for an animation, then re-fits the physics
   * body so its world-space box never changes with the art.
   */
  private applyView(name: AnimName, dir: Direction): void {
    const key = animKey(name, dir);
    if (key === this.viewKey) return;
    this.viewKey = key;
    const art = this.art;
    const anim = this.animArt(name, dir);
    if (art && anim) {
      const flip = dir === 'left';
      const scale = artScale(art, anim);
      const size = art.frameSize;
      // flipX mirrors the frame inside its own box, so a sideways nudge flips sign too.
      const nudgeX = (anim.offsetX ?? 0) * (flip ? -1 : 1);
      this.setFlipX(flip);
      this.setScale(scale);
      this.setOrigin(
        0.5 - nudgeX / size,
        (art.feetY + (anim.offsetY ?? 0) - art.feetOffset / scale) / size,
      );
    }
    this.fitBody();
  }

  private fitBody(): void {
    // Sync the body's cached scale first; setSize multiplies by it.
    this.body.updateBounds();
    const sx = this.scaleX;
    const sy = this.scaleY;
    this.body.setSize(BODY.width / sx, BODY.height / sy, false);
    this.body.setOffset(this.displayOriginX + BODY.left / sx, this.displayOriginY + BODY.top / sy);
  }

  private static createAnimations(scene: Phaser.Scene, art: CharacterArt | null): void {
    if (scene.anims.exists(animKey('idle', 'down'))) return;

    for (const dir of DIRECTIONS) {
      if (art) {
        for (const state of ['idle', 'walk'] as const) {
          const anim = art.anims[state][artDirection(dir)];
          scene.anims.create({
            key: animKey(state, dir),
            frames: scene.anims.generateFrameNumbers(anim.key, { start: 0, end: anim.frames - 1 }),
            frameRate: anim.frameRate,
            repeat: -1,
          });
        }
        for (const [action, byDir] of Object.entries(art.actions) as [CharacterAction, typeof art.actions.attack][]) {
          const anim = byDir[artDirection(dir)];
          if (!anim) continue;
          scene.anims.create({
            key: animKey(action, dir),
            frames: scene.anims.generateFrameNumbers(anim.key, { start: 0, end: anim.frames - 1 }),
            frameRate: anim.frameRate,
            repeat: 0,
          });
        }
        continue;
      }
      scene.anims.create({
        key: animKey('idle', dir),
        frames: [{ key: PLAYER_KEY, frame: playerFrame(dir, 0) }],
      });
      scene.anims.create({
        key: animKey('walk', dir),
        frames: [1, 0, 2, 0].map((i) => ({ key: PLAYER_KEY, frame: playerFrame(dir, i) })),
        frameRate: PLAYER_WALK_FPS,
        repeat: -1,
      });
    }
  }
}
