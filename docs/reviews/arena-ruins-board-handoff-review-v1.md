# Arena Ruins Board Handoff Review v1

Status: **source-art handoff review — no runtime integration, no merge**

- Production branch: `coco/arena-ruins-static-board-production-pack-v1`
- Production Draft PR: #49
- Phase D exact published head before this review: `278ca10be6728066984ea1046a2a0334efae7e3b`
- Reference image: `1000042598.png` (`194d941b5b10a2888f209336d6d1bf2e975df28359b86529dc711875d7111547`)
- Approval: `canonicalApproved=false`

This document records handoff facts and a recommended CC integration sequence. It is not an integration instruction prompt, does not authorize runtime changes, and does not claim that source assets are final-approved or already visible in game.

## PR dependency chain

1. **PR #43 — Arena Ruins Final Board Art Production Plan v1** established the documentation/metadata production direction and runtime constraints.
2. **PR #46 — Arena Ruins Board Concept Preview v1** established the locked 8×7/camera reconstruction and initial pilot readability baseline.
3. **PR #47 — Reference-Matched Board Concept Preview v2** applied the attached reference's material, enclosure, lighting, and composition principles without changing runtime framing.
4. **PR #48 — Board Implementation Contract v1** defined machine-readable placement, camera alignment, safe areas, seven production files, memory budget, and integration blockers.
5. **PR #49 — Static Board Production Pack v1** contains the seven real PNG source assets, manifest, review artifacts, and validator. This handoff review is an additional documentation commit in PR #49.

Every PR in this chain remains unmerged at the time of review.

## Reference usage

The attached reference image was used as the visual master for warm floor tone, stone material family, heavy border, dark perimeter framing, arena enclosure, bench relationship, and warm fantasy lighting. Auto-Battler's v2 preview remained the source of truth for board footprint, 8×7 tile count, row 6 bench, camera framing, pilot placement, and gameplay readability.

Reference UI, text, logos, icons, characters, and proprietary decorative symbols were not transferred. Production modules, cracks, plain banners, masonry arrangements, and props are new Auto-Battler source details.

## Locked for handoff

- Board is 8 columns × 7 rows, 56 tiles; no eighth row.
- Combat rows are 0–5; deploy rows are 3–5.
- Integrated bench is row 6; usable bench columns remain 0–4.
- Camera remains orthographic: pitch 45°, yaw 90°, distance 20, target `[0,0,1.3]`.
- Contain-fit constants remain `BOARD_FILL_RATIO=0.97` and `BOARD_DOWN_BIAS=0.97`.
- Runtime layer names remain `boardSurface`, `arenaBorder`, `background`, `props`, `ambientVfx`, and `lightingProfile`.
- Source filenames, dimensions, RGB/RGBA requirements, source hashes, and memory budget are locked by the Phase D manifest/validator.
- Production sources contain no pilots, UI, combat state, VFX, projectiles, character shadows, or text.
- `canonicalApproved=false` remains locked.

## Not locked / unresolved

- Visual approval of the source pack is still pending.
- No external map-theme file loader or repository-path registry exists.
- No atlas cell/UV-to-geometry contract exists.
- Final Three.js color-space, filtering, anisotropy, and mipmap policy is unresolved.
- The 60×60 perimeter ground is owned by `src/game.js`, outside `mapThemeRoot`; ownership transfer is unresolved.
- Theme insertion order exists, but explicit `renderOrder` does not.
- Runtime only exposes normal, placement-valid, and placement-invalid material behavior; six additional tile-state bindings are unresolved.
- DOM-dependent top/left/right/bottom UI overlap, fullscreen, portrait/landscape, and shop-open coverage still need browser measurement.
- The exact-base Golem review source is a pixel-style placeholder, so polished final-Golem contrast is unresolved.

## Production files CC may pull

Pull the following exact paths as source inputs only:

- `assets/maps/arena-ruins/board/arena-ruins-board-surface-v1.png`
- `assets/maps/arena-ruins/board/arena-ruins-border-corners-v1.png`
- `assets/maps/arena-ruins/board/arena-ruins-perimeter-ground-v1.png`
- `assets/maps/arena-ruins/board/arena-ruins-background-modules-v1.png`
- `assets/maps/arena-ruins/board/arena-ruins-bench-treatment-v1.png`
- `assets/maps/arena-ruins/board/arena-ruins-tile-states-v1.png`
- `assets/maps/arena-ruins/board/arena-ruins-props-v1.png`
- `assets/maps/arena-ruins/board/arena-ruins-static-board-pack-v1.json`
- `data/design/arena-ruins-board-implementation-contract-v1.json`
- `data/design/arena-ruins-board-layer-placement-v1.json`
- `data/design/arena-ruins-board-camera-alignment-v1.json`
- `data/design/arena-ruins-board-ui-safe-areas-v1.json`
- `data/design/arena-ruins-board-asset-registry-v1.json`

CC should verify the exact manifest SHA-256 values before integrating any PNG.

## Review-only files CC must not treat as runtime assets

The following paths support review/provenance and must not be registered as production textures:

- everything under `docs/assets/review/arena-ruins/reference-match-v2/`;
- everything under `docs/assets/review/arena-ruins/production-pack-v1/`;
- `docs/assets/arena-ruins-board-implementation-contract-v1.md`;
- this handoff review;
- any local generated-image source or preserved invalid/intermediate file outside Git.

The contact sheet, composited preview, pilot preview, mobile preview, comparison, alignment, readability, and implementation-zone images are not runtime assets.

## Safe-area notes

- No raised or opaque prop belongs inside board UV `[0,0]..[1,1]`.
- Projectile/target/AoE corridor covers combat rows 0–5.
- Unit-foot quiet area is the central 64% of each tile; edge-unit clearance covers the central 84% with no raised detail.
- HP-bar protection occupies the upper half of the projected unit billboard.
- Conservative screen risk bands are top 18%, left/right 32%, and bottom 22%; these are review metadata, not CSS replacements.
- Front/+z bench-side border must remain flat, side borders low, and back/−z border may be broken-medium.

## Pilot contrast and mobile notes

- Archer reads against warm stone, provided green moss remains sparse outside tile centers.
- Slime has strong warm/cool separation; permanent cyan surface accents remain prohibited.
- Golem is the highest stone-on-stone risk; quiet lighter tile centers and a darker outer enclosure are the board-side mitigation.
- Production review uses unchanged pilot sources only at `[1,4]`, `[4,1]`, and `[6,2]`.
- The 844×390 review preserves the 8×7 grid, darker bench, border silhouette, and three pilot silhouettes. This is not a live-device or browser result.

## Source quality facts

- Seven production PNGs decode and have unique SHA-256 values.
- All RGBA assets are 8-bit PNG color type 6 with transparent corners and zero nontransparent outer-border pixels.
- Checker/light-background forensic candidates are zero.
- The three unused tile-state atlas cells are fully transparent.
- Perimeter left/right and top/bottom edge mismatches are zero.
- Source transfer size is 3,080,259 bytes; conservative decoded RGBA8 budget is 20 MiB, or about 26.67 MiB with a full mip chain.
- No runtime/browser/x4 checkpoint is claimed as passed.

## Recommended CC integration sequence

1. **Path and loader seam:** add a Map 1-only, failure-safe external asset registry/loader without changing board/camera/gameplay; preserve the current procedural fallback.
2. **Surface and bench:** bind the 8×7 board surface and bench treatment against the exact UV/world bounds; verify row orientation before other art.
3. **Border and modules:** define atlas cells/UVs, alpha-edge handling, and back/side/front placement; verify no edge-unit or HP-bar occlusion.
4. **Perimeter ownership:** explicitly decide whether the existing `src/game.js` ground stays scene-owned or moves under theme ownership; do not silently duplicate planes.
5. **Props and quality fallback:** bind only safe-zone placements and define high/medium/low module subsets.
6. **Tile states:** initially bind only runtime-supported states; add no new gameplay state in an art integration task.
7. **Browser review:** measure desktop/mobile/fullscreen/shop-open UI overlap, texture filtering, seams, memory, pilot contrast, and x4 regression before any canonical decision.

Each step should be path-limited and preserve the existing procedural fallback until the replacement has passed review.

## Handoff state

Ready now: source-art download, hash verification, visual review, loader/UV planning, and a separate CC integration task.

Still required: visual approval, runtime integration, browser/device measurements, x4 gameplay regression, and an explicit canonical approval decision.

`canonicalApproved=false`

No runtime integration has occurred. No PR has been merged.
