# Skeleton Runtime Integration Pilot v1 — Human Runtime Review Sheet

**Status: AWAITING_HUMAN_RUNTIME_REVIEW.** This sheet is generated for human sign-off; no
box below has been pre-checked, and this record does not itself constitute approval,
Canonical Approval, or merge authorization.

## What to review

- Screenshots: `screenshots/x1_*.png`, `screenshots/x4_*.png` (5 states each),
  `screenshots/multi_unit_mixed_states.png`.
- Reports: `runtime-integration-report-v1.md`, `state-mapping-v1.md`,
  `transition-qa-v1.md`, `x1-x4-validation-report-v1.md`.

## Checklist (for human reviewer)

- [ ] Idle looks correct (pose, loop, no jitter)
- [ ] Move looks correct (walk cycle reads clearly)
- [ ] Basic Attack looks correct (windup/release/impact/recovery reads clearly)
- [ ] Hit looks correct (reads as a reaction, not a re-attack)
- [ ] Death looks correct (reads as a clean fall, corpse holds before fading)
- [ ] x4 speed does not look broken/skippy in an unacceptable way
- [ ] Multi-unit scene (3 Skeletons, mixed states) looks correct
- [ ] No visual regression to any other unit (hero or other monster)

## Approval flags (all default false — set only by explicit human decision)

| Flag | Value |
|---|---|
| `humanRuntimeApproval` | **false** |
| `runtimeIntegrated` | **true** — code is integrated and validated in this pilot; does not itself mean human-approved |
| `canonicalApproved` | **false** |
| `merged` | **false** |

## Scope reminder

This pilot integrates **Skeleton only**, using Idle/Move/Basic Attack/Hit/Death exclusively.
No Spawn/Skill/Cast/Projectile/Elite/Boss/Special state was added. No Combat, damage-
formula, balance, economy, AI, board-topology, camera, UI, VFX, projectile, or GitHub-
workflow file was changed. Animation markers are presentational only — all damage timing,
cooldown, and combat resolution remain 100% Runtime-owned, unchanged from before this pilot.
