import Phaser from 'phaser';
import type { MonsterAgent, MonsterBrain } from '../ai/MonsterBrain';
import { CombatantState } from '../combat/CombatantState';
import { applyStatusModifiers } from '../combat/stats';
import { monsterCombatStats, type MonsterDef } from '../data/monsterData';
import type { PxRect } from '../world/encounters';
import { MONSTER_ART_DRAW_SCALE, type MonsterAnimState } from '../data/monsterArt';
import { resolveMonsterArt, type MonsterStripKeys } from '../graphics/monsterArt';

const ARRIVE_EPSILON = 2; // px

/** Physics body at tier scale 1, relative to the monster position (world px): x, y of its top-left, width, height. */
const BODY = { x: -10, y: 2, w: 20, h: 12 };
/** Feet / shadow line below the position at tier scale 1 (WorldOverlays draws the shadow here). */
const MONSTER_FEET_OFFSET = 13;

/** Physics body + visuals for one monster. Behaviour lives in MonsterBrain. */
export class Monster extends Phaser.Physics.Arcade.Sprite implements MonsterAgent {
  readonly combat: CombatantState;
  readonly hitRadius: number;
  /** Original spawn from map data (spawnX/Y can be moved by debug tools). */
  readonly homeX: number;
  readonly homeY: number;
  brain!: MonsterBrain;
  /** Spawn zone it belongs to (one zone = one encounter); set by the world on spawn. */
  zoneId = '';
  /** Encounter arena (px), if its zone has one; set by the world on spawn. */
  arena?: readonly PxRect[];

  declare body: Phaser.Physics.Arcade.Body;
  /**
   * Real animation strips (Visual Pass 4), driven frame by frame by rendering/MonsterAnimator.ts; null = the
   * 2-frame idle sheet (or placeholder) with procedural motion (rendering/MonsterMotion.ts).
   */
  readonly strips: MonsterStripKeys | null;

  private deathTween: Phaser.Tweens.Tween | null = null;
  /** Sprite scale at rest (art draw scale, or the placeholder tier scale); death squashes from it. */
  private baseScale = 1;
  /** Display origin and body offset at rest (production art only); a pose shifts both together. */
  private restPose: { originX: number; originY: number; offsetX: number; offsetY: number } | null = null;
  /** Multiply tint a variant keeps between hit flashes (see MONSTER_ART_TINT); null = none. */
  private restTint: number | null = null;
  /** Multiply tint while a status shows on the body (Burn, Slow; set by the renderer); null = none. */
  private statusTint: number | null = null;
  /** Velocity the brain asked for (separation is added on top). */
  private moveX = 0;
  private moveY = 0;

  constructor(
    scene: Phaser.Scene,
    readonly id: string,
    readonly def: MonsterDef,
    public spawnX: number,
    public spawnY: number,
  ) {
    const resolved = resolveMonsterArt(scene, def);
    const art = resolved?.art ?? null;
    super(scene, spawnX, spawnY, resolved ? resolved.key : def.texture, resolved ? 0 : `${def.texture}-0`);
    this.strips = resolved?.strips ?? null;
    scene.add.existing(this);
    scene.physics.add.existing(this);

    const stats = monsterCombatStats(def.stats);
    this.combat = new CombatantState(id, def.name, 'monster', (_level, statuses) => applyStatusModifiers(stats, statuses), def.level);
    this.hitRadius = def.hitRadius;
    this.homeX = spawnX;
    this.homeY = spawnY;

    // Bigger tiers draw bigger. The physics body is fixed in WORLD space by the
    // tier scale k: 20k x 12k px, from k*(-10, +2) to k*(+10, +14) around the
    // monster's position (the shadow sits at its bottom, y + 13k). The art only
    // decides how that body is expressed in its own frame pixels.
    const k = def.scale ?? 1;
    if (art) {
      // Production sheet: 2x art drawn at 0.5 (relative to the monster it was fitted for), feet on the shadow.
      const s = MONSTER_ART_DRAW_SCALE * (k / art.homeScale) * (art.displayScale ?? 1);
      const originY = (art.feetRow - (MONSTER_FEET_OFFSET * k) / s) / art.frameHeight;
      this.baseScale = s;
      this.setScale(s).setOrigin(0.5, originY);
      this.body.setSize((BODY.w * k) / s, (BODY.h * k) / s, false);
      this.body.setOffset(art.frameWidth / 2 + (BODY.x * k) / s, originY * art.frameHeight + (BODY.y * k) / s);
      this.restPose = { originX: this.displayOriginX, originY: this.displayOriginY, offsetX: this.body.offset.x, offsetY: this.body.offset.y };
    } else {
      // Placeholder 32 px blob: the body is (6, 18) 20x12 in frame pixels, scaled with the sprite.
      this.baseScale = k;
      if (k !== 1) {
        this.setScale(k);
        this.body.updateBounds();
      }
      this.body.setSize(BODY.w, BODY.h).setOffset(6, 18);
    }
    this.setCollideWorldBounds(true);
    this.setInteractive({ useHandCursor: true });

    // Real strips: MonsterAnimator sets every frame (idle included). Otherwise a looping idle animation.
    const idleKey = art ? `${art.key}-idle` : `${def.texture}-idle`;
    if (!this.strips && !scene.anims.exists(idleKey)) {
      scene.anims.create({
        key: idleKey,
        frames: art ? [0, 1].map((i) => ({ key: art.key, frame: i })) : [0, 1].map((i) => ({ key: def.texture, frame: `${def.texture}-${i}` })),
        // A slow breathing sway between the two idle poses; movement reuses it (no walk strip yet).
        frameRate: 3,
        repeat: -1,
      });
    }
    if (!this.strips) this.play({ key: idleKey, startFrame: Math.floor(Math.random() * 2) });
    this.restTint = resolved?.tint ?? null;
    this.resetTint();
    this.setDepth(this.y);
  }

  moveToward(x: number, y: number): void {
    const dx = x - this.x;
    const dy = y - this.y;
    const len = Math.hypot(dx, dy);
    if (len < ARRIVE_EPSILON) {
      this.halt();
      return;
    }
    const speed = this.combat.stats.moveSpeed;
    this.moveX = (dx / len) * speed;
    this.moveY = (dy / len) * speed;
    this.body.setVelocity(this.moveX, this.moveY);
    if (Math.abs(dx) > 1) this.setFlipX(dx < 0);
  }

  /** Face a point by mirroring (source art faces right); no rotation. Same rule as moving. */
  faceToward(x: number): void {
    if (Math.abs(x - this.x) > 1) this.setFlipX(x < this.x);
  }

  /** Show one frame of a real animation strip (no-op without strips). Same cell size: origin and body stay put. */
  showFrame(state: MonsterAnimState, frame: number): void {
    const key = this.strips?.[state];
    if (!key) return;
    if (this.texture.key !== key) this.setTexture(key, frame);
    else if (String(this.frame.name) !== String(frame)) this.setFrame(frame);
  }

  halt(): void {
    this.moveX = 0;
    this.moveY = 0;
    this.body.setVelocity(0, 0);
  }

  /** Final velocity = the brain's intended movement + separation from neighbours. */
  applySeparation(vx: number, vy: number): void {
    this.body.setVelocity(this.moveX + vx, this.moveY + vy);
  }

  snapToSpawn(): void {
    this.body.reset(this.spawnX, this.spawnY);
  }

  /**
   * Presentation pose (rendering/MonsterMotion.ts): the art moves by (dx, dy) world px and leans by
   * the rotation (radians) about its feet. The physics body never moves: the display origin and the body
   * offset shift by the same amount (Arcade bodies ignore rotation). No-op on placeholder art.
   */
  setPose(dx: number, dy: number, rotation: number): void {
    const rest = this.restPose;
    if (!rest || !this.body.enable) return;
    const sx = dx / this.baseScale, sy = dy / this.baseScale;
    if (this.displayOriginX !== rest.originX - sx || this.displayOriginY !== rest.originY - sy) {
      this.setDisplayOrigin(rest.originX - sx, rest.originY - sy);
      this.body.setOffset(rest.offsetX - sx, rest.offsetY - sy);
    }
    if (this.rotation !== rotation) this.setRotation(rotation);
  }

  /** Called when the combat system reports this monster died. */
  onDeath(): void {
    this.setPose(0, 0, 0);
    this.halt();
    this.body.enable = false;
    this.disableInteractive();
    this.anims.pause();
    this.deathTween = this.scene.tweens.add({
      targets: this,
      alpha: 0,
      scaleY: this.baseScale * 0.4,
      duration: 350,
      ease: 'Quad.easeIn',
      onComplete: () => this.setVisible(false),
    });
  }

  /** Removed with its map (possibly mid death-fade): stop the fade first. */
  destroy(fromScene?: boolean): void {
    this.deathTween?.stop();
    this.deathTween = null;
    super.destroy(fromScene);
  }

  respawn(): void {
    this.deathTween?.stop();
    this.deathTween = null;
    this.combat.reset();
    this.body.enable = true;
    this.setPose(0, 0, 0);
    this.snapToSpawn();
    this.setVisible(true).setAlpha(1).setScale(this.baseScale);
    this.resetTint();
    this.setInteractive({ useHandCursor: true });
    this.anims.resume();
  }

  resetTint(): void {
    this.setTintMode(Phaser.TintModes.MULTIPLY);
    const tint = multiplyTint(this.restTint, this.statusTint);
    if (tint === null) this.clearTint();
    else this.setTint(tint);
  }

  /**
   * Show (or clear) a status colour on the body, multiplied with the variant tint. Presentation only. A hit flash
   * in progress keeps its white fill; it restores this tint when it ends.
   */
  setStatusTint(color: number | null): void {
    if (color === this.statusTint) return;
    this.statusTint = color;
    if (this.tintMode !== Phaser.TintModes.FILL) this.resetTint();
  }
}

/** Channel-wise product of two multiply tints (null = white / none). */
function multiplyTint(a: number | null, b: number | null): number | null {
  if (a === null) return b;
  if (b === null) return a;
  const ch = (shift: number) => Math.round((((a >> shift) & 0xff) * ((b >> shift) & 0xff)) / 255) << shift;
  return ch(16) | ch(8) | ch(0);
}
