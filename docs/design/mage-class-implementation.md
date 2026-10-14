# Mage Class 1: playable implementation (2026-10-14)

The Mage is a playable Class 1, from the real Job Change through the Field and the Crypt. The plan and the art
contracts are in `docs/design/mage-class-preparation.md` and `docs/art/mage-codex-handoff.md`. Every number below is the
**first playable baseline** (the Preparation Pass proposal) and is meant to be tuned after playtest.

## Skills

| Skill | Kind | Branch / gate | Ranks | Power | MP | CD (s) | Area / range | Extra |
|---|---|---|---|---|---|---|---|---|
| Magic Bolt (basic) | homing projectile, magic | always | – | 1.0 | 0 | 0.6 (ASPD-scaled) | range 7 tiles, 420 px/s | released at 250 ms (attack frame 4) |
| Fireball | homing projectile + splash, Fire | Fire, start | 5 | 1.6 → 2.4 | 10 → 14 | 3.0 → 2.6 | range 7 tiles; splash 1.25 tiles at 50% | released at 312 ms (cast frame 5) |
| Flame Burst | target-point area, Fire | Fire, Fireball R1 | 5 | 1.5 → 2.3 | 22 → 30 | 8.0 → 7.0 | 2.0 tiles at the target; range 6 | Burn 4 s, 1 s ticks, 0.15 → 0.25 per tick |
| Frost Nova | caster area, Frost | Frost, start | 3 | 1.0 → 1.4 | 18 → 22 | 12 → 10 | 2.5 tiles around the Mage | Slow -40%, 3 → 4 s |
| Frost Storm | lingering zone, Frost | Frost, 3 SP (Nova maxed) | 3 | 0.35 → 0.5 per tick | 45 → 55 | 18 → 15 | 2.5 tiles at the target; range 6 | 10 ticks over 5 s; Slow -30% while inside |
| Meteor Burst | delayed target-point area, Fire, heavy | Fire, 8 SP | 3 | 4.0 / 4.8 / 5.6 | 60 / 70 / 80 | 45 / 40 / 35 | 3.0 tiles at the target; range 7 | 800 ms friendly warning; moving does not cancel |
| Arcane Power | passive | Core | 10 | MATK +1.5% / rank | | | | |
| Mana Flow | passive | Core | 5 | Max MP +4% / rank, MP cost -2% / rank | | | | cost reduction capped at 50% globally |
| Elemental Mastery | passive | Core, 5 SP | 5 | Fire and Frost damage +3% / rank | | | | Burn ticks included; Magic Bolt is untagged |

**Tree:** Core 20 SP, Fire 13, Frost 6. That is 39 ranks against 30 SP at Lv40.

**Gates changed from the proposal.** Gates count only SP spent in the node's own branch, so the proposal's
"Meteor: Fire 10 spent" and "Frost Storm: Frost 5 spent" could never be met. The mapping is:

- Fireball sits in Fire (it opens the branch).
- Meteor needs 8 Fire SP, which is reachable at Lv18.
- Frost Storm needs 3 Frost SP (Frost Nova maxed), which is reachable at Lv13.

The first point at Lv11 can go to Fireball or Frost Nova. Magic Bolt is the class basic attack (ATK): never ranked,
never on the hotbar.

**Statuses:**

- **Burn** (`burning`): a damage-over-time tick every 1 s, credited to the Mage.
- **Slow** (`slowed`, Frost Nova, -40%) and **Slow** (`chilled`, Frost Storm, -30%). They are separate statuses so each
  keeps its own timer, and the strongest one applies (they never stack). Frost Storm re-applies a 0.7 s Chill on
  every tick, so the Slow ends soon after a monster leaves the zone.

## Generic framework extensions (all data-driven)

| Extension | Where | Notes |
|---|---|---|
| Per-class basic attack | `SkillTreeDef.basicAttack`, `basicAttackFor(job)`, `SkillTree.basicAttack()`, `PlayerCombatController` (last ctor arg) | Warrior / Novice keep `basic_attack`; a Mage cannot cast the melee one |
| Projectile power by rank | `skillAtRank` `projectile` case | also splash and on-hit status by rank |
| Projectile homing / splash / on-hit | `ProjectileSystem` | splash hits every *other* enemy once through `dealDamage` (`delivery: 'splash'`) |
| Delayed release | `SkillSystem.pendingReleases` | projectiles and zones leave on the strip's release frame; counted by `windingUp` |
| Target-point area | `target_area` effect | the point is fixed at cast; with a wind-up the target can walk out |
| Area on-hit statuses | `aoe_damage.onHit`, `target_area.onHit`, `ground_zone.onHit` | |
| Slow | `StatusDef.slow`, `applyStatusModifiers` | monster move speed only; strongest wins, capped at 90%; wind-up / attack timers untouched |
| Burn (DoT) | `StatusDef.dot`, `ActiveStatus.dot`, `StatusSystem.tick`, `CombatSystem.dealPeriodicDamage` | fixed rhythm from the first application; never misses or crits; normal kill / loot / quest credit |
| Lingering zones | `GroundZoneSystem` (owned by `SkillSystem.zones`) | ticks at start + n·tick, each exactly once; inside is decided per tick; cleared on map change / reset / caster death; cap of 8 |
| Element tags | `SkillDef.element`, `CombatStats.elementDamageBonus`, effect key `elementDamage:<el>` | Fire, Frost only |
| MP cost modifier | effect key `mpCost`, `CombatStats.mpCostReduction`, `SkillSystem.mpCost()` | rounded and capped (`MAX_MP_COST_REDUCTION`); global MP regen untouched |
| Passive effects | `SkillNodeDef.perRank.effects` | scaled by rank like flat / percent |
| Friendly ground telegraph | `Telegraphs.start(..., { point, palette: 'friendly' })` | arcane blue with a gold rim, on the ground layer under actors; danger red stays monsters-only |
| Events | `areaLanded`, `zoneStarted` / `zoneTick` / `zoneEnded`, `damage.delivery` (`area`, `splash`, `dot`), `skillWindup.x/y` | presentation and tests only |

Warrior behaviour is unchanged. Its skills have no element and no MP reduction. Area hits now carry `delivery: 'area'`,
which presentation ignores for skills without area art (Whirlwind still plays its per-target impact). A status
refresh keeps the old "replace the expiry" rule except for Slow / Burn, which only extend.

## Art wiring

- **Character** (`MAGE_ART`): idle / walk / attack are the production strips. The South attack is the corrected
  toward-camera cast. The new shared `cast` strip covers S / N / E, with West mirroring East.
  - All strips use 192 px cells, feet at 153, axis at 95–96 (measured on every frame) and one render scale (0.32).
  - Attack is 8 frames at 16 fps with release on frame 4. Cast is 8 frames at 16 fps with release on frame 5 (312 ms),
    and the spell wind-ups match it.
  - North cast frames 2–4 reach y = 17 because the staff is raised overhead. That is expected and inside the cell.
- **VFX** (`data/vfxArt.ts`, `data/skillVfx.ts`, `rendering/SpellEffects.ts`):

  | Strip | Use | Blend | Fit |
  |---|---|---|---|
  | magic_bolt / magic_bolt_impact | ATK projectile / hit | ADD | 0.36 / 0.34 |
  | fire_bolt / fire_bolt_impact (reused) | Fireball | normal | x1.25 / x1.35, plus a splash ring |
  | flame_burst | burst where it lands | ADD | footprint 140 px fitted to the real radius |
  | frost_nova | ring around the Mage | ADD | footprint 165 px |
  | frost_storm | zone loop on the ground layer (-0.45) plus a soft blue field (-0.62), under every monster | normal, alpha 0.8 (ADD washed to white on dirt paths) | footprint 154 px |
  | meteor_fall | starts 300 ms before the impact (game clock) | normal (keeps the dark rock) | 0.85 |
  | meteor_impact | impact plus a 220 ms shake | normal (keeps the rocks and smoke) | footprint 226 px |

- **Icons:** five active PNGs, plus the approved `fireball.png`, in `SKILL_ICONS`. The three passive PNGs are in
  `PASSIVE_ICONS`, which `passiveIconUrl` prefers over the code-drawn plates. Magic Bolt is the Mage's ATK face.
- **Status feedback:** Burn and Slow show in the target / boss status row (flame / snowflake glyphs, en/th names, timer
  sweep). Bodies get a restrained tint: a slow ember flicker for Burn, frosty blue for Slow. Burn ticks use a small
  ember number with no white flash or impact. Slow and Burn refreshes do not spawn status rings.
- **Warm-up:** `warmTexturesGradually` uploads the 13 Mage textures (attack and cast strips, seven VFX), one every two
  frames starting 1.2 s after boot. There is no boot freeze.

## Text

New en/th interface strings cover:

- the Fire / Frost tabs;
- Magic / splash / Burn / Slow / zone-hit / Meteor-warning summaries and detail rows;
- the MATK / Max MP / MP cost / Fire / Frost passive labels;
- the Burn / Slow status names.

Skill names and descriptions stay English game data (the Demo rule, the same as the Warrior's).

## Testing

- `tests/unit/mageClass.test.ts` (23 tests) covers:
  - registration and tree shape;
  - Magic Bolt: no MP, release frame, MATK, range, walls, homing;
  - Fireball damage and splash, including splash kill credit;
  - Flame Burst point, Burn tick count under irregular frames, and Burn kill credit once;
  - Frost Nova reach and Slow, including restoration and no stacking;
  - Frost Storm exact 10 ticks, per-tick inside / outside, kill credit, and caster death / clear;
  - Meteor: point, 800 ms, no cancel on move, a single impact, and walking out avoids it;
  - all three passives and the MP cost cap;
  - hotbar and save / load;
  - Warrior regression.
- `tests/browser/mage.test.mjs` (`node tests/browser/run.mjs --mage-review`; also in the default suite) covers:
  - the real Job Change window;
  - ATK icon, Magic Bolt in game, range refusal and a real wall;
  - the Skills window and auto-filled hotbar;
  - every spell on a pack, with Burn / Slow status and tint;
  - Frost Storm ground layering, the Meteor friendly warning, and walking during it;
  - passives, save / load, and the 960×540 / 844×390 / 640×360 HUD;
  - real fights: Field wolf pack, Elite Boar, Grove Guardian (Frost build), Story Crypt section 1 and Brute, Story
    Crypt Lord, Lv20 skeleton pack, Lv20 Crypt Lord;
  - first-use frame cost on a fresh page.

### Results (2026-10-14)

- **Typecheck:** clean. **Build:** OK. The chunk-size warning comes from the Phaser bundle and is not new.
- **Unit:** 659 / 659, including the 23 Mage tests, on two consecutive runs.
  - One earlier run hit a one-off failure in `monsterMotion.test.ts`, which uses a pre-existing random phase in
    `MonsterMotion` that this pass did not touch.
- **Mage review:** 30 / 30 on two consecutive runs.
  - The first-use worst frame after the staged warm-up is 7–28 ms for Magic Bolt, Fireball, Frost Storm and Meteor.
- **Regression reviews:** all pass.

  | Review | Checks |
  |---|---|
  | warrior | 24 / 24 |
  | story | 12 / 12 |
  | hud | 40 / 40 |
  | hud-status | 14 / 14 |
  | skill | 10 / 10 |
  | character | 21 / 21 |
  | guardian | 25 / 25 |
  | brute | 24 / 24 |
  | lord | 24 / 24 |
  | anim | 89 / 89 |
  | closure (job change) | 26 / 26 |
  | release | 8 / 8 |
  | environment | 10 / 10 |
  | npc | 7 / 7 |
  | core (hotbar / dodge / potions) | 17 / 17 |

- **Full default suite (once):** 535 / 536. Free RAM stayed at 4.8–7 GB.
  - The one failure was RP-1 (Town quest Auto-Move reported `stuck` on the way to Smith Brann).
  - It passed 8 / 8 when the release review was re-run alone, and it runs before the Mage suite and touches no code
    from this pass, so it is a known flake.

## First balance findings

These come from the Mage review's real fights. The bot holds ATK, presses any ready skill, uses potions under 45% HP,
steps out of danger telegraphs and walks into range. It has no gear and no hand-set HP. Times are wall-clock in
headless Chrome.

| Fight | Mage | Time | Lowest HP | Potions / deaths |
|---|---|---|---|---|
| Field wolf pack (3) | Lv20 Fire | 1.2 s | 97% | 0 / 0 |
| Elite Boar | Lv20 Fire | 2.4 s | 97% | 0 / 0 |
| Grove Guardian | Lv20 Frost | 5.1 s | 93% | 0 / 0 |
| Story Crypt section 1 | Lv15 Fire | 3.7 s | 100% | 0 / 0 |
| Skeleton Brute (Story) | Lv15 Fire | 2.1 s | 100% | 0 / 0 |
| Crypt Lord (Story) | Lv15 Fire | 10 s | 94% | 0 / 0 |
| Lv20 Crypt skeleton pack (3) | Lv20 Fire | 3.3 s | 100% | 0 / 0 |
| Lv20 Crypt Lord (3000 HP) | Lv20 Fire | 6.8 s | 92% | 0 / 0 |

- **The Mage is strong and very safe** against the current Demo content. Magic Bolt alone is about the Warrior's melee
  DPS, but at 7 tiles: monster MDEF is low (Slime 2) and MATK starts near 101 at Lv11. Meteor R1 at Lv20 (~570 per
  target) removes Field elites and Lv20 skeleton packs in one cast. That matches the proposal's "farming fantasy"
  sanity check.
- **Fireball / Flame Burst:** both stay useful. Fireball (3 s) is the single-target filler with a small splash; Flame
  Burst plus Burn is the pack opener (8 s). Neither made the other obsolete.
- **Frost Nova:** it is rarely needed, because nothing reaches the Mage.
- **Frost Storm:** a slow, safe farming tool. Ten ticks at 0.35 total 3.5x per monster per cast.
- **MP:** it never ran dry in these fights (MP potions were never needed). Mana Flow is not required.
- **Slow:** it did not trivialise the bosses. The Guardian and Lord still ran their wind-ups, and Slow only changes
  movement.
- **First-pass tuning:** none. The user asked to play the demo before any pacing or balance change.
- **Candidates for the pacing pass:** compare a Warrior and a Mage at equal level on the same encounters (Lv11 Field,
  Lv15 Story Crypt, Lv20 Crypt). Consider:
  - Magic Bolt power 0.8–0.9, or monster MDEF;
  - the Meteor cooldown or power against the Field Energy reward pace;
  - giving Frost Nova a reason to exist, which depends on monsters that close distance.

## Other fixes found while integrating

- `ui/components/Slot.ts`: switching a slot from a vector glyph to illustrated art left the old glyph under the art.
  It surfaced on the Mage's ATK button (melee swords to Magic Bolt). The art now replaces the glyph.
- `tests/browser/cdp.mjs`: the F and G key codes were added for the five-slot bar.
- `debug.setMonsterMaxHp` (dev only): training dummies for status tests. Statuses re-derive stats and clamp HP to
  Max HP, so a large HP alone does not survive a Slow or Burn.

## Known limitations

- Slow is monster-only (monsters never cast it).
- The release timing uses one value per skill (Magic Bolt 250 ms), while North's attack strip releases on frame 3
  (187 ms). The difference is invisible at 16 fps.
- Fireball reuses the Fire Bolt projectile and impact, larger. A dedicated strip can replace it through
  `SKILL_VFX` alone.
- Area-spell VFX are ellipses fitted by width to the circular hit area (perspective). The friendly / zone fields are
  true circles.
