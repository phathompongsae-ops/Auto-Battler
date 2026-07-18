#!/usr/bin/env node

// Archer Package-Level Review v1 — Node gate for the three integrated archer states
// (idle/move/attack). Verifies the three REAL sidecars agree on unit/anchor/canvas, keep
// canonicalApproved=false, and declare exactly their own event markers with no cross-state
// name bleed; and that the harness exposes the four package transition sequences (A-D) built
// only from registered archer motion-test keys with a real switch at every step. Pure data
// checks — browser playback is verified separately under Playwright and never claimed here.
// Never modifies any file.

import { readFile } from 'node:fs/promises';
import process from 'node:process';

const failures = [];
const assert = (cond, msg) => { if (!cond) failures.push(msg); };
const eq = (a, b, msg) => assert(JSON.stringify(a) === JSON.stringify(b), `${msg} (got ${JSON.stringify(a)}, expected ${JSON.stringify(b)})`);

const side = {};
for (const st of ['idle', 'move', 'attack']) {
  side[st] = JSON.parse(await readFile(new URL(`../assets/units/hero.archer/hero.archer_${st}_motiontest.json`, import.meta.url), 'utf8'));
}

// --- cross-state sidecar consistency ---
for (const st of ['idle', 'move', 'attack']) {
  eq(side[st].unitId, 'hero.archer', `${st}: unitId`);
  eq(side[st].state, st, `${st}: state`);
  eq(side[st].anchor, [0.5, 0.92], `${st}: shared anchor`);
  eq(side[st].canvas, [320, 480], `${st}: shared canvas`);
  eq(side[st].rootMotion, 'in-place', `${st}: rootMotion`);
  eq(side[st].canonicalApproved, false, `${st}: canonicalApproved must remain false`);
}
eq(side.idle.fps, 8, 'idle fps');
eq(side.move.fps, 12, 'move fps');
eq(side.attack.fps, 12, 'attack fps');
eq(side.idle.frameCount, 8, 'idle frameCount');
eq(side.move.frameCount, 8, 'move frameCount');
eq(side.attack.frameCount, 10, 'attack frameCount');
eq(side.idle.loop, true, 'idle loops');
eq(side.move.loop, true, 'move loops');
eq(side.attack.loop, false, 'attack does not loop');

// --- per-state markers, and no marker name bleeds across states ---
eq(side.idle.eventMarkers, [], 'idle declares NO markers');
eq(side.move.eventMarkers, [{ name: 'leftFootstepCue', normalizedTime: 0.25 }, { name: 'rightFootstepCue', normalizedTime: 0.75 }], 'move declares exactly left->right footstep cues');
eq(side.attack.eventMarkers, [{ name: 'projectileRelease', normalizedTime: 0.55 }], 'attack declares exactly projectileRelease @ 0.55');
const names = (st) => (side[st].eventMarkers || []).map((m) => m.name);
for (const [a, b] of [['idle', 'move'], ['idle', 'attack'], ['move', 'attack']]) {
  assert(names(a).every((n) => !names(b).includes(n)), `marker names must not appear in both ${a} and ${b}`);
}

// --- harness transition map (loads DOM-free) ---
const code = await readFile(new URL('../src/motion-test-harness.js', import.meta.url), 'utf8');
const sandbox = {};
new Function('globalThis', code)(sandbox);
const H = sandbox.MotionTestHarness;
assert(!!H, 'motion-test-harness.js must set globalThis.MotionTestHarness');
if (H) {
  const keys = H.MOTION_TESTS.concat(H.EXTRA_MOTION_TESTS).map((t) => t.unit + '/' + t.state);
  for (const st of ['idle', 'move', 'attack']) assert(keys.includes('hero.archer/' + st), `hero.archer/${st} registered as a motion test`);
  const seqs = H.PACKAGE_SEQUENCES;
  eq(Object.keys(seqs).sort(), ['A', 'B', 'C', 'D'], 'exactly four package sequences A-D');
  eq(seqs.A, ['hero.archer/idle', 'hero.archer/move', 'hero.archer/attack', 'hero.archer/idle'], 'sequence A idle->move->attack->idle');
  eq(seqs.B, ['hero.archer/idle', 'hero.archer/attack', 'hero.archer/idle'], 'sequence B idle->attack->idle');
  eq(seqs.C, ['hero.archer/move', 'hero.archer/attack', 'hero.archer/move'], 'sequence C move->attack->move');
  eq(seqs.D, ['hero.archer/attack', 'hero.archer/idle', 'hero.archer/move'], 'sequence D attack->idle->move');
  for (const [n, seq] of Object.entries(seqs)) {
    assert(seq.every((k) => keys.includes(k) && k.startsWith('hero.archer/')), `sequence ${n} uses only registered archer test keys`);
    for (let i = 1; i < seq.length; i++) assert(seq[i] !== seq[i - 1], `sequence ${n} switches state at every step`);
  }
  // package review adds test data/driver only — the pilot contract table and the marker
  // vocabulary must remain the verbatim PR #28 values (Core Logic untouched is asserted by
  // tools/test-motion-test-harness.mjs against the contract JSON; re-check the basics here)
  eq(H.MOTION_TESTS.length, 3, 'contract MOTION_TESTS table still has exactly three tests');
  eq(H.MARKER_VOCABULARY, ['projectileRelease', 'impactCue', 'skillFlashCue', 'footstepCue', 'deathDissolveCue'], 'marker vocabulary unchanged');
  assert(typeof H.runPackageSequence === 'function', 'runPackageSequence API present');
  eq(H.isActive(), false, 'harness stays inactive without a DOM');
  const r = await H.runPackageSequence('A');
  eq(r, null, 'runPackageSequence is a safe no-op (null) outside the active browser harness');
}

if (failures.length) {
  console.error('Archer package transitions test failed:');
  for (const f of failures) console.error('- ' + f);
  process.exit(1);
}
console.log('Archer package transitions test passed (sidecar consistency, marker isolation by contract, 4-sequence transition map).');
