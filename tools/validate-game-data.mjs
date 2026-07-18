#!/usr/bin/env node

import { readFile } from 'node:fs/promises';
import process from 'node:process';

const TARGETING_BEHAVIORS = new Set([
  'nearest',
  'nearest_in_range',
  'cluster',
  'lowest_hp_ally',
  'lowest_hp_enemy',
  'backline',
  'hunter',
]);

const MONSTER_KINDS = new Set(['normal', 'elite', 'miniboss', 'boss']);
const ENCOUNTER_TYPES = new Set(['normal', 'miniboss', 'boss']);
const HERO_GENDERS = new Set(['male', 'female']);
const REQUIRED_LANGUAGES = ['th', 'en'];

function fail(message) {
  throw new Error(message);
}

function isFiniteNumber(value) {
  return typeof value === 'number' && Number.isFinite(value);
}

function requireArray(value, label) {
  if (!Array.isArray(value)) fail(`${label} must be an array`);
  return value;
}

function requireObject(value, label) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    fail(`${label} must be an object`);
  }
  return value;
}

function collectById(items, label, errors) {
  const map = new Map();
  for (const [index, item] of requireArray(items, label).entries()) {
    if (!item || typeof item !== 'object') {
      errors.push(`${label}[${index}] must be an object`);
      continue;
    }
    if (typeof item.id !== 'string' || item.id.length === 0) {
      errors.push(`${label}[${index}] requires a non-empty string id`);
      continue;
    }
    if (map.has(item.id)) errors.push(`${label} has duplicate id: ${item.id}`);
    else map.set(item.id, item);
  }
  return map;
}

function checkNonNegativeStats(stats, label, errors) {
  if (!stats || typeof stats !== 'object') {
    errors.push(`${label}.stats must be an object`);
    return;
  }

  for (const [key, value] of Object.entries(stats)) {
    if (!isFiniteNumber(value)) errors.push(`${label}.stats.${key} must be finite`);
    else if (value < 0) errors.push(`${label}.stats.${key} must be non-negative`);
  }
}

function checkTargeting(value, label, errors) {
  if (!TARGETING_BEHAVIORS.has(value)) {
    errors.push(`${label} has invalid targetingBehavior: ${String(value)}`);
  }
}

function checkLocalizationKey(localization, key, label, errors) {
  if (typeof key !== 'string' || key.length === 0) {
    errors.push(`${label} must be a non-empty localization key`);
    return;
  }

  for (const language of REQUIRED_LANGUAGES) {
    if (!localization[language] || typeof localization[language][key] !== 'string') {
      errors.push(`Missing ${language} localization key: ${key}`);
    }
  }
}

function validate(data) {
  const errors = [];
  const warnings = [];

  requireObject(data, 'root');
  if (data.schemaVersion !== 1) errors.push('schemaVersion must equal 1');

  const heroes = collectById(data.heroes, 'heroes', errors);
  const monsters = collectById(data.monsters, 'monsters', errors);
  const skills = collectById(data.skills, 'skills', errors);
  const weapons = collectById(data.weapons, 'weapons', errors);
  const fusionRules = collectById(data.fusionRules, 'fusionRules', errors);
  const maps = collectById(data.maps, 'maps', errors);
  const stages = collectById(data.stages, 'stages', errors);
  const localization = requireObject(data.localization, 'localization');

  for (const [id, hero] of heroes) {
    const label = `hero ${id}`;
    if (!HERO_GENDERS.has(hero.gender)) errors.push(`${label} has invalid gender`);
    if (!Number.isInteger(hero.classTier) || hero.classTier < 0 || hero.classTier > 3) {
      errors.push(`${label} classTier must be an integer from 0 to 3`);
    }
    checkTargeting(hero.targetingBehavior, label, errors);
    checkNonNegativeStats(hero.stats, label, errors);
    if (!skills.has(hero.skillId)) errors.push(`${label} references unknown skillId: ${hero.skillId}`);
    checkLocalizationKey(localization, hero.nameKey, `${label}.nameKey`, errors);
    checkLocalizationKey(localization, hero.descriptionKey, `${label}.descriptionKey`, errors);
  }

  for (const [id, monster] of monsters) {
    const label = `monster ${id}`;
    if (!MONSTER_KINDS.has(monster.kind)) errors.push(`${label} has invalid kind`);
    checkTargeting(monster.targetingBehavior, label, errors);
    checkNonNegativeStats(monster.stats, label, errors);
    for (const skillId of requireArray(monster.skillIds, `${label}.skillIds`)) {
      if (!skills.has(skillId)) errors.push(`${label} references unknown skillId: ${skillId}`);
    }
    checkLocalizationKey(localization, monster.nameKey, `${label}.nameKey`, errors);
  }

  for (const [id, skill] of skills) {
    const label = `skill ${id}`;
    checkLocalizationKey(localization, skill.nameKey, `${label}.nameKey`, errors);
    checkLocalizationKey(localization, skill.descriptionKey, `${label}.descriptionKey`, errors);
    if (!skill.cast || typeof skill.cast !== 'object') errors.push(`${label}.cast must be an object`);
    else {
      checkTargeting(skill.cast.targetingBehavior, `${label}.cast`, errors);
      for (const key of ['manaCost', 'range', 'castTime']) {
        const value = skill.cast[key];
        if (!isFiniteNumber(value) || value < 0) errors.push(`${label}.cast.${key} must be finite and non-negative`);
      }
    }
    if (!Array.isArray(skill.effects) || skill.effects.length === 0) {
      errors.push(`${label}.effects must contain at least one effect`);
    }
  }

  for (const [id, weapon] of weapons) {
    const label = `weapon ${id}`;
    if (!Number.isInteger(weapon.level) || weapon.level < 1 || weapon.level > 3) {
      errors.push(`${label}.level must be 1, 2, or 3`);
    }
    if (!weapon.stats || typeof weapon.stats !== 'object' || Object.keys(weapon.stats).length === 0) {
      errors.push(`${label}.stats must contain at least one stat`);
    } else {
      for (const [stat, value] of Object.entries(weapon.stats)) {
        if (!isFiniteNumber(value)) errors.push(`${label}.stats.${stat} must be finite`);
      }
    }
    for (const inputId of requireArray(weapon.fusionInputs, `${label}.fusionInputs`)) {
      if (!weapons.has(inputId)) errors.push(`${label} references unknown fusion input: ${inputId}`);
    }
    checkLocalizationKey(localization, weapon.nameKey, `${label}.nameKey`, errors);
  }

  for (const [id, rule] of fusionRules) {
    const label = `fusion rule ${id}`;
    if (!Array.isArray(rule.inputs) || rule.inputs.length < 2) {
      errors.push(`${label} requires at least two inputs`);
      continue;
    }

    const pool = rule.kind === 'weapon_upgrade' ? weapons : heroes;
    for (const inputId of rule.inputs) {
      if (!pool.has(inputId)) errors.push(`${label} references unknown input: ${inputId}`);
    }
    if (!pool.has(rule.output)) errors.push(`${label} references unknown output: ${rule.output}`);

    if (rule.kind === 'hero_class_upgrade' && (rule.inputTier !== 1 || rule.outputTier !== 2)) {
      errors.push(`${label} must currently upgrade Class 1 to Class 2`);
    }
  }

  const stageIdsByMap = new Map();
  for (const [id, stage] of stages) {
    const label = `stage ${id}`;
    if (!maps.has(stage.mapId)) errors.push(`${label} references unknown mapId: ${stage.mapId}`);
    if (!Number.isInteger(stage.stageNumber) || stage.stageNumber < 1 || stage.stageNumber > 15) {
      errors.push(`${label}.stageNumber must be from 1 to 15`);
    }
    if (!ENCOUNTER_TYPES.has(stage.encounterType)) errors.push(`${label} has invalid encounterType`);
    if (!isFiniteNumber(stage.statMultiplier) || stage.statMultiplier <= 0) {
      errors.push(`${label}.statMultiplier must be finite and positive`);
    }
    for (const monsterId of requireArray(stage.allowedMonsterIds, `${label}.allowedMonsterIds`)) {
      if (!monsters.has(monsterId)) errors.push(`${label} references unknown monster: ${monsterId}`);
    }
    for (const bossId of requireArray(stage.bossPool, `${label}.bossPool`)) {
      if (!monsters.has(bossId)) errors.push(`${label} references unknown boss: ${bossId}`);
    }
    if (stage.encounterType === 'boss' && stage.bossPool.length === 0) {
      errors.push(`${label} is a boss encounter without a bossPool`);
    }
    if (![1, 2, 3].every((level) => !stage.weaponDropLevels.includes(level) || Number.isInteger(level))) {
      errors.push(`${label}.weaponDropLevels contains invalid values`);
    }

    const list = stageIdsByMap.get(stage.mapId) || [];
    list.push(stage);
    stageIdsByMap.set(stage.mapId, list);
  }

  for (const [id, map] of maps) {
    const label = `map ${id}`;
    const referencedStageIds = requireArray(map.stageIds, `${label}.stageIds`);
    for (const stageId of referencedStageIds) {
      if (!stages.has(stageId)) errors.push(`${label} references unknown stage: ${stageId}`);
    }
    if (referencedStageIds.length !== 15) {
      warnings.push(`${label} currently has ${referencedStageIds.length}/15 stage IDs`);
    }
    if (!heroes.has(map.secretClassUnlock)) {
      errors.push(`${label} references unknown secretClassUnlock: ${map.secretClassUnlock}`);
    }

    const ownedStages = stageIdsByMap.get(id) || [];
    const numbers = new Set(ownedStages.map((stage) => stage.stageNumber));
    for (let number = 1; number <= 15; number += 1) {
      if (!numbers.has(number)) warnings.push(`${label} is missing stage number ${number}`);
    }
  }

  return { errors, warnings };
}

async function main() {
  const path = process.argv[2];
  if (!path) {
    console.error('Usage: node tools/validate-game-data.mjs <game-data.json>');
    process.exitCode = 2;
    return;
  }

  try {
    const source = await readFile(path, 'utf8');
    const data = JSON.parse(source);
    const { errors, warnings } = validate(data);

    for (const warning of warnings) console.warn(`WARN: ${warning}`);
    for (const error of errors) console.error(`ERROR: ${error}`);

    if (errors.length > 0) {
      console.error(`Validation failed with ${errors.length} error(s) and ${warnings.length} warning(s).`);
      process.exitCode = 1;
      return;
    }

    console.log(`Validation passed with ${warnings.length} warning(s).`);
  } catch (error) {
    console.error(`Validation failed: ${error.message}`);
    process.exitCode = 1;
  }
}

await main();
