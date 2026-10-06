import { ITEMS } from '../../data/itemData';
import type { CombatWorld } from '../../game/CombatWorld';
import { h } from '../dom';
import { renderEquipment, renderInventory } from './inventoryView';
import { renderSkillTree } from './skillTreeView';
import { renderRecurring } from './recurringView';
import { renderCraft, renderEnchant, renderEnhancement, renderJobChange, renderWarp } from './systemScreens';
import type { ScreenId } from '../data/screens';
import type { QuestProgressSource } from '../hud/QuestTracker';

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
    h('div', { className: 'ui-label', text: 'Coming soon' }),
    h('div', { className: 'ui-caption', text: message }),
  ]);
}

function statRows(rows: [string, string][]): HTMLElement {
  return h(
    'dl',
    { className: 'ui-stats' },
    rows.flatMap(([k, v]) => [h('dt', { text: k }), h('dd', { text: v })]),
  );
}

/** Bag with sorting, details, comparison and Equip (see inventoryView.ts). */
const inventory: ScreenRenderer = (tab, { world }) => renderInventory(world, tab);

const character: ScreenRenderer = (tab, { world }) => {
  if (tab === 'equipment') return renderEquipment(world);
  const c = world.player.combat;
  const s = c.stats;
  return statRows([
    ['Level', String(c.level)],
    ['HP', `${Math.ceil(c.hp)} / ${s.maxHp}`],
    ['MP', `${Math.floor(c.mp)} / ${s.maxMp}`],
    ['Attack', String(s.attack)],
    ['Defense', String(s.defense)],
    ['Move speed', String(s.moveSpeed)],
    ['Critical', `${Math.round(s.critChance * 100)}%`],
  ]);
};

/** The job's skill tree (temporary UI; see skillTreeView.ts). */
const skills: ScreenRenderer = (_tab, { world }) => renderSkillTree(world);

const quest: ScreenRenderer = (tab, { quests }) => {
  const list = quests.progress().filter((q) => (tab === 'completed' ? q.done : !q.done));
  if (!list.length) return emptyState(tab === 'completed' ? 'Finished quests appear here.' : 'No active quests.');
  return h(
    'div',
    { className: 'ui-list' },
    list.map((q) =>
      h('div', { className: 'ui-list__row' }, [
        h('div', {}, [
          h('div', { className: 'ui-label', text: q.def.title }),
          h('div', {
            className: 'ui-caption',
            text: `${q.def.goal.kind === 'kill' ? 'Defeat' : 'Collect'} ${q.def.goal.kind === 'kill' ? q.def.goal.monster : ITEMS[q.def.goal.item].name}: ${q.current}/${q.def.goal.count}`,
          }),
        ]),
      ]),
    ),
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
  map: () => emptyState('The world map with discovered areas.'),
  party: () => emptyState('Group up with other players.'),
  dungeon: () => emptyState('Dungeon entry, difficulty and rewards.'),
  settings: () => emptyState('Graphics, audio and control options.'),
};
