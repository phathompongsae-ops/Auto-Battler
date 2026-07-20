# Class 1 Motion Production Batch 2 — Caster Family — Exact Package Approval

**Status: CLASS1_MOTION_BATCH2_CASTER_EXACT_PACKAGE_APPROVED**

This record documents the byte-for-byte import, independent technical verification, and the
user's explicit **Human Visual Approval** of the Class 1 Motion Production Batch 2 (Caster
Family: Mage, Summoner, Acolyte) human-review package. Runtime Integration, canonical asset
promotion, Board Preview, and Runtime synchronization remain separate, later, user-authorized
gates and are **not** authorized by this record.

## Human Visual Approval (user decision)

The user reviewed the Human Review Candidate package and explicitly stated:

> ผมโอเคแล้ว
> (Thai: "I'm OK now" / "I've approved now")

This is recorded as explicit **Human Visual Approval** for the complete reviewed motion set:

- **Characters**: Mage, Summoner, Acolyte
- **Approved actions**: Neutral reference, Idle, Move, Basic Attack
- **Approved object**: the exact package identified by ZIP SHA-256
  `2a7e074388f0ce93f9182a841d91ff45477af6ed6c52015bee1a29531d7016af`
  (`class_1_motion_production_batch_2_caster_family_v1_human_review_package_FINAL.zip`)
- **Record updated (UTC)**: `2026-07-20T11:25:28Z` — this is the record creation/update time for
  this approval entry, not a claimed timestamp of the user's original spoken decision.

This approval is **Human Visual Approved**, **Motion Production Approved**, and **Exact Package
Approved** only. It does **not** extend to: Runtime Integration, Runtime synchronization, Combat
timing behavior, attack-speed handling, Skill/Cast, Hit, Death, Victory, Fusion, Class 2, Secret
Class, Survival, 3-star motion, Board Preview, projectile, VFX, gameplay, or balance. The package
is **Exact Package Approved for motion production records only** — it is explicitly **not**
described as "Runtime-ready," and **Runtime Integration Not Authorized**.

## Package handoff (measured, not trusted)

The task's originally reported hashes (a mid-production report and an earlier downloaded
package) are explicitly **obsolete** and were not used as expected values, per this task's own
instructions. The rebuilt package's independently measured facts are authoritative:

| | |
|---|---|
| Delivery | 14-part split upload; no manifest accompanied this specific upload (only unrelated earlier packages' manifests were present in the session) |
| Part verification | 14/14 parts present, indexes 1–14 contiguous, no gaps/duplicates/zero-byte parts |
| Reassembled filename | `class_1_motion_production_batch_2_caster_family_v1_human_review_package_FINAL.zip` |
| Measured SHA-256 | `2a7e074388f0ce93f9182a841d91ff45477af6ed6c52015bee1a29531d7016af` |
| Measured size | 42,013,790 bytes |
| Measured ZIP entries | 134 |
| CRC | PASS (`unzip -t`, no errors) |
| Path traversal / absolute paths / symlinks | none |
| Duplicate paths / case-collision paths | none |
| Hidden OS / temp files / repo metadata | none |
| Outer wrapper | one level (`class-1-motion-batch-2-caster-human-review-candidate-v1/`), stripped on import to match PR #86's no-wrapper structure |

The ZIP itself, split parts, and reassembly scratch files are not committed — same convention as
every prior package in this pipeline.

## Neutral Master lineage (measured)

All three Neutral Masters re-hashed and confirmed **byte-identical** to the exact-approved PR #83
candidates:

| Class | SHA-256 |
|---|---|
| Mage | `6587abdf0b4427ed9c95acb98a6d7c618e8be653fb13cdcaa9be1472fcb96315` |
| Summoner | `731531aaa1d3efc462a12d2265ad602e6e4711a83f054d8f84b5bb00f3956ae3` |
| Acolyte | `0853ab6d8f91e4100732c7f3628b31a09a38a762dc999dfbecef3cc23804a9c8` |

PR #83, #84, and #86 were checked live/read-only for lineage reference only and were **not**
modified.

## Motion inventory (no fixed frame count assumed — derived from sidecars)

66 total animated motion frames (not the scaffold's obsolete 72/24-per-character assumption).
Idle is 6 frames for all three casters; Move and Attack are 8 frames. Every frame directory was
checked against its own sidecar for completeness (no missing frame, no unexpected frame).

| Class | Idle | Move | Attack | Release frame | Release timestamp |
|---|---|---|---|---|---|
| Mage | 6f / 100cs | 8f / 88cs | 8f / 89cs | 004 | 38cs |
| Summoner | 6f / 96cs | 8f / 80cs | 8f / 83cs | 004 | 35cs |
| Acolyte | 6f / 108cs | 8f / 88cs | 8f / 86cs | 004 | 37cs |

### Basic Attack timing breakdown (independently verified)

| Class | Anticipation | Release | Follow-through | Recovery | Total |
|---|---|---|---|---|---|
| Mage | 38cs | 6cs | 23cs | 22cs | 89cs |
| Summoner | 35cs | 6cs | 22cs | 20cs | 83cs |
| Acolyte | 37cs | 6cs | 23cs | 20cs | 86cs |

For every character: the release marker's `frameIndex`/`frameFile` exists, its `timestampCentiseconds`
equals the exact sum of the preceding frames' durations, the phase breakdown reconciles exactly
with the total duration, and the action is non-looping. All match the task's reported handoff
values exactly.

## Independent verification performed

- **PNG decode**: manual IHDR/IDAT parse + zlib inflate + Paeth unfiltering, re-run against all
  66 motion frames + 3 Neutral Masters. All 640×960, 8-bit RGBA, PNG color type 6.
- **Per-frame SHA-256**: freshly computed for all 69 binaries, cross-checked against every
  imported sidecar's declared hash — all match. Zero duplicate hashes across the whole batch.
- **Transparent borders**: 0 opaque border pixels on all 66 frames.
- **Baseline**: half-open y=855 (max opaque y=854) on all 66 frames.
- **Frame completeness**: every action's frame directory listing matches its sidecar's ordered-
  frame list exactly (no missing, no extra file).
- **Preview GIF timing**: all 9 normal-speed preview GIFs decoded and compared directly against
  their sidecars — **exact centisecond match, 9/9**.
- **No VFX/projectile/summon/healing content**: confirmed absent from every sidecar and the
  batch contract.
- **Release-frame visual check**: frame 004 of each attack sequence viewed directly for all
  three classes — Mage (staff/gem forward), Summoner (book + summoning-ring forward), Acolyte
  (staff forward) — all clear prop-forward release poses, no baked VFX.
- **Recovery-to-neutral coherence**: attack frame 007 viewed against the Neutral Master for a
  representative class (Mage) — visually coherent return to standing pose.
- **Metadata/source-map path safety**: no absolute local filesystem paths found in any JSON/MD
  file in the package.
- **Human Decision Sheet**: confirmed no verdict preselected — all actions `PENDING`.

No image was modified to make any check pass; every check was run against the binaries exactly
as received.

## Checkpoint byte-comparison — disclosed limitation, not a failure

`CHECKPOINT_BINARY_COMPARISON_NOT_INDEPENDENTLY_REPRODUCIBLE`. The package's own
`data/batch-technical-qa-report-v1.json` and `data/batch-manifest-v1.json` claim 107/107
byte-identical binaries against two prior checkpoint ZIPs (both explicitly obsolete per this
task). Neither prior ZIP is present in this session to independently re-verify against, so this
claim is recorded as the **package's own unverified claim only** — not independently confirmed.
All current-package binary and contract checks pass independently regardless of this limitation.

## Internal production-review findings (Coco's report — not user approval)

| Check | Result |
|---|---|
| Identity consistency | Internal PASS |
| Anatomy consistency | Internal PASS |
| Hand continuity | Internal PASS |
| Prop continuity | Internal PASS |
| Normal-speed readability | Internal PASS |
| Pairwise distinction | Internal PASS |
| Targeted correction rounds | 0 |
| Remaining defects reported | none found |

Preserved as reported because they are supported by the package's own technical-qa records.
**These are internal production-review findings only — not user approval, not independent human
approval.** The user's visual decision remains pending.

## Board Preview / Runtime synchronization — unchanged

- Board Preview: **`DEFERRED_UNTIL_AFTER_DEMO`** (from PR #83/#86, not replaced/regenerated; the
  package's `board-scale-motion-readability-proxy.gif` is a readability proxy only)
- Runtime attack-speed synchronization: **`PENDING_SEPARATE_RUNTIME_INTEGRATION_VALIDATION`**
  (production note only: `likelyFutureRuntimeHandling: full replay` — not an implementation
  decision)

## Approval flags

```
humanVisualApproval: true
motionProductionApproved: true
exactPackageApproved: true
canonicalApproved: false
runtimeIntegrationAuthorized: false
runtimeIntegrated: false
merged: false
```

## Validation (actually run)

- ZIP part completeness/order check (14/14, no gaps/dupes/zero-byte)
- Reassembly + fresh SHA-256/size measurement
- `unzip -t` — CRC PASS
- Python zipfile path-safety scan (traversal/absolute/symlink/duplicate/case-collision/hidden)
- Full independent PNG re-decode + re-hash of all 66 motion frames + 3 Neutral Masters
- Per-action frame-directory-vs-sidecar completeness check
- Duration-sum / loop-flag / release-marker cross-check against sidecars and handoff values
- 9/9 GIF timing decode and comparison
- Absolute-path grep across all JSON/MD
- JSON parse validation on every JSON file
- Human Decision Sheet preselection check
- Visual spot-check of all 3 release frames + 1 recovery-to-neutral frame
- `node tools/validate-class1-motion-batch-2-caster-exact-package-approval-v1.mjs` — exit 0
- `node --check` on the updated validator — pass
- `git diff --check` — clean
- Combat/Runtime x4: **NOT APPLICABLE** — no Runtime or Combat change

## Human Visual Approval and Exact Package Approval (this update)

Before recording approval, the existing PR #87 branch was independently re-confirmed to still
contain the exact already-validated imported package and matching records:

- `git` HEAD/branch/clean-tree check in the PR #87 worktree — unchanged, clean
- Live PR #87 state re-checked — open, Draft, unmerged, `mergeable_state=clean`
- Imported-file count re-counted under the import root — 134/134, unchanged
- All 3 Neutral Masters re-hashed and cross-checked against both this record's own
  `exactNeutralMasters[]` and PR #83's own `data/design/class1-neutral-master-batch-exact-package-approval-v1.json`
  candidates — exact match, no drift
- Full validator re-run before any record edit — all checks passed

No inconsistency was found, so no rebuild/re-import was performed. Only the approval flags,
status, and this record's narrative fields were updated to record the user's explicit Human
Visual Approval (`"ผมโอเคแล้ว"`) and Exact Package Approval. `canonicalApproved`,
`runtimeIntegrationAuthorized`, `runtimeIntegrated`, and `merged` all remain `false` — Runtime
Integration is **not authorized** by this record.

## Scope

Changed paths limited to: this record, the approval JSON, and the validator. The 134 already-
imported package files under the reserved import root were **not** touched in this update (no
inconsistency was found that would require re-import). No other existing repository file
modified. No `src/`, gameplay, Combat, balance, Skill/Cast, projectile, or VFX code touched. No
PR merged, no auto-merge enabled. PR #82, #83, #84, #86 untouched.
