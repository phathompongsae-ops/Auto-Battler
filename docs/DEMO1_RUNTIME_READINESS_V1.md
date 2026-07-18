# Demo 1 Map 1 Runtime Readiness Pass v1

Blocker-focused end-to-end verification of the Demo 1 Map 1 playable loop
(shop → purchase → bench → board → battle → result/reward → next stage →
Stage 15 victory → permanent Ninja unlock → next-run eligibility). All three
main combat checkpoints ran at **speed x4** through the real runtime paths.
No functional defect was found, so no runtime code was changed.

## Module / function ownership map (src/game.js)

| Responsibility | Function(s) |
|---|---|
| Shop refresh / purchase | `pickShopOffers` (+ `maybeInjectNinjaOffer`), `buyHero`, `rerollBtn.onclick` |
| Bench spawning | `spawnToBench` / `findFreeBenchCol` |
| Board placement | `moveUnitTo` |
| Stage start / encounter selection | `startBattleBtn.onclick` → `spawnWave` → `buildWave`/`bossWave` (+ `STAGE5/10_MINIBOSS_POOL`, `stageN MinibossChoice`) |
| Combat start / update / end | `startBattleBtn.onclick`, `updateUnit`, `animate` loop (`onWaveCleared`/`onWaveFailed` guarded by `phase==='battle'`) |
| Reward calculation | `computeWaveIncome` + `grantWaveIncome` (base + win_bonus + interest cap + streak) |
| Stage progression | `onWaveCleared` (`wave += 1`, non-final branch) |
| Augment offers (Stage 5/10) | **Not implemented in runtime** — `augmentOffer` exists in `data/design/map1-encounters-v1.json` only |
| Run losses / reset | `onWaveFailed`, `losses`/`MAX_LOSSES` (3), `location.reload()` on limit |
| Stage 15 completion | `onWaveCleared` (`wave >= WAVE_TOTAL` branch → `phase='gameover'`) |
| Secret-class unlock persistence | `unlockNinjaOnMap1Stage15Victory` → `applyNinjaUnlock` → `saveProgress` (`localStorage: autobattler.progress.v1`) |
| Next-run Ninja eligibility | `computeRunStartEligibility` snapshot (`ninjaEligibleThisRun`, read once at load) |

## Test/fix plan (as executed)

Smallest viable plan: instrument the live loop (wrap `onWaveCleared` and
`unlockNinjaOnMap1Stage15Victory` to count events; sample gold/HP for
NaN/Infinity), build a deterministic winning team via real paths, and drive
exactly the 3 checkpoints + focused non-combat checks. Fix only loop-blocking /
state-corrupting defects. None were found → report only.

## Results — 41/41 browser checks pass (Playwright, x4)

**Checkpoint 1 — Stage 5:** boss = Golem (forced), no Warden/Champion/Immortal;
x4; victory → result modal; reward finite & applied once; `onWaveCleared` fired
exactly once; continue advances to Stage 6 / shop phase; no augment modal blocks
flow; no NaN; no page errors.

**Checkpoint 2 — Stage 10:** boss = Bone Dragon (forced); x4; victory → result;
reward finite & once; `onWaveCleared` once; next stage = 11 / shop; no NaN; no
page errors.

**Checkpoint 3 — Stage 15:** boss = Arena Overlord (fixed); x4; victory →
`gameover` run-complete flow; **Ninja unlock written exactly once**; persisted to
save; **not eligible during the unlock run**; `onWaveCleared` once; no NaN; no
page errors.

**Next-run / shop:** after reload through the real save path, Ninja eligible;
chances 5% / 15% / 40% by band; **max one Ninja per shop** on a forced hit.

**Non-combat:** normal Class 1 purchase deducts exactly 2 gold and spawns to
bench; valid `moveUnitTo` placement works; invalid/occupied placement returns
null without corrupting state or gold; **3 Ninjas combine into one 2★ Ninja with
no evolution modal**; genuine defeats increment `losses` and the permanent unlock
survives run losses (`secretClassUnlocks.ninja` stays `true`).

**Global:** no NaN/Infinity in sampled state; reward/unlock events fire exactly
once (no duplicates); no page or console errors across all scenarios.

## Node validators (all pass on this HEAD)

`validate-secret-heroes.mjs`, `test-secret-class-runtime.mjs`,
`build-game-data-fixture.mjs` + `validate-game-data.mjs` (10 unrelated
monster/boss `skillId` errors, unchanged), `validate-demo1-localization.mjs`,
`validate-hero-codex.mjs`, `validate-balance-pack.mjs`,
`validate-demo1-policy.mjs` (map1-encounters). `git diff --check` clean.

## Remaining Demo 1 items

- **Functional blockers:** none.
- **Data blockers:** none for the playable loop. (`validate-game-data.mjs` still
  reports 10 unresolved monster/boss `skillId`s — canonical contract data, not
  wired into the runtime loop, so not a loop blocker; owned by PR #14.)
- **Non-blocking feature/data gap:** Stage 5/10 **augment offers** are defined in
  `map1-encounters-v1.json` but not implemented in the runtime. The loop
  progresses correctly without them; implementing augments is a separate feature,
  out of scope for this blocker pass.
- **Asset blockers:** none functional. Ninja uses the Duelist sprite as a
  role-matched placeholder; a dedicated Ninja portrait is a visual to-do.
- **Visual/polish blockers:** none.

## Verdict

**Demo 1 Runtime ready, with listed non-blocking follow-ups** (augment feature
not yet wired; Ninja portrait; PR #14 monster/boss skill data). The core Demo 1
Map 1 loop — preparation through Stage 15 victory, permanent Ninja unlock, and
next-run eligibility — runs coherently at x4 with no crashes, NaN, duplicate
rewards/unlocks, invalid bosses, or state corruption.
