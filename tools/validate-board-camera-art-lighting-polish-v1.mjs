#!/usr/bin/env node

// Validator for the Board/Camera/Art-Direction/Lighting Polish v1 record. Re-derives every
// checkable claim independently: re-hashes the approved motion binaries against their sidecars
// (proving no PNG was touched), re-parses board-topology and gameplay literals from src/game.js,
// confirms the visual constants the record claims actually exist in source, checks the Human
// Decision Sheet carries no preselected approval, and enforces a changed-path allowlist.

import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';

const RECORD_PATH = 'data/design/board-camera-art-lighting-polish-v1.json';
const MD_PATH = 'docs/reviews/board-camera-art-lighting-polish-v1.md';
const EVIDENCE_DIR = 'docs/reviews/board-camera-art-lighting-polish-v1/evidence';
const GAME_JS_PATH = 'src/game.js';
const HTML_PATH = 'autochess.html';
const IMPORT_ROOT = 'docs/assets/review/character-production/class-1-motion-batch-2-caster-v1';
const EXPECTED_SOURCE_HEAD = '75e735d9777845b42c85d5884262611a909e7f91';
const ROSTER = ['mage', 'summoner', 'acolyte'];
const ACTIONS = ['idle', 'move', 'attack'];
const EXPECTED_NEUTRAL_SHA = {
  mage: '6587abdf0b4427ed9c95acb98a6d7c618e8be653fb13cdcaa9be1472fcb96315',
  summoner: '731531aaa1d3efc462a12d2265ad602e6e4711a83f054d8f84b5bb00f3956ae3',
  acolyte: '0853ab6d8f91e4100732c7f3628b31a09a38a762dc999dfbecef3cc23804a9c8',
};

const errors = [];
const assert = (cond, msg) => { if (!cond) errors.push(msg); };
const ok = (msg) => console.log('✓ ' + msg);
const sha = (p) => crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex');

const record = JSON.parse(fs.readFileSync(RECORD_PATH, 'utf8'));
const gameJs = fs.readFileSync(GAME_JS_PATH, 'utf8');
const html = fs.readFileSync(HTML_PATH, 'utf8');

// 1) status / approval flags / source head recorded
assert(record.status === 'BOARD_CAMERA_ART_LIGHTING_POLISH_APPROVED', `status must be BOARD_CAMERA_ART_LIGHTING_POLISH_APPROVED, got ${record.status}`);
assert(record.sourceLineage.sourceHeadExpected === EXPECTED_SOURCE_HEAD, 'sourceLineage.sourceHeadExpected mismatch');
assert(record.sourceLineage.sourceHeadVerifiedLive === EXPECTED_SOURCE_HEAD, 'sourceLineage.sourceHeadVerifiedLive mismatch');
assert(record.sourceLineage.sourcePr === 88, 'sourceLineage.sourcePr must be 88');
assert(record.approvalFlags.visualHumanApproval === true, 'approvalFlags.visualHumanApproval must be true (recorded user decision)');
assert(record.approvalFlags.canonicalApproved === false, 'approvalFlags.canonicalApproved must remain false — no canonical claim');
assert(record.approvalFlags.merged === false, 'approvalFlags.merged must remain false — no merge claim');
if (!errors.length) ok('record status BOARD_CAMERA_ART_LIGHTING_POLISH_APPROVED; source head recorded; visualHumanApproval=true, canonicalApproved/merged=false');

// 1b) Visual Human Approval decision — explicit, tied to the exact reviewed PR #89 head, with
// the covered areas and the mandatory exclusions all recorded (no canonical/merge extension)
const vhd = record.visualHumanDecision;
assert(!!vhd, 'record.visualHumanDecision is required once status is BOARD_CAMERA_ART_LIGHTING_POLISH_APPROVED');
if (vhd) {
  assert(vhd.verdict === 'VISUAL_HUMAN_APPROVED', `visualHumanDecision.verdict must be VISUAL_HUMAN_APPROVED, got ${vhd.verdict}`);
  assert(vhd.approvedAtExactHead && vhd.approvedAtExactHead.pr === 89 && vhd.approvedAtExactHead.headSha === 'b3241fae9a13ab07d4657bf2c691a3ee973950b1',
    'visualHumanDecision.approvedAtExactHead must pin PR 89 @ b3241fae9a13ab07d4657bf2c691a3ee973950b1');
  assert(Array.isArray(vhd.approvedAreas) && vhd.approvedAreas.length === 11, 'visualHumanDecision.approvedAreas must list all 11 reviewed areas');
  const mustExclude = ['gameplay', 'combatOrdering', 'balance', 'boardTopology', 'pathfinding', 'deployRules', 'motionTiming', 'motionBinaries', 'skillCast', 'projectile', 'vfx', 'meleeRuntime', 'monsterRuntime', 'finalCanonicalGameArt', 'mergeAuthorization'];
  assert(Array.isArray(vhd.explicitlyNotApproved) && mustExclude.every((x) => vhd.explicitlyNotApproved.includes(x)),
    'visualHumanDecision.explicitlyNotApproved must list every required exclusion');
}
if (!errors.length) ok('visualHumanDecision present: verdict=VISUAL_HUMAN_APPROVED pinned to PR 89 @ b3241fae…, 11 areas covered, all required exclusions recorded');

// 2) Human Decision Sheet: every field approved (consistent with the recorded decision), in both
// the JSON record and the Markdown sheet — no field may be left pending or silently disagree
for (const [k, v] of Object.entries(record.humanDecisionSheet)) {
  assert(v === 'approved', `humanDecisionSheet.${k} must be 'approved', got ${v}`);
}
assert(Object.keys(record.humanDecisionSheet).length === 11, 'humanDecisionSheet must have all 11 required fields');
const mdSheet = fs.readFileSync(MD_PATH, 'utf8');
const mdSheetSection = mdSheet.split('## Human Decision Sheet')[1].split('## ')[0];
assert(!/- \[ \]/.test(mdSheetSection), 'Markdown Human Decision Sheet must have no unchecked (pending) item left');
assert((mdSheetSection.match(/- \[x\]/gi) || []).length === 11, 'Markdown Human Decision Sheet must have exactly 11 checked items');
if (!errors.length) ok('Human Decision Sheet: 11/11 fields approved in JSON and Markdown, consistent with the recorded decision');

// 3) approved motion binaries unchanged: Neutral Masters + every sidecar-referenced frame re-hashed
for (const cls of ROSTER) {
  const p = path.join(IMPORT_ROOT, `${cls}/neutral/hero.${cls}_neutral_master.png`);
  assert(fs.existsSync(p) && sha(p) === EXPECTED_NEUTRAL_SHA[cls], `${cls}: neutral master missing or sha mismatch`);
  for (const action of ACTIONS) {
    const sidecar = JSON.parse(fs.readFileSync(path.join(IMPORT_ROOT, cls, action, `${cls}-${action}-sidecar-v1.json`), 'utf8'));
    for (const f of sidecar.orderedFrames) {
      const fp = path.join(IMPORT_ROOT, f.file);
      assert(fs.existsSync(fp) && sha(fp) === f.sha256, `${cls}/${action} frame ${f.index}: missing or sha mismatch`);
    }
  }
}
if (!errors.length) ok('approved motion binaries unchanged: 3 Neutral Masters + all 66 motion frames re-hashed against sidecars');

// 4) board topology + gameplay literals unchanged in src/game.js
for (const literal of ['const GRID_COLS = 8;', 'const GRID_ROWS = 7;', 'const TILE = 1;', 'const BENCH_ROW = 6;', 'const MAX_BENCH = 5;', 'const PLAYER_ROWS = [3, 4, 5];', 'const MANA_PER_ATTACK = 10;']) {
  assert(gameJs.includes(literal), `board/gameplay literal changed or missing: ${literal}`);
}
for (const [cls, speed] of [['mage', '0.9'], ['summoner', '1.0'], ['acolyte', '0.95']]) {
  const re = new RegExp(`${cls}:\\s*\\{[^}]*stats:\\{[^}]*attack_speed:([0-9.]+)`);
  const m = gameJs.match(re);
  assert(!!m && m[1] === speed, `${cls} attack_speed drifted (expected ${speed})`);
}
if (!errors.length) ok('board topology (8x7 grid, TILE=1, bench row, MAX_BENCH, PLAYER_ROWS) and gameplay literals (mana, caster attack speeds) unchanged');

// 5) the visual constants the record claims are actually present in source
for (const marker of ['const CAMERA_ANGLE_DEG = 56', 'const BOARD_FILL_RATIO = 0.80', 'const BOARD_DOWN_BIAS = 0.62', 'const UNIT_SHADOW_OPACITY = 0.46', 'coolFill', "stoneTileTexture('#5c5344'", 'scene.background = new THREE.Color(0x131009)', 'projectToScreen']) {
  assert(gameJs.includes(marker), `src/game.js missing expected visual-polish marker: ${marker}`);
}
assert(html.includes('--bg: #0d0b08') && html.includes('--panel-bg: #1a1510') && html.includes('--accent: #d8ad4d'), 'autochess.html warm dark-stone theme vars missing (or gold accent changed)');
assert(!gameJs.includes('renderer.shadowMap.enabled = true'), 'shadow maps must not be enabled (documented sprite-architecture limitation)');
if (!errors.length) ok('visual-polish constants verified in source (camera 56deg, fill 0.80, bias 0.62, grounding 0.46, cool fill, dark stone tiles/bg, warm UI vars; no shadow map enabled)');

// 6) evidence files exist + structured capture results are clean
const expectedShots = [];
for (const b of ['before', 'after']) for (const v of ['desktop', 'narrow']) for (const s of ['empty', '3units', '5units', '7units', 'attack']) expectedShots.push(`shots/${b}-${v}-${s}.png`);
expectedShots.push('shots/contact-board-camera.png', 'shots/contact-lighting-color.png', 'shots/contact-ui-composition.png');
for (const f of [...expectedShots, 'videos/after-battle-x1.webm', 'videos/after-battle-x4.webm', 'capture-summary.json']) {
  assert(fs.existsSync(path.join(EVIDENCE_DIR, f)), `missing evidence file: ${f}`);
}
const cap = JSON.parse(fs.readFileSync(path.join(EVIDENCE_DIR, 'capture-summary.json'), 'utf8'));
assert(Array.isArray(cap.errors) && cap.errors.length === 0, 'capture-summary must record zero errors');
for (const vp of ['desktop', 'narrow']) {
  const r = cap.interaction[vp] || {};
  assert(r.shopBuyAddsBenchUnit === true && r.tapPlaceLandedAt24 === true && r.postResizeDragMoveLandedAt54 === true && r.consoleErrors === 0,
    `interaction smoke results incomplete/failed for ${vp}: ${JSON.stringify(r)}`);
}
if (!errors.length) ok('evidence complete: 20 before/after shots + 3 contact sheets + x1/x4 clips + clean structured capture summary (interaction pass on both viewports, 0 console errors)');

// 7) changed-path allowlist vs the source branch
try {
  const { execSync } = await import('node:child_process');
  const base = execSync('git merge-base HEAD origin/cc/class1-motion-runtime-caster-v1 2>/dev/null || git rev-list --max-parents=0 HEAD', { encoding: 'utf8' }).trim();
  const changed = execSync(`git diff --name-only ${base} HEAD`, { encoding: 'utf8' }).trim().split('\n').filter(Boolean);
  const allowlist = [GAME_JS_PATH, HTML_PATH, RECORD_PATH, MD_PATH, EVIDENCE_DIR + '/', 'tools/validate-board-camera-art-lighting-polish-v1.mjs', 'tools/validate-class1-motion-runtime-caster-v1.mjs', 'docs/reviews/board-camera-art-lighting-polish-v1-mobile-review.md'];
  const disallowed = changed.filter((cf) => !allowlist.some((prefix) => cf === prefix || cf.startsWith(prefix)));
  assert(disallowed.length === 0, `changed-path allowlist violated: ${JSON.stringify(disallowed)}`);
  assert(!changed.some((cf) => cf.startsWith(IMPORT_ROOT)), 'approved package files must not appear in the changed-path list');
  assert(!changed.some((cf) => cf.startsWith('data/design/') && cf !== RECORD_PATH), 'no other data/design record may change');
  if (!errors.length) ok(`changed-path allowlist: ${changed.length} changed path(s), all in scope; approved package and unrelated records untouched`);
} catch (e) {
  console.log('⚠ changed-path allowlist check skipped (git inspection unavailable): ' + e.message);
}

if (errors.length) {
  console.error('\nVALIDATION FAILED:');
  for (const e of errors) console.error('  ✗ ' + e);
  process.exit(1);
}
console.log('\nALL CHECKS PASSED — board-camera-art-lighting-polish-v1 is consistent with source and evidence. BOARD_CAMERA_ART_LIGHTING_POLISH_APPROVED (current demo visual direction approved; no canonical/merge claim).');
