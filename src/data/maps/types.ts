import type { MonsterId } from '../monsterData';
import type { NavPoint, NavTarget } from '../navigationData';
import type { LocationKind } from '../warpData';
import type { Tile } from '../../world/tiles';
import type { PropPlacement } from './props';

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

/** Which monster numbers a map's monsters spawn with (see dungeon/encounterProfile). */
export type EncounterProfileId = 'story' | 'standard';

/** Monsters of one kind placed at fixed points (one per point). Field: by zone; Dungeon: by section. */
export interface MonsterSpawnZone {
  id: string;
  monsterId: MonsterId;
  /** Spawn points (tile coordinates; monsters stand on the tile centre). */
  points: readonly { tileX: number; tileY: number }[];
  /**
   * Encounter arena (MapDef.encounterAreas key). An arena monster only
   * notices a player inside its arena and gives up only when it or its target
   * leaves the arena (instead of the radius leash). One zone = one encounter:
   * a party wipe resets it unless all of its monsters are down.
   */
  arena?: string;
  /** Spawn only under these encounter profiles (default: every profile). */
  profiles?: readonly EncounterProfileId[];
}

/**
 * A progression gate on a doorway: while any `requiresCleared` spawn zone
 * still has a monster standing, the player cannot pass through `area` (they
 * stay on their side and are told what is missing). Lets a dungeon require
 * its encounters in order without changing its tiles.
 */
export interface ProgressionGateDef {
  id: string;
  /** The doorway (tiles) that is shut while the gate is closed. */
  area: TileRect;
  /** Spawn zones that must be fully down (zones absent under the current profile count as down). */
  requiresCleared: readonly string[];
  /** Shown when the gate stops the player. */
  message: string;
  /** Active only under these encounter profiles (default: every profile). */
  profiles?: readonly EncounterProfileId[];
}

/** An encounter's floor: one or more tile rectangles. */
export interface EncounterAreaDef {
  label: string;
  rects: readonly TileRect[];
}

/**
 * A dungeon checkpoint: a retry position, never a rest stop (reaching one
 * restores nothing). It activates when the player stands inside `trigger`
 * with every `requiresCleared` spawn zone down; the furthest activated one
 * (by `order`) is where the party retries after a wipe.
 */
export interface CheckpointDef {
  id: string;
  label: string;
  order: number;
  trigger: TileRect;
  /** Where the party reappears (world px). */
  respawn: NavPoint;
  /** Spawn zones (MonsterSpawnZone ids) that must be fully down; zones absent under the current profile count as cleared. */
  requiresCleared?: readonly string[];
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
  /** Landmarks and decoration on top of the tiles; solid ones add collision. */
  props: readonly PropPlacement[];
  /** Signage for landmarks that are not navigation targets (world px). */
  landmarks?: readonly { label: string; x: number; y: number }[];
  /** Dungeon: encounter arenas by id (MonsterSpawnZone.arena). */
  encounterAreas?: Readonly<Record<string, EncounterAreaDef>>;
  /** Dungeon: checkpoints along the route (retry positions after a party wipe). */
  checkpoints?: readonly CheckpointDef[];
  /** Dungeon: doorways that stay shut until the encounters before them are down. */
  progressionGates?: readonly ProgressionGateDef[];
}

/** Tile centre in world px. */
export const tileCenter = (tileX: number, tileY: number, tileSize = 32): NavPoint => ({ x: tileX * tileSize + tileSize / 2, y: tileY * tileSize + tileSize / 2 });
