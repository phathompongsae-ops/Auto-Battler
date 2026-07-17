# Melee Movement Audit

## Scope
Read-only audit of `src/game.js` on `main` at commit `509b7569f76c58302b85d32b396b13367a02b693`.

No runtime code was modified.

## Observed issue
A player melee unit and an enemy melee unit can approach each other, pass or chase each other, and fail to stop for combat.

## Root cause
The movement code paths directly toward the target's occupied tile:

- `updateUnit()` checks current integer grid coordinates with `gridDist()`.
- If the current distance is greater than attack range, it calls `stepToward(u, target)`.
- `stepToward()` runs A* with the target's current tile as the destination.
- The A* rule permits the destination tile even when occupied because `(nc===tc&&nr===tr)` bypasses the occupied-tile rejection.
- `stepToward()` then rejects the final occupied tile itself, but only after selecting `path[0]`.
- A moving unit immediately reserves its next tile by removing its old tile from `occupied` and adding the destination tile before interpolation completes.
- `updateUnit()` returns early while moving, so range and attack checks are not performed during interpolation.
- Units are updated sequentially in array order, meaning later units observe reservation changes made by earlier units in the same frame.

This combination can create repeated pursuit of stale integer positions and movement-order oscillation. It does not provide an explicit concept of a valid melee attack tile adjacent to the target, and it has no direct swap-intent guard.

## Minimal correction direction
Do not rewrite A*.

1. For melee movement, select a reachable free tile within attack range of the target instead of using the target's occupied tile as the A* destination.
2. Re-check attack range immediately before starting a move.
3. Prevent direct swap intents where A reserves B's current tile while B intends A's current tile.
4. Keep current destination reservation behavior unless testing proves a per-tick reservation set is required.
5. Use deterministic tie-breaking for equal candidate attack tiles.

## Important implementation constraint
The game currently uses Manhattan distance:

`abs(a.c - b.c) + abs(a.r - b.r)`

Therefore range 1 means orthogonal adjacency only. Do not silently add diagonal melee attacks while fixing this bug.

## Expected code area
- `astar()`
- `gridDist()`
- `stepToward()`
- movement/range portion of `updateUnit()`
- optional small movement-intent/reservation state if direct swap cannot be prevented locally

## Required regression checks
Run combat at x4.

- Melee vs melee approaching head-on
- Perpendicular approach
- Two allies approaching one target
- Blocked adjacent tile
- Narrow path
- Different move speeds
- No occupied-tile overlap
- No direct tile swap
- Units stop and attack when Manhattan distance is within range
- 3–5 focused waves; no routine 15-wave run
- No NaN, stuck wave, duplicate unit, or disposal error

## Ownership
CC currently owns Asset Loader Failure Handling in `src/game.js`. Do not implement this melee fix concurrently with CC's in-progress diff. Assign implementation only after CC finishes and commits the loader task, then start from the latest `main`.
