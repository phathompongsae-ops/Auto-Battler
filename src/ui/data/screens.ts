import type { TabDef } from '../components/Tabs';
import type { IconName } from '../icons';

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
  | 'pet'
  | 'map'
  | 'party'
  | 'dungeon'
  | 'settings';

export interface ScreenDef {
  id: ScreenId;
  title: string;
  icon: IconName;
  /** KeyboardEvent.code; chosen to avoid movement/combat keys. */
  hotkey?: string;
  tabs?: readonly TabDef[];
  /** Shown as its own button in the compact top-right menu (others live under "Menu"). */
  pinned?: boolean;
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
    tabs: [
      { id: 'all', label: 'All' },
      { id: 'equipment', label: 'Equipment' },
      { id: 'materials', label: 'Materials' },
    ],
  },
  { id: 'skills', title: 'Skills', icon: 'skills', hotkey: 'KeyK', pinned: true },
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
  { id: 'pet', title: 'Pet', icon: 'pet', hotkey: 'KeyP' },
  { id: 'map', title: 'World Map', icon: 'map', hotkey: 'KeyM' },
  { id: 'party', title: 'Party', icon: 'party', hotkey: 'KeyO' },
  { id: 'dungeon', title: 'Dungeon', icon: 'dungeon', hotkey: 'KeyU' },
  {
    id: 'settings',
    title: 'Settings',
    icon: 'settings',
    tabs: [
      { id: 'general', label: 'General' },
      { id: 'audio', label: 'Audio' },
      { id: 'controls', label: 'Controls' },
    ],
  },
];

export const SCREEN_BY_ID = Object.fromEntries(SCREENS.map((s) => [s.id, s])) as Record<ScreenId, ScreenDef>;
