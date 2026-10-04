import { MonsterBrain, type MonsterAgent, type MonsterWorld } from '../ai/MonsterBrain';
import { separate } from '../ai/separation';
import { CombatSystem } from '../combat/CombatSystem';
import { ProjectileSystem, type ProjectileWorld } from '../combat/ProjectileSystem';
import { SkillSystem } from '../combat/SkillSystem';
import { StatusSystem } from '../combat/StatusSystem';
import { TargetingSystem } from '../combat/TargetingSystem';
import type { CombatEntity, EntityId } from '../combat/types';
import { EventBus } from '../core/EventBus';
import type { Point } from '../core/math';
import { distance } from '../core/math';
import { defaultRng, type Rng } from '../core/rng';
import type { ItemId } from '../data/itemData';
import { MONSTER_SEPARATION_STRENGTH } from '../data/monsterData';
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
import type { DifficultyId } from '../data/dungeonDifficulty';
import { SpecialShop } from '../pets/specialShop';
import { RewardLedger, type DungeonRun } from '../dungeon/rewards';
import { CraftingQueue } from '../crafting/crafting';
import { defaultUnlocks } from '../warp/warp';
import { LootSystem } from '../loot/LootSystem';
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
import { QUESTS } from '../data/questData';
import { FeatureUnlocks } from '../features/FeatureUnlocks';
import { QuestSystem, type QuestRewardSink } from '../quests/QuestSystem';
import { FeatureProgression } from '../features/FeatureProgression';
import { PlayerActions } from './PlayerActions';
import { JOBS } from '../data/jobData';
import type { EquipmentSlot } from '../data/equipmentData';
import type { EggTier } from '../data/petData';
import type { IdSource } from '../equipment/factory';
import { RecurringQuests } from '../quests/RecurringQuests';
import { NAVIGATION } from '../data/navigationData';
import { PROTOTYPE_MAP_ID } from '../data/navigation/demoNavigation';
import type { Location } from '../data/warpData';
import { AutoMove } from '../navigation/AutoMove';
import { NavIndex, portalTransition } from '../navigation/NavIndex';
import { LPathPlanner, type CollisionGrid } from '../navigation/pathing';
import type { EnhanceOptions } from '../equipment/enhancement';
import { PlayerCombatController } from './PlayerCombatController';

/**
 * Owns every gameplay system and runs one simulation step per frame.
 * The scene builds entities and views; everything rule-related happens here
 * or in the systems, so it can later move behind a network boundary.
 */
export class CombatWorld implements MonsterWorld {
  readonly events = new EventBus<GameEvents>();
  readonly combat = new CombatSystem(this.events);
  readonly statuses = new StatusSystem(this.events);
  readonly projectiles = new ProjectileSystem(this.events, this.combat);
  readonly skills = new SkillSystem(this.events, this.combat, this.statuses, this.projectiles, {
    resolve: (caster, skillId) => (caster === this.player ? this.skillTree.resolve(skillId) : SKILLS[skillId]),
    entities: () => this.combatants,
    dash: (caster, target, maxDistance) => this.dash(caster, target, maxDistance),
  });
  readonly targeting = new TargetingSystem(this.events, TARGETING.acquireRange, TARGETING.loseRange);
  readonly inventory = new Inventory();
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
  /** DEMO: the only map is a field. Dungeon kills don't use Field Energy. */
  zone: RewardZone = 'field';
  /** The dungeon run in progress, if any (DEMO: no dungeon map; entered through the API). */
  dungeonRun: DungeonRun | null = null;
  readonly specialShop = new SpecialShop(this.clock);
  /** Issues dungeon runs; each run's reward is claimed at most once (bounded history). */
  readonly rewardLedger = new RewardLedger();
  /** Timed equipment crafting on the same clock as the shop. */
  readonly crafting = new CraftingQueue(this.clock);
  /** Unlocked towns and discovered dungeons (warp destinations). */
  readonly warpUnlocks = defaultUnlocks();
  readonly loot = new LootSystem(this.events, this.inventory);

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

  private readonly controller: PlayerCombatController;
  private readonly byId = new Map<EntityId, CombatEntity>();
  private readonly separationScratch: number[] = [];
  private freezeMs = 0;
  private rewardRng: Rng = defaultRng;
  /** Last level cap seen; when it rises, stored Overflow EXP is applied. */
  private lastLevelCap = 0;
  /** Last server day seen; a new day can make quests available. */
  private lastServerDay = 0;

  /**
   * Map the player is on. DEMO: the prototype test map stands in for
   * demo_field and physically hosts every demo map id (not saved yet).
   */
  location: Location = { kind: 'field', mapId: PROTOTYPE_MAP_ID };
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
  private navGrid: (mapId: string) => CollisionGrid | undefined;

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
    private readonly map: ProjectileWorld,
    readonly playerSpawn: Point,
    /** Collision tiles per map id, for Auto Move path checks (none = unchecked paths). */
    navGrid: (mapId: string) => CollisionGrid | undefined = () => undefined,
  ) {
    this.register(player);
    this.navGrid = navGrid;
    this.controller = new PlayerCombatController(player, input, this.skills, this.targeting, () => this.monsters, () => this.skillTree.loadout());

    this.events.on('damage', ({ sourceId, targetId }) => {
      const monster = this.monsterById(targetId);
      const source = this.getEntity(sourceId);
      if (monster && source && !this.peaceful) monster.brain.provoke(source, this.now);
    });
    this.events.on('death', ({ entityId, killerId }) => this.onDeath(entityId, killerId));

    // Quest / milestone rewards: real progression, wallet and inventory (no Field Energy, no skill points).
    const questRewards: QuestRewardSink = {
      grantExp: (amount) => this.progression.grantExp(this.player, amount),
      addCurrency: (currency, amount) => this.wallet.add(currency, amount),
      addItem: (itemId, count) => this.acquireItem(itemId, count, 'quest'),
    };
    this.quests = new QuestSystem(
      QUESTS,
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
      world: {
        location: () => this.location,
        inCombat: () => this.playerEngaged(),
        arrive: (destination, kind, leftDungeon) => {
          // DEMO: same prototype scene — town at the spawn point, a dungeon at its entrance marker.
          const from = this.location.mapId;
          if (leftDungeon) this.leaveDungeon();
          this.autoMove.cancel();
          this.location = destination;
          const entrance = this.navigation.find((t) => t.type === 'dungeon_entrance' && t.mapId === destination.mapId);
          const at = kind === 'dungeon' && entrance ? entrance : this.playerSpawn;
          this.player.body.reset(at.x, at.y);
          this.events.emit('mapChanged', { fromMapId: from, toMapId: destination.mapId, portalId: `${kind}_warp_scroll` });
        },
        startDungeonRun: (dungeonId, difficulty) => {
          this.dungeonRun = this.rewardLedger.startRun(dungeonId, difficulty, this.player.combat.level);
          this.zone = 'dungeon';
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
    this.skillTree = new SkillTree(player, this.features, this.events, () => this.skillProcs.reset());
    // A new job brings a different tree (or none): the action bar changes with it.
    this.events.on('jobChanged', () => this.events.emit('skillAvailabilityChanged', { loadout: this.skillTree.loadout() }));
    this.events.on('taunted', ({ casterId, targetId }) => {
      const caster = this.getEntity(casterId);
      if (caster) this.monsterById(targetId)?.brain.taunt(caster, this.now);
    });

    this.navigation = new NavIndex(NAVIGATION);
    this.autoMove = new AutoMove(
      this.navigation,
      new LPathPlanner(navGrid),
      {
        mapId: () => this.location.mapId,
        position: () => ({ x: this.player.x, y: this.player.y }),
        inCombat: () => this.playerEngaged(),
        isDead: () => this.player.combat.dead,
        takePortal: (portalId) => this.takePortal(portalId),
        reachLocation: (locationId) => this.reachLocation(locationId),
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

    // Manual input always wins and cancels Auto Move; otherwise Auto Move may steer the same player.
    const direction = this.autoMove.drive(playerDirection, dtMs, this.player.combat.stats.moveSpeed);
    this.player.move(direction);
    // Moving breaks a melee wind-up that hasn't landed yet (skills opt in via windup.cancelOnMove).
    if (direction && !this.player.combat.dead) this.skills.interruptMovement(this.player);
    this.controller.update(now);
    this.skills.update(now);

    for (const monster of this.monsters) {
      monster.brain.update(now, dtMs);
      monster.setDepth(monster.y);
    }
    separate(this.monsters, MONSTER_SEPARATION_STRENGTH, this.separationScratch);

    this.projectiles.update(dtMs, this.combatants, this.map);
    this.statuses.update(this.combatants, now);
    this.regenerate(dtMs);
    this.loot.update(now, this.player);
    this.targeting.validate(this.player);

    if (this.playerRespawnAt !== null && now >= this.playerRespawnAt) this.respawnPlayer();
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
    this.zone = 'field';
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
      grantExp: (amount) => this.progression.grantExp(this.player, amount),
      rng,
      events: this.events,
    });
  }

  // --- World interactions (NPCs, markers, items, enhancement) --------------

  /** The player talked to / interacted with an NPC. No dialogue UI yet. */
  interactWithNpc(npcId: string): void {
    this.events.emit('npcInteracted', { npcId });
  }

  /** The player reached a location / zone marker (maps and Auto Move will call this). */
  reachLocation(locationId: string): void {
    this.events.emit('locationReached', { locationId });
  }

  /**
   * The real portal transition: the warp portal must start on the current map;
   * the player moves to the far side's arrival point on the new map.
   * DEMO: no scene change yet (all demo map ids share the prototype map).
   */
  takePortal(portalId: string): boolean {
    const from = this.location;
    const t = portalTransition(this.navigation, from, portalId);
    if (!t.ok) return false;
    this.location = t.location;
    this.player.body.reset(t.arrival.x, t.arrival.y);
    this.events.emit('mapChanged', { fromMapId: from.mapId, toMapId: t.location.mapId, portalId });
    return true;
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
    const grid = this.navGrid(this.location.mapId);
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
    const result = applyItem(this.inventory, this.player, itemId, { dungeon: this.dungeonEntitlements });
    if (result.ok) this.events.emit('itemUsed', { entityId: this.player.id, itemId: itemId as ItemId });
    return result;
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
    const target = this.saveTarget();
    applyPlayerSave(target, save);
    this.characterId = target.characterId;
    this.saveHooks = target.hooks;
    // A run in progress belongs to the state being replaced; Auto Move never resumes from a save.
    this.leaveDungeon();
    this.autoMove.clear();
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
    };
  }

  respawnPlayer(): void {
    this.playerRespawnAt = null;
    this.player.respawn(this.playerSpawn.x, this.playerSpawn.y);
    this.events.emit('respawn', { entityId: this.player.id });
  }

  // --- MonsterWorld -------------------------------------------------------

  findAggroTarget(monster: MonsterAgent): CombatEntity | null {
    if (this.peaceful || this.player.combat.dead) return null;
    return distance(monster, this.player) <= monster.def.aggroRange ? this.player : null;
  }

  tryAttack(monster: MonsterAgent, target: CombatEntity, now: number): void {
    this.skills.use(monster, monster.def.attackSkill, now, { target, quiet: true });
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
      });
      if (this.zone === 'field') {
        this.events.emit('fieldReward', { monsterId: monster.id, rewarded: reward.exp, energySpent: reward.energySpent, energyLeft: this.fieldEnergy.current() });
      }
    }
  }

  private regenerate(dtMs: number): void {
    for (const entity of this.combatants) {
      const c = entity.combat;
      if (c.dead || c.mp >= c.stats.maxMp) continue;
      c.mp = Math.min(c.stats.maxMp, c.mp + (c.stats.mpRegen * dtMs) / 1000);
    }
  }
}
