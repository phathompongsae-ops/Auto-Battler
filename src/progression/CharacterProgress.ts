import { FREE_STAT_POINTS_PER_LEVEL, NOVICE_BASE_STATS } from '../data/statData';
import { isJobId, JOB_CHANGE_LEVEL, JOBS, SKILL_POINT_PROGRESSION, STARTING_JOB, type JobId } from '../data/jobData';
import { classGrowthMaxLevel } from '../stats/classBaseStats';
import { primaryModifier, type StatModifier } from '../stats/modifiers';
import { clonePrimary, isPrimaryStat, PRIMARY_STATS, sumPrimary, zeroPrimary, type PrimaryStat, type PrimaryStats } from '../stats/primaryStats';

/** Free stat points earned by reaching `level`: none at Level 1, +1 per level after. */
export function earnedStatPoints(level: number): number {
  return Math.max(0, Math.floor(level) - 1) * FREE_STAT_POINTS_PER_LEVEL;
}

export type AllocateError = 'invalid_stat' | 'invalid_amount' | 'not_enough_points';
export type JobChangeError = 'unknown_job' | 'level_too_low' | 'level_too_high' | 'not_allowed_from_current_job';

/**
 * Skill points earned at `level` by a character whose job is `classId`: the
 * sum over every tier up to the job's tier. Novice earns none.
 */
export function earnedSkillPoints(classId: JobId, level: number): number {
  let total = 0;
  for (let tier = 1; tier <= JOBS[classId].tier; tier++) {
    const rule = SKILL_POINT_PROGRESSION[tier as 1 | 2];
    if (!rule || level < rule.fromLevel) continue;
    total += (Math.min(level, rule.toLevel) - rule.fromLevel + 1) * rule.perLevel;
  }
  return total;
}

export interface CharacterProgressData {
  classId: JobId;
  base: PrimaryStats;
  allocated: PrimaryStats;
  /** Bonus granted by each job taken, kept separate per job. */
  jobBonuses: Partial<Record<JobId, Partial<PrimaryStats>>>;
  /** Skill points spent (skill trees aren't designed yet). Earned points are derived from job and level. */
  skillPointsSpent: number;
}

/**
 * A character's persistent stat inputs: job, base, allocated points, job
 * bonuses, skill points. Level and EXP stay with the combat state and are
 * passed in where needed. No engine code: usable on a server or in tests.
 */
export class CharacterProgress {
  classId: JobId;
  readonly base: PrimaryStats;
  readonly allocated: PrimaryStats;
  readonly jobBonuses: Partial<Record<JobId, Partial<PrimaryStats>>>;
  skillPointsSpent: number;

  constructor(data?: Partial<CharacterProgressData>) {
    this.classId = data?.classId ?? STARTING_JOB;
    this.base = clonePrimary(data?.base ?? NOVICE_BASE_STATS);
    this.allocated = clonePrimary(data?.allocated ?? zeroPrimary());
    this.jobBonuses = Object.fromEntries(
      Object.entries(data?.jobBonuses ?? {}).map(([job, bonus]) => [job, { ...bonus }]),
    ) as Partial<Record<JobId, Partial<PrimaryStats>>>;
    this.skillPointsSpent = data?.skillPointsSpent ?? 0;
  }

  earned(level: number): number {
    return earnedStatPoints(level);
  }

  spent(): number {
    return sumPrimary(this.allocated);
  }

  remaining(level: number): number {
    return this.earned(level) - this.spent();
  }

  /** Spend free points on one stat. There is no per-stat cap. */
  allocate(stat: PrimaryStat, amount: number, level: number): { ok: true } | { ok: false; reason: AllocateError } {
    if (!isPrimaryStat(stat)) return { ok: false, reason: 'invalid_stat' };
    if (!Number.isInteger(amount) || amount <= 0) return { ok: false, reason: 'invalid_amount' };
    if (amount > this.remaining(level)) return { ok: false, reason: 'not_enough_points' };
    this.allocated[stat] += amount;
    return { ok: true };
  }

  earnedSkillPoints(level: number): number {
    return earnedSkillPoints(this.classId, level);
  }

  remainingSkillPoints(level: number): number {
    return this.earnedSkillPoints(level) - this.skillPointsSpent;
  }

  /** Return every allocated point. Touches nothing else. Returns how many came back. */
  resetAllocated(): number {
    const refunded = this.spent();
    for (const stat of PRIMARY_STATS) this.allocated[stat] = 0;
    return refunded;
  }

  /** Whether `jobId` can be taken now (no state change). */
  canChangeJob(jobId: string, level: number): { ok: true } | { ok: false; reason: JobChangeError } {
    if (!isJobId(jobId)) return { ok: false, reason: 'unknown_job' };
    const job = JOBS[jobId];
    if (job.tier === 0 || !job.from.includes(this.classId)) return { ok: false, reason: 'not_allowed_from_current_job' };
    if (level < JOB_CHANGE_LEVEL[job.tier]) return { ok: false, reason: 'level_too_low' };
    const growthEnd = classGrowthMaxLevel(jobId);
    if (growthEnd !== null && level > growthEnd) return { ok: false, reason: 'level_too_high' };
    return { ok: true };
  }

  /**
   * Take a job: records its automatic Job Bonus (no free points are spent or
   * granted by a job change).
   */
  changeJob(jobId: string, level: number): { ok: true } | { ok: false; reason: JobChangeError } {
    const check = this.canChangeJob(jobId, level);
    if (!check.ok) return check;
    const id = jobId as JobId;
    this.classId = id;
    const bonus = JOBS[id].jobBonus;
    if (bonus) this.jobBonuses[id] = { ...bonus };
    return { ok: true };
  }

  /** Sum of all job bonuses received. */
  totalJobBonus(): PrimaryStats {
    const total = zeroPrimary();
    for (const bonus of Object.values(this.jobBonuses)) for (const stat of PRIMARY_STATS) total[stat] += bonus?.[stat] ?? 0;
    return total;
  }

  /** Base, allocated and one modifier per job bonus; add equipment/pet/buffs on top. */
  modifiers(): StatModifier[] {
    const mods = [primaryModifier('base', 'base', this.base), primaryModifier('allocated', 'allocated', this.allocated)];
    for (const [job, bonus] of Object.entries(this.jobBonuses)) if (bonus) mods.push(primaryModifier('job', `job:${job}`, bonus));
    return mods;
  }

  /** Replace everything with `data` (save loading, debug reset). Missing parts become fresh-character defaults. */
  assign(data: Partial<CharacterProgressData>): void {
    const fresh = new CharacterProgress(data);
    this.classId = fresh.classId;
    Object.assign(this.base, fresh.base);
    Object.assign(this.allocated, fresh.allocated);
    for (const key of Object.keys(this.jobBonuses)) delete this.jobBonuses[key as JobId];
    Object.assign(this.jobBonuses, fresh.jobBonuses);
    this.skillPointsSpent = fresh.skillPointsSpent;
  }

  toData(): CharacterProgressData {
    return {
      classId: this.classId,
      base: clonePrimary(this.base),
      allocated: clonePrimary(this.allocated),
      jobBonuses: Object.fromEntries(Object.entries(this.jobBonuses).map(([j, b]) => [j, { ...b }])),
      skillPointsSpent: this.skillPointsSpent,
    };
  }
}
