# Known Issues and Locked Priorities

## Active work owned by CC

### Asset loader failure handling
CC has already been assigned the loader-failure task. Do not duplicate or overwrite that work.

Expected outcome:
- A failed sprite load must not leave the loading screen stuck.
- Failed sprite keys should route to the existing placeholder unit visual.
- Success behavior and disposal lifecycle must remain unchanged.

Until CC reports back, treat this work as in progress and do not assign the same code path to another agent.

## Confirmed gameplay issue

### Melee units cross or oscillate instead of engaging
Observed behavior:
- A player melee unit and an enemy melee unit approach each other.
- Both can pass, swap, or repeatedly chase each other without stopping to attack.

Likely areas to inspect later:
- Attack-range check before movement
- Path destination selection for melee units
- Occupied-tile timing
- Direct tile-swap prevention
- Destination reservation
- Deterministic movement priority

Required principle:
Melee units should path to a valid attack position adjacent to the target, stop when in range, and never swap occupied tiles in the same movement resolution.

Status: recorded; no implementation assigned yet.

## Locked production priority
Before character Asset and Animation production:
1. Lock camera and stage framing.
2. Lock board edges and visible stage depth.
3. Lock bench platform and divider.
4. Lock lower HUD/shop spacing.
5. Verify responsive layout and interaction hit areas.
6. Then prove the pipeline with three real assets: one Class 1 hero, one normal monster, and one stage-5 boss.

Do not expand full character production before these layout foundations are stable.

## Deferred systems
- Survival Mode: postpone until all three maps and 45 main stages are complete.
- Three-star hero system: postpone until the same late phase.

## Agent ownership rule
- CC and Codex must not edit the same code area concurrently.
- Parallel work is allowed only when file/code ownership is clearly separate.
- Documentation-only PRs may proceed while CC has a code diff, but CC should finish and commit its current task before syncing updated `main`.
- Before starting a new task, every agent must report branch, HEAD, and working-tree status, then read the latest handoff documents.
