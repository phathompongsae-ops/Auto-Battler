# Skeleton Neutral Master — Exact Package Approval (Scaffold)

**Status: PENDING_PACKAGE_DELIVERY**

This is a **production scaffold only**. Nothing has been delivered, verified, or approved:

- **No package has been delivered to CC.** The Skeleton Neutral Master Human Review Candidate v1
  was produced offline (by Coco), and its downloadable files are being redelivered separately.
- **Reported hashes are NOT yet independently verified.** The candidate PNG SHA-256
  (`a4b431f9…`), Human Review ZIP SHA-256 (`e4d7dcc2…`), reported size (2,112,240 bytes), and
  reported entry count (28) are unverified production-handoff references only.
- **No image has been imported.** The reserved import root
  (`docs/assets/review/monster-production/skeleton-neutral-master-v1/`) contains only a README.
- **No Human Approval has been recorded.** All decision fields below are pending.
- **Skeleton Motion is not authorized.**
- **Monster Runtime Integration is not authorized.**

## Identity reference (measured this task — identity evidence only)

`assets/mon_skeleton.png` re-hashed independently:
`6484dd238083f6209732359b3f1b37d311fbc6644bd50e18ab079c20d8c76d1c` — exact match to the reported
reference. Repo records (read-only) confirm the identity: monster ID `skeleton`, display name
Skeleton, normal melee enemy (range 1), default nearest targeting, early-demo waves, humanoid
undead with a simple blunt club/mallet prop cue — not elite, not miniboss, not boss, not ranged,
not a caster. This procedural placeholder is **not** an approved Neutral Master.

## Expected future package (documented contract — none of it exists in-repo yet)

Candidate PNG + identity reference record, identity-lock sheet, full-resolution review,
board-scale proxy, warm-board readability review, silhouette comparison, grayscale comparison,
anatomy/prop QA sheet, transparent-edge QA, source map, technical QA record, candidate metadata
sidecar, known limitations, production notes, and a Human Decision Sheet (which must ship with no
preselected verdict).

Expected candidate technical profile: PNG, RGBA, 8-bit, 640×960, transparent background, fully
transparent outer borders, no background, no shadow plate, no baked VFX, no cropping. Expected
reported metadata (unverified): alpha bounds 445×672 +97+183, max alpha Y 854, half-open baseline
Y 855, anchor candidate [0.5, 0.92], runtimeFlipX-compatible, recommended scale ≈0.92 of Class 1
hero alpha height, 1 correction round.

## Expected future verification procedure

Same discipline as the Class 1 pipeline: fresh ZIP SHA-256/size/entry-count/CRC measurement, path
safety scan, byte-for-byte import with post-copy re-hash, independent PNG re-decode
(dimensions/RGBA/bit depth/alpha bounds/transparent borders/baseline), sidecar/QA cross-check
against measured binaries, identity reference re-hash, decision-sheet preselection check, and the
validator run — never trusting the package's own claims.

## Human Decision Sheet (all pending — nothing preselected)

- [ ] Skeleton identity acceptable — **pending**
- [ ] Ordinary normal-monster role readable — **pending**
- [ ] Anatomy acceptable — **pending**
- [ ] Skull/ribcage/pelvis continuity acceptable — **pending**
- [ ] Hands/feet acceptable — **pending**
- [ ] Prop acceptable — **pending**
- [ ] Board-scale readability acceptable — **pending**
- [ ] Warm-board contrast acceptable — **pending**
- [ ] Silhouette distinction acceptable — **pending**
- [ ] Production quality acceptable — **pending**
- [ ] Approved as Skeleton Neutral Master — **pending**
- [ ] Authorize Skeleton Motion Pilot — **pending**

## Scope

This scaffold created only: the reserved import-root README, the approval-record JSON, this
document, and the validator. No `src/**`, gameplay/stage data, monster Runtime definition,
board/camera/UI file, PR #88/#89 record, existing monster binary, or Class 1 asset was touched.
No PR merged, no auto-merge enabled.
