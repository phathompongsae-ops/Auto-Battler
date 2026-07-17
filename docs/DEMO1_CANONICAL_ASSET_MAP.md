# Demo 1 Canonical Asset Map — Proposed Lock

Basis: asset inventory from `main` commit `324f65ffde5737a5d462a4d678a9161724797c7b` and the Demo 1 design locked in `docs/DEMO1_ASSET_AUDIT.md`.

Scope: documentation-only mapping. This file does not change runtime loading, combat, rendering, stage flow, economy, or gameplay state.

## Rules

1. Demo 1 uses one explicit logical ID → one exact asset path.
2. The root procedural sprite set is the proposed distributable baseline because its manifest identifies it as original project work.
3. V5 AI-generated art remains non-canonical until its external generator terms and commercial-use provenance are verified.
4. Novice is not playable and has no canonical Demo 1 mapping.
5. Runtime integration must not silently fall back to another pipeline.
6. File renames are deferred until runtime references are audited; this document locks logical identity before physical cleanup.

## Class 1 heroes

| Runtime/logical ID | Display name | Canonical asset path | Demo 1 status | Notes |
|---|---|---|---|---|
| `fighter` | Fighter | `assets/fighter.png` | Required | Male Class 1 |
| `swordman` | Swordman | `assets/swordman.png` | Required | Keep current ID spelling until a planned compatibility migration |
| `archer` | Archer | `assets/archer.png` | Required | Female Class 1 |
| `mage` | Mage | `assets/mage.png` | Required | Male Class 1 |
| `summoner` | Summoner | `assets/summoner.png` | Required | Male Class 1 |
| `acolyte` | Acolyte | `assets/acolyte.png` | Required | Female Class 1 |
| `merchant` | Merchant | `assets/merchant.png` | Required | Male Class 1 |
| `novice` | Novice | **None** | Prohibited | Legacy `assets/novice.png` must not be used by Shop, roster, spawn, deploy, fusion, fallback, or UI |

## Map 1 enemies and bosses

| Runtime/logical ID | Display name | Canonical asset path | Intended stage role | Notes |
|---|---|---|---|---|
| `stonewolf` | Stone Wolf | `assets/mon_stonewolf.png` | Normal enemy | Root procedural baseline |
| `skeleton` | Skeleton | `assets/mon_skeleton.png` | Normal enemy | Root procedural baseline |
| `spiritarcher` | Spirit Archer | `assets/mon_spiritarcher.png` | Normal enemy | Root procedural baseline |
| `shadowassassin` | Shadow Assassin | `assets/mon_shadowassassin.png` | Normal/special enemy | Root procedural baseline |
| `golem` | Golem | `assets/mon_golem.png` | Stage 5 miniboss pool member | Logical role is miniboss despite legacy `mon_` filename prefix; pool = `[golem, orc_warlord]` |
| `orc_warlord` | Orc Warlord | *(no asset yet — see Next asset-only work)* | Stage 5 miniboss pool member | New Demo 1 pool member; no sprite exists in the repo |
| `bone_dragon` | Bone Dragon | `assets/mon_bonedragon.png` | Stage 10 miniboss pool member | Pool = `[bone_dragon, lich_king]`; no longer Stage 13 |
| `lich_king` | Lich King | *(no asset yet — see Next asset-only work)* | Stage 10 miniboss pool member | New Demo 1 pool member; no sprite exists in the repo |
| `arena_overlord` | Arena Overlord | *(no asset yet — see Next asset-only work)* | Stage 15 fixed boss | Locked Demo 1 identity; must use a dedicated new asset, never the Champion asset |
| `warden` | Warden | `assets/miniboss_warden.png` | **Obsolete for Stage 5** | Superseded by the `[golem, orc_warlord]` pool lock; not part of any confirmed Demo 1 pool |
| `champion` | Immortal Champion | `assets/boss_champion.png` | **Obsolete for Stage 15** | Must not be treated as a second final boss or renamed/reused as `arena_overlord` |

## Unresolved normal-enemy slots

The locked monster pool also references Slime and Orc. The current manifest documents these in the older V5 pipeline (`assets/v5/mon_*.png`), whose external AI license is not verified. Therefore they are deliberately not locked as distributable canonical assets yet.

| Logical ID | Current candidate | Canonical status | Required decision |
|---|---|---|---|
| `slime` | V5 `assets/v5/mon_*.png` set | Pending | Generate/confirm an original-project root procedural replacement or verify V5 provenance |
| `orc` | V5 `assets/v5/mon_*.png` set | Pending | Generate/confirm an original-project root procedural replacement or verify V5 provenance |

Runtime should not substitute unrelated sprites for these IDs. Until resolved, missing-asset behavior should be explicit and test-visible rather than silently loading another pipeline.

## Non-canonical or development-only groups

| Asset group | Status for Demo 1 | Reason |
|---|---|---|
| `assets/v5/body_*.png`, `assets/v5/face_*.png` | Non-canonical | Different portrait pipeline; external AI license unknown |
| `assets/v5/mon_*.png` | Pending/non-canonical | Slime and Orc candidates only; provenance not verified |
| `assets/heroes/*_sheet.png` | Separate advanced-hero animation pipeline | Covers only a subset and does not represent the complete Class 1 shop roster |
| `assets/portraits/*.png` | Separate advanced-hero portrait pipeline | Not a complete Class 1/Class 2 library |
| `assets/contact_sheet*.png`, `assets/heroes_contact_sheet.png` | Development-only | Review/reference sheets, not gameplay assets |
| `assets/novice.png` | Deprecated | Removed from locked game design |

## Runtime integration contract

When CC or a later runtime task integrates this map:

1. Resolve assets by logical ID through one mapping table or adapter.
2. Do not scatter duplicate hard-coded paths across Shop, Bench, Board, and combat presentation.
3. Missing IDs must log one clear error and use the project fallback intentionally; no silent cross-pipeline substitution.
4. Asset selection must never modify hero stats, monster stats, targeting, occupancy, stage composition, or combat outcomes.
5. Verify Shop cards, Bench units, Board units, Stage 5, Stage 10, Stage 13, and Stage 15 use the same logical identity.
6. Confirm Novice cannot appear after at least 50 Shop rerolls.
7. Run relevant combat verification at x4 after integration.

## Next asset-only work

1. `arena_overlord`, `orc_warlord`, and `lich_king` need dedicated new sprite assets — `assets/boss_champion.png` must not be copied/renamed to stand in for `arena_overlord`.
2. Resolve original-project Slime and Orc assets.
3. Add a machine-readable manifest only after exact file existence and naming are verified.
4. Keep asset cleanup/renaming separate from runtime drag-and-drop and Novice-removal work.
