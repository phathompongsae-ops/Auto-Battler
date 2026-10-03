/*
 * Time source for anything calendar-based (shop refresh, crafting). Game
 * logic takes a Clock instead of calling Date.now(), so tests inject a fixed
 * clock and a future server can supply authoritative time.
 *
 * DEMO: the playable build uses the browser's clock (local, untrusted). It is
 * fine for single-player testing and must be replaced by server time before
 * anything with real value depends on it.
 */
export interface Clock {
  /** Milliseconds since the Unix epoch. */
  now(): number;
}

export const localClock: Clock = { now: () => Date.now() };

/** A settable clock for tests and dev tools. */
export class ManualClock implements Clock {
  constructor(private time: number) {}

  now(): number {
    return this.time;
  }

  set(time: number): void {
    this.time = time;
  }

  advance(ms: number): void {
    this.time += ms;
  }
}
