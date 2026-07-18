# Arena Ruins Board Implementation Contract v1

Status: **documentation and asset-production metadata only — no runtime integration**

- Base: Draft PR #47, `coco/arena-ruins-reference-matched-board-preview-v2`
- Exact base SHA: `4d1403ec108f5846deb9f46af89da2d03ce1a666`
- Reference image: `1000042598.png` (`194d941b5b10a2888f209336d6d1bf2e975df28359b86529dc711875d7111547`)
- Preview v2 visual master: `docs/assets/review/arena-ruins/reference-match-v2/arena-ruins-reference-match-board-only-v2.png`
- Approval: `canonicalApproved=false`

This contract translates Reference-Matched Preview v2 into machine-readable asset ownership, dimensions, placement intent, safe areas, and integration blockers. It lets a later CC task integrate approved source files without reinterpreting the concept. This branch does not add a loader, alter Three.js, change board/camera/UI geometry, or claim that any production asset is already in game.

## 1. Locked runtime facts

| Fact | Locked value |
|---|---:|
| Board | 8 columns × 7 rows / 56 tiles |
| Combat rows | `0..5` |
| Deploy rows | `3..5` |
| Bench | row `6`; usable columns `0..4` |
| Tile size | 1 world unit |
| Board bounds | x `[-4,4]`, z `[-3.5,3.5]` |
| World orientation | columns increase +x; rows increase +z toward camera/bench |
| Camera | orthographic; pitch 45°, yaw 90°, distance 20 |
| Look target | `[0,0,1.3]` |
| Contain-fit | projected board corners; height-first plus 1.02 narrow-width guard |
| Framing constants | fill 0.97; down-bias 0.97; topbar pad 6 px |
| Renderer | pixel ratio 1; antialias off; preserveDrawingBuffer off |

The implementation must not convert the board to 8×8 or move the bench. The exact tile-center formula is `x=(c-8/2)+0.5, z=(r-7/2)+0.5`.

## 2. Existing runtime layer truth

`src/map-theme-runtime.js` supports exactly six layer names, in this insertion order:

1. `boardSurface`
2. `arenaBorder`
3. `background`
4. `props`
5. `ambientVfx`
6. `lightingProfile`

There is no explicit `renderOrder`. The numeric render-order values in the metadata are integration intent only and must not be described as current GPU ordering.

| Conceptual concern | Runtime owner | Support found at base |
|---|---|---|
| `boardSurface` | `boardSurface` | procedural layer exists; external-file replacement unresolved |
| `tileDetail` | `boardSurface` | authored into surface source; no independent layer |
| `arenaBorder` | `arenaBorder` | procedural layer exists; atlas UV/loader unresolved |
| `benchTreatment` | `boardSurface` | bench logic exists; independent art composite unresolved |
| `perimeterGround` | `background` intent | current 60×60 ground is owned by `src/game.js`, not theme root |
| `backgroundArchitecture` | `background` | procedural layer exists; atlas UV/loader unresolved |
| `props` | `props` | procedural layer exists; atlas UV/loader unresolved |
| `ambientVfxReferenceOnly` | `ambientVfx` | runtime profile only; no static bitmap |
| `lightingProfileReferenceOnly` | `lightingProfile` | runtime lights only; no static bitmap |
| `tileStateOverlay` | `boardSurface` intent | three material states exist; full nine-state binding unresolved |

## 3. Production asset registry

Phase D is permitted to produce exactly seven source PNGs under `assets/maps/arena-ruins/board/`. They remain non-runtime assets until CC performs a separately authorized integration.

| Asset | Exact path | Dimensions | Alpha | Intended owner |
|---|---|---:|---|---|
| Board surface | `assets/maps/arena-ruins/board/arena-ruins-board-surface-v1.png` | 1024×896 | opaque RGB8 | `boardSurface` |
| Border/corners | `assets/maps/arena-ruins/board/arena-ruins-border-corners-v1.png` | 1024×1024 | RGBA8 true alpha | `arenaBorder` |
| Perimeter ground | `assets/maps/arena-ruins/board/arena-ruins-perimeter-ground-v1.png` | 512×512 | opaque RGB8 | `background` intent |
| Background modules | `assets/maps/arena-ruins/board/arena-ruins-background-modules-v1.png` | 1024×1024 | RGBA8 true alpha | `background` |
| Bench treatment | `assets/maps/arena-ruins/board/arena-ruins-bench-treatment-v1.png` | 1024×128 | RGBA8 true alpha | `boardSurface` intent |
| Tile states | `assets/maps/arena-ruins/board/arena-ruins-tile-states-v1.png` | 1024×768 | RGBA8 true alpha | `boardSurface` intent |
| Props | `assets/maps/arena-ruins/board/arena-ruins-props-v1.png` | 1024×1024 | RGBA8 true alpha | `props` |

The seven files decode to a conservative 20 MiB if every texture expands to RGBA8. A full mip chain would be about 26.67 MiB. PNG transfer size is content-dependent and must be measured after production. No 2K/4K/8K source is justified by the locked mobile framing.

## 4. Placement and alignment

The board surface maps exactly to world x `[-4,4]`, z `[-3.5,3.5]` and board UV `[0,0]..[1,1]`, with 128×128 source pixels per tile. Row 0 is at the PNG top. Bench treatment covers board UV v `6/7..1` and world z `[2.5,3.5]`.

The Preview v2 1536×1024 alignment master uses board bounds x `214..1322`, y `74..760`. Enemy review rows 0–1 occupy y `74..270`, deploy rows 3–5 y `368..662`, and bench row 6 y `662..760`. These are review alignment pixels, not new runtime constants.

Border intent is flat on the front/+z bench side, low on ±x sides, and broken-medium on the back/−z side. Background modules stay at radius 9–13 on back/left/right only. Props never enter a logical tile. Perimeter ground remains a 512-square seamless source for the existing 60×60 repeat concept; ownership transfer is unresolved.

`docs/assets/review/arena-ruins/reference-match-v2/arena-ruins-implementation-zones-v1.png` visualizes these ownership and risk bands for review only.

## 5. UI and gameplay safe areas

Machine-readable normalized zones are in `data/design/arena-ruins-board-ui-safe-areas-v1.json`.

- screen top HUD risk: top 18%;
- left and right panel risks: outer 32% from v=0.12 downward;
- bottom shop/inventory/control risk: bottom 22%;
- board critical screen footprint: `[0.1393229167,0.072265625]..[0.8606770833,0.7421875]` in the 1536×1024 reconstruction;
- combat/projectile/target corridor: board rows 0–5;
- deploy overlay envelope: rows 3–5;
- enemy overlay envelope: observed rows 0–1;
- unit-foot quiet zone: central 64% of each tile;
- edge-unit clearance: central 84% of each tile has no raised decoration;
- HP-bar envelope: upper half of the projected unit billboard.

These screen bands are conservative review metadata. They do not replace CSS layout and do not claim measured browser coverage.

## 6. Tile-state ownership

The 1024×768 tile-state atlas uses a 4×3 grid of 256×256 cells. Nine cells represent `normal`, `hover`, `selected`, `deploy-valid`, `deploy-invalid`, `enemy-zone`, `target`, `AoE`, and `disabled`; three cells remain fully transparent. Production may create the source atlas, but runtime support is currently partial. The contract does not add states or gameplay logic.

## 7. Integration blockers

The following are facts, not future implementation decisions:

- **External loader/path registry absent:** `themeTexture(key, draw)` creates procedural `THREE.CanvasTexture`; no final-file path registry was found.
- **Atlas UV contract absent:** border, background, state, and props cell-to-geometry mappings are unresolved.
- **Color-space assignment absent:** no external final-texture `colorSpace` policy was found.
- **Perimeter-ground ownership unresolved:** the repeated arena floor belongs to `src/game.js`, outside `mapThemeRoot`.
- **Explicit render order absent:** insertion order exists, but no explicit Three.js `renderOrder` contract exists.
- **Tile states partial:** normal/placement-valid/placement-invalid behavior exists; six additional bindings are unresolved.
- **Browser overlap unmeasured:** topbar and responsive panels are DOM-dependent; fullscreen, portrait, landscape, shop-open, and largest-unit edge cases remain to be measured.

Phase D can safely create the source pack despite these blockers because it will not integrate it. CC must resolve loader/UV/ownership/filtering in a separate path-limited runtime task after visual approval.

## 8. Production and handoff rules

- Every production PNG is new Auto-Battler source art; reference UI, text, logos, icons, characters, and proprietary symbols are forbidden.
- No pilot, HP bar, selection, projectile, VFX, checkerboard, map UI, or character shadow may be baked into source assets.
- Pilot assets may appear only in review composites and cannot be regenerated, recolored, retouched, or written back.
- Alpha atlases require true transparent pixels and clean edge RGB; unused cells/gutters remain transparent.
- Source files are `asset-source-only-not-runtime-integrated` until CC integration.
- The existing three review checkpoints remain future-only and `passed=false`.

## 9. Unresolved approval state

This contract is suitable to start Phase D source production, not to approve runtime integration. Final visual approval, loader/UV design, browser UI overlap, runtime filtering/mipmaps, real mobile GPU behavior, and x4 gameplay regression all remain outside this branch.

`canonicalApproved=false`
