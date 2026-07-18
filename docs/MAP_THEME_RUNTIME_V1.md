# Map Theme Runtime v1 + Map 1 "Arena Ruins" Visual Baseline

Smallest stable reusable map-theme system, built against the Map 1 visual lock contract
(`coco/map1-visual-lock-contract-v1` @ `60e8742`, `data/design/map1-visual-lock-v1.json`,
inspected read-only via a temporary worktree — its validator passes: *"Map 1 visual lock contract
validation passed."*). It produces the first in-game visual baseline for **Map 1: Arena Ruins**.

**This is not final artwork.** It is the permanent runtime structure plus a polished
procedural/material baseline that final generated artwork can replace later without rewriting the
scene.

## Files changed

| File | Change |
|---|---|
| `src/map-theme-runtime.js` | **New** — theme registry, lifecycle, six-layer builders, quality/fallback, debug state. |
| `src/game.js` | Read-only `MapThemeHooks` (getScene/getBoardMetrics) + one null-guarded `tick(dt)` in `animate()`. |
| `autochess.html` | Module load + dev-only `#mapThemeDebug` panel (🗺 toggle, `data-dev-only` + `data-no-capture`). |
| `data/design/map-theme-schema-v1.json` | **New** — theme schema; shared vs replace-per-map; degradation order; deferred maps. |
| `data/design/map1-arena-ruins-theme-v1.json` | **New** — canonical Arena Ruins definition (mirrored by the embedded def; tested for consistency). |
| `tools/test-map-theme-runtime.mjs` | **New** — Node test (registry/guards/quality/JSON consistency/readability palette). |
| `docs/MAP_THEME_RUNTIME_V1.md` | This document. |

## Pre-edit ownership map

| Concern | Owner (pre-existing, untouched) |
|---|---|
| Scene/renderer/camera | `scene`, `renderer`, orthographic `camera` + `layoutBoard()` contain-fit (lexical globals in game.js) |
| Board/grid | `tileMeshes` (56), `gridToWorld`, `occupied` — the ONLY tile raycast targets |
| Pointer | `pickTileAtScreenPoint` / `pickPlayerUnitAtScreenPoint` raycast **only** `tileMeshes` + unit bodies → theme meshes are structurally unable to intercept pointers |
| Scene atmosphere | `scene.background`/`scene.fog` owned by the Arena Curse VFX (`VFX_BASE_BG`/`VFX_BASE_FOG`) — the theme never touches them |
| Key lighting | existing `AmbientLight` + warm "torch" `DirectionalLight` |
| Legacy decor (fallback baseline) | stone tiles, mosaic ground, stage frame, 4 pillars + rubble — untouched; this **is** fallback priority 1 |
| Pilots/animation | Asset & Animation Framework (PR #23) — anchors 0.92/0.90/0.94, priorities, VFX cap 24 |
| Fullscreen/screenshot | PR #24 presentation tools (`[data-dev-only]` hide/restore, `data-no-capture`) |

## Public API (`globalThis.MapThemeRuntime`)

`registerTheme(def)` · `activateTheme(themeId, ctx)` · `refreshTheme(ctx)` ·
`setThemeQuality('high'|'medium'|'low')` · `setLayerVisible(name, on)` · `setForceMissing(on)` ·
`disposeTheme()` · `getThemeDebugState()` · `tick(dt)` — plus `LAYER_NAMES`, `QUALITY_LEVELS`,
`listThemes()`. The registry holds `map1.arena_ruins` (enabled) and `map2.lava_hell` /
`map3.heaven_temple` as **disabled metadata only** (activation rejects them safely; no scenes, no
art). The module auto-activates Map 1 at load when the game hooks exist.

## Six layers (all under one `mapThemeRoot` Group)

1. **boardSurface** — faint crack decals at cell **intersections** (grout lines — never centered
   under a unit) + restrained moss just outside the playable edge. All decals `raycast = noop`,
   low opacity, no emissive. Grid coords/occupancy/tile highlights untouched.
2. **arenaBorder** — broken masonry parapet outside the existing stage rim: taller pieces only at
   the back (enemy side), low ruins at the sides, **flat slabs only on the camera/bench side** —
   no cell is ever obscured from the locked camera.
3. **background** — ruined amphitheatre walls + arches (one collapsed) at radius ~9–13, back/sides
   only, faded by the existing fog. Nothing crosses the board view.
4. **props** — broken columns, rubble+moss clusters, weathered torn banners, cracked braziers with
   a soft additive ember (flickers only when `motion` is on). Fixed candidate list entirely outside
   grid/bench/HUD/touch paths; `propScale` takes a prefix per quality.
5. **ambientVfx** — one `THREE.Points` dust cloud (positions updated in place — zero per-frame
   allocation) + two soft additive light shafts at high quality (back corners, never over the
   board). First layer reduced under load; nothing resembles combat VFX; AAF transient cap 24
   untouched.
6. **lightingProfile** — **adds** a cool muted fill (0x5a6a8a, 0.25) + soft golden rim (0xd8ad4d,
   0.3). Never replaces the camera/key light; never touches `scene.background`/`fog`.

Each layer: explicit ownership, independently replaceable/toggleable, disposable (all
geometries/materials/textures tracked and freed in `disposeTheme()`), fails safely to an empty
fallback group, and never touches logical board cells. Gameplay units are never re-parented into
the theme hierarchy.

## Quality levels & degradation

| Budget | high | medium | low |
|---|---|---|---|
| ambient particles | 64 | 28 | 0 |
| light shafts | 2 | 0 | 0 |
| background walls / arches | 10 / 3 | 6 / 2 | 3 / 0 |
| propScale / board decals | 1.0 / 8 | 0.6 / 5 | 0.3 / 3 |
| decorative motion | on | on | **off** |

Order enforced by data + tests: preserve units → preserve board/grid → preserve combat impacts
(all owned elsewhere, untouched) → **reduce ambient particles** → **remove decorative motion** →
**reduce distant/background decoration**. Gameplay-critical visuals are never theme-owned, so they
can never be removed.

## Fallbacks (verified)

Module absent → game renders exactly as before (legacy presentation). Theme missing / context
missing / disabled theme → warn once, keep existing presentation. Layer builder throws → that layer
becomes an empty group; the rest build. Texture fails / `setForceMissing(true)` → flat-color
materials (textures 0), theme stays active, one warning per resource — never per frame, never an
uncaught error.

## Pilot readability (contract palette)

Cool-gray masonry (`0x5d6270`/`0x4a4f5c`) + desaturated moss (`0x55663f`) chosen against the pilot
placeholder colors: Golem tan `#8a7a63` vs masonry ΔRGB ≈ 45–60, Slime teal `#4ea3b0` vs moss ΔRGB ≈
120, Archer olive `#5f8f4e` vs masonry ΔRGB ≈ 56 (hue-opposed green vs blue-gray). Golem stays the
largest pilot; anchors (0.5,0.92)/(0.5,0.90)/(0.5,0.94) are read from the AAF manifest and unchanged.
Hit/death/attack/skill, facing and projectile/impact layering verified working over the theme at x4.

## Debug panel (dev-only)

`#mapThemeDebug` + 🗺 toggle (URL `#mapTheme`/`#aaf` or tap). Shows active theme id, quality,
per-layer object counts (+hidden/fallback flags), geometry/material/texture counts, ambient particle
count, fallback state, refresh and disposal counts. Controls: quality high/med/low, per-layer
toggles, force missing-resource fallback, rebuild once, dispose, reactivate. `data-dev-only` →
auto-hidden in fullscreen (PR #24); `data-no-capture` + HUD-redraw screenshot architecture → never in
screenshots. Readout timer runs only while open.

## Tests (all executed)

- **Node** `tools/test-map-theme-runtime.mjs` — PASS: registry (map1 enabled; map2/map3 disabled +
  rejected), no-browser guards (activate/dispose/refresh/tick never throw), quality normalization,
  degradation monotonicity, six builders present, embedded def == canonical JSON (palette/quality/
  lighting/layers), schema sanity, anchors + palette separation.
- **Browser (Playwright, x4)** `maptheme.mjs` — **3 checkpoints, 47/47**:
  - **CP1 lifecycle/layout:** six layers initialize (no fallback), exactly one `mapThemeRoot`, 56
    tiles + exact tile raycast + placement/occupancy unchanged, every layer toggles, quality
    64/28/0 particles, forced missing-resource → flat-color fallback → restore, **10× dispose/
    reactivate** (one root, geometry/texture growth ≤2, tracked counts stable), **5× fullscreen**
    (single root, no stale canvas), no errors.
  - **CP2 pilot readability/visual runtime:** three pilots attach; anchors 0.92/0.90/0.94; attack +
    projectile, hit, death, facing at x4; Golem largest; palette separation; ambient 0 at low while
    combat impacts stay allowed; normal + fullscreen screenshots (valid PNG, stage filename, themed
    scene present, dev panel auto-hidden and excluded).
  - **CP3 gameplay regression:** purchase, placement, attack/skill, Equipment Shop buy,
    equip/unequip, Duelist Blade fusion, Secret Class API, 3 ninjas → one 2★, battle resolves,
    reward exactly once, wave +1, no NaN/Infinity, gold ≥ 0, no errors.
- **Regression suites (x4):** AAF core + browser 71/71, presentation 42/42, `demo1_ready` 41/41,
  `augment_flow` 31/31, `ninja_v2` 17/17, `economy_tests` 30/30, `secret_limit` 20/20, `equip`
  44/44. `node --check` on changed JS; `git diff --check` clean. (The known 10 PR #14 skillId
  validator errors remain out of scope, unchanged.)

## Limitations (nonblocking)

- The baseline is procedural geometry/canvas materials — intentionally replaceable by final
  generated artwork per layer without changing scene logic.
- Theme lighting is additive and conservative; a final art pass may retune intensities.
- Map 2 / Map 3 are disabled metadata only (by design).

## Verdict

**Map Theme Runtime + Arena Ruins baseline ready.** One shared theme system; one data-driven Map 1
profile across six disposable layers; board/camera/bench/combat/targeting/UI unchanged (verified by
raycast, occupancy and full regression); pilots remain readable and the largest-silhouette hierarchy
holds; fullscreen/screenshot behavior intact; quality degradation and every fallback path verified
leak-free.
