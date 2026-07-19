# Archer Attack v3.1 — 12-Frame Smoothing Human Review Candidate

**Status**: `READY_FOR_HUMAN_REVIEW` — this is a technical/integration verdict only, **not** user approval.
**Branch**: `cc/archer-attack-v3-1-review-candidate-v1` · **Base**: `cc/archer-attack-v3-pose-guided-handoff-v1` @ `d949bbec0ae61891e9794e28d0c1a3b49b719a56`

## Background

- **Attack v1** (PR #67): rejected, NEAR_STATIC.
- **Attack v2** (PR #72): rejected — root-cause analysis proved the "torn bow" defect frames 002–004 had *no draw motion underneath* (byte-identical to a clean neighbor frame outside the defect region).
- **Attack v3** (this candidate's base, via PR #76's pose-guided handoff spec): 10-frame pose-guided reconstruction, produced by Coco outside this environment, with real limb re-posing (Ready → Nock → Raise → Mid Draw → Deep Draw → Full Draw → Release → Follow-through → Recovery → Neutral exit). **v3 passed internal visual/pose QA before this smoothing pass** per the uploaded package's manifest — that verdict belongs to Coco's own production QA, not to a repository-recorded human PASS in this environment.
- **Attack v3.1** (this PR): adds exactly **two true in-between frames** to smooth the draw progression. It does not regenerate, redesign, or alter any of the original 10 frames.

## What changed vs. v3

- **Original 10 frames: unchanged.** Every one of the 10 original v3 frames that appears in the final 12-frame v3.1 sequence is byte-for-byte identical (SHA-256 verified) to its counterpart in the source package's `frames-v3-original/` directory. No re-encoding, resize, recolor, crop, or metadata rewrite was applied to any of them.
- **Two new frames inserted**: frame **004** (in-between old frames 003→004) and frame **006** (in-between old frames 004→005). Both are confirmed distinct from every other frame in the sequence (no accidental duplicate hashes).
- **Release pose: unchanged binary, unchanged duration.** The frame containing the actual bow release (arrow detached, in flight) is byte-identical to the original v3 release frame and keeps its original 7-centisecond duration. See "Release frame clarification" below — the review candidate's file naming differs slightly from a literal reading of the task brief, and that discrepancy is documented, not silently resolved.
- **Total preview timing: unchanged.** 127 centiseconds, identical between the original v3 preview and the v3.1 preview.

## 10→12 frame mapping (verified byte-for-byte, not asserted)

| v3.1 frame | Source | Role |
|---|---|---|
| 000 | v3 000 (byte-identical) | Ready |
| 001 | v3 001 (byte-identical) | Nock/Raise |
| 002 | v3 002 (byte-identical) | Early draw |
| 003 | v3 003 (byte-identical) | Mid draw |
| **004** | **NEW** | In-between: old 003→004 |
| 005 | v3 004 (byte-identical) | Deep draw |
| **006** | **NEW** | In-between: old 004→005 |
| 007 | v3 005 (byte-identical) | **Full Draw** (arrow still nocked, string at cheek, bow flexed) |
| 008 | v3 006 (byte-identical) | **Release** (arrow detached, in flight, string relaxed) |
| 009 | v3 007 (byte-identical) | Follow-through |
| 010 | v3 008 (byte-identical) | Recovery |
| 011 | v3 009 (byte-identical, = approved Neutral Master) | Neutral exit |

## Release frame clarification

The task brief's timing section states the release pose is "old 005 → new 007." Direct pixel inspection of the source frames shows this is not correct:

- **Old frame 005** (→ new 007): arrow still nocked on the string, string drawn to the cheek, bow fully flexed. This is **Full Draw**, not Release.
- **Old frame 006** (→ new 008): arrow detached from the bow and shown mid-flight, string relaxed/snapped forward, hand in follow-through. This is **Release**.

Three independent signals agree on frame 008 being the true release:
1. Direct visual inspection of both frames.
2. The manifest's own semantic labels (007 = "Full draw", 008 = "Release").
3. Timing: the task's own stated requirement is "Release duration: 7 centiseconds." The measured v3.1 per-frame duration is 7cs at index 8, and 9cs at index 7.

This record uses **frame 008** as the actual visual release frame, per the task's own instruction to record the actual visual frame rather than blindly copy a possibly-mismatched frame number. **No runtime marker was touched** — this is purely a documentation/record-keeping resolution for the review candidate.

## Technical verification (all measured from binaries, not trusted from the manifest)

| Check | Result |
|---|---|
| Source ZIP SHA-256 | `fee685d6202f00955503bda24b8c9952bb1adfe5a71f4b1af39037577993192d` — exact match |
| ZIP integrity | PASS, no CRC errors, no path traversal |
| Approved Neutral Master SHA-256 | `4911e7e3ba59241ee011be3e62f1b64230dcf9b3c24c6aeb23dc939d83311013` — exact match |
| 12/12 frames PNG, RGBA, 640×960 | PASS |
| 12/12 frames fully transparent borders | PASS |
| Foot baseline | Measured **y=854** uniformly across all 12 frames (manifest states 855 — see note below) |
| Old→new mapping | PASS — all 10 original frames confirmed byte-identical to their claimed position; both new frames confirmed unique |
| Frame 011 == Approved Master | PASS |
| Total timing preserved | PASS — 127cs in both v3 and v3.1 |
| Release duration preserved | PASS — 7cs at the actual release frame (index 8) |
| GIF integrity (all 4) | PASS — decode cleanly with expected frame counts (10/12/12/12) |
| `git diff --check` | clean |

### Foot baseline discrepancy (documentation only, not a binary defect)

The uploaded manifest states baseline y=855. Direct pixel measurement of all 12 frames — including frame 011, which is byte-identical to the approved Neutral Master — gives **y=854** uniformly. This matches the already-established repository baseline convention (`footBaselineY: 854` in the Idle package approval, `supportFootBaselineY: 854` in the Move package approval). This is a one-pixel documentation discrepancy in the manifest, not a defect in the frames; measured binary truth is used as authoritative throughout this record.

## Internal package QA (Coco's own report — not a substitute for human visual review)

Per the uploaded manifest: Identity QA PASS, Motion QA PASS, Anatomy QA PASS, Bow QA PASS, Technical QA PASS, Comparative QA PASS. These are Coco's production-side claims, reproduced here for transparency. **They are not automated-metric substitutes for human visual approval**, and are not treated as such anywhere in this record.

## Human review focus

When you review the artifacts below, please look specifically at:

1. **Smoothness across frames 004–007** — does the draw now read as a continuous pull rather than a jump?
2. **Hand–arrow–string continuity** — does the drawing hand stay connected to the string and arrow nock throughout?
3. **Full Draw → Release transition (007→008)** — does the release read as a distinct, sudden event?
4. **Release "snap" energy** — does frame 008 convey force/release, not just a pose change?
5. **Recovery → Neutral (010→011)** — does the return to the approved Neutral Master pose feel continuous, not a pop?
6. **v3 vs v3.1 comparison** — does v3.1 actually look smoother than the original 10-frame v3, or does it just look different?

## Review artifacts (open these, not the raw frame directory, for a fast verdict)

1. **v3 vs v3.1 comparison GIF** — `docs/assets/review/character-production/archer/attack-v3-1/review/archer-attack-v3-vs-v3-1-comparison.gif`
2. **v3.1 12-frame preview GIF** (normal speed, 127cs) — `docs/assets/review/character-production/archer/attack-v3-1/review/archer-attack-v3-1-preview.gif`
3. **v3.1 slow QA GIF** (236cs, for frame-by-frame inspection) — `docs/assets/review/character-production/archer/attack-v3-1/review/archer-attack-v3-1-preview-slow-qa.gif`
4. **Contact sheet** (all 12 frames at once) — `docs/assets/review/character-production/archer/attack-v3-1/review/archer-attack-v3-1-contact-sheet.png`
5. **Original v3 preview GIF** (for reference/comparison) — `docs/assets/review/character-production/archer/attack-v3-1/review/archer-attack-v3-original-preview.gif`
6. **Exact 12-frame directory** — `docs/assets/review/character-production/archer/attack-v3-1/frames/`

## Approval status (honest, as of this import)

| Flag | Value |
|---|---|
| `sourceVerified` | `true` |
| `technicalIntegrityPass` | `true` |
| `internalPackageQaReported` | `true` |
| `humanVisualApproval` | **`false`** |
| `attackV3_1PackageApproved` | **`false`** |
| `animationQualityBenchmarkV1Approved` | **`false`** |
| `canonicalApproved` | **`false`** |
| `runtimeEligible` | **`false`** |
| `runtimeIntegrated` | **`false`** |
| `status` | `READY_FOR_HUMAN_REVIEW` |

`READY_FOR_HUMAN_REVIEW` describes that the technical/integration work is done and the candidate is safe to look at — it is **not** a stand-in for your verdict, and no agent has self-approved this package.

## Scope of this PR

- No image was created, edited, or regenerated.
- No Archer identity, costume, or bow design was changed.
- Approved Neutral Master, Idle, Move packages: unchanged.
- Attack v1/v2 evidence: unchanged.
- Original v3 source package: unchanged (this PR only adds the v3.1 candidate; it does not modify v3).
- `src/`, Core Runtime, Combat, projectile behavior, marker runtime, Game Loop, camera/board/grid/pathfinding: **not touched**.
- Combat x4 testing: **NOT APPLICABLE** — no runtime change was made.
- No PR merged.
