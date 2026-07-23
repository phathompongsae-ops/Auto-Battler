# Skeleton Motion Feel Pilot v1

Branch: `cc/skeleton-motion-feel-pilot-v1` (base: main @ `35709ebba989de167de160399e548dc83ff984ae`)

Skeleton-only, presentation-only motion-feel pass. No combat value, damage timing, cooldown
ownership, movement speed, pathfinding, targeting, balance, board, camera, lighting, UI, or
asset byte was changed. No PNG, sprite sheet, or approved Neutral Master was touched — every
frame shown is the same approved package frame; only WHICH frame is shown WHEN changed.

## Root causes (measured before changing anything)

1. **Idle "dancing" (primary blocker)** — `updateSkeletonMotionAnim` looped all 6 idle frames
   continuously (6 × ~0.17s ≈ 1.0s cycle, ~6fps). The package's idle frames are independently
   rendered full-body poses with large inter-frame limb/body displacement; cycling them reads as
   dancing/stepping, not breathing.
2. **Per-tile restart flicker** — at step completion `u.moving` is false for exactly one tick
   before `stepToward` re-sets it. The old state machine keyed directly on `u.moving`, so every
   tile boundary produced: 1-tick idle reset → walk restarts at frame 0. With steps taking
   0.556s (moveSpeed 1.8, TILE 1) and the walk cycle authored at 0.80s, the cycle **never
   completed** — frames 6–7 were never shown while chasing (the new test suite proves this
   discriminator).
3. **Foot slide / walk desync** — frame advance was wall-clock (0.10s/frame), unrelated to world
   displacement.
4. **Weightless attacks** — damage applies the instant an attack triggers (untouched gameplay
   block in `updateUnit`), but the package played 0.42s of anticipation *after* that damage
   (durations 0.14+0.12+0.10+0.06 before contact frame 4), so the visible strike landed almost
   half a second after the damage number/flash.
5. **Flip-jitter risk** — attack facing passes a raw float dx every frame; only exactly-zero was
   guarded, so a target near the unit's own column could alternate sign by sub-pixel amounts.
6. Shadow was already a static circle child (no pulsing mechanism); the idle foot anchor was
   already re-asserted per tick. Source artwork was NOT the blocker — runtime tuning sufficed.

## Changes (all in `src/game.js`, Skeleton-gated; plus this doc and one new test file)

- **`SKELETON_FEEL` + `SKELETON_PRESENT_SEQ`** — a small presentation-tuning layer. The approved
  package timing table `SKELETON_ANIM_DEF` is left byte-intact as the package record (a test
  asserts this); hit/attack playback reads the presentation overrides instead.
- **Idle** — one stable neutral frame (idle frame 0) held while stationary, plus barely-visible
  breathing: `scale.y = 1 ± 0.012` over a 3.2s cycle, **bottom-anchored** (the plane center is
  shifted up by `halfH·(s−1)` so the drawn feet line is constant by construction). No walk frame
  can ever advance while stationary; shadow and world position untouched.
- **Walk** — playback phase advances with **actual world distance** (`strideWorldUnits: 1.0`,
  i.e. one full 8-frame cycle per tile — which also lines up with the pre-existing two-arc
  movement bob per step). Phase persists across path steps and through interrupting one-shots;
  the step-completion tick's final lerp fragment is folded in, so playback tracks travel exactly
  (test tolerance < 1e-6). Zero movement ⇒ zero frame advance; slows automatically under slow
  statuses.
- **Stop settle** — on `moving` → false the last walk pose is held for `stopSettleSec: 0.12`
  before settling onto the held idle. A real stop reads as a settle instead of a hard snap; the
  1-tick between-steps gap resumes moving first and never reaches it (kills the per-tile restart
  flicker). Gameplay position is already exact when this runs — no overshoot, no drift
  (test tolerance < 1e-9 world units).
- **Attack presentation retiming (visual only)** — `[0.05,0.04,0.03,0.03, 0.10, 0.09,0.10,0.13,0.15]`:
  compressed anticipation puts the contact pose (frame 4) 0.15s from the damage event (was
  0.42s), contact holds 0.10s, follow-through 0.47s; total 0.72s inside the 1.0s cooldown. The
  damage event, cooldown ownership, and attack frequency are untouched and test-locked.
- **Hit presentation** — `[0.06,0.07,0.08,0.10]` (0.31s vs 0.42s): still immediate and readable,
  but sustained fire no longer visually pins the unit in hit frames. Visual-only; victim
  cooldown/targeting/health math test-locked.
- **Facing dead-zone** — `SPRITE_FACING_DEADZONE = { Skeleton: 0.05 }` (world units) inside the
  existing `setUnitFacing` helper. Movement always passes whole-tile deltas (|dx| ≥ 1) and is
  unaffected; only near-zero attack-facing dx holds the last facing. Non-Skeleton units have no
  dead-zone entry and keep their exact previous behavior (test-locked). The approved Android
  facing fix (`SPRITE_BASE_FACING.Skeleton = -1`) is untouched and re-verified.
- **Breath cleanup** — `triggerSkeletonAnim` clears the breathing scale when any one-shot/death
  interrupts idle; `body.position.y` is owned by `updateUnit` outside idle, so scale is the whole
  residue surface (test-locked: no residue across repeated fight rounds).

## Before / after measurements

| Property | Before | After |
|---|---|---|
| Idle while stationary | 6-frame loop, 1.00s cycle (~6fps pose cycling → "dancing") | held neutral frame + ±1.2% breathing scale, 3.2s period, feet pinned |
| Idle foot anchor | stable (per-tick reassert) | stable by construction; measured spread < 1e-6 (real-loop: 5.6e-17) |
| Walk playback | wall-clock 0.10s/frame; restarted at frame 0 every tile; frames 6–7 never shown mid-chase; 1-tick idle flash per tile | distance-driven, 1 cycle/tile, phase persists; all 8 frames play; 0 idle flashes |
| Distance per cycle | 1.44 world units nominal (never completed) | exactly 1.0 world units (one tile) |
| Start transition | instant frame-0 swap | cycle resumes from preserved phase; frames advance only as distance accrues |
| Stop transition | instant hard snap to idle frame 0 | 0.12s settle hold, then held idle; stop error < 1e-9, no drift |
| Turn | instant mirror; sub-pixel dx could jitter | instant mirror kept (protects approved facing fix); 0.05-unit dead-zone kills near-zero jitter |
| Attack phases | anticipation 0.42s AFTER damage → contact at 0.42s; total 0.90s | contact at 0.15s after damage; hold 0.10s; recovery 0.47s; total 0.72s (< 1.0s cooldown). Damage still at t=0, unchanged |
| Hit reaction | 0.42s one-shot | 0.31s one-shot, same trigger, clean return |
| Shadow | static circle (stable) | unchanged; stability now test-locked |
| Damage / cooldown / frequency | 13 dmg, cooldown 1/atkSpeed, 5 attacks / 4.95s | identical, test-locked |

## Validation actually run

- `node --check src/game.js` — pass.
- **New** `tests/skeleton_motion_feel_v1.test.js` — **59/59 pass** (idle stability incl. foot/
  shadow/position/offset tolerances, distance-synced walk incl. the frames-6-and-7
  discriminator, stop exactness, facing + dead-zone + non-Skeleton preservation, attack
  timing/cooldown/frequency/output locks, hit visual-only locks, and a full x1/x4
  idle→chase→turn→stop→attack→hit→idle→death lifecycle repeated 3 consecutive rounds per speed
  for state-leakage detection).
- Pre-existing suites unchanged and green: `tests/live_qa_six_fixes.test.js` **70/70**,
  `tests/android_qa_hotfix_v1.test.js` **61/61**.
- Real rAF game loop (not manual ticks), wave 2 (contains Skeletons), full battle to a result at
  **x1 and x4**: victory both speeds, all live-sampled stationary Skeletons on the held idle
  frame, foot-anchor spread ≈ 5.6e-17, facing always ±1, 0 page errors.
- All test runs used the repo's documented offline convention (scratch copy with a local
  three.min.js substituted for the CDN tag); emulated Chromium — **no real-device claim is
  made**. Human Feel Gate remains pending real Android review.

## Addendum: attack-facing follow-up (Skeleton Motion Feel Pilot v1, facing follow-up)

Investigation for a later Skeleton-only pilot round found one more presentation defect, of the
exact same class already fixed for Spirit Archer in a separate PR: Skeleton's basic-attack facing
was recalculated **live** from `u.current_target` on every tick, including every tick of its own
already-committed one-shot `basic_attack` swing (the 0.72s presentation retiming above). If the
target died and was replaced, or a second adjacent target existed on the opposite side (a
surrounded Skeleton) and became the current target mid-swing, the sprite's facing flipped
mid-pose — the swing visibly pointed away from the target it was actually hitting.

Reproduced directly (Skeleton with two adjacent player units, target reassigned mid-swing):
facing flipped mid-animation before the fix, held correctly after.

**Fix** (presentation-only, Skeleton-gated, same pattern as the Spirit Archer fix): snapshot the
committed target-facing dx onto `u.skeletonAtkFacingDx` the instant `triggerSkeletonAnim(u,
'basic_attack')` fires; the facing call at the bottom of the Basic Attack block uses that
snapshot instead of a live recalculation for exactly as long as `u.skelAnim.state ===
'basic_attack'`. Every other sprite/state, including Skeleton's own idle/move/hit, falls through
to the exact original live calculation, unchanged.

Validation: new `tests/skeleton_attack_facing_v1.test.js` (20/20 pass); pre-existing
`tests/skeleton_motion_feel_v1.test.js` re-run 5x fresh against current `main` — 4/5 clean, 1/5
showing the identical, previously-classified `PRE_EXISTING_NON_BLOCKING_TIMING_FLAKE`
(`bodyOffsetClean`, a 90ms real-`setTimeout` race unrelated to facing); `tests/live_qa_six_fixes`
70/70, `tests/android_qa_hotfix_v1` 61/61, `tests/spirit_archer_attack_facing_v1` 29/29 (Spirit
Archer's own fix confirmed untouched). Real rAF game loop, wave 3 (3 Skeletons + 1 Spirit
Archer), full battle to a result at x1 and x4 across 3 repeated runs each: victory every time, 0
out-of-range facing samples, and 0 facing flips across every consecutive sample pair where a
Skeleton or Spirit Archer was mid-`basic_attack` (50–88 locked Skeleton samples at x1, 11 at x4;
18–75 locked Spirit Archer samples), 0 page errors.
