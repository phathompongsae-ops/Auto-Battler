export type Direction = 'up' | 'down' | 'left' | 'right';

export const DIRECTIONS: readonly Direction[] = ['down', 'left', 'right', 'up'];

export const DIRECTION_VECTORS: Record<Direction, { x: number; y: number }> = {
  up: { x: 0, y: -1 },
  down: { x: 0, y: 1 },
  left: { x: -1, y: 0 },
  right: { x: 1, y: 0 },
};

/**
 * Something that can request a movement direction: keyboard, a touch
 * joystick, a gamepad, or later an AI/replay driver.
 * Returns null when it is not asking for movement.
 */
export interface DirectionSource {
  getDirection(): Direction | null;
  destroy(): void;
}
