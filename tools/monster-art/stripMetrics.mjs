// Monster strip alpha / height validator (Visual Pass 4B). Dependency-free: a minimal PNG decoder
// (8-bit RGBA, non-interlaced: the format of every production sheet) plus per-frame alpha bounds.
//   node tools/monster-art/stripMetrics.mjs <strip.png> <cellWidth> <cellHeight> [feetRow] [minH maxH]
// Measures, per frame: the visible (alpha >= ALPHA_MIN) top / bottom / left / right rows and columns,
// the lowest visible pixel against the feet row, the standing height (feet row - top), the
// horizontal centre of the feet band against the cell centre, and whether anything touches an edge.
// A plain alpha-bound measurement; not computer vision.
// Convention (as in every approved sheet): the feet stand ON the feet row, so the lowest visible pixel is
// feetRow - 1 and a cell of height feetRow + 2 leaves exactly 2 clear rows below the feet.
import { readFileSync } from 'node:fs';
import { inflateSync, deflateSync } from 'node:zlib';

/** Pixels at or above this alpha count as visible (ignores faint anti-alias / matte haze). */
export const ALPHA_MIN = 32;

/** Decode an 8-bit RGBA non-interlaced PNG into { width, height, data: Uint8Array (RGBA) }. */
export function decodePng(buffer) {
  const b = Buffer.from(buffer);
  if (b.toString('latin1', 1, 4) !== 'PNG') throw new Error('not a PNG');
  let pos = 8, width = 0, height = 0, depth = 0, type = 0, interlace = 0;
  const idat = [];
  while (pos < b.length) {
    const len = b.readUInt32BE(pos), kind = b.toString('latin1', pos + 4, pos + 8), body = b.subarray(pos + 8, pos + 8 + len);
    if (kind === 'IHDR') { width = body.readUInt32BE(0); height = body.readUInt32BE(4); depth = body[8]; type = body[9]; interlace = body[12]; }
    else if (kind === 'IDAT') idat.push(body);
    else if (kind === 'IEND') break;
    pos += 12 + len;
  }
  if (depth !== 8 || type !== 6 || interlace !== 0) throw new Error(`unsupported PNG (depth ${depth}, colour type ${type}, interlace ${interlace}): production strips are 8-bit RGBA`);
  const raw = inflateSync(Buffer.concat(idat));
  const stride = width * 4, data = new Uint8Array(stride * height);
  for (let y = 0; y < height; y++) {
    const filter = raw[y * (stride + 1)], src = y * (stride + 1) + 1, row = y * stride, prev = row - stride;
    for (let x = 0; x < stride; x++) {
      const a = x >= 4 ? data[row + x - 4] : 0, up = y > 0 ? data[prev + x] : 0, ul = y > 0 && x >= 4 ? data[prev + x - 4] : 0;
      let pred = 0;
      if (filter === 1) pred = a;
      else if (filter === 2) pred = up;
      else if (filter === 3) pred = (a + up) >> 1;
      else if (filter === 4) { const p = a + up - ul, pa = Math.abs(p - a), pb = Math.abs(p - up), pc = Math.abs(p - ul); pred = pa <= pb && pa <= pc ? a : pb <= pc ? up : ul; }
      data[row + x] = (raw[src + x] + pred) & 255;
    }
  }
  return { width, height, data };
}

/** Encode RGBA pixels as a PNG (filter 0). For test fixtures. */
export function encodePng(width, height, data) {
  const crcTable = Array.from({ length: 256 }, (_, n) => { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; return c >>> 0; });
  const crc = (buf) => { let c = 0xffffffff; for (const v of buf) c = crcTable[(c ^ v) & 255] ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0; };
  const chunk = (kind, body) => { const out = Buffer.alloc(12 + body.length); out.writeUInt32BE(body.length, 0); out.write(kind, 4, 'latin1'); body.copy(out, 8); out.writeUInt32BE(crc(out.subarray(4, 8 + body.length)), 8 + body.length); return out; };
  const ihdr = Buffer.alloc(13); ihdr.writeUInt32BE(width, 0); ihdr.writeUInt32BE(height, 4); ihdr[8] = 8; ihdr[9] = 6;
  const raw = Buffer.alloc((width * 4 + 1) * height);
  for (let y = 0; y < height; y++) Buffer.from(data.buffer, data.byteOffset + y * width * 4, width * 4).copy(raw, y * (width * 4 + 1) + 1);
  return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', ihdr), chunk('IDAT', deflateSync(raw)), chunk('IEND', Buffer.alloc(0))]);
}

/**
 * Per-frame alpha metrics of a horizontal strip of `cellWidth` x `cellHeight` cells.
 * Returns { frames, cells: [{ empty, top, bottom, left, right, height, feetCentreX, touchesEdge }] }.
 */
export function measureStrip(png, cellWidth, cellHeight, feetRow = cellHeight - 1) {
  const { width, height, data } = png;
  const frames = width / cellWidth;
  const cells = [];
  for (let f = 0; f < Math.floor(frames); f++) {
    let top = -1, bottom = -1, left = cellWidth, right = -1;
    for (let y = 0; y < cellHeight; y++) for (let x = 0; x < cellWidth; x++) {
      if (data[(y * width + f * cellWidth + x) * 4 + 3] < ALPHA_MIN) continue;
      if (top < 0) top = y;
      bottom = y;
      if (x < left) left = x;
      if (x > right) right = x;
    }
    if (top < 0) { cells.push({ empty: true }); continue; }
    // Feet band: the lowest 6 visible rows; their horizontal centre should sit on the cell centre.
    let fl = cellWidth, fr = -1;
    for (let y = Math.max(top, bottom - 5); y <= bottom; y++) for (let x = 0; x < cellWidth; x++) {
      if (data[(y * width + f * cellWidth + x) * 4 + 3] < ALPHA_MIN) continue;
      if (x < fl) fl = x;
      if (x > fr) fr = x;
    }
    cells.push({ empty: false, top, bottom, left, right, height: feetRow - top, feetCentreX: (fl + fr) / 2,
      touchesEdge: top === 0 || left === 0 || right === cellWidth - 1 || bottom >= cellHeight - 2 });
  }
  return { frames, height, cells };
}

/**
 * Contract check for one strip. `stand` = [min, max] standing height (idle / walk only), `feetTolerance` = how far
 * above the feet row the lowest pixel may sit (a raised foot mid-stride). `centreTolerance` (px) is opt-in: the
 * lowest rows often hold a weapon tip or cape (the approved Lord and Knight sheets do), so alpha bounds alone
 * cannot find the feet reliably; centring is confirmed in the in-game visual review instead.
 * Returns a list of problems (empty = pass).
 */
export function checkStrip(png, { cellWidth, cellHeight, feetRow, frames, stand = null, feetTolerance = 6, centreTolerance = null }) {
  const problems = [];
  if (png.height !== cellHeight) problems.push(`height ${png.height} != cell ${cellHeight}`);
  if (png.width !== cellWidth * frames) problems.push(`width ${png.width} != ${frames} x ${cellWidth}`);
  const m = measureStrip(png, cellWidth, cellHeight, feetRow);
  const centreTol = centreTolerance ?? Infinity;
  m.cells.forEach((c, i) => {
    if (c.empty) { problems.push(`frame ${i} is empty`); return; }
    if (c.touchesEdge) problems.push(`frame ${i} touches the cell edge (crop / no 2 px clear below)`);
    if (c.bottom >= feetRow) problems.push(`frame ${i} lowest pixel row ${c.bottom} is on / below the feet row ${feetRow} (feet stand on it)`);
    if (stand && feetRow - 1 - c.bottom > feetTolerance) problems.push(`frame ${i} feet float ${feetRow - 1 - c.bottom} px above the feet row`);
    if (stand && (c.height < stand[0] || c.height > stand[1])) problems.push(`frame ${i} standing height ${c.height} outside ${stand[0]}-${stand[1]}`);
    if (stand && Math.abs(c.feetCentreX - (cellWidth - 1) / 2) > centreTol) problems.push(`frame ${i} feet centre x ${c.feetCentreX} off the cell centre`);
  });
  return { problems, metrics: m };
}

// CLI
if (process.argv[1] && import.meta.url.endsWith(process.argv[1].replace(/\\/g, '/').split('/').pop())) {
  const [file, w, h, feet, min, max] = process.argv.slice(2);
  if (!file || !w || !h) {
    console.log('usage: node tools/monster-art/stripMetrics.mjs <strip.png> <cellWidth> <cellHeight> [feetRow] [minH maxH]');
    process.exit(2);
  }
  const png = decodePng(readFileSync(file));
  const cellWidth = Number(w), cellHeight = Number(h), feetRow = feet ? Number(feet) : cellHeight - 1;
  const frames = png.width / cellWidth;
  const { problems, metrics } = checkStrip(png, { cellWidth, cellHeight, feetRow, frames, stand: min ? [Number(min), Number(max)] : null });
  console.log(JSON.stringify({ file, size: [png.width, png.height], frames, cells: metrics.cells }, null, 1));
  console.log(problems.length ? `FAIL\n  ${problems.join('\n  ')}` : 'PASS');
  process.exit(problems.length ? 1 : 0);
}
