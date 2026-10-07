import { TILE_SIZE } from '../config';
import type { MapDef, TileRect } from '../data/maps';

/*
 * Encounter arenas (engine-free). A dungeon encounter's floor, in world px,
 * from MapDef.encounterAreas: arena monsters only notice and chase a target
 * inside it, so encounters never pull each other in and a boss can use its
 * whole room without a radius leash resetting it.
 */

/** An axis-aligned rectangle in world px. */
export interface PxRect {
  x: number;
  y: number;
  w: number;
  h: number;
}

export const tileRectToPx = (r: TileRect, tile = TILE_SIZE): PxRect => ({ x: r.x * tile, y: r.y * tile, w: r.w * tile, h: r.h * tile });

/** The arena's floor in px, or undefined when the map has no such area. */
export function arenaRects(map: MapDef, arenaId: string | undefined): readonly PxRect[] | undefined {
  const area = arenaId ? map.encounterAreas?.[arenaId] : undefined;
  return area?.rects.map((r) => tileRectToPx(r));
}

/** Whether a point is on the arena's floor. */
export function inArena(rects: readonly PxRect[], x: number, y: number): boolean {
  return rects.some((r) => x >= r.x && x < r.x + r.w && y >= r.y && y < r.y + r.h);
}

/** Whether a point is inside a tile rectangle. */
export const inTileRect = (r: TileRect, x: number, y: number, tile = TILE_SIZE) => inArena([tileRectToPx(r, tile)], x, y);

/** Whether a monster with this arena may notice / keep a target at (x, y) (no arena: anywhere). */
export const withinEncounter = (arena: readonly PxRect[] | undefined, x: number, y: number) => !arena || inArena(arena, x, y);
