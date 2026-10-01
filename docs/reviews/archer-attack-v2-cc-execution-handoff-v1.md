# Archer Attack v2 — CC Execution Handoff v1

## Ownership

CC is the execution owner for Archer Attack v2 production.

Coco owns GitHub verification, source-of-truth reconciliation, review coordination, approval sequencing, and this planning handoff only.

No shared-filesystem retry is required or authorized by this handoff.

## Exact source chain

Repository:

`phathompongsae-ops/Auto-Battler`

Planning lineage for this handoff:

- PR #68 `Archer Attack Review & Approval Coordination Pack v1`
- branch `coco/archer-attack-review-approval-coordination-v1`
- exact HEAD `fce85bdc79a702d51b3fd4a24852396c21913f8e`
- reconciliation branch descends directly from that exact HEAD

Rejected execution evidence:

- PR #67 `Archer Attack Production v1 + Complete Motion Readiness Pack v1`
- branch `cc/archer-attack-production-v1`
- exact HEAD `390c288c90ee060bccba5f5a00aa673ed503d521`
- status: generated, user visually rejected, not approved, superseded candidate
- rejection reason: `near_static_visual_motion`

Do not merge/cherry-pick PR #67 into the planning lineage merely to obtain this handoff. Treat it as read-only evidence/reference unless the user later authorizes a separate integration strategy.

## Approved visual identity source

Use the exact approved new Neutral Master as the Archer identity source:

- ID: `hero.archer.production-master.candidate.v1`
- Path: `docs/assets/review/character-production/archer/master-v1/archer-production-master-candidate-v1.png`
- SHA-256: `4911e7e3ba59241ee011be3e62f1b64230dcf9b3c24c6aeb23dc939d83311013`
- Expected: 640×960 RGBA PNG

Approved Idle and Move remain immutable and must be protected byte-for-byte.

## Old CLEAR motion/pose reference

Use the old Archer Attack only as a **read-only motion/pose reference**:

Preferred corrected reference:

- PR #31 `Archer Motion Test — visual fix v2`
- branch `cc/archer-motion-test-visual-fix-v2`
- exact HEAD `6ab6a1f485d9e17badc56a671b5f105d049d8fe2`

Initial source integration:

- PR #30 `Archer Attack Motion Test — user-supplied 10-frame integration v1`
- branch `cc/archer-motion-test-user-poses-integration-v1`
- exact HEAD `42b967844f185a4fc00cb818595309ff64627aab`

Reference paths:

- `assets/units/hero.archer/attack/hero.archer_attack_000.png ... hero.archer_attack_009.png`
- `assets/units/hero.archer/hero.archer_attack_motiontest.json`
- `assets/units/hero.archer/source-map.json`
- `assets/units/hero.archer/visual-fix-report.json`

Old motion verdict: **CLEAR**.

Old pose mapping:

1. frame 000 — combat ready / anticipation
2. frame 001 — raise bow
3. frame 002 — nock / prep
4. frame 003 — draw mid
5. frame 004 — full draw / high tension
6. frame 005 — release
7. frame 006 — recoil / follow-through
8. frame 007 — open-hand / follow-through hold
9. frame 008 — recovery toward ready
10. frame 009 — return / neutral exit

**Do not copy old pixels into final v2 art.** Transfer pose intent/readability to the approved new Archer identity.

## Why Attack v1 is rejected

The PR #67 candidate is technically consistent but visually near-static.

Its primary method is deterministic displacement/warp from one Neutral Master pose. That method preserved identity well but did not produce enough real shoulder/elbow/forearm/hand/bow articulation for a readable ranged attack at gameplay scale.

Attack v2 must not repeat **Neutral pose + subtle warp** as the core motion method.

## Attack v2 timing contract

- character/state: `hero.archer / attack`
- frame count: 10
- FPS: 12
- loop: false
- rootMotion: in-place
- runtimeFlipX: true
- preferred anchor: `[0.5,0.92]`, revalidate from actual v2 bounds/support evidence
- marker vocabulary: `projectileRelease`
- target marker timing: normalizedTime approximately `0.55`, near frame `005`
- final marker mapping must follow the actual visible release frame; do not force frame005 blindly if articulated timing changes materially

## True articulation requirement

The sequence must visibly show:

- shoulder rotation
- upper-arm movement
- elbow bend/position change
- forearm displacement
- drawing hand pulling visibly backward
- bow arm raising/stabilizing
- torso anticipation/rotation
- full-draw silhouette clearly distinct from ready
- release silhouette clearly distinct from full draw
- visible follow-through after release

Pixel warp is allowed only as secondary cleanup/refinement, never as the core motion solution.

## Identity lock vs pose freedom

Preserve:

- face identity
- green hood
- green hair
- pointed ears
- green eyes
- ornate green/gold bow identity
- green/gold costume design
- approved chibi proportions
- polished stylized rendering language

Pose is free to change in:

- arms
- shoulders
- elbows
- forearms
- hands
- torso
- bow orientation
- in-place stance

Preserve **who the Archer is**, not the Neutral body pose.

## Required visual-quality gates

Read and enforce:

- `data/design/archer-attack-v2-redo-contract-v1.json`
- `data/design/archer-attack-visual-quality-gates-v1.json`
- `data/design/archer-attack-v2-validator-upgrade-plan-v1.json`
- `docs/reviews/archer-attack-v2-human-review-rubric-v1.md`

Key rules:

- unique hashes do not prove pose diversity
- full draw must be visibly different from neutral/ready
- release must be a semantic pose change, not merely the largest pixel delta
- follow-through must be visible
- at board scale, the character motion alone must read as an Archer bow attack without projectile VFX

## Required review artifacts

Produce at minimum:

1. 10-frame contact sheet
2. 12 FPS sequence preview GIF
3. board-scale preview GIF or board-scale sample sequence
4. full-draw diagnostic: neutral/ready vs full draw
5. `projectileRelease` diagnostic: full draw vs actual release
6. old CLEAR vs rejected v1 NEAR_STATIC vs v2 comparison contact sheet or GIF when feasible

These artifacts must be easy to inspect on a phone.

## Validator v2 direction

Retain all technical source/hash/dimension/RGBA/alpha/anchor/rootMotion/marker/provenance/protected-byte checks.

Add evidence for:

- meaningful pose diversity
- shoulder/elbow/hand articulation
- drawing-hand displacement
- full-draw distinction
- release distinction
- follow-through distinction
- board-scale perceptual readability

Use old PR #31 CLEAR and PR #67 NEAR_STATIC as comparison baselines. Do not invent arbitrary thresholds solely to make validation pass.

Technical PASS may report only that the package is ready for human review. It must never set approval flags.

## End state required after CC production

- Attack v2 generated: true
- Attack v2 package approved: false
- canonicalApproved: false
- runtimeEligible: false
- runtimeIntegrated: false

Stop for user visual review.

## Forbidden scope

Do not:

- integrate runtime
- modify `src/`
- change Combat/gameplay/projectile runtime
- modify approved Neutral/Idle/Move binaries
- produce Slime/Golem or other characters
- auto-approve Attack v2
- merge any PR
