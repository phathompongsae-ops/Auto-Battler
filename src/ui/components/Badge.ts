import { h, setText } from '../dom';

/**
 * Notification badge on a host element (menu button, tab, slot). A count shows
 * a number ("9+" past 9), `true` shows a dot, 0/false hides it.
 */
export class Badge {
  readonly el: HTMLSpanElement;

  constructor(host: HTMLElement) {
    host.classList.add('ui-badge-host');
    this.el = h('span', { className: 'ui-badge', attrs: { hidden: '' } });
    host.append(this.el);
  }

  set(value: number | boolean): void {
    if (value === false || value === 0) {
      this.el.hidden = true;
      return;
    }
    this.el.hidden = false;
    const dot = value === true;
    this.el.classList.toggle('ui-badge--dot', dot);
    setText(this.el, dot ? '' : value > 9 ? '9+' : String(value));
  }
}
