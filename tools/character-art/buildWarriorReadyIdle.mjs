// Builds the Warrior's battle-ready idle strips from the approved idle frames, with no new generation:
//   node tools/character-art/buildWarriorReadyIdle.mjs
// The relaxed idle holds the sword hanging point-down by the leg. The ready stance raises it: the blade is cut out of
// the approved frame (colour + distance-to-blade-axis mask), rotated about the crossguard so it points up and out,
// and drawn back over the arm; the guard stays in the hand and is redrawn on top. What the blade used to cover is
// restored from the figure's mirrored side (South) or cleared to background (East). The back view (North) shows the
// raised blade peeking past the shoulder (drawn under the body). Knees settle ~2 px (thighs compressed, feet rows
// untouched) for a slightly crouched, engaged stance. Frames 1-3 tilt the blade by a degree or two: the weapon's
// secondary motion under the runtime breath (data/idleMotion). Cell size, feet rows and body scale are unchanged.
// Writes public/assets/characters/warrior/anims/warrior_idle_ready_{south,east,north}.png (4 x 192 px frames each).
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Browser } from '../../tests/browser/cdp.mjs';

const root = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const ANIMS = join(root, 'public/assets/characters/warrior/anims');
const png = (name) => readFileSync(join(ANIMS, name)).toString('base64');

/*
 * Per facing (source px of the 192 px cell, measured on frame 0 of the approved strip):
 * - blade: the segment from its root (under the guard) to its tip, and the half-width of the mask around it;
 * - region: the box the blade lies in (the mask never leaves it);
 * - guard: the crossguard box (kept in place and redrawn over the raised blade);
 * - pivot / angle: the rotation (degrees, screen space: positive turns clockwise) that raises the blade;
 * - fill: how pixels the blade used to cover are restored;
 * - feet: the strip's feet row (the stance settle never moves rows at or below `feet - 12`).
 */
const SPECS = {
  south: {
    file: 'warrior_idle_south.png', out: 'warrior_idle_ready_south.png', feet: 153,
    // Left of the boot (x < 71, y > 147) the band is background except the blade tip and its outline.
    blade: { from: [72, 128], to: [66, 160], half: 6.5, anyOpaqueBox: [58, 147, 70, 161] }, region: [58, 126, 82, 161], guard: [64, 120, 85, 128],
    // Hanging down (~100°) -> up and out to the figure's right, ~35° off vertical.
    pivot: [74.5, 124.5], angle: 135, tiltSign: -1, fill: { mirrorAxis: 193 }, under: false,
  },
  east: {
    file: 'warrior_idle_east.png', out: 'warrior_idle_ready_east.png', feet: 157,
    // Beyond x 107 the band holds nothing but the blade (and its dark outline): every opaque pixel there is blade.
    blade: { from: [105, 131], to: [141, 154], half: 7, anyOpaqueFromX: 107 }, region: [103, 124, 152, 161], guard: [99, 123, 108, 138],
    // Forward and down (~33° below horizontal) -> forward and up (~30° above).
    pivot: [103, 131], angle: -63, tiltSign: 1, fill: { clearFromX: 107 }, under: false,
  },
  north: {
    // The back view hides the sword; the South blade, raised on the figure's right (viewer's right from behind,
    // ~30° off vertical), is drawn under the body so only the part past the shoulder shows.
    file: 'warrior_idle_v2_north.png', out: 'warrior_idle_ready_north.png', feet: 156,
    borrow: 'south', place: [124, 122], angle: -159, tiltSign: 1, under: true,
  },
};
/** Blade tilt per frame (degrees, added to the spec angle): rest, lift, peak, return. */
const FRAME_TILT = [0, -1.5, -3, -1.5];
/** Knee settle (source px) and the band it is spread over (rows above the feet row). */
const SETTLE = { px: 2, from: 12, to: 34 };

const b = await Browser.launch({ port: 9348 });
try {
  await b.goto('about:blank');
  const sources = Object.fromEntries(Object.entries(SPECS).map(([k, s]) => [k, png(s.file)]));
  const out = await b.eval(`(async () => {
    const SPECS = ${JSON.stringify(SPECS)}, SRC = ${JSON.stringify(sources)}, TILT = ${JSON.stringify(FRAME_TILT)}, SETTLE = ${JSON.stringify(SETTLE)};
    const N = 192;
    const load = async (b64) => {
      const img = await createImageBitmap(await (await fetch('data:image/png;base64,' + b64)).blob());
      const c = new OffscreenCanvas(N, N), g = c.getContext('2d'); g.drawImage(img, 0, 0, N, N, 0, 0, N, N);
      return g.getImageData(0, 0, N, N);
    };
    const at = (d, x, y) => (y * N + x) * 4;
    const inBox = (x, y, [x0, y0, x1, y1]) => x >= x0 && x <= x1 && y >= y0 && y <= y1;
    const segDist = (x, y, [ax, ay], [bx, by]) => {
      const vx = bx - ax, vy = by - ay, t = Math.max(0, Math.min(1, ((x - ax) * vx + (y - ay) * vy) / (vx * vx + vy * vy)));
      return Math.hypot(x - (ax + t * vx), y - (ay + t * vy));
    };
    // Steel and its dark outline lean blue; the cape (red / purple), boots (brown) and gold do not.
    const steel = (d, o) => d.data[o + 3] > 0 && d.data[o + 2] >= d.data[o] - 4 && d.data[o + 2] >= d.data[o + 1] - 12;
    const bladeMask = (d, s) => {
      const m = new Uint8Array(N * N);
      for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
        const o = at(d, x, y);
        if (inBox(x, y, s.region) && !inBox(x, y, s.guard) && segDist(x, y, s.blade.from, s.blade.to) <= s.blade.half &&
          (steel(d, o) || (s.blade.anyOpaqueBox && inBox(x, y, s.blade.anyOpaqueBox) && d.data[o + 3] > 0) || (s.blade.anyOpaqueFromX !== undefined && x >= s.blade.anyOpaqueFromX && d.data[o + 3] > 0))) m[y * N + x] = 1;
      }
      return m;
    };
    // Premultiplied bilinear sample of the masked sprite.
    const sample = (d, m, fx, fy, acc) => {
      acc[0] = acc[1] = acc[2] = acc[3] = 0;
      const x0 = Math.floor(fx), y0 = Math.floor(fy), tx = fx - x0, ty = fy - y0;
      for (const [dx, dy, w] of [[0, 0, (1 - tx) * (1 - ty)], [1, 0, tx * (1 - ty)], [0, 1, (1 - tx) * ty], [1, 1, tx * ty]]) {
        const x = x0 + dx, y = y0 + dy;
        if (w === 0 || x < 0 || y < 0 || x >= N || y >= N || !m[y * N + x]) continue;
        const o = at(d, x, y), a = d.data[o + 3] * w;
        acc[0] += d.data[o] * a; acc[1] += d.data[o + 1] * a; acc[2] += d.data[o + 2] * a; acc[3] += a;
      }
    };
    const blend = (dst, o, acc, under) => {
      const sa = acc[3] / 255;
      if (sa <= 0.004) return;
      const sr = acc[0] / acc[3], sg = acc[1] / acc[3], sb = acc[2] / acc[3];
      const da = dst.data[o + 3] / 255;
      // Normal "over" (blade on top), or "under" (blade behind what is already drawn).
      const [ta, tr, tg, tb, ba, br, bg, bb] = under ? [da, dst.data[o], dst.data[o + 1], dst.data[o + 2], sa, sr, sg, sb] : [sa, sr, sg, sb, da, dst.data[o], dst.data[o + 1], dst.data[o + 2]];
      const a = ta + ba * (1 - ta);
      if (a <= 0) return;
      dst.data[o] = (tr * ta + br * ba * (1 - ta)) / a;
      dst.data[o + 1] = (tg * ta + bg * ba * (1 - ta)) / a;
      dst.data[o + 2] = (tb * ta + bb * ba * (1 - ta)) / a;
      dst.data[o + 3] = Math.round(a * 255);
    };
    // Draw sprite (d, m) rotated by deg about src pivot (px, py), with that pivot landing on (qx, qy).
    const drawRotated = (dst, d, m, [px, py], [qx, qy], deg, under) => {
      const r = (deg * Math.PI) / 180, c = Math.cos(r), s = Math.sin(r), acc = [0, 0, 0, 0];
      for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
        // Inverse map: destination -> source.
        const dx = x + 0.5 - qx, dy = y + 0.5 - qy;
        const fx = px + c * dx + s * dy - 0.5, fy = py - s * dx + c * dy - 0.5;
        sample(d, m, fx, fy, acc);
        blend(dst, at(dst, x, y), acc, under);
      }
    };
    // Fill holes from opaque neighbours (a few passes): for the root of the blade where it crossed the body.
    const diffuse = (d, holes) => {
      for (let pass = 0; pass < 6; pass++) {
        const next = [];
        for (const i of holes) {
          const x = i % N, y = (i / N) | 0; let r = 0, g = 0, bl = 0, a = 0, n = 0;
          for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
            const xx = x + dx, yy = y + dy; if (xx < 0 || yy < 0 || xx >= N || yy >= N || holes.has(yy * N + xx)) continue;
            const o = at(d, xx, yy); if (d.data[o + 3] === 0) continue;
            r += d.data[o]; g += d.data[o + 1]; bl += d.data[o + 2]; a += d.data[o + 3]; n++;
          }
          const o = at(d, x, y);
          if (n) { d.data[o] = r / n; d.data[o + 1] = g / n; d.data[o + 2] = bl / n; d.data[o + 3] = a / n; next.push(i); }
        }
        for (const i of next) holes.delete(i);
        if (!holes.size) break;
      }
    };
    const settle = (d, feet) => {
      const out = new ImageData(N, N), acc = [0, 0, 0, 0], all = new Uint8Array(N * N).fill(1);
      for (let y = 0; y < N; y++) {
        const above = feet - y;
        const t = Math.max(0, Math.min(1, (above - SETTLE.from) / (SETTLE.to - SETTLE.from)));
        const shift = SETTLE.px * t * t * (3 - 2 * t);
        for (let x = 0; x < N; x++) {
          const o = at(out, x, y);
          if (shift === 0) { for (let k = 0; k < 4; k++) out.data[o + k] = d.data[o + k]; continue; }
          sample(d, all, x, y - shift, acc);
          if (acc[3] > 0) { out.data[o] = acc[0] / acc[3]; out.data[o + 1] = acc[1] / acc[3]; out.data[o + 2] = acc[2] / acc[3]; out.data[o + 3] = Math.min(255, Math.round(acc[3])); }
        }
      }
      return out;
    };

    const frames = {};
    for (const [k, s] of Object.entries(SPECS)) frames[k] = await load(SRC[k]);
    const result = {}, stats = {};
    for (const [k, s] of Object.entries(SPECS)) {
      const src = frames[k];
      const strip = new OffscreenCanvas(N * 4, N), sg = strip.getContext('2d');
      let bladeSrc, mask, pivot, place;
      const base = new ImageData(new Uint8ClampedArray(src.data), N, N);
      if (s.borrow) {
        const b = SPECS[s.borrow];
        bladeSrc = frames[s.borrow]; mask = bladeMask(bladeSrc, b); pivot = b.pivot; place = s.place;
      } else {
        bladeSrc = src; mask = bladeMask(src, s); pivot = s.pivot; place = s.pivot;
        const holes = new Set();
        for (let i = 0; i < N * N; i++) {
          if (!mask[i]) continue;
          const x = i % N, y = (i / N) | 0, o = i * 4;
          if (s.fill.mirrorAxis) {
            const mx = s.fill.mirrorAxis - x, mo = at(src, mx, y);
            if (mx >= 0 && mx < N && !mask[y * N + mx]) { for (let c = 0; c < 4; c++) base.data[o + c] = src.data[mo + c]; continue; }
            holes.add(i);
          } else if (x >= s.fill.clearFromX) { base.data[o + 3] = 0; }
          else holes.add(i);
        }
        diffuse(base, holes);
      }
      stats[k] = { bladePx: mask.reduce((a, v) => a + v, 0) };
      for (let f = 0; f < 4; f++) {
        const frame = new ImageData(new Uint8ClampedArray(base.data), N, N);
        drawRotated(frame, bladeSrc, mask, pivot, place, s.angle + TILT[f] * s.tiltSign, s.under);
        if (s.guard) for (let y = s.guard[1]; y <= s.guard[3]; y++) for (let x = s.guard[0]; x <= s.guard[2]; x++) {
          const o = at(src, x, y);
          if (src.data[o + 3] > 0 && !mask[y * N + x] && !steel(src, o)) for (let c = 0; c < 4; c++) frame.data[o + c] = src.data[o + c];
        }
        sg.putImageData(settle(frame, s.feet), f * N, 0);
      }
      const blob = await strip.convertToBlob({ type: 'image/png' });
      result[s.out] = await new Promise((res) => { const r = new FileReader(); r.onload = () => res(r.result); r.readAsDataURL(blob); });
    }
    return { result, stats };
  })()`);
  for (const [name, url] of Object.entries(out.result)) writeFileSync(join(ANIMS, name), Buffer.from(url.split(',')[1], 'base64'));
  console.log('wrote', Object.keys(out.result).join(', '), JSON.stringify(out.stats));
} finally {
  await b.close();
}
process.exit(0);
