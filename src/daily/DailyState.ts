import type { ServerDayProvider } from '../core/serverDay';
import { FIELD_ENERGY } from '../data/energyData';

/** Every per-server-day allowance a character has. Fresh values come from data. */
export interface DailyValues {
  /** Field Energy left today. */
  fieldEnergy: number;
  /** Dungeon Full Reward claims used today (free and ticket-added alike). */
  dungeonFullClaims: number;
  /** Full Reward claims added today by Additional Dungeon Tickets. */
  dungeonExtraAdded: number;
  /** Rewarded dungeon Assists today. */
  assistRewardsClaimed: number;
}

export interface DailyRecord extends DailyValues {
  /** Server day these values belong to; null = never used (fresh). */
  day: number | null;
}

export function freshDaily(): DailyValues {
  return { fieldEnergy: FIELD_ENERGY.daily, dungeonFullClaims: 0, dungeonExtraAdded: 0, assistRewardsClaimed: 0 };
}

/**
 * The one daily-reset point. All daily allowances live in one record tagged
 * with its server day; the first access on a different day replaces the whole
 * record with fresh values, exactly once. Loading a save from an earlier day
 * therefore resets on first use, and loading again on the same day doesn't.
 */
export class DailyState {
  record: DailyRecord = { day: null, ...freshDaily() };

  constructor(private readonly serverDay: ServerDayProvider) {}

  /** Today's values (mutable). */
  today(): DailyValues {
    const day = this.serverDay.day();
    if (this.record.day !== day) this.record = { day, ...freshDaily() };
    return this.record;
  }
}
