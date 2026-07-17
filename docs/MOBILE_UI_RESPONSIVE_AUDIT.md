# Mobile UI & Responsive Audit (Read-only)

## Scope

Read-only inspection of `autochess.html` on `main`. No runtime or production code was changed.

Focus:

- Topbar overflow and `+EXP` visibility
- Left/right floating panels covering the playable board
- Bottom controls (`Bag`, `Shop`, `Start Battle`) competing for space
- Touch target and safe-area behavior
- Minimum-change implementation direction

## Confirmed current structure

- `#boardContainer` fills the viewport and all UI floats above the canvas.
- `#topbar` has fixed left, center, and right groups.
- `#topbarCenter` may wrap, but each `.pill` uses `white-space: nowrap`.
- The center group contains player HP, wave, gold, Lv/EXP/+EXP, phase, and optional stage label.
- The right group always contains speed and pause buttons.
- Responsive CSS only has a height-based mobile-landscape rule (`max-height: 430px`) and a tablet rule (`min-width: 900px`). There is no narrow-width/portrait-specific rule.
- Left and right status panels are fixed overlays with widths from 130px upward.
- Bag controls occupy the bottom-left; Shop and Start Battle occupy the bottom-right.

## Findings

### 1. `+EXP` is not intentionally hidden

The button exists inside the Lv/EXP pill and no CSS rule sets `display:none` on it.

Likely failure mode on narrow screens:

- The left menu button and right speed/pause buttons reserve fixed width.
- Center pills cannot shrink internally because `.pill` uses `white-space: nowrap`.
- `#topbarCenter` may wrap to another row, but the camera/layout clearance logic and panel top offsets assume a compact topbar.
- On a narrow portrait viewport, the Lv/EXP pill may be pushed below other UI, covered by a panel, or appear outside the user's expected top row.

This should be treated as a responsive-layout defect, not an EXP-system defect.

### 2. Current mobile rule is height-only

`@media (max-height: 430px)` improves landscape phones but does not address narrow portrait widths.

Risk:

- A tall but narrow phone may not activate any mobile compaction rule.
- The full topbar, two side panels, and bottom controls can all remain at desktop-like minimum widths.

### 3. Side panels can consume most of the playable width

Each side starts at roughly 130px wide. On a narrow screen, the combined overlays can leave too little visually clear center space even though the Three.js board still renders full-screen underneath.

This is currently a visual/interaction risk rather than a board-coordinate bug:

- Canvas and raycast coordinates remain full viewport.
- Fixed panels can intercept pointer input where they overlap the board.
- A tile can be visible only partially or be difficult to select near either side.

### 4. Bottom controls have no shared collision layout

- Bag is anchored bottom-left.
- Shop and Start Battle are anchored bottom-right.
- Hint/selected-unit bars and the shop drawer also occupy the lower screen area.

There is no single bottom safe-zone container coordinating these elements. On narrow or short screens, controls may visually compete with the bench row and each other.

### 5. Touch targets are inconsistent

The main Start Battle button is large enough, but some compact controls become small under the height-based media query. The `+EXP` control is especially compact and embedded inside a dense pill, which makes it harder to discover and tap reliably.

## Minimum-change implementation direction

Do not redesign the entire HUD in the first fix.

### Commit 1 — Narrow-width topbar compaction

Add one width-based breakpoint for phones, for example around `max-width: 700px`:

- Hide or shorten low-priority text before hiding controls.
- Keep Lv, EXP progress, and `+EXP` visible.
- Reduce HP-label text before removing the HP bar.
- Hide `#phaseLabel` first because Start Battle already communicates the preparation phase.
- Allow a deliberate two-row topbar instead of accidental wrapping.
- Keep speed controls during development only; release cleanup is a separate pre-release task.

### Commit 2 — Side-panel compact/collapse behavior

At narrow widths:

- Reduce panel width below the current 130px minimum, or make one/both panels collapsible.
- Do not change panel data or combat logic.
- Keep critical counts visible when collapsed.

### Commit 3 — Bottom safe zone

Create one coordinated lower HUD layout rule so:

- Bag remains left.
- Shop/Start remain right.
- Hint/selected-unit bar stays centered.
- Shop drawer opens without covering the Start Battle button unexpectedly.
- Bench tiles retain a visually clear interaction band.

This can be CSS/DOM-only if existing IDs are preserved.

### Commit 4 — Touch target pass

- Ensure primary mobile controls have a practical minimum tap area.
- Increase the `+EXP` button's tap area without significantly increasing pill width.
- Preserve safe-area insets.

## Acceptance checks

Test only the smallest useful viewport matrix:

1. Phone portrait, approximately 360×800
2. Phone landscape, approximately 800×360
3. Tablet landscape, approximately 1024×768

For each:

- Lv, EXP, and `+EXP` are visible and tappable during shop phase.
- No critical topbar element is clipped.
- Side panels do not make central board interaction impractical.
- Bag, Shop, Start Battle, hint/selection bar, and shop drawer do not overlap in a way that blocks required actions.
- Bench-row taps/drags remain usable near both lower corners.
- No gameplay, economy, camera, or raycast logic is changed.

## Credit-saving handoff

When implementation begins, the assignee should not re-audit the full UI from scratch. Recheck only the current branch diff and the three target viewport sizes above, then implement the smallest CSS/DOM change that satisfies the acceptance checks.
