import { TILE_SIZE } from '../config';
import { DEFAULT_MAP_ID, mapDef, mapSize, MAPS, PROP_KINDS, type MapDef, type MapPortalDef } from '../data/maps';
import type { MonsterId } from '../data/monsterData';
import type { NavPoint } from '../data/navigationData';
import type { CollisionGrid } from '../navigation/pathing';
import { PROJECTILE_BLOCKING_TILES, SOLID_TILES, type Tile } from './tiles';

/*
 * Engine-free rules over the map table: collision, spawns, portal triggers
 * and safe positions. The scene draws maps; CombatWorld and tests use these.
 */

interface Cells {
  /** Walking blocked: solid tiles + solid prop footprints. */
  solid: boolean[][];
  /** Projectiles stopped: blocking tiles + tall prop footprints. */
  tall: boolean[][];
}

const cellCache = new Map<string, Cells>();
const grids = new Map<string, CollisionGrid>();

/** Per-tile collision of a map (cached): its tiles plus the footprints of its props. */
export function mapCells(map: MapDef): Cells {
  let cells = cellCache.get(map.id);
  if (cells) return cells;
  cells = {
    solid: map.tiles.map((row) => row.map((t) => SOLID_TILES.includes(t))),
    tall: map.tiles.map((row) => row.map((t) => PROJECTILE_BLOCKING_TILES.includes(t))),
  };
  for (const p of map.props) {
    const kind = PROP_KINDS[p.kind];
    for (let y = p.y; y < p.y + kind.h; y++) {
      for (let x = p.x; x < p.x + kind.w; x++) {
        if (!cells.solid[y] || cells.solid[y][x] === undefined) continue;
        if (kind.solid) cells.solid[y][x] = true;
        if (kind.solid && kind.tall) cells.tall[y][x] = true;
      }
    }
  }
  cellCache.set(map.id, cells);
  return cells;
}

/** Collision (tiles + solid props) for a map id (cached); undefined for an unknown id. */
export function mapCollision(mapId: string): CollisionGrid | undefined {
  const map = mapDef(mapId);
  if (!map) return undefined;
  let grid = grids.get(mapId);
  if (!grid) {
    const { solid } = mapCells(map);
    grid = { isBlocked: (x, y) => solid[Math.floor(y / TILE_SIZE)]?.[Math.floor(x / TILE_SIZE)] ?? true };
    grids.set(mapId, grid);
  }
  return grid;
}

export function tileAt(map: MapDef, x: number, y: number): Tile | undefined {
  return map.tiles[Math.floor(y / TILE_SIZE)]?.[Math.floor(x / TILE_SIZE)];
}

/** Outside the map, a projectile-blocking tile or a tall solid prop. */
export function blocksProjectile(map: MapDef, x: number, y: number): boolean {
  return mapCells(map).tall[Math.floor(y / TILE_SIZE)]?.[Math.floor(x / TILE_SIZE)] ?? true;
}

/** One monster to place when a map loads. Ids are `<monsterId>-<n>`, numbered per monster kind on the map. */
export interface MonsterSpawn {
  id: string;
  monsterId: MonsterId;
  zoneId: string;
  x: number;
  y: number;
}

export function spawnPlan(map: MapDef): MonsterSpawn[] {
  const counts = new Map<string, number>();
  const out: MonsterSpawn[] = [];
  for (const zone of map.monsterSpawnZones) {
    for (const p of zone.points) {
      const n = (counts.get(zone.monsterId) ?? 0) + 1;
      counts.set(zone.monsterId, n);
      out.push({ id: `${zone.monsterId}-${n}`, monsterId: zone.monsterId, zoneId: zone.id, x: p.tileX * TILE_SIZE + TILE_SIZE / 2, y: p.tileY * TILE_SIZE + TILE_SIZE / 2 });
    }
  }
  return out;
}

/** The portal whose trigger area contains (x, y), if any. */
export function portalAt(map: MapDef, x: number, y: number): MapPortalDef | undefined {
  const tx = x / TILE_SIZE;
  const ty = y / TILE_SIZE;
  return map.portals.find((p) => tx >= p.area.x && tx < p.area.x + p.area.w && ty >= p.area.y && ty < p.area.y + p.area.h);
}

/** Half-size (px) of the box checked around a standing point: about the player's feet body. */
const STAND_MARGIN = 8;

/** A point the player can stand on: finite, inside the map, clear of solid tiles and not inside a portal trigger. */
export function isSafePosition(map: MapDef, p: { x: unknown; y: unknown }): p is NavPoint {
  const { x, y } = p;
  if (typeof x !== 'number' || typeof y !== 'number' || !Number.isFinite(x) || !Number.isFinite(y)) return false;
  const { width, height } = mapSize(map);
  if (x < 0 || y < 0 || x >= width * TILE_SIZE || y >= height * TILE_SIZE) return false;
  const grid = mapCollision(map.id)!;
  const m = STAND_MARGIN;
  if (grid.isBlocked(x - m, y - m) || grid.isBlocked(x + m, y - m) || grid.isBlocked(x - m, y + m) || grid.isBlocked(x + m, y + m)) return false;
  return !portalAt(map, x, y);
}

/** Saved location data (may be missing or bad). */
export interface SavedLocation {
  mapId: string;
  x: number;
  y: number;
}

export type MapEntryFallback = 'no_location' | 'unknown_map' | 'invalid_position' | 'dungeon_entrance';

/**
 * Where a loaded character appears. A known map and a safe position are kept;
 * otherwise the safe default is used:
 * - no saved location (older saves) / unknown map id → the default map's spawn;
 * - a bad position → that map's safe spawn;
 * - a dungeon map → its entrance (spawn): a run is never restored from a save.
 */
export function resolveMapEntry(saved: SavedLocation | null | undefined): { mapId: string; at: NavPoint; fallback: MapEntryFallback | null } {
  const home = MAPS[DEFAULT_MAP_ID];
  if (!saved) return { mapId: home.id, at: { ...home.spawnPoint }, fallback: 'no_location' };
  const map = mapDef(saved.mapId);
  if (!map) return { mapId: home.id, at: { ...home.spawnPoint }, fallback: 'unknown_map' };
  if (map.type === 'dungeon') return { mapId: map.id, at: { ...map.spawnPoint }, fallback: 'dungeon_entrance' };
  if (!isSafePosition(map, saved)) return { mapId: map.id, at: { ...map.spawnPoint }, fallback: 'invalid_position' };
  return { mapId: map.id, at: { x: saved.x, y: saved.y }, fallback: null };
}
