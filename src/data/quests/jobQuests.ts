import { JOB_INSTRUCTOR_NPC_ID, JOB_TRIAL_MARKER_ID } from '../jobChangeData';
import type { QuestDef } from '../questData';

/*
 * Class 1 Job Change quests (real Job Quest content, separate from the demo
 * test fixtures). Three chained quests because objectives within one quest
 * progress in parallel and the trial is a sequence: meet the instructor →
 * trial (marker + defeat targets) → report back. No rewards here: a job
 * change never grants Skill Points or free Stat Points. NPC / marker /
 * trial target are DEMO placeholders.
 */
const NOVICE_LV11 = { requiredLevel: 11, requiredClass: ['novice'] } as const;

export const JOB_QUESTS: Readonly<Record<string, QuestDef>> = {
  job_c1_01_instructor: {
    id: 'job_c1_01_instructor',
    title: 'A New Path',
    description: 'You have grown strong. Speak with the Job Instructor about choosing a class.',
    type: 'job',
    objectives: [{ kind: 'talk', npcId: JOB_INSTRUCTOR_NPC_ID }],
    rewards: {},
    prerequisites: { ...NOVICE_LV11 },
    nextQuestIds: ['job_c1_02_trial'],
  },
  job_c1_02_trial: {
    id: 'job_c1_02_trial',
    title: 'The Job Trial',
    description: 'Reach the trial grounds and defeat 3 trial targets.',
    type: 'job',
    objectives: [
      { kind: 'visit', locationId: JOB_TRIAL_MARKER_ID },
      { kind: 'kill', monsterId: 'slime', count: 3 },
    ],
    rewards: {},
    prerequisites: { ...NOVICE_LV11, requiredQuestIds: ['job_c1_01_instructor'] },
    nextQuestIds: ['job_c1_03_report'],
  },
  job_c1_03_report: {
    id: 'job_c1_03_report',
    title: 'Proven Worthy',
    description: 'Return to the Job Instructor and choose your class.',
    type: 'job',
    objectives: [{ kind: 'talk', npcId: JOB_INSTRUCTOR_NPC_ID }],
    rewards: {},
    prerequisites: { ...NOVICE_LV11, requiredQuestIds: ['job_c1_02_trial'] },
  },
};
