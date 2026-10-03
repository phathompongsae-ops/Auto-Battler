import { h } from '../dom';

export interface PanelOptions {
  className?: string;
  /** Darker, less translucent surface for dense content. */
  strong?: boolean;
  flat?: boolean;
  padded?: boolean;
}

/** Translucent rounded panel: the base surface for every HUD block and window section. */
export function createPanel(options: PanelOptions = {}, children: (Node | null)[] = []): HTMLDivElement {
  const classes = ['ui-panel'];
  if (options.strong) classes.push('ui-panel--strong');
  if (options.flat) classes.push('ui-panel--flat');
  if (options.padded) classes.push('ui-panel--padded');
  if (options.className) classes.push(options.className);
  return h('div', { className: classes.join(' ') }, children);
}
