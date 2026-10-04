import type { DifficultyId } from './dungeonDifficulty';
import type { FeatureId } from './featureData';
import type { ItemId } from './itemData';
import type { JobId } from './jobData';
import { DEMO_TEST_QUESTS } from './quests/demoTestQuests';

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
  | { kind: 'kill'; monsterId: string; count?: number }
  /** Cumulative: items acquired while the quest is active (losing them later doesn't undo progress). */
  | { kind: 'collect'; itemId: ItemId; count?: number }
  | { kind: 'visit'; locationId: string; count?: number }
  /** A successful clear of the dungeon (any difficulty unless `difficulty` is set). */
  | { kind: 'dungeon_clear'; dungeonId: string; difficulty?: DifficultyId; count?: number }
  /** Successful enhancements; with `minLevel`, only successes that reach at least +minLevel. */
  | { kind: 'enhance'; minLevel?: number; count?: number };

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

/** Every quest the game knows. Production content will be added beside the demo fixtures. */
export const QUESTS: Readonly<Record<string, QuestDef>> = {
  ...DEMO_TEST_QUESTS,
};
