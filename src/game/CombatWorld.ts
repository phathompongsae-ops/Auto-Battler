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
import type { Rng } from '../core/rng';
import type { ItemId } from '../data/itemData';
import { MONSTER_SEPARATION_STRENGTH } from '../data/monsterData';
import { PLAYER_RESPAWN_DELAY, TARGETING } from '../data/playerData';
import type { Monster } from '../entities/Monster';
import type { Player } from '../entities/Player';
import type { InputController } from '../input/InputController';
import { Inventory } from '../loot/Inventory';
import { Wallet } from '../economy/Wallet';
import { OffsetClock } from '../core/clock';
import { SpecialShop } from '../pets/specialShop';
import { RewardLedger } from '../dungeon/rewards';
import { CraftingQueue } from '../crafting/crafting';
import { defaultUnlocks } from '../warp/warp';
import { LootSystem } from '../loot/LootSystem';
import { useItem as applyItem, type UseItemResult } from '../items/useItem';
import { ProgressionSystem } from '../progression/ProgressionSystem';
import { allocateStat, changeJob } from '../progression/statActions';
import { deserializePlayerSave, serializePlayerSave } from '../save/playerSave';
import { applyPlayerSave, capturePlayerSave, emptyHooks, type PersistedHooks, type SaveTarget } from '../save/playerSnapshot';
import type { JobId } from '../data/jobData';
import type { PrimaryStat } from '../stats/primaryStats';
import type { GameEvents } from './GameEvents';
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
  readonly skills = new SkillSystem(this.events, this.combat, this.statuses, this.projectiles);
  readonly targeting = new TargetingSystem(this.events, TARGETING.acquireRange, TARGETING.loseRange);
  readonly progression = new ProgressionSystem(this.events);
  readonly inventory = new Inventory();
  /** Currencies (gold). */
  readonly wallet = new Wallet();
  /**
   * Calendar time for shop refresh / crafting. DEMO: local clock (untrusted);
   * the offset lets dev tools simulate time. A server will own this later.
   */
  readonly clock = new OffsetClock();
  readonly specialShop = new SpecialShop(this.clock);
  /** Dungeon clears already claimed (idempotent rewards). */
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

  constructor(
    readonly player: Player,
    input: InputController,
    private readonly map: ProjectileWorld,
    readonly playerSpawn: Point,
  ) {
    this.register(player);
    this.controller = new PlayerCombatController(player, input, this.skills, this.targeting, () => this.monsters);

    this.events.on('damage', ({ sourceId, targetId }) => {
      const monster = this.monsterById(targetId);
      const source = this.getEntity(sourceId);
      if (monster && source && !this.peaceful) monster.brain.provoke(source, this.now);
    });
    this.events.on('death', ({ entityId, killerId }) => this.onDeath(entityId, killerId));
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

    this.player.move(playerDirection);
    // Moving breaks a melee wind-up that hasn't landed yet (skills opt in via windup.cancelOnMove).
    if (playerDirection && !this.player.combat.dead) this.skills.interruptMovement(this.player);
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
  }

  // --- Player progression -------------------------------------------------

  /** Spend free stat points on one primary stat. */
  allocatePlayerStat(stat: PrimaryStat, amount: number) {
    return allocateStat(this.player, stat, amount);
  }

  /** Take a job (class) at the player's current level. */
  changePlayerJob(jobId: string) {
    const result = changeJob(this.player, jobId);
    if (result.ok) {
      // Gear the new job can't use goes back to the bag.
      this.player.equipment.revalidate();
      this.events.emit('jobChanged', { entityId: this.player.id, jobId: jobId as JobId });
    }
    return result;
  }

  /** Use one of the player's items (e.g. the Stat Reset test item). */
  usePlayerItem(itemId: string): UseItemResult {
    const result = applyItem(this.inventory, this.player, itemId);
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
      this.progression.grantExp(this.player, monster.def.expReward);
      this.loot.roll(monster.def.lootTable, monster.x, monster.y, this.now);
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
