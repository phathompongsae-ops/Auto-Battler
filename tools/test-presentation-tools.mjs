#!/usr/bin/env node

// Node-side test of the presentation module (src/game-presentation-tools.js). The module is
// browser-facing (fullscreen + canvas capture need a DOM), so under Node — with no `document` —
// it must load cleanly, self-disable, and still expose pure helpers. The full lifecycle + the 3
// x4 browser checkpoints run under Playwright (scratchpad/present.mjs; results in the docs).

import { readFile } from 'node:fs/promises';
import process from 'node:process';

const failures = [];
const assert = (cond, msg) => { if (!cond) failures.push(msg); };
const eq = (a, b, msg) => assert(a === b, `${msg} (got ${JSON.stringify(a)}, expected ${JSON.stringify(b)})`);

const code = await readFile(new URL('../src/game-presentation-tools.js', import.meta.url), 'utf8');
const sandbox = {};
// no `document`/`window` in scope -> exercises the DOM-absent guards
new Function('globalThis', code)(sandbox);
const P = sandbox.GamePresentationTools;

assert(!!P, 'game-presentation-tools.js must set globalThis.GamePresentationTools');

if (P) {
  // Loads and self-disables without a DOM (no throw during module evaluation).
  eq(typeof P.captureScreenshot, 'function', 'captureScreenshot exposed');
  eq(typeof P.toggleFullscreen, 'function', 'toggleFullscreen exposed');
  eq(P.fullscreenSupported(), false, 'fullscreen unsupported without a DOM (graceful)');
  eq(P.isFullscreen(), false, 'isFullscreen false without a DOM');
  // These must be safe no-ops without a DOM (no throw / no uncaught rejection).
  P.enterFullscreen(); P.leaveFullscreen(); P.toggleFullscreen(); P.captureScreenshot(); P.showToast('x');
  assert(true, 'no-DOM calls are safe no-ops');

  // Filename format + sanitization (pure, DOM-free).
  const fn = P.screenshotFilename();
  assert(/^auto-battler-stage-\d{2}-\d{8}-\d{6}\.png$/.test(fn), `filename matches contract: ${fn}`);

  // Stage value comes from the hook (the module reads globalThis, which is this sandbox) and is
  // sanitized to two digits.
  sandbox.GamePresentationHooks = { getWave: () => 7 };
  assert(P.screenshotFilename().startsWith('auto-battler-stage-07-'), 'stage taken from hook wave, zero-padded');
  sandbox.GamePresentationHooks = { getWave: () => 12 };
  assert(P.screenshotFilename().startsWith('auto-battler-stage-12-'), 'two-digit wave kept as-is');
  sandbox.GamePresentationHooks = { getWave: () => '9x' };   // non-numeric junk -> digits only
  assert(P.screenshotFilename().startsWith('auto-battler-stage-09-'), 'non-numeric stage sanitized to digits');
  sandbox.GamePresentationHooks = { getWave: () => null };
  assert(P.screenshotFilename().startsWith('auto-battler-stage-01-'), 'missing wave -> default 01');
  sandbox.GamePresentationHooks = { getWave: () => 3 };
  const a = P.screenshotFilename();
  assert(/-\d{8}-\d{6}\.png$/.test(a), 'timestamp segment is YYYYMMDD-HHMMSS');
  delete sandbox.GamePresentationHooks;

  const st = P._state();
  assert(typeof st === 'object' && st.inited === false, 'init did not run without a DOM');
}

if (failures.length) {
  console.error(`FAIL: ${failures.length} assertion(s) failed`);
  for (const f of failures) console.error('  - ' + f);
  process.exit(1);
}
console.log('PASS: presentation tools (Node/no-DOM guards + filename) — all assertions passed');
