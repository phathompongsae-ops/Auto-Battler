import { h, toggleClass } from '../dom';
import { Badge } from './Badge';

export interface TabDef {
  id: string;
  label: string;
}

/** Horizontal tab strip. Owns only selection state; the caller swaps content on change. */
export class Tabs {
  readonly el: HTMLDivElement;
  private readonly buttons = new Map<string, HTMLButtonElement>();
  private readonly badges = new Map<string, Badge>();
  private active = '';

  constructor(
    tabs: readonly TabDef[],
    private readonly onChange: (id: string) => void,
  ) {
    this.el = h('div', { className: 'ui-tabs', attrs: { role: 'tablist' } });
    for (const tab of tabs) {
      const button = h('button', { className: 'ui-tab', text: tab.label, attrs: { type: 'button', role: 'tab' } });
      button.addEventListener('click', (e) => {
        e.stopPropagation();
        this.select(tab.id);
      });
      this.buttons.set(tab.id, button);
      this.badges.set(tab.id, new Badge(button));
      this.el.append(button);
    }
    if (tabs[0]) this.select(tabs[0].id);
  }

  get current(): string {
    return this.active;
  }

  select(id: string): void {
    if (!this.buttons.has(id) || id === this.active) return;
    this.active = id;
    for (const [tabId, button] of this.buttons) {
      toggleClass(button, 'is-active', tabId === id);
      button.setAttribute('aria-selected', String(tabId === id));
    }
    this.onChange(id);
  }

  setBadge(id: string, value: number | boolean): void {
    this.badges.get(id)?.set(value);
  }
}
