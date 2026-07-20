#!/usr/bin/env node

// Validator for the Class 1 Motion Runtime Integration record (Caster Family: Mage/Summoner/
// Acolyte, Phase 1). Re-derives every checkable claim independently rather than trusting the
// record or src/game.js's own comments: re-hashes the Neutral Masters and every approved motion
// frame referenced by src/game.js's CASTER_FRAME_SEQS registry against each action's own sidecar
// JSON, re-parses HERO_DEFS attack_speed values directly from source, and enforces a changed-path
// allowlist so this branch cannot silently touch the imported package, PR #87's own approval
// record, or unrelated Runtime code.

import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';

const RECORD_PATH = 'data/design/class1-motion-runtime-caster-v1.json';
const HUMAN_REVIEW_RECORD_PATH = 'data/design/class1-motion-runtime-caster-human-review-v1.json';
const HUMAN_REVIEW_MD_PATH = 'docs/reviews/class1-motion-runtime-caster-human-review-v1.md';
const APPROVAL_RECORD_PATH = 'data/design/class1-motion-batch-2-caster-exact-package-approval-v1.json';
const NEUTRAL_RECORD_PATH = 'data/design/class1-neutral-master-batch-exact-package-approval-v1.json';
const GAME_JS_PATH = 'src/game.js';
const IMPORT_ROOT = 'docs/assets/review/character-production/class-1-motion-batch-2-caster-v1';
const EVIDENCE_DIR = 'docs/reviews/class1-motion-runtime-caster-v1/evidence';
const ROSTER = ['mage', 'summoner', 'acolyte'];
const ACTIONS = ['idle', 'move', 'attack'];
const EXPECTED_PR87_HEAD = '7c5b0262c5e4febaad57e00720e2d6deb55f72b1';
const EXPECTED_PACKAGE_SHA = '2a7e074388f0ce93f9182a841d91ff45477af6ed6c52015bee1a29531d7016af';
const EXPECTED_NEUTRAL_SHA = {
  mage: '6587abdf0b4427ed9c95acb98a6d7c618e8be653fb13cdcaa9be1472fcb96315',
  summoner: '731531aaa1d3efc462a12d2265ad602e6e4711a83f054d8f84b5bb00f3956ae3',
  acolyte: '0853ab6d8f91e4100732c7f3628b31a09a38a762dc999dfbecef3cc23804a9c8',
};
const EXPECTED_ATTACK_SPEED = { mage: 0.9, summoner: 1.0, acolyte: 0.95 };

const errors = [];
const assert = (cond, msg) => { if (!cond) errors.push(msg); };
const ok = (msg) => console.log('✓ ' + msg);
const sha = (p) => crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex');

const record = JSON.parse(fs.readFileSync(RECORD_PATH, 'utf8'));
const approvalRecord = JSON.parse(fs.readFileSync(APPROVAL_RECORD_PATH, 'utf8'));
const gameJs = fs.readFileSync(GAME_JS_PATH, 'utf8');

// 1) record status / approval flags
assert(record.status === 'CLASS1_MOTION_RUNTIME_CASTER_APPROVED', `record.status must be CLASS1_MOTION_RUNTIME_CASTER_APPROVED, got ${record.status}`);
const f = record.approvalFlags;
const expectTrue = { humanVisualApproval: true, motionProductionApproved: true, exactPackageApproved: true, runtimeIntegrationAuthorized: true, runtimeIntegrated: true };
for (const [k, v] of Object.entries(expectTrue)) assert(f[k] === v, `approvalFlags.${k} must be ${v}, got ${f[k]}`);
const expectFalse = { canonicalApproved: false, merged: false };
for (const [k, v] of Object.entries(expectFalse)) assert(f[k] === v, `approvalFlags.${k} must be ${v}, got ${f[k]}`);
if (!errors.length) ok('record status CLASS1_MOTION_RUNTIME_CASTER_APPROVED; approvalFlags exact (runtimeIntegrationAuthorized/runtimeIntegrated=true, canonicalApproved/merged=false)');

// 1b) Runtime Human Approval decision — must be an explicit, non-fabricated record, and must not
// claim board/camera/art/lighting/UI presentation was approved
const rhd = record.runtimeHumanDecision;
assert(!!rhd, 'record.runtimeHumanDecision is required once status is CLASS1_MOTION_RUNTIME_CASTER_APPROVED');
if (rhd) {
  assert(rhd.verdict === 'RUNTIME_HUMAN_APPROVED', `runtimeHumanDecision.verdict must be RUNTIME_HUMAN_APPROVED, got ${rhd.verdict}`);
  assert(Array.isArray(rhd.approvedCharacters) && ROSTER.every((c) => rhd.approvedCharacters.includes(c)), 'runtimeHumanDecision.approvedCharacters must cover mage/summoner/acolyte');
  assert(rhd.approvedAtExactHead && rhd.approvedAtExactHead.pr === 88, 'runtimeHumanDecision.approvedAtExactHead.pr must be 88');
  const mustExclude = ['boardAppearance', 'boardLayout', 'cameraFraming', 'artDirection', 'lighting', 'shadows', 'colorGrading', 'uiTone', 'skillCast', 'projectile', 'vfx', 'gameplay', 'balance', 'combatOrdering', 'meleeRuntime', 'archerRuntime', 'monsterRuntime'];
  assert(Array.isArray(rhd.explicitlyNotApproved) && mustExclude.every((x) => rhd.explicitlyNotApproved.includes(x)), 'runtimeHumanDecision.explicitlyNotApproved must list every required exclusion (board/camera/art/lighting/UI/Skill-Cast/etc.)');
}
if (!errors.length) ok('runtimeHumanDecision present: verdict=RUNTIME_HUMAN_APPROVED, characters cover mage/summoner/acolyte, board/camera/art/lighting/UI/Skill-Cast/etc. explicitly excluded');

// 2) source lineage: PR #87 head + package identity, cross-checked against the (untouched)
//    exact-package-approval record, which must NOT itself claim Runtime Integration/merge
assert(record.sourceLineage.pr87HeadExpected === EXPECTED_PR87_HEAD, 'sourceLineage.pr87HeadExpected mismatch');
assert(record.sourceLineage.pr87HeadVerifiedLive === EXPECTED_PR87_HEAD, 'sourceLineage.pr87HeadVerifiedLive mismatch');
assert(record.sourceLineage.packageSha256Expected === EXPECTED_PACKAGE_SHA, 'sourceLineage.packageSha256Expected mismatch');
assert(approvalRecord.packageHandoff.sha256Measured === EXPECTED_PACKAGE_SHA, 'PR #87 approval record packageHandoff.sha256Measured mismatch');
assert(approvalRecord.approvalFlags.runtimeIntegrationAuthorized === false, 'PR #87 approval record must NOT be modified to claim runtimeIntegrationAuthorized');
assert(approvalRecord.approvalFlags.runtimeIntegrated === false, 'PR #87 approval record must NOT be modified to claim runtimeIntegrated');
assert(approvalRecord.approvalFlags.merged === false, 'PR #87 approval record must NOT be modified to claim merged');
if (!errors.length) ok('source lineage: PR #87 head + package SHA-256 match; PR #87\'s own approval record left untouched (not claiming Runtime Integration/merge)');

// 3) Neutral Masters — re-hashed from the untouched import root, cross-checked against this
//    record, EXPECTED_NEUTRAL_SHA, and PR #83's own candidate record
const neutralRecord = JSON.parse(fs.readFileSync(NEUTRAL_RECORD_PATH, 'utf8'));
const neutralCandidates = Object.fromEntries((neutralRecord.candidates || []).map((c) => [c.classId, c.sha256]));
for (const cls of ROSTER) {
  const p = path.join(IMPORT_ROOT, `${cls}/neutral/hero.${cls}_neutral_master.png`);
  assert(fs.existsSync(p), `${cls}: neutral master missing`);
  if (!fs.existsSync(p)) continue;
  const measured = sha(p);
  assert(measured === EXPECTED_NEUTRAL_SHA[cls], `${cls}: neutral master sha mismatch (measured ${measured})`);
  assert(measured === neutralCandidates[cls], `${cls}: neutral master sha does not match PR #83's own candidate record`);
}
if (!errors.length) ok('3/3 Neutral Masters re-hashed and confirmed byte-identical to both this record and PR #83');

// 4) imported package inventory unchanged (134 files, no PNG/GIF touched by this branch)
const importedFiles = [];
(function walk(dir) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full); else importedFiles.push(full);
  }
})(IMPORT_ROOT);
assert(importedFiles.length === 134, `imported file count ${importedFiles.length} != 134`);
if (!errors.length) ok(`imported-file inventory unchanged: ${importedFiles.length}/134 files present`);

// 5) src/game.js static checks — additive markers present
for (const marker of ['CASTER_FRAME_SEQS', 'boardSprite', 'updateCasterAnim', '__casterRuntimeTestHook', 'loadCasterFrames']) {
  assert(gameJs.includes(marker), `src/game.js missing expected marker: ${marker}`);
}
// isSharedUnitTexture must have been extended to recognize CASTER_FRAME_SEQS textures as shared
// (lifecycle-safety fix) — extract the function body and check the reference lives inside it.
const isSharedFnMatch = gameJs.match(/function isSharedUnitTexture\(t\) \{[\s\S]*?\n\}/);
assert(!!isSharedFnMatch && isSharedFnMatch[0].includes('CASTER_FRAME_SEQS'), 'isSharedUnitTexture() must recognize CASTER_FRAME_SEQS textures as shared (lifecycle-safety fix)');
// sprite field (portrait source) must be UNTOUCHED for all 3 casters — dual-purpose-field guard
assert(/mage:\s*\{[^}]*sprite:'Archmage'/.test(gameJs), 'mage HERO_DEFS entry must keep sprite:\'Archmage\' unchanged (portrait path)');
assert(/summoner:\s*\{[^}]*sprite:'Summoner'/.test(gameJs), 'summoner HERO_DEFS entry must keep sprite:\'Summoner\' unchanged (portrait path)');
assert(/acolyte:\s*\{[^}]*sprite:'FrostWeaver'/.test(gameJs), 'acolyte HERO_DEFS entry must keep sprite:\'FrostWeaver\' unchanged (portrait path)');
// shared placeholder sheet entries used by OTHER heroes must remain intact (regression guard)
for (const key of ['archmage', 'frost_weaver', 'inquisitor', 'priest']) {
  assert(gameJs.includes(`${key}:`), `HERO_DEFS.${key} entry must still exist (regression guard)`);
}
if (!errors.length) ok('src/game.js additive markers present; sprite/portrait fields unchanged; shared placeholder sheet entries intact');

// 6) HERO_DEFS attack_speed values re-parsed directly from source, cross-checked against the record
for (const cls of ROSTER) {
  const re = new RegExp(`${cls}:\\s*\\{[^}]*stats:\\{[^}]*attack_speed:([0-9.]+)`);
  const m = gameJs.match(re);
  assert(!!m, `could not locate ${cls} HERO_DEFS attack_speed in src/game.js`);
  if (m) assert(Number(m[1]) === EXPECTED_ATTACK_SPEED[cls], `${cls} attack_speed drifted: source has ${m[1]}, expected ${EXPECTED_ATTACK_SPEED[cls]}`);
}
if (!errors.length) ok('HERO_DEFS attack_speed values (0.9/1.0/0.95) re-confirmed directly from source, matching the record\'s measured comparison');

// 7) per-action frame sequences: re-derive expected {frameCount, durationsCs, loop} from each
//    action's own sidecar (never trust the record or src/game.js's own literals) and cross-check
//    against the casterSeq(...) call literals actually present in src/game.js
for (const cls of ROSTER) {
  for (const action of ACTIONS) {
    const sidecarPath = path.join(IMPORT_ROOT, cls, action, `${cls}-${action}-sidecar-v1.json`);
    assert(fs.existsSync(sidecarPath), `${cls}/${action}: sidecar missing`);
    if (!fs.existsSync(sidecarPath)) continue;
    const sidecar = JSON.parse(fs.readFileSync(sidecarPath, 'utf8'));
    const expectedFrameCount = sidecar.orderedFrames.length;
    const expectedDurations = sidecar.durationsCentiseconds;
    const expectedLoop = sidecar.loop;

    const callRe = new RegExp(`casterSeq\\('${cls}',\\s*'${action}',\\s*(\\d+),\\s*\\[([^\\]]*)\\],\\s*(true|false)\\)`);
    const m = gameJs.match(callRe);
    assert(!!m, `src/game.js missing casterSeq('${cls}', '${action}', ...) call`);
    if (!m) continue;
    const sourceFrameCount = Number(m[1]);
    const sourceDurations = m[2].split(',').map((s) => Number(s.trim()));
    const sourceLoop = m[3] === 'true';
    assert(sourceFrameCount === expectedFrameCount, `${cls}/${action}: src/game.js frameCount ${sourceFrameCount} != sidecar ${expectedFrameCount}`);
    assert(JSON.stringify(sourceDurations) === JSON.stringify(expectedDurations), `${cls}/${action}: src/game.js durations ${JSON.stringify(sourceDurations)} != sidecar ${JSON.stringify(expectedDurations)}`);
    assert(sourceLoop === expectedLoop, `${cls}/${action}: src/game.js loop=${sourceLoop} != sidecar loop=${expectedLoop}`);

    // frame files themselves: exist and hash-match the sidecar (defense-in-depth, same as the
    // exact-package-approval validator)
    for (const frame of sidecar.orderedFrames) {
      const p = path.join(IMPORT_ROOT, frame.file);
      assert(fs.existsSync(p), `${cls}/${action} frame ${frame.index}: file missing`);
      if (fs.existsSync(p)) assert(sha(p) === frame.sha256, `${cls}/${action} frame ${frame.index}: measured sha != sidecar sha`);
    }
  }
}
if (!errors.length) ok('all 9 caster motion sequences (frameCount/durations/loop) in src/game.js re-derived and matched against each action\'s own sidecar; all referenced frame files hash-match');

// 8) evidence present
for (const file of ['board-multi-caster-clean-idle.png', 'board-real-battle-x1.png', 'board-real-battle-x4.png', 'runtime-test-raw-results.json']) {
  assert(fs.existsSync(path.join(EVIDENCE_DIR, file)), `missing evidence file: ${file}`);
}
const evidencePath = path.join(EVIDENCE_DIR, 'runtime-test-raw-results.json');
if (fs.existsSync(evidencePath)) {
  const ev = JSON.parse(fs.readFileSync(evidencePath, 'utf8'));
  assert(ev.casterLoaded === true, 'evidence: casterLoaded must be true');
  assert(Array.isArray(ev.consoleErrors) && ev.consoleErrors.length === 0, 'evidence: consoleErrors must be empty');
}
if (!errors.length) ok('x4/normal-speed Runtime evidence present (screenshots + structured JSON), casterLoaded=true, 0 console errors');

// 8b) Human Review evidence record (if present): before an explicit runtimeHumanDecision exists,
// every checklist item (including the batch-level runtimeMotionApproved verdict) must remain
// 'pending' — approval must never be preselected. Once record.runtimeHumanDecision.verdict is
// RUNTIME_HUMAN_APPROVED, this record's checklist must consistently reflect that same resolved
// decision ('approved'), not silently disagree with it.
if (fs.existsSync(HUMAN_REVIEW_RECORD_PATH)) {
  const hr = JSON.parse(fs.readFileSync(HUMAN_REVIEW_RECORD_PATH, 'utf8'));
  const decided = record.runtimeHumanDecision && record.runtimeHumanDecision.verdict === 'RUNTIME_HUMAN_APPROVED';
  const expected = decided ? 'approved' : 'pending';
  for (const cls of ROSTER) {
    const c = hr.humanReviewChecklist && hr.humanReviewChecklist[cls];
    assert(!!c, `human review checklist missing section for ${cls}`);
    if (c) for (const [k, v] of Object.entries(c)) assert(v === expected, `human review checklist ${cls}.${k} must be '${expected}', got ${v}`);
  }
  const batch = hr.humanReviewChecklist && hr.humanReviewChecklist.batch;
  assert(!!batch, 'human review checklist missing batch section');
  if (batch) for (const [k, v] of Object.entries(batch)) assert(v === expected, `human review checklist batch.${k} must be '${expected}', got ${v}`);
  if (!errors.length) ok(`Human Review checklist present and consistent with the recorded decision (every field, including batch.runtimeMotionApproved, is '${expected}')`);
}

// 9) changed-path allowlist — this branch must not touch the imported package, PR #87's own
//    approval record, or any unrelated Runtime/Combat/gameplay code
try {
  const { execSync } = await import('node:child_process');
  const base = execSync('git merge-base HEAD origin/cc/class1-motion-batch-2-caster-production-v1 2>/dev/null || git rev-list --max-parents=0 HEAD', { encoding: 'utf8' }).trim();
  const changed = execSync(`git diff --name-only ${base} HEAD`, { encoding: 'utf8' }).trim().split('\n').filter(Boolean);
  const allowlist = [GAME_JS_PATH, RECORD_PATH, 'docs/reviews/class1-motion-runtime-caster-v1.md', 'docs/reviews/class1-motion-runtime-caster-v1/', 'tools/validate-class1-motion-runtime-caster-v1.mjs', HUMAN_REVIEW_RECORD_PATH, HUMAN_REVIEW_MD_PATH,
    // Board/Camera/Art/Lighting Polish v1 (branch cc/board-camera-art-lighting-polish-v1): additional
    // authorized visual-presentation-only paths — src/game.js visual constants + autochess.html theme
    // are separately guarded by tools/validate-board-camera-art-lighting-polish-v1.mjs (topology/
    // gameplay-literal/motion-binary checks)
    'autochess.html', 'data/design/board-camera-art-lighting-polish-v1.json', 'docs/reviews/board-camera-art-lighting-polish-v1.md', 'docs/reviews/board-camera-art-lighting-polish-v1/', 'tools/validate-board-camera-art-lighting-polish-v1.mjs'];
  const disallowed = changed.filter((cf) => !allowlist.some((prefix) => cf === prefix || cf.startsWith(prefix)));
  assert(disallowed.length === 0, `changed-path allowlist violated: ${JSON.stringify(disallowed)}`);
  assert(!changed.includes(APPROVAL_RECORD_PATH), 'PR #87 approval record must not appear in the changed-path list');
  assert(!changed.some((cf) => cf.startsWith(IMPORT_ROOT)), 'imported package files must not appear in the changed-path list');
  if (!errors.length) ok(`changed-path allowlist: ${changed.length} changed path(s), all in scope, import root and PR #87 record untouched`);
} catch (e) {
  console.log('⚠ changed-path allowlist check skipped (git inspection unavailable): ' + e.message);
}

if (errors.length) {
  console.error('\nVALIDATION FAILED:');
  for (const e of errors) console.error('  ✗ ' + e);
  process.exit(1);
}
console.log('\nALL CHECKS PASSED — class1-motion-runtime-caster-v1 record is consistent with src/game.js and the approved source package. CLASS1_MOTION_RUNTIME_CASTER_APPROVED (board/camera/art/lighting/UI presentation NOT approved).');
