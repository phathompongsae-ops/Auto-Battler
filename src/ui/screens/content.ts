import { ITEMS } from '../../data/itemData';
import { PLAYER_BASIC_ATTACK, PLAYER_LOADOUT } from '../../data/playerData';
import { SKILLS, type SkillId } from '../../data/skillData';
import type { CombatWorld } from '../../game/CombatWorld';
import { ItemSlot, SkillSlot } from '../components/Slot';
import { h } from '../dom';
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
}

export type ScreenRenderer = (tab: string | null, ctx: ScreenContext) => Node;

const hex = (color: number) => `#${color.toString(16).padStart(6, '0')}`;
const INVENTORY_SLOTS = 24;

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

const inventory: ScreenRenderer = (tab, { world }) => {
  if (tab === 'equipment') return emptyState('Equipment items will be listed here.');
  const entries = world.inventory.entries();
  const grid = h('div', { className: 'ui-grid', style: { '--cols': '6' } });
  for (let i = 0; i < INVENTORY_SLOTS; i++) {
    const entry = entries[i];
    const slot = entry
      ? new ItemSlot({
          content: { abbr: ITEMS[entry[0]].name.slice(0, 2), color: hex(ITEMS[entry[0]].color), title: ITEMS[entry[0]].name },
          count: entry[1],
          rarity: 'uncommon',
        })
      : new ItemSlot();
    grid.append(slot.el);
  }
  return grid;
};

const character: ScreenRenderer = (tab, { world }) => {
  if (tab === 'equipment') return emptyState('Weapon, armour and accessory slots.');
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

const skills: ScreenRenderer = () => {
  const ids: SkillId[] = [PLAYER_BASIC_ATTACK, ...Object.values(PLAYER_LOADOUT)];
  return h(
    'div',
    { className: 'ui-list' },
    ids.map((id) => {
      const skill = SKILLS[id];
      const color = skill.color !== undefined && skill.color !== 0xffffff ? hex(skill.color) : '#a8823a';
      const slot = new SkillSlot({ content: { abbr: skill.name.slice(0, 2), color, title: skill.name } });
      return h('div', { className: 'ui-list__row' }, [
        slot.el,
        h('div', {}, [
          h('div', { className: 'ui-label', text: skill.name }),
          h('div', { className: 'ui-caption', text: `${skill.mpCost} MP · ${(skill.cooldown / 1000).toFixed(1)}s cooldown · range ${skill.range}` }),
        ]),
      ]);
    }),
  );
};

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
  pet: () => emptyState('Your companion, its skills and care.'),
  map: () => emptyState('The world map with discovered areas.'),
  party: () => emptyState('Group up with other players.'),
  dungeon: () => emptyState('Dungeon entry, difficulty and rewards.'),
  settings: () => emptyState('Graphics, audio and control options.'),
};
