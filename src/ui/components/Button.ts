import { h } from '../dom';
import { icon, type IconName } from '../icons';

export type ButtonVariant = 'default' | 'primary' | 'ghost';

export interface ButtonOptions {
  label?: string;
  /** Line icon shown before the label, or alone for icon buttons. */
  icon?: IconName;
  variant?: ButtonVariant;
  /** Square icon-only button; the label becomes its tooltip/aria-label. */
  iconOnly?: boolean;
  round?: boolean;
  title?: string;
  onClick?: () => void;
}

export function createButton(options: ButtonOptions): HTMLButtonElement {
  const classes = ['ui-button'];
  if (options.variant && options.variant !== 'default') classes.push(`ui-button--${options.variant}`);
  if (options.iconOnly) classes.push('ui-button--icon');
  if (options.round) classes.push('ui-button--round');
  const button = h('button', { className: classes.join(' '), attrs: { type: 'button' } }, [
    options.icon ? icon(options.icon) : null,
    options.label && !options.iconOnly ? h('span', { text: options.label }) : null,
  ]);
  const name = options.title ?? options.label;
  if (name) {
    button.title = name;
    button.setAttribute('aria-label', name);
  }
  if (options.onClick) {
    const onClick = options.onClick;
    button.addEventListener('click', (e) => {
      e.stopPropagation();
      onClick();
    });
  }
  return button;
}
