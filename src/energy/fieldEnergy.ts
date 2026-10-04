import type { DailyState } from '../daily/DailyState';
import { FIELD_ENERGY } from '../data/energyData';
import type { MonsterTier } from '../data/monsterBalance';

/** Where a kill happened. Only field kills pay Field Energy. */
export type RewardZone = 'field' | 'dungeon';

/** What a kill grants, decided before anything is rolled or given. */
export interface KillRewardDecision {
  /** The monster's EXP. */
  exp: boolean;
  /** Normal and rare farming drops. Quest drops are never gated. */
  farmingDrops: boolean;
  energySpent: number;
}

/**
 * Field Energy: a daily budget for normal field farming rewards. Stored in
 * the shared DailyState, so it refills with every other daily allowance.
 */
export class FieldEnergy {
  constructor(private readonly daily: DailyState) {}

  current(): number {
    return this.daily.today().fieldEnergy;
  }

  /** Set the Energy left today (clamped to 0..daily). Used by dev tools. */
  set(amount: number): void {
    this.daily.today().fieldEnergy = Math.max(0, Math.min(FIELD_ENERGY.daily, Math.floor(amount)));
  }

  /**
   * Decide a kill's rewards.
   * - Dungeon: never uses Energy; mobs give no EXP (dungeon EXP comes only
   *   from the boss-clear claim); their drops are unchanged.
   * - Field with Energy left: full EXP and drops; pay the tier's cost. A cost
   *   larger than what's left still grants the full reward and empties it.
   * - Field at 0 Energy: no EXP, no normal or rare farming drops, nothing
   *   spent. The kill still counts for quests, and quest drops still roll.
   */
  payForKill(zone: RewardZone, tier: MonsterTier): KillRewardDecision {
    if (zone === 'dungeon') return { exp: false, farmingDrops: true, energySpent: 0 };
    const today = this.daily.today();
    if (today.fieldEnergy <= 0) return { exp: false, farmingDrops: false, energySpent: 0 };
    const spent = Math.min(today.fieldEnergy, FIELD_ENERGY.costByTier[tier]);
    today.fieldEnergy -= spent;
    return { exp: true, farmingDrops: true, energySpent: spent };
  }
}
