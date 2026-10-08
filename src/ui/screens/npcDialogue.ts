import { NPCS, type NpcService } from '../../data/npcData';
import type { CombatWorld } from '../../game/CombatWorld';
import { nextObjective, npcQuests, objectiveText, PHASE_LABEL, rewardText } from '../../quests/questText';
import { createButton } from '../components/Button';
import { h, setText } from '../dom';
import type { ScreenId } from '../data/screens';
import type { WindowManager } from './WindowManager';

/*
 * NPC dialogue (functional placeholder UI): greeting, the quests this NPC
 * offers / follows / takes back (Accept / Continue / Complete), and its
 * services. Every action goes through CombatWorld; the dialogue only shows.
 */

const caption = (text: string, role?: string) => h('div', { className: 'ui-caption', text, attrs: role ? { 'data-role': role } : {} });

const SERVICE: Record<NpcService, { label: string; screen?: ScreenId; note?: string }> = {
  enhancement: { label: 'Enhance equipment', screen: 'enhancement' },
  enchant: { label: 'Enchant equipment', screen: 'enchant' },
  craft: { label: 'Craft equipment', screen: 'craft' },
  job: { label: 'Job Change', screen: 'job' },
  pet: { label: 'Pet Stable', note: 'Coming later: the Pet Stable opens in a future update.' },
  dungeon: { label: 'Go to the Dungeon Gate', note: 'The Sunken Crypt gate north of the plaza opens at Lv3 after Trouble in the Meadow is turned in. Repeat Normal runs unlock at Lv20.' },
};

/** Navigate to where a quest needs the player next (or to its turn-in NPC when it's ready). */
export function goToQuest(world: CombatWorld, questId: string): boolean {
  const def = world.quests.defs[questId];
  const status = world.quests.status(questId);
  const npcId = status === 'completed' ? (def.turnInNpcId ?? def.giverNpcId) : status === 'available' ? def.giverNpcId : undefined;
  if (npcId) {
    const target = NPCS[npcId] && world.navigation.target(NPCS[npcId].navTargetId);
    return !!target && world.autoMove.navigateTo(target.id).ok;
  }
  const index = nextObjective(world.quests, questId);
  return index >= 0 && world.autoMove.navigateToQuestObjective(questId, index).ok;
}

export function renderNpcDialogue(world: CombatWorld, windows: WindowManager, npcId: string): HTMLElement {
  const npc = NPCS[npcId];
  const root = h('div', { className: 'ui-list npc-dialog', attrs: { 'data-role': 'npc-dialog', 'data-npc': npcId } });
  const result = caption('', 'result');
  const say = (text: string) => setText(result, text);

  const rerender = () => {
    const rows: Node[] = [h('div', { className: 'ui-caption npc-dialog__role', text: npc.title }), h('div', { className: 'npc-dialog__greeting', text: `“${npc.greeting}”` })];

    for (const q of npcQuests(world.quests, npcId)) {
      const progress = world.quests.progress(q.questId);
      const block = h('div', { className: 'npc-quest', attrs: { 'data-quest': q.questId, 'data-phase': q.phase } }, [
        h('div', { className: 'ui-label', text: q.def.title }),
        caption(PHASE_LABEL[q.phase], 'phase'),
        caption(q.def.description),
        ...q.def.objectives.map((o, i) =>
          h('div', { className: `npc-quest__objective${progress[i].current >= progress[i].required ? ' is-done' : ''}`, text: objectiveText(o, progress[i].current, progress[i].required) }),
        ),
        caption(`Rewards: ${rewardText(q.def)}`, 'rewards'),
      ]);
      const button =
        q.action === 'accept'
          ? createButton({
              label: 'Accept',
              variant: 'primary',
              onClick: () => {
                const r = world.acceptQuest(q.questId);
                say(r.ok ? `Accepted: ${q.def.title}` : `Cannot accept (${r.reason}).`);
                rerender();
              },
            })
          : q.action === 'complete'
            ? createButton({
                label: 'Complete',
                variant: 'primary',
                onClick: () => {
                  const r = world.turnInQuest(q.questId, npcId);
                  say(r.ok ? `Quest complete: ${q.def.title}! ${rewardText(q.def)}` : `Cannot complete (${r.reason}).`);
                  rerender();
                },
              })
            : createButton({
                label: 'Continue',
                onClick: () => {
                  world.quests.track(q.questId);
                  windows.close();
                  goToQuest(world, q.questId);
                },
              });
      button.dataset.action = q.action;
      block.append(button);
      rows.push(block);
    }

    for (const service of npc.services) {
      const def = SERVICE[service];
      const button = createButton({
        label: def.label,
        onClick: () => {
          if (def.screen) {
            const reason = windows.lockReason(def.screen);
            if (reason) say(reason);
            else windows.open(def.screen);
          } else if (service === 'dungeon') {
            windows.close();
            world.autoMove.navigateTo('nav_demo_dungeon_entrance');
          } else say(def.note ?? '');
        },
      });
      button.dataset.service = service;
      rows.push(h('div', { className: 'npc-service' }, [button, def.note && service !== 'dungeon' ? caption(def.note) : null]));
      if (service === 'dungeon' && def.note) rows.push(caption(def.note));
    }
    root.replaceChildren(...rows, result);
  };
  rerender();
  return root;
}
