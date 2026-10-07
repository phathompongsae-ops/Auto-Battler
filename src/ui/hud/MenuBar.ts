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

  private readonly pinned: { id: ScreenId; button: HTMLButtonElement; title: string }[] = [];

  constructor(
    private readonly world: CombatWorld,
    private readonly windows: WindowManager,
    private readonly quests: QuestProgressSource,
  ) {
    const buttons = SCREENS.filter((s) => s.id === 'map' || s.id === 'settings').map((s) => {
      const button = createButton({
        icon: s.icon,
        iconOnly: true,
        title: s.hotkey ? `${s.title} (${s.hotkey.replace('Key', '')})` : s.title,
        onClick: () => windows.toggle(s.id),
      });
      button.dataset.menu = s.id;
      this.pinned.push({ id: s.id, button, title: button.title });
      this.badges.set(s.id, new Badge(button));
      return button;
    });
    const menu = createButton({ icon: 'menu', iconOnly: true, title: 'Menu', onClick: () => windows.toggle('menu') });
    menu.dataset.nav = 'more';
    this.badges.set('menu', new Badge(menu));
    this.el = h('div', { className: 'hud-menu', attrs: { 'data-hud': 'menu' } }, [...buttons, menu]);

    const offPicked = world.events.on('itemAcquired', () => this.newItems++);
    const offEquipment = world.events.on('equipmentPicked', () => this.newItems++);
    this.unsubscribe = () => {
      offPicked();
      offEquipment();
    };
    windows.onChange((id) => {
      if (id === 'inventory') this.newItems = 0;
    });
  }

  update(): void {
    // Locked systems: disabled, with the requirement as the tooltip.
    for (const p of this.pinned) {
      const reason = this.windows.lockReason(p.id);
      p.button.disabled = !!reason;
      p.button.title = reason ? `${p.title} — ${reason}` : p.title;
      if (reason) p.button.dataset.locked = 'true';
      else delete p.button.dataset.locked;
    }
    this.badges.get('inventory')?.set(this.newItems);
    // Quests live under Menu; a dot there means one is ready to hand in.
    this.badges.get('menu')?.set(this.newItems > 0 || this.quests.progress().some((q) => q.done) || Object.values(this.world.quests.defs).some((q) => this.world.quests.status(q.id) === 'completed'));
  }

  destroy(): void {
    this.unsubscribe();
  }
}
