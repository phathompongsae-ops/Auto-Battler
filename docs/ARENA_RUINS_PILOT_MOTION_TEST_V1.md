# Arena Ruins Pilot Motion Test Harness v1

Development-only test mode (`autochess.html#motionTest`) that stages the three Pilot Motion Test
Contract v1 tests — `hero.archer/attack`, `monster.slime/move`, `monster.golem/attack` — inside
the **existing Arena Ruins baseline** (PR #25 theme + PR #23 animation runtime + PR #24
fullscreen/screenshot). No new map, no theme redesign.

## Honest current status

**All three tests: `awaiting_production_frames`.** No production motion frames exist on any
branch yet (`assets/units/` is absent). The harness, loader, diagnostics, playback, markers, and
fallback state are **ready and verified**; the three contract checkpoints are **blocked awaiting
production frames** and are NOT claimed as passed. No placeholder is ever presented as a passing
asset. When Coco lands real frames at the contract paths, the harness loads and runs them with no
further code changes.

## Contract link (smallest verifiable method)

`data/design/pilot-motion-test-contract-v1.json` and
`tools/validate-pilot-motion-test-contract-v1.mjs` are **verbatim byte-identical copies** of
PR #28 @ `60cc4b042974648b15cea29cc1cc086b4ed7588f` (verified by sha256 against
`git show 60cc4b0:<path>`; the copied validator passes on this branch, exit 0). The harness's
embedded test table is asserted equal to that JSON by `tools/test-motion-test-harness.mjs`.

## Files

| File | Change |
|---|---|
| `src/motion-test-harness.js` | **New** — the harness (`globalThis.MotionTestHarness`). |
| `autochess.html` | One script tag (module creates all its own DOM). |
| `data/design/pilot-motion-test-contract-v1.json` | Verbatim copy of PR #28 contract. |
| `tools/validate-pilot-motion-test-contract-v1.mjs` | Verbatim copy of PR #28 validator. |
| `tools/test-motion-test-harness.mjs` | **New** — Node test (contract consistency + diagnostics + DOM-free guards). |
| `docs/ARENA_RUINS_PILOT_MOTION_TEST_V1.md` | This document. |

## Harness structure

- **Activation:** only via URL hash `#motionTest`, after the game finishes booting (polls for the
  loading screen to clear). Without the hash the module is fully inert — the normal game is
  byte-for-byte unaffected. Never crashes if assets are missing.
- **Stage:** the three pilots spawn at clearly separated tiles — Archer (1,4), Slime (4,1),
  Golem (6,2) — in shop phase (Combat never starts). Camera/view is the locked Map 1 camera;
  the Arena Ruins canonical theme is used as-is.
- **Loader:** per test, fetches the sidecar
  (`assets/units/{unitId}/{unitId}_{state}_motiontest.json`) and probes frames
  `assets/units/{unitId}/{state}/{unitId}_{state}_000.png …` up to `frameMax` (contract naming,
  zero-padded 000). Real frames only — the harness never generates or fakes artwork.
- **Playback:** 12 FPS content clock × playback speed (**x4 default**, x1 toggle); loop
  (slime, seamless with cycle counter) vs non-loop (archer/golem, clean completion + restart)
  per contract; event markers (`projectileRelease` @0.55, `footstepCue` @0.70, `impactCue`
  @0.58) fired at their normalized times and shown in the overlay; runtime **flipX** via a scale
  flip only (no second art set).
- **Diagnostics (per contract):** missing frames → `awaiting_production_frames` with the exact
  expected file list; frame count outside min/max; canvas size not constant across frames;
  metadata missing/invalid; metadata anchor ≠ contract anchor; metadata fps outside 8–15;
  loop policy mismatch; unsupported event marker; transparency warning (opaque frame corners).
- **Debug overlay** (all DOM `data-dev-only` + `data-no-capture`): asset id, state,
  frame/total, FPS, playback speed, anchor, marker (declared + last fired), cycles/completed,
  load status, fallback reason, problems/warnings, and — while awaiting frames — the expected
  file list. Controls: per-pilot tabs, play/pause, restart, x1/x4, flipX, unit isolation,
  overlay close/reopen. Fullscreen + screenshot use the PR #24 buttons unchanged: fullscreen
  auto-hides the overlay (`data-dev-only`) and screenshots exclude it by architecture.

## Test evidence (all actually run)

- **Node** (`exit 0` each): `tools/validate-pilot-motion-test-contract-v1.mjs` (on this branch),
  `tools/test-motion-test-harness.mjs`, `tools/test-asset-animation-runtime.mjs`,
  `tools/test-map-theme-runtime.mjs`, `tools/test-presentation-tools.mjs`; PR #26/#27 validators
  run from a read-only worktree of `60cc4b0` (both passed, exit 0). `node --check` clean;
  `git diff --check` clean.
- **Browser (Playwright, x4 default) — 31/31**:
  - **CP-A (current real state):** harness activates without crash; x4 default; all three tests
    `awaiting_production_frames`; expected file lists exact; pilots at separated tiles; Arena
    Ruins theme active, single root, not redesigned; no Combat started; no console errors.
  - **CP-B (loader mechanics via SYNTHETIC in-memory fixtures served only by the test server —
    never committed, never claimed as production frames):** archer 10-frame non-loop completes
    at x4 with `projectileRelease` near 0.55; slime 8-frame loops ≥2 cycles with `footstepCue`;
    golem 12-frame non-loop completes with `impactCue`; restart/pause/x1-x4/isolation/flipX all
    work; broken fixtures produce the expected diagnostics (frame count < min, unsupported
    marker, anchor mismatch, inconsistent canvas, frameCount mismatch) without crashing.
  - **CP-C (integration/regression):** fullscreen hides/restores the overlay via the PR #24
    path; screenshot works and excludes the overlay; theme/board/HERO_DEFS/AAF intact; without
    `#motionTest` the harness is fully inactive.
- **Regression suites:** `demo1_ready` 41/41, AAF browser 71/71, map-theme 47/47,
  presentation 42/42.

## The three contract checkpoints

> **Status: `blocked: awaiting production frames`.**

Checkpoint 1 (Archer attack @x4), Checkpoint 2 (Slime move @x4), and Checkpoint 3 (Golem attack
@x4) require the real production frames that do not exist yet. The playback/marker/anchor
mechanics they depend on are verified (CP-B above, with clearly-labeled synthetic fixtures), so
the checkpoints can run the moment real frames land at the contract paths — but they are **not**
reported as passed today.

## Deployment

`.github/workflows/pages.yml` deploys GitHub Pages **only on push to `main`** (plus manual
`workflow_dispatch` on main). This branch cannot be deployed without merging, which this task
forbids — so there is no public URL for this branch. Real local preview actually used for all
verification: a static server over the repo root with the Three.js CDN swapped to a local copy
(the page needs nothing else), then open `autochess.html#motionTest`. Any static server works,
e.g. `npx serve .` then visit `http://localhost:3000/autochess.html#motionTest` (note: the
Three.js CDN must be reachable in that environment).

## Out of scope / untouched

No artwork/PNG/spritesheet/video created or committed; no Combat/targeting/pathfinding/economy/
stage-logic/game-loop changes; no Survival, no 3-star, no Map 2–3; canonical Arena Ruins theme
not redesigned; `canonicalApproved` untouched (false); PR #23–#28 unmodified and unmerged.
