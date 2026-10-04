import type { DifficultyId } from '../data/dungeonDifficulty';
import type { ItemId } from '../data/itemData';
import type { ObjectiveKind, QuestObjective } from '../data/questData';

/** A gameplay fact the Quest Engine can match objectives against. */
export type QuestSignal =
  | { kind: 'talk'; npcId: string }
  | { kind: 'kill'; monsterId: string }
  | { kind: 'collect'; itemId: ItemId; amount: number }
  | { kind: 'visit'; locationId: string }
  | { kind: 'dungeon_clear'; dungeonId: string; difficulty: DifficultyId }
  | { kind: 'enhance'; success: boolean; level: number };

type Matcher<K extends ObjectiveKind> = (
  objective: Extract<QuestObjective, { kind: K }>,
  signal: Extract<QuestSignal, { kind: K }>,
) => number;

/** How much one signal advances one objective of the same kind (0 = no match). */
const MATCHERS: { [K in ObjectiveKind]: Matcher<K> } = {
  talk: (o, s) => (o.npcId === s.npcId ? 1 : 0),
  kill: (o, s) => (o.monsterId === s.monsterId ? 1 : 0),
  collect: (o, s) => (o.itemId === s.itemId ? Math.max(0, Math.floor(s.amount)) : 0),
  visit: (o, s) => (o.locationId === s.locationId ? 1 : 0),
  dungeon_clear: (o, s) => (o.dungeonId === s.dungeonId && (o.difficulty === undefined || o.difficulty === s.difficulty) ? 1 : 0),
  enhance: (o, s) => (s.success && s.level >= (o.minLevel ?? 0) ? 1 : 0),
};

export function required(objective: QuestObjective): number {
  return Math.max(1, Math.floor(objective.count ?? 1));
}

export function advanceBy(objective: QuestObjective, signal: QuestSignal): number {
  if (objective.kind !== signal.kind) return 0;
  return (MATCHERS[objective.kind] as Matcher<ObjectiveKind>)(objective as never, signal as never);
}
