import { allPortals, CRYPT_MAP_ID, TOWN_MAP_ID } from './maps';

/*
 * Warp destinations v1, on the real map table (data/maps). Towns and
 * dungeons here are warp-unlock data; the maps themselves live in the table.
 */

export type LocationKind = 'town' | 'field' | 'dungeon';

export interface Location {
  kind: LocationKind;
  mapId: string;
}

export interface TownDef {
  id: string;
  /** Unlocked from the start and used when no other town is chosen. */
  isDefault: boolean;
}

export interface DungeonWarpDef {
  id: string;
  /** Where a Dungeon Warp lands: always the entrance, never the boss room. */
  entranceMapId: string;
  /** The boss room is a section of the dungeon map (same map id). */
  bossRoomMapId: string;
}

export interface PortalDef {
  id: string;
  from: string;
  to: string;
}

export const TOWNS: Readonly<Record<string, TownDef>> = {
  [TOWN_MAP_ID]: { id: TOWN_MAP_ID, isDefault: true },
};

export const DUNGEON_WARPS: Readonly<Record<string, DungeonWarpDef>> = {
  demo_dungeon: { id: 'demo_dungeon', entranceMapId: CRYPT_MAP_ID, bossRoomMapId: CRYPT_MAP_ID },
};

/** Normal map-to-map portals (the cross-map route graph), from the map table. Free; separate from scrolls. */
export const PORTALS: Readonly<Record<string, PortalDef>> = Object.fromEntries(allPortals().map((p) => [p.id, { id: p.id, from: p.from, to: p.to }]));
