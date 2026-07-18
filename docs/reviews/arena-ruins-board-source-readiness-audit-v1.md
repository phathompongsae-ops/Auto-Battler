# Arena Ruins Board Source Readiness Audit v1

## Result

**READY WITH CONDITIONS**

The Arena Ruins static board source pack is structurally complete, hash-locked, visually separated from review-only composites, and ready for a future path-limited CC integration task. It is not runtime-integrated or canonically approved. CC must resolve the loader/atlas/color-space/render-order ownership recorded by the implementation contract and obtain exact-file visual approval before treating the pack as production runtime content.

- `canonicalApproved=false`
- `runtimeIntegrated=false`
- Runtime/Core Logic changes in this audit: none
- Pull requests merged by this audit: none

## Exact GitHub base

Verified from GitHub on 2026-07-19:

- Base source PR: **#49 — Arena Ruins Static Board Production Pack v1**
- Source branch: `coco/arena-ruins-static-board-production-pack-v1`
- Exact source HEAD: `d4f6793a40a8742f0bb4515402a33f204d58caea`
- PR state: `open=true`, `draft=true`, `merged=false`
- PR base: `coco/arena-ruins-board-implementation-contract-v1`
- PR base SHA: `ca5d91972f9a26fea641f2f26b41312de5d2157b`
- Audit branch: `coco/arena-ruins-board-source-readiness-audit-v1`
- Audit worktree began clean at the exact source HEAD above.

The source tree at the GitHub HEAD and the existing source-validation worktree were byte-tree identical: Git tree SHA `642d4231e2f1f291b641355b8ba657b48c166690`.

## Production pack inventory

Manifest: `assets/maps/arena-ruins/board/arena-ruins-static-board-pack-v1.json`

| Asset ID | Production path | Dimensions | Format / alpha | SHA-256 |
|---|---|---:|---|---|
| `arenaRuins.boardSurface.v1` | `assets/maps/arena-ruins/board/arena-ruins-board-surface-v1.png` | 1024×896 | RGB8 / opaque required | `107b10f1d08407d8d08aa453e7b7ea0a67f45228e38d9516a7ae1ab0e888bb56` |
| `arenaRuins.borderCorners.v1` | `assets/maps/arena-ruins/board/arena-ruins-border-corners-v1.png` | 1024×1024 | RGBA8 / true alpha | `7c847c455bb77d9f9f7f036f59e63e920324eafec6a3512b5194677aa067ce8f` |
| `arenaRuins.perimeterGround.v1` | `assets/maps/arena-ruins/board/arena-ruins-perimeter-ground-v1.png` | 512×512 | RGB8 / opaque required | `062d19d2b1371193a775b449c88438a56db6392e6178efa2752494a2ee5717bf` |
| `arenaRuins.backgroundModules.v1` | `assets/maps/arena-ruins/board/arena-ruins-background-modules-v1.png` | 1024×1024 | RGBA8 / true alpha | `55cde4ac422c9f54888b4addaa5cdfa343e417d0b554ebdb40efac6fb41412b4` |
| `arenaRuins.benchTreatment.v1` | `assets/maps/arena-ruins/board/arena-ruins-bench-treatment-v1.png` | 1024×128 | RGBA8 / true alpha | `08c9ca3d4aabac5a3510445d5c58ba2b07b185ccc8aaa0266a7f429ad825a57f` |
| `arenaRuins.tileStates.v1` | `assets/maps/arena-ruins/board/arena-ruins-tile-states-v1.png` | 1024×768 | RGBA8 / true alpha | `5cb733ad8906358562b409ebc4679dffe5d527839d91b97baccd8aad3cdd8c3d` |
| `arenaRuins.props.v1` | `assets/maps/arena-ruins/board/arena-ruins-props-v1.png` | 1024×1024 | RGBA8 / true alpha | `79ca34009f5e55cf9d996fd95620ddee832f097023fc0b37e6a4c3cef0b2fcc9` |

Findings:

- Manifest contains exactly seven production PNG records; all filenames are unique and all files decode.
- All seven content hashes are unique and match the manifest.
- Actual compressed PNG total is 3,080,259 bytes. Contract decoded RGBA8 budget is 20 MiB; estimated full mip-chain budget is 26.67 MiB.
- RGBA atlas border pixels are transparent and checkerboard candidate count is zero.
- Perimeter texture opposite-edge mismatch is zero on both axes.
- Tile-state atlas cells 9–11 are fully transparent and are not accidental gameplay-state art.
- Board surface reads as 8×7; combat rows remain 0–5 and bench treatment remains row 6.

## Review-only separation and baked-content audit

The following files are review artifacts only and do not appear in the production `assets` array:

- `docs/assets/review/arena-ruins/production-pack-v1/production-pack-contact-sheet.png`
- `docs/assets/review/arena-ruins/production-pack-v1/production-pack-composited-preview.png`
- `docs/assets/review/arena-ruins/production-pack-v1/production-pack-with-pilots.png`
- `docs/assets/review/arena-ruins/production-pack-v1/production-pack-mobile-preview.png`

Visual inspection of the production contact sheet and the raw/composited board confirms:

- Production assets contain board surface, border/corner modules, perimeter material, background modules, bench treatment, tile-state overlays, and props only.
- No Archer, Slime, Golem, HP bars, shop/HUD UI, text labels, gameplay selection, targeting result, or runtime state is baked into the production PNGs.
- Pilots and their review shadows appear only in `production-pack-with-pilots.png`; that file is not a production asset and must not be imported as one.
- Labels in the contact sheet are review annotations only and are not present in any production PNG.
- The tile-state atlas is separate from the board surface; no selected/target/deploy state is permanently baked into the base board.

The manifest independently records `pilotEmbedded=false`, `uiEmbedded=false`, and `gameplayStateEmbedded=false` for all seven assets.

## Source-scope audit

Diff audited: `ca5d91972f9a26fea641f2f26b41312de5d2157b..d4f6793a40a8742f0bb4515402a33f204d58caea`.

- Changed paths are limited to `assets/maps/arena-ruins/board/`, production-pack review/docs, the handoff review, and the pack validator.
- No `src/` file changed.
- No character PNG/sidecar changed.
- No Combat, targeting, pathfinding, economy, stage, camera, board geometry, UI runtime, or game-loop file changed.
- This audit adds only this Markdown document on a descendant branch.

## Validator and test evidence

| Command | Worktree | Exit |
|---|---|---:|
| `node tools/validate-arena-ruins-static-board-production-pack-v1.mjs` | exact PR #49 source branch/tree | 0 |
| `node tools/validate-arena-ruins-board-implementation-contract-v1.mjs` | exact PR #48 contract branch/tree | 0 |
| `node tools/test-map-theme-runtime.mjs` | audit worktree at PR #49 source content | 0 |
| `node tools/test-asset-animation-runtime.mjs` | audit worktree at PR #49 source content | 0 |
| `git diff --check` | audit worktree | 0 |

The production-pack and implementation-contract validators intentionally enforce their originating branch names. They were therefore run from the exact source/contract worktrees whose Git trees match the corresponding GitHub heads, rather than weakening or modifying those existing validators for this audit.

Key validator output:

- `PACK OK assets=7 uniqueHashes=7 actualPngBytes=3080259`
- `SEAM OK perimeter leftRight=0 topBottom=0`
- `ATLAS OK tile-state unused cells 9-11 fully transparent`
- `GRID OK 8x7 seamLuma=110.39 centerLuma=115.35`
- `ASSETS 7; decoded RGBA8 budget 20 MiB; runtime integration false`
- `canonicalApproved=false`

## Cross-line boundary audit

Compared Board HEAD `d4f6793a40a8742f0bb4515402a33f204d58caea` with Motion HEAD `f1391db31acd7ac6f6d6220a55f8278c80e9940f`:

- Merge-base: `cc78057b4183776087c9756d1908f8ec3f735ea9`
- Board is not an ancestor of Motion; Motion is not an ancestor of Board.
- Divergent unique commit counts: Board 14, Motion 10.
- Merge commits after the common base: Board 0, Motion 0.
- Patch-equivalent/cherry-pick matches across the two divergent lines: 0 in both directions.
- Production/source path collision count: 0.
- Board source ownership stays under `assets/maps/arena-ruins/board/`; Motion source ownership stays under `assets/units/monster.slime/idle/` and `assets/units/monster.golem/idle/` plus their motion metadata.
- No Board validator or metadata modifies Motion ownership, and no Motion validator or metadata modifies Board ownership.

This audit branch remains a descendant of PR #49 only. It contains no Motion-line commit or file.

## Conditions and blockers

No source-file corruption or source-level blocker was found. The following are integration conditions, not reasons to modify this source audit:

1. Exact-file visual approval is still pending; `canonicalApproved` must remain false until that decision.
2. CC must implement or explicitly resolve the external asset loader/path registry, atlas UV contract, color-space assignment, surround-ground ownership, and render-order intent documented by PR #48.
3. Runtime support for all tile-state visuals is not assumed by this source pack.
4. Browser-measured UI overlap and mobile runtime framing remain integration-stage checks.
5. CC must import production paths only; review composites/contact sheets must stay outside runtime asset registration.

## Handoff recommendation

CC may begin a separate, path-limited Board integration task from the appropriate CC runtime baseline using the seven manifest production paths. Do not merge this Coco ancestry wholesale, do not import review artifacts, and do not connect it to the Motion source ancestry.

Final source readiness: **READY WITH CONDITIONS**.
