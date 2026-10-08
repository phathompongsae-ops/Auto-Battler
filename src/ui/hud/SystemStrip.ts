import type { CombatWorld } from '../../game/CombatWorld';
import { Badge } from '../components/Badge';
import { medallion, setMedallionLabel } from '../components/Medallion';
import { h } from '../dom';
import { SCREEN_BY_ID } from '../data/screens';
import { onLocaleChange, t, type StringKey } from '../i18n';
import type { WindowManager } from '../screens/WindowManager';

/** The five permanent destinations, in strip order. */
const ENTRIES = [
  { id: 'character', label: 'nav.character' },
  { id: 'inventory', label: 'nav.inventory' },
  { id: 'skills', label: 'nav.skills' },
  { id: 'quest', label: 'nav.quests' },
  { id: 'menu', label: 'nav.more' },
] as const satisfies readonly { id: string; label: StringKey }[];

type EntryId = (typeof ENTRIES)[number]['id'];

/** Presentation only: shortcuts route through existing feature-gated windows. */
export class SystemStrip {
  readonly el: HTMLDivElement;
  private readonly entries: { id: EntryId; label: StringKey; button: HTMLButtonElement; badge: Badge }[] = [];
  private newItems = 0;
  private readonly unsubscribe: () => void;

  constructor(private readonly world: CombatWorld, private readonly windows: WindowManager) {
    this.el = h('div', { className: 'hud-systems', attrs: { 'data-hud': 'systems', role: 'navigation', 'aria-label': t('nav.systems') } });
    for (const { id, label } of ENTRIES) {
      const glyph = id === 'menu' ? 'menu' : SCREEN_BY_ID[id].icon;
      const button = medallion(t(label), glyph, () => windows.toggle(id));
      button.dataset.menu = id;
      const badge = new Badge(button);
      this.entries.push({ id, label, button, badge });
      this.el.append(button);
    }
    const offItem = world.events.on('itemAcquired', () => this.newItems++);
    const offEquipment = world.events.on('equipmentPicked', () => this.newItems++);
    const offLocale = onLocaleChange(() => {
      this.el.setAttribute('aria-label', t('nav.systems'));
      for (const entry of this.entries) setMedallionLabel(entry.button, t(entry.label));
    });
    this.unsubscribe = () => { offItem(); offEquipment(); offLocale(); };
    windows.onChange((id) => { if (id === 'inventory') this.newItems = 0; });
  }

  update(): void {
    const ready = Object.values(this.world.quests.defs).some((q) => this.world.quests.status(q.id) === 'completed');
    this.windows.setNotices(this.newItems, ready);
    for (const entry of this.entries) {
      const reason = this.windows.lockReason(entry.id);
      const title = reason ? `${t(entry.label)} — ${reason}` : t(entry.label);
      if (entry.button.disabled !== !!reason) entry.button.disabled = !!reason;
      if (entry.button.title !== title) entry.button.title = title;
      const expanded = String(this.windows.openId === entry.id);
      if (entry.button.getAttribute('aria-expanded') !== expanded) entry.button.setAttribute('aria-expanded', expanded);
      entry.badge.set(entry.id === 'inventory' ? this.newItems : entry.id === 'quest' ? ready : entry.id === 'menu' ? ready || this.newItems > 0 : false);
    }
  }

  destroy(): void { this.unsubscribe(); }
}
