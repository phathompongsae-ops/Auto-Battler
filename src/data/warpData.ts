/*
 * Warp destinations v1. Maps don't exist yet: these ids are DEMO/test
 * destinations so the rules can be exercised. Real maps replace this data.
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
  bossRoomMapId: string;
}

export interface PortalDef {
  id: string;
  from: string;
  to: string;
}

export const TOWNS: Readonly<Record<string, TownDef>> = {
  demo_town: { id: 'demo_town', isDefault: true },
};

export const DUNGEON_WARPS: Readonly<Record<string, DungeonWarpDef>> = {
  demo_dungeon: { id: 'demo_dungeon', entranceMapId: 'demo_dungeon_entrance', bossRoomMapId: 'demo_dungeon_boss' },
};

/** Normal map-to-map portals: separate from scrolls, cost nothing. */
export const PORTALS: Readonly<Record<string, PortalDef>> = {
  demo_town_to_field: { id: 'demo_town_to_field', from: 'demo_town', to: 'demo_field' },
  demo_field_to_town: { id: 'demo_field_to_town', from: 'demo_field', to: 'demo_town' },
  demo_field_to_dungeon: { id: 'demo_field_to_dungeon', from: 'demo_field', to: 'demo_dungeon_entrance' },
};
