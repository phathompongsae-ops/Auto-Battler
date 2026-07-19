#!/usr/bin/env node

import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const validator = path.join(here, 'validate-archer-attack-complete-motion-readiness-support-v1.mjs');

const writeJson = (root, rel, value) => {
  const p = path.join(root, rel);
  fs.mkdirSync(path.dirname(p), { recursive: true });
  fs.writeFileSync(p, JSON.stringify(value, null, 2) + '\n');
};
const writeBytes = (root, rel, text) => {
  const p = path.join(root, rel);
  fs.mkdirSync(path.dirname(p), { recursive: true });
  fs.writeFileSync(p, text);
  return crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex');
};
const run = (root) => spawnSync(process.execPath, [
  validator,
  '--root', root,
  '--contract', 'data/design/archer-attack-complete-motion-readiness-support-v1.json',
  '--pack', 'data/design/archer-complete-motion-readiness-pack-v1.json',
], { encoding: 'utf8' });

function buildFixture() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'archer-motion-support-'));
  const neutralPath = 'assets/neutral.png';
  const neutralSha = writeBytes(root, neutralPath, 'neutral');
  const states = {};
  const supportStates = {};
  const fpsByState = { idle: 8, move: 12, attack: 12 };
  const loopByState = { idle: true, move: true, attack: false };

  for (const state of ['idle', 'move', 'attack']) {
    const packageId = `hero.archer.${state}.pkg`;
    const framePath = `assets/${state}/frame0.png`;
    const frameSha = writeBytes(root, framePath, `${state}-frame`);
    const sidecarPath = `assets/${state}/sidecar.json`;
    const sourceMapPath = `assets/${state}/source-map.json`;
    const approvalPath = `data/${state}-approval.json`;
    writeJson(root, sidecarPath, {
      assetId: packageId,
      unitId: 'hero.archer',
      state,
      fps: fpsByState[state],
      frameCount: 1,
      loop: loopByState[state],
      anchor: [0.5, 0.92],
      canvas: [640, 960],
      rootMotion: 'in-place',
      runtimeFlipX: true,
    });
    writeJson(root, sourceMapPath, {
      assetId: packageId,
      unitId: 'hero.archer',
      state,
      sourceNeutralMaster: { sha256: neutralSha },
      frames: [{ frameIndex: 0, path: framePath, sha256: frameSha }],
    });
    const approved = state !== 'attack';
    if (approved) {
      writeJson(root, approvalPath, {
        [`${state}PackageApproved`]: true,
        userApprovalRecorded: true,
        approval: { owner: 'user' },
      });
    }
    states[state] = {
      packageId,
      frameCount: 1,
      frames: [{ frameIndex: 0, path: framePath, sha256: frameSha }],
      sidecar: sidecarPath,
    };
    supportStates[state] = {
      packageId,
      sidecar: sidecarPath,
      sourceMap: sourceMapPath,
      approvalRecord: approved ? approvalPath : null,
      assetAvailability: 'PRESENT',
      sourceVerified: true,
      technicalIntegrityValidated: true,
      technicallyValidated: approved,
      exactPackageApproved: approved,
      productionReady: approved,
      canonicalApproved: false,
      runtimeReady: false,
      ...(state === 'attack' ? { pendingReason: 'pending user review' } : {}),
    };
  }

  writeJson(root, 'data/design/archer-complete-motion-readiness-pack-v1.json', {
    characterId: 'hero.archer',
    sourceNeutralMaster: { path: neutralPath, sha256: neutralSha },
    states,
    consistencyMatrix: { fps: 12 },
  });
  writeJson(root, 'data/design/archer-attack-complete-motion-readiness-support-v1.json', {
    contractVersion: 1,
    id: 'fixture',
    extends: 'data/design/archer-complete-motion-readiness-pack-v1.json',
    characterId: 'hero.archer',
    requiredMotions: ['idle', 'move', 'attack'],
    motionIds: { idle: 'hero.archer/idle', move: 'hero.archer/move', attack: 'hero.archer/attack' },
    shared: {
      canvas: [640, 960],
      anchor: [0.5, 0.92],
      rootMotion: 'in-place',
      runtimeFlipX: true,
      fpsByState,
      loopByState,
      sourceNeutralMasterSha256: neutralSha,
    },
    states: supportStates,
    approvalEvidencePolicy: { humanApprovalOwner: 'user' },
    pendingBlockedPolicy: { assetAvailabilityEnum: ['PRESENT', 'PENDING_PRODUCTION', 'BLOCKED_MISSING_ASSET'] },
    knownBasePackCorrections: [{ path: 'consistencyMatrix.fps' }],
    completeReadiness: { completeArcherMotionApproved: false, canonicalApproved: false, runtimeEligible: false },
  });
  return root;
}

let root = buildFixture();
let r = run(root);
assert.equal(r.status, 0, `baseline should pass\n${r.stdout}\n${r.stderr}`);
fs.rmSync(root, { recursive: true, force: true });

root = buildFixture();
let contractPath = path.join(root, 'data/design/archer-attack-complete-motion-readiness-support-v1.json');
let c = JSON.parse(fs.readFileSync(contractPath, 'utf8'));
c.motionIds.attack = c.motionIds.move;
fs.writeFileSync(contractPath, JSON.stringify(c, null, 2));
r = run(root);
assert.equal(r.status, 1, 'duplicate motionId must fail');
fs.rmSync(root, { recursive: true, force: true });

root = buildFixture();
contractPath = path.join(root, 'data/design/archer-attack-complete-motion-readiness-support-v1.json');
c = JSON.parse(fs.readFileSync(contractPath, 'utf8'));
c.states.attack.canonicalApproved = true;
fs.writeFileSync(contractPath, JSON.stringify(c, null, 2));
r = run(root);
assert.equal(r.status, 1, 'canonicalApproved without human evidence must fail');
fs.rmSync(root, { recursive: true, force: true });

root = buildFixture();
contractPath = path.join(root, 'data/design/archer-attack-complete-motion-readiness-support-v1.json');
c = JSON.parse(fs.readFileSync(contractPath, 'utf8'));
c.states.attack.assetAvailability = 'PENDING_PRODUCTION';
c.states.attack.technicalIntegrityValidated = false;
c.states.attack.technicallyValidated = false;
c.states.attack.productionReady = false;
c.states.attack.exactPackageApproved = false;
c.states.attack.canonicalApproved = false;
c.states.attack.pendingReason = 'production asset not returned yet';
fs.writeFileSync(contractPath, JSON.stringify(c, null, 2));
r = run(root);
assert.equal(r.status, 2, 'pending production asset must be BLOCKED/PENDING, not PASS');
fs.rmSync(root, { recursive: true, force: true });

root = buildFixture();
const sidecarPath = path.join(root, 'assets/move/sidecar.json');
const sidecar = JSON.parse(fs.readFileSync(sidecarPath, 'utf8'));
sidecar.assetId = 'wrong.id';
fs.writeFileSync(sidecarPath, JSON.stringify(sidecar, null, 2));
r = run(root);
assert.equal(r.status, 1, 'mismatched sidecar assetId must fail');
fs.rmSync(root, { recursive: true, force: true });

console.log('✓ Archer Attack + Complete Motion Readiness support tests passed (5 cases)');
