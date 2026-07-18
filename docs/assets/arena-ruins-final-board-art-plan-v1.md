# Arena Ruins Final Board Art Production Plan v1

Status: **production plan only**

Map: `map1.arena_ruins`

Base: PR #41 / `a76993d0f509981f2dcd70918efe9bc8f9cb00b9`

Reference: PR #25, `src/map-theme-runtime.js`, and visual-lock branch `coco/map1-visual-lock-contract-v1` at `60e8742ad4db84c944414964c8f66cfda87baf6c`

Approval: `canonicalApproved=false`

This pass defines production documentation and machine-readable metadata only. It creates no board art, texture, VFX, UI, scene object, loader, camera change, board change, or gameplay change. None of the three future art-review checkpoints is claimed as passed.

## 1. Verified source and locked runtime truth

The production team must use the values below, not a remembered or idealized board spec.

| Constraint | Verified value | Source |
|---|---:|---|
| Runtime grid | **8 columns × 7 rows (56 tiles)** | `src/game.js`: `GRID_COLS=8`, `GRID_ROWS=7` |
| Combat rows | `0..5` | movement excludes `BENCH_ROW` |
| Player deploy rows | `3,4,5` | `PLAYER_ROWS` |
| Observed enemy spawn rows | `0,1` | `ENEMY_SLOTS`, boss waves |
| Integrated bench | row `6`; usable columns `0..4` | `BENCH_ROW`, `MAX_BENCH` |
| Tile/world scale | `1 world unit` | `TILE` |
| Board center / half-extents | `[0,0,0]` / `[4,3.5]` | `gridToWorld`, `MapThemeHooks.getBoardMetrics` |
| Tile orientation | `(0,0)` is far-left enemy side; `c` increases world +x/screen-right; `r` increases world +z toward camera/bench | `gridToWorld`, camera lock |
| Camera | orthographic, pitch `45°`, yaw `90°`, distance `20`, look target `[0,0,1.3]` | `src/game.js` |
| Framing | projected-corner contain-fit; fill `0.97`; down-bias `0.97`; topbar clearance `6 px` | `layoutBoard` |
| Renderer | pixel ratio `1`, antialias off, no preserved drawing buffer | `src/game.js` |
| Theme root | `mapThemeRoot` | `src/map-theme-runtime.js` |
| Theme layers/build order | `boardSurface`, `arenaBorder`, `background`, `props`, `ambientVfx`, `lightingProfile` | `LAYER_NAMES` |
| Visibility / quality | per-layer visibility; `high`, `medium`, `low` quality | Map Theme Runtime public API |
| Fullscreen | document-root fullscreen followed by the existing `layoutBoard` relayout | `src/game-presentation-tools.js` |
| Screenshot | fresh WebGL frame copied at native renderer size, then player HUD strip composited | `src/game-presentation-tools.js` |

### Blocking specification mismatch to carry forward

The request describes an 8×8 combat board, but the exact base is an 8×7 board with the bench integrated as row 6. Because this work is expressly forbidden from changing board layout, geometry, camera, or runtime, the production target in this plan is **8×7**. No artist should invent an eighth row. The brief/runtime mismatch remains an explicit unresolved owner decision.

## 2. Existing ownership and replacement seams

PR #25 owns six independently togglable groups under `mapThemeRoot`. The array above is the build/insertion order; no explicit Three.js `renderOrder` is assigned, so it must not be described as a guaranteed transparent GPU draw order.

The existing `themeTexture(key, draw)` seam creates procedural `THREE.CanvasTexture` objects. It does **not** define an external image URL loader, repository-path registry, color-space assignment, or atlas UV contract. Final images can be produced now from this plan, but later integration must first define those missing details in a separately authorized runtime task. This plan does not add a loader.

The surrounding 60×60 ground plane is currently owned by `src/game.js`, not the theme root. Its final texture is therefore planned as a future replacement target but its ownership remains unresolved; this pass does not move it into `background`.

## 3. Final visual direction

Arena Ruins is an ancient, damaged fantasy arena, not a generic ruined city. Materials use hand-painted stylized 3D treatment: warm sand and light-brown stone, muted copper, restrained moss, battle wear and cracks, with cool shadow separation inherited from the current theme palette. The central fight area stays lower-frequency and quieter than the perimeter.

The art must work with the locked light contract:

- existing warm key from world `+x/+y/+z` (`#ffb060`);
- additive cool fill from `-x/+y/+z` (`#5a6a8a`, intensity `0.25`);
- soft golden rim from far `-z` (`#d8ad4d`, intensity `0.30`).

It must remain readable on mobile and in fullscreen/screenshot contain-fit. No screen-space vignette may be baked into a world texture because the viewport and projected board bounds change.

## 4. Layer production contract

### A. Board Surface — `boardSurface`

Produce one 1024×896 full-board master: exactly 128 px per runtime tile across 8×7. Use broad hand-painted stone slabs, gentle material variation, fine seams, cracks near grout/intersections, and restrained wear. Keep tile centers free from high-frequency cracks and bright highlights. The bench row may read slightly darker but cannot become a new shape or layout. No numbers, debug-grid lines, state colors, character shadows, or active runes are baked in.

### B. Tile Readability Overlay — `boardSurface` visual contract

Produce one transparent 1024×768 atlas: four by three 256 px cells, nine states used, three cells fully transparent. States are `normal`, `hover`, `selected`, `deploy-valid`, `deploy-invalid`, `enemy-zone`, `target`, `AoE`, and `disabled`.

This is art direction only. The current game implements normal, placement-valid and placement-invalid material behavior; it does not expose every listed state. The plan neither creates those gameplay states nor changes their logic.

### C. Board Border — `arenaBorder`

Produce one transparent 1024×1024 border/corner atlas. The front camera/bench edge is flat; sides remain low; the far/enemy edge may use broken medium-height masonry. Corners must fit the locked 8×7 footprint. Cracks and copper trim may enrich silhouettes, but nothing may cover edge units, HP bars, target markers, or projectiles.

### D. Arena Perimeter — `background` + `props`

Use one 1024×1024 background-modules atlas and one 1024×1024 props atlas. Distant walls and arches stay at the current radius range of roughly 9–13 world units, on back and sides only. Broken columns, rubble, banners and brazier shells remain outside the full grid, bench, HUD, and touch paths. Tall foreground props are forbidden.

### E. Background / Floor Surround — `background`

Produce one 512×512 seamless opaque perimeter-ground tile for the existing 60×60 plane/repeat concept. It establishes depth and a quiet falloff without a baked viewport vignette. Avoid recognizable repeating landmarks. The board’s outer silhouette must remain stronger than the surround.

### F. Ambient Detail — `ambientVfx` and static assignments

Static scuffs, restrained runes and cloth damage belong in `boardSurface` or `props`. Slow dust and rare light shafts remain runtime `ambientVfx`; moving cloth, ember glow and particles are not baked into an atlas. Ambient treatment must not resemble combat VFX and remains the first quality feature to degrade.

### G. Shadow / Contact Support — receiving art only

Paint quiet, consistent receiving values in each tile’s central foot zone. Do not bake any character shadow. Avoid large dark cracks at unit anchors so the existing contact-shadow mesh remains readable. Side/front borders must not create same-value tangencies with the Golem or HP bars.

## 5. Minimum asset deliverables

Six files are the minimum practical set that preserves independently replaceable surface, border, surround, background, state-overlay and props concerns. `ambientVfx` and `lightingProfile` remain data/runtime profiles and need no bitmap.

| Priority | Asset ID | Planned file | Layer | Canvas | Alpha |
|---:|---|---|---|---:|---|
| 1 | `map1.arena_ruins.board_surface_master.v1` | `assets/maps/map1.arena_ruins/arena-ruins-board-surface-master-v1.png` | `boardSurface` | 1024×896 | opaque |
| 2 | `map1.arena_ruins.border_corners_atlas.v1` | `assets/maps/map1.arena_ruins/arena-ruins-border-corners-atlas-v1.png` | `arenaBorder` | 1024×1024 | RGBA |
| 3 | `map1.arena_ruins.perimeter_ground_tile.v1` | `assets/maps/map1.arena_ruins/arena-ruins-perimeter-ground-tile-v1.png` | `background` | 512×512 | opaque |
| 3 | `map1.arena_ruins.background_modules_atlas.v1` | `assets/maps/map1.arena_ruins/arena-ruins-background-modules-atlas-v1.png` | `background` | 1024×1024 | RGBA |
| 4 | `map1.arena_ruins.tile_state_atlas.v1` | `assets/maps/map1.arena_ruins/arena-ruins-tile-state-atlas-v1.png` | `boardSurface` | 1024×768 | RGBA |
| 5 | `map1.arena_ruins.props_atlas.v1` | `assets/maps/map1.arena_ruins/arena-ruins-props-atlas-v1.png` | `props` | 1024×1024 | RGBA |

All files are 8-bit sRGB PNG. Transparent files require true straight alpha, clean RGB edge colors, transparent outer gutters, and no checkerboard pixels. Every deliverable remains `canonicalApproved=false` until the future review completes.

## 6. Resolution, POT and memory rationale

- Board surface uses 1024×896 because it is the exact 8×7 ratio at 128 px per tile. It is a full-board texture, not a tileable texture, so unique wear can be controlled without visible repetition.
- Border, background modules, and props are 1024-square atlases. This is sufficient for the locked mobile camera and avoids unjustified 4K/8K sources.
- The perimeter ground is the only tileable texture, at 512×512.
- The state atlas is 1024×768 because nine 256 px state cells fit a 4×3 packing; unused cells remain transparent.
- No current Map Theme code asserts power-of-two dimensions, but there is also no final file loader contract. Use clamp/no-mipmap assumptions only after integration confirms them; do not silently add mipmaps.
- Worst-case decoded upload if all six expand to RGBA8 is `20,447,232 bytes` = **19.5 MiB**. Mipmaps would add approximately 33% and are outside this budget. Compressed PNG download size must be measured after art exists; this plan does not invent a download estimate.

Maximum practical texture dimension for this pass is 1024. Any request for 2048 or larger must show a measured mobile readability defect that cannot be fixed by composition or atlas use.

## 7. Safe zones

Machine-readable zones live in `data/design/arena-ruins-board-safe-zones-v1.json`. `boardUv` starts at the far-left enemy-side corner and ends at the near-right bench-side corner.

- combat board: all columns, rows 0–5 (`v=0..6/7`);
- full board/bench: all 56 tiles (`v=0..1`);
- deploy highlights: rows 3–5 (`v=3/7..6/7`);
- observed enemy spawn/highlight area: rows 0–1 (`v=0..2/7`);
- unit-foot quiet area: central 64% of every tile;
- edge clearance: central 84% of every tile admits no raised decorative form;
- HP/readability envelope: upper half of the projected unit envelope;
- projectile/target/AoE path: all combat rows;
- conservative screen-UV risk bands: top 18%, left 32%, right 32%, and bottom 22%.

Screen bands are review risks, not replacement UI geometry. Actual UI rectangles depend on content, safe-area insets, breakpoints and fullscreen, so future browser measurement is mandatory.

## 8. Tile-state palette summary

| State | Hue / design color | Opacity | Edge | Pulse |
|---|---|---:|---|---|
| normal | warm stone `#b89a72` | 0.10–0.18 | soft inset seam | no |
| hover | soft gold `#e6c274` | 0.28–0.38 | inner bevel | no |
| selected | amber `#f2b84b` | 0.42–0.55 | double inset | subtle allowed |
| deploy-valid | mint-teal `#69c7aa` | 0.32–0.46 | soft solid inner edge | no |
| deploy-invalid | muted coral `#c9685f` | 0.40–0.54 | broken edge + corner cuts | no |
| enemy-zone | rust red `#a95d4e` | 0.20–0.32 | low-opacity perimeter band | no |
| target | gold-orange `#ffb347` | 0.46–0.60 | radial corner brackets | allowed |
| AoE | muted violet `#b48ad6` | 0.28–0.42 | shared outer area edge | allowed |
| disabled | slate `#6b6f78` | 0.16–0.24 | matte veil + quiet dashed edge | no |

Every state must remain distinct at one-times mobile scale without text. Invalid uses edge shape as well as hue for color-deficiency resilience. AoE uses violet so it does not merge with Slime/cyan effects.

## 9. Pilot contrast risks

The full matrix is in `data/design/arena-ruins-pilot-contrast-matrix-v1.json`.

| Pilot | Primary risk | Artwork correction without recoloring identity |
|---|---|---|
| Archer `#5f8f4e` | green hood/costume can merge with moss | moss is sparse, desaturated, and outside playable cells; tile centers remain cool-neutral |
| Slime `#4ea3b0` | small silhouette and cyan effects can merge with teal body | no cyan board paint; quiet tile centers; gold target and violet AoE families |
| Golem `#8a7a63` | tan stone body can merge with warm arena stone | warm sand/copper concentrates at seams/perimeter; central receiving values remain cooler/darker |

Comparative luminance against proposed quiet floor `#625d55`: Archer 1.72:1, Slime 2.24:1, Golem 1.57:1. These are design risk indicators, not text-accessibility claims and not checkpoint results. Golem is the highest-risk pilot.

## 10. Production order and approval gates

1. **Pass 1 — Board surface master.** Approve value grouping, 8×7 alignment and unit-foot quiet zones before Pass 2.
2. **Pass 2 — Border and corners.** Approve front/side occlusion and corner fit before Pass 3.
3. **Pass 3 — Perimeter/background.** Approve board/background separation, seamless repeat and fullscreen behavior before Pass 4.
4. **Pass 4 — Tile readability overlays.** Approve all nine states at one-times mobile scale before Pass 5.
5. **Pass 5 — Ambient props.** Approve no-go-zone compliance and non-baked VFX separation before Pass 6.
6. **Pass 6 — Mobile readability and pilot-unit contrast review.** Run the three checkpoints below with actual art.

## 11. Exactly three future review checkpoints

1. **Checkpoint 1 — Asset Structure:** dimensions, format, alpha, paths, layer completeness, and no unintended baked UI/VFX.
2. **Checkpoint 2 — Board Readability:** locked 8×7 runtime grid visible, deploy/enemy zones readable, edge tiles unobscured, no combat-area noise, mobile scale readable.
3. **Checkpoint 3 — Pilot Contrast:** Archer, Slime and Golem readable; HP bars, projectiles and markers readable; no camera/layout regression.

All checkpoints are future-only and currently `passed=false`.

## 12. Unresolved items and handoff rules

- 8×8 brief versus locked 8×7 runtime/bench layout.
- External theme file loader, repository-path registry, atlas UV contract, color-space assignment and final filtering/mipmap policy are absent.
- Perimeter ground currently belongs to `src/game.js`, outside `mapThemeRoot`.
- Six visual overlay states beyond the three current tile-material behaviors lack runtime support.
- Theme groups have no explicit render order.
- Exact screen-space UI overlaps require future browser measurements.

The next art-production round may create only the six planned source files and review material. It must not infer that producing a file authorizes runtime integration. Any loader, material, UV, scene ownership, camera, layout, combat, targeting or UI change requires a separate authorized scope.
