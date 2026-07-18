# Demo 1 Economy Balance Audit & Alignment v1

Evidence-first audit of the Demo 1 economy. A deterministic simulator
(`tools/economy-sim.mjs`) models the **currently implemented** runtime economy
across all 15 stages for five strategies; weapon purchasing (not implemented in
the runtime) is modeled separately as a **future sink**. Live formulas were
verified in-browser. **Conclusion: no runtime value change is justified — the
implemented economy is bounded, tight early, flexible late, and cannot overflow.**

## Economy ownership map (src/game.js)

| System | Owner | Status |
|---|---|---|
| Starting gold | `let gold = 10` | implemented |
| Wave income | `computeWaveIncome` / `grantWaveIncome` (`SHOP_ECONOMY.income`) | implemented |
| Base income / win bonus | `base_income_per_wave: 5`, `win_bonus: 1` | implemented |
| Interest | `interest {gold_per_step:10, bonus_per_step:1, max_bonus:5, max_gold_counted:50}` | implemented |
| Win/loss streak | `updateStreak` + `streak_bonus` table (0/+1/+2/+3) | implemented |
| Free reroll | `free_rerolls_per_wave: 1`, reset (`=`) each shop entry | implemented (non-accumulating) |
| Paid reroll | `reroll.cost: 2`, `rerollBtn.onclick` | implemented |
| Hero purchase | `buyHero` (`def.cost`: T1 2, T2 3, Ninja 3) | implemented |
| Hero sellback | `sellUnit`/`getSellValue` (T1 1 = 50% of 2; T2 3) | implemented |
| EXP purchase / level | `buyExpBtn` (`BUY_EXP_COST 4`, `BUY_EXP_GAIN 4`, `expNeeded=2+2·lvl`, L1→5) | implemented |
| No-death bonus | — | **not implemented** (income has none) |
| Weapon shop / buy / fusion prices | — | **not implemented** (data/localization only) |
| Boss/stage gold reward data | `map1-encounters rewardRule` | **data-only** (runtime uses `SHOP_ECONOMY.income`, not `10+stage`) |
| Result-continue gold | `onWaveCleared` grants income once (phase-guarded) | implemented, no double-add |
| Debug gold path | `__NinjaSecretDebug.grantGold` | test-only |

**Implemented sinks:** hero buy, EXP, rerolls, hero sell. **Missing/future sinks:**
weapons (buy/fusion). **Conflict check:** runtime does **not** use the canonical
`10 + stageNumber` reward (which would flood); it uses the bounded `base 5` formula.

## Current values

Start 10 · base 5 · win +1 · interest +1/10 gold (cap +5 at 50) · streak +0/+1/+2/+3 ·
hero T1 2 / T2·Ninja 3 · sell T1 1 / T2 3 · EXP 4 (max level 5 = 28 gold) · reroll 2 (1 free/wave).
**Max possible income/stage = 5+1+5+3 = 14** (hard ceiling → economy cannot become unlimited).

## Simulation (Profile A = current runtime; all 15 stages)

Gross income and end-state by strategy (single deterministic run; interest/streak are exact, reroll "forcing" uses seeded ranges):

| Strategy | Gross S5 / S10 / S15 | Interest | Streak | Final Lvl | Heroes bought | Rerolls | End gold |
|---|---|---|---|---|---|---|---|
| Saver | 43 / 112 / 182 | 56 | 36 | 5 | 3 | 0 | 158 |
| Hero-reroll | 36 / 81 / 126 | 0 | 36 | 1 | 39 | 39 | ~10 |
| Weapon (future-modeled) | 43 / 112 / 182 | 56 | 36 | 1 | 4 | 0 | 184 → *future L3 reached, modeled 50 gold* |
| Balanced | 37 / 88 / 157 | 31 | 36 | 5 | 18 | 15 | 103 |
| Stress spender | 36 / 81 / 126 | 0 | 36 | 5 | 31 | 31 | ~12 |

**Income profile comparison (Balanced):** A(current) S15=157 · B(stage-stepped) 172 · C(sink-adjusted) 157 · D(late-hybrid) 167. B and D add late income the runtime does not need.

### Reading against the required targets

- **Gross income:** ~36–43 by S5, ~81–112 by S10, ~126–182 by S15 (range = how much a strategy banks for interest vs spends).
- **Discretionary spend after essentials:** early (S1–5) a strategy affords **one** major direction/stage (a hero *or* a reroll pair *or* progress toward one EXP level); S6–10 **two** priorities; S11–15 loosens (interest+streak fund ~14/stage) but a full board + level 5 already consumes the plan.
- **Paid rerolls affordable:** Saver 0, Balanced ~1/stage, Stress/Hero-reroll ~2/stage. Never "reroll freely while also buying everything."
- **Interest contribution:** up to +5/stage, but only if ≥50 gold is *held* (Saver banks 56 total; spenders bank 0) — a real, non-dominant tradeoff.
- **Streak contribution:** +36 total on a clean 15-win run (identical across strategies) — rewards winning, caps at +3.
- **Free-reroll value:** exactly one free refresh/stage (non-accumulating, verified) — meaningful early QoL, not a flood.
- **Stress test / overflow:** the Stress spender ends every stage at ~6–12 gold and never goes negative; income is hard-capped at 14/stage → **the economy is bounded and can never become unlimited.**
- **Aggressive spending vs saving:** Stress reaches level 5 + 31 heroes but banks 0 interest; Saver banks big but fields only 3 heroes at level 5. Neither dominates.

### Forcing a specific high-value outcome (seeded Monte-Carlo, 200 seeds)

- **Specific 2★ hero:** collecting ~9 tier-1 copies of *one* line over 15 stages is statistically likely (≈96%+ to *see* them) **but requires dedicating the whole run's hero+reroll budget to that line** (≈18 gold of buys + the rerolls to surface them), at the cost of board width, EXP, and — once implemented — weapons. So it is a **major run-long investment, not a free/automatic** outcome.
- **Level 3 weapon:** weapon purchasing is **not implemented**; in the future model at price 30 it is ~2 stages of full income — a **major investment, never automatic**.

## Balance decisions (all evidence-based)

- **Runtime income/costs:** **no change.** The runtime already avoids the `10+stage` flood, is hard-capped at 14/stage, keeps early game tight (start 10, ~6–8/stage S1–5), and gives late flexibility via interest+streak. Adding income (Profiles B/D) or cutting costs is unnecessary and would erode early pressure.
- **Sellback:** **keep 50%.** For a 2-gold Class 1 hero, `floor(2×0.5)=floor(2×0.7)=floor(2×0.8)=1` — 50/70/80% are **numerically identical** at these integers, so raising the rate changes nothing. Selling can never profit (refund 1 < cost 2) and cannot loop (verified: 20× buy→sell never grows gold).
- **Free reroll:** **keep 1/wave.** Verified non-accumulating; removing it would harm early tightness with no overflow benefit.
- **No-death bonus:** **reject.** Not implemented; adding +3 would be up to +45/run of *win-more* income, worsening the (already sink-limited) late surplus and 2★-forcing — contrary to the bounded/tight intent.
- **Ninja cost 3:** consistent with the tier-2 price point; no economy inconsistency found, left unchanged.

## Why the two "loose" signals are NOT income defects

Both the Saver's large end-gold (158) and the ease of *seeing* enough copies to force a 2★ are consequences of the **not-yet-implemented weapon sink** — the only large late-game gold sink in the canonical design. With weapons competing for the same gold, late surplus drains and forcing a 2★ trades off against weapon progression. The task explicitly warns against flooding/starving income "in anticipation of future systems," so the correct action now is **no change**; revisit once weapons are implemented.

## Tests executed

- **Node:** `tools/economy-sim.mjs` (+`--profiles`); regression `test-augment-runtime`, `test-secret-class-runtime`, `validate-secret-heroes`, `build-game-data-fixture`+`validate-game-data` (10 unrelated skillId errors, unchanged), `validate-demo1-localization`, `validate-balance-pack`; `node --check src/game.js`; `git diff --check` clean.
- **Browser (Playwright, x4):** `economy_tests.mjs` **30/30** — interest at 0/9/10/19/20/49/50/60/1000, streak at every threshold, integer/finite totals, buy −2, sell +1 (no profit, no loop), insufficient-gold rejection & no negative gold, EXP −4 & insufficient rejection, free reroll 0 / paid 2 / non-accumulating. `demo1_ready.mjs` **41/41** (Stage 5/10/15 x4: reward once, integer gold, progression, Stage 15 unlock once). `augment_flow.mjs` **31/31** (Stage 5/10 augments intact). `ninja_v2.mjs` **17/17** (5/15/40 chances, max-1, cost-3, 2★ combine, ownedPool exclusion).

## Remaining Demo 1 economy risks

- **Late-game gold sink gap (future, non-blocking):** with weapons unimplemented, a saver/optimizer accumulates unspent gold late. Resolved by the future weapon runtime; do not pre-compensate with income cuts.
- **2★ forcing tightness (future, non-blocking):** becomes appropriately costly once weapons compete for gold.
- No functional economy defect (no overflow, no negative gold, no NaN, no profit loop, no duplicate reward).

## Verdict

**Economy ready — with modeled future sinks.** The currently implemented Demo 1
economy (heroes, EXP, rerolls, interest, streak, sellback) is correctly bounded,
integer-safe, early-tight, mid-constrained, and late-flexible without ever
overflowing; no runtime value change is warranted. The weapon sink remains a
declared future addition, and the two "loose" signals resolve when it lands.
