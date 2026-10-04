import type { CombatEntity } from '../combat/types';
import type { LootTableId } from '../data/itemData';
import type { MonsterTier } from '../data/monsterBalance';
import type { FieldEnergy, KillRewardDecision, RewardZone } from '../energy/fieldEnergy';
import type { LootSystem } from '../loot/LootSystem';
import type { ProgressionSystem } from '../progression/ProgressionSystem';

export interface KilledMonster {
  x: number;
  y: number;
  def: { tier: MonsterTier; expReward: number; lootTable: LootTableId };
}

export interface KillRewardContext {
  zone: RewardZone;
  fieldEnergy: FieldEnergy;
  progression: ProgressionSystem;
  loot: LootSystem;
  player: CombatEntity;
  now: number;
}

/**
 * Rewards for a monster the player killed. The kill itself always counts
 * (quests listen to the 'death' event, not to this). Field EXP and farming
 * drops need Field Energy; quest drops always roll; dungeon mobs give no EXP.
 */
export function grantKillRewards(monster: KilledMonster, ctx: KillRewardContext): KillRewardDecision {
  const decision = ctx.fieldEnergy.payForKill(ctx.zone, monster.def.tier);
  if (decision.exp) ctx.progression.grantExp(ctx.player, monster.def.expReward);
  ctx.loot.roll(monster.def.lootTable, monster.x, monster.y, ctx.now, { farmingDrops: decision.farmingDrops });
  return decision;
}
