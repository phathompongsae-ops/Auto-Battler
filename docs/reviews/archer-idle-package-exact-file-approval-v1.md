# Archer Idle Package Exact-File Approval v1

## Approval recorded

The user explicitly approved the exact Archer Idle v1 package produced in PR #62. Approval applies only to the eight files and package semantics locked below.

| Effective status | Value |
|---|---|
| `styleDirectionApproved` | `true` |
| `neutralMasterApproved` | `true` |
| `idlePackageApproved` | `true` |
| `canonicalApproved` | `false` |
| `runtimeEligible` | `false` |
| `runtimeIntegrated` | `false` |
| `moveGenerated` | `false` |
| `attackGenerated` | `false` |

This is package approval, not canonical runtime approval.

## Verified source and ancestry

GitHub and the local object tree were checked before recording approval.

| Role | PR | Branch | Exact HEAD | Verified state |
|---|---:|---|---|---|
| Exact approved package/base | #62 | `coco/archer-idle-production-v1` | `8d5ee65a760b123569713fb989867c08a2816fbd` | open, draft, unmerged |
| Neutral Master approval parent | #61 | `coco/archer-neutral-master-exact-file-approval-v1` | `7e1f0639b577b6f8c1d5f6ba43c8160f1c4115e2` | exact parent of PR #62 |

No HEAD drift, frame-hash drift, or motion-contract drift was found. This approval branch descends directly from exact PR #62.

## Exact source identity

| Field | Locked value |
|---|---|
| Character | `hero.archer` |
| State | `idle` |
| Package ID | `hero.archer.idle.chibi-production-candidate.v1` |
| Neutral Master ID | `hero.archer.production-master.candidate.v1` |
| Neutral Master SHA-256 | `4911e7e3ba59241ee011be3e62f1b64230dcf9b3c24c6aeb23dc939d83311013` |
| Frame directory | `assets/units/hero.archer/idle-chibi-v1/` |
| Canvas | 640×960 RGBA PNG |

## Exact package lock

| Frame | SHA-256 |
|---:|---|
| 000 | `4911e7e3ba59241ee011be3e62f1b64230dcf9b3c24c6aeb23dc939d83311013` |
| 001 | `1996f524359331c22ce7950c0494a4bb803d466b772794fffeeee18e49d681fc` |
| 002 | `ce9e92977f6fe1f128d941f9c8309892a9fe3391e51f68bf98c3e7534b375924` |
| 003 | `57d29515f980b5e9c6ec04b087dc89ed8c5a57d4f06896b46cdb0fe65188e2c0` |
| 004 | `30bf88ec7006a0ddbb8b69a6a5585588582b2208c7c92bef72b5cc974fc5b761` |
| 005 | `ecb10ad466cc36ebf05957211ea79e59150d470a51df1a8f451dc952f2edb4ff` |
| 006 | `a0d284b73d007f4bd78251cc1b9492545da97582dbca6b31851242b328f0ec29` |
| 007 | `815717f5dc733fcc3ba0275ac086fc7a5a11847ae627ddd6f49c9f8174327985` |

Locked semantics:

- 8 frames at 8 FPS;
- `loop=true`;
- `rootMotion=in-place`;
- `eventMarkers=[]`;
- `runtimeFlipX=true`;
- anchor `[0.5, 0.92]`;
- contact zone y≥800 remains source-locked;
- visible foot baseline remains y=854 in every frame;
- frame 007→000 continuity remains the approved low-amplitude loop.

Any future edit requires a new version and a new explicit package approval. Approved Idle v1 must never be silently overwritten.

## Metadata boundary

The PR #62 sidecar, source map, production contract, validation report, generator, validator, PNGs, GIF, and review composites are immutable production-time evidence. Their `idlePackageApproved=false` value records the state at the moment PR #62 was produced and is not rewritten.

`data/design/archer-idle-package-exact-file-approval-v1.json` is the effective current approval overlay and records `idlePackageApproved=true`. This preserves byte identity, keeps the original package validator valid, and separates production evidence from the later user decision.

## Findings carried forward

Board review passed. Future derivatives must preserve the bow silhouette, hood/ear readability, and green/gold contrast against Arena Ruins.

Bench remains the highest-risk context. Future production must preserve gold hood trim, the open face area, eye contrast, and enough value separation to keep hood and hair from collapsing into a green mass.

The approved loop is deliberately subtle. Its low amplitude, no-foot-slide result, fixed y=854 baseline, and locked lower contact zone must remain unchanged in Idle v1.

## Next production gate

The approved sequence is now:

1. Approved Neutral Master — complete.
2. Approved Archer Idle — complete through this exact-package record.
3. Archer Move Production v1 — authorized as a separate future task, not started here.
4. Move approval.
5. Archer Attack Production v1 and separate approval.
6. Separate CC runtime integration.

No Move, Attack, runtime, `src/`, Core Logic, Combat, targeting, pathfinding, economy, stage logic, main loop, camera, board, map, generator, validator, source-map, sidecar, production PNG, GIF, or review-composite change is included in this approval record.
