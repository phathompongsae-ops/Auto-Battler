# Arena Ruins Static Board Production Pack v1

Status: **asset-source ready for separate CC integration — not integrated, not final-approved**

- Base: Draft PR #48, `coco/arena-ruins-board-implementation-contract-v1`
- Exact base SHA: `ca5d91972f9a26fea641f2f26b41312de5d2157b`
- Branch: `coco/arena-ruins-static-board-production-pack-v1`
- Reference: attached `1000042598.png`
- Contract: `data/design/arena-ruins-board-asset-registry-v1.json`
- Approval: `canonicalApproved=false`

This pack supplies seven static PNG source assets and four review artifacts. It does not edit a loader, Three.js scene, camera, board geometry, tile logic, UI, Core Logic, or gameplay. The assets are deliberately stored outside current runtime paths and require a separate CC integration task after visual approval.

## Production files

| File | Dimensions / format | Alpha | Purpose |
|---|---|---|---|
| `arena-ruins-board-surface-v1.png` | 1024×896 RGB8 | opaque | exact 8×7 surface, 128 px per tile |
| `arena-ruins-border-corners-v1.png` | 1024×1024 RGBA8 | true alpha | 7 isolated flat/side/back/corner modules |
| `arena-ruins-perimeter-ground-v1.png` | 512×512 RGB8 | opaque | quiet seamless repeat ground |
| `arena-ruins-background-modules-v1.png` | 1024×1024 RGBA8 | true alpha | 6 isolated wall/arch/step/tower modules |
| `arena-ruins-bench-treatment-v1.png` | 1024×128 RGBA8 | true alpha | subtle overlay for integrated row 6 |
| `arena-ruins-tile-states-v1.png` | 1024×768 RGBA8 | true alpha | 9 visual-state cells; 3 unused cells transparent |
| `arena-ruins-props-v1.png` | 1024×1024 RGBA8 | true alpha | 9 isolated stone/banner/brazier/vegetation props |

All source assets live in `assets/maps/arena-ruins/board/`. None contains a pilot, HP bar, baked UI, projectile, VFX, selection state on the board base, character shadow, text, logo, or proprietary symbol.

## Art direction and origin

The attached reference image supplied floor temperature, stone family, border weight, enclosure darkness, warm light, bench relationship, and environmental density principles. Reference-Matched Preview v2 supplied the exact Auto-Battler 8×7 footprint, darker seventh row, fixed camera composition, and established palette. The production details are new: cracks, module silhouettes, plain banners, masonry patterns, and props were not traced from the reference UI or decorative symbols.

Built-in image generation produced original raster source material for border, background modules, props, and perimeter stone. Deterministic processing then removed the generator's connected light/checker background, created true alpha, normalized every file to the contract dimensions, rebuilt the perimeter as an exact mirror-seam tile, created bench/tile-state overlays, and encoded production PNGs as 8-bit RGB/RGBA.

Original generated files were preserved outside the repository. Invalid/intermediate renders were also preserved before replacement: the first tile-state render was 16-bit and contained an invalid draw; the first perimeter tile had dither-caused edge mismatches; the first bench overlay was 16-bit; and the first contact-sheet/mobile renders were 16-bit. Their hashes are recorded in the pack manifest.

## 8×7 and bench readability

The board surface contains exactly 8 columns and 7 rows. Rows 0–5 remain combat surface; row 6 remains the darker integrated bench. No eighth row was introduced. Bench overlay seams use the same eight-column rhythm, while the runtime's usable bench columns remain 0–4 and are not encoded as gameplay logic.

Tile centers stay broad and quieter than seams. Cracks are sparse and concentrated near seams/intersections. The surface contains no permanent cyan combat accent or dense green moss, protecting Slime and Archer. The border/perimeter use darker values to retain Golem silhouette separation.

## Alpha, border and checkerboard findings

- All five alpha assets are 8-bit PNG color type 6 (RGBA).
- All four corners and every outer-border pixel are transparent in each alpha asset.
- Alpha non-zero fractions are plausible for their roles: border 0.331762, background modules 0.378282, bench 0.861328, tile states 0.527039, props 0.332923.
- The three unused tile-state atlas cells are fully transparent.
- The light/checker generator backgrounds are absent from the required production files; no near-white neutral checker residue remains above the forensic threshold.
- The perimeter texture has zero mismatching pixels for left↔right and top↔bottom edges.

## Review artifacts

- `production-pack-contact-sheet.png`: all seven sources on a dark review background with labels.
- `production-pack-composited-preview.png`: surface and bench overlay composited into the locked v2 frame.
- `production-pack-with-pilots.png`: unchanged Archer, Slime, and Golem sources at tiles `[1,4]`, `[4,1]`, and `[6,2]`.
- `production-pack-mobile-preview.png`: 844×390 readability simulation.

Labels exist only in the contact sheet. Production PNGs contain no text.

## Pilot and mobile review

- Archer remains readable against warm tile centers; future runtime placement should keep green moss out of its immediate background.
- Slime retains the strongest warm/cool separation; cyan remains absent from base production art.
- Golem remains the highest stone-on-stone risk but reads through scale/block silhouette and darker surrounding values. The exact-base Golem is still a pixel-style placeholder, so final polished-Golem approval remains unresolved.
- All three review pilots preserve source aspect ratio and remain uncropped. Their source hashes are unchanged.
- At 844×390, tile rhythm, darker bench, border silhouette, and pilot placement remain identifiable. Fine cracks correctly recede.

## Memory and integration status

The source registry's conservative decoded RGBA8 budget is 20 MiB; a full mip chain would be about 26.67 MiB. Actual seven-PNG transfer size is 3,080,259 bytes. These figures do not include review artifacts.

The pack is not in the game. External file loading, atlas UVs, color-space assignment, perimeter-ground ownership, explicit render order, full tile-state bindings, browser overlap, and runtime filtering/mipmap decisions remain CC integration blockers.

## Quality state and unresolved items

- Asset structure and source validation can be checked now, but none of the three future runtime review checkpoints is claimed as passed.
- The review compositing is deterministic, not a live browser/Three.js capture.
- No browser/x4 claim is made.
- Visual approval remains required before CC integrates paths.
- `canonicalApproved=false` remains locked in the manifest and every source registry entry.

`canonicalApproved=false`
