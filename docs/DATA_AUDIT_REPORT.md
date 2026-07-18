# Data Audit Report — PR #7

## Scope

Static audit of the data, schema, localization, and validator files in Draft PR #7. This report does not claim that runtime integration or combat balance has been tested.

## Overall status

**Ready for CC contract review, not ready for direct full runtime replacement.**

The design pack is internally organized and preserves the agreed boundaries, but it intentionally contains draft balance values and several adapter requirements.

## Pass

- Seven Class 1 lines and fourteen Class 2 branches are defined.
- Every Class 1 line has exactly two evolution choices.
- Gender policy is represented consistently: Archer/Acolyte lines are female; the other current lines are male.
- Hero balance contains 21 unique hero records and 21 owner-linked skills.
- Economy preserves the locked five-slot bench and two weapon slots per hero.
- Starting gold equals one Class 1 hero purchase and cannot purchase two Class 1 heroes.
- Sellback examples follow `floor(value * 0.8)`.
- Map 1 contains stages 1–15 with minibosses at 5/10 and a fixed boss at 15.
- Stage 5 and Stage 10 miniboss pools do not overlap.
- Elite policy starts at stage 4, allows at most one elite, and excludes stages 5/10/15.
- Ninja unlock is attached to Map 1 stage 15.
- No Core Runtime files are changed in this PR.

## Warnings

### W1 — Design files are not direct instances of the root game-data schema

Files under `data/design/` use compact authoring shapes. They require a compatibility adapter before being consumed as `game-data.schema.json` records.

Examples:

- Hero balance uses `tier`, while the root schema uses `classTier`.
- Skill draft uses `ownerId`, `mana`, `target`, and a single `effect`; the root schema expects `ownerIds`, `cast`, `effects`, and `presentation`.
- Encounter monsters contain partial stats only; the root schema requires the complete shared stats object.
- Stage drafts use `stage`, `type`, `pool`, and `multiplier`; the root schema uses `stageNumber`, `encounterType`, `allowedMonsterIds`, and `statMultiplier`.

**Action:** CC should build a small adapter or normalize the files before runtime use. Do not silently treat the compact files as final runtime JSON.

### W2 — Skill presentation metadata is intentionally missing

The balance draft does not yet define animation, effect, or projectile presentation IDs. These must be mapped only after Asset Manager, Animation, Effect, and Projectile contracts are accepted.

**Action:** use explicit null/fallback presentation values in the adapter until final asset IDs exist.

### W3 — Status and summon references need runtime definitions

The following references are semantic placeholders and must be backed by runtime definitions before their skills are enabled:

- `status.slow`
- `status.blind`
- `summon.spirit_wolf`
- `summon.alpha_beast`

### W4 — Multi-hit is outside the current root skill-effect schema

`skill.rapid_volley` includes `hits: 3`, while the current root `skillEffect` definition does not allow `hits`.

**Action:** choose one of these during contract review:

1. add an optional bounded `hitCount` field to the root schema, or
2. represent the volley as three explicit effects.

Do not discard the field silently.

### W5 — Localization is incomplete for production UI

Role labels and Class 2 playstyle text exist, but the full production set still needs:

- hero names and descriptions
- skill names and descriptions
- strength and weakness strings
- status/summon names
- monster, miniboss, and boss names
- stage/augment UI text

### W6 — Weapon inventory capacity is a draft choice

`weaponInventorySlots: 8` is not yet a locked design decision. Bench size 5 and weapon slots per hero 2 are locked; inventory size 8 remains subject to test.

### W7 — Balance cannot be approved statically

Hero stats, skill ratios, monster stats, enemy counts, elite multiplier, and stage multipliers remain `balance_draft`. Validator success only proves structural consistency.

## Blockers before direct runtime integration

1. Decide the adapter mapping from compact design records to the root schema/runtime structures.
2. Resolve the Rapid Volley multi-hit representation.
3. Define safe fallback presentation IDs or null handling.
4. Define referenced statuses and summons before enabling those skills.
5. Run all validators and record their output.
6. Confirm current runtime IDs do not conflict with the new semantic IDs.

## Merge guidance

PR #7 may be merged as documentation/data tooling after validator review because it does not modify runtime behavior. Runtime migration must be a separate PR and should proceed in this order:

1. Hero identity and stats adapter
2. Skill adapter with existing behavior preserved
3. Evolution/fusion integration
4. Economy and capacity integration
5. Monster and stage integration
6. x4 combat telemetry and balance pass

## Balance gate

Do not tune Map 1 monsters in detail until Hero, Skill, Fusion, Economy, Bench, and Weapon behavior are running together. Use current monster values only as vertical-slice test baselines.
