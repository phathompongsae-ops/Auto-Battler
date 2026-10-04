/*
 * Feature ids a quest can unlock (Feature Unlock hook). Only the ids and the
 * unlocked state exist for now; menus / gating UI come in the Feature Unlock
 * phase. `demo_feature` is a test fixture.
 */
export const FEATURE_IDS = ['warp', 'enhancement', 'enchant', 'crafting', 'pet', 'dungeon', 'daily_quest', 'demo_feature'] as const;

export type FeatureId = (typeof FEATURE_IDS)[number];

export const isFeatureId = (v: unknown): v is FeatureId => typeof v === 'string' && (FEATURE_IDS as readonly string[]).includes(v);
