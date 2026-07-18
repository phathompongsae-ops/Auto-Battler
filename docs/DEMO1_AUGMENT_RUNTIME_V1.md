# Demo 1 Augment Runtime v1 (Stage 5 / 10)

Smallest complete runtime integration for the Demo 1 Map 1 augment offers after
genuine victories at Stage 5 and Stage 10. Reuses the canonical augment data and
the existing modal/stat pipelines; no progression, economy, combat, or layout
redesign.

## Canonical source

- Offer IDs: `data/design/map1-encounters-v1.json` — stage 5 `augmentOffer:"augment.map1.after_5"`, stage 10 `augment.map1.after_10`.
- Option effects: `docs/GAME_DATA_CONTRACT_V1.md` "Map 1 augment candidates":
  - After Stage 5: **Team +8% HP** / **Class-focused +15% P.ATK / M.ATK**
  - After Stage 10: **Team +10% ATK Speed** / **Class-focused start with 50% mana**

No option was invented. The two offers × two options are projected in
`src/augment-runtime.js` (DOM-free), keyed by the canonical offer IDs.

## Architecture (smallest viable)

- **`src/augment-runtime.js`** (new, global `AugmentRuntime`): canonical offer/option
  table + pure aggregation (`teamMaxHpPct`, `teamAtkSpeedPct`, `classAtkPct`,
  `classStartManaPct`) + deterministic `pickClassLine` + fail-closed `getOfferOptions`.
- **`autochess.html`**: `#augmentModal` overlay reusing the `#resultModal` style; loads
  the new script before `game.js`.
- **`src/game.js`**: run-scoped state + the offer flow + effect application through the
  three existing central pipelines. No base stats mutated.

## Run-scoped state and reset

`runAugments` (array of active effect entries) and `augmentsOfferedStages` (a `Set`)
are in-memory only and **never written to the save**. A run reset is a page reload
(the existing 3-loss `location.reload()` path), which re-initialises both to empty —
verified. The permanent Ninja unlock lives in `localStorage` and is untouched by
augment code, so it survives a run reset (verified). Loss-retry within a run keeps
augments (same run).

## No permanent base-stat mutation

Effects are folded into the pipelines that already rebuild from immutable snapshots
each battle, so they apply **exactly once** and never compound with star scaling:

- **Team +8% HP** → `applyPreCombatSynergyBuffs`: `u.maxHp = round(u.baseMaxHp × (1+synergy) × (1+aug))`, from the immutable `baseMaxHp`; `u.hp` set to the new max (fresh full battle start).
- **Class +15% P.ATK/M.ATK** and **Team +10% ATK Speed** → `buildCombatStats`, which clones the immutable `baseStats` every call. Class ATK scales both `p_atk` and `m_atk` (zero base stays zero). Attack speed is still clamped `[0.2, 3.0]`.
- **Class start mana 50%** → applied once at `startBattle` after `buildCombatStats`: `current_mana = min(max_mana, round(max_mana × 0.5))` for the eligible class, not per frame, clamped to max.

Because these are battle-start choke points, **existing and newly purchased units get
the same active augments** (verified: a unit created after selection receives +8% HP
and +10% ATK speed identically).

## Class-focused selection rule (documented, smallest deterministic)

To keep the modal to exactly two options with no nested class picker, the class-focused
augment binds at selection time to the **most-represented owned class line**
(`getRootClass` over bench+board), ties broken by canonical class order, defaulting to
`fighter` if none are owned. Secret classes (Ninja, `getRootClass → undefined`) never
match a class-focused augment.

## Offer flow & duplication guards

After a Stage 5/10 victory: reward + `onWaveCleared` fire once (existing, phase-guarded);
the result modal's Continue enters the shop phase, then `maybeOfferAugment(clearedStage)`
opens the augment modal. `augmentsOfferedStages` guarantees **at most one offer per stage
per run**; `selectAugment` re-checks the guard, so refresh/reopen/re-continue cannot
duplicate the offer or effect. While the modal is open, `augmentModalOpen` blocks
`startBattle` and the board raycast (and the overlay covers the DOM shop controls).
Stage 15 has no `augmentOffer`, so no offer appears — the game-complete + Ninja unlock
flow is unchanged.

## Fail-closed

If an offer ID is unknown or its option table is malformed, `getOfferOptions` returns
`null`; the runtime logs `[Augment] no valid offer…`, marks the stage offered, and
continues progression without applying any fabricated value.

## Tests (all executed)

- **Node:** `tools/test-augment-runtime.mjs` (offers, aggregation, class selection,
  fail-closed) — pass. Regression: `test-secret-class-runtime`, `validate-secret-heroes`,
  `build-game-data-fixture` + `validate-game-data` (10 unrelated monster/boss skillId
  errors, unchanged), `validate-demo1-localization`, `validate-hero-codex`,
  `validate-balance-pack` — pass. `git diff --check` clean.
- **Browser (Playwright, x4):** `scratchpad/augment_flow.mjs` — **31/31**: Stage 5 modal
  once → Team +8% HP applied to existing+new units; Stage 10 modal once → Team +10% ATK
  Speed applied once, x4 combat finite; Class +15% P.ATK deterministic; Class start-mana
  exactly 50%, ≤ max, not per-frame; run reset clears augments while unlock persists;
  Stage 15 no augment offer. Regression: `ninja_v2.mjs` 17/17, `ninja_combat.mjs` 5/5,
  `demo1_ready.mjs` 41/41.

## Verdict

**Demo 1 augment runtime is ready.** Both checkpoints offer exactly two canonical
options once per run, apply the selected effect for the run through a single central
path (no double-application, no base mutation, no NaN), continue to the next stage, and
leave boss identities, economy, Ninja, shop rates, and Stage 15 completion unchanged.
