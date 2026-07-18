#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '..');
const dataPath = path.join(root, 'data/design/weapon-vertical-slice-v1.json');
const localePath = path.join(root, 'data/weapon-vertical-slice-localization-v1.json');

const fail = (message) => {
  console.error(`ERROR: ${message}`);
  process.exitCode = 1;
};

const readJson = (p) => JSON.parse(fs.readFileSync(p, 'utf8'));
const data = readJson(dataPath);
const localization = readJson(localePath);

const weapons = Array.isArray(data.weapons) ? data.weapons : [];
const recipes = Array.isArray(data.fusionRecipes) ? data.fusionRecipes : [];
const byId = new Map();

if (data.scope?.heroWeaponSlots !== 2) fail('heroWeaponSlots must equal 2');
if (weapons.length !== 4) fail('vertical slice must define exactly 4 weapons');

for (const weapon of weapons) {
  if (!weapon.id || byId.has(weapon.id)) fail(`duplicate or missing weapon id: ${weapon.id}`);
  byId.set(weapon.id, weapon);
  if (![1, 2].includes(weapon.level)) fail(`${weapon.id}: unsupported level ${weapon.level}`);
  if (!Number.isInteger(weapon.price) || weapon.price <= 0) fail(`${weapon.id}: price must be a positive integer`);
  if (weapon.price !== (weapon.level === 1 ? 6 : 14)) fail(`${weapon.id}: unexpected price for level`);
  if (weapon.allowedOwners !== 'all_player_heroes') fail(`${weapon.id}: invalid allowedOwners`);
  if (weapon.equipLimitPerHero !== 1) fail(`${weapon.id}: equipLimitPerHero must equal 1`);
  const statEntries = Object.entries(weapon.stats ?? {});
  if (statEntries.length === 0) fail(`${weapon.id}: must define at least one stat`);
  for (const [key, value] of statEntries) {
    if (!['p_atk', 'm_atk', 'attack_speed_pct'].includes(key)) fail(`${weapon.id}: unsupported stat ${key}`);
    if (!Number.isFinite(value) || value <= 0) fail(`${weapon.id}: ${key} must be finite and positive`);
  }
}

const requiredIds = [
  'weapon.iron_sword',
  'weapon.apprentice_staff',
  'weapon.swift_gloves',
  'weapon.duelist_blade'
];
for (const id of requiredIds) if (!byId.has(id)) fail(`missing required weapon ${id}`);

if (recipes.length !== 1) fail('vertical slice must define exactly one fusion recipe');
for (const recipe of recipes) {
  if (!recipe.id) fail('fusion recipe id is required');
  if (!Array.isArray(recipe.inputs) || recipe.inputs.length !== 2) fail(`${recipe.id}: exactly two inputs required`);
  if (new Set(recipe.inputs).size !== recipe.inputs.length) fail(`${recipe.id}: duplicate inputs are not allowed in v1`);
  for (const input of recipe.inputs ?? []) if (!byId.has(input)) fail(`${recipe.id}: unknown input ${input}`);
  if (!byId.has(recipe.output)) fail(`${recipe.id}: unknown output ${recipe.output}`);
  if (recipe.goldCost !== 0 || recipe.consumesInputs !== true || recipe.automatic !== false) {
    fail(`${recipe.id}: fusion flags do not match v1 contract`);
  }
  if (byId.get(recipe.output)?.level !== 2) fail(`${recipe.id}: output must be level 2`);
  for (const input of recipe.inputs ?? []) if (byId.get(input)?.level !== 1) fail(`${recipe.id}: inputs must be level 1`);
}

const expectedInputs = new Set(['weapon.iron_sword', 'weapon.swift_gloves']);
const actualInputs = new Set(recipes[0]?.inputs ?? []);
if (expectedInputs.size !== actualInputs.size || [...expectedInputs].some((id) => !actualInputs.has(id))) {
  fail('fusion recipe must be Iron Sword + Swift Gloves');
}
if (recipes[0]?.output !== 'weapon.duelist_blade') fail('fusion output must be Duelist Blade');

for (const locale of ['th', 'en']) {
  const table = localization.locales?.[locale];
  if (!table) {
    fail(`missing locale ${locale}`);
    continue;
  }
  for (const weapon of weapons) {
    for (const key of [weapon.nameKey, weapon.descriptionKey]) {
      if (typeof table[key] !== 'string' || table[key].trim() === '') fail(`${locale}: missing localization ${key}`);
    }
  }
}

if (data.inventoryRules?.equipSlotsPerHero !== 2) fail('inventoryRules.equipSlotsPerHero must equal 2');
if (data.inventoryRules?.sameWeaponDuplicateOnOneHero !== false) fail('same weapon duplicates must be disabled in v1');
if (data.inventoryRules?.fullInventoryPurchaseBehavior !== 'reject_without_charging_gold') fail('full inventory purchase must reject before charge');
if (data.inventoryRules?.fusionOutputWhenInventoryFull !== 'reject_before_consuming_inputs') fail('fusion must reject before consuming inputs');
if (data.statApplicationRules?.noBaseMutation !== true || data.statApplicationRules?.noDoubleApplication !== true) {
  fail('stat application must prohibit base mutation and double application');
}

if (!process.exitCode) console.log('Weapon vertical slice validation passed.');
