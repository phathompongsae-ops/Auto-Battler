import { CRYPT_MAP_ID } from './maps';
import type { MonsterStats } from './monsterData';
import type { SkillId } from './skillData';

/*
 * Story encounter profiles. A dungeon map can carry a Story/Tutorial combat
 * profile used for the first, story-driven visit: while the Lv20 Dungeon
 * feature is still locked (no repeat run can exist), the map's monsters spawn
 * with these overrides instead of their base (Lv20 repeat-dungeon) data.
 * Once the Dungeon feature unlocks, the same map always uses the base data.
 * Data only; selection lives in dungeon/encounterProfile.ts.
 *
 * Story Crypt targets (docs/design/gameplay-source-of-truth.md): a Lv3–5
 * Novice (no gear, 2–4 stat points, the demo kit, no healing) can clear it;
 * normal mobs teach basic combat, groups still cost HP; the Crypt Knight is
 * the tutorial Elite (telegraphed Cleave worth stepping away from); the Crypt
 * Lord is clearly harder: its Slam and its Enrage both matter, its basic
 * attacks alone never outpace a player who keeps attacking.
 */

export interface MonsterProfileOverride {
  /** Shown level (Story monsters read as Lv3–6 content). */
  level: number;
  /** Replaces these base stats (magicDefense follows defense, as for placeholders). */
  stats: Pick<MonsterStats, 'maxHp' | 'attack' | 'defense'>;
  /** Replaces the signature attack (a Story variant with the same telegraph). */
  specialSkill?: SkillId;
  /** ms. Story mobs stay down for the visit: a cleared section stays cleared after a death. */
  respawnDelay?: number;
}

export interface StoryEncounterProfile {
  mapId: string;
  monsters: Readonly<Record<string, MonsterProfileOverride>>;
}

/** Long enough that nothing comes back during one Story visit; re-entering the map respawns everything. */
const STAYS_CLEARED_MS = 30 * 60_000;

export const STORY_ENCOUNTERS: Readonly<Record<string, StoryEncounterProfile>> = {
  [CRYPT_MAP_ID]: {
    mapId: CRYPT_MAP_ID,
    monsters: {
      // Between the Field's Mushroom (Lv3) and Wolf (Lv2) per hit; three at once still cost ~10% HP.
      crypt_skeleton: { level: 4, stats: { maxHp: 110, attack: 10, defense: 4 }, respawnDelay: STAYS_CLEARED_MS },
      // A little above the Elite Boar the Meadow quest already taught; Cleave hits for ~15% of a Lv3 bar.
      crypt_knight: { level: 5, stats: { maxHp: 550, attack: 12, defense: 7 }, specialSkill: 'crypt_cleave_story', respawnDelay: STAYS_CLEARED_MS },
      // ~35 s fight (~5 Slams); Slam ~15% of a Lv3 bar (~22% enraged); Enrage below 35% as in the base data.
      crypt_lord: { level: 6, stats: { maxHp: 2800, attack: 9, defense: 8 }, specialSkill: 'crypt_slam_story', respawnDelay: STAYS_CLEARED_MS },
    },
  },
};
