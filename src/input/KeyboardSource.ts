import Phaser from 'phaser';
import type { Direction, DirectionSource } from './Direction';

const KEY_BINDINGS: Record<Direction, number[]> = {
  up: [Phaser.Input.Keyboard.KeyCodes.W, Phaser.Input.Keyboard.KeyCodes.UP],
  down: [Phaser.Input.Keyboard.KeyCodes.S, Phaser.Input.Keyboard.KeyCodes.DOWN],
  left: [Phaser.Input.Keyboard.KeyCodes.A, Phaser.Input.Keyboard.KeyCodes.LEFT],
  right: [Phaser.Input.Keyboard.KeyCodes.D, Phaser.Input.Keyboard.KeyCodes.RIGHT],
};

/**
 * WASD + arrow keys. With several directions held, the most recently pressed
 * one wins, so 4-direction movement never "sticks" on the older key.
 */
export class KeyboardSource implements DirectionSource {
  private readonly keys: Record<Direction, Phaser.Input.Keyboard.Key[]>;
  private held: Direction[] = [];

  constructor(scene: Phaser.Scene) {
    const keyboard = scene.input.keyboard;
    if (!keyboard) throw new Error('Keyboard input plugin is not available');

    // addKey captures the key, so arrows don't scroll the page.
    this.keys = {
      up: KEY_BINDINGS.up.map((code) => keyboard.addKey(code)),
      down: KEY_BINDINGS.down.map((code) => keyboard.addKey(code)),
      left: KEY_BINDINGS.left.map((code) => keyboard.addKey(code)),
      right: KEY_BINDINGS.right.map((code) => keyboard.addKey(code)),
    };
  }

  getDirection(): Direction | null {
    for (const dir of Object.keys(this.keys) as Direction[]) {
      const down = this.keys[dir].some((key) => key.isDown);
      const index = this.held.indexOf(dir);
      if (down && index === -1) this.held.push(dir);
      else if (!down && index !== -1) this.held.splice(index, 1);
    }
    return this.held.at(-1) ?? null;
  }

  destroy(): void {
    this.held = [];
  }
}
