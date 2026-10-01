# Archer Post-Attack Integration Readiness Plan v1

This is a **read-only future sequence**. It does not approve Attack and does not authorize runtime work now.

## Current gate

Base source of truth:
- Repository: `phathompongsae-ops/Auto-Battler`
- PR #65 branch: `coco/archer-move-package-exact-file-approval-v1`
- Exact SHA: `5305c84e80a7117c69a2f8048f9f5ca76e051d09`

Current state:
- Neutral Master: approved
- Idle: exact package approved
- Move: exact package approved
- Attack: not generated at this planning point
- `attackPackageApproved=false`
- `canonicalApproved=false`
- `runtimeEligible=false`
- `runtimeIntegrated=false`

## Required sequence

1. **CC Archer Attack Production**
   - Produce exact-source Attack package only.
   - Complete package validation and visual review evidence.
   - Stop pending user review.

2. **User visual review**
   - Review contact sheet, preview GIF, board-scale sample, `releaseCue` diagnostic, and transition evidence.
   - Technical pass alone does not count as approval.

3. **Attack Exact-File Approval**
   - Separate scoped approval record/PR only after explicit user approval.
   - Lock exact Attack frame hashes, sidecar/source-map semantics, anchor, FPS, non-loop behavior, and `releaseCue`.
   - Only at this step may `attackPackageApproved=true` be recorded.

4. **Complete Archer Motion approved**
   - Confirm Neutral + Idle + Move + Attack approval matrix.
   - Keep `canonicalApproved=false` and runtime not integrated until the separate runtime task.

5. **CC Runtime Integration**
   - Reuse the technical motion pipeline demonstrated by PR #56 (`cc/pilot-idle-motion-runtime-integration-v1` @ `bbe63518c42761f49a0aa068c78e0d07d3e88214`) rather than rewriting the animation framework.
   - Integrate only approved exact package bytes.
   - Preserve state semantics, anchors, markers, `runtimeFlipX`, cache/dispose behavior, and rollback capability.

6. **x4 validation — exactly 3 targeted checkpoints**
   1. **Asset Load + State Registration**
      - exact Idle/Move/Attack package bytes load under correct `hero.archer` states
      - FPS/loop/rootMotion/anchor/`runtimeFlipX` metadata register correctly
      - no stale/legacy texture binding and no load errors
   2. **Playback + Transition + Anchor Stability**
      - Idle loops at 8 FPS; Move loops at 12 FPS; Attack plays non-loop at 12 FPS
      - Idle -> Attack -> Idle and Move -> Attack transitions enter/recover cleanly
      - no root drift, crop, scale pop, anchor jump, or stale frame
   3. **Marker + Projectile Timing + Regression**
      - Move footsteps remain isolated to frames 002/006
      - Attack `releaseCue` fires exactly once at the approved frame per attack playback
      - projectile spawn timing uses the marker without changing Attack art
      - targeted Combat/gameplay regression remains functional at x4 with no marker leakage

7. **Pilot acceptance**
   - Record runtime evidence and rollback readiness.
   - Do not broaden scope until the Archer new-art pipeline is accepted.

8. **Next migration candidates**
   - Slime/Golem may be considered only after Archer pilot acceptance.
   - This plan does not authorize or start their production.

## Runtime handoff requirements after Attack approval

Exact inputs to pass to CC:
- approved Neutral Master path/SHA
- approved Idle exact frame hashes and sidecar/source-map
- approved Move exact frame hashes, sidecar/source-map, footstep markers
- approved Attack exact frame hashes, sidecar/source-map, `releaseCue`
- FPS, loop semantics, rootMotion, anchors, `runtimeFlipX`
- transition notes and board/bench concerns
- validation evidence and exact approval records

Technical reuse expectations from PR #56:
- reuse existing asset-animation/runtime loading and validation patterns
- reuse motion-test harness state arbitration/restart/switch behavior
- preserve marker isolation
- preserve pause/play and x1–x4 test controls
- preserve flipX behavior
- reuse transition and motion-pipeline regression tests where applicable
- do not rewrite the framework unless a demonstrated blocker requires a separately reviewed change

## Rollback plan

Runtime integration must be reversible by removing the new Archer state bindings/mapping changes and restoring the immediately prior approved runtime mapping, without modifying approved asset bytes.

Any runtime defect must not be “fixed” by altering approved Idle/Move/Attack package bytes. Asset changes require a new version and approval cycle.
