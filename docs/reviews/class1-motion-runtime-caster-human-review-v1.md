# Class 1 Caster Runtime — Human Review Evidence v1

**Status: CLASS1_MOTION_RUNTIME_CASTER_APPROVED**

The user reviewed this evidence package and gave explicit **Runtime Human Approval** for the
Runtime motion behavior of Mage, Summoner, and Acolyte (Idle, Move, Basic Attack, x1/x4
readability, facing, repeated-attack stability, return to Idle, multi-unit independence). The
authoritative decision is recorded in `data/design/class1-motion-runtime-caster-v1.json`
(`runtimeHumanDecision`); this record's checklist is updated below to reflect that decision.
**Board/camera/art-direction/lighting/UI presentation are NOT approved** — the user has
specifically expressed dissatisfaction with these, and that work remains a separate, later,
user-authorized task. This record does not authorize Skill/Cast, canonical promotion, or a merge.

## Source verified before capture

| | |
|---|---|
| Repository | `phathompongsae-ops/Auto-Battler` |
| Branch | `cc/class1-motion-runtime-caster-v1` |
| Starting head (expected) | `5cae69c954beb27a5927ce977bc664179c73b033` |
| Starting head (verified live) | `5cae69c954beb27a5927ce977bc664179c73b033` — match |
| PR #88 (verified live) | open, Draft, unmerged, `mergeable_state=clean` |
| Existing Runtime validator | PASS (`tools/validate-class1-motion-runtime-caster-v1.mjs`, exit 0) |
| Package integrity | 134/134 imported files unchanged; 3/3 Neutral Master hashes re-confirmed |

## How this evidence was captured

Every clip drives the **real production functions** — `updateUnit()` / `updateCasterAnim()` via
the existing `window.__casterRuntimeTestHook.stepUnitRef()`, rendered via the real
`renderer.render(scene, camera)` (exposed as `hook.renderFrame()`) — against the actual
`autochess.html` / `src/game.js` in a real headless Chromium browser (Playwright) over a local
static server. No `src/game.js` change was needed; the existing test hook already exposed
everything required.

A test-side ticker calls these real functions at a fixed 33ms real-wall-clock cadence, scaling
`dt` by `speedMul` exactly as the production `animate()` loop does (`dt *= speedMul`) — so x1/x4
timing fidelity matches actual gameplay. This intentionally does **not** route through the
`phase==='battle'` gate in `animate()`, because that gate also fires the real victory dialog the
instant no enemy unit exists on the board — which would have covered pure Idle/Move footage with
a "ชนะด่าน" popup. Bypassing only that phase-gate wrapper (not any animation logic) keeps the
capture clean while still exercising the identical Runtime code path.

Basic Attack scenarios use a fixed in-range dummy target (same technique used for PR #88's own
automated attack-cadence assertions) so the real Combat attack branch fires deterministically;
`max_mana` was set to `Infinity` on those test units only, to keep the pre-existing (out-of-scope)
Skill/Cast system from hijacking the `animState='attack'` value mid-capture.

## Evidence package

`docs/reviews/class1-motion-runtime-caster-v1/evidence/human-review-v1/`

| File | Contents |
|---|---|
| `videos/mage-x1.webm` | Mage — Idle→Move right→Move left→Idle→isolated Attack→Idle→repeated Attack (≥5)→Idle, x1 |
| `videos/mage-x4.webm` | Same sequence, x4 |
| `videos/summoner-x1.webm` / `-x4.webm` | Same sequence for Summoner |
| `videos/acolyte-x1.webm` / `-x4.webm` | Same sequence for Acolyte |
| `videos/batch-x1.webm` | 4 units (Mage, Summoner, Acolyte, 2nd Mage) — simultaneous Idle → independent Move with opposing facing → simultaneous Basic Attacks (all 4) → dispose one unit → confirm remaining 3 continue, x1 |
| `videos/batch-x4.webm` | Same batch sequence, x4 |
| `shots/*-final.png` | Final-frame screenshot per clip |
| `capture-summary.json` | Structured log: per-clip console-error counts (all 0) and post-disposal unit-state readback |

Every clip carries an on-screen HUD label naming the current phase (e.g. "MAGE x4 — REPEATED
BASIC ATTACK (>=5)") so it is self-documenting for review without cross-referencing this document.

## Runtime execution findings (from this capture run)

- **Console errors across all 8 clips: 0.** No asset-load failures.
- **Character isolation**: each character clip used only its own `casterCls`; the batch clip's
  post-disposal readback confirms each remaining unit kept its own distinct `heroKey` and an
  active animation state.
- **Repeated Basic Attack**: "full replay" behavior observed consistently at both x1 and x4 — no
  stuck Attack state, no unbounded animation queue, clean return to Idle once the target was
  removed, in every clip.
- **Lifecycle/disposal**: after removing one of the 4 batch units mid-combat, all 3 remaining
  units retained `hasMap: true` and an active `casterSeqKey` at both x1 and x4 — no shared-texture
  corruption (confirms the fix already recorded in PR #88's own Runtime Integration record).
- **No Runtime defect was found during this capture.**

## Board Preview / Board-UI scope note

Board Preview remains **`DEFERRED_UNTIL_AFTER_DEMO`** — not created or replaced. Board color,
layout, camera framing, and UI tone are **not reviewed or approved** by this task; this evidence
package covers Caster Runtime **motion behavior only**.

## Human Review checklist (resolved — Runtime Human Approved)

### Mage
- [x] Idle acceptable — **approved**
- [x] Move acceptable — **approved**
- [x] Basic Attack acceptable — **approved**
- [x] x4 readability acceptable — **approved**
- [x] Facing acceptable — **approved**
- [x] Return to Idle acceptable — **approved**

### Summoner
- [x] Idle acceptable — **approved**
- [x] Move acceptable — **approved**
- [x] Basic Attack acceptable — **approved**
- [x] x4 readability acceptable — **approved**
- [x] Facing acceptable — **approved**
- [x] Return to Idle acceptable — **approved**

### Acolyte
- [x] Idle acceptable — **approved**
- [x] Move acceptable — **approved**
- [x] Basic Attack acceptable — **approved**
- [x] x4 readability acceptable — **approved**
- [x] Facing acceptable — **approved**
- [x] Return to Idle acceptable — **approved**

### Batch
- [x] Character distinction acceptable — **approved**
- [x] Simultaneous playback acceptable — **approved**
- [x] No obvious visual collision — **approved**
- [x] **Runtime motion approved: approved**

### Explicitly NOT covered by this approval
Board appearance, board layout, camera framing, art direction, lighting, shadows, color grading,
UI tone, Skill/Cast, projectile, VFX, gameplay, balance, Combat ordering, Melee Runtime, Archer
Runtime, monster Runtime. The user has specifically expressed dissatisfaction with the board,
camera/motion viewpoint, art direction, lighting/shadow, and overall visual presentation.

## Known limitations

- Move segments were driven via directly-scripted `moveFrom`/`moveTo` waypoints through the real
  `moveT`/lerp mechanism, rather than the AI-pathing (`stepToward`/A*) system, to keep the capture
  deterministic and avoid the wave-cleared victory dialog contaminating footage. Basic Attack used
  a fixed in-range dummy target for the same reason. Both exercise the exact real per-frame
  update/render functions.
- Equipment-derived attack-speed scenarios were not captured (matches the known limitation already
  recorded in PR #88's own Runtime Integration record).
- Board/UI/camera/color-grading visual polish is explicitly out of scope and not reviewed here.
- `ATTACK_SPEED_RUNTIME_VALIDATION_PENDING` and `PENDING_SEPARATE_RUNTIME_INTEGRATION_VALIDATION`
  remain unresolved — unchanged by this evidence-only task.

## Scope

Changed paths limited to this checklist, the structured review JSON, and the evidence directory
under `docs/reviews/class1-motion-runtime-caster-v1/evidence/human-review-v1/`. `src/game.js` and
`tools/validate-class1-motion-runtime-caster-v1.mjs` were **not** modified — the existing Runtime
Integration code and test hook were sufficient for this capture. No PNG/GIF binary touched. No
gameplay, Combat, balance, Skill/Cast, projectile, VFX, or Board Preview change occurred. PR #87
not modified. PR #88 remains Draft and unmerged; no auto-merge enabled.
