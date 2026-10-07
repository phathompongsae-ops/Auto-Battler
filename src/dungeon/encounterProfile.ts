import type { MonsterDef } from '../data/monsterData';
import { STORY_ENCOUNTERS, type StoryEncounterProfile } from '../data/storyEncounters';

/*
 * Which combat profile a map's monsters spawn with. No engine code.
 *
 * 'story': the map has a Story profile and the Dungeon feature (Lv20: runs,
 * difficulty, repeat rewards) is still locked, i.e. the story-driven visit.
 * 'standard': everything else, including every visit once the Dungeon
 * feature is unlocked; monsters use their base data unchanged.
 *
 * A run is only ever started with the Dungeon feature unlocked, so a Story
 * visit never has a run and a run never sees Story stats.
 */

export type EncounterProfileId = 'story' | 'standard';

export function selectEncounterProfile(mapId: string, ctx: { dungeonFeatureUnlocked: boolean }, profiles = STORY_ENCOUNTERS): EncounterProfileId {
  return profiles[mapId] && !ctx.dungeonFeatureUnlocked ? 'story' : 'standard';
}

/** The definition a monster spawns with under a profile (base data when nothing overrides it). */
export function profiledMonsterDef(def: MonsterDef, mapId: string, profile: EncounterProfileId, profiles = STORY_ENCOUNTERS): MonsterDef {
  const o = profile === 'story' ? (profiles[mapId] as StoryEncounterProfile | undefined)?.monsters[def.id] : undefined;
  if (!o) return def;
  return {
    ...def,
    level: o.level,
    stats: { ...def.stats, ...o.stats, magicDefense: o.stats.defense },
    ...(o.specialSkill ? { specialSkill: o.specialSkill } : {}),
    ...(o.respawnDelay !== undefined ? { respawnDelay: o.respawnDelay } : {}),
  };
}
