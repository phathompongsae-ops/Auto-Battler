export interface AutoPotionSettings {
  hpEnabled: boolean;
  mpEnabled: boolean;
  hpThreshold: number;
  mpThreshold: number;
}
export const AUTO_POTION_DEFAULTS: Readonly<AutoPotionSettings> = {
  hpEnabled: true, mpEnabled: true, hpThreshold: 35, mpThreshold: 25,
};
/** Optional v4 settings: missing fields default, malformed values never reach the simulation. */
export function normalizePotionSettings(raw: unknown): AutoPotionSettings {
  const r = raw && typeof raw === 'object' ? raw as Partial<AutoPotionSettings> : {};
  const threshold = (v: unknown, fallback: number) => typeof v === 'number' && Number.isFinite(v) ? Math.min(100, Math.max(1, Math.round(v))) : fallback;
  return {
    hpEnabled: typeof r.hpEnabled === 'boolean' ? r.hpEnabled : true,
    mpEnabled: typeof r.mpEnabled === 'boolean' ? r.mpEnabled : true,
    hpThreshold: threshold(r.hpThreshold, 35), mpThreshold: threshold(r.mpThreshold, 25),
  };
}
