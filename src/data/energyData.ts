import type { MonsterTier } from './monsterBalance';

/*
 * Field Energy v1. A daily budget for normal field farming rewards (EXP and
 * drops). It refills to `daily` at the start of each server day; unused
 * Energy does not carry over. Dungeons and quest completion never use it.
 */
export const FIELD_ENERGY = {
  daily: 200,
  /** Energy paid when a field kill's rewards are granted. */
  costByTier: {
    normal: 1,
    elite: 5,
    mini_boss: 10,
    // Dungeon bosses only appear in dungeons, which never consume Field Energy.
    dungeon_boss: 0,
  } satisfies Record<MonsterTier, number>,
} as const;
