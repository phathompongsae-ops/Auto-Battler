# Arena Ruins Board Concept Preview v1

Status: **preview/mockup only — not final board artwork**

- Base: PR #43, `coco/arena-ruins-final-board-art-plan-v1`
- Exact base SHA: `80ca5b942e6777ca7f083cf6e9e2d6604b531905`
- Branch: `coco/arena-ruins-board-concept-preview-v1`
- Approval: `canonicalApproved=false`

This review set explores how an Arena Ruins board can read inside the locked game layout. It does not add final textures, integrate art into the scene, or alter runtime, camera, geometry, gameplay, UI, character assets, or map-theme ownership.

The later reference image `1000042598.png` was **not used** as a visual master for v1. It is reserved for a separately authorized Reference-Matched Preview v2 after this v1 branch has a Draft PR and exact head SHA.

## Verified runtime board and camera

The values below were read from `src/game.js` at the exact base commit.

| Constraint | Runtime value |
|---|---:|
| Board | 8 columns × 7 rows (56 tiles) |
| Combat rows | `0..5` |
| Player deploy rows | `3,4,5` |
| Integrated bench | row `6`; usable bench columns `0..4` |
| Tile scale | `1` world unit |
| Camera type | orthographic |
| Camera pitch / yaw | `45°` / `90°` |
| Camera distance | `20` |
| Look target | `[0,0,1.3]` |
| Contain-fit | projected runtime board corners |
| `BOARD_FILL_RATIO` | `0.97` |
| `BOARD_DOWN_BIAS` | `0.97` |
| Topbar clearance | live DOM bottom + `6 px` |

The fixed review viewport is 1536×1024. Camera previews reconstruct the orthographic projection and contain-fit equations using the constants above. They do not modify the runtime camera. The live game measures topbar height from the DOM; the reconstruction uses a 42 px topbar-bottom proxy plus the locked 6 px pad. A live browser capture is therefore still required to confirm the final few pixels of topbar clearance at each breakpoint.

## Preview artifacts

| File | Purpose | Continuation status |
|---|---|---|
| `camera-preview-full-board.png` | Locked full-board camera envelope and surrounding-space review | continued unchanged from the original untracked work |
| `camera-preview-board-only.png` | Same board footprint with surrounding distractions reduced | continued unchanged from the original untracked work |
| `camera-preview-with-pilots.png` | Runtime-scale pilot placement and contrast check | continued unchanged from the original untracked work |
| `arena-ruins-board-concept-v1.png` | Warm-stone, hand-painted Arena Ruins concept | continued from untracked work; normalized to the runtime footprint after preserving the original hash/file |
| `arena-ruins-board-concept-v1-with-pilots.png` | Same concept with unchanged repository pilot sources composited for review | repaired from a truncated untracked PNG, then recomposited after footprint normalization; original preserved |
| `arena-ruins-board-concept-v1-overlays.png` | Visual-only enemy/deploy/bench readability bands | continued from untracked work and recomposited after footprint normalization |

All six PNGs are 1536×1024, 8-bit sRGB, and review artifacts only. The three concept images share one aligned concept base; pilot and zone layers are composites over that base, so camera framing and board scale do not change among them. The concept trio is stored as indexed PNG8 with a 128-color review palette to keep each binary below the environment's GitHub upload limit; PSNR against the preserved aligned truecolor copies is 33.86–34.54 dB. This is appropriate for mockup review, not a final-art delivery format.

## Board concept summary

The v1 concept uses stylized 3D fantasy and hand-painted mobile-game treatment: warm sand-colored slabs, muted bronze/tan value grouping, cool blue-gray perimeter stone, broad tile centers, cracks concentrated near seams, and sparse broken arena structures outside the playable footprint. The integrated bench remains the darker seventh row. There is no baked UI, combat VFX, map logic, or character shadow in the board source.

The concept source was created with built-in image generation in a stylized-concept mode. The final prompt direction preserved an 8×7 board with a darker seventh bench row, locked the existing composition, requested polished hand-painted warm stone/sand/muted bronze with cool shadows and sparse perimeter ruins, and prohibited units, UI, text, VFX, photorealism, extra tiles, or a camera change. No external reference image was supplied to that generation.

## Pilot sources and placement

The composites use existing repository PNGs without regeneration, retouching, recoloring, stretching, or silhouette changes.

| Pilot | Repository source | SHA-256 | Review tile |
|---|---|---|---:|
| Archer | `assets/units/hero.archer/idle/hero.archer_idle_000.png` | `4a1a24f9e691d48aeef55c235a47af07931032e6345b159122f0128d7aa7e888` | `[1,4]` |
| Slime | `assets/units/monster.slime/move/monster.slime_move_000.png` | `12ca260a001dbda6177f29565e9df2c369c09216c889974aeee8b12fb5ae04f9` | `[4,1]` |
| Golem | `assets/mon_golem.png` | `50a51034e08f7ca479a036bb17488c58192480204487bcded48d91838b0db42e` | `[6,2]` |

These positions match `src/motion-test-harness.js`. The composite sizes preserve each source aspect ratio: Archer 92×138, Slime 96×96, and Golem 111×148 review pixels.

## Pilot readability observations

- Archer remains readable against the warm stone because the green costume does not share the board's main hue. Moss must remain sparse and outside tile centers in future art.
- Slime has the strongest hue/luminance separation. Future cyan board effects would be the main collision risk and should remain limited.
- Golem reads by scale and block silhouette, but the exact-base asset is a simple pixel-style placeholder and its tan/gray values can merge with warm stone. Cooler, quieter tile centers are the safest board-side correction.
- Health bars remain legible in both camera and concept composites. No pilot is cropped, recolored, retouched, or baked back into a character asset.

## Mobile readability observations

At a 16:9 mobile downscale, the 8×7 grid and darker bench row remain readable. Large value groups survive better than the fine cracks, so future production should keep tile centers low-frequency and concentrate damage at seams and the perimeter. The board already consumes most of the locked frame; distant background detail has little review value compared with border silhouette and near-perimeter structure.

## Readability overlay contract

`arena-ruins-board-concept-v1-overlays.png` is a visual review mockup only:

- rows `0..1`: restrained enemy-side rust band;
- row `2`: quiet neutral transition;
- rows `3..5`: restrained deploy-side teal band;
- row `6`: darker integrated-bench band.

It does not add selected, target, placement, or combat logic and is not a runtime texture.

## Preserved untracked and intermediate material

No pre-existing untracked file was discarded. The original renderer source, SVG temporary source, transparent pilot/zone overlays, the initially truncated with-pilots PNG, pre-alignment concept versions, and aligned truecolor pre-publish versions remain preserved locally for provenance and recovery. They are production intermediates or invalid backups, not review deliverables, and are intentionally excluded from the Draft PR.

Original hashes captured before repair/normalization:

- concept base: `998ede03ac455035c025d4977a7d9a19f1ee142f0cc40d19e337feec1ef3ebbb`
- concept with pilots, truncated: `c2cede85f0aa80a092f58f3cbdcbfd8d91836094e19ef4a2ef948787e1847300`
- concept overlay: `3fcf18ba8ac6724ce2f439a97f84d08ec5e89eb2be6ff6000ae26fa65868bc91`
- aligned truecolor concept base: `4b0a46a05e2d1aaea4b07fc6a191155e992e636273f31eee099e4c611a74c91a`
- aligned truecolor concept with pilots: `14e14d8a45efbc44558d64453a4e74a2c16875647a6e39f84f4dd7a9a2471dc6`
- aligned truecolor concept overlay: `0c6b2fe3cdb9ac6bc8369b32909ce0f429d226955946bc7728f54e96d3f0fc2e`

## Unresolved items

- Camera previews are deterministic projection reconstructions, not browser screenshots. Live DOM topbar measurement, fullscreen, and real-device breakpoint capture remain future checks.
- The brief history mentions 8×8, but the exact runtime is 8×7 with bench row 6; v1 follows runtime and does not invent an eighth row.
- The Golem source in the exact base is a legacy pixel-style placeholder, so final polished-unit contrast cannot be claimed from this preview.
- Concept art has not been integrated into Three.js, tested under runtime lighting, or reviewed as a final texture.
- The committed concept trio is palette-quantized for preview transport; final art production must return to an approved truecolor source and its own format contract.
- No future production checkpoint from PR #43 is claimed as passed.

## Handoff

This set is suitable for concept/framing review only. If v1 is accepted as a useful baseline, the next separately scoped round may use the attached `1000042598.png` as the visual master for Reference-Matched Preview v2 while retaining the same 8×7 footprint and runtime camera. Final asset production and runtime integration remain separate approvals.

`canonicalApproved=false`
