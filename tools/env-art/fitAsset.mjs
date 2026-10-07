// Fit a generated environment image (e.g. a PixelLab result) onto its 2x target canvas:
// trims the transparent margin, scales the content to fit the target (never wider than the
// footprint-based canvas), and anchors it bottom-centre so its base sits on the footprint edge.
//   node tools/env-art/fitAsset.mjs <source url or file> <out.png> <width> <height> [--fill-width] [--pad-bottom N] [--largest] [--fill-holes]
// --fill-width: scale the content to the full target width (buildings covering their footprint).
// --pad-bottom: leave N transparent px under the content (baked shadow room).
// --largest: keep only the largest connected opaque blob (drops stray specks a generation left on the canvas).
// --fill-holes: make transparent pixels enclosed by the silhouette opaque again (background removal that
//   knocked out light highlights inside the art), coloured from their opaque neighbours.
import { readFileSync, writeFileSync } from 'node:fs';
import { Browser } from '../../tests/browser/cdp.mjs';

const [src, out, w, h, ...flags] = process.argv.slice(2);
const width = Number(w);
const height = Number(h);
const fillWidth = flags.includes('--fill-width');
const padIndex = flags.indexOf('--pad-bottom');
const padBottom = padIndex >= 0 ? Number(flags[padIndex + 1]) : 0;
const largest = flags.includes('--largest');
const fillHoles = flags.includes('--fill-holes');

const dataUrl = /^https?:/.test(src) ? null : `data:image/png;base64,${readFileSync(src).toString('base64')}`;
const imageUrl = dataUrl ?? src;

const b = await Browser.launch({ port: 9338 });
try {
  await b.goto('about:blank');
  const result = await b.eval(`(async () => {
    const res = await fetch(${JSON.stringify(imageUrl)});
    const blob = await res.blob();
    const img = await createImageBitmap(blob);
    const c = document.createElement('canvas'); c.width = img.width; c.height = img.height;
    const g = c.getContext('2d'); g.drawImage(img, 0, 0);
    const id = g.getImageData(0, 0, img.width, img.height);
    const { data } = id;
    if (${largest}) {
      const W = img.width, H = img.height, label = new Int32Array(W * H).fill(-1);
      let best = -1, bestSize = 0, n = 0;
      for (let i = 0; i < W * H; i++) {
        if (label[i] >= 0 || data[i * 4 + 3] <= 8) continue;
        const stack = [i]; label[i] = n; let size = 0;
        while (stack.length) {
          const j = stack.pop(); size++;
          const x = j % W, y = (j / W) | 0;
          for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
            const nx = x + dx, ny = y + dy, k = ny * W + nx;
            if (nx >= 0 && ny >= 0 && nx < W && ny < H && label[k] < 0 && data[k * 4 + 3] > 8) { label[k] = n; stack.push(k); }
          }
        }
        if (size > bestSize) { bestSize = size; best = n; }
        n++;
      }
      for (let i = 0; i < W * H; i++) if (label[i] !== best) data[i * 4 + 3] = 0;
      g.putImageData(id, 0, 0);
    }
    if (${fillHoles}) {
      const W = img.width, H = img.height, outside = new Uint8Array(W * H), stack = [];
      const solid = (i) => data[i * 4 + 3] > 8;
      for (let x = 0; x < W; x++) { stack.push(x, (H - 1) * W + x); }
      for (let y = 0; y < H; y++) { stack.push(y * W, y * W + W - 1); }
      while (stack.length) {
        const i = stack.pop();
        if (outside[i] || solid(i)) continue;
        outside[i] = 1;
        const x = i % W, y = (i / W) | 0;
        if (x > 0) stack.push(i - 1); if (x < W - 1) stack.push(i + 1); if (y > 0) stack.push(i - W); if (y < H - 1) stack.push(i + W);
      }
      let holes = [];
      for (let i = 0; i < W * H; i++) if (!outside[i] && !solid(i)) holes.push(i);
      // Grow inward from opaque neighbours until every hole has a colour.
      while (holes.length) {
        const next = [], fills = [];
        for (const i of holes) {
          const x = i % W, y = (i / W) | 0; let r = 0, gg = 0, b = 0, n = 0;
          for (const j of [x > 0 ? i - 1 : -1, x < W - 1 ? i + 1 : -1, y > 0 ? i - W : -1, y < H - 1 ? i + W : -1]) {
            if (j >= 0 && solid(j)) { r += data[j * 4]; gg += data[j * 4 + 1]; b += data[j * 4 + 2]; n++; }
          }
          if (n) fills.push([i, r / n, gg / n, b / n]); else next.push(i);
        }
        if (!fills.length) break;
        for (const [i, r, gg, b] of fills) { data[i * 4] = r; data[i * 4 + 1] = gg; data[i * 4 + 2] = b; data[i * 4 + 3] = 255; }
        holes = next;
      }
      g.putImageData(id, 0, 0);
    }
    let x0 = img.width, y0 = img.height, x1 = -1, y1 = -1;
    for (let y = 0; y < img.height; y++) for (let x = 0; x < img.width; x++) {
      if (data[(y * img.width + x) * 4 + 3] > 8) { if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; }
    }
    const cw = x1 - x0 + 1, ch = y1 - y0 + 1;
    const availH = ${height} - ${padBottom};
    const scale = ${fillWidth} ? Math.min(${width} / cw, availH / ch) : Math.min(1, ${width} / cw, availH / ch) || 1;
    const dw = Math.round(cw * scale), dh = Math.round(ch * scale);
    const o = document.createElement('canvas'); o.width = ${width}; o.height = ${height};
    const og = o.getContext('2d'); og.imageSmoothingQuality = 'high';
    og.drawImage(c, x0, y0, cw, ch, Math.round((${width} - dw) / 2), availH - dh, dw, dh);
    return { source: [img.width, img.height], content: [cw, ch], scale, placed: [dw, dh], png: o.toDataURL('image/png') };
  })()`);
  writeFileSync(out, Buffer.from(result.png.split(',')[1], 'base64'));
  console.log(JSON.stringify({ out, source: result.source, content: result.content, scale: Number(result.scale.toFixed(3)), placed: result.placed }));
} finally {
  await b.close();
}
