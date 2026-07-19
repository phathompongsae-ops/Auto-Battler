# Archer Attack v3.2 — Exact-Package Approval Record

**This is an additive approval overlay.** It does not modify, replace, or supersede any file in PR #79. It references the exact candidate by SHA and records that explicit human visual approval was given.

## Approval evidence

- **User verdict**: "โอเครละ" (informal Thai — "okay, that's good / good to go")
- **Context**: given after Coco delivered the Archer Attack v3.2 package in `READY_FOR_HUMAN_REVIEW` status (PR #79). The user confirmed the visual result looked acceptable. The benchmark direction discussed alongside the verdict emphasized "looks smooth at normal speed" as the operative standard — **not** a fixed frame-count rule.
- **Independent audit result**: `CC_RETURN_VERIFIED`
- **Independent audit recommendation**: `READY FOR EXACT-PACKAGE APPROVAL RECORD`
- **Approval timestamp**: 2026-07-19T14:45:22Z

## Exact candidate approved

| | |
|---|---|
| Repository | `phathompongsae-ops/Auto-Battler` |
| PR | [#79](https://github.com/phathompongsae-ops/Auto-Battler/pull/79) |
| Branch | `cc/archer-attack-v3-2-review-candidate-v1` |
| Exact candidate HEAD | `ddd0b655f867d0b01106a9e1d274234e1e9b71e9` |
| Base branch | `cc/archer-attack-v3-pose-guided-handoff-v1` |
| Exact base SHA | `d949bbec0ae61891e9794e28d0c1a3b49b719a56` |
| GitHub state at approval | open, draft, unmerged (re-verified live) |

## Exact package

| | |
|---|---|
| Source ZIP | `archer_attack_v3_2_targeted_inbetween_rework_human_review_package.zip` |
| Source ZIP SHA-256 | `bf3653d72c9a5b3eec8b8a24224dcff098527dae194fbbafd3ec69c15072fc3e` |
| Approved Neutral Master SHA-256 | `4911e7e3ba59241ee011be3e62f1b64230dcf9b3c24c6aeb23dc939d83311013` |

## Re-verification performed before this record was created

All of the following were re-measured from the exact worktree at commit `ddd0b655f867d0b01106a9e1d274234e1e9b71e9` — not assumed from PR #79's description:

- Approved Neutral Master hash: exact match
- 12/12 frames present, all hashes re-hashed and confirmed against expectation
- Frame 004 hash `69af0c50...` — exact match
- Frame 006 hash `7a63d3f0...` — exact match
- Frame 011 hash — byte-identical to Approved Master
- Original 10-frame mapping — 10/10 confirmed via the candidate's own record and re-derived hashes
- Frame 007 = Full Draw, Frame 008 = Release — consistent with prior independent pixel inspection (PR #78/#79)
- Total timing = 127cs, Release duration = 7cs — confirmed
- PR #79's own validator (`tools/validate-archer-attack-v3-2-review-candidate-v1.mjs`) re-run: **exit 0**

## Approved 12-frame hash table

| Frame | SHA-256 | Role |
|---:|---|---|
| 000 | `6cbaf2ee52334539355837e294126c429edf4f65355581f8a1cc596c54e704ef` | Ready |
| 001 | `b937db7fd7eb3ae8e4d40fa05e4b98e375f39ac4a210973bbaea1cf06d251051` | Nock/Raise |
| 002 | `67c3a401c4845ce2dc85153b215bcdbd4f31d3a8a7c00ddb86ecaed74c1ae487` | Early draw |
| 003 | `cfdf8b7256597e1c303402e0bbf416fcff44df28a5f96338329971e441059ebc` | Mid draw |
| **004** | `69af0c5088492db38fc81a365e1295264057ffe62f1141f173b86d815da5b277` | **Reworked in-between** (003→004) |
| 005 | `c59180e3109ad93b07b64d95b0d1c81aca2bd7055cfdac838f8010e614a7249f` | Deep draw |
| **006** | `7a63d3f0b357e7559c84c75650baa75c1865c8ced75a6abe618d1893d42e2787` | **Reworked in-between** (004→005) |
| 007 | `c4e9214835d7881adff48786e4a19c59464f6292947c25aa125e4f7256727c0b` | **Full Draw** |
| 008 | `a7906c0fb0ad1fb19e51162680f35c697cc45bda4519c4d40fbce1e506a1f659` | **Release** (7cs) |
| 009 | `2922bbd79dcec9f070a6b144b056287ba11d87feb4fb708589dfb362c5cc874e` | Follow-through |
| 010 | `fe7e873572a220c4f05f26ae8248dacd9c8630b8b556345d619d0df22bb8cd36` | Recovery |
| 011 | `4911e7e3ba59241ee011be3e62f1b64230dcf9b3c24c6aeb23dc939d83311013` | Neutral exit (= Approved Master) |

Only frames **004** and **006** are inserted/reworked. All other 10 are byte-identical to the original v3 sequence.

## What was approved (and what was not)

**Approved:**
- The exact visual package v3.2 as delivered in PR #79
- The final 12-frame sequence specific to this package
- The motion-smoothing quality of v3.2 (frames 004 and 006 specifically)
- Identity, anatomy, and bow/arrow/string continuity of this package
- The exact hashes and timing recorded in PR #79 and reproduced above

**Not approved:**
- Merging PR #79 or any PR
- Runtime integration
- Canonical runtime promotion
- Any change to Core Logic
- A rule that every animation must use 12 frames
- A rule that every animation must use the same frame count
- A rule that every action must add exactly 2 in-between frames
- A rule that every animation must reuse Archer's specific timing values

## Animation Quality Benchmark v1

This approval also activates **Animation Quality Benchmark v1** as a quality standard for future animation review. The benchmark is a **standard of quality**, not a fixed template:

**The benchmark covers:**
- Looks smooth at normal playback speed
- True motion progression (not a mesh-warp/scale-collapse substitute for motion)
- Frame spacing appropriate to the motion being depicted
- Character identity consistency across all frames
- Anatomy continuity (hands, limbs, no missing/extra parts)
- Weapon/prop continuity (bow/arrow/string for Archer specifically)
- Baseline/foot stability across frames
- Timing and release-beat preservation where a release/impact event exists
- Technical QA and comparative review against the prior candidate

**The benchmark explicitly does NOT mandate:**
- Every animation must have exactly 12 frames
- Every character/animation must use the same frame count as another
- Every action must add exactly 2 in-between frames
- Every animation must reuse Archer's specific per-frame timing values
- Frames must be added even when the existing animation already reads as smooth

**Guiding principle**: use as many frames as are actually needed for the motion to read as smooth while preserving the weight of the action — no more, no fewer. Frame count and timing are motion-driven decisions per animation, not a fixed template.

Benchmark activation authorizes this as a *quality standard* going forward. It does **not** itself approve any other character's animation — each candidate still requires its own exact-package approval record.

## Known findings recorded honestly (neither hidden nor "fixed")

### Frame 004: 16-bit RGBA PNG (non-blocking format anomaly)

Frame 004 (`69af0c50...`) is encoded as 16-bit-per-channel RGBA PNG. Every other frame in this package — and every frame across the entire approved Archer pipeline (Neutral Master, Idle, Move, Attack v2/v3/v3.1) — is 8-bit RGBA.

- Hash confirmed matches the exact approved package.
- Decode/display/review/PR #79's validator all PASS.
- **Independent audit classification**: `NON_BLOCKING_FORMAT_ANOMALY`
- **No re-encoding or modification was performed** in this approval task.
- `approvalBlocker = false` — this finding does not invalidate the exact-visual approval above.
- `runtimeCompatibilityFollowUpRequired = true` — before any Runtime Integration, the target asset decoder/toolchain must be independently verified to correctly support 16-bit-per-channel RGBA PNG.
- `runtimeIntegrationBlockedUntilCompatibilityCheck = true`

### `git diff --check` on PR #79 (whitespace observation, not binary drift)

Independent re-verification found that `git diff --check`, run between PR #79's parent commit and its head, scoped to `docs/reviews/archer-attack-v3-2-technical-qa-report.md`, exits **2** with `new blank line at EOF`. This was reproduced directly:

```
git diff --check ddd0b655f867d0b01106a9e1d274234e1e9b71e9^ ddd0b655f867d0b01106a9e1d274234e1e9b71e9 -- docs/reviews/archer-attack-v3-2-technical-qa-report.md
→ docs/reviews/archer-attack-v3-2-technical-qa-report.md:52: new blank line at EOF.
→ exit 2
```

The file was independently confirmed **byte-identical** to the copy originally extracted from the approved source ZIP (SHA-256 and `cmp` both match) — this is not drift or accidental modification, it is exactly how the file was authored.

**Correction to the record**: PR #79's own description states `git diff --check: clean`. That statement does not hold when checked against the file's introducing commit, as shown above. This does not change any conclusion of this approval — the file's content is confirmed unmodified and correct — but the record is corrected here rather than repeating the inaccurate claim.

The file was **not modified** in this approval task, because doing so would change the exact-approved PR #79 candidate snapshot that this record certifies.

## Approval flags

| Flag | Value |
|---|---|
| `humanVisualApproval` | **`true`** |
| `attackV3_2PackageApproved` | **`true`** |
| `exactPackageApproved` | **`true`** |
| `animationQualityBenchmarkV1Approved` | **`true`** |
| `benchmarkActivationAuthorized` | **`true`** |
| `canonicalApproved` | `false` |
| `runtimeEligible` | `false` |
| `runtimeIntegrated` | `false` |
| `runtimeIntegrationAuthorized` | `false` |
| `merged` | `false` |

## Scope of this record

- No PNG/GIF/contact sheet was modified. No frame — including frame 004 — was re-encoded.
- PR #79's candidate files were not touched.
- PR #78 was not touched (preserved as rejected-candidate historical evidence).
- Neutral Master, Idle, Move, Attack v1/v2/v3/v3.1 binaries: unchanged.
- `src/`, Runtime, Combat, projectile, marker, Game Loop, camera/board/grid/pathfinding: unchanged.
- No PR merged, no auto-merge set.
- No runtime integration started.
- No other character's asset production started.

## Next authorized gate

**PRE-RUNTIME 16-BIT PNG COMPATIBILITY CHECK**

This gate is not started by this record. Before any Runtime Integration work on this package begins, the target asset decoder/toolchain must be independently verified to correctly support 16-bit-per-channel RGBA PNG (specifically for frame 004).
