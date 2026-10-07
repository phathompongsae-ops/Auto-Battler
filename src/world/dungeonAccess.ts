import { DUNGEON_ACCESS, type DungeonAccessRule } from '../data/dungeonAccess';

/** What the access check reads from the player; engine-free so it is easy to test. */
export interface AccessState {
  level: number;
  questStatus(questId: string): string;
  questTitle(questId: string): string | undefined;
}

export type AccessMissing = { kind: 'level'; required: number; current: number } | { kind: 'quest'; questId: string; title: string };

export type AccessResult = { ok: true } | { ok: false; mapId: string; missing: AccessMissing[]; message: string };

const STATE_RANK: Record<string, number> = { locked: 0, available: 0, active: 1, completed: 2, claimed: 3 };

/** Checks one rule against the player; every missing requirement is listed, in a fixed order (level, then quest). */
export function checkAccess(rule: DungeonAccessRule, state: AccessState): AccessResult {
  const missing: AccessMissing[] = [];
  if (state.level < rule.minimumLevel) missing.push({ kind: 'level', required: rule.minimumLevel, current: state.level });
  if (rule.requiredQuestId) {
    const need = STATE_RANK[rule.questState ?? 'claimed'];
    if ((STATE_RANK[state.questStatus(rule.requiredQuestId)] ?? 0) < need) {
      missing.push({ kind: 'quest', questId: rule.requiredQuestId, title: state.questTitle(rule.requiredQuestId) ?? rule.requiredQuestId });
    }
  }
  return missing.length ? { ok: false, mapId: rule.mapId, missing, message: accessMessage(missing) } : { ok: true };
}

/** "Requires Level 3", "Complete Trouble in the Meadow first", or both joined. */
export function accessMessage(missing: readonly AccessMissing[]): string {
  const parts = missing.map((m) => (m.kind === 'level' ? `Requires Level ${m.required}` : `Complete ${m.title} first`));
  return parts.length === 2 ? `${parts[0]} and ${parts[1][0].toLowerCase()}${parts[1].slice(1)}` : parts[0];
}

/** Entering `toMapId` from `fromMapId`: guarded maps are checked only when coming from outside them. */
export function checkMapEntry(fromMapId: string, toMapId: string, state: AccessState, rules = DUNGEON_ACCESS): AccessResult {
  const rule = rules[toMapId];
  if (!rule || fromMapId === toMapId) return { ok: true };
  return checkAccess(rule, state);
}
