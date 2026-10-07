// Cut one 64 px tile out of a sheet (e.g. a PixelLab tileset whose plain tile interior was inpainted
// to make a seamless variant) for tools/env-art/buildGroundAtlas.mjs:
//   node tools/env-art/sliceTile.mjs <sheet file|url> <out.png> <x> <y> [size=64]
import { readFileSync, writeFileSync } from 'node:fs';
import { Browser } from '../../tests/browser/cdp.mjs';

const [src, out, x, y, size = '64'] = process.argv.slice(2);
const url = /^https?:/.test(src) ? src : `data:image/png;base64,${readFileSync(src).toString('base64')}`;
const b = await Browser.launch({ port: 9344 });
try {
  await b.goto('about:blank');
  const png = await b.eval(`(async () => {
    const img = await createImageBitmap(await (await fetch(${JSON.stringify(url)})).blob());
    const c = document.createElement('canvas'); c.width = ${Number(size)}; c.height = ${Number(size)};
    c.getContext('2d').drawImage(img, ${Number(x)}, ${Number(y)}, ${Number(size)}, ${Number(size)}, 0, 0, ${Number(size)}, ${Number(size)});
    return c.toDataURL('image/png');
  })()`);
  writeFileSync(out, Buffer.from(png.split(',')[1], 'base64'));
  console.log(out);
} finally {
  await b.close();
}
