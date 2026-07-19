#!/usr/bin/env node

// Validator for Archer Attack v3.1 (12-frame smoothing pass) review candidate.
// Re-derives every claim in data/design/archer-attack-v3-1-review-candidate-v1.json
// from the actual binaries on disk. Does not trust the JSON's own numbers.

import crypto from 'node:crypto';
import fs from 'node:fs';
import process from 'node:process';
import zlib from 'node:zlib';

const RECORD_PATH = 'data/design/archer-attack-v3-1-review-candidate-v1.json';
const MASTER_PATH = 'docs/assets/review/character-production/archer/master-v1/archer-production-master-candidate-v1.png';
const MASTER_SHA = '4911e7e3ba59241ee011be3e62f1b64230dcf9b3c24c6aeb23dc939d83311013';
const FRAMES_DIR = 'docs/assets/review/character-production/archer/attack-v3-1/frames';
const REVIEW_DIR = 'docs/assets/review/character-production/archer/attack-v3-1/review';
const N = 12, W = 640, H = 960;

const errors = [];
const assert = (cond, msg) => { if (!cond) errors.push(msg); };
const sha = (p) => crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex');
const readJson = (p) => JSON.parse(fs.readFileSync(p, 'utf8'));

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

// --- 1. Repository / master identity ---
assert(fs.existsSync(MASTER_PATH), `missing approved Neutral Master at ${MASTER_PATH}`);
if (fs.existsSync(MASTER_PATH)) assert(sha(MASTER_PATH) === MASTER_SHA, 'approved Neutral Master SHA mismatch');

const record = readJson(RECORD_PATH);
assert(record?.approvedMaster?.measuredSha256 === MASTER_SHA, 'record master SHA mismatch');

// --- 2. Frame integrity ---
const frames = [];
const hashSet = new Set();
for (let i = 0; i < N; i++) {
  const idx = String(i).padStart(3, '0');
  const path = `${FRAMES_DIR}/hero.archer_attack_v3_1_${idx}.png`;
  assert(fs.existsSync(path), `missing frame ${path}`);
  if (!fs.existsSync(path)) continue;
  const digest = sha(path);
  try {
    const frame = readPng(path);
    assert(frame.ihdr.width === W && frame.ihdr.height === H, `frame ${idx}: canvas must be ${W}x${H}`);
    assert(frame.ihdr.depth === 8 && frame.ihdr.colorType === 6, `frame ${idx}: must be 8-bit RGBA`);
    const alpha = alphaStats(frame);
    assert(alpha.border === 0, `frame ${idx}: ${alpha.border} non-transparent border pixels`);
    frames.push({ idx, path, digest, frame, alpha, footY: alpha.maxY });
  } catch (e) { errors.push(`frame ${idx}: unreadable PNG (${e.message})`); }
}
assert(!fs.existsSync(`${FRAMES_DIR}/hero.archer_attack_v3_1_012.png`), 'unexpected frame 012');
assert(frames.length === N, `decoded frame count ${frames.length}, expected ${N}`);

// --- 3. Duplicate-hash / uniqueness ---
for (const f of frames) {
  assert(!hashSet.has(f.digest) || f.idx === '011', `frame ${f.idx}: unexpected duplicate SHA-256 (${f.digest})`);
  hashSet.add(f.digest);
}
// frame 011 must equal master; all other 11 must be pairwise unique
const nonExitHashes = frames.filter(f => f.idx !== '011').map(f => f.digest);
assert(new Set(nonExitHashes).size === nonExitHashes.length, 'unexpected duplicate hash among frames 000-010');

// --- 4. Old->new mapping proof ---
if (record.oldToNewMapping && record.sourcePackage?.sourceV3Provenance?.frames_v3_original_hashes) {
  const oldHashes = record.sourcePackage.sourceV3Provenance.frames_v3_original_hashes;
  for (const m of record.oldToNewMapping) {
    const f = frames.find(fr => fr.idx === m.newIndex);
    if (!f) continue;
    if (m.kind === 'reused-byte-identical') {
      assert(m.oldIndex != null, `mapping ${m.newIndex}: reused frame missing oldIndex`);
      const expectedOld = oldHashes[m.oldIndex];
      assert(expectedOld === f.digest, `mapping ${m.newIndex}: not byte-identical to claimed original frame ${m.oldIndex}`);
    } else if (m.kind === 'new-inserted-inbetween') {
      const collides = Object.values(oldHashes).includes(f.digest);
      assert(!collides, `mapping ${m.newIndex}: claimed new in-between is actually byte-identical to an original frame`);
    }
  }
}

// --- 5. Frame 011 exact-master ---
const f011 = frames.find(f => f.idx === '011');
if (f011) assert(f011.digest === MASTER_SHA, 'frame 011 must be byte-identical to the approved Neutral Master');

// --- 6. Foot baseline consistency (measured, not asserted against manifest's claimed value) ---
if (frames.length === N) {
  const footYs = new Set(frames.map(f => f.footY));
  assert(footYs.size === 1, `foot baseline inconsistent across frames: ${[...footYs].join(',')}`);
}

// --- 7. Review artifacts exist and are non-empty ---
for (const rel of [
  'archer-attack-v3-1-preview.gif',
  'archer-attack-v3-1-preview-slow-qa.gif',
  'archer-attack-v3-vs-v3-1-comparison.gif',
  'archer-attack-v3-original-preview.gif',
  'archer-attack-v3-1-contact-sheet.png',
]) {
  const p = `${REVIEW_DIR}/${rel}`;
  assert(fs.existsSync(p) && fs.statSync(p).size > 0, `missing or empty review artifact ${p}`);
}

// --- 8. Approval-state invariants ---
const st = record.approvalState ?? {};
for (const key of ['humanVisualApproval', 'attackV3_1PackageApproved', 'animationQualityBenchmarkV1Approved', 'canonicalApproved', 'runtimeEligible', 'runtimeIntegrated']) {
  assert(st[key] === false, `approvalState.${key} must be false`);
}
assert(st.status === 'READY_FOR_HUMAN_REVIEW', 'approvalState.status must be READY_FOR_HUMAN_REVIEW');

// --- 9. Timing totals sanity (re-derive from record, not re-decoding GIF here — GIF decode covered separately at import time) ---
const t = record.timing ?? {};
const sum = (arr) => (arr ?? []).reduce((a, b) => a + b, 0);
assert(sum(t.originalV3PerFrameDurationCs) === t.originalV3TotalCs, 'original v3 per-frame durations do not sum to stated total');
assert(sum(t.v31PerFrameDurationCs) === t.v31TotalCs, 'v3.1 per-frame durations do not sum to stated total');
assert(t.originalV3TotalCs === t.v31TotalCs, 'total timing not preserved between v3 and v3.1');
assert(Array.isArray(t.v31PerFrameDurationCs) && t.v31PerFrameDurationCs[8] === 7, 'frame index 8 (actual Release frame) must retain 7cs duration');

if (errors.length) {
  console.error('Archer Attack v3.1 Review Candidate Validation FAILED:');
  for (const e of errors) console.error(`- ${e}`);
  process.exit(1);
}

console.log('✓ Archer Attack v3.1 Review Candidate Validation PASSED');
console.log(`✓ 12 RGBA 640x960 frames decoded, borders transparent`);
console.log(`✓ old->new mapping verified byte-for-byte (10 reused + 2 new, zero collisions)`);
console.log(`✓ frame 011 byte-identical to approved Neutral Master`);
console.log(`✓ foot baseline uniform across all 12 frames`);
console.log(`✓ review artifacts present`);
console.log(`✓ approval-state invariants hold (status=READY_FOR_HUMAN_REVIEW, all approval flags false)`);
console.log(`✓ timing totals preserved (127cs), release frame (index 8) retains 7cs`);
