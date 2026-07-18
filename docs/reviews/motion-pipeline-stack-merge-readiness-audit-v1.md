# Motion Pipeline Stack & Merge Readiness Audit v1

Integration/test gate only. This audit does not merge, rebase, cherry-pick, or modify any
existing branch, PR, artwork, sidecar, validator, or runtime file. It reads Git history and
repository state and reports findings. **Nothing was merged by this work.**

## Executive Summary

**READY WITH CONDITIONS.**

The CC motion-integration stack — Asset & Animation Framework Runtime (PR #23) → Map Theme
Runtime (PR #25) → Pilot Motion Test Harness (PR #29, verbatim-copies the PR #28 contract) →
Archer Attack visual fix v2 (PR #31) → Slime Move (PR #32) → Golem Attack visual fix v2
(PR #38) → Archer Idle integration (PR #40) → Archer Move integration (PR #42) → Archer
Package-Level Review (PR #44) — is a single unbroken ancestor chain with every asset
integration verbatim/hash-verified against its Coco source PR, zero scope violations, zero
artwork/sidecar drift after integration, and all ten relevant validators passing with real
exit codes. No branch or PR in the chain is merged.

The "WITH CONDITIONS" qualifier is entirely about **PR #43** (Arena Ruins Final Board Art
Production Plan), which sits on a **separate line** — it branches from the Coco asset-source
commit `a76993d0` (PR #41's head) and is a sibling of, not a continuation of, the CC
integration line. It is docs/plan-only (no runtime code, no PNGs) and was verified absent from
the CC branch, but it must not be merged alongside the motion stack without an explicit,
separate integration plan reconciling its 8×7-vs-8×8 board-size note and its Map Theme Runtime
extension requests.

## Exact Base

- Base PR: **#44** — Archer Package-Level Review v1
- Base branch: `cc/archer-package-level-review-v1`
- Exact base HEAD: `e9d4af45fefa7795c65265c74fde24a8e6f2b648` — confirmed present locally and on
  `origin/cc/archer-package-level-review-v1`
- PR #44 confirmed **open, draft, `merged: false`** at audit time (GitHub API `pull_request_read`)
- Working tree was clean before this audit began; this branch (`cc/motion-pipeline-merge-readiness-audit-v1`)
  was checked out directly from the exact base HEAD above

## Dependency Graph

Eight lines, as requested (A–H). All SHAs below were re-verified against `origin` via
`git ls-remote` and matched the task's exact-commit list with **zero deviation**.

```
A. Runtime/contract foundation
   PR#23 Asset & Animation Framework Runtime  5a3a8ee  (base: cc/equipment-vertical-slice-runtime-v1 @ afe1577)
     -> PR#25 Map Theme Runtime + Arena Ruins baseline  613a324  (base: cc/fullscreen-screenshot-runtime-v1 @ aa1c737)
     -> [b20f043] "Link Pilot Motion Test Contract v1 from PR #28 (verbatim, hash-verified)"
        -- NOT a git-ancestry link to PR#28; PR#28's contract JSON is independently
           re-authored byte-identical and hash-checked (see "PR #28 relationship" below)
     -> PR#29 Arena Ruins Pilot Motion Test Harness (ad041be, harness core+tests)

B. Archer Attack
   PR#30 Archer Attack user-poses integration  42b9678  (base: PR#29 @ ad041be)
     -> PR#31 Archer Attack visual fix v2  6ab6a1f  (base: PR#30 @ 42b9678)

C. Slime Move
   PR#32 Slime Move integration  cc78057  (base: PR#31 @ 6ab6a1f)

D. Golem Attack
   PR#35 Golem Attack integration  2b3aa38  (base: PR#32-line; not in this audit's exact-commit list)
     -> PR#38 Golem Attack visual fix v2  6e60deb  (base: PR#35 @ 2b3aa38)

E. Archer Idle source -> integration
   PR#39 Archer Idle Motion Test asset source  7193af0  (base: coco/archer-complete-animation-package-plan-v1 @ 111e7fb — Coco line)
     -> PR#40 Archer Idle integration  bf7d84d  (base: PR#38 @ 6e60deb — CC line; path-limited checkout of PR#39's files only)

F. Archer Move source -> integration
   PR#41 Archer Move Motion Test asset source  a76993d  (base: PR#39 @ 7193af0 — Coco line)
     -> PR#42 Archer Move integration  a3cf9ca  (base: PR#40 @ bf7d84d — CC line; path-limited checkout of PR#41's files only)

G. Archer Package-Level Review
   PR#44  e9d4af4  (base: PR#42 @ a3cf9ca)

H. Arena Ruins board-plan branch (separate from the CC integration stack)
   PR#43 Arena Ruins Final Board Art Production Plan  80ca5b9  (base: PR#41 @ a76993d — Coco line, SIBLING of PR#42, not an ancestor/descendant of PR#42 or PR#44)
```

**PR #43 is explicitly on the Coco asset/source line, not a continuation of PR #44.** Its base
branch is `coco/archer-move-motion-test-v1` (PR #41's own head, `a76993d0`) — the same commit
PR #42 path-limit-checked-out files from. `git merge-base 80ca5b9 e9d4af4` = `cc78057`
(PR #32/Slime-Move-integration), confirming PR #43 diverges from the CC line well before PR #38.
`git merge-base --is-ancestor` in both directions between PR #43 and PR #42/PR #44 returned
`NO` — **no ancestor/descendant relationship exists between PR #43 and the CC integration
branches.**

### PR #28 relationship (informational, not a blocker)

`git merge-base --is-ancestor 60cc4b0 6ab6a1f` (PR #28 -> PR #31) returns **NO**. PR #28
(`cc/pilot-motion-test-contract-v1`) sits on a separate Coco-docs line
(`...->a779e24 pilot-asset-production-pack-v2->336fcf9 archer-reference-design->60cc4b0`)
that never merges into the CC runtime line. This is by design, not a defect: PR #29's commit
`b20f043` is titled *"Link Pilot Motion Test Contract v1 from PR #28 (verbatim, hash-verified)"`
and re-authors the contract JSON byte-identical to PR #28's, verified by
`tools/test-motion-test-harness.mjs` (asserts `H.MOTION_TESTS` against
`data/design/pilot-motion-test-contract-v1.json`, which itself is documented as "a verbatim
copy of PR #28 @ 60cc4b0"). The content is verified equal even though the git graph does not
show a parent edge. This is flagged here for completeness, not as a defect.

## PR/Branch Matrix

| PR | Branch | Exact head SHA | Base branch | Base SHA | Source vs Integration | Draft | Merged |
|---|---|---|---|---|---|---|---|
| #23 | `cc/asset-animation-framework-runtime-v1` | `5a3a8eec7991a98aad6f3acf0ce38687764dcb1a` | `cc/equipment-vertical-slice-runtime-v1` | `afe1577d` | Runtime foundation | true | false |
| #25 | `cc/map-theme-runtime-v1` | `613a3249377c6cbee0158f36d16e68a087fffb53` | `cc/fullscreen-screenshot-runtime-v1` | `aa1c737c` | Runtime foundation | true | false |
| #28 | `cc/pilot-motion-test-contract-v1` | `60cc4b042974648b15cea29cc1cc086b4ed7588f` | `cc/archer-reference-design-v1` | `336fcf93` | Contract/docs (separate Coco-docs line) | true | false |
| #31 | `cc/archer-motion-test-visual-fix-v2` | `6ab6a1f485d9e17badc56a671b5f105d049d8fe2` | `cc/archer-motion-test-user-poses-integration-v1` | `42b96784` | Integration (visual fix) | true | false |
| #32 | `cc/slime-move-user-poses-integration-v1` | `cc78057b4183776087c9756d1908f8ec3f735ea9` | `cc/archer-motion-test-visual-fix-v2` | `6ab6a1f4` | Integration | true | false |
| #38 | `cc/golem-attack-visual-fix-v2` | `6e60deb393bf33b38a67a8b91f3f2070d0194926` | `cc/golem-attack-user-poses-integration-v1` | `2b3aa382` | Integration (visual fix) | true | false |
| #39 | `coco/archer-idle-motion-test-v1` | `7193af0940efd77189157fdf4d2dbcd8237231a0` | `coco/archer-complete-animation-package-plan-v1` | `111e7fbb` | **Asset source** (Coco line) | true | false |
| #40 | `cc/archer-idle-motion-test-integration-v1` | `bf7d84da216afbfbdbb5fe05da7bb5972f2f3ef3` | `cc/golem-attack-visual-fix-v2` (#38) | `6e60deb3` | **Integration** (CC line) | true | false |
| #41 | `coco/archer-move-motion-test-v1` | `a76993d0f509981f2dcd70918efe9bc8f9cb00b9` | `coco/archer-idle-motion-test-v1` (#39) | `7193af09` | **Asset source** (Coco line) | true | false |
| #42 | `cc/archer-move-motion-test-integration-v1` | `a3cf9cadbc820aee46e726ba4a39ef29af186675` | `cc/archer-idle-motion-test-integration-v1` (#40) | `bf7d84da` | **Integration** (CC line) | true | false |
| #43 | `coco/arena-ruins-final-board-art-plan-v1` | `80ca5b942e6777ca7f083cf6e9e2d6604b531905` | `coco/archer-move-motion-test-v1` (#41) | `a76993d0` | Docs/plan (Coco line, **sibling** of #42/#44) | true | false |
| #44 | `cc/archer-package-level-review-v1` | `e9d4af45fefa7795c65265c74fde24a8e6f2b648` | `cc/archer-move-motion-test-integration-v1` (#42) | `a3cf9cad` | Integration/test gate | true | false |

All 12 SHAs re-verified against `origin` at audit time — **exact match, zero drift** for every
row. All 12 PRs confirmed **open + draft + `merged: false`** via `pull_request_read`.

## Asset Source vs Integration Matrix

| State | Asset source PR | Integration PR | Files introduced by integration | Files modified by integration |
|---|---|---|---|---|
| Idle | #39 (`coco/...`) | #40 (`cc/...`) | 8 PNGs, sidecar, `idle/source-map.json`, 2 review artifacts, new validator `validate-archer-idle-frames-v1.mjs` | `src/motion-test-harness.js` (dev-only harness) |
| Move | #41 (`coco/...`) | #42 (`cc/...`) | 8 PNGs, sidecar, `move-source-map.json`, 2 review artifacts, new validator `validate-archer-move-frames-v1.mjs` | `src/motion-test-harness.js` (dev-only harness) |
| Package review | — (no new asset source) | #44 (`cc/...`) | new gate `test-archer-package-transitions-v1.mjs` | `src/motion-test-harness.js` (dev-only harness, `PACKAGE_SEQUENCES`/`runPackageSequence`) |

## Hash/Verbatim Verification

All PNG/JSON hash comparisons below were run for real via `git show <sha>:<path> | sha256sum`
against both endpoints (integration commit and source commit); full per-file hashes are not
reprinted here to keep this document short — the comparison command and MATCH/MISMATCH result
for every file is what's reported.

**Idle — PR #40 integrated files vs PR #39 source commit `7193af0`:**
12/12 files compared (8 PNGs + sidecar + `source-map.json` + 2 review artifacts) — **12/12 MATCH, 0 MISMATCH.**

**Move — PR #42 integrated files vs PR #41 source commit `a76993d`:**
12/12 files compared (8 PNGs + sidecar + `move-source-map.json` + 2 review artifacts) — **12/12 MATCH, 0 MISMATCH.**

**No-drift-after-integration checks** (`git diff --stat <A> <e9d4af4> -- <path>`, expected empty):
- Attack assets from PR #38 (`6e60deb`) to PR #44 (`e9d4af4`): **empty diff — no drift.**
- Idle assets from PR #40 (`bf7d84d`) to PR #44 (`e9d4af4`): **empty diff — no drift.**
- Move assets from PR #42 (`a3cf9ca`) to PR #44 (`e9d4af4`): **empty diff — no drift.**
- Slime + Golem assets from PR #38 (`6e60deb`) to PR #44 (`e9d4af4`): **empty diff — no drift.**
- All PNG/sidecar files under `assets/` from PR #42 (`a3cf9ca`) to PR #44 (`e9d4af4`): **empty diff** — PR #44 touched zero asset files, confirming its "no artwork/sidecar changes" claim structurally, not just by report.

**canonicalApproved:** confirmed `false` in all three archer sidecars (idle/move/attack) via
the new stack validator (section below) and independently in the raw JSON.

## Scope Verification

`git diff --stat <base> <head>` was run for each integration commit and compared against its
PR body's claimed file list.

**PR #40** (`6e60deb`..`bf7d84d`): 14 files — 8 idle PNGs, idle sidecar, `idle/source-map.json`,
2 review artifacts, `src/motion-test-harness.js`, `tools/validate-archer-idle-frames-v1.mjs`.
**Matches the claimed scope exactly — no out-of-scope files.**

**PR #42** (`bf7d84d`..`a3cf9ca`): 14 files — 8 move PNGs, move sidecar, `move-source-map.json`,
2 review artifacts, `src/motion-test-harness.js`, `tools/validate-archer-move-frames-v1.mjs`.
**Matches the claimed scope exactly — no out-of-scope files.**

**PR #44** (`a3cf9ca`..`e9d4af4`): 2 files — `src/motion-test-harness.js`,
`tools/test-archer-package-transitions-v1.mjs`. **Zero asset changes, matches the claimed
scope exactly — no out-of-scope files.**

**No BLOCKER found in this section.**

## Validator Results

All commands below were executed for real from the audit branch working tree; exit codes are
the actual process exit codes, not inferred.

| Command | Exit |
|---|---|
| `node tools/validate-motion-pipeline-stack-v1.mjs` (new, this audit) | 0 |
| `node tools/validate-archer-idle-frames-v1.mjs` | 0 |
| `node tools/validate-archer-move-frames-v1.mjs` | 0 |
| `node tools/validate-archer-attack-frames-v1.mjs` | 0 |
| `node tools/validate-slime-move-frames-v1.mjs` | 0 |
| `node tools/validate-golem-attack-frames-v1.mjs` | 0 |
| `node tools/validate-pilot-motion-test-contract-v1.mjs` | 0 |
| `node tools/test-motion-test-harness.mjs` | 0 |
| `node tools/test-archer-package-transitions-v1.mjs` | 0 |
| `node tools/test-asset-animation-runtime.mjs` | 0 |
| `node --check tools/validate-motion-pipeline-stack-v1.mjs` | 0 |
| `git diff --check` | 0 |

Sample stdout (trimmed to the pass line each):
```
Motion pipeline stack audit passed (sidecar consistency, frame counts, no duplicates/extras,
all validators+gate present, PR #43 board-plan not leaked in).
Archer idle frames validation passed (8 real frames, unique hashes, structure/alpha/border/sidecar consistent).
Archer move frames validation passed (8 real frames, unique hashes, structure/alpha/border/sidecar+footstep-markers consistent).
Archer attack frames validation passed (10 real frames, structure/alpha/sidecar consistent).
Slime move frames validation passed (8 real frames, structure/alpha/sidecar consistent).
Golem attack frames validation passed (8 real frames, unique hashes, structure/alpha/border/sidecar consistent).
Pilot motion test contract v1 validation passed.
PASS: motion test harness (contract consistency + diagnostics + DOM-free guards) — all assertions passed
Archer package transitions test passed (sidecar consistency, marker isolation by contract, 4-sequence transition map).
PASS: asset & animation framework core — all assertions passed
```

No browser/x4 run was performed in this audit — PR #44 already ran and reported the real
32/32 browser package gate at x4 on this exact HEAD, and this audit changes no runtime/harness
behavior (only adds a new read-only Node validator and this document), so re-running the
browser suite would not exercise anything new.

## Merge Risks

1. **PR #43 is on a separate line and is docs/plan-only.** Merging it alongside the CC motion
   stack without reconciling its own listed "Unresolved integration facts" (8×7-vs-8×8 board
   size, no final-file loader/atlas contract in Map Theme Runtime, six tile-states not yet
   runtime-supported) would introduce unmet expectations into `main`. **Not a blocker for the
   CC motion stack itself** — it is simply not part of it.
2. **PR #28 is not a git ancestor of the runtime line** (documented above as informational).
   A future merge of PR #28 by itself would not conflict with the runtime line (different
   files), but reviewers should know the "contract" and its "consumer" are validated by
   content-hash, not by git ancestry — a future edit to PR #28's contract file would NOT
   automatically propagate, and the mirrored table in `src/motion-test-harness.js` would need
   a manual re-sync (already covered by the existing `test-motion-test-harness.mjs` check).
3. **Sequential fast-forward dependency.** Because #40→#42→#44 each stack on the previous
   integration PR's exact head, merge order must be strictly #38 (or whatever the mainline
   base ultimately is) → #40 → #42 → #44 in sequence; merging #42 or #44 first is not possible
   without conflicts, since each PR's diff assumes the previous one's files already exist.
4. **PR #29/#30/#31/#32/#35/#38 predate this audit's exact-commit list for some (PR #35 head
   not in the task's exact-commit list)** — included in the graph for completeness from prior
   audits' records; not re-verified byte-for-byte in this pass since the task's exact-commit
   list did not include it. No evidence of a problem was found, but it is noted as **outside
   this audit's directly-verified set** (non-blocking).

## Suggested Future Merge Order

**This is a suggestion only. No merge was performed or requested by this audit.**

1. PR #23 (Asset & Animation Framework Runtime)
2. PR #25 (Map Theme Runtime + Arena Ruins baseline)
3. PR #29 (Pilot Motion Test Harness) — *and, separately, PR #28 if the team wants the
   standalone contract doc in `main` too; order between #28 and #29 does not matter since
   they touch disjoint files and are content-equal by hash, not by ancestry*
4. PR #31 (Archer Attack visual fix v2) — supersedes/incorporates #30
5. PR #32 (Slime Move integration)
6. PR #38 (Golem Attack visual fix v2) — supersedes/incorporates #35
7. PR #40 (Archer Idle integration)
8. PR #42 (Archer Move integration)
9. PR #44 (Archer Package-Level Review) — test/gate only, no asset risk

PR #39 and PR #41 (the Coco asset-source PRs) do not need to be merged themselves — their
content already reached `main`'s future state verbatim via #40 and #42's path-limited
checkouts. They can remain as source-of-record branches or be closed once #40/#42 land.

## Branches That Must Remain Separate

- **`coco/arena-ruins-final-board-art-plan-v1` (PR #43)** — separate board-art planning line;
  do not merge into the motion-integration stack until a dedicated integration plan resolves
  its listed unresolved facts (board size, atlas/loader contract, tile-state runtime support).
- **`coco/archer-idle-motion-test-v1` (PR #39)** and **`coco/archer-move-motion-test-v1`
  (PR #41)** — Coco asset-source branches; their content is already captured verbatim in #40
  and #42 respectively via path-limited checkout, so they should not be merged as-is (their
  diffs include files, e.g. `coco/archer-complete-animation-package-plan-v1` plan docs in
  #39's ancestry, that the CC integration deliberately excluded).
- **`cc/pilot-motion-test-contract-v1` (PR #28)** — safe to merge independently at any time
  (disjoint files, no ancestry dependency on the runtime line), but should be merged with the
  understanding documented above (content-hash-verified consumer, not ancestry-linked).

## Blockers

**None.** No ancestry divergence was found inside the CC integration line, no hash mismatch
was found in either verbatim asset import, no out-of-scope file was found in PR #40/#42/#44,
all ten relevant validators exited 0, `canonicalApproved` is `false` everywhere checked, and
no branch or PR is merged.

## Non-blocking Notes

- PR #28's git graph position (documented above) is unusual but intentional and verified safe
  by content hash — flagged for reviewer awareness, not a defect.
- PR #35 (Golem Attack first integration, superseded by PR #38) was not independently
  re-verified in this pass since its SHA was not in this audit's exact-commit list; no issue
  is known or suspected.
- The 8×7-vs-8×8 board-size note from PR #43 is real and documented in PR #43 itself; it is
  irrelevant to the archer motion-test stack (which does not touch board layout) but should be
  resolved before any future board-art integration.
- Duplicate-frame observations from earlier rounds (Attack frames 006≈007, 008≈009,
  byte-identical held poses reported in PR #31) remain present and were re-confirmed absent of
  *new* duplicates by this audit's uniqueness/dedup checks; they are unchanged since PR #31 and
  were already reported non-blocking there.

## Final Readiness Classification

| Area | Classification |
|---|---|
| CC motion-integration ancestry (PR#23→25→29→31→32→38→40→42→44) | **READY** |
| Asset verbatim/hash integrity (Idle, Move) | **READY** |
| Scope of integration commits (#40, #42, #44) | **READY** |
| No-drift-after-integration (Attack/Idle/Move/Slime/Golem) | **READY** |
| Validator suite (10/10 real exit 0) | **READY** |
| `canonicalApproved` discipline | **READY** |
| PR #43 board-art plan relationship to the motion stack | **READY WITH CONDITIONS** (must not be merged into the motion stack without a separate integration plan) |
| PR #28 contract/consumer ancestry note | **READY WITH CONDITIONS** (informational; safe, but reviewers should understand it's hash-linked not ancestry-linked) |

**Overall: READY WITH CONDITIONS.** The motion-test stack itself (idle/move/attack + Slime +
Golem, PR #23 through PR #44) is internally consistent and mergeable in the suggested order
above whenever the team decides to merge. The only conditions are external to the motion
stack: PR #43 must get its own integration plan before any merge, and PR #28's non-ancestry
relationship should be understood by whoever merges it.
