# Regression & Release Checklist

## Purpose
Use the smallest test scope that matches the risk of the change. Do not run a full 15-wave regression by default. Reuse recent valid evidence instead of repeating the same checks without a code-path reason.

## Credit-saving rules
- Do not repeat branch/HEAD/status checks more than once per handoff unless the branch changed.
- Do not rerun unrelated combat, layout, or asset checks when touched files cannot affect them.
- Reuse the latest passing evidence when the relevant code path and assets are unchanged.
- One agent implements; the other reviews. Do not edit the same runtime file in parallel.
- Prefer one focused reproduction plus nearby edge cases over broad random play.
- Full 15-wave testing is reserved for milestones, broad architecture changes, or release preparation.
- Do not prepare or send an agent command unless the project owner explicitly asks for it or authorizes execution.
- Every task report must name the modules, tools, files, and code areas used.

## Standard pre-check
- Confirm branch, HEAD, and working-tree status.
- Confirm the change scope and files touched.
- Identify the modules and tools used for implementation and verification.
- Check the browser console for new errors.
- Run `git diff --check` before commit.

## Test levels

### Level 1 — Documentation or isolated non-runtime change
Use for docs-only updates and changes that cannot affect runtime.

Required:
- Verify only intended files changed.
- Check links, paths, naming, and formatting.
- No combat run required.

### Level 2 — Small runtime or visual change
Use for isolated loader, UI, asset-path, VFX, or visual-state changes.

Required:
- Load the game from a clean start.
- Confirm shop/deployment remains usable.
- Test one combat wave at speed x4 only when the change can affect combat timing or unit visuals.
- Verify no new console, loading, or disposal errors.

For a shop-drawer compositing workaround:
- Confirm the original artifact reproduces before the change at `800×360` and `844×390` using the same browser/WebGL backend.
- Change one CSS candidate at a time; do not combine candidates until an individual result is known.
- Open and close the drawer repeatedly with at least one shop portrait image present.
- Verify drawer position, portrait display, buttons, reroll, purchasing, and interaction hit areas.
- Check at least one portrait size and `1024×768` for nearby regressions.
- Do not edit the render loop or `src/game.js` during a CSS-only phase.
- Record that passing SwiftShader evidence does not confirm real Android hardware behavior.

### Level 3 — Combat, movement, targeting, economy, deployment, or board-interaction change
Use when changing movement resolution, range checks, targeting, pathfinding inputs, occupied tiles, field capacity, EXP/level flow, drag/drop, or bench/grid hit areas.

Required:
- Test at speed x4 for combat and time-dependent checks.
- Run 3–5 focused waves rather than all 15.
- Include the exact scenario being fixed plus nearby edge cases.
- Verify deterministic behavior and no unit duplication, overlap, tile swap, stuck state, NaN, or disposal error.

For melee movement:
- Melee versus melee approaching head-on.
- Offset approach near an obstacle.
- Two allies approaching one target.
- Faster mover versus slower mover.
- Confirm units stop in Manhattan attack range and never directly swap occupied tiles.

For field limit and EXP:
- Level 1 permits 1 field hero.
- Each level increase raises capacity by 1 until the configured cap.
- Drag and tap placement use the same capacity source.
- Field count and full-field messages show the dynamic capacity.
- Buying EXP updates level, EXP display, capacity, and button state correctly.
- Existing field units are not silently deleted if capacity rules change.

### Level 4 — Milestone regression
Use only for broad architecture changes, map/stage milestone completion, release preparation, or changes spanning several core systems.

Required:
- Full planned progression or 15-wave regression as appropriate.
- Test at speed x4 for time-dependent combat checks during development.
- Verify economy, deployment, combat, wave transitions, bosses, cleanup, restart/reset, and responsive layouts.

## Responsive layout checks
When camera, stage, bench, shop, or HUD changes:
- Mobile portrait.
- Mobile landscape.
- Tablet.
- Desktop.
- Safe-area insets.
- `+EXP`, level, gold, wave, and player HP remain visible and tappable.
- Board picking and tile highlighting remain aligned.
- Bench slot hit areas remain aligned.
- Left/right panels do not intercept required board interactions.
- Shop, Bag, Start Battle, hint/selected-unit bars, and shop drawer do not cover each other or the bench.

## Asset and loader checks
When changing asset loading or paths:
- Baseline with all assets available.
- One intentionally broken path during local testing only.
- Loading must finish even when one asset fails.
- Failure logging identifies the asset key and path.
- Failed asset must use the existing fallback visual.
- Completion callback runs exactly once.
- Restore the path before commit.
- No temporary broken path or test asset may be committed.
- Check GitHub Pages relative paths and exact filename case.

## Resource cleanup checks
Run only when unit creation/removal, VFX, textures, materials, or wave cleanup changes:
- Removed units leave no visible body, shadow, bars, badges, timers, or callbacks.
- Repeated focused waves do not show continuously increasing renderer resources caused by the changed path.
- No callback touches a disposed visual after death or removal.

## Pre-release gate
Before a public build or release candidate:
- Default game speed is x1.
- Player-facing x4 is removed or disabled.
- x4 is not merely hidden; public shortcuts, query parameters, or normal UI paths cannot enable it.
- Developer x4 may remain only behind an explicit internal test mode.
- Run release smoke checks at the real player speed, not only x4.
- Verify production GitHub Pages deployment and a clean browser load.
- Verify no debug labels, temporary assets, forced failures, test gold, or test shortcuts remain.
- Verify layout/UI is locked before bulk asset production begins.

## Reporting format
Report only evidence relevant to the change:
- Base commit and branch.
- Files changed.
- Modules, tools, and code areas used.
- Test level used and why.
- Exact scenarios tested at x4 when combat is involved.
- Pass/fail and any remaining risk.
- Checks intentionally skipped because they were unrelated or already covered by unchanged valid evidence.
- Commit hash, PR, and final working-tree status.
