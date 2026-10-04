import type { FeatureId } from './featureData';

/*
 * Class 1 Job Change (Lv11): which quests form the Job Trial and what a
 * successful change unlocks. The JobChange service reads this; it never
 * names quests itself. NPC / marker ids are DEMO placeholders until the
 * real Town map exists.
 */
export const JOB_INSTRUCTOR_NPC_ID = 'demo_job_instructor';
export const JOB_TRIAL_MARKER_ID = 'demo_job_trial_marker';

export const CLASS_1_JOB_CHANGE: {
  /** First quest of the trial (its availability = the Job Quest becoming available). */
  firstQuestId: string;
  /** Claiming this quest completes the Job Trial and opens job selection. */
  trialQuestId: string;
  /** NPC that offers the selection while it is pending. */
  instructorNpcId: string;
  /** Unlocked by a successful Class 1 job change. */
  unlocksFeature: FeatureId;
} = {
  firstQuestId: 'job_c1_01_instructor',
  trialQuestId: 'job_c1_03_report',
  instructorNpcId: JOB_INSTRUCTOR_NPC_ID,
  unlocksFeature: 'class_1_skills',
};
