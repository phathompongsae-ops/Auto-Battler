# Archer Attack v1 Rejection Reconciliation + v2 Redo Plan v1

## Decision

The Archer Attack candidate in **PR #67** is formally recorded as **visually rejected by the user**.

- Attack v1 generated: `true`
- User visual approval: `false`
- Attack v1 package approved: `false`
- Visual verdict: `NEAR_STATIC`
- Rejection reason: `near_static_visual_motion`
- Redo required: `true`

The technical validator PASS for PR #67 does not override this visual rejection.

## Forensic basis

The old Archer Attack motion-test sequence from PR #30/#31 reads **CLEAR** because it is a true multi-pose sequence with distinct motion intents:

`ready → raise bow → nock → draw mid → full tension → release → recoil/follow-through → recovery`

The preferred old motion-reference revision is PR #31 (`cc/archer-motion-test-visual-fix-v2` @ `6ab6a1f485d9e17badc56a671b5f105d049d8fe2`). Its pixels are **reference-only** and must never be copied into final Attack v2 art.

PR #67 Attack v1 uses deterministic displacement/warp from the approved Neutral Master and preserves technical identity/source integrity, but the resulting articulation is too restrained for a bow attack. It is kept only as a rejected/superseded comparison candidate.

## PR #68 stale-state reconciliation

PR #68 (`Archer Attack Review & Approval Coordination Pack v1`) was created before PR #67 was discovered and contains planning state that represents Attack as not generated.

This reconciliation lineage is a direct descendant of exact PR #68 HEAD `fce85bdc79a702d51b3fd4a24852396c21913f8e` and **supersedes the stale effective-state interpretation** without rewriting PR #68 history.

Current effective state is now:

- Neutral Master: approved
- Idle: approved
- Move: approved
- Attack v1: generated, visually rejected, not approved, superseded candidate
- Attack v2: authorized for CC production, not generated, not approved
- Complete Archer Motion Approved: false
- canonicalApproved: false
- runtimeEligible: false
- runtimeIntegrated: false

PR #67 remains a sibling execution branch referenced read-only. No merge, cherry-pick, or binary copy from PR #67 is used in this planning lineage.

## Attack v2 strategy

**Approved new Archer identity + old CLEAR articulated attack readability**

Visual identity source:

- `hero.archer.production-master.candidate.v1`
- `docs/assets/review/character-production/archer/master-v1/archer-production-master-candidate-v1.png`
- SHA-256 `4911e7e3ba59241ee011be3e62f1b64230dcf9b3c24c6aeb23dc939d83311013`

Motion/pose reference:

- PR #30 initial real ten-pose Archer Attack motion test
- PR #31 preferred corrected motion-reference revision
- paths: `assets/units/hero.archer/attack/hero.archer_attack_000.png ... 009.png`
- sidecar: `assets/units/hero.archer/hero.archer_attack_motiontest.json`
- source map: `assets/units/hero.archer/source-map.json`

The old sequence guides **pose timing and articulation only**. Final v2 must remain the approved new chibi Archer identity.

## Core v2 motion rule

Attack v2 must not use **Neutral pose + subtle warp** as its core motion method.

It must visibly articulate shoulders, upper arms, elbows, forearms, hands, torso, and bow orientation so a player can see:

**raise → draw → full draw → release → follow-through**

Pixel warp may be used only as secondary cleanup/refinement.

## Timing contract

- character/state: `hero.archer / attack`
- 10 timing frames
- 12 FPS
- loop=false
- rootMotion=in-place
- runtimeFlipX=true
- preferred anchor `[0.5,0.92]`, revalidated from actual v2 frames
- marker vocabulary: `projectileRelease`
- target marker timing: normalizedTime ~`0.55`, near frame `005`, but final mapping must follow the actual visible release frame rather than being forced blindly

## Visual-quality upgrade

Attack v2 must pass both technical validation and visual/perceptual gates:

- meaningful pose diversity, not unique hashes
- visible arm/shoulder/elbow articulation
- readable full draw distinct from neutral
- semantic release distinct from full draw
- visible follow-through
- board-scale readability without projectile VFX

The user review gate asks seven simple questions; questions 2–5 (draw, full draw, release, follow-through) must all be clearly YES before approval can proceed.

## Stop boundary

This reconciliation authorizes **CC production of Attack v2 only**.

It does not authorize:

- Attack v2 exact-file approval
- runtime integration
- `src/` changes
- Combat/gameplay changes
- Slime/Golem production
- PR merge
