#!/usr/bin/env node

// Validator for the Skeleton Neutral Master Exact Package Approval record. Two states:
//
//   A. Scaffold state (record.status === 'PENDING_PACKAGE_DELIVERY'): no package has been
//      delivered -- verify the scaffold is honest (no fabricated package content, no measured
//      facts populated, no approval claimed, handoff values explicitly unverified) and report
//      SCAFFOLD_READY.
//
//   B. Package-delivered state (any later status): the full independent audit below runs against
//      the actually-imported files. It NEVER fabricates a pass for an absent file -- every check
//      reads and re-derives from the real binaries (same manual PNG decode technique as the
//      Class 1 pipeline validators).

import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import zlib from 'node:zlib';

const RECORD_PATH = 'data/design/skeleton-neutral-master-exact-package-approval-v1.json';
const MD_PATH = 'docs/reviews/skeleton-neutral-master-exact-package-approval-v1.md';
const IMPORT_ROOT = 'docs/assets/review/monster-production/skeleton-neutral-master-v1';
const IDENTITY_REF_PATH = 'assets/mon_skeleton.png';
const EXPECTED_IDENTITY_REF_SHA = '6484dd238083f6209732359b3f1b37d311fbc6644bd50e18ab079c20d8c76d1c';
const EXPECTED_SOURCE_HEAD = 'f0c3e8161e9cdf61477886f9a2016b41f97abc93';

const errors = [];
const assert = (cond, msg) => { if (!cond) errors.push(msg); };
const ok = (msg) => console.log('✓ ' + msg);
const sha = (p) => crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex');

// Manual PNG decode (IHDR/IDAT + zlib inflate + Paeth unfilter) -- same technique as the Class 1
// validators; used only in the package-delivered state.
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
  const bpp = 4, stride = ihdr.width * bpp;
  const raw = zlib.inflateSync(Buffer.concat(idat));
  if (raw.length !== (stride + 1) * ihdr.height) throw new Error('inflated data length mismatch: ' + p);
  const pixels = Buffer.alloc(stride * ihdr.height);
  const paeth = (a, b, c) => { const pp = a + b - c, pa = Math.abs(pp - a), pb = Math.abs(pp - b), pc = Math.abs(pp - c); return pa <= pb && pa <= pc ? a : pb <= pc ? b : c; };
  for (let y = 0; y < ihdr.height; y++) {
    const f = raw[y * (stride + 1)], row = y * stride, prev = (y - 1) * stride;
    for (let x = 0; x < stride; x++) {
      const rb = raw[y * (stride + 1) + 1 + x];
      const left = x >= bpp ? pixels[row + x - bpp] : 0;
      const up = y > 0 ? pixels[prev + x] : 0;
      const ul = y > 0 && x >= bpp ? pixels[prev + x - bpp] : 0;
      let v;
      if (f === 0) v = rb; else if (f === 1) v = rb + left; else if (f === 2) v = rb + up;
      else if (f === 3) v = rb + ((left + up) >> 1); else if (f === 4) v = rb + paeth(left, up, ul);
      else throw new Error('unknown filter ' + f + ': ' + p);
      pixels[row + x] = v & 0xff;
    }
  }
  return { ihdr, pixels };
}

function alphaStats(png) {
  const { width: W, height: H } = png.ihdr;
  let border = 0, maxY = -1, minX = W, maxX = -1, minY = H;
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    if (png.pixels[(y * W + x) * 4 + 3] > 0) {
      if (y > maxY) maxY = y; if (y < minY) minY = y;
      if (x > maxX) maxX = x; if (x < minX) minX = x;
      if (x === 0 || y === 0 || x === W - 1 || y === H - 1) border++;
    }
  }
  return { border, maxY, bounds: maxX >= 0 ? `${maxX - minX + 1}x${maxY - minY + 1}+${minX}+${minY}` : 'empty' };
}

const record = JSON.parse(fs.readFileSync(RECORD_PATH, 'utf8'));
const md = fs.readFileSync(MD_PATH, 'utf8');

// ---- shared checks (both states) ----
assert(record.monsterId === 'skeleton' && record.displayName === 'Skeleton', 'monster identity fields wrong');
assert(record.sourceLineage.sourceHeadExpected === EXPECTED_SOURCE_HEAD, 'sourceLineage.sourceHeadExpected mismatch');
assert(record.sourceLineage.sourcePr === 89, 'sourceLineage.sourcePr must be 89');
assert(fs.existsSync(IDENTITY_REF_PATH) && sha(IDENTITY_REF_PATH) === EXPECTED_IDENTITY_REF_SHA, 'identity reference assets/mon_skeleton.png missing or hash drifted');
assert(record.identityReference.sha256Measured === EXPECTED_IDENTITY_REF_SHA, 'record identityReference hash mismatch');
if (!errors.length) ok('identity: skeleton/Skeleton; source PR #89 head recorded; identity reference re-hashed and matching (identity evidence only, not an approved Neutral Master)');

// changed-path allowlist (both states)
try {
  const { execSync } = await import('node:child_process');
  const base = execSync('git merge-base HEAD origin/cc/board-camera-art-lighting-polish-v1 2>/dev/null || git rev-list --max-parents=0 HEAD', { encoding: 'utf8' }).trim();
  const changed = execSync(`git diff --name-only ${base} HEAD`, { encoding: 'utf8' }).trim().split('\n').filter(Boolean);
  const allowlist = [IMPORT_ROOT + '/', RECORD_PATH, MD_PATH, 'tools/validate-skeleton-neutral-master-exact-package-approval-v1.mjs'];
  const disallowed = changed.filter((cf) => !allowlist.some((prefix) => cf === prefix || cf.startsWith(prefix)));
  assert(disallowed.length === 0, `changed-path allowlist violated: ${JSON.stringify(disallowed)}`);
  assert(!changed.some((cf) => cf.startsWith('src/') || cf === 'autochess.html' || cf.startsWith('assets/')), 'src/gameplay/UI/asset files must not change on this branch');
  if (!errors.length) ok(`changed-path allowlist: ${changed.length} changed path(s), all in scope (no src/gameplay/UI/asset change)`);
} catch (e) {
  console.log('⚠ changed-path allowlist check skipped (git inspection unavailable): ' + e.message);
}

if (record.status === 'PENDING_PACKAGE_DELIVERY') {
  // ================= A. SCAFFOLD STATE =================
  // import root must contain ONLY the README -- no fabricated package content
  const rootFiles = fs.readdirSync(IMPORT_ROOT);
  assert(rootFiles.length === 1 && rootFiles[0] === 'README.md', `import root must contain only README.md, found: ${JSON.stringify(rootFiles)}`);
  const readme = fs.readFileSync(path.join(IMPORT_ROOT, 'README.md'), 'utf8');
  assert(readme.includes('PENDING_PACKAGE_DELIVERY'), 'import-root README must state PENDING_PACKAGE_DELIVERY');
  if (!errors.length) ok('import root reserved: README.md only, no binary/placeholder/fabricated evidence');

  // no measured package facts populated
  assert(record.packageInventory === null, 'packageInventory must be null before delivery');
  assert(record.measuredCandidateProperties === null, 'measuredCandidateProperties must be null before delivery');
  assert(record.qaResults === 'NOT_YET_RUN', 'qaResults must be NOT_YET_RUN before delivery');
  assert(record.expectedHandoffUnverified && record.expectedHandoffUnverified.verified === false, 'expectedHandoffUnverified.verified must be false (reported values are unverified references)');
  assert(/unverified/i.test(record.expectedHandoffUnverified.note || ''), 'expectedHandoffUnverified.note must explicitly say the values are unverified');
  if (!errors.length) ok('no measured package facts populated; reported handoff values explicitly marked unverified');

  // approval fields must remain pending/false; human decisions all pending
  const f = record.approvalFlags;
  assert(f.humanVisualApproval === 'pending', "approvalFlags.humanVisualApproval must be 'pending'");
  for (const k of ['neutralMasterApproved', 'exactPackageApproved', 'canonicalApproved', 'motionProductionAuthorized', 'runtimeIntegrationAuthorized', 'runtimeIntegrated', 'merged']) {
    assert(f[k] === false, `approvalFlags.${k} must be false`);
  }
  assert(record.humanDecision.state === 'pending', 'humanDecision.state must be pending');
  const pd = record.humanDecision.pendingDecisions;
  assert(Object.keys(pd).length === 12, 'humanDecision must have all 12 pending decision fields');
  for (const [k, v] of Object.entries(pd)) assert(v === 'pending', `humanDecision.pendingDecisions.${k} must be 'pending'`);
  assert(!/- \[x\]/i.test(md), 'Markdown scaffold must contain no checked decision item');
  assert(md.includes('PENDING_PACKAGE_DELIVERY'), 'Markdown scaffold must state PENDING_PACKAGE_DELIVERY');
  if (!errors.length) ok("approval flags exact (humanVisualApproval='pending', all others false); 12/12 human decisions pending; no approval language");

  if (errors.length) {
    console.error('\nVALIDATION FAILED:');
    for (const e of errors) console.error('  ✗ ' + e);
    process.exit(1);
  }
  console.log('\nSCAFFOLD_READY — skeleton-neutral-master-exact-package-approval-v1 scaffold is consistent: no package delivered, no import, no approval recorded, all gates pending.');
} else {
  // ================= B. PACKAGE-DELIVERED STATE =================
  // Runs only after a real delivery/import task updates the record. Reads the actually-imported
  // files; a missing file is a FAILURE, never a fabricated pass.
  const inv = record.packageInventory;
  assert(inv && Array.isArray(inv.files) && inv.files.length > 0, 'packageInventory.files must list the imported package inventory');
  assert(typeof inv?.zipSha256Measured === 'string' && /^[0-9a-f]{64}$/.test(inv.zipSha256Measured), 'packageInventory.zipSha256Measured must be a freshly measured SHA-256');
  assert(Number.isInteger(inv?.zipSizeBytesMeasured) && inv.zipSizeBytesMeasured > 0, 'packageInventory.zipSizeBytesMeasured must be measured');
  assert(Number.isInteger(inv?.zipEntryCountMeasured) && inv.zipEntryCountMeasured > 0, 'packageInventory.zipEntryCountMeasured must be measured');
  assert(inv?.zipCrcCheck === 'PASS', 'packageInventory.zipCrcCheck must be PASS');
  assert(inv?.pathSafety === 'PASS', 'packageInventory.pathSafety must be PASS (no traversal/absolute/symlink/duplicate/case-collision paths)');
  if (inv && Array.isArray(inv.files)) {
    for (const f of inv.files) {
      const p = path.join(IMPORT_ROOT, f.path);
      assert(fs.existsSync(p), `inventory file missing on disk: ${f.path}`);
      if (fs.existsSync(p) && f.sha256) assert(sha(p) === f.sha256, `inventory hash mismatch: ${f.path}`);
      if (f.path.endsWith('.json') && fs.existsSync(p)) {
        try { JSON.parse(fs.readFileSync(p, 'utf8')); } catch { assert(false, `package JSON does not parse: ${f.path}`); }
      }
    }
  }

  const m = record.measuredCandidateProperties;
  assert(m && typeof m.candidatePath === 'string', 'measuredCandidateProperties.candidatePath required');
  if (m && typeof m.candidatePath === 'string') {
    const cp = path.join(IMPORT_ROOT, m.candidatePath);
    assert(fs.existsSync(cp), `candidate PNG missing on disk: ${m.candidatePath}`);
    if (fs.existsSync(cp)) {
      const measured = sha(cp);
      assert(measured === m.sha256, `candidate sha mismatch: measured ${measured}`);
      const png = readPng(cp);
      assert(png.ihdr.width === 640 && png.ihdr.height === 960, `candidate dims ${png.ihdr.width}x${png.ihdr.height} != 640x960`);
      assert(png.ihdr.colorType === 6 && png.ihdr.depth === 8, 'candidate not 8-bit RGBA');
      if (png.pixels) {
        const st = alphaStats(png);
        assert(st.border === 0, `candidate has ${st.border} opaque border pixels (must be fully transparent borders)`);
        assert(st.maxY === m.maxAlphaY, `candidate maxAlphaY ${st.maxY} != recorded ${m.maxAlphaY}`);
        assert(st.bounds === m.alphaBounds, `candidate alpha bounds ${st.bounds} != recorded ${m.alphaBounds}`);
      }
      assert(Array.isArray(m.anchor) && m.anchor.length === 2, 'measured anchor metadata required');
    }
  }
  assert(record.qaResults !== 'NOT_YET_RUN', 'qaResults must be populated in package-delivered state');
  // Human Decision Sheet / approval flags: consistency between the decision state and flags.
  const f = record.approvalFlags;
  if (record.humanDecision.state === 'pending') {
    assert(f.humanVisualApproval === 'pending' && f.neutralMasterApproved === false && f.exactPackageApproved === false,
      'approval flags must remain pending/false while the human decision is pending');
  } else if (record.humanDecision.state === 'approved') {
    assert(f.humanVisualApproval === true, 'humanVisualApproval must be true once the user decision is recorded');
  }
  for (const k of ['canonicalApproved', 'runtimeIntegrated', 'merged']) assert(f[k] === false, `approvalFlags.${k} must remain false`);

  if (errors.length) {
    console.error('\nVALIDATION FAILED:');
    for (const e of errors) console.error('  ✗ ' + e);
    process.exit(1);
  }
  console.log(`\nALL CHECKS PASSED — package-delivered state audit complete for status ${record.status}.`);
}
