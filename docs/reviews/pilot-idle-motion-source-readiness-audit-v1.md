# Pilot Idle Motion Source Readiness Audit v1

## Result

**READY WITH CONDITIONS**

The Slime Idle and Golem Idle motion-test source packages are complete, individually framed, source-hash locked, and ready for a future path-limited CC integration task. They are not registered in runtime, have not been reviewed in-browser at x4, and are not canonically approved.

- `canonicalApproved=false`
- Runtime integration performed by this audit: none
- Runtime/Core Logic/gameplay changes in this audit: none
- Pull requests merged by this audit: none

## Exact GitHub base

Verified from GitHub on 2026-07-19:

- Base source PR: **#52 — Golem Idle Motion Test v1 — 8 real frames**
- Source branch: `coco/golem-idle-motion-test-v1`
- Exact source HEAD: `f1391db31acd7ac6f6d6220a55f8278c80e9940f`
- PR state: `open=true`, `draft=true`, `merged=false`
- PR base: `coco/slime-idle-motion-test-v1`
- PR base SHA: `811e6858a7e2cbe004270a094e58982b8c1fbcf7`
- Audit branch: `coco/pilot-idle-motion-source-readiness-audit-v1`
- Audit worktree began clean at the exact source HEAD above.

The source tree at the GitHub HEAD and the existing Golem source-validation worktree were byte-tree identical: Git tree SHA `20e055b48650af11ae780cadbde69fb4daa22ca2`.

## Contract and sidecar audit

| Unit/state | Frames | FPS | Loop | Canvas | Anchor | Root motion | Markers | runtimeFlipX | canonicalApproved |
|---|---:|---:|---|---|---|---|---|---|---|
| `monster.slime/idle` | 8 | 8 | true | 512×512 | `[0.5,0.9]` | `in-place` | `[]` | true | false |
| `monster.golem/idle` | 8 | 8 | true | 640×640 | `[0.5,0.94]` | `in-place` | `[]` | true | false |

Sidecars:

- `assets/units/monster.slime/monster.slime_idle_motiontest.json`
- `assets/units/monster.golem/monster.golem_idle_motiontest.json`

Both sidecars match `data/design/pilot-idle-motion-production-contract-v1.json`. Neither idle state declares footstep, attack, impact, projectile, or gameplay markers. `runtimeFlipX=true` remains backed by the existing `facingMode: 'flip_x'` provenance; no mirrored duplicate frames are stored.

## Real-frame inventory and hashes

### Slime Idle

| Frame | Production PNG | SHA-256 |
|---:|---|---|
| 000 | `assets/units/monster.slime/idle/monster.slime_idle_000.png` | `86479f476d075bc18e12ef2982d37ae765b78d973cf81fffc4e9d1407940749a` |
| 001 | `assets/units/monster.slime/idle/monster.slime_idle_001.png` | `f962c20dc1118832ad116884f85c5ccd3d46b777a91354951ab2ab09d9b1b042` |
| 002 | `assets/units/monster.slime/idle/monster.slime_idle_002.png` | `75576896e88798b68d78aefbaf8755820176b6b22c25ec82708310ae12f6b7ff` |
| 003 | `assets/units/monster.slime/idle/monster.slime_idle_003.png` | `fd04d6461b1ac76a90840c534c3545678338f7a5d04763a0e3c90e31c7f223ac` |
| 004 | `assets/units/monster.slime/idle/monster.slime_idle_004.png` | `b4c092a03996559bc38b340aea9e9172e65bdc87fd13d4aa8b820c2cc6484b1d` |
| 005 | `assets/units/monster.slime/idle/monster.slime_idle_005.png` | `ebcec2064ab3b41455fc3b33bdb0e8ea5ce657174dddeddfd7c0f7c66ab49434` |
| 006 | `assets/units/monster.slime/idle/monster.slime_idle_006.png` | `1da6c7fe5be54ab3f8ad72b6d7ddd505bbdd2a41bfaeecfb9ff8357063300129` |
| 007 | `assets/units/monster.slime/idle/monster.slime_idle_007.png` | `2a5613d8f502df581fcf24e2372a68b8ac0e331c75a7d2a05021e623f603ae56` |

### Golem Idle

| Frame | Production PNG | SHA-256 |
|---:|---|---|
| 000 | `assets/units/monster.golem/idle/monster.golem_idle_000.png` | `4e0ca71130ae24f415752aeb1f3734bd31782c7a6b648c06301345df77e767b0` |
| 001 | `assets/units/monster.golem/idle/monster.golem_idle_001.png` | `36c0d9cd5d3067a8c657aa6307b3b8c4a063ef2a7a9894c03b9c1f987ee33528` |
| 002 | `assets/units/monster.golem/idle/monster.golem_idle_002.png` | `afc5919345afeb6754c8e0b947fe3a817c975e1c94f5777e37d7ec41029a348e` |
| 003 | `assets/units/monster.golem/idle/monster.golem_idle_003.png` | `e1340bc09411704a1ecef57b93e6dc6fa07cae0bf248d176aebe6414b71e0b1b` |
| 004 | `assets/units/monster.golem/idle/monster.golem_idle_004.png` | `13550545cb92a12ff4920f87c7856de8b16b35af058414e4f603835fb51e69ca` |
| 005 | `assets/units/monster.golem/idle/monster.golem_idle_005.png` | `3d519b3af8fa2cf4b5f529d7d26a0a286ad44f8c80c219a0e65afaceaa266aaf` |
| 006 | `assets/units/monster.golem/idle/monster.golem_idle_006.png` | `7e04a98518043a97ce00c87a5cd413784e5cd9ed700a4f07e816b6e9f5c8e045` |
| 007 | `assets/units/monster.golem/idle/monster.golem_idle_007.png` | `a954928d77fb8dc4f6b7e19e80885a8c35afa9999e3434348f43b94fd86e267e` |

Each directory contains exactly PNG frames 000–007 and no 008. All sixteen frame hashes are unique within their state. The PNG files are the production motion-test sources; the two GIFs and two contact sheets under `docs/assets/review/` are review-only and do not substitute for frame files.

## Identity and provenance audit

### Slime

- Identity master: `assets/units/monster.slime/move/monster.slime_move_000.png`
- Locked master SHA-256: `12ca260a001dbda6177f29565e9df2c369c09216c889974aeee8b12fb5ae04f9`
- Production method recorded by `assets/units/monster.slime/idle/source-map.json`: identity-locked source-derived squash/stretch from the existing Move neutral frame.
- Existing Slime Move frames 000–007 and Move sidecar match the hashes locked by the Phase F contract.

### Golem

- Identity master: `assets/units/monster.golem/attack/monster.golem_attack_000.png`
- Locked master SHA-256: `be41f186b37f99fed12e59844638ab0ed2e0020deb73ace5a840c2d4adda70d8`
- Required source version: Golem Attack visual-fix v2.
- Visual-fix report SHA-256: `b95abd52e13a48d5f9cf730e4271b7a5a2437d6c6c7017a05a235e0aa4478dd2`
- Existing Golem Attack frames 000–007 and Attack sidecar match the hashes locked by the Phase F contract.

No source master, source sidecar, palette, material, face, body silhouette, crystal layout, camera, or scale drift was found.

## Idle-artifact and alpha audit

Visual inspection of both contact sheets and validator metrics found:

- Slime reads as a restrained jelly breathing/squash-settle loop. There is no hop, directional travel, attack anticipation, projectile, VFX, ground, text, or scene.
- Golem reads as slow torso/shoulder weight settling with attached crystal lag. Feet remain grounded; there is no slam, impact pose/cue, dust, locomotion, or attack follow-through.
- Slime baseline is y=460 for 8/8; horizontal centroid spread is 0.066 px; normalized 007→000 seam is 0.00892.
- Golem baseline is y=601 for 8/8; horizontal centroid spread is 0.817 px; normalized 007→000 seam is 0.00951.
- Both sets are 8-bit RGBA with transparent corners and zero opaque canvas-border pixels.
- Slime detached alpha residue is zero in all frames.
- Golem large checkerboard candidates are zero; visual-fix-v2 source topology remains clean.
- No accidental duplicate frame hash was found.

These source checks do not claim browser playback, runtime transition, x4 visual approval, or final canonical approval.

## Source-scope audit

Diff audited: `58824feb92452fb3c7ab72bf7984b4f22d558b3e..f1391db31acd7ac6f6d6220a55f8278c80e9940f`.

- Changes are limited to Slime/Golem idle assets and metadata, motion production contracts/pose maps, review artifacts, source handoff documentation, and new source validators.
- No `src/` file changed.
- No Board asset under `assets/maps/` changed or entered this Motion line.
- No Combat, targeting, pathfinding, economy, stage, camera, board geometry, map runtime, UI runtime, or main-loop file changed.
- Existing Slime Move and Golem Attack assets remain unchanged.
- This audit adds only this Markdown document on a descendant branch.

## Validator and test evidence

| Command | Worktree | Exit |
|---|---|---:|
| `node tools/validate-slime-idle-frames-v1.mjs` | exact PR #52 source content | 0 |
| `node tools/validate-slime-move-frames-v1.mjs` | exact PR #52 source content | 0 |
| `node tools/validate-golem-idle-frames-v1.mjs` | exact PR #52 source content | 0 |
| `node tools/validate-golem-attack-frames-v1.mjs` | exact PR #52 source content | 0 |
| `node tools/validate-pilot-idle-motion-production-contract-v1.mjs` | exact PR #50 contract branch/tree | 0 |
| `node tools/validate-pilot-motion-test-contract-v1.mjs` | exact PR #52 source content | 0 |
| `node tools/test-asset-animation-runtime.mjs` | exact PR #52 source content | 0 |
| `git diff --check` | audit worktree | 0 |

The Phase F contract validator intentionally enforces the Phase F branch scope. It was run from the exact PR #50 contract worktree, whose Git tree matches PR #50 (`d6df81d0bbe25e3e830e1c201561e7a2345338a8`), rather than weakening or modifying the validator.

Key validator output:

- `Source locks: Slime Move 8/8 and Golem Attack visual-fix-v2 8/8 unchanged.`
- `Slime idle frames validation passed (8 unique real RGBA frames...)`
- `Golem idle frames validation passed (8 unique real RGBA frames...)`
- `eventMarkers=[]`, `rootMotion=in-place`, `canonicalApproved=false`
- CC integration and browser/x4 review remain pending.

## Cross-line boundary audit

Compared Motion HEAD `f1391db31acd7ac6f6d6220a55f8278c80e9940f` with Board HEAD `d4f6793a40a8742f0bb4515402a33f204d58caea`:

- Merge-base: `cc78057b4183776087c9756d1908f8ec3f735ea9`
- Motion is not an ancestor of Board; Board is not an ancestor of Motion.
- Divergent unique commit counts: Motion 10, Board 14.
- Merge commits after the common base: Motion 0, Board 0.
- Patch-equivalent/cherry-pick matches across the divergent lines: 0 in both directions.
- Production/source path collision count: 0.
- Motion ownership stays under `assets/units/monster.slime/idle/`, `assets/units/monster.golem/idle/`, their unit sidecars/source maps, and motion-only design/review/validator paths.
- No Motion metadata/validator assumes ownership of `assets/maps/arena-ruins/board/`, and no Board metadata/validator owns the idle directories.

This audit branch remains a descendant of PR #52 only. It contains no Board-line commit or file.

## Conditions and blockers

No source-file corruption, identity-source ambiguity, hash drift, or source-level blocker was found. Conditions before integration approval are:

1. CC must import the state paths into a separate CC integration branch without merging this Coco ancestry wholesale.
2. CC must verify actual asset resolution/state registration and fallback behavior; this source audit does not alter runtime.
3. CC must run exactly three x4 checkpoints: Asset Load; Playback/Loop/Anchor Stability; No-marker + Visual Regression.
4. The subtle idle amplitude must receive exact-file visual approval at runtime display scale.
5. `canonicalApproved` must remain false until that approval.

## Handoff recommendation

CC may begin one path-limited Pilot Idle integration task from the appropriate CC Motion baseline using the sixteen PNGs, two idle sidecars, source maps, and the two state validators. Do not import review GIF/contact-sheet files as runtime assets and do not connect this Motion ancestry to the Board source ancestry.

Final source readiness: **READY WITH CONDITIONS**.
