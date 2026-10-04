import { LOOT_TABLES, type ItemId } from '../data/itemData';
import { MONSTERS } from '../data/monsterData';
import type { NavTarget } from '../data/navigationData';
import type { QuestDef, QuestObjective } from '../data/questData';
import type { QuestSystem } from '../quests/QuestSystem';
import type { NavIndex } from './NavIndex';

export type NavResolution =
  | { ok: true; target: NavTarget }
  | {
      ok: false;
      reason: 'unknown_quest' | 'quest_not_active' | 'unknown_objective' | 'objective_complete' | 'no_target';
    };

/** Monster ids whose loot table can drop `itemId` (real data; nothing invented). */
function monstersDropping(itemId: ItemId): string[] {
  return Object.values(MONSTERS)
    .filter((m) => LOOT_TABLES[m.lootTable]?.some((e) => e.itemId === itemId))
    .map((m) => m.id);
}

/**
 * Where an objective wants the player to go. Only configured navigation data
 * is used; when nothing fits the result is `no_target`, never a guess.
 *
 * talk → the NPC; visit → the location marker; kill → a zone listing the
 * monster; collect → a zone whose monsters drop the item; dungeon_clear → the
 * dungeon entrance; enhance → the configured enhancement station (none yet).
 * Targets dedicated to `questId` win; `preferMapId` breaks ties toward the current map.
 */
export function resolveObjectiveTarget(objective: QuestObjective, nav: NavIndex, preferMapId?: string, questId?: string): NavResolution {
  let target: NavTarget | undefined;
  const find = (predicate: (t: NavTarget) => boolean) => nav.find(predicate, preferMapId, questId);
  switch (objective.kind) {
    case 'talk':
      target = find((t) => t.type === 'npc' && t.npcId === objective.npcId);
      break;
    case 'visit':
      target = find((t) => t.type === 'location' && t.locationId === objective.locationId);
      break;
    case 'kill':
      // No monster id (e.g. "any field monster"): any hunting area.
      target = find((t) => t.type === 'monster_zone' && (!objective.monsterId || !!t.monsterIds?.includes(objective.monsterId)));
      break;
    case 'collect': {
      const sources = monstersDropping(objective.itemId);
      target = find((t) => t.type === 'monster_zone' && !!t.monsterIds?.some((m) => sources.includes(m)));
      break;
    }
    case 'dungeon_clear':
      target = find((t) => t.type === 'dungeon_entrance' && (!objective.dungeonId || t.dungeonId === objective.dungeonId));
      break;
    case 'daily_commission':
      break;
    case 'enhance': {
      const id = nav.data.stations.enhance;
      target = id ? nav.target(id) : undefined;
      break;
    }
  }
  return target ? { ok: true, target } : { ok: false, reason: 'no_target' };
}

/** Navigation for objective `index` of an ACTIVE quest (tracked or not). */
export function resolveQuestObjective(quests: QuestSystem, questId: string, index: number, nav: NavIndex, preferMapId?: string): NavResolution {
  const def: QuestDef | undefined = quests.defs[questId];
  if (!def) return { ok: false, reason: 'unknown_quest' };
  if (quests.status(questId) !== 'active') return { ok: false, reason: 'quest_not_active' };
  const objective = def.objectives[index];
  if (!objective) return { ok: false, reason: 'unknown_objective' };
  const progress = quests.progress(questId)[index];
  if (progress.current >= progress.required) return { ok: false, reason: 'objective_complete' };
  return resolveObjectiveTarget(objective, nav, preferMapId, questId);
}
