/*
 * Floating combat number styling and placement (engine-free, so it is unit
 * tested). The renderer (FloatingText) stays a fixed pool; this only decides
 * how a number looks and where in a small target-local pattern it starts.
 *
 * Hierarchy: critical hits read first (bigger, orange-gold, harder pop),
 * normal hits are warm cream and moderate, damage taken by the player stays
 * red, heals are a calmer green, misses are pale grey. Damage-over-time ticks
 * (Burn) are small, quiet and ember-orange, below every direct hit.
 */

export type CombatNumberKind = 'normal' | 'heavy' | 'crit' | 'player_hit' | 'player_crit' | 'heal' | 'miss' | 'burn';

export interface CombatNumberStyle {
  color: string;
  stroke: string;
  strokeThickness: number;
  /** World px at scale 1. */
  size: number;
  /** Starting scale of the pop (settles to 1). */
  pop: number;
  /** ms of the pop. */
  popMs: number;
  /** Total visible lifetime, ms. */
  duration: number;
  /** World px risen over the lifetime. */
  rise: number;
  /** Small starburst behind the number (critical hits only). */
  spark: boolean;
}

/** Normal hit size; a critical is ~1.5x (locked hierarchy). */
export const NORMAL_DAMAGE_SIZE = 15;

export const COMBAT_NUMBER_STYLES: Readonly<Record<CombatNumberKind, CombatNumberStyle>> = {
  normal: { color: '#fff1d0', stroke: '#2a1c0e', strokeThickness: 3, size: NORMAL_DAMAGE_SIZE, pop: 1.25, popMs: 90, duration: 520, rise: 26, spark: false },
  heavy: { color: '#ffe3a1', stroke: '#2a1c0e', strokeThickness: 3, size: 17, pop: 1.3, popMs: 100, duration: 560, rise: 28, spark: false },
  crit: { color: '#ffb43a', stroke: '#3d1200', strokeThickness: 4, size: 22, pop: 1.7, popMs: 140, duration: 720, rise: 30, spark: true },
  player_hit: { color: '#ff5f57', stroke: '#2a0707', strokeThickness: 3, size: NORMAL_DAMAGE_SIZE, pop: 1.2, popMs: 90, duration: 560, rise: 24, spark: false },
  player_crit: { color: '#ff3b30', stroke: '#2a0303', strokeThickness: 4, size: 20, pop: 1.5, popMs: 130, duration: 680, rise: 26, spark: false },
  heal: { color: '#86ef8f', stroke: '#0c2410', strokeThickness: 3, size: 14, pop: 1.1, popMs: 90, duration: 700, rise: 24, spark: false },
  miss: { color: '#c9cfd6', stroke: '#1a1d22', strokeThickness: 3, size: 13, pop: 1, popMs: 0, duration: 520, rise: 18, spark: false },
  burn: { color: '#ffa65a', stroke: '#331103', strokeThickness: 3, size: 12, pop: 1, popMs: 0, duration: 520, rise: 16, spark: false },
};

/** Which style a damage event gets. */
export function damageKind(e: { targetIsPlayer: boolean; crit: boolean; heavy: boolean; dot?: boolean }): CombatNumberKind {
  if (e.targetIsPlayer) return e.crit ? 'player_crit' : 'player_hit';
  if (e.dot) return 'burn';
  if (e.crit) return 'crit';
  return e.heavy ? 'heavy' : 'normal';
}

/**
 * Small fixed fan of start offsets (px) around the target's text anchor:
 * centre, then alternating right/left a little higher each time. Rapid hits
 * on the same target take the next spot instead of piling on one point; the
 * whole pattern stays within ±14 px horizontally and 12 px vertically.
 */
export const STACK_PATTERN: readonly { dx: number; dy: number }[] = [
  { dx: 0, dy: 0 },
  { dx: 10, dy: -5 },
  { dx: -10, dy: -8 },
  { dx: 14, dy: -12 },
  { dx: -14, dy: -3 },
  { dx: 4, dy: -10 },
];

/** A target's numbers older than this no longer count: the next hit starts the pattern again. */
export const STACK_WINDOW_MS = 380;
/** Remembered targets are pruned beyond this (bounded memory). */
const MAX_TRACKED = 48;

/** Target-local slotting for floating numbers. */
export class NumberSlots {
  private readonly recent = new Map<string, { index: number; at: number }>();

  /** The start offset for a number on `targetId` at time `now` (ms). */
  next(targetId: string, now: number): { dx: number; dy: number } {
    const prev = this.recent.get(targetId);
    const index = prev && now - prev.at <= STACK_WINDOW_MS ? (prev.index + 1) % STACK_PATTERN.length : 0;
    this.recent.delete(targetId);
    this.recent.set(targetId, { index, at: now });
    if (this.recent.size > MAX_TRACKED) this.recent.delete(this.recent.keys().next().value!);
    return STACK_PATTERN[index];
  }

  get tracked(): number {
    return this.recent.size;
  }
}
