export type Direction = 'up' | 'down' | 'left' | 'right';

export const DIRECTIONS: readonly Direction[] = ['down', 'left', 'right', 'up'];

export const DIRECTION_VECTORS: Record<Direction, { x: number; y: number }> = {
  up: { x: 0, y: -1 },
  down: { x: 0, y: 1 },
  left: { x: -1, y: 0 },
  right: { x: 1, y: 0 },
};

/** A free movement direction (any length > 0; only its direction is used). */
export interface MoveVector {
  x: number;
  y: number;
}

/** What a frame of movement input asks for: a cardinal direction or a free vector (analog stick). */
export type MoveIntent = Direction | MoveVector;

/**
 * How far past the 45° diagonal the other axis must lead before a moving
 * character turns: the current facing is kept while its own axis is at least
 * 1/FACING_HYSTERESIS of the other one (about ±5° around the diagonal), so a
 * near-diagonal stick does not flicker between two facings.
 */
export const FACING_HYSTERESIS = 1.2;

/**
 * Nearest cardinal facing for a movement vector (4-direction presentation).
 * With `current`, that facing is kept inside the hysteresis band.
 */
export function cardinalFacing(v: MoveVector, current: Direction | null = null): Direction {
  const dominant: Direction = Math.abs(v.x) >= Math.abs(v.y) ? (v.x < 0 ? 'left' : 'right') : v.y < 0 ? 'up' : 'down';
  if (!current || current === dominant) return dominant;
  const axis = DIRECTION_VECTORS[current];
  const along = v.x * axis.x + v.y * axis.y;
  const across = Math.abs(axis.x !== 0 ? v.y : v.x);
  return along > 0 && along * FACING_HYSTERESIS >= across ? current : dominant;
}

/**
 * Something that can request movement: keyboard, a touch joystick, a
 * gamepad, or later an AI/replay driver. `getDirection` is the cardinal
 * request; analog sources may also offer a free vector via `getVector`.
 * Both return null when the source is not asking for movement.
 */
export interface DirectionSource {
  getDirection(): Direction | null;
  getVector?(): MoveVector | null;
  destroy(): void;
}
