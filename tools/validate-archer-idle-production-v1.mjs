#!/usr/bin/env node

// Read-only validation for the Archer chibi Idle v1 candidate package.

import crypto from 'node:crypto';
import fs from 'node:fs';
import process from 'node:process';
import zlib from 'node:zlib';

const SOURCE = 'docs/assets/review/character-production/archer/master-v1/archer-production-master-candidate-v1.png';
const SOURCE_SHA = '4911e7e3ba59241ee011be3e62f1b64230dcf9b3c24c6aeb23dc939d83311013';
const DIR = 'assets/units/hero.archer/idle-chibi-v1';
const SIDECAR = 'assets/units/hero.archer/hero.archer_idle_chibi_v1.json';
const SOURCE_MAP = `${DIR}/source-map.json`;
const METRICS = 'docs/reviews/archer-idle-production-v1-validation.json';
const CONTRACT = 'data/design/archer-idle-production-v1.json';
const N = 8;
const W = 640;
const H = 960;
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
  let offset = 8;
  let ihdr = null;
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
    const p = a + b - c;
    const pa = Math.abs(p - a), pb = Math.abs(p - b), pc = Math.abs(p - c);
    return pa <= pb && pa <= pc ? a : pb <= pc ? b : c;
  };
  for (let y = 0; y < ihdr.height; y++) {
    const filter = raw[y * (stride + 1)];
    const row = y * stride;
    const previous = (y - 1) * stride;
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
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const alpha = frame.pixels[(y * W + x) * 4 + 3];
      if (alpha > 0) {
        minX = Math.min(minX, x); minY = Math.min(minY, y);
        maxX = Math.max(maxX, x); maxY = Math.max(maxY, y);
        if (x === 0 || y === 0 || x === W - 1 || y === H - 1) border++;
      }
    }
  }
  return { x: minX, y: minY, width: maxX - minX + 1, height: maxY - minY + 1, baseline: maxY, border };
}

function premultipliedMae(first, second) {
  let total = 0;
  for (let i = 0; i < first.pixels.length; i += 4) {
    const aa = first.pixels[i + 3] / 255;
    const ba = second.pixels[i + 3] / 255;
    total += Math.abs(first.pixels[i] / 255 * aa - second.pixels[i] / 255 * ba);
    total += Math.abs(first.pixels[i + 1] / 255 * aa - second.pixels[i + 1] / 255 * ba);
    total += Math.abs(first.pixels[i + 2] / 255 * aa - second.pixels[i + 2] / 255 * ba);
    total += Math.abs(aa - ba);
  }
  return total / first.pixels.length;
}

assert(fs.existsSync(SOURCE), `missing approved source ${SOURCE}`);
if (fs.existsSync(SOURCE)) assert(hash(SOURCE) === SOURCE_SHA, 'approved Neutral Master SHA-256 mismatch');

const source = fs.existsSync(SOURCE) ? readPng(SOURCE) : null;
const sourceMap = readJson(SOURCE_MAP);
const sidecar = readJson(SIDECAR);
const metrics = readJson(METRICS);
const contract = readJson(CONTRACT);
const frames = [];
const hashes = new Set();
for (let index = 0; index < N; index++) {
  const path = `${DIR}/hero.archer_idle_${String(index).padStart(3, '0')}.png`;
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
    assert(alpha.baseline === 854, `frame ${index}: foot baseline ${alpha.baseline}, expected 854`);
    frames.push({ index, path, digest, frame, alpha });
  } catch (error) { errors.push(`frame ${index}: unreadable PNG (${error.message})`); }
}
assert(!fs.existsSync(`${DIR}/hero.archer_idle_008.png`), 'unexpected frame 008');
assert(frames.length === N, `decoded frame count ${frames.length}, expected ${N}`);
if (frames.length === N && source?.pixels) {
  assert(frames[0].digest === SOURCE_SHA, 'frame 000 must be exact approved Neutral Master bytes');
  assert(frames[0].frame.pixels.equals(source.pixels), 'frame 000 decoded pixels differ from approved Neutral Master');
  for (const { index, frame } of frames) {
    const start = 800 * W * 4;
    assert(frame.pixels.subarray(start).equals(source.pixels.subarray(start)), `frame ${index}: pinned contact zone y>=800 differs from source`);
  }
  const adjacent = frames.map(({ frame }, index) => premultipliedMae(frame, frames[(index + 1) % N].frame));
  const seam = adjacent[N - 1];
  const maximum = Math.max(...adjacent);
  assert(seam <= maximum + 1e-12, `loop seam ${seam} exceeds maximum adjacent delta ${maximum}`);
  assert(maximum < 0.007, `maximum adjacent visual delta ${maximum} exceeds subtle-motion threshold 0.007`);
  for (const { index, frame } of frames) {
    const sourceDelta = premultipliedMae(source, frame);
    assert(sourceDelta < 0.018, `frame ${index}: source delta ${sourceDelta} exceeds identity-continuity threshold 0.018`);
  }
}

if (sidecar) {
  assert(sidecar.assetId === 'hero.archer.idle.chibi-production-candidate.v1', 'sidecar assetId mismatch');
  assert(sidecar.unitId === 'hero.archer' && sidecar.state === 'idle', 'sidecar unit/state mismatch');
  assert(sidecar.fps === 8 && sidecar.frameCount === 8 && sidecar.loop === true, 'sidecar timing mismatch');
  assert(JSON.stringify(sidecar.anchor) === '[0.5,0.92]', 'sidecar anchor mismatch');
  assert(JSON.stringify(sidecar.canvas) === '[640,960]', 'sidecar canvas mismatch');
  assert(sidecar.rootMotion === 'in-place', 'sidecar rootMotion must be in-place');
  assert(sidecar.runtimeFlipX === true, 'sidecar runtimeFlipX must preserve technical baseline true');
  assert(Array.isArray(sidecar.eventMarkers) && sidecar.eventMarkers.length === 0, 'Idle eventMarkers must be empty');
  for (const key of ['idlePackageApproved', 'canonicalApproved', 'runtimeEligible', 'runtimeIntegrated']) assert(sidecar[key] === false, `sidecar ${key} must be false`);
  assert(sidecar.neutralMasterApproved === true, 'sidecar neutralMasterApproved must be true');
}

if (sourceMap) {
  assert(sourceMap.sourceNeutralMaster?.sha256 === SOURCE_SHA, 'source-map approved source SHA mismatch');
  assert(sourceMap.sourceNeutralMaster?.sourcePR === 61, 'source-map source PR must be 61');
  assert(sourceMap.productionMethod?.aiRegeneration === false, 'source-map must record aiRegeneration=false');
  assert(sourceMap.productionMethod?.contactZonePinnedFromY === 800, 'source-map pinned contact zone mismatch');
  assert(Array.isArray(sourceMap.frames) && sourceMap.frames.length === N, 'source-map frame count mismatch');
  for (const record of sourceMap.frames ?? []) {
    const frame = frames[record.frameIndex];
    if (frame) {
      assert(record.path === frame.path, `source-map frame ${record.frameIndex}: path mismatch`);
      assert(record.sha256 === frame.digest, `source-map frame ${record.frameIndex}: SHA mismatch`);
      assert(record.footBaselineY === 854, `source-map frame ${record.frameIndex}: baseline mismatch`);
      assert(record.anchorToFootBaselinePixels === 29.2, `source-map frame ${record.frameIndex}: anchor offset mismatch`);
    }
  }
  for (const key of ['idlePackageApproved', 'canonicalApproved', 'runtimeEligible']) assert(sourceMap[key] === false, `source-map ${key} must be false`);
}

if (metrics) {
  assert(metrics.loopContinuity?.seamNotGreaterThanMaximumAdjacent === true, 'metrics loop seam invariant failed');
  assert(metrics.anchorDecision?.status === 'retained-after-measurement', 'anchor must be retained after measurement');
  for (const key of ['idlePackageApproved', 'canonicalApproved', 'runtimeEligible', 'runtimeIntegrated']) assert(metrics.status?.[key] === false, `metrics ${key} must be false`);
  assert(metrics.status?.neutralMasterApproved === true, 'metrics neutralMasterApproved must be true');
  for (const artifact of metrics.reviewArtifacts ?? []) {
    assert(fs.existsSync(artifact.path), `missing review artifact ${artifact.path}`);
    if (fs.existsSync(artifact.path)) assert(hash(artifact.path) === artifact.sha256, `review artifact SHA mismatch: ${artifact.path}`);
    assert(artifact.reviewOnly === true && artifact.runtimeEligible === false, `${artifact.id}: review-only flags mismatch`);
  }
}

if (contract) {
  assert(contract.characterId === 'hero.archer' && contract.state === 'idle', 'contract character/state mismatch');
  assert(contract.sourceNeutralMaster?.sha256 === SOURCE_SHA, 'contract source SHA mismatch');
  assert(contract.neutralMasterApproved === true, 'contract neutralMasterApproved must be true');
  for (const key of ['idlePackageApproved', 'canonicalApproved', 'runtimeEligible', 'runtimeIntegrated']) assert(contract[key] === false, `contract ${key} must be false`);
  assert(contract.moveGenerated === false && contract.attackGenerated === false, 'contract must record Move/Attack not generated');
}

if (errors.length) {
  console.error('Archer Idle Production v1 validation failed:');
  for (const error of errors) console.error(`- ${error}`);
  process.exit(1);
}
console.log('Archer Idle Production v1 validation passed: exact approved source, 8 unique 640x960 RGBA frames, pinned feet, measured anchor, smooth loop, provenance, and approval invariants verified.');
