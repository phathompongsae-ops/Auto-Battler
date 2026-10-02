import Phaser from 'phaser';
import { CAMERA_LERP, TILE_SIZE } from '../config';
import { Player } from '../entities/Player';
import { TILESET_KEY } from '../graphics/placeholderTextures';
import { InputController } from '../input/InputController';
import { KeyboardSource } from '../input/KeyboardSource';
import { TouchDragSource } from '../input/TouchDragSource';
import { buildTestMap, SOLID_TILES, TEST_MAP_HEIGHT, TEST_MAP_WIDTH } from '../world/testMap';

export class WorldScene extends Phaser.Scene {
  player!: Player;
  controls!: InputController;
  private debugText!: Phaser.GameObjects.Text;

  constructor() {
    super('World');
  }

  create(): void {
    const map = this.make.tilemap({
      data: buildTestMap(),
      tileWidth: TILE_SIZE,
      tileHeight: TILE_SIZE,
    });
    const tileset = map.addTilesetImage(TILESET_KEY, TILESET_KEY, TILE_SIZE, TILE_SIZE, 0, 0);
    if (!tileset) throw new Error('Could not create tileset');
    const ground = map.createLayer(0, tileset, 0, 0);
    if (!ground) throw new Error('Could not create ground layer');
    ground.setCollision(SOLID_TILES);

    const worldWidth = TEST_MAP_WIDTH * TILE_SIZE;
    const worldHeight = TEST_MAP_HEIGHT * TILE_SIZE;
    this.physics.world.setBounds(0, 0, worldWidth, worldHeight);

    this.player = new Player(this, worldWidth / 2, worldHeight / 2 + TILE_SIZE * 4);
    this.physics.add.collider(this.player, ground);

    const camera = this.cameras.main;
    camera.setBounds(0, 0, worldWidth, worldHeight);
    camera.startFollow(this.player, true, CAMERA_LERP, CAMERA_LERP);

    this.controls = new InputController(new KeyboardSource(this), new TouchDragSource(this));
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.controls.destroy());

    if (import.meta.env.DEV) this.createDebugOverlay();
  }

  update(): void {
    this.player.move(this.controls.getDirection());
  }

  /** Dev-only readout of FPS and player state. */
  private createDebugOverlay(): void {
    this.debugText = this.add
      .text(8, 8, '', {
        fontFamily: 'monospace',
        fontSize: '12px',
        color: '#ffffff',
        backgroundColor: '#00000099',
        padding: { x: 6, y: 4 },
      })
      .setScrollFactor(0)
      .setDepth(Number.MAX_SAFE_INTEGER);
    this.time.addEvent({ delay: 250, loop: true, callback: this.updateDebugText, callbackScope: this });
    this.updateDebugText();
  }

  private updateDebugText(): void {
    const p = this.player;
    this.debugText.setText(
      `FPS ${this.game.loop.actualFps.toFixed(0)}  ${p.state} ${p.facing}  ` +
        `(${Math.round(p.x)}, ${Math.round(p.y)})\n` +
        'Move: WASD / arrows / drag',
    );
  }
}
