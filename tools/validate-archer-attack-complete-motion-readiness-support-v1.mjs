#!/usr/bin/env node

import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

const SHA256_RE = /^[a-f0-9]{64}$/;

function parseArgs(argv) {
  const out = {
    root: '.',
    contract: 'data/design/archer-attack-complete-motion-readiness-support-v1.json',
    pack: 'data/design/archer-complete-motion-readiness-pack-v1.json',
  };
  for (let i = 2; i < argv.length; i += 1) {
    const a = argv[i];
    if (a === '--root') out.root = argv[++i];
    else if (a === '--contract') out.contract = argv[++i];
    else if (a === '--pack') out.pack = argv[++i];
    else throw new Error(`Unknown argument: ${a}`);
  }
  return out;
}

const jsonEqual = (a, b) => JSON.stringify(a) === JSON.stringify(b);

export function validateArcherMotionReadiness({ root = '.', contractPath, packPath }) {
  const errors = [];
  const blockers = [];
  const warnings = [];
  const abs = (p) => path.resolve(root, p);
  const exists = (p) => fs.existsSync(abs(p));
  const readJson = (p) => JSON.parse(fs.readFileSync(abs(p), 'utf8'));
  const sha256 = (p) => crypto.createHash('sha256').update(fs.readFileSync(abs(p))).digest('hex');
  const assert = (cond, msg) => { if (!cond) errors.push(msg); };

  const contract = readJson(contractPath);
  const pack = readJson(packPath);

  assert(contract.extends === packPath, `contract.extends must reference ${packPath}`);
  assert(contract.characterId === 'hero.archer' && pack.characterId === 'hero.archer', 'characterId must be hero.archer');

  const required = contract.requiredMotions ?? [];
  assert(jsonEqual(required, ['idle', 'move', 'attack']), 'requiredMotions must be exactly idle, move, attack');
  assert(new Set(required).size === required.length, 'requiredMotions contains duplicates');

  const motionIds = required.map((s) => contract.motionIds?.[s]);
  assert(motionIds.every(Boolean), 'every required motion must have a motionId');
  assert(new Set(motionIds).size === motionIds.length, 'duplicate motionIds are forbidden');

  const packageIds = [];
  const neutralSha = contract.shared?.sourceNeutralMasterSha256;
  assert(SHA256_RE.test(neutralSha ?? ''), 'sourceNeutralMasterSha256 must be 64-char lowercase hex');
  assert(pack.sourceNeutralMaster?.sha256 === neutralSha, 'Neutral Master SHA mismatch between support contract and readiness pack');

  const fpsByState = contract.shared?.fpsByState ?? {};
  const loopByState = contract.shared?.loopByState ?? {};
  assert(fpsByState.idle === 8 && fpsByState.move === 12 && fpsByState.attack === 12, 'fpsByState must preserve Idle=8, Move=12, Attack=12');
  assert(loopByState.idle === true && loopByState.move === true && loopByState.attack === false, 'loopByState mismatch');

  for (const state of required) {
    const req = contract.states?.[state];
    const packed = pack.states?.[state];
    assert(req, `missing support state ${state}`);
    assert(packed, `readiness pack missing state ${state}`);
    if (!req || !packed) continue;

    assert(typeof req.packageId === 'string' && req.packageId.length > 0, `${state}: packageId required`);
    packageIds.push(req.packageId);
    assert(packed.packageId === req.packageId, `${state}: packageId mismatch with readiness pack`);

    const availability = req.assetAvailability;
    assert(contract.pendingBlockedPolicy?.assetAvailabilityEnum?.includes(availability), `${state}: invalid assetAvailability ${availability}`);

    for (const key of ['sourceVerified', 'technicalIntegrityValidated', 'technicallyValidated', 'exactPackageApproved', 'productionReady', 'canonicalApproved', 'runtimeReady']) {
      assert(typeof req[key] === 'boolean', `${state}: ${key} must be boolean`);
    }

    if (req.productionReady) {
      assert(req.sourceVerified && req.technicallyValidated && req.exactPackageApproved, `${state}: productionReady requires sourceVerified + technicallyValidated + exactPackageApproved`);
    }
    if (req.runtimeReady) {
      assert(req.productionReady, `${state}: runtimeReady requires productionReady`);
    }

    if (availability !== 'PRESENT') {
      assert(req.technicallyValidated === false, `${state}: pending/blocked asset cannot be technicallyValidated`);
      assert(req.productionReady === false, `${state}: pending/blocked asset cannot be productionReady`);
      assert(req.exactPackageApproved === false, `${state}: pending/blocked asset cannot be exactPackageApproved`);
      assert(req.canonicalApproved === false, `${state}: pending/blocked asset cannot be canonicalApproved`);
      assert(typeof req.pendingReason === 'string' && req.pendingReason.length > 0, `${state}: pending/blocked asset requires pendingReason`);
      blockers.push(`${state}: ${availability}`);
      continue;
    }

    assert(Array.isArray(packed.frames) && packed.frames.length === packed.frameCount && packed.frameCount > 0, `${state}: PRESENT asset requires non-empty frames`);
    const seenFrameIndexes = new Set();
    for (const f of packed.frames ?? []) {
      assert(Number.isInteger(f.frameIndex), `${state}: frameIndex must be integer`);
      assert(!seenFrameIndexes.has(f.frameIndex), `${state}: duplicate frameIndex ${f.frameIndex}`);
      seenFrameIndexes.add(f.frameIndex);
      assert(SHA256_RE.test(f.sha256 ?? ''), `${state}: invalid SHA-256 format at frame ${f.frameIndex}`);
      assert(typeof f.path === 'string' && f.path.length > 0, `${state}: frame path required at frame ${f.frameIndex}`);
      if (!exists(f.path)) errors.push(`${state}: missing PRESENT production frame ${f.path}`);
      else assert(sha256(f.path) === f.sha256, `${state}: SHA drift at ${f.path}`);
    }

    assert(typeof req.sidecar === 'string' && exists(req.sidecar), `${state}: sidecar missing`);
    if (typeof req.sidecar === 'string' && exists(req.sidecar)) {
      const sidecar = readJson(req.sidecar);
      assert(sidecar.assetId === req.packageId, `${state}: sidecar assetId mismatch`);
      assert(sidecar.unitId === 'hero.archer', `${state}: sidecar unitId mismatch`);
      assert(sidecar.state === state, `${state}: sidecar state mismatch`);
      assert(sidecar.fps === fpsByState[state], `${state}: sidecar fps mismatch`);
      assert(sidecar.frameCount === packed.frameCount, `${state}: sidecar frameCount mismatch`);
      assert(sidecar.loop === loopByState[state], `${state}: sidecar loop mismatch`);
      assert(sidecar.rootMotion === contract.shared.rootMotion, `${state}: sidecar rootMotion mismatch`);
      assert(sidecar.runtimeFlipX === contract.shared.runtimeFlipX, `${state}: sidecar runtimeFlipX mismatch`);
      assert(jsonEqual(sidecar.anchor, contract.shared.anchor), `${state}: sidecar anchor mismatch`);
      assert(jsonEqual(sidecar.canvas, contract.shared.canvas), `${state}: sidecar canvas mismatch`);
    }

    for (const optionalRequiredPathKey of ['productionContract', 'validationReport']) {
      if (typeof req[optionalRequiredPathKey] === 'string') assert(exists(req[optionalRequiredPathKey]), `${state}: ${optionalRequiredPathKey} missing`);
    }

    assert(typeof req.sourceMap === 'string' && exists(req.sourceMap), `${state}: sourceMap missing`);
    if (typeof req.sourceMap === 'string' && exists(req.sourceMap)) {
      const sourceMap = readJson(req.sourceMap);
      assert(sourceMap.sourceNeutralMaster?.sha256 === neutralSha, `${state}: sourceMap Neutral SHA mismatch`);
      if (sourceMap.assetId !== undefined) assert(sourceMap.assetId === req.packageId, `${state}: sourceMap assetId mismatch`);
      if (sourceMap.unitId !== undefined) assert(sourceMap.unitId === 'hero.archer', `${state}: sourceMap unitId mismatch`);
      if (sourceMap.state !== undefined) assert(sourceMap.state === state, `${state}: sourceMap state mismatch`);
      assert(Array.isArray(sourceMap.frames), `${state}: sourceMap.frames missing`);
      if (Array.isArray(sourceMap.frames)) {
        const sourceByIndex = new Map(sourceMap.frames.map((f) => [f.frameIndex, f]));
        for (const f of packed.frames ?? []) {
          const sf = sourceByIndex.get(f.frameIndex);
          assert(sf, `${state}: sourceMap missing frame ${f.frameIndex}`);
          if (sf) {
            assert(sf.path === f.path, `${state}: sourceMap path mismatch at frame ${f.frameIndex}`);
            assert(sf.sha256 === f.sha256, `${state}: sourceMap SHA mismatch at frame ${f.frameIndex}`);
          }
        }
      }
    }

    if (req.exactPackageApproved) {
      assert(typeof req.approvalRecord === 'string' && exists(req.approvalRecord), `${state}: approved package requires approvalRecord`);
      if (typeof req.approvalRecord === 'string' && exists(req.approvalRecord)) {
        const approval = readJson(req.approvalRecord);
        const key = state === 'idle' ? 'idlePackageApproved' : state === 'move' ? 'movePackageApproved' : 'attackV2PackageApproved';
        assert(approval[key] === true, `${state}: approval record must set ${key}=true`);
        assert(approval.userApprovalRecorded === true || approval.approval?.owner === 'user', `${state}: approval record lacks explicit human/user evidence`);
      }
    }

    if (req.canonicalApproved) {
      const evidence = req.humanApprovalEvidence;
      assert(evidence?.owner === contract.approvalEvidencePolicy?.humanApprovalOwner, `${state}: canonicalApproved requires human owner evidence`);
      assert(evidence?.decision === 'approved', `${state}: canonicalApproved requires approved decision`);
      assert(evidence?.exactHashesLocked === true, `${state}: canonicalApproved requires exactHashesLocked=true`);
    }
  }

  assert(new Set(packageIds).size === packageIds.length, 'duplicate packageIds are forbidden');

  const complete = contract.completeReadiness ?? {};
  const allExactApproved = required.every((s) => contract.states?.[s]?.exactPackageApproved === true);
  assert(complete.completeArcherMotionApproved === allExactApproved, 'completeArcherMotionApproved must equal all required exactPackageApproved states');
  if (complete.canonicalApproved) assert(complete.completeArcherMotionApproved === true, 'complete canonicalApproved requires completeArcherMotionApproved');
  if (complete.runtimeEligible) assert(complete.completeArcherMotionApproved === true, 'runtimeEligible requires completeArcherMotionApproved');

  const correction = contract.knownBasePackCorrections?.find((x) => x.path === 'consistencyMatrix.fps');
  assert(correction, 'support contract must explicitly correct the PR #74 shared-fps inconsistency');
  if (pack.consistencyMatrix?.fps !== undefined) {
    const distinctFps = new Set(Object.values(fpsByState));
    if (distinctFps.size > 1) warnings.push('Base readiness pack consistencyMatrix.fps is a legacy shared field; support contract fpsByState is authoritative.');
  }

  return { errors, blockers, warnings, contract, pack };
}

function main() {
  try {
    const args = parseArgs(process.argv);
    const result = validateArcherMotionReadiness({ root: args.root, contractPath: args.contract, packPath: args.pack });
    for (const w of result.warnings) console.warn(`WARN: ${w}`);
    if (result.errors.length) {
      console.error('Archer Attack + Complete Motion Readiness support validation FAILED:');
      for (const e of result.errors) console.error(`- ${e}`);
      process.exit(1);
    }
    if (result.blockers.length) {
      console.error('Archer Attack + Complete Motion Readiness support is BLOCKED/PENDING:');
      for (const b of result.blockers) console.error(`- ${b}`);
      process.exit(2);
    }
    console.log('✓ Archer Attack + Complete Motion Readiness support contract is internally consistent');
    console.log('✓ required motions/IDs/metadata/provenance/SHA/approval-state gates validated');
    console.log('✓ current canonicalApproved=false and runtime readiness remains separately gated');
  } catch (err) {
    console.error(`Validator crashed: ${err instanceof Error ? err.message : String(err)}`);
    process.exit(1);
  }
}

const invokedDirectly = process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1]);
if (invokedDirectly) main();
