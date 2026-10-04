import Phaser from 'phaser';
import type { Direction, DirectionSource, MoveVector } from './Direction';

/** Screen pixels a drag must travel before it counts as movement. */
export const JOYSTICK_DEAD_ZONE = 16;
/** Touches in this left share of the screen spawn the joystick; the rest is free for aiming / buttons. */
export const JOYSTICK_ZONE_FRACTION = 0.48;
/** Base radius in screen pixels at UI scale 1 (matches the 110 px base drawn by the HUD). */
export const JOYSTICK_BASE_RADIUS = 55;

/**
 * Mobile dynamic floating joystick (the movement input).
 *
 * - A touch that starts in the left JOYSTICK_ZONE_FRACTION of the screen
 *   becomes the joystick: its own position is the base (pulled in from the
 *   screen edges just enough for the base to fit).
 * - Only that finger drives the stick; other touches are ignored until it
 *   lifts. Lifting it (or losing focus) hides the stick, and the next touch
 *   can place it somewhere else.
 * - Past the dead zone the stick is analog: `getVector` gives the free drag
 *   direction (diagonal movement allowed); `getDirection` its dominant axis.
 *
 * Mouse (desktop): pressing anywhere drags the stick the same way, so the
 * keyboard-less desktop build keeps drag-to-move.
 *
 * Pure input: the HUD's Joystick draws it from `origin` / `current`.
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

  /** Free drag direction past the dead zone (unit length), or null. */
  getVector(): MoveVector | null {
    if (!this.origin) return null;
    const dx = this.current.x - this.origin.x;
    const dy = this.current.y - this.origin.y;
    const len = Math.hypot(dx, dy);
    if (len < JOYSTICK_DEAD_ZONE) return null;
    return { x: dx / len, y: dy / len };
  }

  getDirection(): Direction | null {
    const v = this.getVector();
    if (!v) return null;
    if (Math.abs(v.x) > Math.abs(v.y)) return v.x < 0 ? 'left' : 'right';
    return v.y < 0 ? 'up' : 'down';
  }

  /** Whether a touch at this screen x may spawn the joystick. */
  static inZone(x: number, screenWidth: number): boolean {
    return x < screenWidth * JOYSTICK_ZONE_FRACTION;
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
    if (this.pointerId !== null) return; // the owning finger keeps the stick
    const { width, height } = this.scene.scale;
    if (pointer.wasTouch && !TouchDragSource.inZone(pointer.x, width)) return;
    this.pointerId = pointer.id;
    // The base appears under the finger, nudged inward only if it would leave the screen.
    const r = Math.min(JOYSTICK_BASE_RADIUS, width / 4, height / 4);
    const x = Phaser.Math.Clamp(pointer.x, r, width - r);
    const y = Phaser.Math.Clamp(pointer.y, r, height - r);
    this.origin = new Phaser.Math.Vector2(x, y);
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
