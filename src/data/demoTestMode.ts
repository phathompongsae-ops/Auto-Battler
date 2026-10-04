/** Internal playtest tuning. Gameplay receives one instance; dev controls may change it. */
export const DEMO_TEST_DEFAULTS = {
  enabled: true,
  expMultiplier: 10,
  dropRateMultiplier: 10,
} as const;

export class DemoTestMode {
  enabled = DEMO_TEST_DEFAULTS.enabled;
  expMultiplier: number = DEMO_TEST_DEFAULTS.expMultiplier;
  dropRateMultiplier: number = DEMO_TEST_DEFAULTS.dropRateMultiplier;

  reset(): void {
    this.enabled = DEMO_TEST_DEFAULTS.enabled;
    this.expMultiplier = DEMO_TEST_DEFAULTS.expMultiplier;
    this.dropRateMultiplier = DEMO_TEST_DEFAULTS.dropRateMultiplier;
  }

  setExpMultiplier(value: number): void {
    if (!Number.isFinite(value) || value < 0) throw new RangeError('EXP multiplier must be finite and non-negative');
    this.expMultiplier = value;
  }

  setDropRateMultiplier(value: number): void {
    if (!Number.isFinite(value) || value < 0) throw new RangeError('Drop multiplier must be finite and non-negative');
    this.dropRateMultiplier = value;
  }

  exp(base: number, levelModifier = 1): number {
    return Math.max(0, Math.floor(base * levelModifier * (this.enabled ? this.expMultiplier : 1)));
  }

  dropChance(base: number): number {
    return Math.min(1, Math.max(0, base * (this.enabled ? this.dropRateMultiplier : 1)));
  }
}
