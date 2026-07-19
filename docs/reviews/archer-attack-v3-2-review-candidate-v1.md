# Archer Attack v3.2 — Targeted In-Between Rework Human Review Candidate

**Status**: `READY_FOR_HUMAN_REVIEW` — this is a technical/integration verdict only, **not** user approval.
**Branch**: `cc/archer-attack-v3-2-review-candidate-v1` · **Base**: `cc/archer-attack-v3-pose-guided-handoff-v1` @ `d949bbec0ae61891e9794e28d0c1a3b49b719a56`

## Background

- **Attack v1** (PR #67), **Attack v2** (PR #72): rejected.
- **Attack v3** (PR #76 handoff spec): 10-frame pose-guided reconstruction.
- **Attack v3.1** (PR #78): added two true in-between frames (004, 006) to smooth the draw. The package delivered here packages v3.1's frame 004 as `frames-v3-1-rejected/` and documents a measurable scale/silhouette collapse in it (alpha width 517px vs. neighbor frames' 534px/542px) — a real, reproducible defect, not a subjective read.
- **Attack v3.2** (this candidate): a **targeted rework of exactly two frames** — 004 and 006 — leaving all 10 original v3 frames untouched.

No explicit PASS/FAIL verdict on PR #78 was recorded in this conversation prior to this package arriving. The package's own framing (`frames-v3-1-rejected/`) is reported here factually, as delivered, and is not being treated as a repository-recorded human decision on PR #78 by this import.

## What changed vs. v3.1

- **Original 10 frames: still unchanged.** Verified byte-for-byte identical to `frames-v3-original/` (the same reference used for PR #78).
- **Frame 004 reworked**: the rejected v3.1 in-between's subject was alpha-trimmed, resized to 528×772, and repositioned to +68,+83 on the unchanged 640×960 canvas. This is a targeted geometric correction of the same intermediate pose (not a new pose, not a crossfade). Independently re-measured: alpha bounds now exactly `528×772+68+83`, matching neighbor frames 003 and 005 in scale.
- **Frame 006 rebuilt**: bidirectional motion-compensated interpolation (FFmpeg `minterpolate`, MCI/AOBMC) between the exact original v3 frames 004 and 005, with a mild RGB-only unsharp pass. Confirmed as genuinely new, unique content — not byte-identical to the rejected v3.1 frame 006, nor to anything else in the set.
- **Release pose, timing, recovery, neutral exit: unchanged.** Same 127cs total, same 7cs release duration at frame index 8, same byte-identical frame 011 = Approved Master.

## 10→12 mapping (verified byte-for-byte)

| v3.2 frame | Source | Role |
|---|---|---|
| 000–003 | v3 000–003, byte-identical | Ready → Mid draw |
| **004** | **REWORKED** (from rejected v3.1 004, geometry-corrected) | In-between: old 003→004 |
| 005 | v3 004, byte-identical | Deep draw |
| **006** | **REWORKED** (new motion-compensated interpolation) | In-between: old 004→005 |
| 007 | v3 005, byte-identical | Full Draw |
| 008 | v3 006, byte-identical | **Release** |
| 009–010 | v3 007–008, byte-identical | Follow-through, Recovery |
| 011 | v3 009, byte-identical (= Approved Master) | Neutral exit |

Unlike PR #78, this package's own manifest and QA report already correctly label frame 007 as Full Draw and frame 008 as Release — no frame-numbering correction was needed this time.

## Technical verification (measured from binaries, not trusted from the manifest)

| Check | Result |
|---|---|
| Split-package part hashes (4/4) | PASS — exact match to `archer_v3_2_split_manifest.json` |
| Reassembled ZIP SHA-256 | `bf3653d72c9a5b3eec8b8a24224dcff098527dae194fbbafd3ec69c15072fc3e` — exact match |
| ZIP integrity | PASS, no CRC errors, no path traversal (50 relative entries) |
| Approved Neutral Master SHA-256 | `4911e7e3ba59241ee011be3e62f1b64230dcf9b3c24c6aeb23dc939d83311013` — exact match |
| 12/12 frames PNG, RGBA, 640×960 | PASS |
| 12/12 frames fully transparent borders | PASS |
| Foot baseline | Measured **y=854** uniformly (manifest says 855 — same one-pixel documentation convention already noted for v3.1) |
| Old→new mapping | PASS — all 10 original frames byte-identical to their claimed position |
| Reworked frames distinct from rejected v3.1 | PASS — frame 004 ≠ rejected 004, frame 006 ≠ rejected 006 |
| Frame 004 scale-collapse regression check | PASS — width now within neighbor range (528px vs. 534/542px parents) |
| Frame 011 == Approved Master | PASS |
| Total timing preserved | PASS — 127cs, same as v3 and v3.1 |
| Release duration preserved | PASS — 7cs at frame index 8 |
| GIF integrity (3 files) | PASS — decode cleanly with expected 12/12/12 frame counts |
| `git diff --check` | clean |

### ⚠ Known issue: frame 004 bit-depth anomaly (non-blocking, not hidden)

Frame 004 is encoded as **16-bit-per-channel RGBA PNG**. Every other frame in this set — and every frame across the entire approved Archer pipeline (Neutral Master, Idle, Move, Attack v2, v3, v3.1) — is **8-bit RGBA**. This was very likely introduced by the tool used for the alpha-trim/resize/composite rework defaulting to 16-bit output.

This is **not being treated as a defect requiring the binary to be fixed**: the pixel content itself was independently re-measured directly from the raw 16-bit data, and the alpha bounds (`528×772+68+83`) exactly match both the manifest's claim and the expected geometry relative to neighboring frames. Only the encoding precision differs — the artwork itself is correct.

**No binary was re-encoded, resized, or modified in any way to "fix" this.** It is flagged here, in the JSON record, and in the validator's console output (which still exits 0) purely for your awareness. If this candidate proceeds toward canonical/runtime status, normalizing frame 004 to 8-bit RGBA should be tracked as a follow-up — that normalization is explicitly out of scope for this import task.

### Foot baseline discrepancy (same pattern as v3.1, documentation only)

Manifest claims y=855; measured value is uniformly y=854 across all 12 frames, matching the repository's established convention (`footBaselineY: 854` in Idle, `supportFootBaselineY: 854` in Move). One-pixel documentation convention difference, not a binary defect.

## Internal package QA (Coco's own report — not a substitute for human visual review)

Reproduced verbatim at `docs/reviews/archer-attack-v3-2-technical-qa-report.md` / `.json`. Includes normalized ImageMagick RMSE analysis for both reworked transitions (003→004→005 and 005→006→007), each measuring below its unsmoothed parent transition. **This RMSE analysis was not independently re-computed in this environment** (no ImageMagick RMSE tooling available here) — it is reproduced as a package claim, clearly labeled as such, not as this repository's own automated verdict.

## Human review focus

1. **Frame 004 specifically** — does the geometry correction read as a natural pose, with no visible scale pop relative to 003/005?
2. **Frame 006 specifically** — does the motion-interpolated frame look like a genuine intermediate pose, or does it show any interpolation artifacts (ghosting, blur, warping)?
3. **v3.1 vs v3.2 comparison** (via the 3-way GIF) — is v3.2's draw progression actually smoother/more correct than v3.1's, particularly around 004 and 006?
4. **Full Draw → Release (007→008)** — still reads as a distinct, sudden event?
5. **Recovery → Neutral (010→011)** — still continuous, no pop?
6. Transition diagnostics (003-004-005 and 005-006-007) — provided as dedicated close-up images for frame-by-frame inspection of exactly the reworked regions.

## Review artifacts (open these, not the raw frame directory, for a fast verdict)

1. **3-way comparison GIF** (v3 vs v3.1 vs v3.2) — `docs/assets/review/character-production/archer/attack-v3-2/review/archer-attack-v3-vs-v3-1-vs-v3-2-comparison.gif`
2. **v3.2 12-frame preview GIF** (normal speed, 127cs) — `docs/assets/review/character-production/archer/attack-v3-2/review/archer-attack-v3-2-preview.gif`
3. **v3.2 slow QA GIF** (254cs) — `docs/assets/review/character-production/archer/attack-v3-2/review/archer-attack-v3-2-preview-slow-qa.gif`
4. **Contact sheet** (all 12 frames) — `docs/assets/review/character-production/archer/attack-v3-2/review/archer-attack-v3-2-contact-sheet.png`
5. **Focused draw contact sheet** (draw-phase close-up) — `docs/assets/review/character-production/archer/attack-v3-2/review/archer-attack-v3-2-focused-draw-contact-sheet.png`
6. **Transition diagnostics** — `docs/assets/review/character-production/archer/attack-v3-2/review/transition-diagnostics/` (003-004-005, 005-006-007)
7. **Exact 12-frame directory** — `docs/assets/review/character-production/archer/attack-v3-2/frames/`

For a v3.1-only reference GIF, see PR #78's artifacts at `docs/assets/review/character-production/archer/attack-v3-1/review/` (not duplicated here).

## Approval status (honest, as of this import)

| Flag | Value |
|---|---|
| `sourceVerified` | `true` |
| `technicalIntegrityPass` | `true` |
| `internalPackageQaReported` | `true` |
| `humanVisualApproval` | **`false`** |
| `attackV3_2PackageApproved` | **`false`** |
| `animationQualityBenchmarkV1Approved` | **`false`** |
| `benchmarkActivationAuthorized` | **`false`** |
| `canonicalApproved` | **`false`** |
| `runtimeEligible` | **`false`** |
| `runtimeIntegrated` | **`false`** |
| `status` | `READY_FOR_HUMAN_REVIEW` |

## Scope of this PR

- No image was created, edited, or regenerated by this import task — frames 004/006 were produced by Coco outside this environment and imported byte-for-byte.
- No Archer identity, costume, or bow design was changed.
- Approved Neutral Master, Idle, Move packages: unchanged.
- Attack v1/v2/v3/v3.1 evidence: unchanged (v3.1's rejected frames are reproduced read-only for provenance; PR #78 itself is untouched).
- `src/`, Core Runtime, Combat, projectile behavior, marker runtime, Game Loop, camera/board/grid/pathfinding: **not touched**.
- Combat x4 testing: **NOT APPLICABLE** — no runtime change.
- No PR merged.
