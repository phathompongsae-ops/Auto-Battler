#!/usr/bin/env node

// Validator for the Archer Pilot Acceptance Record v1. This record is additive/administrative
// only (it records a human decision on top of already-evidenced runtime work) -- there is no
// binary/animation data to re-derive here, so this validator checks structural/value integrity
// of the record itself: required fields present, approval flags exactly as mandated, referenced
// PR/head SHA present and well-formed, and prohibitions all held false where required.

import fs from 'node:fs';
import process from 'node:process';

const RECORD_PATH = 'data/design/archer-pilot-acceptance-record-v1.json';
const EXPECTED_PR_NUMBER = 82;
const EXPECTED_HEAD_SHA = '19f8ffe0d5c7d9970b1e3435697efb84885535ec';

const errors = [];
const assert = (cond, msg) => { if (!cond) errors.push(msg); };
const ok = (msg) => console.log('✓ ' + msg);

const record = JSON.parse(fs.readFileSync(RECORD_PATH, 'utf8'));

// 1) referenced PR / head SHA
assert(record.referencedPullRequest.number === EXPECTED_PR_NUMBER, 'referencedPullRequest.number mismatch');
assert(record.referencedPullRequest.headShaAtAcceptance === EXPECTED_HEAD_SHA, 'headShaAtAcceptance mismatch');
assert(/^[0-9a-f]{40}$/.test(record.referencedPullRequest.headShaAtAcceptance), 'headShaAtAcceptance not a well-formed 40-hex SHA');
assert(record.referencedPullRequest.verifiedOpen === true, 'verifiedOpen must be true');
assert(record.referencedPullRequest.verifiedDraft === true, 'verifiedDraft must be true');
assert(record.referencedPullRequest.verifiedUnmerged === true, 'verifiedUnmerged must be true');
assert(record.referencedPullRequest.lineageDriftDetected === false, 'lineageDriftDetected must be false');
if (!errors.length) ok(`referenced PR #${EXPECTED_PR_NUMBER} head ${EXPECTED_HEAD_SHA.slice(0, 12)}… recorded, verified open/draft/unmerged, no lineage drift`);

// 2) human decision
assert(record.humanDecision.verdict === 'HUMAN_PILOT_ACCEPTED', 'humanDecision.verdict must be HUMAN_PILOT_ACCEPTED');
assert(Array.isArray(record.humanDecision.priorReworkChain) && record.humanDecision.priorReworkChain.length === 3, 'priorReworkChain must list exactly 3 reworks (v1/v2/v3)');
for (const r of record.humanDecision.priorReworkChain) {
  assert(/^[0-9a-f]{40}$/.test(r.commit), `priorReworkChain entry '${r.rework}': commit not a well-formed 40-hex SHA`);
}
if (!errors.length) ok('human decision recorded as HUMAN_PILOT_ACCEPTED with a well-formed 3-entry rework chain (v1/v2/v3)');

// 3) approval flags -- exact required values, this is the core of what the task mandates
const f = record.approvalFlags;
const expectFlags = { pilotAccepted: true, canonicalApproved: false, finalRuntimeApproved: false, merged: false };
for (const [k, v] of Object.entries(expectFlags)) assert(f[k] === v, `approvalFlags.${k} must be ${v}, got ${f[k]}`);
if (!errors.length) ok('approval flags exact: pilotAccepted=true; canonicalApproved/finalRuntimeApproved/merged=false');

// 4) retained limitations -- must be present and must include the specific items the task named
const limText = JSON.stringify(record.retainedLimitations);
const requiredSubstrings = [
  'projectile', 'representative', 'Chromium', 'DEFERRED_UNTIL_AFTER_DEMO',
  'Canonical approval has not yet been granted', 'Final runtime approval has not yet been granted',
];
for (const s of requiredSubstrings) assert(limText.includes(s), `retainedLimitations missing required reference to: "${s}"`);
assert(record.retainedLimitations.length >= 6, 'retainedLimitations must list at least the 6 required items');
if (!errors.length) ok('retainedLimitations covers all 6 required items (projectile/VFX, representative regression, browser coverage, Board Preview deferred, canonical pending, final runtime pending)');

// 5) prohibitions held -- every one must be false
const p = record.prohibitionsHeld;
for (const [k, v] of Object.entries(p)) assert(v === false, `prohibitionsHeld.${k} must be false, got ${v}`);
if (!errors.length) ok('all 10 prohibitionsHeld entries are false (no runtime/asset/animation/evidence/gameplay change, no replacement PR, no merge/auto-merge, no canonical/final-runtime flag flip)');

// 6) status string
assert(record.status === 'ARCHER_PILOT_ACCEPTANCE_RECORDED', 'record.status must be ARCHER_PILOT_ACCEPTANCE_RECORDED');
if (!errors.length) ok('record status: ARCHER_PILOT_ACCEPTANCE_RECORDED');

if (errors.length) {
  console.error('\nVALIDATION FAILED:');
  for (const e of errors) console.error('  ✗ ' + e);
  process.exit(1);
}
console.log('\nALL CHECKS PASSED — archer-pilot-acceptance-record-v1 is structurally valid and matches the mandated approval flags/prohibitions.');
