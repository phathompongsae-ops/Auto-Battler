// Production art preparation from reviewed candidates (Visual Production Pass 2):
//   node tools/env-art/prepareArt.mjs <jobs.json> [jobId ...]
// Each job reads one image (usually a high-resolution candidate source), and can:
//   cells     split it into N equal horizontal cells (animation strips); one shared crop keeps feet stable
//   frame     [w, h] output cell size; the shared content box is scaled to fit `fit` (default the frame minus
//             padding) and bottom-centred (`align: "bottom"`) or centred (`"center"`); never squashed
//   tile      resize the whole image to `frame` without cropping (ground tiles)
//   grade     { brightness, contrast, saturation, hue (deg), tint: [r, g, b, amount] } colour grade
//   outline   { px, color: [r, g, b] } dark rim behind the silhouette (readability on bright ground)
//   glowCut   { below } drops faint halo pixels (alpha < below) and firms the rest (icon glow reduction)
// and writes a PNG strip plus metadata (frame size and the content box of cell 0, in output px).
// Runs in headless Chrome (canvas), like the other env-art tools; downscaling halves in steps for quality.
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { Browser } from '../../tests/browser/cdp.mjs';

const [jobsFile, ...only] = process.argv.slice(2);
const jobs = JSON.parse(readFileSync(jobsFile, 'utf8')).filter((j) => !only.length || only.includes(j.id));
const root = process.cwd();

const PAGE = String(async (png, job) => {
  const img = await createImageBitmap(await (await fetch('data:image/png;base64,' + png)).blob());
  const canvas = (w, h) => { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; };
  // Step-halving resize: smoother than one large drawImage reduction.
  const resize = (src, sx, sy, sw, sh, dw, dh) => {
    let cur = canvas(sw, sh); cur.getContext('2d').drawImage(src, sx, sy, sw, sh, 0, 0, sw, sh);
    while (cur.width / 2 >= dw && cur.height / 2 >= dh) {
      const n = canvas(Math.round(cur.width / 2), Math.round(cur.height / 2));
      const g = n.getContext('2d'); g.imageSmoothingQuality = 'high'; g.drawImage(cur, 0, 0, n.width, n.height); cur = n;
    }
    const out = canvas(dw, dh); const g = out.getContext('2d'); g.imageSmoothingQuality = 'high'; g.drawImage(cur, 0, 0, dw, dh);
    return out;
  };
  const cells = job.cells ?? 1;
  const cw = Math.floor(img.width / cells), ch = img.height;
  const [fw, fh] = job.frame;
  const strip = canvas(fw * cells, fh);
  const sg = strip.getContext('2d');
  if (job.tile) {
    sg.drawImage(resize(img, 0, 0, img.width, img.height, fw, fh), 0, 0);
  } else {
    // One crop box shared by every cell keeps the baseline and centre identical between frames.
    const all = canvas(img.width, img.height); const ag = all.getContext('2d'); ag.drawImage(img, 0, 0);
    const d = ag.getImageData(0, 0, img.width, img.height).data;
    let x0 = cw, y0 = ch, x1 = -1, y1 = -1;
    for (let c = 0; c < cells; c++) for (let y = 0; y < ch; y++) for (let x = 0; x < cw; x++) {
      if (d[(y * img.width + c * cw + x) * 4 + 3] > 12) { if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; }
    }
    const bw = x1 - x0 + 1, bh = y1 - y0 + 1;
    const pad = job.pad ?? 2, padBottom = job.padBottom ?? pad;
    const [mw, mh] = job.fit ?? [fw - pad * 2, fh - pad - padBottom];
    const scale = Math.min(mw / bw, mh / bh);
    const dw = Math.max(1, Math.round(bw * scale)), dh = Math.max(1, Math.round(bh * scale));
    const ox = Math.round((fw - dw) / 2);
    const oy = job.align === 'center' ? Math.round((fh - dh) / 2) : fh - padBottom - dh;
    for (let c = 0; c < cells; c++) sg.drawImage(resize(img, c * cw + x0, y0, bw, bh, dw, dh), c * fw + ox, oy);
  }
  const id = sg.getImageData(0, 0, strip.width, strip.height); const p = id.data;
  const gr = job.grade;
  if (gr) {
    const hue = ((gr.hue ?? 0) * Math.PI) / 180, cosH = Math.cos(hue), sinH = Math.sin(hue);
    for (let i = 0; i < p.length; i += 4) {
      if (!p[i + 3]) continue;
      let r = p[i] / 255, g = p[i + 1] / 255, b = p[i + 2] / 255;
      if (hue) { // YIQ hue rotation
        const y = 0.299 * r + 0.587 * g + 0.114 * b, ii = 0.596 * r - 0.274 * g - 0.322 * b, q = 0.211 * r - 0.523 * g + 0.312 * b;
        const i2 = ii * cosH - q * sinH, q2 = ii * sinH + q * cosH;
        r = y + 0.956 * i2 + 0.621 * q2; g = y - 0.272 * i2 - 0.647 * q2; b = y - 1.106 * i2 + 1.703 * q2;
      }
      const l = 0.299 * r + 0.587 * g + 0.114 * b, s = gr.saturation ?? 1;
      r = l + (r - l) * s; g = l + (g - l) * s; b = l + (b - l) * s;
      const k = gr.contrast ?? 1, br = gr.brightness ?? 1;
      r = ((r - 0.5) * k + 0.5) * br; g = ((g - 0.5) * k + 0.5) * br; b = ((b - 0.5) * k + 0.5) * br;
      if (gr.tint) { const [tr, tg, tb, a] = gr.tint; r += (tr / 255 - r) * a; g += (tg / 255 - g) * a; b += (tb / 255 - b) * a; }
      p[i] = Math.max(0, Math.min(255, r * 255)); p[i + 1] = Math.max(0, Math.min(255, g * 255)); p[i + 2] = Math.max(0, Math.min(255, b * 255));
    }
  }
  if (job.glowCut) {
    const below = job.glowCut.below;
    for (let i = 3; i < p.length; i += 4) p[i] = p[i] < below ? 0 : Math.min(255, Math.round(((p[i] - below) / (255 - below)) * 255));
  }
  sg.putImageData(id, 0, 0);
  if (job.outline) {
    // Dilate the alpha by `px` (per cell, never across cells) and draw the rim behind the art.
    const { px, color } = job.outline, W = strip.width, H = strip.height;
    const rim = canvas(W, H), rg = rim.getContext('2d'), rd = rg.createImageData(W, H);
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      let a = 0; const cell = Math.floor(x / fw);
      for (let dy = -px; dy <= px && a < 255; dy++) for (let dx = -px; dx <= px; dx++) {
        const nx = x + dx, ny = y + dy;
        if (dx * dx + dy * dy > px * px + px || nx < cell * fw || nx >= (cell + 1) * fw || ny < 0 || ny >= H) continue;
        a = Math.max(a, p[(ny * W + nx) * 4 + 3]);
      }
      const o = (y * W + x) * 4; rd.data[o] = color[0]; rd.data[o + 1] = color[1]; rd.data[o + 2] = color[2]; rd.data[o + 3] = a;
    }
    rg.putImageData(rd, 0, 0); rg.drawImage(strip, 0, 0);
    sg.clearRect(0, 0, W, H); sg.drawImage(rim, 0, 0);
  }
  // Content box of cell 0 in output px (feet row = y1).
  const out = sg.getImageData(0, 0, fw, fh).data;
  let x0 = fw, y0 = fh, x1 = -1, y1 = -1;
  for (let y = 0; y < fh; y++) for (let x = 0; x < fw; x++) if (out[(y * fw + x) * 4 + 3] > 24) { if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; }
  return { size: [strip.width, strip.height], frame: [fw, fh], content: [x0, y0, x1, y1], png: strip.toDataURL('image/png') };
});

const b = await Browser.launch({ port: 9344 });
try {
  await b.goto('about:blank');
  for (const job of jobs) {
    const png = readFileSync(resolve(root, job.src)).toString('base64');
    const r = await b.eval(`(${PAGE})(${JSON.stringify(png)}, ${JSON.stringify(job)})`);
    mkdirSync(dirname(resolve(root, job.out)), { recursive: true });
    writeFileSync(resolve(root, job.out), Buffer.from(r.png.split(',')[1], 'base64'));
    console.log(JSON.stringify({ id: job.id, out: job.out, size: r.size, frame: r.frame, content: r.content }));
  }
} finally {
  await b.close();
}
