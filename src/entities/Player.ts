import Phaser from 'phaser';
import { PLAYER_WALK_FPS } from '../config';
import { CombatantState } from '../combat/CombatantState';
import { statsForLevel } from '../combat/stats';
import type { CombatEntity } from '../combat/types';
import { PLAYER_BASE_STATS, PLAYER_GROWTH, PLAYER_HIT_RADIUS } from '../data/playerData';
import { PLAYER_KEY, playerFrame } from '../graphics/placeholderTextures';
import { DIRECTIONS, DIRECTION_VECTORS, type Direction } from '../input/Direction';

export type PlayerState = 'idle' | 'walk' | 'dead';

const animKey = (state: 'idle' | 'walk', dir: Direction) => `player-${state}-${dir}`;

const DEAD_TINT = 0x666677;

export class Player extends Phaser.Physics.Arcade.Sprite implements CombatEntity {
  readonly id = 'player';
  readonly hitRadius = PLAYER_HIT_RADIUS;
  readonly combat: CombatantState;

  state: PlayerState = 'idle';
  facing: Direction = 'down';

  declare body: Phaser.Physics.Arcade.Body;

  constructor(scene: Phaser.Scene, x: number, y: number) {
    super(scene, x, y, PLAYER_KEY, playerFrame('down', 0));
    scene.add.existing(this);
    scene.physics.add.existing(this);

    this.combat = new CombatantState('player', 'Player', 'player', (level) =>
      statsForLevel(PLAYER_BASE_STATS, PLAYER_GROWTH, level),
    );

    // Collide with the feet only, so the head can overlap walls above.
    this.body.setSize(16, 10).setOffset(8, 20);
    this.setCollideWorldBounds(true);

    Player.createAnimations(scene);
    this.play(animKey('idle', 'down'));
  }

  /** Apply one frame of movement intent. Pass null to stand still. */
  move(direction: Direction | null): void {
    if (this.combat.dead) {
      this.body.setVelocity(0, 0);
      return;
    }
    if (direction) {
      const v = DIRECTION_VECTORS[direction];
      const speed = this.combat.stats.moveSpeed;
      this.body.setVelocity(v.x * speed, v.y * speed);
      this.facing = direction;
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
    if (this.state !== 'dead') this.play(animKey(this.state, this.facing), true);
  }

  die(): void {
    this.state = 'dead';
    this.body.setVelocity(0, 0);
    this.anims.stop();
    this.setFrame(playerFrame('down', 0));
    this.setAngle(90);
    this.resetTint();
  }

  respawn(x: number, y: number): void {
    this.combat.reset();
    this.body.reset(x, y);
    this.setAngle(0);
    this.state = 'idle';
    this.facing = 'down';
    this.resetTint();
    this.play(animKey('idle', 'down'));
  }

  /** Restore the normal tint after a hit flash. */
  resetTint(): void {
    this.setTintMode(Phaser.TintModes.MULTIPLY);
    if (this.combat.dead) this.setTint(DEAD_TINT);
    else this.clearTint();
  }

  private setPlayerState(state: 'idle' | 'walk'): void {
    this.state = state;
    // ignoreIfPlaying keeps the walk cycle running instead of restarting it.
    this.play(animKey(state, this.facing), true);
  }

  private static createAnimations(scene: Phaser.Scene): void {
    if (scene.anims.exists(animKey('idle', 'down'))) return;

    for (const dir of DIRECTIONS) {
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
