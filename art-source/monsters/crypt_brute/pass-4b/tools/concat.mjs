// Concatenate 176x144 strips horizontally: node concat.mjs out.png a.png b.png ...
import { writeFileSync } from 'node:fs';
import { readAnyPng, encodePng } from './png.mjs';
const [out, ...ins] = process.argv.slice(2), imgs = ins.map(readAnyPng), W = imgs.reduce((n, i) => n + i.width, 0), H = 144, d = new Uint8Array(W * H * 4);
let ox = 0; for (const im of imgs) { for (let y = 0; y < H; y++) d.set(im.data.subarray(y * im.width * 4, (y + 1) * im.width * 4), (y * W + ox) * 4); ox += im.width; }
writeFileSync(out, encodePng(W, H, d)); console.log(out, W, 'x', H, W / 176, 'frames');
