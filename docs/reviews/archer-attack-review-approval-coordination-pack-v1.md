# Archer Attack Review & Approval Coordination Pack v1

## Purpose

This pack prepares the review and approval sequence for a future **CC-owned Archer Attack Production v1** candidate. Coco performs GitHub verification, review coordination, approval sequencing, exact-package review preparation, and post-CC handoff planning only.

No Attack frames, production PNG/GIF binaries, Neutral/Idle/Move assets, runtime, `src/`, Combat, gameplay, board/camera/map, or other-character production are changed by this pack.

## Verified source chain

- Repository: `phathompongsae-ops/Auto-Battler`
- PR #65 — `Archer Move Package Exact-File Approval v1`
  - branch: `coco/archer-move-package-exact-file-approval-v1`
  - HEAD: `5305c84e80a7117c69a2f8048f9f5ca76e051d09`
  - Neutral/Idle/Move approved; Attack not generated; canonical/runtime false
- PR #66 — `Archer Attack Production Blocker Resolution + CC Execution Handoff v1`
  - branch: `coco/archer-attack-production-cc-handoff-v1`
  - HEAD: `b2bc48ca3b246f6c72879c2683a9b19e1cf5cd11`
  - base is exact PR #65 HEAD
  - docs/data/planning only

Filesystem limitation remains authoritative:

`Coco filesystem accessibility = NOT SHARED`

Do not retry the previous shared-workspace flow. CC is the execution owner for Attack Production.

## PR #66 handoff audit result

The six handoff files are internally consistent on:
- exact PR #65 source SHA
- Neutral Master ID/path/SHA
- Idle approved and immutable
- Move approved and immutable
- `attackGenerated=false`
- `attackPackageApproved=false`
- CC execution ownership
- Coco filesystem `NOT SHARED`
- no runtime integration before Attack approval
- later x4 runtime validation limited to exactly 3 targeted checkpoints

No PR #66 correction was required.

## Review preparation files

### Review rubric

- Machine-readable: `data/design/archer-attack-review-rubric-v1.json`
- Human-readable: `docs/reviews/archer-attack-review-rubric-v1.md`

The rubric covers:
- identity
- motion readability
- board scale
- bench scale
- technical package evidence
- transition readiness

It never auto-approves a candidate.

## Exact-file approval preparation

Template:

`data/design/archer-attack-package-exact-file-approval-template-v1.json`

Status now:

`pending-user-approval-template-only`

The template contains placeholders for exact Attack frame hashes, frame count, FPS, non-loop semantics, rootMotion, runtimeFlipX, anchor, `releaseCue`, package paths, user approval evidence, and immutable-package boundaries.

It must not be activated or used to set `attackPackageApproved=true` until the user explicitly approves the exact CC-produced candidate.

## Complete Archer approval sequence

State model:

`data/design/archer-complete-motion-approval-state-model-v1.json`

Required sequence:

1. Neutral Master — approved
2. Idle — exact package approved
3. Move — exact package approved
4. Attack Production — pending CC execution
5. User visual review — mandatory
6. Attack Exact-File Approval — only after explicit user approval
7. Complete Archer Motion Approved — only after all four source/motion components are approved
8. CC Runtime Integration Authorization — only after the post-approval gate passes

No step may skip user visual approval.

## CC Attack return checklist

`data/design/archer-attack-cc-return-checklist-v1.json`

CC's return report must include:
- GitHub PR/branch/HEAD/base/ancestry
- Neutral SHA verification and Idle/Move protected-byte passes
- full Attack contract and per-frame hashes
- package paths and `releaseCue`
- identity/board/bench/transition results
- contact sheet, preview GIF, board sample, marker diagnostic
- validators, exit codes, warnings, protected-byte comparisons
- required end state with `attackPackageApproved=false`

Missing exact base/ancestry, protected bytes, frame hashes, marker mapping, review evidence, validation exit codes, or the non-approval state is a hard review blocker.

## Post-approval runtime authorization gate

`data/design/archer-post-approval-runtime-authorization-gate-v1.json`

Current status:

`authorizedNow=false`

Only after Neutral + Idle + Move + Attack are all exact-approved and hashes are locked may CC enter runtime integration.

Runtime must reuse PR #56 technical motion-pipeline patterns where applicable and avoid unnecessary framework rewrite.

Runtime testing is fixed to **x4, exactly 3 targeted checkpoints**:

1. Asset Load + State Registration
2. Playback + Transition + Anchor Stability
3. Marker + Projectile Timing + Regression

The runtime task must preserve exact approved art bytes, anchors, markers, `runtimeFlipX`, transitions, and rollback capability.

## Current effective state

- `neutralMasterApproved=true`
- `idlePackageApproved=true`
- `movePackageApproved=true`
- `attackGenerated=false`
- `attackPackageApproved=false`
- `completeArcherMotionApproved=false`
- `canonicalApproved=false`
- `runtimeEligible=false`
- `runtimeIntegrated=false`

## Stop boundary

This coordination pack stops before:
- Attack production
- Attack frame generation
- user approval recording
- Attack Exact-File Approval activation
- runtime authorization
- runtime integration
- Slime/Golem production
- PR merge
