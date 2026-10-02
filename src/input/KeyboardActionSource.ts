import Phaser from 'phaser';
import type { Action, ActionSource } from './Action';

const K = Phaser.Input.Keyboard.KeyCodes;

export const KEYBOARD_ACTION_BINDINGS: Record<Action, number[]> = {
  attack: [K.SPACE],
  skill1: [K.Q],
  skill2: [K.E],
  skill3: [K.R],
  target_next: [K.TAB],
};

export class KeyboardActionSource implements ActionSource {
  private readonly keys: Record<Action, Phaser.Input.Keyboard.Key[]>;

  constructor(scene: Phaser.Scene) {
    const keyboard = scene.input.keyboard;
    if (!keyboard) throw new Error('Keyboard input plugin is not available');
    const keys = {} as Record<Action, Phaser.Input.Keyboard.Key[]>;
    for (const [action, codes] of Object.entries(KEYBOARD_ACTION_BINDINGS) as [Action, number[]][]) {
      keys[action] = codes.map((code) => keyboard.addKey(code)); // captured: no page scroll / focus change
    }
    this.keys = keys;
  }

  isHeld(action: Action): boolean {
    return this.keys[action].some((key) => key.isDown);
  }

  consumePressed(action: Action): boolean {
    // Check every key so each one's "just down" flag is consumed.
    let pressed = false;
    for (const key of this.keys[action]) {
      if (Phaser.Input.Keyboard.JustDown(key)) pressed = true;
    }
    return pressed;
  }

  destroy(): void {}
}
