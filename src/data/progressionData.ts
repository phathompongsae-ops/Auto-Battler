/*
 * EXP / Level Progression v1 (Lv1–60).
 *
 * Demo philosophy: levelling is intentionally fast. Long-term power comes from
 * equipment, sets, enhancement, enchant, pets and rare drops, not from slow
 * levels, so do not stretch this curve to extend playtime. The demo's
 * playable content focuses on Lv1–20.
 *
 * The curve is defined by cumulative-EXP anchors (total EXP from Lv1 needed to
 * REACH a level). Levels between anchors follow a smooth monotone cubic
 * (see expCurve.ts); anchor levels are hit exactly.
 */

export const MAX_LEVEL = 60;

/** Level → cumulative EXP to reach it. Lv1 (the start) is 0. */
export const EXP_ANCHORS: Readonly<Record<number, number>> = {
  1: 0,
  10: 20_000,
  11: 25_000,
  20: 90_000,
  30: 240_000,
  40: 550_000,
  45: 825_000,
  50: 1_225_000,
  53: 1_550_000,
  55: 1_820_000,
  57: 2_150_000,
  60: 2_700_000,
};

/**
 * Server level cap by server day (day 1 = launch day). Each entry applies from
 * `fromDay` until the next entry. Players at the cap store Overflow EXP.
 */
export const SERVER_LEVEL_CAPS: readonly { fromDay: number; cap: number }[] = [
  { fromDay: 1, cap: 40 },
  { fromDay: 2, cap: 45 },
  { fromDay: 4, cap: 50 },
  { fromDay: 7, cap: 53 },
  { fromDay: 10, cap: 55 },
  { fromDay: 14, cap: 57 },
  { fromDay: 21, cap: 60 },
];
