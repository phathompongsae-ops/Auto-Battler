import { DEMO_KIT_LOADOUT, SKILL_SLOTS, type SkillSlot } from '../data/playerData';
import type { SkillId } from '../data/skillData';
import type { JobId } from '../data/jobData';
import { learnedActives, treeForJob } from './skillTreeRules';

export type Loadout = Record<SkillSlot, SkillId | null>;
export function activeSkills(job: JobId, ranks: Record<string, number>): SkillId[] {
  const tree = treeForJob(job);
  return tree ? learnedActives(tree, ranks).map(n => n.combatSkillId!)
    : Object.values(DEMO_KIT_LOADOUT).filter((id): id is SkillId => id !== null);
}
/** Missing field: reproduce the old tree-order layout. Explicit empty slots stay empty. */
export function normalizeHotbar(raw: unknown, allowed: readonly SkillId[]): Loadout {
  const old = raw === undefined || raw === null;
  const source = raw && typeof raw === 'object' ? raw as Record<string, unknown> : {};
  const seen = new Set<SkillId>();
  const result = {} as Loadout;
  for (let i = 0; i < SKILL_SLOTS.length; i++) {
    const slot = SKILL_SLOTS[i];
    const id = (old ? allowed[i] : source[slot]) as SkillId;
    result[slot] = allowed.includes(id) && !seen.has(id) ? id : null;
    if (result[slot]) seen.add(id);
  }
  return result;
}
/** Placement swaps an already equipped skill; replacement leaves the displaced skill learned. */
export function placeSkill(loadout: Loadout, slot: SkillSlot, id: SkillId | null): Loadout {
  const next = { ...loadout };
  const from = id ? SKILL_SLOTS.find(s => next[s] === id) : undefined;
  if (from && from !== slot) next[from] = next[slot];
  next[slot] = id;
  return next;
}
