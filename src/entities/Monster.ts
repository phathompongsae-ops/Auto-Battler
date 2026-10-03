import Phaser from 'phaser';
import type { MonsterAgent, MonsterBrain } from '../ai/MonsterBrain';
import { CombatantState } from '../combat/CombatantState';
import { applyStatusModifiers } from '../combat/stats';
import { monsterCombatStats, type MonsterDef } from '../data/monsterData';

const ARRIVE_EPSILON = 2; // px

/** Physics body + visuals for one monster. Behaviour lives in MonsterBrain. */
export class Monster extends Phaser.Physics.Arcade.Sprite implements MonsterAgent {
  readonly combat: CombatantState;
  readonly hitRadius: number;
  /** Original spawn from map data (spawnX/Y can be moved by debug tools). */
  readonly homeX: number;
  readonly homeY: number;
  brain!: MonsterBrain;

  declare body: Phaser.Physics.Arcade.Body;

  private deathTween: Phaser.Tweens.Tween | null = null;
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
    super(scene, spawnX, spawnY, def.texture, `${def.texture}-0`);
    scene.add.existing(this);
    scene.physics.add.existing(this);

    const stats = monsterCombatStats(def.stats);
    this.combat = new CombatantState(id, def.name, 'monster', (_level, statuses) => applyStatusModifiers(stats, statuses), def.level);
    this.hitRadius = def.hitRadius;
    this.homeX = spawnX;
    this.homeY = spawnY;

    this.body.setSize(20, 12).setOffset(6, 18);
    this.setCollideWorldBounds(true);
    this.setInteractive({ useHandCursor: true });

    const idleKey = `${def.texture}-idle`;
    if (!scene.anims.exists(idleKey)) {
      scene.anims.create({
        key: idleKey,
        frames: [0, 1].map((i) => ({ key: def.texture, frame: `${def.texture}-${i}` })),
        frameRate: 3,
        repeat: -1,
      });
    }
    this.play({ key: idleKey, startFrame: Math.floor(Math.random() * 2) });
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
      scaleY: 0.4,
      duration: 350,
      ease: 'Quad.easeIn',
      onComplete: () => this.setVisible(false),
    });
  }

  respawn(): void {
    this.deathTween?.stop();
    this.deathTween = null;
    this.combat.reset();
    this.body.enable = true;
    this.snapToSpawn();
    this.setVisible(true).setAlpha(1).setScale(1);
    this.resetTint();
    this.setInteractive({ useHandCursor: true });
    this.anims.resume();
  }

  resetTint(): void {
    this.setTintMode(Phaser.TintModes.MULTIPLY);
    this.clearTint();
  }
}
