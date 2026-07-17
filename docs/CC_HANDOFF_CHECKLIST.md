# CC Handoff Checklist

## Purpose

Use this checklist before merging PR #7 or starting any runtime integration. PR #7 is documentation/data/validation work only and must not be treated as a completed runtime migration.

## Read first

1. `docs/GAME_DATA_CONTRACT_V1.md`
2. `docs/CLASS_EVOLUTION_AND_CODEX_POLICY.md`
3. `docs/UI_EVOLUTION_CODEX_SPEC.md`
4. `data/design/class-evolution-v1.json`
5. `data/design/hero-codex-v1.json`
6. `data/design/hero-balance-v1.json`
7. `data/design/hero-fusion-v1.json`
8. `data/design/economy-balance-v1.json`
9. `data/design/monster-balance-map1-v1.json`
10. `data/design/stage-plan-map1-v1.json`

## Run validators

```bash
node tools/validate-game-data.mjs path/to/game-data.json
node tools/validate-class-evolution.mjs
node tools/validate-hero-codex.mjs
node tools/validate-balance-pack.mjs
```

If any command requires a path or differs from the current implementation, report the exact command used and the module/file responsible. Do not silently skip a validator.

## Draft vs locked

### Locked policy

- Class 1 evolves into one of exactly two Class 2 branches.
- Evolution choice pauses PvE and has no timer.
- Bench capacity is 5.
- Each hero has 2 weapon slots.
- Early gold should buy only one Class 1 hero.
- Sellback target is approximately 80%.
- Elite: maximum 1, starts at stage 4, never on stages 5/10/15.
- Stage 5 and 10 are different minibosses; stage 15 is a fixed boss.
- UI placement must follow the existing customer reference layout.

### Balance draft

The following values are v1 tuning targets and are not final:

- Hero stats and skill numbers
- Monster stats
- Stage multipliers and enemy counts
- Combat duration targets
- Weapon inventory capacity draft
- Economy pacing beyond the locked early-purchase rule

## Merge gate for PR #7

- All validators pass.
- JSON parses successfully.
- No runtime file is modified.
- Existing game still boots and reaches combat.
- No regression in current shop/bench/combat flow.
- PR remains Draft until current embedded runtime IDs are compared against the new data IDs.

## Runtime integration boundary

Runtime integration must happen in a separate PR. Do not combine migration with broad balance changes.

Allowed first step:

- Add a small compatibility adapter that reads one data domain while preserving existing runtime behavior.

Do not change all of these in one PR:

- Hero stats
- Skill execution
- Fusion timing
- Economy
- Monster spawning
- Stage progression

## Required report format

Before changing runtime, report:

- working tree status
- current HEAD
- branch name
- exact files/modules to be used
- smallest implementation plan
- rollback point

After testing, report:

- validator results
- build/boot result
- x4 combat test result
- affected files/modules
- known failures or untested areas
