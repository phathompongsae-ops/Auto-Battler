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
// on top by their own layer.

export type WangTerrain = 'cobble' | 'dirt' | 'grass';

const WANG_TERRAIN: Partial<Record<number, WangTerrain>> = {
  [Tile.Grass]: 'grass',
  [Tile.Flowers]: 'grass',
  [Tile.Path]: 'dirt',
  [Tile.Cobble]: 'cobble',
  // The plaza sits on cobble; its own layer draws it on top.
  [Tile.Plaza]: 'cobble',
  [Tile.PlazaTrim]: 'cobble',
};

export const wangTerrain = (tile: number | undefined): WangTerrain | null => (tile === undefined ? null : (WANG_TERRAIN[tile] ?? null));

/** Tie-break order when terrains are equally common. */
const TERRAIN_ORDER: readonly WangTerrain[] = ['cobble', 'dirt', 'grass'];

/** Frame per corner mask (bit 8 NW, 4 NE, 2 SW, 1 SE; set = upper) for each "lower|upper" pair. */
export type WangLookup = Readonly<Record<string, readonly number[]>>;

/**
 * The dual-grid frame grid ((H+1) x (W+1)); -1 where nothing is drawn.
 * A tile mixing three terrains folds its rarest one into the majority.
 */
export function wangGroundVisuals(tiles: readonly (readonly number[])[], lookup: WangLookup): number[][] {
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
      const resolved = corners.map((c) => (c && keep.has(c) ? c : majority));
      row.push(wangFrame(resolved, lookup, pairs, vx, vy));
    }
    out.push(row);
  }
  return out;
}

function wangFrame(corners: WangTerrain[], lookup: WangLookup, pairs: [WangTerrain, WangTerrain][], vx: number, vy: number): number {
  const distinct = [...new Set(corners)];
  if (distinct.length === 1) {
    // A plain tile: any tileset containing the terrain has one; alternate between them for variety.
    const t = distinct[0];
    const options = pairs.filter(([lower, upper]) => lower === t || upper === t);
    if (!options.length) return -1;
    const [lower, upper] = options[Math.floor(tileHash(vx, vy) * options.length)];
    return lookup[`${lower}|${upper}`][t === upper ? 15 : 0] ?? -1;
  }
  const pair = pairs.find(([lower, upper]) => distinct.includes(lower) && distinct.includes(upper));
  if (!pair) return -1;
  const [, upper] = pair;
  const mask = (corners[0] === upper ? 8 : 0) | (corners[1] === upper ? 4 : 0) | (corners[2] === upper ? 2 : 0) | (corners[3] === upper ? 1 : 0);
  return lookup[`${pair[0]}|${upper}`][mask] ?? -1;
}

/** Cells drawn on top of the corner ground: the plaza (stand-in frames) and every non-ground tile (its own tile art). */
export function wangOverlayCells(tiles: readonly (readonly number[])[]): { plaza: number[][]; solid: number[][] } {
  const plaza: number[][] = [];
  const solid: number[][] = [];
  tiles.forEach((row, y) => {
    plaza.push([]);
    solid.push([]);
    row.forEach((tile, x) => {
      const isPlaza = tile === Tile.Plaza || tile === Tile.PlazaTrim;
      const f = tile === Tile.Plaza ? GROUND_FRAMES.plaza : GROUND_FRAMES.trim;
      plaza[y].push(isPlaza ? f.first + Math.floor(tileHash(x, y) * f.count) : -1);
      solid[y].push(wangTerrain(tile) ? -1 : tile);
    });
  });
  return { plaza, solid };
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
