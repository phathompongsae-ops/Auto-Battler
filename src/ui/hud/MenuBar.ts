import type { CombatWorld } from '../../game/CombatWorld';
import { Badge } from '../components/Badge';
import { createButton } from '../components/Button';
import { h } from '../dom';
import { SCREENS, type ScreenId } from '../data/screens';
import type { WindowManager } from '../screens/WindowManager';
import type { QuestProgressSource } from './QuestTracker';

/**
 * Compact top-right shortcuts: pinned screens plus a Menu button for the
 * rest. Badges: new items since Inventory was last opened, finished quests.
 */
export class MenuBar {
  readonly el: HTMLDivElement;
  private readonly badges = new Map<ScreenId | 'menu', Badge>();
  private newItems = 0;
  private readonly unsubscribe: () => void;

  constructor(
    world: CombatWorld,
    windows: WindowManager,
    private readonly quests: QuestProgressSource,
  ) {
    const buttons = SCREENS.filter((s) => s.pinned).map((s) => {
      const button = createButton({
        icon: s.icon,
        iconOnly: true,
        title: s.hotkey ? `${s.title} (${s.hotkey.replace('Key', '')})` : s.title,
        onClick: () => windows.toggle(s.id),
      });
      button.dataset.menu = s.id;
      this.badges.set(s.id, new Badge(button));
      return button;
    });
    const menu = createButton({ icon: 'menu', iconOnly: true, title: 'Menu', onClick: () => windows.toggle('menu') });
    menu.dataset.menu = 'menu';
    this.badges.set('menu', new Badge(menu));
    this.el = h('div', { className: 'hud-menu', attrs: { 'data-hud': 'menu' } }, [...buttons, menu]);

    this.unsubscribe = world.events.on('lootPicked', () => this.newItems++);
    windows.onChange((id) => {
      if (id === 'inventory') this.newItems = 0;
    });
  }

  update(): void {
    this.badges.get('inventory')?.set(this.newItems);
    // Quests live under Menu; a dot there means one is ready to hand in.
    this.badges.get('menu')?.set(this.quests.progress().some((q) => q.done));
  }

  destroy(): void {
    this.unsubscribe();
  }
}
