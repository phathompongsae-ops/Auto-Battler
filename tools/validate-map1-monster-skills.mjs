#!/usr/bin/env node

import { readFile } from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';

const repoRoot = process.argv[2] ? path.resolve(process.argv[2]) : process.cwd();
const readJson = async (rel) => JSON.parse(await readFile(path.join(repoRoot, rel), 'utf8'));
const errors = [];
const fail = (message) => errors.push(message);

const encounter = await readJson('data/design/map1-encounters-v1.json');
const pack = await readJson('data/design/map1-monster-skills-v1.json');
const localization = await readJson('data/map1-monster-skills-localization-v1.json');

const activeOwners = new Map(
  encounter.monsters
    .filter((owner) => owner.status !== 'obsolete')
    .map((owner) => [owner.id, owner]),
);
const obsoleteOwners = new Set(
  encounter.monsters
    .filter((owner) => owner.status === 'obsolete')
    .map((owner) => owner.id),
);
const requiredSkillIds = new Set(
  [...activeOwners.values()].flatMap((owner) => owner.skillIds ?? []),
);
const allowedTargets = new Set([
  'nearest',
  'nearest_in_range',
  'cluster',
  'lowest_hp_ally',
  'lowest_hp_enemy',
  'backline',
  'hunter',
  'self',
]);
const allowedEffectTypes = new Set(['damage', 'shield']);
const allowedScalingStats = new Set(['pAtk', 'mAtk', 'hp']);
const allowedDamageTypes = new Set(['physical', 'magical', 'true']);

if (pack.schemaVersion !== 1) fail('schemaVersion must be 1');
if (!Array.isArray(pack.skills)) fail('skills must be an array');

const seen = new Set();
for (const [index, skill] of (pack.skills ?? []).entries()) {
  const prefix = `skills[${index}]`;
  if (!skill || typeof skill !== 'object' || Array.isArray(skill)) {
    fail(`${prefix} must be an object`);
    continue;
  }
  if (typeof skill.id !== 'string' || !skill.id) fail(`${prefix}.id must be a non-empty string`);
  if (seen.has(skill.id)) fail(`${prefix}.id duplicates ${skill.id}`);
  seen.add(skill.id);
  if (!requiredSkillIds.has(skill.id)) fail(`${prefix}.id ${skill.id} is not referenced by an active Map 1 owner`);
  if (!activeOwners.has(skill.ownerId)) fail(`${prefix}.ownerId ${skill.ownerId} is not an active Map 1 owner`);
  if (obsoleteOwners.has(skill.ownerId)) fail(`${prefix}.ownerId ${skill.ownerId} is obsolete`);
  const owner = activeOwners.get(skill.ownerId);
  if (owner && !(owner.skillIds ?? []).includes(skill.id)) {
    fail(`${prefix}.ownerId ${skill.ownerId} does not reference ${skill.id}`);
  }
  if (!Number.isFinite(skill.mana) || skill.mana < 0) fail(`${prefix}.mana must be finite and non-negative`);
  if (!allowedTargets.has(skill.target)) fail(`${prefix}.target ${skill.target} is unsupported`);
  if (!Number.isFinite(skill.castTime) || skill.castTime < 0) fail(`${prefix}.castTime must be finite and non-negative`);
  if (!['owner_range', 'fixed'].includes(skill.rangeMode)) fail(`${prefix}.rangeMode must be owner_range or fixed`);
  if (skill.rangeMode === 'fixed' && (!Number.isFinite(skill.range) || skill.range < 0)) {
    fail(`${prefix}.range must be finite and non-negative when rangeMode is fixed`);
  }
  if (skill.target === 'self') {
    if (skill.rangeMode !== 'fixed' || skill.range !== 0) fail(`${prefix} self-target skills must use fixed range 0`);
    if (skill.effect?.type !== 'shield') fail(`${prefix} self-target v1 skills must be shield effects`);
  }
  const effect = skill.effect;
  if (!effect || typeof effect !== 'object' || Array.isArray(effect)) {
    fail(`${prefix}.effect must be an object`);
  } else {
    if (!allowedEffectTypes.has(effect.type)) fail(`${prefix}.effect.type ${effect.type} is outside the v1 scope`);
    if (!allowedScalingStats.has(effect.scalingStat)) fail(`${prefix}.effect.scalingStat ${effect.scalingStat} is unsupported`);
    if (!Number.isFinite(effect.ratio) || effect.ratio <= 0) fail(`${prefix}.effect.ratio must be finite and > 0`);
    if (effect.type === 'damage' && !allowedDamageTypes.has(effect.damageType)) {
      fail(`${prefix}.effect.damageType is required for damage effects`);
    }
    if (effect.type === 'shield' && effect.damageType !== undefined) {
      fail(`${prefix}.effect.damageType must be absent for shield effects`);
    }
  }
  if (!skill.presentation || typeof skill.presentation !== 'object') fail(`${prefix}.presentation must be an object`);
  if (!Array.isArray(skill.tags)) fail(`${prefix}.tags must be an array`);
  for (const language of localization.requiredLanguages ?? []) {
    const table = localization[language];
    if (!table || typeof table !== 'object') {
      fail(`localization.${language} must be an object`);
      continue;
    }
    for (const suffix of ['name', 'description']) {
      const key = `${skill.id}.${suffix}`;
      if (typeof table[key] !== 'string' || !table[key].trim()) fail(`missing localization ${language}.${key}`);
    }
  }
}

for (const id of requiredSkillIds) {
  if (!seen.has(id)) fail(`active Map 1 skill reference has no definition: ${id}`);
}
if (seen.size !== requiredSkillIds.size) {
  fail(`expected exactly ${requiredSkillIds.size} active skill definitions, found ${seen.size}`);
}

const boneBreath = (pack.skills ?? []).find((skill) => skill.id === 'skill.miniboss_bone_breath');
const frostNova = (pack.skills ?? []).find((skill) => skill.id === 'skill.miniboss_lich_king_frost_nova');
for (const skill of [boneBreath, frostNova]) {
  if (skill && !(skill.effect?.damageType === 'magical' && skill.effect?.scalingStat === 'pAtk')) {
    fail(`${skill.id} must keep the explicit v1 magical-damage/pAtk-scaling decision`);
  }
}

if (errors.length) {
  console.error(`Map 1 monster skill validation failed (${errors.length} error${errors.length === 1 ? '' : 's'}):`);
  for (const error of errors) console.error(`  - ${error}`);
  process.exit(1);
}

console.log(`Map 1 monster skill validation passed: ${seen.size} active definitions, ${localization.requiredLanguages.length} languages.`);
