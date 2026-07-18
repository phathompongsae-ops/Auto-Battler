# Secret Class Board Limit Runtime v1

Smallest complete runtime rule: **the active player board may contain at most ONE
Secret Class unit in total, across all Secret Classes** — a global category limit,
not a Ninja-only duplicate rule. Enforced through the single central movement path,
metadata-driven so any future Secret Class works with no code change.

## Placement ownership map (audit)

| Concern | Owner |
|---|---|
| Player units | `placedUnits` (board) + `benchHeroes` (bench); enemies are `units` with `team:'enemy'` |
| Secret-class metadata | `HERO_DEFS[heroKey].secret_class === true` (Ninja carries it) |
| Bench slot | `BENCH_ROW` (6); `spawnToBench`/`findFreeBenchCol` |
| Board slot | rows `!= BENCH_ROW`; `placedUnits` |
| Drag start / drop | `renderer.domElement` pointerdown + document pointerup → all call `moveUnitTo` |
| **Central movement** | **`moveUnitTo(u, c, r)`** — every placement/reposition/release goes through it |
| Purchase → bench | `buyHero` → `spawnToBench` (never touches the board) |
| Fusion / star combine | `scanForStarCombine` → `performStarCombine` → `spawnToBench` (result to bench) |
| Occupancy | `occupied` Set, updated in `moveUnitTo`/`removeUnit` |
| Warning UI | `spawnFloatingText(unit, text, color)` (existing toast, e.g. the Link-cap warning) |
| Start-combat validation | `startBattleBtn.onclick` |

**All board placement flows through `moveUnitTo`** — confirmed — so a single guard there
is the primary enforcement, with a `startBattle` fail-safe as belt-and-suspenders.

## Implementation (files changed: `src/game.js` only)

Two central helpers + one guard + one fail-safe. No new module, no state system, no UI redesign.

```js
function isSecretClassUnit(u) {                    // generic, metadata-driven, fail-closed
  if (!u || typeof u.heroKey !== 'string') return false;
  const def = HERO_DEFS[u.heroKey];
  return !!(def && def.secret_class === true);      // never u.name === 'Ninja'
}
function playerBoardSecretUnits(exclude) {           // player board only; self-exclusion
  return placedUnits.filter((u) => u !== exclude && isSecretClassUnit(u));
}
```

- **Detection** uses `HERO_DEFS.secret_class` — Ninja has it; a future Black Dragon Knight /
  Sword Saint works by carrying the same flag. Fail-closed: normal heroes and malformed/absent
  units return `false` and never crash.
- **Guard in `moveUnitTo`**, placed *before any mutation*: if moving a secret unit to the board
  (`r != BENCH_ROW`) and `playerBoardSecretUnits(u).length >= 1`, show the warning and `return null`.
  `u` is excluded from the count, so **board-to-board reposition of the active secret unit stays
  allowed**. Rejection reuses the existing null-return path (unit stays put, destination untouched,
  no unit created/destroyed, no gold moved).
- **Player board only:** the count reads `placedUnits`; bench units and enemies/bosses
  (`team:'enemy'`, never in `placedUnits`, and no `secret_class` def) are structurally excluded.
- **Start-battle fail-safe:** if corrupted/debug state ever has `>1` secret unit on the board,
  `startBattle` blocks with the same warning and mutates nothing (no unit deleted).

## Warning UI

Existing floating-text toast, primary Thai message: **`ลงสนามได้เพียง 1 Secret Class ต่อทีม`**.
Generic (not Ninja-specific), one short line, no modal, no screen block. PR #16's localization
is not on this source branch; this is the smallest local runtime fallback — the temporary
integration point (the literal string in `moveUnitTo`/`startBattle`) can be swapped for PR #16's
localization key during stack reconciliation without changing the rule.

## What is intentionally unchanged

Secret classes may still be purchased, benched, moved between bench slots, and combined into 2★.
Purchase spawns to bench (never triggers the board warning). Ninja cost stays 3, 2★ combine stays
(no evolution modal, no 3★ system), and no balance/economy/combat/boss/augment value changes.

## Tests (all executed)

- **Browser (Playwright, x4):** `secret_limit.mjs` **20/20** — generic detection (ninja true /
  duelist false / junk-null false); first ninja placed, second rejected with warning, first stays
  on board, second stays on bench; board-to-board reposition allowed (self-excluded, no warn);
  board-to-bench release then replacement placement; 5 normal heroes placeable to MAX_FIELD;
  `startBattle` fail-safe blocks an injected 2-secret board without deleting units; 3 ninjas → one
  2★ on bench (no evolution modal, none on board); no page errors.
- **Regression (x4):** `demo1_ready` 41/41 (Stage 5/10/15, reward once, progression, Stage 15
  unlock once), `augment_flow` 31/31 (Stage 5/10 augments), `ninja_v2` 17/17 (5/15/40 chances,
  max-1, cost-3, 2★ combine, ownedPool exclusion, next-run eligibility), `economy_tests` 30/30
  (interest/streak/buy/sell/EXP/reroll, no profit loop, integer gold).
- **Node:** `test-augment-runtime`, `test-secret-class-runtime`, `build-game-data-fixture` +
  `validate-game-data` (10 unrelated skillId errors, unchanged); `node --check`; `git diff --check` clean.

## Remaining Demo 1 items (non-blocking, unchanged by this task)

Weapon sink not implemented (future); dedicated Ninja portrait; PR #14 monster/boss skills.

## Verdict

**Secret Class Board Limit ready.** The one-secret-per-board rule is enforced generically through
the single central placement path (plus a start-battle fail-safe), preserves purchase/bench/combine,
excludes enemies/bosses and self-repositioning, warns safely with no state corruption, and works for
any future Secret Class via the same `secret_class` metadata.
