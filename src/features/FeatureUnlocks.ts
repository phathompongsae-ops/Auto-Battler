import type { EventBus } from '../core/EventBus';
import { FEATURES, type FeatureId } from '../data/featureData';
import type { GameEvents } from '../game/GameEvents';

/**
 * Features the character has unlocked (persisted). Unlocks are permanent;
 * each one is announced once through `featureUnlocked` (marked `restored`
 * when it only re-establishes earned progress, e.g. loading an older save,
 * so the UI can stay quiet).
 */
export class FeatureUnlocks {
  readonly unlocked = new Set<FeatureId>();

  constructor(private readonly events?: EventBus<GameEvents>) {}

  isFeatureUnlocked(id: FeatureId): boolean {
    return this.unlocked.has(id);
  }

  /** True when this call unlocked it (false if it already was). */
  unlock(id: FeatureId, { restored = false } = {}): boolean {
    if (this.unlocked.has(id)) return false;
    this.unlocked.add(id);
    const def = FEATURES[id];
    this.events?.emit('featureUnlocked', { featureId: id, displayName: def.displayName, description: def.description, restored });
    return true;
  }
}
