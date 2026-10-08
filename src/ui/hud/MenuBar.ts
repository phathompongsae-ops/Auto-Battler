import { h } from '../dom';
import { SCREEN_BY_ID, screenTitle, type ScreenId } from '../data/screens';
import { onLocaleChange, t } from '../i18n';
import { icon } from '../icons';
import type { WindowManager } from '../screens/WindowManager';

/**
 * The three world utilities beside the minimap, in one row: Shop, Daily &
 * Weekly and Area Map. Everything else lives in the bottom strip or More.
 * Locked utilities stay visible with a lock mark and their requirement.
 */
export const UTILITY_SCREENS = ['shop', 'commissions', 'map'] as const satisfies readonly ScreenId[];

export class MenuBar {
  readonly el: HTMLDivElement;
  private readonly buttons: { id: ScreenId; button: HTMLButtonElement }[] = [];
  private readonly offLocale: () => void;

  constructor(private readonly windows: WindowManager) {
    this.el = h('div', { className: 'hud-utilities', attrs: { 'data-hud': 'utilities', role: 'toolbar', 'aria-label': t('nav.utilities') } });
    for (const id of UTILITY_SCREENS) {
      const button = h('button', { className: 'hud-utility', attrs: { type: 'button', 'data-menu': id } }, [
        icon(SCREEN_BY_ID[id].icon),
        h('span', { className: 'hud-utility__lock', attrs: { 'aria-hidden': 'true' } }, [icon('lock')]),
      ]);
      button.addEventListener('click', (e) => {
        e.stopPropagation();
        windows.toggle(id);
      });
      this.buttons.push({ id, button });
      this.el.append(button);
    }
    this.offLocale = onLocaleChange(() => {
      this.el.setAttribute('aria-label', t('nav.utilities'));
      this.update();
    });
    this.update();
  }

  update(): void {
    // Locked systems: disabled, with the requirement as the tooltip. Writes only on change.
    for (const { id, button } of this.buttons) {
      const reason = this.windows.lockReason(id);
      const hotkey = SCREEN_BY_ID[id].hotkey?.replace('Key', '');
      const name = screenTitle(id);
      const title = reason ? `${name} — ${reason}` : hotkey ? `${name} (${hotkey})` : name;
      if (button.title !== title) {
        button.title = title;
        button.setAttribute('aria-label', reason ? `${name} — ${reason}` : name);
      }
      if (button.disabled !== !!reason) {
        button.disabled = !!reason;
        if (reason) button.dataset.locked = 'true';
        else delete button.dataset.locked;
      }
      const expanded = String(this.windows.openId === id);
      if (button.getAttribute('aria-expanded') !== expanded) button.setAttribute('aria-expanded', expanded);
    }
  }

  destroy(): void {
    this.offLocale();
  }
}
