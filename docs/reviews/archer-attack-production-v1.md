# Archer Attack Production v1

## Decision boundary

This package contains one ten-frame `hero.archer` Attack production candidate. It does not contain runtime integration, canonical approval, Slime/Golem production, or an Attack approval decision.

| Status | Value |
|---|---|
| `styleDirectionApproved` | `true` |
| `neutralMasterApproved` | `true` |
| `idlePackageApproved` | `true` |
| `movePackageApproved` | `true` |
| `attackGenerated` | `true` |
| `attackPackageApproved` | `false` |
| `canonicalApproved` | `false` |
| `runtimeEligible` | `false` |
| `runtimeIntegrated` | `false` |

## Verified source and ancestry

GitHub was checked before production.

| Role | PR | Branch | Exact HEAD | Verified state |
|---|---:|---|---|---|
| Exact base and approved Move overlay | #65 | `coco/archer-move-package-exact-file-approval-v1` | `5305c84e80a7117c69a2f8048f9f5ca76e051d09` | open, draft, unmerged |
| Attack runtime contract baseline only | #56 | `cc/pilot-idle-motion-runtime-integration-v1` | `bbe63518c42761f49a0aa068c78e0d07d3e88214` | read-only; no ancestry imported |

This branch (`cc/archer-attack-production-v1`) descends directly from exact PR #65. It does not merge, rebase, or cherry-pick CC runtime ancestry. Execution owner for this round is CC, working from the prepared local exact workspace (`auto-battler-archer-attack-source-v1`) because the Coco filesystem is not shared with CC.

The exact Neutral Master remains:

| Field | Value |
|---|---|
| Candidate | `hero.archer.production-master.candidate.v1` |
| Path | `docs/assets/review/character-production/archer/master-v1/archer-production-master-candidate-v1.png` |
| SHA-256 | `4911e7e3ba59241ee011be3e62f1b64230dcf9b3c24c6aeb23dc939d83311013` |
| Format | 640×960 RGBA PNG |

Both upstream approvals were re-verified byte-level in the workspace before generation: the approved Idle package (8/8 frame SHA matches) and the approved Move package (8/8 frame SHA matches).

## Runtime contract alignment

The package implements the existing `hero.archer/attack` runtime contract row from the read-only technical baseline (`src/motion-test-harness.js`):

| Field | Contract row | This package |
|---|---|---|
| loop | `false` | `false` (play once) |
| fps | 12 | 12 |
| frame count | target 10 (accepted 8–12) | 10 |
| anchor | `[0.5, 0.92]` | `[0.5, 0.92]` |
| marker | `projectileRelease` @ 0.55 | `projectileRelease` @ 0.55 → frame 005 (displayed 0.50–0.60) |
| root motion | in-place | in-place |
| runtimeFlipX | `true` | `true` |

`projectileRelease` is already in the framework's global marker vocabulary. The animation deliberately contains **no drawn arrow**: per the animation framework, the runtime spawns a procedural arrow → trail → impact at the marker.

## Production method

The Attack sequence is deterministic source-derived articulation, not AI regeneration. Every frame independently samples the exact approved Neutral Master with bilinear filtering in premultiplied RGBA. Per the Move approval overlay's carried-forward constraint, the Move locomotion deformation is **not** reused; the Attack field is a distinct draw-and-release gesture:

- whole-body lean toward the bow (viewer-right), up to 9 px, tapering to zero at the pinned foot zone — the head moves only as a rigid subpixel translation, never locally deformed;
- anticipation crouch, up to 7 px of compression, releasing after the snap;
- a localized string-arm lobe (viewer-left hand beside the quiver) pulling up to 16 px toward viewer-left through full draw, snapping back at release; its partition reaches zero before the bow column, so the ornate bow is never locally deformed;
- rows y≥800 are byte-identical to the Neutral Master in every frame — both feet and the y=854 contact baseline are pinned exactly, zero foot slide by construction;
- frame 009 is a verbatim byte copy of the approved master file (same convention as approved Idle frame 000), so the play-once state exits cleanly back to Idle;
- accumulated frame-to-frame edits: none; world travel baked: none.

Frame roles: stance-set → draw-begin → draw-mid → draw-deep → full-draw-hold → **release (marker)** → follow-through → recoil-settle → recovery → return-to-neutral.

## Measured results

From `docs/reviews/archer-attack-production-v1-validation.json`:

- release snap (frames 4→5) is the **maximum** adjacent visual delta (0.0374), giving the attack its sharpest read exactly at the marker;
- smooth settle: frames 8→9 delta 0.0031; entry from neutral 0.0110 (comparable to one normal Move animation step);
- exit frame byte-identical to the Neutral Master: **true**;
- string-arm region centroid snaps toward the bow at release (+1.13 px), after the draw pull;
- horizontal alpha-centroid range 6.66 px (the designed lean), vertical 3.83 px; accumulated translation 0; no world travel;
- all ten frames unique, 640×960 RGBA, zero border pixels, alpha bounds stable.

## Review artifacts (review-only, not runtime-eligible)

Directory: `docs/assets/review/character-production/archer/attack-production-v1/`

- `archer-attack-production-v1-contact-sheet.png` — all ten frames with roles and marker labels
- `archer-attack-production-v1-sequence-preview.gif` — 12 FPS sequence with a hold on the neutral exit
- `archer-attack-production-v1-board-scale-sample.png` — release frame at board scale over the PR #55 board context
- `archer-attack-production-v1-marker-release-diagnostic.png` — full-draw vs release comparison with the string-arm region marked

## Small-scale risk (honest note for review)

The draw-arm pull is deliberately restrained and secondary to the whole-body lean; at board scale the charge-then-snap posture carries the read, and the runtime's procedural arrow will carry most of the attack identity. User review should confirm this restraint is acceptable before approval.

## Validation

`node tools/validate-archer-attack-production-v1.mjs` exits 0: exact approved sources, 10 unique RGBA frames, pinned foot zone byte-equality, byte-identical neutral exit, release-snap cadence, projectileRelease marker alignment, anchor/bounds, provenance, and approval invariants.

## Approval gate

This package awaits a separate exact-file Attack approval decision. Canonical approval and runtime integration remain unauthorized until that decision.
