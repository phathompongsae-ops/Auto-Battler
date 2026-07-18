#!/usr/bin/env node

// Node test for the Arena Ruins Pilot Motion Test Harness (src/motion-test-harness.js).
// Verifies: the module loads DOM-free and stays inactive; its embedded MOTION_TESTS table matches
// the verbatim Pilot Motion Test Contract v1 JSON (copied byte-identical from PR #28 @ 60cc4b0);
// the expected-file generator follows the contract naming/numbering exactly; and the pure
// diagnostics function covers awaiting/count/canvas/anchor/metadata/marker/transparency paths.
// Browser playback + the three x4 checkpoints run under Playwright and require real production
// frames — they are reported separately and are NEVER claimed from this test.

import { readFile } from 'node:fs/promises';
import process from 'node:process';

const failures = [];
const assert = (cond, msg) => { if (!cond) failures.push(msg); };
const eq = (a, b, msg) => assert(a === b, `${msg} (got ${JSON.stringify(a)}, expected ${JSON.stringify(b)})`);

const code = await readFile(new URL('../src/motion-test-harness.js', import.meta.url), 'utf8');
const sandbox = {};
new Function('globalThis', code)(sandbox);
const H = sandbox.MotionTestHarness;
assert(!!H, 'motion-test-harness.js must set globalThis.MotionTestHarness');

const contract = JSON.parse(await readFile(new URL('../data/design/pilot-motion-test-contract-v1.json', import.meta.url), 'utf8'));

if (H) {
  // --- DOM-free safety ---
  eq(H.isActive(), false, 'harness must stay inactive without a DOM');
  const act = await H.activate();
  eq(act, false, 'activate() without a browser returns false, never throws');
  H.deactivate(); // safe no-op

  // --- embedded table matches the verbatim contract JSON ---
  eq(H.MOTION_TESTS.length, 3, 'exactly three motion tests');
  eq(H.FPS_DEFAULT, contract.common.fpsDefault, 'FPS default matches contract');
  eq(JSON.stringify(H.FPS_ACCEPTED), JSON.stringify(contract.common.fpsAcceptedRange), 'FPS accepted range matches contract');
  eq(JSON.stringify(H.MARKER_VOCABULARY), JSON.stringify(contract.runtimeReference.eventMarkerVocabulary), 'marker vocabulary matches contract');
  for (const ct of contract.motionTests) {
    const ht = H.MOTION_TESTS.find((t) => t.unit === ct.unit);
    assert(!!ht, `harness covers ${ct.unit}`);
    if (!ht) continue;
    eq(ht.state, ct.state, `${ct.unit} state matches`);
    eq(ht.loop, ct.loop, `${ct.unit} loop matches`);
    eq(ht.fps, ct.fps, `${ct.unit} fps matches`);
    eq(ht.frameTarget, ct.frameTarget, `${ct.unit} frameTarget matches`);
    eq(ht.frameMin, ct.frameMin, `${ct.unit} frameMin matches`);
    eq(ht.frameMax, ct.frameMax, `${ct.unit} frameMax matches`);
    eq(JSON.stringify(ht.anchor), JSON.stringify(ct.anchor), `${ct.unit} anchor matches`);
    eq(ht.marker.name, ct.eventMarkers[0].name, `${ct.unit} marker name matches`);
    eq(ht.marker.normalizedTime, ct.eventMarkers[0].normalizedTime, `${ct.unit} marker time matches`);
  }

  // --- expected-file generator follows the contract naming exactly ---
  const archer = H.MOTION_TESTS.find((t) => t.unit === 'hero.archer');
  const files = H.expectedFiles(archer);
  eq(files.length, archer.frameTarget + 1, 'expected files = target frames + sidecar');
  eq(files[0], 'assets/units/hero.archer/attack/hero.archer_attack_000.png', 'first frame path matches contract naming + 000 numbering');
  eq(files[archer.frameTarget - 1], 'assets/units/hero.archer/attack/hero.archer_attack_009.png', 'last target frame is zero-padded');
  eq(files[archer.frameTarget], 'assets/units/hero.archer/hero.archer_attack_motiontest.json', 'sidecar path matches contract metadata format');

  // --- pure diagnostics coverage ---
  const slime = H.MOTION_TESTS.find((t) => t.unit === 'monster.slime');
  const frames = (n, w = 800, h = 800) => Array.from({ length: n }, () => ({ w, h }));
  const okMeta = { unitId: 'monster.slime', state: 'move', fps: 12, frameCount: 8, loop: true, anchor: [0.5, 0.9], canvas: [800, 800], eventMarkers: [{ name: 'footstepCue', normalizedTime: 0.7 }], rootMotion: 'in-place' };
  eq(H.evaluateDiagnostics(slime, { frames: [], metadata: null, metadataError: null, cornerAlphas: null }).status, 'awaiting_production_frames', 'no frames -> awaiting_production_frames');
  eq(H.evaluateDiagnostics(slime, { frames: frames(8), metadata: okMeta, metadataError: null, cornerAlphas: [0, 0, 0, 0] }).status, 'loaded', 'valid load -> loaded');
  const under = H.evaluateDiagnostics(slime, { frames: frames(5), metadata: okMeta, metadataError: null, cornerAlphas: [0, 0, 0, 0] });
  assert(under.status === 'diagnostics_failed' && /frame count 5/.test(under.problems[0] || ''), 'frame count below min flagged');
  const mixed = H.evaluateDiagnostics(slime, { frames: [...frames(4), { w: 512, h: 800 }, ...frames(3)], metadata: okMeta, metadataError: null, cornerAlphas: [0, 0, 0, 0] });
  assert(mixed.problems.some((p) => /canvas size not constant/.test(p)), 'inconsistent canvas size flagged');
  const badAnchor = H.evaluateDiagnostics(slime, { frames: frames(8), metadata: { ...okMeta, anchor: [0.5, 0.5] }, metadataError: null, cornerAlphas: [0, 0, 0, 0] });
  assert(badAnchor.problems.some((p) => /anchor/.test(p)), 'anchor mismatch flagged');
  const noMeta = H.evaluateDiagnostics(slime, { frames: frames(8), metadata: null, metadataError: null, cornerAlphas: [0, 0, 0, 0] });
  assert(noMeta.problems.some((p) => /metadata missing/.test(p)), 'missing metadata flagged');
  const badMarker = H.evaluateDiagnostics(slime, { frames: frames(8), metadata: { ...okMeta, eventMarkers: [{ name: 'notARealMarker', normalizedTime: 0.5 }] }, metadataError: null, cornerAlphas: [0, 0, 0, 0] });
  assert(badMarker.problems.some((p) => /unsupported event marker/.test(p)), 'unsupported marker flagged');
  const opaque = H.evaluateDiagnostics(slime, { frames: frames(8), metadata: okMeta, metadataError: null, cornerAlphas: [255, 255, 255, 255] });
  assert(opaque.status === 'loaded' && opaque.warnings.some((w) => /transparency warning/.test(w)), 'opaque corners produce a transparency warning without failing the load');
}

if (failures.length) {
  console.error(`FAIL: ${failures.length} assertion(s) failed`);
  for (const f of failures) console.error('  - ' + f);
  process.exit(1);
}
console.log('PASS: motion test harness (contract consistency + diagnostics + DOM-free guards) — all assertions passed');
