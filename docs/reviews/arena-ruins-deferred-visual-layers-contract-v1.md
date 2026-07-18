# Arena Ruins Deferred Visual Layers Contract v1

Status: **contract ready; one partial integration seam ready; three atlas placement bindings remain unresolved**

This document and its machine-readable companion define the measured atlas regions, UV convention, visual-state mapping, ownership, rendering, texture policy, and the smallest safe follow-up scope after PR #55. They do not integrate runtime art, alter artwork, or approve any file as canonical.

- Machine source of truth: `data/design/arena-ruins-deferred-visual-layers-contract-v1.json`
- Approval: `canonicalApproved=false`
- Runtime integration in this change: none
- Artwork regeneration/retouching in this change: none
- PRs merged by this change: none

## Verified GitHub state and source boundary

GitHub was re-read on 2026-07-19 before this work began.

| Role | PR | Branch | Exact HEAD | State |
|---|---:|---|---|---|
| Production source | #49 | `coco/arena-ruins-static-board-production-pack-v1` | `d4f6793a40a8742f0bb4515402a33f204d58caea` | open, draft, unmerged |
| Board readiness / contract base | #53 | `coco/arena-ruins-board-source-readiness-audit-v1` | `bc78c658ad066042041acf7e0bfad5173ce767fa` | open, draft, unmerged |
| Runtime reference | #55 | `cc/arena-ruins-static-board-runtime-integration-v1` | `08744faad0df8ce5fe1e43461ba59687fd0aebe8` | open, draft, unmerged |

This contract descends from PR #53 because it extends Board source metadata. PR #49 is an ancestor of #53. PR #55 is not an ancestor of #53 and #53 is not an ancestor of #55; their merge-base is `cc78057b4183776087c9756d1908f8ec3f735ea9`. PR #55 descends from the Motion runtime base `cc/motion-pipeline-merge-readiness-audit-v1` at `58824feb92452fb3c7ab72bf7984b4f22d558b3e`, so it is used read-only and is not imported into this ancestry.

The four deferred PNG blobs in PR #55 are byte-identical to PR #49. `src/game.js` has no diff in PR #55 relative to its base.

## Locked compatibility facts

- Board remains 8×7, 56 tiles.
- Combat rows remain 0–5; deploy rows remain 3–5.
- Bench remains row 6; usable bench columns remain 0–4.
- Camera, `gridToWorld`, contain-fit, board geometry, and gameplay geometry remain unchanged.
- PR #55's board surface at y `0.002`, bench treatment at y `0.003`, and existing 60×60 perimeter-ground swap/restore remain unchanged.
- Existing tile material highlights, pilot readability, 844×390 framing, and the procedural fallback remain authoritative.
- Map 2–3 and Motion source assets are outside this contract.

## Direct PNG findings

The analysis used decoded RGBA pixels, connected non-zero-alpha regions, direct visual inspection, the PR #49 manifest, inherited Board contracts, and PR #55 runtime code. The source files were not modified.

| Asset | SHA-256 | Size/type | Measured layout | Runtime result |
|---|---|---|---|---|
| Border/corners | `7c847c455bb77d9f9f7f036f59e63e920324eafec6a3512b5194677aa067ce8f` | 1024×1024 RGBA8 | 7 isolated regions | UV extraction ready; board-side/corner binding unresolved |
| Background modules | `55cde4ac422c9f54888b4addaa5cdfa343e417d0b554ebdb40efac6fb41412b4` | 1024×1024 RGBA8 | 6 isolated regions | UV and visual identity ready; module-to-world-slot binding unresolved |
| Props | `79ca34009f5e55cf9d996fd95620ddee832f097023fc0b37e6a4c3cef0b2fcc9` | 1024×1024 RGBA8 | 9 isolated regions | UV and visual identity ready; prop-to-world-slot binding unresolved |
| Tile states | `5cb733ad8906358562b409ebc4679dffe5d527839d91b97baccd8aad3cdd8c3d` | 1024×768 RGBA8 | fixed 4×3 grid, 256×256 cells; 9 used + 3 fully transparent | all cells resolved; current runtime can safely bind only normal/valid/invalid |

All four files are straight-alpha color atlases. Their outer pixels and unused tile-state cells are transparent as required by the production-pack validator. `canonicalApproved=false` remains unchanged.

## Pixel and UV convention

Pixel rectangles use a top-left origin, x right, y down. `x`/`y` select the first pixel and `width`/`height` are counts.

For freeform atlases:

- `content` is the tight union of non-zero-alpha pixels assigned to that visible region.
- `sample` expands the content by two pixels on all sides without altering the PNG.
- The runtime-facing UV listed below is `[uMin,vMin,uMax,vMax]` in Three.js bottom-left convention with a half-texel inset.
- Sampling discards alpha at or below `8/255`. Every sample boundary is alpha 0 except two background regions whose maximum boundary alpha is 2, still below that threshold.
- Freeform regions do not establish a uniform atlas grid. No repeat or non-uniform stretch is allowed.

The exact formula is:

`uMin=(x+0.5)/W`, `uMax=(x+width-0.5)/W`, `vMin=1-(y+height-0.5)/H`, `vMax=1-(y+0.5)/H`.

## Border/corners atlas

The seven source regions are measurable. Their names below describe visible content only; they do not prove which board side or corner each region owns.

| # | Visible region | Content x,y,w,h | Sample x,y,w,h | Three.js inset UV |
|---:|---|---|---|---|
| 0 | long edge with endcaps | `77,81,867,146` | `75,79,871,150` | `[0.0737304688,0.7768554688,0.9233398438,0.9223632812]` |
| 1 | low wall, left-facing | `46,289,395,141` | `44,287,399,145` | `[0.0434570312,0.5786132812,0.4321289062,0.7192382812]` |
| 2 | low wall, right-facing | `544,289,432,139` | `542,287,436,143` | `[0.5297851562,0.5805664062,0.9545898438,0.7192382812]` |
| 3 | broken wall | `247,483,506,162` | `245,481,510,166` | `[0.2397460938,0.3686523438,0.7368164062,0.5297851562]` |
| 4 | corner, left-facing | `44,685,254,247` | `42,683,258,251` | `[0.0415039062,0.0883789062,0.2924804688,0.3325195312]` |
| 5 | corner, centered view | `373,720,262,193` | `371,718,266,197` | `[0.3627929688,0.1069335938,0.6215820312,0.2983398438]` |
| 6 | corner, right-facing | `722,687,246,253` | `720,685,250,257` | `[0.7036132812,0.0805664062,0.9467773438,0.3305664062]` |

The established placement rules still apply: front/+z must be flat, sides must stay low, back/−z may be broken-medium, all pieces stay outside x `[-4,4]` and z `[-3.5,3.5]`, and the anchor is bottom-center. Repeating a region or stretching one axis is forbidden.

Runtime binding remains **unresolved** because no authored legend labels these seven images as front/back/left/right/specific corners, and no approved world width, height, or plane orientation exists. The smallest missing evidence is one reviewed legend containing those fields. The production composite is review-only and is not a cell placement map.

## Background-modules atlas

| # | Visible module | Content x,y,w,h | Sample x,y,w,h | Three.js inset UV |
|---:|---|---|---|---|
| 0 | curved terrace, left-facing | `43,32,439,290` | `41,30,443,294` | `[0.0405273438,0.6840820312,0.4721679688,0.9702148438]` |
| 1 | curved terrace, right-facing | `546,42,428,277` | `544,40,432,281` | `[0.5317382812,0.6870117188,0.9526367188,0.9604492188]` |
| 2 | ruined arch | `69,353,370,302` | `67,351,374,306` | `[0.0659179688,0.3588867188,0.4301757812,0.6567382812]` |
| 3 | arena stair platform | `497,354,460,311` | `495,352,464,315` | `[0.4838867188,0.3491210938,0.9360351562,0.6557617188]` |
| 4 | small fortified tower | `115,675,293,290` | `113,673,297,294` | `[0.1108398438,0.0561523438,0.3999023438,0.3422851562]` |
| 5 | ruined gate/tunnel | `556,666,356,320` | `554,664,360,324` | `[0.5415039062,0.0356445312,0.8920898438,0.3510742188]` |

Visible identities are strong enough for descriptive semantics, but not for exact world placement. The current contract allows radius 9–13 on back/left/right only and forbids the front. Bottom-center anchoring, uniform scale, no repeat, and no overlap with the board, units, HP bars, projectiles, target indicators, or UI risk bands are mandatory.

Runtime binding remains **unresolved** because no reviewed module-to-slot coordinates, world heights, facing rules, or quality subsets exist. The smallest missing evidence is one locked-camera placement review with exactly those values. If approved later, placement must use a checked-in fixed table; per-run randomness is forbidden.

## Props atlas

| # | Visible prop | Content x,y,w,h | Sample x,y,w,h | Three.js inset UV |
|---:|---|---|---|---|
| 0 | broken column | `48,32,289,342` | `46,30,293,346` | `[0.0454101562,0.6333007812,0.3305664062,0.9702148438]` |
| 1 | block rubble | `396,122,299,253` | `394,120,303,257` | `[0.3852539062,0.6323242188,0.6801757812,0.8823242188]` |
| 2 | red banner | `788,17,171,356` | `786,15,175,360` | `[0.7680664062,0.6342773438,0.9379882812,0.9848632812]` |
| 3 | rock rubble | `60,467,252,189` | `58,465,256,193` | `[0.0571289062,0.3579101562,0.3061523438,0.5454101562]` |
| 4 | carved ruin rubble | `385,462,291,214` | `383,460,295,218` | `[0.3745117188,0.3383789062,0.6616210938,0.5502929688]` |
| 5 | blue banner | `762,376,168,328` | `760,374,172,332` | `[0.7426757812,0.3110351562,0.9096679688,0.6342773438]` |
| 6 | unlit brazier shell | `70,720,233,232` | `68,718,237,236` | `[0.0668945312,0.0688476562,0.2973632812,0.2983398438]` |
| 7 | dry grass | `384,727,220,223` | `382,725,224,227` | `[0.3735351562,0.0708007812,0.5913085938,0.2915039062]` |
| 8 | round stone dais | `675,751,302,214` | `673,749,306,218` | `[0.6577148438,0.0561523438,0.9555664062,0.2680664062]` |

Every prop remains outside the 8×7 board and touch paths. Tall front props are forbidden. Raycast is disabled and no prop joins `tileMeshes` or unit bodies. Uniform scale is the only allowed scaling; rotation and jitter are unsafe until individually reviewed. Existing procedural props range from low rubble to a 1.9-world-unit broken column, but that is only a maximum silhouette reference, not approval of a per-region height.

Runtime binding remains **unresolved** because region-to-slot, world height, facing, rotation, and quality-tier records are absent. The round dais has an additional target/AoE-confusion risk. The smallest missing evidence is a labeled locked-camera prop placement sheet including that readability check.

## Tile-state atlas: resolved 4×3 contract

Cells are indexed row-major from the authored PNG top-left. Each cell is exactly 256×256. Three.js UVs flip the authored y direction and use a half-texel inset. Measured transparent edge clearance is at least 11 pixels. Cells 9–11 contain exactly zero non-zero-alpha pixels.

The texture is an overlay, not a replacement for gameplay tiles. Material opacity is `1`; the source alpha already carries the intended strength. Use `NormalBlending`, depth test on, depth write off, and one resolved cell per tile at y `0.006`.

| Index | State | Row,col | Pixel x,y,w,h | Three.js inset UV | Max alpha | Current binding | Priority |
|---:|---|---|---|---|---:|---|---:|
| 0 | normal | 0,0 | `0,0,256,256` | `[0.0004882812,0.6673177083,0.2495117188,0.9993489583]` | 97 | ready: quiet tile (`opacity=1`, color=`baseTint`) | 10 |
| 1 | hover | 0,1 | `256,0,256,256` | `[0.2504882812,0.6673177083,0.4995117188,0.9993489583]` | 184 | deferred: no exact runtime signal | 40 |
| 2 | selected | 0,2 | `512,0,256,256` | `[0.5004882812,0.6673177083,0.7495117188,0.9993489583]` | 233 | deferred: no exact per-tile runtime signal | 60 |
| 3 | deploy-valid | 0,3 | `768,0,256,256` | `[0.7504882812,0.6673177083,0.9995117188,0.9993489583]` | 208 | ready: `0x8fe6a8` field or `0x9fd8e8` bench, opacity 1 | 30 |
| 4 | deploy-invalid | 1,0 | `0,256,256,256` | `[0.0004882812,0.3339843750,0.2495117188,0.6660156250]` | 225 | ready: `0xe07a70`, opacity 0.72 | 80 |
| 5 | enemy-zone | 1,1 | `256,256,256,256` | `[0.2504882812,0.3339843750,0.4995117188,0.6660156250]` | 159 | deferred: no exact runtime signal | 20 |
| 6 | target | 1,2 | `512,256,256,256` | `[0.5004882812,0.3339843750,0.7495117188,0.6660156250]` | 233 | deferred: no exact runtime signal | 70 |
| 7 | AoE | 1,3 | `768,256,256,256` | `[0.7504882812,0.3339843750,0.9995117188,0.6660156250]` | 218 | deferred: no exact runtime signal | 50 |
| 8 | disabled | 2,0 | `0,512,256,256` | `[0.0004882812,0.0006510417,0.2495117188,0.3326822917]` | 165 | deferred: no exact runtime signal | 90 |
| 9 | unused | 2,1 | `256,512,256,256` | `[0.2504882812,0.0006510417,0.4995117188,0.3326822917]` | 0 | never bind | — |
| 10 | unused | 2,2 | `512,512,256,256` | `[0.5004882812,0.0006510417,0.7495117188,0.3326822917]` | 0 | never bind | — |
| 11 | unused | 2,3 | `768,512,256,256` | `[0.7504882812,0.0006510417,0.9995117188,0.3326822917]` | 0 | never bind | — |

Visual precedence, highest first: `disabled > deploy-invalid > target > selected > AoE > hover > deploy-valid > enemy-zone > normal`. This selects one visual cell and never stacks state planes. It is visual precedence only; it creates no gameplay state.

PR #55 currently exposes only three exact visual signals. Therefore only `normal`, `deploy-valid`, and `deploy-invalid` are safe for the next runtime round. The other six semantic cells are fully mapped but must remain unbound until the runtime exposes an explicit, already-authorized per-tile signal.

## Runtime ownership

| Concern | Existing owner at PR #55 | Contract owner/result |
|---|---|---|
| `boardSurface` | `buildBoardSurface` + `attachProductionBoardArt` in `src/map-theme-runtime.js` | unchanged |
| Tile-state gameplay signal | `src/game.js:updateTileHighlights` | protected, read-only; no logic change |
| Tile-state visual | none | new subgroup under `boardSurface`, using current signals only |
| `arenaBorder` | procedural `buildArenaBorder`; unchanged scene stage frame also exists | production atlas remains deferred; procedural fallback stays |
| `background` | procedural `buildBackground` | production atlas remains deferred; procedural fallback stays |
| `props` | procedural `buildProps` | production atlas remains deferred; procedural fallback stays |
| `ambientVfx` | `buildAmbientVfx` | unchanged; no bitmap in this pack |
| `lightingProfile` | `buildLightingProfile` | unchanged; no bitmap in this pack |
| Perimeter ground | 60×60 mesh owned by `src/game.js`; theme swaps map/tint and restores on dispose | keep PR #55 ownership exactly |

Every future decorative mesh is non-raycast. Atlas textures, materials, and geometries use the existing map-theme owned-resource lifecycle and are disposed with `mapThemeRoot`. The existing procedural layer remains present until the corresponding production layer loads and applies successfully. A missing tile-state atlas leaves current tile material highlights visible.

## Layer and render-order contract

The order below is a visual/depth contract, not a demand to set `Object3D.renderOrder` everywhere.

| Visual order | Concern | Existing/proposed y | Explicit `renderOrder`? |
|---:|---|---:|---|
| 0 | terrain/perimeter | `-0.02` | no; opaque depth-tested ground |
| 10 | gameplay tile base | `0` | no; protected geometry |
| 20 | PR #55 board surface | `0.002` | no |
| 30 | PR #55 bench treatment | `0.003` | no |
| 40 | existing procedural cracks/moss | `0.004..0.006` | no; moss is outside the board |
| 50 | tile-state overlay | `0.006` | no; one state plane and y separation are sufficient |
| 60 | unit shadows | `0.01` | no; must remain above tile states |
| 70 | linked rings and ground VFX | `0.02..0.05` | no; must remain above static states |
| 80 | border/background/props | world geometry/planes | no global override; depth and non-overlap must protect gameplay |
| 90 | units, projectiles, HP/world UI | existing positions | no scenery override may force itself over them |
| 100 | ambient VFX / lights | existing | existing material behavior; lights have no render order |

Opaque 3D elements, units, projectiles, shadows, and HP/world UI retain normal depth behavior. Transparent atlas planes use depth test on and depth write off. Border/background/prop billboards are still deferred, so no speculative transparent sorting rule is introduced.

## Color space and filtering

Required for compatibility/correctness:

- Preserve PR #55's current pass-through/default encoding. `game.html` uses Three.js r128 and the renderer has no explicit sRGB output configuration. Setting only these atlases to `THREE.sRGBEncoding` would create a partial color-management migration.
- `ClampToEdgeWrapping` on both axes.
- `LinearFilter` for min/mag; `generateMipmaps=false` for all four atlases.
- Use the half-texel UVs above and alpha discard `8/255`.
- Straight alpha: `premultipliedAlpha=false`, transparent material, `NormalBlending`, depth test on, depth write off.

Recommended for quality:

- Material opacity 1 because PNG alpha already encodes strength.
- Anisotropy 1 with this no-mipmap atlas policy.
- Avoid overlapping transparent billboards; preserve aspect ratio through uniform scale.

Optional future work:

- A separately generated, hash-tracked atlas derivative with extruded gutters may supply custom mipmaps after visual review.
- A full renderer-wide sRGB migration is valid only as a separate task with all textures and runtime screenshots revalidated together.

## Exact next integration boundary

### Safe to integrate now

Only the tile-state subset is complete enough:

1. Use PR #55's existing failure-safe `fileTexture` seam inside `src/map-theme-runtime.js`.
2. Add one non-raycast tile-state subgroup under `boardSurface` at y `0.006`; share one atlas texture/material and use the exact UVs in this contract.
3. Bind only `normal`, `deploy-valid`, and `deploy-invalid` by read-only observation of the current tile material signals.
4. Keep one resolved state cell per tile, source alpha at material opacity 1, and the existing procedural/material fallback.
5. Do not change `src/game.js`.

### Must remain deferred

- Every border/corner runtime binding until the seven-region side/corner legend and world sizes exist.
- Every background-module binding until exact module-to-slot positions, heights, facing, and quality subsets exist.
- Every prop binding until exact prop-to-slot positions, heights, facing/rotation, quality subsets, and round-dais readability are approved.
- `hover`, `selected`, `enemy-zone`, `target`, `AoE`, and `disabled` until explicit runtime signals exist.
- Automatic atlas mipmaps, partial sRGB changes, Map 2–3, and any artwork change.

### Protected areas

`src/game.js`; Core Logic; Combat; targeting; pathfinding; economy; stage logic; main loop; board dimensions; `gridToWorld`; camera/contain-fit/gameplay geometry; Map 2–3; Motion-source PRs #50–#52 and #54 and all Motion source assets; character animation assets. PR #53 remains the Board readiness audit and is this contract's base.

## Required validation after the future integration

- PR #49 production-pack validator from its exact guarded worktree.
- PR #55 runtime-integration validator, updated only to allow the contract-proven tile-state path and current three bindings.
- Map-theme runtime test and asset-animation runtime regression.
- Exact checks for 56 state meshes, one shared atlas texture, three current bindings only, source UVs, missing-file fallback, dispose/reload, and zero raycast membership.
- Existing highlight behavior: field valid, bench valid, occupied invalid, highlight clear/restore.
- 8×7, row contracts, camera/contain-fit, pilot readability, 1280×720 and 844×390.
- x4 gameplay/motion regression with no new errors.

## Contract conclusion

Resolved without guessing: all four atlas pixel layouts; all normalized UVs; nine tile-state semantics; three current runtime bindings; ownership, texture, disposal, raycast, fallback, and layer-depth rules.

Still unresolved by design: board-side/corner identity and scale for the border atlas; module-to-slot/scale/facing for background; prop-to-slot/scale/facing for props; six unavailable runtime tile-state signals.

`canonicalApproved=false`

No runtime, Core Logic, gameplay, camera, artwork, Map 2–3, or Motion source change is part of this contract. No PR is merged.
