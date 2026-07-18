#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '..');
const data = JSON.parse(fs.readFileSync(path.join(root, 'data/design/weapon-vertical-slice-v1.json'), 'utf8'));
const localization = JSON.parse(fs.readFileSync(path.join(root, 'data/weapon-vertical-slice-localization-v1.json'), 'utf8'));
const fail = (message) => { console.error(`ERROR: ${message}`); process.exitCode = 1; };
const weapons = Array.isArray(data.weapons) ? data.weapons : [];
const recipes = Array.isArray(data.fusionRecipes) ? data.fusionRecipes : [];
const byId = new Map();

if (data.scope?.heroWeaponSlots !== 2) fail('heroWeaponSlots must equal 2');
if (weapons.length !== 5) fail('vertical slice must define exactly 5 equipment records');
for (const weapon of weapons) {
  if (!weapon.id || byId.has(weapon.id)) fail(`duplicate or missing weapon id: ${weapon.id}`);
  byId.set(weapon.id, weapon);
  if (![1, 2].includes(weapon.level)) fail(`${weapon.id}: unsupported level`);
  if (!Number.isInteger(weapon.price) || weapon.price !== (weapon.level === 1 ? 6 : 14)) fail(`${weapon.id}: invalid price`);
  if (weapon.allowedOwners !== 'all_player_heroes' || weapon.equipLimitPerHero !== 1) fail(`${weapon.id}: invalid equip contract`);
  const entries = Object.entries(weapon.stats ?? {});
  if (!entries.length) fail(`${weapon.id}: missing stats`);
  for (const [key, value] of entries) {
    if (!['p_atk', 'm_atk', 'attack_speed_pct', 'max_hp'].includes(key)) fail(`${weapon.id}: unsupported stat ${key}`);
    if (!Number.isFinite(value) || value <= 0) fail(`${weapon.id}: invalid ${key}`);
  }
}

const requiredIds = ['weapon.iron_sword','weapon.apprentice_staff','weapon.swift_gloves','weapon.iron_armor','weapon.duelist_blade'];
for (const id of requiredIds) if (!byId.has(id)) fail(`missing equipment ${id}`);
const armor = byId.get('weapon.iron_armor');
if (Object.keys(armor?.stats ?? {}).length !== 1 || armor?.stats?.max_hp !== 120) fail('Iron Armor must grant only max_hp +120');

if (recipes.length !== 1) fail('exactly one fusion recipe required');
const recipe = recipes[0] ?? {};
const expectedInputs = new Set(['weapon.iron_sword', 'weapon.swift_gloves']);
const actualInputs = new Set(recipe.inputs ?? []);
if (actualInputs.size !== 2 || [...expectedInputs].some((id) => !actualInputs.has(id))) fail('fusion inputs must be Iron Sword + Swift Gloves');
if (recipe.output !== 'weapon.duelist_blade' || recipe.goldCost !== 0 || recipe.consumesInputs !== true || recipe.automatic !== false) fail('fusion contract mismatch');

const shop = data.shopRules ?? {};
if (shop.shopType !== 'equipment') fail('shopType must be equipment');
if (shop.offerSlots !== 2 || shop.refreshCost !== 2) fail('equipment shop must have 2 offers and cost 2 to refresh');
if (shop.freeRefreshPerStage !== 0 || shop.refreshesSharedWithHeroShop !== false) fail('equipment refresh must be paid and independent');
if (JSON.stringify(shop.availableLevels) !== JSON.stringify([1])) fail('only L1 may be offered');
if (shop.level2DirectPurchase !== false || shop.level3DirectPurchase !== false) fail('L2/L3 direct purchase must be disabled');
if (shop.duplicateOffersAllowed !== false || shop.automaticStageRewards !== false) fail('duplicate offers and automatic rewards must be disabled');
const expectedPool = new Set(requiredIds.filter((id) => byId.get(id)?.level === 1));
const actualPool = new Set(shop.offerPool ?? []);
if (expectedPool.size !== actualPool.size || [...expectedPool].some((id) => !actualPool.has(id))) fail('offer pool must contain exactly four L1 items');

if (data.inventoryRules?.inventoryCapacity !== 8) fail('inventory capacity must equal 8');
if (data.inventoryRules?.equipSlotsPerHero !== 2) fail('equip slots must equal 2');
if (data.inventoryRules?.sameWeaponDuplicateOnOneHero !== false) fail('same-item duplicates must be disabled');
if (data.inventoryRules?.fullInventoryPurchaseBehavior !== 'reject_without_charging_gold') fail('full inventory must reject before charge');
if (data.inventoryRules?.fusionOutputWhenInventoryFull !== 'reject_before_consuming_inputs') fail('fusion must reject before consuming inputs');
if (data.statApplicationRules?.maxHpApplication !== 'add_once_to_star_scaled_base_max_hp_before_percent_buffs') fail('max HP ordering must be explicit');
if (data.statApplicationRules?.noBaseMutation !== true || data.statApplicationRules?.noDoubleApplication !== true) fail('base mutation/double application prohibited');

for (const locale of ['th', 'en']) {
  const table = localization.locales?.[locale];
  if (!table) { fail(`missing locale ${locale}`); continue; }
  for (const weapon of weapons) {
    for (const key of [weapon.nameKey, weapon.descriptionKey]) if (typeof table[key] !== 'string' || !table[key].trim()) fail(`${locale}: missing ${key}`);
  }
}

if (!process.exitCode) console.log('Weapon vertical slice validation passed.');
