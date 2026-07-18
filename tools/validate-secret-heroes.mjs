#!/usr/bin/env node

// Validates data/design/secret-heroes-v1.json against the locked Secret Class
// rules (see docs/GAME_DATA_CONTRACT_V1.md and docs/DEMO1_DATA_POLICY.md).
// Kept separate from validate-hero-codex.mjs, which locks the normal roster to
// exactly 21 Class 1/Class 2 heroes and must not be widened for secret classes.

import { readFile } from 'node:fs/promises';
import process from 'node:process';

const PATH = process.argv[2] ?? 'data/design/secret-heroes-v1.json';

// The only secret-class IDs the design has named so far. ninja has real data
// this round; the other two are reserved names for Map 2/3 with no data yet.
const ALLOWED_IDS = new Set(['ninja', 'black_dragon_knight', 'sword_saint']);
const COMBAT_FIELDS = ['stats', 'skillId', 'targetingBehavior', 'castTime'];

function validate(data) {
  const errors = [];
  const fail = (message) => errors.push(message);

  if (!data || typeof data !== 'object' || Array.isArray(data)) return ['root must be an object'];
  if (data.schemaVersion !== 1) fail('schemaVersion must equal 1');

  const reserved = Array.isArray(data.reservedFutureIds) ? data.reservedFutureIds : [];
  for (const id of reserved) {
    if (!ALLOWED_IDS.has(id)) fail(`reservedFutureIds contains unknown secret-class id: ${id}`);
  }

  const list = Array.isArray(data.secretHeroes) ? data.secretHeroes : null;
  if (!list) return [...errors, 'secretHeroes must be an array'];

  const seen = new Set();
  for (const [index, hero] of list.entries()) {
    const label = `secretHeroes[${index}]`;
    if (!hero || typeof hero !== 'object') {
      fail(`${label} must be an object`);
      continue;
    }
    if (typeof hero.id !== 'string' || hero.id.length === 0) {
      fail(`${label} requires a non-empty string id`);
      continue;
    }
    if (!ALLOWED_IDS.has(hero.id)) fail(`${label} has unknown secret-class id: ${hero.id}`);
    if (seen.has(hero.id)) fail(`duplicate secret-class id: ${hero.id}`);
    seen.add(hero.id);

    if (typeof hero.nameKey !== 'string' || !hero.nameKey) fail(`${hero.id}: missing nameKey`);
    if (typeof hero.descriptionKey !== 'string' || !hero.descriptionKey) fail(`${hero.id}: missing descriptionKey`);
    if (hero.classTier !== 3) fail(`${hero.id}: secret classes must be classTier 3`);
    if (hero.secretClassCategory !== 'map_secret_class') fail(`${hero.id}: secretClassCategory must be "map_secret_class"`);

    const unlock = hero.unlock ?? {};
    if (typeof unlock.mapId !== 'string' || !unlock.mapId) fail(`${hero.id}: unlock.mapId is required`);
    if (!Number.isInteger(unlock.stage)) fail(`${hero.id}: unlock.stage must be an integer`);
    if (typeof unlock.condition !== 'string' || !unlock.condition) fail(`${hero.id}: unlock.condition is required`);
    if (typeof unlock.persistKey !== 'string' || !unlock.persistKey) fail(`${hero.id}: unlock.persistKey is required`);
    if (unlock.availableFromNextRun !== true) fail(`${hero.id}: unlock.availableFromNextRun must be true (no same-run entry)`);

    const shop = hero.shop ?? {};
    if (shop.chanceScope !== 'per_refresh_not_per_slot') fail(`${hero.id}: shop.chanceScope must be "per_refresh_not_per_slot"`);
    if (shop.maxCopiesPerShop !== 1) fail(`${hero.id}: shop.maxCopiesPerShop must be exactly 1`);
    if (shop.lockedChancePerRefresh !== 0) fail(`${hero.id}: shop.lockedChancePerRefresh must be 0 while locked`);
    const schedule = Array.isArray(shop.appearanceSchedule) ? shop.appearanceSchedule : [];
    // Locked canonical schedule: stages 1-5 => 0.05, 6-10 => 0.15, 11-15 => 0.40.
    const expected = [
      { band: [1, 5], chance: 0.05 },
      { band: [6, 10], chance: 0.15 },
      { band: [11, 15], chance: 0.40 },
    ];
    if (schedule.length !== expected.length) {
      fail(`${hero.id}: shop.appearanceSchedule must have exactly ${expected.length} stage bands`);
    } else {
      for (const [i, row] of expected.entries()) {
        const actual = schedule[i] ?? {};
        const band = Array.isArray(actual.stageBand) ? actual.stageBand : [];
        if (band[0] !== row.band[0] || band[1] !== row.band[1]) {
          fail(`${hero.id}: shop.appearanceSchedule[${i}].stageBand must be [${row.band.join(', ')}]`);
        }
        if (actual.chancePerRefresh !== row.chance) {
          fail(`${hero.id}: shop.appearanceSchedule[${i}].chancePerRefresh must be ${row.chance}`);
        }
      }
    }

    const fusion = hero.fusion ?? {};
    if (fusion.allowClass1ToClass2Evolution !== false) fail(`${hero.id}: fusion.allowClass1ToClass2Evolution must be false`);
    if (fusion.usesStandardClassFusionRules !== false) fail(`${hero.id}: fusion.usesStandardClassFusionRules must be false`);
    if (fusion.starCombine !== 'standard_three_identical_copies') fail(`${hero.id}: fusion.starCombine must be "standard_three_identical_copies"`);

    // Ninja is a locked female design decision.
    if (hero.id === 'ninja' && hero.gender !== 'female') fail(`${hero.id}: gender must be "female"`);
    if (hero.gender !== undefined && !['female', 'male'].includes(hero.gender)) {
      fail(`${hero.id}: gender must be "female" or "male" when present`);
    }

    // Combat data may be absent, but if present it must either be a real, complete
    // record (status "ready") or be explicitly flagged design_pending with null
    // fields — never a fabricated placeholder passed off as canonical, and never a
    // "ready" record with missing/invalid fields (the runtime safety gate relies
    // on this so it can fail closed). Ranges below are deliberately loose sanity
    // bounds, not exact values, so combat can be rebalanced without editing this.
    const combat = hero.combatData ?? {};
    if (combat.status === 'design_pending') {
      for (const field of COMBAT_FIELDS) {
        if (combat[field] !== null && combat[field] !== undefined) {
          fail(`${hero.id}: combatData.${field} must be null while status is design_pending (do not fabricate)`);
        }
      }
    } else if (combat.status === 'ready') {
      const s = combat.stats;
      if (!s || typeof s !== 'object' || Array.isArray(s)) {
        fail(`${hero.id}: combatData.stats must be an object when status is "ready"`);
      } else {
        const REQUIRED_STATS = ['hp', 'pAtk', 'mAtk', 'pDef', 'mDef', 'atkSpeed', 'moveSpeed', 'range', 'startingMana', 'maxMana'];
        for (const key of REQUIRED_STATS) {
          const v = s[key];
          if (typeof v !== 'number' || !Number.isFinite(v)) fail(`${hero.id}: combatData.stats.${key} must be a finite number`);
          else if (v < 0) fail(`${hero.id}: combatData.stats.${key} must be non-negative`);
        }
        if (!(s.atkSpeed > 0 && s.atkSpeed <= 3)) fail(`${hero.id}: combatData.stats.atkSpeed must be > 0 and <= 3`);
        if (!(s.pAtk > 0 && s.pAtk <= 200)) fail(`${hero.id}: combatData.stats.pAtk must be > 0 and <= 200 (physical DPS)`);
        if (!(s.hp > 0 && s.hp <= 5000)) fail(`${hero.id}: combatData.stats.hp must be > 0 and <= 5000`);
      }
      if (typeof combat.skillId !== 'string' || !combat.skillId) fail(`${hero.id}: combatData.skillId is required when status is "ready"`);
      if (typeof combat.targetingBehavior !== 'string' || !combat.targetingBehavior) fail(`${hero.id}: combatData.targetingBehavior is required when status is "ready"`);
      if (typeof combat.castTime !== 'number' || !Number.isFinite(combat.castTime) || combat.castTime < 0) {
        fail(`${hero.id}: combatData.castTime must be a finite non-negative number when status is "ready"`);
      }
    } else if (combat.status !== undefined) {
      fail(`${hero.id}: combatData.status must be "design_pending" or "ready"`);
    }
  }

  return errors;
}

async function main() {
  try {
    const data = JSON.parse(await readFile(PATH, 'utf8'));
    const errors = validate(data);
    for (const error of errors) console.error(`ERROR: ${error}`);
    if (errors.length > 0) {
      console.error(`Secret hero validation failed with ${errors.length} error(s).`);
      process.exitCode = 1;
      return;
    }
    const count = Array.isArray(data.secretHeroes) ? data.secretHeroes.length : 0;
    console.log(`Secret hero validation passed: ${count} secret class(es) with real data.`);
  } catch (error) {
    console.error(`Secret hero validation failed: ${error.message}`);
    process.exitCode = 1;
  }
}

await main();
