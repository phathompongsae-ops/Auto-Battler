#!/usr/bin/env node

// Deterministic re-validator for the Archer Complete Motion Readiness Pack v1.
// Re-hashes every referenced file and cross-checks sidecar contracts, approval
// overlays, and status invariants. Exits 0 only if the pack matches reality.

import crypto from 'node:crypto';
import fs from 'node:fs';
import process from 'node:process';

const PACK = 'data/design/archer-complete-motion-readiness-pack-v1.json';
const NEUTRAL_SHA = '4911e7e3ba59241ee011be3e62f1b64230dcf9b3c24c6aeb23dc939d83311013';

const errors = [];
const assert = (cond, msg) => { if (!cond) errors.push(msg); };
const sha = (p) => crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex');
const readJson = (p) => JSON.parse(fs.readFileSync(p, 'utf8'));

const pack = readJson(PACK);

// Source of truth: approved Neutral Master
assert(pack.sourceNeutralMaster?.sha256 === NEUTRAL_SHA, 'pack Neutral Master SHA mismatch');
assert(fs.existsSync(pack.sourceNeutralMaster.path), 'Neutral Master file missing');
assert(sha(pack.sourceNeutralMaster.path) === NEUTRAL_SHA, 'Neutral Master bytes drifted');

// Per-state frame hash re-verification
const expectedCounts = { idle: 8, move: 8, attack: 10 };
for (const [state, expected] of Object.entries(expectedCounts)) {
  const s = pack.states?.[state];
  assert(s, `pack missing state ${state}`);
  if (!s) continue;
  assert(s.frameCount === expected && s.frames?.length === expected, `${state}: frame count must be ${expected}`);
  for (const f of s.frames ?? []) {
    if (!fs.existsSync(f.path)) { errors.push(`${state} frame ${f.frameIndex}: missing ${f.path}`); continue; }
    assert(sha(f.path) === f.sha256, `${state} frame ${f.frameIndex}: SHA drift at ${f.path}`);
  }
  // Sidecar contract must match the pack snapshot
  const sc = readJson(s.sidecar);
  for (const key of Object.keys(s.sidecarContract ?? {})) {
    assert(JSON.stringify(sc[key]) === JSON.stringify(s.sidecarContract[key]), `${state} sidecar field '${key}' drifted from pack snapshot`);
  }
}

// Approval overlays must still record the approvals the pack claims
const idleAp = readJson(pack.states.idle.approvalRecord);
const moveAp = readJson(pack.states.move.approvalRecord);
assert(idleAp.idlePackageApproved === true, 'idle approval overlay no longer records approval');
assert(moveAp.movePackageApproved === true, 'move approval overlay no longer records approval');
assert(idleAp.sourceNeutralMaster?.sha256 === NEUTRAL_SHA, 'idle overlay Neutral SHA mismatch');
assert(moveAp.sourceNeutralMaster?.sha256 === NEUTRAL_SHA, 'move overlay Neutral SHA mismatch');

// Attack candidate invariants
const atk = pack.states.attack;
assert(atk.frames?.[9]?.sha256 === NEUTRAL_SHA, 'attack frame 9 must be byte-identical to Neutral Master');
assert(atk.frame9ByteIdenticalToNeutralMaster === true, 'pack must record frame-9 neutral identity');
assert(atk.status === 'v2-candidate-pending-user-visual-approval', 'attack status must remain pending user approval');
const atkSidecar = readJson(atk.sidecar);
for (const key of ['attackPackageApproved', 'canonicalApproved', 'runtimeEligible', 'runtimeIntegrated']) {
  assert(atkSidecar.status?.[key] === false, `attack sidecar status.${key} must be false`);
}

// Consistency matrix
const m = pack.consistencyMatrix;
assert(JSON.stringify(m?.canvas) === '[640,960]', 'consistency canvas mismatch');
assert(m?.fps === 12 && JSON.stringify(m?.anchor) === '[0.5,0.92]', 'consistency fps/anchor mismatch');
assert(m?.rootMotion === 'in-place' && m?.runtimeFlipX === true, 'consistency rootMotion/flipX mismatch');
assert(m?.loopByState?.idle === true && m?.loopByState?.move === true && m?.loopByState?.attack === false, 'consistency loop semantics mismatch');

// Status invariants: no self-approval, canonical stays false
const es = pack.effectiveStatus;
for (const key of ['attackV2PackageApproved', 'completeArcherMotionApproved', 'canonicalApproved', 'runtimeEligible', 'runtimeIntegrated']) {
  assert(es?.[key] === false, `effectiveStatus.${key} must be false until human approval`);
}
for (const key of ['neutralMasterApproved', 'idlePackageApproved', 'movePackageApproved', 'attackV2Generated']) {
  assert(es?.[key] === true, `effectiveStatus.${key} must be true`);
}
assert(Array.isArray(pack.blockers) && pack.blockers.some(b => b.id === 'attack-v2-user-visual-approval'), 'pack must record the pending user-approval blocker');

if (errors.length) {
  console.error('Archer Complete Motion Readiness Pack validation FAILED:');
  for (const e of errors) console.error(`- ${e}`);
  process.exit(1);
}
console.log('✓ Archer Complete Motion Readiness Pack v1 validation PASSED');
console.log('✓ Neutral Master + 8 idle + 8 move + 10 attack frame hashes re-verified');
console.log('✓ sidecar contracts, approval overlays, and consistency matrix match');
console.log('✓ status invariants hold (canonicalApproved=false, no self-approval)');
