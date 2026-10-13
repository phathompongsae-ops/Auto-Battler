/*
 * Idle "life" for a character strip (pure, engine-free): restrained MMORPG-style breathing and weight shift,
 * derived from the existing idle frames instead of redrawn. Each pose resamples one base frame with a small
 * per-row displacement that is exactly zero from the knees down, so the feet stay pixel-identical and planted;
 * the sprite itself is never scaled or moved, so origin, world scale and the collision body are untouched.
 * graphics/idleMotionArt.ts bakes the poses into a texture at boot; unit tests read these same numbers.
 */

/** One baked pose of the idle loop (source pixels of the 192 px strip; the Warrior draws ~0.32 world px per source px). */
export interface IdlePose {
  /** Base strip frame the pose is derived from. */
  readonly frame: number;
  /** Hold time (ms). */
  readonly ms: number;
  /** Upper-body rise (breath): full above the chest, easing to zero at the knees. */
  readonly lift: number;
  /** Weight shift: sideways lean that grows from zero at the feet to full at the head. */
  readonly sway: number;
  /** Secondary motion of the head / hair / weapon tip, trailing the sway. */
  readonly trail: number;
}

/** Rows (counted up from the feet row) where each displacement starts and reaches full strength. */
export const IDLE_MOTION_ROWS = {
  /** Below this the frame is copied untouched: boots, shins and knees never move. */
  still: 30,
  /** Breath reaches full lift at the chest. */
  chest: 72,
  /** Trailing secondary motion starts at the shoulders and is full at the crown. */
  shoulders: 92,
  crown: 125,
} as const;

const smooth = (a: number, b: number, v: number) => {
  const t = Math.min(1, Math.max(0, (v - a) / (b - a)));
  return t * t * (3 - 2 * t);
};

/**
 * Source-space displacement at a row `above` px over the feet row: where that row's pixels are drawn,
 * relative to the base frame (dy < 0 = up). Exactly { 0, 0 } at and below `still`.
 */
export function idleDisplacement(above: number, pose: IdlePose): { dx: number; dy: number } {
  const r = IDLE_MOTION_ROWS;
  if (above <= r.still) return { dx: 0, dy: 0 };
  const body = smooth(r.still, r.chest, above);
  const lean = (above - r.still) / (r.crown - r.still);
  const top = smooth(r.shoulders, r.crown, above);
  return { dx: pose.sway * lean + pose.trail * top, dy: -pose.lift * body };
}

/**
 * Warrior idle loop, ~2.6 s: a slow breath (up to 3 source px ≈ 1 world px ≈ 1.6 screen px at 1.65 zoom) carried
 * by a weight shift (≤ 1.75 px at the head) whose head / hair / blade tip trails one step behind. Steps are small
 * (< 0.8 px) so the loop reads as continuous motion, not a flicker; the drawn weight-shift frame (2) and its
 * in-betweens (1, 3) sit at the peak of the shift, as in the original strip.
 */
export const WARRIOR_IDLE_MOTION: readonly IdlePose[] = buildLoop(16, 2600, 3, 1.75, 1.6);

function buildLoop(steps: number, totalMs: number, lift: number, sway: number, trail: number): IdlePose[] {
  const poses: IdlePose[] = [];
  // Slightly longer holds at full exhale (rest) than at the top of the breath: a calm, uneven rhythm.
  const weights = Array.from({ length: steps }, (_, k) => 1 + 0.35 * Math.cos((2 * Math.PI * k) / steps));
  const sum = weights.reduce((s, w) => s + w, 0);
  const shift = (k: number) => Math.sin((2 * Math.PI * k) / steps - Math.PI / 2);
  for (let k = 0; k < steps; k++) {
    const phase = (2 * Math.PI * k) / steps;
    const s = shift(k);
    poses.push({
      frame: s > 0.6 ? 2 : s > -0.2 ? (shift(k + 1) > s ? 1 : 3) : 0,
      ms: Math.round((totalMs * weights[k]) / sum),
      lift: +(lift * 0.5 * (1 - Math.cos(phase))).toFixed(2),
      sway: +(sway * s).toFixed(2),
      trail: +(trail * (shift(k - 1) - s)).toFixed(2),
    });
  }
  return poses;
}
