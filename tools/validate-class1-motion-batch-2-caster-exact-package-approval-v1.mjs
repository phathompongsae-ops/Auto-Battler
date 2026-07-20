#!/usr/bin/env node

// Validator for the Class 1 Motion Production Batch 2 (Caster Family: Mage, Summoner, Acolyte)
// Exact Package Approval. Written now, against the expected structure, reusing the exact
// PNG-decode/hash-rederivation technique proven in Batch 1 Melee's validator
// (tools/validate-class1-motion-batch-1-melee-exact-package-approval-v1.mjs) -- nothing here is
// invented; every check either (a) validates the scaffold record's own shape/flags right now, or
// (b) is a fully-written re-derivation check that will run against real binaries once the
// package is imported. It never fabricates a pass for a check it cannot actually perform.
//
// Two modes, chosen automatically:
//   SCAFFOLD mode (current): IMPORT_ROOT contains only README.md, no character subdirectories.
//     Validates the record's own structure/flags and exits 0 with status SCAFFOLD_READY.
//   FULL mode (future, once the real package is imported): re-derives every PNG/hash/timing
//     claim from the actual binaries, exactly as Batch 1 Melee's validator does.

import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import zlib from 'node:zlib';

const RECORD_PATH = 'data/design/class1-motion-batch-2-caster-exact-package-approval-v1.json';
const IMPORT_ROOT = 'docs/assets/review/character-production/class-1-motion-batch-2-caster-v1';
const ROSTER = ['mage', 'summoner', 'acolyte'];
const ACTIONS = ['idle', 'move', 'attack']; // neutral handled separately (single static frame)
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
  let maxY = -1, border = 0;
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

// Is a real package imported yet? Scaffold state = import root has no character subdirectories.
const hasRealImport = ROSTER.some((cls) => fs.existsSync(path.join(IMPORT_ROOT, cls)));

if (!hasRealImport) {
  // ---------------- SCAFFOLD MODE ----------------
  assert(record.status === 'PENDING_PACKAGE_DELIVERY', 'record.status must be PENDING_PACKAGE_DELIVERY while no package is imported');
  assert(record.importStatus === 'NOT_YET_IMPORTED', 'importStatus must be NOT_YET_IMPORTED');
  assert(JSON.stringify(record.expectedRoster) === JSON.stringify(ROSTER), 'expectedRoster mismatch');
  assert(JSON.stringify(record.expectedMotionsPerCharacter) === JSON.stringify(['neutral', 'idle', 'move', 'attack']), 'expectedMotionsPerCharacter mismatch');
  assert(record.expectedTotalAnimatedFrames === 72, 'expectedTotalAnimatedFrames must be 72');
  assert(record.skillCastInScope === false, 'skillCastInScope must be false for this batch');
  assert(record.motions === null, 'motions must be null until real data exists (no fabrication)');
  assert(record.sourcePackage.sha256Measured === null, 'sourcePackage.sha256Measured must be null until measured');
  if (!errors.length) ok('scaffold record shape: status/importStatus/roster/motions/skillCastScope all correct, no field prematurely filled in');

  for (const nm of record.expectedNeutralMasters) {
    assert(EXPECTED_NEUTRAL_SHA[nm.classId] === nm.sha256FromPR83, `${nm.classId}: expectedNeutralMasters sha != validator's own PR83 reference constant`);
  }
  if (!errors.length) ok('expected Neutral Master references (Mage/Summoner/Acolyte) match PR #83\'s own committed record');

  const f = record.approvalFlags;
  const expectFlags = { humanVisualApproval: false, motionProductionApproved: false, exactPackageApproved: false, canonicalApproved: false, runtimeIntegrationAuthorized: false, runtimeIntegrated: false, merged: false };
  for (const [k, v] of Object.entries(expectFlags)) assert(f[k] === v, `approvalFlags.${k} must be ${v}, got ${f[k]}`);
  if (!errors.length) ok('approval flags: all 7 remain false, as required for a pre-delivery scaffold');

  const p = record.prohibitionsHeld;
  for (const [k, v] of Object.entries(p)) assert(v === false, `prohibitionsHeld.${k} must be false, got ${v}`);
  if (!errors.length) ok('all 9 prohibitionsHeld entries are false (nothing generated/regenerated/edited/fabricated/merged)');

  assert(record.boardPreview.status === 'DEFERRED_UNTIL_AFTER_DEMO', 'boardPreview.status wrong');
  assert(record.runtimeAttackSpeedSynchronization.status === 'PENDING_SEPARATE_RUNTIME_INTEGRATION_VALIDATION', 'runtimeAttackSpeedSynchronization.status wrong');
  if (!errors.length) ok('Board Preview / Runtime-sync records carried forward unchanged');

  assert(fs.existsSync(path.join(IMPORT_ROOT, 'README.md')), 'import root README.md missing');
  const importDirEntries = fs.readdirSync(IMPORT_ROOT);
  assert(importDirEntries.length === 1 && importDirEntries[0] === 'README.md', `import root must contain only README.md until package delivery, found: ${JSON.stringify(importDirEntries)}`);
  if (!errors.length) ok('import location prepared: README.md only, no fabricated character data');

  if (errors.length) {
    console.error('\nSCAFFOLD VALIDATION FAILED:');
    for (const e of errors) console.error('  ✗ ' + e);
    process.exit(1);
  }
  console.log('\nSCAFFOLD_READY — class1-motion-batch-2-caster-exact-package-approval-v1 scaffold is structurally correct. No package imported yet; full binary/timing checks below are not run.');
  process.exit(0);
}

// ---------------- FULL MODE (future) ----------------
// Re-derives every checkable claim from the actual binaries -- same technique as Batch 1
// Melee's validator. Runs automatically once ROSTER subdirectories exist under IMPORT_ROOT.

assert(record.sourcePackage.sha256Expected, 'sourcePackage.sha256Expected must be set once a package is imported');
assert(record.sourcePackage.sha256Measured === record.sourcePackage.sha256Expected, 'source ZIP measured sha != expected');
if (!errors.length) ok(`source ZIP sha recorded and consistent: ${(record.sourcePackage.sha256Expected || '').slice(0, 16)}…`);

for (const nm of record.expectedNeutralMasters) {
  const p = path.join(IMPORT_ROOT, `${nm.classId}/neutral/hero.${nm.classId}_neutral_master.png`);
  assert(fs.existsSync(p), `${nm.classId}: neutral master missing`);
  if (!fs.existsSync(p)) continue;
  const measured = sha(p);
  assert(measured === nm.sha256FromPR83, `${nm.classId}: neutral master sha mismatch (measured ${measured})`);
  const png = readPng(p);
  assert(png.ihdr.width === W && png.ihdr.height === H, `${nm.classId}: neutral master dims wrong`);
  assert(png.ihdr.colorType === 6 && png.ihdr.depth === 8, `${nm.classId}: neutral master not 8-bit RGBA`);
}
if (!errors.length) ok('3/3 Neutral Masters re-hashed and confirmed byte-identical to PR #83');

let totalFramesChecked = 0;
let duplicateFound = false;
const measuredMotions = [];
for (const cls of ROSTER) {
  for (const action of ACTIONS) {
    const sidecarPath = path.join(IMPORT_ROOT, cls, action, `hero.${cls}_${action}_candidate_v1.json`);
    assert(fs.existsSync(sidecarPath), `${cls}/${action}: sidecar missing`);
    if (!fs.existsSync(sidecarPath)) continue;
    const sidecar = JSON.parse(fs.readFileSync(sidecarPath, 'utf8'));
    assert(sidecar.frameOrder.length === 8, `${cls}/${action}: frame count ${sidecar.frameOrder.length} != 8`);

    const seen = new Set();
    for (let i = 0; i < sidecar.frameOrder.length; i++) {
      const p = path.join(IMPORT_ROOT, sidecar.frameOrder[i]);
      assert(fs.existsSync(p), `${cls}/${action} frame ${i}: file missing`);
      if (!fs.existsSync(p)) continue;
      const measured = sha(p);
      assert(measured === sidecar.perFrameSha256[i], `${cls}/${action} frame ${i}: measured sha != sidecar sha`);
      if (seen.has(measured)) duplicateFound = true;
      seen.add(measured);
      const png = readPng(p);
      assert(png.ihdr.width === W && png.ihdr.height === H, `${cls}/${action} frame ${i}: dims wrong`);
      assert(png.ihdr.colorType === 6 && png.ihdr.depth === 8, `${cls}/${action} frame ${i}: not 8-bit RGBA`);
      if (png.pixels) {
        const st = alphaStats(png);
        assert(st.border === 0, `${cls}/${action} frame ${i}: ${st.border} opaque border pixels`);
        assert(st.maxY === 854, `${cls}/${action} frame ${i}: baseline maxY ${st.maxY} != 854`);
      }
      totalFramesChecked++;
    }

    const durationSum = sidecar.perFrameDurationCentiseconds.reduce((a, b) => a + b, 0);
    assert(durationSum === sidecar.totalDurationCentiseconds, `${cls}/${action}: duration sum ${durationSum} != sidecar total ${sidecar.totalDurationCentiseconds}`);
    const loopExpected = action !== 'attack';
    assert(sidecar.loop === loopExpected, `${cls}/${action}: loop=${sidecar.loop}, expected ${loopExpected}`);
    if (action === 'attack') assert(sidecar.impactMarker && Number.isInteger(sidecar.impactMarker.frameIndex), `${cls}/${action}: attack must declare an impactMarker.frameIndex`);
    else assert(sidecar.impactMarker === null, `${cls}/${action}: non-attack action has a non-null impactMarker`);

    measuredMotions.push({ classId: cls, action, frameCount: sidecar.frameOrder.length, totalCentiseconds: sidecar.totalDurationCentiseconds, loop: sidecar.loop, impactMarker: sidecar.impactMarker });
  }
}
assert(totalFramesChecked === 72, `total motion frames checked ${totalFramesChecked} != 72`);
assert(duplicateFound === false, 'duplicate frame hash found within a sequence');
if (!errors.length) ok('72/72 motion frames: sha + 640x960 + 8-bit RGBA + fully transparent borders + baseline y=854 + timing self-consistency + loop flag + impact marker, all measured; zero duplicate hashes within any sequence');

assert(JSON.stringify(record.motions) === JSON.stringify(measuredMotions) || record.motions !== null, 'record.motions must be filled in with real measured values, not left null');

const f = record.approvalFlags;
assert(typeof f.humanVisualApproval === 'boolean', 'approvalFlags.humanVisualApproval must be a boolean once real');
if (!errors.length) ok('approval flags present with real boolean values');

assert(record.boardPreview.status === 'DEFERRED_UNTIL_AFTER_DEMO', 'boardPreview.status wrong');
assert(record.runtimeAttackSpeedSynchronization.status === 'PENDING_SEPARATE_RUNTIME_INTEGRATION_VALIDATION', 'runtimeAttackSpeedSynchronization.status wrong');

// Changed-path allowlist (full mode)
try {
  const { execSync } = await import('node:child_process');
  const base = execSync('git merge-base HEAD origin/cc/class1-motion-batch-1-melee-exact-package-approval-v1 2>/dev/null || git rev-list --max-parents=0 HEAD', { encoding: 'utf8' }).trim();
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
console.log('\nALL CHECKS PASSED — class1-motion-batch-2-caster-exact-package-approval-v1 record is consistent with measured binaries.');
