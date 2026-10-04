import type { Rng } from '../core/rng';
import type { ItemId } from '../data/itemData';
import type { Wallet } from '../economy/Wallet';
import type { EquipmentManager } from '../equipment/equipment';
import { createEquipment, randomIdSource, type IdSource } from '../equipment/factory';
import type { Inventory } from '../loot/Inventory';
import type { DungeonEntitlements } from './entitlements';
import { rollAssistReward, rollBossReward, type AssistReward, type BossReward, type DungeonRun, type RewardLedger } from './rewards';

export interface ClaimContext {
  ledger: RewardLedger;
  entitlements: DungeonEntitlements;
  inventory: Inventory;
  wallet: Wallet;
  equipment: EquipmentManager;
  /** Grants EXP through the progression rules (level cap, Overflow, events). */
  grantExp: (amount: number) => void;
  rng: Rng;
  newItemId?: IdSource;
}

export type DungeonClaimResult =
  | { ok: true; kind: 'full'; reward: BossReward }
  | { ok: true; kind: 'assist'; reward: AssistReward }
  /** Cleared with no Full Reward or rewarded Assist left: allowed, nothing granted. */
  | { ok: true; kind: 'none' }
  | { ok: false; reason: 'already_claimed' | 'unknown_run' | 'expired' };

function grantItems(inventory: Inventory, items: Partial<Record<ItemId, number>>): void {
  for (const [id, n] of Object.entries(items) as [ItemId, number][]) if (n > 0) inventory.add(id, n);
}

/**
 * Claim a successful boss clear. The ONLY place a dungeon reward is granted
 * or a daily entitlement is used; dying, failing or leaving simply never calls
 * it. Idempotent per run: a retry returns `already_claimed` and changes
 * nothing.
 *
 * Order: a Full Reward while any is left today (EXP, equipment, Boss
 * Fragments, materials, Gold); otherwise a rewarded Assist while any is left
 * (small materials and Gold only); otherwise nothing.
 */
export function claimDungeonClear(run: DungeonRun, ctx: ClaimContext): DungeonClaimResult {
  const state = ctx.ledger.state(run);
  if (state !== 'claimable') return { ok: false, reason: state };

  if (ctx.entitlements.consumeFullReward()) {
    const reward = rollBossReward(run.dungeonId, run.difficulty, ctx.rng);
    ctx.ledger.markClaimed(run);
    grantItems(ctx.inventory, reward.items);
    ctx.wallet.add('gold', reward.gold);
    for (const e of reward.equipment) ctx.equipment.add(createEquipment(e.defId, ctx.rng, ctx.newItemId ?? randomIdSource));
    ctx.grantExp(reward.exp);
    return { ok: true, kind: 'full', reward };
  }

  if (ctx.entitlements.consumeAssistReward()) {
    const reward = rollAssistReward(ctx.rng);
    ctx.ledger.markClaimed(run);
    grantItems(ctx.inventory, reward.items);
    ctx.wallet.add('gold', reward.gold);
    return { ok: true, kind: 'assist', reward };
  }

  ctx.ledger.markClaimed(run);
  return { ok: true, kind: 'none' };
}
