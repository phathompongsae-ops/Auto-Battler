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
