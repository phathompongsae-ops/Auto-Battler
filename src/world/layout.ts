import type { Tile } from './tiles';

/** Small helper for hand-shaping a map's tile rows in data files. Coordinates are tiles. */
export class TileGrid {
  readonly rows: Tile[][];

  constructor(
    readonly width: number,
    readonly height: number,
    fill: Tile,
  ) {
    this.rows = Array.from({ length: height }, () => Array.from({ length: width }, () => fill));
  }

  set(x: number, y: number, tile: Tile): this {
    if (x >= 0 && y >= 0 && x < this.width && y < this.height) this.rows[y][x] = tile;
    return this;
  }

  /** Fill a w×h rectangle whose top-left tile is (x, y). */
  rect(x: number, y: number, w: number, h: number, tile: Tile): this {
    for (let ty = y; ty < y + h; ty++) for (let tx = x; tx < x + w; tx++) this.set(tx, ty, tile);
    return this;
  }

  /** The outermost ring of tiles. */
  border(tile: Tile): this {
    this.rect(0, 0, this.width, 1, tile).rect(0, this.height - 1, this.width, 1, tile);
    return this.rect(0, 0, 1, this.height, tile).rect(this.width - 1, 0, 1, this.height, tile);
  }

  /** Tiles inside an axis-aligned ellipse centred on (cx, cy). */
  ellipse(cx: number, cy: number, rx: number, ry: number, tile: Tile): this {
    for (let y = 0; y < this.height; y++) {
      for (let x = 0; x < this.width; x++) {
        const px = (x - cx) / rx;
        const py = (y - cy) / ry;
        if (px * px + py * py <= 1) this.set(x, y, tile);
      }
    }
    return this;
  }

  /** Replace tiles matching `predicate` (e.g. scatter decoration). */
  each(apply: (x: number, y: number, tile: Tile) => Tile | undefined): this {
    for (let y = 0; y < this.height; y++) for (let x = 0; x < this.width; x++) this.rows[y][x] = apply(x, y, this.rows[y][x]) ?? this.rows[y][x];
    return this;
  }

  build(): Tile[][] {
    return this.rows.map((r) => [...r]);
  }
}

/** Deterministic pseudo-random value in [0, 1) for a tile coordinate. */
export function tileHash(x: number, y: number): number {
  const n = Math.sin(x * 127.1 + y * 311.7) * 43758.5453;
  return n - Math.floor(n);
}
