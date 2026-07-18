# Ninja Combat Balance Pass v1 (Stage 5 / 10 / 15 @ x4)

Focused stability + balance pass for the Ninja secret class (PR #13). All combat
was run at game speed **x4** through the real runtime paths (solo hero placed via
`createHeroInstance → spawnToBench → moveUnitTo`, real `startBattle`, real
skill/attack engine). Telemetry was captured by wrapping the game's global
combat functions (`attackerRawAtk`, `executeSkill`) from the page — no combat
code was modified.

## Baseline under test (unchanged)

HP 360 · pAtk 40 · mAtk 0 · pDef 14 · mDef 16 · atkSpeed 1.7 · moveSpeed 2.9 ·
range 1 · mana 0/100 · skill `skill.ninja_shadow_flurry` (physical, pAtk ×1.3,
target lowest_hp_enemy, castTime 0.35) · cost 3 · Class Tier 3 secret · 3→2★.

Solo scenarios (one hero vs the stage's full enemy set, so all player damage is
attributable). Miniboss selection forced: Stage 5 = Golem (armor 22), Stage 10 =
Bone Dragon (armor 18), Stage 15 = Arena Overlord (armor 28).

## Telemetry

| Hero | Stage | Result | sim s | basics | casts | basic dmg | skill dmg | skill % | HP left | NaN/dup/err |
|---|---|---|---|---|---|---|---|---|---|---|
| **Ninja** | 5 (Golem+2 guards) | **win** | 19.1 | 24 | 4 | 713 | 157 | 18% | 162/360 (45%) | none |
| **Ninja** | 10 (Bone Dragon pack) | loss | 10.7 | 11 | 2 | 302 | 86 | 22% | died | none |
| **Ninja** | 15 (Arena Overlord pack) | loss | 6.1 | 7 | 1 | 202 | 37 | 15% | died | none |
| Archer (T1) | 5 | loss | 20.4 | 22 | 4 | 423 | 120 | — | died | none |
| Ranger (T2) | 5 | win | 14.2 | 16 | 4 | 541 | 329 | — | 450/540 (83%) | none |
| Duelist (T2) | 5 | win | 11.1 | 14 | 2 | 702 | 168 | — | 580/610 (95%) | none |

Notes: totals for a win = full enemy HP (870 at Stage 5). Ninja's Shadow Flurry
correctly locks onto the lowest-HP enemy at cast start; in solo runs the backline
squishies are often already dead to basic attacks, so later casts land on the
only remaining (and thus lowest-HP) target. No stuck pathing, no invalid-range
attacks, no duplicated damage, no NaN, no console/page errors in any run.

## Reading

- **Basic attacks are the primary damage source** (78–85% of Ninja's damage);
  Shadow Flurry is a modest finisher (15–22%, ~37–40 dmg/cast). Identity intact.
- Ninja **wins the early miniboss (Stage 5) solo but is the slowest winner and
  the squishiest** (45% HP left vs Ranger 83% / Duelist 95%, and 19.1s vs
  11.1–14.2s). She does **not** exceed Ranger or Duelist in speed or survival.
- The Golem's armor (22) noticeably taxes her low per-hit pAtk (40) — the
  intended "weak vs armor" weakness shows up as her slow Stage-5 clear.
- Stage 10 and 15 are **losses solo** — expected: she is a fragile, team-
  dependent unit, and those are multi-enemy miniboss/boss packs. She still lands
  meaningful damage (388 / 239) before dying, i.e. she does not die before
  contributing.

## Balance decision: **keep current values, no change**

Checked against the only four adjustment triggers:

- **A — dies before contributing:** No. Wins Stage 5; deals meaningful damage at
  Stage 10/15 before being overwhelmed solo.
- **B — exceeds Ranger & Duelist and survives too well:** No. Slower and squishier
  than both.
- **C — Shadow Flurry excessive / main damage source:** No. 15–22% of her damage.
- **D — atkSpeed 1.7 cooldown/runtime defect:** No. No NaN, no duplicate damage,
  no stuck targeting, no errors.

None are met, so no numerical change is warranted. Canonical
(`secret-heroes-v1.json`), runtime (`HERO_DEFS.ninja` / `SKILL_DEFS.ninja`), and
the runtime projection (`src/secret-class.js`) remain in sync and untouched.

## Regression re-verified on this HEAD

- Node: `validate-secret-heroes.mjs`, `test-secret-class-runtime.mjs`,
  `build-game-data-fixture.mjs` + `validate-game-data.mjs` (still 10 unrelated
  monster/boss `skillId` errors), `validate-demo1-localization.mjs`,
  `validate-hero-codex.mjs` — all pass. `git diff --check` clean.
- Browser (x4): locked→no Ninja; next-run eligible; forced hit = exactly 1 Ninja,
  no design_pending warning; purchase → bench, gold −3; 3× buy → 2★ combine, no
  evolution modal; Ninja absent from ownedPool; place via real path; x4 combat
  with no NaN/errors — 17/17 + 5/5 checks pass.
