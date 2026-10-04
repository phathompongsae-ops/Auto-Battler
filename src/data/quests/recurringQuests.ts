import type { QuestDef, QuestRewards } from '../questData';

/*
 * Daily Commissions and Weekly quests — Balance v1 PLACEHOLDERS (to be tuned
 * once the Vertical Slice exists). Diamond comes mainly from Weekly; Daily
 * gives small EXP / Gold / materials. Nothing here grants Skill or Stat
 * Points. These are ordinary quest definitions marked `repeat`; the
 * RecurringQuests service assigns and resets them per server day / week.
 *
 * DEMO NOTE: the prototype map has only normal Slimes, so Elite / Mini Boss
 * objectives can be selected but not yet completed in play.
 */

export const DAILY_FEATURE = 'daily_commission' as const;
export const WEEKLY_FEATURE = 'weekly_quests' as const;

export const RECURRING_CONFIG = {
  /** Daily Commissions assigned each server day. */
  dailyCount: 3,
  /** Server days per server week (week 0 = days 1–7). */
  daysPerWeek: 7,
} as const;

const DAILY_REWARD: QuestRewards = { exp: 150, gold: 100 };

const daily = (def: Omit<QuestDef, 'type' | 'repeat' | 'prerequisites'>): QuestDef => ({
  ...def,
  type: 'daily',
  repeat: { reset: 'daily' },
  prerequisites: { requiredFeatureIds: [DAILY_FEATURE] },
});

const weekly = (def: Omit<QuestDef, 'type' | 'repeat' | 'prerequisites'>): QuestDef => ({
  ...def,
  type: 'weekly',
  repeat: { reset: 'weekly' },
  prerequisites: { requiredFeatureIds: [WEEKLY_FEATURE] },
});

export const DAILY_QUESTS: Readonly<Record<string, QuestDef>> = Object.fromEntries(
  [
    daily({
      id: 'daily_field_hunter',
      title: 'Field Hunter',
      description: 'Defeat 20 normal field monsters.',
      objectives: [{ kind: 'kill', zone: 'field', tier: 'normal', count: 20 }],
      rewards: { ...DAILY_REWARD, items: [{ itemId: 'enhancement_stone', count: 1 }] },
    }),
    daily({
      id: 'daily_elite_hunter',
      title: 'Elite Hunter',
      description: 'Defeat 3 Elite field monsters.',
      objectives: [{ kind: 'kill', zone: 'field', tier: 'elite', count: 3 }],
      rewards: { ...DAILY_REWARD, items: [{ itemId: 'enhancement_stone', count: 2 }] },
    }),
    daily({
      id: 'daily_material_collector',
      title: 'Material Collector',
      description: 'Collect 10 Slime Gel.',
      objectives: [{ kind: 'collect', itemId: 'slime_gel', count: 10 }],
      rewards: { ...DAILY_REWARD, items: [{ itemId: 'enhancement_stone', count: 1 }] },
    }),
    daily({
      id: 'daily_dungeon_adventurer',
      title: 'Dungeon Adventurer',
      description: 'Clear any dungeon once.',
      objectives: [{ kind: 'dungeon_clear', count: 1 }],
      rewards: { ...DAILY_REWARD, items: [{ itemId: 'enchant_stone', count: 1 }] },
    }),
    daily({
      id: 'daily_enhancement_practice',
      title: 'Enhancement Practice',
      description: 'Successfully enhance equipment once.',
      objectives: [{ kind: 'enhance', count: 1 }],
      rewards: { ...DAILY_REWARD, items: [{ itemId: 'enhancement_stone', count: 2 }] },
    }),
    daily({
      id: 'daily_explorer',
      title: 'Explorer',
      description: 'Visit the Old Gate and the Trial Grounds.',
      objectives: [
        { kind: 'visit', locationId: 'demo_marker_gate' },
        { kind: 'visit', locationId: 'demo_job_trial_marker' },
      ],
      rewards: { ...DAILY_REWARD },
    }),
    daily({
      id: 'daily_helping_hand',
      title: 'Helping Hand',
      description: 'Help others: finish 1 dungeon clear as an Assist.',
      objectives: [{ kind: 'dungeon_clear', assist: true, count: 1 }],
      rewards: { ...DAILY_REWARD, items: [{ itemId: 'enhancement_stone', count: 1 }] },
    }),
    daily({
      id: 'daily_mini_boss_hunter',
      title: 'Mini Boss Hunter',
      description: 'Defeat a field Mini Boss.',
      objectives: [{ kind: 'kill', zone: 'field', tier: 'mini_boss', count: 1 }],
      rewards: { ...DAILY_REWARD, items: [{ itemId: 'rare_craft_material', count: 1 }] },
    }),
  ].map((d) => [d.id, d]),
);

/** Daily selection pool: weight (relative) and minimum level to be eligible. */
export const DAILY_POOL: readonly { questId: string; weight: number; minLevel: number }[] = [
  { questId: 'daily_field_hunter', weight: 3, minLevel: 1 },
  { questId: 'daily_elite_hunter', weight: 2, minLevel: 1 },
  { questId: 'daily_material_collector', weight: 3, minLevel: 1 },
  { questId: 'daily_dungeon_adventurer', weight: 2, minLevel: 1 },
  { questId: 'daily_enhancement_practice', weight: 2, minLevel: 1 },
  { questId: 'daily_explorer', weight: 2, minLevel: 1 },
  { questId: 'daily_helping_hand', weight: 1, minLevel: 1 },
  { questId: 'daily_mini_boss_hunter', weight: 1, minLevel: 1 },
];

export const WEEKLY_QUESTS: Readonly<Record<string, QuestDef>> = Object.fromEntries(
  [
    weekly({
      id: 'weekly_dungeon_hunter',
      title: 'Dungeon Hunter',
      description: 'Clear 10 dungeons this week.',
      objectives: [{ kind: 'dungeon_clear', count: 10 }],
      rewards: { diamond: 40 },
    }),
    weekly({
      id: 'weekly_helping_hand',
      title: 'Helping Hand',
      description: 'Finish 3 dungeon clears as an Assist.',
      objectives: [{ kind: 'dungeon_clear', assist: true, count: 3 }],
      rewards: { diamond: 30 },
    }),
    weekly({
      id: 'weekly_field_hunter',
      title: 'Field Hunter',
      description: 'Defeat 150 field monsters.',
      objectives: [{ kind: 'kill', zone: 'field', count: 150 }],
      rewards: { gold: 2000, items: [{ itemId: 'rare_craft_material', count: 3 }] },
    }),
    weekly({
      id: 'weekly_elite_hunter',
      title: 'Elite Hunter',
      description: 'Defeat 10 Elite field monsters.',
      objectives: [{ kind: 'kill', zone: 'field', tier: 'elite', count: 10 }],
      rewards: { diamond: 30 },
    }),
    weekly({
      id: 'weekly_boss_hunter',
      title: 'Boss Hunter',
      description: 'Defeat 3 field Mini Bosses.',
      objectives: [{ kind: 'kill', zone: 'field', tier: 'mini_boss', count: 3 }],
      rewards: { items: [{ itemId: 'enhancement_stone', count: 10 }] },
    }),
    weekly({
      id: 'weekly_gear_master',
      title: 'Gear Master',
      description: 'Successfully enhance equipment 5 times.',
      objectives: [{ kind: 'enhance', count: 5 }],
      rewards: { diamond: 30 },
    }),
    weekly({
      id: 'weekly_adventurer',
      title: 'Adventurer',
      description: 'Complete 15 Daily Commissions this week.',
      objectives: [{ kind: 'daily_commission', count: 15 }],
      rewards: { diamond: 40 },
    }),
  ].map((d) => [d.id, d]),
);

/** Weekly milestones by number of Weekly quests claimed this week; each claimable once per week. */
export const WEEKLY_MILESTONES: readonly { claimed: number; rewards: QuestRewards }[] = [
  { claimed: 3, rewards: { items: [{ itemId: 'material_box', count: 1 }] } },
  { claimed: 5, rewards: { diamond: 50 } },
  { claimed: 7, rewards: { diamond: 80, items: [{ itemId: 'weekly_chest', count: 1 }] } },
];
