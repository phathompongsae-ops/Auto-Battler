// Secret Class runtime helper — the single, DOM-free place the runtime reads
// Ninja secret-class rules from. The NINJA object below is a RUNTIME PROJECTION
// of the canonical source data/design/secret-heroes-v1.json (only the fields the
// runtime needs). tools/test-secret-class-runtime.mjs asserts this projection
// stays in sync with the canonical JSON, so it cannot silently drift.
//
// Loaded as a classic <script> in autochess.html (sets globalThis.SecretClassRuntime),
// and evaluated by the Node test harness with a sandbox global of the same name.
globalThis.SecretClassRuntime = (function () {
  'use strict';

  // Runtime projection of secret-heroes-v1.json -> secretHeroes[id === "ninja"].
  const NINJA = {
    id: 'ninja',
    persistKey: 'secretClassUnlocks.ninja',
    availableFromNextRun: true,
    notEligibleSameRunAsUnlock: true,
    unlock: { mapIndex: 1, stage: 15, condition: 'clear_map1_stage15_first_win' },
    shop: {
      chanceScope: 'per_refresh_not_per_slot',
      maxCopiesPerShop: 1,
      lockedChancePerRefresh: 0,
      appearanceSchedule: [
        { band: [1, 5], chancePerRefresh: 0.05 },
        { band: [6, 10], chancePerRefresh: 0.15 },
        { band: [11, 15], chancePerRefresh: 0.40 },
      ],
    },
    fusion: {
      starCombine: 'standard_three_identical_copies',
      allowClass1ToClass2Evolution: false,
      usesStandardClassFusionRules: false,
    },
    // Combat data is design_pending in the canonical source (null stats/skill),
    // so the runtime cannot spawn a real Ninja unit yet.
    combatDataStatus: 'design_pending',
  };

  const SECRET_IDS = new Set([NINJA.id, 'black_dragon_knight', 'sword_saint']);

  function isSecretClassHeroKey(id) { return SECRET_IDS.has(id); }

  // Shop chance for a given wave, gated by whether Ninja is eligible THIS run.
  // eligibleThisRun is the run-start snapshot, NOT the raw permanent-unlock flag
  // (see the runtime glue in src/game.js) — that is what keeps Ninja out of the
  // same run it was unlocked in.
  function ninjaChancePerRefresh(wave, eligibleThisRun) {
    if (!eligibleThisRun) return NINJA.shop.lockedChancePerRefresh; // 0 while locked / not yet eligible
    for (const row of NINJA.shop.appearanceSchedule) {
      if (wave >= row.band[0] && wave <= row.band[1]) return row.chancePerRefresh;
    }
    return 0;
  }

  // Exactly ONE roll per shop refresh (per_refresh_not_per_slot). rng defaults to
  // Math.random; tests pass a deterministic function.
  function rollNinjaAppearance(wave, eligibleThisRun, rng) {
    const chance = ninjaChancePerRefresh(wave, eligibleThisRun);
    if (chance <= 0) return false;
    return (typeof rng === 'function' ? rng() : Math.random()) < chance;
  }

  // Applies the permanent Ninja unlock to a progress object, backward-compatible
  // with an absent/malformed progress and never dropping unrelated keys. Returns
  // the (mutated or freshly created) progress object.
  function applyNinjaUnlock(progress) {
    const p = (progress && typeof progress === 'object' && !Array.isArray(progress)) ? progress : {};
    if (!p.secretClassUnlocks || typeof p.secretClassUnlocks !== 'object') p.secretClassUnlocks = {};
    p.secretClassUnlocks.ninja = true;
    return p;
  }

  // Run-start eligibility snapshot: Ninja may appear in the shop THIS run only if
  // it was already unlocked BEFORE the run began. Unlocking mid-run does not make
  // it eligible until the next run.
  function computeRunStartEligibility(unlockedBeforeRun) { return !!unlockedBeforeRun; }

  // Combat-data safety gate: Ninja can only be offered/spawned when canonical
  // combat data exists (status !== design_pending) AND the runtime actually has a
  // hero definition for it. hasRuntimeHeroDef is passed in to stay engine-free.
  function isNinjaCombatReady(hasRuntimeHeroDef) {
    return NINJA.combatDataStatus !== 'design_pending' && !!hasRuntimeHeroDef;
  }

  // Data/ID-level fusion eligibility — testable without spawning a unit.
  function secretClassFusionEligibility(id) {
    if (id !== NINJA.id) return null;
    return {
      usesStandardThreeIdenticalStarCombine: NINJA.fusion.starCombine === 'standard_three_identical_copies',
      allowsClassEvolution: NINJA.fusion.allowClass1ToClass2Evolution,
      usesStandardClassFusionRules: NINJA.fusion.usesStandardClassFusionRules,
    };
  }

  return {
    NINJA,
    isSecretClassHeroKey,
    ninjaChancePerRefresh,
    rollNinjaAppearance,
    computeRunStartEligibility,
    applyNinjaUnlock,
    isNinjaCombatReady,
    secretClassFusionEligibility,
  };
})();
