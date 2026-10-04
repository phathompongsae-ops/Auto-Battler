import type { ItemId } from '../../data/itemData';
import type { MonsterId } from '../../data/monsterData';

/*
 * Tracked-quest definitions for the HUD tracker. There is no quest system
 * yet, so progress is read from what the world already reports (kills,
 * inventory). A real quest system replaces this file's data source, not the
 * tracker component.
 */

export type QuestGoal =
  | { kind: 'kill'; monster: MonsterId; count: number }
  | { kind: 'collect'; item: ItemId; count: number };

export interface TrackedQuestDef {
  id: string;
  title: string;
  goal: QuestGoal;
}

export const DEMO_QUESTS: readonly TrackedQuestDef[] = [
  { id: 'slime-trouble', title: 'Slime Trouble', goal: { kind: 'kill', monster: 'slime', count: 5 } },
  { id: 'sticky-supplies', title: 'Sticky Supplies', goal: { kind: 'collect', item: 'slime_sample', count: 3 } },
];

/** The tracker never shows more than this many lines; the rest live in the Quest window. */
export const QUEST_TRACKER_MAX = 3;
