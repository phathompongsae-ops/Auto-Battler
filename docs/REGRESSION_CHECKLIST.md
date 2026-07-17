# Regression Checklist

## Purpose
Use the smallest test scope that matches the risk of the change. Do not run a full 15-wave regression by default.

## Standard pre-check
- Confirm branch, HEAD, and working-tree status.
- Confirm the change scope and files touched.
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
- Test one combat wave at speed x4.
- Verify movement, attacks, deaths, wave completion, and no new console/disposal errors.

### Level 3 — Combat, movement, targeting, or board-interaction change
Use when changing movement resolution, range checks, targeting, pathfinding inputs, occupied tiles, drag/drop, or bench/grid hit areas.

Required:
- Test at speed x4.
- Run 3–5 focused waves rather than all 15.
- Include the exact scenario being fixed plus nearby edge cases.
- Verify deterministic behavior and no unit duplication, overlap, tile swap, stuck state, NaN, or disposal error.

For the recorded melee-crossing issue, include:
- Melee versus melee approaching head-on.
- Diagonal approach where diagonal attacks are allowed.
- Two allies approaching one target.
- Narrow-path or blocked-adjacent-tile case.
- Confirm units stop in attack range and never directly swap occupied tiles.

### Level 4 — Milestone regression
Use only for broad architecture changes, map/stage milestone completion, release preparation, or changes spanning several core systems.

Required:
- Full planned progression or 15-wave regression as appropriate.
- Test at speed x4 for time-dependent combat checks.
- Verify economy, deployment, combat, wave transitions, bosses, cleanup, restart/reset, and responsive layouts.

## Responsive layout checks
When camera, stage, bench, shop, or HUD changes:
- Mobile portrait.
- Mobile landscape.
- Tablet.
- Desktop.
- Safe-area insets.
- Board picking and tile highlighting remain aligned.
- Bench slot hit areas remain aligned.
- Shop/HUD does not cover the bench or required controls.

## Asset and loader checks
When changing asset loading or paths:
- Baseline with all assets available.
- One intentionally broken path during local testing only.
- Loading must finish even when one asset fails.
- Failed asset must use the existing fallback visual.
- Restore the path before commit.
- No temporary broken path or test asset may be committed.

## Reporting format
Report only evidence relevant to the change:
- Base commit and branch.
- Files changed.
- Test level used and why.
- Exact scenarios tested at x4 when combat is involved.
- Pass/fail and any remaining risk.
- Commit hash, PR, and final working-tree status.
