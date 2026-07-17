# Stage and Lower-Layout Target

## Goal
Lock the stage structure, camera framing, board edges, bench platform, lower HUD spacing, and responsive behavior before character Asset and Animation production.

The target is structural alignment with the reference image, not a final-art copy. The stage should read as a 2.5D arena with visible depth, a clear front edge, and a bench platform that extends from the board without blending into the lower HUD.

## Current vs Target

### Structural differences to fix first
- The current arena reads flatter and narrower than the reference.
- The front edge and side thickness of the board are not visually strong enough.
- The bench does not yet read as a distinct raised/lowered platform attached to the arena.
- The lower screen layers do not clearly follow: board → front edge/divider → bench → shop/HUD.
- HUD elements can visually compete with the bench area.

### Cosmetic differences to defer
- Final stone textures, decorative props, vegetation, banners, lighting polish, and detailed shadows.
- Final shop-card styling and side-panel art.

## Camera and Framing Target
- Keep the existing Three.js orthographic 2.5D/isometric approach.
- Lock pitch, yaw, zoom/frustum, and board framing before Asset production.
- The board must remain readable while exposing enough foreground depth for the front edge and bench.
- Camera changes must not alter gameplay-grid coordinates, tile picking, or pathfinding.
- Responsive framing must preserve the same visual hierarchy across portrait mobile, landscape mobile, tablet, and desktop.

## Stage Structure Target
The stage should be organized as named groups or clearly separated geometry:

1. Board surface
2. Side edges
3. Visible front edge/thickness
4. Divider or ledge
5. Bench platform
6. Optional decorative shell outside gameplay geometry

The visual shell may change, but the gameplay grid must remain unchanged.

## Bench Target
- Bench must read as part of the arena, not a floating HUD panel.
- Bench slots must remain aligned with their real hit areas.
- The bench should sit slightly below or forward from the main board with a clear divider/ledge.
- Bench position should derive from board-local/world coordinates, not ad-hoc screen offsets.
- Drag/drop behavior must remain unchanged.

## Lower Layout Target
Required visual order:

`board → front edge/divider → bench → shop/HUD`

- Shop, hint, selected-unit UI, inventory, and battle controls must not obscure bench slots.
- Safe-area insets must be respected.
- Lower controls may float over unused margins, but not over essential board/bench interaction areas.

## Interaction Constraints
- Do not change board dimensions or gameplay tile coordinates.
- Tile picking must remain accurate.
- Bench hit areas must match visuals.
- Drag/drop behavior must remain unchanged.
- Combat, pathfinding, targeting, economy, stats, and wave logic are out of scope.

## Acceptance Criteria
- Stage reads as a 2.5D arena with visible front and side depth.
- Board, divider, bench, and lower HUD are visually distinct layers.
- Bench slots remain fully usable and unobscured.
- No horizontal page scrolling.
- No new overlap in portrait mobile, landscape mobile, tablet, or desktop.
- Tile and bench picking remain accurate after resize.
- For any combat-adjacent regression, test one wave at x4 unless the diff risk requires more.

## Recommended Implementation Sequence

### Commit 1 — Camera and framing lock
- Scope: framing constants and resize behavior only.
- Expected files: `src/game.js`, possibly `autochess.html` only if CSS spacing is inseparable.
- Acceptance: consistent board/foreground framing on target viewports.
- Risk: tile projection mismatch.
- Rollback: revert this commit independently.

### Commit 2 — Stage depth and board edges
- Scope: front edge, side edges, visible thickness, divider shell.
- Expected file: `src/game.js`.
- Acceptance: stronger 2.5D depth without changing grid coordinates.
- Risk: z-fighting or occlusion.
- Rollback: revert geometry-only commit.

### Commit 3 — Bench platform and divider
- Scope: bench base, spacing, named handles/groups, hit-area parity.
- Expected file: `src/game.js`.
- Acceptance: bench reads as attached platform; drag/drop remains accurate.
- Risk: visual/hit-area mismatch.
- Rollback: revert bench commit.

### Commit 4 — Lower HUD spacing
- Scope: hint, selected-unit bar, shop drawer, inventory, and battle controls.
- Expected file: `autochess.html`.
- Acceptance: no bench obstruction or safe-area collision.
- Risk: viewport-specific overlap.
- Rollback: revert CSS-only commit.

### Commit 5 — Responsive and interaction verification
- Scope: only fixes proven necessary by target viewport checks.
- Acceptance: portrait, landscape, tablet, and desktop pass; tile/bench picking accurate.
- Testing: no routine 15-wave run; use focused checks and one x4 wave only if combat-adjacent behavior changed.

## Deferred Work
- Final environment textures and decorative props
- Asset Framework implementation
- Animation Framework implementation
- Character Asset production beyond the planned three-asset proof
- VFX polish
- Survival Mode
- Three-star hero system
