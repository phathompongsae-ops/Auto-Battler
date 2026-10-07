import type { CheckpointDef } from '../data/maps';

/*
 * One dungeon attempt (engine-free): which checkpoint the party retries
 * from, how many party wipes it has recovered from, and whether it failed
 * or was cleared. Created on entering a dungeon from outside; gone when the
 * party leaves. Never saved.
 *
 * Party rules: a wipe is every ACTIVE party member down at once. One
 * member's death is never a wipe (a future revive can still bring them
 * back); solo, the player is the whole party. Each wipe with a retry left
 * spends it: the open encounters reset and the party reappears at the
 * latest checkpoint with full HP and half MP. A wipe with none left fails
 * the attempt (no clear reward; quest state untouched; enter again for a
 * new attempt).
 */

/** Vitals after a wipe retry (locked): HP 100%, MP 50%. */
export const RETRY_HP_FRACTION = 1;
export const RETRY_MP_FRACTION = 0.5;

export type AttemptStatus = 'active' | 'cleared' | 'failed';

export interface PartyMember {
  readonly combat: { readonly dead: boolean };
}

/** Every active party member is down (an empty party is never "wiped"). */
export function partyDefeated(members: readonly PartyMember[]): boolean {
  return members.length > 0 && members.every((m) => m.combat.dead);
}

export type WipeOutcome = { kind: 'retry'; retriesLeft: number; checkpoint: CheckpointDef | null } | { kind: 'failed' } | { kind: 'ignored' };

export class DungeonAttempt {
  wipesUsed = 0;
  status: AttemptStatus = 'active';
  private latest: CheckpointDef | null = null;

  constructor(
    readonly mapId: string,
    /** Wipes this attempt can recover from (difficulty data; the Story Crypt uses Normal's). Read when needed. */
    private readonly limit: number | (() => number),
  ) {}

  get wipeLimit(): number {
    return typeof this.limit === 'function' ? this.limit() : this.limit;
  }

  get checkpoint(): CheckpointDef | null {
    return this.latest;
  }

  get retriesLeft(): number {
    return Math.max(0, this.wipeLimit - this.wipesUsed);
  }

  /**
   * The party legitimately reached `cp` (the caller checked its trigger and
   * requirements). The furthest checkpoint along the route wins; walking
   * back past an earlier one never moves the retry point back. Restores
   * nothing. True when it became the retry point.
   */
  activate(cp: CheckpointDef): boolean {
    if (this.status !== 'active') return false;
    if (this.latest && this.latest.order >= cp.order) return false;
    this.latest = cp;
    return true;
  }

  /**
   * The whole active party is down. With a retry left it is spent ('retry');
   * with none it fails the attempt. After a clear or a failure nothing is
   * counted ('ignored').
   */
  recordPartyWipe(): WipeOutcome {
    if (this.status !== 'active') return { kind: 'ignored' };
    if (this.retriesLeft === 0) {
      this.status = 'failed';
      return { kind: 'failed' };
    }
    this.wipesUsed++;
    return { kind: 'retry', retriesLeft: this.retriesLeft, checkpoint: this.latest };
  }

  /** The dungeon's boss is down: later deaths no longer spend retries. */
  markCleared(): void {
    if (this.status === 'active') this.status = 'cleared';
  }
}

/** Whether `cp` may activate now: standing in its trigger with its required encounters down. */
export function checkpointReady(cp: CheckpointDef, ctx: { inTrigger: boolean; zoneCleared: (zoneId: string) => boolean }): boolean {
  return ctx.inTrigger && (cp.requiresCleared ?? []).every((z) => ctx.zoneCleared(z));
}
