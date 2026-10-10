import type { MonsterAnimSet, MonsterAnimState, MonsterSpecialStrip, MonsterStrip } from '../data/monsterArt';

/*
 * Which real animation frame a monster shows (Visual Pass 4). Pure and engine-free:
 * MonsterAnimator feeds it the simulation clock and the gameplay events it saw, and
 * it never feeds anything back, so damage timing stays with the combat systems.
 *
 * Priority: death (code squash / fade; no frame) > special wind-up / impact > basic
 * attack > special recovery > hit > walk > idle. A new basic attack may cut a
 * special's recovery (the wind-up and impact always play out), so a contact-first
 * attack is never hidden behind recovery frames.
 */

/** What the animator remembers for one monster (simulation-clock ms; null = none). */
export interface MonsterAnimTimeline {
  /** Basic attack used (its damage landed on this tick). */
  attackAt: number | null;
  /** Telegraphed special started (`skillWindup`); impact lands at start + windupMs. */
  special: { start: number; windupMs: number } | null;
  /** Took damage. */
  hitAt: number | null;
}

export type SpecialPhase = 'windup' | 'impact' | 'recovery';

export interface AnimInput {
  now: number;
  dead: boolean;
  moving: boolean;
  /** Phase offset (ms) so a pack does not walk / breathe in lockstep. */
  offset: number;
  timeline: MonsterAnimTimeline;
}

export interface AnimFrame {
  state: MonsterAnimState;
  frame: number;
  /** Set while a special plays. */
  phase?: SpecialPhase;
}

const msPerFrame = (strip: MonsterStrip) => 1000 / strip.fps;

/** A one-shot strip `elapsed` ms after it started, or null once it has finished. */
export function oneShotFrame(strip: MonsterStrip, elapsed: number): number | null {
  if (elapsed < 0) return null;
  const frame = Math.floor(elapsed / msPerFrame(strip));
  return frame < strip.frames ? frame : null;
}

/** A looping strip at clock time t. */
export function loopFrame(strip: MonsterStrip, t: number): number {
  const frame = Math.floor(Math.max(0, t) / msPerFrame(strip)) % strip.frames;
  return frame;
}

/**
 * A special `elapsed` ms after its wind-up started. Raise plays once (squeezed into the first half of a
 * short wind-up), then the hold segment loops until the wind-up ends; the first impact frame is drawn from
 * exactly `windupMs` (the gameplay impact tick), then recovery; null once finished.
 */
export function specialFrame(strip: MonsterSpecialStrip, elapsed: number, windupMs: number): { frame: number; phase: SpecialPhase } | null {
  if (elapsed < 0) return null;
  if (elapsed < windupMs) {
    const raiseMs = Math.min(strip.raise * msPerFrame(strip), windupMs / 2);
    if (elapsed < raiseMs) return { frame: Math.min(strip.raise - 1, Math.floor((elapsed / raiseMs) * strip.raise)), phase: 'windup' };
    return { frame: strip.raise + (Math.floor((elapsed - raiseMs) / msPerFrame(strip)) % strip.hold), phase: 'windup' };
  }
  const k = Math.floor((elapsed - windupMs) / msPerFrame(strip));
  const first = strip.raise + strip.hold;
  if (k < strip.impact) return { frame: first + k, phase: 'impact' };
  if (k < strip.impact + strip.recovery) return { frame: first + k, phase: 'recovery' };
  return null;
}

/** The frame to show now, or null (dead: the death squash / fade keeps the last frame). */
export function chooseMonsterAnim(anims: MonsterAnimSet, input: AnimInput): AnimFrame | null {
  if (input.dead) return null;
  const { now, timeline } = input;
  const special = timeline.special ? specialFrame(anims.special, now - timeline.special.start, timeline.special.windupMs) : null;
  if (special && special.phase !== 'recovery') return { state: 'special', ...special };
  const attack = timeline.attackAt !== null ? oneShotFrame(anims.attack, now - timeline.attackAt) : null;
  if (attack !== null) return { state: 'attack', frame: attack };
  if (special) return { state: 'special', ...special };
  const hit = timeline.hitAt !== null ? oneShotFrame(anims.hit, now - timeline.hitAt) : null;
  if (hit !== null) return { state: 'hit', frame: hit };
  if (input.moving) return { state: 'walk', frame: loopFrame(anims.walk, now + input.offset) };
  return { state: 'idle', frame: loopFrame(anims.idle, now + input.offset) };
}

/** A special is past its impact (or none): a basic attack may start over it. */
export function specialCommitted(anims: MonsterAnimSet, timeline: MonsterAnimTimeline, now: number): boolean {
  if (!timeline.special) return false;
  const s = specialFrame(anims.special, now - timeline.special.start, timeline.special.windupMs);
  return !!s && s.phase !== 'recovery';
}
