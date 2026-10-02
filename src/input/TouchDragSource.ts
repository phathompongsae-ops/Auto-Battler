import Phaser from 'phaser';
import type { Direction, DirectionSource } from './Direction';

const DEAD_ZONE = 16; // screen pixels before a drag counts as movement

/**
 * Minimal touch / mouse "virtual joystick": press anywhere and drag; the
 * dominant drag axis becomes the direction. It has no visuals yet — the
 * final mobile UI (on-screen stick, buttons) will sit on top of this and can
 * read `origin` / `current` to draw itself.
 */
export class TouchDragSource implements DirectionSource {
  origin: Phaser.Math.Vector2 | null = null;
  readonly current = new Phaser.Math.Vector2();

  private pointerId: number | null = null;

  constructor(private readonly scene: Phaser.Scene) {
    scene.input.on(Phaser.Input.Events.POINTER_DOWN, this.onDown, this);
    scene.input.on(Phaser.Input.Events.POINTER_MOVE, this.onMove, this);
    scene.input.on(Phaser.Input.Events.POINTER_UP, this.onUp, this);
    scene.input.on(Phaser.Input.Events.POINTER_UP_OUTSIDE, this.onUp, this);
    scene.game.events.on(Phaser.Core.Events.BLUR, this.reset, this);
  }

  getDirection(): Direction | null {
    if (!this.origin) return null;
    const dx = this.current.x - this.origin.x;
    const dy = this.current.y - this.origin.y;
    if (Math.max(Math.abs(dx), Math.abs(dy)) < DEAD_ZONE) return null;
    if (Math.abs(dx) > Math.abs(dy)) return dx < 0 ? 'left' : 'right';
    return dy < 0 ? 'up' : 'down';
  }

  destroy(): void {
    this.scene.input.off(Phaser.Input.Events.POINTER_DOWN, this.onDown, this);
    this.scene.input.off(Phaser.Input.Events.POINTER_MOVE, this.onMove, this);
    this.scene.input.off(Phaser.Input.Events.POINTER_UP, this.onUp, this);
    this.scene.input.off(Phaser.Input.Events.POINTER_UP_OUTSIDE, this.onUp, this);
    this.scene.game.events.off(Phaser.Core.Events.BLUR, this.reset, this);
    this.reset();
  }

  private onDown(pointer: Phaser.Input.Pointer): void {
    if (this.pointerId !== null) return; // first finger owns the stick
    this.pointerId = pointer.id;
    this.origin = new Phaser.Math.Vector2(pointer.x, pointer.y);
    this.current.set(pointer.x, pointer.y);
  }

  private onMove(pointer: Phaser.Input.Pointer): void {
    if (pointer.id === this.pointerId) this.current.set(pointer.x, pointer.y);
  }

  private onUp(pointer: Phaser.Input.Pointer): void {
    if (pointer.id === this.pointerId) this.reset();
  }

  private reset(): void {
    this.pointerId = null;
    this.origin = null;
  }
}
