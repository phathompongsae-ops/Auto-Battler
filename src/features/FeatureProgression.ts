import type { EventBus } from '../core/EventBus';
import { FEATURE_IDS, FEATURES, lockedMessage, type FeatureConditions, type FeatureId } from '../data/featureData';
import type { JobTier } from '../data/jobData';
import type { GameEvents } from '../game/GameEvents';
import type { FeatureUnlocks } from './FeatureUnlocks';

/** What feature conditions read about the character. */
export interface FeatureContext {
  level(): number;
  classTier(): JobTier;
  questClaimed(questId: string): boolean;
  serverDay(): number;
}

export type FeatureCheck = { ok: true } | { ok: false; reason: 'feature_locked'; featureId: FeatureId; message: string };

export function conditionsMet(c: FeatureConditions, ctx: FeatureContext, features: FeatureUnlocks): boolean {
  if (c.requiredLevel !== undefined && ctx.level() < c.requiredLevel) return false;
  if (c.requiredClassTier !== undefined && ctx.classTier() < c.requiredClassTier) return false;
  if (c.requiredServerDay !== undefined && ctx.serverDay() < c.requiredServerDay) return false;
  if (c.requiredQuestIds?.some((id) => !ctx.questClaimed(id))) return false;
  if (c.requiredFeatureIds?.some((id) => !features.isFeatureUnlocked(id))) return false;
  return true;
}

/**
 * The Demo progression gate: unlocks each feature once its data conditions
 * hold (re-checked on level-up, quest claim, job change, another unlock,
 * server-day change and load) and answers "may the player use X?" for menus
 * and actions. Unlocks are permanent; nothing here ever locks a feature.
 */
export class FeatureProgression {
  private evaluating = false;
  private readonly unsubscribe: (() => void)[];

  constructor(
    readonly features: FeatureUnlocks,
    private readonly ctx: FeatureContext,
    events: EventBus<GameEvents>,
    playerId: string,
  ) {
    this.unsubscribe = [
      events.on('levelUp', (e) => e.entityId === playerId && this.evaluate()),
      events.on('jobChanged', (e) => e.entityId === playerId && this.evaluate()),
      events.on('questClaimed', () => this.evaluate()),
      events.on('featureUnlocked', () => this.evaluate()), // dependencies (e.g. Weekly after Daily)
    ];
  }

  destroy(): void {
    for (const off of this.unsubscribe) off();
  }

  /**
   * Unlock every feature whose conditions now hold (repeats until nothing
   * changes, so chains resolve in one call). `restored`: the unlocks only
   * re-establish progress already earned (load, migration) — announced
   * quietly. Returns what was unlocked.
   */
  evaluate({ restored = false } = {}): FeatureId[] {
    if (this.evaluating) return [];
    this.evaluating = true;
    const unlocked: FeatureId[] = [];
    try {
      for (let changed = true; changed; ) {
        changed = false;
        for (const id of FEATURE_IDS) {
          const c = FEATURES[id].conditions;
          if (!c || this.features.isFeatureUnlocked(id) || !conditionsMet(c, this.ctx, this.features)) continue;
          this.features.unlock(id, { restored });
          unlocked.push(id);
          changed = true;
        }
      }
    } finally {
      this.evaluating = false;
    }
    return unlocked;
  }

  isUnlocked(id: FeatureId): boolean {
    return this.features.isFeatureUnlocked(id);
  }

  /** The gate every player-facing action / menu uses. */
  check(id: FeatureId): FeatureCheck {
    return this.isUnlocked(id) ? { ok: true } : { ok: false, reason: 'feature_locked', featureId: id, message: lockedMessage(id) };
  }

  /** Whether the conditions hold right now (unlocked or not). */
  conditionsMet(id: FeatureId): boolean {
    const c = FEATURES[id].conditions;
    return !!c && conditionsMet(c, this.ctx, this.features);
  }
}
