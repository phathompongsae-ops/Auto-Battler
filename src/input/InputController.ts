import type { Direction, DirectionSource } from './Direction';

/**
 * Merges several direction sources into one movement intent. Sources are
 * checked in order; the first one asking for movement wins. Gameplay code
 * only ever talks to this, never to keyboard/touch directly.
 */
export class InputController {
  private readonly sources: DirectionSource[];

  constructor(...sources: DirectionSource[]) {
    this.sources = sources;
  }

  getDirection(): Direction | null {
    for (const source of this.sources) {
      const dir = source.getDirection();
      if (dir) return dir;
    }
    return null;
  }

  destroy(): void {
    for (const source of this.sources) source.destroy();
  }
}
