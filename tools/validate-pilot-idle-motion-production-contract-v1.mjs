#!/usr/bin/env node

import crypto from 'node:crypto';
import fs from 'node:fs';
import process from 'node:process';
import { execFileSync } from 'node:child_process';

const BASE = '58824feb92452fb3c7ab72bf7984b4f22d558b3e';
const CONTRACT = 'data/design/pilot-idle-motion-production-contract-v1.json';
const SLIME_POSES = 'data/design/slime-idle-pose-map-v1.json';
const GOLEM_POSES = 'data/design/golem-idle-pose-map-v1.json';
const DOC = 'docs/assets/pilot-idle-motion-production-contract-v1.md';
const SELF = 'tools/validate-pilot-idle-motion-production-contract-v1.mjs';
const ALLOWED = new Set([CONTRACT, SLIME_POSES, GOLEM_POSES, DOC, SELF]);
const errors = [];
const assert = (ok, message) => { if (!ok) errors.push(message); };
const readJson = (path) => {
  try { return JSON.parse(fs.readFileSync(path, 'utf8')); }
  catch (error) { errors.push(`${path}: JSON parse failed (${error.message})`); return null; }
};
const sha256 = (path) => crypto.createHash('sha256').update(fs.readFileSync(path)).digest('hex');

for (const path of ALLOWED) assert(fs.existsSync(path), `missing required file: ${path}`);
const contract = fs.existsSync(CONTRACT) ? readJson(CONTRACT) : null;
const slime = fs.existsSync(SLIME_POSES) ? readJson(SLIME_POSES) : null;
const golem = fs.existsSync(GOLEM_POSES) ? readJson(GOLEM_POSES) : null;

if (contract) {
  assert(contract.contractId === 'pilot-idle-motion-production-contract-v1', 'contractId mismatch');
  assert(contract.base?.pullRequest === 45, 'base PR must be 45');
  assert(contract.base?.branch === 'cc/motion-pipeline-merge-readiness-audit-v1', 'base branch mismatch');
  assert(contract.base?.exactHead === BASE, 'base exact SHA mismatch');
  assert(contract.scope?.metadataAndDocumentationOnly === true, 'phase must be metadata/docs only');
  assert(contract.scope?.runtimeIntegration === false, 'runtimeIntegration must be false');
  assert(contract.scope?.browserX4ValidationRequiredFromCC === true, 'CC x4 review must remain required');
  assert(contract.canonicalApproved === false, 'contract canonicalApproved must be false');
  assert(Array.isArray(contract.futureReviewCheckpoints) && contract.futureReviewCheckpoints.length === 3, 'exactly three future CC checkpoints required');

  const expected = {
    'monster.slime': { canvas: [512, 512], anchor: [0.5, 0.9], master: 'assets/units/monster.slime/move/monster.slime_move_000.png' },
    'monster.golem': { canvas: [640, 640], anchor: [0.5, 0.94], master: 'assets/units/monster.golem/attack/monster.golem_attack_000.png' }
  };
  for (const [unitId, want] of Object.entries(expected)) {
    const unit = contract.units?.[unitId];
    assert(unit?.unitId === unitId, `${unitId}: unitId mismatch`);
    assert(unit?.state === 'idle', `${unitId}: state must be idle`);
    assert(unit?.frameCount === 8 && unit?.fps === 8 && unit?.loop === true, `${unitId}: timing must be 8 frames at 8 FPS looped`);
    assert(unit?.rootMotion === 'in-place', `${unitId}: rootMotion must be in-place`);
    assert(Array.isArray(unit?.eventMarkers) && unit.eventMarkers.length === 0, `${unitId}: eventMarkers must be empty`);
    assert(JSON.stringify(unit?.canvas) === JSON.stringify(want.canvas), `${unitId}: canvas mismatch`);
    assert(JSON.stringify(unit?.anchor) === JSON.stringify(want.anchor), `${unitId}: anchor mismatch`);
    assert(unit?.runtimeFlipX === true, `${unitId}: runtimeFlipX must reflect facingMode flip_x`);
    assert(unit?.runtimeFlipXEvidence?.path === 'src/asset-animation-runtime.js' && unit?.runtimeFlipXEvidence?.value === 'flip_x', `${unitId}: runtime flip evidence missing`);
    assert(unit?.identityMaster?.neutralFrame === want.master, `${unitId}: neutral identity master mismatch`);
    assert(unit?.canonicalApproved === false, `${unitId}: canonicalApproved must be false`);
  }

  for (const [group, hashes] of Object.entries(contract.sourceIntegrity ?? {})) {
    if (!Array.isArray(hashes)) continue;
    const [unitId, state] = group.split('/');
    const dir = `assets/units/${unitId}/${state}`;
    const prefix = `${unitId}_${state}_`;
    const actual = Array.from({ length: 8 }, (_, index) => sha256(`${dir}/${prefix}${String(index).padStart(3, '0')}.png`));
    assert(JSON.stringify(actual) === JSON.stringify(hashes), `${group}: locked source frame hashes changed`);
  }
  for (const [path, hash] of Object.entries(contract.sourceIntegrity?.sidecars ?? {})) {
    assert(fs.existsSync(path), `missing locked source sidecar: ${path}`);
    if (fs.existsSync(path)) assert(sha256(path) === hash, `${path}: locked source sidecar hash changed`);
  }
}

for (const [name, map, expected] of [
  ['Slime', slime, { unitId: 'monster.slime', canvas: [512, 512], anchor: [0.5, 0.9] }],
  ['Golem', golem, { unitId: 'monster.golem', canvas: [640, 640], anchor: [0.5, 0.94] }]
]) {
  if (!map) continue;
  assert(map.unitId === expected.unitId && map.state === 'idle', `${name}: identity/state mismatch`);
  assert(map.frameCount === 8 && map.fps === 8 && map.loop === true, `${name}: timing mismatch`);
  assert(JSON.stringify(map.canvas) === JSON.stringify(expected.canvas), `${name}: canvas mismatch`);
  assert(JSON.stringify(map.anchor) === JSON.stringify(expected.anchor), `${name}: anchor mismatch`);
  assert(map.runtimeFlipX === true, `${name}: runtimeFlipX must be true`);
  assert(map.rootMotion === 'in-place', `${name}: rootMotion must be in-place`);
  assert(Array.isArray(map.eventMarkers) && map.eventMarkers.length === 0, `${name}: eventMarkers must be empty`);
  assert(Array.isArray(map.poses) && map.poses.length === 8, `${name}: exactly eight poses required`);
  assert(map.poses?.every((pose, index) => pose.frame === index && typeof pose.role === 'string' && pose.role.length > 0), `${name}: poses must map frames 0-7 in order`);
  assert(map.canonicalApproved === false, `${name}: canonicalApproved must be false`);
}

if (fs.existsSync(DOC)) {
  const markdown = fs.readFileSync(DOC, 'utf8');
  for (const section of ['Approval and scope', 'Source facts and identity masters', 'Common idle export contract', 'Slime idle motion', 'Golem idle motion', 'Cross-state quality gates', 'Production ancestry', 'Canonical state']) {
    assert(markdown.includes(`## ${section}`), `markdown missing section: ${section}`);
  }
  assert(markdown.includes('canonicalApproved=false'), 'markdown must state canonicalApproved=false');
  assert(markdown.includes('x4'), 'markdown must preserve future x4 requirement');
}

try {
  const source = fs.readFileSync('src/asset-animation-runtime.js', 'utf8');
  const slimeBlock = source.match(/'monster\.slime':\s*\{[\s\S]*?\n\s*\},\n\s*'monster\.golem'/)?.[0] ?? '';
  const golemBlock = source.match(/'monster\.golem':\s*\{[\s\S]*?\n\s*\},\n\s*\};/)?.[0] ?? '';
  assert(/facingMode:\s*'flip_x'/.test(slimeBlock), 'runtime provenance no longer declares Slime facingMode flip_x');
  assert(/facingMode:\s*'flip_x'/.test(golemBlock), 'runtime provenance no longer declares Golem facingMode flip_x');
} catch (error) { errors.push(`runtime provenance check failed (${error.message})`); }

try {
  const tracked = execFileSync('git', ['diff', '--name-only', BASE], { encoding: 'utf8' }).trim().split(/\n/).filter(Boolean);
  const status = execFileSync('git', ['status', '--porcelain'], { encoding: 'utf8' }).trim().split(/\n/).filter(Boolean).map((line) => line.slice(3));
  const changed = [...new Set([...tracked, ...status])];
  for (const path of changed) assert(ALLOWED.has(path), `out-of-scope changed path: ${path}`);
} catch (error) { errors.push(`scope check failed (${error.message})`); }

if (errors.length) {
  console.error('Pilot idle motion production contract validation failed:');
  for (const error of errors) console.error(`- ${error}`);
  process.exit(1);
}

console.log('Pilot idle motion production contract validation passed.');
console.log('Source locks: Slime Move 8/8 and Golem Attack visual-fix-v2 8/8 unchanged.');
console.log('Exports locked: Slime 512x512 @ [0.5,0.9]; Golem 640x640 @ [0.5,0.94].');
console.log('Approval: canonicalApproved=false; CC browser/x4 review remains pending.');
