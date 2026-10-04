import type { JobTier } from './jobData';

/*
 * Feature Unlock v1 (Demo): which systems the player may use, and when they
 * open up. Data only; the FeatureProgression service evaluates the
 * conditions and the menus / actions read the result. Backend systems exist
 * regardless: only player-facing access is gated.
 *
 * Teaching order: Equipment → Warp → Job Change → Class 1 Skills →
 * Enhancement → Daily → Enchant → Pet / Dungeon / Crafting → Weekly.
 */
export const FEATURE_IDS = [
  'equipment',
  'warp',
  'job_change',
  'class_1_skills',
  'enhancement',
  'daily_commission',
  'enchant',
  'pet',
  'dungeon',
  'crafting',
  'weekly_quests',
  'demo_feature',
] as const;

export type FeatureId = (typeof FEATURE_IDS)[number];

export const isFeatureId = (v: unknown): v is FeatureId => typeof v === 'string' && (FEATURE_IDS as readonly string[]).includes(v);

/** All must hold. A feature without conditions never unlocks by itself (quest rewards, scripts). */
export interface FeatureConditions {
  requiredLevel?: number;
  requiredFeatureIds?: readonly FeatureId[];
  /** These quests must be claimed. */
  requiredQuestIds?: readonly string[];
  /** The character's job tier must be at least this (1 = any Class 1 job). */
  requiredClassTier?: JobTier;
  requiredServerDay?: number;
}

export interface FeatureDef {
  id: FeatureId;
  displayName: string;
  description: string;
  /** null = never unlocks on its own (granted explicitly). */
  conditions: FeatureConditions | null;
  /** Shown while locked; default "Unlocks at Lv{requiredLevel}". */
  lockedMessage?: string;
}

const def = (d: FeatureDef) => d;

export const FEATURES: Readonly<Record<FeatureId, FeatureDef>> = {
  equipment: def({ id: 'equipment', displayName: 'Equipment', description: 'Equip and manage your gear.', conditions: {} }),
  warp: def({ id: 'warp', displayName: 'Warp', description: 'Warp Scrolls can take you to town and to discovered dungeons.', conditions: { requiredLevel: 5 } }),
  job_change: def({
    id: 'job_change',
    displayName: 'Job Change',
    description: 'Visit the Job Instructor to choose your Class.',
    conditions: { requiredLevel: 11 },
  }),
  class_1_skills: def({
    id: 'class_1_skills',
    displayName: 'Class Skills',
    description: 'Spend Skill Points in your Class 1 skill tree.',
    conditions: { requiredClassTier: 1 },
    lockedMessage: 'Change Job to unlock',
  }),
  enhancement: def({ id: 'enhancement', displayName: 'Enhancement', description: 'Strengthen your equipment with Enhancement Stones.', conditions: { requiredLevel: 15 } }),
  daily_commission: def({ id: 'daily_commission', displayName: 'Daily Commission', description: 'Three new commissions every day.', conditions: { requiredLevel: 16 } }),
  enchant: def({ id: 'enchant', displayName: 'Enchant', description: 'Reroll the enchant lines on your equipment.', conditions: { requiredLevel: 18 } }),
  pet: def({ id: 'pet', displayName: 'Pet System', description: 'Hatch eggs and bring a companion along.', conditions: { requiredLevel: 20 } }),
  dungeon: def({ id: 'dungeon', displayName: 'Dungeon', description: 'Challenge dungeons on Normal, Hard and Hell.', conditions: { requiredLevel: 20 } }),
  crafting: def({ id: 'crafting', displayName: 'Crafting', description: 'Craft powerful equipment from blueprints.', conditions: { requiredLevel: 20 } }),
  weekly_quests: def({
    id: 'weekly_quests',
    displayName: 'Weekly Quests',
    description: 'Weekly goals with Diamond rewards and milestones.',
    conditions: { requiredLevel: 20, requiredFeatureIds: ['daily_commission'] },
  }),
  demo_feature: def({ id: 'demo_feature', displayName: 'Demo Feature', description: 'Test fixture (demo quest reward).', conditions: null, lockedMessage: 'Demo quest reward' }),
};

/** Player-facing reason a feature is locked. */
export function lockedMessage(id: FeatureId): string {
  const d = FEATURES[id];
  if (d.lockedMessage) return d.lockedMessage;
  if (d.conditions?.requiredLevel) return `Unlocks at Lv${d.conditions.requiredLevel}`;
  return 'Locked';
}
