import type { TouchDragSource } from '../../input/TouchDragSource';
import { h } from '../dom';
import type { UiRoot } from '../UiRoot';

/** Knob travel, in unscaled UI pixels. */
const KNOB_RANGE = 32;

/**
 * Visual for the drag-to-move stick. TouchDragSource stays the input; this
 * only draws a base where the drag started and a knob toward the finger.
 * Idle, touch devices see a faint hint ring bottom-left.
 */
export class Joystick {
  readonly el: HTMLDivElement;
  private readonly base: HTMLDivElement;
  private readonly knob: HTMLDivElement;
  private active = false;

  constructor(
    private readonly source: TouchDragSource,
    private readonly root: UiRoot,
  ) {
    this.base = h('div', { className: 'hud-joystick__base' });
    this.knob = h('div', { className: 'hud-joystick__knob' });
    this.el = h('div', { className: 'hud-joystick', attrs: { 'data-active': 'false', 'data-hud': 'joystick' } }, [
      h('div', { className: 'hud-joystick__hint' }),
      this.base,
      this.knob,
    ]);
  }

  update(): void {
    const origin = this.source.origin;
    const active = !!origin;
    if (active !== this.active) {
      this.active = active;
      this.el.dataset.active = String(active);
    }
    if (!origin) return;
    const o = this.root.toLocal(origin.x, origin.y);
    const c = this.root.toLocal(this.source.current.x, this.source.current.y);
    const range = KNOB_RANGE * this.root.uiScale;
    let dx = c.x - o.x;
    let dy = c.y - o.y;
    const len = Math.hypot(dx, dy);
    if (len > range) {
      dx = (dx / len) * range;
      dy = (dy / len) * range;
    }
    this.base.style.left = `${o.x}px`;
    this.base.style.top = `${o.y}px`;
    this.knob.style.left = `${o.x + dx}px`;
    this.knob.style.top = `${o.y + dy}px`;
  }
}
