import { ITEMS } from '../data/itemData';
import { MONSTERS } from '../data/monsterData';
import { NAVIGATION } from '../data/navigationData';
import { NPCS } from '../data/npcData';
import type { QuestDef, QuestObjective } from '../data/questData';
import type { QuestStatus, QuestSystem } from './QuestSystem';

/*
 * Player-facing quest wording and per-NPC quest views, derived from quest
 * data and state (engine-free). The UI and world markers read these.
 */

/**
 * The phase a player sees:
 * available (can be accepted) → accepted (no progress yet) → in_progress →
 * ready (every objective done: turn it in) → completed (rewards claimed).
 */
export type QuestPhase = 'locked' | 'available' | 'accepted' | 'in_progress' | 'ready' | 'completed';

export function questPhase(quests: QuestSystem, questId: string): QuestPhase {
  const status: QuestStatus = quests.status(questId);
  if (status === 'claimed') return 'completed';
  if (status === 'completed') return 'ready';
  if (status !== 'active') return status;
  return quests.progress(questId).some((p) => p.current > 0) ? 'in_progress' : 'accepted';
}

export const PHASE_LABEL: Record<QuestPhase, string> = {
  locked: 'Locked',
  available: 'Available',
  accepted: 'Accepted',
  in_progress: 'In progress',
  ready: 'Ready to turn in',
  completed: 'Completed',
};

const plural = (name: string) => (name.endsWith('s') ? name : `${name}s`);
const locationName = (locationId: string) =>
  Object.values(NAVIGATION.targets).find((t) => t.locationId === locationId)?.meta?.label ?? locationId.replace(/_/g, ' ');

/** "Wolves", "Talk to Smith Brann", "Reach the Green Meadow"... (data label first). */
export function objectiveLabel(o: QuestObjective): string {
  if (o.label) return o.label;
  switch (o.kind) {
    case 'talk':
      return `Talk to ${NPCS[o.npcId]?.name ?? o.npcId}`;
    case 'kill': {
      const name = o.monsterId ? (MONSTERS[o.monsterId as keyof typeof MONSTERS]?.name ?? o.monsterId) : o.tier === 'elite' ? 'Elite' : o.tier === 'mini_boss' ? 'Mini Boss' : 'Monster';
      return `Defeat ${(o.count ?? 1) > 1 ? plural(name) : name}`;
    }
    case 'collect':
      return `Collect ${ITEMS[o.itemId]?.name ?? o.itemId}`;
    case 'visit':
      return `Reach ${locationName(o.locationId)}`;
    case 'dungeon_clear':
      return 'Clear a dungeon';
    case 'enhance':
      return o.minLevel ? `Enhance gear to +${o.minLevel}` : 'Enhance gear';
    case 'daily_commission':
      return 'Complete Daily Commissions';
  }
}

/** "Wolves 2 / 3". */
export function objectiveText(o: QuestObjective, current: number, required: number): string {
  return `${objectiveLabel(o)} ${Math.min(current, required)} / ${required}`;
}

/** Index of the first unfinished objective, or -1. */
export function nextObjective(quests: QuestSystem, questId: string): number {
  return quests.progress(questId).findIndex((p) => p.current < p.required);
}

/** "+600 EXP · +150 Gold · Enhancement Stone ×3". */
export function rewardText(def: QuestDef): string {
  const r = def.rewards;
  return [r.exp ? `+${r.exp} EXP` : '', r.gold ? `+${r.gold} Gold` : '', ...(r.items ?? []).map((i) => `${ITEMS[i.itemId].name} ×${i.count}`)].filter(Boolean).join(' · ');
}

/** What an NPC can do with a quest right now. */
export type NpcQuestAction = 'accept' | 'continue' | 'complete';

/**
 * The quests an NPC deals with, in dialogue order: ready to turn in here,
 * offered here, then in progress (given or taken here).
 */
export function npcQuests(quests: QuestSystem, npcId: string): { questId: string; def: QuestDef; phase: QuestPhase; action: NpcQuestAction }[] {
  const out: { questId: string; def: QuestDef; phase: QuestPhase; action: NpcQuestAction }[] = [];
  for (const def of Object.values(quests.defs)) {
    if (def.giverNpcId !== npcId && def.turnInNpcId !== npcId) continue;
    const phase = questPhase(quests, def.id);
    const turnInHere = (def.turnInNpcId ?? def.giverNpcId) === npcId;
    if (phase === 'ready' && turnInHere) out.push({ questId: def.id, def, phase, action: 'complete' });
    else if (phase === 'available' && def.giverNpcId === npcId) out.push({ questId: def.id, def, phase, action: 'accept' });
    else if (phase === 'accepted' || phase === 'in_progress' || phase === 'ready') out.push({ questId: def.id, def, phase, action: 'continue' });
  }
  const order: Record<NpcQuestAction, number> = { complete: 0, accept: 1, continue: 2 };
  return out.sort((a, b) => order[a.action] - order[b.action]);
}

/** The marker above an NPC: '?' a quest is ready to turn in here, '!' a quest is offered here. */
export function npcMarker(quests: QuestSystem, npcId: string): '?' | '!' | null {
  const list = npcQuests(quests, npcId);
  if (list.some((q) => q.action === 'complete')) return '?';
  if (list.some((q) => q.action === 'accept')) return '!';
  return null;
}
