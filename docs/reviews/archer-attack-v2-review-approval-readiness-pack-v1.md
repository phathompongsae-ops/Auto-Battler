# Archer Attack v2 Review & Approval Readiness Pack v1

## Current source of truth

This pack is **pre-return readiness only**. No Archer Attack v2 production candidate exists yet.

- Repository: `phathompongsae-ops/Auto-Battler`
- Attack v1 execution evidence: PR #67 @ `390c288c90ee060bccba5f5a00aa673ed503d521`
- Attack v1 effective status from PR #69 reconciliation: generated, user visually rejected, `NEAR_STATIC`, not approved, superseded candidate only
- Attack v2 planning source of truth: PR #69 @ `2abbe77235e6ed78f0953770dc6d8ade5f21bf76`
- Attack v2 status: authorized for CC production, not generated, not approved
- CC is the execution owner for Attack v2 Production

PR #68's older Attack-not-generated coordination state is superseded by the PR #69 reconciliation/state model. Do not use the v1 Attack approval template from PR #68 for Attack v2.

## Exact inputs that must remain stable

Approved Neutral Master:

- ID: `hero.archer.production-master.candidate.v1`
- Path: `docs/assets/review/character-production/archer/master-v1/archer-production-master-candidate-v1.png`
- SHA-256: `4911e7e3ba59241ee011be3e62f1b64230dcf9b3c24c6aeb23dc939d83311013`

Approved Idle and Move remain immutable and must pass protected-byte comparison in the CC return report.

Motion/readability reference only:

- PR #30 first real ten-pose Archer Attack motion test
- PR #31 corrected old reference, preferred for pose/readability comparison
- verdict: `CLEAR`
- old pixels must never become final Attack v2 identity art

Rejected comparison baseline:

- PR #67 Attack v1
- verdict: `NEAR_STATIC`
- reason: `near_static_visual_motion`
- preserve for forensic comparison only

## What Coco must verify when CC returns Attack v2

Use `data/design/archer-attack-v2-cc-return-checklist-v1.json`.

The return is not review-ready until GitHub identity, exact base/ancestry, package paths, hashes, provenance, timing semantics, visual evidence, and protected-byte comparisons are complete.

Expected contract:

- 10 timing frames
- 12 FPS
- `loop=false`
- `rootMotion=in-place`
- `runtimeFlipX=true`
- preferred anchor `[0.5,0.92]`, revalidated on actual v2 frames
- marker vocabulary: `projectileRelease`
- target timing near normalized `0.55` / frame `005`, but final mapping must follow the actual visible release pose

Required visible progression:

`ready -> raise bow -> nock/prep -> draw mid -> full draw/high tension -> release -> recoil/follow-through -> open-hand follow-through -> recovery -> neutral exit`

## Visual acceptance gate

The central question is not whether hashes differ. The central question is whether a player can see the Archer **raise, draw, reach full tension, release, and follow through**.

Required visual gates:

1. Meaningful pose diversity, not minor warp or unique-file hashes.
2. Visible shoulder, upper-arm, elbow, forearm, and drawing-hand articulation.
3. Full draw immediately distinguishable from ready/neutral.
4. Release visibly distinct from full draw as a semantic pose change.
5. Follow-through visibly distinct from release and neutral.
6. Board-scale/mobile readability without relying on projectile VFX.
7. Approved Archer identity remains intact.

Human review uses seven questions:

1. เห็นยกธนูไหม
2. เห็นง้างสายไหม
3. เห็น full draw ชัดไหม
4. เห็นปล่อยลูกศรไหม
5. เห็น follow-through ไหม
6. ยังเป็น Archer ตัวเดิมไหม
7. ที่ board scale ยังอ่านออกไหม

**Hard rule:** questions 2–5 must all be clearly YES. Technical PASS cannot override a visual failure.

## Required review artifacts from CC

At minimum:

- 10-frame contact sheet
- 12 FPS sequence preview GIF
- board-scale preview GIF or sample sequence
- full-draw diagnostic
- `projectileRelease` diagnostic

Preferred when feasible:

- old CLEAR vs rejected v1 NEAR_STATIC vs v2 comparison contact sheet or GIF

Artifacts must be readable on a phone without requiring labels or projectile VFX to understand the attack.

## Approval sequencing

1. **CC Attack v2 Production**
   - Generate the versioned v2 candidate only.
   - Do not overwrite rejected v1.
   - No runtime integration.

2. **CC validation and return report**
   - Technical integrity + visual-evidence gates.
   - Required end state: `attackV2Generated=true`, `attackV2PackageApproved=false`.

3. **Coco exact return verification**
   - Verify PR/branch/HEAD/base/ancestry, exact package inventory, hashes, provenance, protected bytes, visual-gate evidence, and review artifacts.
   - Do not infer missing facts.

4. **User visual review**
   - Apply the seven-question rubric.
   - If draw/full draw/release/follow-through are not clearly readable, reject and return to a new production iteration.

5. **Attack v2 Exact-File Approval — only after explicit user approval**
   - Instantiate a separate approval record/PR using `data/design/archer-attack-v2-package-exact-file-approval-template-v1.json`.
   - Lock exact frame hashes, package paths, FPS, loop, rootMotion, runtimeFlipX, anchor, actual `projectileRelease`, provenance, and approved visual evidence.

6. **Complete Archer Motion Approved**
   - Neutral + Idle + Move + Attack v2 exact approvals must all be locked.

7. **Separate CC runtime authorization**
   - Use `data/design/archer-attack-v2-post-approval-runtime-authorization-gate-v1.json`.
   - Reuse PR #56 technical motion pipeline; do not rewrite framework unnecessarily.
   - Runtime tests at x4 with exactly 3 targeted checkpoints only:
     1. Asset Load + State Registration
     2. Playback + Transition + Anchor Stability
     3. Marker + Projectile Timing + Regression

## Approval safety

The pending exact-file approval template is not an approval record.

Current required state remains:

- Neutral Master approved
- Idle approved
- Move approved
- Attack v1 rejected / not approved / superseded
- Attack v2 authorized / not generated / not approved
- Complete Archer Motion Approved = false
- `canonicalApproved=false`
- `runtimeEligible=false`
- `runtimeIntegrated=false`

No runtime authorization exists now.

## Scope boundary

This readiness pack is docs/data/review coordination only.

No Attack v2 PNG generation, image editing, Archer regeneration, Neutral/Idle/Move mutation, `src/`, runtime, Combat/gameplay, board/camera/map, Slime/Golem production, cross-repository work, or PR merge is authorized or performed here.
