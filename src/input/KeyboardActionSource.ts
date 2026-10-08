import Phaser from 'phaser';
import type { Action, ActionSource } from './Action';

const K = Phaser.Input.Keyboard.KeyCodes;

export const KEYBOARD_ACTION_BINDINGS: Record<Action, number[]> = {
  attack: [K.SPACE],
  skill1: [K.Q],
  skill2: [K.E],
  skill3: [K.R],
  skill4: [K.F],
  skill5: [K.G],
  target_next: [K.TAB],
  dodge: [K.SHIFT],
  hp_potion: [K.ONE],
  mp_potion: [K.TWO],
};

export class KeyboardActionSource implements ActionSource {
  private readonly keys: Record<Action, Phaser.Input.Keyboard.Key[]>;
  /**
   * Presses latched from each key's 'down' event until the game reads them.
   * Phaser processes queued key events once per frame and Key.onUp clears
   * its "just down" flag, so a tap whose down and up land in the same frame
   * (a quick tap, or any tap during a frame hitch) was lost with JustDown.
   */
  private readonly latched = new Set<Action>();
  private readonly unsubscribe: (() => void)[] = [];

  constructor(scene: Phaser.Scene) {
    const keyboard = scene.input.keyboard;
    if (!keyboard) throw new Error('Keyboard input plugin is not available');
    const keys = {} as Record<Action, Phaser.Input.Keyboard.Key[]>;
    for (const [action, codes] of Object.entries(KEYBOARD_ACTION_BINDINGS) as [Action, number[]][]) {
      keys[action] = codes.map((code) => keyboard.addKey(code)); // captured: no page scroll / focus change
      for (const key of keys[action]) {
        const onDown = () => this.latched.add(action);
        key.on('down', onDown);
        this.unsubscribe.push(() => key.off('down', onDown));
      }
    }
    this.keys = keys;
  }

  isHeld(action: Action): boolean {
    return this.keys[action].some((key) => key.isDown);
  }

  consumePressed(action: Action): boolean {
    // Keep Phaser's own "just down" flags in step, but the latch is what decides.
    for (const key of this.keys[action]) Phaser.Input.Keyboard.JustDown(key);
    return this.latched.delete(action);
  }

  destroy(): void {
    for (const off of this.unsubscribe) off();
    this.latched.clear();
  }
}
