// Packs square ground tiles into one atlas row with 2 px extruded borders (margin 2, spacing 4), the same
// layout as the Town ground atlas, so linear filtering never bleeds between frames:
//   node tools/env-art/buildTileAtlas.mjs <out.png> <size> <tile.png>[:flipX][:flipY] ...
// Frames are written in argument order (frame 0 first); `:flipX` / `:flipY` add mirrored variants of a tile.
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { Browser } from '../../tests/browser/cdp.mjs';

const [out, sizeArg, ...specs] = process.argv.slice(2);
const size = Number(sizeArg);
const tiles = specs.map((spec) => {
  const [file, ...flags] = spec.split(':');
  return { png: readFileSync(resolve(file)).toString('base64'), flipX: flags.includes('flipX'), flipY: flags.includes('flipY') };
});

const b = await Browser.launch({ port: 9345 });
try {
  await b.goto('about:blank');
  const png = await b.eval(`(async () => {
    const T = ${size}, M = 2, S = 4, tiles = ${JSON.stringify(tiles)};
    const atlas = document.createElement('canvas');
    atlas.width = M * 2 + tiles.length * T + (tiles.length - 1) * S; atlas.height = M * 2 + T;
    const g = atlas.getContext('2d');
    for (const [i, t] of tiles.entries()) {
      const img = await createImageBitmap(await (await fetch('data:image/png;base64,' + t.png)).blob());
      const cell = document.createElement('canvas'); cell.width = cell.height = T;
      const cg = cell.getContext('2d');
      cg.translate(t.flipX ? T : 0, t.flipY ? T : 0); cg.scale(t.flipX ? -1 : 1, t.flipY ? -1 : 1);
      cg.drawImage(img, 0, 0, T, T);
      const x = M + i * (T + S), y = M;
      g.drawImage(cell, x, y);
      // Extrude: repeat the outermost rows / columns into the 2 px border.
      for (let k = 1; k <= M; k++) {
        g.drawImage(cell, 0, 0, T, 1, x, y - k, T, 1); g.drawImage(cell, 0, T - 1, T, 1, x, y + T - 1 + k, T, 1);
        g.drawImage(cell, 0, 0, 1, T, x - k, y, 1, T); g.drawImage(cell, T - 1, 0, 1, T, x + T - 1 + k, y, 1, T);
      }
      for (const [sx, sy, dx, dy] of [[0, 0, -M, -M], [T - 1, 0, T, -M], [0, T - 1, -M, T], [T - 1, T - 1, T, T]])
        g.drawImage(cell, sx, sy, 1, 1, x + dx, y + dy, M, M);
    }
    return atlas.toDataURL('image/png');
  })()`);
  mkdirSync(dirname(resolve(out)), { recursive: true });
  writeFileSync(resolve(out), Buffer.from(png.split(',')[1], 'base64'));
  console.log(JSON.stringify({ out, frames: tiles.length, size }));
} finally {
  await b.close();
}
