#!/usr/bin/env node

import { readFile } from 'node:fs/promises';
import process from 'node:process';

const CLASS_1_IDS = new Set([
  'fighter',
  'swordman',
  'archer',
  'mage',
  'summoner',
  'acolyte',
  'merchant',
]);

const PROHIBITED_HERO_IDS = new Set(['novice']);
const OBSOLETE_BOSS_IDS = new Set(['warden', 'champion', 'immortal_champion']);
// Confirmed Demo 1 miniboss pools (exactly two unique IDs each, order-independent) and the
// fixed Stage 15 boss — see docs/DEMO1_DATA_POLICY.md and docs/BOSS_ENCOUNTER_POLICY.md.
const REQUIRED_MINIBOSS_POOLS = new Map([
  [5, new Set(['golem', 'orc_warlord'])],
  [10, new Set(['bone_dragon', 'lich_king'])],
]);
const REQUIRED_FINAL_BOSS = { stage: 15, bossId: 'arena_overlord' };

function fail(message) {
  throw new Error(message);
}

function requireArray(value, label) {
  if (!Array.isArray(value)) fail(`${label} must be an array`);
  return value;
}

function collectIds(items, label, errors) {
  const ids = new Set();
  for (const [index, item] of requireArray(items, label).entries()) {
    if (!item || typeof item !== 'object') {
      errors.push(`${label}[${index}] must be an object`);
      continue;
    }
    if (typeof item.id !== 'string' || item.id.length === 0) {
      errors.push(`${label}[${index}] requires a non-empty string id`);
      continue;
    }
    if (ids.has(item.id)) errors.push(`${label} has duplicate id: ${item.id}`);
    ids.add(item.id);
  }
  return ids;
}

// This file validates two independent, optional sections so it can run directly against the
// real, split data files instead of requiring one large combined fixture that doesn't exist in
// the repo:
//   1. A hero roster shape (data/design/hero-codex-v1.json): { heroes: [...] }
//   2. A Map 1 encounter shape (data/design/map1-encounters-v1.json): { monsters: [...], stages: [...] }
function validateDemo1Policy(data) {
  const errors = [];
  const warnings = [];

  if (!data || typeof data !== 'object' || Array.isArray(data)) fail('root must be an object');
  if (data.heroes === undefined && data.monsters === undefined && data.stages === undefined) {
    fail('root must contain at least one of: heroes, monsters, stages');
  }

  if (data.heroes !== undefined) {
    const heroes = requireArray(data.heroes, 'heroes');
    const heroIds = collectIds(heroes, 'heroes', errors);

    for (const hero of heroes) {
      if (!hero || typeof hero !== 'object') continue;
      if (PROHIBITED_HERO_IDS.has(hero.id)) errors.push(`Prohibited hero id present: ${hero.id}`);
      if (hero.classTier === 0) errors.push(`Demo 1 prohibits classTier 0: ${hero.id}`);
    }

    const actualClass1 = new Set(
      heroes.filter((hero) => hero && hero.classTier === 1).map((hero) => hero.id),
    );
    for (const id of CLASS_1_IDS) {
      if (!actualClass1.has(id)) errors.push(`Missing required Class 1 hero: ${id}`);
    }
    for (const id of actualClass1) {
      if (!CLASS_1_IDS.has(id)) errors.push(`Unexpected Class 1 hero in Demo 1: ${id}`);
    }
    if (actualClass1.size !== CLASS_1_IDS.size) {
      errors.push(`Demo 1 must contain exactly ${CLASS_1_IDS.size} Class 1 heroes; found ${actualClass1.size}`);
    }

    if (heroIds.has('ninja')) {
      const ninja = heroes.find((hero) => hero && hero.id === 'ninja');
      if (ninja.classTier !== 3) errors.push('ninja must use classTier 3');
      if (ninja.shop?.enabled === true) errors.push('ninja must not be directly enabled in the normal Shop');
    } else {
      warnings.push('ninja secret-class definition is not present yet');
    }
  }

  if (data.monsters === undefined && data.stages === undefined) return { errors, warnings };

  const monsters = requireArray(data.monsters, 'monsters');
  const monsterIds = collectIds(monsters, 'monsters', errors);
  const stages = requireArray(data.stages, 'stages');

  for (const monster of monsters) {
    if (!monster || typeof monster !== 'object') continue;
    if (OBSOLETE_BOSS_IDS.has(monster.id) && monster.status !== 'obsolete') {
      errors.push(`Obsolete boss id ${monster.id} must be marked status:"obsolete"`);
    }
  }

  // Field names below (`stage`, `type`, `minibossPool`, `finalBossId`) match the actual shape of
  // data/design/map1-encounters-v1.json rather than a hypothetical combined-file schema, per the
  // rule to reuse the smallest existing shape instead of inventing a new one.
  const numbers = new Map();
  for (const stage of stages) {
    if (!stage || !Number.isInteger(stage.stage)) continue;
    if (numbers.has(stage.stage)) errors.push(`Duplicate stage number ${stage.stage}`);
    else numbers.set(stage.stage, stage);
  }

  for (let number = 1; number <= 15; number += 1) {
    if (!numbers.has(number)) errors.push(`Missing stage ${number}`);
  }

  for (const [stageNumber, requiredPool] of REQUIRED_MINIBOSS_POOLS) {
    const stage = numbers.get(stageNumber);
    if (!stage) continue;
    if (stage.type !== 'miniboss') errors.push(`Stage ${stageNumber} must be type:"miniboss"`);
    const pool = Array.isArray(stage.minibossPool) ? stage.minibossPool : [];
    const poolSet = new Set(pool);
    if (poolSet.size !== 2) {
      errors.push(`Stage ${stageNumber} minibossPool must contain exactly two unique ids; found ${poolSet.size}`);
    }
    for (const requiredId of requiredPool) {
      if (!poolSet.has(requiredId)) errors.push(`Stage ${stageNumber} minibossPool must include ${requiredId}`);
      if (!monsterIds.has(requiredId)) errors.push(`Stage ${stageNumber} minibossPool references unknown monster: ${requiredId}`);
    }
    for (const id of poolSet) {
      if (OBSOLETE_BOSS_IDS.has(id)) errors.push(`Stage ${stageNumber} minibossPool must not include obsolete boss id: ${id}`);
    }
  }

  const finalStage = numbers.get(REQUIRED_FINAL_BOSS.stage);
  if (finalStage) {
    if (finalStage.type !== 'boss') errors.push(`Stage ${REQUIRED_FINAL_BOSS.stage} must be type:"boss"`);
    if (finalStage.finalBossId !== REQUIRED_FINAL_BOSS.bossId) {
      errors.push(`Stage ${REQUIRED_FINAL_BOSS.stage} finalBossId must be ${REQUIRED_FINAL_BOSS.bossId}, found ${finalStage.finalBossId ?? '(none)'}`);
    }
    if (OBSOLETE_BOSS_IDS.has(finalStage.finalBossId)) {
      errors.push(`Stage ${REQUIRED_FINAL_BOSS.stage} must not use obsolete boss id: ${finalStage.finalBossId}`);
    }
  }

  const stage13 = numbers.get(13);
  if (stage13 && stage13.type !== 'normal') {
    errors.push('Stage 13 must be a normal stage (type:"normal"), no fixed boss assignment');
  }

  for (const stage of stages) {
    if (!stage || !Number.isInteger(stage.stage)) continue;
    if ([5, 10, 15].includes(stage.stage)) continue;
    if (stage.type === 'miniboss' || stage.type === 'boss') {
      warnings.push(`Stage ${stage.stage} is an extra ${stage.type} encounter`);
    }
  }

  return { errors, warnings };
}

async function main() {
  const path = process.argv[2];
  if (!path) {
    console.error('Usage: node tools/validate-demo1-policy.mjs <game-data.json>');
    process.exitCode = 2;
    return;
  }

  try {
    const data = JSON.parse(await readFile(path, 'utf8'));
    const { errors, warnings } = validateDemo1Policy(data);

    for (const warning of warnings) console.warn(`WARN: ${warning}`);
    for (const error of errors) console.error(`ERROR: ${error}`);

    if (errors.length > 0) {
      console.error(`Demo 1 policy validation failed with ${errors.length} error(s) and ${warnings.length} warning(s).`);
      process.exitCode = 1;
      return;
    }

    console.log(`Demo 1 policy validation passed with ${warnings.length} warning(s).`);
  } catch (error) {
    console.error(`Demo 1 policy validation failed: ${error.message}`);
    process.exitCode = 1;
  }
}

await main();
