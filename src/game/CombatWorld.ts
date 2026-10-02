import { MonsterBrain, type MonsterAgent, type MonsterWorld } from '../ai/MonsterBrain';
import { CombatSystem } from '../combat/CombatSystem';
import { ProjectileSystem, type ProjectileWorld } from '../combat/ProjectileSystem';
import { SkillSystem } from '../combat/SkillSystem';
import { StatusSystem } from '../combat/StatusSystem';
import { TargetingSystem } from '../combat/TargetingSystem';
import type { CombatEntity } from '../combat/types';
import { EventBus } from '../core/EventBus';
import type { Point } from '../core/math';
import { distance } from '../core/math';
import type { Rng } from '../core/rng';
import { PLAYER_RESPAWN_DELAY, TARGETING } from '../data/playerData';
import type { Monster } from '../entities/Monster';
import type { Player } from '../entities/Player';
import type { InputController } from '../input/InputController';
import { Inventory } from '../loot/Inventory';
import { LootSystem } from '../loot/LootSystem';
import { ProgressionSystem } from '../progression/ProgressionSystem';
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
  readonly loot = new LootSystem(this.events, this.inventory);

  readonly monsters: Monster[] = [];
  /** Player + monsters, for systems that scan everyone. */
  readonly combatants: CombatEntity[] = [];

  /** Debug/test switch: monsters never engage the player. */
  peaceful = false;
  now = 0;
  playerRespawnAt: number | null = null;

  private readonly controller: PlayerCombatController;

  constructor(
    readonly player: Player,
    input: InputController,
    private readonly map: ProjectileWorld,
    readonly playerSpawn: Point,
  ) {
    this.combatants.push(player);
    this.controller = new PlayerCombatController(player, input, this.skills, this.targeting, () => this.monsters);

    this.events.on('damage', ({ source, target }) => {
      const monster = this.monsters.find((m) => m === target);
      if (monster && !this.peaceful) monster.brain.provoke(source, this.now);
    });
    this.events.on('death', ({ entity, killer }) => this.onDeath(entity, killer));
  }

  addMonster(monster: Monster): void {
    monster.brain = new MonsterBrain(monster, this, this.now);
    this.monsters.push(monster);
    this.combatants.push(monster);
  }

  setRng(rng: Rng): void {
    this.combat.rng = rng;
    this.loot.rng = rng;
  }

  update(now: number, dtMs: number, playerDirection: Parameters<Player['move']>[0]): void {
    this.now = now;

    this.player.move(playerDirection);
    this.controller.update(now);

    for (const monster of this.monsters) {
      monster.brain.update(now, dtMs);
      monster.setDepth(monster.y);
    }

    this.projectiles.update(dtMs, this.combatants, this.map);
    this.statuses.update(this.combatants, now);
    this.regenerate(dtMs);
    this.loot.update(now, this.player);
    this.targeting.validate(this.player);

    if (this.playerRespawnAt !== null && now >= this.playerRespawnAt) this.respawnPlayer();
  }

  respawnPlayer(): void {
    this.playerRespawnAt = null;
    this.player.respawn(this.playerSpawn.x, this.playerSpawn.y);
    this.events.emit('respawn', { entity: this.player });
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

  private onDeath(entity: CombatEntity, killer: CombatEntity | null): void {
    if (entity === this.player) {
      this.player.die();
      this.playerRespawnAt = this.now + PLAYER_RESPAWN_DELAY;
      return;
    }

    const monster = this.monsters.find((m) => m === entity);
    if (!monster) return;
    monster.onDeath();
    monster.brain.setState('dead', this.now);
    if (killer === this.player) {
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
