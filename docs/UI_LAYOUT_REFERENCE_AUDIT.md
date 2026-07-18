# Demo 1 UI / Layout Reference Audit

## Status

Documentation-only audit. No runtime, camera, combat, economy, drag-and-drop, or gameplay-state code is changed by this work.

The current build already uses a full-viewport Three.js canvas with DOM overlays. The next UI pass should preserve that architecture and lock consistent layout rules before visual polish.

## Source inspected

- `autochess.html` on current `main`
- Existing mobile landscape behavior and safe-area CSS
- Existing top HUD, left Link panel, right monster/team column, Shop Drawer, Item Bag, and board/bench presentation

The exact approved reference screenshot is not stored as a clearly identified canonical file in the repository. Therefore this audit locks measurable layout behavior and identifies which visual details must be confirmed against the approved reference before implementation.

## Executive findings

### Critical

1. **No canonical layout token system**
   - Current dimensions are distributed across component selectors.
   - Result: panel widths, top offsets, gaps, and button sizes can drift independently.
   - Required: introduce one documented set of layout tokens before editing production CSS.

2. **Center gameplay corridor is not explicitly protected**
   - Left and right panels use independent fixed widths.
   - The board is full viewport behind them, but there is no formal minimum unobstructed center width.
   - Required: reserve a center play corridor based on viewport width.

3. **Reference comparison cannot be reproduced without a canonical screenshot ID/path**
   - Required: store or document the approved reference image and target viewport.

### High

4. **Top HUD can wrap in narrow landscape viewports**
   - `#topbarCenter` permits wrapping.
   - This can alter vertical occupation and camera readability.

5. **Right column height is content-driven**
   - Monster and team panels may compete vertically as wave/team content grows.
   - Required: define fixed priority and collapse/scroll behavior.

6. **Touch target sizes are inconsistent**
   - Some compact controls are below the recommended comfortable mobile target size.
   - Required: minimum interactive box of 40×40 CSS px where practical, with 36×36 as an absolute compact exception.

7. **Shop, bag, and battlefield hierarchy is not formally defined**
   - Required: one overlay priority matrix so drawers never obscure critical confirmation or combat controls unexpectedly.

### Medium

8. Visual styling is component-specific rather than token-driven.
9. Panel opacity can reduce board readability when multiple overlays are open.
10. Typography scale has many isolated sizes from 8–14 px.
11. Information density is high in monster rows on short-height devices.

### Low

12. Border radii and decorative spacing vary slightly.
13. Icon treatment is not yet fully canonical.
14. Animation timing and transition curves are not standardized.

---

# Area-by-area audit

## 1. Overall composition

### Current

- Full-screen WebGL canvas at the back.
- DOM HUD and panels float above the canvas.
- Topbar occupies the top edge.
- Link panel anchors left.
- Monster/team column anchors right.
- Board remains visually centered but has no guaranteed UI-free corridor.

### Reference target

- Battlefield is the dominant visual object.
- UI frames the board rather than covering meaningful deployment/combat tiles.
- Left and right information areas feel balanced.
- Important controls remain reachable without crossing the center battlefield.

### Difference

The architecture is correct, but dimensions are still implementation-derived rather than reference-derived.

### Priority

Critical.

### Implementation difficulty

Medium. Primarily CSS/layout work, but camera or board framing must not be changed in the same commit.

---

## 2. Top HUD

### Current

- Three flex zones: left, center, right.
- Center may wrap.
- Uses compact pills and mixed button sizes.
- Safe-area insets are already considered.

### Reference target

- One stable horizontal row in supported landscape viewports.
- Player survival state and current stage are visually dominant.
- Economy and level are secondary.
- Speed/pause controls are grouped at the right edge.

### Difference

Current data is present, but grouping and hierarchy are weaker than a polished reference UI.

### Priority

High.

### Implementation difficulty

Low–Medium.

### Locked recommendation

- Do not allow two-row wrapping in the supported landscape range.
- Compress labels before reducing touch target size.
- Use icon + value patterns for Gold, EXP, and Wave.
- Keep combat speed controls in one fixed cluster.

---

## 3. Left Link / Synergy panel

### Current

- Fixed left panel.
- Three Link portraits and active buff summary.
- Width uses `clamp(130px, 15vw, 165px)`.

### Reference target

- Compact, immediately readable three-member team-link display.
- Buff summary is secondary and should not dominate board height.

### Difference

Panel intent is correct. It needs a locked width ratio, content truncation rules, and a collapsed state for short-height screens.

### Priority

High.

### Implementation difficulty

Low.

---

## 4. Right monster/team column

### Current

- Monster panel above team HP panel.
- Both can scroll and have separate max heights.
- Width mirrors the left panel.

### Reference target

- Current wave threat should be visible first.
- Boss identity receives stronger emphasis.
- Team status remains available but must not squeeze boss information.

### Difference

The correct components exist, but vertical priority should be explicit.

### Priority

High.

### Implementation difficulty

Medium.

### Locked recommendation

- Planning phase: team panel may receive more height.
- Combat phase: monster/boss panel receives priority.
- Boss rows must remain visible without scrolling when a boss is active.
- Non-boss monster rows may collapse into counts on very short screens.

---

## 5. Battlefield and bench

### Current

- Bench is represented on the board rather than as a separate floating DOM strip.
- Drag-and-drop placement and single-tile feedback are already supported.

### Reference target

- Bench must be visually distinct but remain part of the battlefield composition.
- The player must understand deployable rows, occupied tiles, and bench capacity instantly.

### Difference

Interaction behavior is ahead of visual hierarchy. Bench/deployment-zone styling should be standardized without changing placement rules.

### Priority

High.

### Implementation difficulty

Medium, because board visuals are runtime-owned and should be assigned to CC only after the UI specification is approved.

### Ownership boundary

- Coco: document colors, states, labels, and asset requirements.
- CC: any actual Three.js tile, camera, board, or placement-runtime implementation.

---

## 6. Shop Drawer

### Current

- Shop is an overlay/drawer.
- Existing real-device investigation indicates the previous white-rectangle issue was not reproduced on real Android hardware.

### Reference target

- Shop cards are the most visually rich UI element outside the board.
- Hero image, class, price, and purchase affordance must be readable at a glance.
- Drawer should not hide all tactical context.

### Difference

Functional structure exists. Card dimensions, portrait crop, text hierarchy, and open-height require a canonical target.

### Priority

High.

### Implementation difficulty

Medium.

### Locked recommendation

- Maintain one-row card presentation in landscape.
- Preserve a visible strip of battlefield above the drawer.
- Card portrait should receive the majority of card area.
- Price and class icon must be readable without opening secondary details.

---

## 7. Item Bag

### Current

- Separate toggle and overlay behavior.

### Reference target

- Quick equipment inspection without competing with the Shop Drawer.
- Clear item level and slot assignment.

### Difference

Needs overlay exclusivity and consistent grid sizing.

### Priority

Medium.

### Implementation difficulty

Low–Medium.

### Locked recommendation

- Shop and Bag should not remain fully open simultaneously on compact screens.
- Opening one should collapse the other at presentation level only; gameplay state must remain unchanged.

---

## 8. Bottom controls and primary actions

### Current

Controls are distributed among HUD/drawers and phase-specific UI.

### Reference target

A single unmistakable primary action per phase:

- Planning: Start Battle
- Combat: Pause/Speed cluster
- Result: Continue/Retry

### Difference

Primary-action hierarchy should be documented and visually enforced.

### Priority

High.

### Implementation difficulty

Low if CSS-only; Medium if current DOM structure must move.

---

## 9. Mobile usability

### Current strengths

- Landscape-oriented composition.
- Safe-area environment variables.
- Canvas touch handling protected by `touch-action: none`.

### Required lock

Supported baseline viewports:

- 800×360 compact landscape
- 844×390 standard landscape phone
- 1024×768 / landscape tablet class

Rules:

- No required control under 36×36 CSS px.
- Preferred primary controls: at least 44 px high.
- Critical text should not drop below 10 px.
- Avoid placing primary actions in the center battlefield corridor.
- Respect left/right safe areas.
- Portrait mode remains blocked by the landscape overlay once PR #9 or equivalent is canonical.

---

# Proposed layout tokens

These are documentation targets, not production code in this PR.

```css
--ui-safe-edge: max(8px, env(safe-area-inset-left/right));
--ui-top-height-compact: 44px;
--ui-top-height-standard: 52px;
--ui-side-width-compact: clamp(118px, 15vw, 148px);
--ui-side-width-standard: clamp(140px, 16vw, 176px);
--ui-gap: 6px;
--ui-panel-radius: 10px;
--ui-touch-min: 40px;
--ui-touch-compact-min: 36px;
--ui-center-corridor-min: 52vw;
--ui-drawer-max-height: 38vh;
```

The left/right safe-area values must be represented separately in actual CSS; the shorthand above describes intent only.

---

# Overlay priority matrix

Highest to lowest:

1. Loading / fatal error
2. Orientation lock
3. Result / evolution / mandatory choice modal
4. Shop or Item Bag drawer
5. Top HUD and phase controls
6. Left/right informational panels
7. Battlefield canvas

Rules:

- Mandatory modals close or visually suppress optional drawers.
- Shop and Bag are mutually exclusive on compact landscape screens.
- Informational panels may collapse, but primary actions may not disappear.
- No overlay may recreate the renderer or modify gameplay timing.

---

# Implementation phases

## Phase A — Layout Lock

1. Confirm canonical reference screenshot and target viewport.
2. Add shared layout tokens to the existing CSS.
3. Lock one-row top HUD.
4. Protect minimum center gameplay corridor.
5. Lock side-panel widths and combat/planning vertical priorities.
6. Lock Shop and Bag overlay heights/exclusivity.
7. Standardize touch target minimums.
8. Verify at 800×360, 844×390, and tablet landscape.

## Phase B — Visual Polish

1. Apply reference palette and panel materials.
2. Standardize typography scale.
3. Standardize border, radius, shadow, and highlight styles.
4. Upgrade shop-card hierarchy.
5. Add final icons after canonical asset/provenance validation.
6. Improve boss and primary-action emphasis.

## Phase C — Animation Polish

1. Standardize drawer transition duration.
2. Add button press/disabled feedback.
3. Add non-blocking card hover/press feedback.
4. Add phase-transition presentation.
5. Keep all animations presentation-only and reduced-motion safe.

---

# Priority checklist

1. [ ] Store/identify the approved reference screenshot and viewport.
2. [ ] Protect center gameplay corridor.
3. [ ] Prevent top HUD wrapping.
4. [ ] Define planning/combat right-column priorities.
5. [ ] Lock Shop card row and drawer height.
6. [ ] Enforce Shop/Bag exclusivity on compact landscape.
7. [ ] Standardize touch targets.
8. [ ] Standardize typography tokens.
9. [ ] Standardize panel visual tokens.
10. [ ] Add presentation animations only after layout validation.

# Recommended owner split

## Coco ownership

- Documentation and layout tokens
- DOM/CSS-only implementation after approval
- Shop card presentation
- Item Bag presentation
- Typography, icons, localization, and UI asset mapping
- Screenshot regression checklist

## CC ownership

- Three.js camera or board framing
- Tile/bench/deployment-zone visuals implemented inside runtime
- Any runtime state wiring
- Combat-phase state changes
- Renderer or game-loop changes

No implementation task should mix these ownership categories in one commit.