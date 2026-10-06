import Phaser from 'phaser';
import { CAMERA_LERP, TILE_SIZE } from '../config';
import { presentationFor } from '../data/demoConfig';
import { STARTING_JOB } from '../data/jobData';
import { DEFAULT_MAP_ID, MAPS, mapSize, portalCenter, type MapDef } from '../data/maps';
import { INTERNAL_DEMO_QUESTS, QUESTS } from '../data/questData';
import { MONSTERS } from '../data/monsterData';
import { DebugPanel } from '../debug/DebugPanel';
import { createDevApi } from '../debug/devApi';
import { Monster } from '../entities/Monster';
import { Player } from '../entities/Player';
import { CombatWorld, type WorldMapView } from '../game/CombatWorld';
import { isCharacterArtReady } from '../graphics/characterArt';
import { TILESET_KEY } from '../graphics/placeholderTextures';
import { InputController } from '../input/InputController';
import { KeyboardActionSource } from '../input/KeyboardActionSource';
import { KeyboardSource } from '../input/KeyboardSource';
import { TouchDragSource } from '../input/TouchDragSource';
import { VirtualActionSource } from '../input/VirtualActionSource';
import { ActionEffects } from '../rendering/ActionEffects';
import { CombatEffects } from '../rendering/CombatEffects';
import { prewarmShaders } from '../rendering/prewarm';
import { WorldOverlays } from '../rendering/WorldOverlays';
import { Hud } from '../ui/hud/Hud';
import type { MonsterSpawn } from '../world/mapRules';
import { SOLID_TILES } from '../world/tiles';

/** Depth of the placeholder map labels: above the ground, below characters' bars. */
const LABEL_DEPTH = 900_000;

/**
 * Builds the current map, entities and views, then drives CombatWorld each
 * frame. One scene hosts every map: CombatWorld.enterMap() asks it (as the
 * WorldMapView) to swap tiles, collision, labels and monsters.
 */
export class WorldScene extends Phaser.Scene implements WorldMapView {
  player!: Player;
  controls!: InputController;
  /** For future on-screen buttons: press()/release() actions here. */
  virtualActions!: VirtualActionSource;
  world!: CombatWorld;
  private overlays!: WorldOverlays;
  hud!: Hud;

  private tilemap: Phaser.Tilemaps.Tilemap | null = null;
  private colliders: Phaser.Physics.Arcade.Collider[] = [];
  private labels: Phaser.GameObjects.GameObject[] = [];
  private monsterGroup!: Phaser.GameObjects.Group;

  constructor() {
    super('World');
  }

  create(): void {
    this.monsterGroup = this.add.group();
    const start = MAPS[DEFAULT_MAP_ID].spawnPoint;

    // A new character is a Novice; its presentation is the temporary Warrior fallback (see demoConfig).
    // Each Class 1 job has its own sprite set; syncClassArt() swaps it in when the job changes or a save loads.
    const demoArt = presentationFor(STARTING_JOB).art;
    const playerArt = isCharacterArtReady(this, demoArt) ? demoArt : null;
    this.player = new Player(this, start.x, start.y, playerArt);
    this.cameras.main.startFollow(this.player, true, CAMERA_LERP, CAMERA_LERP);

    this.virtualActions = new VirtualActionSource();
    const drag = new TouchDragSource(this);
    this.controls = new InputController(
      [new KeyboardSource(this), drag],
      [new KeyboardActionSource(this), this.virtualActions],
    );

    const fixtureQuests = import.meta.env.DEV && new URLSearchParams(window.location.search).has('questFixtures');
    this.world = new CombatWorld(this.player, this.controls, this, fixtureQuests ? QUESTS : INTERNAL_DEMO_QUESTS);
    // Skill animations are presentation only; damage timing stays with the simulation.
    this.world.events.on('skillUsed', ({ casterId, skillId }) => {
      if (casterId === this.player.id) this.player.playSkillAction(skillId);
    });
    // A new game starts in Town.
    this.world.enterMap(DEFAULT_MAP_ID);

    new CombatEffects(this, this.world);
    new ActionEffects(this, this.world);
    this.overlays = new WorldOverlays(this, this.world);
    this.hud = new Hud(this, {
      world: this.world,
      art: playerArt,
      actions: this.virtualActions,
      drag,
      fixtureQuests,
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

  // --- WorldMapView ---------------------------------------------------------

  build(map: MapDef): void {
    for (const c of this.colliders) c.destroy();
    for (const l of this.labels) l.destroy();
    this.colliders = [];
    this.labels = [];
    this.tilemap?.destroy();

    const tilemap = this.make.tilemap({ data: map.tiles.map((r) => [...r]), tileWidth: TILE_SIZE, tileHeight: TILE_SIZE });
    const tileset = tilemap.addTilesetImage(TILESET_KEY, TILESET_KEY, TILE_SIZE, TILE_SIZE, 0, 0);
    if (!tileset) throw new Error('Could not create tileset');
    const ground = tilemap.createLayer(0, tileset, 0, 0);
    if (!ground) throw new Error('Could not create ground layer');
    ground.setCollision(SOLID_TILES).setDepth(-1);
    this.tilemap = tilemap;

    const { width, height } = mapSize(map);
    this.physics.world.setBounds(0, 0, width * TILE_SIZE, height * TILE_SIZE);
    this.cameras.main.setBounds(0, 0, width * TILE_SIZE, height * TILE_SIZE);
    this.colliders.push(this.physics.add.collider(this.player, ground), this.physics.add.collider(this.monsterGroup, ground));
    this.drawLabels(map);
  }

  createMonster(spawn: MonsterSpawn): Monster {
    const monster = new Monster(this, spawn.id, MONSTERS[spawn.monsterId], spawn.x, spawn.y);
    monster.on(Phaser.Input.Events.GAMEOBJECT_POINTER_DOWN, () => this.world.targeting.select(monster));
    this.monsterGroup.add(monster);
    return monster;
  }

  entered(): void {
    // Snap instead of panning across the new map from the old position.
    this.cameras.main.centerOn(this.player.x, this.player.y);
  }

  /** PLACEHOLDER signage: a marker and name for every navigation target and portal of the map. */
  private drawLabels(map: MapDef): void {
    const label = (x: number, y: number, text: string, color: number) => {
      const dot = this.add.circle(x, y, 5, color, 0.85).setStrokeStyle(1, 0x1d1b26).setDepth(LABEL_DEPTH - 1);
      const name = this.add
        .text(x, y - 10, text, { fontFamily: 'monospace', fontSize: '11px', color: '#f4ecdb', backgroundColor: 'rgba(29,27,38,0.65)', padding: { x: 3, y: 1 } })
        .setOrigin(0.5, 1)
        .setDepth(LABEL_DEPTH);
      this.labels.push(dot, name);
    };
    for (const t of map.navigationTargets) {
      if (t.meta?.label) label(t.x, t.y, t.meta.label, t.type === 'monster_zone' ? 0xff8a65 : t.type === 'station' ? 0x7fd4ff : 0xf3d898);
    }
    for (const p of map.portals) {
      const c = portalCenter(p);
      label(c.x, c.y, p.label, 0xb388ff);
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
