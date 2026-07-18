#!/usr/bin/env node

// Motion Pipeline Stack & Merge Readiness Audit v1 — pure repository-state gate.
// Confirms the archer three-state motion-test package (idle/move/attack) is internally
// consistent, that every per-state validator and the package transition gate exist, that no
// extra/duplicate frame files crept in, and that the Arena Ruins Final Board Art Production
// Plan (PR #43, a Coco docs/asset-source branch) was never accidentally pulled into this
// integration branch. Read-only: never modifies any file, never touches Combat/Core Logic.

import fs from 'node:fs';
import process from 'node:process';

const errors = [];
const assert = (ok, msg) => { if (!ok) errors.push(msg); };
const eq = (a, b, msg) => assert(JSON.stringify(a) === JSON.stringify(b), `${msg} (got ${JSON.stringify(a)}, expected ${JSON.stringify(b)})`);

const ROOT = new URL('..', import.meta.url).pathname;
const read = (p) => fs.readFileSync(ROOT + p, 'utf8');
const exists = (p) => fs.existsSync(ROOT + p);
const json = (p) => JSON.parse(read(p));

// --- 1. all three archer sidecars present and internally consistent ---
const SIDECARS = {
  idle: 'assets/units/hero.archer/hero.archer_idle_motiontest.json',
  move: 'assets/units/hero.archer/hero.archer_move_motiontest.json',
  attack: 'assets/units/hero.archer/hero.archer_attack_motiontest.json',
};
const side = {};
for (const [st, p] of Object.entries(SIDECARS)) {
  assert(exists(p), `missing sidecar: ${p}`);
  if (exists(p)) side[st] = json(p);
}
if (side.idle && side.move && side.attack) {
  for (const st of ['idle', 'move', 'attack']) {
    eq(side[st].unitId, 'hero.archer', `${st}: unitId`);
    eq(side[st].anchor, [0.5, 0.92], `${st}: anchor`);
    eq(side[st].canvas, [320, 480], `${st}: canvas`);
    eq(side[st].canonicalApproved, false, `${st}: canonicalApproved must remain false`);
  }
  eq(side.idle.eventMarkers, [], 'idle must declare NO markers');
  eq(side.move.eventMarkers, [{ name: 'leftFootstepCue', normalizedTime: 0.25 }, { name: 'rightFootstepCue', normalizedTime: 0.75 }], 'move must declare exactly left->right footstep cues');
  const attackMarkers = side.attack.eventMarkers || [];
  assert(attackMarkers.length === 1 && attackMarkers[0].name === 'projectileRelease', 'attack must declare exactly projectileRelease');
  eq(side.idle.frameCount, 8, 'idle frameCount contract');
  eq(side.move.frameCount, 8, 'move frameCount contract');
  eq(side.attack.frameCount, 10, 'attack frameCount contract');
}

// --- 2. PNG counts on disk match contract, naming 000..N-1, no extra frame files ---
const FRAME_DIRS = {
  idle: { dir: 'assets/units/hero.archer/idle', prefix: 'hero.archer_idle_', count: 8 },
  move: { dir: 'assets/units/hero.archer/move', prefix: 'hero.archer_move_', count: 8 },
  attack: { dir: 'assets/units/hero.archer/attack', prefix: 'hero.archer_attack_', count: 10 },
};
for (const [st, { dir, prefix, count }] of Object.entries(FRAME_DIRS)) {
  const files = fs.existsSync(ROOT + dir) ? fs.readdirSync(ROOT + dir).filter((f) => f.endsWith('.png')) : [];
  for (let i = 0; i < count; i++) {
    const name = prefix + String(i).padStart(3, '0') + '.png';
    assert(files.includes(name), `${st}: missing expected frame ${name}`);
  }
  const extra = files.filter((f) => !Array.from({ length: count }, (_, i) => prefix + String(i).padStart(3, '0') + '.png').includes(f));
  assert(extra.length === 0, `${st}: unexpected extra frame file(s): ${extra.join(', ')}`);
}

// --- 3. no duplicate state filenames across the three archer state directories ---
const allFrameNames = new Set();
for (const { dir } of Object.values(FRAME_DIRS)) {
  if (!fs.existsSync(ROOT + dir)) continue;
  for (const f of fs.readdirSync(ROOT + dir)) {
    if (!f.endsWith('.png')) continue;
    assert(!allFrameNames.has(f), `duplicate frame filename across states: ${f}`);
    allFrameNames.add(f);
  }
}

// --- 4. every per-state validator + the package transition gate exist ---
const REQUIRED_TOOLS = [
  'tools/validate-archer-idle-frames-v1.mjs',
  'tools/validate-archer-move-frames-v1.mjs',
  'tools/validate-archer-attack-frames-v1.mjs',
  'tools/validate-slime-move-frames-v1.mjs',
  'tools/validate-golem-attack-frames-v1.mjs',
  'tools/validate-pilot-motion-test-contract-v1.mjs',
  'tools/test-motion-test-harness.mjs',
  'tools/test-archer-package-transitions-v1.mjs',
];
for (const t of REQUIRED_TOOLS) assert(exists(t), `missing required tool: ${t}`);

// --- 5. PR #43 (Arena Ruins Final Board Art Production Plan, a Coco docs/asset-source branch)
// files must NOT have been pulled into this CC motion-integration branch by accident ---
const PR43_FILES = [
  'docs/assets/arena-ruins-final-board-art-plan-v1.md',
  'data/design/arena-ruins-final-board-art-manifest-v1.json',
  'data/design/arena-ruins-board-safe-zones-v1.json',
  'data/design/arena-ruins-pilot-contrast-matrix-v1.json',
  'tools/validate-arena-ruins-final-board-art-plan-v1.mjs',
];
for (const f of PR43_FILES) assert(!exists(f), `scope violation: PR #43 board-plan file leaked into the motion-integration branch: ${f}`);

if (errors.length) {
  console.error('Motion pipeline stack audit failed:');
  for (const e of errors) console.error('- ' + e);
  process.exit(1);
}
console.log('Motion pipeline stack audit passed (sidecar consistency, frame counts, no duplicates/extras, all validators+gate present, PR #43 board-plan not leaked in).');
