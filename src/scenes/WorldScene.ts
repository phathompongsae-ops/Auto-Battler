import Phaser from 'phaser';
import { CAMERA_LERP, CAMERA_ZOOM, TILE_SIZE } from '../config';
import { presentationFor } from '../data/demoConfig';
import { STARTING_JOB } from '../data/jobData';
import { DEFAULT_MAP_ID, MAPS, mapSize, portalCenter, PROP_KINDS, type MapDef, type TileRect } from '../data/maps';
import { INTERNAL_DEMO_QUESTS, QUESTS } from '../data/questData';
import { MONSTERS } from '../data/monsterData';
import { DebugPanel } from '../debug/DebugPanel';
import { createDevApi } from '../debug/devApi';
import { Monster } from '../entities/Monster';
import { Player } from '../entities/Player';
import { CombatWorld, type WorldMapView } from '../game/CombatWorld';
import { isCharacterArtReady } from '../graphics/characterArt';
import { NPC_BASE_KEY, NPC_ROBE_KEY, TILESET_KEY } from '../graphics/placeholderTextures';
import { NPCS } from '../data/npcData';
import { npcMarker } from '../quests/questText';
import { propTextureKey } from '../graphics/propTextures';
import { envDrawScale } from '../graphics/environmentArt';
import { ENV_BUILDINGS, ENV_GROUND_MAP_IDS, ENV_GROUND_TILESET } from '../data/environmentArt';
import { groundVisuals } from '../world/groundVisuals';
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
/** Opacity of a tall prop / building while it covers the player. */
const OCCLUDER_ALPHA = 0.45;

/** A tilemap layer as created by Tilemap.createLayer (CPU or GPU variant). */
type GroundLayer = NonNullable<ReturnType<Phaser.Tilemaps.Tilemap['createLayer']>>;

/** The code-drawn ground layer; visual ground layers sit just above it, below shadows (-0.6). */
const GROUND_DEPTH = -1;
/** Flat ground decoration: above the tiles and shadows, below every prop and character. */
const PROP_GROUND_DEPTH = -0.5;

/**
 * Builds the current map, entities and views, then drives CombatWorld each
 * frame. One scene hosts every map: CombatWorld.enterMap() asks it (as the
 * WorldMapView) to swap tiles, collision, props, labels and monsters.
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
  /** Everything drawn for the current map besides tiles: props, markers, signs. */
  private mapVisuals: Phaser.GameObjects.GameObject[] = [];
  private monsterGroup!: Phaser.GameObjects.Group;
  /** Static bodies on the footprints of solid props (rebuilt with the map). */
  private propBodies!: Phaser.Physics.Arcade.StaticGroup;
  /** The code-drawn tile layer: collision source (and fallback visuals). */
  groundLayer: GroundLayer | null = null;
  /** Visual-only ground layers (2x tiles, transitions); never collide. */
  groundVisualLayers: GroundLayer[] = [];
  private visualTilemaps: Phaser.Tilemaps.Tilemap[] = [];
  /** Tall props and buildings that fade while they cover the player (readability over environment). */
  occluders: { image: Phaser.GameObjects.Image; bounds: Phaser.Geom.Rectangle }[] = [];
  /** Quest markers over the current map's NPCs. */
  private npcMarkers: { npcId: string; mark: Phaser.GameObjects.Text }[] = [];

  constructor() {
    super('World');
  }

  create(): void {
    this.monsterGroup = this.add.group();
    this.propBodies = this.physics.add.staticGroup();
    this.cameras.main.setZoom(CAMERA_ZOOM);
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
    for (const l of this.mapVisuals) l.destroy();
    this.colliders = [];
    this.mapVisuals = [];
    this.tilemap?.destroy();
    for (const t of this.visualTilemaps) t.destroy();
    this.visualTilemaps = [];
    this.groundVisualLayers = [];
    this.occluders = [];
    this.propBodies.clear(true, true);

    const tilemap = this.make.tilemap({ data: map.tiles.map((r) => [...r]), tileWidth: TILE_SIZE, tileHeight: TILE_SIZE });
    const tileset = tilemap.addTilesetImage(TILESET_KEY, TILESET_KEY, TILE_SIZE, TILE_SIZE, 0, 0);
    if (!tileset) throw new Error('Could not create tileset');
    const ground = tilemap.createLayer(0, tileset, 0, 0);
    if (!ground) throw new Error('Could not create ground layer');
    ground.setCollision(SOLID_TILES).setDepth(GROUND_DEPTH);
    this.tilemap = tilemap;
    this.groundLayer = ground;
    this.drawGroundVisuals(map);

    const { width, height } = mapSize(map);
    this.physics.world.setBounds(0, 0, width * TILE_SIZE, height * TILE_SIZE);
    this.cameras.main.setBounds(0, 0, width * TILE_SIZE, height * TILE_SIZE);
    this.colliders.push(
      this.physics.add.collider(this.player, ground),
      this.physics.add.collider(this.monsterGroup, ground),
      this.physics.add.collider(this.player, this.propBodies),
      this.physics.add.collider(this.monsterGroup, this.propBodies),
    );
    const covered = this.drawBuildings(map);
    this.drawProps(map, covered);
    this.drawLabels(map);
  }

  /**
   * Props: art bottom-centred on the footprint, depth-sorted with characters
   * (ground decoration stays under everyone). Solid props get a static body
   * on their footprint, matching the collision grid in world/mapRules.
   */
  private drawProps(map: MapDef, covered: readonly TileRect[] = []): void {
    for (const p of map.props) {
      const kind = PROP_KINDS[p.kind];
      // A building facade carries its own decoration: non-solid props on its footprint are hidden (no collision involved).
      if (!kind.solid && covered.some((r) => p.x >= r.x && p.y >= r.y && p.x + kind.w <= r.x + r.w && p.y + kind.h <= r.y + r.h)) continue;
      const cx = (p.x + kind.w / 2) * TILE_SIZE;
      const bottom = (p.y + kind.h) * TILE_SIZE;
      // Slightly above the footprint edge: a character whose feet touch it from the south draws in front.
      const depth = kind.ground ? PROP_GROUND_DEPTH : bottom - 6;
      const key = propTextureKey(p.kind);
      // 2x PNGs draw at half scale; the footprint (and so collision) is the same either way.
      const image = this.add.image(cx, bottom, key).setOrigin(0.5, 1).setScale(envDrawScale(this, key)).setDepth(depth);
      this.mapVisuals.push(image);
      if (kind.tall) this.addOccluder(image);
      if (!kind.solid) continue;
      const zone = this.add.zone(cx, (p.y + kind.h / 2) * TILE_SIZE, kind.w * TILE_SIZE, kind.h * TILE_SIZE);
      this.propBodies.add(zone);
    }
  }

  /**
   * The visual ground layer (2x tiles, variants, transitions) over the
   * code-drawn tile layer, on maps that have it. Visual only: no collision;
   * the code-drawn layer stays the collision source and shows through
   * wherever a cell has no visual tile. Unavailable (no PNG): nothing is added.
   */
  private drawGroundVisuals(map: MapDef): void {
    const ts = ENV_GROUND_TILESET;
    if (!ENV_GROUND_MAP_IDS.includes(map.id) || !this.textures.exists(ts.key)) return;
    const layers = groundVisuals(map.tiles);
    const scale = envDrawScale(this, ts.key);
    const grids = [layers.base, layers.dirtFringe, layers.grassFringe];
    grids.forEach((data, i) => {
      if (!data.some((row) => row.some((f) => f >= 0))) return;
      const tm = this.make.tilemap({ data: data.map((r) => [...r]), tileWidth: ts.frameSize, tileHeight: ts.frameSize });
      const tileset = tm.addTilesetImage(ts.key, ts.key, ts.frameSize, ts.frameSize, ts.margin, ts.spacing);
      const layer = tileset && tm.createLayer(0, tileset, 0, 0);
      if (!layer) {
        tm.destroy();
        return;
      }
      layer.setScale(scale).setDepth(GROUND_DEPTH + 0.05 * (i + 1));
      this.visualTilemaps.push(tm);
      this.groundVisualLayers.push(layer);
    });
  }

  /** Building facades (2x PNGs) over their Roof-tile footprints; returns the footprints covered. */
  private drawBuildings(map: MapDef): TileRect[] {
    const covered: TileRect[] = [];
    for (const b of ENV_BUILDINGS) {
      if (b.mapId !== map.id || !this.textures.exists(b.key)) continue;
      const f = b.footprint;
      const bottom = (f.y + f.h) * TILE_SIZE;
      const image = this.add
        .image((f.x + f.w / 2) * TILE_SIZE, bottom, b.key)
        .setOrigin(0.5, 1)
        .setScale(envDrawScale(this, b.key))
        .setDepth(bottom - 6);
      this.mapVisuals.push(image);
      this.addOccluder(image);
      covered.push(f);
    }
    return covered;
  }

  private addOccluder(image: Phaser.GameObjects.Image): void {
    this.occluders.push({ image, bounds: image.getBounds() });
  }

  /**
   * A tall prop or building drawn over the player (player behind it) fades so
   * the character stays readable; it is opaque again once the player is clear.
   */
  private updateOccluders(): void {
    const p = this.player;
    const top = p.y - p.layout.height + p.layout.feetOffset;
    for (const { image, bounds } of this.occluders) {
      const covers = image.depth > p.depth && p.x > bounds.left && p.x < bounds.right && p.y + p.layout.feetOffset > bounds.top && top < bounds.bottom;
      const alpha = covers ? OCCLUDER_ALPHA : 1;
      if (image.alpha !== alpha) image.setAlpha(alpha);
    }
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

  /** PLACEHOLDER signage: a marker and name for every navigation target and portal, plus landmark names. */
  private drawLabels(map: MapDef): void {
    const text = (x: number, y: number, value: string, color: string, size: number) =>
      this.add
        .text(x, y, value, {
          fontFamily: 'monospace',
          fontSize: `${size}px`,
          fontStyle: 'bold',
          color,
          stroke: '#1d1b26',
          strokeThickness: 3,
          resolution: 2,
        })
        .setOrigin(0.5, 1)
        .setDepth(LABEL_DEPTH);
    const marker = (x: number, y: number, value: string, color: number) => {
      const dot = this.add.circle(x, y, 4, color, 0.9).setStrokeStyle(1, 0x1d1b26).setDepth(LABEL_DEPTH - 1);
      this.mapVisuals.push(dot, text(x, y - 8, value, '#f4ecdb', 9));
    };
    for (const t of map.navigationTargets) {
      // NPCs are drawn as figures with their own name plate (see drawNpcs).
      if (t.npcId && Object.values(NPCS).some((n) => n.navTargetId === t.id)) continue;
      if (t.meta?.label) marker(t.x, t.y, t.meta.label, t.type === 'monster_zone' ? 0xff8a65 : t.type === 'station' ? 0x7fd4ff : 0xf3d898);
    }
    for (const p of map.portals) {
      const c = portalCenter(p);
      marker(c.x, c.y, p.label, 0xb388ff);
    }
    for (const l of map.landmarks ?? []) this.mapVisuals.push(text(l.x, l.y, l.label.toUpperCase(), '#f3d898', 10));
    this.drawNpcs(map, text);
  }

  /** NPC figures with name plates and a quest marker ('!' offered, '?' ready to turn in) kept in sync each frame. */
  private drawNpcs(map: MapDef, text: (x: number, y: number, value: string, color: string, size: number) => Phaser.GameObjects.Text): void {
    this.npcMarkers = [];
    for (const npc of Object.values(NPCS)) {
      const at = this.world.npcPosition(npc.id);
      if (!at || at.mapId !== map.id) continue;
      const feet = at.y + 6;
      const base = this.add.image(at.x, feet, NPC_BASE_KEY).setOrigin(0.5, 1).setDepth(feet);
      const robe = this.add.image(at.x, feet, NPC_ROBE_KEY).setOrigin(0.5, 1).setDepth(feet + 0.1).setTint(npc.color);
      const name = text(at.x, feet - 46, npc.name, '#ffe9a8', 9);
      const role = text(at.x, feet - 36, npc.title, '#c9d1e3', 8);
      const mark = text(at.x, feet - 56, '', '#ffd23f', 18).setVisible(false);
      this.tweens.add({ targets: mark, y: feet - 60, yoyo: true, repeat: -1, duration: 500, ease: 'Sine.easeInOut' });
      this.mapVisuals.push(base, robe, name, role, mark);
      this.npcMarkers.push({ npcId: npc.id, mark });
    }
  }

  private updateNpcMarkers(): void {
    for (const { npcId, mark } of this.npcMarkers) {
      const m = npcMarker(this.world.quests, npcId);
      if (!m) {
        if (mark.visible) mark.setVisible(false);
        continue;
      }
      if (mark.text !== m) mark.setText(m).setColor(m === '?' ? '#7ee787' : '#ffd23f');
      if (!mark.visible) mark.setVisible(true);
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
    this.updateNpcMarkers();
    this.updateOccluders();
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
