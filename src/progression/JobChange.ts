import type { EventBus } from '../core/EventBus';
import { CLASS_WEAPONS, type WeaponType } from '../data/equipmentData';
import { presentationFor, type ClassPresentation } from '../data/demoConfig';
import { CLASS_1_JOB_CHANGE } from '../data/jobChangeData';
import { JOB_CHANGE_LEVEL, JOBS, type JobId, type JobTier } from '../data/jobData';
import type { PrimaryStats } from '../stats/primaryStats';
import type { FeatureUnlocks } from '../features/FeatureUnlocks';
import type { GameEvents } from '../game/GameEvents';
import type { QuestSystem } from '../quests/QuestSystem';
import { classGrowthMaxLevel } from '../stats/classBaseStats';
import type { StatOwner } from './statActions';

/**
 * novice: no Class 1 job yet (Job Trial not finished).
 * selection_available: the trial is done; the player must pick a Class 1 job.
 * class_1: a Class 1 job is held (permanent for Demo v1).
 */
export type JobChangeStage = 'novice' | 'selection_available' | 'class_1';

export type SelectJobError =
  | 'unknown_job'
  | 'not_a_class_1_job'
  | 'already_changed'
  | 'trial_incomplete'
  | 'level_too_low'
  | 'level_too_high';

/** One job's full definition, assembled from the existing data tables (one class system). */
export interface JobDefinitionView {
  jobId: JobId;
  displayName: string;
  tier: JobTier;
  /** Level at which the job can be taken (0 for Novice). */
  minimumLevel: number;
  /** Last level of its base growth (null = holds indefinitely, e.g. Novice). */
  levelLimit: number | null;
  jobBonus: Partial<PrimaryStats>;
  weapons: readonly WeaponType[];
  offHands: readonly WeaponType[];
  skillTreeId: string | null;
  presentation: ClassPresentation;
}

export function jobDefinition(jobId: JobId): JobDefinitionView {
  const job = JOBS[jobId];
  return {
    jobId,
    displayName: job.name,
    tier: job.tier,
    minimumLevel: job.tier === 0 ? 0 : JOB_CHANGE_LEVEL[job.tier],
    levelLimit: classGrowthMaxLevel(jobId),
    jobBonus: { ...(job.jobBonus ?? {}) },
    weapons: CLASS_WEAPONS[jobId].weapons,
    offHands: CLASS_WEAPONS[jobId].offHands,
    skillTreeId: job.skillTreeId ?? null,
    presentation: presentationFor(jobId),
  };
}

/** Every Class 1 job a Novice can choose. */
export const CLASS_1_CHOICES: readonly JobId[] = (Object.keys(JOBS) as JobId[]).filter((id) => JOBS[id].tier === 1 && JOBS[id].from.includes('novice'));

/**
 * The Lv11 Class 1 Job Change. The Job Trial is ordinary Job Quests (data);
 * claiming the configured trial quest opens selection. Selecting is the only
 * production way to change job: validated, permanent, applied exactly once.
 * Skill points are derived from job + level, so a delayed change keeps every
 * eligible Lv11+ point and nothing here can grant extra ones.
 */
export class JobChange {
  private readonly unsubscribe: (() => void)[] = [];

  constructor(
    private readonly owner: StatOwner,
    private readonly quests: QuestSystem,
    private readonly features: FeatureUnlocks,
    private readonly events: EventBus<GameEvents>,
    private readonly playerId: string,
    private readonly config = CLASS_1_JOB_CHANGE,
  ) {
    this.unsubscribe.push(
      events.on('questAvailable', (e) => {
        if (e.questId === config.firstQuestId) events.emit('jobQuestAvailable', { questId: e.questId });
      }),
      // A claim happens once, so these fire once.
      events.on('questClaimed', (e) => {
        if (e.questId !== config.trialQuestId) return;
        events.emit('jobTrialCompleted', { questId: e.questId });
        if (this.stage() === 'selection_available') events.emit('jobSelectionAvailable', { choices: [...CLASS_1_CHOICES] });
      }),
    );
  }

  destroy(): void {
    for (const off of this.unsubscribe.splice(0)) off();
  }

  trialComplete(): boolean {
    return this.quests.status(this.config.trialQuestId) === 'claimed';
  }

  stage(): JobChangeStage {
    if (JOBS[this.owner.progress.classId].tier >= 1) return 'class_1';
    return this.trialComplete() ? 'selection_available' : 'novice';
  }

  choices(): JobDefinitionView[] {
    return CLASS_1_CHOICES.map(jobDefinition);
  }

  canSelect(jobId: string, { skipTrial = false } = {}): { ok: true } | { ok: false; reason: SelectJobError } {
    if (!(jobId in JOBS)) return { ok: false, reason: 'unknown_job' };
    if (!CLASS_1_CHOICES.includes(jobId as JobId)) return { ok: false, reason: 'not_a_class_1_job' };
    if (this.owner.progress.classId !== 'novice') return { ok: false, reason: 'already_changed' };
    if (!skipTrial && !this.trialComplete()) return { ok: false, reason: 'trial_incomplete' };
    const check = this.owner.progress.canChangeJob(jobId, this.owner.combat.level);
    if (!check.ok) return { ok: false, reason: check.reason === 'level_too_high' ? 'level_too_high' : 'level_too_low' };
    return { ok: true };
  }

  /**
   * Choose the Class 1 job. Applies the Job Bonus (job stats, never allocated
   * points), switches class growth, recalculates stats and refills HP/MP,
   * unlocks the Class 1 skill feature and reports `jobChanged` (quests
   * re-check class prerequisites). A second call is refused: 'already_changed'.
   *
   * `skipTrial` exists only for explicitly named dev force tools.
   */
  select(jobId: string, { skipTrial = false } = {}): { ok: true; jobId: JobId } | { ok: false; reason: SelectJobError } {
    const check = this.canSelect(jobId, { skipTrial });
    if (!check.ok) return check;
    const from = this.owner.progress.classId;
    const result = this.owner.progress.changeJob(jobId, this.owner.combat.level);
    if (!result.ok) return { ok: false, reason: 'level_too_low' };
    const id = jobId as JobId;
    this.owner.combat.refreshStats();
    this.owner.combat.restore();
    this.features.unlock(this.config.unlocksFeature);
    this.events.emit('jobChanged', { entityId: this.playerId, jobId: id, fromJobId: from, tier: JOBS[id].tier });
    return { ok: true, jobId: id };
  }
}
