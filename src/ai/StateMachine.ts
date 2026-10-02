export interface State<C, S extends string> {
  enter?(ctx: C, now: number): void;
  /** Return the next state's id to transition, or nothing to stay. */
  update(ctx: C, now: number, dtMs: number): S | void;
  exit?(ctx: C, now: number): void;
}

/** Small reusable finite state machine. Holds no game logic itself. */
export class StateMachine<C, S extends string> {
  current: S;
  enteredAt: number;

  constructor(
    private readonly ctx: C,
    private readonly states: Record<S, State<C, S>>,
    initial: S,
    now = 0,
  ) {
    this.current = initial;
    this.enteredAt = now;
    this.states[initial].enter?.(ctx, now);
  }

  transition(next: S, now: number): void {
    if (next === this.current) return;
    this.states[this.current].exit?.(this.ctx, now);
    this.current = next;
    this.enteredAt = now;
    this.states[next].enter?.(this.ctx, now);
  }

  update(now: number, dtMs: number): void {
    const next = this.states[this.current].update(this.ctx, now, dtMs);
    if (next) this.transition(next, now);
  }
}
