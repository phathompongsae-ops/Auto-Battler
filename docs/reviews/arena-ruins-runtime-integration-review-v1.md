# Arena Ruins Static Board Runtime Integration — Review v1

Status: **runtime integration of the PR #49 production pack — visual gate passed, not canonical**

- Source PR: **#49** `coco/arena-ruins-static-board-production-pack-v1` @ `d4f6793a40a8742f0bb4515402a33f204d58caea` (open/draft/unmerged at integration time)
- Integration base: **PR #45** `cc/motion-pipeline-merge-readiness-audit-v1` @ `58824feb92452fb3c7ab72bf7984b4f22d558b3e` — the newest CC branch on the audited motion-integration line (no newer CC descendant existed; a Coco board branch is never used as a playable runtime base)
- Integration branch: `cc/arena-ruins-static-board-runtime-integration-v1`
- Integration method: **path-limited checkout** from the exact source commit of only the files the Phase E handoff review lists under "Production files CC may pull" (7 PNGs + pack manifest + 5 contract JSONs). No blind cherry-pick; no review artifact pulled; every file byte-verified (13/13 sha256 MATCH vs both the pack manifest and `git show <source-sha>:<path>`).
- `canonicalApproved=false` everywhere. No PR merged.

## Source hashes (verified MATCH against manifest + source commit)

| File | sha256 |
|---|---|
| arena-ruins-board-surface-v1.png (1024×896 RGB8) | `107b10f1…e888bb56` |
| arena-ruins-border-corners-v1.png (1024×1024 RGBA8) | `7c847c45…aa067ce8f`* |
| arena-ruins-perimeter-ground-v1.png (512×512 RGB8) | `062d19d2…5717bf` |
| arena-ruins-background-modules-v1.png (1024×1024 RGBA8) | `55cde4ac…41412b4` |
| arena-ruins-bench-treatment-v1.png (1024×128 RGBA8) | `08c9ca3d…825a57f` |
| arena-ruins-tile-states-v1.png (1024×768 RGBA8) | `5cb733ad…dd8c3d` |
| arena-ruins-props-v1.png (1024×1024 RGBA8) | `79ca3400…4cb525c9`* |

Full values live in the pack manifest; the new runtime validator re-verifies every byte on every run. PR #49's own production-pack validator was additionally executed from an isolated worktree of the exact source head — PASSED, exit 0.

## Runtime files changed

- `src/map-theme-runtime.js` — the only runtime file touched (dev-safe presentation layer). No change to `src/game.js` or any gameplay source.
- `tools/validate-arena-ruins-runtime-integration-v1.mjs` — new read-only gate.

## Loader/registry changes (minimal seam)

`fileTexture(path, anchor, onReady)` — a Map 1-only external-file texture loader inside the theme runtime. Async; applies only while the same theme activation is still live; tracked/disposed like every theme resource; on any failure (missing file, decode error, `forceMissing` debug) the existing procedural baseline stays untouched. No Map 2–3 support was built (deliberate; forbidden scope).

## Integrated layers (contract-proven only)

1. **Board surface master** — 56 per-tile decals at contract y=0.002, each an exact 128 px/tile UV window of the 8×7 master (PNG row 0 = enemy/back edge per `row0AtPngTop`). Implemented per-tile so the **existing gameplay tile-highlight system stays fully usable**: a decal hides itself while its gameplay tile shows a selection/placement highlight (read-only observation of the tile material vs its stored `baseTint`) and returns when the tile is normal. Raycast disabled on every decal; gameplay raycasts only `tileMeshes` + unit bodies.
2. **Bench treatment** — 8 per-column transparent slices over gameplay bench row 6 only (z=3, contract y=0.003), same reveal rule; bench stays the real gameplay row with usable columns 0–4.
3. **Perimeter ground** — ownership decision per the handoff: the existing 60×60 plane **stays owned by `src/game.js`** (no duplicate plane); the theme swaps its material map/tint to the seamless 512² production stone (RepeatWrapping 10×10, mipmapped POT) and restores the original values on `disposeTheme()`.

## Deferred layers (no safe contract — deliberately NOT bound)

- **Border/corners atlas, background-modules atlas, props atlas** — all marked `atlas-uv-unresolved` in the asset registry; no cell/UV-to-geometry contract exists and guessing UVs is forbidden. The PR #25 procedural arenaBorder/background/props layers remain as the interim environment.
- **Tile-state atlas** — runtime exposes only normal / placement-valid / placement-invalid material behavior, owned by `src/game.js`; the nine-cell atlas has no binding contract. **Integrated states: none (existing three visual states preserved and verified working through the art). Deferred states: all nine atlas cells.**
- Color-space/filtering decisions: textures use the existing pipeline default (pass-through, matching every current game texture — renderer has no sRGB output configured), LinearFilter without mipmaps for the two non-POT sources, mipmapped repeat for the POT perimeter. Board center renders warm (measured R 146 > G 113 > B 76), not washed out or darkened.

## Board geometry / bench / camera verification

- 8 columns × 7 rows, 56 gameplay tiles, bench row 6, `TILE=1` — verified live in-browser and by the validator against `src/game.js` constants (unchanged file).
- `gridToWorld` spot checks unchanged: (1,4)→(-2.5,1), (6,2)→(2.5,-1), (0,6)→(-3.5,3).
- Camera: no camera code touched; contain-fit verified live — all four projected board corners on-screen at 1280×720 and 844×390.

## Pilot readability (measured from the real rendered canvas + eyeballed screenshots)

- **Archer** [1,4]: luminance range 221.5, color distance to board 63 — reads clearly. ✔
- **Slime** [4,1]: luminance range 194.4, color distance 205 — strong warm/cool separation. ✔
- **Golem** [6,2]: luminance range 206.9, color distance 92 — reads by silhouette/scale, blue crystal accents separate it from the warm stone. The known stone-on-stone risk did **not** materialize as a defect at board scale in this pass; no environment mitigation was needed.

## Mobile findings (844×390)

Art loaded 3/3, 56 decals active, board fully on-screen, grid/bench/border readable, no crop/stretch, zero errors. Screenshot: `mobile-viewport-view.png`.

## Visual differences from Reference-Matched Preview v2 (honest gaps)

- The heavier stone arena border, ruins background modules, and props atlases are **not yet the production art** (deferred, above) — the surrounding environment is still the PR #25 procedural interim, so enclosure/border weight is lighter than Preview v2.
- Board surface, bench darkening, warm floor tone, and darker perimeter framing DO come from the production pack and land close to the preview's board identity.

## Browser gate — exactly 3 checkpoints at x4 (final run 29/29 PASS)

1. **Asset Load + Board Geometry — PASS**: production art 3/3 loaded, 0 failed, no missing texture; 56 decals + 8 bench slices + ground swap active; 8×7/bench-6/tile coordinates unchanged; contain-fit corners on-screen; no fatal errors.
2. **Runtime Visual + Pilot Readability — PASS**: art active in motion-test mode; all five motion tests still `loaded`; pilots on contract tiles; no production mesh above y=0.003 (units/HP bars/projectiles structurally unoccludable); warm-tone measurement; three pilot readability measurements above; tile-highlight reveal verified (decal hides on highlight values, returns after); mobile viewport clean.
3. **Gameplay/Motion Regression at x4 — PASS**: speed ×4; real tap-select highlight path over the art (29 highlighted tiles revealed, all restored); battle starts (3 enemies), resolves to `result` with damage dealt (targeting/pathfinding intact); pause/play works; Archer attack (projectileRelease) + Archer move (footstep cues) + Slime move (footstepCue) + Golem attack (impactCue) all still run on the new board; zero new console/page errors.

Two earlier FAILs in the run were test-expectation bugs (wrong `gridToWorld(6,2)` literal; game phase string is `battle`, not `combat`), fixed in the test only — no runtime change resulted from them.

## Validators (real runs, exit codes)

`validate-arena-ruins-runtime-integration-v1` 0 · PR #49 pack validator (isolated exact-source worktree) 0 · `test-map-theme-runtime` 0 · `test-asset-animation-runtime` 0 · `test-motion-test-harness` 0 · `test-archer-package-transitions-v1` 0 · `validate-motion-pipeline-stack-v1` 0 · all five frame validators 0 · `validate-pilot-motion-test-contract-v1` 0 · `node --check` (both changed files) 0 · `git diff --check` 0.

## Unresolved blockers (carried forward, not created here)

Atlas cell/UV contract for border/background/props; nine-state tile-state binding contract; final color-space/filtering/anisotropy policy; formal perimeter-ground ownership transfer (interim decision documented above); explicit renderOrder; DOM-measured fullscreen/shop-open overlap matrix.

## Screenshots (real runtime, this directory)

`full-game-view.png` · `board-focused-view.png` · `pilots-on-board-view.png` · `mobile-viewport-view.png`

`canonicalApproved=false` — visual approval of the integrated board remains a user decision. No Core Logic, combat, targeting, pathfinding, economy, stage-logic, camera, or board-geometry change was made. No Map 2–3 work. No PR merged.
