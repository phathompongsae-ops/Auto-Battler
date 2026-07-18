#!/usr/bin/env node

import crypto from 'node:crypto';
import fs from 'node:fs';
import process from 'node:process';
import zlib from 'node:zlib';
import { execFileSync } from 'node:child_process';

const BASE = '811e6858a7e2cbe004270a094e58982b8c1fbcf7';
const DIR = 'assets/units/monster.golem/idle';
const SIDECAR = 'assets/units/monster.golem/monster.golem_idle_motiontest.json';
const SOURCE_MAP = `${DIR}/source-map.json`;
const CONTRACT = 'data/design/pilot-idle-motion-production-contract-v1.json';
const CONTACT = 'docs/assets/review/golem-idle-motion-test-v1-contact-sheet.png';
const GIF = 'docs/assets/review/golem-idle-motion-test-v1-preview.gif';
const N = 8, W = 640, H = 640;
const errors = [];
const assert = (ok, message) => { if (!ok) errors.push(message); };
const sha256 = (path) => crypto.createHash('sha256').update(fs.readFileSync(path)).digest('hex');

function readPng(path) {
  const buffer = fs.readFileSync(path);
  if (buffer.slice(0, 8).toString('hex') !== '89504e470d0a1a0a') throw new Error('bad PNG signature');
  let offset = 8, ihdr = null;
  const idat = [];
  while (offset < buffer.length) {
    const length = buffer.readUInt32BE(offset);
    const type = buffer.slice(offset + 4, offset + 8).toString();
    const data = buffer.slice(offset + 8, offset + 8 + length);
    if (type === 'IHDR') ihdr = { w: data.readUInt32BE(0), h: data.readUInt32BE(4), depth: data[8], colorType: data[9], interlace: data[12] };
    if (type === 'IDAT') idat.push(data);
    offset += length + 12;
    if (type === 'IEND') break;
  }
  if (!ihdr) throw new Error('missing IHDR');
  if (ihdr.depth !== 8 || ihdr.colorType !== 6 || ihdr.interlace !== 0) return { ihdr, pixels: null };
  const stride = ihdr.w * 4;
  const raw = zlib.inflateSync(Buffer.concat(idat));
  if (raw.length !== (stride + 1) * ihdr.h) throw new Error('inflated byte length mismatch');
  const pixels = Buffer.alloc(stride * ihdr.h);
  const paeth = (a, b, c) => {
    const p = a + b - c, pa = Math.abs(p - a), pb = Math.abs(p - b), pc = Math.abs(p - c);
    return pa <= pb && pa <= pc ? a : pb <= pc ? b : c;
  };
  for (let y = 0; y < ihdr.h; y++) {
    const filter = raw[y * (stride + 1)], row = y * stride, previous = (y - 1) * stride;
    for (let x = 0; x < stride; x++) {
      const value = raw[y * (stride + 1) + 1 + x];
      const left = x >= 4 ? pixels[row + x - 4] : 0;
      const up = y > 0 ? pixels[previous + x] : 0;
      const upperLeft = y > 0 && x >= 4 ? pixels[previous + x - 4] : 0;
      let decoded;
      if (filter === 0) decoded = value;
      else if (filter === 1) decoded = value + left;
      else if (filter === 2) decoded = value + up;
      else if (filter === 3) decoded = value + ((left + up) >> 1);
      else if (filter === 4) decoded = value + paeth(left, up, upperLeft);
      else throw new Error(`unsupported PNG filter ${filter}`);
      pixels[row + x] = decoded & 255;
    }
  }
  return { ihdr, pixels };
}

function metrics(pixels) {
  let count = 0, sumX = 0, sumY = 0, minX = W, minY = H, maxX = -1, maxY = -1, borderOpaque = 0;
  const active = new Uint8Array(W * H);
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const alpha = pixels[(y * W + x) * 4 + 3];
      if (alpha > 8) {
        active[y * W + x] = 1;
        count++; sumX += x; sumY += y;
        minX = Math.min(minX, x); minY = Math.min(minY, y); maxX = Math.max(maxX, x); maxY = Math.max(maxY, y);
        if (x === 0 || y === 0 || x === W - 1 || y === H - 1) borderOpaque++;
      }
    }
  }
  const visited = new Uint8Array(active.length);
  const componentSizes = [];
  for (let start = 0; start < active.length; start++) {
    if (!active[start] || visited[start]) continue;
    const queue = [start]; visited[start] = 1;
    let size = 0;
    for (let cursor = 0; cursor < queue.length; cursor++) {
      const index = queue[cursor], x = index % W, y = Math.floor(index / W); size++;
      for (const next of [index - 1, index + 1, index - W, index + W]) {
        if (next < 0 || next >= active.length || visited[next] || !active[next]) continue;
        const nx = next % W, ny = Math.floor(next / W);
        if (Math.abs(nx - x) + Math.abs(ny - y) !== 1) continue;
        visited[next] = 1; queue.push(next);
      }
    }
    componentSizes.push(size);
  }
  componentSizes.sort((a, b) => b - a);
  return {
    count,
    opaqueFraction: count / (W * H),
    centroidX: sumX / count,
    centroidY: sumY / count,
    bbox: [minX, minY, maxX - minX + 1, maxY - minY + 1],
    baselineY: maxY,
    borderOpaque,
    componentCount: componentSizes.length,
    detachedPixels: count - (componentSizes[0] ?? 0),
    detachedLargeComponents: componentSizes.slice(1).filter((size) => size >= 64).length
  };
}

const expectedNames = Array.from({ length: N }, (_, index) => `monster.golem_idle_${String(index).padStart(3, '0')}.png`);
assert(fs.existsSync(DIR), `missing directory: ${DIR}`);
const actualNames = fs.existsSync(DIR) ? fs.readdirSync(DIR).filter((name) => name.endsWith('.png')).sort() : [];
assert(JSON.stringify(actualNames) === JSON.stringify(expectedNames), `frame filenames must be exactly 000-007 (got ${actualNames.join(', ')})`);
assert(!fs.existsSync(`${DIR}/monster.golem_idle_008.png`), 'unexpected frame 008');

const master = readPng('assets/units/monster.golem/attack/monster.golem_attack_000.png');
const masterMetrics = master.pixels ? metrics(master.pixels) : null;
const frames = [];
const hashes = new Set();
for (const name of expectedNames) {
  const path = `${DIR}/${name}`;
  if (!fs.existsSync(path)) continue;
  const hash = sha256(path);
  assert(!hashes.has(hash), `${name}: duplicate hash`);
  hashes.add(hash);
  try {
    const png = readPng(path);
    assert(png.ihdr.w === W && png.ihdr.h === H, `${name}: canvas must be 640x640`);
    assert(png.ihdr.depth === 8 && png.ihdr.colorType === 6, `${name}: must be 8-bit RGBA`);
    assert(png.pixels, `${name}: pixel decode unavailable`);
    if (png.pixels) {
      const alphaAt = (x, y) => png.pixels[(y * W + x) * 4 + 3];
      const corners = [alphaAt(0, 0), alphaAt(W - 1, 0), alphaAt(0, H - 1), alphaAt(W - 1, H - 1)];
      assert(corners.every((alpha) => alpha === 0), `${name}: corners must be transparent`);
      const measure = metrics(png.pixels);
      assert(measure.borderOpaque === 0, `${name}: opaque border pixels ${measure.borderOpaque}`);
      assert(measure.opaqueFraction > 0.2 && measure.opaqueFraction < 0.75, `${name}: opaque fraction ${measure.opaqueFraction.toFixed(4)} implausible`);
      assert(measure.detachedLargeComponents === 0, `${name}: large detached alpha component found (checkerboard/residue risk)`);
      if (masterMetrics) assert(measure.detachedPixels <= masterMetrics.detachedPixels + 64, `${name}: detached pixels ${measure.detachedPixels} exceed clean visual-fix-v2 master ${masterMetrics.detachedPixels}+64`);
      frames.push({ name, hash, pixels: png.pixels, ...measure });
    }
  } catch (error) { errors.push(`${name}: corrupt/unreadable PNG (${error.message})`); }
}

if (frames.length === N) {
  const centroidXs = frames.map((frame) => frame.centroidX);
  const centroidSpread = Math.max(...centroidXs) - Math.min(...centroidXs);
  assert(centroidSpread <= 1.25, `horizontal centroid spread ${centroidSpread.toFixed(3)}px exceeds 1.25px`);
  const baselines = frames.map((frame) => frame.baselineY);
  assert(new Set(baselines).size === 1 && baselines[0] === 601, `foot baseline must stay y=601 (got ${baselines.join(',')})`);
  assert(Math.abs(baselines[0] - (H * 0.94 - 0.6)) <= 1, 'baseline does not align with anchor [0.5,0.94]');

  let seamAbs = 0;
  const first = frames[0].pixels, last = frames[7].pixels;
  for (let index = 0; index < first.length; index++) seamAbs += Math.abs(first[index] - last[index]);
  const seamMean = seamAbs / first.length / 255;
  assert(seamMean < 0.02, `007->000 normalized mean seam ${seamMean.toFixed(5)} exceeds 0.02`);

  console.log(`Metrics: bbox=${frames.map((frame) => frame.bbox.join('x')).join(' | ')}`);
  console.log(`Metrics: baseline=${baselines.join(',')}; horizontal centroid spread=${centroidSpread.toFixed(3)}px; loop seam=${seamMean.toFixed(5)}`);
  console.log(`Forensics: clean-master detached=${masterMetrics?.detachedPixels}; frame detached=${frames.map((frame) => frame.detachedPixels).join(',')}; large checker candidates=0; opaque border=0 for 8/8.`);
}

for (const path of [SIDECAR, SOURCE_MAP, CONTRACT, CONTACT, GIF]) assert(fs.existsSync(path) && fs.statSync(path).size > 0, `missing or empty required file: ${path}`);
if (fs.existsSync(SIDECAR)) {
  try {
    const sidecar = JSON.parse(fs.readFileSync(SIDECAR, 'utf8'));
    assert(sidecar.unitId === 'monster.golem' && sidecar.state === 'idle', 'sidecar identity/state mismatch');
    assert(sidecar.fps === 8 && sidecar.frameCount === 8 && sidecar.loop === true, 'sidecar timing mismatch');
    assert(JSON.stringify(sidecar.canvas) === JSON.stringify([640, 640]), 'sidecar canvas mismatch');
    assert(JSON.stringify(sidecar.anchor) === JSON.stringify([0.5, 0.94]), 'sidecar anchor mismatch');
    assert(sidecar.rootMotion === 'in-place', 'sidecar rootMotion must be in-place');
    assert(sidecar.runtimeFlipX === true, 'sidecar runtimeFlipX must be true');
    assert(Array.isArray(sidecar.eventMarkers) && sidecar.eventMarkers.length === 0, 'sidecar eventMarkers must be empty');
    assert(sidecar.canonicalApproved === false, 'sidecar canonicalApproved must be false');
  } catch (error) { errors.push(`sidecar JSON invalid (${error.message})`); }
}

if (fs.existsSync(SOURCE_MAP)) {
  try {
    const sourceMap = JSON.parse(fs.readFileSync(SOURCE_MAP, 'utf8'));
    assert(sourceMap.identityMaster?.sha256 === 'be41f186b37f99fed12e59844638ab0ed2e0020deb73ace5a840c2d4adda70d8', 'identity master hash mismatch');
    assert(sourceMap.identityMaster?.visualFixReportSha256 === 'b95abd52e13a48d5f9cf730e4271b7a5a2437d6c6c7017a05a235e0aa4478dd2', 'visual-fix-v2 report hash mismatch');
    assert(sourceMap.frames?.length === 8, 'source map must contain 8 frame records');
    if (frames.length === N) assert(sourceMap.frames.every((record, index) => record.frame === index && record.sha256 === frames[index].hash), 'source map frame hashes mismatch');
    assert(sourceMap.canonicalApproved === false, 'source map canonicalApproved must be false');
    assert(sourceMap.browserX4Status === 'not_run_by_coco_pending_cc_integration', 'source map must not claim browser/x4 approval');
  } catch (error) { errors.push(`source map JSON invalid (${error.message})`); }
}

if (fs.existsSync(CONTRACT)) {
  try {
    const contract = JSON.parse(fs.readFileSync(CONTRACT, 'utf8'));
    const golemLocked = contract.sourceIntegrity?.['monster.golem/attack'] ?? [];
    for (let index = 0; index < 8; index++) {
      const path = `assets/units/monster.golem/attack/monster.golem_attack_${String(index).padStart(3, '0')}.png`;
      assert(sha256(path) === golemLocked[index], `locked Golem Attack source changed: frame ${index}`);
    }
    const attackSidecar = 'assets/units/monster.golem/monster.golem_attack_motiontest.json';
    assert(sha256(attackSidecar) === contract.sourceIntegrity?.sidecars?.[attackSidecar], 'locked Golem Attack sidecar changed');
  } catch (error) { errors.push(`contract/source lock check failed (${error.message})`); }
}

if (fs.existsSync('assets/units/monster.slime/idle/source-map.json')) {
  try {
    const slimeMap = JSON.parse(fs.readFileSync('assets/units/monster.slime/idle/source-map.json', 'utf8'));
    for (const record of slimeMap.frames ?? []) {
      const path = `assets/units/monster.slime/idle/monster.slime_idle_${String(record.frame).padStart(3, '0')}.png`;
      assert(sha256(path) === record.sha256, `Slime Idle asset changed: frame ${record.frame}`);
    }
  } catch (error) { errors.push(`Slime source-integrity check failed (${error.message})`); }
}

if (fs.existsSync(CONTACT)) {
  try { const contact = readPng(CONTACT); assert(contact.ihdr.w > 0 && contact.ihdr.h > 0, 'contact sheet dimensions invalid'); }
  catch (error) { errors.push(`contact sheet invalid (${error.message})`); }
}
if (fs.existsSync(GIF)) {
  const signature = fs.readFileSync(GIF).slice(0, 6).toString();
  assert(signature === 'GIF87a' || signature === 'GIF89a', 'preview GIF signature invalid');
}

try {
  const changed = execFileSync('git', ['diff', '--name-only', BASE], { encoding: 'utf8' }).trim().split(/\n/).filter(Boolean);
  for (const path of changed) {
    assert(!path.startsWith('src/'), `runtime/Core Logic path changed: ${path}`);
    assert(!path.startsWith('assets/units/monster.slime/'), `Slime asset changed in Golem phase: ${path}`);
    assert(!path.startsWith('assets/units/monster.golem/attack/'), `Golem Attack master changed: ${path}`);
    assert(path !== 'assets/units/monster.golem/monster.golem_attack_motiontest.json', `Golem Attack sidecar changed: ${path}`);
  }
} catch (error) { errors.push(`scope guard failed (${error.message})`); }

if (errors.length) {
  console.error('Golem idle frames validation failed:');
  for (const error of errors) console.error(`- ${error}`);
  process.exit(1);
}

console.log('Golem idle frames validation passed (8 unique real RGBA frames, stable feet/centroid, visual-fix-v2 alpha forensics, source locks and sidecar consistent).');
console.log('Approval: canonicalApproved=false; CC integration and browser/x4 review remain pending.');
