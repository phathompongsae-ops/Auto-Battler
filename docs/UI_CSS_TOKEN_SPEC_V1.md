# UI CSS Token Specification V1

Status: proposed documentation only. Values are targets for the first layout pass and are not yet applied to runtime files.

## Goals

- Keep the 3D board visually dominant.
- Make Thai text readable on short landscape phones.
- Prevent panel growth from pushing into the board.
- Reuse a small shared token set instead of one-off CSS values.

## Target viewports

- 800 × 360: minimum supported short landscape
- 844 × 390: primary Android reference
- 915 × 412: large-phone verification

## Proposed root tokens

```css
:root {
  --ui-safe-left: max(8px, env(safe-area-inset-left));
  --ui-safe-right: max(8px, env(safe-area-inset-right));
  --ui-safe-top: max(6px, env(safe-area-inset-top));
  --ui-safe-bottom: max(6px, env(safe-area-inset-bottom));

  --ui-space-1: 4px;
  --ui-space-2: 6px;
  --ui-space-3: 8px;
  --ui-space-4: 12px;
  --ui-space-5: 16px;

  --ui-radius-sm: 6px;
  --ui-radius-md: 10px;
  --ui-radius-lg: 16px;

  --ui-font-xs: 10px;
  --ui-font-sm: 12px;
  --ui-font-md: 14px;
  --ui-font-lg: 18px;

  --ui-touch-min: 44px;
  --ui-topbar-height: 54px;
  --ui-side-width: clamp(148px, 17vw, 188px);
  --ui-action-width: clamp(170px, 21vw, 230px);
  --ui-panel-max-opacity: 0.86;
  --ui-panel-border-width: 1px;
  --ui-z-board: 0;
  --ui-z-panel: 10;
  --ui-z-drawer: 20;
  --ui-z-modal: 30;
  --ui-z-orientation: 40;
}
```

## Layout budgets

### Top HUD

- Maximum visual height: 54px at 800 × 360.
- Must remain one row at all target viewports.
- Nonessential labels may collapse before values or icons.
- Speed and Pause remain separate touch targets.

### Left panel

- Width uses `--ui-side-width`.
- Team Link is the only persistent large panel in this column.
- Item Bag may use a compact button below it.
- No field-team roster list in this column.

### Right panel

- Enemy panel uses the upper portion only.
- Maximum height target: 42vh, with internal scrolling only when necessary.
- Shop and Start Battle own the right-lower action zone.
- Persistent field-team list is prohibited in this zone.

### Center board clearance

- Side overlays must preserve an unobstructed central corridor.
- At 844 × 390, combined left and right persistent overlays should target no more than 42% of viewport width.
- Temporary guidance must fade or relocate before it obscures bench interaction.

## Component rules

### Buttons

- Minimum hit area: 44 × 44px.
- Primary Start Battle button may be taller but should not exceed 62px.
- Icons must not be the only clue for destructive or stateful actions.

### Panels

- One shared panel background and border hierarchy.
- Avoid nested opaque cards where one border is sufficient.
- Internal list rows may be denser than panel headers but must remain touch-safe if interactive.

### Typography

- Thai panel headings: minimum 12px.
- Primary values: 14px minimum.
- HP numbers inside bars: 10px minimum where space permits.
- No text should be cut vertically at 800 × 360.

### Motion

- Layout pass uses no new animation.
- Later visual polish may use 120–180ms opacity/transform transitions.
- No animation may delay Start Battle, Pause, Shop, or Bag interaction.

## Implementation order

1. Add tokens without changing component appearance.
2. Migrate top HUD spacing and touch targets.
3. Migrate side widths and height budgets.
4. Remove or collapse persistent field-team panel.
5. Lock right-lower actions.
6. Verify all target viewports.
7. Apply visual skin only after layout acceptance.

## Protected runtime boundary

Token adoption must not change JavaScript state, event registration, Three.js renderer sizing, camera fitting, board geometry, combat speed behavior, or drawer state logic.
