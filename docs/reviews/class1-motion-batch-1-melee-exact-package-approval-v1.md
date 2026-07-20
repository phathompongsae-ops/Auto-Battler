# Class 1 Motion Production Batch 1 — Melee Family — Exact Package Approval

**Status: CLASS1_MOTION_BATCH1_MELEE_EXACT_PACKAGE_APPROVED**

Additive approval overlay recording the user's explicit visual approval of the exact Class 1
Motion Production Batch 1 (Melee Family) package — **Fighter, Swordman, Merchant**, each with
**Idle / Move / Basic Attack**. No motion was generated or regenerated, no PNG/GIF binary was
edited/resized/recolored/recompressed/re-encoded, no Neutral Master was modified, and no Runtime
Integration was started. `src/`, gameplay, and Combat are untouched.

## Human decision (authoritative)

**HUMAN_VISUAL_APPROVED** — Fighter, Swordman, and Merchant, all three approved motions each
(Idle / Move / Basic Attack). The package as shipped records `humanVisualApproval: pending`
throughout its own sidecars and decision sheet; this record is what turns that into `true`.

## Source package (measured, not trusted)

| | |
|---|---|
| File | `class_1_motion_production_batch_1_melee_family_v1_human_review_package.zip` |
| Delivery | 12-part split upload + manifest; parts 009/010 missing on first delivery, re-uploaded and verified before reassembly |
| Expected SHA-256 | `48ad953c0c8fc5e3a6c368a77ffb540ca1dac0a96b6a38d0a944832e1b7c05d2` |
| Measured SHA-256 | **exact match** |
| Size / entries | 34,815,662 bytes · 164 ZIP entries (134 files + 30 directory entries) · CRC PASS · no path traversal |
| Import | all 134 files extracted and imported **byte-for-byte** under `docs/assets/review/character-production/class-1-motion-batch-1-melee-v1/` (file-by-file SHA diff empty) |

The ZIP itself is not committed (same convention as prior Archer/Class-1 packages); the imported
tree is the immutable approved snapshot.

## Neutral Master lineage (measured)

All three Neutral Masters used by this motion package are re-hashed and confirmed
**byte-identical** to the exact-approved candidates from PR #83 (Class 1 Neutral Master Batch v1
Exact Package Approval, head `a7a821045dd7532dd96dfb07dfd352080e588c40`, live-verified before
this task began):

| Class | SHA-256 |
|---|---|
| Fighter | `4b2ec5558971c3730da352f5ba2a39d928bbf5c722d40e38256dd6b4d48a19c4` |
| Swordman | `2a1fc6f93f384fbc92486a8e42975a10bb84d8f9cd35b13b155a9668638861ed` |
| Merchant | `053785f1283a02c49897445edf038e3f95b30cb2733b81c206f648e986b157d3` |

PR #83 was **not** modified. PR #82 and #84 (Archer Pilot lineage) were checked live as
quality-pipeline reference only and were **not** modified.

## Approved motions (all values re-measured from binaries, not copied from claims)

72 total motion frames (24 per character), all PNG · 8-bit RGBA · 640×960 · fully transparent
borders · half-open foot baseline y=855 · zero duplicate frame hashes within any sequence.

| Class | Action | Frames | Total (cs) | Loop | Impact frame |
|---|---|---|---|---|---|
| Fighter | Idle | 8 | 104 | true | — |
| Fighter | Move | 8 | 80 | true | — |
| Fighter | Attack | 8 | 72 | false | index 4 (31cs from start) |
| Swordman | Idle | 8 | 104 | true | — |
| Swordman | Move | 8 | 72 | true | — |
| Swordman | Attack | 8 | 64 | false | index 4 (26cs from start) |
| Merchant | Idle | 8 | 120 | true | — |
| Merchant | Move | 8 | 88 | true | — |
| Merchant | Attack | 8 | 74 | false | index 4 (33cs from start) |

Every duration sum matches its sidecar's declared total, and every total matches the expected
summary given for this task — independently re-summed, not copied.

## Independent verification performed

- **PNG decode**: manual IHDR/IDAT parse + zlib inflate + Paeth unfiltering, re-run against all
  72 motion frames + 3 Neutral Masters. All decode cleanly; all 640×960, 8-bit RGBA, PNG color
  type 6.
- **Per-frame SHA-256**: freshly computed for all 75 binaries, cross-checked against every
  imported sidecar's `perFrameSha256` array — all match.
- **Transparent borders**: 0 opaque border pixels on all 72 frames.
- **Baseline**: half-open y=855 (max opaque y=854) on all 72 frames.
- **Duplicate-hash check**: no duplicate frame hash within any of the 9 sequences.
- **Preview GIF timing**: all 9 normal-speed preview GIFs decoded and their per-frame delays
  compared directly against the corresponding sidecar's `perFrameDurationCentiseconds` — **exact
  centisecond match, 9/9**.
- **Impact-frame visual check**: frame 004 of each attack sequence viewed directly for all three
  classes — Fighter (gauntlet punch, fist at full extension), Swordman (sword slash, blade at
  full reach), Merchant (axe chop, blade at full downswing) — all clearly show a weapon/limb-
  forward strike-contact pose, consistent with the declared impact marker.
- **Recovery-to-neutral coherence**: attack frame 007 (final recovery frame) viewed against the
  Neutral Master for a representative class (Fighter) — visually coherent return to the guarded
  neutral stance.
- **Package's own internal QA** (`data/technical-qa-report-v1.json`, `docs/technical-qa-report-v1.md`
  inside the imported tree): independently cross-checked, not just copied — its own claimed
  72/72 pass results match what this task's own re-derivation found.

No image was modified to make any check pass; every check was run against the binaries exactly
as received.

## Board Preview — unchanged

**`DEFERRED_UNTIL_AFTER_DEMO`** — recorded on PR #83, not replaced, not regenerated, not
revisited. This package contains no board-preview asset of its own.

## Runtime attack-speed synchronization — unchanged

**`PENDING_SEPARATE_RUNTIME_INTEGRATION_VALIDATION`** — the package's own
`timing-summary-v1.json` records `designRateDivergenceRecorded: true`, i.e. the production team
already flagged that these design-time attack durations were authored independently of any
specific runtime `attack_speed` value and will need dedicated runtime-integration validation
(as was required for Archer) before being trusted against Combat's actual attack cadence. Not
evaluated or resolved by this task — no Runtime or Combat code was touched.

## Approval flags

```
humanVisualApproval: true
motionProductionApproved: true
exactPackageApproved: true
canonicalApproved: false
runtimeIntegrationAuthorized: false
runtimeIntegrated: false
finalRuntimeApproved: false
merged: false
```

Approval covers the exact package binaries listed above — nothing more. Canonical promotion and
Runtime Integration each remain separate, explicitly user-authorized gates.

## Validation (actually run)

- `node tools/validate-class1-motion-batch-1-melee-exact-package-approval-v1.mjs` — exit 0
  (ZIP-record consistency; 3 Neutral Master re-hashes; 72 per-frame re-hash + decode +
  transparency + baseline + dimensions/RGBA/bit-depth; frame counts; per-frame timings; total
  durations; loop flags; impact markers; roster completeness; approval flags; Board Preview
  deferred record; Runtime-sync pending record; changed-path allowlist)
- `node --check` on the new validator — pass
- `git diff --check` on the commit — clean
- Combat x4: **not applicable** — no Runtime or Combat code changed by this task; not run

## Scope

New files only: the byte-for-byte package import (134 files), this record, the approval JSON,
and the validator. No existing repository file modified. No PR merged. PR #82, #83, #84 untouched.
