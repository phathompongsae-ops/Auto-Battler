# Equipment Vertical Slice Runtime v1

Smallest complete Equipment loop for Demo 1, built on the **existing Equipment Core**
(item instances, shared inventory, equip/unequip, the `buildCombatStats` stat pipeline,
and the star-combine equipment transfer). Player-facing UI says **อุปกรณ์ (Equipment)**;
internal ids keep `weapon.*` per the contract.

## Pre-edit ownership map

| Concern | Owner (pre-existing unless noted) |
|---|---|
| Hero shop / reroll / free reroll | `pickShopOffers`, `rerollBtn.onclick`, `freeRerollsRemaining` |
| Gold / insufficient-gold | `gold`, `buyHero`, `computeWaveIncome` |
| Run reset | `location.reload()` (3-loss) — clears all in-memory state |
| Unit creation / bench / board | `createHeroInstance`, `spawnToBench`, `moveUnitTo`, `placedUnits`/`benchHeroes` |
| Hero inspect / equip UI | `openEquipModal`/`renderEquipModal`, `#equipModal`, `equipSlotsEl`, item drag-drop |
| **Central stat build** | **`buildCombatStats(hero, ITEM_DEFS_BY_ID)`** (flat `stats` add, then `percent_stats` mult, then clamps) |
| Star scaling | `getScaledHeroStats` → immutable `baseStats`/`baseMaxHp` |
| Augment / Synergy stat application | `augClass*`/`augTeam*` in `buildCombatStats`; `synergyBuffs` in `buildCombatStats` + `applyPreCombatSynergyBuffs` |
| Attack-speed clamp | `ATTACK_SPEED_MIN/MAX` in `buildCombatStats` |
| Max-HP init | `applyPreCombatSynergyBuffs` from immutable `baseMaxHp` |
| Item model / equip / inventory | `playerState`, `createItemInstance`, `equipItem`, `unequipItem`, `returnHeroEquipmentToInventory` |
| Star-combine equipment transfer | `performStarCombine` (returns items to inventory / equips ≤2 on result / overflows, never destroys) |

All board placement flows through `moveUnitTo`; **all stat application flows through
`buildCombatStats` + `applyPreCombatSynergyBuffs`** — the two central boundaries used here.

## Architecture (files changed: `src/game.js`, `autochess.html`)

Reused the Equipment Core; added: the 5-item slice catalog, an Equipment Shop, manual
fusion, inventory cap 8, equip guards, and Iron Armor Max-HP. Run-scoped state
(`equipShopOffers`, `fusionPending`, `playerState.*`) is in-memory only and cleared by the
reload-based run reset; the permanent Ninja unlock (localStorage) is untouched.

**Catalog** (added to `ITEM_DEFS_BY_ID`):

| Item | id | Lv | Price | Effect (stat key) |
|---|---|---|---|---|
| Iron Sword | `weapon.iron_sword` | 1 | 6 | `stats.p_atk 8` |
| Apprentice Staff | `weapon.apprentice_staff` | 1 | 6 | `stats.m_atk 8` |
| Swift Gloves | `weapon.swift_gloves` | 1 | 6 | `percent_stats.attack_speed 8` |
| Iron Armor | `weapon.iron_armor` | 1 | 6 | `stats.hp 120` (→ Max HP) |
| Duelist Blade | `weapon.duelist_blade` | 2 | 14 | `stats.p_atk 14` + `percent_stats.attack_speed 10` (fusion-only) |

**Stat-build ordering** (unchanged formulas; equipment inserted as declared modifiers):

- **P.ATK / M.ATK:** star-scaled base → **+ flat equipment once** → existing `%` (synergy/augment) → floor at 0. (`buildCombatStats`)
- **Attack Speed:** star/base → synergy `%` → augment `%` → **equipment `%` once** (`percent_stats`) → clamp `[0.2, 3.0]`.
- **Max HP:** immutable star-scaled `baseMaxHp` **+ equip flat HP (Iron Armor 120) once** → synergy `%` → augment `%` (`applyPreCombatSynergyBuffs`). `hp` is set to the rebuilt `maxHp` (fresh full at battle start). Rebuilt from base every battle → no compounding.

No `HERO_DEFS` or canonical item record is mutated.

**Equipment Shop:** `equipShopOffers` (2 slots), `refreshEquipShop` (2 distinct L1, equal
chance, Duelist Blade excluded), `buyEquipItem` (−6, one item, sold-once), `rerollEquipShop`
(−2, no free reroll, hero free reroll isolated). Refreshed at shop-phase start (init + wave
transitions) and by the equip reroll button only — never by the hero reroll.

**Equip rules** (central `equipItem`/`unequipItem`, all reject before mutation): outside
combat only; no two copies of the same item id on one hero; both slots max 2; full-inventory
unequip rejects and keeps the item equipped.

**Fusion:** `canFuseDuelistBlade`/`fuseDuelistBlade` — manual confirm, inventory inputs only
(equipped never consumed), input order irrelevant, validate-before-mutate, consume exactly
one of each input + create one output, 0 gold, `fusionPending` double-submit guard.

**Star-combine equipment policy:** kept the existing `performStarCombine` behavior — consumed
copies' equipment returns to the merge pool, up to 2 re-equip on the result, the rest overflow
back to inventory; **items are never deleted or duplicated** (verified: after a 3→2★ combine
with an equipped Iron Sword, exactly one sword survives, equipped-or-inventoried). This
already satisfies "no loss / no duplication" without a disproportionate rewrite; the
block-on-full-inventory alternative was unnecessary and is noted as deferred.

**Localization:** local Thai strings in `EQ_TXT` (ร้านอุปกรณ์ / รีเฟรชอุปกรณ์ / คลังอุปกรณ์ /
etc.). Documented swap point for PR #19 localization keys on stack reconciliation. PR #19
files were not modified.

## Economy (unchanged hero economy; equipment is a real competing sink)

Hero costs/EXP/reroll/interest/streak unchanged. Equipment: L1 6, reroll 2, no free reroll,
fusion 0, no sellback. Verified: buy −6; reroll −2; buy two + fuse = 12 total (0 fusion gold);
hero free reroll still available after an equip reroll; no negative gold, no double charge, no
buy/fusion duplication.

## Tests (all executed)

- **Browser (Playwright, x4-capable):** `equip.mjs` **44/44** — shop (2 slots, only 4 L1 ids,
  distinct, Duelist Blade never offered over 200 refreshes, buy −6 once, sold-once, reroll −2,
  hero free reroll isolated, insufficient-gold preserves offers, cap 8, full-inventory buy
  rejected); stats (Iron Sword P.ATK+8 only / Staff M.ATK+8 / Gloves AS+8% / Iron Armor MaxHP+120
  with current=max / Duelist Blade P.ATK+14 & AS+10% / two-item combine / idempotent rebuild /
  removal clears effect); equip rules (first/second equip, duplicate-id reject, full-slot reject,
  combat equip+unequip reject, unequip with space, full-inventory unequip reject); fusion
  (missing reject, ready, consume-2 create-1, 0 gold, repeated-confirm no dup, equipped items
  excluded); star-combine equipment safety (3 ninjas → 2★, exactly one sword, no evolution
  modal); run reset (inventory/offers/fusion cleared, Ninja unlock persists); no page errors.
- **Regression (x4):** `demo1_ready` 41/41 (Stage 5/10/15, reward once, progression, unlock
  once), `augment_flow` 31/31, `ninja_v2` 17/17 (5/15/40 chances, max-1, cost-3, 2★ combine),
  `economy_tests` 30/30, `secret_limit` 20/20 (Secret Class board limit).
- **Node:** `test-augment-runtime`, `test-secret-class-runtime`, `build-game-data-fixture` +
  `validate-game-data` (10 unrelated skillId errors, unchanged); `node --check`; `git diff --check` clean.

## Remaining Demo 1 items (non-blocking)

Deferred by design: L3 runtime, full 21-recipe matrix, equipment sellback/rarity/odds/art,
permanent inventory, auto-fusion. Dedicated Ninja portrait and PR #14 monster/boss skills remain.
Localization currently a local Thai fallback (PR #19 swap point documented).

## Verdict

**Equipment Vertical Slice ready** (with the documented non-blocking localization-key swap for
PR #19). The full loop — Equipment Shop → buy L1 → shared inventory (cap 8) → equip two distinct
items → stats modified exactly once through the central build → unequip → manual L1→L2 fusion —
works, rejects invalid actions before any mutation, preserves star-combine equipment without
loss/duplication, keeps the hero economy and all prior systems intact, and resets cleanly per run.
