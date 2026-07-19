#!/usr/bin/env node

// Read-only validator for the Archer chibi Attack v1 production candidate.

import crypto from 'node:crypto';
import fs from 'node:fs';
import process from 'node:process';
import zlib from 'node:zlib';

const SOURCE = 'docs/assets/review/character-production/archer/master-v1/archer-production-master-candidate-v1.png';
const SOURCE_SHA = '4911e7e3ba59241ee011be3e62f1b64230dcf9b3c24c6aeb23dc939d83311013';
const IDLE_APPROVAL = 'data/design/archer-idle-package-exact-file-approval-v1.json';
const MOVE_APPROVAL = 'data/design/archer-move-package-exact-file-approval-v1.json';
const DIR = 'assets/units/hero.archer/attack-chibi-v1';
const SIDECAR = 'assets/units/hero.archer/hero.archer_attack_chibi_v1.json';
const SOURCE_MAP = `${DIR}/source-map.json`;
const METRICS = 'docs/reviews/archer-attack-production-v1-validation.json';
const CONTRACT = 'data/design/archer-attack-production-v1.json';
const N = 10, W = 640, H = 960, FEET_PIN_Y = 800, RELEASE_FRAME = 5;
const errors = [];
const assert = (condition, message) => { if (!condition) errors.push(message); };
const hash = (path) => crypto.createHash('sha256').update(fs.readFileSync(path)).digest('hex');

function readJson(path) {
  try { return JSON.parse(fs.readFileSync(path, 'utf8')); }
  catch (error) { errors.push(`${path}: invalid JSON (${error.message})`); return null; }
}

function readPng(path) {
  const buffer = fs.readFileSync(path);
  if (buffer.subarray(0, 8).toString('hex') !== '89504e470d0a1a0a') throw new Error('bad PNG signature');
  let offset = 8, ihdr = null;
  const idat = [];
  while (offset < buffer.length) {
    const length = buffer.readUInt32BE(offset);
    const type = buffer.subarray(offset + 4, offset + 8).toString();
    const data = buffer.subarray(offset + 8, offset + 8 + length);
    if (type === 'IHDR') ihdr = { width: data.readUInt32BE(0), height: data.readUInt32BE(4), depth: data[8], colorType: data[9], interlace: data[12] };
    if (type === 'IDAT') idat.push(data);
    offset += 12 + length;
    if (type === 'IEND') break;
  }
  if (!ihdr) throw new Error('missing IHDR');
  if (ihdr.interlace !== 0) throw new Error('interlaced PNG unsupported');
  if (ihdr.depth !== 8 || ihdr.colorType !== 6) return { ihdr, pixels: null };
  const stride = ihdr.width * 4;
  const raw = zlib.inflateSync(Buffer.concat(idat));
  if (raw.length !== (stride + 1) * ihdr.height) throw new Error('inflated data length mismatch');
  const pixels = Buffer.alloc(stride * ihdr.height);
  const paeth = (a, b, c) => {
    const p = a + b - c, pa = Math.abs(p - a), pb = Math.abs(p - b), pc = Math.abs(p - c);
    return pa <= pb && pa <= pc ? a : pb <= pc ? b : c;
  };
  for (let y = 0; y < ihdr.height; y++) {
    const filter = raw[y * (stride + 1)], row = y * stride, previous = (y - 1) * stride;
    for (let x = 0; x < stride; x++) {
      const rawByte = raw[y * (stride + 1) + 1 + x];
      const left = x >= 4 ? pixels[row + x - 4] : 0;
      const up = y > 0 ? pixels[previous + x] : 0;
      const upperLeft = y > 0 && x >= 4 ? pixels[previous + x - 4] : 0;
      let value;
      if (filter === 0) value = rawByte;
      else if (filter === 1) value = rawByte + left;
      else if (filter === 2) value = rawByte + up;
      else if (filter === 3) value = rawByte + ((left + up) >> 1);
      else if (filter === 4) value = rawByte + paeth(left, up, upperLeft);
      else throw new Error(`unknown filter ${filter}`);
      pixels[row + x] = value & 0xff;
    }
  }
  return { ihdr, pixels };
}

function alphaStats(frame) {
  let minX = W, minY = H, maxX = -1, maxY = -1, border = 0;
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const alpha = frame.pixels[(y * W + x) * 4 + 3];
    if (alpha > 0) {
      minX = Math.min(minX, x); minY = Math.min(minY, y); maxX = Math.max(maxX, x); maxY = Math.max(maxY, y);
      if (x === 0 || y === 0 || x === W - 1 || y === H - 1) border++;
    }
  }
  return { minX, minY, maxX, maxY, border };
}

function premultipliedMae(first, second) {
  let total = 0;
  for (let i = 0; i < first.pixels.length; i += 4) {
    const aa = first.pixels[i + 3] / 255, ba = second.pixels[i + 3] / 255;
    total += Math.abs(first.pixels[i] / 255 * aa - second.pixels[i] / 255 * ba);
    total += Math.abs(first.pixels[i + 1] / 255 * aa - second.pixels[i + 1] / 255 * ba);
    total += Math.abs(first.pixels[i + 2] / 255 * aa - second.pixels[i + 2] / 255 * ba);
    total += Math.abs(aa - ba);
  }
  return total / first.pixels.length;
}

assert(fs.existsSync(SOURCE), `missing approved source ${SOURCE}`);
if (fs.existsSync(SOURCE)) assert(hash(SOURCE) === SOURCE_SHA, 'approved Neutral Master SHA mismatch');
const source = fs.existsSync(SOURCE) ? readPng(SOURCE) : null;
const idleApproval = readJson(IDLE_APPROVAL);
const moveApproval = readJson(MOVE_APPROVAL);
const sourceMap = readJson(SOURCE_MAP);
const sidecar = readJson(SIDECAR);
const metrics = readJson(METRICS);
const contract = readJson(CONTRACT);
assert(idleApproval?.idlePackageApproved === true, 'approved Idle overlay must set idlePackageApproved=true');
assert(idleApproval?.sourceNeutralMaster?.sha256 === SOURCE_SHA, 'approved Idle overlay Neutral Master SHA mismatch');
assert(moveApproval?.movePackageApproved === true, 'approved Move overlay must set movePackageApproved=true');
assert(moveApproval?.sourceNeutralMaster?.sha256 === SOURCE_SHA, 'approved Move overlay Neutral Master SHA mismatch');

const frames = [];
const hashes = new Set();
for (let index = 0; index < N; index++) {
  const path = `${DIR}/hero.archer_attack_${String(index).padStart(3, '0')}.png`;
  assert(fs.existsSync(path), `missing frame ${path}`);
  if (!fs.existsSync(path)) continue;
  const digest = hash(path);
  assert(!hashes.has(digest), `frame ${index}: duplicate SHA-256`);
  hashes.add(digest);
  try {
    const frame = readPng(path);
    assert(frame.ihdr.width === W && frame.ihdr.height === H, `frame ${index}: canvas must be ${W}x${H}`);
    assert(frame.ihdr.depth === 8 && frame.ihdr.colorType === 6, `frame ${index}: must be 8-bit RGBA`);
    const alpha = alphaStats(frame);
    assert(alpha.border === 0, `frame ${index}: ${alpha.border} non-transparent border pixels`);
    assert(alpha.minX >= 60 && alpha.maxX <= 595 && alpha.minY >= 110 && alpha.maxY <= 860, `frame ${index}: alpha bounds imply crop or scale drift`);
    frames.push({ index, path, digest, frame, alpha });
  } catch (error) { errors.push(`frame ${index}: unreadable PNG (${error.message})`); }
}
assert(!fs.existsSync(`${DIR}/hero.archer_attack_010.png`), 'unexpected frame 010');
assert(frames.length === N, `decoded frame count ${frames.length}, expected ${N}`);

if (frames.length === N && source?.pixels) {
  // Feet pin: rows y>=800 must be byte-identical to the Neutral Master in
  // every frame — the strongest possible no-foot-slide guarantee.
  const pinStart = FEET_PIN_Y * W * 4;
  for (const { index, frame } of frames) {
    assert(frame.pixels.subarray(pinStart).equals(source.pixels.subarray(pinStart)), `frame ${index}: pinned foot zone y>=${FEET_PIN_Y} differs from Neutral Master`);
    assert(premultipliedMae(source, frame) < 0.06, `frame ${index}: source delta exceeds attack identity threshold 0.06`);
  }
  // Neutral exit: the final frame is the exact approved master file.
  assert(frames[N - 1].digest === SOURCE_SHA, `frame ${N - 1}: must be byte-identical to the approved Neutral Master`);

  const adjacent = [];
  for (let i = 0; i < N - 1; i++) adjacent.push(premultipliedMae(frames[i].frame, frames[i + 1].frame));
  const maximum = Math.max(...adjacent);
  assert(adjacent[4] >= maximum - 1e-12, `release snap (4->5) ${adjacent[4]} must be the maximum adjacent delta (max ${maximum})`);
  assert(maximum < 0.05, `maximum adjacent visual delta ${maximum} exceeds Attack threshold 0.05`);
  assert(adjacent[N - 2] < 0.006, `settle pair (8->9) ${adjacent[N - 2]} exceeds clean-exit threshold 0.006`);
  assert(premultipliedMae(source, frames[0].frame) < 0.015, `entry delta ${premultipliedMae(source, frames[0].frame)} exceeds idle-transition threshold 0.015`);
}

if (sidecar) {
  assert(sidecar.assetId === 'hero.archer.attack.chibi-production-candidate.v1', 'sidecar assetId mismatch');
  assert(sidecar.unitId === 'hero.archer' && sidecar.state === 'attack', 'sidecar unit/state mismatch');
  assert(sidecar.fps === 12 && sidecar.frameCount === 10 && sidecar.loop === false, 'sidecar timing mismatch');
  assert(JSON.stringify(sidecar.anchor) === '[0.5,0.92]' && JSON.stringify(sidecar.canvas) === '[640,960]', 'sidecar anchor/canvas mismatch');
  assert(sidecar.rootMotion === 'in-place' && sidecar.runtimeFlipX === true, 'sidecar rootMotion/runtimeFlipX mismatch');
  assert(JSON.stringify(sidecar.eventMarkers) === '[{"name":"projectileRelease","normalizedTime":0.55}]', 'sidecar marker contract mismatch');
  assert(sidecar.neutralMasterApproved === true && sidecar.idlePackageApproved === true && sidecar.movePackageApproved === true, 'sidecar source approval flags mismatch');
  for (const key of ['attackPackageApproved', 'canonicalApproved', 'runtimeEligible', 'runtimeIntegrated']) assert(sidecar[key] === false, `sidecar ${key} must be false`);
}

if (sourceMap) {
  assert(sourceMap.sourceNeutralMaster?.sha256 === SOURCE_SHA, 'source-map Neutral Master SHA mismatch');
  assert(sourceMap.approvedIdle?.sourcePR === 63 && sourceMap.approvedIdle?.idlePackageApproved === true, 'source-map approved Idle reference mismatch');
  assert(sourceMap.approvedMove?.sourcePR === 65 && sourceMap.approvedMove?.movePackageApproved === true, 'source-map approved Move reference mismatch');
  assert(sourceMap.productionMethod?.aiRegeneration === false, 'source-map must record aiRegeneration=false');
  assert(sourceMap.productionMethod?.feetPinExclusiveY === FEET_PIN_Y, 'source-map feet pin mismatch');
  assert(sourceMap.productionMethod?.worldTravelBaked === false, 'source-map must record no baked world travel');
  assert(Array.isArray(sourceMap.frames) && sourceMap.frames.length === N, 'source-map frame count mismatch');
  for (const record of sourceMap.frames ?? []) {
    const frame = frames[record.frameIndex];
    if (frame) {
      assert(record.path === frame.path, `source-map frame ${record.frameIndex}: path mismatch`);
      assert(record.sha256 === frame.digest, `source-map frame ${record.frameIndex}: SHA mismatch`);
    }
  }
  for (const key of ['attackPackageApproved', 'canonicalApproved', 'runtimeEligible', 'runtimeIntegrated']) assert(sourceMap[key] === false, `source-map ${key} must be false`);
}

if (metrics) {
  assert(metrics.sequenceContinuity?.releaseSnapIsMaximumAdjacent === true, 'metrics release-snap invariant failed');
  assert(metrics.sequenceContinuity?.exitFrameByteIdenticalToNeutral === true, 'metrics neutral-exit invariant failed');
  assert(metrics.rootMotion?.horizontalCentroidRangePixels < 8, 'horizontal centroid range must remain below 8 px');
  assert(metrics.rootMotion?.verticalCentroidRangePixels < 5, 'vertical centroid range must remain below 5 px');
  assert(metrics.rootMotion?.accumulatedTranslationPixels === 0 && metrics.rootMotion?.worldTravelBaked === false, 'root-motion invariant failed');
  assert(metrics.markerAlignment?.projectileRelease?.normalizedTime === 0.55 && metrics.markerAlignment?.projectileRelease?.frameIndex === RELEASE_FRAME, 'projectileRelease marker mismatch');
  assert(metrics.markerAlignment?.markersChangedFromBaseline === false, 'markers must not change from baseline');
  for (const artifact of metrics.reviewArtifacts ?? []) {
    assert(fs.existsSync(artifact.path), `missing review artifact ${artifact.path}`);
    if (fs.existsSync(artifact.path)) assert(hash(artifact.path) === artifact.sha256, `review artifact SHA mismatch: ${artifact.path}`);
    assert(artifact.reviewOnly === true && artifact.runtimeEligible === false, `${artifact.id}: review-only flags mismatch`);
  }
  assert(metrics.status?.neutralMasterApproved === true && metrics.status?.idlePackageApproved === true && metrics.status?.movePackageApproved === true, 'metrics source approval flags mismatch');
  assert(metrics.status?.attackGenerated === true, 'metrics attackGenerated must be true');
  for (const key of ['attackPackageApproved', 'canonicalApproved', 'runtimeEligible', 'runtimeIntegrated']) assert(metrics.status?.[key] === false, `metrics ${key} must be false`);
}

if (contract) {
  assert(contract.characterId === 'hero.archer' && contract.state === 'attack', 'contract character/state mismatch');
  assert(contract.sourceNeutralMaster?.sha256 === SOURCE_SHA, 'contract Neutral Master SHA mismatch');
  assert(contract.neutralMasterApproved === true && contract.idlePackageApproved === true && contract.movePackageApproved === true, 'contract source approval flags mismatch');
  assert(contract.attackGenerated === true, 'contract attackGenerated must be true');
  for (const key of ['attackPackageApproved', 'canonicalApproved', 'runtimeEligible', 'runtimeIntegrated']) assert(contract[key] === false, `contract ${key} must be false`);
  assert(Array.isArray(contract.frameInventory) && contract.frameInventory.length === N, 'contract frame inventory mismatch');
  for (const item of contract.frameInventory ?? []) {
    const frame = frames[item.frameIndex];
    if (frame) assert(item.sha256 === frame.digest, `contract frame ${item.frameIndex}: SHA mismatch`);
  }
}

if (errors.length) {
  console.error('Archer Attack Production v1 validation failed:');
  for (const error of errors) console.error(`- ${error}`);
  process.exit(1);
}
console.log('Archer Attack Production v1 validation passed: exact approved sources, 10 unique RGBA frames, pinned foot zone, byte-identical neutral exit, release-snap cadence, projectileRelease marker, anchor/bounds, provenance, and approval invariants verified.');
