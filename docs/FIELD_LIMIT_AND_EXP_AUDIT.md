# Field Limit and EXP UI Audit

## Scope
Read-only review of the current `main` implementation. No production code, CSS, assets, or workflow files were modified.

## Confirmed defect: field capacity is not tied to player level

The runtime defines `MAX_FIELD = 5` as a fixed global cap. `moveUnitTo()` blocks a bench-to-field move only when `placedUnits.length >= MAX_FIELD`.

Current consequence:
- Level 1 can deploy up to 5 heroes.
- Buying EXP and increasing `level` does not increase deployment capacity because capacity is already fixed at 5.
- The field counter and full-field hint also use `MAX_FIELD`, so the UI consistently reports `/5` rather than the level-derived capacity.

This is a real gameplay regression, not only a display problem.

## EXP system status

The EXP system still exists:
- The top bar contains `Lv.`, current EXP, and the `+EXP` button.
- `renderUI()` updates the level/EXP labels.
- The button is disabled outside shop phase or when gold is below `BUY_EXP_COST`.
- The click handler spends `BUY_EXP_COST`, adds `BUY_EXP_GAIN`, and repeatedly levels up while enough EXP remains.

Therefore the EXP purchase logic has not been removed. Its gameplay value is currently reduced because field capacity does not read `level`.

## Mobile visibility audit

The `+EXP` control is nested inside the same no-wrap `.pill` as `Lv.` and the EXP fraction. The top bar also contains several other no-wrap pills, while the left and right groups are fixed non-shrinking groups.

The center group allows wrapping, but there is no dedicated narrow portrait breakpoint that reorganizes the level/EXP control. On a narrow mobile viewport the level pill can be pushed to another line, crowded between the fixed left/right groups, or become difficult to notice beneath the top overlay. The current source does not deliberately hide `#buyExpBtn`.

Conclusion:
- Confirmed: field capacity logic is wrong.
- Confirmed: the EXP button and click logic still exist.
- Probable UI issue: responsive top-bar crowding, not an intentional `display:none` rule.
- Runtime screenshot/device measurement is still required to identify the exact portrait failure mode before changing CSS.

## Minimal correction direction

After CC finishes the loader task and the current `src/game.js` diff is safely committed:

1. Introduce one field-capacity source of truth derived from player level, capped by the intended maximum.
2. Use that value in `moveUnitTo()` instead of the fixed `MAX_FIELD` check.
3. Use the same value in field count, full-field state, hint text, tile/drop validation, and any other deployment entry point.
4. Keep `MAX_FIELD` only as the absolute design cap if needed; do not use it as the current capacity.
5. Do not automatically remove already-deployed heroes if capacity somehow decreases; level currently only rises.
6. Give the level/EXP control a deliberate mobile layout rule rather than hiding it.

## Product rule requiring owner confirmation

Recommended default based on the reported expected behavior:

`fieldCapacity = min(level, MAX_FIELD)`

This means:
- Level 1: 1 hero
- Level 2: 2 heroes
- Level 3: 3 heroes
- Level 4: 4 heroes
- Level 5 and above: 5 heroes

Confirm this progression before implementation if the intended maximum level or field cap differs.

## Required focused tests

Use x4 for combat checks.

1. Fresh run at level 1: first hero deploys; second hero remains on bench and cannot be dropped into battle rows.
2. Buy EXP to level 2: second hero becomes deployable immediately without reload.
3. Verify field counter changes from `1/1` to the appropriate `1/2`, then `2/2`.
4. Verify tap-to-move and drag-to-move enforce the same capacity.
5. Moving a field hero between battle tiles must not be blocked when already at capacity.
6. Moving a field hero back to bench must reduce the count and reopen one slot.
7. Test the `+EXP` control on narrow portrait mobile, landscape mobile, tablet, and desktop.
8. Run one combat wave at x4 after deployment-limit changes to confirm deployed units, summons, wave completion, and cleanup are unaffected.

## Ownership

This audit is documentation only. Do not implement it concurrently with CC's in-progress Asset Loader Failure Handling changes in `src/game.js`.