import { h } from '../dom';
import { icon, type IconName } from '../icons';

/** Original crest artwork, shared by the permanent strip and system grid. */
export function medallion(label: string, glyph: IconName, onClick: () => void): HTMLButtonElement {
  const button = h('button', {
    className: 'ui-medallion',
    attrs: { type: 'button', 'aria-label': label, title: label, 'data-motif': glyph },
  }, [h('span', { className: 'ui-medallion__face' }, [icon(glyph)]), h('span', { className: 'ui-medallion__label', text: label })]);
  button.addEventListener('click', (e) => { e.stopPropagation(); onClick(); });
  return button;
}
