import type { NavPoint } from '../data/navigationData';
import type { Direction } from '../input/Direction';

/**
 * Plans waypoints within one map. Replaceable (e.g. by A*) without touching
 * AutoMove or quests: AutoMove only follows the returned points.
 */
export interface PathPlanner {
  /** Waypoints ending at `to`, or null when no path is known. */
  plan(mapId: string, from: NavPoint, to: NavPoint, hints?: readonly NavPoint[]): NavPoint[] | null;
}

/** Solid-tile lookup for one map. */
export interface CollisionGrid {
  isBlocked(x: number, y: number): boolean;
}

export function tileGrid(rows: readonly (readonly number[])[], tileSize: number, solid: readonly number[]): CollisionGrid {
  return {
    isBlocked(x, y) {
      const row = rows[Math.floor(y / tileSize)];
      const tile = row?.[Math.floor(x / tileSize)];
      return tile === undefined || solid.includes(tile);
    },
  };
}

/**
 * Prototype planner for 4-direction movement: L-shaped paths (horizontal
 * then vertical, or the reverse), checked against the map's collision tiles
 * with a margin for the player's body. Hand-placed hint waypoints are chained
 * the same way. Maps without a grid get the unchecked horizontal-first path.
 */
export class LPathPlanner implements PathPlanner {
  constructor(
    private readonly gridFor: (mapId: string) => CollisionGrid | undefined = () => undefined,
    private readonly margin = 12,
  ) {}

  plan(mapId: string, from: NavPoint, to: NavPoint, hints: readonly NavPoint[] = []): NavPoint[] | null {
    const grid = this.gridFor(mapId);
    const out: NavPoint[] = [];
    let at = from;
    for (const goal of [...hints, to]) {
      const leg = this.leg(grid, at, goal);
      if (!leg) return null;
      out.push(...leg);
      at = goal;
    }
    return out;
  }

  private leg(grid: CollisionGrid | undefined, from: NavPoint, to: NavPoint): NavPoint[] | null {
    const xFirst = [{ x: to.x, y: from.y }, to];
    if (!grid) return xFirst;
    const yFirst = [{ x: from.x, y: to.y }, to];
    for (const path of [xFirst, yFirst]) if (this.clear(grid, [from, ...path])) return path;
    return null;
  }

  private clear(grid: CollisionGrid, points: NavPoint[]): boolean {
    const m = this.margin;
    for (let i = 1; i < points.length; i++) {
      const a = points[i - 1];
      const b = points[i];
      const steps = Math.max(1, Math.ceil(Math.hypot(b.x - a.x, b.y - a.y) / 8));
      for (let s = 0; s <= steps; s++) {
        const x = a.x + ((b.x - a.x) * s) / steps;
        const y = a.y + ((b.y - a.y) * s) / steps;
        if (grid.isBlocked(x - m, y - m) || grid.isBlocked(x + m, y - m) || grid.isBlocked(x - m, y + m) || grid.isBlocked(x + m, y + m)) return false;
      }
    }
    return true;
  }
}

/**
 * The movement direction toward a waypoint for 4-direction movement: close
 * the horizontal gap first, then the vertical one. null = within `tolerance`
 * on both axes (reached).
 */
export function steerToward(from: NavPoint, to: NavPoint, tolerance: number): Direction | null {
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  if (Math.abs(dx) > tolerance) return dx > 0 ? 'right' : 'left';
  if (Math.abs(dy) > tolerance) return dy > 0 ? 'down' : 'up';
  return null;
}
