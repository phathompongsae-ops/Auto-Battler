import Phaser from 'phaser';
import { CAMERA_LERP, TILE_SIZE } from '../config';
import { MONSTERS } from '../data/monsterData';
import { DebugPanel } from '../debug/DebugPanel';
import { createDevApi } from '../debug/devApi';
import { Monster } from '../entities/Monster';
import { Player } from '../entities/Player';
import { CombatWorld } from '../game/CombatWorld';
import { TILESET_KEY } from '../graphics/placeholderTextures';
import { InputController } from '../input/InputController';
import { KeyboardActionSource } from '../input/KeyboardActionSource';
import { KeyboardSource } from '../input/KeyboardSource';
import { TouchDragSource } from '../input/TouchDragSource';
import { VirtualActionSource } from '../input/VirtualActionSource';
import { CombatEffects } from '../rendering/CombatEffects';
import { prewarmShaders } from '../rendering/prewarm';
import { WorldOverlays } from '../rendering/WorldOverlays';
import {
  buildTestMap,
  MONSTER_SPAWNS,
  PLAYER_SPAWN,
  PROJECTILE_BLOCKING_TILES,
  SOLID_TILES,
  TEST_MAP_HEIGHT,
  TEST_MAP_WIDTH,
  type Tile,
} from '../world/testMap';

/** Builds the map, entities and views, then drives CombatWorld each frame. */
export class WorldScene extends Phaser.Scene {
  player!: Player;
  controls!: InputController;
  /** For future on-screen buttons: press()/release() actions here. */
  virtualActions!: VirtualActionSource;
  world!: CombatWorld;
  private overlays!: WorldOverlays;

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

    this.player = new Player(this, PLAYER_SPAWN.x, PLAYER_SPAWN.y);
    this.physics.add.collider(this.player, ground);

    const camera = this.cameras.main;
    camera.setBounds(0, 0, worldWidth, worldHeight);
    camera.startFollow(this.player, true, CAMERA_LERP, CAMERA_LERP);

    this.virtualActions = new VirtualActionSource();
    this.controls = new InputController(
      [new KeyboardSource(this), new TouchDragSource(this)],
      [new KeyboardActionSource(this), this.virtualActions],
    );

    const projectileWorld = {
      blocksProjectile: (x: number, y: number) => {
        const tile = ground.getTileAtWorldXY(x, y);
        return !tile || PROJECTILE_BLOCKING_TILES.includes(tile.index as Tile);
      },
    };
    this.world = new CombatWorld(this.player, this.controls, projectileWorld, PLAYER_SPAWN);

    const monsters: Monster[] = [];
    MONSTER_SPAWNS.forEach((spawn, i) => {
      const x = spawn.tileX * TILE_SIZE + TILE_SIZE / 2;
      const y = spawn.tileY * TILE_SIZE + TILE_SIZE / 2;
      const monster = new Monster(this, `${spawn.monster}-${i + 1}`, MONSTERS[spawn.monster], x, y);
      monster.on(Phaser.Input.Events.GAMEOBJECT_POINTER_DOWN, () => this.world.targeting.select(monster));
      this.world.addMonster(monster);
      monsters.push(monster);
    });
    this.physics.add.collider(monsters, ground);

    new CombatEffects(this, this.world);
    this.overlays = new WorldOverlays(this, this.world);
    prewarmShaders(this);

    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.controls.destroy();
      this.world.events.clear();
    });

    if (import.meta.env.DEV) {
      new DebugPanel(this, this.world);
      (window as unknown as { debug: unknown }).debug = createDevApi(this.world, this.overlays);
    }
  }

  update(time: number, delta: number): void {
    this.world.update(time, delta, this.controls.getDirection());
    this.overlays.update(time);
  }
}
