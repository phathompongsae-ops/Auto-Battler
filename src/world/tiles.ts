/*
 * Tile indices shared by every map. Placeholder colours only (see
 * graphics/placeholderTextures.ts); real tilesets replace the art, not the ids.
 */
export const Tile = {
  Grass: 0,
  Flowers: 1,
  Path: 2,
  Wall: 3,
  Water: 4,
  /** Town paving. */
  Cobble: 5,
  /** Town building footprint (solid). */
  Roof: 6,
  /** Walkable portal / map exit. */
  Portal: 7,
  /** Field zone grounds (walkable, colour-coded per hunting zone). */
  Dirt: 8,
  Moss: 9,
  DarkGrass: 10,
  /** Field obstacle (solid). */
  Tree: 11,
  /** Dungeon floor / walls / boss room carpet. */
  DungeonFloor: 12,
  DungeonWall: 13,
  Carpet: 14,
} as const;

export type Tile = (typeof Tile)[keyof typeof Tile];

export const TILE_COUNT = 15;

/** Tiles nothing can walk through. */
export const SOLID_TILES: Tile[] = [Tile.Wall, Tile.Water, Tile.Roof, Tile.Tree, Tile.DungeonWall];

/** Tiles that stop projectiles (they fly over water). */
export const PROJECTILE_BLOCKING_TILES: Tile[] = [Tile.Wall, Tile.Roof, Tile.Tree, Tile.DungeonWall];
