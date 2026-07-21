# Skeleton Runtime Integration Pilot v1 — Transition & Interruption QA

**Method**: a non-committed, scratch-only browser test harness (real Three.js r128 scene,
real `makeUnit`/`updateUnit`/`animate()` code paths, served locally) was driven via
Playwright, calling the Runtime's own internal functions directly (`makeUnit`,
`triggerSkeletonAnim`, `updateSkeletonMotionAnim`, `advanceSkeletonDeathAnim`,
`removeUnit`) to force every transition deterministically, in addition to a live emergent-
combat scenario (Scenario A/B) for organic confirmation. See
`x1-x4-validation-report-v1.md` for the harness setup details.

## Deterministic transition matrix (Scenario C)

| # | Transition forced | Expected | Observed | Result |
|---|---|---|---|---|
| 1 | Fresh unit creation | Idle, frame 0 | Idle, frame 0 | PASS |
| 2 | `moving=true` | Move | Move | PASS |
| 3 | `moving=false` | Idle | Idle | PASS |
| 4 | Idle → Attack (trigger) | Attack, frame 0 | Attack, frame 0 | PASS |
| 5 | Attack → Hit (interrupt mid-swing) | Hit, frame 0 (immediate override) | Hit, frame 0 | PASS |
| 6 | Hit finishes, `moving=false` | resumes Idle | Idle | PASS |
| 7 | Hit finishes, `moving=true` | resumes Move | Move | PASS |
| 8 | Any state → Death (trigger) | Death, frame 0 | Death, frame 0 | PASS |
| 9 | Hit triggered AFTER Death | **stays Death** (locked) | Death, frame 0 (unchanged) | PASS |
| 10 | Attack triggered AFTER Death | **stays Death** (locked) | Death, frame 0 (unchanged) | PASS |
| 11 | `advanceSkeletonDeathAnim` × 20 (1.2s > 108cs) | `deathDone=true`, frame holds at last frame | `deathDone=true`, frame 8 (last) | PASS |

## Emergent combat confirmation (Scenario A, real combat loop, x1)

Observed sequence over ~6s of real combat between one Skeleton and one player dummy:
`move → hit (interrupted while approaching, took a hit mid-walk) → move → idle → basic_attack
→ hit → basic_attack → hit → basic_attack (loop continues)`.

This independently confirms, under real (non-scripted) combat conditions: Hit correctly
interrupts Move, Idle, and Attack; Attack correctly follows Idle once in range; the cycle
repeats stably with no stuck/frozen states and no desync between `frameIdx` and elapsed time.

## Post-death / removal

- A dead Skeleton's `updateUnit()` (and therefore `updateAnim()`/
  `updateSkeletonMotionAnim()`) is never called again (`if (!u.alive) return;` at the top of
  `updateUnit`, pre-existing and untouched) — confirmed no dead Skeleton ever reverts to
  Idle/Move/Attack/Hit.
- Death frames are advanced by a small dedicated call inside `animate()`'s existing
  dead-unit loop, gated on `u.skelAnim.state==='death' && !deathDone`.
- The pre-existing generic death fade (rotate+opacity, ~0.5s) is now gated on
  `(!u.skelAnim || u.skelAnim.deathDone)` — confirmed the fade does not begin until the full
  108cs Death sequence has played (screenshot `x1_5_death.png` shows the corpse still fully
  opaque, HP bar still present, ~0.3s after death trigger — well before the fade would have
  started under the old ~0.5s timer had it not been gated).
- Removal itself (`removeUnit`, called from `clearEnemies()` at the next wave boundary) is
  entirely unmodified Runtime behavior — verified in the disposal test (see resource/memory
  notes) that removal works correctly and safely for Skeleton units mid-battle.

## Bug found and fixed

Scenario A initially surfaced a real defect: 151 uncaught page errors
(`Cannot read properties of undefined (reading 'durations')`) once the Skeleton reached its
first Attack, one per `animate()` frame while in that state — caused by a state-string
mismatch (`'attack'` vs. the `SKELETON_ANIM_DEF` key `'basic_attack'`). Each thrown error
aborted that `animate()` frame before `renderer.render()` ran, meaning most frames failed to
render while a Skeleton was attacking. Fixed in `src/game.js` (two call sites); re-run of the
identical scenario after the fix produced **0 page errors** across all subsequent scenarios.
