import type { DifficultyId } from './dungeonDifficulty';
import type { FeatureId } from './featureData';
import type { ItemId } from './itemData';
import type { JobId } from './jobData';
import { DEMO_TEST_QUESTS } from './quests/demoTestQuests';
import { JOB_QUESTS } from './quests/jobQuests';
import { DAILY_QUESTS, WEEKLY_QUESTS } from './quests/recurringQuests';
import type { MonsterTier } from './monsterBalance';

/*
 * Quest definitions: plain data, keyed by stable id. Gameplay systems never
 * name a quest id; they report events and the Quest Engine matches them.
 */

export const QUEST_TYPES = ['main', 'side', 'feature', 'daily', 'weekly', 'job'] as const;
export type QuestType = (typeof QUEST_TYPES)[number];

/**
 * What a quest asks for. `count` defaults to 1. New kinds (enchant, craft,
 * pet, class change, equip, boss kill, use item...) are added here plus one
 * matcher in quests/objectives.ts.
 */
export type QuestObjective =
  | { kind: 'talk'; npcId: string; count?: number }
  /** Kills; each filter is optional (no monsterId = any monster; zone/tier narrow it, e.g. field Elites). */
  | { kind: 'kill'; monsterId?: string; tier?: MonsterTier; zone?: 'field' | 'dungeon'; count?: number }
  /** Cumulative: items acquired while the quest is active (losing them later doesn't undo progress). */
  | { kind: 'collect'; itemId: ItemId; count?: number }
  | { kind: 'visit'; locationId: string; count?: number }
  /**
   * A successful dungeon clear (once per run). No dungeonId = any dungeon; any
   * difficulty unless set; `assist: true` = only clears resolved as an Assist
   * (rewarded or not).
   */
  | { kind: 'dungeon_clear'; dungeonId?: string; difficulty?: DifficultyId; assist?: boolean; count?: number }
  /** Successful enhancements; with `minLevel`, only successes that reach at least +minLevel. */
  | { kind: 'enhance'; minLevel?: number; count?: number }
  /** Daily Commissions claimed (counted once per claim). */
  | { kind: 'daily_commission'; count?: number };

export type ObjectiveKind = QuestObjective['kind'];

/** All must hold for the quest to become available. */
export interface QuestPrerequisites {
  requiredLevel?: number;
  /** These quests must be claimed. */
  requiredQuestIds?: readonly string[];
  /** The character's current job must be one of these. */
  requiredClass?: readonly JobId[];
  requiredServerDay?: number;
  requiredFeatureIds?: readonly FeatureId[];
}

/**
 * Granted once, on claim. There is deliberately no skill-point reward: skill
 * points come only from job and level.
 */
export interface QuestRewards {
  exp?: number;
  gold?: number;
  diamond?: number;
  items?: readonly { itemId: ItemId; count: number }[];
  unlockFeatures?: readonly FeatureId[];
}

export interface QuestDef {
  id: string;
  title: string;
  description: string;
  type: QuestType;
  objectives: readonly QuestObjective[];
  rewards: QuestRewards;
  prerequisites?: QuestPrerequisites;
  /** Chain links: quests this one leads to (informational; their prerequisites decide availability). */
  nextQuestIds?: readonly string[];
  /** The feature this quest introduces; unlocked on claim (with rewards.unlockFeatures). */
  featureUnlockId?: FeatureId;
  /** Repeat metadata for daily/weekly quests. Stored only; resets are not implemented yet. */
  repeat?: { reset: 'daily' | 'weekly' };
}

/** Active Internal Demo content: Job Change is the only required quest chain. */
export const INTERNAL_DEMO_QUESTS: Readonly<Record<string, QuestDef>> = {
  ...JOB_QUESTS,
  ...DAILY_QUESTS,
  ...WEEKLY_QUESTS,
};

/** All known definitions, including legacy fixtures for tests and save validation. */
export const QUESTS: Readonly<Record<string, QuestDef>> = {
  ...DEMO_TEST_QUESTS,
  ...INTERNAL_DEMO_QUESTS,
};
