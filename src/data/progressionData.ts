export const MAX_LEVEL = 50;

/** EXP needed to go from `level` to `level + 1`. */
export const EXP_CURVE = { base: 50, exponent: 1.5 };

export function expToNext(level: number): number {
  return Math.round(EXP_CURVE.base * level ** EXP_CURVE.exponent);
}
