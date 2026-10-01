# Archer Attack Production CC Execution Handoff v1

## Execution ownership

**CC is the execution owner for Archer Attack Production v1.** Coco's filesystem was verified as `NOT SHARED`, so do not depend on Coco opening or operating CC's local workspace and do not retry the previous shared-filesystem flow.

Coco remains responsible only for GitHub-state verification, docs/data planning, review coordination, and approval sequencing.

## Exact source gate

Use CC's own locally accessible exact Auto-Battler workspace.

- Repository: `phathompongsae-ops/Auto-Battler`
- Base PR: **#65 — Archer Move Package Exact-File Approval v1**
- Base branch: `coco/archer-move-package-exact-file-approval-v1`
- Exact base SHA: `5305c84e80a7117c69a2f8048f9f5ca76e051d09`
- Required PR state before production: open, draft, unmerged
- Required approval state: Neutral approved, Idle approved, Move approved; canonical/runtime false; Attack not generated

Hard stop before generation on any mismatch.

### Neutral Master — exact identity source

- ID: `hero.archer.production-master.candidate.v1`
- Path: `docs/assets/review/character-production/archer/master-v1/archer-production-master-candidate-v1.png`
- SHA-256: `4911e7e3ba59241ee011be3e62f1b64230dcf9b3c24c6aeb23dc939d83311013`
- Expected: 640×960 RGBA PNG

CC must verify the local bytes, decode, dimensions, RGBA mode, and alpha before producing any Attack frame.

### Approved immutable motion sources

Idle:
- Approval record: `data/design/archer-idle-package-exact-file-approval-v1.json`
- 8 frames, 8 FPS, loop, in-place, `runtimeFlipX=true`, anchor `[0.5,0.92]`
- Immutable: do not regenerate, retouch, overwrite, or normalize approved bytes.

Move:
- Approval record: `data/design/archer-move-package-exact-file-approval-v1.json`
- 8 frames, 12 FPS, loop, in-place, `runtimeFlipX=true`, anchor `[0.5,0.92]`
- `leftFootstepCue@0.25 -> frame 002`
- `rightFootstepCue@0.75 -> frame 006`
- Immutable: do not regenerate, retouch, overwrite, or normalize approved bytes.

Machine-readable exact hashes and paths are in `data/design/archer-attack-input-manifest-v1.json`.

## Attack-only production scope

Produce only `hero.archer / attack`.

Motion intent:
1. anticipation
2. bow draw
3. full draw
4. aim
5. release
6. follow-through
7. recovery

Target 6–8 frames; use the smallest count that remains clearly readable at board scale.

Contract:
- 12 FPS
- `loop=false`
- `rootMotion=in-place`
- `runtimeFlipX=true`
- preferred anchor `[0.5,0.92]`, revalidated locally from actual bounds/support evidence
- semantic marker `releaseCue` mapped deterministically to the exact visual release frame

The release marker is metadata only. Do **not** implement projectile runtime or Combat changes.

Identity lock:
- youthful female Ranger
- stylized 3D fantasy chibi, ~2.5–3 heads tall
- green hood, green hair, pointed ears, large green eyes
- oversized ornate green/gold bow
- green/gold Ranger outfit
- compact gameplay-readable silhouette
- polished mobile-game rendering

Do not permit identity, face, bow, costume, scale, lighting, or root-position drift.

## Expected package convention

Follow current Archer Idle/Move conventions:

- Frames: `assets/units/hero.archer/attack-chibi-v1/hero.archer_attack_000.png ...`
- Sidecar: `assets/units/hero.archer/hero.archer_attack_chibi_v1.json`
- Source map: `assets/units/hero.archer/attack-chibi-v1/source-map.json`
- Production evidence contract: `data/design/archer-attack-production-v1.json`
- Validation report: `docs/reviews/archer-attack-production-v1-validation.json`
- Human review: `docs/reviews/archer-attack-production-v1.md`
- Review-only artifacts: `docs/assets/review/character-production/archer/attack-production-v1/`

Do not overwrite any existing v1 asset. If an unexpected path collision exists, stop and report before writing.

A package-specific generator/validator is allowed only when it is the smallest reliable solution. Do not create a new framework.

## Tooling

Verify Python, Pillow, Node/npm, SHA-256 tools, existing validators, and image/GIF tooling.

Known possible gap: `numpy`. Install a **pinned compatible version only when the chosen generator actually requires it**, record the version, and otherwise do not install it.

## Required review evidence

At minimum:
1. contact sheet
2. Attack preview GIF
3. board-scale sample
4. `releaseCue` diagnostic

When possible without runtime edits:
5. Idle -> Attack -> Idle transition diagnostic
6. Move -> Attack diagnostic

Bench-scale readability is the highest-risk visual context. Review face opening, hood/hair separation, gold hood trim, eye contrast, and bow identity.

## Validation and protection

Run the exact checklist in `data/design/archer-attack-production-validation-checklist-v1.json`.

Before and after production, byte-verify:
- Neutral Master unchanged
- approved Idle unchanged
- approved Move unchanged

Run relevant legacy validators read-only, JSON/schema checks, design-data audit, changed-path audit, and `git diff --check`.

Do not edit existing validators merely to make a check pass.

## Git and stop boundary

Create the Attack production branch as a direct descendant of exact PR #65 HEAD `5305c84e80a7117c69a2f8048f9f5ca76e051d09`.

Recommended branch: `coco/archer-attack-production-v1`

Do not merge or cherry-pick runtime ancestry. PR #56 is a **read-only technical reuse reference**, not ancestry to import.

Open a Draft PR only after the Attack package, evidence, review artifacts, validation, and readiness records are stable.

Stop with:
- `attackGenerated=true`
- `attackPackageApproved=false`
- `canonicalApproved=false`
- `runtimeEligible=false`
- `runtimeIntegrated=false`

Technical PASS is not user approval. Do not create an Attack Exact-File Approval PR in the production task.

## Forbidden scope

No `src/`, runtime integration, Combat, projectile implementation, targeting, pathfinding, main loop, camera, board, map, economy, stage logic, Slime, Golem, other heroes/bosses, or PR merge.
