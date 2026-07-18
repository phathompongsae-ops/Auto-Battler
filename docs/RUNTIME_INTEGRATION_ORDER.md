# Runtime Integration Order

## Goal

Integrate PR #7 data into the existing game with the smallest reversible changes. Preserve current runtime behavior until each domain is independently verified.

## Phase 0 — Review only

- Run all validators.
- Compare all proposed IDs with the currently embedded runtime constants.
- Confirm the game boots without consuming the new data.
- Do not rebalance combat in this phase.

## Phase 1 — Hero data adapter

Scope:

- Read hero identity, class line, role metadata, and base stats through a compatibility adapter.
- Preserve existing hero creation and combat flow.
- Add fallback to current embedded values if a record is missing.

Exit criteria:

- All existing heroes spawn.
- No undefined or NaN stats.
- Shop and bench still function.
- x4 smoke combat completes.

## Phase 2 — Skill metadata adapter

Scope:

- Map skill IDs, mana cost, targeting metadata, scaling metadata, and presentation IDs.
- Do not rewrite the combat queue or effect execution architecture.

Exit criteria:

- Every hero resolves a valid skill ID.
- Mana gain and casting still occur.
- No duplicate casts or missing targets.
- x4 tests cover melee, ranged, heal, summon, control, and AoE examples.

## Phase 3 — Fusion and evolution choice

Scope:

- Connect fusion eligibility to `hero-fusion-v1.json`.
- Add centered two-choice evolution UI using the existing reference layout.
- Pause time-sensitive PvE while choosing.
- Record choice before replacing the unit.

Exit criteria:

- Exactly two valid choices for every Class 1 hero.
- Inputs are not consumed twice.
- Closing without a choice is blocked after consumption.
- Save/load cannot alter a recorded choice.

This phase touches Core Runtime and belongs to CC.

## Phase 4 — Economy, bench, and weapon capacity

Scope:

- Starting gold and shop pricing adapter.
- Bench hard cap of 5.
- Block purchase when bench is full.
- Two weapon slots per hero.
- Weapon inventory capacity draft remains configurable.
- Sellback calculation around 80%, using the declared rounding rule.

Exit criteria:

- Starting gold buys one Class 1 hero, not two.
- Full bench purchase is rejected without losing gold.
- Sell values match the data rule.
- No item or hero disappears on capacity failure.

## Phase 5 — Monster and Map 1 stage adapter

Scope:

- Import Map 1 monster definitions.
- Import stage 1–15 encounter plans.
- Preserve current spawn/combat systems; replace only data selection.
- Apply elite and boss policies from the data.

Exit criteria:

- Stages 1–15 resolve in order.
- Elite starts at stage 4, maximum one, absent on 5/10/15.
- Stage 5 and 10 minibosses differ.
- Stage 15 uses the fixed boss.
- No invalid monster references.

## Phase 6 — Balance test pass

Only after phases 1–5 work together:

- Run repeatable x4 combat tests.
- Collect telemetry defined in `docs/TEST_TELEMETRY_SPEC.md`.
- Adjust one variable family at a time.
- Tune heroes/economy first when player power is wrong.
- Tune monsters/stages after player power and progression are stable.

## PR and commit policy

Preferred: one PR per phase.

Minimum acceptable: separate commits per phase with clean rollback points.

Never combine all of the following in one unreviewable change:

- data migration
- combat architecture change
- skill rewrite
- economy rebalance
- stage rebalance

## Required testing rule

All combat-related integration tests must include x4 speed. Report the exact test harness, modules, and files used. Physical Android verification remains required for UI/rendering issues that appear only under headless Chromium or SwiftShader.
