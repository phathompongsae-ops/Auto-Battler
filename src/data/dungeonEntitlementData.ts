import type { ItemId } from './itemData';

/*
 * Dungeon reward entitlements v1 (per character, per server day). Dungeons
 * never use Field Energy; instead the boss-clear reward is limited.
 *
 * Normal / Hard / Hell share one quota. Unused allowance does not carry over.
 */
export const DUNGEON_DAILY = {
  /** Free Full Reward claims each server day. */
  freeFullRewards: 5,
  /** Additional Dungeon Tickets can add at most this many Full Rewards a day (5 + 2 = 7). */
  maxExtraFullRewards: 2,
  /** Rewarded Assists a day once Full Rewards are used up; helping beyond this is unrewarded. */
  rewardedAssists: 3,
} as const;

/**
 * Claim history window: a character keeps the last N issued dungeon runs'
 * claim state. Runs older than that can no longer be claimed, so the history
 * stays bounded instead of growing with every clear ever made.
 */
export const DUNGEON_RUN_CLAIM_WINDOW = 64;

/**
 * DEMO: Assist reward (small, placeholder amounts). By rule it never contains
 * EXP, main equipment or Boss Fragments (validated in tests).
 */
export const ASSIST_REWARD: {
  gold: number;
  items: readonly { itemId: ItemId; count: readonly [number, number]; chance: number }[];
} = {
  gold: 100,
  items: [
    { itemId: 'enhancement_stone', count: [1, 2], chance: 1 },
    { itemId: 'enchant_stone', count: [1, 1], chance: 0.2 },
    { itemId: 'rare_craft_material', count: [1, 1], chance: 0.05 },
  ],
};
