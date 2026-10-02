import type { Action, ActionSource } from './Action';

/**
 * Programmatic action source. Future on-screen buttons call press()/release()
 * from their pointer handlers; nothing in combat needs to change.
 */
export class VirtualActionSource implements ActionSource {
  private readonly held = new Set<Action>();
  private readonly pressed = new Set<Action>();

  press(action: Action): void {
    if (!this.held.has(action)) this.pressed.add(action);
    this.held.add(action);
  }

  release(action: Action): void {
    this.held.delete(action);
  }

  isHeld(action: Action): boolean {
    return this.held.has(action);
  }

  consumePressed(action: Action): boolean {
    return this.pressed.delete(action);
  }

  destroy(): void {
    this.held.clear();
    this.pressed.clear();
  }
}
