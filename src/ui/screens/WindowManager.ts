import { medallion } from '../components/Medallion';
import { Badge } from '../components/Badge';
import { UiWindow } from '../components/Window';
import { h } from '../dom';
import { SCREENS, SCREEN_BY_ID, type ScreenId } from '../data/screens';
import { SCREEN_CONTENT, type ScreenContext } from './content';

/** Open window kinds: a menu screen, the menu grid, or a dialogue (NPC talk...). */
export type OpenWindowId = ScreenId | 'menu' | 'dialog';

/** Opens one screen window at a time; hotkeys toggle, Esc closes. */
export class WindowManager {
  private current: { id: OpenWindowId; window: UiWindow } | null = null;
  private readonly listeners = new Set<(id: OpenWindowId | null) => void>();
  private readonly menuBadges = new Map<ScreenId, Badge>();
  private notices = { items: 0, questReady: false };

  constructor(
    private readonly host: HTMLElement,
    private readonly ctx: ScreenContext,
  ) {
    window.addEventListener('keydown', this.onKey);
  }

  get openId(): OpenWindowId | null {
    return this.current?.id ?? null;
  }

  onChange(listener: (id: OpenWindowId | null) => void): void {
    this.listeners.add(listener);
  }

  /** Presentation counters, shared with the permanent strip; no saved state. */
  setNotices(items: number, questReady: boolean): void {
    this.notices = { items, questReady };
    this.menuBadges.get('inventory')?.set(items);
    this.menuBadges.get('quest')?.set(questReady);
  }

  toggle(id: ScreenId | 'menu'): void {
    if (this.current?.id === id) this.close();
    else this.open(id);
  }

  /** Why a screen can't be opened right now (its feature is locked), or null. */
  lockReason(id: ScreenId | 'menu'): string | null {
    if (id === 'menu') return null;
    const feature = SCREEN_BY_ID[id].feature;
    if (!feature) return null;
    const check = this.ctx.world.featureProgression.check(feature);
    return check.ok ? null : check.message;
  }

  /** Open a screen; a locked one doesn't open (whatever asked: hotkey, menu, button). */
  open(id: ScreenId | 'menu'): boolean {
    if (this.lockReason(id)) return false;
    this.close();
    const window =
      id === 'menu'
        ? new UiWindow({ id: 'menu', title: 'Adventurer’s Crest', render: () => this.renderMenu(), onClose: () => this.closed() })
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
    return true;
  }

  /**
   * A dialogue window (not a menu screen): `windowId` is its data-window
   * name, `render` builds its body (it may re-render itself). Replaces any
   * open window.
   */
  openDialog(windowId: string, title: string, render: () => Node): void {
    this.close();
    const window = new UiWindow({ id: windowId, title, render: () => render(), onClose: () => this.closed() });
    this.current = { id: 'dialog', window };
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
    this.menuBadges.clear();
    this.emit();
  }

  private emit(): void {
    for (const listener of this.listeners) listener(this.openId);
  }

  /** Grid of every screen, for the ones not pinned to the HUD. */
  private renderMenu(): Node {
    this.menuBadges.clear();
    return h(
      'div',
      { className: 'ui-menu-grid' },
      SCREENS.filter((s) => s.implemented !== false).map((s) => {
        const reason = this.lockReason(s.id);
        const button = medallion(s.title, s.icon, () => this.open(s.id));
        button.title = reason ? `${s.title} — ${reason}` : s.title;
        button.dataset.screen = s.id;
        if (s.id === 'inventory' || s.id === 'quest') {
          const badge = new Badge(button);
          badge.set(s.id === 'inventory' ? this.notices.items : this.notices.questReady);
          this.menuBadges.set(s.id, badge);
        }
        if (!reason) return button;
        // Locked systems stay visible so players can see what is coming.
        button.disabled = true;
        button.dataset.locked = 'true';
        return h('div', { attrs: { 'data-locked-screen': s.id } }, [button, h('div', { className: 'ui-caption', text: reason })]);
      }),
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
