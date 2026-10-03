import { rollInt, weightedPick, type Rng } from '../core/rng';
import { DIFFICULTIES, type DifficultyId } from '../data/dungeonDifficulty';
import { BOSS_REWARDS, CHANCE_DROP_QUANTITY, DUNGEONS } from '../data/dungeonRewards';
import type { Rarity } from '../data/equipmentData';
import type { ItemId } from '../data/itemData';
import { entryCheck } from './difficulty';

/** A rolled boss reward: what will be granted when the clear is claimed. */
export interface BossReward {
  equipment: { defId: string; rarity: Rarity }[];
  items: Partial<Record<ItemId, number>>;
  gold: number;
}

function rollEquipment(dungeonId: string, difficulty: DifficultyId, rng: Rng): { defId: string; rarity: Rarity } {
  const rarity = weightedPick(BOSS_REWARDS[difficulty].equipmentRarity, rng);
  const pool = DUNGEONS[dungeonId].equipmentPool[rarity];
  if (!pool.length) throw new Error(`${dungeonId} has no ${rarity} equipment`);
  return { defId: pool[Math.floor(rng() * pool.length)], rarity };
}

/**
 * Roll a boss clear's reward. Always: Equipment x1, Boss Fragments,
 * Enhancement Stones, Gold. Chance drops whose odds are still null (hooks)
 * are never rolled.
 */
export function rollBossReward(dungeonId: string, difficulty: DifficultyId, rng: Rng): BossReward {
  const dungeon = DUNGEONS[dungeonId];
  if (!dungeon) throw new Error(`unknown dungeon ${dungeonId}`);
  const table = BOSS_REWARDS[difficulty];
  const items: Partial<Record<ItemId, number>> = {};
  const give = (id: ItemId, n: number) => (items[id] = (items[id] ?? 0) + n);

  const equipment = [rollEquipment(dungeonId, difficulty, rng)];
  give('boss_fragment', table.bossFragments);
  give('enhancement_stone', rollInt(table.enhancementStones[0], table.enhancementStones[1], rng));
  const gold = Math.round(dungeon.bossGold * DIFFICULTIES[difficulty].rewards.currency);

  const c = table.chances;
  if (rng() < c.enchantStone) give('enchant_stone', CHANCE_DROP_QUANTITY.enchantStone);
  if (rng() < c.rareCraftMaterial) give('rare_craft_material', CHANCE_DROP_QUANTITY.rareCraftMaterial);
  if (rng() < c.extraEquipment) equipment.push(rollEquipment(dungeonId, difficulty, rng));
  if (c.blueprint !== null && rng() < c.blueprint) give(dungeon.blueprintItem as ItemId, CHANCE_DROP_QUANTITY.blueprint);
  if (c.protectionStone !== null && rng() < c.protectionStone) give('protection_stone', CHANCE_DROP_QUANTITY.protectionStone);
  if (c.successBooster !== null && rng() < c.successBooster) give('success_booster', CHANCE_DROP_QUANTITY.successBooster);

  return { equipment, items, gold };
}

/**
 * Energy contract for claiming a clear. Energy is consumed when a boss reward
 * is CLAIMED — never on entering, teleporting or wiping. The full economy
 * isn't built; DEMO uses `freeEnergy`.
 */
export interface EnergyGate {
  /** Spend the energy for this clear; false if the player can't afford it (claim refused). */
  consumeForClaim(clearId: string): boolean;
}

export const freeEnergy: EnergyGate = { consumeForClaim: () => true };

/** Stable id of one dungeon clear. A server would issue the run id; DEMO uses a local counter. */
export function clearId(dungeonId: string, difficulty: DifficultyId, runId: string): string {
  return `${dungeonId}:${difficulty}:${runId}`;
}

export type ClaimResult = { ok: true; reward: BossReward } | { ok: false; reason: 'already_claimed' | 'no_energy' };

/**
 * Idempotent reward claims: each clear id can be claimed once. Claiming
 * consumes energy (through the gate) and then grants the reward.
 */
export class RewardLedger {
  readonly claimed = new Set<string>();

  claim(id: string, reward: BossReward, grant: (reward: BossReward) => void, energy: EnergyGate = freeEnergy): ClaimResult {
    if (this.claimed.has(id)) return { ok: false, reason: 'already_claimed' };
    if (!energy.consumeForClaim(id)) return { ok: false, reason: 'no_energy' };
    this.claimed.add(id);
    grant(reward);
    return { ok: true, reward };
  }
}

/**
 * Start a dungeon run. Entry is never gated by level and never costs Energy
 * (there is deliberately no EnergyGate here): Energy is only spent when the
 * resulting clear is claimed.
 */
export function startDungeonRun(dungeonId: string, difficulty: DifficultyId, playerLevel: number, runId: string) {
  const dungeon = DUNGEONS[dungeonId];
  if (!dungeon) throw new Error(`unknown dungeon ${dungeonId}`);
  return { clearId: clearId(dungeonId, difficulty, runId), entry: entryCheck(playerLevel, dungeon.baseLevel, difficulty) };
}
