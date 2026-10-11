import type { CombatWorld } from '../../game/CombatWorld';
import { h } from '../dom';
import { t, type StringKey } from '../i18n';
import { renderHero } from './inventoryView';
import { objectiveText, questPhase, rewardText } from '../../quests/questText';
import { renderSkillTree } from './skillTreeView';
import { renderRecurring } from './recurringView';
import { renderCraft, renderEnchant, renderEnhancement, renderJobChange, renderWarp } from './systemScreens';
import type { ScreenId } from '../data/screens';
import type { QuestProgressSource } from '../hud/QuestTracker';
import { renderAreaMap, renderHudSettings } from './navigationView';
import { renderShop } from './shopView';

/*
 * Window bodies per screen. Each is a placeholder built from the shared
 * components; real screens replace one renderer without touching the window
 * frame, tabs or HUD.
 */

export interface ScreenContext {
  world: CombatWorld;
  quests: QuestProgressSource;
  /** Opens the temporary job selection when it is legitimately available. */
  openJobSelect?: () => boolean;
}

export type ScreenRenderer = (tab: string | null, ctx: ScreenContext) => Node;


function emptyState(message: string): HTMLElement {
  return h('div', { className: 'ui-empty' }, [
    h('div', { className: 'ui-label', text: t('common.comingSoon') }),
    h('div', { className: 'ui-caption', text: message }),
  ]);
}

/** Character and Inventory share one view: hero, equipment, stats, bag and actions (see inventoryView.ts). */
const inventory: ScreenRenderer = (_tab, { world }) => renderHero(world, 'inventory');
const character: ScreenRenderer = (_tab, { world }) => renderHero(world, 'character');

/** The job's skill tree (temporary UI; see skillTreeView.ts). */
const skills: ScreenRenderer = (_tab, { world }) => renderSkillTree(world);

/**
 * The quest log: Active (offered, accepted, in progress, ready to turn in)
 * and Completed (claimed). Daily / Weekly quests live in their own screen.
 */
const quest: ScreenRenderer = (tab, { world }) => {
  const q = world.quests;
  const ids = Object.values(q.defs)
    .filter((d) => !d.repeat)
    .map((d) => d.id)
    .filter((id) => {
      const phase = questPhase(q, id);
      return tab === 'completed' ? phase === 'completed' : phase !== 'completed' && phase !== 'locked';
    });
  if (!ids.length) return emptyState(t(tab === 'completed' ? 'quest.emptyCompleted' : 'quest.emptyActive'));
  return h(
    'div',
    { className: 'ui-list' },
    ids.map((id) => {
      const def = q.defs[id];
      const progress = q.progress(id);
      return h('div', { className: 'ui-list__row', attrs: { 'data-quest': id, 'data-phase': questPhase(q, id) } }, [
        h('div', {}, [
          h('div', { className: 'ui-label', text: def.title }),
          h('div', { className: 'ui-caption', text: t(`quest.phase.${questPhase(q, id)}` as StringKey) }),
          ...def.objectives.map((o, i) => h('div', { className: 'ui-caption', text: objectiveText(o, progress[i].current, progress[i].required) })),
          h('div', { className: 'ui-caption', text: t('quest.rewards', { rewards: rewardText(def) }) }),
        ]),
      ]);
    }),
  );
};

export const SCREEN_CONTENT: Record<ScreenId, ScreenRenderer> = {
  character,
  inventory,
  skills,
  quest,
  commissions: (tab, { world }) => renderRecurring(world, tab === 'weekly' ? 'weekly' : 'daily'),
  job: (_tab, ctx) => renderJobChange(ctx.world, ctx.openJobSelect),
  warp: (_tab, { world }) => renderWarp(world),
  enhancement: (_tab, { world }) => renderEnhancement(world),
  enchant: (_tab, { world }) => renderEnchant(world),
  craft: (_tab, { world }) => renderCraft(world),
  pet: () => emptyState('Your companion, its skills and care.'),
  map: (_tab, { world }) => renderAreaMap(world),
  party: () => emptyState('Group up with other players.'),
  dungeon: () => emptyState('Dungeon entry, difficulty and rewards.'),
  settings: (tab, ctx) => renderHudSettings(tab, ctx.world),
  shop: (tab, { world }) => renderShop(world, tab),
};
