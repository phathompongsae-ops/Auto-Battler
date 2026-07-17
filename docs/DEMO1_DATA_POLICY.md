# Demo 1 Data Policy

This document narrows `GAME_DATA_CONTRACT_V1.md` to the confirmed Demo 1 scope. It is authoritative for Demo 1 whenever the generic contract still contains an older placeholder or broader future-facing option.

## Locked scope

- Map: `arena_ruins`
- Stages: 1–15
- Class 1 roster: exactly seven heroes
- Bench capacity: exactly five
- Stage 5: select one miniboss from a two-member Map 1 miniboss pool
- Stage 10: select the remaining miniboss from the same two-member pool
- Stage 15: fixed `arena_overlord` boss
- Secret class unlock after Stage 15: Ninja
- Elite enemies start at Stage 4, maximum one elite per stage, and never appear on Stages 5, 10, or 15

## Hero policy

The only Class 1 hero IDs in Demo 1 are:

- `fighter`
- `swordman`
- `archer`
- `mage`
- `summoner`
- `acolyte`
- `merchant`

`novice` is removed from the design. Demo 1 data must not contain:

- hero ID `novice`
- `classTier: 0`
- Novice Shop entries
- Novice roster, fusion, spawn, fallback, localization, or asset mappings

The generic contract's historical Class Tier 0 example is not valid for Demo 1.

## Boss identity policy

Demo 1 uses the following confirmed encounter structure:

| Stage | Encounter | Confirmed rule |
|---:|---|---|
| 5 | Miniboss | One random member of a two-ID Map 1 miniboss pool |
| 10 | Miniboss | The remaining member of that same pool; no repeat in the same run |
| 15 | Boss | Fixed logical ID `arena_overlord` |

Known candidate notes:

- `golem` is expected to be one of the Stage 5/10 miniboss-pool members, pending final verification of the complete two-ID pool.
- `bone_dragon` is expected to be one of the Stage 5/10 miniboss-pool members.
- The second/complete pool membership must not be guessed or locked from obsolete draft data.
- Stage 13 is a normal stage and has no fixed boss assignment.
- `champion` / `Immortal Champion` is obsolete for Demo 1 Stage 15 and must not be treated as a second final boss.

The data shape should use:

- `minibossPool`: exactly two unique IDs once both candidates are confirmed
- `minibossSelectionPolicy`: `shuffle_without_replacement`
- `finalBossId`: `arena_overlord`

Until both miniboss IDs are confirmed, validators must not invent or hard-code an unverified second candidate.

## Secret class policy

`ninja` is a Class Tier 3 secret class unlocked through Map 1 progression. It is not a normal Class 1→Class 2 fusion output and must not be enabled in the standard Shop pool.

## Monster skills

Monster definitions use `skillIds`, including an empty array when a monster has no active skill. Runtime behavior remains authoritative; data only declares references.

## Validation

Run both validators when a Demo 1 game-data file is introduced:

```bash
node tools/validate-game-data.mjs path/to/game-data.json
node tools/validate-demo1-policy.mjs path/to/game-data.json
```

The first command validates the reusable contract. The second command enforces Demo 1-specific locks that should not be generalized to future maps or modes.

## Ownership boundary

This policy and validator do not alter `src/game.js`, combat formulas, movement, targeting, camera, stage execution, drag-and-drop, Shop runtime, or the main loop. Runtime integration remains a separate task after the active CC changes are complete.
