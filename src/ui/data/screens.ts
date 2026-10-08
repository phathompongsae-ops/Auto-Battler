import type { TabDef } from '../components/Tabs';
import type { IconName } from '../icons';
import type { FeatureId } from '../../data/featureData';
import { STRINGS } from '../i18n/strings';
import { t, type StringKey } from '../i18n';

/*
 * Every full-screen menu the game will have. The HUD menu, hotkeys and the
 * window manager all read this list; adding a screen is one entry here plus
 * a content renderer.
 */

export type ScreenId =
  | 'character'
  | 'inventory'
  | 'skills'
  | 'quest'
  | 'commissions'
  | 'job'
  | 'warp'
  | 'enhancement'
  | 'enchant'
  | 'craft'
  | 'pet'
  | 'map'
  | 'party'
  | 'dungeon'
  | 'settings'
  | 'shop';

export interface ScreenDef {
  id: ScreenId;
  title: string;
  icon: IconName;
  /** KeyboardEvent.code; chosen to avoid movement/combat keys. */
  hotkey?: string;
  tabs?: readonly TabDef[];
  /** Shown as its own button in the compact top-right menu (others live under "Menu"). */
  pinned?: boolean;
  /** Feature that must be unlocked to open it (locked: shown disabled with its requirement). */
  feature?: FeatureId;
  /** False for placeholder screens: omit from the production system grid. */
  implemented?: boolean;
}

export const SCREENS: readonly ScreenDef[] = [
  {
    id: 'character',
    title: 'Character',
    icon: 'character',
    hotkey: 'KeyC',
    pinned: true,
    tabs: [
      { id: 'stats', label: 'Stats' },
      { id: 'equipment', label: 'Equipment' },
    ],
  },
  {
    id: 'inventory',
    title: 'Inventory',
    icon: 'inventory',
    hotkey: 'KeyI',
    pinned: true,
    feature: 'equipment',
    tabs: [
      { id: 'all', label: 'All' },
      { id: 'equipment', label: 'Equipment' },
      { id: 'materials', label: 'Materials' },
    ],
  },
  { id: 'skills', title: 'Skills', icon: 'skills', hotkey: 'KeyK', pinned: true, feature: 'class_1_skills' },
  {
    id: 'quest',
    title: 'Quests',
    icon: 'quest',
    hotkey: 'KeyJ',
    tabs: [
      { id: 'active', label: 'Active' },
      { id: 'completed', label: 'Completed' },
    ],
  },
  {
    id: 'commissions',
    title: 'Daily & Weekly',
    icon: 'calendar',
    hotkey: 'KeyY',
    feature: 'daily_commission',
    tabs: [
      { id: 'daily', label: 'Daily' },
      { id: 'weekly', label: 'Weekly' },
    ],
  },
  { id: 'pet', title: 'Pet', icon: 'pet', hotkey: 'KeyP', feature: 'pet', implemented: false },
  { id: 'job', title: 'Job Change', icon: 'character', feature: 'job_change' },
  { id: 'warp', title: 'Warp', icon: 'compass', feature: 'warp' },
  { id: 'enhancement', title: 'Enhancement', icon: 'enhance', feature: 'enhancement' },
  { id: 'enchant', title: 'Enchant', icon: 'rune', feature: 'enchant' },
  { id: 'craft', title: 'Craft', icon: 'craft', feature: 'crafting' },
  { id: 'map', title: 'Area Map', icon: 'map', hotkey: 'KeyM' },
  { id: 'party', title: 'Party', icon: 'party', hotkey: 'KeyO', implemented: false },
  { id: 'dungeon', title: 'Dungeon', icon: 'dungeon', hotkey: 'KeyU', feature: 'dungeon', implemented: false },
  {
    id: 'shop',
    title: 'Shop',
    icon: 'shop',
    hotkey: 'KeyB',
    tabs: [
      { id: 'gold', label: 'Gold' },
      { id: 'diamond', label: 'Diamond' },
    ],
  },
  {
    id: 'settings',
    title: 'Settings',
    icon: 'settings',
    tabs: [
      { id: 'general', label: 'General' },
      { id: 'controls', label: 'Controls' },
    ],
  },
];

export const SCREEN_BY_ID = Object.fromEntries(SCREENS.map((s) => [s.id, s])) as Record<ScreenId, ScreenDef>;

/** Localized window / menu title (ids and `title` stay English). */
export function screenTitle(id: ScreenId | 'menu'): string {
  return t(`screen.${id}`);
}

/** A screen's tabs with localized labels; tab ids are unchanged. */
export function screenTabs(id: ScreenId): readonly TabDef[] | undefined {
  return SCREEN_BY_ID[id].tabs?.map((tab) => {
    const key = `tab.${tab.id}`;
    return key in STRINGS.en ? { ...tab, label: t(key as StringKey) } : tab;
  });
}
