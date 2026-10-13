import type { NavPoint } from '../data/navigationData';
import type { Direction } from '../input/Direction';
import { TILE_SIZE } from '../config';

/**
 * Plans waypoints within one map. Replaceable (e.g. by A*) without touching
 * AutoMove or quests: AutoMove only follows the returned points.
 */
export interface PathPlanner {
  /** Waypoints ending at `to`, or null when no path is known. */
  plan(mapId: string, from: NavPoint, to: NavPoint, hints?: readonly NavPoint[]): NavPoint[] | null;
}

/** Grid cell size of the detour search: the map tile. */
const DETOUR_TILE = TILE_SIZE;
/** Upper bound on tiles visited by one detour search (the largest map is well under this). */
const DETOUR_MAX_TILES = 20000;

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
 * with a margin for the player's body; when both are blocked, a tile-grid
 * detour (breadth-first) around it. Hand-placed hint waypoints are chained
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
    // Both L-shapes cross scenery (a building, the plaza fountain, crypt pillars): detour along the tile grid.
    return this.detour(grid, from, to);
  }

  /**
   * Fallback for a leg the L-shapes can't make: a breadth-first search over tiles whose centre fits the player's
   * body margin, returned as the turn points of the tile-centre path (each segment axis-aligned, so steerToward
   * follows it exactly). Same collision as everything else; bounded so a bad target can't stall a frame.
   */
  private detour(grid: CollisionGrid, from: NavPoint, to: NavPoint): NavPoint[] | null {
    const T = DETOUR_TILE;
    const m = this.margin;
    // The body box around the tile centre: corners, edge midpoints and centre (a wall thinner than the box still counts).
    const free = (tx: number, ty: number) => {
      const x = tx * T + T / 2;
      const y = ty * T + T / 2;
      for (const ox of [-m, 0, m]) for (const oy of [-m, 0, m]) if (grid.isBlocked(x + ox, y + oy)) return false;
      return true;
    };
    // The nearest free tile to a point (it may stand at a wall's edge, where its own tile centre doesn't fit).
    const snap = (p: NavPoint): [number, number] | null => {
      const tx = Math.floor(p.x / T);
      const ty = Math.floor(p.y / T);
      let best: [number, number] | null = null;
      let bestD = Infinity;
      for (let dy = -1; dy <= 1; dy++) {
        for (let dx = -1; dx <= 1; dx++) {
          if (!free(tx + dx, ty + dy)) continue;
          const d = Math.hypot((tx + dx) * T + T / 2 - p.x, (ty + dy) * T + T / 2 - p.y);
          if (d < bestD) [best, bestD] = [[tx + dx, ty + dy], d];
        }
      }
      return best;
    };
    const start = snap(from);
    const goal = snap(to);
    if (!start || !goal) return null;
    const key = (tx: number, ty: number) => `${tx},${ty}`;
    const prev = new Map<string, string | null>([[key(...start), null]]);
    const queue: [number, number][] = [start];
    for (let head = 0; head < queue.length && queue.length < DETOUR_MAX_TILES; head++) {
      const [tx, ty] = queue[head];
      if (tx === goal[0] && ty === goal[1]) break;
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) {
        const nx = tx + dx;
        const ny = ty + dy;
        const k = key(nx, ny);
        // The step itself must be clear too (a thin wall can sit between two tile centres).
        if (prev.has(k) || !free(nx, ny) || !this.clear(grid, [{ x: tx * T + T / 2, y: ty * T + T / 2 }, { x: nx * T + T / 2, y: ny * T + T / 2 }])) continue;
        prev.set(k, key(tx, ty));
        queue.push([nx, ny]);
      }
    }
    if (!prev.has(key(...goal))) return null;
    const tiles: [number, number][] = [];
    for (let k: string | null | undefined = key(...goal); k; k = prev.get(k)) tiles.unshift(k.split(',').map(Number) as [number, number]);
    // Keep only the corners (and the first / last tile): straight runs collapse to one segment.
    const centre = ([tx, ty]: [number, number]): NavPoint => ({ x: tx * T + T / 2, y: ty * T + T / 2 });
    const points: NavPoint[] = [centre(tiles[0])];
    for (let i = 1; i < tiles.length - 1; i++) {
      const [a, b, c] = [tiles[i - 1], tiles[i], tiles[i + 1]];
      if (a[0] - b[0] !== b[0] - c[0] || a[1] - b[1] !== b[1] - c[1]) points.push(centre(b));
    }
    if (tiles.length > 1) points.push(centre(tiles[tiles.length - 1]));
    points.push(to);
    return points;
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
