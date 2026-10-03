import type { AttackStyle } from '../stats/derivedStats';
import type { PrimaryStats } from '../stats/primaryStats';

/*
 * Jobs (classes). Game logic references the stable `id`, never `name`.
 *
 * Tier 0 = Novice, tier 1 = first class (Level 11), tier 2 = second class
 * (Level 40). Tier-2 jobs are not designed yet: the schema supports them
 * (`from` a tier-1 job, optional `jobBonus`), but no entries exist.
 */

export type JobTier = 0 | 1 | 2;

/** Level at which a job of each tier can be taken. */
export const JOB_CHANGE_LEVEL: Record<Exclude<JobTier, 0>, number> = { 1: 11, 2: 40 };

/**
 * Skill points per tier: +perLevel for each level from fromLevel to toLevel,
 * earned once a job of that tier is held. Levels only; quests never grant
 * skill points. Tier 2 is not designed yet.
 */
export const SKILL_POINT_PROGRESSION: Partial<Record<Exclude<JobTier, 0>, { fromLevel: number; toLevel: number; perLevel: number }>> = {
  1: { fromLevel: 11, toLevel: 40, perLevel: 1 },
};

export interface JobDef {
  id: string;
  name: string;
  tier: JobTier;
  /** Jobs this one can be taken from. Empty for Novice. */
  from: readonly string[];
  /** Automatic primary-stat bonus on taking the job. Free, separate from allocated points. */
  jobBonus?: Partial<PrimaryStats>;
  attackStyle: AttackStyle;
}

const JOB_DEFS = {
  novice: { id: 'novice', name: 'Novice', tier: 0, from: [], attackStyle: 'melee' },
  warrior: { id: 'warrior', name: 'Warrior', tier: 1, from: ['novice'], jobBonus: { str: 3, vit: 2 }, attackStyle: 'melee' },
  archer: { id: 'archer', name: 'Archer', tier: 1, from: ['novice'], jobBonus: { dex: 3, agi: 2 }, attackStyle: 'ranged' },
  mage: { id: 'mage', name: 'Mage', tier: 1, from: ['novice'], jobBonus: { int: 3, dex: 2 }, attackStyle: 'melee' },
  cleric: { id: 'cleric', name: 'Cleric', tier: 1, from: ['novice'], jobBonus: { int: 3, vit: 2 }, attackStyle: 'melee' },
  ninja: { id: 'ninja', name: 'Ninja', tier: 1, from: ['novice'], jobBonus: { agi: 3, luk: 2 }, attackStyle: 'melee' },
} satisfies Record<string, JobDef>;

export type JobId = keyof typeof JOB_DEFS;
export const JOBS: Record<JobId, JobDef> = JOB_DEFS;
export const STARTING_JOB: JobId = 'novice';

export function isJobId(value: unknown): value is JobId {
  return typeof value === 'string' && value in JOBS;
}
