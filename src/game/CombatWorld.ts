import { MonsterBrain, type MonsterAgent, type MonsterWorld } from '../ai/MonsterBrain';
import { separate } from '../ai/separation';
import { CombatSystem } from '../combat/CombatSystem';
import { DodgeSystem } from '../combat/DodgeSystem';
import { AutoPotion, PotionSystem, preferredPotion } from '../items/PotionSystem';
import { ProjectileSystem } from '../combat/ProjectileSystem';
import { SkillSystem } from '../combat/SkillSystem';
import { StatusSystem } from '../combat/StatusSystem';
import { TargetingSystem } from '../combat/TargetingSystem';
import type { CombatEntity, EntityId } from '../combat/types';
import { EventBus } from '../core/EventBus';
import type { Point } from '../core/math';
import { distance } from '../core/math';
import { defaultRng, type Rng } from '../core/rng';
import type { ItemId } from '../data/itemData';
import { MONSTER_SEPARATION_STRENGTH, MONSTERS, type MonsterDef } from '../data/monsterData';
import { DemoTestMode } from '../data/demoTestMode';
import { PLAYER_RESPAWN_DELAY, TARGETING } from '../data/playerData';
import type { Monster } from '../entities/Monster';
import type { Player } from '../entities/Player';
import type { InputController } from '../input/InputController';
import { Inventory } from '../loot/Inventory';
import { Wallet } from '../economy/Wallet';
import { OffsetClock } from '../core/clock';
import { ClockServerDay } from '../core/serverDay';
import { FieldEnergy, type RewardZone } from '../energy/fieldEnergy';
import { DailyState } from '../daily/DailyState';
import { DungeonEntitlements } from '../dungeon/entitlements';
import { claimDungeonClear, type DungeonClaimResult } from '../dungeon/claim';
import { profiledMonsterDef, selectEncounterProfile, type EncounterProfileId } from '../dungeon/encounterProfile';
import { DIFFICULTIES, type DifficultyId } from '../data/dungeonDifficulty';
import { activeGates, closedGateAt } from '../dungeon/gates';
import { dueTutorialBeats, type TutorialMoment } from '../dungeon/tutorial';
import { STORY_ENCOUNTERS } from '../data/storyEncounters';
import { checkpointReady, DungeonAttempt, partyDefeated, RETRY_HP_FRACTION, RETRY_MP_FRACTION, type WipeOutcome } from '../dungeon/attempt';
import { SpecialShop } from '../pets/specialShop';
import { RewardLedger, type DungeonRun } from '../dungeon/rewards';
import { CraftingQueue } from '../crafting/crafting';
import { defaultUnlocks } from '../warp/warp';
import { LootSystem, type LootDrop } from '../loot/LootSystem';
import { Bag } from '../inventory/Bag';
import { createEquipment, randomIdSource, type IdSource } from '../equipment/factory';
import { useItem as applyItem, type UseItemResult } from '../items/useItem';
import { ProgressionSystem } from '../progression/ProgressionSystem';
import { allocateStat } from '../progression/statActions';
import { JobChange } from '../progression/JobChange';
import { SkillTree } from '../skills/SkillTree';
import { SkillProcs } from '../skills/SkillProcs';
import { SKILLS } from '../data/skillData';
import { deserializePlayerSave, serializePlayerSave } from '../save/playerSave';
import { applyPlayerSave, capturePlayerSave, emptyHooks, type PersistedHooks, type SaveTarget } from '../save/playerSnapshot';
import type { PrimaryStat } from '../stats/primaryStats';
import type { GameEvents } from './GameEvents';
import { grantKillRewards } from './killRewards';
import { INTERNAL_DEMO_QUESTS, type QuestDef } from '../data/questData';
import { FeatureUnlocks } from '../features/FeatureUnlocks';
import { QuestSystem, type QuestRewardSink } from '../quests/QuestSystem';
import { FeatureProgression } from '../features/FeatureProgression';
import { PlayerActions } from './PlayerActions';
import { JOBS } from '../data/jobData';
import type { EquipmentSlot } from '../data/equipmentData';
import type { EggTier } from '../data/petData';
import { RecurringQuests } from '../quests/RecurringQuests';
import { NAVIGATION } from '../data/navigationData';
import { DEFAULT_MAP_ID, type MapDef } from '../data/maps';
import { NAV_DEFAULT_RADIUS, type NavPoint, type NavTarget } from '../data/navigationData';
import { NPC_INTERACT_RADIUS, NPCS, type NpcDef } from '../data/npcData';
import { DUNGEON_WARPS, type Location } from '../data/warpData';
import { AutoMove } from '../navigation/AutoMove';
import { NavIndex, portalTransition } from '../navigation/NavIndex';
import { LPathPlanner } from '../navigation/pathing';
import { MapSession } from '../world/MapSession';
import { checkMapEntry, type AccessResult } from '../world/dungeonAccess';
import { inTileRect, withinEncounter } from '../world/encounters';
import { blocksProjectile, mapCollision, portalAt, resolveMapEntry, type MapEntryFallback, type MonsterSpawn } from '../world/mapRules';
import type { EnhanceOptions } from '../equipment/enhancement';
import { PlayerCombatController } from './PlayerCombatController';

/** How long an enrage lasts (effectively until death or a leash reset). */
const ENRAGE_MS = 10 * 60 * 1000;

/** What CombatWorld needs from the scene to load a map: its tiles / collision / visuals, and monster entities. */
export interface WorldMapView {
  /** Tear down the previous map's tiles, collision and visuals; build `map`'s. */
  build(map: MapDef): void;
  /** A monster entity for one spawn, built from `def` (its encounter profile applied; not yet registered with the world). */
  createMonster(spawn: MonsterSpawn, def: MonsterDef): Monster;
  /** The player was placed on the new map (camera snap, HUD...). */
  entered(map: MapDef): void;
}

/**
 * Owns every gameplay system and runs one simulation step per frame.
 * The scene builds entities and views; everything rule-related happens here
 * or in the systems, so it can later move behind a network boundary.
 */
export class CombatWorld implements MonsterWorld {
  readonly events = new EventBus<GameEvents>();
  readonly combat = new CombatSystem(this.events);
  readonly statuses = new StatusSystem(this.events, this.combat);
  readonly projectiles = new ProjectileSystem(this.events, this.combat, this.statuses);
  readonly skills = new SkillSystem(this.events, this.combat, this.statuses, this.projectiles, {
    actionDuration: (caster, id) => caster === this.player ? this.player.skillActionDuration(id) : 0,
    resolve: (caster, skillId) => (caster === this.player ? this.skillTree.resolve(skillId) : SKILLS[skillId]),
    entities: () => this.combatants,
    dash: (caster, target, maxDistance) => this.dash(caster, target, maxDistance),
  });
  readonly targeting = new TargetingSystem(this.events, TARGETING.acquireRange, TARGETING.loseRange);
  readonly dodge = new DodgeSystem({
    blocked: (actor, x, y) => this.movementBlocked(actor, x, y),
    move: (actor, x, y) => {
      // Engine adapter; the ability itself has no player/Phaser dependency.
      const body = (actor as Player | Monster).body;
      body.reset(x, y);
    },
  });
  readonly inventory = new Inventory();
  readonly potions = new PotionSystem(this.events, () => this.now);
  readonly autoPotions = new AutoPotion();
  private readonly autoUsePotion = (id: ItemId) => this.usePlayerItem(id);
  readonly demoTestMode = new DemoTestMode();
  /** Currencies (gold). */
  readonly wallet = new Wallet();
  /**
   * Calendar time for shop refresh / crafting. DEMO: local clock (untrusted);
   * the offset lets dev tools simulate time. A server will own this later.
   */
  readonly clock = new OffsetClock();
  /** Server day (level cap, daily Energy). DEMO: from the clock; dev tools may override it. */
  readonly serverDay = new ClockServerDay(this.clock);
  readonly progression = new ProgressionSystem(this.events, this.serverDay);
  /** Every per-day allowance, reset together when the server day changes. */
  readonly daily = new DailyState(this.serverDay);
  /** Daily budget for field farming rewards. */
  readonly fieldEnergy = new FieldEnergy(this.daily);
  /** Daily dungeon Full Reward / Assist entitlements. */
  readonly dungeonEntitlements = new DungeonEntitlements(this.daily);
  /** Dev/test override of the reward zone (null = decided by the map and the run). */
  zoneOverride: RewardZone | null = null;
  /** Reward rules for kills: 'dungeon' on a dungeon map or during a run (nothing granted, no Field Energy); otherwise 'field'. */
  get zone(): RewardZone {
    return this.zoneOverride ?? (this.dungeonRun || this.location.kind === 'dungeon' ? 'dungeon' : 'field');
  }
  /** The dungeon run in progress, if any (issued by enterDungeon; never saved). */
  dungeonRun: DungeonRun | null = null;
  /**
   * Combat profile of the loaded map's monsters, chosen on entering it
   * (dungeon/encounterProfile): 'story' while the Lv20 Dungeon feature is
   * locked (the Story Crypt; never with a run), otherwise 'standard'.
   */
  encounterProfile: EncounterProfileId = 'standard';
  readonly specialShop = new SpecialShop(this.clock);
  /** Issues dungeon runs; each run's reward is claimed at most once (bounded history). */
  readonly rewardLedger = new RewardLedger();
  /** Timed equipment crafting on the same clock as the shop. */
  readonly crafting = new CraftingQueue(this.clock);
  /** Unlocked towns and discovered dungeons (warp destinations). */
  readonly warpUnlocks = defaultUnlocks();
  readonly loot = new LootSystem(this.events, this.inventory, this.demoTestMode);
  /** The player's bag: stackable items + unequipped equipment within its capacity. */
  readonly bag: Bag;
  /** Instance ids for equipment created from loot (dev tools may make them deterministic). */
  equipmentIds: IdSource = randomIdSource;

  readonly monsters: Monster[] = [];
  /** Player + monsters, for systems that scan everyone. */
  readonly combatants: CombatEntity[] = [];

  /** Debug/test switch: monsters never engage the player. */
  peaceful = false;
  /**
   * Simulation time in ms. Advances only while the world is running, so
   * cooldowns, AI timers, statuses, loot and respawns all pause during hit stop.
   */
  now = 0;
  playerRespawnAt: number | null = null;
  /**
   * The dungeon attempt on the current dungeon map (checkpoints, party
   * wipes, failure); null outside dungeons. A new one starts whenever a
   * dungeon map is entered. Never saved.
   */
  dungeonAttempt: DungeonAttempt | null = null;
  /** How the pending respawn resolves a party wipe (set on the wipe, used by respawnPlayer). */
  private pendingWipe: WipeOutcome | null = null;
  /** Last player position outside every closed progression gate (where a gate holds them back to). */
  private gateSafe: NavPoint | null = null;
  /** When each gate last told the player what is missing (so bumping it doesn't spam). */
  private readonly gateNotice = new Map<string, number>();
  /** Story tutorial beats already shown in this dungeon attempt (reset on every map entry). */
  private readonly tutorialSeen = new Set<string>();

  private readonly controller: PlayerCombatController;
  /** Projectiles stop at the current map's walls. */
  private readonly projectileWorld = { blocksProjectile: (x: number, y: number) => blocksProjectile(this.maps.map, x, y) };
  private readonly byId = new Map<EntityId, CombatEntity>();
  private readonly separationScratch: number[] = [];
  private freezeMs = 0;
  /** The portal whose entry requirements just refused the player (cleared on leaving its area). */
  private refusedPortalId: string | null = null;
  private rewardRng: Rng = defaultRng;
  /** Last level cap seen; when it rises, stored Overflow EXP is applied. */
  private lastLevelCap = 0;
  /** Last server day seen; a new day can make quests available. */
  private lastServerDay = 0;

  /** The loaded map (tiles, collision, its monsters); changed only through enterMap(). */
  readonly maps: MapSession<Monster>;
  /** Why the last load used a fallback position (null = the saved spot was used). Dev / tests only. */
  lastMapFallback: MapEntryFallback | null = null;

  /** Map the player is on. */
  get location(): Location {
    const map = this.maps.map;
    return { kind: map.type, mapId: map.id };
  }

  /** The current map's safe spawn (where the player respawns). */
  get playerSpawn(): Point {
    return this.maps.map.spawnPoint;
  }
  /** Navigation targets and the portal map graph. */
  readonly navigation: NavIndex;
  /** Quest / [Go] navigation. Manual movement input cancels it (AutoMove.drive, called in update()). */
  readonly autoMove: AutoMove;

  /** Daily Commissions and Weekly quests (cycles on the shared server day). */
  readonly recurring: RecurringQuests;
  /** The Lv11 Class 1 Job Change (trial quests → selection). */
  readonly jobChange: JobChange;
  /** The player's skill tree (learn / reset / castable skills / loadout). */
  readonly skillTree: SkillTree;
  /** Proc passives (Guardian Instinct, Battle Instinct). */
  readonly skillProcs: SkillProcs;

  /** Unlocked feature ids (Feature Unlock hook). */
  readonly features = new FeatureUnlocks(this.events);
  /** The Demo progression gate (data-driven feature unlocks + "may the player use X?"). */
  readonly featureProgression: FeatureProgression;
  /** Player-facing system actions, each gated by its feature. */
  readonly actions: PlayerActions;
  /** Data-driven quests, progressed by world events. */
  readonly quests: QuestSystem;

  constructor(
    readonly player: Player,
    input: InputController,
    /** Builds map visuals / collision and monster entities (the scene). */
    private readonly view: WorldMapView,
    questDefs: Readonly<Record<string, QuestDef>> = INTERNAL_DEMO_QUESTS,
  ) {
    this.register(player);
    this.bag = new Bag(this.inventory, player.equipment);
    // New Demo supply only; loading replaces the inventory and never grants it again.
    this.inventory.add('small_hp_potion', 3);
    this.inventory.add('small_mp_potion', 3);
    // Loot: normal rewards auto-loot into the bag; special drops wait on the ground for a collector (the player now, a pet later).
    this.loot.receiver = { id: player.id, store: (drop) => this.storeLoot(drop) };
    this.maps = new MapSession<Monster>({
      build: (map) => view.build(map),
      spawn: (spawn) => {
        const monster = view.createMonster(spawn, profiledMonsterDef(MONSTERS[spawn.monsterId], this.maps.map.id, this.encounterProfile));
        monster.zoneId = spawn.zoneId;
        monster.arena = spawn.arena;
        this.addMonster(monster);
        return monster;
      },
      despawn: (monster) => this.removeMonster(monster),
    });
    this.controller = new PlayerCombatController(player, input, this.skills, this.targeting, () => this.monsters, () => this.skillTree.loadout(), now => {
      if (this.dodge.start(player, input.getMove(), player.facing, now)) {
        player.facing = player.combat.dodge!.direction;
        this.autoMove.cancel();
      }
    }, resource => this.usePreferredPotion(resource), () => this.skillTree.basicAttack());

    this.events.on('damage', ({ sourceId, targetId }) => {
      if (targetId === player.id && !player.combat.dead) this.tutorial({
        hpFraction: player.combat.hp / player.combat.stats.maxHp,
        hasHpPotion: !!preferredPotion(this.inventory, 'hp'),
      });
      const monster = this.monsterById(targetId);
      const source = this.getEntity(sourceId);
      if (monster && source && !this.peaceful) monster.brain.provoke(source, this.now);
      if (monster) this.checkEnrage(monster);
    });
    this.events.on('death', ({ entityId, killerId }) => this.onDeath(entityId, killerId));

    // Quest / milestone rewards: real progression, wallet and inventory (no Field Energy, no skill points).
    const questRewards: QuestRewardSink = {
      grantExp: (amount) => this.progression.grantExp(this.player, this.demoTestMode.exp(amount)),
      addCurrency: (currency, amount) => this.wallet.add(currency, amount),
      addItem: (itemId, count) => this.acquireItem(itemId, count, 'quest'),
    };
    this.quests = new QuestSystem(
      questDefs,
      { level: () => player.combat.level, classId: () => player.progress.classId, serverDay: () => this.serverDay.day() },
      this.features,
      questRewards,
      this.events,
      player.id,
    );
    this.recurring = new RecurringQuests(this.quests, this.features, this.serverDay, () => player.combat.level, questRewards, this.events);
    this.featureProgression = new FeatureProgression(
      this.features,
      {
        level: () => player.combat.level,
        classTier: () => JOBS[player.progress.classId].tier,
        questClaimed: (id) => this.quests.status(id) === 'claimed',
        serverDay: () => this.serverDay.day(),
      },
      this.events,
      player.id,
    );
    this.actions = new PlayerActions({
      features: this.featureProgression,
      inventory: this.inventory,
      wallet: this.wallet,
      equipment: player.equipment,
      pets: player.pets,
      crafting: this.crafting,
      shop: this.specialShop,
      warpUnlocks: this.warpUnlocks,
      events: this.events,
      rng: () => this.rewardRng,
      bag: this.bag,
      world: {
        location: () => this.location,
        inCombat: () => this.playerEngaged(),
        entryAccess: (mapId) => {
          const access = this.entryAccess(mapId);
          if (!access.ok) this.refuseEntry(access, 'dungeon_warp_scroll');
          return access;
        },
        arrive: (destination, kind, leftDungeon) => {
          // A real map change: a town warp lands on the town's spawn, a dungeon warp on the dungeon map's spawn (its entrance).
          if (leftDungeon) this.leaveDungeon();
          this.autoMove.cancel();
          this.enterMap(destination.mapId, undefined, `${kind}_warp_scroll`);
          if (kind === 'dungeon') this.startRunOnEntry();
        },
        startDungeonRun: (dungeonId, difficulty) => {
          this.dungeonRun = this.rewardLedger.startRun(dungeonId, difficulty, this.player.combat.level);
          return this.dungeonRun;
        },
      },
    });
    // A new character starts with what Lv1 allows (Equipment), quietly.
    this.featureProgression.evaluate({ restored: true });
    this.recurring.sync();
    this.quests.refresh();

    this.jobChange = new JobChange(player, this.quests, this.features, this.events, player.id);
    this.skillProcs = new SkillProcs(player, this.events, this.statuses, () => this.now);
    // A skill reset also forgets proc streaks / internal cooldowns.
    this.skillTree = new SkillTree(player, this.features, this.events, () => this.skillProcs.reset(), () => player.combat.actionLocked(this.now) || this.skills.windingUp(player));
    // A new job brings a different tree (or none): the action bar changes with it.
    this.events.on('jobChanged', () => this.events.emit('skillAvailabilityChanged', { loadout: this.skillTree.loadout() }));
    this.events.on('taunted', ({ casterId, targetId }) => {
      const caster = this.getEntity(casterId);
      if (caster) this.monsterById(targetId)?.brain.taunt(caster, this.now);
    });

    this.navigation = new NavIndex(NAVIGATION);
    this.autoMove = new AutoMove(
      this.navigation,
      new LPathPlanner(mapCollision),
      {
        mapId: () => this.location.mapId,
        position: () => ({ x: this.player.x, y: this.player.y }),
        inCombat: () => this.playerEngaged(),
        isDead: () => this.player.combat.dead,
        takePortal: (portalId) => this.takePortal(portalId),
        reachLocation: (locationId) => this.arriveAtLocation(locationId),
      },
      (state) => this.events.emit('navigationChanged', state),
      this.quests,
    );
  }

  addMonster(monster: Monster): void {
    monster.brain = new MonsterBrain(monster, this, this.now);
    this.monsters.push(monster);
    this.register(monster);
  }

  /** Unregister and destroy a monster (its map is being left). */
  removeMonster(monster: Monster): void {
    if (this.targeting.current === monster) this.targeting.select(null);
    const i = this.monsters.indexOf(monster);
    if (i >= 0) this.monsters.splice(i, 1);
    const j = this.combatants.indexOf(monster);
    if (j >= 0) this.combatants.splice(j, 1);
    this.byId.delete(monster.id);
    monster.destroy();
  }

  // --- Maps -----------------------------------------------------------------

  /**
   * Load a map for real: everything belonging to the old map (monsters, loot
   * on the ground, projectiles, pending hits, the target) is cleared, the new
   * map's tiles / collision / monsters are built, and the player is placed at
   * `at` (default: the map's safe spawn). Leaving a dungeon map ends the run
   * without a claim. Emits mapChanged (`cause`: the portal id, a warp scroll,
   * 'load'...) except for the very first load.
   */
  enterMap(mapId: string, at?: NavPoint, cause = 'enter'): MapDef {
    const from = this.maps.loaded ? this.maps.map : null;
    this.loot.clear();
    this.insideLocations.clear();
    this.projectiles.clear();
    this.skills.clear();
    this.targeting.select(null);
    this.player.combat.dodge = null;
    this.player.combat.actionLockedUntil = 0;
    this.player.combat.invulnerableUntil = 0;
    // Past the Story stage once the Dungeon feature is unlocked or already earned (older saves restore it after loading the map).
    const dungeonFeatureUnlocked = this.featureProgression.check('dungeon').ok || this.featureProgression.conditionsMet('dungeon');
    this.encounterProfile = selectEncounterProfile(mapId, { dungeonFeatureUnlocked });
    const map = this.maps.enter(mapId, this.encounterProfile);
    if (from?.type === 'dungeon' && map.type !== 'dungeon') this.leaveDungeon();
    // Every entry into a dungeon map is a fresh attempt (its spawns were just rebuilt).
    // Wipe allowance: the run's difficulty, read when a wipe happens (the Story Crypt has no run: Normal's).
    this.pendingWipe = null;
    this.gateSafe = null;
    this.tutorialSeen.clear();
    this.dungeonAttempt = map.type === 'dungeon' ? new DungeonAttempt(map.id, () => DIFFICULTIES[this.dungeonRun?.difficulty ?? 'normal'].partyWipeLimit) : null;
    const spot = at ?? map.spawnPoint;
    this.player.body.reset(spot.x, spot.y);
    this.view.entered(map);
    if (from) this.events.emit('mapChanged', { fromMapId: from.id, toMapId: map.id, portalId: cause });
    this.tutorial({ entered: true });
    return map;
  }

  /** Walking into a portal's trigger area takes it (Auto Move takes its own portals). */
  private checkPortalTrigger(): void {
    if (this.autoMove.isActive() || this.player.combat.dead) return;
    const portal = portalAt(this.maps.map, this.player.x, this.player.y);
    // A refused portal is not retried (or re-announced) until the player steps out of its area.
    if (!portal || portal.id !== this.refusedPortalId) this.refusedPortalId = null;
    if (portal && portal.id !== this.refusedPortalId) this.takePortal(portal.id);
  }

  /** Dungeon entry requirements (data/dungeonAccess) for entering `toMapId` from the current map. */
  entryAccess(toMapId: string): AccessResult {
    return checkMapEntry(this.location.mapId, toMapId, {
      level: this.player.combat.level,
      questStatus: (id) => this.quests.status(id),
      questTitle: (id) => this.quests.defs[id]?.title,
    });
  }

  private refuseEntry(access: Extract<AccessResult, { ok: false }>, via: string): void {
    this.events.emit('mapEntryBlocked', { toMapId: access.mapId, via, message: access.message });
  }

  getEntity(id: EntityId | null): CombatEntity | undefined {
    return id === null ? undefined : this.byId.get(id);
  }

  monsterById(id: EntityId | null): Monster | undefined {
    const entity = this.getEntity(id);
    return entity && entity !== this.player ? (entity as Monster) : undefined;
  }

  setRng(rng: Rng): void {
    this.combat.rng = rng;
    this.loot.rng = rng;
    this.rewardRng = rng;
  }

  /** True while a hit stop is freezing the simulation. */
  get frozen(): boolean {
    return this.freezeMs > 0;
  }

  /** Freeze the whole simulation for `ms` of real time (longest request wins). */
  requestHitStop(ms: number): void {
    this.freezeMs = Math.max(this.freezeMs, ms);
  }

  /**
   * Advance the simulation by `dtMs` of real time. During a hit stop nothing
   * steps; inputs pressed meanwhile stay queued and are handled afterwards.
   */
  update(dtMs: number, playerDirection: Parameters<Player['move']>[0]): void {
    if (this.freezeMs > 0) {
      this.freezeMs = Math.max(0, this.freezeMs - dtMs);
      return;
    }
    this.now += dtMs;
    const now = this.now;
    this.combat.now = now;

    // Manual input always wins and cancels Auto Move; otherwise Auto Move may steer the same player.
    const direction = this.autoMove.drive(playerDirection, dtMs, this.player.combat.stats.moveSpeed);
    const dodging = !!this.player.combat.dodge;
    this.player.move(dodging ? null : direction);
    // Moving breaks a melee wind-up that hasn't landed yet (skills opt in via windup.cancelOnMove).
    if (!dodging && direction && !this.player.combat.dead) this.skills.interruptMovement(this.player);
    this.controller.update(now);
    this.dodge.update(this.player, now);
    const alpha = this.player.combat.invulnerable(now) ? 0.65 : 1;
    if (this.player.alpha !== alpha) this.player.setAlpha(alpha);
    this.skills.update(now);
    this.skillTree.flushPending();

    for (const monster of this.monsters) {
      monster.brain.update(now, dtMs);
      monster.setDepth(monster.y);
    }
    separate(this.monsters, MONSTER_SEPARATION_STRENGTH, this.separationScratch);

    this.projectiles.update(dtMs, this.combatants, this.projectileWorld);
    this.statuses.update(this.combatants, now);
    for (const actor of this.combatants) this.potions.periodic.update(actor.combat, now);
    this.autoPotions.update(this.player.combat, this.inventory, this.player.progress.autoPotions, this.playerEngaged(), now, this.autoUsePotion);
    this.regenerate(dtMs);
    this.loot.update(now, this.player);
    this.targeting.validate(this.player);

    if (this.playerRespawnAt !== null && now >= this.playerRespawnAt) this.respawnPlayer();
    this.checkProgressionGates();
    this.checkPortalTrigger();
    this.checkLocations();
    this.checkCheckpoints();
    this.checkTutorialEngagements();
    this.settleLevelCap();
    this.checkServerDay();
  }

  /** A new server day can make day-gated quests available. */
  private checkServerDay(): void {
    const day = this.serverDay.day();
    if (day === this.lastServerDay) return;
    this.lastServerDay = day;
    this.featureProgression.evaluate();
    // New day: Daily set (and on a new week, Weekly state) resets once, through the shared server day.
    this.recurring.sync();
    this.quests.refresh();
  }

  /** A living monster is chasing or attacking the player. */
  private playerEngaged(): boolean {
    return this.monsters.some((m) => !m.combat.dead && m.brain.target === this.player && (m.brain.state === 'chase' || m.brain.state === 'attack'));
  }

  /** Apply stored Overflow EXP once the cap rises (new server day, job change). */
  private settleLevelCap(): void {
    if (this.player.combat.dead) return; // level-ups refill HP; wait for the respawn
    const cap = this.progression.levelCap(this.player);
    if (cap === this.lastLevelCap) return;
    this.lastLevelCap = cap;
    this.progression.settle(this.player);
  }

  // --- Dungeon runs --------------------------------------------------------

  /** Enter a dungeon (needs the Dungeon feature): issues a run. Costs no Field Energy and no entitlement. */
  enterDungeon(dungeonId: string, difficulty: DifficultyId) {
    return this.actions.enterDungeon(dungeonId, difficulty);
  }

  /** Leave (or fail / die out of) the current run without claiming: nothing is used. */
  leaveDungeon(): void {
    this.dungeonRun = null;
    this.zoneOverride = null;
  }

  /**
   * The boss is down: claim the run's reward (Full, Assist or none), once.
   * Retries for the same run return 'already_claimed' and grant nothing.
   */
  claimDungeonClear(run: DungeonRun | null = this.dungeonRun, rng: Rng = this.rewardRng): DungeonClaimResult {
    if (!run) return { ok: false, reason: 'unknown_run' };
    return claimDungeonClear(run, {
      ledger: this.rewardLedger,
      entitlements: this.dungeonEntitlements,
      inventory: this.inventory,
      wallet: this.wallet,
      equipment: this.player.equipment,
      grantExp: (amount) => this.progression.grantExp(this.player, this.demoTestMode.exp(amount)),
      rng,
      tuning: this.demoTestMode,
      events: this.events,
    });
  }

  // --- World interactions (NPCs, markers, items, enhancement) --------------

  /** The player talked to / interacted with an NPC (talk objectives listen to this). */
  interactWithNpc(npcId: string): void {
    this.events.emit('npcInteracted', { npcId });
  }

  /** The player reached a location / zone marker. Always reports (dev tools, tests). */
  reachLocation(locationId: string): void {
    this.events.emit('locationReached', { locationId });
  }

  /** Location markers the player currently stands in (each reports once per entry). */
  private readonly insideLocations = new Set<string>();

  /** Arrival at a location (walking in or Auto Move): reported once until the player leaves it again. */
  private arriveAtLocation(locationId: string): void {
    if (this.insideLocations.has(locationId)) return;
    this.insideLocations.add(locationId);
    this.reachLocation(locationId);
  }

  /**
   * Progression gates (dungeon/gates): a closed gate's doorway can't be
   * entered. Walking (or Auto Move) into it puts the player back where they
   * last stood outside every closed gate, stops Auto Move and says what is
   * missing. Inside a room the player moves freely.
   */
  private checkProgressionGates(): void {
    const p = this.player;
    const gates = activeGates(this.maps.map, this.encounterProfile);
    if (!gates.length || p.combat.dead) return;
    const gate = closedGateAt(gates, p.x, p.y, (z) => this.zoneCleared(z));
    if (!gate) {
      this.gateSafe = { x: p.x, y: p.y };
      return;
    }
    const back = this.gateSafe ?? this.playerSpawn;
    p.body.reset(back.x, back.y);
    if (this.autoMove.isActive()) this.autoMove.cancel('cancelled');
    if (this.now - (this.gateNotice.get(gate.id) ?? -Infinity) >= 2000) {
      this.gateNotice.set(gate.id, this.now);
      this.events.emit('progressBlocked', { mapId: this.location.mapId, gateId: gate.id, message: gate.message });
    }
  }

  /** Standing in a checkpoint's trigger with its encounters down activates it (a retry position; restores nothing). */
  private checkCheckpoints(): void {
    const attempt = this.dungeonAttempt;
    if (!attempt || attempt.status !== 'active' || this.player.combat.dead) return;
    for (const cp of this.maps.map.checkpoints ?? []) {
      const ready = checkpointReady(cp, { inTrigger: inTileRect(cp.trigger, this.player.x, this.player.y), zoneCleared: (z) => this.zoneCleared(z) });
      if (ready && attempt.activate(cp)) {
        this.events.emit('checkpointReached', { mapId: this.location.mapId, checkpointId: cp.id, label: cp.label });
        this.tutorial({ checkpointId: cp.id });
      }
    }
  }

  /** Story tutorial lines (Story profile only): each due beat is announced once per attempt. */
  private tutorial(moment: TutorialMoment): void {
    const beats = this.encounterProfile === 'story' ? STORY_ENCOUNTERS[this.location.mapId]?.tutorial : undefined;
    if (!beats || this.tutorialSeen.size >= beats.length) return;
    for (const beat of dueTutorialBeats(beats, this.tutorialSeen, moment)) {
      this.tutorialSeen.add(beat.id);
      this.events.emit('tutorialHint', { mapId: this.location.mapId, beatId: beat.id, message: beat.message });
    }
  }

  /** An encounter's first engagement (one of its monsters chasing or attacking) is a tutorial moment. */
  private checkTutorialEngagements(): void {
    const beats = this.encounterProfile === 'story' ? STORY_ENCOUNTERS[this.location.mapId]?.tutorial : undefined;
    if (!beats || this.tutorialSeen.size >= beats.length || this.player.combat.dead) return;
    this.tutorial({ engaged: (zone) => this.monsters.some((m) => m.zoneId === zone && !m.combat.dead && (m.brain.state === 'chase' || m.brain.state === 'attack')) });
  }

  /** Every monster of a spawn zone is down (a zone with no monsters on this map counts as cleared). */
  zoneCleared(zoneId: string): boolean {
    return this.monsters.every((m) => m.zoneId !== zoneId || m.combat.dead);
  }

  /**
   * After a party wipe: every encounter that is not fully down starts over
   * (its fallen monsters stand back up; all of it at full HP, home, idle),
   * and nothing in flight survives. Cleared encounters stay cleared.
   */
  private resetOpenEncounters(): void {
    const open = new Set(this.monsters.filter((m) => !this.zoneCleared(m.zoneId)).map((m) => m.zoneId));
    for (const m of this.monsters) {
      if (!open.has(m.zoneId)) continue;
      if (m.combat.dead) m.respawn();
      else {
        m.combat.reset();
        m.snapToSpawn();
      }
      m.brain.setState('idle', this.now);
    }
    this.skills.clear();
    this.projectiles.clear();
    this.targeting.select(null);
  }

  /** The active party (solo for now; party members join here later). A wipe is all of them down. */
  activeParty(): CombatEntity[] {
    return [this.player];
  }

  /** Walking into a location marker's radius reaches it (visit objectives); leaving re-arms it. */
  private checkLocations(): void {
    if (this.player.combat.dead) return;
    for (const t of this.navigation.all()) {
      if (t.type !== 'location' || !t.locationId || t.mapId !== this.location.mapId) continue;
      const inside = Math.hypot(t.x - this.player.x, t.y - this.player.y) <= (t.radius ?? NAV_DEFAULT_RADIUS);
      if (inside) this.arriveAtLocation(t.locationId);
      else this.insideLocations.delete(t.locationId);
    }
  }

  // --- Town NPCs and quests --------------------------------------------------

  /** Where an NPC stands (its navigation target), or null if unknown. */
  npcPosition(npcId: string): NavTarget | null {
    const npc = NPCS[npcId];
    return (npc && this.navigation.target(npc.navTargetId)) ?? null;
  }

  /** NPCs on the current map, nearest first, within talking range. */
  nearbyNpc(): NpcDef | null {
    let best: NpcDef | null = null;
    let bestD = NPC_INTERACT_RADIUS;
    for (const npc of Object.values(NPCS)) {
      const at = this.npcPosition(npc.id);
      if (!at || at.mapId !== this.location.mapId) continue;
      const d = Math.hypot(at.x - this.player.x, at.y - this.player.y);
      if (d <= bestD) {
        best = npc;
        bestD = d;
      }
    }
    return best;
  }

  /**
   * Talk to an NPC standing next to the player: reports the conversation
   * (talk objectives progress before the dialogue shows its quests).
   */
  talkTo(npcId: string): { ok: true; npc: NpcDef } | { ok: false; reason: 'unknown_npc' | 'too_far' | 'dead' } {
    const npc = NPCS[npcId];
    if (!npc) return { ok: false, reason: 'unknown_npc' };
    if (this.player.combat.dead) return { ok: false, reason: 'dead' };
    if (this.nearbyNpc()?.id !== npcId) return { ok: false, reason: 'too_far' };
    this.autoMove.cancel();
    this.interactWithNpc(npcId);
    return { ok: true, npc };
  }

  /** Accept a quest (starts and tracks it). */
  acceptQuest(questId: string) {
    const r = this.quests.start(questId);
    if (r.ok) this.quests.track(questId);
    return r;
  }

  /**
   * Turn a finished quest in to the NPC it names (its rewards are granted
   * once; a second turn-in is refused by the Quest Engine).
   */
  turnInQuest(questId: string, npcId: string) {
    const def = this.quests.defs[questId];
    if (!def) return { ok: false as const, reason: 'unknown_quest' as const };
    if ((def.turnInNpcId ?? def.giverNpcId ?? npcId) !== npcId) return { ok: false as const, reason: 'wrong_npc' as const };
    return this.quests.claim(questId);
  }

  /**
   * The real portal transition: the portal must start on the current map;
   * the destination map is loaded and the player appears at the far side's
   * arrival point.
   */
  takePortal(portalId: string): boolean {
    const t = portalTransition(this.navigation, this.location, portalId);
    if (!t.ok) return false;
    // Walking in and Auto Move both come through here: neither can bypass a dungeon's requirements.
    const access = this.entryAccess(t.location.mapId);
    if (!access.ok) {
      this.refusedPortalId = portalId;
      this.refuseEntry(access, portalId);
      return false;
    }
    const from = this.location.kind;
    this.enterMap(t.location.mapId, t.arrival, portalId);
    if (from !== 'dungeon' && t.location.kind === 'dungeon') this.startRunOnEntry();
    return true;
  }

  /**
   * Walking into a dungeon (its gate or a Dungeon Warp) starts a Normal run
   * when the Dungeon feature is unlocked and none is in progress. Entering
   * costs nothing; the boss-clear claim spends today's entitlement. Locked:
   * the dungeon is still walkable, and nothing is ever rewarded there.
   */
  private startRunOnEntry(): void {
    // A Story visit never issues (or spends) a run.
    if (this.dungeonRun || this.encounterProfile === 'story' || !this.featureProgression.check('dungeon').ok) return;
    const dungeonId = Object.values(DUNGEON_WARPS).find((d) => d.entranceMapId === this.location.mapId)?.id;
    if (dungeonId) this.actions.enterDungeon(dungeonId, 'normal');
  }

  /**
   * Charge's dash: move the caster toward the target until in contact, at
   * most `maxDistance`, stopping before any solid tile (collision-checked
   * every few px along the line). Instant reposition; no dash animation yet.
   */
  private dash(caster: CombatEntity, target: CombatEntity, maxDistance: number): void {
    if (caster !== this.player) return;
    const dx = target.x - caster.x;
    const dy = target.y - caster.y;
    const length = Math.hypot(dx, dy);
    const travel = Math.min(maxDistance, length - target.hitRadius - caster.hitRadius - 2);
    if (travel <= 0) return;
    const grid = mapCollision(this.location.mapId);
    const margin = caster.hitRadius;
    const blocked = (x: number, y: number) =>
      !!grid && (grid.isBlocked(x - margin, y - margin) || grid.isBlocked(x + margin, y - margin) || grid.isBlocked(x - margin, y + margin) || grid.isBlocked(x + margin, y + margin));
    let best = { x: caster.x, y: caster.y };
    for (let d = 4; d <= travel; d += 4) {
      const p = { x: caster.x + (dx / length) * d, y: caster.y + (dy / length) * d };
      if (blocked(p.x, p.y)) break;
      best = p;
    }
    this.player.body.reset(best.x, best.y);
  }

  /** Body footprint vs map geometry and live gate doors. Sweeps use this same query. */
  private movementBlocked(actor: CombatEntity, x: number, y: number): boolean {
    const grid = mapCollision(this.location.mapId);
    if (!grid) return true;
    const left = actor === this.player ? -8 : -actor.hitRadius;
    const right = actor === this.player ? 8 : actor.hitRadius;
    const top = actor === this.player ? 4 : -actor.hitRadius;
    const bottom = actor === this.player ? 14 : actor.hitRadius;
    const gates = activeGates(this.maps.map, this.encounterProfile);
    for (const dx of [left, right]) for (const dy of [top, bottom]) {
      if (grid.isBlocked(x + dx, y + dy) || closedGateAt(gates, x + dx, y + dy, z => this.zoneCleared(z))) return true;
    }
    return false;
  }

  /** Loot into the bag when it fits: items stack; an equipment drop becomes a new owned instance. */
  private storeLoot(drop: LootDrop): { ok: true; instanceId?: string } | { ok: false; reason: 'inventory_full' } {
    if (drop.kind === 'item') {
      if (!this.bag.hasRoomForItem(drop.itemId)) return { ok: false, reason: 'inventory_full' };
      this.inventory.add(drop.itemId);
      return { ok: true };
    }
    if (!this.bag.hasRoomForEquipment()) return { ok: false, reason: 'inventory_full' };
    const item = createEquipment(drop.defId, this.rewardRng, this.equipmentIds);
    this.player.equipment.add(item);
    return { ok: true, instanceId: item.instanceId };
  }

  /** Add items obtained through gameplay and report the acquisition. */
  acquireItem(itemId: ItemId, amount: number, source: GameEvents['itemAcquired']['source']): void {
    if (!(amount > 0)) return;
    this.inventory.add(itemId, amount);
    this.events.emit('itemAcquired', { itemId, amount, source });
  }

  // --- Player-facing system actions (feature-gated; see PlayerActions) -----

  /** One enhancement attempt on an owned item (needs Enhancement; balance unchanged). */
  enhanceEquipment(instanceId: string, options: EnhanceOptions = {}, rng: Rng = this.rewardRng) {
    return this.actions.enhance(instanceId, options, rng);
  }
  equipPlayerItem(instanceId: string, slot?: EquipmentSlot) {
    return this.actions.equip(instanceId, slot);
  }
  unequipPlayerSlot(slot: EquipmentSlot) {
    return this.actions.unequip(slot);
  }
  rerollPlayerEnchants(instanceId: string, locked: number[] = [], rng: Rng = this.rewardRng) {
    return this.actions.rerollEnchants(instanceId, locked, rng);
  }
  startCraft(recipeId: string, newId?: IdSource) {
    return this.actions.startCraft(recipeId, newId);
  }
  claimCraft(jobId: string, rng: Rng = this.rewardRng, newItemId?: IdSource) {
    return this.actions.claimCraft(jobId, rng, newItemId);
  }
  useWarpScroll(kind: 'town' | 'dungeon', dungeonId = '') {
    return this.actions.useWarpScroll(kind, dungeonId);
  }
  setActivePet(petInstanceId: string | null) {
    return this.actions.setActivePet(petInstanceId);
  }
  openPlayerEgg(tier: EggTier, rng: Rng = this.rewardRng, newId?: IdSource) {
    return this.actions.openEgg(tier, rng, newId);
  }
  usePlayerEggTicket(rng: Rng = this.rewardRng) {
    return this.actions.useEggTicket(rng);
  }
  buyEggTicket() {
    return this.actions.buyEggTicket();
  }

  // --- Player progression -------------------------------------------------

  /** Spend free stat points on one primary stat. */
  allocatePlayerStat(stat: PrimaryStat, amount: number) {
    return allocateStat(this.player, stat, amount);
  }

  /**
   * Choose the Class 1 job through the real Job Change (Lv11+, still Novice,
   * Job Trial complete; permanent). `skipTrial` is for dev force tools only.
   */
  changePlayerJob(jobId: string, options: { skipTrial?: boolean } = {}) {
    const result = this.jobChange.select(jobId, options);
    // Gear the new job can't use goes back to the bag.
    if (result.ok) this.player.equipment.revalidate();
    return result;
  }

  /** Use one of the player's items (e.g. the Stat Reset test item). */
  usePlayerItem(itemId: string): UseItemResult {
    const result = applyItem(this.inventory, this.player, itemId, { dungeon: this.dungeonEntitlements, potions: this.potions });
    if (result.ok) this.events.emit('itemUsed', { entityId: this.player.id, itemId: itemId as ItemId });
    return result;
  }

  usePreferredPotion(resource: 'hp' | 'mp'): UseItemResult {
    const id = preferredPotion(this.inventory, resource);
    return id ? this.usePlayerItem(id) : { ok: false, reason: 'not_owned' };
  }

  // --- Player save --------------------------------------------------------

  /** Stable id of the local character; a server would assign this. */
  characterId = 'local-1';
  /** Save data for systems that don't exist yet (equipment, pet, currencies...). */
  saveHooks: PersistedHooks = emptyHooks();

  /** Serialized v1 save of the player (inputs only; derived stats are recalculated on load). */
  savePlayer(): string {
    return serializePlayerSave(capturePlayerSave(this.saveTarget()));
  }

  /** Validate and load a serialized save. Throws SaveError and changes nothing if it's invalid. */
  loadPlayer(text: string): void {
    const save = deserializePlayerSave(text);
    this.skillTree.clearPending();
    this.autoPotions.reset();
    const target = this.saveTarget();
    applyPlayerSave(target, save);
    this.characterId = target.characterId;
    this.saveHooks = target.hooks;
    // A run in progress belongs to the state being replaced; Auto Move never resumes from a save.
    this.leaveDungeon();
    this.autoMove.clear();
    // Back on the saved map and spot, or a safe fallback (old save, unknown map, bad position, a dungeon → its entrance).
    const entry = resolveMapEntry(target.location);
    this.lastMapFallback = entry.fallback;
    this.enterMap(entry.mapId, entry.at, 'load');
    // The server cap may have risen since the save was made.
    this.lastLevelCap = 0;
    this.settleLevelCap();
    // Features the character qualifies for (older saves, level above unlock levels) are restored quietly.
    this.featureProgression.evaluate({ restored: true });
    // A save from an earlier server day / week resets its recurring quests here, once.
    this.recurring.sync();
    this.quests.refresh();
  }

  private saveTarget(): SaveTarget {
    return {
      characterId: this.characterId,
      progress: this.player.progress,
      combat: this.player.combat,
      inventory: this.inventory,
      wallet: this.wallet,
      equipment: this.player.equipment,
      pets: this.player.pets,
      shop: this.specialShop,
      crafting: this.crafting,
      warp: this.warpUnlocks,
      ledger: this.rewardLedger,
      daily: this.daily,
      quests: this.quests,
      recurring: this.recurring,
      features: this.features,
      hooks: this.saveHooks,
      location: { mapId: this.location.mapId, x: this.player.x, y: this.player.y },
    };
  }

  respawnPlayer(): void {
    this.playerRespawnAt = null;
    const wipe = this.pendingWipe;
    this.pendingWipe = null;
    if (wipe?.kind === 'failed') return this.failDungeonAttempt();
    const checkpoint = this.dungeonAttempt?.checkpoint ?? null;
    const at = checkpoint?.respawn ?? this.playerSpawn;
    if (wipe?.kind === 'retry') this.resetOpenEncounters();
    this.player.respawn(at.x, at.y);
    this.gateSafe = null;
    if (wipe?.kind === 'retry') {
      // Locked retry vitals: HP 100%, MP 50%.
      const c = this.player.combat;
      c.hp = Math.round(c.stats.maxHp * RETRY_HP_FRACTION);
      c.mp = Math.floor(c.stats.maxMp * RETRY_MP_FRACTION);
      this.events.emit('dungeonRetry', { mapId: this.location.mapId, checkpointId: checkpoint?.id ?? null, retriesLeft: wipe.retriesLeft });
    }
    this.events.emit('respawn', { entityId: this.player.id });
  }

  /**
   * Out of retries: the attempt ends without any clear reward and the party
   * is returned to Town through the dungeon's exit (full HP, as any Town
   * respawn). Quest progress is left exactly as it was, so the dungeon (and
   * its story quest) can simply be attempted again.
   */
  private failDungeonAttempt(): void {
    const mapId = this.location.mapId;
    const exit = this.maps.map.portals[0];
    this.events.emit('dungeonFailed', { mapId });
    this.enterMap(exit?.to ?? DEFAULT_MAP_ID, exit?.arrival, 'dungeon_failed');
    this.player.respawn(this.player.x, this.player.y);
    this.events.emit('respawn', { entityId: this.player.id });
  }

  // --- MonsterWorld -------------------------------------------------------

  findAggroTarget(monster: MonsterAgent): CombatEntity | null {
    if (this.peaceful || this.player.combat.dead) return null;
    // An encounter's monsters only notice players on its own floor (no cross-encounter pulls).
    if (!withinEncounter(monster.arena, this.player.x, this.player.y)) return null;
    return distance(monster, this.player) <= monster.def.aggroRange ? this.player : null;
  }

  /** The signature attack whenever it is ready and in reach, otherwise the basic attack. */
  tryAttack(monster: MonsterAgent, target: CombatEntity, now: number): void {
    const special = monster.def.specialSkill;
    if (special && this.skills.use(monster, special, now, { target, quiet: true }).ok) return;
    this.skills.use(monster, monster.def.attackSkill, now, { target, quiet: true });
  }

  /** Telegraphed attacks root the monster until they land. */
  busy(monster: MonsterAgent): boolean {
    return this.skills.windingUp(monster);
  }

  /** Elites / bosses enrage once below their threshold (an attack buff; a leash reset or death ends it). */
  private checkEnrage(monster: Monster): void {
    const below = monster.def.enrageBelow;
    const c = monster.combat;
    if (!below || c.dead || c.hp / c.stats.maxHp >= below || c.statuses.some((s) => s.def.id === 'enraged')) return;
    this.statuses.apply(monster, 'enraged', ENRAGE_MS, this.now);
    this.events.emit('monsterEnraged', { entityId: monster.id, monsterId: monster.def.id });
  }

  // ------------------------------------------------------------------------

  private register(entity: CombatEntity): void {
    if (this.byId.has(entity.id)) throw new Error(`Duplicate entity id ${entity.id}`);
    this.byId.set(entity.id, entity);
    this.combatants.push(entity);
  }

  private onDeath(entityId: EntityId, killerId: EntityId | null): void {
    if (entityId === this.player.id) {
      this.player.die();
      this.playerRespawnAt = this.now + PLAYER_RESPAWN_DELAY;
      // In a dungeon only a full-party wipe counts (one member down is not a wipe).
      const attempt = this.dungeonAttempt;
      if (attempt && partyDefeated(this.activeParty())) {
        const outcome = attempt.recordPartyWipe();
        if (outcome.kind !== 'ignored') {
          this.pendingWipe = outcome;
          this.events.emit('partyWiped', { mapId: this.location.mapId, retriesLeft: outcome.kind === 'retry' ? outcome.retriesLeft : 0, failed: outcome.kind === 'failed' });
        }
      }
      return;
    }

    const monster = this.monsterById(entityId);
    if (!monster) return;
    monster.onDeath();
    monster.brain.setState('dead', this.now);
    if (killerId === this.player.id) {
      // The kill always counts (quests listen to 'death'); EXP and drops need Field Energy.
      const reward = grantKillRewards(monster, {
        zone: this.zone,
        fieldEnergy: this.fieldEnergy,
        progression: this.progression,
        loot: this.loot,
        player: this.player,
        now: this.now,
        events: this.events,
        tuning: this.demoTestMode,
        wallet: this.wallet,
      });
      if (this.zone === 'field') {
        this.events.emit('fieldReward', { monsterId: monster.id, rewarded: reward.exp, energySpent: reward.energySpent, energyLeft: this.fieldEnergy.current() });
      }
      if (monster.def.tier === 'dungeon_boss') this.bossDefeated(monster);
    }
  }

  /**
   * The dungeon boss is down: the run in progress (if any) resolves its claim
   * now, through the same retry-safe claim as before. No run → no reward.
   */
  private bossDefeated(monster: Monster): void {
    const run = this.dungeonRun;
    const claimed = run ? this.claimDungeonClear(run).ok : false;
    this.dungeonAttempt?.markCleared();
    this.events.emit('bossDefeated', { entityId: monster.id, monsterId: monster.def.id, mapId: this.location.mapId, runId: run?.runId ?? null, claimed });
  }

  private regenerate(dtMs: number): void {
    for (const entity of this.combatants) {
      const c = entity.combat;
      if (c.dead || c.mp >= c.stats.maxMp) continue;
      c.mp = Math.min(c.stats.maxMp, c.mp + (c.stats.mpRegen * dtMs) / 1000);
    }
  }
}
