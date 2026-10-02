#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, '..');
const dataPath = process.argv[2]
  ? path.resolve(process.cwd(), process.argv[2])
  : path.join(repoRoot, 'data/design/class-evolution-v1.json');

const errors = [];
const expectedClass1Ids = new Set([
  'fighter',
  'swordman',
  'archer',
  'mage',
  'summoner',
  'acolyte',
  'merchant'
]);

function fail(message) {
  errors.push(message);
}

function readJson(filePath) {
  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf8'));
  } catch (error) {
    console.error(`Unable to read ${filePath}: ${error.message}`);
    process.exit(2);
  }
}

function hasDuplicates(values) {
  return new Set(values).size !== values.length;
}

const data = readJson(dataPath);
const roleIcons = Array.isArray(data.roleIcons) ? data.roleIcons : [];
const classLines = Array.isArray(data.classLines) ? data.classLines : [];
const roleIds = roleIcons.map((role) => role.id);
const roleIdSet = new Set(roleIds);

if (data.schemaVersion !== 1) fail('schemaVersion must equal 1.');
if (hasDuplicates(roleIds)) fail('roleIcons contains duplicate ids.');
if (classLines.length !== 7) fail(`classLines must contain exactly 7 entries; found ${classLines.length}.`);

for (const role of roleIcons) {
  for (const key of ['id', 'nameKey', 'descriptionKey', 'assetId']) {
    if (typeof role?.[key] !== 'string' || role[key].length === 0) {
      fail(`roleIcons entry is missing ${key}.`);
    }
  }
}

const class1Ids = classLines.map((line) => line.class1Id);
if (hasDuplicates(class1Ids)) fail('classLines contains duplicate class1Id values.');

for (const expected of expectedClass1Ids) {
  if (!class1Ids.includes(expected)) fail(`Missing Class 1 line: ${expected}.`);
}
for (const actual of class1Ids) {
  if (!expectedClass1Ids.has(actual)) fail(`Unexpected Class 1 line: ${actual}.`);
}

for (const line of classLines) {
  const label = line.class1Id ?? '<missing class1Id>';
  const options = Array.isArray(line.evolutionOptions) ? line.evolutionOptions : [];
  const branches = Array.isArray(line.branches) ? line.branches : [];
  const baseRoles = Array.isArray(line.roleIconIds) ? line.roleIconIds : [];

  if (options.length !== 2 || hasDuplicates(options)) {
    fail(`${label}: evolutionOptions must contain exactly two unique hero ids.`);
  }
  if (branches.length !== 2) fail(`${label}: branches must contain exactly two entries.`);
  if (baseRoles.length < 2 || baseRoles.length > 3 || hasDuplicates(baseRoles)) {
    fail(`${label}: roleIconIds must contain two or three unique role ids.`);
  }

  for (const roleId of baseRoles) {
    if (!roleIdSet.has(roleId)) fail(`${label}: unknown role icon ${roleId}.`);
  }

  const branchIds = branches.map((branch) => branch.heroId);
  if (hasDuplicates(branchIds)) fail(`${label}: branch hero ids must be unique.`);
  if (options.length === 2 && branchIds.length === 2) {
    const optionSet = new Set(options);
    if (!branchIds.every((id) => optionSet.has(id))) {
      fail(`${label}: branches must exactly match evolutionOptions.`);
    }
  }

  for (const branch of branches) {
    const branchLabel = `${label} -> ${branch.heroId ?? '<missing heroId>'}`;
    const roles = Array.isArray(branch.roleIconIds) ? branch.roleIconIds : [];
    const strengths = Array.isArray(branch.strengthKeys) ? branch.strengthKeys : [];
    const weaknesses = Array.isArray(branch.weaknessKeys) ? branch.weaknessKeys : [];

    if (roles.length < 2 || roles.length > 3 || hasDuplicates(roles)) {
      fail(`${branchLabel}: roleIconIds must contain two or three unique role ids.`);
    }
    for (const roleId of roles) {
      if (!roleIdSet.has(roleId)) fail(`${branchLabel}: unknown role icon ${roleId}.`);
    }
    if (!['physical', 'magical', 'hybrid'].includes(branch.damageProfile)) {
      fail(`${branchLabel}: invalid damageProfile ${branch.damageProfile}.`);
    }
    if (!['melee', 'mid', 'long'].includes(branch.rangeCategory)) {
      fail(`${branchLabel}: invalid rangeCategory ${branch.rangeCategory}.`);
    }
    if (typeof branch.playstyleKey !== 'string' || branch.playstyleKey.length === 0) {
      fail(`${branchLabel}: playstyleKey is required.`);
    }
    if (strengths.length < 1 || hasDuplicates(strengths)) {
      fail(`${branchLabel}: strengthKeys must contain unique localization keys.`);
    }
    if (weaknesses.length < 1 || hasDuplicates(weaknesses)) {
      fail(`${branchLabel}: weaknessKeys must contain unique localization keys.`);
    }
  }
}

if (errors.length > 0) {
  console.error(`Class evolution validation failed (${errors.length} issue${errors.length === 1 ? '' : 's'}):`);
  for (const error of errors) console.error(`- ${error}`);
  process.exit(1);
}

console.log(`Class evolution data is valid: ${classLines.length} class lines, ${roleIcons.length} role icons.`);
