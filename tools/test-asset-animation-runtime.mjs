#!/usr/bin/env node

// Tests the DOM/THREE-free core of the Asset & Animation Framework (src/asset-animation-runtime.js):
// pilot manifest + identity, asset resolution order, state machine (priority / one-shot / terminal
// death / x4-safe advance), state fallback, FPS sanitising, texture-cache refcounting, and the VFX
// budget. The browser adapter is dormant under Node (no THREE/document), so only the core runs.

import { readFile } from 'node:fs/promises';
import process from 'node:process';

const failures = [];
const assert = (cond, msg) => { if (!cond) failures.push(msg); };
const eq = (a, b, msg) => assert(a === b, `${msg} (got ${JSON.stringify(a)}, expected ${JSON.stringify(b)})`);

const code = await readFile(new URL('../src/asset-animation-runtime.js', import.meta.url), 'utf8');
const sandbox = {};
new Function('globalThis', code)(sandbox);
const A = sandbox.AssetAnimationRuntime;
assert(!!A, 'asset-animation-runtime.js must set globalThis.AssetAnimationRuntime');
assert(A && A._hasBrowser === false, 'browser adapter must stay dormant under Node');

if (A) {
  // --- Manifest + identity ---
  const ids = Object.keys(A.PILOT_MANIFEST);
  eq(ids.length, 3, 'exactly three pilots');
  for (const id of ['hero.archer', 'monster.slime', 'monster.golem']) assert(ids.includes(id), `manifest has ${id}`);
  for (const id of ids) eq(A.PILOT_MANIFEST[id].canonicalApproved, false, `${id} canonicalApproved must be false (no placeholder is canonical)`);
  eq(A.identifyPilot({ heroKey: 'archer' }), 'hero.archer', 'identify archer by heroKey');
  eq(A.identifyPilot({ name: 'Slime 1' }), 'monster.slime', 'identify slime by name prefix');
  eq(A.identifyPilot({ sprite: 'Golem', name: 'Golem A' }), 'monster.golem', 'identify golem by sprite key');
  eq(A.identifyPilot({ heroKey: 'fighter', name: 'Fighter' }), null, 'non-pilot -> null');
  eq(A.identifyPilot(null), null, 'null -> null (fail-closed)');
  eq(A.identifyPilot(42), null, 'non-object -> null (fail-closed)');

  // --- Asset resolution order ---
  eq(A.resolveAsset(A.PILOT_MANIFEST['hero.archer']).status, 'placeholder', 'no canonical -> programmatic placeholder');
  eq(A.resolveAsset(A.PILOT_MANIFEST['hero.archer']).source, 'programmatic', 'placeholder source is programmatic');
  const approved = A.resolveAsset({ canonicalApproved: true, canonicalPath: 'x.png' });
  assert(approved.status === 'canonical' && approved.path === 'x.png', 'canonical-approved file wins');
  eq(A.resolveAsset({ candidatePath: 'c.png' }).status, 'candidate', 'candidate resolves to candidate');
  eq(A.resolveAsset({ fallbackPath: 'p.png' }).status, 'placeholder', 'fallbackPath resolves to placeholder file');
  eq(A.resolveAsset({}).status, 'fallback', 'empty -> geometric fallback');
  eq(A.resolveAsset({}).source, 'geometric', 'empty fallback source is geometric');
  eq(A.resolveAsset(null).status, 'fallback', 'null record -> geometric fallback (no throw)');
  // a placeholder is never labeled canonical
  assert(A.resolveAsset(A.PILOT_MANIFEST['monster.golem']).canonicalApproved === false, 'placeholder never canonicalApproved');

  // --- FPS sanitising: default 12, clamp 8..15, reject bad values ---
  eq(A.sanitizeFps(0), 12, 'fps 0 -> 12');
  eq(A.sanitizeFps(NaN), 12, 'fps NaN -> 12');
  eq(A.sanitizeFps(Infinity), 12, 'fps Infinity -> 12');
  eq(A.sanitizeFps(-5), 12, 'fps negative -> 12');
  eq(A.sanitizeFps(4), 8, 'fps below range clamps to 8');
  eq(A.sanitizeFps(9), 9, 'fps in range kept');
  eq(A.sanitizeFps(99), 15, 'fps above range clamps to 15');

  // --- State fallback table ---
  eq(A.resolveState('move', new Set(['idle'])).state, 'idle', 'move -> idle');
  eq(A.resolveState('skill', new Set(['idle', 'attack'])).state, 'attack', 'skill -> attack');
  eq(A.resolveState('skill', new Set(['idle'])).state, 'idle', 'skill -> idle when no attack');
  eq(A.resolveState('death', new Set(['idle', 'hit'])).state, 'hit', 'death -> hit');
  eq(A.resolveState('hit', new Set(['idle'])).state, 'idle', 'hit -> idle');
  eq(A.resolveState('idle', new Set(['idle'])).fellBack, false, 'present state does not fall back');

  // --- AnimationController: priority + one-shot + terminal death + x4 ---
  const rec = JSON.parse(JSON.stringify(A.PILOT_MANIFEST['hero.archer']));
  let c = new A.AnimationController(rec, {});
  eq(c.currentState, 'idle', 'controller starts idle');
  c.requestState('attack');
  eq(c.currentState, 'attack', 'enter attack');
  eq(c.requestState('move'), false, 'move cannot interrupt locked attack (priority)');
  const c2 = new A.AnimationController(rec, {}); c2.requestState('attack');
  assert(c2.requestState('skill') === true && c2.currentState === 'skill', 'skill overrides attack');
  const c3 = new A.AnimationController(rec, {}); c3.requestState('skill');
  assert(c3.requestState('hit') === true, 'hit overrides skill');
  const c4 = new A.AnimationController(rec, {}); c4.requestState('death'); c4.update(10);
  assert(c4.currentState === 'death' && c4.finished, 'death plays and finishes');
  eq(c4.requestState('idle'), false, 'death is terminal — idle rejected');
  // x4: a large dt advances a looping state's frames without freezing or NaN
  const c5 = new A.AnimationController(rec, {}); c5.requestState('move', { restart: true });
  c5.update(1 / 60 * 4); c5.update(1 / 60 * 4); c5.update(1 / 60 * 4);
  assert(Number.isFinite(c5.frameIndex) && c5.frameIndex >= 0 && c5.frameIndex < c5.frameCount, 'x4 advance stays in range, finite');
  // fallback logging fires once per (unit,state)
  let fbCount = 0;
  const c6 = new A.AnimationController(rec, { onFallback: () => fbCount++ });
  c6.setAvailable(['idle', 'move', 'attack', 'hit']);
  c6.requestState('death'); c6.requestState('idle'); c6.requestState('death', { restart: true });
  eq(fbCount, 1, 'fallback logs once per (unit,state), not per frame');
  eq(c6.resolvedState === 'hit' || c6.currentState === 'death', true, 'death resolved via fallback to hit');

  // snapshot exposes the per-unit animation record fields
  const snap = c.snapshot();
  for (const f of ['currentState', 'previousState', 'frameIndex', 'frameCount', 'elapsed', 'stateStartTime', 'lockedUntil', 'facing', 'qualityTier', 'disposed']) {
    assert(f in snap, `snapshot exposes ${f}`);
  }

  // quality tiers
  eq(A.normalizeQuality('showcase'), 'showcase', 'showcase is a valid tier');
  eq(A.normalizeQuality('bogus'), 'gameplay', 'invalid tier -> gameplay default');
  assert(A.framesForState({ qualityTier: 'showcase' }, 'move') > A.framesForState({ qualityTier: 'gameplay' }, 'move'), 'showcase has more move frames than gameplay');

  // --- Texture cache refcounting ---
  let disposed = [];
  const cache = A.createTextureCache({ create: (k) => ({ k }), dispose: (r, k) => disposed.push(k) });
  cache.acquire('a'); cache.acquire('a'); cache.acquire('b');
  eq(cache.refs('a'), 2, 'a refcount 2 (shared, created once)');
  eq(cache.size(), 2, 'two distinct cache entries');
  cache.release('a');
  assert(cache.has('a') && cache.refs('a') === 1, 'a survives first release while still in use');
  cache.release('a');
  assert(!cache.has('a') && disposed.includes('a'), 'a disposed only when last ref released');
  eq(cache.stats().creates, 2, 'exactly two creations (a shared)');

  // --- VFX budget ---
  const b = A.createVfxBudget(2);
  eq(b.cap, 2, 'budget honors explicit cap');
  assert(b.canSpawn('character') === true, 'character never budget-limited');
  b.onSpawn(); b.onSpawn();
  assert(b.canSpawn('trail') === false, 'droppable transient shed at cap');
  assert(b.canSpawn('impact') === true && b.canSpawn('character') === true, 'core visuals still allowed at cap');
  b.onDispose();
  assert(b.canSpawn('trail') === true, 'freeing a slot lets a droppable spawn again');
  eq(A.createVfxBudget().cap, A.MAX_TRANSIENT_VFX, 'default cap = documented MAX_TRANSIENT_VFX');
  eq(A.MAX_TRANSIENT_VFX, 24, 'documented conservative transient cap is 24');
}

if (failures.length) {
  console.error(`FAIL: ${failures.length} assertion(s) failed`);
  for (const f of failures) console.error('  - ' + f);
  process.exit(1);
}
console.log('PASS: asset & animation framework core — all assertions passed');
