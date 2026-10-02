import Phaser from 'phaser';
import { PLAYER_SPEED, PLAYER_WALK_FPS } from '../config';
import { PLAYER_KEY, playerFrame } from '../graphics/placeholderTextures';
import { DIRECTIONS, DIRECTION_VECTORS, type Direction } from '../input/Direction';

export type PlayerState = 'idle' | 'walk';

const animKey = (state: PlayerState, dir: Direction) => `player-${state}-${dir}`;

export class Player extends Phaser.Physics.Arcade.Sprite {
  state: PlayerState = 'idle';
  facing: Direction = 'down';

  declare body: Phaser.Physics.Arcade.Body;

  constructor(scene: Phaser.Scene, x: number, y: number) {
    super(scene, x, y, PLAYER_KEY, playerFrame('down', 0));
    scene.add.existing(this);
    scene.physics.add.existing(this);

    // Collide with the feet only, so the head can overlap walls above.
    this.body.setSize(16, 10).setOffset(8, 20);
    this.setCollideWorldBounds(true);

    Player.createAnimations(scene);
    this.play(animKey('idle', 'down'));
  }

  /** Apply one frame of movement intent. Pass null to stand still. */
  move(direction: Direction | null): void {
    if (direction) {
      const v = DIRECTION_VECTORS[direction];
      this.body.setVelocity(v.x * PLAYER_SPEED, v.y * PLAYER_SPEED);
      this.facing = direction;
      this.setPlayerState('walk');
    } else {
      this.body.setVelocity(0, 0);
      this.setPlayerState('idle');
    }
    // Draw order follows the feet so the player sorts correctly with props later.
    this.setDepth(this.y);
  }

  private setPlayerState(state: PlayerState): void {
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
