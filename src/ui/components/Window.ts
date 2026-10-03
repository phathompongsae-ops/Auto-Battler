import { h, setText } from '../dom';
import { createButton } from './Button';
import { Tabs, type TabDef } from './Tabs';

export interface WindowOptions {
  id: string;
  title: string;
  tabs?: readonly TabDef[];
  /** Builds the body for a tab (or the whole window when there are no tabs). */
  render: (tabId: string | null) => Node;
  footer?: Node[];
  onClose?: () => void;
}

/**
 * Modal window frame: scrim, title bar with close, optional tabs, scrolling
 * body and footer. Every full-screen menu (Character, Inventory, Skills…)
 * is one of these with different content.
 */
export class UiWindow {
  readonly el: HTMLDivElement;
  readonly tabs: Tabs | null;
  private readonly body: HTMLDivElement;
  private readonly titleEl: HTMLSpanElement;

  constructor(private readonly options: WindowOptions) {
    this.titleEl = h('span', { className: 'ui-title', text: options.title });
    this.body = h('div', { className: 'ui-window__body' });
    const close = createButton({ icon: 'close', iconOnly: true, variant: 'ghost', title: 'Close', onClick: () => this.close() });
    const header = h('div', { className: 'ui-window__header' }, [this.titleEl, close]);

    this.tabs = options.tabs?.length ? new Tabs(options.tabs, (id) => this.show(id)) : null;
    const tabsRow = this.tabs ? h('div', { className: 'ui-window__tabs' }, [this.tabs.el]) : null;
    const footer = options.footer?.length ? h('div', { className: 'ui-window__footer' }, options.footer) : null;

    const frame = h(
      'div',
      { className: 'ui-window', attrs: { role: 'dialog', 'aria-modal': 'true', 'aria-label': options.title, 'data-window': options.id } },
      [header, tabsRow, this.body, footer],
    );
    // Clicking the scrim (outside the frame) closes; clicks inside don't reach the game.
    frame.addEventListener('pointerdown', (e) => e.stopPropagation());
    this.el = h('div', { className: 'ui-scrim' }, [frame]);
    this.el.addEventListener('pointerdown', (e) => {
      if (e.target === this.el) this.close();
    });

    if (!this.tabs) this.show(null);
  }

  setTitle(title: string): void {
    setText(this.titleEl, title);
  }

  close(): void {
    this.el.remove();
    this.options.onClose?.();
  }

  private show(tabId: string | null): void {
    this.body.replaceChildren(this.options.render(tabId));
  }
}
