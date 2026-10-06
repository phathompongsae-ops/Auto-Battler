import type { MonsterId } from '../monsterData';
import type { NavPoint, NavTarget } from '../navigationData';
import type { LocationKind } from '../warpData';
import type { Tile } from '../../world/tiles';

/*
 * Data-driven map table. Every playable map (Town / Field / Dungeon) is one
 * MapDef: its tiles (collision comes from the solid tiles), a safe spawn,
 * portals (the authoritative cross-map graph), monster spawn zones and
 * navigation targets. Nothing about a specific map is hard-coded in code or UI.
 */

export type MapType = LocationKind;

/** A rectangle in tile coordinates. */
export interface TileRect {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface MapPortalDef {
  /** Stable portal id (PORTALS key; quests / saves never store it). */
  id: string;
  /** Destination map id. */
  to: string;
  /** Trigger area (tiles): the player stepping inside it takes the portal. Keep it clear of arrival points. */
  area: TileRect;
  /** Where the player appears on the destination map (world px). */
  arrival: NavPoint;
  label: string;
  /** Hand-placed Auto Move waypoints toward this portal (same map), when a direct L path is blocked. */
  waypoints?: readonly NavPoint[];
}

/** Monsters of one kind placed at fixed points (one per point). Field: by zone; Dungeon: by section. */
export interface MonsterSpawnZone {
  id: string;
  monsterId: MonsterId;
  /** Spawn points (tile coordinates; monsters stand on the tile centre). */
  points: readonly { tileX: number; tileY: number }[];
}

export interface MapDef {
  id: string;
  type: MapType;
  displayName: string;
  /** Rows of tile indices (see world/tiles). Collision = SOLID_TILES. */
  tiles: readonly (readonly Tile[])[];
  /** Safe spawn (world px): new characters, loads with no / bad position, respawns. */
  spawnPoint: NavPoint;
  portals: readonly MapPortalDef[];
  /** Town: none (no hostile spawns). */
  monsterSpawnZones: readonly MonsterSpawnZone[];
  /** NPCs, stations, zones and markers on this map (portal targets are derived from `portals`). */
  navigationTargets: readonly NavTarget[];
}

/** Tile centre in world px. */
export const tileCenter = (tileX: number, tileY: number, tileSize = 32): NavPoint => ({ x: tileX * tileSize + tileSize / 2, y: tileY * tileSize + tileSize / 2 });
