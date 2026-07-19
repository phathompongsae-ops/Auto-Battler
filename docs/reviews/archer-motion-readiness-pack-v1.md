# Complete Archer Motion Readiness Pack v1

Machine-readable record: `data/design/archer-motion-readiness-pack-v1.json`

The `hero.archer` motion set is now **complete in production**: all three states the runtime contract requires exist as exact, hash-locked packages derived from the single approved Neutral Master (SHA-256 `4911e7e3ba59241ee011be3e62f1b64230dcf9b3c24c6aeb23dc939d83311013`).

| State | Package | Frames | FPS | Loop | Markers | Status |
|---|---|---:|---:|---|---|---|
| Idle | `hero.archer.idle.chibi-production-candidate.v1` | 8 | 8 | yes | — | **approved** (PR #63 overlay) |
| Move | `hero.archer.move.chibi-production-candidate.v1` | 8 | 12 | yes | leftFootstepCue @0.25, rightFootstepCue @0.75 | **approved** (PR #65 overlay) |
| Attack | `hero.archer.attack.chibi-production-candidate.v1` | 10 | 12 | no | projectileRelease @0.55 | **pending user approval** (this PR) |

All 26 frames are 640×960 RGBA, anchor `[0.5, 0.92]`, in-place root motion, `runtimeFlipX=true`, each derived independently from the exact approved Neutral Master with no AI regeneration and no cross-state deformation reuse.

## Gate state

```
neutralMasterApproved = true
idlePackageApproved   = true
movePackageApproved   = true
attackGenerated       = true
attackPackageApproved = false
canonicalApproved     = false
runtimeEligible       = false
runtimeIntegrated     = false
```

## Remaining gates, in order

1. **Archer Attack exact-file approval** — separate task, user decision, same overlay pattern as Idle/Move.
2. **Canonical approval of the complete motion set** — separate task, user decision.
3. **CC runtime integration** — separate task; blocked until both approvals above exist. See `docs/reviews/archer-runtime-integration-handoff-readiness-v1.md`.

No gate is advanced by this record; it aggregates existing state so review and the future integration task have one authoritative index.
