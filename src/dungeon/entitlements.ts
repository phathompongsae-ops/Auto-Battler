import type { DailyState } from '../daily/DailyState';
import { DUNGEON_DAILY } from '../data/dungeonEntitlementData';

export interface DungeonDailyStatus {
  freeFullRewards: number;
  extraAdded: number;
  /** Tickets that could still add a Full Reward today. */
  extraAddsLeft: number;
  fullClaimsUsed: number;
  fullRewardsLeft: number;
  assistRewardsClaimed: number;
  assistRewardsLeft: number;
}

export type AddExtraResult = { ok: true; fullRewardsLeft: number } | { ok: false; reason: 'daily_extra_limit' };

/**
 * Daily dungeon reward entitlements: 5 free Full Rewards, up to +2 from
 * Additional Dungeon Tickets (max 7), then up to 3 rewarded Assists. Normal,
 * Hard and Hell share the quota. Only a successful boss-clear claim uses one.
 */
export class DungeonEntitlements {
  constructor(private readonly daily: DailyState) {}

  status(): DungeonDailyStatus {
    const d = this.daily.today();
    return {
      freeFullRewards: DUNGEON_DAILY.freeFullRewards,
      extraAdded: d.dungeonExtraAdded,
      extraAddsLeft: DUNGEON_DAILY.maxExtraFullRewards - d.dungeonExtraAdded,
      fullClaimsUsed: d.dungeonFullClaims,
      fullRewardsLeft: Math.max(0, DUNGEON_DAILY.freeFullRewards + d.dungeonExtraAdded - d.dungeonFullClaims),
      assistRewardsClaimed: d.assistRewardsClaimed,
      assistRewardsLeft: Math.max(0, DUNGEON_DAILY.rewardedAssists - d.assistRewardsClaimed),
    };
  }

  /** One Additional Dungeon Ticket: +1 Full Reward today, at most +2 a day. */
  addExtraFullReward(): AddExtraResult {
    const d = this.daily.today();
    if (d.dungeonExtraAdded >= DUNGEON_DAILY.maxExtraFullRewards) return { ok: false, reason: 'daily_extra_limit' };
    d.dungeonExtraAdded += 1;
    return { ok: true, fullRewardsLeft: this.status().fullRewardsLeft };
  }

  /** Use one Full Reward claim; false when none are left. */
  consumeFullReward(): boolean {
    if (this.status().fullRewardsLeft <= 0) return false;
    this.daily.today().dungeonFullClaims += 1;
    return true;
  }

  /** Use one rewarded Assist; false when none are left (helping stays allowed). */
  consumeAssistReward(): boolean {
    if (this.status().assistRewardsLeft <= 0) return false;
    this.daily.today().assistRewardsClaimed += 1;
    return true;
  }

  /** DEV: put today's dungeon counters back to fresh (Energy untouched). */
  resetToday(): void {
    const d = this.daily.today();
    d.dungeonFullClaims = 0;
    d.dungeonExtraAdded = 0;
    d.assistRewardsClaimed = 0;
  }
}
