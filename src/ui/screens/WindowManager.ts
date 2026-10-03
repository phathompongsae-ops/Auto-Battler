import { createButton } from '../components/Button';
import { UiWindow } from '../components/Window';
import { h } from '../dom';
import { SCREENS, SCREEN_BY_ID, type ScreenId } from '../data/screens';
import { SCREEN_CONTENT, type ScreenContext } from './content';

/** Opens one screen window at a time; hotkeys toggle, Esc closes. */
export class WindowManager {
  private current: { id: ScreenId | 'menu'; window: UiWindow } | null = null;
  private readonly listeners = new Set<(id: ScreenId | 'menu' | null) => void>();

  constructor(
    private readonly host: HTMLElement,
    private readonly ctx: ScreenContext,
  ) {
    window.addEventListener('keydown', this.onKey);
  }

  get openId(): ScreenId | 'menu' | null {
    return this.current?.id ?? null;
  }

  onChange(listener: (id: ScreenId | 'menu' | null) => void): void {
    this.listeners.add(listener);
  }

  toggle(id: ScreenId | 'menu'): void {
    if (this.current?.id === id) this.close();
    else this.open(id);
  }

  open(id: ScreenId | 'menu'): void {
    this.close();
    const window =
      id === 'menu'
        ? new UiWindow({ id: 'menu', title: 'Menu', render: () => this.renderMenu(), onClose: () => this.closed() })
        : new UiWindow({
            id,
            title: SCREEN_BY_ID[id].title,
            tabs: SCREEN_BY_ID[id].tabs,
            render: (tab) => SCREEN_CONTENT[id](tab, this.ctx),
            onClose: () => this.closed(),
          });
    this.current = { id, window };
    this.host.append(window.el);
    this.emit();
  }

  close(): void {
    this.current?.window.close();
  }

  destroy(): void {
    window.removeEventListener('keydown', this.onKey);
    this.close();
  }

  private closed(): void {
    this.current = null;
    this.emit();
  }

  private emit(): void {
    for (const listener of this.listeners) listener(this.openId);
  }

  /** Grid of every screen, for the ones not pinned to the HUD. */
  private renderMenu(): Node {
    return h(
      'div',
      { className: 'ui-menu-grid' },
      SCREENS.map((s) => createButton({ label: s.title, icon: s.icon, onClick: () => this.open(s.id) })),
    );
  }

  private readonly onKey = (e: KeyboardEvent): void => {
    if (e.repeat) return;
    if (e.code === 'Escape' && this.current) {
      this.close();
      return;
    }
    const screen = SCREENS.find((s) => s.hotkey === e.code);
    if (screen) this.toggle(screen.id);
  };
}
