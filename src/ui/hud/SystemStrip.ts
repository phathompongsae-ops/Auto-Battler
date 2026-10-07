import type { CombatWorld } from '../../game/CombatWorld';
import { Badge } from '../components/Badge';
import { medallion } from '../components/Medallion';
import { h } from '../dom';
import { SCREEN_BY_ID, type ScreenId } from '../data/screens';
import type { WindowManager } from '../screens/WindowManager';

/** Presentation only: shortcuts route through existing feature-gated windows. */
export class SystemStrip {
  readonly el: HTMLDivElement;
  private readonly entries: { id: ScreenId | 'menu'; button: HTMLButtonElement; badge: Badge }[] = [];
  private newItems = 0;
  private readonly unsubscribe: () => void;

  constructor(private readonly world: CombatWorld, private readonly windows: WindowManager) {
    this.el = h('div', { className: 'hud-systems', attrs: { 'data-hud': 'systems', role: 'navigation', 'aria-label': 'Game systems' } });
    for (const id of ['character', 'inventory', 'skills', 'quest', 'menu'] as const) {
      const def = id === 'menu' ? { title: 'More', icon: 'menu' as const } : SCREEN_BY_ID[id];
      const button = medallion(def.title, def.icon, () => windows.toggle(id));
      button.dataset.menu = id;
      const badge = new Badge(button);
      this.entries.push({ id, button, badge });
      this.el.append(button);
    }
    const offItem = world.events.on('itemAcquired', () => this.newItems++);
    const offEquipment = world.events.on('equipmentPicked', () => this.newItems++);
    this.unsubscribe = () => { offItem(); offEquipment(); };
    windows.onChange((id) => { if (id === 'inventory') this.newItems = 0; });
  }

  update(): void {
    const ready = Object.values(this.world.quests.defs).some((q) => this.world.quests.status(q.id) === 'completed');
    this.windows.setNotices(this.newItems, ready);
    for (const entry of this.entries) {
      const reason = this.windows.lockReason(entry.id);
      entry.button.disabled = !!reason;
      entry.button.title = reason ? `${SCREEN_BY_ID[entry.id as ScreenId].title} — ${reason}` : entry.button.getAttribute('aria-label')!;
      entry.button.setAttribute('aria-expanded', String(this.windows.openId === entry.id));
      entry.badge.set(entry.id === 'inventory' ? this.newItems : entry.id === 'quest' ? ready : entry.id === 'menu' ? ready || this.newItems > 0 : false);
    }
  }

  destroy(): void { this.unsubscribe(); }
}
