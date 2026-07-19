# Archer Runtime Integration Handoff Readiness v1

Status: **handoff-ready documentation only.** `runtimeEligible=false`, `runtimeIntegrated=false`. No `src/` file is changed by this milestone; runtime integration is a separate future task and remains unauthorized until the Attack exact-file approval and canonical approval both exist.

## What the future CC runtime integration task will consume

Authoritative index: `data/design/archer-motion-readiness-pack-v1.json` (all 26 frame paths + SHA-256 values for Idle/Move/Attack).

### Sidecars (already runtime-shaped)

Each state ships a sidecar whose fields map 1:1 onto the animation framework's loader expectations (`docs/ASSET_ANIMATION_FRAMEWORK_RUNTIME_V1.md`, PR #56 baseline):

| Sidecar | State | Key fields |
|---|---|---|
| `assets/units/hero.archer/hero.archer_idle_chibi_v1.json` | idle | 8 fps, 8 frames, loop, no markers |
| `assets/units/hero.archer/hero.archer_move_chibi_v1.json` | move | 12 fps, 8 frames, loop, leftFootstepCue/rightFootstepCue |
| `assets/units/hero.archer/hero.archer_attack_chibi_v1.json` | attack | 12 fps, 10 frames, play-once, projectileRelease @0.55 |

All three declare `framePathPattern`, `anchor [0.5, 0.92]`, `canvas [640, 960]`, `rootMotion "in-place"`, `runtimeFlipX true`, and their gate flags.

### Runtime contract rows already satisfied

The read-only technical baseline (`src/motion-test-harness.js`, PR #56) declares the target rows; every produced package matches its row exactly:

- `hero.archer/idle` — loop, 8 fps, 8 frames ✔
- `hero.archer/move` — loop, 12 fps, 8 frames, two footstep cues ✔
- `hero.archer/attack` — play-once, 12 fps, 10 frames (target 10, accepted 8–12), `projectileRelease` @0.55 ✔ (marker name is in the framework's global vocabulary)

### Integration steps for the future task (not performed here)

1. Verify both remaining approvals exist (Attack exact-file approval; canonical approval) and flip `runtimeEligible` through the approval overlay pattern — never by hand-editing production sidecars.
2. Register the three sidecars with the state machine (`idle`/`move` looping defaults; `attack` play-once with `skill → attack → idle` transition per the framework's priority order).
3. Wire `projectileRelease` to the existing procedural arrow → trail → impact pipeline; the animation intentionally contains no drawn arrow.
4. Honor `runtimeFlipX` for facing; anchors are uniform at `[0.5, 0.92]`, so no per-state offset table is needed.
5. Downscale policy per the framework doc (character animation never dropped).
6. Run the three package validators plus the motion test harness sequences (`idle→move→attack→idle` etc.) as the integration acceptance check.

## Why this unblocks the previous execution blocker

Production previously stalled because Coco's filesystem is not shared with CC. This milestone was executed entirely by CC inside the prepared exact workspace (`/home/user/auto-battler-archer-attack-source-v1`, branched from exact PR #65 HEAD `5305c84e80a7117c69a2f8048f9f5ca76e051d09`), and everything the integration task needs is now hash-locked in-repo — no cross-session filesystem sharing is required for any later step.
