/** Abstract gameplay actions. Combat code only ever sees these, never keys or buttons. */
export type Action = 'attack' | 'skill1' | 'skill2' | 'skill3' | 'skill4' | 'skill5' | 'target_next';

export const ACTIONS: readonly Action[] = ['attack', 'skill1', 'skill2', 'skill3', 'skill4', 'skill5', 'target_next'];

/**
 * Something that can trigger actions: keyboard now, on-screen buttons or a
 * gamepad later.
 */
export interface ActionSource {
  /** True while the action's control is held down. */
  isHeld(action: Action): boolean;
  /** True once per press; reading it consumes the press. */
  consumePressed(action: Action): boolean;
  destroy(): void;
}
