export const Tile = {
  Grass: 0,
  Flowers: 1,
  Path: 2,
  Wall: 3,
  Water: 4,
} as const;

export type Tile = (typeof Tile)[keyof typeof Tile];

export const TILE_COUNT = 5;

/** Tiles the player cannot walk through. */
export const SOLID_TILES: Tile[] = [Tile.Wall, Tile.Water];

export const TEST_MAP_WIDTH = 40;
export const TEST_MAP_HEIGHT = 30;

/** Deterministic pseudo-random value in [0, 1) for a tile coordinate. */
function hash(x: number, y: number): number {
  const n = Math.sin(x * 127.1 + y * 311.7) * 43758.5453;
  return n - Math.floor(n);
}

/**
 * A small hand-shaped test field: stone wall around the edge, a crossroads,
 * a pond, and scattered flowers. Returned as rows of tile indices.
 */
export function buildTestMap(): number[][] {
  const w = TEST_MAP_WIDTH;
  const h = TEST_MAP_HEIGHT;
  const midX = Math.floor(w / 2);
  const midY = Math.floor(h / 2);

  const rows: number[][] = [];
  for (let y = 0; y < h; y++) {
    const row: number[] = [];
    for (let x = 0; x < w; x++) {
      let tile: Tile = hash(x, y) < 0.08 ? Tile.Flowers : Tile.Grass;

      if (Math.abs(x - midX) <= 1 || Math.abs(y - midY) <= 1) tile = Tile.Path;

      // Oval pond in the north-east quarter.
      const px = (x - 30) / 4.5;
      const py = (y - 7) / 3;
      if (px * px + py * py <= 1) tile = Tile.Water;

      if (x === 0 || y === 0 || x === w - 1 || y === h - 1) tile = Tile.Wall;

      row.push(tile);
    }
    rows.push(row);
  }
  return rows;
}
