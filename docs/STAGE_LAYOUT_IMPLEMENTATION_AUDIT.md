# Stage/Layout Implementation Audit

## Scope
Read-only audit of the current `main` implementation. No production code changed.

Reviewed areas:
- `src/game.js`: camera/frustum, board tiles, arena shell, bench representation, picking assumptions
- `autochess.html`: top bar, floating side panels, shop drawer, selected-unit bar, inventory, bottom-right controls, responsive rules

## Current implementation summary

### Camera and framing
- Orthographic camera is already in place.
- Framing is controlled primarily by `CAMERA_ANGLE_DEG`, `CAMERA_YAW_DEG`, `LOOK_TARGET`, `BOARD_FILL_RATIO`, `BOARD_DOWN_BIAS`, and `layoutBoard()`.
- `layoutBoard()` already measures the real topbar height and adjusts the frustum to avoid topbar overlap.
- This is a useful base and should be refined rather than replaced.

### Board and arena shell
- Gameplay tiles are individual horizontal planes at y=0.
- A large outer ground plane sits slightly below the board.
- Decorative arena framing already exists outside gameplay tiles using procedural geometry and materials.
- The current structure still reads mainly as a flat tiled surface with a decorative rim, rather than a board slab with strong front/side depth.

### Bench
- The bench is currently the final gameplay row (`BENCH_ROW = 6`) inside the same 8x7 tile plane.
- It is differentiated mainly by tint and interaction metadata.
- There is no independently readable bench platform or ledge that visually separates it from the combat board.
- Existing bench coordinates, occupancy, drag/drop, and picking should remain unchanged; only the visual shell should be added around those coordinates.

### HUD and lower hierarchy
- The canvas fills the viewport and all UI floats over it.
- Topbar, left Link panel, right monster/team panels, inventory drawer, selected-unit bar, shop drawer, shop toggle, and battle button are independent fixed overlays.
- Safe-area insets are already used in several important positions.
- On short screens the shop drawer is capped to 100px, but several independently positioned lower overlays can still compete for the same visual space.
- The required hierarchy `board -> front edge/divider -> bench -> shop/HUD` is not enforced by one shared layout system; it currently depends on separate fixed CSS rules.

## Main findings

### Finding 1 — Do not rebuild the camera system
The contain-fit orthographic approach and real topbar measurement are already valuable. The smallest safe change is to tune the existing constants and include the planned foreground stage/bench extents in the framing calculation.

### Finding 2 — Add visual depth without moving gameplay tiles
The board needs a non-interactive visual slab beneath/around the existing tile coordinates:
- front fascia
- side fascia
- shallow board thickness
- divider/ledge before the bench

These meshes must stay outside `tileMeshes` and all gameplay picking collections.

### Finding 3 — Bench should become a visual sub-platform, not a new gameplay system
Keep `BENCH_ROW`, grid coordinates, occupancy, and drag/drop unchanged. Add a bench base and divider aligned from board-local coordinates so the bench reads lower/forward while its interactive tiles remain where they are.

### Finding 4 — Lower HUD needs a shared reserved zone
The shop drawer, selected-unit/hint bar, inventory access, and bottom-right controls should use shared CSS variables or a single lower safe-zone contract. This avoids each component independently overlapping the bench on short or narrow screens.

### Finding 5 — Side panels should not determine board geometry
The current design intentionally allows side panels to float over scene margins. Keep that behavior. Do not shrink the gameplay board based on panel width unless a real viewport test proves required.

## Minimal implementation plan

### Commit 1 — Framing constants and measurement only
Expected area: `src/game.js`
- Keep the current camera and contain-fit math.
- Extend framing bounds to account for the visible front fascia and bench shell.
- Tune only the smallest set of constants needed.
- Do not touch grid coordinates or tile picking.

### Commit 2 — Board slab and front/side fascia
Expected area: `src/game.js`
- Add a named non-interactive stage group.
- Add shallow board thickness and visible front/side faces under existing tiles.
- Avoid z-fighting by keeping clear y offsets.
- Do not add these meshes to gameplay raycast lists.

### Commit 3 — Bench platform and divider shell
Expected area: `src/game.js`
- Derive dimensions from `GRID_COLS`, `GRID_ROWS`, `BENCH_ROW`, and `TILE`.
- Add a bench base and divider/ledge around the current bench row.
- Preserve all bench coordinates and hit areas.

### Commit 4 — Lower HUD safe-zone contract
Expected area: `autochess.html`
- Introduce shared CSS variables for bottom safe area, controls height, and drawer clearance.
- Make hint/selected bar, shop drawer, inventory access, and bottom-right controls respect the same reserved region.
- Keep existing DOM and event handlers.

### Commit 5 — Focused responsive fixes only
Expected area: only files proven necessary by testing
- Mobile portrait
- Mobile landscape
- Tablet
- Desktop
- Verify no horizontal scroll, bench obstruction, or picking mismatch.

## Explicit non-goals
- No pathfinding, combat, targeting, economy, wave, or stat changes
- No tile-coordinate or board-dimension changes
- No replacement of Three.js or orthographic camera
- No final textures, props, lighting polish, or character assets
- No production code change in this audit

## Test policy when implementation starts
- Camera/geometry-only changes: focused visual and picking checks; one combat wave at x4 only when the change is combat-adjacent.
- Bench or hit-area changes: Level 3 checks from `REGRESSION_CHECKLIST.md`, including drag/drop and resize.
- No routine 15-wave run until a milestone-level change.

## Integration note
CC currently owns Asset Loader Failure Handling. Do not begin Stage/Layout production edits until that task is finished, committed, and the implementation branch is based on the latest `main`.
