/**
 * Internal playtest tuning. Gameplay receives one instance; dev controls may change it.
 * Return to production balance by setting both multipliers to 1 (or enabled to false).
 * Gold, Field Energy costs and Dungeon entitlement counts are never tuned here.
 */
export const DEMO_TEST_DEFAULTS = {
  enabled: true,
  expMultiplier: 10,
  dropRateMultiplier: 10,
} as const;

/** Upper bound for dev overrides; keeps a typo from flooding a test save. */
export const DEMO_MULTIPLIER_MAX = 100;

function validMultiplier(value: number, label: string): number {
  if (!Number.isFinite(value)) throw new RangeError(`${label} multiplier must be a finite number`);
  return Math.min(DEMO_MULTIPLIER_MAX, Math.max(0, value));
}

export class DemoTestMode {
  enabled = DEMO_TEST_DEFAULTS.enabled;
  expMultiplier: number = DEMO_TEST_DEFAULTS.expMultiplier;
  dropRateMultiplier: number = DEMO_TEST_DEFAULTS.dropRateMultiplier;

  reset(): void {
    this.enabled = DEMO_TEST_DEFAULTS.enabled;
    this.expMultiplier = DEMO_TEST_DEFAULTS.expMultiplier;
    this.dropRateMultiplier = DEMO_TEST_DEFAULTS.dropRateMultiplier;
  }

  /** Sets the EXP multiplier, clamped to 0..DEMO_MULTIPLIER_MAX; returns the value applied. */
  setExpMultiplier(value: number): number {
    return (this.expMultiplier = validMultiplier(value, 'EXP'));
  }

  /** Sets the drop-chance multiplier, clamped to 0..DEMO_MULTIPLIER_MAX; returns the value applied. */
  setDropRateMultiplier(value: number): number {
    return (this.dropRateMultiplier = validMultiplier(value, 'Drop'));
  }

  /** base EXP → level modifier → demo multiplier (ProgressionSystem then applies caps/Overflow). */
  exp(base: number, levelModifier = 1): number {
    return Math.max(0, Math.floor(base * levelModifier * (this.enabled ? this.expMultiplier : 1)));
  }

  /** Scales a drop probability (never quantity), clamped to 0..1. */
  dropChance(base: number): number {
    return Math.min(1, Math.max(0, base * (this.enabled ? this.dropRateMultiplier : 1)));
  }
}
