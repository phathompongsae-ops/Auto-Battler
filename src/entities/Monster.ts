import Phaser from 'phaser';
import type { MonsterAgent, MonsterBrain } from '../ai/MonsterBrain';
import { CombatantState } from '../combat/CombatantState';
import { applyStatusModifiers } from '../combat/stats';
import { monsterCombatStats, type MonsterDef } from '../data/monsterData';
import type { PxRect } from '../world/encounters';
import { MONSTER_ART_DRAW_SCALE, MONSTER_ART_TINT } from '../data/monsterArt';
import { loadedMonsterArt } from '../graphics/monsterArt';

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

  private deathTween: Phaser.Tweens.Tween | null = null;
  /** Sprite scale at rest (art draw scale, or the placeholder tier scale); death squashes from it. */
  private baseScale = 1;
  /** Multiply tint a variant keeps between hit flashes (see MONSTER_ART_TINT); null = none. */
  private restTint: number | null = null;
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
    const art = loadedMonsterArt(scene, def.texture);
    super(scene, spawnX, spawnY, art ? art.key : def.texture, art ? 0 : `${def.texture}-0`);
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
      const s = MONSTER_ART_DRAW_SCALE * (k / art.homeScale);
      const originY = (art.feetRow - (MONSTER_FEET_OFFSET * k) / s) / art.frameHeight;
      this.baseScale = s;
      this.setScale(s).setOrigin(0.5, originY);
      this.body.setSize((BODY.w * k) / s, (BODY.h * k) / s, false);
      this.body.setOffset(art.frameWidth / 2 + (BODY.x * k) / s, originY * art.frameHeight + (BODY.y * k) / s);
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

    const idleKey = art ? `${art.key}-idle` : `${def.texture}-idle`;
    if (!scene.anims.exists(idleKey)) {
      scene.anims.create({
        key: idleKey,
        frames: art ? [0, 1].map((i) => ({ key: art.key, frame: i })) : [0, 1].map((i) => ({ key: def.texture, frame: `${def.texture}-${i}` })),
        // A slow breathing sway between the two idle poses; movement reuses it (no walk strip yet).
        frameRate: 3,
        repeat: -1,
      });
    }
    this.play({ key: idleKey, startFrame: Math.floor(Math.random() * 2) });
    if (art) this.restTint = MONSTER_ART_TINT[def.id] ?? null;
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

  /** Called when the combat system reports this monster died. */
  onDeath(): void {
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
    this.snapToSpawn();
    this.setVisible(true).setAlpha(1).setScale(this.baseScale);
    this.resetTint();
    this.setInteractive({ useHandCursor: true });
    this.anims.resume();
  }

  resetTint(): void {
    this.setTintMode(Phaser.TintModes.MULTIPLY);
    if (this.restTint === null) this.clearTint();
    else this.setTint(this.restTint);
  }
}
