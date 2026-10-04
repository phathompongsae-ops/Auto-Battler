import type { FeatureId } from '../data/featureData';

/** Features the character has unlocked (persisted). Gating UI comes later. */
export class FeatureUnlocks {
  readonly unlocked = new Set<FeatureId>();

  isFeatureUnlocked(id: FeatureId): boolean {
    return this.unlocked.has(id);
  }

  /** True when this call unlocked it (false if it already was). */
  unlock(id: FeatureId): boolean {
    if (this.unlocked.has(id)) return false;
    this.unlocked.add(id);
    return true;
  }
}
