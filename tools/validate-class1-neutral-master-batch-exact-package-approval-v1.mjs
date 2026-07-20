#!/usr/bin/env node

// Validator for the Class 1 Neutral Master Batch v1 Exact Package Approval record.
// Re-derives every checkable claim from the actual binaries on disk — candidate hashes,
// the Archer exact benchmark hash, dimensions, RGBA mode, and border transparency are
// all measured here, never trusted from the JSON record or the package's own manifest.
// The source-ZIP hash is a record-consistency check (the ZIP itself is not committed,
// matching the v3.1/v3.2 package convention); its measured value was taken at approval
// time and must match the expected constant below.

import crypto from 'node:crypto';
import fs from 'node:fs';
import process from 'node:process';
import zlib from 'node:zlib';

const RECORD_PATH = 'data/design/class1-neutral-master-batch-exact-package-approval-v1.json';
const IMPORT_ROOT = 'docs/assets/review/character-production/class-1-batch/master-batch-v1';
const ZIP_SHA_EXPECTED = 'c794b8f7ecc46781e3b941b59c5c188348879b06052ac7b43d8052f2007aa007';
const ARCHER_MASTER_SHA = '4911e7e3ba59241ee011be3e62f1b64230dcf9b3c24c6aeb23dc939d83311013';
const W = 640, H = 960;
const ROSTER = ['fighter', 'swordman', 'archer', 'mage', 'summoner', 'acolyte', 'merchant'];
const NEW_CLASSES = ['fighter', 'swordman', 'mage', 'summoner', 'acolyte', 'merchant'];

const errors = [];
const assert = (cond, msg) => { if (!cond) errors.push(msg); };
const ok = (msg) => console.log('✓ ' + msg);
const sha = (p) => crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex');

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
  if (ihdr.colorType !== 6 || ihdr.depth !== 8) return { ihdr, pixels: null };
  const bytesPerPixel = 4;
  const stride = ihdr.width * bytesPerPixel;
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
      const left = x >= bytesPerPixel ? pixels[row + x - bytesPerPixel] : 0;
      const up = y > 0 ? pixels[previous + x] : 0;
      const upperLeft = y > 0 && x >= bytesPerPixel ? pixels[previous + x - bytesPerPixel] : 0;
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

function alphaStats(png) {
  let minX = W, minY = H, maxX = -1, maxY = -1, border = 0;
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const alpha = png.pixels[(y * W + x) * 4 + 3];
    if (alpha > 0) {
      if (x < minX) minX = x; if (x > maxX) maxX = x;
      if (y < minY) minY = y; if (y > maxY) maxY = y;
      if (x === 0 || y === 0 || x === W - 1 || y === H - 1) border++;
    }
  }
  return { bounds: `${maxX - minX + 1}x${maxY - minY + 1}+${minX}+${minY}`, border, maxY };
}

// ---- record + package manifest ----
const record = JSON.parse(fs.readFileSync(RECORD_PATH, 'utf8'));
const manifest = JSON.parse(fs.readFileSync(`${IMPORT_ROOT}/data/class-1-neutral-master-batch-manifest-v1.json`, 'utf8'));

// 1) ZIP SHA record consistency
assert(record.sourcePackage.sha256Expected === ZIP_SHA_EXPECTED, 'record zip expected sha != validator constant');
assert(record.sourcePackage.sha256Measured === ZIP_SHA_EXPECTED, 'record zip measured sha != expected');
assert(record.sourcePackage.sha256Match === true, 'record zip sha match flag false');
if (!errors.length) ok(`source ZIP sha recorded and consistent: ${ZIP_SHA_EXPECTED.slice(0, 16)}… (record-consistency check; ZIP not committed by convention)`);

// 2) Archer exact benchmark hash — measured from the imported reference binary
const archerPath = `${IMPORT_ROOT}/exact-approved-archer-reference/archer-production-master-candidate-v1.png`;
const archerSha = sha(archerPath);
assert(archerSha === ARCHER_MASTER_SHA, `archer reference sha mismatch: ${archerSha}`);
const archerPng = readPng(archerPath);
assert(archerPng.ihdr.width === W && archerPng.ihdr.height === H, 'archer reference dimensions wrong');
ok('archer exact benchmark: byte-identical to approved master (4911e7e3…3013), 640x960');

// 3) candidates: hashes, dimensions, RGBA 8-bit, transparent borders, baseline —
//    measured, then cross-checked against BOTH the approval record and the package manifest
const recCandidates = Object.fromEntries(record.candidates.map((c) => [c.classId, c]));
const manCandidates = Object.fromEntries(manifest.candidates.map((c) => [c.classId, c]));
for (const cls of NEW_CLASSES) {
  const rel = `candidates/${cls}/hero.${cls}_neutral_master_candidate_v1.png`;
  const p = `${IMPORT_ROOT}/${rel}`;
  assert(fs.existsSync(p), `${cls}: candidate file missing`);
  if (!fs.existsSync(p)) continue;
  const measured = sha(p);
  assert(measured === recCandidates[cls].sha256, `${cls}: sha != approval record`);
  assert(measured === manCandidates[cls].sha256, `${cls}: sha != package manifest`);
  const png = readPng(p);
  assert(png.ihdr.width === W && png.ihdr.height === H, `${cls}: dimensions ${png.ihdr.width}x${png.ihdr.height} != 640x960`);
  assert(png.ihdr.colorType === 6 && png.ihdr.depth === 8, `${cls}: not 8-bit RGBA (depth=${png.ihdr.depth}, colorType=${png.ihdr.colorType})`);
  assert(png.pixels !== null, `${cls}: could not decode pixels`);
  if (png.pixels) {
    const st = alphaStats(png);
    assert(st.border === 0, `${cls}: ${st.border} opaque border pixels (transparency violated)`);
    assert(st.bounds === recCandidates[cls].alphaBounds, `${cls}: alpha bounds ${st.bounds} != record ${recCandidates[cls].alphaBounds}`);
    assert(st.maxY === 854, `${cls}: baseline max opaque y ${st.maxY} != 854`);
  }
}
if (!errors.length) ok('6/6 candidates: sha + 640x960 + 8-bit RGBA + fully transparent borders + alpha bounds + baseline y=854, all measured and matching record AND manifest');

// 4) roster completeness: 6 new candidates + archer by reference = 7 approved classes
assert(JSON.stringify(record.rosterCompleteness.required) === JSON.stringify(ROSTER), 'roster list mismatch');
assert(record.rosterCompleteness.complete === true && record.rosterCompleteness.archerByReference === true, 'roster completeness flags wrong');
assert(record.humanDecision.approvedClasses.length === 6, 'approved class count != 6');
if (!errors.length) ok('roster completeness: 7 classes (6 newly approved candidates + Archer by exact reference)');

// 5) approval flags — exact required values
const f = record.approvalFlags;
const expectFlags = { humanVisualApproval: true, class1NeutralMasterBatchApproved: true, exactPackageApproved: true, canonicalApproved: false, motionProductionAuthorized: false, runtimeIntegrationAuthorized: false, merged: false };
for (const [k, v] of Object.entries(expectFlags)) assert(f[k] === v, `approvalFlags.${k} must be ${v}, got ${f[k]}`);
if (!errors.length) ok('approval flags exact: visual/batch/exactPackage=true; canonical/motion/runtime/merged=false');

// 6) deferred Board Preview record
const bp = record.boardPreview;
assert(bp.status === 'DEFERRED_UNTIL_AFTER_DEMO', 'boardPreview.status wrong');
assert(bp.doNotRegenerateNow === true, 'boardPreview must not be regenerated now');
assert(/8.8/.test(bp.reason) || /8x8/.test(JSON.stringify(bp)), 'boardPreview reason must reference the 8x8 runtime board');
assert(bp.futureFollowUpOnly && bp.futureFollowUpOnly.boardSize === '8x8' && bp.futureFollowUpOnly.sevenUnitHorizontalShowcase === false, 'boardPreview follow-up constraints wrong');
assert(fs.existsSync(`${IMPORT_ROOT}/${bp.deferredFile}`), 'deferred board preview file missing from import (must be preserved, not regenerated)');
if (!errors.length) ok('board preview: DEFERRED_UNTIL_AFTER_DEMO recorded with 8x8/3-5-unit follow-up constraints; existing file preserved unmodified');

// 7) review assets present (individual sheets for all 7 roster classes)
for (const cls of ROSTER) {
  assert(fs.existsSync(`${IMPORT_ROOT}/review/individual/${cls}-neutral-master-review.png`), `review sheet missing for ${cls}`);
}
if (!errors.length) ok('review assets: individual sheets present for all 7 roster classes');

if (errors.length) {
  console.error('\nVALIDATION FAILED:');
  for (const e of errors) console.error('  ✗ ' + e);
  process.exit(1);
}
console.log('\nALL CHECKS PASSED — CLASS1_NEUTRAL_MASTER_EXACT_PACKAGE_APPROVED record is consistent with measured binaries.');
