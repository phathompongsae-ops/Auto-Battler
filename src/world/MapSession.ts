import { DEFAULT_MAP_ID, mapDef, MAPS, type EncounterProfileId, type MapDef } from '../data/maps';
import { spawnPlan, type MonsterSpawn } from './mapRules';

/** What a map change needs from the game (CombatWorld + scene); tests fake it. */
export interface MapSessionHost<M> {
  /** Tear down the old map's tiles / collision / visuals and build this one. */
  build(map: MapDef): void;
  /** Create and register one monster. */
  spawn(spawn: MonsterSpawn): M;
  /** Remove and destroy one monster of the map being left. */
  despawn(monster: M): void;
}

/**
 * The loaded map and its monsters. Entering a map always despawns every
 * monster of the previous one first, then builds the new map and spawns
 * exactly its own spawn plan (none for a Town).
 */
export class MapSession<M> {
  private current: MapDef | null = null;
  private spawned: M[] = [];

  constructor(private readonly host: MapSessionHost<M>) {}

  get map(): MapDef {
    return this.current ?? MAPS[DEFAULT_MAP_ID];
  }

  get loaded(): boolean {
    return this.current !== null;
  }

  monsters(): readonly M[] {
    return this.spawned;
  }

  /** Load `mapId` (unknown ids load the default map) with its spawns under `profile`. Returns the map loaded. */
  enter(mapId: string, profile: EncounterProfileId = 'standard'): MapDef {
    const map = mapDef(mapId) ?? MAPS[DEFAULT_MAP_ID];
    for (const monster of this.spawned.splice(0)) this.host.despawn(monster);
    this.current = map;
    this.host.build(map);
    this.spawned = spawnPlan(map, profile).map((s) => this.host.spawn(s));
    return map;
  }
}
