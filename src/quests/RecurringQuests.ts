import type { EventBus } from '../core/EventBus';
import { seededRng } from '../core/rng';
import type { ServerDayProvider } from '../core/serverDay';
import {
  DAILY_FEATURE,
  DAILY_POOL,
  DAILY_QUESTS,
  RECURRING_CONFIG,
  WEEKLY_FEATURE,
  WEEKLY_MILESTONES,
  WEEKLY_QUESTS,
} from '../data/quests/recurringQuests';
import type { QuestRewards } from '../data/questData';
import type { FeatureUnlocks } from '../features/FeatureUnlocks';
import type { GameEvents } from '../game/GameEvents';
import { grantQuestRewards, type QuestRewardSink, type QuestSystem } from './QuestSystem';

/** Persisted Daily / Weekly cycle state (quest progress itself lives in the quest log). */
export interface RecurringState {
  daily: {
    /** Server day this Daily set belongs to (null = never assigned). */
    cycleId: number | null;
    /** Today's Daily Commissions, in selection order. */
    questIds: string[];
  };
  weekly: {
    /** Server week (0 = days 1–7) the Weekly state belongs to. */
    cycleId: number | null;
    /** Daily Commissions claimed this week (feeds Weekly "Adventurer"). */
    dailyClaims: number;
    /** Milestones (claimed-Weekly counts) already collected this week. */
    milestonesClaimed: number[];
  };
}

export const emptyRecurringState = (): RecurringState => ({
  daily: { cycleId: null, questIds: [] },
  weekly: { cycleId: null, dailyClaims: 0, milestonesClaimed: [] },
});

/** Server week of a server day: week 0 = days 1–7, week 1 = days 8–14, ... */
export function serverWeek(day: number): number {
  return Math.floor((day - 1) / RECURRING_CONFIG.daysPerWeek);
}

/**
 * Today's Daily Commissions: `count` distinct pool entries, weighted, chosen
 * by a generator seeded from the server day only (never browser randomness),
 * so the same day always gives the same set. `level` filters eligibility.
 */
export function selectDailyQuests(day: number, level: number, pool = DAILY_POOL, count = RECURRING_CONFIG.dailyCount): string[] {
  const rng = seededRng(Math.imul(day, 2654435761) ^ 0x5eed);
  const candidates = pool.filter((p) => level >= p.minLevel && p.weight > 0);
  const picked: string[] = [];
  while (picked.length < count && candidates.length) {
    const total = candidates.reduce((s, c) => s + c.weight, 0);
    let roll = rng() * total;
    let i = 0;
    while (i < candidates.length - 1 && roll >= candidates[i].weight) roll -= candidates[i++].weight;
    picked.push(candidates[i].questId);
    candidates.splice(i, 1);
  }
  return picked;
}

export type ClaimMilestoneResult =
  | { ok: true; milestone: number }
  | { ok: false; reason: 'feature_locked' | 'unknown_milestone' | 'not_reached' | 'already_claimed' };

export interface MilestoneView {
  milestone: number;
  rewards: QuestRewards;
  reached: boolean;
  claimed: boolean;
}

/**
 * Daily Commissions and Weekly quests on top of the Quest Engine. Uses the
 * shared server day (no second clock): a new day expires yesterday's Dailies
 * (unclaimed rewards included) and assigns 3 new ones; a new week resets the
 * 7 Weeklies, the milestone claims and the Daily-claim counter. Assigned
 * quests are started automatically once their feature is unlocked; claiming
 * stays explicit. Everything persists, and a cycle resets exactly once.
 */
export class RecurringQuests {
  state: RecurringState = emptyRecurringState();
  private readonly unsubscribe: (() => void)[];

  constructor(
    private readonly quests: QuestSystem,
    private readonly features: FeatureUnlocks,
    private readonly serverDay: ServerDayProvider,
    private readonly level: () => number,
    private readonly rewards: QuestRewardSink,
    private readonly events: EventBus<GameEvents>,
  ) {
    quests.offered = (questId) => this.isOffered(questId);
    this.unsubscribe = [
      // Counted on the reward claim, which happens once per quest per day.
      events.on('questClaimed', ({ questId }) => {
        if (!this.state.daily.questIds.includes(questId)) return;
        this.state.weekly.dailyClaims += 1;
        events.emit('dailyCommissionClaimed', { questId, claimedThisWeek: this.state.weekly.dailyClaims });
      }),
      events.on('featureUnlocked', ({ featureId }) => {
        if (featureId === DAILY_FEATURE || featureId === WEEKLY_FEATURE) this.sync();
      }),
    ];
  }

  destroy(): void {
    for (const off of this.unsubscribe) off();
  }

  /** Whether a recurring quest belongs to the current cycle. */
  isOffered(questId: string): boolean {
    if (questId in DAILY_QUESTS) return this.state.daily.cycleId === this.serverDay.day() && this.state.daily.questIds.includes(questId);
    if (questId in WEEKLY_QUESTS) return this.state.weekly.cycleId === serverWeek(this.serverDay.day());
    return false;
  }

  /**
   * Bring cycles up to date with the server day (call on day change, feature
   * unlock and load). Week first, so a new week's counter starts clean.
   */
  sync(): void {
    const day = this.serverDay.day();
    const week = serverWeek(day);
    if (this.state.weekly.cycleId !== week) {
      for (const id of Object.keys(WEEKLY_QUESTS)) this.quests.forget(id);
      this.state.weekly = { cycleId: week, dailyClaims: 0, milestonesClaimed: [] };
      this.events.emit('recurringReset', { cycle: 'weekly', cycleId: week });
    }
    if (this.state.daily.cycleId !== day) {
      // The whole previous set expires, even a quest that is selected again today: it starts over.
      for (const id of this.state.daily.questIds) this.quests.forget(id);
      this.state.daily = { cycleId: day, questIds: selectDailyQuests(day, this.level()) };
      this.events.emit('recurringReset', { cycle: 'daily', cycleId: day });
    }
    // Yesterday's (and any stray) Daily records expire, unclaimed rewards included.
    for (const id of Object.keys(DAILY_QUESTS)) if (!this.state.daily.questIds.includes(id)) this.quests.forget(id);
    // Assign the current cycle once the feature is unlocked.
    if (this.features.isFeatureUnlocked(DAILY_FEATURE)) for (const id of this.state.daily.questIds) this.assign(id);
    if (this.features.isFeatureUnlocked(WEEKLY_FEATURE)) for (const id of Object.keys(WEEKLY_QUESTS)) this.assign(id);
  }

  private assign(questId: string): void {
    if (questId in this.quests.defs && this.quests.status(questId) === 'available') this.quests.start(questId);
  }

  dailyQuestIds(): string[] {
    return [...this.state.daily.questIds];
  }

  weeklyQuestIds(): string[] {
    return Object.keys(WEEKLY_QUESTS);
  }

  /** Weekly quests claimed this week (milestone progress, out of 7). */
  weeklyClaimed(): number {
    return this.weeklyQuestIds().filter((id) => id in this.quests.defs && this.quests.status(id) === 'claimed').length;
  }

  milestones(): MilestoneView[] {
    const claimed = this.weeklyClaimed();
    return WEEKLY_MILESTONES.map((m) => ({
      milestone: m.claimed,
      rewards: m.rewards,
      reached: claimed >= m.claimed,
      claimed: this.state.weekly.milestonesClaimed.includes(m.claimed),
    }));
  }

  /** Collect a Weekly milestone (explicit; once per week). */
  claimMilestone(milestone: number): ClaimMilestoneResult {
    if (!this.features.isFeatureUnlocked(WEEKLY_FEATURE)) return { ok: false, reason: 'feature_locked' };
    const def = WEEKLY_MILESTONES.find((m) => m.claimed === milestone);
    if (!def) return { ok: false, reason: 'unknown_milestone' };
    if (this.state.weekly.milestonesClaimed.includes(milestone)) return { ok: false, reason: 'already_claimed' };
    if (this.weeklyClaimed() < milestone) return { ok: false, reason: 'not_reached' };
    this.state.weekly.milestonesClaimed.push(milestone);
    grantQuestRewards(this.rewards, def.rewards);
    this.events.emit('weeklyMilestoneClaimed', { milestone });
    return { ok: true, milestone };
  }

  toState(): RecurringState {
    return structuredClone(this.state);
  }

  /** Restore saved cycle state (validated). Call sync() afterwards to apply any pending reset once. */
  load(state: RecurringState): void {
    this.state = structuredClone(state);
  }

  /** DEV: forget the current Daily / Weekly cycle so the next sync starts a fresh one. */
  resetCycle(cycle: 'daily' | 'weekly'): void {
    if (cycle === 'daily') {
      for (const id of this.state.daily.questIds) this.quests.forget(id);
      this.state.daily = { cycleId: null, questIds: [] };
    } else this.state.weekly = { ...this.state.weekly, cycleId: null };
    this.sync();
  }
}
