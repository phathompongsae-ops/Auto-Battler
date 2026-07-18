# Board–Camera–UI Visual Acceptance Spec

## Purpose

This document defines measurable visual acceptance criteria for the future CC-owned Board + Camera + Bench visual lock. It is documentation-only and does not modify runtime behavior.

## Target viewports

Primary mobile landscape targets:

- 800 × 360
- 844 × 390

Secondary sanity targets:

- 960 × 432
- 1024 × 600

Portrait is not a layout target; the existing landscape-orientation gate remains the expected behavior.

## Ownership boundary

Coco owns this visual specification only.

CC owns all implementation involving:

- Three.js camera position and rotation
- orthographic frustum sizing
- camera pitch/yaw
- board world position and scale
- bench world position and scale
- renderer resize behavior
- raycast and drag/drop alignment after camera changes

This document must not be used as authority to change combat, movement, targeting, pathfinding, economy, stage flow, or game-loop behavior.

## Composition zones

All measurements are relative to the usable landscape viewport after safe-area insets.

### Top HUD zone

- Reserve the top 12–16% of usable viewport height for persistent HUD information.
- The board's highest visible tile or unit head must not overlap persistent HUD text or controls.
- Temporary combat effects may enter this zone briefly, but core unit silhouettes must remain readable.

### Side UI zones

- Left and right persistent panels should each consume no more than 18% of usable viewport width in the primary targets.
- The board must remain visually centered within the remaining play area, not the full physical screen.
- Collapsed panels must not leave large dead margins that make the board appear off-center.

### Bottom interaction zone

- Reserve enough lower-screen clearance that the complete bench row remains visible and touchable.
- Shop/Bag overlays may cover the bench only while intentionally open.
- With overlays closed, no persistent UI may obscure bench units, bench tile centers, or drag-release targets.

## Board framing targets

At both 800 × 360 and 844 × 390:

- All board columns must be fully visible.
- The complete bench row must be fully visible.
- No outer tile may be clipped by the viewport or persistent UI.
- The board should occupy approximately 62–74% of usable viewport width after persistent side panels.
- The board plus bench should occupy approximately 68–82% of usable viewport height below the top HUD zone.
- The board visual center should sit slightly below the vertical center of the usable play area.
- Empty space below the bench should be small but non-zero, sufficient for touch feedback and unit shadows.
- Empty space above the far board edge should leave room for tall enemies, boss silhouettes, health bars, and hit effects.

These ranges are acceptance bands, not hardcoded implementation constants. CC may choose the smallest camera/frustum change that satisfies both target viewports.

## Camera direction lock

The intended presentation remains orthographic 2.5D/isometric-like, not perspective.

Acceptance criteria:

- Near and far tiles remain similarly readable in size.
- Grid rows are visually distinguishable without excessive vertical compression.
- Unit silhouettes remain readable and are not viewed from too high above.
- The board does not look front-flat like a straight top-down card table.
- The board does not look excessively diagonal or skewed.
- Camera framing should stay visually consistent between 800 × 360 and 844 × 390.

Exact pitch, yaw, camera distance, and orthographic frustum are CC implementation decisions and must be recorded in the implementation report.

## Bench acceptance

With Shop and Bag closed:

- Every bench slot center must be visible.
- A unit placed in the leftmost or rightmost bench slot must remain fully visible.
- Unit heads, weapons, and selection indicators must not be cut off.
- Tap-select and drag start must work across the full visible unit silhouette.
- Drag release to each bench slot must align with the visible tile.
- Board-to-bench and bench-to-board movement must not require releasing outside the visible tile.
- Bench tint must remain visually distinct from combat rows.

## UI stacking and occlusion order

Expected visual priority from back to front:

1. Three.js world and canvas
2. passive board labels or non-interactive decoration
3. persistent HUD and side panels
4. Shop/Bag drawers and modal panels
5. orientation overlay and blocking alerts

Acceptance criteria:

- No world unit may render visually above a DOM drawer.
- Closed drawers must not retain invisible hit-blocking layers.
- Persistent HUD must not block board drag interactions outside its visible bounds.
- Orientation overlay must block interaction while portrait and restore the same world/camera state on return to landscape.

## Safe-area handling

For devices with display cutouts or gesture insets:

- Persistent top and side controls must respect CSS safe-area insets.
- Critical board tiles and bench slots must not rely on the cutout area for visibility.
- The camera should fit to the remaining usable play region rather than blindly centering on the physical viewport.
- No separate board geometry variant should be created for notched devices unless measured evidence proves necessary.

## Unit and effect headroom

The camera lock must be tested with:

- one short normal monster
- one standard Class 1 hero
- one tall/broad Stage 5 boss candidate

Acceptance criteria:

- Tall silhouettes are not clipped at the top.
- Health bars and essential status indicators remain visible.
- Hit flash, projectile impact, death fade, and spawn effects have visible headroom.
- Camera changes do not require reducing unit scale so far that Shop/Bench/Board readability suffers.

## Interaction acceptance checklist

At both primary viewports:

- [ ] All board columns and rows are visible.
- [ ] Complete bench row is visible.
- [ ] Leftmost and rightmost bench units are not clipped.
- [ ] Board units are not hidden behind persistent HUD.
- [ ] Bench units are not hidden behind persistent UI when drawers are closed.
- [ ] Shop open/close preserves camera and board position.
- [ ] Bag open/close preserves camera and board position.
- [ ] Bench-to-board drag works on left, center, and right slots.
- [ ] Board-to-board drag works on near and far rows.
- [ ] Board-to-bench drag works on left, center, and right slots.
- [ ] Hover/placement highlight remains aligned with the visible tile.
- [ ] Touch and mouse raycasts select the same visible tile.
- [ ] No persistent overlay intercepts canvas input outside its visible area.
- [ ] Portrait→landscape return preserves the same board framing.

## Visual acceptance checklist

- [ ] Board is large enough to read without zoom.
- [ ] Board is not so large that edge tiles or units are clipped.
- [ ] Board sits slightly low in the usable play area.
- [ ] Far-row units remain readable.
- [ ] Bench visually reads as part of the board system but not a combat row.
- [ ] No excessive unused strip exists below the bench.
- [ ] No excessive unused strip exists beside the board when panels are collapsed.
- [ ] Tall boss and effects have adequate headroom.
- [ ] Composition is materially consistent between 800 × 360 and 844 × 390.
- [ ] UI hierarchy remains readable without covering essential gameplay space.

## Runtime validation expectations for the later CC task

Only the later implementation task should perform runtime tests.

Required minimum:

- Verify both primary landscape viewports.
- Test mouse and genuine touch drag/drop.
- Test Shop and Bag open/close.
- Test portrait overlay round trip.
- Run 3–5 targeted combat waves at speed ×4.
- Include one normal monster, one Class 1 hero, and one Stage 5 boss-sized unit.
- Confirm no camera jitter, raycast offset, clipped health bars, NaN values, duplicate listeners, or renderer recreation.

Do not require a full 15-stage run unless the camera change affects stage transitions or another concrete regression appears.

## Explicit non-goals

This visual pass must not:

- redesign HUD art
- change board dimensions
- change bench capacity
- change deployable rows
- change pathfinding or tile coordinates
- change combat balance
- change normal Shop odds
- integrate final character assets
- implement Survival Mode
- implement a 3-star hero system

## Definition of done

The Board + Camera + Bench visual lock is accepted only when:

1. both primary viewports pass every interaction-critical item;
2. framing meets the stated composition bands without clipping;
3. touch and mouse raycasts remain visually aligned;
4. tall-unit/effect headroom is demonstrated;
5. targeted ×4 combat smoke tests pass;
6. implementation constants and modules changed are listed in the final CC report;
7. before/after screenshots for both primary viewports are attached to the implementation PR.
