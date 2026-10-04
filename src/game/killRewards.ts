import type { CombatEntity } from '../combat/types';
import type { EventBus } from '../core/EventBus';
import type { GameEvents } from './GameEvents';
import type { LootTableId } from '../data/itemData';
import type { MonsterTier } from '../data/monsterBalance';
import type { FieldEnergy, KillRewardDecision, RewardZone } from '../energy/fieldEnergy';
import type { LootSystem } from '../loot/LootSystem';
import type { DemoTestMode } from '../data/demoTestMode';
import type { ProgressionSystem } from '../progression/ProgressionSystem';

export interface KilledMonster {
  id: string;
  x: number;
  y: number;
  def: { id: string; tier: MonsterTier; expReward: number; lootTable: LootTableId };
}

export interface KillRewardContext {
  zone: RewardZone;
  fieldEnergy: FieldEnergy;
  progression: ProgressionSystem;
  loot: LootSystem;
  player: CombatEntity;
  now: number;
  events: EventBus<GameEvents>;
  tuning?: DemoTestMode;
}

/**
 * Rewards for a monster the player killed. The kill itself always counts
 * (quests listen to the 'death' event, not to this). Field EXP and farming
 * drops need Field Energy; field quest drops always roll; dungeon mobs give
 * nothing (all dungeon rewards come from the boss-clear claim).
 */
export function grantKillRewards(monster: KilledMonster, ctx: KillRewardContext): KillRewardDecision {
  // Quest kill progress: every kill counts, whatever its rewards (0 Energy, dungeon...).
  ctx.events.emit('monsterKilled', { entityId: monster.id, monsterId: monster.def.id, tier: monster.def.tier, zone: ctx.zone });
  const decision = ctx.fieldEnergy.payForKill(ctx.zone, monster.def.tier);
  if (decision.exp) ctx.progression.grantExp(ctx.player, ctx.tuning?.exp(monster.def.expReward) ?? monster.def.expReward);
  ctx.loot.roll(monster.def.lootTable, monster.x, monster.y, ctx.now, { farmingDrops: decision.farmingDrops, questDrops: decision.questDrops });
  return decision;
}
