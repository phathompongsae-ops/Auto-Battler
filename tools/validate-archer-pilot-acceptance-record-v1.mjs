#!/usr/bin/env node

import fs from 'node:fs';
import process from 'node:process';
import { execFileSync } from 'node:child_process';

const RECORD_PATH = 'data/design/archer-pilot-acceptance-record-v1.json';
const DOC_PATH = 'docs/reviews/archer-pilot-acceptance-record-v1.md';
const VALIDATOR_PATH = 'tools/validate-archer-pilot-acceptance-record-v1.mjs';
const EXPECTED_REPOSITORY = 'phathompongsae-ops/Auto-Battler';
const EXPECTED_SOURCE_HEAD = '19f8ffe0d5c7d9970b1e3435697efb84885535ec';
const EXPECTED_SOURCE_BASE = '5a42b921f3371bfdaf1c5f22e5bbf750b296818d';
const ALLOWED_PATHS = [RECORD_PATH, DOC_PATH, VALIDATOR_PATH].sort();

const errors = [];
const assert = (condition, message) => { if (!condition) errors.push(message); };

let record;
try {
  record = JSON.parse(fs.readFileSync(RECORD_PATH, 'utf8'));
} catch (error) {
  console.error(`Pilot Acceptance validation FAILED: cannot parse ${RECORD_PATH}: ${error.message}`);
  process.exit(1);
}

assert(record.repository === EXPECTED_REPOSITORY, 'repository allowlist mismatch');
assert(record.recordType === 'pilot-acceptance-overlay', 'recordType must be pilot-acceptance-overlay');
assert(record.sourcePullRequest?.number === 82, 'source PR must be #82');
assert(record.sourcePullRequest?.headSha === EXPECTED_SOURCE_HEAD, 'source PR head SHA mismatch');
assert(record.sourcePullRequest?.baseSha === EXPECTED_SOURCE_BASE, 'source PR base SHA mismatch');
assert(record.sourcePullRequest?.stateAtRecordCreation?.open === true, 'source PR must be recorded open');
assert(record.sourcePullRequest?.stateAtRecordCreation?.draft === true, 'source PR must be recorded Draft');
assert(record.sourcePullRequest?.stateAtRecordCreation?.merged === false, 'source PR must be recorded unmerged');
assert(record.sourcePullRequest?.stateAtRecordCreation?.lineageDriftDetected === false, 'lineage drift must be false');

assert(record.humanDecision?.verdict === 'HUMAN_PILOT_ACCEPTED', 'human decision mismatch');
assert(record.humanDecision?.context?.some((value) => value.includes('READY_FOR_HUMAN_PILOT_ACCEPTANCE')), 'independent recommendation evidence missing');

const flags = record.approvalFlags ?? {};
assert(flags.pilotAccepted === true, 'pilotAccepted must be true');
assert(flags.canonicalApproved === false, 'canonicalApproved must remain false');
assert(flags.finalRuntimeApproved === false, 'finalRuntimeApproved must remain false');
assert(flags.merged === false, 'merged must remain false');

const limitations = new Map((record.retainedLimitations ?? []).map((entry) => [entry.id, entry]));
for (const id of [
  'no-projectile-vfx-system',
  'representative-regression-only',
  'browser-device-coverage',
  'board-preview-runtime-representativeness',
  'canonical-approval-not-granted',
  'final-runtime-approval-not-granted'
]) {
  assert(limitations.has(id), `missing retained limitation: ${id}`);
}
assert(limitations.get('board-preview-runtime-representativeness')?.status === 'DEFERRED_UNTIL_AFTER_DEMO', 'Board Preview deferral classification mismatch');
assert(limitations.get('board-preview-runtime-representativeness')?.pilotAcceptanceBlocker === false, 'Board Preview must not be a Pilot Acceptance blocker');

for (const [key, value] of Object.entries(record.scopeVerification ?? {})) {
  assert(value === false, `scopeVerification.${key} must remain false`);
}

assert(fs.existsSync(DOC_PATH), `missing Markdown record: ${DOC_PATH}`);

try {
  const parent = execFileSync('git', ['rev-parse', 'HEAD^'], { encoding: 'utf8' }).trim();
  assert(parent === EXPECTED_SOURCE_HEAD, `approval commit parent must be exact PR #82 head; measured ${parent}`);
  const changed = execFileSync('git', ['diff', '--name-only', 'HEAD^', 'HEAD'], { encoding: 'utf8' })
    .trim().split('\n').filter(Boolean).sort();
  assert(JSON.stringify(changed) === JSON.stringify(ALLOWED_PATHS), `changed-path allowlist mismatch: ${changed.join(', ')}`);
} catch (error) {
  errors.push(`could not verify commit parent/changed paths: ${error.message}`);
}

if (errors.length) {
  console.error('Archer Pilot Acceptance Record validation FAILED:');
  for (const error of errors) console.error(`- ${error}`);
  process.exit(1);
}

console.log('✓ Archer Pilot Acceptance Record validation PASSED');
console.log('✓ repository, PR #82, exact head/base and no-drift snapshot recorded');
console.log('✓ HUMAN_PILOT_ACCEPTED recorded after READY_FOR_HUMAN_PILOT_ACCEPTANCE');
console.log('✓ approval flags: pilotAccepted=true; canonical/finalRuntime/merged=false');
console.log('✓ retained limitations and Board Preview deferral recorded');
console.log('✓ exact source-head parent and three-file changed-path allowlist verified');
