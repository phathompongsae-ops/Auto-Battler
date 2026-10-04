import Phaser from 'phaser';
import { CAMERA_LERP, TILE_SIZE } from '../config';
import { presentationFor } from '../data/demoConfig';
import { STARTING_JOB } from '../data/jobData';
import { MONSTERS } from '../data/monsterData';
import { DebugPanel } from '../debug/DebugPanel';
import { createDevApi } from '../debug/devApi';
import { Monster } from '../entities/Monster';
import { Player } from '../entities/Player';
import { CombatWorld } from '../game/CombatWorld';
import { isCharacterArtReady } from '../graphics/characterArt';
import { TILESET_KEY } from '../graphics/placeholderTextures';
import { InputController } from '../input/InputController';
import { tileGrid } from '../navigation/pathing';
import { KeyboardActionSource } from '../input/KeyboardActionSource';
import { KeyboardSource } from '../input/KeyboardSource';
import { TouchDragSource } from '../input/TouchDragSource';
import { VirtualActionSource } from '../input/VirtualActionSource';
import { ActionEffects } from '../rendering/ActionEffects';
import { CombatEffects } from '../rendering/CombatEffects';
import { prewarmShaders } from '../rendering/prewarm';
import { WorldOverlays } from '../rendering/WorldOverlays';
import { Hud } from '../ui/hud/Hud';
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
  hud!: Hud;

  constructor() {
    super('World');
  }

  create(): void {
    const tiles = buildTestMap();
    const map = this.make.tilemap({
      data: tiles,
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

    // A new character is a Novice; its presentation is the temporary Warrior fallback (see demoConfig).
    // Each Class 1 job has its own sprite set; syncClassArt() swaps it in when the job changes or a save loads.
    const demoArt = presentationFor(STARTING_JOB).art;
    const playerArt = isCharacterArtReady(this, demoArt) ? demoArt : null;
    this.player = new Player(this, PLAYER_SPAWN.x, PLAYER_SPAWN.y, playerArt);
    this.physics.add.collider(this.player, ground);

    const camera = this.cameras.main;
    camera.setBounds(0, 0, worldWidth, worldHeight);
    camera.startFollow(this.player, true, CAMERA_LERP, CAMERA_LERP);

    this.virtualActions = new VirtualActionSource();
    const drag = new TouchDragSource(this);
    this.controls = new InputController(
      [new KeyboardSource(this), drag],
      [new KeyboardActionSource(this), this.virtualActions],
    );

    const projectileWorld = {
      blocksProjectile: (x: number, y: number) => {
        const tile = ground.getTileAtWorldXY(x, y);
        return !tile || PROJECTILE_BLOCKING_TILES.includes(tile.index as Tile);
      },
    };
    // DEMO: every demo map id is hosted by this one prototype map, so they share its collision.
    const navGrid = tileGrid(tiles, TILE_SIZE, SOLID_TILES);
    this.world = new CombatWorld(this.player, this.controls, projectileWorld, PLAYER_SPAWN, () => navGrid);
    // Skill animations are presentation only; damage timing stays with the simulation.
    this.world.events.on('skillUsed', ({ casterId, skillId }) => {
      if (casterId === this.player.id) this.player.playSkillAction(skillId);
    });

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
    new ActionEffects(this, this.world);
    this.overlays = new WorldOverlays(this, this.world);
    this.hud = new Hud(this, {
      world: this.world,
      art: playerArt,
      actions: this.virtualActions,
      drag,
      tiles: buildTestMap(),
      areaName: 'Green Meadow',
    });
    prewarmShaders(this);

    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.hud.destroy();
      this.controls.destroy();
      this.world.events.clear();
    });

    if (import.meta.env.DEV) {
      new DebugPanel(this, this.world);
      (window as unknown as { debug: unknown }).debug = createDevApi(this.world, this.overlays);
    }
  }

  update(_time: number, delta: number): void {
    this.syncClassArt();
    this.world.update(delta, this.controls.getMove());

    // Hit stop freezes the simulation; keep physics in step with it.
    const physics = this.physics.world;
    if (this.world.frozen && !physics.isPaused) physics.pause();
    else if (!this.world.frozen && physics.isPaused) physics.resume();

    this.overlays.update(this.world.now);
    this.hud.update(this.world.now);
  }

  /**
   * Draw the player with its class's sprite set. Checked every frame so a
   * Job Change, a loaded save or a debug reset all switch the art the same
   * way. Placeholder mode (no art loaded) is left alone.
   */
  private syncClassArt(): void {
    const art = presentationFor(this.player.progress.classId).art;
    if (this.player.currentArt && art !== this.player.currentArt && isCharacterArtReady(this, art)) this.player.setArt(art);
  }
}
