# Game Data Contract v1

## Status

This document defines the first shared contract for game data. It is documentation-only and does not change runtime behavior.

The contract is designed so Data, UI, Asset Tooling, Save/Load, and Core Runtime can use the same IDs and field names without duplicating domain rules.

## Design rules

1. IDs are stable, lowercase snake_case strings.
2. Display text is referenced by localization keys, not embedded as gameplay truth.
3. Runtime-derived values are not stored in source data.
4. Cross-references use IDs and must resolve during validation.
5. Optional fields must have documented defaults.
6. Schema changes require a `schemaVersion` bump.
7. Core combat remains authoritative; presentation events never apply damage, healing, status, mana, or targeting changes.

## Root document

```json
{
  "schemaVersion": 1,
  "heroes": [],
  "monsters": [],
  "skills": [],
  "weapons": [],
  "fusionRules": [],
  "maps": [],
  "stages": [],
  "localization": {}
}
```

## Shared stat block

```json
{
  "hp": 100,
  "pAtk": 10,
  "mAtk": 0,
  "pDef": 5,
  "mDef": 5,
  "atkSpeed": 1.0,
  "moveSpeed": 1.0,
  "range": 1,
  "startingMana": 0,
  "maxMana": 100
}
```

Rules:

- All numeric values must be finite.
- `hp`, defenses, speeds, range, and mana values must be non-negative.
- `atkSpeed` is attacks per second unless Core Runtime explicitly documents another unit.
- `range` is measured in board cells.
- Balance values belong in data; formulas and combat timing remain Core Runtime responsibilities.

## Hero definition

```json
{
  "id": "fighter",
  "nameKey": "hero.fighter.name",
  "descriptionKey": "hero.fighter.description",
  "gender": "male",
  "classTier": 1,
  "classLine": "fighter",
  "roles": ["frontline", "physical"],
  "targetingBehavior": "nearest",
  "stats": {},
  "skillId": "fighter_power_strike",
  "assetId": "hero.fighter",
  "shop": {
    "enabled": true,
    "cost": 2,
    "weight": 1
  },
  "tags": []
}
```

Allowed `classTier` values:

- `0`: Novice / apprentice source unit
- `1`: Class 1
- `2`: Class 2
- `3`: Secret class

`classTier: 0` (Novice) is a generic-contract placeholder only. It is not valid for Demo 1; see `docs/DEMO1_DATA_POLICY.md`.

Initial Class 1 IDs:

- `fighter`
- `swordman`
- `archer`
- `mage`
- `summoner`
- `acolyte`
- `merchant`

Initial Class 2 IDs:

- `knight`, `berserker`
- `blade_master`, `duelist`
- `sniper`, `ranger`
- `archmage`, `frost_weaver`
- `beast_lord`, `spirit_blade`
- `priest`, `inquisitor`
- `tycoon`, `trickster`

Secret class IDs:

- `ninja`
- `black_dragon_knight`
- `sword_saint`

Gender constraints:

- Archer, Sniper, Ranger, Acolyte, Priest, and Inquisitor are female.
- All other current class lines are male.

## Monster definition

```json
{
  "id": "slime",
  "nameKey": "monster.slime.name",
  "kind": "normal",
  "roles": ["frontline"],
  "targetingBehavior": "nearest",
  "stats": {},
  "skillIds": [],
  "assetId": "monster.slime",
  "tags": ["map_1"]
}
```

Allowed `kind` values:

- `normal`
- `elite`
- `miniboss`
- `boss`

Initial normal monster IDs:

- `slime`
- `orc`
- `stonewolf`
- `skeleton`
- `spiritarcher`
- `shadowassassin`
- `golem`

Initial boss ID:

- `arena_overlord`

Stage 5 and Stage 10 minibosses are drawn from separate `kind: "miniboss"` pools rather than a single top-level boss list; see `docs/DEMO1_DATA_POLICY.md` for the confirmed Demo 1 pool membership.

## Skill definition

```json
{
  "id": "fighter_power_strike",
  "nameKey": "skill.fighter_power_strike.name",
  "descriptionKey": "skill.fighter_power_strike.description",
  "ownerIds": ["fighter"],
  "cast": {
    "manaCost": 100,
    "targetingBehavior": "nearest",
    "range": 1,
    "castTime": 0.4
  },
  "effects": [
    {
      "type": "damage",
      "damageType": "physical",
      "scalingStat": "pAtk",
      "ratio": 1.5,
      "flat": 0
    }
  ],
  "presentation": {
    "animationState": "cast",
    "effectId": "hit.normal",
    "projectileId": null
  },
  "tags": []
}
```

Allowed initial targeting behaviors:

- `nearest`
- `nearest_in_range`
- `cluster`
- `lowest_hp_ally`
- `lowest_hp_enemy`
- `backline`
- `hunter`

Important boundary:

- `presentation.animationState`, `effectId`, and `projectileId` only describe visuals.
- Animation frame events and projectile arrival must not independently calculate or apply gameplay effects.

## Weapon definition

```json
{
  "id": "iron_sword",
  "nameKey": "weapon.iron_sword.name",
  "level": 1,
  "slotType": "weapon",
  "stats": {
    "pAtk": 5
  },
  "passiveIds": [],
  "fusionInputs": [],
  "assetId": "weapon.iron_sword",
  "tags": []
}
```

Rules:

- Heroes have two weapon slots.
- Level 1 contains base weapons.
- Level 2 contains valid combinations of two Level 1 weapons.
- Level 3 is created from two identical Level 2 weapons.
- Fusion output IDs must be deterministic.
- Weapon data must not contain hero-drop rules.

Stage depth shop odds:

- Stages 1–5: Level 1 only
- Stages 6–9: 75% Level 1, 25% Level 2
- Stages 10–12: 50% Level 1, 40% Level 2, 10% Level 3
- Stages 13–15: 30% Level 1, 50% Level 2, 20% Level 3

## Fusion rule

```json
{
  "id": "fighter_to_knight",
  "kind": "hero_class_upgrade",
  "inputs": ["fighter", "fighter", "fighter"],
  "output": "knight",
  "inputTier": 1,
  "outputTier": 2
}
```

Rules:

- Hero class fusion in the current scope is Class 1 to Class 2 only.
- Input order is not significant unless a future rule explicitly sets `ordered: true`.
- Every input and output ID must resolve.
- Secret-class unlocks are map progression rewards, not ordinary fusion rules.

## Map definition

```json
{
  "id": "arena_ruins",
  "index": 1,
  "nameKey": "map.arena_ruins.name",
  "stageIds": [],
  "secretClassUnlock": "ninja",
  "themeAssetId": "map.arena_ruins"
}
```

Initial maps:

1. `arena_ruins` — unlocks `ninja`
2. `lava_hell` — unlocks `black_dragon_knight`
3. `heaven_temple` — unlocks `sword_saint`

## Stage definition

```json
{
  "id": "arena_ruins_01",
  "mapId": "arena_ruins",
  "stageNumber": 1,
  "encounterType": "normal",
  "maxEnemies": 3,
  "allowedMonsterIds": ["slime"],
  "bossPool": [],
  "statMultiplier": 1.0,
  "weaponDropLevels": [1],
  "reward": {
    "baseGold": 11,
    "noDeathBonus": 3
  },
  "augmentOffer": null
}
```

Rules:

- Each map contains 15 stages.
- Stages 5 and 10 are miniboss encounters.
- Stage 15 is a boss encounter and unlocks the map's secret class.
- Augments are offered after stages 5 and 10.
- `stageNumber` is local to the map, from 1 through 15.
- `statMultiplier` scales source stats; exact application order is Core Runtime responsibility.

Map 1 augment candidates:

After stage 5:

- Team: `+8% HP`
- Class-focused: `+15% P.ATK / M.ATK`

After stage 10:

- Team: `+10% ATK Speed`
- Class-focused: `start with 50% mana`

## Localization

```json
{
  "th": {
    "hero.fighter.name": "ไฟเตอร์"
  },
  "en": {
    "hero.fighter.name": "Fighter"
  }
}
```

Rules:

- Every `nameKey` and `descriptionKey` must exist in every required language.
- IDs remain language-independent.
- UI formatting such as percentages is handled by UI helpers, not hardcoded into source descriptions when avoidable.

## Validation requirements

A validator must fail on:

- duplicate IDs within the same entity type
- unresolved hero, monster, skill, weapon, asset, map, or stage references
- invalid class tiers or monster kinds
- invalid targeting behavior
- negative or non-finite numeric values
- stage numbers outside 1–15
- maps without exactly 15 stage IDs when marked complete
- boss stages without a boss pool
- fusion rules with missing inputs or output
- missing localization keys
- invalid weapon-level drop combinations

Warnings may be used for:

- unused definitions
- missing optional presentation IDs
- placeholder assets
- incomplete maps during development

## Running the validator against current canonical data

`tools/validate-game-data.mjs` takes a single root JSON file matching the shape
above, but the repository's canonical data lives in split authoring files
(`data/design/*.json`, `data/demo1-localization.json`). `tools/build-game-data-fixture.mjs`
is a small, deterministic adapter that assembles a root-shaped file from those
split files without inventing canonical facts:

```bash
node tools/build-game-data-fixture.mjs /tmp/game-data.fixture.json
node tools/validate-game-data.mjs /tmp/game-data.fixture.json
```

Field mapping used by the adapter:

- `heroes`: id/gender/classTier from `hero-codex-v1.json`; stats/skillId from `hero-balance-v1.json`.
- `monsters`: `map1-encounters-v1.json`, excluding entries marked `status:"obsolete"` (`warden`, `champion`).
- `skills`: `hero-balance-v1.json` skills, with `ownerId`/`effect` wrapped into `ownerIds`/`effects` arrays and `mana`/`target` renamed to `cast.manaCost`/`cast.targetingBehavior`.
- `fusionRules`: `hero-fusion-v1.json` rules, expanded from one two-output row into two single-output rows (the root schema has no concept of a player-choice output pair); inputs and the locked 3-identical-input rule are copied verbatim.
- `stages`/`maps`: `map1-encounters-v1.json`; `bossPool` is derived from `minibossPool` (Stage 5/10) or `[finalBossId]` (Stage 15).
- `weapons`: left empty — no canonical weapon-item records exist yet.

A handful of fields have no canonical source at all yet (`hero.targetingBehavior`,
`skill.cast.castTime`) and use an explicitly flagged placeholder rather than an
invented value; the adapter prints these as a gap summary on every run.

Localization for all 21 hero definitions (Class 1 and Class 2) and all 21 hero
skills now exists in `data/demo1-localization.json`. Running the adapter output
through the validator still reports real (non-adapter) errors from two remaining
gaps: unresolved monster/boss `skillIds` (no monster-skill data file exists yet)
and an unresolved `ninja` `secretClassUnlock` — `ninja` cannot be added to
`hero-codex-v1.json` without a design decision, because
`tools/validate-hero-codex.mjs` locks that file's contract to exactly 21
Class 1/Class 2 heroes across the seven known class lines, and no canonical
balance/skill data exists for `ninja`. These are pre-existing data gaps the
adapter surfaces accurately; closing them is tracked as follow-up work, not
part of this adapter.

## Migration and ownership

- This contract does not require immediate migration of constants already embedded in `src/game.js`.
- Migration should happen behind a small compatibility adapter and in separate commits.
- Data extraction must not be mixed with combat rebalance.
- Data/UI/Asset work may extend this contract.
- CC owns any changes that alter Core Runtime interpretation, combat formulas, movement, targeting, camera, or the main loop.
