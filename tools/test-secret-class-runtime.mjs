#!/usr/bin/env node

// Tests the DOM-free Secret Class runtime helper (src/secret-class.js):
//   1. its NINJA projection has not drifted from the canonical
//      data/design/secret-heroes-v1.json, and
//   2. its pure gating/chance/fusion logic behaves per the locked Ninja rules.
// No browser, DOM, or Three.js is involved — this is the deterministic evidence
// the runtime rules are correct; the Playwright smoke only checks wiring.

import { readFile } from 'node:fs/promises';
import process from 'node:process';

const failures = [];
const assert = (cond, msg) => { if (!cond) failures.push(msg); };
const eq = (a, b, msg) => assert(a === b, `${msg} (got ${JSON.stringify(a)}, expected ${JSON.stringify(b)})`);

// Load the helper by evaluating it with a sandbox global of the same shape the
// browser provides (it assigns globalThis.SecretClassRuntime).
const helperCode = await readFile(new URL('../src/secret-class.js', import.meta.url), 'utf8');
const sandbox = {};
new Function('globalThis', helperCode)(sandbox);
const SCR = sandbox.SecretClassRuntime;
assert(!!SCR, 'src/secret-class.js must set globalThis.SecretClassRuntime');

const canonical = JSON.parse(await readFile(new URL('../data/design/secret-heroes-v1.json', import.meta.url), 'utf8'));
const ninjaCanon = (canonical.secretHeroes || []).find((h) => h.id === 'ninja');
assert(!!ninjaCanon, 'secret-heroes-v1.json must contain a ninja secret hero');

if (SCR && ninjaCanon) {
  const P = SCR.NINJA;

  // --- 1. Drift check: projection vs canonical ---
  eq(P.id, ninjaCanon.id, 'ninja id');
  eq(P.persistKey, ninjaCanon.unlock.persistKey, 'ninja persistKey');
  eq(P.availableFromNextRun, ninjaCanon.unlock.availableFromNextRun, 'ninja availableFromNextRun');
  eq(P.notEligibleSameRunAsUnlock, ninjaCanon.unlock.notEligibleSameRunAsUnlock, 'ninja notEligibleSameRunAsUnlock');
  eq(P.unlock.stage, ninjaCanon.unlock.stage, 'ninja unlock.stage');
  eq(P.shop.chanceScope, ninjaCanon.shop.chanceScope, 'ninja shop.chanceScope');
  eq(P.shop.maxCopiesPerShop, ninjaCanon.shop.maxCopiesPerShop, 'ninja shop.maxCopiesPerShop');
  eq(P.shop.lockedChancePerRefresh, ninjaCanon.shop.lockedChancePerRefresh, 'ninja shop.lockedChancePerRefresh');
  eq(P.shop.appearanceSchedule.length, ninjaCanon.shop.appearanceSchedule.length, 'ninja schedule length');
  for (let i = 0; i < P.shop.appearanceSchedule.length; i += 1) {
    const a = P.shop.appearanceSchedule[i];
    const b = ninjaCanon.shop.appearanceSchedule[i];
    eq(a.band[0], b.stageBand[0], `ninja schedule[${i}].band lo`);
    eq(a.band[1], b.stageBand[1], `ninja schedule[${i}].band hi`);
    eq(a.chancePerRefresh, b.chancePerRefresh, `ninja schedule[${i}].chance`);
  }
  eq(P.fusion.starCombine, ninjaCanon.fusion.starCombine, 'ninja fusion.starCombine');
  eq(P.fusion.allowClass1ToClass2Evolution, ninjaCanon.fusion.allowClass1ToClass2Evolution, 'ninja fusion.allowClass1ToClass2Evolution');
  eq(P.fusion.usesStandardClassFusionRules, ninjaCanon.fusion.usesStandardClassFusionRules, 'ninja fusion.usesStandardClassFusionRules');
  // Combat design v1 — projection must match canonical combatData exactly.
  eq(P.combat.status, ninjaCanon.combatData.status, 'ninja combat.status');
  eq(P.combat.skillId, ninjaCanon.combatData.skillId, 'ninja combat.skillId');
  eq(P.combat.targetingBehavior, ninjaCanon.combatData.targetingBehavior, 'ninja combat.targetingBehavior');
  eq(P.combat.castTime, ninjaCanon.combatData.castTime, 'ninja combat.castTime');
  for (const k of ['hp','pAtk','mAtk','pDef','mDef','atkSpeed','moveSpeed','range','startingMana','maxMana']) {
    eq(P.combat.stats[k], ninjaCanon.combatData.stats[k], `ninja combat.stats.${k}`);
  }
  eq(ninjaCanon.gender, 'female', 'ninja gender female (canonical)');

  // --- 2. Chance bands, gated by eligibility ---
  eq(SCR.ninjaChancePerRefresh(3, true), 0.05, 'stage 1-5 chance');
  eq(SCR.ninjaChancePerRefresh(8, true), 0.15, 'stage 6-10 chance');
  eq(SCR.ninjaChancePerRefresh(13, true), 0.40, 'stage 11-15 chance');
  eq(SCR.ninjaChancePerRefresh(1, true), 0.05, 'stage 1 boundary');
  eq(SCR.ninjaChancePerRefresh(5, true), 0.05, 'stage 5 boundary');
  eq(SCR.ninjaChancePerRefresh(6, true), 0.15, 'stage 6 boundary');
  eq(SCR.ninjaChancePerRefresh(10, true), 0.15, 'stage 10 boundary');
  eq(SCR.ninjaChancePerRefresh(11, true), 0.40, 'stage 11 boundary');
  eq(SCR.ninjaChancePerRefresh(15, true), 0.40, 'stage 15 boundary');
  // Not eligible => always 0 (locked, or unlocked mid-run).
  eq(SCR.ninjaChancePerRefresh(3, false), 0, 'locked stage 1-5 chance');
  eq(SCR.ninjaChancePerRefresh(13, false), 0, 'locked stage 11-15 chance');

  // --- 3. One-roll semantics against a deterministic rng threshold ---
  // rng returns just-below / just-above the band chance -> hit / miss.
  eq(SCR.rollNinjaAppearance(13, true, () => 0.39), true, 'roll hit below 0.40');
  eq(SCR.rollNinjaAppearance(13, true, () => 0.41), false, 'roll miss above 0.40');
  eq(SCR.rollNinjaAppearance(3, true, () => 0.049), true, 'roll hit below 0.05');
  eq(SCR.rollNinjaAppearance(3, true, () => 0.051), false, 'roll miss above 0.05');
  eq(SCR.rollNinjaAppearance(13, false, () => 0.0), false, 'roll never hits while ineligible');
  // Exactly one rng draw per call (per refresh, not per slot).
  let draws = 0;
  SCR.rollNinjaAppearance(13, true, () => { draws += 1; return 0.9; });
  eq(draws, 1, 'exactly one rng draw per roll');

  // --- 4. Run-start eligibility snapshot ---
  eq(SCR.computeRunStartEligibility(true), true, 'eligible when unlocked before run');
  eq(SCR.computeRunStartEligibility(false), false, 'not eligible when not unlocked before run');

  // --- 4b. Permanent-unlock save mutation (backward compatible, keeps other keys) ---
  const freshUnlock = SCR.applyNinjaUnlock({});
  eq(freshUnlock.secretClassUnlocks.ninja, true, 'applyNinjaUnlock sets ninja=true on empty progress');
  const legacyUnlock = SCR.applyNinjaUnlock({ coins: 5, secretClassUnlocks: { other: true } });
  eq(legacyUnlock.coins, 5, 'applyNinjaUnlock preserves unrelated keys');
  eq(legacyUnlock.secretClassUnlocks.other, true, 'applyNinjaUnlock preserves existing unlocks');
  eq(legacyUnlock.secretClassUnlocks.ninja, true, 'applyNinjaUnlock adds ninja to existing unlocks');
  eq(SCR.applyNinjaUnlock(null).secretClassUnlocks.ninja, true, 'applyNinjaUnlock tolerates null progress');

  // --- 5. Combat-data safety gate (now that combat data is ready) ---
  eq(SCR.isNinjaCombatReady(true), true, 'combat-ready with a runtime hero def and complete data');
  eq(SCR.isNinjaCombatReady(false), false, 'still fails closed without a runtime hero def');
  // Fail-closed: temporarily break each required field and confirm the gate shuts.
  const savedStatus = P.combat.status;
  P.combat.status = 'design_pending';
  eq(SCR.isNinjaCombatReady(true), false, 'gate closes when status not ready');
  P.combat.status = savedStatus;
  const savedSkill = P.combat.skillId;
  P.combat.skillId = null;
  eq(SCR.isNinjaCombatReady(true), false, 'gate closes when skillId missing');
  P.combat.skillId = savedSkill;
  const savedAtk = P.combat.stats.pAtk;
  P.combat.stats.pAtk = 0;
  eq(SCR.isNinjaCombatReady(true), false, 'gate closes when pAtk not positive');
  P.combat.stats.pAtk = savedAtk;

  // --- 6. Fusion eligibility (data/ID level, no unit spawned) ---
  eq(SCR.isSecretClassHeroKey('ninja'), true, 'ninja is a secret class');
  eq(SCR.isSecretClassHeroKey('fighter'), false, 'fighter is not a secret class');
  const fe = SCR.secretClassFusionEligibility('ninja');
  eq(fe.allowsClassEvolution, false, 'ninja never enters class evolution');
  eq(fe.usesStandardClassFusionRules, false, 'ninja does not use normal class fusion rules');
  eq(fe.usesStandardThreeIdenticalStarCombine, true, 'ninja uses standard 3-identical star combine');
}

if (failures.length > 0) {
  console.error(`Secret Class runtime tests FAILED (${failures.length}):`);
  for (const f of failures) console.error(`- ${f}`);
  process.exitCode = 1;
} else {
  console.log('Secret Class runtime tests passed: projection in sync, gating/chance/fusion logic correct.');
}
