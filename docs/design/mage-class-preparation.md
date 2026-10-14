# Mage class preparation: audit, contracts, plan (2026-10-14)

This is preparation only: no gameplay was changed. Audited on `phaser-rebuild` at `5f512a62`. The Codex art package
is in `docs/art/mage-codex-handoff.md`.

## A. Class framework (as implemented)

### Class registry and selection

**Registry:** `src/data/jobData.ts` `JOBS`.

- Novice is tier 0. Warrior, Archer, **Mage**, Cleric and Ninja are tier 1, taken at Lv11.
- Mage is already registered: `jobBonus { int: 3, dex: 2 }`, `skillTreeId: 'mage_c1'`, `attackStyle: 'melee'`.
- `attackStyle` only chooses STR or DEX for *physical* ATK, so it is irrelevant for magic.

**Growth:** `src/data/classGrowth.ts` already has Mage anchors.

| Level | HP | MP | MATK | DEF | MDEF |
|---|---|---|---|---|---|
| 11 | 420 | 300 | 85 | 12 | 25 |
| 20 | 620 | 470 | 140 | 18 | 42 |
| 30 | 900 | 680 | 210 | 26 | 62 |
| 40 | 1200 | 920 | 290 | 35 | 90 |

Warrior at Lv11: HP 700, ATK 70, DEF 25. Interpolated between anchors; an error past Lv40.

**Selection:** the Lv11 Job Change is `src/progression/JobChange.ts` with `CLASS_1_CHOICES`, which is every tier-1 job.

- `JobSelectWindow` enables a job only when `treeForJob(job)` exists. Today only Warrior has a tree, so the other
  classes show "not implemented".
- **Registering `SKILL_TREES.mage_c1` is the only switch needed to make the Mage selectable.**

**Presentation:** `src/data/demoConfig.ts` already maps Mage to its own art (`MAGE_ART`) but the TEMPORARY Warrior demo
kit (`temporaryKit: true`).

### Player art pipeline (`src/data/characterArt.ts`, `class1Art()`)

The Class 1 contract is shared by Archer, Mage, Cleric and Ninja (Warrior differs, see below).

- **Cells:** 192×192 transparent, as horizontal strips `public/assets/characters/<id>/anims/<id>_<anim>_<dir>.png`.
- **Feet row:** y = **153** (`CLASS1_FEET_Y`). Measured on the Mage master and every Mage strip frame.
- **Body axis:** x ≈ **95**. `offsetX: 1` nudges the pivot onto it, so mirroring stays on the body.
- **Height:** the figure is about **125 px** tall (head top y ≈ 29; `CLASS1_REFERENCE_HEIGHT = 125`). It renders at
  `worldHeight` 40, so the scale is **0.32** (40/125). On screen it is about 66 px tall at camera zoom 1.65.
- **Origin:** `(0.5 − nudge/192, (153 − 13/0.32)/192)`. `feetOffset` is 13 world px; the body box is
  `{-8, 4, 16, 10}` world px and never changes with the art.
- **Directions:** art exists for `down` (south), `up` (north) and `right` (east). `left` (west) is the **runtime
  mirror of east** (`flipX`).
- **Frame rates:**

  | Animation | Frames | FPS | Notes |
  |---|---|---|---|
  | Idle | 4 | 5 | loop |
  | Walk | 8 | 10 | loop |
  | Attack (Mage) | 8 | 16 | 500 ms; `attackHitFrame { down: 4, up: 3, right: 4 }` |

  The hit frame drives presentation only (the `PLAYER_ACTION_HIT` VFX event). Combat timing is the skill's own.
- **Actions:** `CharacterAction = 'attack' | 'powerSlash'`. `skillActions` maps a skill to an action strip; the Mage
  currently maps every skill to `attack`.
- **Optional per-strip features:** idle `motion` (the baked breathing from the Warrior pass) and `timing`.
- **No hit-reaction or defeat strips:** a hit is a white fill-tint flash; defeat rotates the sprite 90° and tints it.
- **Warrior differences:** `feetY` 157 with per-strip `offsetY`, per-strip `visibleHeight` normalisation, and the
  ready-stance idle.

### Skills and combat (`src/data/skillData.ts`, `src/combat/*`)

**`SkillEffect` kinds:**

| Kind | What it does |
|---|---|
| `damage` | single target; optional `onHit` status and `critBonus` |
| `aoe_damage` | every enemy within `radius` of **the caster**; no on-hit status |
| `taunt` | taunt enemies within a radius |
| `dash_strike` | dash, then strike |
| `projectile` | straight line, first enemy hit, **no splash** |
| `status` | self status |
| `heal` | heal the caster |

**Casting rules:**

- **Targets:** `'enemy' | 'enemy_or_direction' | 'self'`.
- **Damage types:** `physical` (ATK vs DEF) and `magic` (MATK vs MDEF). Formula: `ATK × power × 100 / (100 + DEF)`.
- **Wind-up:** `windup { ms, cancelOnMove, recheckRange }` delays single hits and caster-centred areas.
  `skillWindup` events drive monster telegraphs. **Player wind-ups get no telegraph**, and telegraphs always anchor
  on the caster.

**Basic attack:** one global `PLAYER_BASIC_ATTACK = 'basic_attack'`, melee, range 40 px, `usesAttackSpeed`, 500 ms
base. **There is no per-class basic attack.**

**Projectiles:** `ProjectileSystem` (pooled; speed, radius, max distance; walls stop them).

- The renderer has a sprite path **only for `fire_bolt`**. Other projectiles draw as code circles.
- `skillAtRank()` has **no `projectile` case**, so projectile power does not scale with rank.

**Statuses:** `src/data/statusData.ts`.

- A status is a stat modifier (`flat` / `percent` / `effects`) plus `stun` / `taunt` flags.
- **Stat keys** (`DerivedStatKey`): maxHp, maxMp, physicalAtk, magicAtk, def, mdef, accuracy, evasion, aspd,
  critRate, critDamage, castTime, healPower.
- **`moveSpeed` is not a stat key**, so a Slow cannot be expressed. Monsters move at `combat.stats.moveSpeed`.

**Periodic effects:** `PeriodicResourceSystem` restores HP/MP over time (potions). **There is no damage-over-time.**

**Persistent ground areas:** none exist.

**Cooldowns and MP:**

- Cooldowns are per skill on `CombatantState.cooldowns`; the basic attack's interval is reduced by ASPD.
- MP cost is paid at cast. Player MP regen is fixed at 1.5/s (`PLAYER_FIXED_STATS`), and nothing can modify it.

**Passives and procs:**

- Tree nodes of type `passive` add `perRank` flat or percent modifiers. Warrior Sword Mastery is +1.5% physicalAtk per
  rank, 10 ranks.
- `proc` nodes fire statuses (`low_hp`, `hit_streak`).
- **There is no element tag**, so "fire / frost damage +X%" is not expressible.

### Skill tree, hotbar and save

- **Tree model:** `SkillTreeDef` has branches, nodes (`active | passive | buff | proc`), `maxRank`,
  `branchSpendRequirement`, `prerequisite`, `combatSkillId`, and per-rank `{ mpCost, cooldownMs, power, stunMs,
  radiusTiles, durationMs, critBonus }`.
- **Skill points:** +1 per level from 11 to 40, so 30 points. The Warrior tree holds 47 ranks, so builds must choose.
- **Hotbar:** 5 slots (`skill1..5`). Learned actives auto-fill an empty slot. `SkillTree.assign` with queued changes
  in combat. The circular icon UI is already shared.
- **Save:** `classId`, `skillRanks`, `hotbar` and `jobBonuses` are saved and validated generically.
  **Nothing class-specific is needed.**
- **Gating:** the `class_1_skills` feature. Job Change needs Lv11 plus the Job Trial.

### UI assumptions for multiple classes

- **Already shared:** the Skills window, Character window, hotbar, portrait (`art.portrait`) and job select are
  generic.
- **Icons:** active icons come from `SKILL_ICONS` (`src/data/skillIcons.ts`, PNG per skill id, 96 px). Passive and
  proc icons are **code-drawn plates** (`src/ui/art/iconArt.ts`, 96 px).
- **Status icons:** vector glyphs (`StatusRow`), except Warrior procs.

## B. Existing Mage assets

| Asset | Path | Class |
|---|---|---|
| South master (192, feet 153, h 125) | `public/assets/characters/mage/mage_south_master.png` | **A** production |
| Static directions S / N / E / W | `public/assets/characters/mage/directions/` | **A** |
| Idle 4f S / N / E | `anims/mage_idle_{south,north,east}.png` | **A** |
| Walk 8f S / E | `anims/mage_walk_{south,east}.png` | **A** |
| Walk 8f N | `anims/mage_walk_north.png` | **B**: the staff hides behind the cloak for 4 frames (minor) |
| Attack 8f E / N | `anims/mage_attack_{east,north}.png` | **A**: a staff thrust with a small baked spark; good for Magic Bolt |
| Attack 8f S | `anims/mage_attack_south.png` | **B → replace**: casts sideways (`directional_attack_visual_pending` in the manifest) |
| Raw PixelLab frames, cleanup, QA contact sheet | `art-source/characters/{raw,cleanup}/mage`, `art-source/characters/qa/class1_mage_animations_contact.png` | **C** reference |
| Manifest (PixelLab character `696cb425…`) | `art-source/characters/class1_animation_manifest.json` | **C** |
| Fire projectile 64px 4f and impact 96px 6f | `public/assets/vfx/combat/fire_bolt*.png` | **A**, reusable for Fireball |
| Fire Bolt skill icon (a fireball) | `public/assets/ui/skills/fire_bolt.png` | **A**, reusable as the Fireball icon |

Everything else is **E (missing)**:

- skill-specific cast strips;
- Magic Bolt, Flame Burst, Frost Nova, Frost Storm and Meteor VFX;
- Mage skill icons (except Fireball);
- Mage passive icons;
- Burn / Slow status visuals.

The portrait reuses the south master (`art.portrait`), and there is no class crest system to supply. Nothing was
overwritten.

## C. Gaps that need code (smallest additions to existing systems)

1. **Per-class basic attack:** resolve the basic attack by job (`magic_bolt` for Mage) instead of the global
   `basic_attack`. Touches PlayerCombatController, ActionCluster, SkillTree's basic-attack branch and the debug
   readout.
2. **Projectile ranks:** a `projectile` case in `skillAtRank` (power by rank). Projectile art by skill id
   (generalise the `fire_bolt` special case into a `VFX_ART` lookup) and face the sprite along its travel direction.
3. **Projectile splash** (Fireball): optional `splash { radius, power }` resolved at impact.
4. **Ground-targeted area** (Flame Burst, Meteor): a new `target_area` kind centred on the target's position at cast,
   with an optional wind-up and an optional `onHit` status.
5. **On-hit status for areas** (Frost Nova's Slow): allow `onHit` on `aoe_damage`.
6. **Slow:** add `moveSpeed` to the status / stat pipeline for monsters (`COMBAT_KEY`), plus a `slowed` status.
7. **Burn** (damage over time): a status with `tick { intervalMs, power }`. Damage is credited to the caster through
   `CombatSystem.dealDamage` (damage numbers, kill credit, loot and quests).
8. **Persistent area** (Frost Storm): a small `GroundZoneSystem` that ticks damage and Slow every interval for a
   duration. It is owned by the caster, cleared on map change, reset or death, and pooled for visuals.
9. **Element tag:** `element: 'fire' | 'frost'` on SkillDef, plus effect keys `fireDamage` / `frostDamage` applied in
   `dealDamage` (for Elemental Mastery).
10. **Player point telegraph** (Meteor): `Telegraphs.start` at a point, in a friendly palette (blue/gold, not danger
    red). Reuses the soft field textures.
11. **Mana Flow:** max MP % works today. "MP efficiency" needs either an `mpCostReduction` effect key or a regen
    modifier, because regen is fixed.
12. **Data, strings, icons:** skills, the tree, `SKILL_ICONS`, i18n (en/th), status glyphs, and the `skillActions`
    mapping for the Mage.

## D. Mage design (locked) mapped to the engine

| Skill | Engine form |
|---|---|
| Magic Bolt (basic) | `projectile`, magic, 0 MP, `usesAttackSpeed`, ranged |
| Fireball | `projectile` + splash; fire |
| Flame Burst | `target_area` + Burn; fire |
| Frost Nova | `aoe_damage` (self) + `onHit` slowed; frost |
| Frost Storm | ground zone (ticks damage + slowed); frost |
| Meteor Burst | `target_area` with a wind-up (point telegraph); fire; heavy |
| Arcane Power | passive `percent.magicAtk` |
| Mana Flow | passive `percent.maxMp` (+ MP efficiency, see C.11) |
| Elemental Mastery | passive `effects.fireDamage` + `effects.frostDamage` |

## E. Proposed balance: PROPOSED — NOT IMPLEMENTED

**Basis:**

- **Mage damage:** Lv11 MATK ≈ 85 + 2 × INT (8 with the job bonus) ≈ 101. The Warrior's ATK at Lv11 is about 86.
- **Monsters:** Field Slime 60 HP to Elite Boar 450 (DEF 8), Guardian 1600 (DEF 12). Crypt Lv20 Skeleton 140,
  Knight 700, Lord 3000 (DEF 16).
- **Warrior skills:** powers 1.25–2.6, MP 8–22, cooldowns 4–30 s. Whirlwind is a 2-tile AoE at 1.4–2.2.
- **Mage MP:** 300 at Lv11 against a fixed 1.5/s regen (90 MP/min).
- **Skill points:** 30 at Lv40.

**Tree:** branches **Core** (Fireball, Arcane Power, Mana Flow), **Fire** (Flame Burst, Meteor Burst) and **Frost**
(Frost Nova, Frost Storm), with Elemental Mastery in Core. Total ranks 38 against 30 points, mirroring the Warrior's
"choose a path".

**Magic Bolt:** power 1.0 magic, 0 MP, interval 600 ms (ASPD-scaled), range 7 tiles (224 px), speed 420 px/s. No
rank; it is always available.

| Node | Branch / unlock | Ranks | Power | MP | CD (s) | Radius (tiles) | Duration / tick | Status |
|---|---|---|---|---|---|---|---|---|
| Fireball | Core, start | 5 | 1.6 → 2.4 | 10 → 14 | 3.0 → 2.6 | splash 1.25 at 50% | – | – |
| Flame Burst | Fire, Fireball R1 | 5 | 1.5 → 2.3 | 22 → 30 | 8.0 → 7.0 | 2.0 at target | Burn 4 s, 1 s ticks | Burn 0.15 → 0.25 × MATK per tick |
| Frost Nova | Frost, start | 3 | 1.0 → 1.4 | 18 → 22 | 12 → 10 | 2.5 self | Slow 3 → 4 s | Slow −40% move |
| Frost Storm | Frost, 5 spent | 3 | 0.35 → 0.5 per tick | 45 → 55 | 18 → 15 | 2.5 at target | 5 s, 0.5 s ticks (10) | Slow −30% while inside |
| Meteor Burst | Fire, 10 spent | 3 | 4.0 / 4.8 / 5.6 | 60 / 70 / 80 | 45 / 40 / 35 | 3.0 at target | 800 ms wind-up (point telegraph) | heavy |
| Arcane Power | Core | 10 | MATK +1.5% per rank (+15%) | – | – | – | – | – |
| Mana Flow | Core | 5 | Max MP +4% per rank (+20%); optional MP cost −2% per rank | – | – | – | – | – |
| Elemental Mastery | Core, 5 spent | 5 | Fire and Frost damage +3% per rank (+15%) | – | – | – | – | – |

Sanity checks:

- **Lv11 Fireball against an Elite Boar:** 101 × 1.6 × 100/108 ≈ 150 per cast (~3 casts plus bolts).
- **Lv20 Meteor R1 on a Skeleton pack:** MATK about 160 × 4.0 ≈ 640 against 140 HP, a full clear. That is the intended
  farming fantasy; check it against Field Energy and reward pacing.

## F. Animation contract (minimum)

| State | Canvas / cells | Frames | FPS | Feet / axis | Directions | Status |
|---|---|---|---|---|---|---|
| Idle | 192×192, 4-cell strip | 4 | 5 | 153 / 95 | S, N, E (W mirrors E) | **exists (A)** |
| Walk | 192×192, 8-cell strip | 8 | 10 | 153 / 95 | S, N, E | **exists**; N is B (keep) |
| Basic cast / Magic Bolt (`attack`) | 192×192, 8-cell strip | 8 | 16 (500 ms), hit frame 4 | 153 / 95 | E, N **exist**; **S must be regenerated** (cast toward the camera) | 1 new strip |
| Spell cast (`cast`, shared by all five actives) | 192×192, 8-cell strip | 8 | 16, hit frame 5 | 153 / 95 | S, N, E | **recommended, optional**: 3 new strips; else every spell reuses `attack` |
| Hit reaction | – | – | – | – | – | **not used by the runtime** (tint flash) |
| Defeat | – | – | – | – | – | **not used** (90° rotation and tint) |

East can mirror to west: the staff is held in front, as the manifest records.

## G. VFX contract

| Effect | Form | Art | Canvas | Frames | Blend | Impact | Ground | Code-drawn OK? |
|---|---|---|---|---|---|---|---|---|
| Magic Bolt | projectile | **new** `magic_bolt` loop + **new** `magic_bolt_impact` | 64 / 96 | 4 loop (14 fps) / 6 (220 ms) | ADD-friendly | blue spark | – | a temporary code orb is acceptable |
| Fireball | projectile + splash | **reuse** `fire_bolt` / `fire_bolt_impact` (scale 1.2) | 64 / 96 | 4 / 6 | – | reused | code-drawn splash ring | yes |
| Flame Burst | target area | **new** `flame_burst` | 192 | 8 (400 ms) | ADD | the burst itself | soft field tint (telegraph texture, orange) | no, needs art |
| Frost Nova | self area | **new** `frost_nova` | 192 | 8 (380 ms) | ADD | expanding icy ring | code frost tint 0.6 s | no |
| Frost Storm | persistent area | **new** `frost_storm` loop | 192 | 6 loop (10 fps) | ADD | – | soft blue field (reuse telegraph field texture) | no |
| Meteor Burst | point wind-up, then area | **new** `meteor_fall` + **new** `meteor_impact` | 128×256 / 256 | 6 (300 ms) / 8 (450 ms) | ADD (impact) | the explosion | friendly point telegraph (code) | no |
| Burn (status) | on target | none | – | – | – | – | orange tint flicker plus Burn glyph | yes |
| Slow (status) | on target | none | – | – | – | – | blue tint plus Slow glyph | yes |

That is **7 new VFX strips**.

## H. Icon contract

Active icons are 96×96 transparent PNGs in `public/assets/ui/skills/<skill_id>.png`: one dominant symbol, no frame,
designed to read inside the hotbar circle (radius about 42 px).

- **New actives:** Magic Bolt, Flame Burst, Frost Nova, Frost Storm, Meteor Burst.
- **Fireball** reuses `fire_bolt.png` unless a distinct icon is wanted (prompt provided).
- **Passives** (Arcane Power, Mana Flow, Elemental Mastery) are muted and distinct. **Decision needed:**
  - code-drawn plates in `iconArt.ts`, matching the Warrior passives (no generation); or
  - generated PNGs (prompts provided), which need a small `passiveIconUrl` change to prefer a PNG.

## I. Implementation order (after art returns)

1. **Phase 1, playable Mage** (small, reviewable):
   - per-class basic attack (C.1) and Magic Bolt, with the code orb until art lands;
   - projectile art lookup and rotation (C.2);
   - the `mage_c1` tree with **Fireball only** (+ splash, C.3), which makes the Mage selectable;
   - `MAGE_ART.skillActions`, `SKILL_ICONS`, strings;
   - the presentation flip `temporaryKit: false`;
   - a targeted test (job change → bolt → Fireball).
2. **Phase 2, mechanics:**
   - Slow and Burn (C.5–C.7);
   - `target_area` (C.4);
   - Frost Nova, then Flame Burst;
   - ground zone (C.8) and Frost Storm;
   - player point telegraph (C.10) and Meteor Burst.
3. **Phase 3, passives and tree:** Arcane Power, Mana Flow (C.11 decision), element tags and Elemental Mastery (C.9),
   branch gating, save/load, and hotbar checks.
4. **Phase 4, presentation and QA:**
   - VFX strips wired, cast strip, South attack replacement;
   - pre-paint or warm-up of the new VFX textures (the cold-hitch lesson);
   - targeted reviews; balance pass on Field and Crypt; full suite once.

## Estimated new production files

| Group | Count |
|---|---|
| Character strips | 1 required (South attack) + 3 optional (cast S / N / E) |
| VFX strips | 7 |
| Skill icons | 5 actives + 3 passives (if generated) + 1 optional (Fireball) |
| **Total** | **16 required** (13 if passives are code-drawn), up to **20** with all optional files |

## Risks

- **Style match:** the shipped Mage is PixelLab-generated, crisp-edged chibi art, rendered smoothly at 0.32. New
  character strips made with a different generator risk face, outfit or proportion drift between strips.
  - Prefer the pipeline that made the original (PixelLab `animate_character` on the locked character), or Codex with
    the master as a strict reference and the same 192 / 153 / 95 contract.
  - Any strip must pass the measurements above.
- **Anchors:** image generators do not hit pixel anchors. Every strip needs a post pass: integer-translate each
  frame so the feet sit on y = 153 and the boot centre on x ≈ 95, the way the manifest's alignment did it.
- **Area farming:** AoE plus Burn plus Storm can trivialise Field pacing (rewards, Field Energy). Tune against kills
  per minute, not per-hit damage.
- **Damage-over-time and zone credit:** kill credit, loot, quest progress and wipe/reset cleanup must use the same
  `dealDamage` path, or kills will go uncredited.
- **Performance:** new VFX textures will show the same cold first-use hitch. Pre-paint or pool them at boot. Also
  bound the zone ticks and the number of sprites.
- **Slow on monster AI:** leash, chase and attack-range timing were tuned at full speed. Check that the Brute, Lord
  and Guardian wind-ups still read.
- **South attack replacement:** hit-frame timing must stay 4 at 16 fps, or the presentation event desyncs.

## Decisions needed before implementation

1. **Character-strip generator:** PixelLab (matches the shipped art) or Codex image_gen with the master reference.
2. **Spell cast strip:** a shared `cast` strip (3 new strips), or every spell reuses `attack`.
3. **Passive icons:** code-drawn plates (the current convention) or generated PNGs.
4. **Fireball icon:** reuse `fire_bolt.png`, or make a new one.
5. **Mana Flow "MP efficiency":** MP-cost reduction, MP regen, or Max MP only.
6. **Demo kit Fire Bolt:** keep it as the Novice kit skill, separate from Fireball (recommended), or merge them.
7. **Meteor:** can the Mage move during its 800 ms wind-up (cancel on move, like Power Slash), or is it committed?
8. **Balance table** (section E): approve or adjust before Phase 2.
