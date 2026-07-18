# Test Telemetry Specification

## Purpose

Capture enough repeatable evidence to balance Map 1 without guessing. Use this only after the relevant runtime phase is connected.

## Mandatory test mode

- Combat tests must include x4 speed.
- Record whether the result was obtained in headless Chromium, desktop browser, or physical Android.
- Record the exact test harness, modules, files, branch, and commit SHA.

## One record per combat

```json
{
  "runId": "map1-balance-001",
  "commitSha": "",
  "platform": "physical_android",
  "speedMultiplier": 4,
  "stage": 1,
  "seed": null,
  "playerGoldBefore": 0,
  "playerGoldAfter": 0,
  "team": [],
  "benchCount": 0,
  "weaponInventoryCount": 0,
  "enemyIds": [],
  "eliteId": null,
  "bossId": null,
  "combatDurationGameSeconds": 0,
  "combatDurationRealSeconds": 0,
  "result": "win",
  "heroesAlive": 0,
  "heroesDead": 0,
  "totalPlayerDamage": 0,
  "totalEnemyDamage": 0,
  "skillCastsByUnit": {},
  "damageByUnit": {},
  "healingByUnit": {},
  "summonsCreated": 0,
  "targetingErrors": [],
  "runtimeErrors": [],
  "notes": ""
}
```

## Team entry

Each item in `team` should include:

- hero ID
- class tier
- star/rank state if applicable
- grid position
- current HP at combat start
- weapon IDs
- relevant augment IDs

## Required observations

### Combat health

- Win or loss
- Game-time duration
- Real-time duration at x4
- Number of surviving heroes
- First death time
- Whether the fight timed out

### Damage and skills

- Damage dealt by each unit
- Damage received by each unit
- Skill cast count
- Healing and shielding where applicable
- Summon count and lifetime where applicable
- Invalid, duplicate, or cancelled casts

### Economy and capacity

- Gold before and after
- Shop purchases and rerolls
- Sell transactions and calculated value
- Bench occupancy
- Rejected purchases due to full bench
- Weapon inventory occupancy
- Rejected item grants or purchases

### AI and targeting

Record any instance of:

- no target despite a valid enemy
- attacking an invalid/dead target
- targeting behavior differing from data
- units stuck between cells
- repeated retarget loops
- backline/hunter behavior selecting the wrong category

## Minimum test matrix

For each relevant stage, run at least:

1. Baseline legal team
2. Weak but reasonable team
3. Strong economy/weapon outcome

Priority stages:

- Stage 1: one Class 1 hero affordability baseline
- Stage 4: first elite eligibility
- Stage 5: first miniboss
- Stage 6: post-augment transition
- Stage 10: second miniboss
- Stage 11: second post-augment transition
- Stage 15: fixed boss

## Initial duration targets

These are draft signals, not pass/fail laws:

- Normal stage: 15–30 game seconds
- Miniboss: 25–45 game seconds
- Boss: 40–60 game seconds

At x4, compare both game-time and real-time values so speed scaling bugs are visible.

## Balance interpretation order

When difficulty is wrong, inspect in this order:

1. Runtime bugs and invalid targeting
2. Hero stats and skill execution
3. Economy and expected team size
4. Weapon/augment power
5. Enemy count and composition
6. Monster base stats
7. Stage multiplier

Do not increase or decrease monster stats before ruling out player-power or runtime errors.

## Change discipline

- Change one variable family per test batch.
- Keep before/after records.
- Do not tune heroes and monsters simultaneously unless correcting an obvious invalid value.
- Use at least three repeated runs before treating a result as a trend when randomness exists.

## Test report summary

Each test batch should conclude with:

- branch and commit
- files/modules used
- tests run at x4
- pass/fail totals
- median combat duration
- median survivors
- major runtime defects
- suspected balance issues
- recommended next single change
