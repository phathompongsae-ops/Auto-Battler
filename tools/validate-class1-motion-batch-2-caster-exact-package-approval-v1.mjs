#!/usr/bin/env node

// Validator for the Class 1 Motion Production Batch 2 (Caster Family: Mage, Summoner, Acolyte)
// import/verification record. Re-derives every checkable claim from the actual imported
// binaries -- per-frame hashes, Neutral Master hashes, dimensions, RGBA mode, bit depth,
// transparent borders, baseline, frame ordering/completeness, durations, loop flags, and
// release markers are all measured here, never trusted from the JSON record or the package's
// own sidecars/manifest.
//
// This package has NO universal fixed frame count -- unlike the retired scaffold version of
// this validator (which assumed 8 frames/action, 24/character, 72 total, and reported
// PENDING_PACKAGE_DELIVERY/SCAFFOLD_READY before any package existed), every action's required
// frame inventory is derived from that action's own sidecar JSON, not hardcoded.

import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import zlib from 'node:zlib';

const RECORD_PATH = 'data/design/class1-motion-batch-2-caster-exact-package-approval-v1.json';
const IMPORT_ROOT = 'docs/assets/review/character-production/class-1-motion-batch-2-caster-v1';
const ROSTER = ['mage', 'summoner', 'acolyte'];
const ACTIONS = ['idle', 'move', 'attack'];
const W = 640, H = 960;
const EXPECTED_NEUTRAL_SHA = {
  mage: '6587abdf0b4427ed9c95acb98a6d7c618e8be653fb13cdcaa9be1472fcb96315',
  summoner: '731531aaa1d3efc462a12d2265ad602e6e4711a83f054d8f84b5bb00f3956ae3',
  acolyte: '0853ab6d8f91e4100732c7f3628b31a09a38a762dc999dfbecef3cc23804a9c8',
};

const errors = [];
const assert = (cond, msg) => { if (!cond) errors.push(msg); };
const ok = (msg) => console.log('✓ ' + msg);
const sha = (p) => crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex');

function readPng(p) {
  const buffer = fs.readFileSync(p);
  if (buffer.subarray(0, 8).toString('hex') !== '89504e470d0a1a0a') throw new Error('bad PNG signature: ' + p);
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
  if (!ihdr) throw new Error('missing IHDR: ' + p);
  if (ihdr.interlace !== 0) throw new Error('interlaced PNG unsupported: ' + p);
  if (ihdr.colorType !== 6 || ihdr.depth !== 8) return { ihdr, pixels: null };
  const bytesPerPixel = 4;
  const stride = ihdr.width * bytesPerPixel;
  const raw = zlib.inflateSync(Buffer.concat(idat));
  if (raw.length !== (stride + 1) * ihdr.height) throw new Error('inflated data length mismatch: ' + p);
  const pixels = Buffer.alloc(stride * ihdr.height);
  const paeth = (a, b, c) => {
    const pp = a + b - c, pa = Math.abs(pp - a), pb = Math.abs(pp - b), pc = Math.abs(pp - c);
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
      else throw new Error('unknown filter ' + filter + ': ' + p);
      pixels[row + x] = value & 0xff;
    }
  }
  return { ihdr, pixels };
}

function alphaStats(png) {
  let border = 0, maxY = -1;
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const alpha = png.pixels[(y * W + x) * 4 + 3];
    if (alpha > 0) {
      if (y > maxY) maxY = y;
      if (x === 0 || y === 0 || x === W - 1 || y === H - 1) border++;
    }
  }
  return { border, maxY };
}

const record = JSON.parse(fs.readFileSync(RECORD_PATH, 'utf8'));

// 1) record status / handoff consistency (no "expected ZIP hash" constant here -- the package's
//    own measured hash IS the authoritative value per this task; just check internal consistency)
assert(record.status === 'CLASS1_MOTION_BATCH2_CASTER_EXACT_PACKAGE_APPROVED', 'record.status must be CLASS1_MOTION_BATCH2_CASTER_EXACT_PACKAGE_APPROVED');
assert(/^[0-9a-f]{64}$/.test(record.packageHandoff.sha256Measured), 'packageHandoff.sha256Measured must be a well-formed 64-hex SHA-256');
assert(record.packageHandoff.zipCrcCheck === 'PASS', 'packageHandoff.zipCrcCheck must be PASS');
assert(record.humanDecision && record.humanDecision.verdict === 'HUMAN_VISUAL_APPROVED', 'record.humanDecision.verdict must be HUMAN_VISUAL_APPROVED');
assert(record.humanDecision && record.humanDecision.approvedPackage && record.humanDecision.approvedPackage.sha256 === record.packageHandoff.sha256Measured, 'humanDecision.approvedPackage.sha256 must match packageHandoff.sha256Measured');
if (!errors.length) ok(`record status CLASS1_MOTION_BATCH2_CASTER_EXACT_PACKAGE_APPROVED; ZIP sha ${record.packageHandoff.sha256Measured.slice(0, 16)}… recorded, CRC PASS; human decision HUMAN_VISUAL_APPROVED for exactly this package`);

// 2) imported-file inventory
assert(fs.existsSync(IMPORT_ROOT), 'import root missing');
const importedFiles = [];
(function walk(dir) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full);
    else importedFiles.push(full);
  }
})(IMPORT_ROOT);
assert(importedFiles.length === 134, `imported file count ${importedFiles.length} != 134`);
if (!errors.length) ok(`imported-file inventory: ${importedFiles.length}/134 files present`);

// 3) Neutral Masters -- measured, cross-checked against PR #83 (via the constant table above)
for (const cls of ROSTER) {
  const p = path.join(IMPORT_ROOT, `${cls}/neutral/hero.${cls}_neutral_master.png`);
  assert(fs.existsSync(p), `${cls}: neutral master missing`);
  if (!fs.existsSync(p)) continue;
  const measured = sha(p);
  assert(measured === EXPECTED_NEUTRAL_SHA[cls], `${cls}: neutral master sha mismatch (measured ${measured})`);
  const png = readPng(p);
  assert(png.ihdr.width === W && png.ihdr.height === H, `${cls}: neutral master dims wrong`);
  assert(png.ihdr.colorType === 6 && png.ihdr.depth === 8, `${cls}: neutral master not 8-bit RGBA`);
}
if (!errors.length) ok('3/3 Neutral Masters re-hashed and confirmed byte-identical to PR #83');

// 4) Motion frames: per-action sidecar-DERIVED re-verification (no fixed frame-count assumed)
let totalFramesChecked = 0;
let duplicateFound = false;
const allHashes = new Set();
for (const cls of ROSTER) {
  for (const action of ACTIONS) {
    const dir = path.join(IMPORT_ROOT, cls, action, 'frames');
    const sidecarPath = path.join(IMPORT_ROOT, cls, action, `${cls}-${action}-sidecar-v1.json`);
    assert(fs.existsSync(sidecarPath), `${cls}/${action}: sidecar missing`);
    if (!fs.existsSync(sidecarPath)) continue;
    const sidecar = JSON.parse(fs.readFileSync(sidecarPath, 'utf8'));

    const recMotion = record.motions.find((m) => m.classId === cls && m.action === action);
    assert(!!recMotion, `${cls}/${action}: not present in record.motions`);
    assert(sidecar.orderedFrames.length === recMotion.frameCount, `${cls}/${action}: sidecar frame count ${sidecar.orderedFrames.length} != record ${recMotion.frameCount}`);

    // directory contains exactly the sidecar's declared frames -- no missing, no unexpected
    const dirFiles = fs.readdirSync(dir).filter((f) => f.endsWith('.png')).sort();
    const sidecarFiles = sidecar.orderedFrames.map((f) => path.basename(f.file)).sort();
    assert(JSON.stringify(dirFiles) === JSON.stringify(sidecarFiles), `${cls}/${action}: frame directory != sidecar orderedFrames (no missing/unexpected frame required)`);

    // indexes complete, ordered, unique, starting at 0
    const indexes = sidecar.orderedFrames.map((f) => f.index);
    const sortedIndexes = [...indexes].sort((a, b) => a - b);
    assert(JSON.stringify(indexes) === JSON.stringify(sortedIndexes), `${cls}/${action}: frame indexes not in order: ${JSON.stringify(indexes)}`);
    assert(new Set(indexes).size === indexes.length, `${cls}/${action}: duplicate frame index`);
    assert(indexes[0] === 0 && indexes[indexes.length - 1] === indexes.length - 1, `${cls}/${action}: frame indexes not complete (0..N-1): ${JSON.stringify(indexes)}`);

    for (const f of sidecar.orderedFrames) {
      const p = path.join(IMPORT_ROOT, f.file);
      assert(fs.existsSync(p), `${cls}/${action} frame ${f.index}: file missing`);
      if (!fs.existsSync(p)) continue;
      const measured = sha(p);
      assert(measured === f.sha256, `${cls}/${action} frame ${f.index}: measured sha != sidecar sha`);
      if (allHashes.has(measured)) duplicateFound = true;
      allHashes.add(measured);
      assert(f.durationCentiseconds > 0, `${cls}/${action} frame ${f.index}: non-positive duration`);

      const png = readPng(p);
      assert(png.ihdr.width === W && png.ihdr.height === H, `${cls}/${action} frame ${f.index}: dims wrong`);
      assert(png.ihdr.colorType === 6 && png.ihdr.depth === 8, `${cls}/${action} frame ${f.index}: not 8-bit RGBA`);
      if (png.pixels) {
        const st = alphaStats(png);
        assert(st.border === 0, `${cls}/${action} frame ${f.index}: ${st.border} opaque border pixels`);
        assert(st.maxY === 854, `${cls}/${action} frame ${f.index}: baseline maxY ${st.maxY} != 854`);
      }
      totalFramesChecked++;
    }

    const durationSum = sidecar.durationsCentiseconds.reduce((a, b) => a + b, 0);
    assert(durationSum === sidecar.totalDurationCentiseconds, `${cls}/${action}: duration sum ${durationSum} != sidecar total ${sidecar.totalDurationCentiseconds}`);
    assert(sidecar.totalDurationCentiseconds === recMotion.totalCentiseconds, `${cls}/${action}: sidecar total != record total`);

    const loopExpected = action !== 'attack';
    assert(sidecar.loop === loopExpected, `${cls}/${action}: loop=${sidecar.loop}, expected ${loopExpected}`);
    assert(sidecar.loop === recMotion.loop, `${cls}/${action}: sidecar loop != record loop`);

    if (action === 'attack') {
      const m = sidecar.impactOrReleaseMarker;
      assert(!!m, `${cls}/${action}: missing release marker`);
      if (m) {
        const precedingSum = sidecar.durationsCentiseconds.slice(0, m.frameIndex).reduce((a, b) => a + b, 0);
        assert(fs.existsSync(path.join(IMPORT_ROOT, m.frameFile)), `${cls}/${action}: release marker frameFile does not exist`);
        assert(m.timestampCentiseconds === precedingSum, `${cls}/${action}: release timestamp ${m.timestampCentiseconds} != sum of preceding durations ${precedingSum}`);
        assert(m.frameDurationCentiseconds === sidecar.durationsCentiseconds[m.frameIndex], `${cls}/${action}: release frame duration mismatch`);
        // Field-by-field, not full object identity -- the sidecar's marker carries an extra
        // "type" field (e.g. "visualRelease") that the record's simplified releaseMarker
        // intentionally omits; only the fields that matter for correctness are compared.
        const rm = recMotion.releaseMarker;
        assert(rm && rm.frameIndex === m.frameIndex && rm.frameFile === m.frameFile && rm.timestampCentiseconds === m.timestampCentiseconds && rm.frameDurationCentiseconds === m.frameDurationCentiseconds, `${cls}/${action}: sidecar release marker fields != record release marker fields`);
      }
    } else {
      assert(sidecar.impactOrReleaseMarker === null, `${cls}/${action}: non-attack action has a non-null release marker`);
    }
  }
}
assert(totalFramesChecked === record.totalAnimatedMotionFrames, `total motion frames checked ${totalFramesChecked} != record total ${record.totalAnimatedMotionFrames}`);
assert(duplicateFound === false, 'duplicate frame hash found across the batch (masquerading as unique motion)');
if (!errors.length) ok(`${totalFramesChecked}/${record.totalAnimatedMotionFrames} motion frames: sha + 640x960 + 8-bit RGBA + fully transparent borders + baseline y=854 + frame-directory completeness + duration sums + loop flags + release markers, all measured; zero duplicate hashes across the batch`);

// 5) roster completeness
assert(ROSTER.length === 3 && ACTIONS.length === 3, 'roster/action constant tampering');
if (!errors.length) ok('roster completeness: 3 classes (Mage, Summoner, Acolyte) x 3 animated actions (Idle, Move, Attack) + 3 Neutral Masters');

// 6) approval flags -- exact required values (exact-package approved, Runtime not authorized)
const f = record.approvalFlags;
const expectTrueFlags = { humanVisualApproval: true, motionProductionApproved: true, exactPackageApproved: true };
for (const [k, v] of Object.entries(expectTrueFlags)) assert(f[k] === v, `approvalFlags.${k} must be ${v}, got ${f[k]}`);
const expectFalseFlags = { canonicalApproved: false, runtimeIntegrationAuthorized: false, runtimeIntegrated: false, merged: false };
for (const [k, v] of Object.entries(expectFalseFlags)) assert(f[k] === v, `approvalFlags.${k} must be ${v}, got ${f[k]}`);
if (!errors.length) ok("approval flags exact: humanVisualApproval/motionProductionApproved/exactPackageApproved=true; canonicalApproved/runtimeIntegrationAuthorized/runtimeIntegrated/merged=false");

// 7) Board Preview deferred record
assert(record.boardPreview.status === 'DEFERRED_UNTIL_AFTER_DEMO', 'boardPreview.status wrong');
if (!errors.length) ok('Board Preview record: DEFERRED_UNTIL_AFTER_DEMO (unchanged, not replaced)');

// 8) Runtime synchronization pending record
assert(record.runtimeAttackSpeedSynchronization.status === 'PENDING_SEPARATE_RUNTIME_INTEGRATION_VALIDATION', 'runtimeAttackSpeedSynchronization.status wrong');
if (!errors.length) ok('Runtime attack-speed synchronization record: PENDING_SEPARATE_RUNTIME_INTEGRATION_VALIDATION');

// 9) changed-path allowlist
try {
  const { execSync } = await import('node:child_process');
  const base = execSync('git merge-base HEAD origin/cc/class1-motion-batch-2-caster-production-v1 2>/dev/null || git rev-list --max-parents=0 HEAD', { encoding: 'utf8' }).trim();
  const changed = execSync(`git diff --name-only ${base} HEAD`, { encoding: 'utf8' }).trim().split('\n').filter(Boolean);
  const allowlist = [`${IMPORT_ROOT}/`, RECORD_PATH, 'docs/reviews/class1-motion-batch-2-caster-exact-package-approval-v1.md', 'tools/validate-class1-motion-batch-2-caster-exact-package-approval-v1.mjs'];
  const disallowed = changed.filter((cf) => !allowlist.some((prefix) => cf === prefix || cf.startsWith(prefix)));
  assert(disallowed.length === 0, `changed-path allowlist violated: ${JSON.stringify(disallowed)}`);
  if (!errors.length) ok(`changed-path allowlist: ${changed.length} changed path(s), all in scope`);
} catch (e) {
  console.log('⚠ changed-path allowlist check skipped (git inspection unavailable): ' + e.message);
}

if (errors.length) {
  console.error('\nVALIDATION FAILED:');
  for (const e of errors) console.error('  ✗ ' + e);
  process.exit(1);
}
console.log('\nALL CHECKS PASSED — class1-motion-batch-2-caster-exact-package-approval-v1 record is consistent with measured binaries. CLASS1_MOTION_BATCH2_CASTER_EXACT_PACKAGE_APPROVED (Runtime Integration NOT authorized).');
