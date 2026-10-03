import { h, setText } from '../dom';

export type BarKind = 'hp' | 'mp' | 'exp';

export interface BarOptions {
  /** Show "value / max" over the bar. */
  showText?: boolean;
  thin?: boolean;
}

/** HP / MP / EXP bar. Call set() as often as you like; it only writes on change. */
export class Bar {
  readonly el: HTMLDivElement;
  private readonly fill: HTMLDivElement;
  private readonly text: HTMLSpanElement | null;
  private ratio = -1;
  private label = '';

  constructor(
    readonly kind: BarKind,
    options: BarOptions = {},
  ) {
    this.fill = h('div', { className: 'ui-bar__fill' });
    this.text = options.showText ? h('span', { className: 'ui-bar__text' }) : null;
    this.el = h(
      'div',
      {
        className: `ui-bar ui-bar--${kind}${options.thin ? ' ui-bar--thin' : ''}`,
        attrs: { role: 'meter', 'aria-label': kind.toUpperCase(), 'data-bar': kind },
      },
      [this.fill, this.text],
    );
  }

  set(value: number, max: number): void {
    const ratio = max > 0 ? Math.min(1, Math.max(0, value / max)) : 0;
    if (Math.abs(ratio - this.ratio) > 0.001) {
      this.ratio = ratio;
      this.fill.style.transform = `scaleX(${ratio})`;
      this.el.dataset.ratio = ratio.toFixed(3);
    }
    const label = `${Math.ceil(value)} / ${Math.round(max)}`;
    if (label === this.label) return;
    this.label = label;
    if (this.text) setText(this.text, label);
    this.el.setAttribute('aria-valuenow', String(Math.ceil(value)));
    this.el.setAttribute('aria-valuemax', String(Math.round(max)));
  }
}
