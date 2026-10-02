import type { Action, ActionSource } from './Action';
import type { Direction, DirectionSource } from './Direction';

/**
 * Merges several input sources into one movement intent and one set of
 * actions. Gameplay code only ever talks to this, never to keyboard/touch
 * directly.
 */
export class InputController {
  constructor(
    private readonly directionSources: DirectionSource[],
    private readonly actionSources: ActionSource[] = [],
  ) {}

  /** Sources are checked in order; the first one asking for movement wins. */
  getDirection(): Direction | null {
    for (const source of this.directionSources) {
      const dir = source.getDirection();
      if (dir) return dir;
    }
    return null;
  }

  isHeld(action: Action): boolean {
    return this.actionSources.some((source) => source.isHeld(action));
  }

  consumePressed(action: Action): boolean {
    // Ask every source so all of them consume their press.
    let pressed = false;
    for (const source of this.actionSources) {
      if (source.consumePressed(action)) pressed = true;
    }
    return pressed;
  }

  destroy(): void {
    for (const source of this.directionSources) source.destroy();
    for (const source of this.actionSources) source.destroy();
  }
}
