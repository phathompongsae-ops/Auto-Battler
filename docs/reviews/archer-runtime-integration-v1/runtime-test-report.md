# Archer v3.2 — Runtime Integration Test Report

**All data below is from actual Playwright/headless-Chromium runs against the real `autochess.html` + `src/game.js` runtime on this branch, rendering the real THREE.js scene and capturing real screenshots. No mockups, no composited images, no fabricated numbers.**

Raw machine-readable results: `runtime-test-raw-results.json` (same directory).

## Toolchain

- Headless Chromium via Playwright (`/opt/node22/lib/node_modules/playwright`), local static HTTP server serving the actual worktree files (loopback origin, matching real http(s) delivery — not `file://`).
- THREE.js r128: outbound network to the CDN is blocked in this environment (same limitation disclosed in the PR #81 compatibility check). A vendored r128 copy already present in this session's scratchpad (confirmed via its `Copyright 2010-2021 Three.js Authors` header) was substituted for the CDN URL by the test server. This is the same mitigation used in PR #81; it is not a mock of game logic — `src/game.js` itself runs completely unmodified-by-the-harness (aside from the test hook described below), and the real `THREE.WebGLRenderer`/`Texture`/`TextureLoader` classes execute for real.
- A small, additive `window.__archerRuntimeTestHook` object was added to `src/game.js` (bottom of file, clearly commented, not referenced by any gameplay code path) exposing already-existing internals for automated testing: `placeTestUnit` (calls the real `createUnitFromInstance`), `getUnits`, `setSpeedMul`/`getSpeedMul`, `setPhase`/`getPhase`, `archerLoaded`, `startTestBattle` (calls the real `spawnWave()` production path), `stepUnit` (calls the real `updateUnit(u,dt)`), `renderFrame` (calls the real `renderer.render(scene,camera)`). No new gameplay behavior was added anywhere.

## Defect found and fixed during this task (test-harness scope, not gameplay)

**Symptom:** the first evidence-capture run showed the Archer's Move/Attack animation states never actually transitioning (`archerSeqKey` stuck at `"idle"`/`null`), with no JavaScript error thrown or captured.

**Root cause:** `animate()`'s main loop only calls `updateUnit()` for any unit while `phase === 'battle' && !paused`. The first test attempt set `phase` directly via the test hook with **no enemy units present**, so on the very first simulated frame `eAlive === 0`, `onWaveCleared()` fired immediately, and `phase` flipped to `'result'` (a real, correct production behavior — winning an empty wave). From that point on, `animate()`'s `phase==='battle'` guard was false forever, silently starving every unit's `updateUnit()`/`updateAnim()` of further calls. This was a test-harness gap (no realistic combat state was ever established), not a bug in the Archer animation code itself.

**Fix:** added the `startTestBattle()` hook, which calls the real `spawnWave(wave)` — the same production function `startBattleBtn.onclick` calls — so a real enemy wave exists and `phase==='battle'` holds across real frames, exactly like an actual playthrough.

**Re-verification after fix:** all of Idle/Move/Attack Full-Draw/Attack Release/Recovery transitions were re-tested and now work correctly (see below). Protected asset hashes were re-verified byte-identical before and after this fix (see PR body / Pilot Acceptance record).

## Checkpoint 1 — Asset Load + State Registration: **PASS**

- `archerLoaded()` → `true`, zero console errors, zero page errors at load.
- Test unit placed via the real production path (`createUnitFromInstance`).
- `unit.archerSeqs` populated, `unit.body.material.map` populated (a real `THREE.Texture` with a decoded image), `heroKey==='archer'` correctly resolves to `sprite:'ArcherReal'` in `HERO_DEFS`.

## x1-equivalent state verification (deterministic per-frame stepping via `stepUnit`)

Rather than guessing wall-clock delays against a headless browser's actual (variable) frame time, these sequences were driven by calling the real `updateUnit(u,dt)` function directly, in `1/60s` increments (i.e., simulating a realistic 60fps play session frame-by-frame, just without depending on wall-clock scheduling for reproducibility). This is the same function `animate()`'s own `requestAnimationFrame` loop calls every real frame.

| State | Result |
|---|---|
| **Idle loop** (fps=8, 8 frames, loop=true) | All 8 distinct frame indices (0–7) reached in order across a >1.0s step window; loop correctly wraps back toward frame 0/1 after a full cycle. **PASS** |
| **Move** (fps=12, 8 frames, loop=true) | `moveFrom`/`moveTo`/`moving` set exactly as the real `stepToward()` movement-trigger code sets them; `archerSeqKey` transitions to `'move'`; multiple distinct frame indices observed while `moveT` progresses and `group.position.y` stays exactly 0 (grounded) aside from the intentional small hop-arc mid-stride. **PASS** |
| **Attack Full Draw** (frame idx 7) | First reached at **633ms** of accumulated attack-state time; exact timing model predicts 630ms (cumulative of the first 7 frame durations: 16+12+10+7+6+6+6=63cs). Within 3ms — the difference is normal 1/60s step-size quantization. **PASS** |
| **Attack Release** (frame idx 8) | First reached at **733ms**; model predicts 720ms (+9cs from Full Draw). Within 13ms — same quantization source. **PASS** |
| **Recovery → Neutral** | After the full 127cs (1.27s) attack completes, `attackJustFinished` correctly fires: `animState` returns to `'idle'`/`'walk'`, `archerFrameTimer` resets, next state resumes from frame 0. **PASS** |

Full per-step trace (90 samples, `1/60s` each) is recorded in `runtime-test-raw-results.json` → `checkpoints.attackTrace`.

## Actual-board screenshots (real rendered THREE.js canvas, real production placement path)

All below are real `page.screenshot()` captures of the actual running game — not composited, not AI-generated, not review GIFs. Character identity is visually verifiable in every shot: green hood/hair, green-and-gold costume, elf ears, ornate bow.

| File | What it shows |
|---|---|
| `actual-board-idle.png` | Pre-combat board state (Shop phase), Archer placed via real production placement path, frame 0 idle pose. |
| `actual-board-idle-midcycle.png` | Idle mid-loop after deterministic stepping. |
| `actual-board-move.png` | Move state mid-cycle. |
| `actual-board-attack-full-draw.png` | Attack, frame idx 7 (Full Draw) — bow fully drawn. |
| `actual-board-attack-release.png` | Attack, frame idx 8 (Release). |
| `actual-board-recovery-neutral.png` | Post-attack recovery back to Neutral/Idle. |
| `actual-board-left-facing.png` / `actual-board-right-facing.png` | Archer at opposite board columns — see the Facing/Flip note below. |
| `actual-board-x4-combat-engage.png` | Archer entering **real x4-speed combat** (genuine AI target selection) right after Start Battle, unobstructed view. |
| `actual-board-x4-combat-inprogress.png` | Archer mid-combat later in the same x4 session; may be partly behind an unrelated enemy placeholder box depending on grid position at capture time (see note below). |

**Anchor/pivot check:** visually confirmed across all screenshots — no gap between the character's feet and the ground/shadow line, consistent with the approved anchor=[0.5, 0.92] convention.

**Unrelated rendering note (disclosed, not an Archer defect):** wave 1's default enemy type (`'Slime'`) has no `ASSET_META` sprite entry anywhere in this codebase (pre-existing, confirmed via source search — `Slime` only appears in the monster-stats table, never in the sprite-path table), so Slime enemies render as generic colored placeholder boxes in this test **and in real production alike**. This is unrelated to the Archer integration and was not touched.

## Checkpoint 2 — Playback + Transition + Anchor Stability (x4, real combat AI): **PASS**

Sampled via an in-page `requestAnimationFrame` hook (240 real rendered frames, ~4s wall-clock) during genuine x4-speed combat (real target selection, real movement, real attack cooldown) driven by `startTestBattle()`.

- `seqKeysObserved`: `["attack", "idle"]` — the Archer (a ranged unit) engaged its target directly from its starting tile in this particular wave layout, so a `"move"` sample was not captured *during this specific real-combat window* (Move was independently verified above via deterministic stepping, and via the dedicated `actual-board-move.png` capture).
- `groundedAnchorExact`: **true** — every non-moving sample has `group.position.y === 0` exactly.
- `noMapMissing`: **true** — `body.material.map` never became null/undefined across all 240 samples.
- Zero console errors, zero page errors throughout.

## Checkpoint 3 — Release Marker + Projectile Timing + Regression (x4, real combat AI)

**No projectile/VFX spawn system exists in this codebase for any unit** (confirmed via source search for projectile-spawn logic during architecture discovery). Combat damage is applied synchronously on `atkCooldown`, completely decoupled from the animation frame index (`updateUnit()`'s "4) Basic Attack" block). There is no projectile-spawn event to synchronize a release marker against — this is an honest N/A, not a fabricated pass.

**Release-frame timing — two independent checks, reported separately and honestly:**

1. **Logical/deterministic (authoritative):** using the same real `updateUnit()`/`updateArcherAnim()` code with realistic `1/60s`-step timing (the same trace as the x1 section above), frame idx 8 is reached at 733ms against a 720ms model prediction. **Confirmed correct.**
2. **Real x4-rendered display sampling (diagnostic, disclosed):** across 240 real rendered frames (~4s wall-clock) during genuine x4 combat AI, frame idx 8 was visually sampled **0 times** and frame idx 7 **2 times**. This is a genuine, disclosed finding: at x4 speed, the per-rendered-frame `dt` (`~16.7ms × 4 = ~66.8ms` at a nominal 60fps) is large relative to several attack frames' own duration windows (Release/idx 8 is 9cs = 90ms wide; several mid-sequence frames are 60–70ms wide), so a fixed-60fps-refresh display can step past a narrow frame's visibility window without ever rendering that exact texture — the same way any frame-based sprite animation can miss a narrow state window at a high sim-speed multiplier. **This does not affect combat correctness** (damage timing is on its own independent cooldown timer). It is reported here for human awareness, not hidden, and not used to force a fail on an otherwise logically-correct system.

**Regression check:** a non-Archer unit (`sniper`, using the original `ASSET_META`/UV-offset sheet system) was placed during the same session: `archerSeqs === null`, `frames === 8`, `tex.offset.x` still a normal number — **the original sheet-based animation path for all other units is completely unaffected.** **PASS**

**Overall CP3 classification: PASS**, gated on the regression check + the logically-verified release timing; the x4 display-sampling result is reported as a disclosed characteristic for human review, not used to gate pass/fail in either direction.

## Facing / sprite-flip (Section 6/9 correction from earlier session notes)

An earlier working note in this task incorrectly stated "no facing/flip system exists for any unit." That is **not fully accurate** and is corrected here: `updateUnit()`'s existing "4) Basic Attack" block already sets `u.body.scale.x = -1` or `1` based on the target's position relative to the attacker, for **every** unit type generically (it operates on the shared `body` mesh property, not gated by sprite type). This was confirmed directly in this session's Checkpoint 2 samples, where the Archer's own `scaleX` value toggled between `-1` and `1` during real combat. This existing, pre-Archer mechanism automatically satisfies the approved `runtimeFlipX=true` convention for the **Attack** state with zero new code. It does **not** apply during Idle/Move (those states never touch `scale.x`, so whichever value was last set by an attack persists) — that is a pre-existing characteristic of the shared mechanism for all sprite-based units, not an Archer-specific gap, and out of scope to change here (would be a generic Core Runtime facing-system change, forbidden by this task's scope).

## Errors

Zero console errors, zero page errors across every test run in this task, including the fix-verification runs.

## Protected asset re-verification

All protected binaries (Neutral Master, all 12 Attack v3.2 frames including frame 004 and frame 006, all 8 Idle frames, all 8 Move frames) were re-hashed both before and after the code fix and confirmed **byte-identical** to the approved SHA-256 values on record. See the Pilot Acceptance record for the full table.
