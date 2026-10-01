# Archer Attack Review Rubric v1

This rubric is for **user review of a future CC-produced Archer Attack Production v1 candidate**. It does not generate art, approve a package automatically, or authorize runtime integration.

Source lock:
- Repository: `phathompongsae-ops/Auto-Battler`
- Coordination base: PR #66 @ `b2bc48ca3b246f6c72879c2683a9b19e1cf5cd11`
- Attack production source: PR #65 @ `5305c84e80a7117c69a2f8048f9f5ca76e051d09`
- Neutral Master: `hero.archer.production-master.candidate.v1`
- Neutral SHA-256: `4911e7e3ba59241ee011be3e62f1b64230dcf9b3c24c6aeb23dc939d83311013`

## A. Identity

Pass only when the candidate preserves the approved Archer identity:
- same face/head read as the approved Neutral Master
- green hood and green hair remain stable
- pointed elf-like ears remain readable
- large green eyes remain readable
- oversized ornate green/gold bow remains the dominant class cue
- green/gold Ranger costume and ~2.5–3-head chibi proportions remain recognizable
- no redesign drift, face morph, bow morph, or costume morph

## B. Motion readability

The sequence should read clearly as a Ranger bow attack:
- anticipation is readable without breaking identity
- bow draw is clear
- full draw/aim produces a readable silhouette
- release is the clearest timing beat
- follow-through is controlled
- recovery returns cleanly without an obvious pop

Reject or revise if it reads primarily as a melee swing, spell cast, generic arm motion, locomotion, or acrobatic jump.

## C. Board scale

Check the actual gameplay-scale presentation:
- bow silhouette survives reduction
- no crop
- no excessive blur/noise
- attack intent is readable at board scale
- no obvious HP-bar-zone interference
- green/gold foreground contrast remains useful

## D. Bench scale

Bench scale is the highest-risk context. Check:
- hood/hair separation
- readable face opening
- visible gold hood trim
- eye contrast
- distinct bow identity

A bench concern may be recorded without changing bench geometry or approved source assets.

## E. Technical package review

Expected target contract unless CC documents a separately reviewed deviation:
- 6–8 frames, using the smallest readable count
- 12 FPS
- `loop=false`
- `rootMotion=in-place`
- `runtimeFlipX=true`
- anchor validated from actual bounds/support evidence; preferred `[0.5,0.92]`
- `releaseCue` has exact `frameIndex`, deterministic `normalizedTime`, and projectile-release semantic meaning
- per-frame SHA-256 values recorded
- provenance traces every frame to the exact Neutral Master
- expected 640×960 RGBA PNG frames with alpha bounds measured and no crop

## F. Transition readiness

Review static/package evidence for:
- Idle → Attack
- Attack → Idle
- Move → Attack

Look for anchor/scale/bounds discontinuity, silhouette jump, bow-orientation jump, first-frame pop, and recovery pop. Approved Idle/Move bytes must never be edited to make a transition look better.

## Review decision

Allowed outcomes:
1. **Pass for user consideration** — technical/visual evidence is sufficient for the user to decide.
2. **Revise candidate** — specific Attack-only corrections are required.
3. **Reject candidate** — identity or motion direction is unacceptable.

**Technical PASS is not user approval.** This rubric must never set `attackPackageApproved=true`. Exact-file approval requires a later explicit user decision on the exact candidate package and hashes.
