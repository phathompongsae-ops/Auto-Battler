# Mobile Landscape UI Acceptance Checklist

Status: Draft acceptance checklist
Scope: UI/DOM/CSS verification only unless a test explicitly names runtime observation

## Required viewports

- 800×360
- 844×390
- 915×412 as a wider sanity check

## Board visibility

- [ ] The board remains the dominant visual element.
- [ ] No persistent DOM panel covers the central combat area.
- [ ] The lower board and bench row remain visible enough for touch placement.
- [ ] Context messages disappear or remain narrow enough not to hide the board.

## Top HUD

- [ ] HP, wave, gold, level/EXP, speed, and pause remain readable.
- [ ] No pill wraps into a second row at required viewports.
- [ ] Controls respect left and right safe areas.
- [ ] Tap targets are at least approximately 40 CSS px on their shortest side where practical.

## Left-side hierarchy

- [ ] Team Link / Synergy is the only persistent large left-side panel.
- [ ] Bag access remains reachable and does not overlap Team Link.
- [ ] Left-side content does not intrude into the board's central interaction zone.

## Right-side hierarchy

- [ ] Enemy Wave information appears above team-detail controls.
- [ ] Start Battle remains the strongest lower-right action.
- [ ] Shop access remains visible without covering Start Battle.
- [ ] The full Team-in-Field roster is not persistently stacked under Enemy Wave.
- [ ] Compact team summary or drawer control does not compete with primary actions.

## Drawers and overlays

- [ ] Only one major drawer is open at a time.
- [ ] Opening Shop does not leave inaccessible controls underneath it.
- [ ] Opening Bag does not cover both the board center and Start Battle simultaneously.
- [ ] Closing a drawer restores the exact prior layout state.
- [ ] Overlay z-index order is documented and deterministic.

## Typography and density

- [ ] Primary values remain readable without browser zoom.
- [ ] Secondary labels may truncate, but critical numbers must not.
- [ ] Thai text does not clip vertically.
- [ ] Panel padding and gaps use shared layout tokens rather than isolated values.

## Interaction checks

- [ ] Hero drag begins without accidental browser pan/scroll.
- [ ] Placement highlight remains visible above the board but below DOM panels.
- [ ] UI buttons do not steal pointer input from the board outside their bounds.
- [ ] Expanded team details can be closed with one obvious action.

## Regression boundary

This UI pass must not change:
- combat outcomes
- wave composition
- economy
- targeting
- movement
- Three.js camera or board geometry unless handled by CC in a separate task

Any later combat-related verification must be run at x4 and identify the modules/files involved.