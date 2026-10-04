import { rollInt, weightedPick, type Rng } from '../core/rng';
import { DIFFICULTIES, type DifficultyId } from '../data/dungeonDifficulty';
import { ASSIST_REWARD, DUNGEON_RUN_CLAIM_WINDOW } from '../data/dungeonEntitlementData';
import { BOSS_REWARDS, CHANCE_DROP_QUANTITY, DUNGEONS } from '../data/dungeonRewards';
import type { Rarity } from '../data/equipmentData';
import type { ItemId } from '../data/itemData';
import type { DemoTestMode } from '../data/demoTestMode';
import { entryCheck } from './difficulty';

/** A rolled boss reward: what will be granted when the clear is claimed. */
export interface BossReward {
  equipment: { defId: string; rarity: Rarity }[];
  items: Partial<Record<ItemId, number>>;
  gold: number;
  exp: number;
}

/** A rolled Assist reward: small materials and Gold only (never EXP, main equipment or Boss Fragments). */
export interface AssistReward {
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
 * Roll a boss clear's Full Reward. Always: Equipment x1, Boss Fragments,
 * Enhancement Stones, Gold and the dungeon's EXP. Chance drops whose odds are
 * still null (hooks) are never rolled.
 */
export function rollBossReward(dungeonId: string, difficulty: DifficultyId, rng: Rng, tuning?: DemoTestMode): BossReward {
  const dungeon = DUNGEONS[dungeonId];
  if (!dungeon) throw new Error(`unknown dungeon ${dungeonId}`);
  const table = BOSS_REWARDS[difficulty];
  const items: Partial<Record<ItemId, number>> = {};
  const give = (id: ItemId, n: number) => (items[id] = (items[id] ?? 0) + n);

  const equipment = [rollEquipment(dungeonId, difficulty, rng)];
  give('boss_fragment', table.bossFragments);
  give('enhancement_stone', rollInt(table.enhancementStones[0], table.enhancementStones[1], rng));
  const gold = Math.round(dungeon.bossGold * DIFFICULTIES[difficulty].rewards.currency);
  const exp = Math.round(dungeon.bossExp * DIFFICULTIES[difficulty].rewards.exp);

  const c = table.chances;
  const chance = (base: number) => tuning?.dropChance(base) ?? base;
  if (rng() < chance(c.enchantStone)) give('enchant_stone', CHANCE_DROP_QUANTITY.enchantStone);
  if (rng() < chance(c.rareCraftMaterial)) give('rare_craft_material', CHANCE_DROP_QUANTITY.rareCraftMaterial);
  if (rng() < chance(c.extraEquipment)) equipment.push(rollEquipment(dungeonId, difficulty, rng));
  if (c.blueprint !== null && rng() < chance(c.blueprint)) give(dungeon.blueprintItem as ItemId, CHANCE_DROP_QUANTITY.blueprint);
  if (c.protectionStone !== null && rng() < chance(c.protectionStone)) give('protection_stone', CHANCE_DROP_QUANTITY.protectionStone);
  if (c.successBooster !== null && rng() < chance(c.successBooster)) give('success_booster', CHANCE_DROP_QUANTITY.successBooster);

  return { equipment, items, gold, exp };
}

/** Roll a rewarded Assist from ASSIST_REWARD (data). */
export function rollAssistReward(rng: Rng, tuning?: DemoTestMode): AssistReward {
  const items: Partial<Record<ItemId, number>> = {};
  for (const entry of ASSIST_REWARD.items) {
    if (rng() < (tuning?.dropChance(entry.chance) ?? entry.chance)) items[entry.itemId] = (items[entry.itemId] ?? 0) + rollInt(entry.count[0], entry.count[1], rng);
  }
  return { items, gold: ASSIST_REWARD.gold };
}

/** Stable id of one dungeon clear. */
export function clearId(dungeonId: string, difficulty: DifficultyId, runId: string): string {
  return `${dungeonId}:${difficulty}:${runId}`;
}

/** One dungeon run, issued by the character's RewardLedger. */
export interface DungeonRun {
  /** Per-character run number; the claim key. */
  seq: number;
  runId: string;
  dungeonId: string;
  difficulty: DifficultyId;
  clearId: string;
  entry: ReturnType<typeof entryCheck>;
}

export type RunClaimState = 'claimable' | 'already_claimed' | 'unknown_run' | 'expired';

/**
 * Issues dungeon runs and remembers which were claimed, so each run's reward
 * (EXP, equipment, Boss Fragments, materials, Gold and the daily entitlement)
 * is granted at most once.
 *
 * Bounded by design: runs are numbered per character and only the last
 * DUNGEON_RUN_CLAIM_WINDOW runs can be claimed; older ones are `expired` and
 * forgotten. `nextSeq` and `claimed` are saved together with the rest of the
 * character, so a save made after a claim can't claim it again, and a run the
 * loaded state never issued is `unknown_run`.
 */
export class RewardLedger {
  /** Next run number to issue (persisted). */
  nextSeq = 1;
  /** Claimed run numbers inside the window (persisted). */
  readonly claimed = new Set<number>();

  /**
   * Start a dungeon run. Entry is never gated by level and costs nothing:
   * neither Field Energy nor a reward entitlement.
   */
  startRun(dungeonId: string, difficulty: DifficultyId, playerLevel: number): DungeonRun {
    const dungeon = DUNGEONS[dungeonId];
    if (!dungeon) throw new Error(`unknown dungeon ${dungeonId}`);
    const seq = this.nextSeq++;
    const runId = `run-${seq}`;
    this.prune();
    return { seq, runId, dungeonId, difficulty, clearId: clearId(dungeonId, difficulty, runId), entry: entryCheck(playerLevel, dungeon.baseLevel, difficulty) };
  }

  state(run: Pick<DungeonRun, 'seq'>): RunClaimState {
    if (!Number.isInteger(run.seq) || run.seq < 1 || run.seq >= this.nextSeq) return 'unknown_run';
    if (run.seq <= this.nextSeq - 1 - DUNGEON_RUN_CLAIM_WINDOW) return 'expired';
    return this.claimed.has(run.seq) ? 'already_claimed' : 'claimable';
  }

  /** Mark a claimable run claimed. Call only after state() said 'claimable'. */
  markClaimed(run: Pick<DungeonRun, 'seq'>): void {
    this.claimed.add(run.seq);
  }

  private prune(): void {
    const oldest = this.nextSeq - DUNGEON_RUN_CLAIM_WINDOW;
    for (const seq of this.claimed) if (seq < oldest) this.claimed.delete(seq);
  }
}
