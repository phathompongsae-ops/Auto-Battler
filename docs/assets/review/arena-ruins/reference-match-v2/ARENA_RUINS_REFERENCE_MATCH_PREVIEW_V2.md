# Arena Ruins Reference-Matched Board Concept Preview v2

Status: **preview/mockup only — not final board artwork**

- Base: Draft PR #46, `coco/arena-ruins-board-concept-preview-v1`
- Exact base SHA: `da53c453f12d9b17d9dbe6955d64f9d824605003`
- Branch: `coco/arena-ruins-reference-matched-board-preview-v2`
- Visual reference: `1000042598.png`
- Visual-reference SHA-256: `194d941b5b10a2888f209336d6d1bf2e975df28359b86529dc711875d7111547`
- Approval: `canonicalApproved=false`

This review set applies the material, lighting, enclosure, and composition principles visible in the attached reference image to Auto-Battler's existing Preview v1. It preserves the runtime board footprint, camera orientation, integrated bench, and pilot scale. It does not copy the reference game's UI, labels, icons, characters, logos, or proprietary decorative symbols. It does not integrate art, modify the runtime camera or geometry, or alter gameplay.

## Runtime board, bench, and deploy rows

The locked facts below were verified from the repository at the base commit.

| Constraint | Runtime value |
|---|---:|
| Board | 8 columns × 7 rows (56 tiles) |
| Combat rows | `0..5` |
| Deploy rows | `3..5` |
| Integrated bench | row `6`; usable columns `0..4` |
| Tile scale | `1` world unit |
| Camera | orthographic |
| Pitch / yaw | `45°` / `90°` |
| Distance | `20` |
| Look target | `[0,0,1.3]` |
| `BOARD_FILL_RATIO` | `0.97` |
| `BOARD_DOWN_BIAS` | `0.97` |
| Review viewport | 1536×1024 |

The camera preview uses the same deterministic projection reconstruction and contain-fit/down-bias assumptions as Preview v1. The live game derives top-bar clearance from the DOM, so a browser capture is still required for final breakpoint-level confirmation. No runtime camera value was changed.

## Preview v1 used as the geometry master

`docs/assets/review/arena-ruins/arena-ruins-board-concept-v1.png` supplied the board footprint, corner placement, 8×7 tile count, darker seventh bench row, and camera composition. The attached `1000042598.png` supplied the visual principles for warm stone, border mass, perimeter darkness, enclosure, warm lighting, and environmental density. Both images were passed as real image inputs to the built-in image-generation workflow; the reference was not inferred from its text description.

## Reference analysis

### Must Match Closely

- The board remains the dominant central shape under an elevated isometric/top-down camera feeling.
- Tile centers use warm sand and brown stone, with a clear light-middle/dark-perimeter hierarchy.
- The playable surface is enclosed by a thick, weighty stone border and a darker arena silhouette.
- The lower edge reads as an integrated bench relationship, not an eighth combat row.
- Warm torches, sparse banners, broken masonry, and restrained vegetation establish a fantasy-arena atmosphere.
- Illumination is warm and directional with soft falloff; the perimeter frames the board rather than competing with it.

### Match Where Runtime Allows

- Corner towers, broken walls, rubble groups, steps, banners, and vegetation were reinterpreted around the locked board footprint.
- The reference's raised enclosure and deep background were compressed into the available surround without moving the board or camera.
- A shallow channel/moat impression is represented through dark gaps and border depth instead of introducing new geometry.
- Prop count and asymmetry are reduced where the fixed frame leaves little clearance for tiles, pilots, or health bars.

### Adapt for Gameplay Readability

- Tile centers are quieter than seams, cracks, border stones, and perimeter props.
- Permanent cyan accents are excluded from the playable surface so Slime and cyan effects remain readable.
- Green moss is sparse and kept mainly outside combat tile centers to protect Archer's green silhouette.
- Golem positions use lighter/warm tile centers against a darker border; future art should preserve a value break around its feet and torso.
- Props remain outside pilot and health-bar envelopes. The overlay image demonstrates enemy, deploy, bench, selected, target, and AoE readability without adding logic.
- Tile seams remain broad enough to survive the supplied mobile review downscale.

## Artifacts

| File | Review role |
|---|---|
| `camera-preview-runtime-v2.png` | Locked runtime framing with the v2 board, no pilots or explanatory overlay |
| `arena-ruins-reference-match-board-only-v2.png` | Reference-matched board, border, and perimeter review |
| `arena-ruins-reference-match-with-pilots-v2.png` | Unchanged repository pilots composited at fixed review tiles |
| `arena-ruins-reference-match-readability-v2.png` | Visual-only enemy/deploy/bench and selected/target/AoE review overlay |
| `arena-ruins-reference-comparison-v2.png` | Labeled side-by-side reference, Preview v1, and Preview v2 review artifact |
| `arena-ruins-reference-match-mobile-crop-v2.png` | 844×390 mobile-scale readability simulation |
| `reference-alignment-guide-v2.png` | Labeled runtime bounds and 8×7 alignment guide |

The five full-frame images are 1536×1024. The comparison is 1536×433 and the mobile simulation is 844×390. The main review PNGs use indexed 64-color transport copies to remain within the available binary-upload envelope. Their truecolor pre-quantization originals and hashes were preserved locally before replacement; this is a preview transport optimization, not a final production-art format decision.

`camera-preview-runtime-v2.png` and `arena-ruins-reference-match-board-only-v2.png` intentionally share identical rendered pixels because both communicate the same locked camera/base-board view for different review questions.

## Pilot sources and fixed placement

Existing repository assets were composited without regeneration, retouching, recoloring, stretching, or source-file modification.

| Pilot | Source | SHA-256 | Tile | Composite size |
|---|---|---|---:|---:|
| Archer | `assets/units/hero.archer/idle/hero.archer_idle_000.png` | `4a1a24f9e691d48aeef55c235a47af07931032e6345b159122f0128d7aa7e888` | `[1,4]` | 92×138 |
| Slime | `assets/units/monster.slime/move/monster.slime_move_000.png` | `12ca260a001dbda6177f29565e9df2c369c09216c889974aeee8b12fb5ae04f9` | `[4,1]` | 96×96 |
| Golem | `assets/mon_golem.png` | `50a51034e08f7ca479a036bb17488c58192480204487bcded48d91838b0db42e` | `[6,2]` | 111×148 |

The placement is fixed across the pilot and mobile composites. Contact shadows and health bars exist only in review composites and are not written into pilot source PNGs.

## Preview v1 to v2 differences

- v2 replaces v1's cool, open ruin perimeter with a denser, darker arena enclosure and heavier border.
- The floor shifts toward warmer sand/brown stone and a stronger center-versus-perimeter value hierarchy.
- Torches, banners, steps, broken walls, rubble, and vegetation add depth while remaining outside the playable centers.
- Tile centers are cleaner and more uniform; cracks are concentrated at seams and selected isolated slabs.
- The seventh row remains visually darker and integrated as the bench; it has not moved or become a combat row.

## Pilot contrast observations

- Archer is readable through its green hue and narrow silhouette; dense green moss behind tile `[1,4]` would be a future risk.
- Slime has strong warm/cool separation at `[4,1]`; permanent cyan floor decoration remains prohibited in that area.
- Golem is readable by size and block silhouette at `[6,2]`, but its warm gray/brown values remain the highest collision risk against stone. A quiet, slightly lighter tile center and darker outer silhouette are the board-side mitigation.
- All three pilots are fully contained, aspect-ratio preserved, grounded at their tile feet, and unchanged at source.

## Mobile readability observations

At 844×390, the full 8×7 grid, darker bench row, outer border, and three pilot silhouettes remain identifiable. Fine cracks and small rubble become secondary, which is desirable. Health bars remain legible as shapes, while precise UI text is intentionally outside this mockup's scope. Final production should prioritize large value groups and seam rhythm over additional high-frequency floor detail.

## Alignment and quality notes

- Board-only, camera, pilot, readability, and alignment images use the same 1536×1024 footprint and unchanged board corners.
- The generated v2 board was normalized horizontally against Preview v1's runtime bounds; the pre-normalization image and truecolor originals were preserved locally with hashes before replacement.
- One initially rendered readability PNG was truncated. Its original hash (`26fa700bb6d836d275ca5c5c93964ff048ec5aae57d5475242d669498f490f70`) is preserved locally as an invalid backup and excluded from version control; the required artifact was fully decoded and rebuilt.
- No source pilot file, Preview v1 file, runtime file, or Core Logic file was deleted or modified.

## Unresolved items

- These camera images are deterministic projection reconstructions, not live browser screenshots; live DOM top-bar overlap, fullscreen behavior, and device breakpoints remain unmeasured.
- The exact-base Golem source is a pixel-style placeholder, so polished final-Golem contrast cannot be approved from this preview.
- The mockup has not been run through Three.js lighting, texture filtering, mipmaps, or mobile GPU memory checks.
- Border/perimeter elements are still one concept image, not production-separated assets or runtime geometry.
- The reference match is intentionally approximate and principle-based; it is not a 100% match and does not reproduce reference UI or proprietary symbols.

## Recommendation

Approve v2 as the visual basis for a documentation/metadata-only implementation contract, while keeping final visual approval and runtime/browser validation unresolved. A v3 is only warranted if review requests a materially different material temperature, enclosure density, or border silhouette. Final board production and CC runtime integration remain separate work.

`canonicalApproved=false`
