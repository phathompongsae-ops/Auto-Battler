import { GROUND_FRAMES } from '../data/environmentArt';
import { tileHash } from './layout';
import { Tile } from './tiles';

/*
 * The visual ground layer, derived at render time from a map's tile indices
 * (which stay the only source of collision, navigation and rules). Engine-
 * free: WorldScene turns these frame grids into visual-only tilemap layers.
 *
 * Per cell: a base frame (a deterministic variant of its terrain family) and
 * transition overlays where a neighbouring terrain spills over the edge:
 * grass fringes onto roads / stone, dirt fringes onto stone. Tiles without a
 * visual family (walls, water, building bases, portals...) get -1 and keep
 * the code-drawn tile underneath.
 */

export type GroundFamily = 'grass' | 'cobble' | 'dirt' | 'plaza' | 'trim';

const FAMILY: Partial<Record<number, GroundFamily>> = {
  [Tile.Grass]: 'grass',
  [Tile.Flowers]: 'grass',
  [Tile.Cobble]: 'cobble',
  [Tile.Path]: 'dirt',
  [Tile.Plaza]: 'plaza',
  [Tile.PlazaTrim]: 'trim',
};

export const groundFamily = (tile: number | undefined): GroundFamily | null => (tile === undefined ? null : (FAMILY[tile] ?? null));

/** Families a grass / dirt fringe may spill onto. */
const GRASS_SPILLS_ONTO = new Set<GroundFamily>(['dirt', 'cobble', 'plaza', 'trim']);
const DIRT_SPILLS_ONTO = new Set<GroundFamily>(['cobble', 'plaza', 'trim']);

/** Neighbour bits: 1 = north, 2 = east, 4 = south, 8 = west. */
export function neighbourMask(tiles: readonly (readonly number[])[], x: number, y: number, family: GroundFamily): number {
  const is = (tx: number, ty: number) => groundFamily(tiles[ty]?.[tx]) === family;
  return (is(x, y - 1) ? 1 : 0) | (is(x + 1, y) ? 2 : 0) | (is(x, y + 1) ? 4 : 0) | (is(x - 1, y) ? 8 : 0);
}

// --------------------------------------------------------------------------
// Corner (Wang) ground on a dual grid — production tilesets (PixelLab).
//
// The visual grid is offset by half a tile: visual tile (vx, vy) sits on the
// vertex shared by cells (vx-1..vx, vy-1..vy), and its NW / NE / SW / SE
// corners take those four cells' terrains. A tileset per terrain pair
// ("lower|upper") gives the frame for every corner mask. Cells without a
// ground terrain (walls, water, building bases, portals) borrow the majority
// terrain of the tile so no transition is drawn toward them; they are drawn
// on top by their own layer. Plain tiles (all four corners one terrain) pick a
// deterministic variant by position so large areas do not stamp one tile.

export type WangTerrain = 'cobble' | 'dirt' | 'grass' | 'plaza' | 'darkgrass' | 'moss' | 'water';

const WANG_TERRAIN: Partial<Record<number, WangTerrain>> = {
  [Tile.Grass]: 'grass',
  [Tile.Flowers]: 'grass',
  [Tile.Path]: 'dirt',
  [Tile.Dirt]: 'dirt',
  // Field-only terrains (Visual Pass 3): grass-family zones and the pond. Water stays solid in map.tiles.
  [Tile.DarkGrass]: 'darkgrass',
  [Tile.Moss]: 'moss',
  [Tile.Water]: 'water',
  [Tile.Cobble]: 'cobble',
  // The trim ring belongs to the plaza; the plaza / cobble transition draws its kerb border.
  [Tile.Plaza]: 'plaza',
  [Tile.PlazaTrim]: 'plaza',
};

export const wangTerrain = (tile: number | undefined): WangTerrain | null => (tile === undefined ? null : (WANG_TERRAIN[tile] ?? null));

/** Tie-break order when terrains are equally common. */
const TERRAIN_ORDER: readonly WangTerrain[] = ['cobble', 'dirt', 'grass', 'plaza', 'darkgrass', 'moss', 'water'];

/** Town default: the terrain every other Town terrain has a tileset with; bridges two terrains without a shared tileset. */
const DEFAULT_CONNECTOR: WangTerrain = 'cobble';

/** Frame per corner mask (bit 8 NW, 4 NE, 2 SW, 1 SE; set = upper) for each "lower|upper" pair. */
export type WangLookup = Readonly<Record<string, readonly number[]>>;

/** Plain-tile variant frames per terrain (optional; default: the pair tilesets' plain tiles). */
export type WangPlain = Readonly<Partial<Record<WangTerrain, readonly number[]>>>;

/**
 * The dual-grid frame grid ((H+1) x (W+1)); -1 where nothing is drawn.
 * A tile mixing three terrains folds its rarest one into the majority.
 */
export function wangGroundVisuals(tiles: readonly (readonly number[])[], lookup: WangLookup, plain: WangPlain = {}, connector: WangTerrain = DEFAULT_CONNECTOR): number[][] {
  const h = tiles.length;
  const w = tiles[0]?.length ?? 0;
  const pairs = Object.keys(lookup).map((k) => k.split('|') as [WangTerrain, WangTerrain]);
  const out: number[][] = [];
  for (let vy = 0; vy <= h; vy++) {
    const row: number[] = [];
    for (let vx = 0; vx <= w; vx++) {
      const corners = [wangTerrain(tiles[vy - 1]?.[vx - 1]), wangTerrain(tiles[vy - 1]?.[vx]), wangTerrain(tiles[vy]?.[vx - 1]), wangTerrain(tiles[vy]?.[vx])];
      const counts = new Map<WangTerrain, number>();
      for (const c of corners) if (c) counts.set(c, (counts.get(c) ?? 0) + 1);
      if (!counts.size) {
        row.push(-1);
        continue;
      }
      const ranked = [...counts.keys()].sort((a, b) => counts.get(b)! - counts.get(a)! || TERRAIN_ORDER.indexOf(a) - TERRAIN_ORDER.indexOf(b));
      const majority = ranked[0];
      const keep = new Set(ranked.slice(0, 2));
      let resolved = corners.map((c) => (c && keep.has(c) ? c : majority));
      // Two terrains without a tileset of their own: the minority becomes the connector.
      const two = [...new Set(resolved)];
      if (two.length === 2 && !pairs.some(([l, u]) => two.includes(l) && two.includes(u))) {
        const minority = two[0] === majority ? two[1] : two[0];
        const into = two.includes(connector) ? majority : connector;
        resolved = resolved.map((c) => (c === minority ? into : c));
      }
      row.push(wangFrame(resolved, lookup, pairs, plain, vx, vy));
    }
    out.push(row);
  }
  return out;
}

function wangFrame(corners: WangTerrain[], lookup: WangLookup, pairs: [WangTerrain, WangTerrain][], plain: WangPlain, vx: number, vy: number): number {
  const distinct = [...new Set(corners)];
  if (distinct.length === 1) {
    // A plain tile: a listed variant, else any tileset containing the terrain has one.
    const t = distinct[0];
    const variants = plain[t]?.length
      ? plain[t]!
      : pairs.filter(([lower, upper]) => lower === t || upper === t).map(([lower, upper]) => lookup[`${lower}|${upper}`][t === upper ? 15 : 0]);
    if (!variants.length) return -1;
    return variants[Math.floor(tileHash(vx, vy) * variants.length)] ?? -1;
  }
  const pair = pairs.find(([lower, upper]) => distinct.includes(lower) && distinct.includes(upper));
  if (!pair) return -1;
  const [, upper] = pair;
  const mask = (corners[0] === upper ? 8 : 0) | (corners[1] === upper ? 4 : 0) | (corners[2] === upper ? 2 : 0) | (corners[3] === upper ? 1 : 0);
  return lookup[`${pair[0]}|${upper}`][mask] ?? -1;
}

/**
 * Cells drawn on top of the corner ground: every non-ground tile in its own
 * tile art (-1 elsewhere). With production wall art, Wall cells are left to
 * wallCells instead.
 */
export function wangOverlayCells(tiles: readonly (readonly number[])[], wallArt = false): number[][] {
  return tiles.map((row) => row.map((tile) => (wangTerrain(tile) || (wallArt && tile === Tile.Wall) ? -1 : tile)));
}

/** Wall-top frame per Wall cell (a deterministic variant by position), -1 elsewhere. */
export function wallCells(tiles: readonly (readonly number[])[], frames: readonly number[]): number[][] {
  return tiles.map((row, y) => row.map((tile, x) => (tile === Tile.Wall && frames.length ? frames[Math.floor(tileHash(x, y) * frames.length)] : -1)));
}

export interface GroundVisualLayers {
  /** Base frame per cell (-1 = no visual tile: the code-drawn tile shows). */
  base: number[][];
  /** Dirt transition overlay frame per cell (-1 = none). */
  dirtFringe: number[][];
  /** Grass transition overlay frame per cell (-1 = none). */
  grassFringe: number[][];
}

export function groundVisuals(tiles: readonly (readonly number[])[]): GroundVisualLayers {
  const base: number[][] = [];
  const dirtFringe: number[][] = [];
  const grassFringe: number[][] = [];
  tiles.forEach((row, y) => {
    base.push([]);
    dirtFringe.push([]);
    grassFringe.push([]);
    row.forEach((tile, x) => {
      const family = groundFamily(tile);
      if (!family) {
        base[y].push(-1);
        dirtFringe[y].push(-1);
        grassFringe[y].push(-1);
        return;
      }
      const f = GROUND_FRAMES[family];
      base[y].push(f.first + Math.floor(tileHash(x, y) * f.count));
      const dirtMask = DIRT_SPILLS_ONTO.has(family) ? neighbourMask(tiles, x, y, 'dirt') : 0;
      dirtFringe[y].push(dirtMask ? GROUND_FRAMES.dirtFringe.first + dirtMask - 1 : -1);
      const grassMask = GRASS_SPILLS_ONTO.has(family) ? neighbourMask(tiles, x, y, 'grass') : 0;
      grassFringe[y].push(grassMask ? GROUND_FRAMES.grassFringe.first + grassMask - 1 : -1);
    });
  });
  return { base, dirtFringe, grassFringe };
}
