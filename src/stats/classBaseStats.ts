import { CLASS_GROWTH, type ClassBaseValues } from '../data/classGrowth';
import type { JobId } from '../data/jobData';

export class ClassGrowthRangeError extends Error {}

const KEYS: readonly (keyof ClassBaseValues)[] = ['hp', 'mp', 'atk', 'matk', 'def', 'mdef'];

/**
 * A class's base combat values at `level`.
 *
 * Exact anchor levels return the locked values. Between two anchors each
 * value is linearly interpolated and rounded to the nearest integer, halves
 * rounding up (Math.round). Below the first anchor or past the last one with
 * afterLastAnchor 'error', this throws instead of extrapolating.
 */
export function classBaseStats(classId: JobId, level: number): ClassBaseValues {
  const growth = CLASS_GROWTH[classId];
  const levels = Object.keys(growth.anchors).map(Number).sort((a, b) => a - b);
  const first = levels[0];
  const last = levels[levels.length - 1];
  if (!Number.isInteger(level) || level < first) {
    throw new ClassGrowthRangeError(`${classId} has no base growth for level ${level} (starts at ${first})`);
  }
  if (level >= last) {
    if (level > last && growth.afterLastAnchor === 'error') {
      throw new ClassGrowthRangeError(`${classId} base growth ends at level ${last}; level ${level} is not defined`);
    }
    return { ...growth.anchors[last] };
  }
  const hi = levels.find((l) => l >= level)!;
  if (hi === level) return { ...growth.anchors[hi] };
  const lo = levels[levels.indexOf(hi) - 1];
  const t = (level - lo) / (hi - lo);
  const a = growth.anchors[lo];
  const b = growth.anchors[hi];
  const out = {} as ClassBaseValues;
  for (const k of KEYS) out[k] = Math.round(a[k] + (b[k] - a[k]) * t);
  return out;
}

/** Highest level a class has base growth for, or null when it holds indefinitely. */
export function classGrowthMaxLevel(classId: JobId): number | null {
  const growth = CLASS_GROWTH[classId];
  if (growth.afterLastAnchor === 'hold') return null;
  return Math.max(...Object.keys(growth.anchors).map(Number));
}
