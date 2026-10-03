import type { CombatantState } from '../combat/CombatantState';
import type { Inventory } from '../loot/Inventory';
import type { CharacterProgress } from '../progression/CharacterProgress';
import { newPlayerSave, type PlayerSave } from './playerSave';

/** Save fields with no live system yet; carried through load → save untouched. */
export type PersistedHooks = Pick<PlayerSave, 'equipment' | 'activePetId' | 'currencies' | 'energy' | 'quests' | 'dungeons'>;

export function emptyHooks(): PersistedHooks {
  const { equipment, activePetId, currencies, energy, quests, dungeons } = newPlayerSave('_');
  return { equipment, activePetId, currencies, energy, quests, dungeons };
}

/** Everything a player save is captured from / applied to. No engine types. */
export interface SaveTarget {
  characterId: string;
  progress: CharacterProgress;
  combat: CombatantState;
  inventory: Inventory;
  hooks: PersistedHooks;
}

export function capturePlayerSave(t: SaveTarget): PlayerSave {
  const data = t.progress.toData();
  const level = t.combat.level;
  return {
    schemaVersion: 2,
    characterId: t.characterId,
    classId: data.classId,
    level,
    exp: t.combat.exp,
    stats: { base: data.base, allocated: data.allocated, jobBonuses: data.jobBonuses },
    unspentStatPoints: t.progress.remaining(level),
    skillPointsSpent: data.skillPointsSpent,
    inventory: t.inventory.entries().map(([itemId, count]) => ({ itemId, count })),
    ...structuredClone(t.hooks),
  };
}

/** Load a (validated) save into live state. Derived stats are recalculated, not loaded. */
export function applyPlayerSave(t: SaveTarget, save: PlayerSave): void {
  t.characterId = save.characterId;
  t.progress.assign({
    classId: save.classId,
    base: save.stats.base,
    allocated: save.stats.allocated,
    jobBonuses: save.stats.jobBonuses,
    skillPointsSpent: save.skillPointsSpent,
  });
  t.combat.level = save.level;
  t.combat.exp = save.exp;
  t.inventory.clear();
  for (const { itemId, count } of save.inventory) t.inventory.add(itemId, count);
  const { equipment, activePetId, currencies, energy, quests, dungeons } = structuredClone(save);
  t.hooks = { equipment, activePetId, currencies, energy, quests, dungeons };
  t.combat.refreshStats();
  t.combat.restore();
}
