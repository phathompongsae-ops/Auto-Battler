# Project Status: Auto-Battler (Three.js 2.5D)
**Last Updated:** 2026-07-15

## Latest change: LINK_SYSTEM_V2 (data-driven Link/Synergy rebuild)

Replaced the old inert `SYNERGIES`/`HERO_TAGS`/`.linked`-boolean system in `autochess.html`
with a fully data-driven, instance-based Link system per the LINK_SYSTEM_V2 task spec:

- Added `primaryLinkTag` (one of vanguard/striker/ranger/caster/support/summoner/merchant) to
  all 21 `HERO_DEFS` entries — the sole tag counted for Link (old `synergy[]` array stays
  display-only, never counted).
- New hero-instance identity: `benchHeroes` now holds `{instanceId, heroKey}` objects
  (`createHeroInstance`) instead of raw heroKey strings, so duplicate heroes on the bench/field
  can be told apart unambiguously; `placeHeroAt` now takes a bench index (not a heroKey).
- `linkedInstanceIds` (Set) is the sole source of truth for which field heroes are in Link —
  `toggleLinkByInstanceId`, `sanitizeLinkSelection` (drops stale ids / trims to `MAX_LINK_SLOTS`),
  `showLinkFullWarning` (self-reverting flash when a blocked 4th pick is attempted).
- `LINK_SYNERGIES`: 7 synergies (one per tag) with tier2/tier3 thresholds; `resolveActiveLinkTiers`
  picks the single highest tier per synergy (no stacking within one synergy); `getTeamBuffs` sums
  effects across *different* synergies (which can stack) then hard-caps each stat
  (`DAMAGE_BONUS_CAP_PCT=25`, `ARMOR_PENETRATION_CAP=20`, `ATTACK_SPEED_BONUS_CAP_PCT=25`,
  `DAMAGE_REDUCTION_CAP_PCT=20`, `ECONOMY_BONUS_CAP_PER_WAVE=2`).
- Combat-lifecycle split so buffs never compound: `applyPreCombatLinkBuffs()` (called once from
  `startBattleBtn.onclick`, before `spawnWave`) freezes `combatLinkBuffs` for the whole battle and
  recomputes each unit's `maxHp` from an immutable `u.baseMaxHp` every time; `applyCombatLinkModifiers`
  applies dmgPct/armorPen (attacker-side) and damageReductionPct (defender-side) per attack using
  that frozen snapshot instead of a live `getTeamBuffs()` call. `onWaveCleared` reward now reads
  `combatLinkBuffs.goldPerVictory`.
- Tested via local Playwright harness: all 9 acceptance scenarios from the task spec pass
  (highest-tier-only, no multi-tag double counting, missing-tag fallback to `'unassigned'`,
  link persistence/cleanup on unplace, HP never compounds across repeated `applyPreCombatLinkBuffs`
  calls, merchant gold-per-victory capped at 2, 4th-pick blocked with visible warning, full
  multi-wave playthrough through a boss wave at speed x4 with no NaN/console errors).

**Files changed:** `autochess.html`, `Gemini.md`, `gemini_status.md`.

## Roadmap & Priorities
1. **Stabilize 15-stage run:** Full test flow (1-15), error checking, and regression testing. — ✅ done
   (see `Gemini.md`: weapon-atlas 404 + favicon 404 fixed, clean Playwright run through wave 15)
   - Sub-task: boss-ID pick scaffold for stage 5/10/15 — ✅ done (placeholder only, no stats/sprite yet;
     see `Gemini.md`)
2. **Remove runtime regex patch:** Convert Combat Next into a modular system.
3. **Hero Merge / Star Upgrade:** Implement unique ID, star levels, and 3-copy merge logic.
4. **Equipment Core:** Implement inventory, 2 slots per hero, and stat modifier pipeline.
5. **Equipment Merge and Shop:** Implement popup shop (3 items), merge logic, and drop-rate tables.
6. **Skill / Mana / Status Effects:** Implement combat mechanics (Mana gain, targeting, status effects).
7. **Modularization:** Move data/configs to external files (JSON/.js) to improve performance and code maintainability.
