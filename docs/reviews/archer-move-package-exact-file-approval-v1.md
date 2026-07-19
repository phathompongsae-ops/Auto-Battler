# Archer Move Package Exact-File Approval v1

## Approval recorded

The user explicitly approved the exact Archer Move v1 package produced in PR #64. Approval applies only to the eight files, hashes, marker mapping, and motion semantics locked below.

| Effective status | Value |
|---|---|
| `styleDirectionApproved` | `true` |
| `neutralMasterApproved` | `true` |
| `idlePackageApproved` | `true` |
| `movePackageApproved` | `true` |
| `canonicalApproved` | `false` |
| `runtimeEligible` | `false` |
| `runtimeIntegrated` | `false` |
| `attackGenerated` | `false` |

This is exact-package approval, not canonical runtime approval.

## Repository, source, and ancestry

The only repository accessed for this task is `phathompongsae-ops/Auto-Battler`. The local `origin` and GitHub target were verified before each write stage. No cross-repository merge, cherry-pick, copy, or write occurred.

| Role | PR | Branch | Exact HEAD | Verified state |
|---|---:|---|---|---|
| Exact approved Move package/base | #64 | `coco/archer-move-production-v1` | `636b46abee0f91d4f73a71aadff409de2fd2ec67` | open, draft, unmerged |
| PR #64 base | #63 | `coco/archer-idle-package-exact-file-approval-v1` | `40b334937f394f54c1d1e97b729e37778644ee1e` | exact base |

No HEAD, frame-hash, or motion-contract drift was found. This approval branch descends directly from exact PR #64 and does not import CC/runtime ancestry.

## Exact source identity

| Field | Locked value |
|---|---|
| Character/state | `hero.archer` / `move` |
| Package ID | `hero.archer.move.chibi-production-candidate.v1` |
| Neutral Master ID | `hero.archer.production-master.candidate.v1` |
| Neutral Master SHA-256 | `4911e7e3ba59241ee011be3e62f1b64230dcf9b3c24c6aeb23dc939d83311013` |
| Frame directory | `assets/units/hero.archer/move-chibi-v1/` |
| Canvas | 640×960 RGBA PNG |

## Exact package lock

| Frame | SHA-256 |
|---:|---|
| 000 | `a9142fb9aff23110822e2eae491fd10a483aaec21f0ce44616108c3d5e797d79` |
| 001 | `91ccd270ed2796d6a6d0d11a95582537af95cbfe0334c701022522f4e3def1fc` |
| 002 | `1b92c2c694f03866798c5c0d67e7a1a2f929b2d4181c172fa493c0f583f146d9` |
| 003 | `904eff4bf047861d6e4da257ecd733471a2de73c36ca5333b0c7ec18b181e70c` |
| 004 | `8890f16ab7a903d7638a35e8fcc3456cb82ad49a67f0d4ff85371e55bbc3c2d9` |
| 005 | `2d6f9200366e3056a8309e249f6fd2ddf31b32fea7538ae35860878126446d03` |
| 006 | `444f4b9833c3e5bd3be41c2873673b881e0ef7d40b1092ed1894cd4a33f3927c` |
| 007 | `383adfadbeba4314ecade83b6080c753ed2a976fc80b03d4820b0546bdb035b1` |

Locked semantics:

- 8 frames at 12 FPS;
- `loop=true`;
- `rootMotion=in-place`;
- `runtimeFlipX=true`;
- anchor `[0.5, 0.92]`;
- `leftFootstepCue @ 0.25` maps to frame 002, with contact at y=854;
- `rightFootstepCue @ 0.75` maps to frame 006, with contact at y=854;
- accumulated root translation remains zero;
- support-height variation remains at most two pixels.

Any future edit requires a new version and new explicit package approval. Approved Move v1 must never be silently overwritten.

## Metadata boundary

The PR #64 production contract, eight PNGs, sidecar, source map, validation report, generator, validator, GIF, contact sheet, board sample, and marker diagnostic are immutable production-time evidence. Their `movePackageApproved=false` value records the package state when PR #64 was produced and is not rewritten.

`data/design/archer-move-package-exact-file-approval-v1.json` is the effective approval overlay and records `movePackageApproved=true`. This retains exact byte identity and keeps the original package validator valid.

## Findings carried forward

Move v1 uses a compact, low-amplitude locomotion cue. Future work must preserve the face, hood, pointed ears, ornate bow, green/gold identity, zero accumulated translation, validated cadence, and exact marker contacts.

The package has no detected identity drift. The y=852–854 transition range and two-pixel maximum support variation are approved as part of this exact package.

Archer Attack must be produced as a separate state from the approved Neutral Master and identity constraints. Move-specific lower-body deformation must not be copied into Attack as an assumed pose solution.

## Next production gate

1. Approved Neutral Master — complete.
2. Approved Archer Idle — complete.
3. Approved Archer Move — complete through this exact-package overlay.
4. Archer Attack Production v1 — authorized, not started by this task.
5. Separate Attack approval.
6. Separate CC runtime integration.

No Attack, runtime, `src/`, Core Logic, Combat, targeting, pathfinding, economy, stage logic, main loop, camera, board, map, generator, validator, source-map, sidecar, production PNG, GIF, or review-composite change is included.
