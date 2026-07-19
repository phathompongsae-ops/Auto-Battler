#!/usr/bin/env node

// Validator for the Archer Attack v3.2 Exact-Package Approval overlay.
// Re-derives every claim from the exact candidate binaries and from the
// underlying PR #79 candidate record -- does not trust its own JSON blindly.

import crypto from 'node:crypto';
import fs from 'node:fs';
import process from 'node:process';
import { execSync } from 'node:child_process';

const APPROVAL_PATH = 'data/design/archer-attack-v3-2-exact-package-approval-v1.json';
const CANDIDATE_RECORD_PATH = 'data/design/archer-attack-v3-2-review-candidate-v1.json';
const MASTER_PATH = 'docs/assets/review/character-production/archer/master-v1/archer-production-master-candidate-v1.png';
const MASTER_SHA = '4911e7e3ba59241ee011be3e62f1b64230dcf9b3c24c6aeb23dc939d83311013';
const FRAMES_DIR = 'docs/assets/review/character-production/archer/attack-v3-2/frames';
const EXPECTED_CANDIDATE_HEAD = 'ddd0b655f867d0b01106a9e1d274234e1e9b71e9';
const EXPECTED_BASE_SHA = 'd949bbec0ae61891e9794e28d0c1a3b49b719a56';
const EXPECTED_ZIP_SHA = 'bf3653d72c9a5b3eec8b8a24224dcff098527dae194fbbafd3ec69c15072fc3e';
const EXPECTED_FRAME_004 = '69af0c5088492db38fc81a365e1295264057ffe62f1141f173b86d815da5b277';
const EXPECTED_FRAME_006 = '7a63d3f0b357e7559c84c75650baa75c1865c8ced75a6abe618d1893d42e2787';

const errors = [];
const assert = (cond, msg) => { if (!cond) errors.push(msg); };
const sha = (p) => crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex');
const readJson = (p) => JSON.parse(fs.readFileSync(p, 'utf8'));

const approval = readJson(APPROVAL_PATH);
const candidate = fs.existsSync(CANDIDATE_RECORD_PATH) ? readJson(CANDIDATE_RECORD_PATH) : null;

// --- 1. Exact candidate identity ---
assert(approval.sourcePr === 79, 'sourcePr must be 79');
assert(approval.exactCandidateHeadSha === EXPECTED_CANDIDATE_HEAD, 'exactCandidateHeadSha mismatch');
assert(approval.exactBaseSha === EXPECTED_BASE_SHA, 'exactBaseSha mismatch');
assert(approval.exactSourceZipSha256 === EXPECTED_ZIP_SHA, 'exactSourceZipSha256 mismatch');

// --- 2. Master re-verified from binary ---
assert(fs.existsSync(MASTER_PATH), `missing approved master at ${MASTER_PATH}`);
if (fs.existsSync(MASTER_PATH)) assert(sha(MASTER_PATH) === MASTER_SHA, 'Neutral Master SHA mismatch (binary)');
assert(approval.exactMasterSha256 === MASTER_SHA, 'approval record master SHA mismatch');

// --- 3. Frame hash table 12/12, re-hashed from disk ---
const hashes = approval.approvedFrames?.hashes ?? {};
assert(Object.keys(hashes).length === 12, 'approvedFrames.hashes must list exactly 12 frames');
for (let i = 0; i < 12; i++) {
  const idx = String(i).padStart(3, '0');
  const path = `${FRAMES_DIR}/hero.archer_attack_v3_2_${idx}.png`;
  assert(fs.existsSync(path), `missing frame binary ${path}`);
  if (!fs.existsSync(path)) continue;
  const measured = sha(path);
  assert(hashes[idx] === measured, `frame ${idx}: approval record hash does not match binary on disk`);
}

// --- 4. Frame 004/006/011 specifics ---
assert(hashes['004'] === EXPECTED_FRAME_004, 'frame 004 hash mismatch vs expected');
assert(hashes['006'] === EXPECTED_FRAME_006, 'frame 006 hash mismatch vs expected');
assert(hashes['011'] === MASTER_SHA, 'frame 011 must equal Approved Master SHA');
assert(JSON.stringify(approval.approvedFrames?.reworkOrInsertedFrameIndices) === JSON.stringify([4, 6]), 'reworkOrInsertedFrameIndices must be exactly [4,6]');
assert(approval.approvedFrames?.fullDrawFrameIndex === 7, 'fullDrawFrameIndex must be 7');
assert(approval.approvedFrames?.releaseFrameIndex === 8, 'releaseFrameIndex must be 8');
assert(approval.approvedFrames?.neutralExitFrameIndex === 11, 'neutralExitFrameIndex must be 11');
assert(approval.approvedFrames?.originalMappingVerified10Of10 === true, 'originalMappingVerified10Of10 must be true');

// --- 5. Timing ---
const t = approval.timing ?? {};
const sum = (arr) => (arr ?? []).reduce((a, b) => a + b, 0);
assert(sum(t.perFrameDurationCs) === t.totalDurationCs, 'per-frame durations do not sum to stated total');
assert(t.totalDurationCs === 127, 'total duration must be 127cs');
assert(t.releaseFrameIndex === 8 && t.releaseDurationCs === 7, 'release frame/duration mismatch');
assert(Array.isArray(t.perFrameDurationCs) && t.perFrameDurationCs[8] === 7, 'per-frame duration at index 8 must be 7cs');

// --- 6. Approval evidence present ---
const ev = approval.userApprovalEvidence ?? {};
assert(typeof ev.userVerdict === 'string' && ev.userVerdict.length > 0, 'userVerdict must be recorded');
assert(ev.independentAuditResult === 'CC_RETURN_VERIFIED', 'independentAuditResult must be CC_RETURN_VERIFIED');
assert(Array.isArray(ev.approvalScope?.approved) && ev.approvalScope.approved.length > 0, 'approvalScope.approved must be recorded');
assert(Array.isArray(ev.approvalScope?.notApproved) && ev.approvalScope.notApproved.length > 0, 'approvalScope.notApproved must be recorded');
assert(typeof approval.approvalTimestampUtc === 'string' && approval.approvalTimestampUtc.length > 0, 'approvalTimestampUtc must be recorded');

// --- 7. 16-bit follow-up recorded and still required ---
const fmt = approval.knownFormatObservation ?? {};
assert(fmt.affectedFrame === '004', 'knownFormatObservation must reference frame 004');
assert(fmt.approvalBlocker === false, 'knownFormatObservation.approvalBlocker must be false');
assert(fmt.runtimeCompatibilityFollowUpRequired === true, 'runtimeCompatibilityFollowUpRequired must remain true');
assert(fmt.runtimeIntegrationBlockedUntilCompatibilityCheck === true, 'runtimeIntegrationBlockedUntilCompatibilityCheck must remain true');

// --- 8. git diff --check discrepancy honestly recorded ---
const gd = approval.gitDiffCheckObservation ?? {};
assert(gd.affectedFile === 'docs/reviews/archer-attack-v3-2-technical-qa-report.md', 'gitDiffCheckObservation.affectedFile mismatch');
assert(gd.fileByteIdenticalToApprovedSourcePackage === true, 'gitDiffCheckObservation must record file as byte-identical to approved source');

// --- 9. Approval flags ---
const af = approval.approvalFlags ?? {};
for (const key of ['humanVisualApproval', 'attackV3_2PackageApproved', 'exactPackageApproved', 'animationQualityBenchmarkV1Approved', 'benchmarkActivationAuthorized']) {
  assert(af[key] === true, `approvalFlags.${key} must be true`);
}
for (const key of ['canonicalApproved', 'runtimeEligible', 'runtimeIntegrated', 'runtimeIntegrationAuthorized', 'merged']) {
  assert(af[key] === false, `approvalFlags.${key} must remain false`);
}

// --- 10. Benchmark policy explicitly non-mandating fixed frame counts ---
const bm = approval.animationQualityBenchmarkV1 ?? {};
assert(Array.isArray(bm.standardDoesNotMandate) && bm.standardDoesNotMandate.some(s => /12 frames/i.test(s)), 'benchmark must explicitly disclaim a 12-frame mandate');
assert(bm.benchmarkActivationAuthorized === true, 'animationQualityBenchmarkV1.benchmarkActivationAuthorized must be true');

// --- 11. Cross-check against the underlying PR #79 candidate record, if present ---
if (candidate) {
  assert(candidate.finalV32FrameHashes?.['004'] === hashes['004'], 'approval frame 004 hash diverges from candidate record');
  assert(candidate.finalV32FrameHashes?.['006'] === hashes['006'], 'approval frame 006 hash diverges from candidate record');
  assert(candidate.finalV32FrameHashes?.['011'] === hashes['011'], 'approval frame 011 hash diverges from candidate record');
}

// --- 12. No runtime/src paths were touched by this approval commit ---
try {
  const changed = execSync('git diff --name-only HEAD~1 HEAD', { encoding: 'utf8' }).trim().split('\n').filter(Boolean);
  const forbidden = changed.filter(p => p.startsWith('src/') || p.includes('runtime') || p.startsWith('assets/units/'));
  assert(forbidden.length === 0, `approval commit touched forbidden paths: ${forbidden.join(', ')}`);
} catch (e) {
  errors.push(`could not verify changed-path allowlist via git: ${e.message}`);
}

if (errors.length) {
  console.error('Archer Attack v3.2 Exact-Package Approval Validation FAILED:');
  for (const e of errors) console.error(`- ${e}`);
  process.exit(1);
}

console.log('✓ Archer Attack v3.2 Exact-Package Approval Validation PASSED');
console.log('✓ exact candidate identity (PR #79 head, base SHA, source ZIP SHA) verified');
console.log('✓ Neutral Master re-verified from binary');
console.log('✓ 12/12 frame hashes re-hashed from disk and matched to approval record');
console.log('✓ frame 004/006 reworked-frame hashes, frame 011 exact-master identity confirmed');
console.log('✓ Full Draw (007) / Release (008, 7cs) / Neutral exit (011) mapping confirmed');
console.log('✓ total timing 127cs confirmed');
console.log('✓ approval evidence (user verdict, independent audit result) present');
console.log('✓ 16-bit frame-004 follow-up recorded and still required (non-blocking)');
console.log('✓ git diff --check discrepancy on PR #79 honestly recorded, not hidden');
console.log('✓ approval flags correct: visual/package/benchmark=true, canonical/runtime/merge=false');
console.log('✓ benchmark policy explicitly disclaims a fixed 12-frame mandate');
console.log('✓ no src/runtime/asset-binary paths touched by this approval commit');
