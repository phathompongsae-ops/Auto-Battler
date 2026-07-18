# Map 1 Monster and Boss Skill Design v1

## Status

Design-only specification for the 10 active Map 1 monster and boss `skillId` references that currently have no canonical skill definitions.

This document is stacked on the PR #7 data-contract branch. It does not modify Runtime, combat formulas, targeting code, animation, VFX, encounters, stats, or existing boss identities. Values below are balance-draft proposals and must not be treated as runtime-ready until converted into canonical skill data, validated, and tested by CC at speed x4.

## Design constraints

1. Use only mechanics already represented by the existing data contract where possible: `damage`, `shield`, and established targeting behaviors.
2. Avoid introducing teleport, displacement, stun, summon, terrain, or persistent hazard systems in this pass.
3. Presentation events must never become gameplay truth or apply damage a second time.
4. Normal monsters receive one simple readable ability.
5. Minibosses receive one stronger identity skill.
6. The final boss receives two complementary skills without becoming unavoidable or permanently disabling the player team.
7. Ratios are starting points for later balance testing, not final values.

## Active unresolved skill inventory

| Owner | Kind | Skill ID | Proposed identity |
|---|---|---|---|
| Orc | Normal | `skill.monster_heavy_swing` | Slow heavy physical strike against nearest target |
| Stone Wolf | Normal | `skill.monster_pounce` | Hunter-style physical burst against a vulnerable enemy |
| Spirit Archer | Normal | `skill.monster_spirit_arrow` | Long-range physical shot pressuring the backline |
| Shadow Assassin | Normal | `skill.monster_shadow_step` | Backline physical strike without adding teleport mechanics |
| Golem | Normal / Stage 5 pool member | `skill.monster_stone_guard` | Temporary self-protection using the existing shield contract |
| Orc Warlord | Miniboss | `skill.miniboss_orc_warlord_slam` | Heavy physical area-pressure attack |
| Bone Dragon | Miniboss | `skill.miniboss_bone_breath` | Magical breath against a clustered group |
| Lich King | Miniboss | `skill.miniboss_lich_king_frost_nova` | Magical cluster burst; visual frost only in v1 |
| Arena Overlord | Boss | `skill.boss_arena_quake` | Main physical cluster attack |
| Arena Overlord | Boss | `skill.boss_commanding_roar` | Self-shield / defensive tempo skill |

## Proposed skill contracts

### 1. Orc — Heavy Swing

- ID: `skill.monster_heavy_swing`
- Owner: `orc`
- Mana cost: 100
- Targeting: `nearest`
- Range: use owner range
- Cast-time direction: short and readable, approximately 0.45–0.60 seconds
- Effect: physical damage
- Scaling stat: `pAtk`
- Draft ratio: 1.40

Purpose: Gives Orc a simple stronger hit without adding a new status or area system.

### 2. Stone Wolf — Pounce

- ID: `skill.monster_pounce`
- Owner: `stone_wolf`
- Mana cost: 90
- Targeting: `lowest_hp_enemy` if supported for monsters; otherwise retain owner behavior `hunter`
- Range: use owner range
- Cast-time direction: fast, approximately 0.25–0.40 seconds
- Effect: physical damage
- Scaling stat: `pAtk`
- Draft ratio: 1.55

Purpose: Reinforces the hunter identity through target selection and burst damage without implementing an actual leap, teleport, or displacement mechanic.

### 3. Spirit Archer — Spirit Arrow

- ID: `skill.monster_spirit_arrow`
- Owner: `spirit_archer`
- Mana cost: 100
- Targeting: `backline`
- Range: use owner range
- Cast-time direction: approximately 0.40–0.55 seconds
- Effect: physical damage
- Scaling stat: `pAtk`
- Draft ratio: 1.45

Purpose: Creates clear backline pressure while remaining a normal single-target projectile-style attack. Projectile arrival must remain presentation-only.

### 4. Shadow Assassin — Shadow Step

- ID: `skill.monster_shadow_step`
- Owner: `shadow_assassin`
- Mana cost: 85
- Targeting: `backline`
- Range: use owner range
- Cast-time direction: fast, approximately 0.20–0.35 seconds
- Effect: physical damage
- Scaling stat: `pAtk`
- Draft ratio: 1.65

Purpose: Preserves the name and assassin fantasy while explicitly avoiding new teleport or stealth mechanics in v1. Runtime may present a quick dash-like animation only if movement and damage remain authoritative in Core Combat.

### 5. Golem — Stone Guard

- ID: `skill.monster_stone_guard`
- Owner: `golem`
- Mana cost: 110
- Targeting: self
- Range: 0
- Cast-time direction: approximately 0.50–0.70 seconds
- Effect: shield
- Scaling stat: use a supported defensive/self scaling source; if the contract only supports `mAtk`, use a conservative flat-equivalent ratio and document the limitation
- Draft ratio direction: moderate, not a full-health reset

Purpose: Makes Golem durable without adding damage reduction, taunt, armor mutation, or a new status system.

Open contract issue: the current targeting list does not explicitly include `self`. Canonical data must not invent an unsupported target. Before implementation, CC/Data must choose either:

- add a documented `self` targeting behavior to the shared contract and Runtime; or
- model the shield using an already-supported owner-safe path.

Until this is resolved, `stone_guard` remains design-approved but contract-blocked.

### 6. Orc Warlord — Warlord Slam

- ID: `skill.miniboss_orc_warlord_slam`
- Owner: `orc_warlord`
- Mana cost: 100
- Targeting: `cluster`
- Range: use owner range
- Cast-time direction: telegraphed, approximately 0.65–0.85 seconds
- Effect: physical damage
- Scaling stat: `pAtk`
- Draft ratio: 1.25 to each affected target

Purpose: Provides miniboss area pressure with a clear wind-up. Do not add knockback or stun in v1.

### 7. Bone Dragon — Bone Breath

- ID: `skill.miniboss_bone_breath`
- Owner: `bone_dragon`
- Mana cost: 110
- Targeting: `cluster`
- Range: use owner range
- Cast-time direction: approximately 0.70–0.90 seconds
- Effect: magical damage
- Scaling stat: the encounter data currently exposes only `pAtk`; canonical conversion must either add a real `mAtk` stat or explicitly use `pAtk` as the sourced scaling stat
- Draft ratio: 1.35

Purpose: A readable ranged cluster attack. No damage-over-time, cone geometry, or persistent ground hazard in v1.

Open data issue: Bone Dragon has no canonical `mAtk`. Do not fabricate it silently.

### 8. Lich King — Frost Nova

- ID: `skill.miniboss_lich_king_frost_nova`
- Owner: `lich_king`
- Mana cost: 110
- Targeting: `cluster`
- Range: use owner range
- Cast-time direction: approximately 0.70–0.90 seconds
- Effect: magical damage only in v1
- Scaling stat: same unresolved `mAtk` issue as Bone Dragon
- Draft ratio: 1.25

Purpose: Establishes a frost-themed area burst without introducing slow/freeze until monster status application has a canonical contract and Runtime support.

The visual may look icy, but it must not apply an unmodeled slow or freeze.

### 9. Arena Overlord — Arena Quake

- ID: `skill.boss_arena_quake`
- Owner: `arena_overlord`
- Mana cost: 100
- Targeting: `cluster`
- Range: use owner range
- Cast-time direction: strongly telegraphed, approximately 0.85–1.10 seconds
- Effect: physical damage
- Scaling stat: `pAtk`
- Draft ratio: 1.35 to each affected target

Purpose: Primary boss pressure skill with enough warning for visual readability. No stun, displacement, terrain damage, or repeated animation-event damage.

### 10. Arena Overlord — Commanding Roar

- ID: `skill.boss_commanding_roar`
- Owner: `arena_overlord`
- Mana cost: 120
- Targeting: self
- Range: 0
- Cast-time direction: approximately 0.55–0.75 seconds
- Effect: shield
- Draft strength: moderate defensive tempo; must not create an indefinite loop or fully reset the fight

Purpose: Alternates offense with a defensive window and makes the final boss feel distinct without adding team buffs, summons, enrage phases, or new status systems.

This skill shares the unresolved `self` targeting contract issue with Stone Guard.

## Recommended canonical-data shape

When these definitions are promoted into data, use a dedicated file such as:

`data/design/map1-monster-skills-v1.json`

Recommended root shape:

```json
{
  "schemaVersion": 1,
  "status": "balance_draft",
  "skills": []
}
```

Each skill should provide at minimum:

- `id`
- `ownerId`
- `mana`
- `target`
- `castTime`
- `effect`
- an explicit note for any unresolved contract dependency

The fixture builder should then combine hero skills and monster/boss skills without changing either source file's authored values.

## Conversion blockers before validator exit 0

The missing-reference count cannot be honestly closed by IDs alone. Before canonical promotion:

1. Resolve self-targeting for `stone_guard` and `commanding_roar`.
2. Decide whether Bone Dragon and Lich King receive canonical `mAtk` or use an explicitly documented existing stat.
3. Confirm monster skill cast-time units and legal range derivation.
4. Add Thai and English localization keys for all 10 skill names/descriptions.
5. Add semantic validation that every active monster `skillId` resolves exactly once.
6. Reject definitions owned only by obsolete `warden` or `champion` records.
7. Keep obsolete skill IDs outside the active fixture unless historical data is intentionally modeled.

## Runtime handoff

Runtime implementation is a separate CC-owned task after canonical data approval.

Required targeted validation:

- use gameplay speed x4;
- test one normal melee skill, one ranged/backline skill, one miniboss cluster skill, and both Arena Overlord skills;
- verify one gameplay effect per cast;
- verify animation/projectile events do not duplicate damage;
- verify no NaN, soft lock, permanent shield loop, or unsupported targeting fallback;
- report the exact modules/files and test harness used.

## Scope safety

- No changes to `src/game.js`.
- No changes to `src/secret-class.js`.
- No changes to `autochess.html`.
- No changes to PR #7 itself.
- No changes to PR #11, PR #12, or PR #13.
- No encounter composition, monster stats, boss identities, camera, UI, economy, or shop changes.
- No claim that the 10 validator errors are resolved by this document alone.
