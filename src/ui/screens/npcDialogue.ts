import { NPCS, type NpcService } from '../../data/npcData';
import type { CombatWorld } from '../../game/CombatWorld';
import type { StartNavFailure } from '../../navigation/AutoMove';
import { nextObjective, npcQuests, objectiveText, rewardText } from '../../quests/questText';
import { createButton } from '../components/Button';
import { h, setText } from '../dom';
import type { ScreenId } from '../data/screens';
import type { WindowManager } from './WindowManager';
import { t, type StringKey } from '../i18n';

/*
 * NPC dialogue (functional placeholder UI): greeting, the quests this NPC
 * offers / follows / takes back (Accept / Continue / Complete), and its
 * services. Every action goes through CombatWorld; the dialogue only shows.
 */

const caption = (text: string, role?: string) => h('div', { className: 'ui-caption', text, attrs: role ? { 'data-role': role } : {} });

/** NPC services by string key (read at render time, so labels follow the interface language). */
const SERVICE: Record<NpcService, { label: StringKey; screen?: ScreenId; note?: StringKey }> = {
  enhancement: { label: 'npc.service.enhancement', screen: 'enhancement' },
  enchant: { label: 'npc.service.enchant', screen: 'enchant' },
  craft: { label: 'npc.service.craft', screen: 'craft' },
  job: { label: 'npc.service.job', screen: 'job' },
  pet: { label: 'npc.service.pet', note: 'npc.service.petNote' },
  dungeon: { label: 'npc.service.dungeon', note: 'npc.service.dungeonNote' },
};

/** Navigate to where a quest needs the player next (or to its turn-in NPC when it's ready). */
export function goToQuest(world: CombatWorld, questId: string): boolean {
  const def = world.quests.defs[questId];
  const status = world.quests.status(questId);
  const npcId = status === 'completed' ? (def.turnInNpcId ?? def.giverNpcId) : status === 'available' ? def.giverNpcId : undefined;
  // Never fail silently: when Auto Move can't start, the feed tells the player to walk there themselves.
  const unavailable = (reason: StartNavFailure) => (world.events.emit('navigationUnavailable', { reason }), false);
  if (npcId) {
    const target = NPCS[npcId] && world.navigation.target(NPCS[npcId].navTargetId);
    if (!target) return unavailable('no_target');
    const r = world.autoMove.navigateTo(target.id);
    return r.ok || unavailable(r.reason);
  }
  const index = nextObjective(world.quests, questId);
  if (index < 0) return unavailable('no_target');
  const r = world.autoMove.navigateToQuestObjective(questId, index);
  return r.ok || unavailable(r.reason);
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
        caption(t(`quest.phase.${q.phase}` as StringKey), 'phase'),
        caption(q.def.description),
        ...q.def.objectives.map((o, i) =>
          h('div', { className: `npc-quest__objective${progress[i].current >= progress[i].required ? ' is-done' : ''}`, text: objectiveText(o, progress[i].current, progress[i].required) }),
        ),
        caption(t('quest.rewards', { rewards: rewardText(q.def) }), 'rewards'),
      ]);
      const button =
        q.action === 'accept'
          ? createButton({
              label: t('npc.accept'),
              variant: 'primary',
              onClick: () => {
                const r = world.acceptQuest(q.questId);
                say(r.ok ? t('npc.accepted', { quest: q.def.title }) : t('npc.cannotAccept', { reason: String(r.reason) }));
                rerender();
              },
            })
          : q.action === 'complete'
            ? createButton({
                label: t('npc.complete'),
                variant: 'primary',
                onClick: () => {
                  const r = world.turnInQuest(q.questId, npcId);
                  say(r.ok ? t('npc.completed', { quest: q.def.title, rewards: rewardText(q.def) }) : t('npc.cannotComplete', { reason: String(r.reason) }));
                  rerender();
                },
              })
            : createButton({
                label: t('npc.continue'),
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
        label: t(def.label),
        onClick: () => {
          if (def.screen) {
            const reason = windows.lockReason(def.screen);
            if (reason) say(reason);
            else windows.open(def.screen);
          } else if (service === 'dungeon') {
            windows.close();
            world.autoMove.navigateTo('nav_demo_dungeon_entrance');
          } else say(def.note ? t(def.note) : '');
        },
      });
      button.dataset.service = service;
      rows.push(h('div', { className: 'npc-service' }, [button, def.note && service !== 'dungeon' ? caption(t(def.note)) : null]));
      if (service === 'dungeon' && def.note) rows.push(caption(t(def.note)));
    }
    root.replaceChildren(...rows, result);
  };
  rerender();
  return root;
}
